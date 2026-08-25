"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.16.0
Created      : 2026-08-23
Modified     : 2026-08-25
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

from typing import Dict, Any, List, Optional
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from ...api.deps import get_company_db, get_current_user
from ...models.auth import User
from ...services.distribution_svc import DistributionService
from ...schemas.distribution import (
    TerritoryCreateReq,
    TerritoryResponse,
    DealerAssignReq,
    DealerAssignResponse,
    RouteCreateReq,
    RouteStopReq,
    RouteResponse,
    RouteStopResponse,
    DistributionOrderCreateReq,
    DistributionOrderResponse,
    LoadingSheetCreateReq,
    LoadingSheetResponse,
    ClaimSubmitReq,
    ClaimReviewReq,
    ClaimResponse,
    SettlementCreateReq,
    SettlementResponse,
)

router = APIRouter()


# ---------------------------------------------------------------------------
# Territories & Dealers
# ---------------------------------------------------------------------------
@router.post("/territories", summary="Create or register distribution territory")
async def create_territory(
    req: TerritoryCreateReq,
    db: AsyncSession = Depends(get_company_db),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    """Registers a geographic distribution territory."""
    terr = await DistributionService.create_territory(
        session=db,
        code=req.code,
        name=req.name,
        region=req.region,
        parent_code=req.parent_code,
    )
    await db.commit()
    return {
        "status": "SUCCESS",
        "territory": {
            "id": terr.id,
            "code": terr.code,
            "name": terr.name,
            "region": terr.region,
        },
    }


@router.post("/dealers/assign", summary="Assign dealer to territory")
async def assign_dealer(
    req: DealerAssignReq,
    db: AsyncSession = Depends(get_company_db),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    """Assigns a dealer or distributor party to a territory with credit limits."""
    assignment = await DistributionService.assign_dealer(
        session=db,
        party_id=req.party_id,
        territory_code=req.territory_code,
        salesman_id=req.salesman_id,
        credit_limit=req.credit_limit,
        credit_days=req.credit_days,
    )
    await db.commit()
    return {
        "status": "SUCCESS",
        "assignment_id": assignment.id,
        "party_id": assignment.party_id,
        "territory_code": assignment.territory_code,
        "credit_limit": float(assignment.credit_limit),
    }


# ---------------------------------------------------------------------------
# Delivery Routes & Stops
# ---------------------------------------------------------------------------
@router.post("/routes", summary="Create delivery route with optional stops")
async def create_route(
    req: RouteCreateReq,
    db: AsyncSession = Depends(get_company_db),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    company_id = getattr(current_user, "company_id", "COMP-001") or "COMP-001"
    user_id = getattr(current_user, "id", None)
    route = await DistributionService.create_route(
        session=db,
        company_id=company_id,
        req=req,
        user_id=user_id,
    )
    return {
        "status": "SUCCESS",
        "route_id": route.id,
        "route_code": route.route_code,
        "name": route.name,
        "territory_code": route.territory_code,
    }


@router.post("/routes/{route_id}/stops", summary="Add stop to delivery route")
async def add_route_stop(
    route_id: str,
    req: RouteStopReq,
    db: AsyncSession = Depends(get_company_db),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    company_id = getattr(current_user, "company_id", "COMP-001") or "COMP-001"
    try:
        stop = await DistributionService.add_route_stop(
            session=db,
            company_id=company_id,
            route_id=route_id,
            req=req,
        )
        return {
            "status": "SUCCESS",
            "stop_id": stop.id,
            "party_id": stop.party_id,
            "stop_sequence": stop.stop_sequence,
        }
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


# ---------------------------------------------------------------------------
# Distribution Orders
# ---------------------------------------------------------------------------
@router.post("/orders", summary="Create distribution order with pricing and GST evaluation")
async def create_distribution_order(
    req: DistributionOrderCreateReq,
    db: AsyncSession = Depends(get_company_db),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    """Creates a Primary or Secondary distribution order with rule snapshots."""
    lines_data = [line.model_dump() for line in req.line_items]
    company_id = getattr(current_user, "company_id", "COMP-001") or "COMP-001"
    try:
        order = await DistributionService.create_distribution_order(
            session=db,
            party_id=req.party_id,
            order_type=req.order_type,
            territory_code=req.territory_code,
            salesman_id=req.salesman_id,
            route_id=req.route_id,
            delivery_route=req.delivery_route,
            line_items_data=lines_data,
            supplier_state=req.supplier_state,
            recipient_state=req.recipient_state,
            price_book_code=req.price_book_code,
            company_id=company_id,
        )
        return {
            "status": "SUCCESS",
            "order_id": order.id,
            "order_no": order.order_no,
            "order_type": order.order_type,
            "taxable_amount": float(order.taxable_amount),
            "tax_total": float(order.tax_total),
            "grand_total": float(order.grand_total),
            "governance_snapshot_id": order.governance_snapshot_id,
            "lines_count": len(order.lines),
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/orders/{order_id}/dispatch", summary="Dispatch distribution order and record stock movement")
async def dispatch_distribution_order(
    order_id: str,
    delivery_challan_no: Optional[str] = None,
    db: AsyncSession = Depends(get_company_db),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    """Dispatches order and posts authoritative outward stock movements."""
    try:
        order = await DistributionService.dispatch_distribution_order(
            session=db,
            order_id=order_id,
            delivery_challan_no=delivery_challan_no,
        )
        return {
            "status": "SUCCESS",
            "order_no": order.order_no,
            "order_status": order.status,
            "delivery_challan_no": order.delivery_challan_no,
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ---------------------------------------------------------------------------
# Loading Sheets
# ---------------------------------------------------------------------------
@router.post("/loading-sheets", summary="Create vehicle loading sheet")
async def create_loading_sheet(
    req: LoadingSheetCreateReq,
    db: AsyncSession = Depends(get_company_db),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    company_id = getattr(current_user, "company_id", "COMP-001") or "COMP-001"
    user_id = getattr(current_user, "id", None)
    try:
        sheet = await DistributionService.create_loading_sheet(
            session=db,
            company_id=company_id,
            req=req,
            user_id=user_id,
        )
        return {
            "status": "SUCCESS",
            "sheet_id": sheet.id,
            "sheet_no": sheet.sheet_no,
            "total_orders_count": sheet.total_orders_count,
            "total_value": float(sheet.total_value),
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ---------------------------------------------------------------------------
# Claims Workflow
# ---------------------------------------------------------------------------
@router.post("/claims", summary="Submit dealer distribution claim")
async def submit_claim(
    req: ClaimSubmitReq,
    db: AsyncSession = Depends(get_company_db),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    company_id = getattr(current_user, "company_id", "COMP-001") or "COMP-001"
    user_id = getattr(current_user, "id", None)
    claim = await DistributionService.submit_claim(
        session=db,
        company_id=company_id,
        req=req,
        user_id=user_id,
    )
    return {
        "status": "SUCCESS",
        "claim_id": claim.id,
        "claim_no": claim.claim_no,
        "claim_type": claim.claim_type,
        "claim_amount": float(claim.claim_amount),
    }


@router.post("/claims/{claim_id}/review", summary="Review and approve/reject claim")
async def review_claim(
    claim_id: str,
    req: ClaimReviewReq,
    db: AsyncSession = Depends(get_company_db),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    company_id = getattr(current_user, "company_id", "COMP-001") or "COMP-001"
    user_id = getattr(current_user, "id", None)
    try:
        claim = await DistributionService.review_claim(
            session=db,
            company_id=company_id,
            claim_id=claim_id,
            req=req,
            user_id=user_id,
        )
        return {
            "status": "SUCCESS",
            "claim_no": claim.claim_no,
            "claim_status": claim.status,
            "approved_amount": float(claim.approved_amount) if claim.approved_amount else 0.0,
            "settlement_credit_note_id": claim.settlement_credit_note_id,
        }
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


# ---------------------------------------------------------------------------
# Route Settlement
# ---------------------------------------------------------------------------
@router.post("/settlements", summary="Settle route trip collection and stock return")
async def settle_route_trip(
    req: SettlementCreateReq,
    db: AsyncSession = Depends(get_company_db),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    company_id = getattr(current_user, "company_id", "COMP-001") or "COMP-001"
    user_id = getattr(current_user, "id", None)
    try:
        settlement = await DistributionService.settle_route_trip(
            session=db,
            company_id=company_id,
            req=req,
            user_id=user_id,
        )
        return {
            "status": "SUCCESS",
            "settlement_id": settlement.id,
            "settlement_no": settlement.settlement_no,
            "total_sales_value": float(settlement.total_sales_value),
            "cash_collected": float(settlement.cash_collected),
            "shortage_excess_amount": float(settlement.shortage_excess_amount),
            "settlement_status": settlement.status,
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
