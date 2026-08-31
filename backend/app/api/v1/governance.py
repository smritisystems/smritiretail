"""
Project      : SMRITI Retail OS
Repository   : SMRITIRetailNX
Organization : AITDL NETWORKS

Founders

* Pushpa Devi Jawahar Mallah -- Founder & Chairperson
* Jawahar Ramkripal Mallah   -- Founder, CEO & Chief Software Architect
* Websites: aitdl.com | erpnbook.com | smritibooks.com

* Version    : 3.28.0
* Created    : 2026-08-24
* Modified   : 2026-08-24
* Copyright  : (c) AITDL.com and SMRITIBooks.com. All Rights Reserved.
* License    : Proprietary Commercial Software

Sprint 8c -- Governance Masters parity.
System Parameters, Year-End, Reopen-Day, Data-Rebuild, Archive, Promotions.
Shoper9 EXE refs: SR426400, SR123000, SR428100, SR333100, SR320800, SR329700, SR430300.
"""

from datetime import datetime, timezone, date
from decimal import Decimal
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, Query, Body, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import text, func

from ...api.deps import (
    get_company_db, get_tenant_context, get_current_user,
    TenantContext, require_role,
)
from ...models.system import SystemConfig  # system_configs table

router = APIRouter(prefix="/governance")

# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------

ADMIN_ROLES = ["SYSADMIN", "ADMIN"]

def _require_admin(current_user):
    role = getattr(current_user, "role", None) or getattr(current_user, "user_role", "")
    if role not in ADMIN_ROLES:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="SMRITI-PERM-001: This operation requires ADMIN or SYSADMIN role."
        )


# ---------------------------------------------------------------------------
# GOV-001: System Parameters  (Shoper9: SR426400.EXE MnuNo 720/721)
# GET  /api/v1/governance/system-params
# PUT  /api/v1/governance/system-params
# ---------------------------------------------------------------------------

@router.get("/system-params")
async def get_system_params(
    category: Optional[str] = Query(default=None, description="Filter by category"),
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_company_db),
    current_user=Depends(get_current_user),
):
    """
    GOV-001 -- System Parameters read (Shoper9: SR426400.EXE MnuNo 720/721).
    Returns all active system configuration key-value pairs.
    """
    stmt = select(SystemConfig).where(SystemConfig.is_deleted == False)
    if category:
        stmt = stmt.where(SystemConfig.category.ilike(f"%{category}%"))
    if tenant and tenant.company_id:
        stmt = stmt.where(
            (SystemConfig.company_id == tenant.company_id) |
            (SystemConfig.company_id.is_(None))
        )
    configs = (await db.execute(stmt.order_by(SystemConfig.category, SystemConfig.key))).scalars().all()
    return {
        "total": len(configs),
        "params": [
            {
                "key":        c.key,
                "value":      c.value,
                "category":   getattr(c, "category", None),
                "is_active":  getattr(c, "is_active", True),
                "version":    getattr(c, "version", None),
            }
            for c in configs
        ],
    }


@router.put("/system-params")
async def update_system_param(
    key:      str = Body(..., description="Configuration key"),
    value:    Any = Body(..., description="New value"),
    category: Optional[str] = Body(default=None),
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_company_db),
    current_user=Depends(get_current_user),
):
    """
    GOV-001 -- System Parameter write (Shoper9: SR426400.EXE MnuNo 720/721).
    Upserts a single system configuration key-value pair.
    Requires ADMIN or SYSADMIN role.
    """
    _require_admin(current_user)
    stmt = select(SystemConfig).where(
        SystemConfig.key == key,
        SystemConfig.is_deleted == False,
    )
    if tenant and tenant.company_id:
        stmt = stmt.where(
            (SystemConfig.company_id == tenant.company_id) |
            (SystemConfig.company_id.is_(None))
        )
    existing = (await db.execute(stmt)).scalar_one_or_none()
    if existing:
        existing.value = value
        if category:
            existing.category = category
        existing.updated_by = getattr(current_user, "username", "system")
        existing.modified_at = datetime.now(timezone.utc)
        db.add(existing)
    else:
        new_cfg = SystemConfig(
            key=key, value=value, category=category,
            company_id=tenant.company_id if tenant else None,
            created_by=getattr(current_user, "username", "system"),
            is_active=True, is_deleted=False,
        )
        db.add(new_cfg)
    await db.commit()
    return {"status": "ok", "key": key, "value": value}


