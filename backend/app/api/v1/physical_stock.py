"""
Project      : SMRITI Retail OS
Repository   : SMRITIRetailNX
Organization : AITDL NETWORKS

Founders

* Pushpa Devi Jawahar Mallah -- Founder & Chairperson
* Jawahar Ramkripal Mallah   -- Founder, CEO & Chief Software Architect
* Websites: aitdl.com | erpnbook.com | smritibooks.com

* Version    : 3.31.0
* Created    : 2026-08-24
* Modified   : 2026-08-24
* Copyright  : (c) AITDL.com and SMRITIBooks.com. All Rights Reserved.
* License    : Proprietary Commercial Software

Sprint 12 -- Physical Stock Management parity.
Shoper9 MnuNo 350/351/352 (SR323400/SR211000).
stock_takes and stock_count_lines tables now present (v1372 migration).
"""

from datetime import date, datetime, timezone, timedelta
from decimal import Decimal
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import text

from ...api.deps import (
    get_company_db, get_tenant_context, get_current_user, TenantContext
)

router = APIRouter(prefix="/physical-stock")

# ---------------------------------------------------------------------------
# Pydantic schemas
# ---------------------------------------------------------------------------

class StockCountLineIn(BaseModel):
    product_id:   str
    product_name: Optional[str] = None
    sku:          Optional[str] = None
    barcode:      Optional[str] = None
    warehouse_id: Optional[str] = None
    bin_location: Optional[str] = None
    batch_no:     Optional[str] = None
    counted_qty:  Decimal = Field(default=Decimal("0"))
    unit_cost:    Optional[Decimal] = None
    notes:        Optional[str] = None

class StockTakeCreate(BaseModel):
    description:  Optional[str] = None
    count_date:   Optional[date] = None
    warehouse_id: Optional[str] = None
    notes:        Optional[str] = None
    lines:        List[StockCountLineIn] = []


# ---------------------------------------------------------------------------
# Helper: generate a short ID
# ---------------------------------------------------------------------------
import uuid as _uuid

def _new_id() -> str:
    return str(_uuid.uuid4())[:20]

def _tenant_clause(tenant) -> tuple:
    params: Dict[str, Any] = {}
    clause = ""
    if tenant and tenant.company_id:
        clause = "AND company_id = :company_id"
        params["company_id"] = tenant.company_id
    return clause, params


# ---------------------------------------------------------------------------
# PHY-001: List / Search Stock Takes  (MnuNo 350/351 SR323400 index)
# GET /api/v1/physical-stock/sessions
# ---------------------------------------------------------------------------

@router.get("/sessions")
async def list_stock_takes(
    from_date:  Optional[date] = Query(default=None),
    to_date:    Optional[date] = Query(default=None),
    status:     Optional[str]  = Query(default=None,
                    description="DRAFT|IN_PROGRESS|COMPLETED|APPROVED|CANCELLED"),
    warehouse_id: Optional[str] = Query(default=None),
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_company_db),
    current_user=Depends(get_current_user),
):
    """
    PHY-001 -- Physical Stock Take Sessions (Shoper9: SR323400.EXE MnuNo 350/351).
    Lists all stock-take sessions with summary variance figures.
    """
    cmp_clause, params = _tenant_clause(tenant)
    date_clause = ""
    if from_date:
        date_clause += " AND count_date >= :from_date"
        params["from_date"] = from_date
    if to_date:
        date_clause += " AND count_date <= :to_date"
        params["to_date"] = to_date
    status_clause = ""
    if status:
        status_clause = "AND status = :status"
        params["status"] = status.upper()
    wh_clause = ""
    if warehouse_id:
        wh_clause = "AND warehouse_id = :warehouse_id"
        params["warehouse_id"] = warehouse_id

    sql = f"""
        SELECT id, stock_take_no, description, count_date, warehouse_id,
               status, counted_by, approved_by, approved_at, notes,
               total_lines, total_variance_qty, total_variance_value, created_at
        FROM stock_takes
        WHERE is_deleted = false
          {cmp_clause} {date_clause} {status_clause} {wh_clause}
        ORDER BY count_date DESC, created_at DESC
        LIMIT 200
    """
    rows = (await db.execute(text(sql), params)).fetchall()
    return {
        "report_id":    "PHY-001",
        "sh9_exe":      "SR323400",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "total":        len(rows),
        "sessions": [
            {
                "id":                  r[0],
                "stock_take_no":       r[1],
                "description":         r[2] or "",
                "count_date":          str(r[3]) if r[3] else "",
                "warehouse_id":        r[4] or "",
                "status":              r[5] or "",
                "counted_by":          r[6] or "",
                "approved_by":         r[7] or "",
                "approved_at":         str(r[8])[:19] if r[8] else "",
                "notes":               r[9] or "",
                "total_lines":         int(r[10] or 0),
                "total_variance_qty":  float(r[11] or 0),
                "total_variance_value": float(r[12] or 0),
            }
            for r in rows
        ],
    }


