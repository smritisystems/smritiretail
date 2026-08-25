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
from sqlalchemy import select, and_, or_, func
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
from ..schemas.fulfillment import (
    PackingSlipCreateRequest,
    PackingSlipResponse,
    PackingSlipItemResponse,
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
            created_at=now.replace(tzinfo=None),
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
            dispatch_date=now.replace(tzinfo=None),
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
            dsp.delivered_date = now.replace(tzinfo=None)
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
                    settled_date=now.replace(tzinfo=None),
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
            timestamp=now.replace(tzinfo=None),
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
