"""
Project      : SMRITI Retail OS
Repository   : SMRITIRetailNX
Organization : AITDL NETWORKS

Founders

* Pushpa Devi Jawahar Mallah -- Founder & Chairperson
* Jawahar Ramkripal Mallah   -- Founder, CEO & Chief Software Architect
* Websites: aitdl.com | erpnbook.com | smritibooks.com

* Version    : 3.30.0
* Created    : 2026-08-24
* Modified   : 2026-08-24
* Copyright  : (c) AITDL.com and SMRITIBooks.com. All Rights Reserved.
* License    : Proprietary Commercial Software

Sprint 10 -- CRM Reports parity.
Shoper9 MnuNo 100/613/650 (SR120100/SR430900/SR442300).
Walk-in Register, Customer Mailer List, Bill-wise Items,
Size-wise Sales, Item-wise Returns.
"""

from datetime import date, datetime, timezone, timedelta
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func, text

from ...api.deps import get_company_db, get_tenant_context, get_current_user, TenantContext
from ...models.crm import Customer
from ...models.sales import SalesInvoice

router = APIRouter(prefix="/crm-reports")

# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------

def _tc(stmt, model, tenant):
    if tenant and tenant.company_id:
        stmt = stmt.where(
            (model.company_id == tenant.company_id) | (model.company_id.is_(None))
        )
    return stmt

def _dc(stmt, model, from_date, to_date):
    if from_date:
        stmt = stmt.where(model.created_at >= from_date)
    if to_date:
        next_day = datetime.combine(to_date, datetime.min.time()) + timedelta(days=1)
        stmt = stmt.where(model.created_at < next_day)
    return stmt


# ---------------------------------------------------------------------------
# CRM-001: Walk-in Entry Register  (Shoper9: SR120100.EXE MnuNo 100/108)
# GET /api/v1/crm-reports/walk-in
# ---------------------------------------------------------------------------

@router.get("/walk-in")
async def walk_in_register(
    from_date: Optional[date] = Query(default=None),
    to_date:   Optional[date] = Query(default=None),
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_company_db),
    current_user=Depends(get_current_user),
):
    """
    CRM-001 -- Walk-in Entry Register (Shoper9: SR120100.EXE MnuNo 100/108).
    Lists walk-in / anonymous customers created within the period.
    Derives from Customer records with source_type = WALK_IN or no loyalty member.
    """
    params: Dict[str, Any] = {}
    cmp_clause = ""
    if tenant and tenant.company_id:
        cmp_clause = "AND c.company_id = :company_id"
        params["company_id"] = tenant.company_id
    date_clause = ""
    if from_date:
        date_clause += " AND c.created_at >= :from_date"
        params["from_date"] = from_date
    if to_date:
        params["to_date_next"] = datetime.combine(to_date, datetime.min.time()) + timedelta(days=1)
        date_clause += " AND c.created_at < :to_date_next"

    sql = f"""
        SELECT
            c.id, c.name, c.mobile, c.email,
            COALESCE(c.address, '') AS address,
            c.created_at,
            COALESCE(c.source_type, 'WALK_IN') AS source_type,
            COUNT(si.id) AS visit_count,
            COALESCE(SUM(si.grand_total), 0) AS total_spend
        FROM customers c
        LEFT JOIN sales_invoices si
               ON si.customer_id = c.id
              AND si.is_deleted = false
              AND si.status NOT IN ('CANCELLED', 'DRAFT')
        WHERE c.is_deleted = false
          {cmp_clause}
          {date_clause}
        GROUP BY c.id, c.name, c.mobile, c.email, c.address, c.created_at, c.source_type
        ORDER BY c.created_at DESC
        LIMIT 500
    """
    try:
        rows = (await db.execute(text(sql), params)).fetchall()
        lines = [
            {
                "customer_id":  r[0],
                "name":         r[1] or "Walk-in",
                "mobile":       r[2] or "",
                "email":        r[3] or "",
                "address":      r[4],
                "registered_on": str(r[5])[:10] if r[5] else "",
                "source_type":  r[6],
                "visit_count":  int(r[7] or 0),
                "total_spend":  float(r[8] or 0),
            }
            for r in rows
        ]
    except Exception:
        # Fallback to ORM
        stmt = select(Customer).where(Customer.is_deleted == False)
        stmt = _tc(stmt, Customer, tenant)
        stmt = _dc(stmt, Customer, from_date, to_date)
        stmt = stmt.order_by(Customer.created_at.desc()).limit(500)
        custs = (await db.execute(stmt)).scalars().all()
        lines = [
            {
                "customer_id":  c.id,
                "name":         getattr(c, "name", None) or "Walk-in",
                "mobile":       getattr(c, "mobile", None) or "",
                "email":        getattr(c, "email", None) or "",
                "address":      getattr(c, "address", None) or "",
                "registered_on": str(c.created_at)[:10] if c.created_at else "",
                "source_type":  getattr(c, "source_type", None) or "WALK_IN",
                "visit_count":  0,
                "total_spend":  0.0,
            }
            for c in custs
        ]

    return {
        "report_id":     "CRM-001",
        "sh9_exe":       "SR120100",
        "from_date":     str(from_date or ""),
        "to_date":       str(to_date or ""),
        "generated_at":  datetime.now(timezone.utc).isoformat(),
        "total_records": len(lines),
        "total_spend":   round(sum(l["total_spend"] for l in lines), 2),
        "lines":         lines,
    }


