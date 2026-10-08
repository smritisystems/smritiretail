"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.33.0
Created      : 2026-10-09
Modified     : 2026-10-09
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Phase 3 Master Registry & Tenant Defaults Verification Suite
"""

import pytest
from decimal import Decimal
from unittest.mock import AsyncMock, patch, MagicMock

from app.models.crm import Customer, CustomerGroup
from app.services.customer_discount_policy import (
    CustomerDiscountPolicy,
    WALK_IN_CUSTOMER_ID,
    resolve_customer_discount_policy,
)
from app.services.master_lookup_presets import (
    get_standard_lookup_presets,
    STANDARD_LOOKUP_PRESETS,
)
from app.api.v1.master_lookup import get_master_lookup_presets


@pytest.mark.asyncio
async def test_walkin_customer_default_code():
    """Verify default WALK_IN_CUSTOMER_ID is treated as walkin with 0 discount entitlement."""
    session = AsyncMock()
    with patch("app.services.system_parameter.SystemParameterService.resolve_parameter", new_callable=AsyncMock) as mock_param:
        mock_param.return_value = None

        policy = await resolve_customer_discount_policy(
            session=session,
            customer_id="CUST-WALKIN",
            company_id="COMP-001",
            branch_id="MAIN",
        )
        assert policy.customer is None
        assert policy.group is None
        assert policy.max_discount_percent == Decimal("0.00")
        assert policy.can_receive_discount is False


@pytest.mark.asyncio
async def test_walkin_customer_configured_custom_parameter():
    """Verify tenant-configured SMRITI.POS.WALKIN_CUSTOMER_CODE is dynamically respected."""
    session = AsyncMock()
    custom_walkin_param = MagicMock()
    custom_walkin_param.effective_value = "RETAIL-WALKIN-COUNTER-1"

    with patch("app.services.system_parameter.SystemParameterService.resolve_parameter", new_callable=AsyncMock) as mock_param:
        mock_param.return_value = custom_walkin_param

        # The custom walk-in code should resolve to walkin policy without querying Customer table
        policy = await resolve_customer_discount_policy(
            session=session,
            customer_id="RETAIL-WALKIN-COUNTER-1",
            company_id="COMP-001",
            branch_id="MAIN",
        )
        assert policy.customer is None
        assert policy.group is None
        assert policy.max_discount_percent == Decimal("0.00")
        assert policy.can_receive_discount is False
        assert session.execute.call_count == 0


@pytest.mark.asyncio
async def test_regular_customer_still_resolved_when_custom_walkin_configured():
    """Verify regular customer queries DB even when custom walk-in parameter is configured."""
    session = AsyncMock()
    custom_walkin_param = MagicMock()
    custom_walkin_param.effective_value = "RETAIL-WALKIN-COUNTER-1"

    mock_cust = Customer(
        id="cust-regular-1",
        name="Sunil Mehta",
        code="CUST-REG-01",
        company_id="COMP-001",
        branch_id="MAIN",
        customer_group_id="grp-vip",
    )
    mock_grp = CustomerGroup(
        id="grp-vip",
        name="VIP Tier",
        company_id="COMP-001",
        max_discount_percent=Decimal("15.00"),
        can_receive_discount=True,
    )

    call_count = 0

    async def mock_execute(stmt, *args, **kwargs):
        nonlocal call_count
        call_count += 1
        res = MagicMock()
        if call_count == 1:
            res.scalars.return_value.first.return_value = mock_cust
        else:
            res.scalars.return_value.first.return_value = mock_grp
        return res

    session.execute.side_effect = mock_execute

    with patch("app.services.system_parameter.SystemParameterService.resolve_parameter", new_callable=AsyncMock) as mock_param:
        mock_param.return_value = custom_walkin_param

        policy = await resolve_customer_discount_policy(
            session=session,
            customer_id="cust-regular-1",
            company_id="COMP-001",
            branch_id="MAIN",
        )
        assert policy.customer is not None
        assert policy.customer.id == "cust-regular-1"
        assert policy.group is not None
        assert policy.max_discount_percent == Decimal("15.00")
        assert policy.can_receive_discount is True


def test_standard_lookup_presets_retrieval():
    """Verify master lookup presets registry returns expected presets across standard categories."""
    depts = get_standard_lookup_presets("department")
    assert len(depts) >= 10
    dept_codes = [d["code"] for d in depts]
    assert "MENSWEAR" in dept_codes
    assert "BILLING_POS" in dept_codes
    assert "FINANCE_ACCOUNTS" in dept_codes

    banks = get_standard_lookup_presets("bank")
    assert len(banks) >= 6
    bank_codes = [b["code"] for b in banks]
    assert "HDFC" in bank_codes
    assert "SBI" in bank_codes

    payment_modes = get_standard_lookup_presets("payment_mode")
    assert len(payment_modes) >= 8
    pm_codes = [pm["code"] for pm in payment_modes]
    assert "UPI" in pm_codes
    assert "CARD_CC" in pm_codes
    assert "CASH" in pm_codes

    uoms = get_standard_lookup_presets("uom")
    assert len(uoms) >= 9
    uom_codes = [u["code"] for u in uoms]
    assert "PCS" in uom_codes
    assert "PAIR" in uom_codes


def test_standard_lookup_presets_empty_on_unknown_type():
    """Verify unknown lookup types return an empty list gracefully."""
    empty = get_standard_lookup_presets("non_existent_category_xyz")
    assert empty == []

    empty_none = get_standard_lookup_presets("")
    assert empty_none == []


@pytest.mark.asyncio
async def test_get_master_lookup_presets_endpoint_handler():
    """Verify the API router handler returns presets matching registry."""
    mock_user = MagicMock()
    res = await get_master_lookup_presets(type_code="designation", current_user=mock_user)
    assert isinstance(res, list)
    assert len(res) >= 8
    desig_codes = [d["code"] for d in res]
    assert "STORE_MANAGER" in desig_codes
    assert "CASHIER" in desig_codes
