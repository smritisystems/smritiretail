"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.16.0
Created      : 2026-10-08
Modified     : 2026-10-08
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: P0-1 Verification Test Suite
"""

import pytest
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock
from fastapi import HTTPException

from app.models.crm import Customer, CustomerGroup
from app.services.customer_discount_policy import (
    CustomerDiscountPolicy,
    WALK_IN_CUSTOMER_ID,
    resolve_customer_discount_policy,
    validate_customer_discount_policy,
)


@pytest.mark.asyncio
async def test_walkin_customer_discount_policy():
    session = AsyncMock()
    policy = await resolve_customer_discount_policy(
        session=session,
        customer_id=WALK_IN_CUSTOMER_ID,
        company_id="COMP-001",
        branch_id="MAIN",
    )
    assert policy.customer is None
    assert policy.group is None
    assert policy.max_discount_percent == Decimal("0.00")
    assert policy.can_receive_discount is False


@pytest.mark.asyncio
async def test_reliance_without_group_does_not_get_50_percent():
    session = AsyncMock()
    cust = Customer(
        id="cust-reliance-1",
        name="Reliance Retail Limited",
        code="RIL-MUMBAI-01",
        company_id="COMP-001",
        branch_id="MAIN",
        customer_group_id=None,
    )
    mock_res = MagicMock()
    mock_res.scalars.return_value.first.return_value = cust
    session.execute.return_value = mock_res

    policy = await resolve_customer_discount_policy(
        session=session,
        customer_id="cust-reliance-1",
        company_id="COMP-001",
        branch_id="MAIN",
    )
    # MUST NOT be 50%
    assert policy.max_discount_percent == Decimal("0.00")
    assert policy.can_receive_discount is False


@pytest.mark.asyncio
async def test_cust_001_without_group_does_not_get_50_percent():
    session = AsyncMock()
    cust = Customer(
        id="cust-001-id",
        name="Institutional Buyer",
        code="CUST-001",
        company_id="COMP-001",
        branch_id="MAIN",
        customer_group_id=None,
    )
    mock_res = MagicMock()
    mock_res.scalars.return_value.first.return_value = cust
    session.execute.return_value = mock_res

    policy = await resolve_customer_discount_policy(
        session=session,
        customer_id="cust-001-id",
        company_id="COMP-001",
        branch_id="MAIN",
    )
    assert policy.max_discount_percent == Decimal("0.00")
    assert policy.can_receive_discount is False


@pytest.mark.asyncio
async def test_customer_with_configured_group_discount():
    session = AsyncMock()
    group = CustomerGroup(
        id="grp-tier1",
        name="Key Accounts Tier 1",
        company_id="COMP-001",
        branch_id="MAIN",
        max_discount_percent=Decimal("25.00"),
        can_receive_discount=True,
    )
    cust = Customer(
        id="cust-key-1",
        name="Key Account Customer",
        code="KEY-01",
        company_id="COMP-001",
        branch_id="MAIN",
        customer_group_id="grp-tier1",
    )

    async def mock_exec(stmt, *args, **kwargs):
        stmt_str = str(stmt).lower()
        res = MagicMock()
        if "customer_groups" in stmt_str:
            res.scalars.return_value.first.return_value = group
        elif "customers" in stmt_str:
            res.scalars.return_value.first.return_value = cust
        else:
            res.scalars.return_value.first.return_value = None
            res.scalars.return_value.all.return_value = []
        return res

    session.execute.side_effect = mock_exec

    policy = await resolve_customer_discount_policy(
        session=session,
        customer_id="cust-key-1",
        company_id="COMP-001",
        branch_id="MAIN",
    )
    assert policy.max_discount_percent == Decimal("25.00")
    assert policy.can_receive_discount is True


@pytest.mark.asyncio
async def test_institutional_group_50_percent_discount():
    session = AsyncMock()
    group = CustomerGroup(
        id="grp-inst-50",
        name="Enterprise Institutional 50",
        company_id="COMP-001",
        branch_id="MAIN",
        max_discount_percent=Decimal("50.00"),
        can_receive_discount=True,
    )
    cust = Customer(
        id="cust-reliance-2",
        name="Reliance Retail Limited",
        code="RIL-002",
        company_id="COMP-001",
        branch_id="MAIN",
        customer_group_id="grp-inst-50",
    )

    async def mock_exec(stmt, *args, **kwargs):
        stmt_str = str(stmt).lower()
        res = MagicMock()
        if "customer_groups" in stmt_str:
            res.scalars.return_value.first.return_value = group
        elif "customers" in stmt_str:
            res.scalars.return_value.first.return_value = cust
        else:
            res.scalars.return_value.first.return_value = None
            res.scalars.return_value.all.return_value = []
        return res

    session.execute.side_effect = mock_exec

    policy = await resolve_customer_discount_policy(
        session=session,
        customer_id="cust-reliance-2",
        company_id="COMP-001",
        branch_id="MAIN",
    )
    # Entitled to 50% through group configuration, NOT source-code identity matching
    assert policy.max_discount_percent == Decimal("50.00")
    assert policy.can_receive_discount is True


def test_validate_customer_discount_policy():
    cust = Customer(id="c1", name="Test Customer")
    group = CustomerGroup(id="g1", name="Test Group", max_discount_percent=Decimal("20.00"), can_receive_discount=True)
    policy = CustomerDiscountPolicy(
        customer=cust,
        group=group,
        max_discount_percent=Decimal("20.00"),
        can_receive_discount=True,
    )

    # Valid discount within limit: 15% of 1000 = 150
    validate_customer_discount_policy(policy, Decimal("150.00"), Decimal("1000.00"))

    # Exactly at limit: 20% of 1000 = 200
    validate_customer_discount_policy(policy, Decimal("200.00"), Decimal("1000.00"))

    # Exceeds limit: 25% of 1000 = 250 -> HTTPException
    with pytest.raises(HTTPException) as exc_info:
        validate_customer_discount_policy(policy, Decimal("250.00"), Decimal("1000.00"))
    assert exc_info.value.status_code == 400
    assert "exceeds the group limit of 20.00%" in exc_info.value.detail


def test_no_hardcoded_reliance_in_source():
    import inspect
    from app.services import customer_discount_policy
    source = inspect.getsource(customer_discount_policy)
    assert "RELIANCE" not in source
    assert "RIL" not in source
    assert "CUST-001" not in source
