"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.26.0
Created      : 2026-08-22
Modified     : 2026-08-22
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import pytest
from decimal import Decimal
from ..core.gst_engine import (
    validate_gstin,
    extract_state_code_from_gstin,
    calculate_line_item_tax,
    determine_gstr1_table,
    GST_STATE_CODES,
)


def test_gstin_validation():
    # Valid Maharashtra GSTIN
    is_valid, state_code, state_name = validate_gstin("27AAACS1234A1Z1")
    assert is_valid is True
    assert state_code == "27"
    assert state_name == "Maharashtra"

    # Valid Delhi GSTIN
    is_valid_dl, state_code_dl, state_name_dl = validate_gstin("07AAAAA0000A1Z5")
    assert is_valid_dl is True
    assert state_code_dl == "07"
    assert state_name_dl == "Delhi"

    # Invalid GSTINs
    assert validate_gstin("")[0] is False
    assert validate_gstin("12345")[0] is False
    assert validate_gstin("27AAACS1234A1Y1")[0] is False  # Missing 'Z' as 14th char
    assert validate_gstin(None)[0] is False


def test_extract_state_code():
    assert extract_state_code_from_gstin("27AAACS1234A1Z1") == "27"
    assert extract_state_code_from_gstin("09ABCDE1234F1Z5") == "09"
    assert extract_state_code_from_gstin("99INVALID") == "99"
    assert extract_state_code_from_gstin("") is None
    assert extract_state_code_from_gstin(None) is None


def test_tax_inclusive_intra_state_b2c_mrp():
    # Customer buys 1 item at MRP Rs 118.00 (tax inclusive, 18% GST, Intra-state)
    result = calculate_line_item_tax(
        unit_price=Decimal("118.00"),
        quantity=Decimal("1.00"),
        discount_amount=Decimal("0.00"),
        gst_rate=Decimal("18.00"),
        is_tax_inclusive=True,
        is_interstate=False,
    )

    assert result["total_amount"] == Decimal("118.00")
    assert result["taxable_value"] == Decimal("100.00")
    assert result["tax_amount"] == Decimal("18.00")
    assert result["cgst_amount"] == Decimal("9.00")
    assert result["sgst_amount"] == Decimal("9.00")
    assert result["igst_amount"] == Decimal("0.00")


def test_tax_inclusive_inter_state_b2c_mrp():
    # Customer buys 1 item at MRP Rs 118.00 (tax inclusive, 18% GST, Inter-state)
    result = calculate_line_item_tax(
        unit_price=Decimal("118.00"),
        quantity=Decimal("1.00"),
        discount_amount=Decimal("0.00"),
        gst_rate=Decimal("18.00"),
        is_tax_inclusive=True,
        is_interstate=True,
    )

    assert result["total_amount"] == Decimal("118.00")
    assert result["taxable_value"] == Decimal("100.00")
    assert result["tax_amount"] == Decimal("18.00")
    assert result["cgst_amount"] == Decimal("0.00")
    assert result["sgst_amount"] == Decimal("0.00")
    assert result["igst_amount"] == Decimal("18.00")


def test_tax_exclusive_intra_state_b2b():
    # B2B buyer buys 2 units at Rs 1000.00 base rate + 18% GST (Intra-state)
    result = calculate_line_item_tax(
        unit_price=Decimal("1000.00"),
        quantity=Decimal("2.00"),
        discount_amount=Decimal("100.00"),
        gst_rate=Decimal("18.00"),
        is_tax_inclusive=False,
        is_interstate=False,
    )

    # Taxable = 2000 - 100 = 1900
    # Tax = 1900 * 0.18 = 342.00
    # Total = 1900 + 342 = 2242.00
    assert result["taxable_value"] == Decimal("1900.00")
    assert result["tax_amount"] == Decimal("342.00")
    assert result["cgst_amount"] == Decimal("171.00")
    assert result["sgst_amount"] == Decimal("171.00")
    assert result["igst_amount"] == Decimal("0.00")
    assert result["total_amount"] == Decimal("2242.00")


def test_tax_exclusive_inter_state_b2b():
    # B2B buyer buys 2 units at Rs 1000.00 base rate + 18% GST (Inter-state)
    result = calculate_line_item_tax(
        unit_price=Decimal("1000.00"),
        quantity=Decimal("2.00"),
        discount_amount=Decimal("100.00"),
        gst_rate=Decimal("18.00"),
        is_tax_inclusive=False,
        is_interstate=True,
    )

    assert result["taxable_value"] == Decimal("1900.00")
    assert result["tax_amount"] == Decimal("342.00")
    assert result["cgst_amount"] == Decimal("0.00")
    assert result["sgst_amount"] == Decimal("0.00")
    assert result["igst_amount"] == Decimal("342.00")
    assert result["total_amount"] == Decimal("2242.00")


def test_gstr1_table_classification():
    # B2B Registered
    assert determine_gstr1_table(is_registered_b2b=True, is_interstate=False, invoice_grand_total=Decimal("500.00")) == "B2B"
    assert determine_gstr1_table(is_registered_b2b=True, is_interstate=True, invoice_grand_total=Decimal("300000.00")) == "B2B"

    # B2C Inter-state Large (> 2.5L)
    assert determine_gstr1_table(is_registered_b2b=False, is_interstate=True, invoice_grand_total=Decimal("250001.00")) == "B2CL"

    # B2C Inter-state Small (<= 2.5L)
    assert determine_gstr1_table(is_registered_b2b=False, is_interstate=True, invoice_grand_total=Decimal("250000.00")) == "B2CS"
    assert determine_gstr1_table(is_registered_b2b=False, is_interstate=True, invoice_grand_total=Decimal("1500.00")) == "B2CS"

    # B2C Intra-state
    assert determine_gstr1_table(is_registered_b2b=False, is_interstate=False, invoice_grand_total=Decimal("500000.00")) == "B2CS"
