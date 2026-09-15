"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 1.1.0
Created      : 2026-09-15
Modified     : 2026-09-16
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
Source Module: Tests for Barcode Billing CSV Import Engine (Database Verification)
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
    assert _detect_format([], True) == "FORMAT_PDT"
    assert "FORMAT_1" in FORMAT_LABELS


def test_compute_gst():
    res = _compute_gst(Decimal("100.00"), Decimal("18.0"), Decimal("1"))
    assert res["line_total"] == 100.0
    assert res["taxable_value"] == 84.75
    assert res["cgst_amount"] == 7.63
    assert res["sgst_amount"] == 7.63


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
        assert row.hsn_code == "6205"


@pytest.mark.asyncio
async def test_validate_row_valid_sku():
    mock_db = AsyncMock()
    mock_catalog = {
        "product_id": "00000000-0000-0000-0000-000000000002",
        "item_name": "Leather Shoe Formal",
        "sku": "SHOE-BRN-42",
        "barcode": "890100000002",
        "catalog_mrp": Decimal("2499.00"),
        "catalog_selling_price": Decimal("1999.00"),
        "gst_rate": Decimal("18.0"),
        "hsn_code": "6403",
        "available_stock": 5,
        "uom": "PAIR",
    }
    with patch("app.api.v1.billing_csv._lookup_catalog", new_callable=AsyncMock, return_value=mock_catalog):
        row = await _validate_row(
            idx=1, raw_id="SHOE-BRN-42", raw_sku=None, raw_qty="2",
            raw_price=None, raw_disc=None, raw_mrp_csv=None, raw_gst_csv=None,
            fmt="FORMAT_2", db=mock_db, company_id="comp-1"
        )
        assert row.status == "VALID"
        assert row.product_id == "00000000-0000-0000-0000-000000000002"
        assert row.resolved_sku == "SHOE-BRN-42"
        assert row.quantity == 2.0
        assert row.effective_selling_price == 1999.00


@pytest.mark.asyncio
async def test_validate_row_not_in_database_strictly_rejected():
    mock_db = AsyncMock()
    # When catalog lookup returns None (not present in database)
    with patch("app.api.v1.billing_csv._lookup_catalog", new_callable=AsyncMock, return_value=None):
        # Arbitrary text or unknown barcode
        row = await _validate_row(
            idx=1, raw_id="JUNK_UNKNOWN_TEXT_XYZ", raw_sku=None, raw_qty="1",
            raw_price=None, raw_disc=None, raw_mrp_csv=None, raw_gst_csv=None,
            fmt="FORMAT_1", db=mock_db, company_id="comp-1"
        )
        assert row.status == "REJECTED"
        assert row.product_id is None
        assert row.error_code == "SMRITI-BILL-001"
        assert "not present in the database" in row.error_message


@pytest.mark.asyncio
async def test_validate_row_blank_identifier_rejected():
    mock_db = AsyncMock()
    row = await _validate_row(
        idx=1, raw_id="   ", raw_sku=None, raw_qty="1",
        raw_price=None, raw_disc=None, raw_mrp_csv=None, raw_gst_csv=None,
        fmt="FORMAT_1", db=mock_db, company_id="comp-1"
    )
    assert row.status == "REJECTED"
    assert row.product_id is None
    assert row.error_code == "SMRITI-BILL-001"
    assert "Row has no barcode or SKU" in row.error_message


@pytest.mark.asyncio
async def test_validate_row_exceeding_mrp_rejected():
    mock_db = AsyncMock()
    mock_catalog = {
        "product_id": "00000000-0000-0000-0000-000000000001",
        "item_name": "Test Shirt",
        "sku": "TS-001",
        "barcode": "890100000001",
        "catalog_mrp": Decimal("500.00"),
        "catalog_selling_price": Decimal("450.00"),
        "gst_rate": Decimal("5.0"),
        "hsn_code": "6205",
        "available_stock": 10,
        "uom": "PCS",
    }
    with patch("app.api.v1.billing_csv._lookup_catalog", new_callable=AsyncMock, return_value=mock_catalog):
        row = await _validate_row(
            idx=2, raw_id="890100000001", raw_sku=None, raw_qty="1",
            raw_price="600.00", raw_disc=None, raw_mrp_csv=None, raw_gst_csv=None,
            fmt="FORMAT_3", db=mock_db, company_id="comp-1"
        )
        assert row.status == "REJECTED"
        assert row.error_code == "SMRITI-BILL-002"
        assert "exceeds the legal MRP" in row.error_message


@pytest.mark.asyncio
async def test_validate_row_gst_mismatch_warning():
    mock_db = AsyncMock()
    mock_catalog = {
        "product_id": "00000000-0000-0000-0000-000000000001",
        "item_name": "Test Shirt",
        "sku": "TS-001",
        "barcode": "890100000001",
        "catalog_mrp": Decimal("500.00"),
        "catalog_selling_price": Decimal("500.00"),
        "gst_rate": Decimal("18.0"),
        "hsn_code": "6205",
        "available_stock": 10,
        "uom": "PCS",
    }
    with patch("app.api.v1.billing_csv._lookup_catalog", new_callable=AsyncMock, return_value=mock_catalog):
        row = await _validate_row(
            idx=3, raw_id="890100000001", raw_sku=None, raw_qty="1",
            raw_price="500.00", raw_disc=None, raw_mrp_csv="500.00", raw_gst_csv="12.0",
            fmt="FORMAT_6", db=mock_db, company_id="comp-1"
        )
        assert row.status == "WARNING"
        assert row.gst_rate == 18.0  # Catalog rate wins!
        assert any("SMRITI-BILL-010" in w for w in row.warnings)
