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

import traceback
from typing import Dict, Any, List, Optional, Tuple
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from ...api.deps import get_company_db, get_current_user
from ...services.fulfillment_engine import FulfillmentEngine
from ...schemas.fulfillment import (
    PackingSlipCreateRequest,
    PackingSlipResponse,
    DispatchCreateRequest,
    DispatchResponse,
    DeliveryStatusUpdateRequest,
    DeliveryTrackingResponse,
    ReverseLogisticsCreateRequest,
    ReverseLogisticsResponse,
    FulfillmentTimelineResponse,
)

router = APIRouter()


def _extract_user_info(current_user: Any) -> Tuple[str, str]:
    if isinstance(current_user, dict):
        comp_id = current_user.get("company_id", "COMP-001")
        user_id = current_user.get("sub", "usr-system")
    else:
        comp_id = getattr(current_user, "company_id", "COMP-001") or "COMP-001"
        user_id = getattr(current_user, "id", None) or getattr(current_user, "username", "usr-system")
    return comp_id, user_id


# ============================================================================
# PACKING SLIP ENDPOINTS
# ============================================================================

@router.post("/pack", response_model=PackingSlipResponse, status_code=status.HTTP_201_CREATED, summary="Create Order Pick & Pack Slip")
async def create_packing_slip(
    req: PackingSlipCreateRequest,
    db: AsyncSession = Depends(get_company_db),
    current_user: Any = Depends(get_current_user),
):
    """Creates a pick & pack slip linking item quantities to a sales invoice."""
    try:
        company_id, user_id = _extract_user_info(current_user)
        return await FulfillmentEngine.create_packing_slip(
            session=db,
            company_id=company_id,
            req=req,
            created_by=user_id,
        )
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/pack/{packing_slip_id}", response_model=PackingSlipResponse, summary="Get Packing Slip Details")
async def get_packing_slip(
    packing_slip_id: str,
    db: AsyncSession = Depends(get_company_db),
    current_user: Any = Depends(get_current_user),
):
    """Fetches details of a packing slip."""
    company_id, _ = _extract_user_info(current_user)
    ps = await FulfillmentEngine.get_packing_slip(db, company_id, packing_slip_id)
    if not ps:
        raise HTTPException(status_code=404, detail="Packing slip not found")
    return ps


# ============================================================================
# DISPATCH & TRACKING ENDPOINTS
# ============================================================================

@router.post("/dispatch", response_model=DispatchResponse, status_code=status.HTTP_201_CREATED, summary="Create Dispatch Manifest")
async def create_dispatch(
    req: DispatchCreateRequest,
    db: AsyncSession = Depends(get_company_db),
    current_user: Any = Depends(get_current_user),
):
    """Creates a dispatch manifest assigning courier partner, tracking AWB, and driver commissions."""
    try:
        company_id, user_id = _extract_user_info(current_user)
        return await FulfillmentEngine.create_dispatch(
            session=db,
            company_id=company_id,
            req=req,
            created_by=user_id,
        )
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/delivery/status", response_model=DeliveryTrackingResponse, summary="Update Delivery Status Milestone")
async def update_delivery_status(
    req: DeliveryStatusUpdateRequest,
    db: AsyncSession = Depends(get_company_db),
    current_user: Any = Depends(get_current_user),
):
    """Updates delivery milestone status and automatically settles driver commissions upon delivery."""
    try:
        company_id, user_id = _extract_user_info(current_user)
        return await FulfillmentEngine.update_delivery_status(
            session=db,
            company_id=company_id,
            req=req,
            created_by=user_id,
        )
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/tracking/{tracking_number}", response_model=DeliveryTrackingResponse, summary="Track Delivery by AWB")
async def track_delivery(
    tracking_number: str,
    db: AsyncSession = Depends(get_company_db),
    current_user: Any = Depends(get_current_user),
):
    """Fetches live delivery status using tracking number."""
    company_id, _ = _extract_user_info(current_user)
    tracking = await FulfillmentEngine.get_tracking_info(db, company_id, tracking_number)
    if not tracking:
        raise HTTPException(status_code=404, detail="Tracking number not found")
    return tracking


# ============================================================================
# REVERSE LOGISTICS & TIMELINE ENDPOINTS
# ============================================================================

@router.post("/returns", response_model=ReverseLogisticsResponse, status_code=status.HTTP_201_CREATED, summary="Process Reverse Logistics Return")
async def process_returns(
    req: ReverseLogisticsCreateRequest,
    db: AsyncSession = Depends(get_company_db),
    current_user: Any = Depends(get_current_user),
):
    """Processes return manifests and reverses driver/participant commission allocations."""
    try:
        company_id, user_id = _extract_user_info(current_user)
        return await FulfillmentEngine.process_reverse_logistics(
            session=db,
            company_id=company_id,
            req=req,
            created_by=user_id,
        )
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/timeline/{invoice_id}", response_model=FulfillmentTimelineResponse, summary="Get Full Fulfillment Timeline")
async def get_fulfillment_timeline(
    invoice_id: str,
    db: AsyncSession = Depends(get_company_db),
    current_user: Any = Depends(get_current_user),
):
    """Aggregates the complete pick, pack, dispatch, delivery, and return timeline for an invoice."""
    company_id, _ = _extract_user_info(current_user)
    return await FulfillmentEngine.get_fulfillment_timeline(db, company_id, invoice_id)
