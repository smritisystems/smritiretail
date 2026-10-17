"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.91.0
Created      : 2026-10-17
Modified     : 2026-10-17
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Unit & Integration Tests — Billing Profile Engine
"""

import uuid
import pytest
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.tenant import Company
from app.services.billing_profile_service import BillingProfileService, VALID_PROFILES


@pytest.mark.asyncio
async def test_billing_profile_lifecycle_and_precedence(db_session: AsyncSession):
    company_id = f"CMP-{uuid.uuid4().hex[:8].upper()}"
    company = Company(id=company_id, name="Test Profile Retailer", is_active=True)
    db_session.add(company)
    await db_session.commit()

    # 1. Unconfigured State Check
    prof = await BillingProfileService.get_effective_profile(db_session, company_id)
    assert prof["configured"] is False
    assert prof["billing_profile"] is None
    assert prof["effective_configuration"] is None

    # 2. Rejection of invalid or combined profile
    with pytest.raises(HTTPException) as exc_invalid:
        await BillingProfileService.setup_initial_profile(
            session=db_session,
            company_id=company_id,
            profile="COMBINED_B2B_B2C",
            updated_by="admin",
        )
    assert exc_invalid.value.status_code == 400
    assert "SMRITI-CONF-002" in exc_invalid.value.detail

    # 3. Initial Setup with B2C_ONLY
    setup_res = await BillingProfileService.setup_initial_profile(
        session=db_session,
        company_id=company_id,
        profile="B2C_ONLY",
        updated_by="admin",
    )
    assert setup_res["configured"] is True
    assert setup_res["billing_profile"] == "B2C_ONLY"
    eff = setup_res["effective_configuration"]
    assert eff["shift_management"] == "ENABLED"
    assert eff["customer_po_reference"] == "HIDDEN"
    assert eff["customer_selection_required"] is False
    assert eff["default_invoice_format"] == "RETAIL_RECEIPT"
    assert len(setup_res["history"]) == 1
    assert setup_res["history"][0]["new_profile"] == "B2C_ONLY"

    # 4. Duplicate Setup Blocked
    with pytest.raises(HTTPException) as exc_dup:
        await BillingProfileService.setup_initial_profile(
            session=db_session,
            company_id=company_id,
            profile="B2C_ONLY",
            updated_by="admin",
        )
    assert exc_dup.value.status_code == 400
    assert "SMRITI-CONF-001" in exc_dup.value.detail

    # 5. Custom Overrides via Administrator Configuration (Precedence Tier 1)
    conf_res = await BillingProfileService.update_configuration_overrides(
        session=db_session,
        company_id=company_id,
        overrides={
            "shift_management": "DISABLED",
            "customer_po_reference": "OPTIONAL",
            "repeat_barcode_policy": "ASK_USER",
        },
        updated_by="admin",
    )
    eff_conf = conf_res["effective_configuration"]
    assert eff_conf["shift_management"] == "DISABLED"  # Override took precedence over B2C default
    assert eff_conf["customer_po_reference"] == "OPTIONAL"
    assert eff_conf["repeat_barcode_policy"] == "ASK_USER"

    # 6. Authorized Profile Switch to B2B_ONLY with Reason Audit
    switch_res = await BillingProfileService.switch_profile(
        session=db_session,
        company_id=company_id,
        new_profile="B2B_ONLY",
        reason="Corporate transition to wholesale distribution business",
        updated_by="admin",
    )
    assert switch_res["configured"] is True
    assert switch_res["billing_profile"] == "B2B_ONLY"
    assert len(switch_res["history"]) == 2
    assert switch_res["history"][1]["old_profile"] == "B2C_ONLY"
    assert switch_res["history"][1]["new_profile"] == "B2B_ONLY"
    assert "wholesale distribution" in switch_res["history"][1]["reason"]
    eff_b2b = switch_res["effective_configuration"]
    assert eff_b2b["customer_selection_required"] is True
    assert eff_b2b["default_invoice_format"] == "B2B_TAX_INVOICE"
