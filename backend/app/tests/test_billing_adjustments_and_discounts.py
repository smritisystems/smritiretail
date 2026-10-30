"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.17.0
Created      : 2026-10-25
Modified     : 2026-10-25
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Unit Test Suite
"""

from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import AsyncMock
import pytest
from fastapi import HTTPException

from app.core.gst_engine import calculate_line_item_tax
from app.services.customer_discount_policy import (
    CustomerDiscountPolicy,
    validate_customer_discount_policy,
)
from app.schemas.canonical_posting import CanonicalAdjustmentItem


@pytest.fixture(autouse=True)
def auto_override_company_db():
    yield


@pytest.fixture(autouse=True)
def seed_control_plane_test_assignments():
    yield


def test_calculate_line_item_tax_exclusive_with_composite_addon():
    """Verify Section 8 CGST composite addon increases line taxable base and calculates proportional tax."""
    result = calculate_line_item_tax(
        unit_price=Decimal("1000.00"),
        quantity=Decimal("1.0000"),
        discount_amount=Decimal("0.00"),
        gst_rate=Decimal("18.00"),
        is_tax_inclusive=False,
        is_interstate=False,
        composite_adjustment=Decimal("100.00"),  # ₹100 composite freight/packing
    )
    # Taxable value = 1000 + 100 = 1100.00
    assert result["taxable_value"] == Decimal("1100.00")
    # Tax = 1100 * 18% = 198.00 (CGST 99.00, SGST 99.00)
    assert result["tax_amount"] == Decimal("198.00")
    assert result["cgst_amount"] == Decimal("99.00")
    assert result["sgst_amount"] == Decimal("99.00")
    assert result["igst_amount"] == Decimal("0.00")
    assert result["total_amount"] == Decimal("1298.00")


def test_calculate_line_item_tax_inclusive_with_composite_addon():
    """Verify tax-inclusive composite supply adds to gross total before tax de-composition."""
    result = calculate_line_item_tax(
        unit_price=Decimal("1180.00"),
        quantity=Decimal("1.0000"),
        discount_amount=Decimal("0.00"),
        gst_rate=Decimal("18.00"),
        is_tax_inclusive=True,
        is_interstate=True,
        composite_adjustment=Decimal("118.00"),  # ₹118 gross composite charge
    )
    # Gross total = 1180 + 118 = 1298.00
    # Taxable value = 1298 / 1.18 = 1100.00
    assert result["taxable_value"] == Decimal("1100.00")
    assert result["tax_amount"] == Decimal("198.00")
    assert result["igst_amount"] == Decimal("198.00")
    assert result["cgst_amount"] == Decimal("0.00")
    assert result["sgst_amount"] == Decimal("0.00")
    assert result["total_amount"] == Decimal("1298.00")


def test_calculate_line_item_tax_exclusive_with_composite_deduction():
    """Verify pre-tax deduction reduces taxable value prior to GST computation."""
    result = calculate_line_item_tax(
        unit_price=Decimal("1000.00"),
        quantity=Decimal("1.0000"),
        discount_amount=Decimal("0.00"),
        gst_rate=Decimal("18.00"),
        is_tax_inclusive=False,
        is_interstate=False,
        composite_adjustment=Decimal("-100.00"),  # ₹100 pre-tax deduction
    )
    # Taxable value = 1000 - 100 = 900.00
    assert result["taxable_value"] == Decimal("900.00")
    # Tax = 900 * 18% = 162.00
    assert result["tax_amount"] == Decimal("162.00")
    assert result["total_amount"] == Decimal("1062.00")


def test_customer_contractual_discount_allows_contracted_rate():
    """Verify validate_customer_discount_policy honors contractual discount percent even if group limit is lower."""
    policy = CustomerDiscountPolicy(
        customer=SimpleNamespace(id="CUST-1"),
        group=SimpleNamespace(id="GRP-1", max_discount_percent=Decimal("5.00"), can_receive_discount=True),
        max_discount_percent=Decimal("5.00"),
        can_receive_discount=True,
        contractual_discount_percent=Decimal("15.00"),  # 15% contractual entitlement
    )
    # 12% discount requested on ₹1000 (₹120) -> should succeed under 15% contractual limit
    validate_customer_discount_policy(
        policy=policy,
        discount_amount=Decimal("120.00"),
        gross_amount=Decimal("1000.00"),
        authorized_discount_override=False,
    )


def test_customer_discount_policy_rejects_exceeding_discount():
    """Verify validate_customer_discount_policy rejects discount exceeding both group and contractual caps."""
    policy = CustomerDiscountPolicy(
        customer=SimpleNamespace(id="CUST-1"),
        group=SimpleNamespace(id="GRP-1", max_discount_percent=Decimal("5.00"), can_receive_discount=True),
        max_discount_percent=Decimal("5.00"),
        can_receive_discount=True,
        contractual_discount_percent=Decimal("10.00"),
    )
    # 15% requested -> exceeds 10% cap
    with pytest.raises(HTTPException) as exc:
        validate_customer_discount_policy(
            policy=policy,
            discount_amount=Decimal("150.00"),
            gross_amount=Decimal("1000.00"),
            authorized_discount_override=False,
        )
    assert exc.value.status_code == 400
    assert "Customer discount exceeds the policy limit" in exc.value.detail


def test_customer_discount_policy_honors_authorized_override():
    """Verify authorized_discount_override permits discount exceeding standard limit."""
    policy = CustomerDiscountPolicy(
        customer=SimpleNamespace(id="CUST-1"),
        group=SimpleNamespace(id="GRP-1", max_discount_percent=Decimal("5.00"), can_receive_discount=True),
        max_discount_percent=Decimal("5.00"),
        can_receive_discount=True,
        contractual_discount_percent=Decimal("5.00"),
    )
    # 25% discount requested with authorized_discount_override=True -> succeeds
    validate_customer_discount_policy(
        policy=policy,
        discount_amount=Decimal("250.00"),
        gross_amount=Decimal("1000.00"),
        authorized_discount_override=True,
    )


def test_canonical_adjustment_item_instantiation():
    """Verify CanonicalAdjustmentItem supports composite, specific SAC, and timing configurations."""
    comp_adj = CanonicalAdjustmentItem(
        code="FREIGHT",
        name="Packaging & Transport",
        adjustment_type="ADDON",
        rate_type="FIXED",
        rate_value=Decimal("150.00"),
        amount=Decimal("150.00"),
        timing="PRE_TAX",
        tax_treatment="COMPOSITE",
    )
    assert comp_adj.tax_treatment == "COMPOSITE"
    assert comp_adj.timing == "PRE_TAX"
    assert comp_adj.amount == Decimal("150.00")

    sac_adj = CanonicalAdjustmentItem(
        code="TRANS_SAC",
        name="Dedicated Transport Service",
        adjustment_type="ADDON",
        rate_type="FIXED",
        rate_value=Decimal("500.00"),
        amount=Decimal("500.00"),
        timing="PRE_TAX",
        tax_treatment="SPECIFIC_SAC",
        gst_rate=Decimal("18.00"),
        sac_code="9965",
    )
    assert sac_adj.tax_treatment == "SPECIFIC_SAC"
    assert sac_adj.sac_code == "9965"
    assert sac_adj.gst_rate == Decimal("18.00")