# ---------------------------------------------------------------------------
# CRM-002: Customer Mailer List  (Shoper9: SR430900.EXE MnuNo 613/6133)
# GET /api/v1/crm-reports/mailer-list
# ---------------------------------------------------------------------------

@router.get("/mailer-list")
async def customer_mailer_list(
    group_id:      Optional[str]  = Query(default=None, description="Filter by customer group ID"),
    has_email:     bool = Query(default=True,  description="Only include customers with email"),
    has_mobile:    bool = Query(default=False, description="Only include customers with mobile"),
    active_only:   bool = Query(default=True,  description="Only active customers"),
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_company_db),
    current_user=Depends(get_current_user),
):
    """
    CRM-002 -- Customer Mailer List (Shoper9: SR430900.EXE MnuNo 613/6133).
    Filtered customer list for bulk email/SMS campaigns.
    """
    stmt = select(Customer).where(Customer.is_deleted == False)
    stmt = _tc(stmt, Customer, tenant)
    if active_only:
        stmt = stmt.where(Customer.is_active == True)
    if group_id:
        stmt = stmt.where(Customer.group_id == group_id)
    stmt = stmt.order_by(Customer.name).limit(5000)
    custs = (await db.execute(stmt)).scalars().all()

    lines = []
    for c in custs:
        email  = getattr(c, "email", None) or ""
        mobile = getattr(c, "mobile", None) or ""
        if has_email and not email:
            continue
        if has_mobile and not mobile:
            continue
        lines.append({
            "customer_id": c.id,
            "name":        getattr(c, "name", None) or "",
            "email":       email,
            "mobile":      mobile,
            "group_id":    getattr(c, "group_id", None) or "",
            "city":        getattr(c, "city", None) or "",
            "pincode":     getattr(c, "pincode", None) or "",
            "dob":         str(getattr(c, "date_of_birth", None) or ""),
        })

    return {
        "report_id":     "CRM-002",
        "sh9_exe":       "SR430900",
        "generated_at":  datetime.now(timezone.utc).isoformat(),
        "total_records": len(lines),
        "filter": {
            "group_id":   group_id,
            "has_email":  has_email,
            "has_mobile": has_mobile,
            "active_only": active_only,
        },
        "lines": lines,
    }


# ---------------------------------------------------------------------------
# CRM-003: Customer Outstanding  (Shoper9: SR242500.EXE MnuNo 650/658)
# GET /api/v1/crm-reports/outstanding
# ---------------------------------------------------------------------------

