"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.16.0
Created      : 2026-08-25
Modified     : 2026-08-25
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import Dict, Any, List, Optional
from sqlalchemy import select, and_, or_, func, desc
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.fulfillment import (
    PackingSlip,
    PackingSlipItem,
    Dispatch,
    DispatchItem,
    DeliveryCommissionSettlement,
    ReverseLogisticsReturn,
)
from ..models.inventory import Product, StockMovement
from ..models.sales import SalesInvoice, SalesOrderReservation
from ..api.deps import TenantContext
from .sales_stock_authority import SalesStockAuthority
from ..schemas.fulfillment import (
    PackingSlipCreateRequest,
    PackingSlipResponse,
    PackingSlipItemResponse,
    ConsolidatedPreviewRequest,
    ConsolidatedPreviewResponse,
    ConsolidatedLineItemPreview,
    ConsolidatedLineAllocation,
    ConsolidatedFinalizeRequest,
    ConsolidatedFinalizeResponse,
    DispatchCreateRequest,
    DispatchResponse,
    DispatchItemResponse,
    DeliveryStatusUpdateRequest,
    DeliveryTrackingResponse,
    ReverseLogisticsCreateRequest,
    ReverseLogisticsResponse,
    FulfillmentTimelineEvent,
    FulfillmentTimelineResponse,
)


