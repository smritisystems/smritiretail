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

Sprint 8b -- Business Ledger parity.
Cash Report endpoints derived from Shoper9 MnuNo 460 gap analysis.
Shoper9 EXE refs: SR203100, SR210600, SR212700, SR212900, SR234400,
                  SR203300, SR203200, SR242900.
"""

from datetime import date
from decimal import Decimal
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func, and_

from ...api.deps import get_company_db, get_tenant_context, get_current_user, TenantContext
from ...models.sales import SalesInvoice

router = APIRouter(prefix="/finance")

# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------

def _build_date_clause(model, from_date, to_date):
    clauses = [model.is_deleted == False]
    if from_date:
        clauses.append(model.date >= from_date)
    if to_date:
        clauses.append(model.date <= to_date)
    return clauses

def _tenant_clauses(model, tenant):
    clauses = []
    if tenant and tenant.company_id:
        clauses.append(
            (model.company_id == tenant.company_id)
            | (model.company_id.is_(None))
        )
    if tenant and tenant.branch_id:
        clauses.append(
            (model.branch_id == tenant.branch_id) | (model.branch_id.is_(None))
        )
    return clauses


# ---------------------------------------------------------------------------
# RPT-FIN-001: Cash Transaction Report  (Shoper9: SR203100.EXE MnuNo 460/461)
# GET /api/v1/finance/cash-transactions
# ---------------------------------------------------------------------------

@router.get("/cash-transactions")
async def cash_transactions(
    from_date: Optional[date] = Query(default=None, description="Start date YYYY-MM-DD"),
    to_date:   Optional[date] = Query(default=None, description="End date YYYY-MM-DD"),
    payment_mode: Optional[str] = Query(default=None, description="CASH / CARD / UPI / CREDIT"),
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_company_db),
    current_user=Depends(get_current_user),
):
    """
    RPT-FIN-001 -- Cash Transaction Report (Shoper9: SR203100.EXE).
    All cash-mode invoice transactions for the period with payment breakdown.
    MnuNo 460/461.
    """
    clauses = _build_date_clause(SalesInvoice, from_date, to_date)
    clauses += _tenant_clauses(SalesInvoice, tenant)
    if payment_mode:
        clauses.append(SalesInvoice.payment_mode.ilike(f"%{payment_mode}%"))

    res = await db.execute(
        select(SalesInvoice).where(*clauses).order_by(SalesInvoice.date)
    )
    invoices = res.scalars().all()

    lines = []
    by_mode: Dict[str, Decimal] = {}
    total = Decimal(0)

    for inv in invoices:
        net = Decimal(str(
            getattr(inv, "net_amount", None) or
            getattr(inv, "grand_total", None) or
            getattr(inv, "total_amount", "0") or "0"
        ))
        pm = (getattr(inv, "payment_mode", None) or "CASH").upper()
        total += net
        by_mode[pm] = by_mode.get(pm, Decimal(0)) + net
        lines.append({
            "invoice_id":     inv.id,
            "invoice_number": getattr(inv, "invoice_number", None) or inv.id,
            "date":           str(getattr(inv, "date", "") or ""),
            "payment_mode":   pm,
            "cashier":        getattr(inv, "salesperson_name", None) or getattr(inv, "cashier_name", ""),
            "customer":       getattr(inv, "customer_name", None) or "",
            "net_amount":     float(net),
        })

    return {
        "report_id":      "RPT-FIN-001",
        "sh9_exe":        "SR203100",
        "from_date":      str(from_date or ""),
        "to_date":        str(to_date or ""),
        "total_records":  len(lines),
        "total_amount":   float(total),
        "by_payment_mode": {k: float(v) for k, v in by_mode.items()},
        "lines":          lines,
    }


# ---------------------------------------------------------------------------
# RPT-FIN-002: Counter-wise Details  (Shoper9: SR210600.EXE MnuNo 460/464)
# GET /api/v1/finance/counter-wise
# ---------------------------------------------------------------------------

@router.get("/counter-wise")
async def counter_wise_details(
    from_date: Optional[date] = Query(default=None, description="Start date YYYY-MM-DD"),
    to_date:   Optional[date] = Query(default=None, description="End date YYYY-MM-DD"),
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_company_db),
    current_user=Depends(get_current_user),
):
    """
    RPT-FIN-002 -- Counter-wise Details (Shoper9: SR210600.EXE).
    Sales aggregated by POS register/counter.
    MnuNo 460/464.
    """
    clauses = _build_date_clause(SalesInvoice, from_date, to_date)
    clauses += _tenant_clauses(SalesInvoice, tenant)

    res = await db.execute(
        select(SalesInvoice).where(*clauses).order_by(SalesInvoice.date)
    )
    invoices = res.scalars().all()

    by_counter: Dict[str, dict] = {}
    for inv in invoices:
        counter = (
            getattr(inv, "register_id", None) or
            getattr(inv, "pos_register", None) or
            getattr(inv, "counter_id", None) or "MAIN"
        )
        net = Decimal(str(
            getattr(inv, "net_amount", None) or
            getattr(inv, "grand_total", "0") or "0"
        ))
        if counter not in by_counter:
            by_counter[counter] = {"bills": 0, "total": Decimal(0), "cash": Decimal(0), "card": Decimal(0)}
        pm = (getattr(inv, "payment_mode", None) or "CASH").upper()
        by_counter[counter]["bills"] += 1
        by_counter[counter]["total"] += net
        if "CARD" in pm:
            by_counter[counter]["card"] += net
        else:
            by_counter[counter]["cash"] += net

    counters = [
        {
            "counter_id":    k,
            "bills":         d["bills"],
            "total_sales":   float(d["total"]),
            "cash_sales":    float(d["cash"]),
            "card_sales":    float(d["card"]),
            "avg_ticket":    float(d["total"] / d["bills"]) if d["bills"] > 0 else 0.0,
        }
        for k, d in sorted(by_counter.items(), key=lambda x: -x[1]["total"])
    ]

    return {
        "report_id":    "RPT-FIN-002",
        "sh9_exe":      "SR210600",
        "from_date":    str(from_date or ""),
        "to_date":      str(to_date or ""),
        "total_counters": len(counters),
        "counters":     counters,
    }


# ---------------------------------------------------------------------------
# RPT-FIN-003: Credit Note Status  (Shoper9: SR212700.EXE MnuNo 460/465)
# GET /api/v1/finance/credit-note-status
# ---------------------------------------------------------------------------

@router.get("/credit-note-status")
async def credit_note_status(
    from_date: Optional[date] = Query(default=None, description="Start date YYYY-MM-DD"),
    to_date:   Optional[date] = Query(default=None, description="End date YYYY-MM-DD"),
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_company_db),
    current_user=Depends(get_current_user),
):
    """
    RPT-FIN-003 -- Credit Note Status (Shoper9: SR212700.EXE).
    All open and utilised credit notes in the period.
    MnuNo 460/465.
    """
    # Credit notes are return invoices or credit_note status invoices
    clauses = [SalesInvoice.is_deleted == False]
    clauses += _tenant_clauses(SalesInvoice, tenant)

    # Filter for return/credit note type
    type_col = (
        getattr(SalesInvoice, "invoice_type", None) or
        getattr(SalesInvoice, "transaction_type", None)
    )
    # Safely build type filter
    try:
        clauses.append(SalesInvoice.invoice_type.in_(["CREDIT_NOTE", "RETURN", "CN"]))
    except AttributeError:
        pass  # invoice_type column may not exist; return all

    if from_date:
        clauses.append(SalesInvoice.date >= from_date)
    if to_date:
        clauses.append(SalesInvoice.date <= to_date)

    res = await db.execute(select(SalesInvoice).where(*clauses).order_by(SalesInvoice.date))
    notes = res.scalars().all()

    total_issued = Decimal(0)
    total_utilised = Decimal(0)
    lines = []
    for n in notes:
        amt  = Decimal(str(getattr(n, "grand_total", None) or getattr(n, "total_amount", "0") or "0"))
        used = Decimal(str(getattr(n, "amount_utilised", None) or getattr(n, "utilized_amount", "0") or "0"))
        bal  = amt - used
        total_issued += amt
        total_utilised += used
        lines.append({
            "credit_note_number": getattr(n, "invoice_number", None) or n.id,
            "date":               str(getattr(n, "date", "") or ""),
            "customer":           getattr(n, "customer_name", None) or "",
            "amount_issued":      float(amt),
            "amount_utilised":    float(used),
            "balance":            float(bal),
            "status":             "OPEN" if bal > 0 else "FULLY_USED",
        })

    return {
        "report_id":       "RPT-FIN-003",
        "sh9_exe":         "SR212700",
        "from_date":       str(from_date or ""),
        "to_date":         str(to_date or ""),
        "total_notes":     len(lines),
        "total_issued":    float(total_issued),
        "total_utilised":  float(total_utilised),
        "total_balance":   float(total_issued - total_utilised),
        "lines":           lines,
    }


# ---------------------------------------------------------------------------
# RPT-FIN-004: Counter Summary across Cashiers  (Shoper9: SR212900.EXE MnuNo 460/466)
# GET /api/v1/finance/counter-summary
# ---------------------------------------------------------------------------

@router.get("/counter-summary")
async def counter_summary(
    report_date: Optional[date] = Query(default=None, description="Report date YYYY-MM-DD"),
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_company_db),
    current_user=Depends(get_current_user),
):
    """
    RPT-FIN-004 -- Counter Summary across Cashiers (Shoper9: SR212900.EXE).
    Per-cashier/salesperson aggregated sales for a single day.
    MnuNo 460/466.
    """
    clauses = [SalesInvoice.is_deleted == False, SalesInvoice.status != "CANCELLED"]
    clauses += _tenant_clauses(SalesInvoice, tenant)
    if report_date:
        clauses.append(SalesInvoice.date == report_date)

    res = await db.execute(select(SalesInvoice).where(*clauses))
    invoices = res.scalars().all()

    by_cashier: Dict[str, dict] = {}
    for inv in invoices:
        cashier = (
            getattr(inv, "salesperson_name", None) or
            getattr(inv, "cashier_name", None) or "Unknown"
        )
        counter = getattr(inv, "register_id", None) or "MAIN"
        key = f"{counter}:{cashier}"
        net = Decimal(str(
            getattr(inv, "net_amount", None) or
            getattr(inv, "grand_total", "0") or "0"
        ))
        disc = Decimal(str(getattr(inv, "discount_amount", None) or getattr(inv, "discount", "0") or "0"))
        if key not in by_cashier:
            by_cashier[key] = {
                "cashier": cashier, "counter": counter,
                "bills": 0, "total": Decimal(0), "discount": Decimal(0),
            }
        by_cashier[key]["bills"] += 1
        by_cashier[key]["total"] += net
        by_cashier[key]["discount"] += disc

    summary = [
        {
            "counter_id":     d["counter"],
            "cashier_name":   d["cashier"],
            "bills_handled":  d["bills"],
            "total_sales":    float(d["total"]),
            "total_discount": float(d["discount"]),
            "avg_ticket":     float(d["total"] / d["bills"]) if d["bills"] > 0 else 0.0,
        }
        for d in sorted(by_cashier.values(), key=lambda x: -x["total"])
    ]

    return {
        "report_id":      "RPT-FIN-004",
        "sh9_exe":        "SR212900",
        "report_date":    str(report_date or ""),
        "total_cashiers": len(summary),
        "grand_total":    float(sum(Decimal(str(s["total_sales"])) for s in summary)),
        "summary":        summary,
    }


# ---------------------------------------------------------------------------
# RPT-FIN-005: Advance Receipt Status  (Shoper9: SR234400.EXE MnuNo 460/467)
# GET /api/v1/finance/advance-receipts
# ---------------------------------------------------------------------------

@router.get("/advance-receipts")
async def advance_receipt_status(
    from_date: Optional[date] = Query(default=None, description="Start date YYYY-MM-DD"),
    to_date:   Optional[date] = Query(default=None, description="End date YYYY-MM-DD"),
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_company_db),
    current_user=Depends(get_current_user),
):
    """
    RPT-FIN-005 -- Advance Receipt Status (Shoper9: SR234400.EXE).
    Advance/deposit payments received but not yet adjusted against invoices.
    MnuNo 460/467.
    """
    clauses = [SalesInvoice.is_deleted == False]
    clauses += _tenant_clauses(SalesInvoice, tenant)

    # Advance receipts are invoices with type ADVANCE / DEPOSIT or have advance_amount > 0
    try:
        clauses.append(SalesInvoice.invoice_type.in_(["ADVANCE", "DEPOSIT", "ADVANCE_RECEIPT"]))
    except AttributeError:
        # Fallback: look for payment_mode = ADVANCE
        try:
            clauses.append(SalesInvoice.payment_mode.ilike("%advance%"))
        except AttributeError:
            pass

    if from_date:
        clauses.append(SalesInvoice.date >= from_date)
    if to_date:
        clauses.append(SalesInvoice.date <= to_date)

    res = await db.execute(
        select(SalesInvoice).where(*clauses).order_by(SalesInvoice.date)
    )
    receipts = res.scalars().all()

    total_received = Decimal(0)
    total_adjusted = Decimal(0)
    lines = []
    for r in receipts:
        amt  = Decimal(str(getattr(r, "grand_total", None) or getattr(r, "total_amount", "0") or "0"))
        adj  = Decimal(str(getattr(r, "amount_adjusted", None) or getattr(r, "adjusted_amount", "0") or "0"))
        bal  = amt - adj
        total_received += amt
        total_adjusted += adj
        lines.append({
            "receipt_number": getattr(r, "invoice_number", None) or r.id,
            "date":           str(getattr(r, "date", "") or ""),
            "customer":       getattr(r, "customer_name", None) or "",
            "amount_received": float(amt),
            "amount_adjusted": float(adj),
            "balance":         float(bal),
            "status":          "PENDING" if bal > 0 else "ADJUSTED",
        })

    return {
        "report_id":       "RPT-FIN-005",
        "sh9_exe":         "SR234400",
        "from_date":       str(from_date or ""),
        "to_date":         str(to_date or ""),
        "total_receipts":  len(lines),
        "total_received":  float(total_received),
        "total_adjusted":  float(total_adjusted),
        "total_pending":   float(total_received - total_adjusted),
        "lines":           lines,
    }

# ---------------------------------------------------------------------------
# RPT-FIN-006: Reconciliation Report  (Shoper9: SR239600.EXE MnuNo 460/469)
# GET /api/v1/finance/reconciliation
# ---------------------------------------------------------------------------

@router.get("/reconciliation")
async def reconciliation_report(
    from_date: Optional[date] = Query(default=None),
    to_date:   Optional[date] = Query(default=None),
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_company_db),
    current_user=Depends(get_current_user),
):
    """
    RPT-FIN-006 -- Reconciliation Report (Shoper9: SR239600.EXE MnuNo 460/469).
    Compares expected cash (from sales) vs actual declared cash per shift/counter.
    """
    date_clause = _build_date_clause(from_date, to_date)
    _, params = _tenant_clauses(tenant)
    sql = f"""
        SELECT id,
               COALESCE(counter_id, 'MAIN') AS counter,
               opening_balance,
               COALESCE(cash_in_hand, 0)    AS declared_cash,
               COALESCE(total_sales, 0)     AS total_sales,
               COALESCE(total_returns, 0)   AS total_returns,
               status, created_at
        FROM pos_shifts
        WHERE is_deleted = false
          {(' AND company_id = :company_id' if tenant and tenant.company_id else '')}
          {date_clause}
        ORDER BY created_at DESC LIMIT 200
    """
    try:
        rows = (await db.execute(text(sql), params)).fetchall()
        lines = [
            {
                "shift_id":        r[0],
                "counter":         r[1],
                "opening_balance": float(r[2] or 0),
                "declared_cash":   float(r[3] or 0),
                "total_sales":     float(r[4] or 0),
                "total_returns":   float(r[5] or 0),
                "expected_cash":   float((r[2] or 0) + (r[4] or 0) - (r[5] or 0)),
                "variance":        float((r[3] or 0) - ((r[2] or 0) + (r[4] or 0) - (r[5] or 0))),
                "status":          r[6] or "",
                "date":            str(r[7])[:10] if r[7] else "",
            }
            for r in rows
        ]
    except Exception:
        lines = []
    return {
        "report_id":      "RPT-FIN-006",
        "sh9_exe":        "SR239600",
        "from_date":      str(from_date or ""),
        "to_date":        str(to_date or ""),
        "generated_at":   datetime.now(timezone.utc).isoformat(),
        "total_shifts":   len(lines),
        "total_variance": round(sum(l["variance"] for l in lines), 2),
        "lines":          lines,
    }


# ---------------------------------------------------------------------------
# RPT-FIN-007: Till Status Report  (Shoper9: SR239600.EXE MnuNo 460/470)
# GET /api/v1/finance/till-status
# ---------------------------------------------------------------------------

@router.get("/till-status")
async def till_status(
    as_on_date: Optional[date] = Query(default=None),
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_company_db),
    current_user=Depends(get_current_user),
):
    """
    RPT-FIN-007 -- Till Status Report (Shoper9: SR239600.EXE MnuNo 460/470).
    Current open-shift status per till/counter.
    """
    params: Dict[str, Any] = {}
    cmp_clause = ""
    if tenant and tenant.company_id:
        cmp_clause = "AND company_id = :company_id"
        params["company_id"] = tenant.company_id
    as_on = as_on_date or date.today()
    params["as_on"] = as_on
    sql = f"""
        SELECT id, COALESCE(counter_id, 'MAIN') AS counter,
               COALESCE(cashier_name, cashier_id, 'Unknown') AS cashier,
               opening_balance,
               COALESCE(cash_in_hand, opening_balance, 0) AS cash_in_hand,
               status, created_at
        FROM pos_shifts
        WHERE is_deleted = false AND status IN ('OPEN', 'ACTIVE')
          {cmp_clause}
          AND DATE(created_at) = :as_on
        ORDER BY created_at DESC
    """
    try:
        rows = (await db.execute(text(sql), params)).fetchall()
        lines = [
            {
                "shift_id":        r[0],
                "counter":         r[1],
                "cashier":         r[2],
                "opening_balance": float(r[3] or 0),
                "cash_in_hand":    float(r[4] or 0),
                "status":          r[5] or "",
                "opened_at":       str(r[6])[:19] if r[6] else "",
            }
            for r in rows
        ]
    except Exception:
        lines = []
    return {
        "report_id":          "RPT-FIN-007",
        "sh9_exe":            "SR239600",
        "as_on_date":         str(as_on),
        "generated_at":       datetime.now(timezone.utc).isoformat(),
        "open_tills":         len(lines),
        "total_cash_in_hand": round(sum(l["cash_in_hand"] for l in lines), 2),
        "lines":              lines,
    }


# ---------------------------------------------------------------------------
# RPT-FIN-008: Till Activity Log  (Shoper9: SR240400.EXE MnuNo 460/471)
# GET /api/v1/finance/till-activity
# ---------------------------------------------------------------------------

@router.get("/till-activity")
async def till_activity_log(
    from_date:  Optional[date] = Query(default=None),
    to_date:    Optional[date] = Query(default=None),
    counter_id: Optional[str]  = Query(default=None),
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_company_db),
    current_user=Depends(get_current_user),
):
    """
    RPT-FIN-008 -- Till Activity Log (Shoper9: SR240400.EXE MnuNo 460/471).
    Chronological log of all till shift events.
    """
    date_clause = _build_date_clause(from_date, to_date)
    _, params = _tenant_clauses(tenant)
    counter_clause = ""
    if counter_id:
        counter_clause = "AND counter_id = :counter_id"
        params["counter_id"] = counter_id
    sql = f"""
        SELECT id, COALESCE(counter_id,'MAIN') AS counter,
               COALESCE(cashier_name, cashier_id) AS cashier,
               status, opening_balance,
               COALESCE(cash_in_hand, 0) AS cash_in_hand,
               COALESCE(total_sales, 0)  AS total_sales,
               created_at, modified_at
        FROM pos_shifts
        WHERE is_deleted = false
          {(' AND company_id = :company_id' if tenant and tenant.company_id else '')}
          {date_clause} {counter_clause}
        ORDER BY created_at DESC LIMIT 500
    """
    try:
        rows = (await db.execute(text(sql), params)).fetchall()
        lines = [
            {
                "shift_id":        r[0],
                "counter":         r[1],
                "cashier":         r[2] or "",
                "event":           r[3] or "",
                "opening_balance": float(r[4] or 0),
                "cash_in_hand":    float(r[5] or 0),
                "total_sales":     float(r[6] or 0),
                "opened_at":       str(r[7])[:19] if r[7] else "",
                "closed_at":       str(r[8])[:19] if r[8] else "",
            }
            for r in rows
        ]
    except Exception:
        lines = []
    return {
        "report_id":    "RPT-FIN-008",
        "sh9_exe":      "SR240400",
        "from_date":    str(from_date or ""),
        "to_date":      str(to_date or ""),
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "total_events": len(lines),
        "lines":        lines,
    }


# ---------------------------------------------------------------------------
# RPT-FIN-009: Credit Sale Report  (Shoper9: SR242900.EXE MnuNo 460/4702)
# GET /api/v1/finance/credit-sale
# ---------------------------------------------------------------------------

@router.get("/credit-sale")
async def credit_sale_report(
    from_date:    Optional[date] = Query(default=None),
    to_date:      Optional[date] = Query(default=None),
    overdue_only: bool = Query(default=False),
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_company_db),
    current_user=Depends(get_current_user),
):
    """
    RPT-FIN-009 -- Credit Sale Report (Shoper9: SR242900.EXE MnuNo 460/4702).
    SalesInvoices with payment_mode=CREDIT — outstanding balances and due dates.
    """
    date_clause = _build_date_clause(from_date, to_date)
    _, params = _tenant_clauses(tenant)
    sql = f"""
        SELECT id, invoice_number,
               COALESCE(customer_name, 'Walk-in') AS customer,
               customer_id,
               COALESCE(net_amount, 0)            AS net_amount,
               COALESCE(paid_amount, 0)           AS paid_amount,
               COALESCE(net_amount, 0) - COALESCE(paid_amount, 0) AS balance,
               COALESCE(due_date, created_at + INTERVAL '30 days') AS due_date,
               created_at, status
        FROM sales_invoices
        WHERE is_deleted = false AND payment_mode = 'CREDIT'
          AND status NOT IN ('CANCELLED')
          {(' AND company_id = :company_id' if tenant and tenant.company_id else '')}
          {date_clause}
        ORDER BY due_date ASC LIMIT 500
    """
    try:
        rows = (await db.execute(text(sql), params)).fetchall()
        today = date.today()
        lines = []
        for r in rows:
            is_overdue = (hasattr(r[7], 'date') and r[7].date() < today)
            if overdue_only and not is_overdue:
                continue
            lines.append({
                "invoice_id":     r[0],
                "invoice_number": r[1] or r[0],
                "customer":       r[2],
                "customer_id":    r[3] or "",
                "net_amount":     float(r[4] or 0),
                "paid_amount":    float(r[5] or 0),
                "balance":        float(r[6] or 0),
                "due_date":       str(r[7])[:10] if r[7] else "",
                "invoice_date":   str(r[8])[:10] if r[8] else "",
                "status":         r[9] or "",
                "overdue":        is_overdue,
            })
    except Exception:
        lines = []
    return {
        "report_id":         "RPT-FIN-009",
        "sh9_exe":           "SR242900",
        "from_date":         str(from_date or ""),
        "to_date":           str(to_date or ""),
        "generated_at":      datetime.now(timezone.utc).isoformat(),
        "total_invoices":    len(lines),
        "total_outstanding": round(sum(l["balance"] for l in lines), 2),
        "overdue_count":     sum(1 for l in lines if l["overdue"]),
        "lines":             lines,
    }
