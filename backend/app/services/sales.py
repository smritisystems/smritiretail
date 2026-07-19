"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.26.0 (Phase 3 — PricingGroup Price Engine)
Created      : 2026-07-11
Modified     : 2026-07-18 (Phase 3)
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import uuid
from typing import List, Optional
from decimal import Decimal
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import delete
from sqlalchemy.orm import selectinload
from sqlalchemy.exc import IntegrityError
from fastapi import HTTPException
from ..models.sales import (
    SalesInvoice, SalesInvoiceItem,
    SalesQuotation, SalesQuotationItem,
    SalesOrder, SalesOrderItem,
    SalesReturn, SalesReturnItem,
)
from ..models.inventory import Product, StockMovement
from ..schemas.sales import (
    SalesInvoiceCreate,
    SalesInvoiceUpdate,
    SalesQuotationCreate,
    SalesQuotationUpdate,
    SalesOrderCreate,
    SalesOrderUpdate,
    SalesReturnCreate,
    SalesReturnUpdate,
)
from .crm import CrmService
from .inventory import InventoryService
from ..api.deps import TenantContext


def _uid() -> str:
    return uuid.uuid4().hex[:8]


class SalesService:
    def __init__(self, db: AsyncSession, tenant_ctx: TenantContext):
        self.db = db
        self.tenant_ctx = tenant_ctx
        self.crm_service = CrmService(db, tenant_ctx)
        self.inventory_service = InventoryService(db, tenant_ctx)

    # ──────────────────────────────────────────────────────────────
    # Sales Invoice
    # ──────────────────────────────────────────────────────────────

    async def create_sales_invoice(self, invoice_in: SalesInvoiceCreate) -> SalesInvoice:
        # Check duplicate invoice no
        existing = await self.db.execute(
            select(SalesInvoice).filter(
                SalesInvoice.invoice_no == invoice_in.invoice_no,
                SalesInvoice.is_deleted == False,
                SalesInvoice.company_id == self.tenant_ctx.company_id,
                SalesInvoice.branch_id == self.tenant_ctx.branch_id
            )
        )
        if existing.scalars().first():
            raise HTTPException(status_code=400, detail="Sales invoice with this invoice number already exists")

        # 1. Resolve customer pricing group → price engine parameters
        # This must happen BEFORE the item loop so the same policy applies to all lines.
        pricing_params = await self.crm_service.resolve_customer_pricing(invoice_in.customer_id)
        pg_discount    = Decimal(str(pricing_params["discount_percent"]))    # e.g. 5.00
        pg_adjustment  = Decimal(str(pricing_params["price_adjustment"]))    # absolute ±
        rounding_rule  = pricing_params["rounding_rule"]                     # e.g. "Nearest1"

        # 2. Validate items and calculate totals
        calculated_tax_total = Decimal("0.00")
        calculated_grand_total = Decimal("0.00")
        invoice_items = []

        for item in invoice_in.items:
            # Check stock
            available = await self.inventory_service.check_stock_availability(item.product_id, float(item.quantity))
            if not available:
                raise HTTPException(status_code=400, detail=f"Insufficient stock for product ID: {item.product_id}")

            quantity = item.quantity
            # --- Price Engine: apply PricingGroup discount + adjustment ---
            # item.price is the base selling price supplied by the frontend.
            # The PricingGroup can reduce it by discount_percent and then
            # shift it by an absolute price_adjustment (markup +ve / markdown -ve).
            base_price = item.price
            if pg_discount > Decimal("0"):
                base_price = base_price * (1 - pg_discount / Decimal("100"))
            if pg_adjustment != Decimal("0"):
                base_price = base_price + pg_adjustment
            # Rounding
            if rounding_rule == "Nearest1":
                price = base_price.quantize(Decimal("1"))
            elif rounding_rule == "Nearest5":
                price = (base_price / 5).quantize(Decimal("1")) * 5
            elif rounding_rule == "Nearest10":
                price = (base_price / 10).quantize(Decimal("1")) * 10
            else:
                price = base_price.quantize(Decimal("0.01"))
            gst_rate = item.gst_rate

            # Tax amount = quantity * effective_price * (gst_rate / 100)
            item_tax   = (quantity * price * (gst_rate / Decimal("100.00"))).quantize(Decimal("0.01"))
            item_total = (quantity * price + item_tax).quantize(Decimal("0.01"))

            calculated_tax_total   += item_tax
            calculated_grand_total += item_total

            db_item = SalesInvoiceItem(
                product_id=item.product_id,
                code=item.code,
                name=item.name,
                quantity=quantity,
                price=price,
                hsn_code=item.hsn_code,
                gst_rate=gst_rate,
                tax_amount=item_tax,
                total_amount=item_total
            )
            invoice_items.append(db_item)

        # 2. Check customer credit limit
        await self.crm_service.check_credit_limit(invoice_in.customer_id, float(calculated_grand_total))

        # 3. Save Sales Invoice & items
        db_invoice = SalesInvoice(
            id=invoice_in.id,
            invoice_no=invoice_in.invoice_no,
            date=invoice_in.date,
            customer_id=invoice_in.customer_id,
            tax_total=calculated_tax_total,
            grand_total=calculated_grand_total,
            is_interstate=invoice_in.is_interstate,
            eway_bill_no=invoice_in.eway_bill_no,
            status=invoice_in.status,
            items=invoice_items,
            company_id=self.tenant_ctx.company_id,
            branch_id=self.tenant_ctx.branch_id
        )

        # Deduct stock of products and record stock movements
        for item in invoice_in.items:
            product_stmt = select(Product).filter(
                Product.id == item.product_id,
                Product.is_deleted == False,
                Product.company_id == self.tenant_ctx.company_id,
                Product.branch_id == self.tenant_ctx.branch_id
            )
            product_res = await self.db.execute(product_stmt)
            product = product_res.scalars().first()
            if product and product.tracking_mode != "No-stock":
                product.stock -= int(item.quantity)
                self.db.add(product)

                # Record StockMovement
                movement_id = f"SM-{int(datetime.now(timezone.utc).timestamp())}-{uuid.uuid4().hex[:6]}"
                db_movement = StockMovement(
                    id=movement_id,
                    uuid=str(uuid.uuid4()),
                    product_id=product.id,
                    product_name=product.name,
                    sku=product.sku or product.code,
                    quantity=-item.quantity,  # Negative for OUT
                    movement_type="OUT",
                    reference_doc_type="Sales Invoice",
                    reference_doc_id=db_invoice.id,
                    warehouse="Default Warehouse",
                    unit_cost=product.cost_price or product.price,
                    remarks=f"Stock deducted for sales invoice: {db_invoice.invoice_no}",
                    source_module="Sales",
                    company_id=self.tenant_ctx.company_id,
                    branch_id=self.tenant_ctx.branch_id
                )
                self.db.add(db_movement)

        self.db.add(db_invoice)
        try:
            await self.db.commit()
        except IntegrityError:
            await self.db.rollback()
            raise HTTPException(
                status_code=400,
                detail="Sales invoice with this invoice number already exists"
            )
        await self.db.refresh(db_invoice)
        return db_invoice

    async def get_sales_invoice(self, invoice_id: str) -> tuple[SalesInvoice, List[SalesInvoiceItem]]:
        res = await self.db.execute(
            select(SalesInvoice)
            .options(selectinload(SalesInvoice.items))
            .where(
                SalesInvoice.id == invoice_id,
                SalesInvoice.company_id == self.tenant_ctx.company_id,
                SalesInvoice.branch_id == self.tenant_ctx.branch_id,
                SalesInvoice.is_deleted == False
            )
        )
        invoice = res.scalars().first()
        if not invoice:
            raise HTTPException(status_code=404, detail="Sales invoice not found")
        return invoice, invoice.items

    # ──────────────────────────────────────────────────────────────
    # Sales Quotation
    # ──────────────────────────────────────────────────────────────

    async def create_sales_quotation(self, q_in: SalesQuotationCreate) -> SalesQuotation:
        existing = await self.db.execute(
            select(SalesQuotation).filter(
                SalesQuotation.quotation_no == q_in.quotation_no,
                SalesQuotation.is_deleted == False,
                SalesQuotation.company_id == self.tenant_ctx.company_id,
                SalesQuotation.branch_id == self.tenant_ctx.branch_id
            )
        )
        if existing.scalars().first():
            raise HTTPException(status_code=400, detail="Sales quotation with this quotation number already exists")

        tax_total = Decimal("0.00")
        grand_total = Decimal("0.00")
        q_items = []

        for item in q_in.items:
            item_tax = (item.quantity * item.price * (item.gst_rate / Decimal("100.00"))).quantize(Decimal("0.01"))
            item_total = (item.quantity * item.price + item_tax).quantize(Decimal("0.01"))
            tax_total += item_tax
            grand_total += item_total

            q_items.append(SalesQuotationItem(
                product_id=item.product_id,
                code=item.code,
                name=item.name,
                quantity=item.quantity,
                price=item.price,
                hsn_code=item.hsn_code,
                gst_rate=item.gst_rate,
                tax_amount=item_tax,
                total_amount=item_total
            ))

        db_q = SalesQuotation(
            id=q_in.id,
            quotation_no=q_in.quotation_no,
            date=q_in.date,
            customer_name=q_in.customer_name,
            tax_total=tax_total,
            grand_total=grand_total,
            status=q_in.status,
            sales_order_id=q_in.sales_order_id,
            items=q_items,
            company_id=self.tenant_ctx.company_id,
            branch_id=self.tenant_ctx.branch_id
        )

        self.db.add(db_q)
        try:
            await self.db.commit()
        except IntegrityError:
            await self.db.rollback()
            raise HTTPException(status_code=400, detail="Sales quotation already exists")

        # Re-fetch with eager items to avoid MissingGreenlet during response serialization
        result = await self.db.execute(
            select(SalesQuotation)
            .options(selectinload(SalesQuotation.items))
            .where(SalesQuotation.id == db_q.id)
        )
        return result.scalars().first()

    async def list_sales_quotations(self) -> List[SalesQuotation]:
        res = await self.db.execute(
            select(SalesQuotation)
            .options(selectinload(SalesQuotation.items))
            .where(
                SalesQuotation.company_id == self.tenant_ctx.company_id,
                SalesQuotation.branch_id == self.tenant_ctx.branch_id,
                SalesQuotation.is_deleted == False
            )
        )
        return res.scalars().all()

    async def get_sales_quotation(self, q_id: str) -> tuple[SalesQuotation, List[SalesQuotationItem]]:
        res = await self.db.execute(
            select(SalesQuotation)
            .options(selectinload(SalesQuotation.items))
            .where(
                SalesQuotation.id == q_id,
                SalesQuotation.company_id == self.tenant_ctx.company_id,
                SalesQuotation.branch_id == self.tenant_ctx.branch_id,
                SalesQuotation.is_deleted == False
            )
        )
        q = res.scalars().first()
        if not q:
            raise HTTPException(status_code=404, detail="Sales quotation not found")
        return q, q.items

    # ──────────────────────────────────────────────────────────────
    # Sales Order
    # ──────────────────────────────────────────────────────────────

    async def create_sales_order(self, so_in: SalesOrderCreate) -> SalesOrder:
        existing = await self.db.execute(
            select(SalesOrder).filter(
                SalesOrder.order_no == so_in.order_no,
                SalesOrder.is_deleted == False,
                SalesOrder.company_id == self.tenant_ctx.company_id,
                SalesOrder.branch_id == self.tenant_ctx.branch_id
            )
        )
        if existing.scalars().first():
            raise HTTPException(status_code=400, detail="Sales order with this order number already exists")

        tax_total = Decimal("0.00")
        grand_total = Decimal("0.00")
        so_items = []

        for item in so_in.items:
            item_tax = (item.quantity * item.price * (item.gst_rate / Decimal("100.00"))).quantize(Decimal("0.01"))
            item_total = (item.quantity * item.price + item_tax).quantize(Decimal("0.01"))
            tax_total += item_tax
            grand_total += item_total

            so_items.append(SalesOrderItem(
                product_id=item.product_id,
                code=item.code,
                name=item.name,
                quantity=item.quantity,
                price=item.price,
                hsn_code=item.hsn_code,
                gst_rate=item.gst_rate,
                tax_amount=item_tax,
                total_amount=item_total
            ))

        db_so = SalesOrder(
            id=so_in.id,
            order_no=so_in.order_no,
            date=so_in.date,
            customer_name=so_in.customer_name,
            tax_total=tax_total,
            grand_total=grand_total,
            status=so_in.status,
            source_quotation_id=so_in.source_quotation_id,
            items=so_items,
            company_id=self.tenant_ctx.company_id,
            branch_id=self.tenant_ctx.branch_id
        )

        self.db.add(db_so)
        try:
            await self.db.commit()
        except IntegrityError:
            await self.db.rollback()
            raise HTTPException(status_code=400, detail="Sales order already exists")

        # Re-fetch with eager items to avoid MissingGreenlet during response serialization
        result = await self.db.execute(
            select(SalesOrder)
            .options(selectinload(SalesOrder.items))
            .where(SalesOrder.id == db_so.id)
        )
        return result.scalars().first()

    async def list_sales_orders(self) -> List[SalesOrder]:
        res = await self.db.execute(
            select(SalesOrder)
            .options(selectinload(SalesOrder.items))
            .where(
                SalesOrder.company_id == self.tenant_ctx.company_id,
                SalesOrder.branch_id == self.tenant_ctx.branch_id,
                SalesOrder.is_deleted == False
            )
        )
        return res.scalars().all()

    async def get_sales_order(self, so_id: str) -> tuple[SalesOrder, List[SalesOrderItem]]:
        res = await self.db.execute(
            select(SalesOrder)
            .options(selectinload(SalesOrder.items))
            .where(
                SalesOrder.id == so_id,
                SalesOrder.company_id == self.tenant_ctx.company_id,
                SalesOrder.branch_id == self.tenant_ctx.branch_id,
                SalesOrder.is_deleted == False
            )
        )
        so = res.scalars().first()
        if not so:
            raise HTTPException(status_code=404, detail="Sales order not found")
        return so, so.items

    # ──────────────────────────────────────────────────────────────
    # Sales Return
    # ──────────────────────────────────────────────────────────────

    async def create_sales_return(self, sr_in: SalesReturnCreate) -> SalesReturn:
        # Check original invoice exists
        inv_res = await self.db.execute(
            select(SalesInvoice).filter(
                SalesInvoice.id == sr_in.original_invoice_id,
                SalesInvoice.company_id == self.tenant_ctx.company_id,
                SalesInvoice.branch_id == self.tenant_ctx.branch_id,
                SalesInvoice.is_deleted == False
            )
        )
        if not inv_res.scalars().first():
            raise HTTPException(status_code=404, detail="Original sales invoice not found")

        existing = await self.db.execute(
            select(SalesReturn).filter(
                SalesReturn.return_no == sr_in.return_no,
                SalesReturn.is_deleted == False,
                SalesReturn.company_id == self.tenant_ctx.company_id,
                SalesReturn.branch_id == self.tenant_ctx.branch_id
            )
        )
        if existing.scalars().first():
            raise HTTPException(status_code=400, detail="Sales return with this return number already exists")

        tax_total = Decimal("0.00")
        grand_total = Decimal("0.00")
        sr_items = []
        product_stock_updates = []

        for item in sr_in.items:
            # Check product
            res = await self.db.execute(
                select(Product).where(
                    Product.id == item.product_id,
                    Product.company_id == self.tenant_ctx.company_id,
                    Product.branch_id == self.tenant_ctx.branch_id,
                    Product.is_deleted == False
                )
            )
            product = res.scalars().first()
            if not product:
                raise HTTPException(status_code=404, detail=f"Product with ID {item.product_id} not found")

            item_tax = (item.quantity * item.price * (item.gst_rate / Decimal("100.00"))).quantize(Decimal("0.01"))
            item_total = (item.quantity * item.price + item_tax).quantize(Decimal("0.01"))
            tax_total += item_tax
            grand_total += item_total

            sr_items.append(SalesReturnItem(
                product_id=item.product_id,
                code=item.code,
                name=item.name,
                quantity=item.quantity,
                price=item.price,
                gst_rate=item.gst_rate,
                tax_amount=item_tax,
                total_amount=item_total
            ))
            product_stock_updates.append((product, item.quantity))

        db_sr = SalesReturn(
            id=sr_in.id,
            return_no=sr_in.return_no,
            original_invoice_id=sr_in.original_invoice_id,
            credit_note_number=sr_in.credit_note_number or f"CN-{sr_in.return_no}",
            date=sr_in.date,
            reason=sr_in.reason,
            tax_total=tax_total,
            grand_total=grand_total,
            is_interstate=sr_in.is_interstate,
            status=sr_in.status,
            items=sr_items,
            company_id=self.tenant_ctx.company_id,
            branch_id=self.tenant_ctx.branch_id
        )

        # Apply stock increments (returned items add back to stock) and record stock movements
        for product, qty in product_stock_updates:
            if product.tracking_mode != "No-stock":
                product.stock += int(qty)
                product.modified_at = datetime.now(timezone.utc)
                self.db.add(product)

                # Record StockMovement
                movement_id = f"SM-{int(datetime.now(timezone.utc).timestamp())}-{uuid.uuid4().hex[:6]}"
                db_movement = StockMovement(
                    id=movement_id,
                    uuid=str(uuid.uuid4()),
                    product_id=product.id,
                    product_name=product.name,
                    sku=product.sku or product.code,
                    quantity=qty,  # Positive for IN
                    movement_type="IN",
                    reference_doc_type="Sales Return",
                    reference_doc_id=db_sr.id,
                    warehouse="Default Warehouse",
                    unit_cost=product.cost_price or product.price,
                    remarks=f"Stock incremented for sales return: {db_sr.return_no}",
                    source_module="Sales",
                    company_id=self.tenant_ctx.company_id,
                    branch_id=self.tenant_ctx.branch_id
                )
                self.db.add(db_movement)

        self.db.add(db_sr)
        try:
            await self.db.commit()
        except IntegrityError:
            await self.db.rollback()
            raise HTTPException(status_code=400, detail="Sales return already exists")

        # Re-fetch with eager items to avoid MissingGreenlet during response serialization
        result = await self.db.execute(
            select(SalesReturn)
            .options(selectinload(SalesReturn.items))
            .where(SalesReturn.id == db_sr.id)
        )
        return result.scalars().first()

    async def list_sales_returns(self) -> List[SalesReturn]:
        res = await self.db.execute(
            select(SalesReturn)
            .options(selectinload(SalesReturn.items))
            .where(
                SalesReturn.company_id == self.tenant_ctx.company_id,
                SalesReturn.branch_id == self.tenant_ctx.branch_id,
                SalesReturn.is_deleted == False
            )
        )
        return res.scalars().all()

    async def get_sales_return(self, sr_id: str) -> tuple[SalesReturn, List[SalesReturnItem]]:
        res = await self.db.execute(
            select(SalesReturn)
            .options(selectinload(SalesReturn.items))
            .where(
                SalesReturn.id == sr_id,
                SalesReturn.company_id == self.tenant_ctx.company_id,
                SalesReturn.branch_id == self.tenant_ctx.branch_id,
                SalesReturn.is_deleted == False
            )
        )
        sr = res.scalars().first()
        if not sr:
            raise HTTPException(status_code=404, detail="Sales return not found")
        return sr, sr.items

    # ───────────────────────────────────────────────────────────────
    # Phase 2 — UPDATE / CANCEL / DELETE
    # ───────────────────────────────────────────────────────────────

    # ── Invoice UPDATE ──────────────────────────────────────────────

    async def update_sales_invoice(
        self, invoice_id: str, update_in: SalesInvoiceUpdate
    ) -> SalesInvoice:
        """
        Partial-update a sales invoice.
        If items are supplied, old items are replaced and totals are server-side re-computed.
        Stock adjustments are NOT made on update; use Sales Returns for stock reversal.
        """
        res = await self.db.execute(
            select(SalesInvoice)
            .options(selectinload(SalesInvoice.items))
            .where(
                SalesInvoice.id         == invoice_id,
                SalesInvoice.company_id == self.tenant_ctx.company_id,
                SalesInvoice.branch_id  == self.tenant_ctx.branch_id,
                SalesInvoice.is_deleted == False,
            )
        )
        invoice = res.scalars().first()
        if not invoice:
            raise HTTPException(status_code=404, detail="Sales invoice not found")

        # Apply scalar patches
        for attr in ("status", "customer_id", "date", "is_interstate",
                     "eway_bill_no", "invoice_no"):
            val = getattr(update_in, attr)
            if val is not None:
                setattr(invoice, attr, val)

        if update_in.items is not None:
            # Reassign the collection — delete-orphan cascade handles deleting old items
            # and the unit-of-work inserts new ones in the correct order.
            tax_total   = Decimal("0.00")
            grand_total = Decimal("0.00")
            new_items   = []
            for item in update_in.items:
                item_tax   = (item.quantity * item.price
                               * (item.gst_rate / Decimal("100.00"))).quantize(Decimal("0.01"))
                item_total = (item.quantity * item.price + item_tax).quantize(Decimal("0.01"))
                tax_total   += item_tax
                grand_total += item_total
                new_items.append(SalesInvoiceItem(
                    invoice_id=invoice.id,
                    product_id=item.product_id, code=item.code, name=item.name,
                    quantity=item.quantity, price=item.price,
                    hsn_code=item.hsn_code, gst_rate=item.gst_rate,
                    tax_amount=item_tax, total_amount=item_total,
                ))
            invoice.items       = new_items  # orphans scheduled for DELETE, new for INSERT
            invoice.tax_total   = tax_total
            invoice.grand_total = grand_total
        else:
            if update_in.tax_total   is not None: invoice.tax_total   = update_in.tax_total
            if update_in.grand_total is not None: invoice.grand_total = update_in.grand_total

        invoice.modified_at = datetime.now(timezone.utc)
        self.db.add(invoice)
        await self.db.commit()

        result = await self.db.execute(
            select(SalesInvoice)
            .options(selectinload(SalesInvoice.items))
            .where(SalesInvoice.id == invoice.id)
        )
        return result.scalars().first()

    # ── Invoice CANCEL (DELETE) ─────────────────────────────────────

    async def cancel_sales_invoice(self, invoice_id: str) -> SalesInvoice:
        """
        Cancel a sales invoice: set status='Cancelled' and soft-delete (is_deleted=True).
        This mirrors the Express DELETE /api/sales/invoices/:id behaviour.
        Stock reversal is NOT performed here; use Sales Returns for that.
        """
        res = await self.db.execute(
            select(SalesInvoice).where(
                SalesInvoice.id         == invoice_id,
                SalesInvoice.company_id == self.tenant_ctx.company_id,
                SalesInvoice.branch_id  == self.tenant_ctx.branch_id,
                SalesInvoice.is_deleted == False,
            )
        )
        invoice = res.scalars().first()
        if not invoice:
            raise HTTPException(status_code=404, detail="Sales invoice not found")

        invoice.status      = "Cancelled"
        invoice.is_deleted  = True
        invoice.modified_at = datetime.now(timezone.utc)
        self.db.add(invoice)
        await self.db.commit()
        await self.db.refresh(invoice)
        return invoice

    # ── Quotation UPDATE ────────────────────────────────────────────

    async def update_sales_quotation(
        self, q_id: str, update_in: SalesQuotationUpdate
    ) -> SalesQuotation:
        res = await self.db.execute(
            select(SalesQuotation)
            .options(selectinload(SalesQuotation.items))
            .where(
                SalesQuotation.id         == q_id,
                SalesQuotation.company_id == self.tenant_ctx.company_id,
                SalesQuotation.branch_id  == self.tenant_ctx.branch_id,
                SalesQuotation.is_deleted == False,
            )
        )
        q = res.scalars().first()
        if not q:
            raise HTTPException(status_code=404, detail="Sales quotation not found")

        for attr in ("quotation_no", "date", "customer_name", "status", "sales_order_id"):
            val = getattr(update_in, attr)
            if val is not None:
                setattr(q, attr, val)

        if update_in.items is not None:
            await self.db.execute(
                delete(SalesQuotationItem).where(SalesQuotationItem.quotation_id == q.id)
            )
            tax_total   = Decimal("0.00")
            grand_total = Decimal("0.00")
            for item in update_in.items:
                item_tax   = (item.quantity * item.price
                               * (item.gst_rate / Decimal("100.00"))).quantize(Decimal("0.01"))
                item_total = (item.quantity * item.price + item_tax).quantize(Decimal("0.01"))
                tax_total   += item_tax
                grand_total += item_total
                self.db.add(SalesQuotationItem(
                    quotation_id=q.id,
                    product_id=item.product_id, code=item.code, name=item.name,
                    quantity=item.quantity, price=item.price,
                    hsn_code=item.hsn_code, gst_rate=item.gst_rate,
                    tax_amount=item_tax, total_amount=item_total,
                ))
            q.tax_total   = tax_total
            q.grand_total = grand_total
        else:
            if update_in.tax_total   is not None: q.tax_total   = update_in.tax_total
            if update_in.grand_total is not None: q.grand_total = update_in.grand_total

        q.modified_at = datetime.now(timezone.utc)
        self.db.add(q)
        await self.db.commit()

        result = await self.db.execute(
            select(SalesQuotation)
            .options(selectinload(SalesQuotation.items))
            .where(SalesQuotation.id == q.id)
        )
        return result.scalars().first()

    # ── Quotation DELETE ────────────────────────────────────────────

    async def delete_sales_quotation(self, q_id: str) -> None:
        res = await self.db.execute(
            select(SalesQuotation).where(
                SalesQuotation.id         == q_id,
                SalesQuotation.company_id == self.tenant_ctx.company_id,
                SalesQuotation.branch_id  == self.tenant_ctx.branch_id,
                SalesQuotation.is_deleted == False,
            )
        )
        q = res.scalars().first()
        if not q:
            raise HTTPException(status_code=404, detail="Sales quotation not found")
        q.is_deleted  = True
        q.modified_at = datetime.now(timezone.utc)
        self.db.add(q)
        await self.db.commit()

    # ── Order UPDATE ────────────────────────────────────────────────

    async def update_sales_order(
        self, so_id: str, update_in: SalesOrderUpdate
    ) -> SalesOrder:
        res = await self.db.execute(
            select(SalesOrder)
            .options(selectinload(SalesOrder.items))
            .where(
                SalesOrder.id         == so_id,
                SalesOrder.company_id == self.tenant_ctx.company_id,
                SalesOrder.branch_id  == self.tenant_ctx.branch_id,
                SalesOrder.is_deleted == False,
            )
        )
        so = res.scalars().first()
        if not so:
            raise HTTPException(status_code=404, detail="Sales order not found")

        for attr in ("order_no", "date", "customer_name", "status", "source_quotation_id"):
            val = getattr(update_in, attr)
            if val is not None:
                setattr(so, attr, val)

        if update_in.items is not None:
            await self.db.execute(
                delete(SalesOrderItem).where(SalesOrderItem.order_id == so.id)
            )
            tax_total   = Decimal("0.00")
            grand_total = Decimal("0.00")
            for item in update_in.items:
                item_tax   = (item.quantity * item.price
                               * (item.gst_rate / Decimal("100.00"))).quantize(Decimal("0.01"))
                item_total = (item.quantity * item.price + item_tax).quantize(Decimal("0.01"))
                tax_total   += item_tax
                grand_total += item_total
                self.db.add(SalesOrderItem(
                    order_id=so.id,
                    product_id=item.product_id, code=item.code, name=item.name,
                    quantity=item.quantity, price=item.price,
                    hsn_code=item.hsn_code, gst_rate=item.gst_rate,
                    tax_amount=item_tax, total_amount=item_total,
                ))
            so.tax_total   = tax_total
            so.grand_total = grand_total
        else:
            if update_in.tax_total   is not None: so.tax_total   = update_in.tax_total
            if update_in.grand_total is not None: so.grand_total = update_in.grand_total

        so.modified_at = datetime.now(timezone.utc)
        self.db.add(so)
        await self.db.commit()

        result = await self.db.execute(
            select(SalesOrder)
            .options(selectinload(SalesOrder.items))
            .where(SalesOrder.id == so.id)
        )
        return result.scalars().first()

    # ── Order DELETE ────────────────────────────────────────────────

    async def delete_sales_order(self, so_id: str) -> None:
        res = await self.db.execute(
            select(SalesOrder).where(
                SalesOrder.id         == so_id,
                SalesOrder.company_id == self.tenant_ctx.company_id,
                SalesOrder.branch_id  == self.tenant_ctx.branch_id,
                SalesOrder.is_deleted == False,
            )
        )
        so = res.scalars().first()
        if not so:
            raise HTTPException(status_code=404, detail="Sales order not found")
        so.is_deleted  = True
        so.modified_at = datetime.now(timezone.utc)
        self.db.add(so)
        await self.db.commit()

    # ── Return UPDATE ───────────────────────────────────────────────

    async def update_sales_return(
        self, sr_id: str, update_in: SalesReturnUpdate
    ) -> SalesReturn:
        res = await self.db.execute(
            select(SalesReturn)
            .options(selectinload(SalesReturn.items))
            .where(
                SalesReturn.id         == sr_id,
                SalesReturn.company_id == self.tenant_ctx.company_id,
                SalesReturn.branch_id  == self.tenant_ctx.branch_id,
                SalesReturn.is_deleted == False,
            )
        )
        sr = res.scalars().first()
        if not sr:
            raise HTTPException(status_code=404, detail="Sales return not found")

        for attr in ("return_no", "original_invoice_id", "credit_note_number",
                     "date", "reason", "is_interstate", "status"):
            val = getattr(update_in, attr)
            if val is not None:
                setattr(sr, attr, val)

        if update_in.items is not None:
            await self.db.execute(
                delete(SalesReturnItem).where(SalesReturnItem.return_id == sr.id)
            )
            tax_total   = Decimal("0.00")
            grand_total = Decimal("0.00")
            for item in update_in.items:
                item_tax   = (item.quantity * item.price
                               * (item.gst_rate / Decimal("100.00"))).quantize(Decimal("0.01"))
                item_total = (item.quantity * item.price + item_tax).quantize(Decimal("0.01"))
                tax_total   += item_tax
                grand_total += item_total
                self.db.add(SalesReturnItem(
                    return_id=sr.id,
                    product_id=item.product_id, code=item.code, name=item.name,
                    quantity=item.quantity, price=item.price,
                    gst_rate=item.gst_rate,
                    tax_amount=item_tax, total_amount=item_total,
                ))
            sr.tax_total   = tax_total
            sr.grand_total = grand_total
        else:
            if update_in.tax_total   is not None: sr.tax_total   = update_in.tax_total
            if update_in.grand_total is not None: sr.grand_total = update_in.grand_total

        sr.modified_at = datetime.now(timezone.utc)
        self.db.add(sr)
        await self.db.commit()

        result = await self.db.execute(
            select(SalesReturn)
            .options(selectinload(SalesReturn.items))
            .where(SalesReturn.id == sr.id)
        )
        return result.scalars().first()

    # ── Return DELETE ───────────────────────────────────────────────

    async def delete_sales_return(self, sr_id: str) -> None:
        res = await self.db.execute(
            select(SalesReturn).where(
                SalesReturn.id         == sr_id,
                SalesReturn.company_id == self.tenant_ctx.company_id,
                SalesReturn.branch_id  == self.tenant_ctx.branch_id,
                SalesReturn.is_deleted == False,
            )
        )
        sr = res.scalars().first()
        if not sr:
            raise HTTPException(status_code=404, detail="Sales return not found")
        sr.is_deleted  = True
        sr.modified_at = datetime.now(timezone.utc)
        self.db.add(sr)
        await self.db.commit()


    # ─────────────────────────── Phase 4B: Workflow ─────────────────────────────

    async def approve_sales_invoice(self, invoice_id: str) -> SalesInvoice:
        """
        Approve a sales invoice: Draft → Confirmed.
        Sets status='Confirmed' and updates modified_at.
        """
        res = await self.db.execute(
            select(SalesInvoice).where(
                SalesInvoice.id         == invoice_id,
                SalesInvoice.company_id == self.tenant_ctx.company_id,
                SalesInvoice.branch_id  == self.tenant_ctx.branch_id,
                SalesInvoice.is_deleted == False,
            )
        )
        invoice = res.scalars().first()
        if not invoice:
            raise HTTPException(status_code=404, detail="Sales invoice not found")
        if invoice.status not in ("Draft", "Submitted"):
            raise HTTPException(
                status_code=400,
                detail=f"Cannot approve an invoice with status '{invoice.status}'.",
            )
        invoice.status      = "Confirmed"
        invoice.modified_at = datetime.now(timezone.utc)
        self.db.add(invoice)
        await self.db.commit()
        await self.db.refresh(invoice)
        return invoice

    # ─────────────────────────── Phase 4B: Convert Quotation ────────────────────

    async def convert_quotation_to_invoice(self, q_id: str) -> SalesInvoice:
        """
        Convert a sales quotation to a sales invoice.
        - Quotation status must be Draft or Approved.
        - Creates a new SalesInvoice from the quotation's lines.
        - Marks the quotation status as 'Converted'.
        """
        q_res = await self.db.execute(
            select(SalesQuotation)
            .options(selectinload(SalesQuotation.items))
            .where(
                SalesQuotation.id         == q_id,
                SalesQuotation.company_id == self.tenant_ctx.company_id,
                SalesQuotation.branch_id  == self.tenant_ctx.branch_id,
                SalesQuotation.is_deleted == False,
            )
        )
        quotation = q_res.scalars().first()
        if not quotation:
            raise HTTPException(status_code=404, detail="Quotation not found")
        if quotation.status not in ("Draft", "Approved", "Submitted"):
            raise HTTPException(
                status_code=400,
                detail=f"Cannot convert a quotation with status '{quotation.status}'.",
            )
        if not quotation.items:
            raise HTTPException(status_code=400, detail="Quotation has no line items to convert.")

        # Build invoice from quotation
        invoice_id = _uid()
        invoice = SalesInvoice(
            id           = invoice_id,
            company_id   = self.tenant_ctx.company_id,
            branch_id    = self.tenant_ctx.branch_id,
            invoice_no   = f"INV-{invoice_id[:6].upper()}",
            status       = "Draft",
            payment_mode = "Cash",
            tax_total    = Decimal("0.00"),
            grand_total  = quotation.grand_total or Decimal("0.00"),
        )
        self.db.add(invoice)

        for q_item in quotation.items:
            line_price = Decimal(str(q_item.price))
            line_qty   = Decimal(str(q_item.quantity))
            line_total = line_price * line_qty
            inv_item = SalesInvoiceItem(
                invoice_id   = invoice.id,
                product_id   = q_item.product_id,
                code         = q_item.code,
                name         = q_item.name,
                quantity     = line_qty,
                price        = line_price,
                gst_rate     = q_item.gst_rate or Decimal("0"),
                tax_amount   = Decimal("0.00"),
                total_amount = line_total,
            )
            self.db.add(inv_item)

        # Mark quotation converted
        quotation.status      = "Converted"
        quotation.modified_at = datetime.now(timezone.utc)
        self.db.add(quotation)

        await self.db.commit()
        await self.db.refresh(invoice)
        return invoice
