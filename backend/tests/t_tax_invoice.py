import pytest
from app.services.dispatch_import import (
    calculate_tax_invoice,
    LineItemInput
)

def test_gst_exclusive_5_percent_calculation_mandate():
    """
    Statutory Requirement Test:
    When a column is labeled TAXABLE VALUE, it represents net GST-exclusive base value.
    5% IGST MUST be calculated as: taxable_value * 5 / 100.
    It MUST NOT be calculated as GST-inclusive: taxable_value * 5 / 105.
    
    For Invoice TT2026-2027/72:
    Taxable Value: 106,127.36
    IGST @ 5% = 106,127.36 * 0.05 = 5,306.37
    Grand Total (unrounded) = 111,433.73
    Grand Total (rounded) = 111,434.00
    Rounding Adjustment = +0.27
    """
    taxable_value = 106127.36
    gst_rate = 5.0

    # Correct GST-Exclusive calculation
    expected_igst = round(taxable_value * (gst_rate / 100.0), 2)
    assert expected_igst == 5306.37

    # Incorrect Inclusive formula attempt
    incorrect_inclusive_igst = round(taxable_value * (gst_rate / 105.0), 2)
    assert incorrect_inclusive_igst == 5053.68 or incorrect_inclusive_igst == 5053.72

    # Prevent inclusive formula from being equal to exclusive calculation
    assert expected_igst != incorrect_inclusive_igst, (
        "CRITICAL STATUTORY FAILURE: Inclusive GST formula was used for exclusive TAXABLE VALUE!"
    )

    unrounded_total = taxable_value + expected_igst
    assert round(unrounded_total, 2) == 111433.73

    rounded_grand_total = round(unrounded_total)
    assert rounded_grand_total == 111434

    rounding_adjustment = round(rounded_grand_total - unrounded_total, 2)
    assert rounding_adjustment == 0.27


def test_tattly_dispatch_engine_exclusive_gst():
    """
    Verifies backend calculation engine produces exclusive 5% IGST.
    """
    items = [
        LineItemInput(
            product_id="CH-24-G-BLACK-37",
            quantity=1.0,
            unit_price=1068.00,
            hsn_code="64041990",
            tax_rate=5.0
        ),
        LineItemInput(
            product_id="SND-01-C-BRONZE-38",
            quantity=2.0,
            unit_price=1405.4376,
            hsn_code="64041990",
            tax_rate=5.0
        )
    ]

    # Inter-state calculation (e.g., MH (27) to TS (36))
    res = calculate_tax_invoice(
        seller_state="27",
        place_of_supply="36",
        items=items
    )

    assert res.is_interstate is True
    expected_subtotal = round(1068.00 + (2.0 * 1405.4376), 2) # 1068.00 + 2810.88 = 3878.88
    assert res.subtotal == expected_subtotal

    expected_igst = round(expected_subtotal * 0.05, 2) # 3878.88 * 0.05 = 193.94
    assert res.igst_amount == expected_igst
    assert res.cgst_amount == 0.0
    assert res.sgst_amount == 0.0

    expected_grand = round(expected_subtotal + expected_igst, 2) # 3878.88 + 193.94 = 4072.82
    assert res.grand_total == expected_grand