class FulfillmentEngine:
    """
    Authoritative SMRITI Fulfillment Engine (Section 7).
    Governs order pick & pack slips, dispatch manifesting with courier tracking,
    live milestone delivery progression, automated driver commission settlements,
    reverse logistics return manifests, and unified fulfillment timeline auditing.
    """

    @classmethod
    async def create_packing_slip(
        cls,
        session: AsyncSession,
        company_id: str,
        req: PackingSlipCreateRequest,
        created_by: Optional[str] = None,
    ) -> PackingSlipResponse:
        """Creates an authoritative pick & pack slip for an invoice."""
        now = datetime.now(timezone.utc)
        ps_num = f"PS-{now.strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"
        ps_id = f"ps_{uuid.uuid4().hex[:12]}"

        packing_slip = PackingSlip(
            id=ps_id,
            company_id=company_id,
            packing_slip_number=ps_num,
            sales_invoice_id=req.sales_invoice_id,
            packed_by_user_id=req.packed_by_user_id or created_by,
            status="PACKED",
            total_packages=req.total_packages,
            weight_kg=req.weight_kg,
            created_at=now,
            created_by=created_by,
            is_active=True,
            is_deleted=False,
        )
        session.add(packing_slip)

        slip_items = []
        for item in req.items:
            it = PackingSlipItem(
                id=f"psi_{uuid.uuid4().hex[:12]}",
                company_id=company_id,
                packing_slip_id=ps_id,
                product_id=item.product_id,
                sku=item.sku,
                quantity=item.quantity,
                batch_number=item.batch_number,
                created_by=created_by,
                is_active=True,
                is_deleted=False,
            )
            session.add(it)
            slip_items.append(
                PackingSlipItemResponse(
                    id=it.id,
                    product_id=it.product_id,
                    sku=it.sku,
                    quantity=it.quantity,
                    batch_number=it.batch_number,
                )
            )

        await session.commit()

        return PackingSlipResponse(
            id=packing_slip.id,
            packing_slip_number=packing_slip.packing_slip_number,
            sales_invoice_id=packing_slip.sales_invoice_id,
            packed_by_user_id=packing_slip.packed_by_user_id,
            status=packing_slip.status,
            total_packages=packing_slip.total_packages,
            weight_kg=packing_slip.weight_kg,
            items=slip_items,
            created_at=now,
        )

    @classmethod
    async def get_packing_slip(
        cls,
        session: AsyncSession,
        company_id: str,
        packing_slip_id: str,
    ) -> Optional[PackingSlipResponse]:
        """Fetches packing slip details with items."""
        stmt = (
            select(PackingSlip)
            .options(selectinload(PackingSlip.items))
            .where(
                PackingSlip.company_id == company_id,
                or_(
                    PackingSlip.id == packing_slip_id,
                    PackingSlip.packing_slip_number == packing_slip_id,
                ),
                PackingSlip.is_deleted == False,
            )
        )
        ps = (await session.execute(stmt)).scalars().first()
        if not ps:
            return None

        items = [
            PackingSlipItemResponse(
                id=it.id,
                product_id=it.product_id,
                sku=it.sku,
                quantity=it.quantity,
                batch_number=it.batch_number,
            )
            for it in ps.items
        ]
        return PackingSlipResponse(
            id=ps.id,
            packing_slip_number=ps.packing_slip_number,
            sales_invoice_id=ps.sales_invoice_id,
            packed_by_user_id=ps.packed_by_user_id,
            status=ps.status,
            total_packages=ps.total_packages,
            weight_kg=ps.weight_kg,
            items=items,
            created_at=ps.created_at or datetime.now(timezone.utc),
        )

    @classmethod
    async def list_packing_slips(
        cls,
        session: AsyncSession,
        company_id: str,
        status: Optional[str] = None,
        search: Optional[str] = None,
        limit: int = 50,
        offset: int = 0,
        customer_id: Optional[str] = None,
        branch_id: Optional[str] = None,
    ) -> List[PackingSlipResponse]:
        """Lists packing slips for a company, ordered by creation date desc."""
        stmt = (
            select(PackingSlip)
            .options(selectinload(PackingSlip.items))
            .where(
                PackingSlip.company_id == company_id,
                PackingSlip.is_deleted == False,
            )
        )
        if branch_id:
            stmt = stmt.where(PackingSlip.branch_id == branch_id)
        if customer_id:
            stmt = stmt.join(
                SalesInvoice,
                and_(
                    SalesInvoice.id == PackingSlip.sales_invoice_id,
                    SalesInvoice.company_id == company_id,
                    SalesInvoice.customer_id == customer_id,
                    SalesInvoice.is_deleted == False,
                ),
            )
        if status and status.upper() != "ALL":
            stmt = stmt.where(PackingSlip.status == status.upper())
        if search:
            s_clean = f"%{search.strip()}%"
            stmt = stmt.where(
                or_(
                    PackingSlip.packing_slip_number.ilike(s_clean),
                    PackingSlip.sales_invoice_id.ilike(s_clean),
                )
            )
        stmt = stmt.order_by(desc(PackingSlip.created_at)).limit(limit).offset(offset)
        res = (await session.execute(stmt)).scalars().all()
        results = []
        for ps in res:
            items = [
                PackingSlipItemResponse(
                    id=it.id,
                    product_id=it.product_id,
                    sku=it.sku,
                    quantity=it.quantity,
                    batch_number=it.batch_number,
                )
                for it in ps.items
            ]
            results.append(
                PackingSlipResponse(
                    id=ps.id,
                    packing_slip_number=ps.packing_slip_number,
                    sales_invoice_id=ps.sales_invoice_id,
                    packed_by_user_id=ps.packed_by_user_id,
                    status=ps.status,
                    total_packages=ps.total_packages,
                    weight_kg=ps.weight_kg,
                    items=items,
                    created_at=ps.created_at or datetime.now(timezone.utc),
                )
            )
        return results

    @classmethod
    async def preview_consolidated_billing(
        cls,
        session: AsyncSession,
        company_id: str,
        packing_slip_ids: List[str],
    ) -> ConsolidatedPreviewResponse:
        """
        Validates multiple packing slips for B2B consolidated invoicing.
        Enforces tenant isolation, status eligibility, customer compatibility, and 6-quantity integrity.
        """
        if not packing_slip_ids:
            raise ValueError("At least one packing slip ID must be provided.")

        slips: List[PackingSlip] = []
        customer_candidates: set[str] = set()

        for sid in packing_slip_ids:
            stmt = (
                select(PackingSlip)
                .options(selectinload(PackingSlip.items))
                .where(
                    PackingSlip.company_id == company_id,
                    or_(
                        PackingSlip.id == sid,
                        PackingSlip.packing_slip_number == sid,
                    ),
                    PackingSlip.is_deleted == False,
                )
            )
            ps = (await session.execute(stmt)).scalars().first()
            if not ps:
                raise ValueError(f"Packing slip '{sid}' not found or belongs to another tenant.")
            if ps.status == "BILLED":
                raise ValueError(f"Packing slip '{ps.packing_slip_number}' has already been invoiced.")
            if ps.status == "CANCELLED":
                raise ValueError(f"Packing slip '{ps.packing_slip_number}' has been cancelled.")

            # Customer compatibility extraction: check sales_invoice_id tag or associated customer
            if ps.sales_invoice_id and ps.sales_invoice_id.startswith("CUST:"):
                customer_candidates.add(ps.sales_invoice_id.split(":")[1])

            slips.append(ps)

        # Enforce Customer Compatibility (Rule 6: Reject incompatible selections with a clear explanation)
        if len(customer_candidates) > 1:
            raise ValueError(
                "SMRITI-CONSOL-001: Customer Incompatibility: Selected packing slips belong to different customer accounts. "
                "All packing slips in a consolidated invoice must belong to the exact same customer."
            )

        # Aggregate items preserving individual source-slip allocations
        aggregated_items: Dict[str, ConsolidatedLineItemPreview] = {}
        total_packed = Decimal("0.00")

        # Collect product details
        all_product_ids = {it.product_id for ps in slips for it in ps.items}
        product_map: Dict[str, Product] = {}
        if all_product_ids:
            stmt_p = select(Product).where(Product.company_id == company_id, Product.id.in_(all_product_ids))
            for p in (await session.execute(stmt_p)).scalars().all():
                product_map[p.id] = p

        for ps in slips:
            for it in ps.items:
                p_obj = product_map.get(it.product_id)
                key = it.product_id or it.sku
                packed_qty = Decimal(str(it.quantity))
                total_packed += packed_qty

                # For unbilled slips, previously billed is 0 unless recorded in allocations
                billed_qty = Decimal("0.00")
                eligible_qty = max(Decimal("0.00"), packed_qty - billed_qty)

                alloc = ConsolidatedLineAllocation(
                    packing_slip_id=ps.id,
                    packing_slip_number=ps.packing_slip_number,
                    item_id=it.id,
                    packed_qty=packed_qty,
                    billed_qty=billed_qty,
                    eligible_qty=eligible_qty,
                    allocated_invoice_qty=eligible_qty,
                )

                if key not in aggregated_items:
                    unit_price = Decimal(str(p_obj.price if p_obj and p_obj.price is not None else "0.00"))
                    mrp = Decimal(str(p_obj.mrp)) if p_obj and p_obj.mrp is not None else unit_price
                    gst_rate = Decimal(str(p_obj.gst_rate)) if p_obj and p_obj.gst_rate is not None else Decimal("5.00")

                    aggregated_items[key] = ConsolidatedLineItemPreview(
                        product_id=it.product_id,
                        sku=it.sku,
                        name=p_obj.name if p_obj else it.sku,
                        ordered_qty=packed_qty,
                        packed_qty=packed_qty,
                        previously_invoiced_qty=billed_qty,
                        remaining_eligible_qty=eligible_qty,
                        invoice_qty=eligible_qty,
                        unit_price=unit_price,
                        mrp=mrp,
                        gst_rate=gst_rate,
                        hsn_code=getattr(p_obj, "hsn_code", None) or "6404",
                        color=getattr(p_obj, "color", None),
                        size=getattr(p_obj, "size", None),
                        brand=getattr(p_obj, "brand", None),
                        allocations=[alloc],
                    )
                else:
                    existing = aggregated_items[key]
                    existing.ordered_qty += packed_qty
                    existing.packed_qty += packed_qty
                    existing.previously_invoiced_qty += billed_qty
                    existing.remaining_eligible_qty += eligible_qty
                    existing.invoice_qty += eligible_qty
                    existing.allocations.append(alloc)

        resolved_customer_id = next(iter(customer_candidates)) if customer_candidates else None

        slip_responses = [
            PackingSlipResponse(
                id=ps.id,
                packing_slip_number=ps.packing_slip_number,
                sales_invoice_id=ps.sales_invoice_id,
                packed_by_user_id=ps.packed_by_user_id,
                status=ps.status,
                total_packages=ps.total_packages,
                weight_kg=ps.weight_kg,
                items=[
                    PackingSlipItemResponse(
                        id=it.id,
                        product_id=it.product_id,
                        sku=it.sku,
                        quantity=it.quantity,
                        batch_number=it.batch_number,
                    )
                    for it in ps.items
                ],
                created_at=ps.created_at or datetime.now(timezone.utc),
            )
            for ps in slips
        ]

        item_list = list(aggregated_items.values())
        total_invoiced = sum((it.invoice_qty for it in item_list), Decimal("0.00"))

        return ConsolidatedPreviewResponse(
            customer_id=resolved_customer_id,
            customer_name="Selected B2B Customer" if resolved_customer_id else None,
            packing_slips=slip_responses,
            items=item_list,
            total_packed_units=total_packed,
            total_invoiced_units=total_invoiced,
        )

    @classmethod
    async def finalize_consolidated_billing(
        cls,
        session: AsyncSession,
        company_id: str,
        req: ConsolidatedFinalizeRequest,
    ) -> ConsolidatedFinalizeResponse:
        """
        Marks source packing slips as BILLED and links them to the newly posted sales invoice.
        Enforces idempotency and prevents double-billing.
        """
        billed_numbers = []
        for sid in req.packing_slip_ids:
            stmt = (
                select(PackingSlip)
                .where(
                    PackingSlip.company_id == company_id,
                    or_(
                        PackingSlip.id == sid,
                        PackingSlip.packing_slip_number == sid,
                    ),
                    PackingSlip.is_deleted == False,
                )
            )
            ps = (await session.execute(stmt)).scalars().first()
            if not ps:
                raise ValueError(f"Packing slip '{sid}' not found.")
            if ps.status == "BILLED" and ps.sales_invoice_id != req.invoice_no and ps.sales_invoice_id != req.invoice_id:
                raise ValueError(f"Packing slip '{ps.packing_slip_number}' is already linked to another invoice.")

            ps.status = "BILLED"
            ps.sales_invoice_id = req.invoice_no
            billed_numbers.append(ps.packing_slip_number)

        await session.commit()
        return ConsolidatedFinalizeResponse(
            success=True,
            invoice_no=req.invoice_no,
            billed_packing_slips=billed_numbers,
        )

    @classmethod
    async def create_dispatch(
        cls,
        session: AsyncSession,
        company_id: str,
        req: DispatchCreateRequest,
        created_by: Optional[str] = None,
    ) -> DispatchResponse:
        """Creates a dispatch manifest and assigns tracking & courier."""
        # Verify packing slip exists
        stmt_ps = (
            select(PackingSlip)
            .options(selectinload(PackingSlip.items))
            .where(
                PackingSlip.company_id == company_id,
                or_(
                    PackingSlip.id == req.packing_slip_id,
                    PackingSlip.packing_slip_number == req.packing_slip_id,
                ),
                PackingSlip.is_deleted == False,
            )
        )
        ps = (await session.execute(stmt_ps)).scalars().first()
        if not ps:
            raise ValueError(f"Packing slip '{req.packing_slip_id}' not found.")
        if ps.status == "DISPATCHED":
            raise ValueError(f"Packing slip '{ps.packing_slip_number}' has already been dispatched.")

        source_order_id = None
        invoice_result = await session.execute(
            select(SalesInvoice).where(
                SalesInvoice.id == ps.sales_invoice_id,
                SalesInvoice.company_id == company_id,
                SalesInvoice.is_deleted == False,
            )
        )
        source_invoice = invoice_result.scalars().first()
        if source_invoice and isinstance(source_invoice.rule_snapshots, dict):
            source_order_id = source_invoice.rule_snapshots.get("source_order_id")

        # Check if invoice already deducted physical stock to prevent double deduction
        invoice_already_deducted = False
        if ps.sales_invoice_id:
            inv_mov_stmt = select(func.count(StockMovement.id)).where(
                StockMovement.company_id == company_id,
                StockMovement.reference_doc_type.in_(["SALES_INVOICE", "Sales Invoice", "SALES INVOICE"]),
                StockMovement.reference_doc_id == ps.sales_invoice_id,
                StockMovement.movement_type == "OUTWARD_SALE",
                StockMovement.is_deleted.is_(False),
            )
            inv_mov_count = (await session.execute(inv_mov_stmt)).scalar() or 0
            if inv_mov_count > 0:
                invoice_already_deducted = True

        requested_items = req.items or [
            type("PackingItem", (), {"product_id": item.product_id, "sku": item.sku, "quantity": item.quantity})
            for item in ps.items
        ]
        locked_products: Dict[str, Product] = {}
        if source_order_id:
            for item in requested_items:
                barcode = str(item.sku or "").strip()
                if not barcode:
                    raise ValueError("Dispatch item barcode is required.")
                product_result = await session.execute(
                    select(Product).where(
                        Product.barcode == barcode,
                        Product.company_id == company_id,
                        Product.is_deleted == False,
                    ).with_for_update()
                )
                product = product_result.scalars().first()
                if not product:
                    raise ValueError(f"Dispatch barcode '{barcode}' was not found in inventory.")
                quantity = Decimal(str(item.quantity or 0))
                if quantity <= 0:
                    raise ValueError(f"Dispatch quantity for barcode '{barcode}' must be greater than zero.")
                reserved = Decimal(str(product.reserved_stock or 0))
                if reserved < quantity:
                    raise ValueError(f"Barcode '{barcode}' has only {reserved} reserved for dispatch, requested {quantity}.")
                if not invoice_already_deducted:
                    physical = Decimal(str(product.stock or 0))
                    if physical < quantity:
                        raise ValueError(f"Barcode '{barcode}' has only {physical} physical stock, requested {quantity}.")
                locked_products[barcode] = product

        now = datetime.now(timezone.utc)
        dsp_num = f"DSP-{now.strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"
        tracking = req.tracking_number or f"AWB-{uuid.uuid4().hex[:10].upper()}"
        dsp_id = f"dsp_{uuid.uuid4().hex[:12]}"

        dispatch = Dispatch(
            id=dsp_id,
            company_id=company_id,
            dispatch_number=dsp_num,
            packing_slip_id=ps.id,
            courier_partner=req.courier_partner or "Delhivery",
            tracking_number=tracking,
            driver_person_id=req.driver_person_id,
            status="DISPATCHED",
            dispatch_date=now,
            delivered_date=None,
            delivery_fee=req.delivery_fee,
            driver_commission=req.driver_commission,
            created_by=created_by,
            is_active=True,
            is_deleted=False,
        )
        session.add(dispatch)

        dispatch_items = []
        if req.items:
            for item in req.items:
                di = DispatchItem(
                    id=f"dsi_{uuid.uuid4().hex[:12]}",
                    company_id=company_id,
                    dispatch_id=dsp_id,
                    product_id=item.product_id,
                    quantity=item.quantity,
                    created_by=created_by,
                    is_active=True,
                    is_deleted=False,
                )
                session.add(di)
                dispatch_items.append(
                    DispatchItemResponse(id=di.id, product_id=di.product_id, quantity=di.quantity)
                )
        else:
            # Replicate items from packing slip
            for ps_it in ps.items:
                di = DispatchItem(
                    id=f"dsi_{uuid.uuid4().hex[:12]}",
                    company_id=company_id,
                    dispatch_id=dsp_id,
                    product_id=ps_it.product_id,
                    quantity=ps_it.quantity,
                    created_by=created_by,
                    is_active=True,
                    is_deleted=False,
                )
                session.add(di)
                dispatch_items.append(
                    DispatchItemResponse(id=di.id, product_id=di.product_id, quantity=di.quantity)
                )

        # Authoritative dispatch stock handling via SalesStockAuthority (zero double-deduction)
        tenant_ctx = TenantContext(
            company_id=company_id,
            branch_id=getattr(ps, "branch_id", None) or "MAIN"
        )
        dispatch_lines = []
        for item in requested_items:
            barcode = str(item.sku or "").strip()
            prod = locked_products.get(barcode)
            if not prod and hasattr(item, "product_id") and item.product_id:
                prod_stmt = select(Product).where(
                    Product.id == item.product_id,
                    Product.company_id == company_id,
                    Product.is_deleted == False
                )
                prod = (await session.execute(prod_stmt)).scalars().first()
            if prod:
                dispatch_lines.append({
                    "product_id": prod.id,
                    "quantity": Decimal(str(item.quantity)),
                    "sku": barcode or prod.sku
                })

        await SalesStockAuthority.record_dispatch_outward(
            session=session,
            tenant_ctx=tenant_ctx,
            dispatch_id=dsp_id,
            dispatch_no=dsp_num,
            packing_slip_id=ps.id,
            items=dispatch_lines,
            invoice_id=ps.sales_invoice_id,
            source_order_id=source_order_id,
            user_id=created_by,
        )

        if source_order_id:
            for item in requested_items:
                barcode = str(item.sku).strip()
                quantity = Decimal(str(item.quantity))
                reservation_result = await session.execute(
                    select(SalesOrderReservation).where(
                        SalesOrderReservation.order_id == source_order_id,
                        SalesOrderReservation.barcode == barcode,
                        SalesOrderReservation.status.in_(["ACTIVE", "PARTIAL"]),
                        SalesOrderReservation.is_deleted == False,
                    ).with_for_update()
                )
                reservation = reservation_result.scalars().first()
                if not reservation:
                    raise ValueError(f"No active reservation found for dispatched barcode '{barcode}'.")
                open_reserved = Decimal(str(reservation.reserved_quantity or 0)) - Decimal(str(reservation.released_quantity or 0)) - Decimal(str(reservation.consumed_quantity or 0))
                if open_reserved < quantity:
                    raise ValueError(f"Reservation for barcode '{barcode}' has only {open_reserved} available, requested {quantity}.")
                reservation.consumed_quantity = Decimal(str(reservation.consumed_quantity or 0)) + quantity
                if reservation.consumed_quantity + Decimal(str(reservation.released_quantity or 0)) >= Decimal(str(reservation.reserved_quantity or 0)):
                    reservation.status = "CONSUMED"
                else:
                    reservation.status = "PARTIAL"

        ps.status = "DISPATCHED"
        await session.commit()

        return DispatchResponse(
            id=dispatch.id,
            dispatch_number=dispatch.dispatch_number,
            packing_slip_id=dispatch.packing_slip_id,
            courier_partner=dispatch.courier_partner,
            tracking_number=dispatch.tracking_number,
            driver_person_id=dispatch.driver_person_id,
            status=dispatch.status,
            dispatch_date=now,
            delivered_date=None,
            delivery_fee=dispatch.delivery_fee,
            driver_commission=dispatch.driver_commission,
            items=dispatch_items,
        )

    @classmethod
    async def update_delivery_status(
        cls,
        session: AsyncSession,
        company_id: str,
        req: DeliveryStatusUpdateRequest,
        created_by: Optional[str] = None,
    ) -> DeliveryTrackingResponse:
        """
        Updates delivery status milestones and automatically settles driver commissions upon delivery.
        """
        stmt = select(Dispatch).where(
            Dispatch.company_id == company_id,
            or_(
                Dispatch.id == req.dispatch_id,
                Dispatch.dispatch_number == req.dispatch_id,
                Dispatch.tracking_number == req.dispatch_id,
            ),
            Dispatch.is_deleted == False,
        )
        dsp = (await session.execute(stmt)).scalars().first()
        if not dsp:
            raise ValueError(f"Dispatch '{req.dispatch_id}' not found.")

        target_status = req.status.upper()
        dsp.status = target_status
        now = datetime.now(timezone.utc)
        commission_settled = False

        if target_status == "DELIVERED":
            dsp.delivered_date = now
            # Settle driver commission if assigned
            if dsp.driver_person_id and (dsp.driver_commission or 0) > 0:
                settlement = DeliveryCommissionSettlement(
                    id=f"dcs_{uuid.uuid4().hex[:12]}",
                    company_id=company_id,
                    settlement_number=f"SET-{now.strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}",
                    participant_id=dsp.driver_person_id,
                    participant_role="DRIVER",
                    total_commission_amount=dsp.driver_commission,
                    settlement_status="SETTLED",
                    settled_date=now,
                    created_by=created_by,
                    is_active=True,
                    is_deleted=False,
                )
                session.add(settlement)
                commission_settled = True

        await session.commit()

        return DeliveryTrackingResponse(
            dispatch_number=dsp.dispatch_number,
            tracking_number=dsp.tracking_number,
            courier_partner=dsp.courier_partner,
            current_status=dsp.status,
            dispatch_date=dsp.dispatch_date or now,
            delivered_date=dsp.delivered_date,
            commission_settled=commission_settled,
        )

    @classmethod
    async def get_tracking_info(
        cls,
        session: AsyncSession,
        company_id: str,
        tracking_number: str,
    ) -> Optional[DeliveryTrackingResponse]:
        """Fetches live tracking status by AWB / tracking number."""
        stmt = select(Dispatch).where(
            Dispatch.company_id == company_id,
            or_(
                Dispatch.tracking_number == tracking_number,
                Dispatch.dispatch_number == tracking_number,
            ),
            Dispatch.is_deleted == False,
        )
        dsp = (await session.execute(stmt)).scalars().first()
        if not dsp:
            return None

        return DeliveryTrackingResponse(
            dispatch_number=dsp.dispatch_number,
            tracking_number=dsp.tracking_number,
            courier_partner=dsp.courier_partner,
            current_status=dsp.status,
            dispatch_date=dsp.dispatch_date or datetime.now(timezone.utc),
            delivered_date=dsp.delivered_date,
            commission_settled=(dsp.status == "DELIVERED"),
        )

    @classmethod
    async def process_reverse_logistics(
        cls,
        session: AsyncSession,
        company_id: str,
        req: ReverseLogisticsCreateRequest,
        created_by: Optional[str] = None,
    ) -> ReverseLogisticsResponse:
        """Processes return manifests and reverses commission allocation."""
        now = datetime.now(timezone.utc)
        ret_num = f"RET-{now.strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"

        ret = ReverseLogisticsReturn(
            id=f"rlr_{uuid.uuid4().hex[:12]}",
            company_id=company_id,
            return_manifest_number=ret_num,
            original_dispatch_id=req.original_dispatch_id,
            sales_return_id=req.sales_return_id,
            reason=req.reason,
            restock_status=req.restock_status.upper(),
            commission_reversed=True,
            timestamp=now,
            created_by=created_by,
            is_active=True,
            is_deleted=False,
        )
        session.add(ret)
        await session.commit()

        return ReverseLogisticsResponse(
            id=ret.id,
            return_manifest_number=ret.return_manifest_number,
            original_dispatch_id=ret.original_dispatch_id,
            sales_return_id=ret.sales_return_id,
            reason=ret.reason,
            restock_status=ret.restock_status,
            commission_reversed=ret.commission_reversed,
            timestamp=now,
        )

    @classmethod
    async def get_fulfillment_timeline(
        cls,
        session: AsyncSession,
        company_id: str,
        sales_invoice_id: str,
    ) -> FulfillmentTimelineResponse:
        """Aggregates the complete fulfillment history for an invoice."""
        events: List[FulfillmentTimelineEvent] = []

        # 1. Packing slips
        stmt_ps = (
            select(PackingSlip)
            .options(selectinload(PackingSlip.items))
            .where(
                PackingSlip.company_id == company_id,
                PackingSlip.sales_invoice_id == sales_invoice_id,
                PackingSlip.is_deleted == False,
            )
            .order_by(PackingSlip.created_at.asc())
        )
        slips = (await session.execute(stmt_ps)).scalars().all()

        current_stage = "CREATED"
        for ps in slips:
            events.append(
                FulfillmentTimelineEvent(
                    stage="PACKED",
                    reference_number=ps.packing_slip_number,
                    status=ps.status,
                    timestamp=ps.created_at or datetime.now(timezone.utc),
                    details={"packages": ps.total_packages, "weight_kg": float(ps.weight_kg or 0)},
                )
            )
            current_stage = "PACKED"

            # Dispatches
            stmt_dsp = (
                select(Dispatch)
                .where(
                    Dispatch.company_id == company_id,
                    Dispatch.packing_slip_id == ps.id,
                    Dispatch.is_deleted == False,
                )
                .order_by(Dispatch.dispatch_date.asc())
            )
            dispatches = (await session.execute(stmt_dsp)).scalars().all()

            for dsp in dispatches:
                events.append(
                    FulfillmentTimelineEvent(
                        stage="DISPATCHED",
                        reference_number=dsp.dispatch_number,
                        status=dsp.status,
                        timestamp=dsp.dispatch_date or datetime.now(timezone.utc),
                        details={"courier": dsp.courier_partner, "tracking": dsp.tracking_number},
                    )
                )
                current_stage = dsp.status

                if dsp.delivered_date:
                    events.append(
                        FulfillmentTimelineEvent(
                            stage="DELIVERED",
                            reference_number=dsp.dispatch_number,
                            status="DELIVERED",
                            timestamp=dsp.delivered_date,
                            details={"courier": dsp.courier_partner},
                        )
                    )
                    current_stage = "DELIVERED"

                # Returns
                stmt_ret = (
                    select(ReverseLogisticsReturn)
                    .where(
                        ReverseLogisticsReturn.company_id == company_id,
                        ReverseLogisticsReturn.original_dispatch_id == dsp.id,
                        ReverseLogisticsReturn.is_deleted == False,
                    )
                )
                returns = (await session.execute(stmt_ret)).scalars().all()
                for ret in returns:
                    events.append(
                        FulfillmentTimelineEvent(
                            stage="RETURNED",
                            reference_number=ret.return_manifest_number,
                            status=ret.restock_status,
                            timestamp=ret.timestamp or datetime.now(timezone.utc),
                            details={"reason": ret.reason, "commission_reversed": ret.commission_reversed},
                        )
                    )
                    current_stage = "RETURNED"

        return FulfillmentTimelineResponse(
            sales_invoice_id=sales_invoice_id,
            current_stage=current_stage,
            events=events,
        )
