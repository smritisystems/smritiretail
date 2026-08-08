"""
Author & Creator:
Jawahar Ramkripal Mallah

Founder:
SmritiSys
AITDL Networks

Role:
Chief Systems Architect

Web:
smritisys.com | smritibooks.com | aitdl.com

Email:
jawahar.mallah@gmail.com

Copyright © 2026 SmritiSys.
All Rights Reserved.
"""

import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import List, Optional

from fastapi import HTTPException


def _uid() -> str:
    return uuid.uuid4().hex[:8]
from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

from app.api.deps import TenantContext
from app.models.crm import Customer
from app.models.sales import SalesInvoice, SalesInvoiceItem, SalesOrder, SalesOrderItem, SalesQuotation, SalesQuotationItem
from app.repositories.customer import CustomerRepository
from app.repositories.sales import SalesQuotationRepository
from app.schemas.crm import CustomerCreate
from app.schemas.sales import SalesQuotationCreate, SalesQuotationUpdate
from app.services.sales_orchestrator import SalesBusinessOrchestrator


class QuotationApplicationService:
    def __init__(self, db: AsyncSession, tenant_ctx: TenantContext):
        self.db = db
        self.tenant_ctx = tenant_ctx
        self.repository = SalesQuotationRepository(db, tenant_ctx)
        self.orchestrator = SalesBusinessOrchestrator(db, tenant_ctx)

    async def _calculate_item_totals(self, item) -> dict:
        resolved = await self.orchestrator.resolve_gst(item.product_id, item.gst_rate)
        gst_rate = resolved["gst_rate"]

        item_tax = (item.quantity * item.price * (gst_rate / Decimal("100.00"))).quantize(Decimal("0.01"))
        item_total = (item.quantity * item.price + item_tax).quantize(Decimal("0.01"))
        cgst_amount = (item_tax / 2).quantize(Decimal("0.01"))
        sgst_amount = item_tax - cgst_amount
        igst_amount = Decimal("0.00")

        return {
            "gst_rate": gst_rate,
            "tax_amount": item_tax,
            "total_amount": item_total,
            "cgst_amount": cgst_amount,
            "sgst_amount": sgst_amount,
            "igst_amount": igst_amount,
        }

    async def _ensure_editable(self, quotation: SalesQuotation) -> None:
        if quotation.status in {"Cancelled", "Converted"}:
            raise HTTPException(
                status_code=400,
                detail=f"Cannot modify a quotation with status '{quotation.status}'."
            )

    async def create_quotation(self, q_in: SalesQuotationCreate) -> SalesQuotation:
        return await self.orchestrator.create_sales_quotation(q_in)

    async def _populate_item_inventory_fields(self, item: SalesQuotationItem) -> None:
        snapshot = await self.orchestrator.resolve_inventory_snapshot(item.product_id)
        avail = snapshot.get("available_qty")
        resv = snapshot.get("reserved_qty")

        def _fmt_qty(qty_val):
            if qty_val is None:
                return "0"
            try:
                dec = Decimal(str(qty_val))
                if dec % 1 == 0:
                    return str(int(dec))
                return str(dec.normalize())
            except Exception:
                return str(qty_val)

        setattr(item, "available_stock", _fmt_qty(avail))
        setattr(item, "reserved_stock", _fmt_qty(resv))

    async def _populate_quotations_inventory(self, quotations: List[SalesQuotation]) -> None:
        for quotation in quotations:
            for item in quotation.items or []:
                await self._populate_item_inventory_fields(item)

    async def list_quotations(self) -> List[SalesQuotation]:
        quotations = await self.repository.get_all()
        await self._populate_quotations_inventory(quotations)
        return quotations

    async def get_quotation(self, q_id: str) -> tuple[SalesQuotation, List[SalesQuotationItem]]:
        quotation = await self.repository.get_with_items(q_id)
        if not quotation:
            raise HTTPException(status_code=404, detail="Sales quotation not found")
        await self._populate_quotations_inventory([quotation])
        return quotation, quotation.items

    async def update_quotation(self, q_id: str, update_in: SalesQuotationUpdate) -> SalesQuotation:
        quotation = await self.repository.get_with_items(q_id)
        if not quotation:
            raise HTTPException(status_code=404, detail="Sales quotation not found")

        await self._ensure_editable(quotation)

        if update_in.status is not None and update_in.status.title() != quotation.status:
            raise HTTPException(
                status_code=400,
                detail="Sales quotation status can only be changed through workflow actions"
            )
        if update_in.sales_order_id is not None and update_in.sales_order_id != quotation.sales_order_id:
            raise HTTPException(
                status_code=400,
                detail="Sales quotation sales_order_id can only be set through conversion operations"
            )

        for attr in ("quotation_no", "date", "customer_name"):
            val = getattr(update_in, attr)
            if val is not None:
                setattr(quotation, attr, val)

        if update_in.items is not None:
            await self.db.execute(delete(SalesQuotationItem).where(SalesQuotationItem.quotation_id == quotation.id))
            tax_total = Decimal("0.00")
            grand_total = Decimal("0.00")
            cgst_total = Decimal("0.00")
            sgst_total = Decimal("0.00")
            igst_total = Decimal("0.00")
            new_items: List[SalesQuotationItem] = []

            for item in update_in.items:
                totals = await self._calculate_item_totals(item)
                tax_total += totals["tax_amount"]
                grand_total += totals["total_amount"]
                cgst_total += totals["cgst_amount"]
                sgst_total += totals["sgst_amount"]
                igst_total += totals["igst_amount"]

                new_items.append(SalesQuotationItem(
                    product_id=item.product_id,
                    code=item.code,
                    name=item.name,
                    quantity=item.quantity,
                    price=item.price,
                    hsn_code=item.hsn_code,
                    gst_rate=totals["gst_rate"],
                    tax_amount=totals["tax_amount"],
                    total_amount=totals["total_amount"],
                    cgst_amount=totals["cgst_amount"],
                    sgst_amount=totals["sgst_amount"],
                    igst_amount=totals["igst_amount"],
                    tenant_id=self.tenant_ctx.tenant_id,
                    company_id=self.tenant_ctx.company_id,
                    branch_id=self.tenant_ctx.branch_id,
                ))

            quotation.items = new_items
            quotation.tax_total = tax_total
            quotation.grand_total = grand_total
            quotation.cgst_total = cgst_total
            quotation.sgst_total = sgst_total
            quotation.igst_total = igst_total

        elif update_in.tax_total is not None:
            quotation.tax_total = update_in.tax_total
            quotation.grand_total = update_in.grand_total or quotation.grand_total

        quotation.modified_at = datetime.now(timezone.utc)
        self.db.add(quotation)
        await self.db.commit()
        return await self.repository.get_with_items(q_id)

    async def delete_quotation(self, q_id: str) -> None:
        quotation = await self.repository.get_with_items(q_id)
        if not quotation:
            raise HTTPException(status_code=404, detail="Sales quotation not found")
        quotation.status = "Cancelled"
        quotation.is_deleted = True
        quotation.modified_at = datetime.now(timezone.utc)
        self.db.add(quotation)
        await self.db.commit()

    async def submit_quotation(self, q_id: str) -> SalesQuotation:
        return await self._update_status(q_id, "Submitted", allowed_from={"Draft"})

    async def approve_quotation(self, q_id: str) -> SalesQuotation:
        return await self._update_status(q_id, "Approved", allowed_from={"Draft", "Submitted"})

    async def reject_quotation(self, q_id: str) -> SalesQuotation:
        return await self._update_status(q_id, "Rejected", allowed_from={"Submitted"})

    async def cancel_quotation(self, q_id: str) -> SalesQuotation:
        quotation = await self.repository.get_with_items(q_id)
        if not quotation:
            raise HTTPException(status_code=404, detail="Sales quotation not found")
        quotation.status = "Cancelled"
        quotation.is_deleted = True
        quotation.modified_at = datetime.now(timezone.utc)
        self.db.add(quotation)
        await self.db.commit()
        return quotation

    async def convert_to_sales_order(self, q_id: str):
        quotation = await self.repository.get_with_items(q_id)
        if not quotation:
            raise HTTPException(status_code=404, detail="Sales quotation not found")
        if quotation.status not in ("Draft", "Submitted", "Approved"):
            raise HTTPException(
                status_code=400,
                detail=f"Cannot convert a quotation with status '{quotation.status}'."
            )
        if not quotation.items:
            raise HTTPException(status_code=400, detail="Quotation has no line items to convert.")

        return await self.orchestrator.convert_quotation_to_order(q_id)

    async def convert_quotation_to_invoice(self, q_id: str) -> SalesInvoice:
        quotation = await self.repository.get_with_items(q_id)
        if not quotation:
            raise HTTPException(status_code=404, detail="Sales quotation not found")
        if quotation.status not in ("Draft", "Submitted", "Approved"):
            raise HTTPException(
                status_code=400,
                detail=f"Cannot convert a quotation with status '{quotation.status}'."
            )
        if not quotation.items:
            raise HTTPException(status_code=400, detail="Quotation has no line items to convert.")

        invoice = await self.orchestrator.convert_quotation_to_invoice(q_id)
        return invoice

    async def _resolve_or_create_customer_id(self, customer_name: str) -> str:
        return await self.orchestrator.resolve_or_create_customer_id(customer_name)

    async def _update_status(self, q_id: str, status: str, allowed_from: set[str]) -> SalesQuotation:
        quotation = await self.repository.get_with_items(q_id)
        if not quotation:
            raise HTTPException(status_code=404, detail="Sales quotation not found")
        if quotation.status not in allowed_from:
            raise HTTPException(status_code=400, detail=f"Quotation status must be one of {sorted(allowed_from)} to transition to {status}")
        quotation.status = status
        quotation.modified_at = datetime.now(timezone.utc)
        self.db.add(quotation)
        await self.db.commit()
        return quotation
