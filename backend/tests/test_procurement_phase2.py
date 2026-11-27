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
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import pytest
from fastapi import HTTPException
from app.api.deps import TenantContext
from app.api.v1.reports import SMRITI_STUDIOS
from app.models.purchase import (
    PurchaseRequisition, PurchaseRequisitionItem,
    SupplierRfq, SupplierRfqItem,
    SupplierQuotation, SupplierQuotationItem,
)
from app.schemas.procurement_phase2 import (
    RequisitionApprovalAction, RequisitionConvertToPORequest,
    RequisitionCreate, RequisitionItemCreate,
    QuotationCreate, QuotationItemCreate,
)
from app.services.procurement_phase2 import ProcurementPhase2Service
from app.services.purchase import PurchaseService


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


@pytest.mark.asyncio
async def test_create_requisition_uses_authenticated_user_from_tenant_context():
    db = MagicMock()
    db.execute = AsyncMock()
    db.commit = AsyncMock()
    db.refresh = AsyncMock()
    result = MagicMock()
    result.scalar.return_value = 0
    db.execute.return_value = result
    tenant = TenantContext(
        company_id="COMP-001",
        branch_id="BR-MAIN-001",
        user_id="user-123",
    )
    payload = RequisitionCreate(
        required_by_date="2026-12-05",
        justification="Replenish store stock",
        items=[
            RequisitionItemCreate(
                product_id="prod-1",
                code="SKU-100",
                name="Leather Shoe",
                quantity_requested=Decimal("2"),
                estimated_cost=Decimal("750.00"),
            )
        ],
    )

    created = await ProcurementPhase2Service(db, tenant).create_requisition(payload)

    assert created.created_by == "user-123"
    db.add.assert_called_once_with(created)
    db.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_approval_accepts_partial_quantities_and_excludes_zero_quantity_lines():
    db = MagicMock()
    db.commit = AsyncMock()
    db.refresh = AsyncMock()
    request = SimpleNamespace(
        status="SUBMITTED",
        notes=None,
        items=[
            SimpleNamespace(
                id="line-1",
                name="First item",
                quantity_requested=Decimal("4"),
                quantity_approved=Decimal("0"),
                estimated_cost=Decimal("10"),
                line_total=Decimal("0"),
            ),
            SimpleNamespace(
                id="line-2",
                name="Second item",
                quantity_requested=Decimal("3"),
                quantity_approved=Decimal("0"),
                estimated_cost=Decimal("4"),
                line_total=Decimal("0"),
            ),
        ],
    )
    service = ProcurementPhase2Service(db, TenantContext(company_id="COMP-001", branch_id="BR-001", user_id="user-123"))
    service.get_requisition = AsyncMock(return_value=request)

    await service.approve_requisition(
        "request-1",
        RequisitionApprovalAction(
            approved_quantities={"line-1": Decimal("0"), "line-2": Decimal("2")},
            notes="Approve only the needed amount",
        ),
    )

    assert request.items[0].quantity_approved == Decimal("0")
    assert request.items[1].quantity_approved == Decimal("2")
    assert request.approved_total == Decimal("8.00")
    assert request.status == "APPROVED"
    db.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_approval_rejects_out_of_range_unknown_and_all_zero_quantities():
    db = MagicMock()
    db.commit = AsyncMock()
    request = SimpleNamespace(
        status="SUBMITTED",
        items=[
            SimpleNamespace(id="line-1", name="First item", quantity_requested=Decimal("4")),
        ],
    )
    service = ProcurementPhase2Service(db, TenantContext(company_id="COMP-001", branch_id="BR-001"))
    service.get_requisition = AsyncMock(return_value=request)
    invalid_actions = (
        ({"line-1": Decimal("-1")}, "must be between zero"),
        ({"line-1": Decimal("5")}, "must be between zero"),
        ({"unknown": Decimal("1")}, "not part of this request"),
        ({"line-1": Decimal("0")}, "Approve at least one requested unit"),
    )

    for quantities, expected_detail in invalid_actions:
        with pytest.raises(HTTPException) as exc_info:
            await service.approve_requisition(
                "request-1",
                RequisitionApprovalAction(approved_quantities=quantities),
            )
        assert expected_detail in exc_info.value.detail

    db.commit.assert_not_awaited()


@pytest.mark.asyncio
async def test_purchase_order_conversion_does_not_restore_zero_approved_quantities(monkeypatch):
    async def get_supplier(_service, supplier_id):
        return SimpleNamespace(id=supplier_id)

    monkeypatch.setattr(PurchaseService, "_get_supplier", get_supplier)
    db = MagicMock()
    db.commit = AsyncMock()
    db.refresh = AsyncMock()
    request = SimpleNamespace(
        id="request-1",
        requisition_no="PR-001",
        status="APPROVED",
        po_id=None,
        po_no=None,
        items=[
            SimpleNamespace(
                id="line-1",
                product_id="product-1",
                item_id=None,
                variant_id=None,
                code="SKU-1",
                name="Excluded item",
                quantity_requested=Decimal("4"),
                quantity_approved=Decimal("0"),
                quantity_ordered=Decimal("0"),
                estimated_cost=Decimal("10"),
            ),
            SimpleNamespace(
                id="line-2",
                product_id="product-2",
                item_id=None,
                variant_id=None,
                code="SKU-2",
                name="Approved item",
                quantity_requested=Decimal("3"),
                quantity_approved=Decimal("2"),
                quantity_ordered=Decimal("0"),
                estimated_cost=Decimal("4"),
            ),
        ],
    )
    requisition_result = MagicMock()
    requisition_result.scalars.return_value.first.return_value = request
    count_result = MagicMock()
    count_result.scalar.return_value = 0
    db.execute = AsyncMock(side_effect=[requisition_result, count_result])
    service = ProcurementPhase2Service(db, TenantContext(company_id="COMP-001", branch_id="BR-001", user_id="user-123"))

    purchase_order = await service.convert_requisition_to_po(
        "request-1",
        RequisitionConvertToPORequest(supplier_id="supplier-1"),
    )

    assert len(purchase_order.items) == 1
    assert purchase_order.items[0].product_id == "product-2"
    assert purchase_order.items[0].quantity == Decimal("2")
    assert request.items[0].quantity_ordered == Decimal("0")
    assert request.items[1].quantity_ordered == Decimal("2")
    db.commit.assert_awaited_once()
