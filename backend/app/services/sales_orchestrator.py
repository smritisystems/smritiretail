"""
SalesBusinessOrchestrator — document-agnostic orchestration for Sales capability.
"""

from __future__ import annotations
from decimal import Decimal
from datetime import datetime, timezone
import logging
import uuid
from typing import Optional, Dict, Any, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import IntegrityError
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from fastapi import HTTPException
from ..api.deps import TenantContext
from ..services.crm import CrmService
from ..services.inventory import InventoryService
from ..services.workflow import workflow_service
from ..services.sales_context import SalesContext
from ..services.event_bus import event_bus, Events
from ..services.accounting import AccountingService, JournalVoucher, JournalEntry, Accounts
from ..models.inventory import Product, StockMovement
from ..models.crm import Customer
from ..models.sales import (
    SalesInvoice, SalesInvoiceItem, SalesOrder, SalesOrderItem,
    SalesQuotation, SalesQuotationItem, SalesReturn, SalesReturnItem, SalesPayment
)
from ..repositories.customer import CustomerRepository
from ..repositories.sales import SalesQuotationRepository
from ..schemas.crm import CustomerCreate
from ..schemas.sales import (
    SalesInvoiceCreate, SalesOrderCreate, SalesReturnCreate, SalesQuotationCreate
)

logger = logging.getLogger("smriti.sales")