# ---------------------------------------------------------------------------
# GOV-002: Stock Number Methodology  (Shoper9: SR123000.EXE MnuNo 720/723)
# GET  /api/v1/governance/stock-number-method
# PUT  /api/v1/governance/stock-number-method
# ---------------------------------------------------------------------------

STOCK_METHOD_KEY = "STOCK_NUMBER_METHODOLOGY"

@router.get("/stock-number-method")
async def get_stock_number_method(
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_company_db),
    current_user=Depends(get_current_user),
):
    """
    GOV-002 -- Stock Number Methodology (Shoper9: SR123000.EXE MnuNo 720/723).
    Returns the current stock numbering scheme (AUTO / MANUAL / BARCODE / EAN13).
    """
    res = (await db.execute(
        select(SystemConfig).where(
            SystemConfig.key == STOCK_METHOD_KEY,
            SystemConfig.is_deleted == False,
        )
    )).scalar_one_or_none()
    method = (res.value if res else None) or "AUTO"
    return {
        "key":     STOCK_METHOD_KEY,
        "method":  method,
        "allowed": ["AUTO", "MANUAL", "BARCODE", "EAN13", "CUSTOM"],
        "description": "Defines how stock/item numbers are assigned at product creation.",
    }


@router.put("/stock-number-method")
async def set_stock_number_method(
    method: str = Body(..., description="AUTO | MANUAL | BARCODE | EAN13 | CUSTOM"),
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_company_db),
    current_user=Depends(get_current_user),
):
    """
    GOV-002 -- Set Stock Number Methodology (Shoper9: SR123000.EXE MnuNo 720/723).
    Requires ADMIN or SYSADMIN role.
    """
    _require_admin(current_user)
    allowed = {"AUTO", "MANUAL", "BARCODE", "EAN13", "CUSTOM"}
    if method.upper() not in allowed:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"SMRITI-VAL-001: method must be one of {sorted(allowed)}"
        )
    res = (await db.execute(
        select(SystemConfig).where(SystemConfig.key == STOCK_METHOD_KEY)
    )).scalar_one_or_none()
    if res:
        res.value = method.upper()
        res.updated_by = getattr(current_user, "username", "system")
        res.modified_at = datetime.now(timezone.utc)
        db.add(res)
    else:
        db.add(SystemConfig(
            key=STOCK_METHOD_KEY, value=method.upper(), category="Inventory",
            company_id=tenant.company_id if tenant else None,
            created_by=getattr(current_user, "username", "system"),
            is_active=True, is_deleted=False,
        ))
    await db.commit()
    return {"status": "ok", "method": method.upper()}


# ---------------------------------------------------------------------------
# GOV-003: Year End Process  (Shoper9: SR428100.EXE MnuNo 750/758)
# POST /api/v1/governance/year-end
# ---------------------------------------------------------------------------

@router.post("/year-end")
async def run_year_end(
    fiscal_year: str = Body(..., description="Fiscal year label e.g. FY2026-27"),
    confirm:     bool = Body(..., description="Must be true to execute"),
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_company_db),
    current_user=Depends(get_current_user),
):
    """
    GOV-003 -- Year End Process (Shoper9: SR428100.EXE MnuNo 750/758).
    Marks the fiscal year as closed and records the closure audit event.
    Actual stock snapshot and balance carry-forward are performed by the
    Alembic-managed accounting close job; this endpoint records the intent
    and creates the governance log entry.
    Requires SYSADMIN role.
    """
    role = getattr(current_user, "role", None) or getattr(current_user, "user_role", "")
    if role != "SYSADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="SMRITI-PERM-002: Year-End Process requires SYSADMIN role."
        )
    if not confirm:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="SMRITI-VAL-002: Set confirm=true to authorise year-end closure."
        )

    # Record governance config entry
    db.add(SystemConfig(
        key=f"YEAR_END_{fiscal_year}",
        value={
            "fiscal_year":  fiscal_year,
            "closed_at":    datetime.now(timezone.utc).isoformat(),
            "closed_by":    getattr(current_user, "username", "system"),
            "status":       "CLOSED",
        },
        category="YearEnd",
        company_id=tenant.company_id if tenant else None,
        created_by=getattr(current_user, "username", "system"),
        is_active=True, is_deleted=False,
    ))
    await db.commit()

    return {
        "status":      "year_end_recorded",
        "fiscal_year": fiscal_year,
        "closed_at":   datetime.now(timezone.utc).isoformat(),
        "closed_by":   getattr(current_user, "username", "system"),
        "note":        "Balance carry-forward and stock snapshot scheduled for next accounting cycle.",
    }


