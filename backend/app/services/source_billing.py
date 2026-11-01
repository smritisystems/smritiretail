import os
import uuid
from decimal import Decimal, ROUND_HALF_UP
from typing import Any, Optional

from fastapi import HTTPException
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..api.deps import TenantContext
from ..models.crm import Customer
from ..models.fulfillment import PackingSlip, PackingSlipItem, SalesSourceInvoiceAllocation
from ..models.sales import (
    SalesInvoice,
    SalesOrder,
    SalesOrderInvoiceAllocation,
    SalesOrderItem,
    SalesOrderReservation,
)
from ..repositories.customer import CustomerRepository
from ..schemas.sales import SalesInvoiceCreate
from ..schemas.source_billing import (
    SourceBillingCommitRequest,
    SourceBillingCommitResponse,
    SourceBillingPrepareLine,
    SourceBillingPrepareRequest,
    SourceBillingPrepareResponse,
)
from .sales import SalesService


def source_billing_commit_enabled() -> bool:
    return os.getenv("SMRITI_SOURCE_BILLING_ENABLED", "").strip().lower() in {"1", "true", "yes"}


def _allocate_fixed_line_discount(
    total_discount: Decimal,
    ordered_quantity: Decimal,
    previously_billed_quantity: Decimal,
    quantity: Decimal,
) -> Decimal:
    if total_discount <= 0 or ordered_quantity <= 0 or quantity <= 0:
        return Decimal("0.00")
    cent = Decimal("0.01")
    billed_before = min(ordered_quantity, max(Decimal("0"), previously_billed_quantity))
    billed_after = min(ordered_quantity, billed_before + quantity)
    allocated_before = (total_discount * billed_before / ordered_quantity).quantize(cent, rounding=ROUND_HALF_UP)
    allocated_after = (total_discount * billed_after / ordered_quantity).quantize(cent, rounding=ROUND_HALF_UP)
    return max(Decimal("0.00"), allocated_after - allocated_before)


