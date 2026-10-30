"""
Project      : SMRITI Retail OS
Repository   : SMRITIRetailNX
Organization : AITDL NETWORKS

Founders
* Pushpa Devi Jawahar Mallah
  * Founder & Chairperson
* Jawahar Ramkripal Mallah
  * Founder, Chief Executive Officer (CEO) & Chief Software Architect

Websites: aitdl.com | erpnbook.com | smritibooks.com

Version      : 1.0.0
Created      : 2026-10-16
Modified     : 2026-10-16
Copyright    : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""
# smriti_capability(entity="PURCHASE", capability="PURCHASE_REQUISITION_AND_RFQ", role="SERVICE", canonicalOwner="backend/app/services/procurement_phase2.py")

import uuid
from typing import Optional, List, Dict, Any
from decimal import Decimal, ROUND_HALF_UP
from datetime import datetime, date, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import or_, func, desc
from sqlalchemy.orm import selectinload
from fastapi import HTTPException

from ..models.purchase import (
    Supplier,
    PurchaseOrder, PurchaseOrderItem,
    PurchaseRequisition, PurchaseRequisitionItem,
    SupplierRfq, SupplierRfqItem,
    SupplierQuotation, SupplierQuotationItem,
)
from ..models.inventory import Product
from ..api.deps import TenantContext
from ..schemas.procurement_phase2 import (
    RequisitionCreate, RequisitionApprovalAction, RequisitionRejectAction,
    RequisitionConvertToPORequest,
    RfqCreate, QuotationCreate, QuotationSelectAction,
    QuotationConvertToPORequest,
    QuotationComparisonMatrixResponse, QuotationComparisonItemMatrix,
    QuotationResponse,
)
from .purchase import PurchaseService


def _round2(val: Decimal) -> Decimal:
    return val.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def _round4(val: Decimal) -> Decimal:
    return val.quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)


class ProcurementPhase2Service:
    def __init__(self, db: AsyncSession, tenant: TenantContext):
        self.db = db
        self.tenant = tenant

    def _scope_company(self, model_cls):
        if self.tenant.company_id:
            return (model_cls.company_id == self.tenant.company_id) | (model_cls.company_id.is_(None))
        return True

    # ─────────────────────────────────────────────────────────────────────────
    # 1. Purchase Requisitions
    # ─────────────────────────────────────────────────────────────────────────

    async def create_requisition(self, payload: RequisitionCreate) -> PurchaseRequisition:
        # Generate PR Number if absent
        today_str = date.today().strftime("%Y%m%d")
        if not payload.requisition_no:
            seq_stmt = select(func.count(PurchaseRequisition.id)).where(
                self._scope_company(PurchaseRequisition)
            )
            count = (await self.db.execute(seq_stmt)).scalar() or 0
            req_no = f"PR-{today_str}-{count + 1:04d}"
        else:
            req_no = payload.requisition_no

        req_id = f"prq-{uuid.uuid4().hex[:12]}"

        # Calculate estimated total
        estimated_total = Decimal("0.00")
        items = []
        for line in payload.items:
            line_tot = _round2(line.quantity_requested * line.estimated_cost)
            estimated_total += line_tot
            item_entity = PurchaseRequisitionItem(
                id=f"pqi-{uuid.uuid4().hex[:12]}",
                company_id=self.tenant.company_id,
                branch_id=self.tenant.branch_id,
                requisition_id=req_id,
                product_id=line.product_id,
                item_id=line.item_id,
                variant_id=line.variant_id,
                code=line.code,
                name=line.name,
                quantity_requested=line.quantity_requested,
                quantity_approved=Decimal("0.0000"),
                quantity_ordered=Decimal("0.0000"),
                estimated_cost=line.estimated_cost,
                line_total=line_tot,
                notes=line.notes,
            )
            items.append(item_entity)

        req = PurchaseRequisition(
            id=req_id,
            company_id=self.tenant.company_id,
            branch_id=self.tenant.branch_id,
            requisition_no=req_no,
            requisition_date=payload.requisition_date,
            required_by_date=payload.required_by_date,
            department=payload.department,
            priority=payload.priority,
            status="DRAFT",
            justification=payload.justification,
            notes=payload.notes,
            estimated_total=estimated_total,
            approved_total=Decimal("0.00"),
            items=items,
            created_by=self.tenant.user_id,
        )

        self.db.add(req)
        await self.db.commit()
        await self.db.refresh(req)
        return req

    async def list_requisitions(self, status: Optional[str] = None) -> List[PurchaseRequisition]:
        stmt = (
            select(PurchaseRequisition)
            .options(selectinload(PurchaseRequisition.items))
            .where(
                self._scope_company(PurchaseRequisition),
                PurchaseRequisition.is_deleted == False,
            )
            .order_by(desc(PurchaseRequisition.created_at))
        )
        if status:
            stmt = stmt.where(PurchaseRequisition.status == status.upper())
        res = await self.db.execute(stmt)
        return list(res.scalars().all())

    async def get_requisition(self, requisition_id: str) -> PurchaseRequisition:
        stmt = (
            select(PurchaseRequisition)
            .options(selectinload(PurchaseRequisition.items))
            .where(
                (PurchaseRequisition.id == requisition_id) | (PurchaseRequisition.requisition_no == requisition_id),
                self._scope_company(PurchaseRequisition),
                PurchaseRequisition.is_deleted == False,
            )
        )
        res = await self.db.execute(stmt)
        req = res.scalars().first()
        if not req:
            raise HTTPException(status_code=404, detail=f"Purchase Requisition '{requisition_id}' not found")
        return req

    async def submit_requisition(self, requisition_id: str) -> PurchaseRequisition:
        req = await self.get_requisition(requisition_id)
        if req.status != "DRAFT":
            raise HTTPException(status_code=400, detail=f"Cannot submit requisition in '{req.status}' state")
        req.status = "SUBMITTED"
        req.submitted_by = self.tenant.user_id
        req.submitted_at = datetime.now(timezone.utc)
        await self.db.commit()
        await self.db.refresh(req)
        return req

    async def approve_requisition(self, requisition_id: str, action: RequisitionApprovalAction) -> PurchaseRequisition:
        req = await self.get_requisition(requisition_id)
        if req.status not in ("SUBMITTED", "DRAFT"):
            raise HTTPException(status_code=400, detail=f"Cannot approve requisition in '{req.status}' state")

        approved_total = Decimal("0.00")
        for item in req.items:
            if action.approved_quantities and item.id in action.approved_quantities:
                app_qty = action.approved_quantities[item.id]
            else:
                app_qty = item.quantity_requested
            item.quantity_approved = app_qty
            item.line_total = _round2(app_qty * item.estimated_cost)
            approved_total += item.line_total

        req.status = "APPROVED"
        req.approved_total = approved_total
        req.approved_by = self.tenant.user_id
        req.approved_at = datetime.now(timezone.utc)
        if action.notes:
            req.notes = f"{req.notes or ''}\nApproval Notes: {action.notes}".strip()

        await self.db.commit()
        await self.db.refresh(req)
        return req

    async def reject_requisition(self, requisition_id: str, action: RequisitionRejectAction) -> PurchaseRequisition:
        req = await self.get_requisition(requisition_id)
        if req.status not in ("SUBMITTED", "DRAFT"):
            raise HTTPException(status_code=400, detail=f"Cannot reject requisition in '{req.status}' state")

        req.status = "REJECTED"
        req.rejected_by = self.tenant.user_id
        req.rejected_at = datetime.now(timezone.utc)
        req.rejection_reason = action.reason
        await self.db.commit()
        await self.db.refresh(req)
        return req

    async def cancel_requisition(self, requisition_id: str, reason: str) -> PurchaseRequisition:
        req = await self.get_requisition(requisition_id)
        if req.status in ("CONVERTED_TO_PO", "CANCELLED"):
            raise HTTPException(status_code=400, detail=f"Cannot cancel requisition in '{req.status}' state")

        req.status = "CANCELLED"
        req.cancelled_by = self.tenant.user_id
        req.cancelled_at = datetime.now(timezone.utc)
        req.cancellation_reason = reason
        await self.db.commit()
        await self.db.refresh(req)
        return req

    async def convert_requisition_to_po(self, requisition_id: str, payload: RequisitionConvertToPORequest) -> PurchaseOrder:
        # Atomic lock
        stmt = (
            select(PurchaseRequisition)
            .options(selectinload(PurchaseRequisition.items))
            .where(
                PurchaseRequisition.id == requisition_id,
                self._scope_company(PurchaseRequisition),
                PurchaseRequisition.is_deleted == False,
            )
            .with_for_update()
        )
        res = await self.db.execute(stmt)
        req = res.scalars().first()
        if not req:
            raise HTTPException(status_code=404, detail="Purchase Requisition not found")

        if req.status != "APPROVED":
            raise HTTPException(status_code=400, detail=f"Only APPROVED requisitions can be converted to PO (current: '{req.status}')")

        if req.po_id:
            raise HTTPException(status_code=409, detail=f"Requisition already converted to PO '{req.po_no}' (id: {req.po_id})")

        # Build Purchase Order lines from approved requisition items
        po_service = PurchaseService(self.db, self.tenant)
        sup = await po_service._get_supplier(payload.supplier_id)
        if not sup:
            raise HTTPException(status_code=404, detail=f"Supplier '{payload.supplier_id}' not found")

        today_str = date.today().strftime("%Y%m%d")
        count_stmt = select(func.count(PurchaseOrder.id)).where(self._scope_company(PurchaseOrder))
        po_count = (await self.db.execute(count_stmt)).scalar() or 0
        order_no = f"PO-{today_str}-{po_count + 1:04d}"
        po_id = f"po-{uuid.uuid4().hex[:12]}"

        subtotal = Decimal("0.00")
        tax_total = Decimal("0.00")
        po_items = []

        for item in req.items:
            qty = item.quantity_approved if item.quantity_approved > 0 else item.quantity_requested
            cost = item.estimated_cost if item.estimated_cost > 0 else Decimal("100.00")
            gst_rate = Decimal("18.00")
            tax = _round2(qty * cost * (gst_rate / Decimal("100.00")))
            line_tot = _round2((qty * cost) + tax)

            subtotal += _round2(qty * cost)
            tax_total += tax

            po_line = PurchaseOrderItem(
                id=f"poi-{uuid.uuid4().hex[:12]}",
                company_id=self.tenant.company_id,
                branch_id=self.tenant.branch_id,
                order_id=po_id,
                product_id=item.product_id,
                item_id=item.item_id,
                variant_id=item.variant_id,
                code=item.code,
                name=item.name,
                quantity=qty,
                cost_price=cost,
                gst_rate=gst_rate,
                tax_amount=tax,
                line_total=line_tot,
            )
            po_items.append(po_line)
            # Update ordered quantity
            item.quantity_ordered = qty

        po = PurchaseOrder(
            id=po_id,
            company_id=self.tenant.company_id,
            branch_id=self.tenant.branch_id,
            order_no=order_no,
            supplier_id=sup.id,
            status="DRAFT",
            notes=f"Generated from Requisition {req.requisition_no}. {payload.notes or ''}".strip(),
            subtotal=subtotal,
            tax_total=tax_total,
            grand_total=subtotal + tax_total,
            items=po_items,
            created_by=self.tenant.user_id,
        )

        req.status = "CONVERTED_TO_PO"
        req.po_id = po_id
        req.po_no = order_no

        self.db.add(po)
        await self.db.commit()
        await self.db.refresh(po)
        return po

    # ─────────────────────────────────────────────────────────────────────────
    # 2. Supplier RFQs
    # ─────────────────────────────────────────────────────────────────────────

    async def create_rfq(self, payload: RfqCreate) -> SupplierRfq:
        today_str = date.today().strftime("%Y%m%d")
        if not payload.rfq_no:
            seq_stmt = select(func.count(SupplierRfq.id)).where(self._scope_company(SupplierRfq))
            count = (await self.db.execute(seq_stmt)).scalar() or 0
            rfq_no = f"RFQ-{today_str}-{count + 1:04d}"
        else:
            rfq_no = payload.rfq_no

        rfq_id = f"rfq-{uuid.uuid4().hex[:12]}"
        items = []
        for line in payload.items:
            item_entity = SupplierRfqItem(
                id=f"rfi-{uuid.uuid4().hex[:12]}",
                company_id=self.tenant.company_id,
                branch_id=self.tenant.branch_id,
                rfq_id=rfq_id,
                product_id=line.product_id,
                item_id=line.item_id,
                variant_id=line.variant_id,
                code=line.code,
                name=line.name,
                target_quantity=line.target_quantity,
                target_cost=line.target_cost,
                specifications=line.specifications,
            )
            items.append(item_entity)

        rfq = SupplierRfq(
            id=rfq_id,
            company_id=self.tenant.company_id,
            branch_id=self.tenant.branch_id,
            rfq_no=rfq_no,
            rfq_date=payload.rfq_date,
            due_date=payload.due_date,
            requisition_id=payload.requisition_id,
            title=payload.title,
            status="DRAFT",
            notes=payload.notes,
            terms_conditions=payload.terms_conditions,
            items=items,
            created_by=self.tenant.user_id,
        )

        self.db.add(rfq)
        await self.db.commit()
        await self.db.refresh(rfq)
        return rfq

    async def list_rfqs(self, status: Optional[str] = None) -> List[SupplierRfq]:
        stmt = (
            select(SupplierRfq)
            .options(selectinload(SupplierRfq.items), selectinload(SupplierRfq.quotations))
            .where(
                self._scope_company(SupplierRfq),
                SupplierRfq.is_deleted == False,
            )
            .order_by(desc(SupplierRfq.created_at))
        )
        if status:
            stmt = stmt.where(SupplierRfq.status == status.upper())
        res = await self.db.execute(stmt)
        return list(res.scalars().all())

    async def get_rfq(self, rfq_id: str) -> SupplierRfq:
        stmt = (
            select(SupplierRfq)
            .options(selectinload(SupplierRfq.items), selectinload(SupplierRfq.quotations))
            .where(
                (SupplierRfq.id == rfq_id) | (SupplierRfq.rfq_no == rfq_id),
                self._scope_company(SupplierRfq),
                SupplierRfq.is_deleted == False,
            )
        )
        res = await self.db.execute(stmt)
        rfq = res.scalars().first()
        if not rfq:
            raise HTTPException(status_code=404, detail=f"RFQ '{rfq_id}' not found")
        return rfq

    async def issue_rfq(self, rfq_id: str) -> SupplierRfq:
        rfq = await self.get_rfq(rfq_id)
        if rfq.status != "DRAFT":
            raise HTTPException(status_code=400, detail=f"Cannot issue RFQ in '{rfq.status}' state")
        rfq.status = "ISSUED"
        await self.db.commit()
        await self.db.refresh(rfq)
        return rfq

    async def close_rfq(self, rfq_id: str) -> SupplierRfq:
        rfq = await self.get_rfq(rfq_id)
        if rfq.status in ("CLOSED", "CANCELLED"):
            raise HTTPException(status_code=400, detail=f"Cannot close RFQ in '{rfq.status}' state")
        rfq.status = "CLOSED"
        await self.db.commit()
        await self.db.refresh(rfq)
        return rfq

    # ─────────────────────────────────────────────────────────────────────────
    # 3. Supplier Quotations & Landed Cost Engine
    # ─────────────────────────────────────────────────────────────────────────

    async def create_quotation(self, payload: QuotationCreate) -> SupplierQuotation:
        po_service = PurchaseService(self.db, self.tenant)
        sup = await po_service._get_supplier(payload.supplier_id)
        if not sup:
            raise HTTPException(status_code=404, detail=f"Supplier '{payload.supplier_id}' not found")

        quot_id = f"qtn-{uuid.uuid4().hex[:12]}"

        # Step 1: calculate base subtotal to allocate freight proportionally
        raw_base_subtotal = Decimal("0.00")
        for line in payload.items:
            disc_amt = _round2(line.quoted_quantity * line.unit_price * (line.discount_percent / Decimal("100.00")))
            taxable_line = _round2((line.quoted_quantity * line.unit_price) - disc_amt)
            raw_base_subtotal += taxable_line

        subtotal = Decimal("0.00")
        tax_total = Decimal("0.00")
        items = []
        allocated_freight_sum = Decimal("0.00")

        # Step 2: compute line totals and allocate freight
        for idx, line in enumerate(payload.items):
            disc_amt = _round2(line.quoted_quantity * line.unit_price * (line.discount_percent / Decimal("100.00")))
            taxable_line = _round2((line.quoted_quantity * line.unit_price) - disc_amt)
            tax_amt = _round2(taxable_line * (line.tax_rate / Decimal("100.00")))

            # Proportional freight allocation with penny-balancing on last line
            if raw_base_subtotal > 0 and payload.freight_charges > 0:
                if idx == len(payload.items) - 1:
                    freight_line = payload.freight_charges - allocated_freight_sum
                else:
                    freight_line = _round2(payload.freight_charges * (taxable_line / raw_base_subtotal))
                    allocated_freight_sum += freight_line
            else:
                freight_line = Decimal("0.00")

            line_tot = _round2(taxable_line + tax_amt + freight_line)
            net_landed_unit = _round4(line_tot / line.quoted_quantity) if line.quoted_quantity > 0 else Decimal("0.00")

            subtotal += taxable_line
            tax_total += tax_amt

            item_entity = SupplierQuotationItem(
                id=f"qti-{uuid.uuid4().hex[:12]}",
                company_id=self.tenant.company_id,
                branch_id=self.tenant.branch_id,
                quotation_id=quot_id,
                rfq_item_id=line.rfq_item_id,
                product_id=line.product_id,
                item_id=line.item_id,
                variant_id=line.variant_id,
                code=line.code,
                name=line.name,
                quoted_quantity=line.quoted_quantity,
                unit_price=line.unit_price,
                discount_percent=line.discount_percent,
                discount_amount=disc_amt,
                tax_rate=line.tax_rate,
                tax_amount=tax_amt,
                freight_allocation=freight_line,
                net_landed_cost_per_unit=net_landed_unit,
                line_total=line_tot,
            )
            items.append(item_entity)

        total_landed_cost = _round2(subtotal + tax_total + payload.freight_charges + payload.other_charges)

        quotation = SupplierQuotation(
            id=quot_id,
            company_id=self.tenant.company_id,
            branch_id=self.tenant.branch_id,
            quotation_no=payload.quotation_no,
            rfq_id=payload.rfq_id,
            supplier_id=sup.id,
            quotation_date=payload.quotation_date,
            valid_until=payload.valid_until,
            status="RECEIVED",
            payment_terms=payload.payment_terms,
            delivery_timeline=payload.delivery_timeline,
            subtotal=subtotal,
            tax_total=tax_total,
            freight_charges=payload.freight_charges,
            other_charges=payload.other_charges,
            total_landed_cost=total_landed_cost,
            items=items,
            created_by=self.tenant.user_id,
        )

        self.db.add(quotation)

        # Update RFQ status to EVALUATED if linked
        if payload.rfq_id:
            rfq_stmt = select(SupplierRfq).where(SupplierRfq.id == payload.rfq_id)
            rfq = (await self.db.execute(rfq_stmt)).scalars().first()
            if rfq and rfq.status in ("DRAFT", "ISSUED"):
                rfq.status = "EVALUATED"

        await self.db.commit()
        await self.db.refresh(quotation)
        return quotation

    async def list_quotations(self, rfq_id: Optional[str] = None, supplier_id: Optional[str] = None) -> List[SupplierQuotation]:
        stmt = (
            select(SupplierQuotation)
            .options(selectinload(SupplierQuotation.items), selectinload(SupplierQuotation.supplier))
            .where(
                self._scope_company(SupplierQuotation),
                SupplierQuotation.is_deleted == False,
            )
            .order_by(desc(SupplierQuotation.created_at))
        )
        if rfq_id:
            stmt = stmt.where(SupplierQuotation.rfq_id == rfq_id)
        if supplier_id:
            stmt = stmt.where(SupplierQuotation.supplier_id == supplier_id)
        res = await self.db.execute(stmt)
        return list(res.scalars().all())

    async def get_quotation(self, quotation_id: str) -> SupplierQuotation:
        stmt = (
            select(SupplierQuotation)
            .options(selectinload(SupplierQuotation.items), selectinload(SupplierQuotation.supplier))
            .where(
                (SupplierQuotation.id == quotation_id) | (SupplierQuotation.quotation_no == quotation_id),
                self._scope_company(SupplierQuotation),
                SupplierQuotation.is_deleted == False,
            )
        )
        res = await self.db.execute(stmt)
        q = res.scalars().first()
        if not q:
            raise HTTPException(status_code=404, detail=f"Quotation '{quotation_id}' not found")
        return q

    async def get_rfq_comparison_matrix(self, rfq_id: str) -> QuotationComparisonMatrixResponse:
        rfq = await self.get_rfq(rfq_id)
        quotations = await self.list_quotations(rfq_id=rfq.id)

        # Rank quotations by total_landed_cost ascending
        sorted_quotes = sorted(quotations, key=lambda q: q.total_landed_cost)
        for rank, q in enumerate(sorted_quotes, start=1):
            q.rank = rank

        lowest_landed_supplier = sorted_quotes[0].supplier_id if sorted_quotes else None

        # Build side-by-side item matrix
        item_comparisons = []
        for rfq_item in rfq.items:
            quote_map = {}
            for q in quotations:
                # Find matching quotation line
                matched_line = next((ql for ql in q.items if ql.rfq_item_id == rfq_item.id or ql.product_id == rfq_item.product_id), None)
                if matched_line:
                    quote_map[q.supplier_id] = {
                        "supplier_name": q.supplier.name if q.supplier else q.supplier_id,
                        "quoted_quantity": float(matched_line.quoted_quantity),
                        "unit_price": float(matched_line.unit_price),
                        "discount_percent": float(matched_line.discount_percent),
                        "tax_rate": float(matched_line.tax_rate),
                        "net_landed_unit": float(matched_line.net_landed_cost_per_unit),
                        "line_total": float(matched_line.line_total),
                        "freight_allocation": float(matched_line.freight_allocation),
                    }
            item_comparisons.append(
                QuotationComparisonItemMatrix(
                    product_id=rfq_item.product_id,
                    item_name=rfq_item.name,
                    code=rfq_item.code,
                    target_quantity=rfq_item.target_quantity,
                    quotes=quote_map,
                )
            )

        # Build formatted quotation responses
        quot_responses = []
        for q in quotations:
            resp = QuotationResponse.model_validate(q)
            resp.supplier_name = q.supplier.name if q.supplier else q.supplier_id
            quot_responses.append(resp)

        return QuotationComparisonMatrixResponse(
            rfq_id=rfq.id,
            rfq_no=rfq.rfq_no,
            title=rfq.title,
            quotations=quot_responses,
            item_comparisons=item_comparisons,
            lowest_landed_cost_supplier_id=lowest_landed_supplier,
        )

    async def select_quotation(self, quotation_id: str, action: QuotationSelectAction) -> SupplierQuotation:
        quotation = await self.get_quotation(quotation_id)
        if quotation.status in ("SELECTED", "REJECTED"):
            raise HTTPException(status_code=400, detail=f"Cannot select quotation in '{quotation.status}' state")

        quotation.status = "SELECTED"
        quotation.selection_justification = action.selection_justification
        quotation.evaluation_score = action.evaluation_score
        quotation.evaluation_notes = action.evaluation_notes
        quotation.selected_by = self.tenant.user_id
        quotation.selected_at = datetime.now(timezone.utc)

        # Update sibling quotations if part of an RFQ
        if quotation.rfq_id:
            rfq_stmt = select(SupplierRfq).where(SupplierRfq.id == quotation.rfq_id)
            rfq = (await self.db.execute(rfq_stmt)).scalars().first()
            if rfq:
                rfq.status = "AWARDED"
                rfq.awarded_quotation_id = quotation.id
                rfq.awarded_supplier_id = quotation.supplier_id
                rfq.awarded_notes = action.selection_justification
                rfq.awarded_by = self.tenant.user_id
                rfq.awarded_at = datetime.now(timezone.utc)

            # Mark other quotations as SHORTLISTED or REJECTED
            other_stmt = select(SupplierQuotation).where(
                SupplierQuotation.rfq_id == quotation.rfq_id,
                SupplierQuotation.id != quotation.id,
            )
            others = (await self.db.execute(other_stmt)).scalars().all()
            for other in others:
                if other.status == "RECEIVED":
                    other.status = "REJECTED"

        await self.db.commit()
        await self.db.refresh(quotation)
        return quotation

    async def convert_quotation_to_po(self, quotation_id: str, payload: QuotationConvertToPORequest) -> PurchaseOrder:
        # Atomic lock
        stmt = (
            select(SupplierQuotation)
            .options(selectinload(SupplierQuotation.items), selectinload(SupplierQuotation.supplier))
            .where(
                SupplierQuotation.id == quotation_id,
                self._scope_company(SupplierQuotation),
                SupplierQuotation.is_deleted == False,
            )
            .with_for_update()
        )
        res = await self.db.execute(stmt)
        quotation = res.scalars().first()
        if not quotation:
            raise HTTPException(status_code=404, detail="Supplier Quotation not found")

        if quotation.status != "SELECTED":
            raise HTTPException(status_code=400, detail=f"Only SELECTED quotations can be converted to PO (current: '{quotation.status}')")

        if quotation.po_id:
            raise HTTPException(status_code=409, detail=f"Quotation already converted to PO '{quotation.po_no}' (id: {quotation.po_id})")

        today_str = date.today().strftime("%Y%m%d")
        count_stmt = select(func.count(PurchaseOrder.id)).where(self._scope_company(PurchaseOrder))
        po_count = (await self.db.execute(count_stmt)).scalar() or 0
        order_no = f"PO-{today_str}-{po_count + 1:04d}"
        po_id = f"po-{uuid.uuid4().hex[:12]}"

        po_items = []
        for line in quotation.items:
            po_line = PurchaseOrderItem(
                id=f"poi-{uuid.uuid4().hex[:12]}",
                company_id=self.tenant.company_id,
                branch_id=self.tenant.branch_id,
                order_id=po_id,
                product_id=line.product_id,
                item_id=line.item_id,
                variant_id=line.variant_id,
                code=line.code,
                name=line.name,
                quantity=line.quoted_quantity,
                cost_price=line.unit_price,
                gst_rate=line.tax_rate,
                tax_amount=line.tax_amount,
                line_total=line.line_total,
            )
            po_items.append(po_line)

        po = PurchaseOrder(
            id=po_id,
            company_id=self.tenant.company_id,
            branch_id=self.tenant.branch_id,
            order_no=order_no,
            supplier_id=quotation.supplier_id,
            status="DRAFT",
            notes=f"Awarded from Quotation {quotation.quotation_no}. Justification: {quotation.selection_justification or 'None'}. {payload.notes or ''}".strip(),
            subtotal=quotation.subtotal,
            tax_total=quotation.tax_total,
            grand_total=quotation.total_landed_cost,
            items=po_items,
            created_by=self.tenant.user_id,
        )

        quotation.po_id = po_id
        quotation.po_no = order_no

        self.db.add(po)
        await self.db.commit()
        await self.db.refresh(po)
        return po