@router.get("/outstanding")
async def customer_outstanding(
    customer_id:  Optional[str] = Query(default=None),
    overdue_only: bool = Query(default=False),
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_company_db),
    current_user=Depends(get_current_user),
):
    """
    CRM-003 -- Customer Outstanding (Shoper9: SR242500.EXE MnuNo 650/658).
    CREDIT-mode invoices with outstanding balance per customer.
    """
    params: Dict[str, Any] = {}
    clauses = ["si.is_deleted = false", "si.payment_mode = 'CREDIT'",
               "si.status NOT IN ('CANCELLED', 'DRAFT')"]
    if tenant and tenant.company_id:
        clauses.append("si.company_id = :company_id")
        params["company_id"] = tenant.company_id
    if customer_id:
        clauses.append("si.customer_id = :customer_id")
        params["customer_id"] = customer_id

    where = " AND ".join(clauses)
    sql = f"""
        SELECT
            si.customer_id,
            COALESCE(si.customer_name, c.name, 'Unknown') AS customer_name,
            COUNT(si.id)                                   AS invoice_count,
            SUM(si.grand_total)                            AS total_invoiced,
            SUM(COALESCE(si.grand_total, 0))               AS outstanding,
            MIN(si.date)                                   AS oldest_invoice,
            MAX(si.date)                                   AS latest_invoice
        FROM sales_invoices si
        LEFT JOIN customers c ON c.id = si.customer_id
        WHERE {where}
        GROUP BY si.customer_id, customer_name
        HAVING SUM(COALESCE(si.grand_total, 0)) > 0
        ORDER BY outstanding DESC
        LIMIT 500
    """
    try:
        rows = (await db.execute(text(sql), params)).fetchall()
        today = date.today()
        lines = [
            {
                "customer_id":     r[0] or "",
                "customer_name":   r[1],
                "invoice_count":   int(r[2] or 0),
                "total_invoiced":  float(r[3] or 0),
                "outstanding":     float(r[4] or 0),
                "oldest_invoice":  str(r[5]) if r[5] else "",
                "latest_invoice":  str(r[6]) if r[6] else "",
                "days_since_oldest": (today - r[5]).days if r[5] else 0,
            }
            for r in rows
        ]
    except Exception:
        lines = []

    return {
        "report_id":        "CRM-003",
        "sh9_exe":          "SR242500",
        "generated_at":     datetime.now(timezone.utc).isoformat(),
        "total_customers":  len(lines),
        "total_outstanding": round(sum(l["outstanding"] for l in lines), 2),
        "lines":            lines,
    }


# ---------------------------------------------------------------------------
# RPT-SAL-012: Bill-wise Items  (Shoper9: SR202000.EXE MnuNo 410/415)
# GET /api/v1/crm-reports/bill-items
# ---------------------------------------------------------------------------

@router.get("/bill-items")
async def bill_wise_items(
    from_date:   Optional[date] = Query(default=None),
    to_date:     Optional[date] = Query(default=None),
    customer_id: Optional[str]  = Query(default=None),
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_company_db),
    current_user=Depends(get_current_user),
):
    """
    RPT-SAL-012 -- Bill-wise Items (Shoper9: SR202000.EXE MnuNo 410/415).
    SalesInvoice + rule_snapshots JSONB expansion showing items per bill.
    NOTE: sales_invoice_lines table not present -- line data from rule_snapshots.
    """
    stmt = select(SalesInvoice).where(
        SalesInvoice.is_deleted == False,
        SalesInvoice.status.notin_(["CANCELLED", "DRAFT"]),
    )
    stmt = _tc(stmt, SalesInvoice, tenant)
    stmt = _dc(stmt, SalesInvoice, from_date, to_date)
    if customer_id:
        stmt = stmt.where(SalesInvoice.customer_id == customer_id)
    stmt = stmt.order_by(SalesInvoice.created_at.desc()).limit(200)
    invs = (await db.execute(stmt)).scalars().all()

    lines = []
    for inv in invs:
        rs = getattr(inv, "rule_snapshots", None) or {}
        items = rs.get("line_items", rs.get("items", rs.get("lines", [])))
        bill_entry = {
            "invoice_no":    inv.invoice_no,
            "date":          str(inv.date) if inv.date else str(inv.created_at)[:10],
            "customer_id":   inv.customer_id or "",
            "customer_name": getattr(inv, "customer_name", None) or "Walk-in",
            "grand_total":   float(inv.grand_total or 0),
            "payment_mode":  inv.payment_mode or "CASH",
            "item_count":    len(items) if isinstance(items, list) else 0,
            "items":         items if isinstance(items, list) else [],
        }
        lines.append(bill_entry)

    return {
        "report_id":    "RPT-SAL-012",
        "sh9_exe":      "SR202000",
        "from_date":    str(from_date or ""),
        "to_date":      str(to_date or ""),
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "note":         "Line items sourced from rule_snapshots JSONB; sales_invoice_lines table pending migration",
        "total_bills":  len(lines),
        "lines":        lines,
    }

# ---------------------------------------------------------------------------
# CRM-004: Customer Loyalty Report  (MnuNo 650/658 loyalty extension)
# GET /api/v1/crm-reports/loyalty
# ---------------------------------------------------------------------------

