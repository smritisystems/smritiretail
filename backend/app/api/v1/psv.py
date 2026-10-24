"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.16.1
Created      : 2026-08-25
Modified     : 2026-10-17
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

from typing import Dict, Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Header
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, case, cast, Date
from sqlalchemy.orm import selectinload

from app.api.deps import get_company_db, get_current_user, get_tenant_context, TenantContext
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
    PSVStoreResolutionReq,
    PSVStoreResolutionResp,
    PSVQuantityReconciliationResponse,
    PSVReceiveInvoiceReq,
    PSVReceiveInvoiceResp,
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
    effective_company_id = session.info.get("company_id") or current_user.company_id or company_id or "COMP-001"
    # 1. Load all parties for this company with sku_tracking eagerly loaded
    party_stmt = (
        select(PSVParty)
        .where(PSVParty.company_id == effective_company_id)
        .options(selectinload(PSVParty.sku_tracking))
        .order_by(PSVParty.name)
    )
    parties = (await session.execute(party_stmt)).scalars().all()
    if not parties:
        return []

    # 2. Build 4-day history per party from psv_stock_events
    # Group events by (party_id, event_date.date) and bucket into stock/sales
    history_stmt = (
        select(
            PSVStockEvent.psv_party_id,
            cast(PSVStockEvent.event_date, Date).label("day"),
            func.sum(
                case(
                    (PSVStockEvent.movement_type.in_(["SOLD", "SOLD_THROUGH", "OUTWARD_SALE", "POS_SALE"]), PSVStockEvent.quantity),
                    else_=0,
                )
            ).label("sales"),
        )
        .where(
            PSVStockEvent.company_id == effective_company_id,
            PSVStockEvent.psv_party_id.in_([p.id for p in parties]),
            PSVStockEvent.approval_status == "APPROVED",
        )
        .group_by(PSVStockEvent.psv_party_id, cast(PSVStockEvent.event_date, Date))
        .order_by(PSVStockEvent.psv_party_id, cast(PSVStockEvent.event_date, Date).desc())
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
        PSVStockBalance.company_id == effective_company_id,
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
        current_stock = int(live_stock) if live_stock is not None else int(party.stock_count or 0)
        current_st = float(party.sell_through or 0.0)
        current_woc = float(party.weeks_of_cover or 0.0)
        current_cap = float(party.capital_locked or 0.0)
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
            stock_count=current_stock,
            sell_through=party.sell_through,
            weeks_of_cover=party.weeks_of_cover,
            capital_locked=party.capital_locked,
            stockCount=current_stock,
            sellThrough=current_st,
            weeksOfCover=current_woc,
            capitalLocked=current_cap,
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


@router.post("/resolve-store-party", response_model=PSVStoreResolutionResp)
async def resolve_store_party(
    req: PSVStoreResolutionReq,
    session: AsyncSession = Depends(get_company_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
    current_user: User = Depends(get_current_user),
) -> PSVStoreResolutionResp:
    """
    Resolves or provisions a Party Stock Visibility (PSV) account from a validated
    customer delivery location / store code idempotently.
    Enforces customer ownership, company boundary, active location status,
    header-tampering protection, and database-level uniqueness. Zero stock movements are created.
    """
    res = await PSVProjectionService.resolve_or_create_store_psv_party(
        session=session,
        company_id=tenant_ctx.company_id,
        delivery_location_id=req.delivery_location_id,
        customer_id=req.customer_id,
    )
    await session.commit()
    return PSVStoreResolutionResp(**res)


@router.get("/reconciliation", response_model=PSVQuantityReconciliationResponse)
async def get_psv_quantity_reconciliation(
    party_id: Optional[str] = Query(None, description="Optional PSV party ID filter"),
    customer_id: Optional[str] = Query(None, description="Optional Customer ID or Code filter"),
    store_code: Optional[str] = Query(None, description="Optional store code or delivery location filter"),
    start_date: Optional[str] = Query(None, description="Optional start date filter (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="Optional end date filter (YYYY-MM-DD)"),
    invoice_id: Optional[str] = Query(None, description="Optional sales invoice ID filter"),
    invoice_no: Optional[str] = Query(None, description="Optional invoice number search string"),
    style_code: Optional[str] = Query(None, description="Optional Article/Style code filter"),
    color: Optional[str] = Query(None, description="Optional variant color filter"),
    size: Optional[str] = Query(None, description="Optional variant size filter"),
    approval_status: Optional[str] = Query(None, description="Optional approval status filter: PENDING | APPROVED"),
    reconciliation_status: Optional[str] = Query(None, description="Optional status filter: RECONCILED | SHORTAGE | EXCESS | PENDING_APPROVAL | UNRECEIVED | HAS_REJECTIONS"),
    has_discrepancy: Optional[bool] = Query(None, description="Filter for items with quantity discrepancies or pending approvals"),
    limit: int = Query(200, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    session: AsyncSession = Depends(get_company_db),
    current_user: User = Depends(get_current_user),
    company_id: str = Header(default="COMP-001", alias="X-Company-ID"),
) -> PSVQuantityReconciliationResponse:
    """
    Authoritative backend quantity reconciliation between Sales Tax Invoices, physical receiving records,
    pending approvals, and stock ledger.
    
    Returns item-level:
      - Document Qty (from Sales Tax Invoice)
      - Received Qty (actual physical received quantity)
      - Pending Approval Qty (unapproved goods awaiting review)
      - Approved Qty (accepted physical stock)
      - Short Qty (document qty - received qty)
      - Excess Qty (received qty - document qty)
      - Rejected Qty (quantity rejected on inspection)
      - Canonical attributes: Style/Article Code, Color, Size, SKU
    """
    res = await PSVProjectionService.get_quantity_reconciliation(
        session=session,
        company_id=company_id,
        party_id=party_id,
        customer_id=customer_id,
        store_code=store_code,
        start_date=start_date,
        end_date=end_date,
        invoice_id=invoice_id,
        invoice_no=invoice_no,
        style_code=style_code,
        color=color,
        size=size,
        approval_status=approval_status,
        reconciliation_status=reconciliation_status,
        has_discrepancy=has_discrepancy,
        limit=limit,
        offset=offset,
    )
    return res


@router.post("/receive-invoice", response_model=PSVReceiveInvoiceResp)
async def record_psv_invoice_receipt(
    req: PSVReceiveInvoiceReq,
    session: AsyncSession = Depends(get_company_db),
    current_user: User = Depends(get_current_user),
    company_id: str = Header(default="COMP-001", alias="X-Company-ID"),
) -> PSVReceiveInvoiceResp:
    """
    Records physical goods receipt (and optional inspection rejections) against a Sales Tax Invoice.
    
    Rules:
      - Received quantities default to PENDING approval unless auto_approve=True is requested by a MANAGER/ADMIN.
      - Pending quantities do not inflate available stock.
      - Identifies items using canonical Article/Style Code, Color, Size, or SKU.
    """
    user_role_str = getattr(current_user, "role", "STAFF")
    if hasattr(user_role_str, "value"):
        user_role_str = user_role_str.value
    resp = await PSVProjectionService.record_invoice_receipt(
        session=session,
        company_id=company_id,
        user_id=str(current_user.id),
        user_role=str(user_role_str),
        req=req,
        commit=True,
    )
    return resp


@router.post("/invoices/{invoice_id}/project")
async def project_sales_invoice_to_psv(
    invoice_id: str,
    session: AsyncSession = Depends(get_company_db),
    current_user: User = Depends(get_current_user),
    company_id: str = Header(default="COMP-001", alias="X-Company-ID"),
) -> Dict[str, Any]:
    """
    Explicitly / idempotently projects a Sales Tax Invoice's items into the PSV ledger
    as BILLED_TO_PARTNER movements (Document Qty).
    """
    res = await PSVProjectionService.project_posted_invoice(
        session=session,
        invoice_id=invoice_id,
        company_id=company_id,
    )
    await session.commit()
    return res