# ---------------------------------------------------------------------------
# PHY-002: Create Stock Take Session  (MnuNo 350/351 SR323400 create)
# POST /api/v1/physical-stock/sessions
# ---------------------------------------------------------------------------

@router.post("/sessions", status_code=status.HTTP_201_CREATED)
async def create_stock_take(
    payload: StockTakeCreate,
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_company_db),
    current_user=Depends(get_current_user),
):
    """
    PHY-002 -- Create Physical Stock Take (Shoper9: SR323400.EXE MnuNo 350/351).
    Creates a new stock-take session with optional pre-populated count lines.
    Role guard: ADMIN, SYSADMIN, STOREKEEPER.
    """
    role = (getattr(current_user, "role", "") or "").upper()
    if role not in ("ADMIN", "SYSADMIN", "SUPERADMIN", "STOREKEEPER", "MANAGER"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "code":    "SMRITI-PERM-001",
                "message": "You do not have permission to create a stock take session.",
                "action":  "Contact your store manager or system administrator.",
            },
        )

    company_id = tenant.company_id if tenant else None
    branch_id  = tenant.branch_id  if tenant else None
    creator    = getattr(current_user, "id", None) or "system"
    take_id    = _new_id()
    count_date = payload.count_date or date.today()

    # Generate sequential take number: PHY-YYYYMMDD-xxxx
    seq_row = (await db.execute(text("""
        SELECT COUNT(*) FROM stock_takes
        WHERE company_id = :company_id AND is_deleted = false
    """), {"company_id": company_id})).scalar()
    take_no = f"PHY-{count_date.strftime('%Y%m%d')}-{int(seq_row or 0) + 1:04d}"

    await db.execute(text("""
        INSERT INTO stock_takes
          (id, company_id, branch_id, stock_take_no, description,
           count_date, warehouse_id, status, notes,
           total_lines, total_variance_qty, total_variance_value,
           created_by, updated_by, created_at, modified_at,
           is_active, is_deleted, version)
        VALUES
          (:id, :company_id, :branch_id, :stock_take_no, :description,
           :count_date, :warehouse_id, 'DRAFT', :notes,
           0, 0, 0,
           :created_by, :created_by, NOW(), NOW(),
           true, false, 1)
    """), {
        "id": take_id, "company_id": company_id, "branch_id": branch_id,
        "stock_take_no": take_no, "description": payload.description or "",
        "count_date": count_date, "warehouse_id": payload.warehouse_id,
        "notes": payload.notes or "", "created_by": creator,
    })

    # Insert lines if provided
    line_ids = []
    for i, ln in enumerate(payload.lines):
        line_id = _new_id()
        line_ids.append(line_id)
        await db.execute(text("""
            INSERT INTO stock_count_lines
              (id, company_id, branch_id, stock_take_id, product_id,
               product_name, sku, barcode, warehouse_id, bin_location, batch_no,
               computed_qty, counted_qty, variance_qty, unit_cost, variance_value,
               status, notes, created_by, updated_by, created_at, modified_at,
               is_active, is_deleted, version)
            VALUES
              (:id, :company_id, :branch_id, :take_id, :product_id,
               :product_name, :sku, :barcode, :warehouse_id, :bin_location, :batch_no,
               0, :counted_qty,
               COALESCE(:counted_qty, 0),
               :unit_cost,
               COALESCE(:counted_qty, 0) * COALESCE(:unit_cost, 0),
               'PENDING', :notes, :creator, :creator, NOW(), NOW(),
               true, false, 1)
        """), {
            "id": line_id, "company_id": company_id, "branch_id": branch_id,
            "take_id": take_id, "product_id": ln.product_id,
            "product_name": ln.product_name or "", "sku": ln.sku or "",
            "barcode": ln.barcode or "", "warehouse_id": ln.warehouse_id,
            "bin_location": ln.bin_location, "batch_no": ln.batch_no,
            "counted_qty": float(ln.counted_qty), "unit_cost": float(ln.unit_cost) if ln.unit_cost else None,
            "notes": ln.notes or "", "creator": creator,
        })

    # Update line count on session
    await db.execute(text("""
        UPDATE stock_takes SET total_lines = :n WHERE id = :id
    """), {"n": len(payload.lines), "id": take_id})

    await db.commit()
    return {
        "id":            take_id,
        "stock_take_no": take_no,
        "count_date":    str(count_date),
        "status":        "DRAFT",
        "lines_created": len(line_ids),
        "created_at":    datetime.now(timezone.utc).isoformat(),
    }


