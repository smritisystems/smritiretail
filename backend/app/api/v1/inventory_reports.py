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

Sprint 8d -- Inventory & Stock Report parity.
Shoper9 MnuNo 430/450 Stock Ledger Reports.
EXE refs: SR202500, SR203000, SR241700, SR233600, SR202800, SR212600.
"""

from datetime import date, datetime, timezone, timedelta
from decimal import Decimal
from typing import Dict, List, Optional
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func, and_, text

from ...api.deps import get_company_db, get_tenant_context, get_current_user, TenantContext
from ...models.inventory import Product, StockMovement

router = APIRouter(prefix="/inventory-reports")

# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------

def _tenant_inv(stmt, model, tenant):
    if tenant and tenant.company_id:
        stmt = stmt.where(
            (model.company_id == tenant.company_id) |
            (model.company_id.is_(None))
        )
    if tenant and tenant.branch_id:
        stmt = stmt.where(
            (model.branch_id == tenant.branch_id) | (model.branch_id.is_(None))
        )
    return stmt

def _date_inv(stmt, model, from_date, to_date):
    if from_date:
        stmt = stmt.where(model.created_at >= from_date)
    if to_date:
        next_day = date(to_date.year, to_date.month, to_date.day) + timedelta(days=1)
        stmt = stmt.where(model.created_at < next_day)
    return stmt


# ---------------------------------------------------------------------------
# RPT-INV-001: Stock Balance Summary  (Shoper9: SR202500.EXE MnuNo 430/431)
# GET /api/v1/inventory-reports/balance
# ---------------------------------------------------------------------------

@router.get("/balance")
async def stock_balance(
    category:    Optional[str] = Query(default=None, description="Filter by category"),
    warehouse:   Optional[str] = Query(default=None, description="Filter by warehouse"),
    zero_stock:  bool = Query(default=False, description="Include zero-stock items"),
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_company_db),
    current_user=Depends(get_current_user),
):
    """
    RPT-INV-001 -- Stock Balance Summary (Shoper9: SR202500.EXE MnuNo 430/431).
    Current stock-on-hand per product derived from StockMovement aggregation.
    """
    # Aggregate IN vs OUT movements per product
    p_stmt = select(Product).where(Product.is_deleted == False, Product.is_active == True)
    p_stmt = _tenant_inv(p_stmt, Product, tenant)
    if category:
        p_stmt = p_stmt.where(Product.category.ilike(f"%{category}%"))
    products = (await db.execute(p_stmt)).scalars().all()

    # Batch-load movements aggregated by product
    mv_stmt = select(
        StockMovement.product_id,
        StockMovement.movement_type,
        StockMovement.warehouse,
        func.sum(StockMovement.quantity).label("total_qty"),
        func.sum(StockMovement.quantity * func.coalesce(StockMovement.unit_cost, 0)).label("total_value"),
    ).where(StockMovement.is_deleted == False)
    mv_stmt = _tenant_inv(mv_stmt, StockMovement, tenant)
    if warehouse:
        mv_stmt = mv_stmt.where(StockMovement.warehouse.ilike(f"%{warehouse}%"))
    mv_stmt = mv_stmt.group_by(
        StockMovement.product_id,
        StockMovement.movement_type,
        StockMovement.warehouse,
    )
    mv_rows = (await db.execute(mv_stmt)).fetchall()

    # Build product balance map
    bal: Dict[str, Dict] = {}
    for row in mv_rows:
        pid = row.product_id
        if pid not in bal:
            bal[pid] = {"in": Decimal(0), "out": Decimal(0), "value_in": Decimal(0)}
        qty = Decimal(str(row.total_qty or 0))
        val = Decimal(str(row.total_value or 0))
        mt = (row.movement_type or "").upper()
        if mt in ("IN", "INWARD_GRN", "RETURN", "ADJUSTMENT_IN", "TRANSFER_IN"):
            bal[pid]["in"] += qty
            bal[pid]["value_in"] += val
        else:
            bal[pid]["out"] += qty

    lines = []
    total_items = 0
    total_value = Decimal(0)
    for prod in products:
        b = bal.get(prod.id, {"in": Decimal(0), "out": Decimal(0), "value_in": Decimal(0)})
        on_hand = b["in"] - b["out"]
        if not zero_stock and on_hand <= 0:
            continue
        avg_cost = b["value_in"] / b["in"] if b["in"] > 0 else Decimal(0)
        value = on_hand * avg_cost
        total_value += value
        total_items += 1
        lines.append({
            "product_id":   prod.id,
            "product_code": getattr(prod, "sku", None) or getattr(prod, "code", prod.id),
            "product_name": prod.name,
            "category":     getattr(prod, "category", None) or "",
            "on_hand":      float(on_hand),
            "avg_cost":     float(avg_cost.quantize(Decimal("0.01"))),
            "stock_value":  float(value.quantize(Decimal("0.01"))),
            "min_level":    float(getattr(prod, "min_stock_level", None) or 0),
            "reorder_level": float(getattr(prod, "reorder_level", None) or 0),
            "status":       "LOW" if on_hand <= float(getattr(prod, "min_stock_level", None) or 0)
                            else "OK",
        })

    lines.sort(key=lambda x: x["product_name"])
    return {
        "report_id":    "RPT-INV-001",
        "sh9_exe":      "SR202500",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "total_items":  total_items,
        "total_value":  float(total_value.quantize(Decimal("0.01"))),
        "low_stock_count": sum(1 for l in lines if l["status"] == "LOW"),
        "lines":        lines,
    }


# ---------------------------------------------------------------------------
# RPT-INV-002: Stock Movement Report  (Shoper9: SR203000.EXE MnuNo 430/432)
# GET /api/v1/inventory-reports/movement
# ---------------------------------------------------------------------------

@router.get("/movement")
async def stock_movement_report(
    from_date:     Optional[date] = Query(default=None),
    to_date:       Optional[date] = Query(default=None),
    movement_type: Optional[str]  = Query(default=None, description="IN|OUT|ADJUSTMENT|TRANSFER"),
    product_id:    Optional[str]  = Query(default=None),
    warehouse:     Optional[str]  = Query(default=None),
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_company_db),
    current_user=Depends(get_current_user),
):
    """
    RPT-INV-002 -- Stock Movement Report (Shoper9: SR203000.EXE MnuNo 430/432).
    Detailed movement register with aggregation summary by type.
    """
    stmt = select(StockMovement).where(StockMovement.is_deleted == False)
    stmt = _tenant_inv(stmt, StockMovement, tenant)
    stmt = _date_inv(stmt, StockMovement, from_date, to_date)
    if movement_type:
        stmt = stmt.where(StockMovement.movement_type.ilike(f"%{movement_type}%"))
    if product_id:
        stmt = stmt.where(StockMovement.product_id == product_id)
    if warehouse:
        stmt = stmt.where(StockMovement.warehouse.ilike(f"%{warehouse}%"))
    stmt = stmt.order_by(StockMovement.created_at.desc()).limit(500)
    movements = (await db.execute(stmt)).scalars().all()

    by_type: Dict[str, Dict] = {}
    lines = []
    for mv in movements:
        mt = (mv.movement_type or "UNKNOWN").upper()
        qty = Decimal(str(mv.quantity or 0))
        cost = Decimal(str(mv.unit_cost or 0))
        value = qty * cost
        if mt not in by_type:
            by_type[mt] = {"count": 0, "qty": Decimal(0), "value": Decimal(0)}
        by_type[mt]["count"] += 1
        by_type[mt]["qty"] += qty
        by_type[mt]["value"] += value
        lines.append({
            "movement_id":     mv.id,
            "movement_type":   mt,
            "product_id":      mv.product_id,
            "product_name":    getattr(mv, "product_name", None) or "",
            "sku":             getattr(mv, "sku", None) or "",
            "quantity":        float(qty),
            "unit_cost":       float(cost),
            "value":           float(value),
            "warehouse":       getattr(mv, "warehouse", None) or "",
            "reference_type":  getattr(mv, "reference_doc_type", None) or "",
            "reference_id":    getattr(mv, "reference_doc_id", None) or "",
            "date":            str(mv.created_at)[:10] if mv.created_at else "",
        })

    return {
        "report_id":    "RPT-INV-002",
        "sh9_exe":      "SR203000",
        "from_date":    str(from_date or ""),
        "to_date":      str(to_date or ""),
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "total_records": len(lines),
        "summary_by_type": {
            k: {"count": v["count"], "qty": float(v["qty"]), "value": float(v["value"])}
            for k, v in sorted(by_type.items())
        },
        "lines": lines,
    }


# ---------------------------------------------------------------------------
# RPT-INV-003: Stock Availability  (Shoper9: SR241700.EXE MnuNo 430/445)
# GET /api/v1/inventory-reports/availability
# ---------------------------------------------------------------------------

@router.get("/availability")
async def stock_availability(
    below_reorder: bool = Query(default=False, description="Only items below reorder level"),
    below_minimum: bool = Query(default=False, description="Only items below minimum stock"),
    category:      Optional[str] = Query(default=None),
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_company_db),
    current_user=Depends(get_current_user),
):
    """
    RPT-INV-003 -- Stock Availability (Shoper9: SR241700.EXE MnuNo 430/445).
    Current availability status â€” identifies below-minimum and reorder-required items.
    """
    p_stmt = select(Product).where(Product.is_deleted == False, Product.is_active == True)
    p_stmt = _tenant_inv(p_stmt, Product, tenant)
    if category:
        p_stmt = p_stmt.where(Product.category.ilike(f"%{category}%"))
    products = (await db.execute(p_stmt)).scalars().all()

    # Aggregate on-hand per product
    mv_agg = (await db.execute(
        select(
            StockMovement.product_id,
            StockMovement.movement_type,
            func.sum(StockMovement.quantity).label("qty"),
        ).where(StockMovement.is_deleted == False)
        .group_by(StockMovement.product_id, StockMovement.movement_type)
    )).fetchall()

    bal: Dict[str, Decimal] = {}
    for row in mv_agg:
        pid = row.product_id
        qty = Decimal(str(row.qty or 0))
        mt = (row.movement_type or "").upper()
        if pid not in bal:
            bal[pid] = Decimal(0)
        if mt in ("IN", "INWARD_GRN", "RETURN", "ADJUSTMENT_IN", "TRANSFER_IN"):
            bal[pid] += qty
        else:
            bal[pid] -= qty

    lines = []
    for prod in products:
        on_hand = bal.get(prod.id, Decimal(0))
        min_level    = Decimal(str(getattr(prod, "min_stock_level", None) or 0))
        reorder_level = Decimal(str(getattr(prod, "reorder_level", None) or 0))
        max_level    = Decimal(str(getattr(prod, "max_stock_level", None) or 0))
        is_below_min    = on_hand < min_level
        is_below_reorder = on_hand < reorder_level

        if below_minimum and not is_below_min:
            continue
        if below_reorder and not is_below_reorder:
            continue

        avail_status = (
            "CRITICAL"  if on_hand <= 0 else
            "BELOW_MIN" if is_below_min else
            "REORDER"   if is_below_reorder else
            "OK"
        )
        lines.append({
            "product_id":     prod.id,
            "product_code":   getattr(prod, "sku", None) or prod.id,
            "product_name":   prod.name,
            "category":       getattr(prod, "category", None) or "",
            "on_hand":        float(on_hand),
            "min_level":      float(min_level),
            "reorder_level":  float(reorder_level),
            "max_level":      float(max_level),
            "availability":   avail_status,
        })

    lines.sort(key=lambda x: (x["availability"] == "OK", x["product_name"]))
    return {
        "report_id":      "RPT-INV-003",
        "sh9_exe":        "SR241700",
        "generated_at":   datetime.now(timezone.utc).isoformat(),
        "total_products": len(lines),
        "critical_count": sum(1 for l in lines if l["availability"] == "CRITICAL"),
        "below_min_count": sum(1 for l in lines if l["availability"] == "BELOW_MIN"),
        "reorder_count":  sum(1 for l in lines if l["availability"] == "REORDER"),
        "lines":          lines,
    }


# ---------------------------------------------------------------------------
# RPT-INV-004: Stock Aging  (Shoper9: SR233600.EXE MnuNo 430/441)
# GET /api/v1/inventory-reports/aging
# ---------------------------------------------------------------------------

@router.get("/aging")
async def stock_aging(
    as_on_date: Optional[date] = Query(default=None, description="Age as on date (default today)"),
    buckets:    str = Query(default="30,60,90,180", description="Aging bucket days e.g. 30,60,90,180"),
    category:   Optional[str] = Query(default=None),
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_company_db),
    current_user=Depends(get_current_user),
):
    """
    RPT-INV-004 -- Stock Aging (Shoper9: SR233600.EXE MnuNo 430/441).
    Stock on-hand bucketed by days-since-last-receipt into configurable aging slots.
    """
    pivot = datetime.combine(as_on_date or date.today(), datetime.min.time()).replace(tzinfo=timezone.utc)

    # Parse buckets
    try:
        bucket_days = [int(b.strip()) for b in buckets.split(",")]
    except ValueError:
        bucket_days = [30, 60, 90, 180]
    bucket_days = sorted(set(bucket_days))
    bucket_labels = []
    prev = 0
    for b in bucket_days:
        bucket_labels.append(f"{prev+1}-{b} days")
        prev = b
    bucket_labels.append(f"{bucket_days[-1]}+ days")

    # Get last inward movement date per product
    last_in = (await db.execute(
        select(
            StockMovement.product_id,
            func.max(StockMovement.created_at).label("last_in_date"),
        ).where(
            StockMovement.is_deleted == False,
            StockMovement.movement_type.in_(["IN", "INWARD_GRN", "RETURN"]),
        )
        .group_by(StockMovement.product_id)
    )).fetchall()
    last_in_map = {r.product_id: r.last_in_date for r in last_in}

    # Get products with stock
    p_stmt = select(Product).where(Product.is_deleted == False, Product.is_active == True)
    p_stmt = _tenant_inv(p_stmt, Product, tenant)
    if category:
        p_stmt = p_stmt.where(Product.category.ilike(f"%{category}%"))
    products = (await db.execute(p_stmt)).scalars().all()

    # Get on-hand balance
    mv_agg = (await db.execute(
        select(StockMovement.product_id, StockMovement.movement_type,
               func.sum(StockMovement.quantity).label("qty"))
        .where(StockMovement.is_deleted == False)
        .group_by(StockMovement.product_id, StockMovement.movement_type)
    )).fetchall()
    bal: Dict[str, Decimal] = {}
    for row in mv_agg:
        pid = row.product_id
        qty = Decimal(str(row.qty or 0))
        if pid not in bal:
            bal[pid] = Decimal(0)
        mt = (row.movement_type or "").upper()
        if mt in ("IN", "INWARD_GRN", "RETURN", "ADJUSTMENT_IN"):
            bal[pid] += qty
        else:
            bal[pid] -= qty

    # Build aged summary
    bucket_totals = {lbl: 0 for lbl in bucket_labels}
    lines = []
    for prod in products:
        on_hand = bal.get(prod.id, Decimal(0))
        if on_hand <= 0:
            continue
        last_dt = last_in_map.get(prod.id)
        if last_dt:
            if last_dt.tzinfo is None:
                last_dt = last_dt.replace(tzinfo=timezone.utc)
            days_old = (pivot - last_dt).days
        else:
            days_old = 9999

        # Classify into bucket
        bucket_idx = len(bucket_days)  # default: last bucket (overflow)
        for i, b in enumerate(bucket_days):
            if days_old <= b:
                bucket_idx = i
                break
        bucket_lbl = bucket_labels[bucket_idx]
        bucket_totals[bucket_lbl] += 1

        lines.append({
            "product_id":   prod.id,
            "product_code": getattr(prod, "sku", prod.id),
            "product_name": prod.name,
            "on_hand":      float(on_hand),
            "last_receipt": str(last_dt)[:10] if last_dt else "NEVER",
            "days_old":     days_old if days_old < 9999 else None,
            "age_bucket":   bucket_lbl,
        })

    lines.sort(key=lambda x: (x["days_old"] is None, -(x["days_old"] or 0)))
    return {
        "report_id":    "RPT-INV-004",
        "sh9_exe":      "SR233600",
        "as_on_date":   str(as_on_date or date.today()),
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "bucket_summary": bucket_totals,
        "total_products": len(lines),
        "lines":        lines,
    }


# ---------------------------------------------------------------------------
# RPT-INV-005: Goods Register (Transaction-wise)  (Shoper9: SR202800.EXE MnuNo 450/451)
# GET /api/v1/inventory-reports/goods-register
# ---------------------------------------------------------------------------

@router.get("/goods-register")
async def goods_register(
    from_date:     Optional[date] = Query(default=None),
    to_date:       Optional[date] = Query(default=None),
    movement_type: Optional[str]  = Query(default=None, description="INWARD_GRN | OUTWARD_SALE | TRANSFER"),
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_company_db),
    current_user=Depends(get_current_user),
):
    """
    RPT-INV-005 -- Transaction-wise Goods Register (Shoper9: SR202800.EXE MnuNo 450/451).
    All inward and outward goods movements grouped by reference document.
    """
    stmt = select(StockMovement).where(StockMovement.is_deleted == False)
    stmt = _tenant_inv(stmt, StockMovement, tenant)
    stmt = _date_inv(stmt, StockMovement, from_date, to_date)
    if movement_type:
        stmt = stmt.where(StockMovement.movement_type.ilike(f"%{movement_type}%"))
    stmt = stmt.order_by(StockMovement.created_at.desc()).limit(1000)
    movements = (await db.execute(stmt)).scalars().all()

    # Group by reference document
    by_doc: Dict[str, dict] = {}
    for mv in movements:
        ref = getattr(mv, "reference_doc_id", None) or mv.id
        ref_type = getattr(mv, "reference_doc_type", None) or "MOVEMENT"
        if ref not in by_doc:
            by_doc[ref] = {
                "reference_id":   ref,
                "reference_type": ref_type,
                "date":           str(mv.created_at)[:10] if mv.created_at else "",
                "movement_type":  mv.movement_type or "",
                "lines":          [],
                "total_qty":      Decimal(0),
                "total_value":    Decimal(0),
            }
        qty = Decimal(str(mv.quantity or 0))
        cost = Decimal(str(mv.unit_cost or 0))
        by_doc[ref]["total_qty"] += qty
        by_doc[ref]["total_value"] += qty * cost
        by_doc[ref]["lines"].append({
            "product_id":   mv.product_id,
            "product_name": getattr(mv, "product_name", None) or "",
            "sku":          getattr(mv, "sku", None) or "",
            "qty":          float(qty),
            "unit_cost":    float(cost),
            "warehouse":    getattr(mv, "warehouse", None) or "",
        })

    docs = [
        {**v, "total_qty": float(v["total_qty"]), "total_value": float(v["total_value"])}
        for v in sorted(by_doc.values(), key=lambda x: x["date"], reverse=True)
    ]
    return {
        "report_id":       "RPT-INV-005",
        "sh9_exe":         "SR202800",
        "from_date":       str(from_date or ""),
        "to_date":         str(to_date or ""),
        "generated_at":    datetime.now(timezone.utc).isoformat(),
        "total_documents": len(docs),
        "documents":       docs,
    }


# ---------------------------------------------------------------------------
# RPT-INV-006: Item-wise Goods Register  (Shoper9: SR212600.EXE MnuNo 450/452)
# GET /api/v1/inventory-reports/goods-register-item
# ---------------------------------------------------------------------------

@router.get("/goods-register-item")
async def goods_register_item(
    from_date:  Optional[date] = Query(default=None),
    to_date:    Optional[date] = Query(default=None),
    product_id: Optional[str]  = Query(default=None, description="Filter by single product"),
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_company_db),
    current_user=Depends(get_current_user),
):
    """
    RPT-INV-006 -- Item-wise Goods Register (Shoper9: SR212600.EXE MnuNo 450/452).
    All goods movements aggregated per item across the period.
    """
    stmt = select(StockMovement).where(StockMovement.is_deleted == False)
    stmt = _tenant_inv(stmt, StockMovement, tenant)
    stmt = _date_inv(stmt, StockMovement, from_date, to_date)
    if product_id:
        stmt = stmt.where(StockMovement.product_id == product_id)
    movements = (await db.execute(stmt)).scalars().all()

    agg: Dict[str, dict] = {}
    for mv in movements:
        pid  = mv.product_id
        qty  = Decimal(str(mv.quantity or 0))
        cost = Decimal(str(mv.unit_cost or 0))
        mt   = (mv.movement_type or "").upper()
        if pid not in agg:
            agg[pid] = {
                "product_id":   pid,
                "product_name": getattr(mv, "product_name", None) or "",
                "sku":          getattr(mv, "sku", None) or "",
                "total_in":     Decimal(0),
                "total_out":    Decimal(0),
                "value_in":     Decimal(0),
                "value_out":    Decimal(0),
                "tx_count":     0,
            }
        agg[pid]["tx_count"] += 1
        if mt in ("IN", "INWARD_GRN", "RETURN", "ADJUSTMENT_IN", "TRANSFER_IN"):
            agg[pid]["total_in"]  += qty
            agg[pid]["value_in"]  += qty * cost
        else:
            agg[pid]["total_out"] += qty
            agg[pid]["value_out"] += qty * cost

    lines = [
        {
            "product_id":   d["product_id"],
            "product_name": d["product_name"],
            "sku":          d["sku"],
            "total_in":     float(d["total_in"]),
            "total_out":    float(d["total_out"]),
            "net_movement": float(d["total_in"] - d["total_out"]),
            "value_in":     float(d["value_in"]),
            "value_out":    float(d["value_out"]),
            "tx_count":     d["tx_count"],
        }
        for d in sorted(agg.values(), key=lambda x: x["product_name"])
    ]

    return {
        "report_id":    "RPT-INV-006",
        "sh9_exe":      "SR212600",
        "from_date":    str(from_date or ""),
        "to_date":      str(to_date or ""),
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "total_items":  len(lines),
        "lines":        lines,
    }

# ---------------------------------------------------------------------------
# RPT-INV-007: Sales Returns Report  (Shoper9: SR210200.EXE MnuNo 410/421)
# GET /api/v1/inventory-reports/returns
# ---------------------------------------------------------------------------

@router.get("/returns")
async def sales_returns_report(
    from_date:  Optional[date] = Query(default=None),
    to_date:    Optional[date] = Query(default=None),
    reason:     Optional[str]  = Query(default=None, description="Filter by return reason keyword"),
    status:     Optional[str]  = Query(default=None, description="Filter by status e.g. APPROVED, PENDING"),
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_company_db),
    current_user=Depends(get_current_user),
):
    """
    RPT-INV-007 -- Sales Returns / Returned Bills (Shoper9: SR210200.EXE MnuNo 410/421).
    All sales_returns records within period with credit note details.
    Also covers MnuNo 430/444 Void Transactions (SR239800) when status=VOIDED.
    """
    params: Dict[str, Any] = {}
    clauses = ["is_deleted = false"]
    if tenant and tenant.company_id:
        clauses.append("company_id = :company_id")
        params["company_id"] = tenant.company_id
    if from_date:
        clauses.append("created_at >= :from_date")
        params["from_date"] = from_date
    if to_date:
        params["to_date_next"] = datetime.combine(to_date, datetime.min.time()) + timedelta(days=1)
        clauses.append("created_at < :to_date_next")
    if reason:
        clauses.append("reason ILIKE :reason")
        params["reason"] = f"%{reason}%"
    if status:
        clauses.append("status = :status")
        params["status"] = status.upper()

    where = " AND ".join(clauses)
    sql = f"""
        SELECT
            id, return_no, original_invoice_id,
            COALESCE(credit_note_number, '') AS credit_note_number,
            date, reason, tax_total, grand_total, status, created_at
        FROM sales_returns
        WHERE {where}
        ORDER BY created_at DESC
        LIMIT 500
    """
    try:
        rows = (await db.execute(text(sql), params)).fetchall()
        lines = [
            {
                "return_id":          r[0],
                "return_no":          r[1],
                "original_invoice_id": r[2] or "",
                "credit_note_number": r[3],
                "return_date":        str(r[4]) if r[4] else str(r[9])[:10],
                "reason":             r[5] or "",
                "tax_total":          float(r[6] or 0),
                "grand_total":        float(r[7] or 0),
                "status":             r[8] or "",
            }
            for r in rows
        ]
    except Exception:
        lines = []

    total_value = sum(l["grand_total"] for l in lines)
    return {
        "report_id":    "RPT-INV-007",
        "sh9_exe":      "SR210200",
        "from_date":    str(from_date or ""),
        "to_date":      str(to_date or ""),
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "total_returns": len(lines),
        "total_value":  round(total_value, 2),
        "lines":        lines,
    }


# ---------------------------------------------------------------------------
# RPT-INV-008: Stock Adjustments / Discrepancy  (Shoper9: SR211600.EXE MnuNo 430/436)
# GET /api/v1/inventory-reports/adjustments
# ---------------------------------------------------------------------------

@router.get("/adjustments")
async def stock_adjustments_report(
    from_date: Optional[date] = Query(default=None),
    to_date:   Optional[date] = Query(default=None),
    status:    Optional[str]  = Query(default=None, description="DRAFT|APPROVED|REJECTED"),
    reason:    Optional[str]  = Query(default=None),
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_company_db),
    current_user=Depends(get_current_user),
):
    """
    RPT-INV-008 -- Stock Adjustments / Discrepancy (Shoper9: SR211600.EXE MnuNo 430/436).
    Lists all stock adjustment entries with qty and value impact.
    Covers MnuNo 430/442 Inward Discrepancy (SR233700) when reason contains 'inward'.
    """
    params: Dict[str, Any] = {}
    clauses = ["is_deleted = false"]
    if tenant and tenant.company_id:
        clauses.append("company_id = :company_id")
        params["company_id"] = tenant.company_id
    if from_date:
        clauses.append("adjustment_date >= :from_date")
        params["from_date"] = from_date
    if to_date:
        params["to_date_next"] = (datetime.combine(to_date, datetime.min.time()) + timedelta(days=1)).date()
        clauses.append("adjustment_date < :to_date_next")
    if status:
        clauses.append("status = :status")
        params["status"] = status.upper()
    if reason:
        clauses.append("reason ILIKE :reason")
        params["reason"] = f"%{reason}%"

    where = " AND ".join(clauses)
    sql = f"""
        SELECT
            id, adjustment_no, document_number,
            adjustment_date, reason,
            total_adjustment_qty, total_adjustment_value,
            status, workflow_status, notes, created_at, created_by
        FROM stock_adjustments
        WHERE {where}
        ORDER BY adjustment_date DESC
        LIMIT 500
    """
    try:
        rows = (await db.execute(text(sql), params)).fetchall()
        lines = [
            {
                "adjustment_id":       r[0],
                "adjustment_no":       r[1] or r[2] or r[0],
                "document_number":     r[2] or "",
                "adjustment_date":     str(r[3]) if r[3] else str(r[10])[:10],
                "reason":              r[4] or "",
                "total_qty":           float(r[5] or 0),
                "total_value":         float(r[6] or 0),
                "status":              r[7] or "",
                "workflow_status":     r[8] or "",
                "notes":               r[9] or "",
                "created_by":          r[11] or "",
            }
            for r in rows
        ]
    except Exception:
        lines = []

    total_qty   = sum(l["total_qty"] for l in lines)
    total_value = sum(l["total_value"] for l in lines)
    by_status: Dict[str, int] = {}
    for l in lines:
        by_status[l["status"]] = by_status.get(l["status"], 0) + 1

    return {
        "report_id":    "RPT-INV-008",
        "sh9_exe":      "SR211600",
        "from_date":    str(from_date or ""),
        "to_date":      str(to_date or ""),
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "total_adjustments": len(lines),
        "total_qty_adjusted": round(total_qty, 2),
        "total_value_adjusted": round(total_value, 2),
        "by_status":    by_status,
        "lines":        lines,
    }
