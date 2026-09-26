"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 1.0.0
Created      : 2026-09-24
Modified     : 2026-09-24
Copyright    : (c) SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
Target Test  : Authoritative Retail & POS Billing Calculation Engine Test Battery
"""

from decimal import Decimal, ROUND_HALF_UP
import pytest

from app.core.gst_engine import (
    calculate_line_item_tax,
    round_currency,
    validate_gstin,
    extract_state_code_from_gstin,
)


def test_gst_inclusive_single_item():
    """Scenario 1: Retail MRP tax-inclusive calculation with 18% GST (Intrastate CGST 9% + SGST 9%)."""
    res = calculate_line_item_tax(
        unit_price=Decimal("1180.00"),
        quantity=Decimal("1"),
        discount_amount=Decimal("0.00"),
        gst_rate=Decimal("18.00"),
        is_tax_inclusive=True,
        is_interstate=False,
    )
    assert res["taxable_value"] == Decimal("1000.00")
    assert res["tax_amount"] == Decimal("180.00")
    assert res["cgst_amount"] == Decimal("90.00")
    assert res["sgst_amount"] == Decimal("90.00")
    assert res["igst_amount"] == Decimal("0.00")
    assert res["total_amount"] == Decimal("1180.00")


def test_gst_inclusive_interstate():
    """Scenario 2: Retail MRP tax-inclusive calculation with 18% GST (Interstate IGST 18%)."""
    res = calculate_line_item_tax(
        unit_price=Decimal("1180.00"),
        quantity=Decimal("1"),
        discount_amount=Decimal("0.00"),
        gst_rate=Decimal("18.00"),
        is_tax_inclusive=True,
        is_interstate=True,
    )
    assert res["taxable_value"] == Decimal("1000.00")
    assert res["tax_amount"] == Decimal("180.00")
    assert res["cgst_amount"] == Decimal("0.00")
    assert res["sgst_amount"] == Decimal("0.00")
    assert res["igst_amount"] == Decimal("180.00")
    assert res["total_amount"] == Decimal("1180.00")


def test_gst_exclusive_b2b():
    """Scenario 3: B2B Tax-exclusive wholesale calculation with 12% GST."""
    res = calculate_line_item_tax(
        unit_price=Decimal("500.00"),
        quantity=Decimal("10"),
        discount_amount=Decimal("0.00"),
        gst_rate=Decimal("12.00"),
        is_tax_inclusive=False,
        is_interstate=False,
    )
    assert res["taxable_value"] == Decimal("5000.00")
    assert res["tax_amount"] == Decimal("600.00")
    assert res["cgst_amount"] == Decimal("300.00")
    assert res["sgst_amount"] == Decimal("300.00")
    assert res["total_amount"] == Decimal("5600.00")


def test_zero_rated_exempt_item():
    """Scenario 4: Zero-rated / GST exempt agricultural or healthcare product."""
    res = calculate_line_item_tax(
        unit_price=Decimal("250.00"),
        quantity=Decimal("4"),
        discount_amount=Decimal("0.00"),
        gst_rate=Decimal("0.00"),
        is_tax_inclusive=True,
        is_interstate=False,
    )
    assert res["taxable_value"] == Decimal("1000.00")
    assert res["tax_amount"] == Decimal("0.00")
    assert res["cgst_amount"] == Decimal("0.00")
    assert res["sgst_amount"] == Decimal("0.00")
    assert res["total_amount"] == Decimal("1000.00")


def test_line_level_discount_mrp():
    """Scenario 5: Line-level promotional discount applied before MRP tax bifurcation."""
    res = calculate_line_item_tax(
        unit_price=Decimal("1000.00"),
        quantity=Decimal("2"),
        discount_amount=Decimal("200.00"),  # Gross 2000 - 200 = 1800
        gst_rate=Decimal("18.00"),
        is_tax_inclusive=True,
        is_interstate=False,
    )
    assert res["total_amount"] == Decimal("1800.00")
    expected_taxable = round_currency(Decimal("1800.00") / Decimal("1.18"))
    assert res["taxable_value"] == expected_taxable


def test_line_level_discount_exclusive():
    """Scenario 6: Line-level trade discount on tax-exclusive price."""
    res = calculate_line_item_tax(
        unit_price=Decimal("100.00"),
        quantity=Decimal("5"),
        discount_amount=Decimal("50.00"),  # Taxable = 450.00
        gst_rate=Decimal("5.00"),
        is_tax_inclusive=False,
        is_interstate=False,
    )
    assert res["taxable_value"] == Decimal("450.00")
    assert res["tax_amount"] == Decimal("22.50")
    assert res["cgst_amount"] == Decimal("11.25")
    assert res["sgst_amount"] == Decimal("11.25")
    assert res["total_amount"] == Decimal("472.50")


def test_split_payment_cash_card():
    """Scenario 7: POS Split-tender payment reconciliation (Cash + Card combo)."""
    invoice_total = Decimal("2450.00")
    payments = [
        {"mode": "CASH", "amount": Decimal("1000.00")},
        {"mode": "CARD", "amount": Decimal("1450.00")},
    ]
    total_tendered = sum(p["amount"] for p in payments)
    balance_due = invoice_total - total_tendered
    assert total_tendered == invoice_total
    assert balance_due == Decimal("0.00")


def test_split_payment_with_rounding():
    """Scenario 8: Multi-tender reconciliation with cash denomination rounding."""
    exact_total = Decimal("1499.78")
    rounded_total = exact_total.quantize(Decimal("1"), rounding=ROUND_HALF_UP).quantize(Decimal("0.01"))
    rounding_adj = rounded_total - exact_total

    payments = [
        {"mode": "CASH", "amount": Decimal("500.00")},
        {"mode": "UPI", "amount": Decimal("1000.00")},
    ]
    tender_sum = sum(p["amount"] for p in payments)
    change_due = tender_sum - rounded_total
    assert rounded_total == Decimal("1500.00")
    assert rounding_adj == Decimal("0.22")
    assert change_due == Decimal("0.00")


def test_financial_rounding_half_up():
    """Scenario 9: Statutory Round-Half-Up financial rounding precision."""
    assert round_currency(Decimal("10.555")) == Decimal("10.56")
    assert round_currency(Decimal("10.554")) == Decimal("10.55")
    assert round_currency(Decimal("10.5550")) == Decimal("10.56")


def test_gstin_validation_and_state_extraction():
    """Scenario 10: GSTIN validation and jurisdiction extraction across states."""
    valid_mh, state_code_mh, state_name_mh = validate_gstin("27AAAPL1234A1Z5")
    assert valid_mh is True
    assert state_code_mh == "27"
    assert state_name_mh == "Maharashtra"

    valid_dl, state_code_dl, state_name_dl = validate_gstin("07AAAAA0000A1Z5")
    assert valid_dl is True
    assert state_code_dl == "07"
    assert state_name_dl == "Delhi"

    invalid_gst, _, _ = validate_gstin("INVALID1234")
    assert invalid_gst is False
