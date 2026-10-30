"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 1.0.0
Created      : 2026-09-23
Modified     : 2026-09-23
Copyright    : (c) SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
Target Test  : Goods Receipt Note (GRN) Automated Unit Tests
"""

from datetime import date
from decimal import Decimal
import pytest

from app.models.goods_receipt import GoodsReceiptNote, GoodsReceiptLine
from app.api.v1.grn import (
    GRNCreate,
    GRNLineCreate,
    _compute_grn_totals,
    _next_grn_number,
)


def test_grn_model_initialization():
    """Verify GoodsReceiptNote model instantiation and default values."""
    grn = GoodsReceiptNote(
        id="grn-test-01",
        uuid="uuid-test-01",
        grn_number="GRN/2026-09/TEST01",
        company_id="comp-001",
        branch_id="branch-001",
        vendor_id="vend-001",
        grn_date=date(2026, 9, 23),
        status="DRAFT",
        currency_code="INR",
    )
    assert grn.grn_number == "GRN/2026-09/TEST01"
    assert grn.status == "DRAFT"
    assert grn.company_id == "comp-001"
    assert grn.branch_id == "branch-001"
    assert grn.currency_code == "INR"


def test_grn_line_model_initialization():
    """Verify GoodsReceiptLine model instantiation and values."""
    line = GoodsReceiptLine(
        id="line-01",
        grn_id="grn-test-01",
        product_id="prod-001",
        product_code="ITEM-01",
        received_qty=Decimal("10.000"),
        uom="NOS",
        unit_cost=Decimal("150.0000"),
        taxable_value=Decimal("1500.00"),
        cgst_amt=Decimal("135.00"),
        sgst_amt=Decimal("135.00"),
        total_value=Decimal("1770.00"),
        landed_cost=Decimal("1770.00"),
    )
    assert line.product_id == "prod-001"
    assert line.received_qty == Decimal("10.000")
    assert line.total_value == Decimal("1770.00")
    assert line.uom == "NOS"


def test_compute_grn_totals():
    """Test header level aggregation from line items."""
    line1 = GRNLineCreate(
        product_id="prod-01",
        received_qty=Decimal("5"),
        taxable_value=Decimal("500.00"),
        cgst_amt=Decimal("45.00"),
        sgst_amt=Decimal("45.00"),
        igst_amt=Decimal("0.00"),
        total_value=Decimal("590.00"),
        landed_cost=Decimal("590.00"),
    )
    line2 = GRNLineCreate(
        product_id="prod-02",
        received_qty=Decimal("15"),
        taxable_value=Decimal("1500.00"),
        cgst_amt=Decimal("0.00"),
        sgst_amt=Decimal("0.00"),
        igst_amt=Decimal("270.00"),
        total_value=Decimal("1770.00"),
        landed_cost=Decimal("1770.00"),
    )
    totals = _compute_grn_totals([line1, line2])
    assert totals["total_quantity"] == Decimal("20")
    assert totals["total_taxable"] == Decimal("2000.00")
    assert totals["total_tax"] == Decimal("360.00")
    assert totals["total_landed"] == Decimal("2360.00")


def test_grn_number_generation():
    """Test GRN number formatting pattern."""
    num = _next_grn_number("comp-001")
    assert num.startswith("GRN/")
    parts = num.split("/")
    assert len(parts) == 3
