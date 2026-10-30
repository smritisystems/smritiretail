"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.33.0
Created      : 2026-09-15
Modified     : 2026-09-17
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
Source Module: Tests for Barcode Billing CSV Import Engine & Statutory Tax Modes
"""

import sys
from pathlib import Path
backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

import pytest
from decimal import Decimal
from unittest.mock import AsyncMock, patch

from app.api.v1.billing_csv import (
    _detect_format,
    _compute_gst,
    _validate_row,
    _norm_header,
    _parse_tax_mode,
    _parse_input,
    FORMAT_LABELS,
)


def test_detect_format():
    assert _detect_format(["barcode"], False) == "FORMAT_1"
    assert _detect_format(["sku"], False) == "FORMAT_1"
    assert _detect_format(["barcode", "quantity"], False) == "FORMAT_2"
    assert _detect_format(["sku", "quantity"], False) == "FORMAT_2"
    assert _detect_format([_norm_header("barcode"), _norm_header("qty")], False) == "FORMAT_2"
    assert _detect_format(["barcode", "quantity", "selling_price"], False) == "FORMAT_3"
    assert _detect_format([_norm_header("barcode"), _norm_header("qty"), _norm_header("price")], False) == "FORMAT_3"
    assert _detect_format(["barcode", "quantity", "rate"], False) == "FORMAT_4"
    assert _detect_format(["barcode", "quantity", "discount_percent"], False) == "FORMAT_5"
    assert _detect_format([_norm_header("barcode"), _norm_header("qty"), _norm_header("disc_pct")], False) == "FORMAT_5"
    assert _detect_format(["barcode", "sku", "quantity", "mrp", "selling_price", "gst_rate", "hsn_code"], False) == "FORMAT_6"
    assert _detect_format(["barcode", "quantity", "rate", "is_tax_inclusive"], False) == "FORMAT_B2B_RATE"
    assert _detect_format(["barcode", "quantity", "rate", "discount_percent", "discount_amount", "is_tax_inclusive"], False) == "FORMAT_COMMERCIAL_DISC"
    assert _detect_format([], True) == "FORMAT_PDT"
    assert "FORMAT_B2B_RATE" in FORMAT_LABELS
    assert "FORMAT_COMMERCIAL_DISC" in FORMAT_LABELS


def test_compute_gst_inclusive():
    res = _compute_gst(Decimal("100.00"), Decimal("18.0"), Decimal("1"), is_tax_inclusive=True)
    assert res["line_total"] == 100.0
    assert res["taxable_value"] == 84.75
    # Total tax is 15.25 -> split evenly without 1-paisa rounding divergence
    assert round(res["cgst_amount"] + res["sgst_amount"], 2) == 15.25


def test_compute_gst_exclusive():
    res = _compute_gst(Decimal("100.00"), Decimal("18.0"), Decimal("1"), is_tax_inclusive=False)
    assert res["taxable_value"] == 100.0
    assert res["line_total"] == 118.0
    assert res["cgst_amount"] == 9.0
    assert res["sgst_amount"] == 9.0


def test_parse_tax_mode():
    assert _parse_tax_mode("1")[0] is True
    assert _parse_tax_mode("true")[0] is True
    assert _parse_tax_mode("YES")[0] is True
    assert _parse_tax_mode("INC")[0] is True
    assert _parse_tax_mode("mrp")[0] is True
    assert _parse_tax_mode("0")[0] is False
    assert _parse_tax_mode("false")[0] is False
    assert _parse_tax_mode("NO")[0] is False
    assert _parse_tax_mode("EXC")[0] is False
    assert _parse_tax_mode("base")[0] is False
    assert _parse_tax_mode("")[0] is True
    assert _parse_tax_mode(None, default_mode=False)[0] is False
    # Invalid mode
    res, err = _parse_tax_mode("invalid_val")
    assert res is None
    assert "Invalid tax mode" in err


@pytest.mark.asyncio
async def test_validate_row_format_1_valid_barcode():
    mock_db = AsyncMock()
    mock_catalog = {
        "product_id": "00000000-0000-0000-0000-000000000001",
        "item_name": "Test Shirt",
        "sku": "TS-001",
        "barcode": "890100000001",
        "catalog_mrp": Decimal("999.00"),
        "catalog_selling_price": Decimal("899.00"),
        "gst_rate": Decimal("12.0"),
        "hsn_code": "6205",
        "available_stock": 10,
        "uom": "PCS",
    }
    with patch("app.api.v1.billing_csv._lookup_catalog", new_callable=AsyncMock, return_value=mock_catalog):
        row = await _validate_row(
            idx=1, raw_id="890100000001", raw_sku=None, raw_qty="1",
            raw_price=None, raw_disc=None, raw_mrp_csv=None, raw_gst_csv=None,
            fmt="FORMAT_1", db=mock_db, company_id="comp-1"
        )
        assert row.status == "VALID"
        assert row.product_id == "00000000-0000-0000-0000-000000000001"
        assert row.effective_selling_price == 899.00
        assert row.quantity == 1.0
        assert row.catalog_mrp == 999.00
        assert row.is_tax_inclusive is True
        assert row.tax_mode_display == "INCLUSIVE"
        assert row.hsn_code == "6205"


@pytest.mark.asyncio
async def test_validate_row_tax_exclusive_valid():
    mock_db = AsyncMock()
    mock_catalog = {
        "product_id": "00000000-0000-0000-0000-000000000002",
        "item_name": "Wholesale Denim",
        "sku": "DNM-001",
        "barcode": "890100000002",
        "catalog_mrp": Decimal("1500.00"),
        "catalog_selling_price": Decimal("1200.00"),
        "gst_rate": Decimal("12.0"),
        "hsn_code": "6203",
        "available_stock": 50,
        "uom": "PCS",
    }
    with patch("app.api.v1.billing_csv._lookup_catalog", new_callable=AsyncMock, return_value=mock_catalog):
        # Base rate = 1000.00, GST = 12% -> Taxable = 1000.00, Tax = 120.00, Line Total = 1120.00 <= 1500 MRP
        row = await _validate_row(
            idx=1, raw_id="890100000002", raw_sku=None, raw_qty="1",
            raw_price="1000.00", raw_disc=None, raw_mrp_csv=None, raw_gst_csv=None,
            fmt="FORMAT_B2B_RATE", db=mock_db, company_id="comp-1",
            raw_tax_inc="EXC"
        )
        assert row.status == "VALID"
        assert row.is_tax_inclusive is False
        assert row.tax_mode_display == "EXCLUSIVE"
        assert row.effective_selling_price == 1000.00
        assert row.taxable_value == 1000.00
        assert row.line_total == 1120.00
        assert row.cgst_amount == 60.00
        assert row.sgst_amount == 60.00


@pytest.mark.asyncio
async def test_validate_row_tax_exclusive_exceeding_mrp_rejected():
    mock_db = AsyncMock()
    mock_catalog = {
        "product_id": "00000000-0000-0000-0000-000000000003",
        "item_name": "Limited Sneakers",
        "sku": "SNK-001",
        "barcode": "890100000003",
        "catalog_mrp": Decimal("1100.00"),
        "catalog_selling_price": Decimal("1000.00"),
        "gst_rate": Decimal("18.0"),
        "hsn_code": "6404",
        "available_stock": 10,
        "uom": "PAIR",
    }
    with patch("app.api.v1.billing_csv._lookup_catalog", new_callable=AsyncMock, return_value=mock_catalog):
        # Base rate = 1000.00, GST = 18% -> Post-tax = 1180.00, which EXCEEDS legal MRP 1100.00!
        row = await _validate_row(
            idx=2, raw_id="890100000003", raw_sku=None, raw_qty="1",
            raw_price="1000.00", raw_disc=None, raw_mrp_csv=None, raw_gst_csv=None,
            fmt="FORMAT_B2B_RATE", db=mock_db, company_id="comp-1",
            raw_tax_inc="false"
        )
        assert row.status == "REJECTED"
        assert row.error_code == "SMRITI-BILL-002"
        assert "exceeding legal MRP" in row.error_message


@pytest.mark.asyncio
async def test_validate_row_commercial_dual_discount():
    mock_db = AsyncMock()
    mock_catalog = {
        "product_id": "00000000-0000-0000-0000-000000000004",
        "item_name": "Cotton Kurti",
        "sku": "KRT-001",
        "barcode": "890100000004",
        "catalog_mrp": Decimal("2000.00"),
        "catalog_selling_price": Decimal("1800.00"),
        "gst_rate": Decimal("5.0"),
        "hsn_code": "6206",
        "available_stock": 25,
        "uom": "PCS",
    }
    with patch("app.api.v1.billing_csv._lookup_catalog", new_callable=AsyncMock, return_value=mock_catalog):
        # Price = 1000.00, Qty = 2, Gross = 2000.00, Disc % = 10% (200), Disc Amt = 50 -> Total Disc = 250
        # Tax Inclusive: Line total = 1750.00, Taxable = 1750 / 1.05 = 1666.67
        row = await _validate_row(
            idx=3, raw_id="890100000004", raw_sku=None, raw_qty="2",
            raw_price="1000.00", raw_disc="10.0", raw_mrp_csv=None, raw_gst_csv=None,
            fmt="FORMAT_COMMERCIAL_DISC", db=mock_db, company_id="comp-1",
            raw_disc_amt="50.00", raw_tax_inc="1"
        )
        assert row.status == "VALID"
        assert row.line_total == 1750.00
        assert row.taxable_value == 1666.67


def test_positional_5_column_parsing():
    raw_csv = "8901001, 5, 250.00, 10.0, 0\n8901002, 10, 450.00, 5.0, 1"
    is_pdt, canonical_headers, data_rows = _parse_input(raw_csv, None)
    assert is_pdt is False
    assert canonical_headers == ["barcode", "quantity", "selling_price", "discount_percent", "is_tax_inclusive"]
    assert len(data_rows) == 2
    assert data_rows[0]["barcode"] == "8901001"
    assert data_rows[0]["is_tax_inclusive"] == "0"
    assert data_rows[1]["is_tax_inclusive"] == "1"


@pytest.mark.asyncio
async def test_validate_row_reliance_contractual_4376():
    mock_db = AsyncMock()
    mock_catalog = {
        "product_id": "00000000-0000-0000-0000-000000000005",
        "item_name": "Premium Denim Trouser",
        "sku": "DNM-001",
        "barcode": "890100000005",
        "catalog_mrp": Decimal("2500.00"),
        "catalog_selling_price": Decimal("2500.00"),
        "gst_rate": Decimal("12.0"),
        "hsn_code": "6203",
        "available_stock": 50,
        "uom": "PCS",
    }
    with patch("app.api.v1.billing_csv._lookup_catalog", new_callable=AsyncMock, return_value=mock_catalog):
        # Even if CSV specifies selling_price="2200.00" or raw_disc="10.0",
        # is_reliance=True MUST override and auto-apply exact 43.76% discount on MRP:
        # Effective SP = 2500 * (1 - 0.4376) = 1406.00
        # Line Total (2 units) = 2812.00
        row = await _validate_row(
            idx=0, raw_id="890100000005", raw_sku=None, raw_qty="2",
            raw_price="2200.00", raw_disc="10.0", raw_mrp_csv=None, raw_gst_csv=None,
            fmt="FORMAT_COMMERCIAL_DISC", db=mock_db, company_id="comp-1",
            raw_disc_amt=None, raw_tax_inc="1", is_reliance=True
        )
        assert row.status == "VALID"
        assert row.effective_selling_price == 1406.00
        assert row.line_total == 2812.00
        assert row.mrp_markdown_display == "43.76% off MRP [REL_RET_4376]"


def test_parse_input_preserves_header_order_and_aliases():
    from app.api.v1.billing_csv import _parse_input
    raw_csv = "ean,qty,base_rate,disc_pct,tax_mode\n8901001,2,500.00,10.0,0"
    parsed = _parse_input(raw_csv, None)
    assert parsed.raw_headers == ["ean", "qty", "base_rate", "disc_pct", "tax_mode"]
    assert parsed.canonical_headers == ["barcode", "quantity", "rate", "discount_percent", "is_tax_inclusive"]
    assert parsed.header_map["ean"] == "barcode"
    assert parsed.header_map["qty"] == "quantity"
    assert parsed.header_map["base_rate"] == "rate"
    assert parsed.header_map["disc_pct"] == "discount_percent"
    assert parsed.header_map["tax_mode"] == "is_tax_inclusive"
    assert len(parsed.unrecognized_headers) == 0


def test_header_suggestions_for_misspelled_columns():
    from app.api.v1.billing_csv import _parse_input, _suggest_header
    raw_csv = "barcd,quant,prc,cost,disc_rate\n8901001,2,500.00,450.00,5.0"
    parsed = _parse_input(raw_csv, None)
    assert "barcd" in parsed.unrecognized_headers
    assert "quant" in parsed.unrecognized_headers
    assert "prc" in parsed.unrecognized_headers
    assert any("barcode" in s for s in parsed.suggestions)
    assert any("quantity" in s for s in parsed.suggestions)
    assert any("selling_price" in s for s in parsed.suggestions)


def test_distinguished_validations_reporting():
    from app.api.v1.billing_csv import _resolve_distinguished_validations
    validations = _resolve_distinguished_validations(
        canonical_headers=["barcode", "quantity", "rate", "discount_percent"],
        header_map={"ean": "barcode", "qty": "quantity", "base_rate": "rate", "disc%": "discount_percent"},
        fmt="FORMAT_COMMERCIAL_DISC",
        default_tax_inclusive=False,
        is_reliance=True,
    )
    assert any("Wholesale Base Rate Validation" in v for v in validations)
    assert any("Percentage Discount Validation" in v for v in validations)
    assert any("Contractual Trade Exclusivity" in v for v in validations)
    assert any("Discrete UOM Guard" in v for v in validations)

