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

from typing import Dict, Any, List
from fastapi import APIRouter, Depends, HTTPException, Query, Header
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload

from app.api.deps import get_company_db, get_current_user
from app.models.auth import User
from app.models.psv import (
    PSVParty, PSVPartySkuTracking, PSVStockEvent, PSVStockBalance
)
from app.services.psv_projection import PSVProjectionService
from app.schemas.psv import (
    PSVEventProjectionReq,
    PSVVisibilityPolicyCreateReq,
    PSVPartyScopeCreateReq,
    PSVScopedVisibilityResponse,
    PSVPartyResponse,
    PSVSkuTrackingResponse,
)

router = APIRouter(prefix="/psv", tags=["Projected Stock Visibility (PSV)"])


@router.get("/parties", response_model=List[PSVPartyResponse])
async def list_psv_parties(
    session: AsyncSession = Depends(get_company_db),
    current_user: User = Depends(get_current_user),
    company_id: str = Header(default="COMP-001", alias="X-Company-ID"),
) -> List[PSVPartyResponse]:
    """
    F-01 fix: Returns all PSV parties for the requesting company,
    including per-SKU tracking and a 4-day stock/sales history window
    for the velocity chart in PsvTab.
    """
    # 1. Load all parties for this company with sku_tracking eagerly loaded
    party_stmt = (
        select(PSVParty)
        .where(PSVParty.company_id == company_id)
        .options(selectinload(PSVParty.sku_tracking))
        .order_by(PSVParty.name)
    )
    parties = (await session.execute(party_stmt)).scalars().all()

    # 2. Build 4-day history per party from psv_stock_events
    # Group events by (party_id, event_date.date) and bucket into stock/sales
    history_stmt = (
        select(
            PSVStockEvent.psv_party_id,
            func.date_trunc("day", PSVStockEvent.event_date).label("day"),
            func.sum(
                func.case(
                    (PSVStockEvent.movement_type.in_(["SOLD", "SOLD_THROUGH", "OUTWARD_SALE", "POS_SALE"]), PSVStockEvent.quantity),
                    else_=0,
                )
            ).label("sales"),
        )
        .where(
            PSVStockEvent.company_id == company_id,
            PSVStockEvent.psv_party_id.in_([p.id for p in parties]),
            PSVStockEvent.approval_status == "APPROVED",
        )
        .group_by(PSVStockEvent.psv_party_id, func.date_trunc("day", PSVStockEvent.event_date))
        .order_by(PSVStockEvent.psv_party_id, func.date_trunc("day", PSVStockEvent.event_date).desc())
    )
    history_rows = (await session.execute(history_stmt)).all()

    # Group history rows by party_id and take last 4 days
    from collections import defaultdict
    party_history: Dict[str, list] = defaultdict(list)
    for row in history_rows:
        pid = row.psv_party_id
        if len(party_history[pid]) < 4:
            party_history[pid].append({
                "date": row.day.strftime("%d %b") if row.day else "—",
                "sales": float(row.sales or 0),
                "stock": 0,  # populated below from psv_stock_balances
            })

    # 3. Load stock balances per party for current_balance aggregation
    bal_stmt = select(
        PSVStockBalance.psv_party_id,
        func.sum(PSVStockBalance.current_balance).label("total_balance"),
    ).where(
        PSVStockBalance.company_id == company_id,
        PSVStockBalance.psv_party_id.in_([p.id for p in parties]),
    ).group_by(PSVStockBalance.psv_party_id)
    bal_rows = (await session.execute(bal_stmt)).all()
    balance_map: Dict[str, float] = {row.psv_party_id: float(row.total_balance or 0) for row in bal_rows}

    # 4. Build response — stamp current stock_count from balances if available
    result: List[PSVPartyResponse] = []
    for party in parties:
        live_stock = balance_map.get(party.id)
        history = party_history.get(party.id, [])
        # fill stock value into history entries from live balance (approximate)
        for h in history:
            h["stock"] = int(live_stock or party.stock_count)

        sku_list = [
            PSVSkuTrackingResponse.model_validate(s)
            for s in (party.sku_tracking or [])
        ]
        resp = PSVPartyResponse(
            id=party.id,
            company_id=party.company_id,
            host_customer_id=party.host_customer_id,
            delivery_location_id=party.delivery_location_id,
            store_code=party.store_code,
            store_name_snapshot=party.store_name_snapshot,
            stock_model=party.stock_model,
            name=party.name,
            location=party.location,
            stock_count=int(live_stock) if live_stock is not None else party.stock_count,
            sell_through=party.sell_through,
            weeks_of_cover=party.weeks_of_cover,
            capital_locked=party.capital_locked,
            status=party.status,
            sku_tracking=sku_list,
            history=history,
        )
        result.append(resp)
    return result


