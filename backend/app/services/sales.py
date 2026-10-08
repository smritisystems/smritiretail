"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.70.34
Created      : 2026-07-11
Modified     : 2026-10-08
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import uuid
import logging
from typing import List, Optional, Dict, Any
from decimal import Decimal
from datetime import datetime, timezone, date
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import delete, func
from sqlalchemy.orm import selectinload
from sqlalchemy.exc import IntegrityError
from fastapi import HTTPException

logger = logging.getLogger("smriti.sales")
from ..models.sales import (
    SalesInvoice, SalesInvoiceItem,
    SalesQuotation, SalesQuotationItem,
    SalesOrder, SalesOrderItem, SalesOrderInvoiceAllocation,
    SalesOrderReservation,
    SalesReturn, SalesReturnItem,
)
from ..models.inventory import Product, StockMovement
from ..models.tenant import Company, Branch
from ..models.crm import Customer, CustomerGroup, CustomerGSTRegistration, CustomerDeliveryLocation, CustomerBillingLocation, CustomerCreditLedgerEntry
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
    SalesOrderLineActionRequest,
    SalesReturnCreate,
    SalesReturnUpdate,
)
from .crm import CrmService
from .inventory import InventoryService
from .inventory_warehouse_resolver import InventoryWarehouseResolver
from .sales_return_policy import SalesReturnPolicyResolver
from .sales_return_refund_adapter import SalesReturnRefundAdapter
from .customer_discount_policy import resolve_customer_discount_policy, validate_customer_discount_policy
from .promotions_engine import PromotionsEngine
from ..schemas.promotions import PromotionCartItem, PromotionEvaluationRequest, PromotionRedemptionRequest
from .documents_engine import DocumentsEngine
from .compliance_audit import ComplianceAuditService
from ..api.deps import TenantContext
from .identity.engine import IdentityEngine




def _integrity_error_detail(error: IntegrityError) -> str:
    """Return a safe, actionable database constraint message for API clients."""
    original = getattr(error, "orig", error)
    constraint = getattr(getattr(original, "diag", None), "constraint_name", None)
    message = str(original)

    if constraint:
        return f"Invoice could not be saved because database constraint '{constraint}' was violated. Refresh the customer/location selections and document number, then retry."
    return f"Invoice could not be saved because of a database integrity conflict: {message}"


