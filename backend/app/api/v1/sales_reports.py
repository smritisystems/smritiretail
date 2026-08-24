"""
Project      : SMRITI Retail OS
Repository   : SMRITIRetailNX
Organization : AITDL NETWORKS

Founders

* Pushpa Devi Jawahar Mallah -- Founder & Chairperson
* Jawahar Ramkripal Mallah   -- Founder, CEO & Chief Software Architect
* Websites: aitdl.com | erpnbook.com | smritibooks.com

* Version    : 3.29.0
* Created    : 2026-08-24
* Modified   : 2026-08-24
* Copyright  : (c) AITDL.com and SMRITIBooks.com. All Rights Reserved.
* License    : Proprietary Commercial Software

Sprint 9 -- Sales Report parity.
Shoper9 MnuNo 410 Sales Reports (SR209600/SR209500/SR210000/SR221600/SR210200/SR231900).
"""

from datetime import date, datetime, timezone, timedelta
from decimal import Decimal
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func, text

from ...api.deps import get_company_db, get_tenant_context, get_current_user, TenantContext
from ...models.sales import SalesInvoice

router = APIRouter(prefix="/sales-reports")

# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------

def _t(stmt, model, tenant):
    """Apply tenant + branch scoping."""
    if tenant and tenant.company_id:
        stmt = stmt.where(
            (model.company_id == tenant.company_id) | (model.company_id.is_(None))
        )
    if tenant and tenant.branch_id:
        aliases = [tenant.branch_id, "MAIN", "BR-MAIN-001", "BR-001", "DEFAULT"]
        stmt = stmt.where(
            (model.branch_id.in_(aliases)) | (model.branch_id.is_(None))
        )
    return stmt

def _d(stmt, model, from_date, to_date):
    """Apply date range filter on created_at."""
    if from_date:
        stmt = stmt.where(model.created_at >= from_date)
    if to_date:
        next_day = datetime.combine(to_date, datetime.min.time()) + timedelta(days=1)
        stmt = stmt.where(model.created_at < next_day)
    return stmt

def _row(inv) -> Dict[str, Any]:
    """Safely extract invoice scalar fields."""
    return {
        "invoice_id":    inv.id,
        "invoice_no":    getattr(inv, "invoice_number", None) or inv.id,
        "date":          str(inv.created_at)[:10] if inv.created_at else "",
        "customer_id":   getattr(inv, "customer_id", None) or "",
        "customer_name": getattr(inv, "customer_name", None) or "Walk-in",
        "salesperson":   getattr(inv, "salesperson_name", None) or getattr(inv, "salesperson_id", None) or "",
        "branch":        getattr(inv, "branch_id", None) or "",
        "node":          getattr(inv, "terminal_id", None) or getattr(inv, "counter_id", None) or "",
        "total":         float(getattr(inv, "total_amount", None) or 0),
        "discount":      float(getattr(inv, "discount_amount", None) or 0),
        "tax":           float(getattr(inv, "tax_amount", None) or 0),
        "net":           float(getattr(inv, "net_amount", None) or 0),
        "status":        getattr(inv, "status", None) or "",
    }


# ---------------------------------------------------------------------------
# RPT-SAL-006: Top Selling Items  (Shoper9: SR209600.EXE MnuNo 410/418)
# GET /api/v1/sales-reports/top-selling
# ---------------------------------------------------------------------------