# ---------------------------------------------------------------------------
# GOV-004: Re-Open Day  (Shoper9: SR333100.EXE MnuNo 750/759)
# POST /api/v1/governance/reopen-day
# ---------------------------------------------------------------------------

@router.post("/reopen-day")
async def reopen_day(
    reopen_date: date = Body(..., description="Date to re-open YYYY-MM-DD"),
    reason:      str  = Body(..., description="Business reason for re-opening"),
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_company_db),
    current_user=Depends(get_current_user),
):
    """
    GOV-004 -- Re-Open Day (Shoper9: SR333100.EXE MnuNo 750/759).
    Allows a previously closed day to be re-opened for corrections.
    Records a governance audit entry; actual shift unlock is done via POS
    shift endpoint. Requires ADMIN or SYSADMIN role.
    """
    _require_admin(current_user)
    db.add(SystemConfig(
        key=f"REOPEN_DAY_{reopen_date.isoformat()}",
        value={
            "date":        reopen_date.isoformat(),
            "reason":      reason,
            "reopened_at": datetime.now(timezone.utc).isoformat(),
            "reopened_by": getattr(current_user, "username", "system"),
        },
        category="DayControl",
        company_id=tenant.company_id if tenant else None,
        created_by=getattr(current_user, "username", "system"),
        is_active=True, is_deleted=False,
    ))
    await db.commit()
    return {
        "status":      "day_reopened",
        "date":        reopen_date.isoformat(),
        "reopened_by": getattr(current_user, "username", "system"),
        "note":        "To post corrections, use POS shift or Sales/Purchase endpoints for the reopened date.",
    }


# ---------------------------------------------------------------------------
# GOV-005: Data Rebuild  (Shoper9: SR320800.EXE MnuNo 750/756)
# POST /api/v1/governance/data-rebuild
# ---------------------------------------------------------------------------

@router.post("/data-rebuild")
async def data_rebuild(
    scope:   str  = Body(..., description="STOCK | SALES | ALL"),
    confirm: bool = Body(..., description="Must be true to execute"),
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_company_db),
    current_user=Depends(get_current_user),
):
    """
    GOV-005 -- Data Rebuild (Shoper9: SR320800.EXE MnuNo 750/756).
    Triggers a scheduled recalculation of aggregate/cached data
    (running stock totals, sales summaries) from raw transaction history.
    Requires SYSADMIN role. Actual rebuild job runs asynchronously.
    """
    role = getattr(current_user, "role", None) or getattr(current_user, "user_role", "")
    if role != "SYSADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="SMRITI-PERM-002: Data Rebuild requires SYSADMIN role."
        )
    if not confirm:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="SMRITI-VAL-002: Set confirm=true to authorise data rebuild."
        )
    allowed_scopes = {"STOCK", "SALES", "ALL"}
    if scope.upper() not in allowed_scopes:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"SMRITI-VAL-001: scope must be one of {sorted(allowed_scopes)}"
        )
    # Record governance event
    db.add(SystemConfig(
        key=f"DATA_REBUILD_{scope.upper()}_{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}",
        value={
            "scope":      scope.upper(),
            "requested_at": datetime.now(timezone.utc).isoformat(),
            "requested_by": getattr(current_user, "username", "system"),
            "status":     "QUEUED",
        },
        category="DataRebuild",
        company_id=tenant.company_id if tenant else None,
        created_by=getattr(current_user, "username", "system"),
        is_active=True, is_deleted=False,
    ))
    await db.commit()
    return {
        "status":       "rebuild_queued",
        "scope":        scope.upper(),
        "requested_by": getattr(current_user, "username", "system"),
        "note":         "Rebuild job queued. Check system logs for completion status.",
    }


# ---------------------------------------------------------------------------
# GOV-006: Database Archival  (Shoper9: SR329700.EXE MnuNo 750/760)
# POST /api/v1/governance/archive
# ---------------------------------------------------------------------------

