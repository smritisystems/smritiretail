"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.30.0
Created      : 2026-08-24
Modified     : 2026-08-26
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal

Shoper9 MnuNo 410 Sales Reports Integration (SR209600/SR209500/SR210000/SR221600/SR210200/SR231900/SR202000/SR236300/SR214100).
Canonical FastAPI + SQLAlchemy ORM backend implementation.
"""

from datetime import date, datetime, timezone, timedelta
from decimal import Decimal
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func, distinct, desc

from ...api.deps import get_company_db, get_tenant_context, get_current_user, TenantContext
from ...models.sales import SalesInvoice, SalesInvoiceItem, SalesReturn, SalesReturnItem
from ...models.inventory import Product

router = APIRouter(prefix="/sales-reports")

# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------

def _t(stmt, model, tenant: TenantContext):
    """Apply company and branch tenant scoping."""
    if tenant and tenant.company_id:
        stmt = stmt.where(
            (model.company_id == tenant.company_id) | (model.company_id.is_(None))
        )
    if tenant and tenant.branch_id:
        stmt = stmt.where(
            (model.branch_id == tenant.branch_id) | (model.branch_id.is_(None))
        )
    return stmt

def _d(stmt, model, from_date: Optional[date], to_date: Optional[date]):
    """Apply date range filter on date column."""
    if from_date:
        stmt = stmt.where(model.date >= from_date)
    if to_date:
        stmt = stmt.where(model.date <= to_date)
    return stmt

def _row(inv: SalesInvoice) -> Dict[str, Any]:
    """Safely extract invoice scalar fields."""
    return {
        "invoice_id":    inv.id,
        "invoice_no":    inv.invoice_no or inv.id,
        "date":          str(inv.date) if inv.date else "",
        "customer_id":   inv.customer_id or "",
        "customer_name": inv.customer_name or "Walk-in",
        "salesperson":   inv.salesperson_name or inv.salesperson_id or "",
        "terminal":      inv.terminal_id or inv.counter_id or "",
        "branch":        inv.branch_id or "",
        "gross":         float(inv.grand_total or 0),
        "discount":      float(inv.discount_amount or 0),
        "tax":           float(inv.tax_total or 0),
        "net":           float(inv.net_amount or 0),
        "paid":          float(inv.paid_amount or 0),
        "balance":       float(inv.balance_amount or 0),
        "status":        inv.status or "",
    }


# ---------------------------------------------------------------------------
# RPT-SAL-006: Top Selling Items  (Shoper9: SR209600.EXE MnuNo 410/418)
# GET /api/v1/sales-reports/top-selling
# ---------------------------------------------------------------------------

@router.get("/top-selling")
async def top_selling_items(
    from_date: Optional[date] = Query(default=None),
    to_date:   Optional[date] = Query(default=None),
    top_n:     int            = Query(default=20, ge=1, le=200, description="Number of top items to return"),
    tenant: TenantContext     = Depends(get_tenant_context),
    db: AsyncSession          = Depends(get_company_db),
    current_user              = Depends(get_current_user),
):
    """
    RPT-SAL-006 -- Top Selling Items (Shoper9: SR209600.EXE MnuNo 410/418).
    Items ranked by total quantity sold within the period from SalesInvoiceItem.
    """
    try:
        stmt = (
            select(
                SalesInvoiceItem.code,
                SalesInvoiceItem.name,
                Product.sku,
                func.sum(SalesInvoiceItem.quantity).label("total_qty"),
                func.sum(SalesInvoiceItem.total_amount).label("gross_value"),
                func.sum(
                    func.coalesce(SalesInvoiceItem.mrp, SalesInvoiceItem.price) * SalesInvoiceItem.quantity - SalesInvoiceItem.total_amount
                ).label("total_discount"),
                func.count(distinct(SalesInvoice.id)).label("invoice_count"),
                SalesInvoiceItem.product_id,
            )
            .join(SalesInvoice, SalesInvoiceItem.invoice_id == SalesInvoice.id)
            .outerjoin(Product, SalesInvoiceItem.product_id == Product.id)
            .where(
                SalesInvoice.is_deleted == False,
                SalesInvoice.status.notin_(["CANCELLED", "DRAFT"])
            )
        )
        stmt = _t(stmt, SalesInvoice, tenant)
        stmt = _d(stmt, SalesInvoice, from_date, to_date)
        stmt = (
            stmt.group_by(SalesInvoiceItem.code, SalesInvoiceItem.name, Product.sku, SalesInvoiceItem.product_id)
            .order_by(desc("total_qty"))
            .limit(top_n)
        )

        rows = (await db.execute(stmt)).all()
        lines = [
            {
                "rank":           i + 1,
                "product_id":     r[7] or r[0],
                "product_name":   r[1] or "",
                "sku":            r[2] or r[0] or "",
                "total_qty":      float(r[3] or 0),
                "gross_value":    float(r[4] or 0),
                "total_discount": max(0.0, float(r[5] or 0)),
                "invoice_count":  int(r[6] or 0),
            }
            for i, r in enumerate(rows)
        ]

        return {
            "report_id":    "RPT-SAL-006",
            "sh9_exe":      "SR209600",
            "from_date":    str(from_date or ""),
            "to_date":      str(to_date or ""),
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "top_n":        top_n,
            "total_items":  len(lines),
            "lines":        lines,
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate top-selling items report: {str(e)}"
        )


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
    try:
        stmt = (
            select(
                SalesInvoice.date.label("sale_date"),
                func.count(SalesInvoice.id).label("bill_count"),
                func.sum(func.coalesce(SalesInvoice.grand_total, 0)).label("gross_sales"),
                func.sum(func.coalesce(SalesInvoice.discount_amount, 0)).label("total_discount"),
                func.sum(func.coalesce(SalesInvoice.tax_total, 0)).label("total_tax"),
                func.sum(func.coalesce(SalesInvoice.net_amount, SalesInvoice.grand_total)).label("net_sales"),
                func.count(distinct(func.coalesce(SalesInvoice.customer_id, "walkin"))).label("unique_customers"),
            )
            .where(
                SalesInvoice.is_deleted == False,
                SalesInvoice.status.notin_(["CANCELLED", "DRAFT"])
            )
        )
        stmt = _t(stmt, SalesInvoice, tenant)
        stmt = _d(stmt, SalesInvoice, from_date, to_date)
        stmt = stmt.group_by(SalesInvoice.date).order_by(desc("sale_date"))

        rows = (await db.execute(stmt)).all()
        lines = [
            {
                "date":             str(r[0]) if r[0] else "",
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
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate day-wise sales report: {str(e)}"
        )


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
    try:
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
        stmt = stmt.order_by(SalesInvoice.date.desc(), SalesInvoice.created_at.desc()).limit(1000)
        invs = (await db.execute(stmt)).scalars().all()

        by_sp: Dict[str, dict] = {}
        lines = []
        for inv in invs:
            sp   = inv.salesperson_name or inv.salesperson_id or "Unassigned"
            net  = float(inv.net_amount or inv.grand_total or 0)
            disc = float(inv.discount_amount or 0)
            if sp not in by_sp:
                by_sp[sp] = {"salesperson": sp, "bill_count": 0, "net_sales": 0.0, "total_discount": 0.0}
            by_sp[sp]["bill_count"]    += 1
            by_sp[sp]["net_sales"]     += net
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
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate salesperson sales report: {str(e)}"
        )


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
    try:
        sp_col = func.coalesce(SalesInvoice.salesperson_name, SalesInvoice.salesperson_id, "Unassigned")
        stmt = (
            select(
                sp_col.label("salesperson"),
                func.count(SalesInvoice.id).label("bill_count"),
                func.sum(func.coalesce(SalesInvoice.grand_total, 0)).label("gross_sales"),
                func.sum(func.coalesce(SalesInvoice.discount_amount, 0)).label("total_discount"),
                func.sum(func.coalesce(SalesInvoice.tax_total, 0)).label("total_tax"),
                func.sum(func.coalesce(SalesInvoice.net_amount, SalesInvoice.grand_total)).label("net_sales"),
                func.avg(func.coalesce(SalesInvoice.grand_total, 0)).label("avg_bill_value"),
            )
            .where(
                SalesInvoice.is_deleted == False,
                SalesInvoice.status.notin_(["CANCELLED", "DRAFT"])
            )
        )
        stmt = _t(stmt, SalesInvoice, tenant)
        stmt = _d(stmt, SalesInvoice, from_date, to_date)
        stmt = stmt.group_by(sp_col).order_by(desc("net_sales"))

        rows = (await db.execute(stmt)).all()
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
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate salesperson summary report: {str(e)}"
        )


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
    All RETURNED status SalesInvoices or SalesReturns within the period.
    """
    try:
        stmt = select(SalesInvoice).where(
            SalesInvoice.is_deleted == False,
            SalesInvoice.status == "RETURNED",
        )
        stmt = _t(stmt, SalesInvoice, tenant)
        stmt = _d(stmt, SalesInvoice, from_date, to_date)
        stmt = stmt.order_by(SalesInvoice.date.desc(), SalesInvoice.created_at.desc()).limit(500)
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
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate returned bills report: {str(e)}"
        )


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
    try:
        node_col = func.coalesce(SalesInvoice.terminal_id, SalesInvoice.counter_id, "DEFAULT_NODE")
        stmt = (
            select(
                node_col.label("node"),
                SalesInvoice.branch_id,
                func.count(SalesInvoice.id).label("bill_count"),
                func.sum(func.coalesce(SalesInvoice.grand_total, 0)).label("gross_sales"),
                func.sum(func.coalesce(SalesInvoice.discount_amount, 0)).label("total_discount"),
                func.sum(func.coalesce(SalesInvoice.net_amount, SalesInvoice.grand_total)).label("net_sales"),
                func.sum(func.coalesce(SalesInvoice.tax_total, 0)).label("total_tax"),
            )
            .where(
                SalesInvoice.is_deleted == False,
                SalesInvoice.status.notin_(["CANCELLED", "DRAFT"])
            )
        )
        stmt = _t(stmt, SalesInvoice, tenant)
        stmt = _d(stmt, SalesInvoice, from_date, to_date)
        if node_id:
            stmt = stmt.where(
                (SalesInvoice.terminal_id == node_id) | (SalesInvoice.counter_id == node_id)
            )
        stmt = stmt.group_by(node_col, SalesInvoice.branch_id).order_by(desc("net_sales"))

        rows = (await db.execute(stmt)).all()
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
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate node-wise sales report: {str(e)}"
        )


