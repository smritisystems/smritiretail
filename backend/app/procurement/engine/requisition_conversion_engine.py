"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.1.0
Created      : 2026-07-21
Modified     : 2026-07-21
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal Architecture Standard
"""

import uuid
from decimal import Decimal
from datetime import datetime, timedelta, timezone
from typing import Dict, Any, Optional
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.models.purchase import (
    PurchaseRequisition, PurchaseRequisitionLine,
    PurchaseOrder, PurchaseOrderItem,
    ProcurementRFQ, ProcurementRFQItem,
    Supplier
)
from app.models.inventory import Product
from app.procurement.engine.blanket_release_engine import BlanketReleaseEngine
from app.api.deps import TenantContext


class RequisitionConversionEngine:
    """
    RequisitionConversionEngine — Converts approved Purchase Requisitions into downstream transactional documents:
    Direct Purchase Order, Request for Quotation (RFQ), or Blanket Purchase Agreement Release PO.
    """

    def __init__(self, db: AsyncSession, tenant: TenantContext):
        self.db = db
        self.tenant = tenant

    async def convert(
        self,
        requisition_id: str,
        strategy: str,
        supplier_id: Optional[str] = None,
        bpa_id: Optional[str] = None
    ) -> Dict[str, Any]:
        # 1. Fetch & Validate Requisition
        stmt = select(PurchaseRequisition).where(
            PurchaseRequisition.id == requisition_id,
            PurchaseRequisition.company_id == self.tenant.company_id,
            PurchaseRequisition.is_deleted == False
        )
        req = (await self.db.execute(stmt)).scalars().first()
        if not req:
            raise HTTPException(status_code=404, detail=f"Purchase Requisition '{requisition_id}' not found")

        if req.status != "Approved":
            raise HTTPException(status_code=400, detail=f"Cannot convert requisition in status '{req.status}'. Must be 'Approved'.")

        l_stmt = select(PurchaseRequisitionLine).where(
            PurchaseRequisitionLine.requisition_id == req.id,
            PurchaseRequisitionLine.is_deleted == False
        )
        req_lines = list((await self.db.execute(l_stmt)).scalars().all())
        if not req_lines:
            raise HTTPException(status_code=400, detail="Requisition has no line items to convert")

        strategy_upper = strategy.upper()

        # Strategy 1: DIRECT_PO
        if strategy_upper == "DIRECT_PO":
            target_sup_id = supplier_id or req_lines[0].preferred_supplier_id
            if not target_sup_id:
                raise HTTPException(status_code=400, detail="Supplier ID or preferred_supplier_id is required for Direct PO conversion")

            po_id = f"po-{uuid.uuid4().hex[:8]}"
            order_no = f"PO-REQ-{req.requisition_no}-{uuid.uuid4().hex[:4].upper()}"

            subtotal = Decimal("0.00")
            tax_total = Decimal("0.00")
            po_items = []

            for r_line in req_lines:
                p_stmt = select(Product).where(Product.id == r_line.product_id)
                product = (await self.db.execute(p_stmt)).scalars().first()

                gst_rate = Decimal("18.00")
                if product and product.gst_percentage is not None:
                    gst_rate = Decimal(str(product.gst_percentage))

                qty = r_line.requested_quantity
                price = r_line.estimated_unit_price
                line_val = (price * qty).quantize(Decimal("0.01"))
                tax_amt = (line_val * gst_rate / Decimal("100.00")).quantize(Decimal("0.01"))
                line_tot = (line_val + tax_amt).quantize(Decimal("0.01"))

                subtotal += line_val
                tax_total += tax_amt

                poi = PurchaseOrderItem(
                    id=f"poi-{uuid.uuid4().hex[:8]}",
                    order_id=po_id,
                    product_id=r_line.product_id,
                    code=product.code if product else f"PROD-{r_line.product_id[:6]}",
                    name=product.name if product else "Requisition Item",
                    quantity=qty,
                    cost_price=price,
                    gst_rate=gst_rate,
                    tax_amount=tax_amt,
                    line_total=line_tot,
                    company_id=self.tenant.company_id,
                    branch_id=self.tenant.branch_id
                )
                po_items.append(poi)

            po = PurchaseOrder(
                id=po_id,
                uuid=str(uuid.uuid4()),
                tenant_id=getattr(self.tenant, "tenant_id", None) or self.tenant.company_id,
                company_id=self.tenant.company_id,
                branch_id=self.tenant.branch_id,
                order_no=order_no,
                supplier_id=target_sup_id,
                status="CONFIRMED",
                notes=f"Converted from Purchase Requisition {req.requisition_no}",
                subtotal=subtotal.quantize(Decimal("0.01")),
                tax_total=tax_total.quantize(Decimal("0.01")),
                grand_total=(subtotal + tax_total).quantize(Decimal("0.01"))
            )
            self.db.add(po)
            self.db.add_all(po_items)

            req.status = "Converted"
            req.converted_doc_type = "PURCHASE_ORDER"
            req.converted_doc_id = po.id
            self.db.add(req)

            await self.db.commit()
            await self.db.refresh(po)
            return {"converted_doc_type": "PURCHASE_ORDER", "converted_doc_id": po.id, "document": po}

        # Strategy 2: RFQ
        elif strategy_upper == "RFQ":
            rfq_id = f"rfq-{uuid.uuid4().hex[:12]}"
            rfq_code = f"RFQ-{req.requisition_no}-{uuid.uuid4().hex[:4].upper()}"

            rfq = ProcurementRFQ(
                id=rfq_id,
                uuid=str(uuid.uuid4()),
                tenant_id=getattr(self.tenant, "tenant_id", None) or self.tenant.company_id,
                company_id=self.tenant.company_id,
                branch_id=self.tenant.branch_id,
                rfq_code=rfq_code,
                title=f"RFQ for Requisition {req.requisition_no}: {req.title}",
                submission_deadline=datetime.now(timezone.utc) + timedelta(days=7),
                status="Draft"
            )
            self.db.add(rfq)

            rfq_items = []
            for r_line in req_lines:
                rfq_item = ProcurementRFQItem(
                    id=f"rfqi-{uuid.uuid4().hex[:12]}",
                    uuid=str(uuid.uuid4()),
                    tenant_id=getattr(self.tenant, "tenant_id", None) or self.tenant.company_id,
                    company_id=self.tenant.company_id,
                    branch_id=self.tenant.branch_id,
                    rfq_id=rfq_id,
                    product_id=r_line.product_id,
                    required_quantity=r_line.requested_quantity,
                    target_price=r_line.estimated_unit_price
                )
                rfq_items.append(rfq_item)

            self.db.add_all(rfq_items)

            req.status = "Converted"
            req.converted_doc_type = "RFQ"
            req.converted_doc_id = rfq.id
            self.db.add(req)

            await self.db.commit()
            await self.db.refresh(rfq)
            return {"converted_doc_type": "RFQ", "converted_doc_id": rfq.id, "document": rfq}

        # Strategy 3: BPA_RELEASE
        elif strategy_upper == "BPA_RELEASE":
            if not bpa_id:
                raise HTTPException(status_code=400, detail="bpa_id is required for BPA_RELEASE conversion strategy")

            release_engine = BlanketReleaseEngine(self.db, self.tenant)
            release_items = [{"product_id": line.product_id, "release_quantity": line.requested_quantity} for line in req_lines]
            po = await release_engine.issue_bpa_release(bpa_id=bpa_id, release_items=release_items)

            req.status = "Converted"
            req.converted_doc_type = "BPA_RELEASE"
            req.converted_doc_id = po.id
            self.db.add(req)

            await self.db.commit()
            return {"converted_doc_type": "BPA_RELEASE", "converted_doc_id": po.id, "document": po}

        else:
            raise HTTPException(status_code=400, detail=f"Unsupported conversion strategy '{strategy}'. Supported: DIRECT_PO, RFQ, BPA_RELEASE.")