# ---------------------------------------------------------------------------
# PHY-003: Get Stock Take Session Detail + Lines
# GET /api/v1/physical-stock/sessions/{take_id}
# ---------------------------------------------------------------------------

@router.get("/sessions/{take_id}")
async def get_stock_take(
    take_id: str,
    db: AsyncSession = Depends(get_company_db),
    current_user=Depends(get_current_user),
):
    """
    PHY-003 -- Get Stock Take Detail with Count Lines.
    Returns session header + all count lines with computed/counted/variance.
    """
    row = (await db.execute(text("""
        SELECT id, stock_take_no, description, count_date, warehouse_id,
               status, counted_by, approved_by, total_lines,
               total_variance_qty, total_variance_value, notes
        FROM stock_takes WHERE id = :id AND is_deleted = false
    """), {"id": take_id})).fetchone()

    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "code":    "SMRITI-DATA-001",
                "message": f"Stock take session '{take_id}' was not found.",
                "action":  "Verify the session ID and try again.",
            },
        )

    lines = (await db.execute(text("""
        SELECT id, product_id, product_name, sku, barcode,
               bin_location, batch_no,
               computed_qty, counted_qty, variance_qty,
               unit_cost, variance_value, status, notes
        FROM stock_count_lines
        WHERE stock_take_id = :take_id AND is_deleted = false
        ORDER BY product_name
    """), {"take_id": take_id})).fetchall()

    return {
        "id":                  row[0],
        "stock_take_no":       row[1],
        "description":         row[2] or "",
        "count_date":          str(row[3]) if row[3] else "",
        "warehouse_id":        row[4] or "",
        "status":              row[5] or "",
        "counted_by":          row[6] or "",
        "approved_by":         row[7] or "",
        "total_lines":         int(row[8] or 0),
        "total_variance_qty":  float(row[9] or 0),
        "total_variance_value": float(row[10] or 0),
        "notes":               row[11] or "",
        "lines": [
            {
                "id":            l[0],
                "product_id":    l[1],
                "product_name":  l[2] or "",
                "sku":           l[3] or "",
                "barcode":       l[4] or "",
                "bin_location":  l[5] or "",
                "batch_no":      l[6] or "",
                "computed_qty":  float(l[7] or 0),
                "counted_qty":   float(l[8]) if l[8] is not None else None,
                "variance_qty":  float(l[9] or 0),
                "unit_cost":     float(l[10] or 0),
                "variance_value": float(l[11] or 0),
                "status":        l[12] or "",
                "notes":         l[13] or "",
            }
            for l in lines
        ],
    }


# ---------------------------------------------------------------------------
# PHY-004: Physical vs Computed Variance Report  (SR211000 MnuNo 350/352)
# GET /api/v1/physical-stock/variance
# ---------------------------------------------------------------------------

