"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.87.0
Created      : 2026-10-16
Modified     : 2026-10-16
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import sys, os
from decimal import Decimal
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import pytest
from app.api.v1.reports import SMRITI_STUDIOS
from app.models.purchase import (
    PurchaseRequisition, PurchaseRequisitionItem,
    SupplierRfq, SupplierRfqItem,
    SupplierQuotation, SupplierQuotationItem,
)
from app.schemas.procurement_phase2 import (
    RequisitionCreate, RequisitionItemCreate,
    QuotationCreate, QuotationItemCreate,
)


def test_procurement_phase2_reports_catalog_extended():
    """Verify purchase_studio catalog has RPT-PUR-005, 006, and 007."""
    assert "purchase_studio" in SMRITI_STUDIOS
    reports = SMRITI_STUDIOS["purchase_studio"].get("reports", [])
    report_ids = [r["id"] for r in reports]

    assert "RPT-PUR-005" in report_ids, "Missing Pending Purchase Requisitions Register"
    assert "RPT-PUR-006" in report_ids, "Missing Requisition-to-PO Conversion & Tracking"
    assert "RPT-PUR-007" in report_ids, "Missing Supplier RFQ & Quotation Comparison Register"

    rpt5 = next(r for r in reports if r["id"] == "RPT-PUR-005")
    assert rpt5["category"] == "Requisition"
    assert rpt5["drillDownEnabled"] is True

    rpt7 = next(r for r in reports if r["id"] == "RPT-PUR-007")
    assert rpt7["category"] == "Quotation Comparison"
    assert rpt7["drillDownEnabled"] is True


def test_landed_cost_mathematical_precision():
    """Verify landed cost calculation formula with discount, tax, and freight."""
    qty = Decimal("10.0000")
    unit_price = Decimal("1000.00")
    discount_pct = Decimal("10.00")  # 10% discount -> 900.00 base unit
    tax_rate = Decimal("18.00")      # 18% GST on 900 -> 162.00 tax unit
    freight_total = Decimal("500.00") # Total freight

    # Calculation
    discount_amt = qty * unit_price * (discount_pct / Decimal("100.00")) # 1000.00
    taxable_subtotal = (qty * unit_price) - discount_amt                # 9000.00
    tax_amt = taxable_subtotal * (tax_rate / Decimal("100.00"))         # 1620.00
    total_landed = taxable_subtotal + tax_amt + freight_total           # 11120.00
    net_landed_unit = total_landed / qty                                # 1112.00

    assert discount_amt == Decimal("1000.00")
    assert taxable_subtotal == Decimal("9000.00")
    assert tax_amt == Decimal("1620.00")
    assert total_landed == Decimal("11120.00")
    assert net_landed_unit == Decimal("1112.00")


def test_purchase_requisition_schema_validation():
    """Verify RequisitionCreate schema validates item lines and quantities."""
    req = RequisitionCreate(
        required_by_date="2026-10-30",
        department="Store Ops",
        justification="Footwear seasonal stock breach",
        items=[
            RequisitionItemCreate(
                product_id="prod-1",
                code="SKU-100",
                name="Leather Shoe",
                quantity_requested=Decimal("20.0000"),
                estimated_cost=Decimal("750.00"),
            )
        ]
    )
    assert req.priority == "NORMAL"
    assert len(req.items) == 1
    assert req.items[0].quantity_requested == Decimal("20.0000")