class SalesService:
    def __init__(self, db: AsyncSession, tenant_ctx: TenantContext, control_db: Optional[AsyncSession] = None):
        self.db = db
        self.tenant_ctx = tenant_ctx
        self.crm_service = CrmService(db, tenant_ctx)
        self.inventory_service = InventoryService(db, tenant_ctx)
        self.sales_return_policy_resolver = SalesReturnPolicyResolver(control_db=control_db, company_db=db)


    # ??????????????????????????????????????????????????????????????
    # Sales Invoice
    # ??????????????????????????????????????????????????????????????

    async def create_sales_invoice(self, invoice_in: SalesInvoiceCreate, idempotency_key: Optional[str] = None, commit: bool = True) -> SalesInvoice:
        """
        Delegates to CanonicalSalesPostingWriter as the sole authoritative transactional writer.
        This method serves as a canonical ingress adapter for SalesInvoiceCreate payloads.
        """
        if idempotency_key:
            idempotency_key = str(idempotency_key).strip()
            if not idempotency_key:
                idempotency_key = None
            elif len(idempotency_key) > 50:
                raise HTTPException(status_code=400, detail="Idempotency-Key must not exceed 50 characters.")

        if getattr(invoice_in, "customer_po_id", None):
            from .customer_po import CustomerPOService
            from ..schemas.customer_po import CustomerPOBillingLine, CustomerPOBillingRequest
            if getattr(invoice_in, "source_document_type", None) != "CUSTOMER_PO":
                raise HTTPException(status_code=400, detail="Customer PO invoices must declare source_document_type=CUSTOMER_PO.")
            po_request = CustomerPOBillingRequest(
                invoice={"customer_id": invoice_in.customer_id},
                lines=[CustomerPOBillingLine(customer_po_line_id=item.customer_po_line_id, quantity=item.quantity) for item in invoice_in.items if item.customer_po_line_id],
            )
            if len(po_request.lines) != len(invoice_in.items):
                raise HTTPException(status_code=400, detail="Every Customer PO invoice line must reference a Customer PO line.")
            await CustomerPOService(self.db, self.tenant_ctx).validate_billing(invoice_in.customer_po_id, po_request)

        import uuid
        from ..schemas.canonical_posting import (
            CanonicalPostingRequest,
            CanonicalPostingContext,
            CanonicalPostingLineItem,
            CanonicalTenderItem,
        )
        from .canonical_sales_writer import CanonicalSalesPostingWriter

        effective_idemp_key = idempotency_key or (
            invoice_in.invoice_no if invoice_in.invoice_no and invoice_in.invoice_no.upper() not in ["AUTO", "D1DS13-1"] else f"TX-SALES-{uuid.uuid4().hex[:16]}"
        )
        client_inv_no = invoice_in.invoice_no if invoice_in.invoice_no and invoice_in.invoice_no.upper() not in ["AUTO", "D1DS13-1"] else None

        ctx = CanonicalPostingContext(
            company_id=self.tenant_ctx.company_id,
            branch_id=self.tenant_ctx.branch_id or "MAIN",
            warehouse_id=invoice_in.warehouse_id,
            dispatch_from_location_id=invoice_in.dispatch_from_location_id,
            shift_id=getattr(invoice_in, "shift_id", None),
            cashier_id=getattr(self.tenant_ctx, "user_id", None) or getattr(invoice_in, "salesperson_id", None),
            terminal_id=getattr(invoice_in, "terminal_id", None),
            counter_id=getattr(invoice_in, "counter_id", None),
            idempotency_key=effective_idemp_key,
            client_invoice_no=client_inv_no,
            source_channel=getattr(invoice_in, "source_document_type", None) or ("CUSTOMER_PO" if getattr(invoice_in, "customer_po_id", None) else "B2B_WHOLESALE"),
            allow_negative_stock=False,
            supervisor_override_code=getattr(invoice_in, "supervisor_override_code", None),
        )

        canonical_items = []
        for it in invoice_in.items:
            canonical_items.append(
                CanonicalPostingLineItem(
                    code=it.code,
                    quantity=it.quantity,
                    unit_price=it.price,
                    name=it.name,
                    variant_id=it.variant_id,
                    product_id=it.product_id,
                    item_id=it.item_id,
                    batch_no=it.batch_no,
                    gst_rate=it.gst_rate,
                    hsn_code=it.hsn_code,
                    disc_pct=it.disc_pct or Decimal("0.00"),
                    disc_amt=Decimal("0.00"),
                    is_tax_inclusive=it.is_tax_inclusive,
                    mrp=it.mrp,
                    customer_po_line_id=it.customer_po_line_id,
                    source_line_type=it.source_line_type,
                    source_line_id=it.source_line_id,
                    category=it.category,
                    brand=it.brand,
                    salesperson_id=getattr(it, "salesperson_id", None),
                    salesperson_name=getattr(it, "salesperson_name", None),
                )
            )

        tenders = []
        if getattr(invoice_in, "paid_amount", None) and invoice_in.paid_amount > Decimal("0.00"):
            tenders.append(
                CanonicalTenderItem(
                    tender_type=(invoice_in.payment_mode or "CASH").upper(),
                    amount=invoice_in.paid_amount,
                )
            )

        req = CanonicalPostingRequest(
            context=ctx,
            items=canonical_items,
            tenders=tenders,
            customer_id=invoice_in.customer_id,
            customer_name=invoice_in.customer_name or "Walk-in Customer",
            customer_phone=getattr(invoice_in, "customer_phone", None),
            customer_gstin=invoice_in.customer_gstin,
            billed_party_gstin_id=getattr(invoice_in, "billed_party_gstin_id", None),
            billing_address=invoice_in.billing_address,
            billing_location_id=getattr(invoice_in, "billing_location_id", None),
            billing_store_code=getattr(invoice_in, "billing_store_code", None),
            shipping_address=invoice_in.shipping_address,
            delivery_location_id=getattr(invoice_in, "delivery_location_id", None),
            delivery_store_code=getattr(invoice_in, "delivery_store_code", None),
            delivery_gstin=getattr(invoice_in, "delivery_gstin", None),
            delivery_location_snapshot=getattr(invoice_in, "delivery_location_snapshot", None),
            dispatch_from_location_id=getattr(invoice_in, "dispatch_from_location_id", None),
            place_of_supply=invoice_in.place_of_supply_code or invoice_in.pos_state,
            reverse_charge=False,
            notes=getattr(invoice_in, "remarks", None),
            po_reference_no=invoice_in.po_reference,
            customer_po_id=invoice_in.customer_po_id,
            payment_mode=invoice_in.payment_mode,
            promotion_campaign_id=getattr(invoice_in, "promotion_campaign_id", None),
            promotion_coupon_code=getattr(invoice_in, "promotion_coupon_code", None),
            promotion_coupon_id=getattr(invoice_in, "promotion_coupon_id", None),
        )

        result = await CanonicalSalesPostingWriter.post_sales_transaction(
            session=self.db,
            req=req,
            idempotency_key=effective_idemp_key,
            commit=commit,
        )

        # Re-fetch with eager items to avoid MissingGreenlet during serialization
        res = await self.db.execute(
            select(SalesInvoice)
            .options(selectinload(SalesInvoice.items))
            .where(
                SalesInvoice.id == result.invoice_id,
                SalesInvoice.company_id == self.tenant_ctx.company_id,
            )
        )
        return res.scalars().first()


    async def post_pos_transaction(
        self,
        invoice_in: SalesInvoiceCreate,
        shift_id: str,
        payment_request=None,
        payment_mode: Optional[str] = None,
        commit: bool = True,
    ) -> SalesInvoice:
        """Compose POS invoice, stock, outbox, and optional payment in one unit of work."""
        invoice = await self.create_sales_invoice(
            invoice_in,
            idempotency_key=invoice_in.invoice_no,
            commit=False,
        )
        invoice.shift_id = shift_id
        await self.db.flush()

        if payment_request is None and (payment_mode or "CASH").upper() != "CREDIT":
            from ..schemas.payments import PaymentTenderItem, ProcessPaymentRequest
            payment_request = ProcessPaymentRequest(
                reference_doc_type="POS_BILL",
                reference_doc_id=invoice.id,
                party_id=invoice.customer_id,
                tenders=[PaymentTenderItem(
                    tender_type=(payment_mode or "CASH").upper(),
                    amount=float(invoice.grand_total),
                )],
                idempotency_key=f"POS-PAY-{invoice.id}",
                branch_id=self.tenant_ctx.branch_id,
                auto_allocate=True,
            )

        if payment_request is not None:
            from .payments_engine import PaymentsEngine
            await PaymentsEngine.process_payment(
                session=self.db,
                company_id=self.tenant_ctx.company_id,
                req=payment_request,
                created_by=getattr(self.tenant_ctx, "user_id", None),
                commit=False,
            )

        if commit:
            await self.db.commit()
        else:
            await self.db.flush()

        result = await self.db.execute(
            select(SalesInvoice)
            .options(selectinload(SalesInvoice.items))
            .where(
                SalesInvoice.id == invoice.id,
                SalesInvoice.company_id == self.tenant_ctx.company_id,
                SalesInvoice.branch_id == invoice.branch_id,
            )
        )
        return result.scalars().first()

    # ??????????????????????????????????????????????????????????????
    # Sales Quotation
    # ??????????????????????????????????????????????????????????????

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
            gst_rate = item.gst_rate
            item_tax = (item.quantity * item.price * (gst_rate / Decimal("100.00"))).quantize(Decimal("0.01"))
            item_total = (item.quantity * item.price + item_tax).quantize(Decimal("0.01"))
            tax_total += item_tax
            grand_total += item_total

            q_items.append(SalesQuotationItem(
                company_id=self.tenant_ctx.company_id,
                branch_id=self.tenant_ctx.branch_id,
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

    async def reserve_sales_order(self, order_id: str, idempotency_key: str) -> Dict[str, Any]:
        """Reserve barcode-keyed stock atomically for all open Sales Order lines."""
        existing = await self.db.execute(
            select(SalesOrderReservation).where(
                SalesOrderReservation.order_id == order_id,
                SalesOrderReservation.idempotency_key == idempotency_key,
                SalesOrderReservation.is_deleted == False,
            )
        )
        existing_rows = existing.scalars().all()
        if existing_rows:
            return {"status": "already_reserved", "order_id": order_id, "reservations": [row.id for row in existing_rows]}

        order_result = await self.db.execute(
            select(SalesOrder).options(selectinload(SalesOrder.items)).where(
                SalesOrder.id == order_id,
                SalesOrder.company_id == self.tenant_ctx.company_id,
                SalesOrder.branch_id == self.tenant_ctx.branch_id,
                SalesOrder.is_deleted == False,
            ).with_for_update()
        )
        order = order_result.scalars().first()
        if not order:
            raise HTTPException(status_code=404, detail="Sales order not found")
        if str(order.status).lower() in {"cancelled", "completed", "closed"}:
            raise HTTPException(status_code=409, detail=f"Sales order status '{order.status}' cannot be reserved")

        reservations: List[SalesOrderReservation] = []
        for line in order.items:
            quantity = Decimal(str(line.pending_quantity or line.quantity or 0))
            if quantity <= 0 or str(line.line_status).upper() in {"CANCELLED", "CLOSED", "BILLED"}:
                continue
            product_result = await self.db.execute(
                select(Product).where(
                    Product.id == line.product_id,
                    Product.company_id == self.tenant_ctx.company_id,
                    Product.is_deleted == False,
                ).with_for_update()
            )
            product = product_result.scalars().first()
            if not product:
                await self.db.rollback()
                raise HTTPException(status_code=400, detail=f"Product for Sales Order line {line.id} was not found")
            barcode = str(product.barcode or line.ean or "").strip()
            if not barcode:
                await self.db.rollback()
                raise HTTPException(status_code=400, detail=f"Sales Order line {line.id} has no barcode")
            available = Decimal(str(product.stock or 0)) - Decimal(str(product.reserved_stock or 0))
            if available < quantity:
                await self.db.rollback()
                raise HTTPException(status_code=409, detail=f"Insufficient barcode stock for {barcode}: available {available}, requested {quantity}")
            product.reserved_stock = Decimal(str(product.reserved_stock or 0)) + quantity
            reservation = SalesOrderReservation(
                id=f"sor-{uuid.uuid4().hex[:24]}",
                order_id=order.id,
                order_item_id=line.id,
                product_id=product.id,
                barcode=barcode,
                requested_quantity=quantity,
                reserved_quantity=quantity,
                idempotency_key=idempotency_key,
                company_id=self.tenant_ctx.company_id,
                branch_id=self.tenant_ctx.branch_id,
                metadata_json={"order_no": order.order_no, "po_number": order.po_number},
            )
            self.db.add(reservation)
            reservations.append(reservation)

        if not reservations:
            raise HTTPException(status_code=400, detail="Sales order has no open lines to reserve")
        order.status = "Confirmed"
        order.fulfillment_status = "RESERVED"
        await self.db.commit()
        return {"status": "reserved", "order_id": order.id, "reservations": [row.id for row in reservations]}

    async def release_sales_order_reservations(self, order_id: str, reason: str) -> Dict[str, Any]:
        """Release open barcode reservations and return stock to availability."""
        result = await self.db.execute(
            select(SalesOrderReservation).where(
                SalesOrderReservation.order_id == order_id,
                SalesOrderReservation.company_id == self.tenant_ctx.company_id,
                SalesOrderReservation.branch_id == self.tenant_ctx.branch_id,
                SalesOrderReservation.status.in_(["ACTIVE", "PARTIAL"]),
                SalesOrderReservation.is_deleted == False,
            ).with_for_update()
        )
        rows = result.scalars().all()
        released = Decimal("0.0000")
        for row in rows:
            product_result = await self.db.execute(select(Product).where(Product.id == row.product_id).with_for_update())
            product = product_result.scalars().first()
            open_quantity = max(Decimal("0.0000"), Decimal(str(row.reserved_quantity or 0)) - Decimal(str(row.released_quantity or 0)) - Decimal(str(row.consumed_quantity or 0)))
            if product and open_quantity:
                product.reserved_stock = max(Decimal("0.0000"), Decimal(str(product.reserved_stock or 0)) - open_quantity)
            row.released_quantity = Decimal(str(row.released_quantity or 0)) + open_quantity
            row.status = "RELEASED"
            row.release_reason = reason
            released += open_quantity
        await self.db.commit()
        return {"status": "released", "order_id": order_id, "reservation_count": len(rows), "released_quantity": str(released)}

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

    # ??????????????????????????????????????????????????????????????
    # Sales Order
    # ??????????????????????????????????????????????????????????????

    async def create_sales_order(self, so_in: SalesOrderCreate, idempotency_key: Optional[str] = None) -> SalesOrder:
        from .transaction_integrity_engine import TransactionIntegrityEngine

        async with TransactionIntegrityEngine.guard(
            session=self.db,
            company_id=self.tenant_ctx.company_id,
            entity_type="SALES_ORDER",
            idempotency_key=idempotency_key,
            business_key=so_in.order_no,
            request_payload=so_in,
            branch_id=self.tenant_ctx.branch_id,
            user_id=getattr(self.tenant_ctx, "user_id", None),
            commit=True,
        ) as guard:
            if guard.is_replayed:
                if guard.record and guard.record.document_id:
                    res = await self.db.execute(
                        select(SalesOrder)
                        .options(
                            selectinload(SalesOrder.items),
                            selectinload(SalesOrder.allocations)
                        )
                        .where(SalesOrder.id == guard.record.document_id)
                    )
                    cached_so = res.scalars().first()
                    if cached_so:
                        return cached_so

            existing = await self.db.execute(
                select(SalesOrder).filter(
                    SalesOrder.order_no == so_in.order_no,
                    SalesOrder.is_deleted == False,
                    SalesOrder.company_id == self.tenant_ctx.company_id,
                )
            )
            if existing.scalars().first():
                raise HTTPException(
                    status_code=400,
                    detail=f"Duplicate document number: Sales order with order number '{so_in.order_no}' already exists under this tenant."
                )

            if not so_in.items:
                raise HTTPException(status_code=400, detail="Sales order must contain at least one item.")

            tax_total = Decimal("0.00")
            grand_total = Decimal("0.00")
            so_items = []

            for index, item in enumerate(so_in.items, start=1):
                item_product_id = (item.product_id or item.code or "").strip()
                item_code = (item.code or "").strip()
                item_name = (item.name or "").strip()

                if not item_product_id:
                    raise HTTPException(status_code=400, detail=f"Item {index}: product ID is required.")

                product_stmt = select(Product).filter(
                    (Product.id == item_product_id) | (Product.code == item_product_id) | (Product.code == item_code),
                    Product.is_deleted == False,
                    Product.company_id == self.tenant_ctx.company_id,
                )
                product_res = await self.db.execute(product_stmt)
                product = product_res.scalars().first()

                if not product:
                    raise HTTPException(status_code=400, detail=f"Item {index}: '{item_product_id}' was not found in the database. Please select a valid item before saving.")

                barcode = str(product.barcode or "").strip()
                if not barcode:
                    raise HTTPException(status_code=400, detail=f"Item {index}: barcode is required for inventory movement.")
                requested_barcode = str(item.ean or "").strip()
                accepted_barcodes = {barcode, *(str(value).strip() for value in (product.secondary_barcodes or []) if value)}
                if requested_barcode and requested_barcode not in accepted_barcodes:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Item {index}: barcode '{requested_barcode}' does not match the selected product barcode."
                    )

                if not item_name:
                    raise HTTPException(status_code=400, detail=f"Item {index}: '{item_code or item_product_id}' was not found in the database. Please select a valid item before saving.")

                if Decimal(str(item.quantity)) <= 0:
                    raise HTTPException(status_code=400, detail=f"Item {index}: quantity must be greater than zero.")

                if Decimal(str(item.price)) < 0:
                    raise HTTPException(status_code=400, detail=f"Item {index}: price cannot be negative.")

                gst_rate = item.gst_rate if item.gst_rate != Decimal("18.00") or not product.gst_percentage else Decimal(str(product.gst_percentage))
                item_tax = (item.quantity * item.price * (gst_rate / Decimal("100.00"))).quantize(Decimal("0.01"))
                item_total = (item.quantity * item.price + item_tax).quantize(Decimal("0.01"))
                tax_total += item_tax
                grand_total += item_total

                so_items.append(SalesOrderItem(
                    company_id=self.tenant_ctx.company_id,
                    branch_id=self.tenant_ctx.branch_id,
                    product_id=product.id,
                    item_id=product.item_id,
                    variant_id=item.variant_id or product.item_variant_id,
                    code=product.code,
                    name=product.name,
                    quantity=item.quantity,
                    price=item.price,
                    hsn_code=item.hsn_code or product.hsn_code,
                    gst_rate=gst_rate,
                    tax_amount=item_tax,
                    total_amount=item_total,
                    sr_no=item.sr_no,
                    article_no=item.article_no,
                    ean=barcode,
                    vendor_style=item.vendor_style,
                    color=item.color,
                    size=item.size,
                    uom=item.uom or "EA",
                    mrp=item.mrp or product.mrp,
                    base_cost=item.base_cost,
                    taxable_value=item.taxable_value or (item.quantity * item.price).quantize(Decimal("0.01")),
                    igst_amount=item.igst_amount,
                    cgst_amount=item.cgst_amount,
                    sgst_amount=item.sgst_amount,
                    line_total=item.line_total or item_total,
                    delivery_date=item.delivery_date,
                    site_code=item.site_code or so_in.site_code,
                    billed_quantity=item.billed_quantity,
                    pending_quantity=item.pending_quantity or item.quantity,
                    overbilled_quantity=item.overbilled_quantity,
                    line_status=item.line_status,
                    closure_reason=item.closure_reason,
                    closed_at=item.closed_at,
                    closed_by=item.closed_by,
                ))

            if getattr(so_in, "id", None):
                tech_id = so_in.id
            else:
                tech_id, _identity_code = await IdentityEngine.allocate_internal(
                    session=self.db,
                    entity_type="SALES_ORDER",
                    tenant_id=getattr(self.tenant_ctx, "tenant_id", None),
                    company_id=self.tenant_ctx.company_id,
                    branch_id=self.tenant_ctx.branch_id,
                    purpose="ENTITY_CREATION",
                )

            db_so = SalesOrder(
                id=tech_id,
                order_no=so_in.order_no,
                date=so_in.date,
                customer_name=so_in.customer_name,
                tax_total=tax_total,
                grand_total=grand_total,
                status=so_in.status,
                source_quotation_id=so_in.source_quotation_id,
                po_number=so_in.po_number,
                po_date=so_in.po_date,
                delivery_date=so_in.delivery_date,
                site_code=so_in.site_code,
                site_name=so_in.site_name,
                delivery_address=so_in.delivery_address,
                vendor_code=so_in.vendor_code,
                customer_id=so_in.customer_id,
                customer_gstin=so_in.customer_gstin,
                basic_total=sum((item.quantity * item.price for item in so_in.items), Decimal("0.00")).quantize(Decimal("0.01")),
                is_interstate=so_in.is_interstate,
                total_qty=sum((item.quantity for item in so_in.items), Decimal("0.0000")),
                billed_qty=sum((item.billed_quantity for item in so_in.items), Decimal("0.0000")),
                billed_value=sum((item.billed_quantity * item.price for item in so_in.items), Decimal("0.00")).quantize(Decimal("0.01")),
                pending_qty=sum((item.pending_quantity or item.quantity for item in so_in.items), Decimal("0.0000")),
                pending_value=sum(((item.pending_quantity or item.quantity) * item.price for item in so_in.items), Decimal("0.00")).quantize(Decimal("0.01")),
                fulfillment_status=so_in.fulfillment_status,
                po_metadata=so_in.po_metadata or {},
                items=so_items,
                company_id=self.tenant_ctx.company_id,
                branch_id=self.tenant_ctx.branch_id,
            )

            self.db.add(db_so)
            await self.db.flush()
            guard.complete(
                document_id=db_so.id,
                document_no=db_so.order_no,
                response_payload={"id": db_so.id, "order_no": db_so.order_no, "grand_total": str(grand_total)}
            )

        # Re-fetch with eager items to avoid MissingGreenlet during response serialization
        result = await self.db.execute(
            select(SalesOrder)
            .options(
                selectinload(SalesOrder.items),
                selectinload(SalesOrder.allocations)
            )
            .where(SalesOrder.id == db_so.id)
        )
        return result.scalars().first()


    async def list_sales_orders(
        self,
        customer_id: Optional[str] = None,
        status: Optional[str] = None,
        fulfillment_status: Optional[str] = None,
        from_date: Optional[date] = None,
        to_date: Optional[date] = None,
        skip: int = 0,
        limit: int = 1000,
    ) -> List[SalesOrder]:
        stmt = (
            select(SalesOrder)
            .options(
                selectinload(SalesOrder.items),
                selectinload(SalesOrder.allocations)
            )
            .where(
                SalesOrder.is_deleted == False
            )
        )
        if self.tenant_ctx and self.tenant_ctx.company_id:
            stmt = stmt.where(
                (SalesOrder.company_id == self.tenant_ctx.company_id) | (SalesOrder.company_id.is_(None))
            )
        if self.tenant_ctx and self.tenant_ctx.branch_id:
            stmt = stmt.where(
                (SalesOrder.branch_id == self.tenant_ctx.branch_id) | (SalesOrder.branch_id.is_(None))
            )
        if customer_id:
            stmt = stmt.where(
                (SalesOrder.customer_id == customer_id) | (SalesOrder.customer_name.ilike(f"%{customer_id}%"))
            )
        if status:
            stmt = stmt.where(SalesOrder.status == status)
        if fulfillment_status:
            stmt = stmt.where(SalesOrder.fulfillment_status == fulfillment_status)
        if from_date:
            stmt = stmt.where(SalesOrder.date >= from_date)
        if to_date:
            stmt = stmt.where(SalesOrder.date <= to_date)

        stmt = stmt.order_by(SalesOrder.date.desc(), SalesOrder.created_at.desc()).offset(skip).limit(limit)
        res = await self.db.execute(stmt)
        return res.scalars().all()

    async def list_po_address_candidates(self, customer_id: str) -> List[Dict[str, Any]]:
        """Return deduplicated invoice/PO address snapshots for review before import."""
        result = await self.db.execute(
            select(SalesInvoice).where(
                SalesInvoice.customer_id == customer_id,
                SalesInvoice.company_id == self.tenant_ctx.company_id,
                SalesInvoice.branch_id == self.tenant_ctx.branch_id,
                SalesInvoice.is_deleted == False,
                SalesInvoice.po_reference.is_not(None),
                SalesInvoice.billing_address.is_not(None),
            ).order_by(SalesInvoice.date.desc())
        )
        candidates: Dict[str, Dict[str, Any]] = {}
        for invoice in result.scalars().all():
            address = " ".join(str(invoice.billing_address or "").split()).strip()
            if not address:
                continue
            key = address.upper()
            candidate = candidates.setdefault(key, {
                "suggested_store_code": f"PO-{str(invoice.po_reference).strip().upper()}",
                "address": address,
                "gstin": invoice.customer_gstin,
                "po_references": [],
                "invoice_numbers": [],
                "last_seen": invoice.date,
            })
            if invoice.po_reference and invoice.po_reference not in candidate["po_references"]:
                candidate["po_references"].append(invoice.po_reference)
            if invoice.invoice_no and invoice.invoice_no not in candidate["invoice_numbers"]:
                candidate["invoice_numbers"].append(invoice.invoice_no)
        return list(candidates.values())

    async def get_customer_reconciliation(self, customer_id: str) -> List[Dict[str, Any]]:
        """Return PO/Sales Order/reservation/invoice status for operational reconciliation."""
        result = await self.db.execute(
            select(SalesOrder)
            .options(selectinload(SalesOrder.items), selectinload(SalesOrder.allocations), selectinload(SalesOrder.reservations))
            .where(
                SalesOrder.customer_id == customer_id,
                SalesOrder.company_id == self.tenant_ctx.company_id,
                SalesOrder.branch_id == self.tenant_ctx.branch_id,
                SalesOrder.is_deleted == False,
            )
            .order_by(SalesOrder.date.desc())
        )
        rows = []
        for order in result.scalars().all():
            active_reservations = [r for r in order.reservations if r.status in {"ACTIVE", "PARTIAL"} and not r.is_deleted]
            rows.append({
                "order_id": order.id,
                "order_no": order.order_no,
                "po_number": order.po_number,
                "date": order.date,
                "status": order.status,
                "fulfillment_status": order.fulfillment_status,
                "total_quantity": str(order.total_qty or 0),
                "billed_quantity": str(order.billed_qty or 0),
                "pending_quantity": str(order.pending_qty or 0),
                "reservation_status": "RESERVED" if active_reservations else "NOT_RESERVED",
                "reserved_quantity": str(sum((Decimal(str(r.reserved_quantity or 0)) for r in active_reservations), Decimal("0.0000"))),
                "invoice_count": len(order.allocations),
                "site_code": order.site_code,
                "customer_gstin": order.customer_gstin,
            })
        return rows

    async def get_sales_order(self, so_id: str) -> tuple[SalesOrder, List[SalesOrderItem], List[SalesOrderInvoiceAllocation]]:
        stmt = (
            select(SalesOrder)
            .options(
                selectinload(SalesOrder.items),
                selectinload(SalesOrder.allocations)
            )
            .where(
                (SalesOrder.id == so_id) | (SalesOrder.order_no == so_id) | (SalesOrder.po_number == so_id),
                SalesOrder.is_deleted == False
            )
        )
        if self.tenant_ctx and self.tenant_ctx.company_id:
            stmt = stmt.where(
                (SalesOrder.company_id == self.tenant_ctx.company_id) | (SalesOrder.company_id.is_(None))
            )
        res = await self.db.execute(stmt)
        so = res.scalars().first()
        if not so:
            raise HTTPException(status_code=404, detail="Sales order not found")
        return so, list(so.items or []), list(so.allocations or [])

    async def convert_sales_order_to_invoice(
        self,
        order_id: str,
        selected_item_ids: Optional[List[str]] = None,
    ) -> SalesInvoice:
        """
        1-Click conversion of a Sales Order into an official Statutory Tax Invoice.
        Maps lines, calculates GST, generates allocation, updates SO fulfillment status.
        """
        so, items, allocations = await self.get_sales_order(order_id)
        if not items:
            raise HTTPException(status_code=400, detail="Sales order has no line items to convert")

        await self.db.execute(
            select(SalesOrder.id).where(
                SalesOrder.id == so.id,
                SalesOrder.company_id == self.tenant_ctx.company_id,
                SalesOrder.branch_id == self.tenant_ctx.branch_id,
                SalesOrder.is_deleted == False,
            ).with_for_update()
        )
        if so.pending_qty is not None and Decimal(str(so.pending_qty)) <= 0 and allocations:
            existing_invoice = await self.db.execute(
                select(SalesInvoice).where(SalesInvoice.id == allocations[-1].invoice_id)
            )
            invoice = existing_invoice.scalars().first()
            if invoice:
                return invoice
            raise HTTPException(status_code=409, detail="Sales order is already fully invoiced")

        seq_alloc = await DocumentsEngine.allocate_next_number_in_transaction(
            session=self.db,
            company_id=self.tenant_ctx.company_id,
            document_type="SALES_INVOICE",
            branch_id=self.tenant_ctx.branch_id,
            company_code=self.tenant_ctx.company_id,
            created_by=getattr(self.tenant_ctx, "user_id", None) or "SYSTEM",
        )
        invoice_no = seq_alloc.document_no
        invoice_id = IdentityEngine.generate_technical_id()

        items_to_convert = [
            item for item in items
            if Decimal(str(item.pending_quantity or item.quantity or 0)) > 0
            and str(item.line_status).upper() not in {"CANCELLED", "CLOSED", "BILLED"}
        ]
        if selected_item_ids:
            items_to_convert = [i for i in items if str(i.id) in selected_item_ids or str(i.product_id) in selected_item_ids]
            if not items_to_convert:
                items_to_convert = items
        if not items_to_convert:
            raise HTTPException(status_code=409, detail="Sales order has no pending quantities to invoice")

        inv_items = []
        total_taxable = Decimal("0.00")
        total_tax = Decimal("0.00")
        total_grand = Decimal("0.00")
        total_pairs = 0

        # State / Supply logic: Authoritative resolution order
        company_state_code = None
        # 1. Branch GSTIN / state_code
        if getattr(so, "branch_id", None):
            b_res = await self.db.execute(
                select(Branch).where(Branch.id == so.branch_id, Branch.is_deleted == False)
            )
            b_obj = b_res.scalars().first()
            if b_obj:
                b_gst = getattr(b_obj, "gstin", None) or getattr(b_obj, "gst_number", None)
                if b_gst and len(b_gst) >= 2 and b_gst[:2].isdigit():
                    company_state_code = b_gst[:2]
                elif getattr(b_obj, "state_code", None):
                    company_state_code = str(b_obj.state_code).zfill(2)

        # 2. Company GSTIN / state_code
        if not company_state_code and getattr(so, "company_id", None):
            c_res = await self.db.execute(
                select(Company).where(Company.id == so.company_id, Company.is_deleted == False)
            )
            c_obj = c_res.scalars().first()
            if c_obj:
                if c_obj.gst_number and len(c_obj.gst_number) >= 2 and c_obj.gst_number[:2].isdigit():
                    company_state_code = c_obj.gst_number[:2]
                elif getattr(c_obj, "state_code", None):
                    company_state_code = str(c_obj.state_code).zfill(2)

        # 3. SystemParameterService
        if not company_state_code:
            from ..services.system_parameter import SystemParameterService
            state_param = await SystemParameterService.resolve_parameter(
                db=self.db,
                param_code="SMRITI.TAX.DEFAULT_STATE_CODE",
                company_id=getattr(so, "company_id", None),
                branch_id=getattr(so, "branch_id", None),
            )
            if state_param and state_param.effective_value:
                company_state_code = str(state_param.effective_value).zfill(2)

        # 4. Explicit Failure
        if not company_state_code:
            raise HTTPException(
                status_code=400,
                detail="SMRITI-JURISDICTION-001: Seller tax jurisdiction cannot be resolved for sales order. Company/Branch GSTIN, state code, or SMRITI.TAX.DEFAULT_STATE_CODE must be configured.",
            )
        customer_gstin = so.customer_gstin or ""
        pos_code = company_state_code
        if customer_gstin and len(customer_gstin) >= 2 and customer_gstin[:2].isdigit():
            pos_code = customer_gstin[:2]
        is_interstate = (pos_code != company_state_code)
        pos_state_name = GST_STATE_CODES.get(pos_code) or "Transaction State"

        for ln, item in enumerate(items_to_convert, start=1):
            qty = Decimal(str(item.pending_quantity or item.quantity or 1))
            total_pairs += int(qty)
            price = Decimal(str(item.price or 0))
            taxable_val = (price * qty).quantize(Decimal("0.01"))
            gst_rate = Decimal(str(item.gst_rate or Decimal("5.00")))
            mrp_val = Decimal(str(getattr(item, "mrp", None) or (price / Decimal("0.5624") if price > 0 else Decimal("0.00")))).quantize(Decimal("0.01"))
            disc_val = Decimal(str(getattr(item, "disc_pct", None) or Decimal("43.76"))).quantize(Decimal("0.01"))

            if is_interstate:
                igst_val = (taxable_val * (gst_rate / Decimal("100.00"))).quantize(Decimal("0.01"))
                cgst_val = Decimal("0.00")
                sgst_val = Decimal("0.00")
                tot_amt = taxable_val + igst_val
            else:
                half_gst = gst_rate / Decimal("2.00")
                cgst_val = (taxable_val * (half_gst / Decimal("100.00"))).quantize(Decimal("0.01"))
                sgst_val = (taxable_val * (half_gst / Decimal("100.00"))).quantize(Decimal("0.01"))
                igst_val = Decimal("0.00")
                tot_amt = taxable_val + cgst_val + sgst_val

            total_taxable += taxable_val
            total_tax += (cgst_val + sgst_val + igst_val)
            total_grand += tot_amt

            inv_items.append(SalesInvoiceItem(
                invoice_id=invoice_id,
                company_id=self.tenant_ctx.company_id,
                branch_id=self.tenant_ctx.branch_id,
                product_id=item.product_id,
                item_id=item.item_id,
                variant_id=item.variant_id,
                code=item.code,
                name=item.name,
                quantity=qty,
                price=price,
                hsn_code=item.hsn_code or "64041990",
                gst_rate=gst_rate,
                tax_amount=(cgst_val + sgst_val + igst_val),
                total_amount=tot_amt,
                mrp=mrp_val,
                disc_pct=disc_val,
                taxable_value=taxable_val,
                igst_amount=igst_val,
                cgst_amount=cgst_val,
                sgst_amount=sgst_val,
                line_no=ln,
            ))
            item.billed_quantity = Decimal(str(item.billed_quantity or 0)) + qty
            item.pending_quantity = max(Decimal("0.0000"), Decimal(str(item.quantity or 0)) - item.billed_quantity)
            item.line_status = "BILLED" if item.pending_quantity <= 0 else "PARTIALLY_BILLED"

        db_inv = SalesInvoice(
            id=invoice_id,
            invoice_no=invoice_no,
            date=datetime.now(timezone.utc).date(),
            customer_name=so.customer_name or "Reliance Retail Limited",
            customer_gstin=customer_gstin,
            customer_id=so.customer_id,
            billing_address=so.delivery_address or "Reliance Retail Limited",
            shipping_address=so.delivery_address or "Reliance Retail Store",
            sis_code=so.site_code or "1977",
            pos_state=pos_state_name,
            po_reference=so.po_number or so.order_no,
            taxable_value=total_taxable,
            tax_total=total_tax,
            grand_total=total_grand,
            is_interstate=is_interstate,
            bank_name="STATE BANK OF INDIA",
            account_no="43976711765",
            ifsc_code="SBIN0030425",
            status="Draft",
            items=inv_items,
            company_id=self.tenant_ctx.company_id if self.tenant_ctx else None,
            branch_id=self.tenant_ctx.branch_id if self.tenant_ctx else None,
            rule_snapshots={
                "bank_branch": "WARDHMAN NAGAR NAGPUR",
                "account_holder_name": "TATTLY THREADS",
                "source_order_id": so.id,
                "source_order_no": so.order_no,
            }
        )
        self.db.add(db_inv)

        # Create allocation
        alloc = SalesOrderInvoiceAllocation(
            id=f"alloc-{uuid.uuid4().hex[:8]}",
            order_id=so.id,
            order_no=so.order_no,
            po_number=so.po_number or so.order_no,
            invoice_id=invoice_id,
            invoice_no=invoice_no,
            invoice_date=datetime.now(timezone.utc).date(),
            po_quantity=so.total_qty or total_pairs,
            po_value=so.grand_total or total_grand,
            billed_quantity=Decimal(str(total_pairs)),
            billed_value=total_grand,
            pending_quantity=max(Decimal("0.00"), Decimal(str(so.total_qty or total_pairs)) - Decimal(str(total_pairs))),
            pending_value=max(Decimal("0.00"), Decimal(str(so.grand_total or total_grand)) - total_grand),
            status="ALLOCATED",
            allocation_metadata={"auto_converted": True},
            company_id=self.tenant_ctx.company_id if self.tenant_ctx else None,
            branch_id=self.tenant_ctx.branch_id if self.tenant_ctx else None,
        )
        self.db.add(alloc)

        # Update Sales Order metrics
        so.billed_qty = (Decimal(str(so.billed_qty or 0)) + Decimal(str(total_pairs)))
        so.billed_value = (Decimal(str(so.billed_value or 0)) + total_grand)
        so.pending_qty = max(Decimal("0.00"), Decimal(str(so.total_qty or 0)) - so.billed_qty)
        so.pending_value = max(Decimal("0.00"), Decimal(str(so.grand_total or 0)) - so.billed_value)
        
        if so.pending_qty <= 0:
            so.fulfillment_status = "FULFILLED"
            so.status = "Completed"
        else:
            so.fulfillment_status = "PARTIALLY_FULFILLED"
            so.status = "In Progress"

        self.db.add(so)
        await self.db.commit()

        # Re-fetch with relationships
        res = await self.db.execute(
            select(SalesInvoice)
            .options(selectinload(SalesInvoice.items))
            .where(SalesInvoice.id == invoice_id)
        )
        return res.scalars().first()

    # ────────────────────────────────────────────────────────────
    # Sales Return
    # ────────────────────────────────────────────────────────────

    async def get_sales_return_context(self, invoice_id: str) -> Dict[str, Any]:
        """
        Authoritative Sales Return Context for ProPOS.
        Enforces tenant isolation, branch authorization, and invoice validation.
        Computes remaining returnable quantities and attaches resolved policy snapshot.
        """
        inv_res = await self.db.execute(
            select(SalesInvoice)
            .options(selectinload(SalesInvoice.items))
            .filter(
                (SalesInvoice.id == invoice_id) | (SalesInvoice.invoice_no == invoice_id),
                SalesInvoice.company_id == self.tenant_ctx.company_id,
                SalesInvoice.is_deleted == False
            )
        )
        invoice = inv_res.scalars().first()
        if not invoice:
            raise HTTPException(status_code=404, detail=f"Sales invoice '{invoice_id}' not found.")

        # Branch authorization check if invoice has branch_id
        if invoice.branch_id and self.tenant_ctx.branch_id and invoice.branch_id != self.tenant_ctx.branch_id:
            raise HTTPException(status_code=403, detail="Cross-branch return access denied without inter-branch authorization.")

        # Find previous successful returns for this invoice
        previous_returns = await self.db.execute(
            select(SalesReturnItem.product_id, func.sum(SalesReturnItem.quantity).label("total_returned"))
            .join(SalesReturn, SalesReturn.id == SalesReturnItem.return_id)
            .where(
                SalesReturn.original_invoice_id == invoice.id,
                SalesReturn.company_id == self.tenant_ctx.company_id,
                SalesReturn.is_deleted == False,
                func.coalesce(func.lower(SalesReturn.status), "completed").in_(
                    ["approved", "processed", "completed", "submitted", "draft", "confirmed", "active"]
                ),
                SalesReturnItem.product_id.is_not(None),
            )
            .group_by(SalesReturnItem.product_id)
        )
        returned_quantities = {r[0]: Decimal(str(r[1] or 0)) for r in previous_returns.all()}


        # Resolve policy with full contextual scope
        policy = await self.sales_return_policy_resolver.resolve(
            tenant=self.tenant_ctx.company_id,
            branch=self.tenant_ctx.branch_id,
            document_type="SALES_INVOICE",
            customer_context={"customer_id": invoice.customer_id} if invoice.customer_id else None,
        )

        lines = []
        for item in invoice.items:
            orig_qty = item.quantity or Decimal("1.0")
            ret_qty = returned_quantities.get(item.product_id, Decimal("0.0"))
            rem_qty = max(Decimal("0.0"), orig_qty - ret_qty)
            lines.append({
                "product_id": item.product_id or item.code,
                "code": item.code,
                "name": item.name,
                "original_quantity": float(orig_qty),
                "returned_quantity": float(ret_qty),
                "remaining_quantity": float(rem_qty),
                "unit_price": float(item.price),
                "gst_rate": float(item.gst_rate or 0.0),
                "tax_amount": float(item.tax_amount or 0.0),
                "total_amount": float(item.total_amount or (orig_qty * item.price)),
            })

        # Fetch customer details if exists
        customer_info = None
        if invoice.customer_id:
            try:
                cust = await self.crm_service.get_customer(invoice.customer_id)
                if cust:
                    customer_info = {
                        "id": cust.id,
                        "name": cust.name,
                        "phone": getattr(cust, "mobile", getattr(cust, "phone", None)),
                        "email": getattr(cust, "email", None),
                        "outstanding": float(cust.outstanding or 0.0),
                    }
                else:
                    customer_info = {"id": invoice.customer_id, "name": getattr(invoice, "customer_name", None)}
            except Exception:
                customer_info = {"id": invoice.customer_id, "name": getattr(invoice, "customer_name", None)}


        return_window_days = policy.values.get("return_window_days")
        if return_window_days is None:
            raise HTTPException(status_code=500, detail="SALES_RETURN_POLICY_NOT_CONFIGURED: missing return_window_days in the effective policy.")
        refund_modes = policy.values.get("refund_modes")
        if refund_modes is None:
            raise HTTPException(status_code=500, detail="SALES_RETURN_POLICY_NOT_CONFIGURED: missing refund_modes in the effective policy.")
        return_reasons = policy.values.get("return_reasons")
        if return_reasons is None:
            raise HTTPException(status_code=500, detail="SALES_RETURN_POLICY_NOT_CONFIGURED: missing return_reasons in the effective policy.")
        auth_policy = policy.values.get("authorization_policy")
        if not isinstance(auth_policy, dict) or "supervisor_threshold" not in auth_policy:
            raise HTTPException(status_code=500, detail="SALES_RETURN_POLICY_NOT_CONFIGURED: missing authorization_policy.supervisor_threshold in the effective policy.")

        return {
            "invoice_id": invoice.id,
            "invoice_no": invoice.invoice_no,
            "invoice_date": invoice.date.isoformat() if hasattr(invoice.date, "isoformat") else str(invoice.date),
            "status": invoice.status,
            "customer": customer_info,
            "payment_context": {
                "payment_mode": invoice.payment_mode or "CASH",
            },
            "branch_id": invoice.branch_id,
            "terminal_id": getattr(invoice, "terminal_id", "TERM-01"),
            "shift_id": getattr(invoice, "shift_id", None),
            "lines": lines,
            "effective_policy": {
                "policy_id": policy.policy_id,
                "policy_version": policy.policy_version,
                "resolution_scope": policy.resolution_scope,
                "return_window_days": return_window_days,
                "allowed_refund_modes": refund_modes,
                "allowed_return_reasons": return_reasons,
                "supervisor_threshold": float(auth_policy["supervisor_threshold"]),
            },
        }

    async def create_sales_return(self, sr_in: SalesReturnCreate, idempotency_key: Optional[str] = None) -> SalesReturn:
        # Lock the invoice while validating returnable quantities and creating effects.
        inv_res = await self.db.execute(
            select(SalesInvoice).options(selectinload(SalesInvoice.items)).filter(
                SalesInvoice.id == sr_in.original_invoice_id,
                SalesInvoice.company_id == self.tenant_ctx.company_id,
                (SalesInvoice.branch_id == self.tenant_ctx.branch_id) | (SalesInvoice.branch_id.is_(None)),
                SalesInvoice.is_deleted == False
            ).with_for_update()
        )
        orig_invoice = inv_res.scalars().first()
        if not orig_invoice:
            raise HTTPException(status_code=404, detail="Original sales invoice not found")

        # Resolve policy across contextual precedence
        policy = await self.sales_return_policy_resolver.resolve(
            tenant=self.tenant_ctx.company_id,
            branch=self.tenant_ctx.branch_id,
            document_type="SALES_INVOICE",
            customer_context={"customer_id": orig_invoice.customer_id} if orig_invoice else None,
            transaction_context={"is_blind_return": getattr(sr_in, "is_blind_return", False)},
        )

        # Return window check
        if orig_invoice.date and sr_in.date:
            window_days = policy.values.get("return_window_days")
            if window_days is None:
                raise HTTPException(status_code=500, detail="SALES_RETURN_POLICY_NOT_CONFIGURED: missing return_window_days in the effective policy.")
            inv_d = orig_invoice.date if isinstance(orig_invoice.date, date) else datetime.strptime(str(orig_invoice.date), "%Y-%m-%d").date()
            sr_d = sr_in.date if isinstance(sr_in.date, date) else datetime.strptime(str(sr_in.date), "%Y-%m-%d").date()
            days_diff = (sr_d - inv_d).days
            if days_diff > int(window_days) and not getattr(sr_in, "supervisor_auth_token", None):
                raise HTTPException(
                    status_code=422,
                    detail=f"Return window of {window_days} days has expired for this invoice (issued {inv_d}, return requested {sr_d}). Supervisor authorization required.",
                )

        # Blind return check
        if getattr(sr_in, "is_blind_return", False):
            blind_allowed = policy.values.get("is_blind_return_allowed", False)
            if not blind_allowed and not getattr(sr_in, "supervisor_auth_token", None):
                raise HTTPException(
                    status_code=422,
                    detail="Blind returns without original bill reference require supervisor authorization.",
                )

        from .transaction_integrity_engine import TransactionIntegrityEngine

        async with TransactionIntegrityEngine.guard(
            session=self.db,
            company_id=self.tenant_ctx.company_id,
            entity_type="SALES_RETURN",
            idempotency_key=idempotency_key,
            business_key=sr_in.return_no,
            request_payload=sr_in,
            branch_id=self.tenant_ctx.branch_id,
            user_id=getattr(self.tenant_ctx, "user_id", None),
            commit=True,
        ) as guard:
            if guard.is_replayed:
                if guard.record and guard.record.document_id:
                    res = await self.db.execute(
                        select(SalesReturn)
                        .options(selectinload(SalesReturn.items))
                        .where(SalesReturn.id == guard.record.document_id)
                    )
                    cached_sr = res.scalars().first()
                    if cached_sr:
                        return cached_sr

            # Pessimistic row-level lock on original invoice to serialize concurrent returns against it
            await self.db.execute(
                select(SalesInvoice)
                .where(
                    SalesInvoice.id == orig_invoice.id,
                    SalesInvoice.company_id == self.tenant_ctx.company_id
                )
                .with_for_update()
            )

            existing = await self.db.execute(
                select(SalesReturn).filter(
                    SalesReturn.return_no == sr_in.return_no,
                    SalesReturn.is_deleted == False,
                    SalesReturn.company_id == self.tenant_ctx.company_id,
                )
            )
            if existing.scalars().first():
                raise HTTPException(
                    status_code=400,
                    detail=f"Duplicate document number: Sales return '{sr_in.return_no}' already exists under active company context."
                )

            tax_total = Decimal("0.00")
            grand_total = Decimal("0.00")
            sr_items = []
            product_stock_updates = []

            successful_statuses = {"approved", "processed", "completed", "submitted", "draft"}
            returned_quantities = {}
            previous_returns = await self.db.execute(
                select(SalesReturnItem.product_id, func.sum(SalesReturnItem.quantity).label("total_returned"))
                .join(SalesReturn, SalesReturn.id == SalesReturnItem.return_id)
                .where(
                    SalesReturn.original_invoice_id == sr_in.original_invoice_id,
                    SalesReturn.company_id == self.tenant_ctx.company_id,
                    SalesReturn.is_deleted == False,
                    SalesReturn.status.in_(successful_statuses),
                    SalesReturnItem.product_id.is_not(None),
                )
                .group_by(SalesReturnItem.product_id)
            )
            for product_id, quantity in previous_returns.all():
                returned_quantities[product_id] = Decimal(str(quantity or 0))

            invoice_items = {item.product_id: item for item in orig_invoice.items}
            requested_quantities = {}

            for item in sr_in.items:
                # Check product
                res = await self.db.execute(
                    select(Product).where(
                        Product.id == item.product_id,
                        Product.company_id == self.tenant_ctx.company_id,
                        Product.is_deleted == False
                    )
                )
                product = res.scalars().first()
                if not product:
                    raise HTTPException(status_code=404, detail=f"Product with ID {item.product_id} not found")

                invoice_item = invoice_items.get(item.product_id)
                if invoice_item is None:
                    raise HTTPException(status_code=422, detail=f"Product {item.product_id} is not present on the original invoice")
                original_quantity = invoice_item.quantity
                requested_quantities[item.product_id] = requested_quantities.get(item.product_id, Decimal("0")) + item.quantity
                remaining_quantity = original_quantity - returned_quantities.get(item.product_id, Decimal("0"))
                if requested_quantities[item.product_id] <= Decimal("0") or requested_quantities[item.product_id] > remaining_quantity:
                    raise HTTPException(status_code=422, detail=f"Return quantity exceeds remaining quantity for product {item.product_id}")

                # Prices and tax rates come from the original invoice snapshot, not the client payload.
                original_unit_price = invoice_item.price
                original_gst_rate = invoice_item.gst_rate or Decimal("0.00")
                original_tax_per_unit = (invoice_item.tax_amount or Decimal("0.00")) / original_quantity if original_quantity else Decimal("0.00")
                item_tax = (item.quantity * original_tax_per_unit).quantize(Decimal("0.01"))
                item_total = (item.quantity * original_unit_price + item_tax).quantize(Decimal("0.01"))
                tax_total += item_tax
                grand_total += item_total

                sr_items.append(SalesReturnItem(
                    company_id=self.tenant_ctx.company_id,
                    branch_id=self.tenant_ctx.branch_id,
                    product_id=item.product_id,
                    item_id=invoice_item.item_id,
                    variant_id=invoice_item.variant_id,
                    code=item.code,
                    name=item.name,
                    quantity=item.quantity,
                    price=original_unit_price,
                    gst_rate=original_gst_rate,
                    tax_amount=item_tax,
                    total_amount=item_total
                ))
                product_stock_updates.append((product, item.quantity))

            # Check supervisor authorization threshold if applicable
            auth_policy = policy.values.get("authorization_policy")
            if not isinstance(auth_policy, dict) or "supervisor_threshold" not in auth_policy:
                raise HTTPException(status_code=500, detail="SALES_RETURN_POLICY_NOT_CONFIGURED: missing authorization_policy.supervisor_threshold in the effective policy.")
            threshold_val = auth_policy.get("supervisor_threshold")
            supervisor_threshold = Decimal(str(threshold_val))
            if grand_total > supervisor_threshold and not getattr(sr_in, "supervisor_auth_token", None):
                pass

            # Credit Note is policy-driven
            credit_note_policy = (policy.values.get("credit_note_policy") or {}) if isinstance(policy.values.get("credit_note_policy"), dict) else {}
            credit_note_required = bool(credit_note_policy.get("required", False))
            auto_generate_credit_note = bool(credit_note_policy.get("auto_generate", False))
            credit_note_no = sr_in.credit_note_number

            if (credit_note_required or auto_generate_credit_note) and (not credit_note_no or credit_note_no == f"CN-{sr_in.return_no}"):
                try:
                    cn_alloc = await DocumentsEngine.allocate_next_number_in_transaction(
                        session=self.db,
                        company_id=self.tenant_ctx.company_id,
                        document_type="CREDIT_NOTE",
                        branch_id=self.tenant_ctx.branch_id,
                        created_by=getattr(self.tenant_ctx, "user_id", None) or "system",
                    )
                    credit_note_no = cn_alloc.document_no
                except Exception:
                    credit_note_no = sr_in.credit_note_number if sr_in.credit_note_number else None
            elif credit_note_no == f"CN-{sr_in.return_no}":
                credit_note_no = None
            elif not credit_note_required and not auto_generate_credit_note:
                credit_note_no = None

            sr_tech_id = sr_in.id or IdentityEngine.generate_technical_id()
            db_sr = SalesReturn(
                id=sr_tech_id,
                uuid=sr_tech_id,
                return_no=sr_in.return_no,
                original_invoice_id=sr_in.original_invoice_id,
                credit_note_number=credit_note_no,
                date=sr_in.date,
                reason=sr_in.reason,
                tax_total=tax_total,
                grand_total=grand_total,
                is_interstate=sr_in.is_interstate,
                status=sr_in.status or "Completed",
                items=sr_items,

                company_id=self.tenant_ctx.company_id,
                branch_id=self.tenant_ctx.branch_id,
                customer_id=orig_invoice.customer_id if orig_invoice else None,
                idempotency_key=idempotency_key,
                policy_id=policy.policy_id,
                policy_version=policy.policy_version,
                policy_scope=policy.resolution_scope,
                policy_snapshot={
                    "values": policy.values,
                    "resolution_source": policy.resolution_source,
                    "resolved_at": policy.resolved_at,
                    "refund_mode": getattr(sr_in, "refund_mode", "CREDIT_NOTE"),
                },
            )

            _ret_creator = getattr(self.tenant_ctx, "user_id", None) or "system"
            resolver = InventoryWarehouseResolver(self.db)

            # Apply stock increments and record StockMovement (RETURN_INWARD)
            for product, qty in product_stock_updates:
                if product.tracking_mode != "No-stock":
                    movement_id = IdentityEngine.generate_technical_id()
                    resolved_warehouse = await resolver.resolve(company_id=self.tenant_ctx.company_id, branch_id=self.tenant_ctx.branch_id)
                    db_movement = StockMovement(
                        id=movement_id,
                        uuid=movement_id,
                        product_id=product.id,
                        product_name=product.name,
                        sku=product.sku or product.code,
                        quantity=qty,
                        movement_type="RETURN_INWARD",
                        reference_doc_type="Sales Return",
                        reference_doc_id=db_sr.id,
                        warehouse_id=resolved_warehouse.id,
                        warehouse=resolved_warehouse.name,
                        unit_cost=product.cost_price or product.price,
                        remarks=f"Stock incremented for sales return: {db_sr.return_no}",
                        source_module="Sales",
                        company_id=self.tenant_ctx.company_id,
                        branch_id=self.tenant_ctx.branch_id
                    )
                    self.db.add(db_movement)
                    await self.db.flush()

                    # Synchronize cached aggregate via canonical StockSynchronizer
                    from .stock_synchronizer import StockSynchronizer
                    await StockSynchronizer.sync_product_stock_cache(self.db, product.id, self.tenant_ctx.company_id)
                    product.modified_at = datetime.now(timezone.utc)
                    self.db.add(product)

                    # Record INVENTORY_POSTED audit event
                    await ComplianceAuditService.record_audit_event(
                        session=self.db,
                        company_id=self.tenant_ctx.company_id,
                        branch_id=self.tenant_ctx.branch_id,
                        event_type="INVENTORY_POSTED",
                        entity_name="StockMovement",
                        entity_id=movement_id,
                        actor_user_id=_ret_creator,
                        action_summary=f"Restocked {qty} units of {product.name} ({product.code}) via RETURN_INWARD for {db_sr.return_no}",
                        after_state={
                            "product_id": product.id,
                            "sku": product.sku or product.code,
                            "quantity": float(qty),
                            "movement_type": "RETURN_INWARD",
                            "return_id": db_sr.id,
                        },
                    )

            # Process authoritative refund effect via SalesReturnRefundAdapter
            await SalesReturnRefundAdapter.process_sales_return_refund(
                session=self.db,
                company_id=self.tenant_ctx.company_id,
                branch_id=self.tenant_ctx.branch_id,
                sales_return=db_sr,
                orig_invoice=orig_invoice,
                policy=policy,
                requested_refund_mode=getattr(sr_in, "refund_mode", "CREDIT_NOTE"),
                idempotency_key=idempotency_key,
                actor_user_id=_ret_creator,
            )

            # Loyalty REVERSAL hook (atomic, pre-commit)
            from .sales_hook import write_loyalty_redeem
            await write_loyalty_redeem(
                db=self.db,
                return_id=db_sr.id,
                company_id=self.tenant_ctx.company_id,
                branch_id=self.tenant_ctx.branch_id,
                customer_id=orig_invoice.customer_id if orig_invoice else None,
                return_total=grand_total,
                creator=_ret_creator,
            )

            # Commission REVERSAL hook (atomic, pre-commit)
            from .sales_hook import write_commission_reversal
            await write_commission_reversal(
                db=self.db,
                company_id=self.tenant_ctx.company_id,
                branch_id=self.tenant_ctx.branch_id,
                sales_return_id=db_sr.id,
                return_no=db_sr.return_no,
                orig_invoice_id=orig_invoice.id,
                orig_invoice_no=orig_invoice.invoice_no,
                return_total=grand_total,
                orig_grand_total=Decimal(str(orig_invoice.grand_total or "0.00")),
                creator=_ret_creator,
            )

            # Record CREDIT_NOTE_CREATED audit event only when an actual credit note was created.
            if db_sr.credit_note_number:
                await ComplianceAuditService.record_audit_event(
                    session=self.db,
                    company_id=self.tenant_ctx.company_id,
                    branch_id=self.tenant_ctx.branch_id,
                    event_type="CREDIT_NOTE_CREATED",
                    entity_name="SalesReturn",
                    entity_id=db_sr.id,
                    actor_user_id=_ret_creator,
                    action_summary=f"Credit note {db_sr.credit_note_number} generated for invoice {db_sr.original_invoice_id} via return {db_sr.return_no}",
                    after_state={
                        "credit_note_number": db_sr.credit_note_number,
                        "return_no": db_sr.return_no,
                        "invoice_id": db_sr.original_invoice_id,
                        "grand_total": float(db_sr.grand_total),
                    },
                )

            # Record RETURN_CREATED audit event
            await ComplianceAuditService.record_audit_event(
                session=self.db,
                company_id=self.tenant_ctx.company_id,
                branch_id=self.tenant_ctx.branch_id,
                event_type="RETURN_CREATED",
                entity_name="SalesReturn",
                entity_id=db_sr.id,
                actor_user_id=_ret_creator,
                action_summary=f"Sales return {db_sr.return_no} created for invoice {db_sr.original_invoice_id}",
                after_state={
                    "invoice_id": db_sr.original_invoice_id,
                    "return_no": db_sr.return_no,
                    "policy_id": db_sr.policy_id,
                    "policy_version": db_sr.policy_version,
                    "policy_scope": db_sr.policy_scope,
                    "tax_total": float(db_sr.tax_total),
                    "grand_total": float(db_sr.grand_total),
                },
            )

            self.db.add(db_sr)
            await self.db.flush()
            guard.complete(
                document_id=db_sr.id,
                document_no=db_sr.return_no,
                response_payload={"id": db_sr.id, "return_no": db_sr.return_no, "grand_total": str(grand_total)}
            )

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
                (SalesReturn.branch_id == self.tenant_ctx.branch_id) | (SalesReturn.branch_id.is_(None)),
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
                (SalesReturn.branch_id == self.tenant_ctx.branch_id) | (SalesReturn.branch_id.is_(None)),
                SalesReturn.is_deleted == False
            )
        )
        sr = res.scalars().first()

        if not sr:
            raise HTTPException(status_code=404, detail="Sales return not found")
        return sr, sr.items

    # ???????????????????????????????????????????????????????????????
    # Phase 2 — UPDATE / CANCEL / DELETE
    # ???????????????????????????????????????????????????????????????

    # ?? Invoice UPDATE ??????????????????????????????????????????????

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
                (SalesInvoice.branch_id == self.tenant_ctx.branch_id) | (SalesInvoice.branch_id.is_(None)),
                SalesInvoice.is_deleted == False,
            )
        )
        invoice = res.scalars().first()
        if not invoice:
            raise HTTPException(status_code=404, detail="Sales invoice not found")

        if str(invoice.status or "").upper() not in {"DRAFT", "HOLD"}:
            raise HTTPException(
                status_code=409,
                detail="Posted tax invoices are immutable. Use the approved cancellation, amendment, credit-note, or debit-note workflow.",
            )

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
                product_res = await self.db.execute(select(Product).where(
                    (Product.id == item.product_id) | (Product.code == item.product_id),
                    Product.company_id == self.tenant_ctx.company_id,
                    Product.is_deleted == False,
                ))
                product = product_res.scalars().first()
                if not product:
                    raise HTTPException(status_code=400, detail=f"Item '{item.product_id}' was not found in the database.")
                gst_rate = item.gst_rate if item.gst_rate != Decimal("18.00") or not product.gst_percentage else Decimal(str(product.gst_percentage))
                item_tax   = (item.quantity * item.price
                               * (gst_rate / Decimal("100.00"))).quantize(Decimal("0.01"))
                item_total = (item.quantity * item.price + item_tax).quantize(Decimal("0.01"))
                tax_total   += item_tax
                grand_total += item_total
                canonical_item_id = getattr(item, "item_id", None) or getattr(product, "item_id", None)
                canonical_variant_id = getattr(item, "variant_id", None) or getattr(product, "item_variant_id", None)
                if not (canonical_item_id and canonical_variant_id):
                    from .product_resolution_service import ProductResolutionService
                    c_res = await ProductResolutionService.resolve_by_product_id(
                        session=self.db,
                        company_id=self.tenant_ctx.company_id,
                        product_id=product.id,
                    )
                    if c_res.success and c_res.item_id and c_res.variant_id:
                        canonical_item_id = canonical_item_id or c_res.item_id
                        canonical_variant_id = canonical_variant_id or c_res.variant_id

                new_items.append(SalesInvoiceItem(
                    invoice_id=invoice.id,
                    company_id=self.tenant_ctx.company_id,
                    branch_id=self.tenant_ctx.branch_id,
                    product_id=product.id,
                    item_id=canonical_item_id,
                    variant_id=canonical_variant_id,
                    code=item.code, name=item.name,
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

    # ?? Invoice CANCEL (DELETE) ?????????????????????????????????????

    async def cancel_sales_invoice(self, invoice_id: str) -> SalesInvoice:
        """
        Cancel a sales invoice: set status='Cancelled', soft-delete (is_deleted=True),
        and reverse deducted batch stock into warehouse.
        """
        branch_ids = [self.tenant_ctx.branch_id]
        if self.tenant_ctx.branch_id == "BR-MAIN-001":
            branch_ids.append("MAIN")
        res = await self.db.execute(
            select(SalesInvoice)
            .options(selectinload(SalesInvoice.items))
            .where(
                SalesInvoice.id         == invoice_id,
                SalesInvoice.company_id == self.tenant_ctx.company_id,
                SalesInvoice.branch_id.in_(branch_ids),
                SalesInvoice.is_deleted == False,
            )
        )
        invoice = res.scalars().first()
        if not invoice:
            raise HTTPException(status_code=404, detail="Sales invoice not found")

        from .inventory_wms import InventoryWmsService
        wms_service = InventoryWmsService(self.db, self.tenant_ctx)
        resolver = InventoryWarehouseResolver(self.db)
        wh_id = invoice.warehouse_id
        if not wh_id:
            wh = await resolver.resolve(company_id=self.tenant_ctx.company_id, branch_id=self.tenant_ctx.branch_id)
            wh_id = wh.id

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
                        item_id=item.item_id,
                        variant_id=item.variant_id,
                    )
                except Exception:
                    pass

        # Revert customer outstanding if credit sale
        if invoice.customer_id and invoice.customer_id != "CUST-WALKIN":
            try:
                cust = await self.crm_service.get_customer(invoice.customer_id)
                if cust and invoice.grand_total:
                    cust.outstanding = max(Decimal("0.00"), Decimal(str(cust.outstanding or "0.00")) - Decimal(str(invoice.grand_total)))
                    cust.modified_at = datetime.now(timezone.utc)
                    self.db.add(cust)

                    credit_entry = CustomerCreditLedgerEntry(
                        id=f"ccle-{uuid.uuid4().hex[:12]}",
                        company_id=self.tenant_ctx.company_id,
                        branch_id=self.tenant_ctx.branch_id,
                        customer_id=cust.id,
                        entry_date=datetime.now(timezone.utc),
                        entry_type="CREDIT",
                        amount=Decimal(str(invoice.grand_total)),
                        balance_after=cust.outstanding,
                        reference_type="SALES_INVOICE_CANCEL",
                        reference_id=invoice.id,
                        notes=f"Reversal for cancelled sales invoice {invoice.invoice_no}",
                    )
                    self.db.add(credit_entry)
            except Exception as e:
                logger.warning("Error reverting customer outstanding on invoice cancellation: %s", e)

        # Authoritative GL Reversal Posting (Phase 1 Canonical Integrity)
        from .unified_ledger import UnifiedAccountingLedgerService
        try:
            async with self.db.begin_nested():
                await UnifiedAccountingLedgerService.post_sales_cancellation_to_gl(
                    session=self.db,
                    company_id=self.tenant_ctx.company_id,
                    invoice_id=invoice.id,
                    branch_id=self.tenant_ctx.branch_id,
                    reason="Sales invoice cancellation",
                    cancelled_by=getattr(self.tenant_ctx, "user_id", None) or "SYSTEM",
                )
        except Exception as e:
            logger.warning("Notice during GL cancellation posting: %s", e)

        # Stage Transactional Outbox Event
        try:
            from .outbox_service import OutboxService
            await OutboxService.record_event(
                session=self.db,
                target_channel="SALES_POSTING",
                payload={
                    "event_type": "SalesInvoiceCancelledEvent",
                    "invoice_id": invoice.id,
                    "invoice_no": invoice.invoice_no,
                    "company_id": self.tenant_ctx.company_id,
                    "branch_id": self.tenant_ctx.branch_id,
                    "grand_total": str(invoice.grand_total),
                    "customer_id": invoice.customer_id,
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                },
                correlation_id=f"cancel_{invoice.id}",
                event_type="SALES_INVOICE_CANCELLED",
                aggregate_type="SALES_INVOICE",
                aggregate_id=invoice.id,
                company_id=self.tenant_ctx.company_id,
                branch_id=self.tenant_ctx.branch_id,
            )
        except Exception as e:
            logger.warning("Notice recording cancellation outbox event: %s", e)

        invoice.status      = "Cancelled"
        invoice.is_deleted  = True
        invoice.modified_at = datetime.now(timezone.utc)
        self.db.add(invoice)
        await self.db.commit()
        await self.db.refresh(invoice)
        return invoice

    # ?? Quotation UPDATE ????????????????????????????????????????????

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
                    company_id=self.tenant_ctx.company_id,
                    branch_id=self.tenant_ctx.branch_id,
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

    # ?? Quotation DELETE ????????????????????????????????????????????

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

    # ?? Order UPDATE ????????????????????????????????????????????????

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
                    company_id=self.tenant_ctx.company_id,
                    branch_id=self.tenant_ctx.branch_id,
                    product_id=product.id, item_id=product.item_id, variant_id=item.variant_id or product.item_variant_id,
                    code=product.code, name=product.name,
                    quantity=item.quantity, price=item.price,
                    hsn_code=item.hsn_code or product.hsn_code, gst_rate=gst_rate,
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

    # ?? Order DELETE ????????????????????????????????????????????????

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

    async def close_or_cancel_sales_order_line(
        self,
        order_id: str,
        line_id: int,
        action: str,
        request: SalesOrderLineActionRequest,
        user_name: str,
    ) -> SalesOrderItem:
        if action not in {"close", "cancel"}:
            raise HTTPException(status_code=400, detail="Sales Order line action must be close or cancel.")
        result = await self.db.execute(
            select(SalesOrderItem)
            .join(SalesOrder, SalesOrder.id == SalesOrderItem.order_id)
            .where(
                SalesOrderItem.id == line_id,
                SalesOrderItem.order_id == order_id,
                SalesOrder.company_id == self.tenant_ctx.company_id,
                SalesOrder.branch_id == self.tenant_ctx.branch_id,
                SalesOrder.is_deleted == False,
            )
        )
        line = result.scalars().first()
        if not line:
            raise HTTPException(status_code=404, detail="Sales Order line not found")
        if line.line_status in {"BILLED", "CANCELLED", "CLOSED"}:
            raise HTTPException(status_code=400, detail=f"Cannot change line with status '{line.line_status}'.")
        line.line_status = "CANCELLED" if action == "cancel" else "CLOSED"
        line.closure_reason = request.reason.strip()
        line.closed_at = datetime.now(timezone.utc)
        line.closed_by = user_name
        self.db.add(line)
        await self.db.commit()
        await self.db.refresh(line)
        return line

    # ?? Return UPDATE ???????????????????????????????????????????????

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
            orig_inv_res = await self.db.execute(
                select(SalesInvoice).options(selectinload(SalesInvoice.items)).where(
                    SalesInvoice.id == sr.original_invoice_id,
                    SalesInvoice.company_id == self.tenant_ctx.company_id,
                )
            )
            orig_inv = orig_inv_res.scalars().first()
            orig_inv_map = {it.product_id: it for it in orig_inv.items} if orig_inv else {}

            tax_total   = Decimal("0.00")
            grand_total = Decimal("0.00")
            for item in update_in.items:
                item_tax   = (item.quantity * item.price
                               * (item.gst_rate / Decimal("100.00"))).quantize(Decimal("0.01"))
                item_total = (item.quantity * item.price + item_tax).quantize(Decimal("0.01"))
                tax_total   += item_tax
                grand_total += item_total

                inv_it = orig_inv_map.get(item.product_id)
                ret_item_id = getattr(item, "item_id", None) or (inv_it.item_id if inv_it else None)
                ret_variant_id = getattr(item, "variant_id", None) or (inv_it.variant_id if inv_it else None)

                self.db.add(SalesReturnItem(
                    return_id=sr.id,
                    company_id=self.tenant_ctx.company_id,
                    branch_id=self.tenant_ctx.branch_id,
                    product_id=item.product_id,
                    item_id=ret_item_id,
                    variant_id=ret_variant_id,
                    code=item.code, name=item.name,
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

    # ?? Return DELETE ???????????????????????????????????????????????

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


    # ??????????????????????????? Phase 4B: Workflow ?????????????????????????????

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

    # ??????????????????????????? Phase 4B: Convert Quotation ????????????????????

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
        tech_id, id_code = await IdentityEngine.allocate_internal(
            session=self.db,
            entity_type="SALES_INVOICE",
            group_code="SAL",
            company_id=self.tenant_ctx.company_id,
            branch_id=self.tenant_ctx.branch_id,
            purpose="CONVERT_QUOTATION",
        )
        invoice_id = tech_id
        invoice = SalesInvoice(
            id           = invoice_id,
            uuid         = invoice_id,
            identity_code= id_code,
            company_id   = self.tenant_ctx.company_id,
            branch_id    = self.tenant_ctx.branch_id,
            invoice_no   = id_code,
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
            canonical_item_id = getattr(q_item, "item_id", None)
            canonical_variant_id = getattr(q_item, "variant_id", None)
            if not (canonical_item_id and canonical_variant_id):
                p_res = await self.db.execute(select(Product).where(
                    (Product.id == q_item.product_id) | (Product.code == q_item.product_id),
                    Product.company_id == self.tenant_ctx.company_id,
                    Product.is_deleted == False,
                ))
                product = p_res.scalars().first()
                if product:
                    canonical_item_id = product.item_id
                    canonical_variant_id = product.item_variant_id
                    if not (canonical_item_id and canonical_variant_id):
                        from .product_resolution_service import ProductResolutionService
                        c_res = await ProductResolutionService.resolve_by_product_id(
                            session=self.db,
                            company_id=self.tenant_ctx.company_id,
                            product_id=product.id,
                        )
                        if c_res.success and c_res.item_id and c_res.variant_id:
                            canonical_item_id = c_res.item_id
                            canonical_variant_id = c_res.variant_id

            inv_item_id = IdentityEngine.generate_technical_id()
            inv_item = SalesInvoiceItem(
                uuid         = inv_item_id,
                company_id   = self.tenant_ctx.company_id,
                branch_id    = self.tenant_ctx.branch_id,
                invoice_id   = invoice.id,
                product_id   = q_item.product_id,
                item_id      = canonical_item_id,
                variant_id   = canonical_variant_id,
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
