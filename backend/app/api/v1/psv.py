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
from sqlalchemy import select, func, case, cast, Date, and_
from sqlalchemy.orm import selectinload

from app.api.deps import get_company_db, get_current_user, get_tenant_context, TenantContext
from app.models.auth import User
from app.models.psv import (
    PSVParty, PSVPartySkuTracking, PSVStockEvent, PSVStockBalance
)
from app.models.inventory import Product
from app.models.crm import Customer, CustomerDeliveryLocation
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

    location_stmt = (
        select(
            PSVParty.id,
            CustomerDeliveryLocation.city,
            CustomerDeliveryLocation.state,
        )
        .join(
            CustomerDeliveryLocation,
            and_(
                CustomerDeliveryLocation.id == PSVParty.delivery_location_id,
                CustomerDeliveryLocation.customer_id == PSVParty.host_customer_id,
                CustomerDeliveryLocation.is_deleted == False,
            ),
        )
        .join(
            Customer,
            and_(
                Customer.id == CustomerDeliveryLocation.customer_id,
                Customer.company_id == effective_company_id,
                Customer.is_deleted == False,
            ),
        )
        .where(
            PSVParty.company_id == effective_company_id,
            PSVParty.id.in_([party.id for party in parties]),
        )
    )
    location_rows = (await session.execute(location_stmt)).all()
    party_location = {
        row.id: {"city": row.city, "state": row.state}
        for row in location_rows
    }

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

    # 3. Load per-SKU projected balances; these drive store/article/dimension views.
    balance_stmt = (
        select(PSVStockBalance, Product)
        .outerjoin(
            Product,
            and_(
                Product.id == PSVStockBalance.product_id,
                Product.company_id == effective_company_id,
                Product.is_deleted == False,
            ),
        )
        .where(
            PSVStockBalance.company_id == effective_company_id,
            PSVStockBalance.psv_party_id.in_([p.id for p in parties]),
        )
    )
    balance_rows = (await session.execute(balance_stmt)).all()
    balance_map: Dict[str, float] = defaultdict(float)
    balance_tracking: Dict[str, List[PSVSkuTrackingResponse]] = defaultdict(list)
    for balance, product in balance_rows:
        balance_map[balance.psv_party_id] += float(balance.current_balance or 0)
        balance_tracking[balance.psv_party_id].append(
            PSVSkuTrackingResponse(
                id=balance.id,
                party_id=balance.psv_party_id,
                sku=balance.sku,
                invoiced_qty=int(balance.billed_qty or 0),
                confirmed_sold_qty=int(balance.sold_qty or 0),
                returned_qty=int(balance.returned_qty or 0),
                product_name=(product.name if product else None) or balance.sku,
                current_balance=balance.current_balance or 0,
                billed_qty=balance.billed_qty or 0,
                received_qty=balance.received_qty or 0,
                sold_qty=balance.sold_qty or 0,
                returned_stock_qty=balance.returned_qty or 0,
                transferred_qty=balance.transferred_qty or 0,
                style_code=product.style_code if product else None,
                color=product.color if product else None,
                size=product.size if product else None,
                category=product.category if product else None,
            )
        )

    # 4. Build response — stamp current stock_count from balances if available
    result: List[PSVPartyResponse] = []
    for party in parties:
        live_stock = balance_map.get(party.id)
        history = party_history.get(party.id, [])
        # fill stock value into history entries from live balance (approximate)
        for h in history:
            h["stock"] = int(live_stock if live_stock is not None else party.stock_count)

        # Prefer the live projected ledger. Legacy tracking remains a fallback for
        # older parties that have not yet produced per-SKU balance rows.
        sku_list = balance_tracking.get(party.id, [])
        if not sku_list:
            sku_list = []
            for tracking in party.sku_tracking or []:
                response_tracking = PSVSkuTrackingResponse.model_validate(tracking)
                response_tracking = response_tracking.model_copy(update={
                    "product_name": tracking.product.name if tracking.product else tracking.sku,
                    "current_balance": max(
                        0,
                        (tracking.invoiced_qty or 0)
                        - (tracking.confirmed_sold_qty or 0)
                        - (tracking.returned_qty or 0),
                    ),
                    "billed_qty": tracking.invoiced_qty or 0,
                    "sold_qty": tracking.confirmed_sold_qty or 0,
                    "returned_stock_qty": tracking.returned_qty or 0,
                })
                if tracking.product:
                    response_tracking = response_tracking.model_copy(update={
                        "style_code": tracking.product.style_code,
                        "color": tracking.product.color,
                        "size": tracking.product.size,
                        "category": tracking.product.category,
                    })
                sku_list.append(response_tracking)
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
            city=party_location.get(party.id, {}).get("city"),
            state=party_location.get(party.id, {}).get("state"),
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
      - A registered barcode is mandatory when available; without one, the exact invoice SKU must be confirmed.
      - Barcode counts are validated against the invoice item, retained as audit evidence, and must equal accepted plus rejected quantity.
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