@router.get("/top-selling")
async def top_selling_items(
    from_date: Optional[date] = Query(default=None),
    to_date:   Optional[date] = Query(default=None),
    top_n:     int  = Query(default=20, ge=1, le=200, description="Number of top items to return"),
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_company_db),
    current_user=Depends(get_current_user),
):
    """
    RPT-SAL-006 -- Top Selling Items (Shoper9: SR209600.EXE MnuNo 410/418).
    Items ranked by total qty sold within the period from SalesInvoice line items.
    """
    params: Dict[str, Any] = {"top_n": top_n}
    clauses = ["si.is_deleted = false", "sil.is_deleted = false"]
    if tenant and tenant.company_id:
        clauses.append("si.company_id = :company_id")
        params["company_id"] = tenant.company_id
    if from_date:
        clauses.append("si.created_at >= :from_date")
        params["from_date"] = from_date
    if to_date:
        clauses.append("si.created_at < :to_date_next")
        params["to_date_next"] = datetime.combine(to_date, datetime.min.time()) + timedelta(days=1)

    where = " AND ".join(clauses)
    sql = f"""
        SELECT
            sil.product_id,
            sil.product_name,
            sil.sku,
            SUM(sil.quantity)                                AS total_qty,
            SUM(sil.quantity * sil.unit_price)               AS gross_value,
            SUM(sil.quantity * COALESCE(sil.discount_amount, 0)) AS total_discount,
            COUNT(DISTINCT si.id)                            AS invoice_count
        FROM sales_invoice_lines sil
        JOIN sales_invoices si ON sil.invoice_id = si.id
        WHERE {where}
        GROUP BY sil.product_id, sil.product_name, sil.sku
        ORDER BY total_qty DESC
        LIMIT :top_n
    """
    try:
        rows = (await db.execute(text(sql), params)).fetchall()
        lines = [
            {
                "rank":          i + 1,
                "product_id":    r[0],
                "product_name":  r[1] or "",
                "sku":           r[2] or "",
                "total_qty":     float(r[3] or 0),
                "gross_value":   float(r[4] or 0),
                "total_discount": float(r[5] or 0),
                "invoice_count": int(r[6] or 0),
            }
            for i, r in enumerate(rows)
        ]
    except Exception:
        # Fallback: aggregate from invoice-level if line-item table unavailable
        stmt = select(SalesInvoice).where(SalesInvoice.is_deleted == False)
        stmt = _t(stmt, SalesInvoice, tenant)
        stmt = _d(stmt, SalesInvoice, from_date, to_date)
        invs = (await db.execute(stmt)).scalars().all()
        lines = [{"note": "Line-item table unavailable; re-run after sales_invoice_lines migration", "count": len(invs)}]

    return {
        "report_id":    "RPT-SAL-006",
        "sh9_exe":      "SR209600",
        "from_date":    str(from_date or ""),
        "to_date":      str(to_date or ""),
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "top_n":        top_n,
        "lines":        lines,
    }


# ---------------------------------------------------------------------------
# RPT-SAL-007: Day-wise Sales Summary  (Shoper9: SR209500.EXE MnuNo 410/423)
# GET /api/v1/sales-reports/day-wise
# ---------------------------------------------------------------------------

@router.get("/day-wise")
async def day_wise_sales(
    from_date: Optional[date] = Query(default=None),
    to_date:   Optional[date] = Query(default=None),
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_company_db),
    current_user=Depends(get_current_user),
):
    """
    RPT-SAL-007 -- Day-wise Sales Summary (Shoper9: SR209500.EXE MnuNo 410/423).
    Aggregates SalesInvoice by calendar date: bill count, gross, discount, net, tax.
    """
    params: Dict[str, Any] = {}
    clauses = ["is_deleted = false", "status NOT IN ('CANCELLED', 'DRAFT')"]
    if tenant and tenant.company_id:
        clauses.append("company_id = :company_id")
        params["company_id"] = tenant.company_id
    if from_date:
        clauses.append("created_at >= :from_date")
        params["from_date"] = from_date
    if to_date:
        clauses.append("created_at < :to_date_next")
        params["to_date_next"] = datetime.combine(to_date, datetime.min.time()) + timedelta(days=1)

    where = " AND ".join(clauses)
    sql = f"""
        SELECT
            DATE(created_at AT TIME ZONE 'Asia/Kolkata') AS sale_date,
            COUNT(id)                                    AS bill_count,
            SUM(COALESCE(total_amount, 0))               AS gross_sales,
            SUM(COALESCE(discount_amount, 0))            AS total_discount,
            SUM(COALESCE(tax_amount, 0))                 AS total_tax,
            SUM(COALESCE(net_amount, 0))                 AS net_sales,
            COUNT(DISTINCT COALESCE(customer_id, 'walkin')) AS unique_customers
        FROM sales_invoices
        WHERE {where}
        GROUP BY sale_date
        ORDER BY sale_date DESC
    """
    rows = (await db.execute(text(sql), params)).fetchall()
    lines = [
        {
            "date":             str(r[0]),
            "bill_count":       int(r[1] or 0),
            "gross_sales":      float(r[2] or 0),
            "total_discount":   float(r[3] or 0),
            "total_tax":        float(r[4] or 0),
            "net_sales":        float(r[5] or 0),
            "unique_customers": int(r[6] or 0),
        }
        for r in rows
    ]
    grand = {
        "bill_count":     sum(l["bill_count"] for l in lines),
        "gross_sales":    sum(l["gross_sales"] for l in lines),
        "total_discount": sum(l["total_discount"] for l in lines),
        "total_tax":      sum(l["total_tax"] for l in lines),
        "net_sales":      sum(l["net_sales"] for l in lines),
    }
    return {
        "report_id":    "RPT-SAL-007",
        "sh9_exe":      "SR209500",
        "from_date":    str(from_date or ""),
        "to_date":      str(to_date or ""),
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "total_days":   len(lines),
        "grand_total":  grand,
        "lines":        lines,
    }