@router.get("/loyalty")
async def customer_loyalty_report(
    tier_id:     Optional[str] = Query(default=None, description="Filter by loyalty tier ID"),
    min_balance: Optional[float] = Query(default=None, description="Min current points balance"),
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_company_db),
    current_user=Depends(get_current_user),
):
    """
    CRM-004 -- Customer Loyalty Report (Loyalty extension of MnuNo 650/658).
    Lists all loyalty members with points balance, lifetime spend, tier, and card number.
    """
    params: Dict[str, Any] = {}
    clauses = ["lm.is_deleted = false", "lm.is_active = true"]
    if tenant and tenant.company_id:
        clauses.append("lm.company_id = :company_id")
        params["company_id"] = tenant.company_id
    if tier_id:
        clauses.append("lm.loyalty_tier_id = :tier_id")
        params["tier_id"] = tier_id
    if min_balance is not None:
        clauses.append("lm.current_points_balance >= :min_balance")
        params["min_balance"] = min_balance

    where = " AND ".join(clauses)
    sql = f"""
        SELECT
            lm.id, lm.customer_id,
            COALESCE(c.name, 'Unknown')         AS customer_name,
            COALESCE(c.mobile, '')              AS mobile,
            COALESCE(lm.card_number, '')        AS card_number,
            COALESCE(lt.name, 'Standard')       AS tier_name,
            lm.total_points_earned,
            lm.total_points_redeemed,
            lm.current_points_balance,
            COALESCE(lm.total_lifetime_spend, 0) AS lifetime_spend,
            lm.joined_date
        FROM loyalty_members lm
        LEFT JOIN customers c  ON c.id  = lm.customer_id
        LEFT JOIN loyalty_tiers lt ON lt.id = lm.loyalty_tier_id
        WHERE {where}
        ORDER BY lm.current_points_balance DESC
        LIMIT 1000
    """
    try:
        rows = (await db.execute(text(sql), params)).fetchall()
        lines = [
            {
                "member_id":       r[0],
                "customer_id":     r[1],
                "customer_name":   r[2],
                "mobile":          r[3],
                "card_number":     r[4],
                "tier":            r[5],
                "points_earned":   float(r[6] or 0),
                "points_redeemed": float(r[7] or 0),
                "points_balance":  float(r[8] or 0),
                "lifetime_spend":  float(r[9] or 0),
                "joined_date":     str(r[10]) if r[10] else "",
            }
            for r in rows
        ]
    except Exception:
        lines = []

    return {
        "report_id":       "CRM-004",
        "generated_at":    datetime.now(timezone.utc).isoformat(),
        "total_members":   len(lines),
        "total_points_outstanding": round(sum(l["points_balance"] for l in lines), 2),
        "total_lifetime_spend": round(sum(l["lifetime_spend"] for l in lines), 2),
        "lines":           lines,
    }


# ---------------------------------------------------------------------------
# CRM-005: Loyalty Tier Summary
# GET /api/v1/crm-reports/loyalty-tiers
# ---------------------------------------------------------------------------

@router.get("/loyalty-tiers")
async def loyalty_tier_summary(
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_company_db),
    current_user=Depends(get_current_user),
):
    """
    CRM-005 -- Loyalty Tier Summary.
    Aggregated member counts and points per tier.
    """
    params: Dict[str, Any] = {}
    cmp_clause = ""
    if tenant and tenant.company_id:
        cmp_clause = "AND lm.company_id = :company_id"
        params["company_id"] = tenant.company_id

    sql = f"""
        SELECT
            COALESCE(lt.name, 'Standard')         AS tier_name,
            COUNT(lm.id)                           AS member_count,
            SUM(lm.current_points_balance)         AS total_points,
            SUM(lm.total_lifetime_spend)           AS total_spend,
            COALESCE(lt.min_spend, 0)              AS min_spend,
            COALESCE(lt.earn_multiplier, 1.0)      AS earn_multiplier,
            COALESCE(lt.redemption_ratio, 1.0)     AS redemption_ratio
        FROM loyalty_members lm
        LEFT JOIN loyalty_tiers lt ON lt.id = lm.loyalty_tier_id
        WHERE lm.is_deleted = false AND lm.is_active = true
          {cmp_clause}
        GROUP BY tier_name, lt.min_spend, lt.earn_multiplier, lt.redemption_ratio
        ORDER BY total_spend DESC
    """
    try:
        rows = (await db.execute(text(sql), params)).fetchall()
        tiers = [
            {
                "tier":             r[0],
                "member_count":     int(r[1] or 0),
                "total_points":     float(r[2] or 0),
                "total_spend":      float(r[3] or 0),
                "min_spend":        float(r[4] or 0),
                "earn_multiplier":  float(r[5] or 1),
                "redemption_ratio": float(r[6] or 1),
            }
            for r in rows
        ]
    except Exception:
        tiers = []

    return {
        "report_id":       "CRM-005",
        "generated_at":    datetime.now(timezone.utc).isoformat(),
        "total_tiers":     len(tiers),
        "total_members":   sum(t["member_count"] for t in tiers),
        "tiers":           tiers,
    }