class SalesBusinessOrchestrator:
    def __init__(self, db: AsyncSession, tenant_ctx: TenantContext):
        self.db = db
        self.tenant_ctx = tenant_ctx
        self.crm_service = CrmService(db, tenant_ctx)
        self.inventory_service = InventoryService(db, tenant_ctx)

    def build_context(
        self,
        document_type: Optional[str] = None,
        document_id: Optional[str] = None,
        customer_id: Optional[str] = None,
        customer_name: Optional[str] = None,
        date: Optional[Any] = None,
        is_interstate: bool = False,
        pricing_policy: Optional[str] = None,
        tax_policy: Optional[str] = None,
        channel: str = "Retail",
        warehouse: Optional[str] = None,
        sales_person_id: Optional[str] = None,
    ) -> SalesContext:
        context = SalesContext(
            tenant_id=self.tenant_ctx.tenant_id,
            company_id=self.tenant_ctx.company_id,
            branch_id=self.tenant_ctx.branch_id,
            customer_id=customer_id,
            customer_name=customer_name,
            warehouse=warehouse,
            currency="INR",
            channel=channel,
            pricing_policy=pricing_policy,
            tax_policy=tax_policy,
            document_type=document_type,
            document_id=document_id,
            date=date,
            is_interstate=is_interstate,
            sales_person_id=sales_person_id,
        )
        return context

    async def resolve_customer_pricing(self, customer_id: str) -> dict:
        return await self.crm_service.resolve_customer_pricing(customer_id)

    async def resolve_product_inventory(self, product_id: str) -> dict:
        product = await self.inventory_service.get_product(product_id)
        if not product:
            raise HTTPException(status_code=404, detail="Product not found")

        from app.services.inventory_availability import InventoryAvailabilityService
        avail_service = InventoryAvailabilityService(self.db, self.tenant_ctx)
        avail_res = await avail_service.can_fulfill(product_id=product_id, qty=0)

        return {
            "product_id": product.id,
            "available_qty": Decimal(str(avail_res["available_qty"])),
            "reserved_qty": Decimal(str(avail_res["reserved_qty"])),
            "tracking_mode": getattr(product, "tracking_mode", "No-stock"),
            "gst_rate": Decimal(str(await self.inventory_service.resolve_effective_gst_percentage(product))),
            "price": Decimal(str(getattr(product, "price", "0.00")))
        }

    async def resolve_gst(self, product_id: str, gst_rate: Optional[Decimal] = None) -> dict:
        product = await self.inventory_service.get_product(product_id)
        if not product:
            raise HTTPException(status_code=404, detail="Product not found")
        resolved_rate = Decimal(str(await self.inventory_service.resolve_effective_gst_percentage(product)))
        return {
            "product_id": product.id,
            "gst_rate": resolved_rate,
            "tax_inclusive": False,
        }

    async def resolve_pricing(self, item_price: Decimal, customer_id: Optional[str], product_id: Optional[str]) -> dict:
        pricing_params = {
            "discount_percent": Decimal("0.00"),
            "price_adjustment": Decimal("0.00"),
            "rounding_rule": "Nearest1"
        }
        if customer_id:
            resolved = await self.crm_service.resolve_customer_pricing(customer_id)
            pricing_params = {
                "discount_percent": Decimal(str(resolved.get("discount_percent", 0.00))),
                "price_adjustment": Decimal(str(resolved.get("price_adjustment", 0.00))),
                "rounding_rule": resolved.get("rounding_rule", "Nearest1"),
                "tax_inclusive": resolved.get("tax_inclusive", True),
            }

        base_price = item_price
        if pricing_params["discount_percent"] > Decimal("0.00"):
            base_price = base_price * (Decimal("1.00") - pricing_params["discount_percent"] / Decimal("100.00"))
        base_price += pricing_params["price_adjustment"]

        if pricing_params["rounding_rule"] == "Nearest1":
            final_price = base_price.quantize(Decimal("1"))
        elif pricing_params["rounding_rule"] == "Nearest5":
            final_price = (base_price / Decimal("5")).quantize(Decimal("1")) * Decimal("5")
        elif pricing_params["rounding_rule"] == "Nearest10":
            final_price = (base_price / Decimal("10")).quantize(Decimal("1")) * Decimal("10")
        else:
            final_price = base_price.quantize(Decimal("0.01"))

        return {
            "product_id": product_id,
            "base_price": item_price.quantize(Decimal("0.01")),
            "final_price": final_price.quantize(Decimal("0.01")),
            "discount_percent": pricing_params["discount_percent"],
            "discount_amount": (item_price - final_price).quantize(Decimal("0.01")),
            "pricing_policy": pricing_params["rounding_rule"],
        }

    async def resolve_inventory_snapshot(self, product_id: str) -> dict:
        inventory = await self.resolve_product_inventory(product_id)
        return {
            "product_id": inventory["product_id"],
            "available_qty": inventory["available_qty"],
            "reserved_qty": inventory["reserved_qty"],
            "tracking_mode": inventory["tracking_mode"],
        }

    async def check_credit_limit(self, customer_id: str, amount: Decimal) -> None:
        await self.crm_service.check_credit_limit(customer_id, float(amount))

    async def transition_document_status(
        self,
        document_type: str,
        document_id: str,
        to_status: str,
        user: str = "system",
        remarks: Optional[str] = None,
        document_number: Optional[str] = None,
    ) -> Any:
        return await workflow_service.transition(
            document_type=document_type,
            document_id=document_id,
            to_status=to_status,
            session=self.db,
            user=user,
            remarks=remarks,
            document_number=document_number,
            company_id=self.tenant_ctx.company_id,
            branch_id=self.tenant_ctx.branch_id,
        )

    async def resolve_or_create_customer_id(self, customer_name: str) -> str:
        if not customer_name:
            raise HTTPException(status_code=400, detail="Customer name is required")

        customer_repo = CustomerRepository(self.db, self.tenant_ctx)
        customer = await customer_repo.get_by_name(customer_name)
        if customer:
            return customer.id

        customer_in = CustomerCreate(
            name=customer_name,
            outstanding=Decimal("0.00"),
        )
        created = await self.crm_service.create_customer(customer_in)
        return created.id

    async def create_sales_quotation(self, q_in: SalesQuotationCreate) -> SalesQuotation:
        repository = SalesQuotationRepository(self.db, self.tenant_ctx)
        if await repository.exists_by_quotation_no(q_in.quotation_no):
            raise HTTPException(status_code=400, detail="Sales quotation with this quotation number already exists")

        tax_total = Decimal("0.00")
        grand_total = Decimal("0.00")
        cgst_total = Decimal("0.00")
        sgst_total = Decimal("0.00")
        igst_total = Decimal("0.00")
        items: List[SalesQuotationItem] = []

        for item in q_in.items:
            resolved = await self.resolve_gst(item.product_id, item.gst_rate)
            gst_rate = resolved["gst_rate"]
            item_tax = (item.quantity * item.price * (gst_rate / Decimal("100.00"))).quantize(Decimal("0.01"))
            item_total = (item.quantity * item.price + item_tax).quantize(Decimal("0.01"))
            cgst_amount = (item_tax / 2).quantize(Decimal("0.01"))
            sgst_amount = item_tax - cgst_amount
            igst_amount = Decimal("0.00")

            tax_total += item_tax
            grand_total += item_total
            cgst_total += cgst_amount
            sgst_total += sgst_amount
            igst_total += igst_amount

            items.append(SalesQuotationItem(
                product_id=item.product_id,
                code=item.code,
                name=item.name,
                quantity=item.quantity,
                price=item.price,
                hsn_code=item.hsn_code,
                gst_rate=gst_rate,
                tax_amount=item_tax,
                total_amount=item_total,
                cgst_amount=cgst_amount,
                sgst_amount=sgst_amount,
                igst_amount=igst_amount,
                tenant_id=self.tenant_ctx.tenant_id,
                company_id=self.tenant_ctx.company_id,
                branch_id=self.tenant_ctx.branch_id,
            ))

        db_q = SalesQuotation(
            id=q_in.id,
            quotation_no=q_in.quotation_no,
            date=q_in.date,
            customer_name=q_in.customer_name,
            tax_total=tax_total,
            grand_total=grand_total,
            cgst_total=cgst_total,
            sgst_total=sgst_total,
            igst_total=igst_total,
            status=q_in.status,
            items=items,
            company_id=self.tenant_ctx.company_id,
            branch_id=self.tenant_ctx.branch_id,
        )

        return await repository.create(db_q)

    async def create_sales_invoice(self, invoice_in: SalesInvoiceCreate) -> SalesInvoice:
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

        calculated_tax_total = Decimal("0.00")
        calculated_grand_total = Decimal("0.00")
        calculated_cgst_total = Decimal("0.00")
        calculated_sgst_total = Decimal("0.00")
        calculated_igst_total = Decimal("0.00")
        invoice_items: List[SalesInvoiceItem] = []

        invoice_id = invoice_in.id or f"SINV-{uuid.uuid4().hex[:8]}"

        for item in invoice_in.items:
            available = await self.inventory_service.check_stock_availability(item.product_id, float(item.quantity))
            if not available:
                raise HTTPException(status_code=400, detail=f"Insufficient stock for product ID: {item.product_id}")

            pricing = await self.resolve_pricing(item.price, invoice_in.customer_id, item.product_id)
            price = pricing["final_price"]
            resolved = await self.resolve_gst(item.product_id, item.gst_rate)
            gst_rate = resolved["gst_rate"]

            item_tax = (item.quantity * price * (gst_rate / Decimal("100.00"))).quantize(Decimal("0.01"))
            item_total = (item.quantity * price + item_tax).quantize(Decimal("0.01"))

            if invoice_in.is_interstate:
                cgst_amount = Decimal("0.00")
                sgst_amount = Decimal("0.00")
                igst_amount = item_tax
            else:
                cgst_amount = (item_tax / 2).quantize(Decimal("0.01"))
                sgst_amount = item_tax - cgst_amount
                igst_amount = Decimal("0.00")

            calculated_tax_total += item_tax
            calculated_grand_total += item_total
            calculated_cgst_total += cgst_amount
            calculated_sgst_total += sgst_amount
            calculated_igst_total += igst_amount

            invoice_items.append(SalesInvoiceItem(
                invoice_id=invoice_id,
                product_id=item.product_id,
                code=item.code,
                name=item.name,
                quantity=item.quantity,
                unit_price=price,
                price=price,
                hsn_code=item.hsn_code,
                gst_rate=gst_rate,
                gst_percentage=gst_rate,
                tax_amount=item_tax,
                cgst_amount=cgst_amount,
                sgst_amount=sgst_amount,
                igst_amount=igst_amount,
                line_total=item_total,
                total_amount=item_total,
                tenant_id=self.tenant_ctx.tenant_id,
                company_id=self.tenant_ctx.company_id,
                branch_id=self.tenant_ctx.branch_id,
            ))

        await self.check_credit_limit(invoice_in.customer_id, calculated_grand_total)

        payment_modes = set()
        db_payments = []
        for p_in in invoice_in.payments:
            pay_id = f"PMT-{uuid.uuid4().hex[:8].upper()}"
            payment_no = f"PAY-{uuid.uuid4().hex[:8].upper()}"
            tx_no = getattr(p_in, "transaction_no", None) or getattr(p_in, "reference_no", None)
            db_pmt = SalesPayment(
                id=pay_id,
                payment_no=payment_no,
                invoice_id=invoice_id,
                customer_id=invoice_in.customer_id,
                payment_mode=p_in.payment_mode,
                amount=p_in.amount,
                reference_no=tx_no,
                tenant_id=self.tenant_ctx.tenant_id,
                company_id=self.tenant_ctx.company_id,
                branch_id=self.tenant_ctx.branch_id
            )
            db_payments.append(db_pmt)
            payment_modes.add(p_in.payment_mode)

        cached_payment_mode = None
        if db_payments:
            cached_payment_mode = "MIXED" if len(payment_modes) > 1 else list(payment_modes)[0]

        total_payment_amount = sum((p.amount for p in db_payments), Decimal("0.00")).quantize(Decimal("0.01"))
        balance_due = max(calculated_grand_total - total_payment_amount, Decimal("0.00")).quantize(Decimal("0.01"))
        paid_amount = min(total_payment_amount, calculated_grand_total).quantize(Decimal("0.01"))
        if invoice_in.status and str(invoice_in.status).lower() in {"paid", "partial", "unpaid", "draft"}:
            invoice_status = invoice_in.status
        else:
            invoice_status = "Paid" if balance_due == Decimal("0.00") else ("Partial" if total_payment_amount > Decimal("0.00") else "Unpaid")

        db_invoice = SalesInvoice(
            id=invoice_id,
            invoice_no=invoice_in.invoice_no,
            invoice_date=invoice_in.date or datetime.now(timezone.utc),
            customer_id=invoice_in.customer_id,
            subtotal=sum((item.quantity * item.price).quantize(Decimal("0.01")) for item in invoice_in.items),
            tax_total=calculated_tax_total,
            cgst_amount=calculated_cgst_total,
            sgst_amount=calculated_sgst_total,
            igst_amount=calculated_igst_total,
            discount_amount=Decimal("0.00"),
            grand_total=calculated_grand_total,
            paid_amount=paid_amount,
            balance_due=balance_due,
            status=invoice_status,
            items=invoice_items,
            company_id=self.tenant_ctx.company_id,
            branch_id=self.tenant_ctx.branch_id
        )

        customer = await self.db.get(Customer, invoice_in.customer_id)
        if customer:
            current_outstanding = Decimal(str(customer.outstanding or "0.00"))
            customer.outstanding = (current_outstanding + balance_due).quantize(Decimal("0.01"))
            self.db.add(customer)

        self.db.add(db_invoice)
        for pmt in db_payments:
            self.db.add(pmt)

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
                movement_id = f"SM-{int(datetime.now(timezone.utc).timestamp())}-{uuid.uuid4().hex[:6]}"
                db_movement = StockMovement(
                    id=movement_id,
                    uuid=str(uuid.uuid4()),
                    product_id=product.id,
                    product_name=product.name,
                    sku=product.sku or product.code,
                    quantity=-item.quantity,
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

        try:
            await self.db.commit()
        except IntegrityError:
            await self.db.rollback()
            raise HTTPException(status_code=400, detail="Sales invoice with this invoice number already exists")

        accounting_service = AccountingService(self.db, self.tenant_ctx)
        subtotal = Decimal("0.00")
        for item in invoice_items:
            subtotal += (item.quantity * item.unit_price).quantize(Decimal("0.01"))

        voucher = JournalVoucher(
            ref_document_type="SalesInvoice",
            ref_document_id=db_invoice.id,
            ref_document_no=db_invoice.invoice_no,
            narration=f"Sales invoice posted: {db_invoice.invoice_no}",
            voucher_date=(db_invoice.invoice_date.isoformat() if getattr(db_invoice, "invoice_date", None) else datetime.now(timezone.utc).isoformat()),
            company_id=self.tenant_ctx.company_id,
            branch_id=self.tenant_ctx.branch_id,
            entries=[
                JournalEntry(
                    account_code=Accounts.ACCOUNTS_RECEIVABLE,
                    account_name="Accounts Receivable",
                    debit=calculated_grand_total.quantize(Decimal("0.01")),
                    credit=Decimal("0.00"),
                    narration=f"Receivable for sales invoice {db_invoice.invoice_no}",
                ),
                JournalEntry(
                    account_code=Accounts.SALES_REVENUE,
                    account_name="Sales Revenue",
                    debit=Decimal("0.00"),
                    credit=subtotal.quantize(Decimal("0.01")),
                    narration=f"Sales revenue for invoice {db_invoice.invoice_no}",
                ),
                JournalEntry(
                    account_code=Accounts.GST_OUTPUT_CGST,
                    account_name="CGST Payable",
                    debit=Decimal("0.00"),
                    credit=calculated_cgst_total.quantize(Decimal("0.01")),
                    narration=f"CGST output for invoice {db_invoice.invoice_no}",
                ),
                JournalEntry(
                    account_code=Accounts.GST_OUTPUT_SGST,
                    account_name="SGST Payable",
                    debit=Decimal("0.00"),
                    credit=calculated_sgst_total.quantize(Decimal("0.01")),
                    narration=f"SGST output for invoice {db_invoice.invoice_no}",
                ),
                JournalEntry(
                    account_code=Accounts.GST_OUTPUT_IGST,
                    account_name="IGST Payable",
                    debit=Decimal("0.00"),
                    credit=calculated_igst_total.quantize(Decimal("0.01")),
                    narration=f"IGST output for invoice {db_invoice.invoice_no}",
                ),
            ],
        )
        try:
            await accounting_service.post_journal(voucher)
        except Exception as exc:  # pragma: no cover - best effort accounting integration
            logger.warning("[SALES] Failed to post accounting journal for invoice %s: %s", db_invoice.invoice_no, exc)

        stmt = select(SalesInvoice).options(selectinload(SalesInvoice.items)).filter(SalesInvoice.id == db_invoice.id)
        result = await self.db.execute(stmt)
        refreshed = result.scalars().first()

        await event_bus.publish(
            Events.SALES_INVOICE_POSTED,
            {
                "invoice_id": refreshed.id,
                "invoice_no": refreshed.invoice_no,
                "customer_id": refreshed.customer_id,
                "grand_total": float(refreshed.grand_total),
                "invoice_date": refreshed.invoice_date.isoformat() if refreshed.invoice_date else None,
            },
            self.db,
        )
        return refreshed

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
        cgst_total = Decimal("0.00")
        sgst_total = Decimal("0.00")
        igst_total = Decimal("0.00")
        items: List[SalesOrderItem] = []

        for item in so_in.items:
            pricing = await self.resolve_pricing(item.price, None, item.product_id)
            effective_price = pricing["final_price"]
            gst_info = await self.resolve_gst(item.product_id, item.gst_rate)
            effective_gst_rate = gst_info["gst_rate"]

            item_tax = (item.quantity * effective_price * (effective_gst_rate / Decimal("100.00"))).quantize(Decimal("0.01"))
            item_total = (item.quantity * effective_price + item_tax).quantize(Decimal("0.01"))
            cgst_amount = (item_tax / 2).quantize(Decimal("0.01"))
            sgst_amount = item_tax - cgst_amount
            igst_amount = Decimal("0.00")

            tax_total += item_tax
            grand_total += item_total
            cgst_total += cgst_amount
            sgst_total += sgst_amount
            igst_total += igst_amount

            items.append(SalesOrderItem(
                product_id=item.product_id,
                code=item.code,
                name=item.name,
                quantity=item.quantity,
                price=effective_price,
                hsn_code=item.hsn_code,
                gst_rate=effective_gst_rate,
                tax_amount=item_tax,
                total_amount=item_total,
                cgst_amount=cgst_amount,
                sgst_amount=sgst_amount,
                igst_amount=igst_amount,
                tenant_id=self.tenant_ctx.tenant_id,
                company_id=self.tenant_ctx.company_id,
                branch_id=self.tenant_ctx.branch_id,
            ))

        db_order = SalesOrder(
            id=so_in.id,
            order_no=so_in.order_no,
            date=so_in.date,
            customer_name=so_in.customer_name,
            subtotal=sum((item.quantity * item.price).quantize(Decimal("0.01")) for item in items),
            tax_total=tax_total,
            cgst_total=cgst_total,
            sgst_total=sgst_total,
            igst_total=igst_total,
            grand_total=grand_total,
            status=so_in.status,
            source_quotation_id=so_in.source_quotation_id,
            items=items,
            company_id=self.tenant_ctx.company_id,
            branch_id=self.tenant_ctx.branch_id,
        )

        self.db.add(db_order)
        try:
            await self.db.commit()
        except IntegrityError:
            await self.db.rollback()
            raise HTTPException(status_code=400, detail="Sales order already exists")

        result = await self.db.execute(
            select(SalesOrder).options(selectinload(SalesOrder.items)).where(SalesOrder.id == db_order.id)
        )
        return result.scalars().first()

    async def create_sales_return(self, sr_in: SalesReturnCreate) -> SalesReturn:
        invoice_stmt = select(SalesInvoice).filter(
            SalesInvoice.id == sr_in.original_invoice_id,
            SalesInvoice.company_id == self.tenant_ctx.company_id,
            SalesInvoice.branch_id == self.tenant_ctx.branch_id,
            SalesInvoice.is_deleted == False
        )
        invoice_res = await self.db.execute(invoice_stmt)
        if not invoice_res.scalars().first():
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
        cgst_total = Decimal("0.00")
        sgst_total = Decimal("0.00")
        igst_total = Decimal("0.00")
        items: List[SalesReturnItem] = []

        for item in sr_in.items:
            product_stmt = select(Product).filter(
                Product.id == item.product_id,
                Product.company_id == self.tenant_ctx.company_id,
                Product.branch_id == self.tenant_ctx.branch_id,
                Product.is_deleted == False
            )
            product_res = await self.db.execute(product_stmt)
            product = product_res.scalars().first()
            if not product:
                raise HTTPException(status_code=404, detail=f"Product with ID {item.product_id} not found")

            item_tax = (item.quantity * item.price * (item.gst_rate / Decimal("100.00"))).quantize(Decimal("0.01"))
            item_total = (item.quantity * item.price + item_tax).quantize(Decimal("0.01"))
            if sr_in.is_interstate:
                cgst_amount = Decimal("0.00")
                sgst_amount = Decimal("0.00")
                igst_amount = item_tax
            else:
                cgst_amount = (item_tax / 2).quantize(Decimal("0.01"))
                sgst_amount = item_tax - cgst_amount
                igst_amount = Decimal("0.00")

            tax_total += item_tax
            grand_total += item_total
            cgst_total += cgst_amount
            sgst_total += sgst_amount
            igst_total += igst_amount

            items.append(SalesReturnItem(
                product_id=item.product_id,
                code=item.code,
                name=item.name,
                quantity=item.quantity,
                price=item.price,
                gst_rate=item.gst_rate,
                tax_amount=item_tax,
                total_amount=item_total,
                cgst_amount=cgst_amount,
                sgst_amount=sgst_amount,
                igst_amount=igst_amount,
                tenant_id=self.tenant_ctx.tenant_id,
                company_id=self.tenant_ctx.company_id,
                branch_id=self.tenant_ctx.branch_id,
            ))

            if product.tracking_mode != "No-stock":
                movement_id = f"SM-{int(datetime.now(timezone.utc).timestamp())}-{uuid.uuid4().hex[:6]}"
                db_movement = StockMovement(
                    id=movement_id,
                    uuid=str(uuid.uuid4()),
                    product_id=product.id,
                    product_name=product.name,
                    sku=product.sku or product.code,
                    quantity=item.quantity,
                    movement_type="IN",
                    reference_doc_type="Sales Return",
                    reference_doc_id=sr_in.id,
                    warehouse="Default Warehouse",
                    unit_cost=product.cost_price or product.price,
                    remarks=f"Stock incremented for sales return: {sr_in.return_no}",
                    source_module="Sales",
                    company_id=self.tenant_ctx.company_id,
                    branch_id=self.tenant_ctx.branch_id
                )
                self.db.add(db_movement)

        db_return = SalesReturn(
            id=sr_in.id,
            return_no=sr_in.return_no,
            original_invoice_id=sr_in.original_invoice_id,
            credit_note_number=sr_in.credit_note_number or f"CN-{sr_in.return_no}",
            date=sr_in.date,
            reason=sr_in.reason,
            tax_total=tax_total,
            grand_total=grand_total,
            cgst_total=cgst_total,
            sgst_total=sgst_total,
            igst_total=igst_total,
            is_interstate=sr_in.is_interstate,
            status=sr_in.status,
            items=items,
            company_id=self.tenant_ctx.company_id,
            branch_id=self.tenant_ctx.branch_id,
        )

        self.db.add(db_return)
        try:
            await self.db.commit()
        except IntegrityError:
            await self.db.rollback()
            raise HTTPException(status_code=400, detail="Sales return already exists")

        result = await self.db.execute(
            select(SalesReturn).options(selectinload(SalesReturn.items)).where(SalesReturn.id == db_return.id)
        )
        return result.scalars().first()

    async def convert_quotation_to_order(self, quotation_id: str) -> SalesOrder:
        quotation = await SalesQuotationRepository(self.db, self.tenant_ctx).get_with_items(quotation_id)
        if not quotation:
            raise HTTPException(status_code=404, detail="Sales quotation not found")
        if quotation.status not in ("Draft", "Submitted", "Approved"):
            raise HTTPException(status_code=400, detail=f"Cannot convert a quotation with status '{quotation.status}'.")
        if not quotation.items:
            raise HTTPException(status_code=400, detail="Quotation has no line items to convert.")

        order = await self.create_order_from_quotation(quotation)
        quotation.status = "Converted"
        quotation.modified_at = datetime.now(timezone.utc)
        self.db.add(quotation)
        await self.db.commit()
        return order

    async def convert_quotation_to_invoice(self, quotation_id: str) -> SalesInvoice:
        quotation = await SalesQuotationRepository(self.db, self.tenant_ctx).get_with_items(quotation_id)
        if not quotation:
            raise HTTPException(status_code=404, detail="Sales quotation not found")
        if quotation.status not in ("Draft", "Submitted", "Approved"):
            raise HTTPException(status_code=400, detail=f"Cannot convert a quotation with status '{quotation.status}'.")
        if not quotation.items:
            raise HTTPException(status_code=400, detail="Quotation has no line items to convert.")

        invoice = await self.create_invoice_from_quotation(quotation)
        quotation.status = "Converted"
        quotation.modified_at = datetime.now(timezone.utc)
        self.db.add(quotation)
        await self.db.commit()
        return invoice

    async def create_invoice_from_quotation(self, quotation: SalesQuotation) -> SalesInvoice:
        invoice_id = f"inv-{quotation.id}"
        invoice_no = f"INV-{uuid.uuid4().hex[:8].upper()}"
        customer_id = await self.resolve_or_create_customer_id(quotation.customer_name)

        subtotal = Decimal("0.00")
        tax_total = Decimal("0.00")
        grand_total = quotation.grand_total or Decimal("0.00")
        cgst_total = Decimal("0.00")
        sgst_total = Decimal("0.00")
        igst_total = Decimal("0.00")
        invoice_items: List[SalesInvoiceItem] = []

        for item in quotation.items:
            line_subtotal = (item.price * item.quantity).quantize(Decimal("0.01"))
            subtotal += line_subtotal
            tax_rate = item.gst_rate if item.gst_rate is not None else Decimal("0.00")
            line_tax = (line_subtotal * tax_rate / Decimal("100.00")).quantize(Decimal("0.01"))
            # Preserve GST/tax values supplied on the quotation. Only resolve
            # effective GST when the quotation line does not provide a gst_rate.
            if item.gst_rate is None:
                resolved = await self.resolve_gst(item.product_id, item.gst_rate)
                tax_rate = resolved["gst_rate"]
                line_tax = (line_subtotal * tax_rate / Decimal("100.00")).quantize(Decimal("0.01"))

            cgst_line = (line_tax / Decimal("2")).quantize(Decimal("0.01")) if tax_rate != Decimal("0.00") else Decimal("0.00")
            sgst_line = line_tax - cgst_line
            igst_line = Decimal("0.00")

            cgst_total += cgst_line
            sgst_total += sgst_line
            igst_total += igst_line
            tax_total += line_tax

            line_total = (line_subtotal + line_tax).quantize(Decimal("0.01"))
            invoice_items.append(SalesInvoiceItem(
                invoice_id=invoice_id,
                product_id=item.product_id,
                code=item.code,
                name=item.name,
                quantity=item.quantity,
                unit_price=item.price,
                price=item.price,
                hsn_code=item.hsn_code,
                gst_rate=tax_rate,
                gst_percentage=tax_rate,
                tax_amount=line_tax,
                cgst_amount=cgst_line,
                sgst_amount=sgst_line,
                igst_amount=igst_line,
                line_total=line_total,
                total_amount=line_total,
                tenant_id=self.tenant_ctx.tenant_id,
                company_id=self.tenant_ctx.company_id,
                branch_id=self.tenant_ctx.branch_id,
            ))

        # If the quotation explicitly set a grand_total that doesn't match
        # the computed subtotal+tax_total, prefer the quotation's grand_total
        # and derive tax_total from it. This preserves user-edited totals
        # on quotations during conversion.
        computed_total = (subtotal + tax_total).quantize(Decimal("0.01"))
        if quotation.grand_total is not None and quotation.grand_total != computed_total:
            grand_total = quotation.grand_total
            tax_total = (grand_total - subtotal).quantize(Decimal("0.01"))
            if tax_total < Decimal("0.00"):
                tax_total = Decimal("0.00")
            cgst_total = (tax_total / Decimal("2")).quantize(Decimal("0.01"))
            sgst_total = (tax_total - cgst_total).quantize(Decimal("0.01"))
        elif grand_total == Decimal("0.00"):
            grand_total = computed_total

        invoice = SalesInvoice(
            id=invoice_id,
            invoice_no=invoice_no,
            invoice_date=quotation.date,
            customer_id=customer_id,
            status="Draft",
            subtotal=subtotal,
            tax_total=tax_total,
            cgst_amount=cgst_total,
            sgst_amount=sgst_total,
            igst_amount=igst_total,
            grand_total=grand_total,
            paid_amount=Decimal("0.00"),
            balance_due=grand_total,
            items=invoice_items,
            company_id=self.tenant_ctx.company_id,
            branch_id=self.tenant_ctx.branch_id,
        )
        self.db.add(invoice)
        await self.db.flush()
        await self.db.refresh(invoice)
        return invoice

    async def create_order_from_quotation(self, quotation: SalesQuotation) -> SalesOrder:
        order_id = f"so-{quotation.id}"
        order_no = f"ORD-{uuid.uuid4().hex[:8].upper()}"
        subtotal = Decimal("0.00")
        tax_total = Decimal("0.00")
        grand_total = quotation.grand_total or Decimal("0.00")
        cgst_total = Decimal("0.00")
        sgst_total = Decimal("0.00")
        igst_total = Decimal("0.00")
        order_items: List[SalesOrderItem] = []

        for item in quotation.items:
            line_subtotal = (item.price * item.quantity).quantize(Decimal("0.01"))
            subtotal += line_subtotal
            line_tax = ((item.gst_rate or Decimal("0.00")) * line_subtotal / Decimal("100.00")).quantize(Decimal("0.01"))
            tax_total += line_tax
            cgst_total += (line_tax / Decimal("2")).quantize(Decimal("0.01")) if line_tax != Decimal("0.00") else Decimal("0.00")
            sgst_total += (line_tax / Decimal("2")).quantize(Decimal("0.01")) if line_tax != Decimal("0.00") else Decimal("0.00")
            order_items.append(SalesOrderItem(
                product_id=item.product_id,
                code=item.code,
                name=item.name,
                quantity=item.quantity,
                price=item.price,
                hsn_code=item.hsn_code,
                gst_rate=item.gst_rate,
                tax_amount=line_tax,
                total_amount=(line_subtotal + line_tax).quantize(Decimal("0.01")),
                cgst_amount=(line_tax / Decimal("2")).quantize(Decimal("0.01")) if line_tax != Decimal("0.00") else Decimal("0.00"),
                sgst_amount=(line_tax / Decimal("2")).quantize(Decimal("0.01")) if line_tax != Decimal("0.00") else Decimal("0.00"),
                igst_amount=Decimal("0.00"),
                tenant_id=self.tenant_ctx.tenant_id,
                company_id=self.tenant_ctx.company_id,
                branch_id=self.tenant_ctx.branch_id,
            ))

        order = SalesOrder(
            id=order_id,
            order_no=order_no,
            date=quotation.date,
            customer_name=quotation.customer_name,
            subtotal=subtotal,
            tax_total=tax_total,
            cgst_total=cgst_total,
            sgst_total=sgst_total,
            igst_total=igst_total,
            grand_total=grand_total,
            status="Draft",
            source_quotation_id=quotation.id,
            items=order_items,
            company_id=self.tenant_ctx.company_id,
            branch_id=self.tenant_ctx.branch_id,
        )
        self.db.add(order)
        await self.db.flush()
        return order