@router.post("/policies")
async def create_psv_policy(
    req: PSVVisibilityPolicyCreateReq,
    session: AsyncSession = Depends(get_company_db),
    current_user: User = Depends(get_current_user),
    company_id: str = Header(default="COMP-001", alias="X-Company-ID"),
) -> Dict[str, Any]:
    """Creates or updates a PSV visibility policy."""
    pol = await PSVProjectionService.create_visibility_policy(
        session=session,
        company_id=company_id,
        req=req,
    )
    return {
        "status": "SUCCESS",
        "policy_id": pol.id,
        "policy_code": pol.policy_code,
        "name": pol.name,
    }


@router.post("/party-scopes")
async def assign_party_scope(
    req: PSVPartyScopeCreateReq,
    session: AsyncSession = Depends(get_company_db),
    current_user: User = Depends(get_current_user),
    company_id: str = Header(default="COMP-001", alias="X-Company-ID"),
) -> Dict[str, Any]:
    """Binds a party to a specific visibility scope."""
    scope = await PSVProjectionService.assign_party_scope(
        session=session,
        company_id=company_id,
        req=req,
    )
    return {
        "status": "SUCCESS",
        "scope_id": scope.id,
        "party_id": scope.party_id,
        "policy_code": scope.policy_code,
    }


@router.post("/project-event")
async def project_psv_event(
    req: PSVEventProjectionReq,
    session: AsyncSession = Depends(get_company_db),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    """Projects an immutable stock event into the non-authoritative PSV visibility ledger."""
    res = await PSVProjectionService.project_psv_stock_event(
        psv_session=session,
        event_payload=req.model_dump(),
    )
    return res


@router.get("/scoped-balances/{party_id}", response_model=PSVScopedVisibilityResponse)
async def get_scoped_party_visibility(
    party_id: str,
    session: AsyncSession = Depends(get_company_db),
    current_user: User = Depends(get_current_user),
    company_code: str = Header(default="001", alias="X-Company-Code"),
) -> PSVScopedVisibilityResponse:
    """Retrieves projected stock visibility strictly scoped to the requesting party."""
    res = await PSVProjectionService.get_scoped_party_visibility(
        session=session,
        company_code=company_code,
        party_id=party_id,
    )
    return res


@router.patch("/events/{event_id}/approve")
async def approve_psv_event(
    event_id: str,
    session: AsyncSession = Depends(get_company_db),
    current_user: User = Depends(get_current_user),
    company_id: str = Header(default="COMP-001", alias="X-Company-ID"),
) -> Dict[str, Any]:
    """
    F-08: Promotes a PENDING (unapproved) PSV stock event to APPROVED and
    applies the deferred balance delta into psv_stock_balances.

    Role requirement: MANAGER or ADMIN only.
    """
    allowed_roles = {"MANAGER", "ADMIN", "manager", "admin"}
    if getattr(current_user, "role", None) not in allowed_roles and \
       getattr(getattr(current_user, "role", None), "value", None) not in allowed_roles:
        raise HTTPException(
            status_code=403,
            detail="Insufficient permissions. MANAGER or ADMIN role required to approve PSV events.",
        )
    result = await PSVProjectionService.approve_pending_event(
        session=session,
        event_id=event_id,
        company_id=company_id,
        approved_by=str(current_user.id),
    )
    if result.get("status") == "NOT_FOUND":
        raise HTTPException(status_code=404, detail=f"PSV event '{event_id}' not found.")
    if result.get("status") == "ALREADY_APPROVED":
        raise HTTPException(status_code=409, detail=f"PSV event '{event_id}' is already approved.")
    return result