@router.get("/variance")
async def physical_vs_computed(
    take_id:    Optional[str]  = Query(default=None, description="Filter by stock take ID"),
    from_date:  Optional[date] = Query(default=None),
    to_date:    Optional[date] = Query(default=None),
    excess_only: bool = Query(default=False, description="Only lines with positive variance"),
    short_only:  bool = Query(default=False, description="Only lines with negative variance"),
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_company_db),
    current_user=Depends(get_current_user),
):
    """
    PHY-004 -- Physical vs Computed Variance (Shoper9: SR211000.EXE MnuNo 350/352).
    Joins stock_count_lines with stock_takes to show item-level discrepancies.
    """
    cmp_clause, params = _tenant_clause(tenant)
    take_clause = ""
    if take_id:
        take_clause = "AND scl.stock_take_id = :take_id"
        params["take_id"] = take_id
    date_clause = ""
    if from_date:
        date_clause += " AND st.count_date >= :from_date"
        params["from_date"] = from_date
    if to_date:
        date_clause += " AND st.count_date <= :to_date"
        params["to_date"] = to_date
    var_clause = ""
    if excess_only:
        var_clause = "AND scl.variance_qty > 0"
    elif short_only:
        var_clause = "AND scl.variance_qty < 0"

    sql = f"""
        SELECT
            scl.id, scl.stock_take_id,
            st.stock_take_no, st.count_date,
            scl.product_id, scl.product_name, scl.sku,
            scl.computed_qty, scl.counted_qty, scl.variance_qty,
            scl.unit_cost, scl.variance_value,
            scl.bin_location, scl.batch_no, scl.status
        FROM stock_count_lines scl
        JOIN stock_takes st ON st.id = scl.stock_take_id
        WHERE scl.is_deleted = false AND st.is_deleted = false
          AND scl.counted_qty IS NOT NULL
          {cmp_clause.replace('company_id', 'st.company_id')}
          {take_clause} {date_clause} {var_clause}
        ORDER BY ABS(COALESCE(scl.variance_qty, 0)) DESC
        LIMIT 1000
    """
    try:
        rows = (await db.execute(text(sql), params)).fetchall()
        lines = [
            {
                "line_id":        r[0],
                "take_id":        r[1],
                "stock_take_no":  r[2],
                "count_date":     str(r[3]) if r[3] else "",
                "product_id":     r[4],
                "product_name":   r[5] or "",
                "sku":            r[6] or "",
                "computed_qty":   float(r[7] or 0),
                "counted_qty":    float(r[8] or 0),
                "variance_qty":   float(r[9] or 0),
                "unit_cost":      float(r[10] or 0),
                "variance_value": float(r[11] or 0),
                "bin_location":   r[12] or "",
                "batch_no":       r[13] or "",
                "line_status":    r[14] or "",
                "discrepancy_type": (
                    "EXCESS" if float(r[9] or 0) > 0
                    else "SHORT" if float(r[9] or 0) < 0
                    else "MATCH"
                ),
            }
            for r in rows
        ]
    except Exception:
        lines = []

    total_variance_value = sum(l["variance_value"] for l in lines)
    return {
        "report_id":     "PHY-004",
        "sh9_exe":       "SR211000",
        "from_date":     str(from_date or ""),
        "to_date":       str(to_date or ""),
        "generated_at":  datetime.now(timezone.utc).isoformat(),
        "total_lines":   len(lines),
        "excess_lines":  sum(1 for l in lines if l["discrepancy_type"] == "EXCESS"),
        "short_lines":   sum(1 for l in lines if l["discrepancy_type"] == "SHORT"),
        "match_lines":   sum(1 for l in lines if l["discrepancy_type"] == "MATCH"),
        "total_variance_value": round(total_variance_value, 2),
        "lines":         lines,
    }


# ---------------------------------------------------------------------------
# PHY-005: Approve / Close Stock Take Session
# PATCH /api/v1/physical-stock/sessions/{take_id}/approve
# ---------------------------------------------------------------------------