@router.post("/archive")
async def archive_database(
    archive_before: date = Body(..., description="Archive transactions before this date"),
    archive_type:   str  = Body(default="COMPRESS", description="COMPRESS | EXPORT | PURGE"),
    confirm:        bool = Body(..., description="Must be true to execute"),
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_company_db),
    current_user=Depends(get_current_user),
):
    """
    GOV-006 -- Database Archival (Shoper9: SR329700.EXE MnuNo 750/760).
    Records an archival intent for transactions before the specified date.
    Actual data movement is performed by the scheduled archive job.
    Requires SYSADMIN role.
    """
    role = getattr(current_user, "role", None) or getattr(current_user, "user_role", "")
    if role != "SYSADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="SMRITI-PERM-002: Database Archival requires SYSADMIN role."
        )
    if not confirm:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="SMRITI-VAL-002: Set confirm=true to authorise archival."
        )
    db.add(SystemConfig(
        key=f"ARCHIVE_{archive_before.isoformat()}_{archive_type.upper()}",
        value={
            "archive_before": archive_before.isoformat(),
            "archive_type":   archive_type.upper(),
            "requested_at":   datetime.now(timezone.utc).isoformat(),
            "requested_by":   getattr(current_user, "username", "system"),
            "status":         "QUEUED",
        },
        category="Archive",
        company_id=tenant.company_id if tenant else None,
        created_by=getattr(current_user, "username", "system"),
        is_active=True, is_deleted=False,
    ))
    await db.commit()
    return {
        "status":         "archive_queued",
        "archive_before": archive_before.isoformat(),
        "archive_type":   archive_type.upper(),
        "note":           "Archival job queued. Data before the specified date will be compressed/exported per policy.",
    }


# ---------------------------------------------------------------------------
# GOV-007: Sales Promotions Setup  (Shoper9: SR430300.EXE MnuNo 600/608)
# GET  /api/v1/governance/promotions
# POST /api/v1/governance/promotions
# ---------------------------------------------------------------------------

@router.get("/promotions")
async def list_promotions(
    is_active: Optional[bool] = Query(default=None),
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_company_db),
    current_user=Depends(get_current_user),
):
    """
    GOV-007 -- List Sales Promotions (Shoper9: SR430300.EXE MnuNo 600/608).
    Returns all promotion campaigns. Table: promotion_campaigns.
    """
    clauses = ["is_deleted = false"]
    params: Dict[str, Any] = {}
    if is_active is not None:
        clauses.append("is_active = :is_active")
        params["is_active"] = is_active
    if tenant and tenant.company_id:
        clauses.append("(company_id = :company_id OR company_id IS NULL)")
        params["company_id"] = tenant.company_id
    where = " AND ".join(clauses)
    rows = (await db.execute(
        text(f"SELECT * FROM promotion_campaigns WHERE {where} ORDER BY created_at DESC LIMIT 100"),
        params,
    )).fetchall()
    cols = (await db.execute(text(
        "SELECT column_name FROM information_schema.columns "
        "WHERE table_name='promotion_campaigns' AND table_schema='public' ORDER BY ordinal_position"
    ))).scalars().all()
    return {
        "total":      len(rows),
        "promotions": [dict(zip(cols, r)) for r in rows],
    }


@router.post("/promotions")
async def create_promotion(
    name:       str  = Body(..., description="Promotion name"),
    promo_type: str  = Body(..., description="FLAT | PERCENT | BUY_X_GET_Y | COMBO"),
    value:      float = Body(..., description="Discount value or percentage"),
    start_date: date = Body(..., description="Promotion start date"),
    end_date:   date = Body(..., description="Promotion end date"),
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_company_db),
    current_user=Depends(get_current_user),
):
    """
    GOV-007 -- Create Sales Promotion (Shoper9: SR430300.EXE MnuNo 600/608).
    Inserts a new promotion campaign into promotion_campaigns.
    Requires ADMIN or SYSADMIN role.
    """
    _require_admin(current_user)
    allowed_types = {"FLAT", "PERCENT", "BUY_X_GET_Y", "COMBO"}
    if promo_type.upper() not in allowed_types:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"SMRITI-VAL-001: promo_type must be one of {sorted(allowed_types)}"
        )
    import uuid as _uuid
    now = datetime.now(timezone.utc)
    await db.execute(
        text("""
            INSERT INTO promotion_campaigns
                (id, name, promo_type, discount_value, start_date, end_date,
                 company_id, is_active, is_deleted, created_at, created_by)
            VALUES
                (:id, :name, :promo_type, :value, :start_date, :end_date,
                 :company_id, true, false, :now, :created_by)
        """),
        {
            "id":         str(_uuid.uuid4()),
            "name":       name,
            "promo_type": promo_type.upper(),
            "value":      value,
            "start_date": start_date,
            "end_date":   end_date,
            "company_id": tenant.company_id if tenant else None,
            "now":        now,
            "created_by": getattr(current_user, "username", "system"),
        }
    )
    await db.commit()
    return {
        "status":     "created",
        "name":       name,
        "promo_type": promo_type.upper(),
        "value":      value,
        "start_date": start_date.isoformat(),
        "end_date":   end_date.isoformat(),
    }