# ---------------------------------------------------------------------------
# RPT-SAL-008: Salesperson Sales Detail  (Shoper9: SR210000.EXE MnuNo 410/419)
# GET /api/v1/sales-reports/salesperson-sales
# ---------------------------------------------------------------------------

@router.get("/salesperson-sales")
async def salesperson_sales(
    from_date:       Optional[date] = Query(default=None),
    to_date:         Optional[date] = Query(default=None),
    salesperson_id:  Optional[str]  = Query(default=None),
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_company_db),
    current_user=Depends(get_current_user),
):
    """
    RPT-SAL-008 -- Salesperson Sales Detail (Shoper9: SR210000.EXE MnuNo 410/419).
    Invoice-level detail grouped by salesperson.
    """
    stmt = select(SalesInvoice).where(
        SalesInvoice.is_deleted == False,
        SalesInvoice.status.notin_(["CANCELLED", "DRAFT"]),
    )
    stmt = _t(stmt, SalesInvoice, tenant)
    stmt = _d(stmt, SalesInvoice, from_date, to_date)
    if salesperson_id:
        stmt = stmt.where(
            (SalesInvoice.salesperson_id == salesperson_id) |
            (SalesInvoice.salesperson_name.ilike(f"%{salesperson_id}%"))
        )
    stmt = stmt.order_by(SalesInvoice.created_at.desc()).limit(1000)
    invs = (await db.execute(stmt)).scalars().all()

    by_sp: Dict[str, dict] = {}
    lines = []
    for inv in invs:
        sp = getattr(inv, "salesperson_name", None) or getattr(inv, "salesperson_id", None) or "Unassigned"
        net = float(getattr(inv, "net_amount", None) or 0)
        disc = float(getattr(inv, "discount_amount", None) or 0)
        if sp not in by_sp:
            by_sp[sp] = {"salesperson": sp, "bill_count": 0, "net_sales": 0.0, "total_discount": 0.0}
        by_sp[sp]["bill_count"] += 1
        by_sp[sp]["net_sales"] += net
        by_sp[sp]["total_discount"] += disc
        lines.append({**_row(inv), "salesperson": sp})

    return {
        "report_id":     "RPT-SAL-008",
        "sh9_exe":       "SR210000",
        "from_date":     str(from_date or ""),
        "to_date":       str(to_date or ""),
        "generated_at":  datetime.now(timezone.utc).isoformat(),
        "total_invoices": len(lines),
        "summary_by_salesperson": sorted(by_sp.values(), key=lambda x: -x["net_sales"]),
        "lines":         lines,
    }


# ---------------------------------------------------------------------------
# RPT-SAL-009: Salesperson Summary  (Shoper9: SR221600.EXE MnuNo 410/426)
# GET /api/v1/sales-reports/salesperson-summary
# ---------------------------------------------------------------------------

@router.get("/salesperson-summary")
async def salesperson_summary(
    from_date: Optional[date] = Query(default=None),
    to_date:   Optional[date] = Query(default=None),
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_company_db),
    current_user=Depends(get_current_user),
):
    """
    RPT-SAL-009 -- Salesperson Summary (Shoper9: SR221600.EXE MnuNo 410/426).
    Aggregated performance summary per salesperson: bills, gross, discount, net, avg bill value.
    """
    params: Dict[str, Any] = {}
    clauses = ["is_deleted = false", "status NOT IN ('CANCELLED', 'DRAFT')"]
    if tenant and tenant.company_id:
        clauses.append("company_id = :company_id")
        params["company_id"] = tenant.company_id
    if from_date:
        clauses.append("created_at >= :from_date")
        params["from_date"] = from_date
    if to_date:
        clauses.append("created_at < :to_date_next")
        params["to_date_next"] = datetime.combine(to_date, datetime.min.time()) + timedelta(days=1)

    where = " AND ".join(clauses)
    sql = f"""
        SELECT
            COALESCE(salesperson_name, salesperson_id, 'Unassigned') AS sp,
            COUNT(id)                             AS bill_count,
            SUM(COALESCE(total_amount, 0))        AS gross_sales,
            SUM(COALESCE(discount_amount, 0))     AS total_discount,
            SUM(COALESCE(tax_amount, 0))          AS total_tax,
            SUM(COALESCE(net_amount, 0))          AS net_sales,
            AVG(COALESCE(net_amount, 0))          AS avg_bill_value
        FROM sales_invoices
        WHERE {where}
        GROUP BY sp
        ORDER BY net_sales DESC
    """
    rows = (await db.execute(text(sql), params)).fetchall()
    return {
        "report_id":    "RPT-SAL-009",
        "sh9_exe":      "SR221600",
        "from_date":    str(from_date or ""),
        "to_date":      str(to_date or ""),
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "total_salespersons": len(rows),
        "lines": [
            {
                "salesperson":    r[0],
                "bill_count":     int(r[1] or 0),
                "gross_sales":    float(r[2] or 0),
                "total_discount": float(r[3] or 0),
                "total_tax":      float(r[4] or 0),
                "net_sales":      float(r[5] or 0),
                "avg_bill_value": round(float(r[6] or 0), 2),
            }
            for r in rows
        ],
    }


