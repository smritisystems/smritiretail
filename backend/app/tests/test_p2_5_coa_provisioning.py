"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.49.4
Created      : 2026-10-02
Modified     : 2026-10-02
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import uuid
import pytest
from sqlalchemy import select, func

from app.models.tenant import Company, Branch
from app.models.accounting import Account
from scripts.provision_p2_5_coas import (
    provision_company_p2_5_coas,
    audit_company_coa_status,
    CANONICAL_P2_5_COA_SPECS,
)

pytestmark = pytest.mark.asyncio


async def _setup_test_company_with_parent_2000(db_session, suffix: str):
    """Sets up a test company and branch with only base parent 2000 account (simulating legacy tenant)."""
    company_id = f"COMP-COA-{suffix}"
    branch_id = f"BR-COA-{suffix}"

    company = Company(
        id=company_id,
        company_code=f"C{suffix[:6].upper()}",
        name=f"COA Test Company {suffix}",
        is_active=True,
        is_deleted=False,
    )
    branch = Branch(
        id=branch_id,
        code=f"B{suffix[:6].upper()}",
        company_id=company_id,
        name=f"COA Test Branch {suffix}",
        is_active=True,
        is_deleted=False,
    )
    db_session.add_all([company, branch])
    await db_session.flush()

    # Create base liability parent account 2000
    parent_2000 = Account(
        id=f"acc_2000_{company_id}",
        uuid=str(uuid.uuid4()),
        company_id=company_id,
        branch_id=branch_id,
        account_code="2000",
        account_name="Liabilities",
        account_type="LIABILITY",
        root_type="LIABILITY",
        parent_account_id=None,
        is_group=True,
        currency="INR",
        is_active=True,
        is_system=True,
        version=1,
    )
    db_session.add(parent_2000)
    await db_session.commit()

    return company_id, branch_id, parent_2000


async def test_coa_2050_2060_idempotent_provisioning(db_session):
    """
    Verifies that provision_company_p2_5_coas:
    RUN 1 -> creates missing accounts 2050 and 2060
    RUN 2 -> creates zero additional accounts (reports already existing)
    RUN 3 -> creates zero additional accounts (reports already existing)
    Existing accounts are never duplicated.
    """
    suffix = uuid.uuid4().hex[:8]
    company_id, branch_id, parent_2000 = await _setup_test_company_with_parent_2000(db_session, suffix)

    # 1. Audit before provisioning
    audit_pre = await audit_company_coa_status(db_session, company_id)
    assert audit_pre["parent_2000_exists"] is True
    assert audit_pre["acc_2050_exists"] is False
    assert audit_pre["acc_2060_exists"] is False

    # 2. RUN 1: Should create exactly accounts 2050 and 2060
    res_run1 = await provision_company_p2_5_coas(db_session, company_id)
    assert sorted(res_run1["created"]) == ["2050", "2060"]
    assert res_run1["already_existing"] == []

    # Verify rows in DB after Run 1
    stmt_2050 = select(Account).where(Account.company_id == company_id, Account.account_code == "2050")
    acc_2050 = (await db_session.execute(stmt_2050)).scalar_one_or_none()
    assert acc_2050 is not None
    assert acc_2050.account_name == "Customer Advance Liability"
    assert acc_2050.account_type == "LIABILITY"
    assert acc_2050.root_type == "LIABILITY"
    assert acc_2050.parent_account_id == parent_2000.id

    stmt_2060 = select(Account).where(Account.company_id == company_id, Account.account_code == "2060")
    acc_2060 = (await db_session.execute(stmt_2060)).scalar_one_or_none()
    assert acc_2060 is not None
    assert acc_2060.account_name == "Customer Credit Note & Wallet Liability"
    assert acc_2060.account_type == "LIABILITY"
    assert acc_2060.root_type == "LIABILITY"
    assert acc_2060.parent_account_id == parent_2000.id

    # 3. RUN 2: Must be completely idempotent (0 created, 2 already existing)
    res_run2 = await provision_company_p2_5_coas(db_session, company_id)
    assert res_run2["created"] == []
    assert sorted(res_run2["already_existing"]) == ["2050", "2060"]

    # 4. RUN 3: Must remain completely idempotent (0 created, 2 already existing)
    res_run3 = await provision_company_p2_5_coas(db_session, company_id)
    assert res_run3["created"] == []
    assert sorted(res_run3["already_existing"]) == ["2050", "2060"]

    # 5. Verify total count for 2050 and 2060 is strictly 1 each
    cnt_2050 = (await db_session.execute(
        select(func.count(Account.id)).where(Account.company_id == company_id, Account.account_code == "2050")
    )).scalar()
    assert cnt_2050 == 1

    cnt_2060 = (await db_session.execute(
        select(func.count(Account.id)).where(Account.company_id == company_id, Account.account_code == "2060")
    )).scalar()
    assert cnt_2060 == 1
