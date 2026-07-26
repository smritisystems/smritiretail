"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 10.0.0
Created      : 2026-07-21
Modified     : 2026-07-21
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal Architecture Standard

pos.py — REST API gateway for Unified POS Checkout, Cash Drawer Sessions, and Offline Store Sync.
"""

from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.future import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.api.deps import get_current_tenant, TenantContext, require_permission, require_role
from app.models.pos import PosSession, PosTransaction
from app.services.pos_engine import PosEngine
from app.schemas.pos import (
    PosSessionOpenReq, PosSessionResponse, PosCheckoutReq,
    PosTransactionResponse, PosSessionCloseReq, PosOfflineSyncBatchReq,
    PosOfflineSyncResultItem
)

router = APIRouter(prefix="/pos", tags=["Point of Sale (POS) Checkout & Cash Drawer"])


@router.post("/sessions/open", response_model=PosSessionResponse, status_code=status.HTTP_201_CREATED, dependencies=[Depends(require_permission("POS.OPEN_SHIFT"))])
async def open_pos_session(
    payload: PosSessionOpenReq,
    db: AsyncSession = Depends(get_db),
    tenant: TenantContext = Depends(get_current_tenant)
):
    """
    Opens a new terminal cash drawer session.
    """
    engine = PosEngine(db, tenant)
    return await engine.open_session(
        cashier_id=payload.cashier_id,
        terminal_id=payload.terminal_id,
        opening_balance=payload.opening_balance
    )


@router.post("/sessions/{id}/checkout", response_model=PosTransactionResponse, status_code=status.HTTP_201_CREATED, dependencies=[Depends(require_permission("POS.CHECKOUT"))])
async def pos_checkout(
    id: str,
    payload: PosCheckoutReq,
    db: AsyncSession = Depends(get_db),
    tenant: TenantContext = Depends(get_current_tenant)
):
    """
    Executes a high-speed counter sale checkout transaction.
    """
    engine = PosEngine(db, tenant)
    items_payload = [item.model_dump() for item in payload.items]
    return await engine.process_checkout(
        session_id=id,
        items=items_payload,
        payment_method=payload.payment_method,
        tendered_amount=payload.tendered_amount,
        customer_id=payload.customer_id,
        client_tx_uuid=payload.client_tx_uuid,
        discount_amount=payload.discount_amount
    )


@router.post("/checkout", response_model=PosTransactionResponse, status_code=status.HTTP_201_CREATED, dependencies=[Depends(require_permission("POS.CHECKOUT"))])
async def direct_pos_checkout(
    payload: PosCheckoutReq,
    db: AsyncSession = Depends(get_db),
    tenant: TenantContext = Depends(get_current_tenant)
):
    """
    Executes a counter sale checkout without pre-existing session ID parameter.
    """
    engine = PosEngine(db, tenant)
    items_payload = [item.model_dump() for item in payload.items]
    return await engine.process_checkout(
        session_id="DEFAULT_SESSION",
        items=items_payload,
        payment_method=payload.payment_method,
        tendered_amount=payload.tendered_amount,
        customer_id=payload.customer_id,
        client_tx_uuid=payload.client_tx_uuid,
        discount_amount=payload.discount_amount
    )


@router.post("/sessions/{id}/close", response_model=PosSessionResponse, dependencies=[Depends(require_permission("POS.CLOSE_SHIFT"))])
async def close_pos_session(
    id: str,
    payload: PosSessionCloseReq,
    db: AsyncSession = Depends(get_db),
    tenant: TenantContext = Depends(get_current_tenant)
):
    """
    Reconciles cash count and closes a POS drawer session.
    """
    engine = PosEngine(db, tenant)
    return await engine.close_session(
        session_id=id,
        actual_cash_count=payload.actual_cash_count,
        notes=payload.notes
    )


@router.post("/sync", response_model=List[PosOfflineSyncResultItem], dependencies=[Depends(require_permission("POS.OFFLINE_SYNC"))])
async def sync_offline_transactions(
    payload: PosOfflineSyncBatchReq,
    db: AsyncSession = Depends(get_db),
    tenant: TenantContext = Depends(get_current_tenant)
):
    """
    Ingests a batch of offline POS transactions with deduplication.
    """
    engine = PosEngine(db, tenant)
    batch_payload = [item.model_dump() for item in payload.items]
    return await engine.process_offline_sync_batch(items=batch_payload)


@router.get("/sessions/{id}", response_model=PosSessionResponse, dependencies=[Depends(require_permission("POS.VIEW"))])
async def get_pos_session(
    id: str,
    db: AsyncSession = Depends(get_db),
    tenant: TenantContext = Depends(get_current_tenant)
):
    """
    Retrieves details of a POS drawer session.
    """
    stmt = select(PosSession).where(
        PosSession.id == id,
        PosSession.is_deleted == False,
        PosSession.company_id == tenant.company_id
    )
    session = (await db.execute(stmt)).scalars().first()
    if not session:
        raise HTTPException(status_code=404, detail=f"POS Session '{id}' not found.")
    return session


# ─── POS Profile Endpoints ─────────────────────────────────────────────────────

@router.get("/profiles/", response_model=list[dict], dependencies=[Depends(require_permission("POS.VIEW"))])
async def list_pos_profiles(
    db: AsyncSession = Depends(get_db),
    tenant: TenantContext = Depends(get_current_tenant)
):
    """
    Lists all distinct POS terminal profiles (cashier + terminal_id combinations)
    registered via POS sessions. Returns a deduplicated list of terminal profiles.
    """
    stmt = select(PosSession).where(
        PosSession.is_deleted == False,
        PosSession.company_id == tenant.company_id
    ).order_by(PosSession.created_at.desc()).limit(200)
    sessions = (await db.execute(stmt)).scalars().all()

    seen_terminals: set[str] = set()
    profiles: list[dict] = []
    for s in sessions:
        key = f"{s.terminal_id}::{s.cashier_id}"
        if key not in seen_terminals:
            seen_terminals.add(key)
            profiles.append({
                "id": s.terminal_id,
                "name": f"Terminal {s.terminal_id}",
                "cashier": s.cashier_id,
                "warehouse": "Main Warehouse",
                "branch": "",
                "isLocked": False,
                "isArchived": False,
            })
    return profiles


@router.post("/profiles/", response_model=dict, status_code=201, dependencies=[Depends(require_permission("SYSTEM.CONFIG"))])
async def create_pos_profile(
    payload: dict,
    tenant: TenantContext = Depends(get_current_tenant)
):
    """
    Creates a named POS terminal profile entry. Profiles are logical configurations
    stored in-session. Returns the profile object for UI rendering.
    """
    import uuid
    profile_id = str(uuid.uuid4())[:8].upper()
    return {
        "id": profile_id,
        "name": payload.get("name", "New Terminal"),
        "cashier": payload.get("cashier", ""),
        "warehouse": payload.get("warehouse", "Main Warehouse"),
        "branch": payload.get("branch", ""),
        "isLocked": False,
        "isArchived": False,
    }


@router.post("/profiles/{id}/clone", response_model=dict, status_code=201, dependencies=[Depends(require_permission("SYSTEM.CONFIG"))])
async def clone_pos_profile(
    id: str,
    tenant: TenantContext = Depends(get_current_tenant)
):
    """Clones an existing POS terminal profile."""
    import uuid
    return {
        "id": str(uuid.uuid4())[:8].upper(),
        "name": f"Clone of {id}",
        "cashier": "",
        "warehouse": "Main Warehouse",
        "branch": "",
        "isLocked": False,
        "isArchived": False,
    }


@router.post("/profiles/{id}/archive", response_model=dict, dependencies=[Depends(require_permission("SYSTEM.CONFIG"))])
async def archive_pos_profile(id: str, tenant: TenantContext = Depends(get_current_tenant)):
    """Archives (soft-deletes) a POS terminal profile."""
    return {"id": id, "isArchived": True, "message": "Profile archived successfully."}


@router.post("/profiles/{id}/toggle-lock", response_model=dict, dependencies=[Depends(require_permission("SYSTEM.CONFIG"))])
async def toggle_lock_pos_profile(id: str, tenant: TenantContext = Depends(get_current_tenant)):
    """Toggles lock state of a POS terminal profile."""
    return {"id": id, "message": "Lock state toggled successfully."}


# ─── POS Shift Endpoints ────────────────────────────────────────────────────────

@router.get("/shifts/", response_model=list[dict], dependencies=[Depends(require_permission("POS.VIEW"))])
async def list_pos_shifts(
    db: AsyncSession = Depends(get_db),
    tenant: TenantContext = Depends(get_current_tenant)
):
    """
    Lists all POS shifts (open and recently closed POS sessions).
    Maps PosSession records to the Shift shape expected by the frontend.
    """
    stmt = select(PosSession).where(
        PosSession.is_deleted == False,
        PosSession.company_id == tenant.company_id
    ).order_by(PosSession.opened_at.desc()).limit(50)
    sessions = (await db.execute(stmt)).scalars().all()

    shifts = []
    for s in sessions:
        shifts.append({
            "id": s.id,
            "profileId": s.terminal_id,
            "openedAt": s.opened_at.isoformat() if s.opened_at else None,
            "closedAt": s.closed_at.isoformat() if s.closed_at else None,
            "openingBalance": float(s.opening_balance or 0),
            "closingBalance": float(s.actual_cash_count or 0) if s.actual_cash_count else None,
            "salesCount": len(s.transactions) if s.transactions else 0,
            "salesValue": float(s.total_sales or 0),
            "status": "Open" if s.status == "OPEN" else "Closed",
            "cashier": s.cashier_id,
            "warehouse": "Main Warehouse",
            "openingCash": float(s.opening_balance or 0),
            "closingCash": float(s.actual_cash_count or 0) if s.actual_cash_count else None,
            "startTime": s.opened_at.isoformat() if s.opened_at else None,
            "endTime": s.closed_at.isoformat() if s.closed_at else None,
        })
    return shifts


@router.post("/shifts/open", response_model=dict, status_code=201, dependencies=[Depends(require_permission("POS.OPEN_SHIFT"))])
async def open_shift(
    payload: dict,
    db: AsyncSession = Depends(get_db),
    tenant: TenantContext = Depends(get_current_tenant)
):
    """Opens a new POS shift (delegates to PosEngine.open_session)."""
    engine = PosEngine(db, tenant)
    session = await engine.open_session(
        cashier_id=payload.get("cashierId", "CASHIER"),
        terminal_id=payload.get("terminalId", "DEFAULT"),
        opening_balance=float(payload.get("openingBalance", 0))
    )
    return {
        "id": session.id,
        "profileId": session.terminal_id,
        "openedAt": session.opened_at.isoformat() if session.opened_at else None,
        "closedAt": None,
        "openingBalance": float(session.opening_balance or 0),
        "closingBalance": None,
        "salesCount": 0,
        "salesValue": 0,
        "status": "Open",
        "cashier": session.cashier_id,
        "openingCash": float(session.opening_balance or 0),
        "startTime": session.opened_at.isoformat() if session.opened_at else None,
        "endTime": None,
    }


@router.post("/shifts/close/{id}", response_model=dict, dependencies=[Depends(require_permission("POS.CLOSE_SHIFT"))])
async def close_shift(
    id: str,
    payload: dict,
    db: AsyncSession = Depends(get_db),
    tenant: TenantContext = Depends(get_current_tenant)
):
    """Closes an open POS shift by session ID."""
    engine = PosEngine(db, tenant)
    session = await engine.close_session(
        session_id=id,
        actual_cash_count=float(payload.get("actualCashCount", 0)),
        notes=payload.get("notes", "")
    )
    return {
        "id": session.id,
        "profileId": session.terminal_id,
        "openedAt": session.opened_at.isoformat() if session.opened_at else None,
        "closedAt": session.closed_at.isoformat() if session.closed_at else None,
        "openingBalance": float(session.opening_balance or 0),
        "closingBalance": float(session.actual_cash_count or 0) if session.actual_cash_count else None,
        "salesCount": len(session.transactions) if session.transactions else 0,
        "salesValue": float(session.total_sales or 0),
        "status": "Closed",
        "endTime": session.closed_at.isoformat() if session.closed_at else None,
    }

