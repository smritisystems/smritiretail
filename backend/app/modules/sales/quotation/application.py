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
from app.services.crm import CrmService
from app.services.inventory import InventoryService


class QuotationApplicationService:
    def __init__(self, db: AsyncSession, tenant_ctx: TenantContext):
        self.db = db
        self.tenant_ctx = tenant_ctx
        self.repository = SalesQuotationRepository(db, tenant_ctx)
        self.crm_service = CrmService(db, tenant_ctx)
        self.inventory_service = InventoryService(db, tenant_ctx)

    async def _calculate_item_totals(self, item) -> dict:
        gst_rate = item.gst_rate
        product = await self.inventory_service.get_product(item.product_id)
        if product:
            effective_rate = await self.inventory_service.resolve_effective_gst_percentage(product)
            gst_rate = Decimal(str(effective_rate))

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
        if await self.repository.exists_by_quotation_no(q_in.quotation_no):
            raise HTTPException(status_code=400, detail="Sales quotation with this quotation number already exists")

        tax_total = Decimal("0.00")
        grand_total = Decimal("0.00")
        cgst_total = Decimal("0.00")
        sgst_total = Decimal("0.00")
        igst_total = Decimal("0.00")
        items: List[SalesQuotationItem] = []

        for item in q_in.items:
            totals = await self._calculate_item_totals(item)
            tax_total += totals["tax_amount"]
            grand_total += totals["total_amount"]
            cgst_total += totals["cgst_amount"]
            sgst_total += totals["sgst_amount"]
            igst_total += totals["igst_amount"]

            items.append(SalesQuotationItem(
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
            status="Draft",
            items=items,
            company_id=self.tenant_ctx.company_id,
            branch_id=self.tenant_ctx.branch_id,
        )

        return await self.repository.create(db_q)

    async def _populate_item_inventory_fields(self, item: SalesQuotationItem) -> None:
        product = await self.inventory_service.get_product(item.product_id)
        if product:
            setattr(item, "available_stock", Decimal(str(product.stock or 0)))
            setattr(item, "reserved_stock", Decimal(str(product.reserved_stock or 0)))
        else:
            setattr(item, "available_stock", Decimal("0.00"))
            setattr(item, "reserved_stock", Decimal("0.00"))

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

        order_id = f"so-{uuid.uuid4().hex[:8]}"
        order_no = f"ORD-{uuid.uuid4().hex[:8].upper()}"
        tax_total = Decimal("0.00")
        grand_total = Decimal("0.00")
        cgst_total = Decimal("0.00")
        sgst_total = Decimal("0.00")
        igst_total = Decimal("0.00")
        order_items: List[SalesOrderItem] = []

        for q_item in quotation.items:
            item_tax = q_item.tax_amount or Decimal("0.00")
            item_total = q_item.total_amount or Decimal("0.00")
            cgst_total += q_item.cgst_amount or Decimal("0.00")
            sgst_total += q_item.sgst_amount or Decimal("0.00")
            igst_total += q_item.igst_amount or Decimal("0.00")
            tax_total += item_tax
            grand_total += item_total

            order_items.append(SalesOrderItem(
                product_id=q_item.product_id,
                code=q_item.code,
                name=q_item.name,
                quantity=q_item.quantity,
                price=q_item.price,
                hsn_code=q_item.hsn_code,
                gst_rate=q_item.gst_rate,
                tax_amount=item_tax,
                total_amount=item_total,
                cgst_amount=q_item.cgst_amount or Decimal("0.00"),
                sgst_amount=q_item.sgst_amount or Decimal("0.00"),
                igst_amount=q_item.igst_amount or Decimal("0.00"),
                tenant_id=self.tenant_ctx.tenant_id,
                company_id=self.tenant_ctx.company_id,
                branch_id=self.tenant_ctx.branch_id,
            ))

        db_order = SalesOrder(
            id=order_id,
            order_no=order_no,
            date=quotation.date,
            customer_name=quotation.customer_name,
            subtotal=(grand_total - tax_total).quantize(Decimal("0.01")),
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
        self.db.add(db_order)

        quotation.status = "Converted"
        quotation.sales_order_id = db_order.id
        quotation.modified_at = datetime.now(timezone.utc)
        self.db.add(quotation)

        await self.db.commit()

        result = await self.db.execute(
            select(SalesOrder).options(selectinload(SalesOrder.items)).where(SalesOrder.id == db_order.id)
        )
        return result.scalars().first()

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

        invoice_id = _uid()
        invoice_no = f"INV-{invoice_id[:6].upper()}"
        subtotal = Decimal("0.00")
        tax_total = Decimal("0.00")
        grand_total = quotation.grand_total or Decimal("0.00")
        cgst_amount = Decimal("0.00")
        sgst_amount = Decimal("0.00")
        igst_amount = Decimal("0.00")
        invoice_items: List[SalesInvoiceItem] = []

        customer_id = await self._resolve_or_create_customer_id(quotation.customer_name)

        line_subtotals: List[Decimal] = []
        base_tax_amounts: List[Decimal] = []
        for q_item in quotation.items:
            line_subtotal = (q_item.price * q_item.quantity).quantize(Decimal("0.01"))
            line_tax = ((line_subtotal * (q_item.gst_rate or Decimal("0.00")) / Decimal("100.00"))).quantize(Decimal("0.01"))
            subtotal += line_subtotal
            line_subtotals.append(line_subtotal)
            base_tax_amounts.append(line_tax)

        base_tax_total = sum(base_tax_amounts)
        if quotation.tax_total is not None and quotation.tax_total != Decimal("0.00"):
            tax_total = quotation.tax_total
        else:
            tax_total = (grand_total - subtotal).quantize(Decimal("0.01"))

        tax_scale = Decimal("1.00")
        if base_tax_total != Decimal("0.00") and tax_total != base_tax_total:
            tax_scale = (tax_total / base_tax_total).quantize(Decimal("0.0001"))

        for q_item, line_subtotal, base_tax in zip(quotation.items, line_subtotals, base_tax_amounts):
            scaled_tax = (base_tax * tax_scale).quantize(Decimal("0.01")) if base_tax_total != Decimal("0.00") else (q_item.tax_amount or Decimal("0.00"))
            line_total = (line_subtotal + scaled_tax).quantize(Decimal("0.01"))
            if q_item.gst_rate and q_item.gst_rate != Decimal("0.00"):
                cgst_line = (scaled_tax / Decimal("2")).quantize(Decimal("0.01"))
                sgst_line = scaled_tax - cgst_line
                igst_line = Decimal("0.00")
            else:
                cgst_line = Decimal("0.00")
                sgst_line = Decimal("0.00")
                igst_line = Decimal("0.00")

            cgst_amount += cgst_line
            sgst_amount += sgst_line
            igst_amount += igst_line

            invoice_items.append(SalesInvoiceItem(
                invoice_id=invoice_id,
                product_id=q_item.product_id,
                code=q_item.code,
                name=q_item.name,
                quantity=q_item.quantity,
                unit_price=q_item.price,
                price=q_item.price,
                gst_rate=q_item.gst_rate,
                gst_percentage=q_item.gst_rate,
                tax_amount=scaled_tax,
                cgst_amount=cgst_line,
                sgst_amount=sgst_line,
                igst_amount=igst_line,
                line_total=line_total,
                total_amount=line_total,
                tenant_id=self.tenant_ctx.tenant_id,
                company_id=self.tenant_ctx.company_id,
                branch_id=self.tenant_ctx.branch_id,
            ))

        if grand_total == Decimal("0.00"):
            grand_total = (subtotal + tax_total).quantize(Decimal("0.01"))

        invoice = SalesInvoice(
            id=invoice_id,
            invoice_no=invoice_no,
            invoice_date=quotation.date,
            customer_id=customer_id,
            status="Draft",
            subtotal=subtotal,
            tax_total=tax_total,
            cgst_amount=cgst_amount,
            sgst_amount=sgst_amount,
            igst_amount=igst_amount,
            grand_total=grand_total,
            paid_amount=Decimal("0.00"),
            balance_due=grand_total,
            items=invoice_items,
            company_id=self.tenant_ctx.company_id,
            branch_id=self.tenant_ctx.branch_id,
        )
        self.db.add(invoice)

        quotation.status = "Converted"
        quotation.modified_at = datetime.now(timezone.utc)
        self.db.add(quotation)
        await self.db.commit()

        await self.db.refresh(invoice)
        return invoice

    async def _resolve_or_create_customer_id(self, customer_name: str) -> str:
        if not customer_name:
            raise HTTPException(status_code=400, detail="Quotation customer_name is required to convert to invoice")

        # Prefer an existing customer matching name within the same tenant.
        repo = CustomerRepository(self.db, self.tenant_ctx)
        stmt = select(Customer).filter(
            Customer.name == customer_name,
            Customer.is_deleted == False,
        )
        stmt = repo._apply_tenant_filter(stmt)
        res = await self.db.execute(stmt)
        customer = res.scalars().first()
        if customer:
            return customer.id

        # Create a minimal anonymous customer for the quotation if not found.
        customer_in = CustomerCreate(
            name=customer_name,
            outstanding=Decimal("0.00"),
        )
        new_customer = await self.crm_service.create_customer(customer_in)
        return new_customer.id

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
