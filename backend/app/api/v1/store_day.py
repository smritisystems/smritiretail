"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.122.0
Created      : 2026-10-27
Copyright    : (c) SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal

EOD Phase 3 - Store Business-Day API
=====================================
Routes:
  POST  /pos/store-days/open                   Open a new store business day
  POST  /pos/store-days/{id}/close             Close an open store business day
  POST  /pos/store-days/{id}/lock              Lock a closed store business day
  POST  /pos/store-days/{id}/assign-shift      Assign a cashier shift to the day
  GET   /pos/store-days/{id}/eod-report        Cross-shift EOD aggregation report
  GET   /audit/employee-activity               Employee activity timeline
"""
from datetime import date as DateType
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from ...api.deps import (
    get_company_db,
    get_tenant_context,
    require_role,
    TenantContext,
    get_current_user,
)
from ...models.auth import UserRole, User
from ...services.store_day_svc import StoreDayService

router = APIRouter()


# ---------------------------------------------------------------------------
# Pydantic schemas
# ---------------------------------------------------------------------------

class StoreDayOpenRequest(BaseModel):
    branch_id: str
    business_date: DateType
    opened_by: Optional[str] = None


class StoreDayCloseRequest(BaseModel):
    sign_off_notes: Optional[str] = None
    force: bool = False


class StoreDayAssignShiftRequest(BaseModel):
    shift_id: str


# ---------------------------------------------------------------------------
# Store-day lifecycle
# ---------------------------------------------------------------------------

@router.post(
    "/pos/store-days/open",
    summary="Open Store Business Day",
    tags=["EOD"],
)
async def open_store_day(
    req: StoreDayOpenRequest,
    current_user: User = Depends(require_role(UserRole.MANAGER, UserRole.SYSADMIN)),
    db: AsyncSession = Depends(get_company_db),
    tenant: TenantContext = Depends(get_tenant_context),
):
    """Open a new store business day for a branch. One OPEN day per branch at a time."""
    svc = StoreDayService(db, tenant)
    try:
        day = await svc.open_store_day(
            branch_id=req.branch_id,
            business_date=req.business_date,
            opened_by=req.opened_by or current_user.id,
        )
        await db.commit()
        return {
            "id": day.id,
            "branch_id": day.branch_id,
            "business_date": day.business_date.isoformat(),
            "status": day.status,
            "opened_at": day.opened_at.isoformat(),
            "opened_by": day.opened_by,
        }
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))


@router.post(
    "/pos/store-days/{store_day_id}/close",
    summary="Close Store Business Day",
    tags=["EOD"],
)
async def close_store_day(
    store_day_id: str,
    req: StoreDayCloseRequest,
    current_user: User = Depends(require_role(UserRole.MANAGER, UserRole.SYSADMIN)),
    db: AsyncSession = Depends(get_company_db),
    tenant: TenantContext = Depends(get_tenant_context),
):
    """
    Close an OPEN store business day.
    Blocked by pending approvals or pending offline sync unless force=True (SYSADMIN).
    """
    if req.force and current_user.role not in (UserRole.SYSADMIN,):
        raise HTTPException(status_code=403, detail="Force-close requires SYSADMIN role.")
    svc = StoreDayService(db, tenant)
    try:
        day = await svc.close_store_day(
            store_day_id=store_day_id,
            closed_by=current_user.id,
            sign_off_notes=req.sign_off_notes,
            force=req.force,
        )
        await db.commit()
        return {
            "id": day.id,
            "branch_id": day.branch_id,
            "business_date": day.business_date.isoformat(),
            "status": day.status,
            "closed_at": day.closed_at.isoformat() if day.closed_at else None,
            "closed_by": day.closed_by,
            "sign_off_notes": day.sign_off_notes,
            "exception_summary": day.exception_summary_json,
        }
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))


@router.post(
    "/pos/store-days/{store_day_id}/lock",
    summary="Lock Store Business Day",
    tags=["EOD"],
)
async def lock_store_day(
    store_day_id: str,
    current_user: User = Depends(require_role(UserRole.MANAGER, UserRole.SYSADMIN)),
    db: AsyncSession = Depends(get_company_db),
    tenant: TenantContext = Depends(get_tenant_context),
):
    """Lock a CLOSED store business day. Final sign-off. Cannot be reopened."""
    svc = StoreDayService(db, tenant)
    try:
        day = await svc.lock_store_day(
            store_day_id=store_day_id,
            locked_by=current_user.id,
        )
        await db.commit()
        return {
            "id": day.id,
            "status": day.status,
            "locked_at": day.locked_at.isoformat() if day.locked_at else None,
            "locked_by": day.locked_by,
        }
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))


@router.post(
    "/pos/store-days/{store_day_id}/assign-shift",
    summary="Assign Shift to Store Day",
    tags=["EOD"],
)
async def assign_shift_to_day(
    store_day_id: str,
    req: StoreDayAssignShiftRequest,
    current_user: User = Depends(require_role(UserRole.MANAGER, UserRole.SYSADMIN)),
    db: AsyncSession = Depends(get_company_db),
    tenant: TenantContext = Depends(get_tenant_context),
):
    """Link a cashier shift to an open store business day."""
    svc = StoreDayService(db, tenant)
    try:
        assignment = await svc.assign_shift_to_day(
            store_day_id=store_day_id,
            shift_id=req.shift_id,
            assigned_by=current_user.id,
        )
        await db.commit()
        return {
            "id": assignment.id,
            "store_day_id": assignment.store_day_id,
            "shift_id": assignment.shift_id,
            "assigned_at": assignment.assigned_at.isoformat(),
        }
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))


# ---------------------------------------------------------------------------
# EOD Aggregation Report
# ---------------------------------------------------------------------------

@router.get(
    "/pos/store-days/{store_day_id}/eod-report",
    summary="Cross-Shift EOD Aggregation Report",
    tags=["EOD"],
)
async def get_eod_report(
    store_day_id: str,
    current_user: User = Depends(require_role(UserRole.MANAGER, UserRole.SYSADMIN)),
    db: AsyncSession = Depends(get_company_db),
    tenant: TenantContext = Depends(get_tenant_context),
):
    """
    Cross-shift EOD aggregation report.
    All figures computed at query time from authoritative ledger tables.
    No shadow aggregation tables used.
    """
    svc = StoreDayService(db, tenant)
    try:
        return await svc.get_eod_report(store_day_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


# ---------------------------------------------------------------------------
# Employee Activity Timeline
# ---------------------------------------------------------------------------

@router.get(
    "/audit/employee-activity",
    summary="Employee Activity Timeline",
    tags=["EOD", "Audit"],
)
async def get_employee_activity(
    branch_id: str = Query(..., description="Branch/store ID"),
    business_date: DateType = Query(..., description="Business date YYYY-MM-DD"),
    actor_id: Optional[str] = Query(None, description="Filter by actor/employee ID"),
    limit: int = Query(200, ge=1, le=500),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(require_role(UserRole.MANAGER, UserRole.SYSADMIN)),
    db: AsyncSession = Depends(get_company_db),
    tenant: TenantContext = Depends(get_tenant_context),
):
    """
    Employee activity timeline from compliance_immutable_audit_logs.
    Null actors display as 'Unknown / not recorded'.
    """
    svc = StoreDayService(db, tenant)
    return await svc.get_employee_activity(
        branch_id=branch_id,
        business_date=business_date,
        actor_id=actor_id,
        limit=limit,
        offset=offset,
    )