# ---------------------------------------------------------------------------
# RPT-SAL-013: Bill-wise Items (Live -- sales_invoice_items)
# (Shoper9: SR202000.EXE MnuNo 410/415)
# GET /api/v1/sales-reports/bill-items-live & /bill-wise-items
# ---------------------------------------------------------------------------

@router.get("/bill-items-live")
@router.get("/bill-wise-items")
async def bill_wise_items_live(
    from_date:   Optional[date] = Query(default=None),
    to_date:     Optional[date] = Query(default=None),
    customer_id: Optional[str]  = Query(default=None),
    product_id:  Optional[str]  = Query(default=None),
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_company_db),
    current_user=Depends(get_current_user),
):
    """
    RPT-SAL-013 -- Bill-wise Items Live (Shoper9: SR202000.EXE MnuNo 410/415).
    Uses canonical sales_invoice_items table. Returns per-invoice line-item detail.
    """
    try:
        stmt = (
            select(
                SalesInvoice.invoice_no,
                SalesInvoice.date,
                SalesInvoice.customer_id,
                SalesInvoice.customer_name,
                SalesInvoice.payment_mode,
                SalesInvoice.grand_total,
                SalesInvoiceItem.id.label("line_id"),
                SalesInvoiceItem.line_no,
                SalesInvoiceItem.product_id,
                SalesInvoiceItem.name.label("product_name"),
                Product.sku,
                Product.size.label("size_label"),
                Product.color,
                SalesInvoiceItem.quantity,
                SalesInvoiceItem.price.label("unit_price"),
                SalesInvoiceItem.mrp,
                SalesInvoiceItem.disc_pct.label("discount_pct"),
                (func.coalesce(SalesInvoiceItem.mrp, SalesInvoiceItem.price) * SalesInvoiceItem.quantity - SalesInvoiceItem.total_amount).label("discount_amount"),
                SalesInvoiceItem.taxable_value,
                SalesInvoiceItem.gst_rate.label("tax_rate"),
                SalesInvoiceItem.tax_amount,
                SalesInvoiceItem.total_amount.label("net_amount"),
            )
            .join(SalesInvoice, SalesInvoiceItem.invoice_id == SalesInvoice.id)
            .outerjoin(Product, SalesInvoiceItem.product_id == Product.id)
            .where(
                SalesInvoice.is_deleted == False,
                SalesInvoice.status.notin_(["CANCELLED", "DRAFT"])
            )
        )
        stmt = _t(stmt, SalesInvoice, tenant)
        stmt = _d(stmt, SalesInvoice, from_date, to_date)
        if customer_id:
            stmt = stmt.where(
                (SalesInvoice.customer_id == customer_id) | (SalesInvoice.customer_name.ilike(f"%{customer_id}%"))
            )
        if product_id:
            stmt = stmt.where(
                (SalesInvoiceItem.product_id == product_id) | (SalesInvoiceItem.code == product_id)
            )
        stmt = stmt.order_by(SalesInvoice.date.desc(), SalesInvoice.invoice_no.asc(), SalesInvoiceItem.line_no.asc()).limit(2000)

        rows = (await db.execute(stmt)).all()

        invoices: Dict[str, dict] = {}
        for r in rows:
            inv_no = r[0]
            if inv_no not in invoices:
                invoices[inv_no] = {
                    "invoice_no":    r[0],
                    "date":          str(r[1]) if r[1] else "",
                    "customer_id":   r[2] or "",
                    "customer_name": r[3] or "Walk-in",
                    "payment_mode":  r[4] or "CASH",
                    "invoice_total": float(r[5] or 0),
                    "lines":         [],
                }
            invoices[inv_no]["lines"].append({
                "line_id":         r[6],
                "line_no":         r[7] or len(invoices[inv_no]["lines"]) + 1,
                "product_id":      r[8] or "",
                "product_name":    r[9] or "",
                "sku":             r[10] or "",
                "size_label":      r[11] or "",
                "color":           r[12] or "",
                "quantity":        float(r[13] or 0),
                "unit_price":      float(r[14] or 0),
                "mrp":             float(r[15] or 0),
                "discount_pct":    float(r[16] or 0),
                "discount_amount": max(0.0, float(r[17] or 0)),
                "taxable_value":   float(r[18] or 0),
                "tax_rate":        float(r[19] or 0),
                "tax_amount":      float(r[20] or 0),
                "net_amount":      float(r[21] or 0),
            })

        bills = list(invoices.values())
        return {
            "report_id":    "RPT-SAL-013",
            "sh9_exe":      "SR202000",
            "from_date":    str(from_date or ""),
            "to_date":      str(to_date or ""),
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "total_bills":  len(bills),
            "total_lines":  sum(len(b["lines"]) for b in bills),
            "bills":        bills,
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate bill-wise items report: {str(e)}"
        )


