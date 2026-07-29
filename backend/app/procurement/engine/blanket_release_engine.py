"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.0.0
Created      : 2026-07-21
Modified     : 2026-07-21
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal Architecture Standard
"""

import uuid
from decimal import Decimal
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.models.purchase import (
    BlanketPurchaseAgreement, BlanketPurchaseAgreementLine,
    PurchaseOrder, PurchaseOrderItem, Supplier
)
from app.models.inventory import Product
from app.api.deps import TenantContext


class BlanketReleaseEngine:
    """
    Blanket Release Engine — Issues scheduled delivery releases against active Blanket Purchase Agreements.
    Enforces commitment ceiling validation, updates cumulative released metrics, and auto-exhausts completed agreements.
    """

    def __init__(self, db: AsyncSession, tenant: TenantContext):
        self.db = db
        self.tenant = tenant

    async def issue_bpa_release(
        self,
        bpa_id: str,
        release_items: List[Dict[str, Any]]
    ) -> PurchaseOrder:
        # 1. Fetch and Validate BPA Aggregate
        bpa_stmt = select(BlanketPurchaseAgreement).where(
            BlanketPurchaseAgreement.id == bpa_id,
            BlanketPurchaseAgreement.company_id == self.tenant.company_id,
            BlanketPurchaseAgreement.is_deleted == False
        )
        bpa = (await self.db.execute(bpa_stmt)).scalars().first()
        if not bpa:
            raise HTTPException(status_code=404, detail=f"Blanket Purchase Agreement '{bpa_id}' not found")

        if bpa.status != "Active":
            raise HTTPException(status_code=400, detail=f"Cannot issue release on BPA in status '{bpa.status}'. Must be 'Active'.")

        now = datetime.now(timezone.utc)
        if bpa.valid_from > now or bpa.valid_to < now:
            raise HTTPException(status_code=400, detail="Blanket Purchase Agreement is outside its active validity period")

        if not release_items:
            raise HTTPException(status_code=400, detail="Release request must contain at least one product line item")

        # Fetch BPA lines
        lines_stmt = select(BlanketPurchaseAgreementLine).where(
            BlanketPurchaseAgreementLine.bpa_id == bpa_id,
            BlanketPurchaseAgreementLine.is_deleted == False
        )
        bpa_lines = {b_line.product_id: b_line for b_line in (await self.db.execute(lines_stmt)).scalars().all()}

        # 2. Count existing releases for release_no sequence
        rel_count_stmt = select(PurchaseOrder).where(
            PurchaseOrder.bpa_id == bpa_id,
            PurchaseOrder.company_id == self.tenant.company_id
        )
        existing_releases = list((await self.db.execute(rel_count_stmt)).scalars().all())
        bpa_release_no = len(existing_releases) + 1

        po_id = f"po-{uuid.uuid4().hex[:8]}"
        order_no = f"PO-REL-{bpa.bpa_code}-R{bpa_release_no:02d}-{uuid.uuid4().hex[:6].upper()}"

        subtotal = Decimal("0.00")
        tax_total = Decimal("0.00")
        po_items = []

        # 3. Process each release item line
        for req_item in release_items:
            product_id = req_item["product_id"]
            req_qty = Decimal(str(req_item["release_quantity"]))

            if req_qty <= Decimal("0.00"):
                raise HTTPException(status_code=400, detail=f"Release quantity must be greater than zero for product '{product_id}'")

            if product_id not in bpa_lines:
                raise HTTPException(status_code=400, detail=f"Product '{product_id}' is not committed under BPA '{bpa.bpa_code}'")

            line = bpa_lines[product_id]

            if req_qty > line.remaining_quantity:
                raise HTTPException(
                    status_code=400,
                    detail=f"Requested release quantity ({req_qty}) exceeds remaining commitment limit ({line.remaining_quantity}) for product '{product_id}'"
                )

            # Fetch product for code/name/tax
            p_stmt = select(Product).where(Product.id == product_id, Product.is_deleted == False)
            product = (await self.db.execute(p_stmt)).scalars().first()
            if not product:
                raise HTTPException(status_code=404, detail=f"Product '{product_id}' not found")

            gst_rate = Decimal("18.00")
            if product.gst_percentage is not None:
                gst_rate = Decimal(str(product.gst_percentage))

            unit_price = line.agreed_unit_price
            line_val = (unit_price * req_qty).quantize(Decimal("0.01"))

            tax_amt = (line_val * gst_rate / Decimal("100.00")).quantize(Decimal("0.01"))
            line_tot = (line_val + tax_amt).quantize(Decimal("0.01"))

            subtotal += line_val
            tax_total += tax_amt

            # Update line metrics
            line.released_quantity += req_qty
            line.remaining_quantity -= req_qty
            self.db.add(line)

            # Create PO Item
            poi = PurchaseOrderItem(
                id=f"poi-{uuid.uuid4().hex[:8]}",
                order_id=po_id,
                product_id=product_id,
                code=product.code,
                name=product.name,
                quantity=req_qty,
                cost_price=unit_price,
                gst_rate=gst_rate,
                tax_amount=tax_amt,
                line_total=line_tot,
                company_id=self.tenant.company_id,
                branch_id=self.tenant.branch_id
            )
            po_items.append(poi)

        # 4. Check total commitment value ceiling
        if subtotal > bpa.remaining_value:
            raise HTTPException(
                status_code=400,
                detail=f"Total release subtotal (₹{subtotal}) exceeds remaining agreement value ceiling (₹{bpa.remaining_value})"
            )

        bpa.released_value += subtotal
        bpa.remaining_value -= subtotal

        # Check for Auto-Exhaustion
        all_lines_exhausted = all(b_line.remaining_quantity <= Decimal("0.00") for b_line in bpa_lines.values())
        if all_lines_exhausted or bpa.remaining_value <= Decimal("0.00"):
            bpa.status = "Exhausted"

        self.db.add(bpa)

        # 5. Create Purchase Order Release
        po = PurchaseOrder(
            id=po_id,
            uuid=str(uuid.uuid4()),
            tenant_id=getattr(self.tenant, "tenant_id", None) or self.tenant.company_id,
            company_id=self.tenant.company_id,
            branch_id=self.tenant.branch_id,
            order_no=order_no,
            supplier_id=bpa.supplier_id,
            status="CONFIRMED",
            bpa_id=bpa.id,
            bpa_release_no=bpa_release_no,
            notes=f"Scheduled delivery release #{bpa_release_no} against BPA {bpa.bpa_code}",
            subtotal=subtotal.quantize(Decimal("0.01")),
            tax_total=tax_total.quantize(Decimal("0.01")),
            grand_total=(subtotal + tax_total).quantize(Decimal("0.01"))
        )
        self.db.add(po)
        self.db.add_all(po_items)

        await self.db.commit()
        await self.db.refresh(po)
        return po