@router.patch("/sessions/{take_id}/approve")
async def approve_stock_take(
    take_id: str,
    db: AsyncSession = Depends(get_company_db),
    current_user=Depends(get_current_user),
):
    """
    PHY-005 -- Approve Stock Take Session.
    Transitions session from COMPLETED -> APPROVED and records approver.
    Role guard: ADMIN or MANAGER.
    """
    role = (getattr(current_user, "role", "") or "").upper()
    if role not in ("ADMIN", "SYSADMIN", "SUPERADMIN", "MANAGER"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "code":    "SMRITI-PERM-001",
                "message": "Only managers or administrators can approve stock takes.",
                "action":  "Contact your store manager.",
            },
        )

    row = (await db.execute(text("""
        SELECT id, status FROM stock_takes
        WHERE id = :id AND is_deleted = false
    """), {"id": take_id})).fetchone()

    if not row:
        raise HTTPException(status_code=404, detail={"code": "SMRITI-DATA-001",
            "message": f"Stock take session '{take_id}' not found."})

    if row[1] not in ("COMPLETED", "IN_PROGRESS"):
        raise HTTPException(status_code=422, detail={
            "code":    "SMRITI-VAL-001",
            "message": f"Session is currently '{row[1]}'. Only COMPLETED sessions can be approved.",
            "action":  "Complete the count first before approving.",
        })

    approver = getattr(current_user, "full_name", None) or getattr(current_user, "id", "system")
    await db.execute(text("""
        UPDATE stock_takes
        SET status = 'APPROVED', approved_by = :approver,
            approved_at = NOW(), modified_at = NOW()
        WHERE id = :id
    """), {"approver": approver, "id": take_id})
    await db.commit()

    return {
        "id":          take_id,
        "status":      "APPROVED",
        "approved_by": approver,
        "approved_at": datetime.now(timezone.utc).isoformat(),
    }

# ---------------------------------------------------------------------------
# PHY-006: Update a single count line (counted_qty, notes)
# PATCH /api/v1/physical-stock/sessions/{take_id}/lines/{line_id}
# Sprint 18 -- enables inline counted_qty entry from the React UI
# ---------------------------------------------------------------------------

class CountLineUpdate(BaseModel):
    counted_qty: Decimal
    notes:       Optional[str] = None

@router.patch("/sessions/{take_id}/lines/{line_id}", status_code=200)
async def update_count_line(
    take_id:  str,
    line_id:  str,
    body:     CountLineUpdate,
    tenant:   TenantContext = Depends(get_tenant_context),
    db:       AsyncSession  = Depends(get_company_db),
    current_user=Depends(get_current_user),
):
    """
    PHY-006 -- Update counted_qty (and optional notes) for a single stock count line.
    Recalculates variance_qty = counted_qty - computed_qty.
    Session must be OPEN or IN_PROGRESS.
    """
    # 1. Guard: session must exist + be open
    take_row = (await db.execute(text("""
        SELECT id, status FROM stock_takes
        WHERE id = :take_id AND is_deleted = false
    """), {"take_id": take_id})).fetchone()

    if not take_row:
        raise HTTPException(status_code=404, detail={
            "code": "SMRITI-DATA-001",
            "message": f"Stock take session '{take_id}' not found.",
        })
    if take_row[1] not in ("OPEN", "IN_PROGRESS"):
        raise HTTPException(status_code=422, detail={
            "code": "SMRITI-VAL-001",
            "message": f"Session is '{take_row[1]}'. Only OPEN or IN_PROGRESS sessions can be edited.",
            "action": "Reopen the session or create a new count.",
        })

    # 2. Guard: line must exist in this session
    line_row = (await db.execute(text("""
        SELECT id, computed_qty FROM stock_count_lines
        WHERE id = :line_id AND stock_take_id = :take_id
    """), {"line_id": line_id, "take_id": take_id})).fetchone()

    if not line_row:
        raise HTTPException(status_code=404, detail={
            "code": "SMRITI-DATA-001",
            "message": f"Count line '{line_id}' not found in session.",
        })

    computed_qty = Decimal(str(line_row[1] or 0))
    variance_qty = body.counted_qty - computed_qty

    # 3. Update
    await db.execute(text("""
        UPDATE stock_count_lines
        SET counted_qty   = :counted_qty,
            variance_qty  = :variance_qty,
            notes         = COALESCE(:notes, notes),
            modified_at   = NOW()
        WHERE id = :line_id
    """), {
        "counted_qty":  float(body.counted_qty),
        "variance_qty": float(variance_qty),
        "notes":        body.notes,
        "line_id":      line_id,
    })

    # 4. Transition session to IN_PROGRESS on first edit
    if take_row[1] == "OPEN":
        await db.execute(text("""
            UPDATE stock_takes SET status = 'IN_PROGRESS', modified_at = NOW()
            WHERE id = :take_id
        """), {"take_id": take_id})

    await db.commit()

    return {
        "id":           line_id,
        "counted_qty":  float(body.counted_qty),
        "variance_qty": float(variance_qty),
        "status":       "IN_PROGRESS" if take_row[1] == "OPEN" else take_row[1],
    }