# ---------------------------------------------------------------------------
# RPT-SAL-014: Size / Attribute-wise Sales  (Shoper9: SR236300 MnuNo 410/422)
# GET /api/v1/sales-reports/size-wise & /attribute-size-wise
# ---------------------------------------------------------------------------

@router.get("/size-wise")
@router.get("/attribute-size-wise")
async def size_wise_sales(
    from_date:  Optional[date] = Query(default=None),
    to_date:    Optional[date] = Query(default=None),
    product_id: Optional[str]  = Query(default=None),
    size_label: Optional[str]  = Query(default=None),
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_company_db),
    current_user=Depends(get_current_user),
):
    """
    RPT-SAL-014 -- Attribute + Size wise Sales (Shoper9: SR236300.EXE MnuNo 410/422).
    Aggregates sales_invoice_items by product + size + color.
    """
    try:
        size_col = func.coalesce(Product.size, "Standard")
        color_col = func.coalesce(Product.color, "N/A")
        stmt = (
            select(
                SalesInvoiceItem.product_id,
                SalesInvoiceItem.name.label("product_name"),
                Product.sku,
                size_col.label("size_label"),
                color_col.label("color"),
                func.sum(SalesInvoiceItem.quantity).label("total_qty"),
                func.sum(SalesInvoiceItem.total_amount).label("total_net"),
                func.sum(
                    func.coalesce(SalesInvoiceItem.mrp, SalesInvoiceItem.price) * SalesInvoiceItem.quantity - SalesInvoiceItem.total_amount
                ).label("total_discount"),
                func.sum(SalesInvoiceItem.tax_amount).label("total_tax"),
                func.count(distinct(SalesInvoice.id)).label("invoice_count"),
            )
            .join(SalesInvoice, SalesInvoiceItem.invoice_id == SalesInvoice.id)
            .outerjoin(Product, SalesInvoiceItem.product_id == Product.id)
            .where(
                SalesInvoice.is_deleted == False,
                SalesInvoice.status.notin_(["CANCELLED", "DRAFT"])
            )
        )
        stmt = _t(stmt, SalesInvoice, tenant)
        stmt = _d(stmt, SalesInvoice, from_date, to_date)
        if product_id:
            stmt = stmt.where(
                (SalesInvoiceItem.product_id == product_id) | (SalesInvoiceItem.code == product_id)
            )
        if size_label:
            stmt = stmt.where(Product.size.ilike(f"%{size_label}%"))

        stmt = (
            stmt.group_by(SalesInvoiceItem.product_id, SalesInvoiceItem.name, Product.sku, size_col, color_col)
            .order_by(desc("total_qty"))
            .limit(500)
        )

        rows = (await db.execute(stmt)).all()
        lines = [
            {
                "product_id":     r[0] or "",
                "product_name":   r[1] or "",
                "sku":            r[2] or "",
                "size_label":     r[3],
                "color":          r[4],
                "total_qty":      float(r[5] or 0),
                "total_net":      float(r[6] or 0),
                "total_discount": max(0.0, float(r[7] or 0)),
                "total_tax":      float(r[8] or 0),
                "invoice_count":  int(r[9] or 0),
            }
            for r in rows
        ]

        return {
            "report_id":    "RPT-SAL-014",
            "sh9_exe":      "SR236300",
            "from_date":    str(from_date or ""),
            "to_date":      str(to_date or ""),
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "total_rows":   len(lines),
            "grand_qty":    round(sum(l["total_qty"] for l in lines), 2),
            "grand_net":    round(sum(l["total_net"] for l in lines), 2),
            "lines":        lines,
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate size-wise sales report: {str(e)}"
        )