class SourceBillingService:
    """Prepare and atomically commit source-backed invoices."""

    def __init__(self, session: AsyncSession, tenant_ctx: TenantContext):
        self.session = session
        self.tenant_ctx = tenant_ctx

    async def _load_order(self, identifier: str, *, lock: bool = False) -> SalesOrder:
        if not self.tenant_ctx.company_id or not self.tenant_ctx.branch_id:
            raise HTTPException(status_code=400, detail="A company and active branch are required for source billing.")
        stmt = (
            select(SalesOrder)
            .options(selectinload(SalesOrder.items))
            .where(
                SalesOrder.company_id == self.tenant_ctx.company_id,
                SalesOrder.branch_id == self.tenant_ctx.branch_id,
                SalesOrder.is_deleted.is_(False),
                or_(SalesOrder.id == identifier, SalesOrder.order_no == identifier),
            )
        )
        if lock:
            stmt = stmt.with_for_update()
        order = (await self.session.execute(stmt)).scalars().first()
        if not order:
            raise HTTPException(status_code=404, detail="Sales Order not found in the active company and branch.")
        return order

    async def _load_packing_slip(self, identifier: str, *, lock: bool = False) -> PackingSlip:
        if not self.tenant_ctx.company_id or not self.tenant_ctx.branch_id:
            raise HTTPException(status_code=400, detail="A company and active branch are required for source billing.")
        stmt = (
            select(PackingSlip)
            .options(selectinload(PackingSlip.items))
            .where(
                PackingSlip.company_id == self.tenant_ctx.company_id,
                PackingSlip.branch_id == self.tenant_ctx.branch_id,
                PackingSlip.is_deleted.is_(False),
                or_(PackingSlip.id == identifier, PackingSlip.packing_slip_number == identifier),
            )
        )
        if lock:
            stmt = stmt.with_for_update()
        slip = (await self.session.execute(stmt)).scalars().first()
        if not slip:
            raise HTTPException(status_code=404, detail="Packing Slip not found in the active company and branch.")
        if slip.billing_ownership_status != "VERIFIED" or not slip.customer_id or not slip.order_id:
            raise HTTPException(status_code=409, detail="Packing Slip ownership is unverified or it is not linked to a Sales Order.")
        return slip

    async def _require_visible_customer(self, customer_id: Optional[str]) -> Customer:
        if not customer_id:
            raise HTTPException(status_code=409, detail="The source document has no verified customer.")
        visible = await CustomerRepository(self.session, self.tenant_ctx).get_billing_visible_id(customer_id)
        if visible != customer_id:
            raise HTTPException(status_code=404, detail="Customer not found or unavailable for billing.")
        customer = (await self.session.execute(
            select(Customer).where(
                Customer.id == customer_id,
                Customer.company_id == self.tenant_ctx.company_id,
                Customer.is_deleted.is_(False),
                Customer.status == "Active",
            )
        )).scalars().first()
        if not customer:
            raise HTTPException(status_code=404, detail="Customer not found or unavailable for billing.")
        return customer

    async def _allocated_order_quantity(self, item_id: int) -> Decimal:
        value = await self.session.scalar(
            select(func.coalesce(func.sum(
                SalesSourceInvoiceAllocation.allocated_quantity
                - SalesSourceInvoiceAllocation.reversed_quantity
            ), 0)).where(
                SalesSourceInvoiceAllocation.company_id == self.tenant_ctx.company_id,
                SalesSourceInvoiceAllocation.branch_id == self.tenant_ctx.branch_id,
                SalesSourceInvoiceAllocation.sales_order_item_id == item_id,
                SalesSourceInvoiceAllocation.status == "COMMITTED",
                SalesSourceInvoiceAllocation.is_deleted.is_(False),
            )
        )
        return Decimal(str(value or 0))

    async def _allocated_slip_quantity(self, item_id: str) -> Decimal:
        value = await self.session.scalar(
            select(func.coalesce(func.sum(
                SalesSourceInvoiceAllocation.allocated_quantity
                - SalesSourceInvoiceAllocation.reversed_quantity
            ), 0)).where(
                SalesSourceInvoiceAllocation.company_id == self.tenant_ctx.company_id,
                SalesSourceInvoiceAllocation.branch_id == self.tenant_ctx.branch_id,
                SalesSourceInvoiceAllocation.packing_slip_item_id == item_id,
                SalesSourceInvoiceAllocation.status == "COMMITTED",
                SalesSourceInvoiceAllocation.is_deleted.is_(False),
            )
        )
        return Decimal(str(value or 0))

    async def _line_for_order_item(
        self,
        order: SalesOrder,
        item: SalesOrderItem,
        *,
        source_line_id: str,
        package_quantity: Optional[Decimal] = None,
        package_billed: Decimal = Decimal("0"),
    ) -> SourceBillingPrepareLine:
        ordered = Decimal(str(item.quantity or 0))
        allocated = await self._allocated_order_quantity(item.id)
        legacy_billed = Decimal(str(item.billed_quantity or 0))
        previously_billed = max(allocated, legacy_billed)
        order_remaining = max(Decimal("0"), ordered - previously_billed)
        if package_quantity is None:
            remaining = order_remaining
        else:
            remaining = min(
                order_remaining,
                max(Decimal("0"), package_quantity - package_billed),
            )
        line_status = str(item.line_status or "OPEN").upper()
        reason = None
        if line_status in {"CANCELLED", "CLOSED", "BILLED"}:
            remaining = Decimal("0")
            reason = f"Sales Order line is {line_status.lower()}."
        elif remaining <= 0:
            reason = "No unbilled quantity remains."
        return SourceBillingPrepareLine(
            source_line_id=source_line_id,
            order_line_id=str(item.id),
            product_id=item.product_id or "",
            item_id=item.item_id,
            variant_id=item.variant_id,
            code=item.code,
            name=item.name,
            ordered_quantity=package_quantity if package_quantity is not None else ordered,
            previously_billed_quantity=package_billed if package_quantity is not None else previously_billed,
            remaining_quantity=remaining,
            unit_price=Decimal(str(item.price or 0)),
            discount_percent=Decimal(str(item.discount_percent or 0)),
            discount_amount=Decimal(str(item.discount_amount or 0)),
            discount_quantity_basis=ordered,
            previously_billed_order_quantity=previously_billed,
            gst_rate=item.gst_rate,
            hsn_code=item.hsn_code,
            eligible=remaining > 0,
            reason=reason,
        )

    async def prepare(self, request: SourceBillingPrepareRequest) -> SourceBillingPrepareResponse:
        slip: Optional[PackingSlip] = None
        if request.source_type == "SALES_ORDER":
            order = await self._load_order(request.source_document_id)
            existing_slips = await self.session.execute(
                select(PackingSlip.id).where(
                    PackingSlip.company_id == self.tenant_ctx.company_id,
                    PackingSlip.branch_id == self.tenant_ctx.branch_id,
                    PackingSlip.order_id == order.id,
                    PackingSlip.is_deleted.is_(False),
                ).limit(1)
            )
            if existing_slips.scalar_one_or_none():
                raise HTTPException(
                    status_code=409,
                    detail="This Sales Order has Packing Slips. Bill through the eligible Packing Slip source to avoid duplicate stock movement.",
                )
        else:
            slip = await self._load_packing_slip(request.source_document_id)
            order = await self._load_order(slip.order_id)
            if slip.customer_id != order.customer_id:
                raise HTTPException(status_code=409, detail="Packing Slip customer does not match its Sales Order customer.")

        customer = await self._require_visible_customer(slip.customer_id if slip else order.customer_id)
        terminal_statuses = {"CANCELLED", "CLOSED", "REJECTED"}
        order_status = str(order.status or "").strip().upper()
        if order_status in terminal_statuses:
            raise HTTPException(status_code=409, detail=f"Sales Order is {order_status.lower()} and cannot be billed.")

        lines: list[SourceBillingPrepareLine] = []
        if slip:
            if str(slip.status or "").upper() not in {"PACKED", "PARTIALLY_BILLED"}:
                raise HTTPException(status_code=409, detail=f"Packing Slip is {slip.status.lower()} and cannot be billed.")
            if not slip.items:
                raise HTTPException(status_code=409, detail="Packing Slip has no item lines.")
            for slip_line in slip.items:
                source_line_id = str(slip_line.id)
                order_item = next(
                    (row for row in order.items if row.id == slip_line.order_item_id),
                    None,
                )
                if not order_item or order_item.product_id != slip_line.product_id:
                    lines.append(SourceBillingPrepareLine(
                        source_line_id=source_line_id,
                        order_line_id=str(slip_line.order_item_id) if slip_line.order_item_id else None,
                        product_id=slip_line.product_id,
                        code=slip_line.sku,
                        name=slip_line.sku,
                        ordered_quantity=Decimal(str(slip_line.quantity)),
                        previously_billed_quantity=Decimal("0"),
                        remaining_quantity=Decimal("0"),
                        unit_price=Decimal("0"),
                        eligible=False,
                        reason="Packing Slip line has no verified matching Sales Order line.",
                    ))
                    continue
                package_billed = await self._allocated_slip_quantity(source_line_id)
                line = await self._line_for_order_item(
                    order,
                    order_item,
                    source_line_id=source_line_id,
                    package_quantity=Decimal(str(slip_line.quantity)),
                    package_billed=package_billed,
                )
                lines.append(line)
        else:
            for item in order.items:
                lines.append(await self._line_for_order_item(
                    order, item, source_line_id=str(item.id),
                ))

        return SourceBillingPrepareResponse(
            source_type=request.source_type,
            source_document_id=slip.id if slip else order.id,
            source_document_number=slip.packing_slip_number if slip else order.order_no,
            sales_order_id=order.id,
            sales_order_number=order.order_no,
            packing_slip_id=slip.id if slip else None,
            packing_slip_number=slip.packing_slip_number if slip else None,
            customer_id=customer.id,
            customer_name=customer.name,
            company_id=self.tenant_ctx.company_id,
            branch_id=self.tenant_ctx.branch_id,
            lines=lines,
        )

    async def commit(
        self,
        request: SourceBillingCommitRequest,
        idempotency_key: str,
        *,
        authorized_credit_override: bool = False,
        credit_override_actor: Optional[str] = None,
        authorized_transaction_mode_change: bool = False,
        authorized_price_override: bool = False,
        authorized_discount_override: bool = False,
        authorized_adjustment_override: bool = False,
    ) -> SourceBillingCommitResponse:
        if not source_billing_commit_enabled():
            raise HTTPException(
                status_code=503,
                detail="Source billing is not enabled. Complete migration, reconciliation, and rollout validation first.",
            )
        if not idempotency_key or len(idempotency_key) > 50:
            raise HTTPException(status_code=400, detail="A source-billing Idempotency-Key of 1-50 characters is required.")

        try:
            if request.source_type == "SALES_ORDER":
                order = await self._load_order(request.source_document_id, lock=True)
                slip = None
            else:
                slip = await self._load_packing_slip(request.source_document_id, lock=True)
                order = await self._load_order(slip.order_id, lock=True)
                if slip.customer_id != order.customer_id:
                    raise HTTPException(status_code=409, detail="Packing Slip customer does not match its Sales Order customer.")

            customer = await self._require_visible_customer(slip.customer_id if slip else order.customer_id)
            item_result = await self.session.execute(
                select(SalesOrderItem).where(
                    SalesOrderItem.order_id == order.id,
                    SalesOrderItem.company_id == self.tenant_ctx.company_id,
                    SalesOrderItem.branch_id == self.tenant_ctx.branch_id,
                    SalesOrderItem.is_deleted.is_(False),
                ).with_for_update()
            )
            order_items = {str(item.id): item for item in item_result.scalars().all()}
            slip_items = {}
            if slip:
                slip_result = await self.session.execute(
                    select(PackingSlipItem).where(
                        PackingSlipItem.packing_slip_id == slip.id,
                        PackingSlipItem.company_id == self.tenant_ctx.company_id,
                        PackingSlipItem.is_deleted.is_(False),
                    ).with_for_update()
                )
                slip_items = {str(item.id): item for item in slip_result.scalars().all()}

            requested: dict[str, Decimal] = {}
            for line in request.lines:
                if line.source_line_id in requested:
                    raise HTTPException(status_code=422, detail="Duplicate source line in billing request.")
                requested[line.source_line_id] = line.quantity

            if request.invoice.customer_id and request.invoice.customer_id != customer.id:
                raise HTTPException(status_code=422, detail="Invoice customer must match the source document customer.")

            source_rows: list[tuple[str, SalesOrderItem, Optional[PackingSlipItem], Decimal]] = []
            if slip:
                for source_line_id, quantity in requested.items():
                    slip_line = slip_items.get(source_line_id)
                    if not slip_line or not slip_line.order_item_id:
                        raise HTTPException(status_code=409, detail="Packing Slip line is unverified and cannot be billed.")
                    order_item = order_items.get(str(slip_line.order_item_id))
                    if not order_item or order_item.product_id != slip_line.product_id:
                        raise HTTPException(status_code=409, detail="Packing Slip line does not match its Sales Order line.")
                    source_rows.append((source_line_id, order_item, slip_line, quantity))
            else:
                for source_line_id, quantity in requested.items():
                    order_item = order_items.get(source_line_id)
                    if not order_item:
                        raise HTTPException(status_code=404, detail=f"Sales Order line {source_line_id} was not found.")
                    source_rows.append((source_line_id, order_item, None, quantity))

            invoice_header = request.invoice.model_dump(exclude_unset=True)
            invoice_header.update({
                "customer_id": customer.id,
                "customer_name": customer.name,
                "customer_gstin": request.invoice.customer_gstin or order.customer_gstin,
                "source_document_type": "PACKING_SLIP_CONSOLIDATED" if slip else "SALES_ORDER",
                "source_document_id": slip.id if slip else order.id,
                "so_reference_no": order.order_no,
                "po_reference": request.invoice.po_reference or order.po_number,
                "status": "Submitted",
                "is_draft": False,
                "items": [],
            })
            invoice_lines: list[dict[str, Any]] = []
            billed_quantity_by_order_line: dict[int, Decimal] = {}
            for source_line_id, order_item, slip_item, quantity in source_rows:
                ordered_quantity = Decimal(str(order_item.quantity or 0))
                allocated_quantity = billed_quantity_by_order_line.get(order_item.id)
                if allocated_quantity is None:
                    allocated_quantity = max(
                        await self._allocated_order_quantity(order_item.id),
                        Decimal(str(order_item.billed_quantity or 0)),
                    )
                discount_percent = Decimal(str(order_item.discount_percent or 0))
                discount_amount = Decimal("0.00") if discount_percent > 0 else _allocate_fixed_line_discount(
                    Decimal(str(order_item.discount_amount or 0)),
                    ordered_quantity,
                    allocated_quantity,
                    quantity,
                )
                invoice_lines.append({
                    "product_id": order_item.product_id,
                    "item_id": order_item.item_id,
                    "variant_id": order_item.variant_id,
                    "code": order_item.code,
                    "name": order_item.name,
                    "quantity": quantity,
                    "price": order_item.price,
                    "mrp": order_item.mrp,
                    "hsn_code": order_item.hsn_code,
                    "gst_rate": order_item.gst_rate,
                    "disc_pct": discount_percent,
                    "disc_amt": discount_amount,
                    "source_line_type": "PACKING_SLIP" if slip_item else "SALES_ORDER",
                    "source_line_id": source_line_id,
                })
                billed_quantity_by_order_line[order_item.id] = allocated_quantity + quantity
            invoice_header["items"] = invoice_lines
            invoice_input = SalesInvoiceCreate.model_validate(invoice_header)

            invoice = await SalesService(self.session, self.tenant_ctx).create_sales_invoice(
                invoice_input,
                idempotency_key=idempotency_key,
                commit=False,
                authorized_credit_override=authorized_credit_override,
                credit_override_actor=credit_override_actor,
                authorized_transaction_mode_change=authorized_transaction_mode_change,
                authorized_price_override=authorized_price_override,
                authorized_discount_override=authorized_discount_override,
                authorized_adjustment_override=authorized_adjustment_override,
                source_billing_authorized=True,
            )
            if not invoice:
                raise HTTPException(status_code=500, detail="Canonical invoice posting returned no invoice.")

            existing_allocations = (await self.session.execute(
                select(SalesSourceInvoiceAllocation).where(
                    SalesSourceInvoiceAllocation.company_id == self.tenant_ctx.company_id,
                    SalesSourceInvoiceAllocation.branch_id == self.tenant_ctx.branch_id,
                    SalesSourceInvoiceAllocation.idempotency_key == idempotency_key,
                    SalesSourceInvoiceAllocation.is_deleted.is_(False),
                )
            )).scalars().all()
            if existing_allocations:
                expected = {line.source_line_id: line.quantity for line in request.lines}
                if len(expected) != len(request.lines):
                    raise HTTPException(status_code=422, detail="Duplicate source line in billing request.")
                actual: dict[str, Decimal] = {}
                invoice_ids = {row.invoice_id for row in existing_allocations}
                for allocation in existing_allocations:
                    same_source = allocation.sales_order_id == order.id
                    if slip:
                        same_source = same_source and allocation.packing_slip_id == slip.id
                        source_line_id = allocation.packing_slip_item_id
                    else:
                        same_source = same_source and allocation.packing_slip_id is None
                        source_line_id = str(allocation.sales_order_item_id) if allocation.sales_order_item_id else None
                    if not same_source or not source_line_id or allocation.status != "COMMITTED":
                        raise HTTPException(status_code=409, detail="Idempotency-Key was already used for a different or reversed source billing request.")
                    actual[str(source_line_id)] = Decimal(str(allocation.allocated_quantity))
                if actual != expected or len(invoice_ids) != 1 or next(iter(invoice_ids)) != invoice.id:
                    raise HTTPException(status_code=409, detail="Idempotency-Key was already used with a different source or quantity.")
                await self.session.commit()
                return SourceBillingCommitResponse(
                    success=True,
                    idempotent_replay=True,
                    invoice_id=invoice.id,
                    invoice_no=invoice.invoice_no,
                    source_type=request.source_type,
                    source_document_id=slip.id if slip else order.id,
                    allocated_lines=len(existing_allocations),
                    allocated_quantity=sum(
                        (Decimal(str(row.allocated_quantity)) for row in existing_allocations),
                        Decimal("0"),
                    ),
                )

            terminal_statuses = {"CANCELLED", "CLOSED", "REJECTED"}
            order_status = str(order.status or "").strip().upper()
            if order_status in terminal_statuses:
                raise HTTPException(status_code=409, detail=f"Sales Order is {order_status.lower()} and cannot be billed.")
            if slip and str(slip.status or "").upper() not in {"PACKED", "PARTIALLY_BILLED"}:
                raise HTTPException(status_code=409, detail=f"Packing Slip is {slip.status.lower()} and cannot be billed.")
            if not slip:
                existing_slips = await self.session.execute(
                    select(PackingSlip).where(
                        PackingSlip.company_id == self.tenant_ctx.company_id,
                        PackingSlip.branch_id == self.tenant_ctx.branch_id,
                        PackingSlip.order_id == order.id,
                        PackingSlip.is_deleted.is_(False),
                    ).with_for_update()
                )
                if existing_slips.scalars().first():
                    raise HTTPException(
                        status_code=409,
                        detail="This Sales Order has Packing Slips. Bill through the eligible Packing Slip source to avoid duplicate stock movement.",
                    )

            for source_line_id, order_item, slip_item, quantity in source_rows:
                package_billed = (
                    await self._allocated_slip_quantity(slip_item.id)
                    if slip_item
                    else Decimal("0")
                )
                line_preview = await self._line_for_order_item(
                    order,
                    order_item,
                    source_line_id=source_line_id,
                    package_quantity=Decimal(str(slip_item.quantity)) if slip_item else None,
                    package_billed=package_billed,
                )
                if not line_preview.eligible or quantity > line_preview.remaining_quantity:
                    raise HTTPException(
                        status_code=409,
                        detail=f"Requested quantity exceeds remaining billable quantity for source line {source_line_id}.",
                    )

            invoice_line_by_source = {
                (str(item.source_line_type or ""), str(item.source_line_id or "")): item
                for item in invoice.items
                if item.source_line_id
            }
            if len(invoice_line_by_source) != len(source_rows):
                raise HTTPException(status_code=409, detail="Canonical invoice lines do not map one-to-one to selected source lines.")

            allocated_value_total = Decimal("0")
            allocated_quantity_total = Decimal("0")
            for source_line_id, order_item, slip_item, quantity in source_rows:
                source_type = "PACKING_SLIP" if slip_item else "SALES_ORDER"
                invoice_line = invoice_line_by_source.get((source_type, source_line_id))
                if not invoice_line:
                    raise HTTPException(status_code=409, detail="Canonical invoice line is missing its source reference.")
                line_value = Decimal(str(invoice_line.total_amount or 0))
                allocation = SalesSourceInvoiceAllocation(
                    id=f"sia-{uuid.uuid4().hex[:16]}",
                    company_id=self.tenant_ctx.company_id,
                    branch_id=self.tenant_ctx.branch_id,
                    created_by=getattr(self.tenant_ctx, "user_id", None),
                    sales_order_id=order.id,
                    sales_order_item_id=order_item.id,
                    packing_slip_id=slip.id if slip else None,
                    packing_slip_item_id=slip_item.id if slip_item else None,
                    invoice_id=invoice.id,
                    invoice_item_id=invoice_line.id,
                    allocated_quantity=quantity,
                    allocated_value=line_value,
                    reversed_quantity=Decimal("0"),
                    reversed_value=Decimal("0"),
                    status="COMMITTED",
                    idempotency_key=idempotency_key,
                )
                self.session.add(allocation)
                order_item.billed_quantity = Decimal(str(order_item.billed_quantity or 0)) + quantity
                order_item.pending_quantity = max(
                    Decimal("0"),
                    Decimal(str(order_item.quantity or 0)) - order_item.billed_quantity,
                )
                order_item.line_status = "BILLED" if order_item.pending_quantity <= 0 else "PARTIALLY_BILLED"
                order_item.updated_by = getattr(self.tenant_ctx, "user_id", None)
                reservation_result = await self.session.execute(
                    select(SalesOrderReservation)
                    .where(
                        SalesOrderReservation.order_item_id == order_item.id,
                        SalesOrderReservation.company_id == self.tenant_ctx.company_id,
                        SalesOrderReservation.status.in_(("ACTIVE", "PARTIAL")),
                        SalesOrderReservation.is_deleted.is_(False),
                    )
                    .with_for_update()
                )
                reservations = reservation_result.scalars().all()
                remaining_to_consume = quantity
                for reservation in reservations:
                    available_reserved = max(
                        Decimal("0"),
                        Decimal(str(reservation.reserved_quantity or 0))
                        - Decimal(str(reservation.released_quantity or 0))
                        - Decimal(str(reservation.consumed_quantity or 0)),
                    )
                    consumed = min(available_reserved, remaining_to_consume)
                    reservation.consumed_quantity = Decimal(str(reservation.consumed_quantity or 0)) + consumed
                    remaining_to_consume -= consumed
                    reservation.status = "CONSUMED" if (
                        Decimal(str(reservation.consumed_quantity or 0))
                        + Decimal(str(reservation.released_quantity or 0))
                        >= Decimal(str(reservation.reserved_quantity or 0))
                    ) else "PARTIAL"
                    if remaining_to_consume <= 0:
                        break
                allocated_quantity_total += quantity
                allocated_value_total += line_value

            updated_items = list(order_items.values())
            order.billed_qty = sum(
                (Decimal(str(item.billed_quantity or 0)) for item in updated_items),
                Decimal("0"),
            )
            order.pending_qty = max(
                Decimal("0"),
                Decimal(str(order.total_qty or 0)) - order.billed_qty,
            )
            order.billed_value = Decimal(str(order.billed_value or 0)) + allocated_value_total
            order.pending_value = max(
                Decimal("0"),
                Decimal(str(order.grand_total or 0)) - order.billed_value,
            )
            if order.pending_qty <= 0:
                order.fulfillment_status = "FULLY_BILLED"
                order.status = "Completed"
            else:
                order.fulfillment_status = "PARTIALLY_BILLED"
                order.status = "In Progress"

            legacy_allocation = SalesOrderInvoiceAllocation(
                id=f"alloc-{uuid.uuid4().hex[:16]}",
                company_id=self.tenant_ctx.company_id,
                branch_id=self.tenant_ctx.branch_id,
                created_by=getattr(self.tenant_ctx, "user_id", None),
                order_id=order.id,
                order_no=order.order_no,
                po_number=order.po_number or order.order_no,
                invoice_id=invoice.id,
                invoice_no=invoice.invoice_no,
                invoice_date=invoice.date,
                po_quantity=order.total_qty or allocated_quantity_total,
                po_value=order.grand_total or allocated_value_total,
                billed_quantity=allocated_quantity_total,
                billed_value=allocated_value_total,
                pending_quantity=order.pending_qty,
                pending_value=order.pending_value,
                status="FULLY_BILLED" if order.pending_qty <= 0 else "PARTIAL",
                allocation_metadata={"source_type": request.source_type, "source_document_id": slip.id if slip else order.id},
            )
            self.session.add(legacy_allocation)

            if slip:
                all_slip_items_remaining = True
                for slip_item in slip_items.values():
                    order_item = order_items.get(str(slip_item.order_item_id)) if slip_item.order_item_id else None
                    if not order_item:
                        all_slip_items_remaining = False
                        continue
                    line = await self._line_for_order_item(
                        order,
                        order_item,
                        source_line_id=str(slip_item.id),
                        package_quantity=Decimal(str(slip_item.quantity)),
                        package_billed=await self._allocated_slip_quantity(slip_item.id),
                    )
                    if line.remaining_quantity > 0:
                        all_slip_items_remaining = False
                slip.status = "BILLED" if all_slip_items_remaining else "PARTIALLY_BILLED"
                slip.sales_invoice_id = invoice.id

            await self.session.flush()
            from .outbox_service import OutboxService
            await OutboxService.record_event(
                session=self.session,
                target_channel="SALES_POSTING",
                payload={
                    "event_type": "SalesSourceBillingCommittedEvent",
                    "source_type": request.source_type,
                    "source_document_id": slip.id if slip else order.id,
                    "sales_order_id": order.id,
                    "invoice_id": invoice.id,
                    "invoice_no": invoice.invoice_no,
                    "allocated_quantity": str(allocated_quantity_total),
                    "company_id": self.tenant_ctx.company_id,
                    "branch_id": self.tenant_ctx.branch_id,
                },
                correlation_id=idempotency_key,
                event_type="SALES_SOURCE_BILLING_COMMITTED",
                aggregate_type="SALES_SOURCE",
                aggregate_id=slip.id if slip else order.id,
                company_id=self.tenant_ctx.company_id,
                branch_id=self.tenant_ctx.branch_id,
            )
            await self.session.commit()
            return SourceBillingCommitResponse(
                success=True,
                invoice_id=invoice.id,
                invoice_no=invoice.invoice_no,
                source_type=request.source_type,
                source_document_id=slip.id if slip else order.id,
                allocated_lines=len(source_rows),
                allocated_quantity=allocated_quantity_total,
            )
        except Exception:
            await self.session.rollback()
            raise

    async def reverse_invoice_allocations(self, invoice: SalesInvoice) -> None:
        """Restore source availability while preserving committed allocation history."""
        allocation_result = await self.session.execute(
            select(SalesSourceInvoiceAllocation).where(
                SalesSourceInvoiceAllocation.company_id == self.tenant_ctx.company_id,
                SalesSourceInvoiceAllocation.branch_id == self.tenant_ctx.branch_id,
                SalesSourceInvoiceAllocation.invoice_id == invoice.id,
                SalesSourceInvoiceAllocation.status == "COMMITTED",
                SalesSourceInvoiceAllocation.is_deleted.is_(False),
            )
        )
        candidate_allocations = allocation_result.scalars().all()
        if not candidate_allocations:
            return

        slip_ids_to_lock = sorted({row.packing_slip_id for row in candidate_allocations if row.packing_slip_id})
        if slip_ids_to_lock:
            await self.session.execute(
                select(PackingSlip.id)
                .where(
                    PackingSlip.id.in_(slip_ids_to_lock),
                    PackingSlip.company_id == self.tenant_ctx.company_id,
                    PackingSlip.branch_id == self.tenant_ctx.branch_id,
                    PackingSlip.is_deleted.is_(False),
                )
                .order_by(PackingSlip.id)
                .with_for_update()
            )
        order_ids_to_lock = sorted({row.sales_order_id for row in candidate_allocations if row.sales_order_id})
        if order_ids_to_lock:
            await self.session.execute(
                select(SalesOrder.id)
                .where(
                    SalesOrder.id.in_(order_ids_to_lock),
                    SalesOrder.company_id == self.tenant_ctx.company_id,
                    SalesOrder.branch_id == self.tenant_ctx.branch_id,
                    SalesOrder.is_deleted.is_(False),
                )
                .order_by(SalesOrder.id)
                .with_for_update()
            )
            await self.session.execute(
                select(SalesOrderItem.id)
                .where(
                    SalesOrderItem.order_id.in_(order_ids_to_lock),
                    SalesOrderItem.company_id == self.tenant_ctx.company_id,
                    SalesOrderItem.branch_id == self.tenant_ctx.branch_id,
                    SalesOrderItem.is_deleted.is_(False),
                )
                .order_by(SalesOrderItem.id)
                .with_for_update()
            )
        allocation_result = await self.session.execute(
            select(SalesSourceInvoiceAllocation).where(
                SalesSourceInvoiceAllocation.company_id == self.tenant_ctx.company_id,
                SalesSourceInvoiceAllocation.branch_id == self.tenant_ctx.branch_id,
                SalesSourceInvoiceAllocation.invoice_id == invoice.id,
                SalesSourceInvoiceAllocation.status == "COMMITTED",
                SalesSourceInvoiceAllocation.is_deleted.is_(False),
            ).with_for_update()
        )
        allocations = allocation_result.scalars().all()
        if not allocations:
            return

        quantity_by_item: dict[int, Decimal] = {}
        value_by_order: dict[str, Decimal] = {}
        slip_ids: set[str] = set()
        for allocation in allocations:
            quantity_to_reverse = max(
                Decimal("0"),
                Decimal(str(allocation.allocated_quantity or 0))
                - Decimal(str(allocation.reversed_quantity or 0)),
            )
            value_to_reverse = max(
                Decimal("0"),
                Decimal(str(allocation.allocated_value or 0))
                - Decimal(str(allocation.reversed_value or 0)),
            )
            allocation.reversed_quantity = allocation.allocated_quantity
            allocation.reversed_value = allocation.allocated_value
            allocation.status = "REVERSED"
            if allocation.sales_order_item_id:
                item_id = allocation.sales_order_item_id
                quantity_by_item[item_id] = quantity_by_item.get(item_id, Decimal("0")) + quantity_to_reverse
            if allocation.sales_order_id:
                value_by_order[allocation.sales_order_id] = (
                    value_by_order.get(allocation.sales_order_id, Decimal("0")) + value_to_reverse
                )
            if allocation.packing_slip_id:
                slip_ids.add(allocation.packing_slip_id)

        if quantity_by_item:
            item_result = await self.session.execute(
                select(SalesOrderItem).where(
                    SalesOrderItem.id.in_(list(quantity_by_item)),
                    SalesOrderItem.company_id == self.tenant_ctx.company_id,
                    SalesOrderItem.branch_id == self.tenant_ctx.branch_id,
                    SalesOrderItem.is_deleted.is_(False),
                ).with_for_update()
            )
            for item in item_result.scalars().all():
                item.billed_quantity = max(
                    Decimal("0"),
                    Decimal(str(item.billed_quantity or 0)) - quantity_by_item[item.id],
                )
                item.pending_quantity = max(
                    Decimal("0"),
                    Decimal(str(item.quantity or 0)) - item.billed_quantity,
                )
                item.line_status = "PARTIALLY_BILLED" if item.billed_quantity > 0 else "OPEN"

        order_ids = set(value_by_order)
        if order_ids:
            order_result = await self.session.execute(
                select(SalesOrder).where(
                    SalesOrder.id.in_(list(order_ids)),
                    SalesOrder.company_id == self.tenant_ctx.company_id,
                    SalesOrder.branch_id == self.tenant_ctx.branch_id,
                    SalesOrder.is_deleted.is_(False),
                ).with_for_update()
            )
            orders = order_result.scalars().all()
            for order in orders:
                lines_result = await self.session.execute(
                    select(SalesOrderItem).where(
                        SalesOrderItem.order_id == order.id,
                        SalesOrderItem.company_id == self.tenant_ctx.company_id,
                        SalesOrderItem.is_deleted.is_(False),
                    )
                )
                items = lines_result.scalars().all()
                order.billed_qty = sum(
                    (Decimal(str(item.billed_quantity or 0)) for item in items),
                    Decimal("0"),
                )
                order.pending_qty = max(
                    Decimal("0"),
                    Decimal(str(order.total_qty or 0)) - order.billed_qty,
                )
                order.billed_value = max(
                    Decimal("0"),
                    Decimal(str(order.billed_value or 0)) - value_by_order[order.id],
                )
                order.pending_value = max(
                    Decimal("0"),
                    Decimal(str(order.grand_total or 0)) - order.billed_value,
                )
                order.fulfillment_status = "PARTIALLY_BILLED" if order.billed_qty > 0 else "UNFULFILLED"
                if str(order.status or "").upper() in {"COMPLETED", "IN PROGRESS"}:
                    order.status = "In Progress" if order.billed_qty > 0 else "Approved"

        legacy_result = await self.session.execute(
            select(SalesOrderInvoiceAllocation).where(
                SalesOrderInvoiceAllocation.company_id == self.tenant_ctx.company_id,
                SalesOrderInvoiceAllocation.branch_id == self.tenant_ctx.branch_id,
                SalesOrderInvoiceAllocation.invoice_id == invoice.id,
                SalesOrderInvoiceAllocation.is_deleted.is_(False),
            ).with_for_update()
        )
        for legacy_allocation in legacy_result.scalars().all():
            legacy_allocation.status = "REVERSED"

        for slip_id in slip_ids:
            slip_result = await self.session.execute(
                select(PackingSlip).where(
                    PackingSlip.id == slip_id,
                    PackingSlip.company_id == self.tenant_ctx.company_id,
                    PackingSlip.branch_id == self.tenant_ctx.branch_id,
                    PackingSlip.is_deleted.is_(False),
                ).with_for_update()
            )
            slip = slip_result.scalars().first()
            if not slip:
                continue
            slip_lines = (await self.session.execute(
                select(PackingSlipItem).where(
                    PackingSlipItem.packing_slip_id == slip.id,
                    PackingSlipItem.is_deleted.is_(False),
                )
            )).scalars().all()
            all_billed = bool(slip_lines)
            any_billed = False
            for slip_line in slip_lines:
                active_qty = await self._allocated_slip_quantity(slip_line.id)
                any_billed = any_billed or active_qty > 0
                all_billed = all_billed and active_qty >= Decimal(str(slip_line.quantity or 0))
            slip.status = "BILLED" if all_billed else ("PARTIALLY_BILLED" if any_billed else "PACKED")
            latest_allocation = (await self.session.execute(
                select(SalesSourceInvoiceAllocation)
                .where(
                    SalesSourceInvoiceAllocation.packing_slip_id == slip.id,
                    SalesSourceInvoiceAllocation.company_id == self.tenant_ctx.company_id,
                    SalesSourceInvoiceAllocation.branch_id == self.tenant_ctx.branch_id,
                    SalesSourceInvoiceAllocation.status == "COMMITTED",
                    SalesSourceInvoiceAllocation.is_deleted.is_(False),
                )
                .order_by(SalesSourceInvoiceAllocation.created_at.desc())
                .limit(1)
            )).scalars().first()
            slip.sales_invoice_id = latest_allocation.invoice_id if latest_allocation else "UNBILLED"
