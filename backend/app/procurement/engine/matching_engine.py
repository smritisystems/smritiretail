"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 5.8.0
Created      : 2026-07-21
Modified     : 2026-07-21
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal Architecture Standard
"""

import uuid
from decimal import Decimal
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.models.purchase import (
    PurchaseOrder, PurchaseOrderItem,
    PurchaseReceipt, PurchaseReceiptItem,
    ThreeWayMatch, ThreeWayMatchLine
)
from app.api.deps import TenantContext
from app.procurement.engine.tolerance_engine import ToleranceEngine


class MatchingEngine:
    """
    Automated 3-Way Matching Engine (PO <-> GRN <-> Vendor Bill).
    Evaluates price & quantity variances, resolves multi-level tolerance policies,
    enforces supervisor payment blocks, and appends explainable resolution traces.
    """

    def __init__(self, db: AsyncSession, tenant: TenantContext):
        self.db = db
        self.tenant = tenant
        self.tolerance_engine = ToleranceEngine(db, tenant)

    async def execute_three_way_match(
        self,
        po_id: str,
        grn_id: str,
        vendor_bill_no: str,
        billed_items: List[Dict[str, Any]],
        vendor_bill_date: Optional[datetime] = None
    ) -> ThreeWayMatch:

        # 1. Fetch PO & Items
        po_stmt = select(PurchaseOrder).where(
            PurchaseOrder.id == po_id,
            PurchaseOrder.company_id == self.tenant.company_id,
            PurchaseOrder.is_deleted == False
        )
        po = (await self.db.execute(po_stmt)).scalars().first()
        if not po:
            raise HTTPException(status_code=404, detail=f"Purchase order '{po_id}' not found")

        po_items_stmt = select(PurchaseOrderItem).where(
            PurchaseOrderItem.order_id == po_id,
            PurchaseOrderItem.is_deleted == False
        )
        po_items = {it.product_id: it for it in (await self.db.execute(po_items_stmt)).scalars().all()}

        # 2. Fetch GRN & Items
        grn_stmt = select(PurchaseReceipt).where(
            PurchaseReceipt.id == grn_id,
            PurchaseReceipt.company_id == self.tenant.company_id,
            PurchaseReceipt.is_deleted == False
        )
        grn = (await self.db.execute(grn_stmt)).scalars().first()
        if not grn:
            raise HTTPException(status_code=404, detail=f"Goods receipt (GRN) '{grn_id}' not found")

        grn_items_stmt = select(PurchaseReceiptItem).where(
            PurchaseReceiptItem.receipt_id == grn_id,
            PurchaseReceiptItem.is_deleted == False
        )
        grn_items = {it.product_id: it for it in (await self.db.execute(grn_items_stmt)).scalars().all()}

        # 3. Create ThreeWayMatch Header
        match_id = f"twm-{uuid.uuid4().hex[:12]}"
        match_obj = ThreeWayMatch(
            id=match_id,
            uuid=str(uuid.uuid4()),
            tenant_id=getattr(self.tenant, "tenant_id", None) or self.tenant.company_id,
            company_id=self.tenant.company_id,
            branch_id=self.tenant.branch_id,
            po_id=po_id,
            grn_id=grn_id,
            vendor_bill_no=vendor_bill_no,
            vendor_bill_date=vendor_bill_date or datetime.now(timezone.utc),
            match_status="Pending",
            overall_price_variance=Decimal("0.00"),
            overall_qty_variance=Decimal("0.00")
        )
        self.db.add(match_obj)

        has_blocked = False
        has_warning = False
        tot_price_var = Decimal("0.00")
        tot_qty_var = Decimal("0.00")

        # 4. Line-by-Line 3-Way Match Verification
        for b_item in billed_items:
            product_id = b_item["product_id"]
            billed_qty = Decimal(str(b_item.get("billed_qty", 0.0)))
            billed_price = Decimal(str(b_item.get("billed_unit_price", 0.0)))

            po_item = po_items.get(product_id)
            grn_item = grn_items.get(product_id)

            ord_qty = Decimal(str(po_item.quantity)) if po_item else Decimal("0.00")
            recv_qty = Decimal(str(grn_item.quantity_received)) if grn_item else Decimal("0.00")
            po_price = Decimal(str(po_item.cost_price)) if po_item else Decimal("0.00")

            # Resolve Tolerance Policy Hierarchy
            tolerance = await self.tolerance_engine.resolve_tolerance(
                product_id=product_id,
                supplier_id=po.supplier_id
            )

            # Compute Variances
            price_var_amt = billed_price - po_price
            price_var_pct = (price_var_amt / po_price * Decimal("100.00")) if po_price > 0 else Decimal("0.00")

            qty_var_amt = billed_qty - recv_qty
            qty_var_pct = (qty_var_amt / recv_qty * Decimal("100.00")) if recv_qty > 0 else Decimal("0.00")

            tot_price_var += price_var_amt * billed_qty
            tot_qty_var += qty_var_amt

            # Trace & Line Status Evaluation
            trace = [
                f"Step 1: Evaluated PO Unit Price (₹{po_price}) vs Billed Unit Price (₹{billed_price})",
                f"Step 2: Evaluated Received Qty ({recv_qty}) vs Billed Qty ({billed_qty})",
                f"Step 3: Resolved Tolerance Policy '{tolerance.level}' (Allowed Price Var: {tolerance.allowed_price_pct}%, Qty Var: {tolerance.allowed_qty_pct}%)"
            ]

            line_status = "Matched"
            if abs(price_var_pct) > Decimal(str(tolerance.allowed_price_pct)) or abs(qty_var_pct) > Decimal(str(tolerance.allowed_qty_pct)):
                if tolerance.auto_approve:
                    line_status = "Warning"
                    has_warning = True
                    trace.append(f"Step 4: Variance detected (Price {price_var_pct:.2f}%, Qty {qty_var_pct:.2f}%) within auto-approve threshold -> Set to Warning")
                else:
                    line_status = "Blocked"
                    has_blocked = True
                    trace.append(f"Step 4: Variance detected (Price {price_var_pct:.2f}%, Qty {qty_var_pct:.2f}%) EXCEEDED tolerance -> Set to Blocked")
            else:
                trace.append("Step 4: 3-Way Verification Passed cleanly -> Set to Matched")

            line_obj = ThreeWayMatchLine(
                id=f"twml-{uuid.uuid4().hex[:12]}",
                uuid=str(uuid.uuid4()),
                tenant_id=getattr(self.tenant, "tenant_id", None) or self.tenant.company_id,
                company_id=self.tenant.company_id,
                branch_id=self.tenant.branch_id,
                match_id=match_obj.id,
                product_id=product_id,
                ordered_qty=ord_qty,
                received_qty=recv_qty,
                billed_qty=billed_qty,
                po_unit_price=po_price,
                billed_unit_price=billed_price,
                price_variance_pct=price_var_pct.quantize(Decimal("0.01")),
                qty_variance_pct=qty_var_pct.quantize(Decimal("0.01")),
                line_status=line_status,
                resolution_trace=trace
            )
            self.db.add(line_obj)

        # Overall Header Status Decision
        if has_blocked:
            match_obj.match_status = "Blocked"
        elif has_warning:
            match_obj.match_status = "Warning"
        else:
            match_obj.match_status = "Matched"

        match_obj.overall_price_variance = tot_price_var.quantize(Decimal("0.01"))
        match_obj.overall_qty_variance = tot_qty_var.quantize(Decimal("0.01"))

        await self.db.commit()
        await self.db.refresh(match_obj)
        return match_obj

    async def approve_variance_block(self, match_id: str, approved_by: str, approval_notes: str) -> ThreeWayMatch:
        """
        Supervisor Approval Override Workflow for Blocked 3-Way Matches.
        """
        stmt = select(ThreeWayMatch).where(
            ThreeWayMatch.id == match_id,
            ThreeWayMatch.company_id == self.tenant.company_id,
            ThreeWayMatch.is_deleted == False
        )
        match_obj = (await self.db.execute(stmt)).scalars().first()
        if not match_obj:
            raise HTTPException(status_code=404, detail=f"3-Way Match record '{match_id}' not found")

        match_obj.match_status = "Approved Override"
        match_obj.approved_by = approved_by
        match_obj.approved_at = datetime.now(timezone.utc)
        match_obj.approval_notes = approval_notes

        self.db.add(match_obj)
        await self.db.commit()
        await self.db.refresh(match_obj)
        return match_obj
