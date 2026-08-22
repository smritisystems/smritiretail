"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.18.1 (Phase 2 — Sales UPDATE/DELETE/CANCEL)
Created      : 2026-07-11
Modified     : 2026-07-15 (Phase 2)
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
from ..models.tenant import Company
from ..core.gst_engine import (
    calculate_line_item_tax,
    validate_gstin,
    extract_state_code_from_gstin,
    determine_gstr1_table,
    GST_STATE_CODES,
)
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

    async def create_sales_invoice(self, invoice_in: SalesInvoiceCreate, idempotency_key: Optional[str] = None) -> SalesInvoice:
        # Auto-generate ID and invoice_no if missing; use idempotency_key as primary invoice_id if supplied
        invoice_id = idempotency_key or invoice_in.id or f"inv-{int(datetime.now(timezone.utc).timestamp())}-{uuid.uuid4().hex[:6]}"
        invoice_no = invoice_in.invoice_no or f"INV-{invoice_id.upper()}"

        # Idempotency / Double-Submit protection: return existing invoice if already created
        existing = await self.db.execute(
            select(SalesInvoice)
            .options(selectinload(SalesInvoice.items))
            .filter(
                (SalesInvoice.id == invoice_id) | (SalesInvoice.invoice_no == invoice_no),
                SalesInvoice.is_deleted == False,
                SalesInvoice.company_id == self.tenant_ctx.company_id,
                SalesInvoice.branch_id == self.tenant_ctx.branch_id
            )
        )
        existing_inv = existing.scalars().first()
        if existing_inv:
            return existing_inv

        # Resolve company store state code
        company_state_code = "27"  # Default Maharashtra
        comp_stmt = select(Company).filter(Company.id == self.tenant_ctx.company_id, Company.is_deleted == False)
        comp_res = await self.db.execute(comp_stmt)
        company_obj = comp_res.scalars().first()
        if company_obj and company_obj.gst_number:
            extracted_comp_state = extract_state_code_from_gstin(company_obj.gst_number)
            if extracted_comp_state:
                company_state_code = extracted_comp_state

        # Resolve customer details & Place of Supply (POS)
        resolved_customer_id = invoice_in.customer_id or "CUST-WALKIN"
        customer_gstin = invoice_in.customer_gstin
        customer_name = invoice_in.customer_name
        pos_state_name = invoice_in.pos_state
        pos_state_code = None

        if resolved_customer_id:
            try:
                cust_res = await self.crm_service.get_customer(resolved_customer_id)
                if cust_res:
                    if not customer_gstin:
                        customer_gstin = getattr(cust_res, "gst_number", None)
                    if not customer_name:
                        customer_name = getattr(cust_res, "name", None)
            except Exception:
                if resolved_customer_id == "CUST-WALKIN" and not customer_name:
                    customer_name = "Walk-In / Cash Customer"

        if not customer_name and resolved_customer_id == "CUST-WALKIN":
            customer_name = "Walk-In / Cash Customer"

        is_registered_b2b = False
        if customer_gstin:
            is_valid_gstin, st_code, st_name = validate_gstin(customer_gstin)
            if is_valid_gstin and st_code:
                is_registered_b2b = True
                pos_state_code = st_code
                pos_state_name = pos_state_name or st_name

        if not pos_state_code:
            # Fallback to store state if unregistered walk-in
            pos_state_code = company_state_code
            pos_state_name = pos_state_name or GST_STATE_CODES.get(company_state_code, "Home State")

        # Determine inter-state jurisdiction
        is_interstate = (company_state_code != pos_state_code)
        if invoice_in.is_interstate is not None:
            is_interstate = invoice_in.is_interstate

        from .inventory_wms_service import InventoryWmsService
        wms_service = InventoryWmsService(self.db, self.tenant_ctx)
        warehouse_id = invoice_in.warehouse_id or "wh-central-001"

        # 1. Validate items and calculate totals
        calculated_taxable_total = Decimal("0.00")
        calculated_tax_total = Decimal("0.00")
        calculated_grand_total = Decimal("0.00")
        invoice_items = []
        batch_deductions = []

        for idx, item in enumerate(invoice_in.items, start=1):
            product_stmt = select(Product).filter(
                (Product.id == item.product_id) | (Product.code == item.product_id) | (Product.code == item.code),
                Product.is_deleted == False,
                Product.company_id == self.tenant_ctx.company_id,
            )
            product_res = await self.db.execute(product_stmt)
            product = product_res.scalars().first()
            if not product:
                raise HTTPException(status_code=404, detail=f"Product not found: {item.product_id or item.code}")

            quantity = Decimal(str(item.quantity))
            unit_price = Decimal(str(item.price))
            gst_rate = Decimal(str(item.gst_rate or "18.00"))

            # Determine batch allocation
            assigned_batch = item.batch_no
            if product.tracking_mode != "No-stock":
                if assigned_batch:
                    batch_deductions.append({
                        "product": product,
                        "batch_no": assigned_batch,
                        "quantity": quantity
                    })
                else:
                    # Auto-allocate via FEFO
                    allocs = await wms_service.allocate_stock_fefo(
                        product_id=product.id,
                        warehouse_id=warehouse_id,
                        requested_qty=quantity
                    )
                    assigned_batch = allocs[0]["batch_no"] if allocs else "BATCH-OPENING"
                    for a in allocs:
                        batch_deductions.append({
                            "product": product,
                            "batch_no": a["batch_no"],
                            "quantity": Decimal(str(a["allocated_quantity"]))
                        })

            # Determine whether line is tax-inclusive (default: True for B2C consumer MRP, False for B2B wholesale)
            if item.is_tax_inclusive is not None:
                is_inclusive = item.is_tax_inclusive
            else:
                is_inclusive = not is_registered_b2b

            # Compute discount amount if discount percentage is given
            disc_pct = Decimal(str(item.disc_pct or "0.00"))
            discount_amount = (unit_price * quantity * disc_pct / Decimal("100.00")) if disc_pct > 0 else Decimal("0.00")

            tax_calc = calculate_line_item_tax(
                unit_price=unit_price,
                quantity=quantity,
                discount_amount=discount_amount,
                gst_rate=gst_rate,
                is_tax_inclusive=is_inclusive,
                is_interstate=is_interstate,
            )

            calculated_taxable_total += tax_calc["taxable_value"]
            calculated_tax_total += tax_calc["tax_amount"]
            calculated_grand_total += tax_calc["total_amount"]

            db_item = SalesInvoiceItem(
                product_id=product.id,
                code=item.code or product.code,
                name=item.name or product.name,
                batch_no=assigned_batch,
                quantity=quantity,
                price=unit_price,
                hsn_code=item.hsn_code or product.hsn_code,
                gst_rate=gst_rate,
                tax_amount=tax_calc["tax_amount"],
                total_amount=tax_calc["total_amount"],
                taxable_value=tax_calc["taxable_value"],
                cgst_amount=tax_calc["cgst_amount"],
                sgst_amount=tax_calc["sgst_amount"],
                igst_amount=tax_calc["igst_amount"],
                mrp=item.mrp or product.mrp or unit_price,
                disc_pct=disc_pct,
                line_no=item.line_no or idx,
            )
            invoice_items.append(db_item)

        # 2. Check customer credit limit & policy
        if resolved_customer_id and resolved_customer_id != "CUST-WALKIN":
            await self.crm_service.check_credit_limit(resolved_customer_id, float(calculated_grand_total))

        # 3. Save Sales Invoice & items
        db_customer_id = resolved_customer_id if (resolved_customer_id and resolved_customer_id != "CUST-WALKIN") else None
        db_invoice = SalesInvoice(
            id=invoice_id,
            invoice_no=invoice_no,
            date=invoice_in.date,
            customer_id=db_customer_id,
            customer_name=customer_name,
            customer_gstin=customer_gstin,
            pos_state=pos_state_name,
            warehouse_id=warehouse_id,
            taxable_value=calculated_taxable_total,
            tax_total=calculated_tax_total,
            grand_total=calculated_grand_total,
            is_interstate=is_interstate,
            payment_mode=invoice_in.payment_mode or "CASH",
            billing_address=invoice_in.billing_address,
            shipping_address=invoice_in.shipping_address,
            rounding_amount=invoice_in.rounding_amount or Decimal("0.00"),
            eway_bill_no=invoice_in.eway_bill_no,
            status=invoice_in.status,
            items=invoice_items,
            company_id=self.tenant_ctx.company_id,
            branch_id=self.tenant_ctx.branch_id,
        )
        self.db.add(db_invoice)

        # 4. Deduct stock from WMS batch stocks atomically
        for ded in batch_deductions:
            await wms_service.atomic_mutate_batch_stock(
                product_id=ded["product"].id,
                warehouse_id=warehouse_id,
                batch_no=ded["batch_no"],
                qty_delta=-ded["quantity"],
                movement_type="SALES_OUTWARD",
                reference_doc_type="Sales Invoice",
                reference_doc_id=db_invoice.invoice_no,
                remarks=f"Stock deducted for sales invoice: {db_invoice.invoice_no}",
            )

        # Record Transactional Outbox event atomically within same DB transaction
        from .outbox_service import OutboxService
        await OutboxService.record_event(
            session=self.db,
            target_channel="PSV_QUEUE",
            payload={
                "action": "SALES_INVOICE_CREATED",
                "invoice_no": db_invoice.invoice_no,
                "grand_total": str(db_invoice.grand_total),
                "customer_id": db_invoice.customer_id,
                "company_code": self.tenant_ctx.company_id
            },
            causation_id=db_invoice.invoice_no
        )
        try:
            await self.db.commit()
        except Exception as e:
            await self.db.rollback()
            import traceback
            traceback.print_exc()
            raise HTTPException(
                status_code=400,
                detail=f"Commit error: {str(e)}"
            )
        # Re-fetch with eager items to avoid MissingGreenlet during response serialization
        res = await self.db.execute(
            select(SalesInvoice)
            .options(selectinload(SalesInvoice.items))
            .where(SalesInvoice.id == db_invoice.id)
        )
        return res.scalars().first()

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
                SalesInvoice.branch_id.in_(
                    [self.tenant_ctx.branch_id, "BR-MAIN-001", "MAIN", "BR-001"]
                    if self.tenant_ctx.branch_id in ("BR-MAIN-001", "MAIN", "BR-001")
                    else [self.tenant_ctx.branch_id]
                ),
                SalesInvoice.is_deleted == False,
            )
        )
        invoice = res.scalars().first()
        if not invoice:
            raise HTTPException(status_code=404, detail="Sales invoice not found")

        # Apply scalar patches
        for attr in ("status", "customer_id", "date", "is_interstate",
                     "eway_bill_no", "invoice_no", "customer_name",
                     "customer_gstin", "pos_state"):
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
        Cancel a sales invoice: set status='Cancelled', soft-delete (is_deleted=True),
        and reverse deducted batch stock into warehouse.
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

        from .inventory_wms_service import InventoryWmsService
        wms_service = InventoryWmsService(self.db, self.tenant_ctx)
        wh_id = invoice.warehouse_id or "wh-central-001"

        # Restore batch stock for each line item
        for item in invoice.items:
            if item.product_id and item.quantity > 0:
                batch = item.batch_no or "BATCH-OPENING"
                try:
                    await wms_service.atomic_mutate_batch_stock(
                        product_id=item.product_id,
                        warehouse_id=wh_id,
                        batch_no=batch,
                        qty_delta=Decimal(str(item.quantity)),
                        movement_type="SALES_CANCEL",
                        reference_doc_type="Sales Invoice",
                        reference_doc_id=invoice.invoice_no,
                        remarks=f"Stock restored for cancelled sales invoice: {invoice.invoice_no}",
                    )
                except Exception:
                    pass

        # Revert customer outstanding if credit sale
        if invoice.customer_id and invoice.customer_id != "CUST-WALKIN":
            try:
                cust = await self.crm_service.get_customer(invoice.customer_id)
                if cust and invoice.grand_total:
                    cust.outstanding = max(Decimal("0.00"), cust.outstanding - invoice.grand_total)
                    cust.modified_at = datetime.now(timezone.utc)
                    self.db.add(cust)
            except Exception:
                pass

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
