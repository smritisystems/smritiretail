"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 1.0.0
Created      : 2026-08-24
Modified     : 2026-08-24
Copyright    : (c) SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal

Sprint 3 -- Legacy Menu Map API Router

READ-ONLY. No POST/PUT/DELETE/PATCH endpoints.
Write path: scripts/sh9_seed.py (governance boundary -- admin-only).

Endpoints:
  GET /api/v1/legacy-menu-map/stats
      Aggregate migration status summary (dashboard tile)
  GET /api/v1/legacy-menu-map/
      Paginated list with optional filters
  GET /api/v1/legacy-menu-map/{id}
      Single entry by SMRITI id
  GET /api/v1/legacy-menu-map/sh9/{mnu_no}/{menu_opt}
      Lookup by Shoper9 natural key (MnuNo, MenuOpt)
  GET /api/v1/legacy-menu-map/by-workspace/{smriti_menu_id}
      All Shoper entries that map to a given SMRITI workspace

Auth: All endpoints require authenticated user. Stats requires MANAGER+.
"""

import math
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func

from ...api.deps import get_db, get_current_user, require_role
from ...models.auth import User, UserRole
from ...models.legacy_menu_map import LegacyMenuMap
from ...schemas.legacy_menu_map import (
    LegacyMenuItemResponse,
    LegacyMenuSummary,
    LegacyMenuStats,
    LegacyMenuListResponse,
)

router = APIRouter()

VALID_STATUSES = {"MAPPED","MERGED","REPLACED","DEPRECATED","NOT_APPLIC","PENDING"}
VALID_MODULES  = {"SALES","INVENTORY","PURCHASE","FINANCE","REPORTS","CONFIG",
                  "ADMIN","CRM","SYSTEM"}


# ── GET /stats ─────────────────────────────────────────────────────────────────

@router.get(
    "/stats",
    response_model=LegacyMenuStats,
    summary="Legacy migration aggregate statistics",
    description=(
        "Returns aggregate counts by migration_status, module breakdown, "
        "and coverage percentage. Intended for the migration dashboard tile. "
        "Requires MANAGER role or higher."
    ),
)
async def get_legacy_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.MANAGER)),
):
    # Status counts
    status_q = await db.execute(
        select(LegacyMenuMap.migration_status, func.count().label("cnt"))
        .where(LegacyMenuMap.is_deleted == False)
        .group_by(LegacyMenuMap.migration_status)
    )
    status_rows = status_q.all()
    counts = {r.migration_status: r.cnt for r in status_rows}

    total     = sum(counts.values())
    pending   = counts.get("PENDING", 0)
    covered   = total - pending
    pct       = round((covered / total * 100) if total else 0.0, 1)

    # Module breakdown (MAPPED entries only)
    module_q = await db.execute(
        select(LegacyMenuMap.smriti_module, func.count().label("cnt"))
        .where(
            LegacyMenuMap.is_deleted == False,
            LegacyMenuMap.migration_status == "MAPPED",
            LegacyMenuMap.smriti_module.is_not(None),
        )
        .group_by(LegacyMenuMap.smriti_module)
        .order_by(func.count().desc())
    )
    modules = {r.smriti_module: r.cnt for r in module_q.all()}

    # MultiInstance count
    mi_q = await db.execute(
        select(func.count())
        .where(
            LegacyMenuMap.is_deleted == False,
            LegacyMenuMap.sh9_multi_inst == 1,
        )
    )
    mi_count = mi_q.scalar() or 0

    return LegacyMenuStats(
        total       = total,
        mapped      = counts.get("MAPPED",     0),
        merged      = counts.get("MERGED",     0),
        replaced    = counts.get("REPLACED",   0),
        deprecated  = counts.get("DEPRECATED", 0),
        not_applic  = counts.get("NOT_APPLIC", 0),
        pending     = pending,
        coverage_pct= pct,
        modules     = modules,
        multi_instance_count = mi_count,
    )


# ── GET / (paginated list) ─────────────────────────────────────────────────────

@router.get(
    "/",
    response_model=LegacyMenuListResponse,
    summary="List legacy menu entries (paginated)",
)
async def list_legacy_entries(
    status: Optional[str]     = Query(None, description="Filter by migration_status"),
    module: Optional[str]     = Query(None, description="Filter by smriti_module"),
    workspace: Optional[str]  = Query(None, description="Filter by smriti_menu_id"),
    search: Optional[str]     = Query(None, description="Search in sh9_mnu_cap or sh9_mnu_name"),
    multi_inst: Optional[bool]= Query(None, description="Filter entries with MultiInstance=1"),
    page: int  = Query(1, ge=1, description="Page number (1-indexed)"),
    size: int  = Query(50, ge=1, le=200, description="Items per page"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if status and status not in VALID_STATUSES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid status '{status}'. Valid: {sorted(VALID_STATUSES)}"
        )

    q = select(LegacyMenuMap).where(LegacyMenuMap.is_deleted == False)

    if status:
        q = q.where(LegacyMenuMap.migration_status == status)
    if module:
        q = q.where(LegacyMenuMap.smriti_module == module.upper())
    if workspace:
        q = q.where(LegacyMenuMap.smriti_menu_id == workspace)
    if search:
        pattern = f"%{search}%"
        q = q.where(
            LegacyMenuMap.sh9_mnu_cap.ilike(pattern) |
            LegacyMenuMap.sh9_mnu_name.ilike(pattern)
        )
    if multi_inst is True:
        q = q.where(LegacyMenuMap.sh9_multi_inst == 1)
    elif multi_inst is False:
        q = q.where(
            (LegacyMenuMap.sh9_multi_inst == 0) |
            LegacyMenuMap.sh9_multi_inst.is_(None)
        )

    # Count total before pagination
    count_q  = select(func.count()).select_from(q.subquery())
    total_r  = await db.execute(count_q)
    total    = total_r.scalar() or 0

    # Paginate
    offset   = (page - 1) * size
    q        = q.order_by(
        LegacyMenuMap.sh9_mnu_no.asc(),
        LegacyMenuMap.sh9_menu_opt.asc()
    ).offset(offset).limit(size)

    res      = await db.execute(q)
    rows     = res.scalars().all()

    return LegacyMenuListResponse(
        total = total,
        page  = page,
        size  = size,
        pages = math.ceil(total / size) if total else 0,
        items = [LegacyMenuSummary.model_validate(r) for r in rows],
    )


# ── GET /{id} ──────────────────────────────────────────────────────────────────

@router.get(
    "/{entry_id}",
    response_model=LegacyMenuItemResponse,
    summary="Get single legacy entry by SMRITI id",
)
async def get_legacy_entry(
    entry_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = select(LegacyMenuMap).where(
        LegacyMenuMap.id == entry_id,
        LegacyMenuMap.is_deleted == False,
    )
    res = await db.execute(q)
    row = res.scalar_one_or_none()
    if not row:
        raise HTTPException(
            status_code=404,
            detail=f"Legacy menu entry '{entry_id}' not found."
        )
    return LegacyMenuItemResponse.model_validate(row)


# ── GET /sh9/{mnu_no}/{menu_opt} ───────────────────────────────────────────────

@router.get(
    "/sh9/{mnu_no}/{menu_opt}",
    response_model=LegacyMenuItemResponse,
    summary="Lookup by Shoper9 natural key (MnuNo, MenuOpt)",
    description=(
        "Resolve a Shoper9 vaMenu entry to its SMRITI equivalent "
        "using the original MnuNo and MenuOpt keys."
    ),
)
async def get_by_sh9_key(
    mnu_no:   int,
    menu_opt: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = select(LegacyMenuMap).where(
        LegacyMenuMap.sh9_mnu_no   == mnu_no,
        LegacyMenuMap.sh9_menu_opt == menu_opt,
        LegacyMenuMap.is_deleted   == False,
    )
    res = await db.execute(q)
    row = res.scalar_one_or_none()
    if not row:
        raise HTTPException(
            status_code=404,
            detail=(
                f"No mapping found for Shoper9 MnuNo={mnu_no}, MenuOpt={menu_opt}. "
                f"This entry may have been removed in a Shoper patch "
                f"(see SH9_MENU_DELETES.csv) or is not yet classified."
            )
        )
    return LegacyMenuItemResponse.model_validate(row)


# ── GET /by-workspace/{smriti_menu_id} ────────────────────────────────────────

@router.get(
    "/by-workspace/{smriti_menu_id:path}",
    response_model=List[LegacyMenuSummary],
    summary="All Shoper entries mapping to a given SMRITI workspace",
    description=(
        "Returns all legacy Shoper9 actions that map to the specified "
        "SMRITI menu_id (e.g. 'menu-sales', 'menu-inventory'). "
        "Useful for validating that every required Shoper action has a "
        "SMRITI workspace equivalent before decommissioning."
    ),
)
async def get_by_workspace(
    smriti_menu_id: str,
    include_deprecated: bool = Query(
        False, description="Include DEPRECATED and NOT_APPLIC entries"
    ),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = select(LegacyMenuMap).where(
        LegacyMenuMap.smriti_menu_id == smriti_menu_id,
        LegacyMenuMap.is_deleted     == False,
    )
    if not include_deprecated:
        q = q.where(
            LegacyMenuMap.migration_status.not_in(["DEPRECATED","NOT_APPLIC"])
        )
    q = q.order_by(
        LegacyMenuMap.sh9_mnu_no.asc(),
        LegacyMenuMap.sh9_menu_opt.asc()
    )
    res = await db.execute(q)
    rows = res.scalars().all()
    return [LegacyMenuSummary.model_validate(r) for r in rows]