# ---------------------------------------------------------------------------
# RPT-SAL-010: Returned Bills  (Shoper9: SR210200.EXE MnuNo 410/421)
# GET /api/v1/sales-reports/returned-bills
# ---------------------------------------------------------------------------

@router.get("/returned-bills")
async def returned_bills(
    from_date: Optional[date] = Query(default=None),
    to_date:   Optional[date] = Query(default=None),
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_company_db),
    current_user=Depends(get_current_user),
):
    """
    RPT-SAL-010 -- Returned Bills (Shoper9: SR210200.EXE MnuNo 410/421).
    All RETURNED status SalesInvoices within the period.
    """
    stmt = select(SalesInvoice).where(
        SalesInvoice.is_deleted == False,
        SalesInvoice.status == "RETURNED",
    )
    stmt = _t(stmt, SalesInvoice, tenant)
    stmt = _d(stmt, SalesInvoice, from_date, to_date)
    stmt = stmt.order_by(SalesInvoice.created_at.desc()).limit(500)
    invs = (await db.execute(stmt)).scalars().all()

    lines = [_row(inv) for inv in invs]
    total_net = sum(l["net"] for l in lines)
    return {
        "report_id":     "RPT-SAL-010",
        "sh9_exe":       "SR210200",
        "from_date":     str(from_date or ""),
        "to_date":       str(to_date or ""),
        "generated_at":  datetime.now(timezone.utc).isoformat(),
        "total_returns": len(lines),
        "total_value":   round(total_net, 2),
        "lines":         lines,
    }


# ---------------------------------------------------------------------------
# RPT-SAL-011: Node-wise Sales Details  (Shoper9: SR231900.EXE MnuNo 410/427)
# GET /api/v1/sales-reports/node-wise
# ---------------------------------------------------------------------------

@router.get("/node-wise")
async def node_wise_sales(
    from_date: Optional[date] = Query(default=None),
    to_date:   Optional[date] = Query(default=None),
    node_id:   Optional[str]  = Query(default=None, description="Filter by terminal/counter ID"),
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_company_db),
    current_user=Depends(get_current_user),
):
    """
    RPT-SAL-011 -- Node-wise Sales Details (Shoper9: SR231900.EXE MnuNo 410/427).
    Sales aggregated per POS node/terminal/counter within the period.
    """
    params: Dict[str, Any] = {}
    clauses = ["is_deleted = false", "status NOT IN ('CANCELLED', 'DRAFT')"]
    if tenant and tenant.company_id:
        clauses.append("company_id = :company_id")
        params["company_id"] = tenant.company_id
    if from_date:
        clauses.append("created_at >= :from_date")
        params["from_date"] = from_date
    if to_date:
        clauses.append("created_at < :to_date_next")
        params["to_date_next"] = datetime.combine(to_date, datetime.min.time()) + timedelta(days=1)
    if node_id:
        clauses.append("(terminal_id = :node_id OR counter_id = :node_id)")
        params["node_id"] = node_id

    where = " AND ".join(clauses)
    sql = f"""
        SELECT
            COALESCE(terminal_id, counter_id, 'UNKNOWN') AS node,
            branch_id,
            COUNT(id)                              AS bill_count,
            SUM(COALESCE(total_amount, 0))         AS gross_sales,
            SUM(COALESCE(discount_amount, 0))      AS total_discount,
            SUM(COALESCE(net_amount, 0))           AS net_sales,
            SUM(COALESCE(tax_amount, 0))           AS total_tax
        FROM sales_invoices
        WHERE {where}
        GROUP BY node, branch_id
        ORDER BY net_sales DESC
    """
    rows = (await db.execute(text(sql), params)).fetchall()
    return {
        "report_id":    "RPT-SAL-011",
        "sh9_exe":      "SR231900",
        "from_date":    str(from_date or ""),
        "to_date":      str(to_date or ""),
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "total_nodes":  len(rows),
        "lines": [
            {
                "node":           r[0],
                "branch_id":      r[1] or "",
                "bill_count":     int(r[2] or 0),
                "gross_sales":    float(r[3] or 0),
                "total_discount": float(r[4] or 0),
                "net_sales":      float(r[5] or 0),
                "total_tax":      float(r[6] or 0),
            }
            for r in rows
        ],
    }
