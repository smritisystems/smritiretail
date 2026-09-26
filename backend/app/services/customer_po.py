import json
import uuid
from datetime import date
from decimal import Decimal
from typing import Any, Optional

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from ..models.company_policy import CompanyPolicySetting
from ..models.customer_po import CustomerPOInvoiceAllocation, CustomerPurchaseOrder, CustomerPurchaseOrderLine
from ..models.crm import Customer
from ..models.crm import CustomerDeliveryLocation
from ..models.inventory import Product
from ..models.item_master import Item, ItemVariant
from ..models.sales import SalesInvoice, SalesInvoiceItem
from ..schemas.customer_po import CustomerPOBillingRequest, CustomerPOCreate, OverBillingPolicy
from ..schemas.sales import SalesInvoiceCreate
from .sales import SalesService


class CustomerPOService:
    """Customer PO lifecycle and atomic PO-to-invoice allocation service."""

    def __init__(self, db, tenant_ctx):
        self.db = db
        self.tenant_ctx = tenant_ctx

    def _scope(self, query, model):
        return query.where(
            model.company_id == self.tenant_ctx.company_id,
            model.branch_id == self.tenant_ctx.branch_id,
            model.is_deleted == False,
        )

    async def _policy(self) -> tuple[OverBillingPolicy, dict[str, Any]]:
        default_policy = {"value": "BLOCK", "version": 1, "source": "CUSTOMER_PO_DEFAULT"}
        try:
            from ..db.session import async_session
            async with async_session() as ctrl_session:
                result = await ctrl_session.execute(select(CompanyPolicySetting).where(
                    CompanyPolicySetting.company_id == self.tenant_ctx.company_id,
                    CompanyPolicySetting.key == "OVER_BILLING_POLICY",
                ))
                setting = result.scalars().first()
                if setting:
                    raw = setting.value
                    parsed = json.loads(raw) if isinstance(raw, str) else raw
                    value = str(parsed.get("value", "BLOCK")).upper()
                    if value in {"BLOCK", "WARN", "ALLOW_WITH_AUTHORIZATION", "ALLOW"}:
                        return value, parsed
        except Exception:
            pass
        return "BLOCK", default_policy

    async def create(self, payload: CustomerPOCreate):
        customer = (await self.db.execute(select(Customer).where(
            Customer.id == payload.customer_id,
            Customer.company_id == self.tenant_ctx.company_id,
            (Customer.branch_id == self.tenant_ctx.branch_id) | (Customer.branch_id.is_(None)),
            Customer.is_deleted == False,
        ))).scalars().first()
        if not customer:
            raise HTTPException(status_code=404, detail="Customer not found in the active company.")

        duplicate = (await self.db.execute(self._scope(select(CustomerPurchaseOrder).where(
            CustomerPurchaseOrder.customer_id == payload.customer_id,
            CustomerPurchaseOrder.po_number == payload.po_number,
        ), CustomerPurchaseOrder))).scalars().first()
        if duplicate:
            raise HTTPException(status_code=409, detail="Customer PO number already exists for this customer.")

        policy, snapshot = await self._policy()
        po_id = f"cpo-{uuid.uuid4().hex[:16]}"
        lines = []
        ordered_qty = Decimal("0")
        ordered_value = Decimal("0")
        for line in payload.lines:
            await self._validate_line_references(line, payload.customer_id)
            value = (line.quantity_ordered * line.unit_price).quantize(Decimal("0.01"))
            ordered_qty += line.quantity_ordered
            ordered_value += value
            lines.append(CustomerPurchaseOrderLine(
                id=f"cpol-{uuid.uuid4().hex[:16]}",
                company_id=self.tenant_ctx.company_id,
                branch_id=self.tenant_ctx.branch_id,
                created_by=getattr(self.tenant_ctx, "user_id", None),
                customer_po_id=po_id,
                line_number=line.line_number,
                product_id=line.product_id,
                item_id=line.item_id,
                variant_id=line.variant_id,
                code=line.code,
                description=line.description,
                quantity_ordered=line.quantity_ordered,
                quantity_cancelled=Decimal("0"),
                quantity_billed=Decimal("0"),
                quantity_remaining=line.quantity_ordered,
                unit_price=line.unit_price,
                ordered_value=value,
                billed_value=Decimal("0"),
                remaining_value=value,
                gst_rate=line.gst_rate,
                hsn_code=line.hsn_code,
                uom=line.uom.upper(),
                delivery_location_id=line.delivery_location_id,
                line_status="OPEN",
            ))
        po = CustomerPurchaseOrder(
            id=po_id,
            company_id=self.tenant_ctx.company_id,
            branch_id=self.tenant_ctx.branch_id,
            created_by=getattr(self.tenant_ctx, "user_id", None),
            customer_id=payload.customer_id,
            po_number=payload.po_number,
            po_date=payload.po_date,
            valid_until=payload.valid_until,
            currency=payload.currency.upper(),
            status=payload.status,
            ordered_quantity=ordered_qty,
            remaining_quantity=ordered_qty,
            ordered_value=ordered_value,
            remaining_value=ordered_value,
            billing_policy_snapshot={**snapshot, "value": policy},
            notes=payload.notes,
            lines=lines,
        )
        self.db.add(po)
        await self.db.commit()
        return await self.get(po_id)

    async def _validate_line_references(self, line, customer_id: str):
        if line.product_id:
            product = (await self.db.execute(select(Product).where(
                (Product.id == line.product_id) | (Product.code == line.product_id),
                Product.company_id == self.tenant_ctx.company_id,
                (Product.branch_id == self.tenant_ctx.branch_id) | (Product.branch_id.is_(None)),
                Product.is_deleted == False,
            ))).scalars().first()
            if not product:
                raise HTTPException(status_code=400, detail=f"Product '{line.product_id}' is outside the active tenant scope.")
            if line.item_id and product.item_id and product.item_id != line.item_id:
                raise HTTPException(status_code=400, detail="Product and item references do not describe the same master record.")
            if line.variant_id and product.item_variant_id and product.item_variant_id != line.variant_id:
                raise HTTPException(status_code=400, detail="Product and variant references do not describe the same master record.")
        if line.item_id:
            item = (await self.db.execute(select(Item).where(
                Item.id == line.item_id,
                Item.company_id == self.tenant_ctx.company_id,
                (Item.branch_id == self.tenant_ctx.branch_id) | (Item.branch_id.is_(None)),
                Item.is_deleted == False,
            ))).scalars().first()
            if not item:
                raise HTTPException(status_code=400, detail=f"Item '{line.item_id}' is outside the active tenant scope.")
        if line.variant_id:
            variant = (await self.db.execute(select(ItemVariant).where(
                ItemVariant.id == line.variant_id,
                ItemVariant.company_id == self.tenant_ctx.company_id,
                (ItemVariant.branch_id == self.tenant_ctx.branch_id) | (ItemVariant.branch_id.is_(None)),
                ItemVariant.is_deleted == False,
            ))).scalars().first()
            if not variant or (line.item_id and variant.item_id != line.item_id):
                raise HTTPException(status_code=400, detail=f"Variant '{line.variant_id}' is invalid for the selected item and tenant.")
        if line.delivery_location_id:
            location = (await self.db.execute(select(CustomerDeliveryLocation).where(
                CustomerDeliveryLocation.id == line.delivery_location_id,
                CustomerDeliveryLocation.company_id == self.tenant_ctx.company_id,
                (CustomerDeliveryLocation.branch_id == self.tenant_ctx.branch_id) | (CustomerDeliveryLocation.branch_id.is_(None)),
                CustomerDeliveryLocation.customer_id == customer_id,
                CustomerDeliveryLocation.status == "ACTIVE",
                CustomerDeliveryLocation.is_deleted == False,
            ))).scalars().first()
            if not location:
                raise HTTPException(status_code=400, detail="Delivery location does not belong to the selected customer and tenant.")

    async def validate_billing(self, po_id: str, request: CustomerPOBillingRequest, lock: bool = False, enforce_policy: bool = False):
        query = self._scope(
            select(CustomerPurchaseOrder).where(CustomerPurchaseOrder.id == po_id),
            CustomerPurchaseOrder,
        )
        if lock:
            query = query.with_for_update()
        po = (await self.db.execute(query)).scalars().first()
        if not po:
            raise HTTPException(status_code=404, detail="Customer PO not found.")

        if lock:
            lines_query = self._scope(
                select(CustomerPurchaseOrderLine)
                .where(CustomerPurchaseOrderLine.customer_po_id == po.id)
                .with_for_update(),
                CustomerPurchaseOrderLine,
            )
            locked_lines = (await self.db.execute(lines_query)).scalars().all()
            po_lines = {line.id: line for line in locked_lines}
        else:
            lines_query = self._scope(
                select(CustomerPurchaseOrderLine)
                .where(CustomerPurchaseOrderLine.customer_po_id == po.id),
                CustomerPurchaseOrderLine,
            )
            lines = (await self.db.execute(lines_query)).scalars().all()
            po_lines = {line.id: line for line in lines}

        if request.invoice.get("customer_id") not in (None, po.customer_id, "CUST-WALKIN"):
            raise HTTPException(status_code=400, detail="Invoice customer does not match the Customer PO customer.")
        if len({line.customer_po_line_id for line in request.lines}) != len(request.lines):
            raise HTTPException(status_code=400, detail="Duplicate Customer PO line in billing request.")
        policy, _ = await self._policy()
        for requested in request.lines:
            if requested.quantity <= 0:
                raise HTTPException(status_code=400, detail="Billing quantity must be greater than zero.")
            line = po_lines.get(requested.customer_po_line_id)
            if not line or line.customer_po_id != po.id:
                raise HTTPException(status_code=400, detail="PO line does not belong to the selected Customer PO.")
            if enforce_policy and requested.quantity > line.quantity_remaining:
                if policy == "BLOCK":
                    raise HTTPException(status_code=409, detail=f"Over-billing blocked for PO line {line.line_number}; remaining quantity is {line.quantity_remaining}.")
                elif policy == "ALLOW_WITH_AUTHORIZATION" and not request.authorization:
                    raise HTTPException(status_code=409, detail=f"Over-billing requires authorization for PO line {line.line_number}; remaining quantity is {line.quantity_remaining}.")
        return po, po_lines

    async def get(self, po_id: str):
        result = await self.db.execute(self._scope(
            select(CustomerPurchaseOrder)
            .options(selectinload(CustomerPurchaseOrder.lines))
            .where(CustomerPurchaseOrder.id == po_id), CustomerPurchaseOrder
        ))
        po = result.scalars().first()
        if not po:
            raise HTTPException(status_code=404, detail="Customer PO not found.")
        return po

    async def update(self, po_id: str, payload):
        result = await self.db.execute(self._scope(
            select(CustomerPurchaseOrder).where(CustomerPurchaseOrder.id == po_id).with_for_update(), CustomerPurchaseOrder
        ))
        po = result.scalars().first()
        if not po:
            raise HTTPException(status_code=404, detail="Customer PO not found.")
        if po.status in {"FULLY_BILLED", "CLOSED", "CANCELLED"} and payload.status not in {None, po.status}:
            raise HTTPException(status_code=409, detail=f"Customer PO is {po.status} and cannot change lifecycle state.")
        if payload.valid_until is not None:
            if payload.valid_until < po.po_date:
                raise HTTPException(status_code=400, detail="valid_until cannot be before po_date")
            po.valid_until = payload.valid_until
        if payload.notes is not None:
            po.notes = payload.notes
        if payload.status is not None:
            po.status = payload.status
        await self.db.commit()
        return await self.get(po_id)

    async def list(self, customer_id: Optional[str] = None, q: Optional[str] = None, status: Optional[str] = None):
        query = self._scope(select(CustomerPurchaseOrder).options(selectinload(CustomerPurchaseOrder.lines)), CustomerPurchaseOrder)
        if customer_id:
            query = query.where(CustomerPurchaseOrder.customer_id == customer_id)
        if q:
            query = query.where(CustomerPurchaseOrder.po_number.ilike(f"%{q}%"))
        if status:
            query = query.where(CustomerPurchaseOrder.status == status)
        result = await self.db.execute(query.order_by(CustomerPurchaseOrder.po_date.desc(), CustomerPurchaseOrder.po_number))
        return list(result.scalars().unique().all())

    async def utilization(self, po_id: str):
        po = await self.get(po_id)
        return {
            "po_id": po.id,
            "po_number": po.po_number,
            "status": po.status,
            "ordered_quantity": po.ordered_quantity,
            "billed_quantity": po.billed_quantity,
            "remaining_quantity": po.remaining_quantity,
            "ordered_value": po.ordered_value,
            "billed_value": po.billed_value,
            "remaining_value": po.remaining_value,
            "billable_lines": [line for line in po.lines if line.quantity_remaining > 0 and line.line_status not in {"CANCELLED", "CLOSED"}],
        }

    async def history(self, po_id: str):
        await self.get(po_id)
        result = await self.db.execute(self._scope(
            select(CustomerPOInvoiceAllocation)
            .where(CustomerPOInvoiceAllocation.customer_po_id == po_id)
            .order_by(CustomerPOInvoiceAllocation.created_at), CustomerPOInvoiceAllocation
        ))
        return list(result.scalars().all())

    async def close(self, po_id: str):
        result = await self.db.execute(self._scope(
            select(CustomerPurchaseOrder).where(CustomerPurchaseOrder.id == po_id).with_for_update(), CustomerPurchaseOrder
        ))
        po = result.scalars().first()
        if not po:
            raise HTTPException(status_code=404, detail="Customer PO not found.")
        if po.remaining_quantity > 0:
            raise HTTPException(status_code=409, detail="Customer PO cannot close while billable quantity remains.")
        po.status = "CLOSED"
        po.closed_at = date.today()
        po.closed_by = getattr(self.tenant_ctx, "user_id", None) or "SYSTEM"
        await self.db.commit()
        return await self.get(po_id)

    async def bill(self, po_id: str, request: CustomerPOBillingRequest, idempotency_key: Optional[str] = None):
        """Create invoice plus allocations in one transaction, with row locks and idempotency."""
        effective_key = idempotency_key or getattr(request, "idempotency_key", None)
        if effective_key:
            existing = (await self.db.execute(
                self._scope(
                    select(SalesInvoice)
                    .options(selectinload(SalesInvoice.items))
                    .where(SalesInvoice.id == effective_key),
                    SalesInvoice,
                )
            )).scalars().first()
            if existing:
                return existing

        po, po_lines = await self.validate_billing(po_id, request, lock=True, enforce_policy=True)
        if po.status in {"CANCELLED", "CLOSED"}:
            raise HTTPException(status_code=409, detail=f"Customer PO is {po.status} and cannot be billed.")

        policy, policy_snapshot = await self._policy()
        invoice_payload = dict(request.invoice)
        invoice_payload.update({
            "customer_id": po.customer_id,
            "customer_po_id": po.id,
            "customer_po_number_snapshot": po.po_number,
            "customer_po_date_snapshot": po.po_date,
            "source_document_type": "CUSTOMER_PO",
            "source_document_id": po.id,
            "po_reference": po.po_number,
        })
        source_items = []
        for requested_line in request.lines:
            po_line_id = requested_line.customer_po_line_id
            quantity = requested_line.quantity
            line = po_lines.get(po_line_id)
            if not line or line.customer_po_id != po.id:
                raise HTTPException(status_code=400, detail="PO line does not belong to the selected Customer PO.")
            source_items.append({
                "product_id": line.product_id,
                "item_id": line.item_id,
                "code": line.code,
                "name": line.description,
                "quantity": quantity,
                "price": line.unit_price,
                "gst_rate": line.gst_rate,
                "hsn_code": line.hsn_code,
                "customer_po_line_id": line.id,
                "source_line_type": "CUSTOMER_PO",
                "source_line_id": line.id,
            })
        invoice_payload["items"] = source_items
        invoice_payload["rule_snapshots"] = {
            **(invoice_payload.get("rule_snapshots") or {}),
            "customer_po": {"id": po.id, "number": po.po_number, "date": str(po.po_date)},
            "over_billing_policy": {**policy_snapshot, "value": policy},
        }

        try:
            invoice_in = SalesInvoiceCreate.model_validate(invoice_payload)
            invoice = await SalesService(self.db, self.tenant_ctx).create_sales_invoice(
                invoice_in, idempotency_key=effective_key, commit=False
            )
            total_qty = Decimal("0")
            total_value = Decimal("0")
            for source_item, requested_qty in zip(source_items, request.lines):
                line = po_lines[requested_qty.customer_po_line_id]
                invoice_item = next(item for item in invoice.items if item.customer_po_line_id == line.id)
                value = (Decimal(str(invoice_item.total_amount)) or Decimal("0"))
                line.quantity_billed += requested_qty.quantity
                line.quantity_remaining = max(Decimal("0"), line.quantity_ordered - line.quantity_cancelled - line.quantity_billed)
                line.billed_value += value
                line.remaining_value = max(Decimal("0"), line.ordered_value - line.billed_value)
                line.line_status = "FULLY_BILLED" if line.quantity_remaining <= 0 else "PARTIALLY_BILLED"
                self.db.add(CustomerPOInvoiceAllocation(
                    id=f"cpoa-{uuid.uuid4().hex[:16]}",
                    company_id=self.tenant_ctx.company_id,
                    branch_id=self.tenant_ctx.branch_id,
                    created_by=getattr(self.tenant_ctx, "user_id", None),
                    customer_po_id=po.id,
                    customer_po_line_id=line.id,
                    invoice_id=invoice.id,
                    invoice_item_id=invoice_item.id,
                    customer_po_number=po.po_number,
                    invoice_number=invoice.invoice_no,
                    allocated_quantity=requested_qty.quantity,
                    allocated_value=value,
                    status="ALLOCATED",
                    allocation_metadata={"policy": {**policy_snapshot, "value": policy}},
                ))
                total_qty += requested_qty.quantity
                total_value += value
            po.billed_quantity += total_qty
            po.remaining_quantity = max(Decimal("0"), po.ordered_quantity - po.cancelled_quantity - po.billed_quantity)
            po.billed_value += total_value
            po.remaining_value = max(Decimal("0"), po.ordered_value - po.cancelled_value - po.billed_value)
            po.status = "FULLY_BILLED" if po.remaining_quantity <= 0 else "PARTIALLY_BILLED"
            self.db.add(po)
            await self.db.commit()
            return invoice
        except HTTPException:
            await self.db.rollback()
            raise
        except Exception:
            await self.db.rollback()
            raise
