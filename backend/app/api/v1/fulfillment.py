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

from ...api.deps import get_company_db, get_current_user, get_tenant_context, TenantContext
from ...repositories.customer import CustomerRepository
from ...services.fulfillment_engine import FulfillmentEngine
from ...schemas.fulfillment import (
    PackingSlipCreateRequest,
    PackingSlipResponse,
    ConsolidatedPreviewRequest,
    ConsolidatedPreviewResponse,
    ConsolidatedFinalizeRequest,
    ConsolidatedFinalizeResponse,
    DispatchCreateRequest,
    DispatchResponse,
    DeliveryStatusUpdateRequest,
    DeliveryTrackingResponse,
    ReverseLogisticsCreateRequest,
    ReverseLogisticsResponse,
    FulfillmentTimelineResponse,
)

router = APIRouter()


def _extract_user_info(current_user: Any, tenant_ctx: TenantContext) -> Tuple[str, str]:
    if isinstance(current_user, dict):
        comp_id = tenant_ctx.company_id
        user_id = current_user.get("sub", "usr-system")
    else:
        comp_id = tenant_ctx.company_id
        user_id = getattr(current_user, "id", None) or getattr(current_user, "username", "usr-system")
    return comp_id, user_id


# ============================================================================
# PACKING SLIP & CONSOLIDATED BILLING ENDPOINTS
# ============================================================================

@router.get("/pack", response_model=List[PackingSlipResponse], summary="List Packing Slips")
@router.get("/packing-slips", response_model=List[PackingSlipResponse], summary="List Packing Slips (Canonical)")
async def list_packing_slips(
    customer_id: Optional[str] = Query(None, description="Filter by exact invoice customer ID"),
    status: Optional[str] = Query(None, description="Status filter: PACKED, BILLED, CANCELLED, ALL"),
    search: Optional[str] = Query(None, description="Search by number or invoice/order reference"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_company_db),
    current_user: Any = Depends(get_current_user),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """Lists packing slips for company tenant."""
    company_id, _ = _extract_user_info(current_user, tenant_ctx)
    if customer_id and await CustomerRepository(db, tenant_ctx).get_billing_visible_id(customer_id) is None:
        raise HTTPException(status_code=404, detail="Customer not found or unavailable for billing.")
    return await FulfillmentEngine.list_packing_slips(
        session=db,
        company_id=company_id,
        customer_id=customer_id,
        branch_id=tenant_ctx.branch_id,
        status=status,
        search=search,
        limit=limit,
        offset=offset,
    )


@router.post("/pack", response_model=PackingSlipResponse, status_code=status.HTTP_201_CREATED, summary="Create Order Pick & Pack Slip")
async def create_packing_slip(
    req: PackingSlipCreateRequest,
    db: AsyncSession = Depends(get_company_db),
    current_user: Any = Depends(get_current_user),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """Creates a pick & pack slip linking item quantities to a sales invoice."""
    try:
        company_id, user_id = _extract_user_info(current_user, tenant_ctx)
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
@router.get("/packing-slips/{packing_slip_id}", response_model=PackingSlipResponse, summary="Get Packing Slip Details (Canonical)")
async def get_packing_slip(
    packing_slip_id: str,
    db: AsyncSession = Depends(get_company_db),
    current_user: Any = Depends(get_current_user),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """Fetches details of a packing slip."""
    company_id, _ = _extract_user_info(current_user, tenant_ctx)
    ps = await FulfillmentEngine.get_packing_slip(db, company_id, packing_slip_id)
    if not ps:
        raise HTTPException(status_code=404, detail="Packing slip not found")
    return ps


@router.post("/consolidated-preview", response_model=ConsolidatedPreviewResponse, summary="Preview B2B Consolidated Invoicing")
async def preview_consolidated_billing(
    req: ConsolidatedPreviewRequest,
    db: AsyncSession = Depends(get_company_db),
    current_user: Any = Depends(get_current_user),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """
    Validates multiple packing slips for B2B consolidated invoicing.
    Enforces customer compatibility, single-tenant context, and 6-quantity integrity.
    """
    try:
        company_id, _ = _extract_user_info(current_user, tenant_ctx)
        return await FulfillmentEngine.preview_consolidated_billing(
            session=db,
            company_id=company_id,
            packing_slip_ids=req.packing_slip_ids,
        )
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/consolidated-finalize", response_model=ConsolidatedFinalizeResponse, summary="Finalize B2B Consolidated Billing")
async def finalize_consolidated_billing(
    req: ConsolidatedFinalizeRequest,
    db: AsyncSession = Depends(get_company_db),
    current_user: Any = Depends(get_current_user),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """
    Marks source packing slips as BILLED and records the posted invoice reference.
    """
    try:
        company_id, _ = _extract_user_info(current_user, tenant_ctx)
        return await FulfillmentEngine.finalize_consolidated_billing(
            session=db,
            company_id=company_id,
            req=req,
        )
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# DISPATCH & TRACKING ENDPOINTS
# ============================================================================

@router.post("/dispatch", response_model=DispatchResponse, status_code=status.HTTP_201_CREATED, summary="Create Dispatch Manifest")
async def create_dispatch(
    req: DispatchCreateRequest,
    db: AsyncSession = Depends(get_company_db),
    current_user: Any = Depends(get_current_user),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """Creates a dispatch manifest assigning courier partner, tracking AWB, and driver commissions."""
    try:
        company_id, user_id = _extract_user_info(current_user, tenant_ctx)
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
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """Updates delivery milestone status and automatically settles driver commissions upon delivery."""
    try:
        company_id, user_id = _extract_user_info(current_user, tenant_ctx)
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
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """Fetches live delivery status using tracking number."""
    company_id, _ = _extract_user_info(current_user, tenant_ctx)
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
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """Processes return manifests and reverses driver/participant commission allocations."""
    try:
        company_id, user_id = _extract_user_info(current_user, tenant_ctx)
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
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """Aggregates the complete pick, pack, dispatch, delivery, and return timeline for an invoice."""
    company_id, _ = _extract_user_info(current_user, tenant_ctx)
    return await FulfillmentEngine.get_fulfillment_timeline(db, company_id, invoice_id)