# ---------------------------------------------------------------------------
# RPT-SAL-015: Item-wise Sales Returns  (Shoper9: SR214100 MnuNo 410/425)
# GET /api/v1/sales-reports/item-returns-live & /item-wise-returns
# ---------------------------------------------------------------------------

@router.get("/item-returns-live")
@router.get("/item-wise-returns")
async def item_wise_returns(
    from_date:  Optional[date] = Query(default=None),
    to_date:    Optional[date] = Query(default=None),
    product_id: Optional[str]  = Query(default=None),
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_company_db),
    current_user=Depends(get_current_user),
):
    """
    RPT-SAL-015 -- Item-wise Sales Returns (Shoper9: SR214100.EXE MnuNo 410/425).
    Queries SalesReturnItem joined with SalesReturn and Product.
    """
    try:
        stmt = (
            select(
                SalesReturnItem.product_id,
                SalesReturnItem.name.label("product_name"),
                Product.sku,
                func.count(distinct(SalesReturn.id)).label("return_count"),
                func.sum(SalesReturnItem.quantity).label("returned_qty"),
                func.sum(SalesReturnItem.total_amount).label("returned_value"),
                func.sum(SalesReturnItem.tax_amount).label("returned_tax"),
            )
            .join(SalesReturn, SalesReturnItem.return_id == SalesReturn.id)
            .outerjoin(Product, SalesReturnItem.product_id == Product.id)
            .where(
                SalesReturn.is_deleted == False,
                SalesReturn.status.notin_(["CANCELLED"])
            )
        )
        if tenant and tenant.company_id:
            stmt = stmt.where((SalesReturn.company_id == tenant.company_id) | (SalesReturn.company_id.is_(None)))
        if from_date:
            stmt = stmt.where(SalesReturn.date >= from_date)
        if to_date:
            stmt = stmt.where(SalesReturn.date <= to_date)
        if product_id:
            stmt = stmt.where(
                (SalesReturnItem.product_id == product_id) | (SalesReturnItem.code == product_id)
            )

        stmt = (
            stmt.group_by(SalesReturnItem.product_id, SalesReturnItem.name, Product.sku)
            .order_by(desc("returned_qty"))
            .limit(500)
        )

        rows = (await db.execute(stmt)).all()
        lines = [
            {
                "product_id":     r[0] or "",
                "product_name":   r[1] or "",
                "sku":            r[2] or "",
                "return_count":   int(r[3] or 0),
                "returned_qty":   float(r[4] or 0),
                "returned_value": float(r[5] or 0),
                "returned_tax":   float(r[6] or 0),
            }
            for r in rows
        ]

        return {
            "report_id":      "RPT-SAL-015",
            "sh9_exe":        "SR214100",
            "from_date":      str(from_date or ""),
            "to_date":        str(to_date or ""),
            "generated_at":   datetime.now(timezone.utc).isoformat(),
            "total_products": len(lines),
            "grand_qty":      round(sum(l["returned_qty"] for l in lines), 2),
            "grand_value":    round(sum(l["returned_value"] for l in lines), 2),
            "lines":          lines,
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate item-wise returns report: {str(e)}"
        )
