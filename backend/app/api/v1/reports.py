"""
Project      : SMRITI Retail OS
Repository   : SMRITIRetailNX
Organization : AITDL NETWORKS

Founders

* Pushpa Devi Jawahar Mallah — Founder & Chairperson
* Jawahar Ramkripal Mallah  — Founder, CEO & Chief Software Architect
* Websites: aitdl.com | erpnbook.com | smritibooks.com

* Version    : 3.21.0
* Created    : 2026-07-11
* Modified   : 2026-07-16
* Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
* License    : Proprietary Commercial Software
"""

from datetime import date
from typing import List, Optional
from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from ...api.deps import get_db, get_tenant_context, get_current_user, TenantContext
from ...schemas.reports import (
    StockValuationReport,
    DailySalesSummary,
    SupplierLedger,
    PurchaseSummaryLine,
)
from ...schemas.report_schedule import ReportScheduleCreate, ReportScheduleResponse
from ...services.reports import ReportsService

router = APIRouter(prefix="/reports")

# ─────────────────────────────────────────────────────────────────────────────
# Studios Catalog — System metadata; stored as Python dict per approved design.
# No DB table needed until custom studio support is introduced.
# ─────────────────────────────────────────────────────────────────────────────

SMRITI_STUDIOS = {
    "sales_studio": {
        "name": "Sales Report Studio",
        "description": "Gross revenue, ticket size, payment modes, sales returns & salesperson indices.",
        "icon": "bar_chart",
        "reports": [
            {"id": "RPT-SAL-001", "code": "RPT-SAL-001", "title": "Daily Sales Summary Register",     "description": "All completed cash, card, and UPI invoice records with aggregate revenue and average tickets.", "category": "Sales Summary",    "format": "Matrix", "owner": "System", "drillDownEnabled": True},
            {"id": "RPT-SAL-002", "code": "RPT-SAL-002", "title": "Sales Returns & Credit Notes Log",  "description": "Detailed log of product returns, reason analyses, and credit notes issued.",                 "category": "Returns",         "format": "Grid",   "owner": "System", "drillDownEnabled": True},
            {"id": "RPT-SAL-003", "code": "RPT-SAL-003", "title": "Top Selling Products Ledger",      "description": "Top performing items ranked by volume, revenue contributions, and margins.",                  "category": "Product Analysis","format": "Pivot",  "owner": "System", "drillDownEnabled": True},
            {"id": "RPT-SAL-004", "code": "RPT-SAL-004", "title": "Salesperson Performance Index",    "description": "Individual sales staff conversions, target tracking, and commission calculations.",           "category": "Staff Analysis",  "format": "Grid",   "owner": "Admin",  "drillDownEnabled": False},
        ],
    },
    "purchase_studio": {
        "name": "Purchase Report Studio",
        "description": "Supplier ledger, GRN register, PO outstanding, and payment tracking.",
        "icon": "inventory_2",
        "reports": [
            {"id": "RPT-PUR-001", "code": "RPT-PUR-001", "title": "Purchase Summary Register",         "description": "Per-supplier breakdown of PO count, GRN count, ordered and received amounts.",             "category": "Purchase Summary","format": "Grid",   "owner": "System", "drillDownEnabled": True},
            {"id": "RPT-PUR-002", "code": "RPT-PUR-002", "title": "Supplier Ledger",                  "description": "Chronological debit/credit ledger for a supplier with running balance.",                    "category": "Supplier",        "format": "Grid",   "owner": "System", "drillDownEnabled": True},
        ],
    },
    "inventory_studio": {
        "name": "Inventory Report Studio",
        "description": "Stock valuation, movement register, low-stock alerts, and expiry tracking.",
        "icon": "warehouse",
        "reports": [
            {"id": "RPT-INV-001", "code": "RPT-INV-001", "title": "Stock Valuation Report",            "description": "Current stock × cost price for every active product — inventory asset valuation.",        "category": "Valuation",       "format": "Grid",   "owner": "System", "drillDownEnabled": False},
        ],
    },
}


@router.get("/stock-valuation", response_model=StockValuationReport)
async def stock_valuation_report(
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_db),
):
    """
    Stock Valuation Report.

    Returns current `stock × cost_price` for every active product.
    Use this for inventory audit and asset valuation.
    """
    return await ReportsService(db, tenant).stock_valuation()


@router.get("/daily-sales", response_model=DailySalesSummary)
async def daily_sales_report(
    report_date: date = Query(description="Date to report (YYYY-MM-DD)"),
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_db),
):
    """
    Daily Sales Summary.

    Aggregates all sales invoices for the given date by payment mode (CASH / CARD / UPI / CREDIT).
    Also provides a per-shift breakdown if invoices are linked to shifts.
    """
    return await ReportsService(db, tenant).daily_sales(report_date)


@router.get("/supplier-ledger/{supplier_id}", response_model=SupplierLedger)
async def supplier_ledger(
    supplier_id: str,
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_db),
):
    """
    Supplier Ledger.

    Chronological debit (GRN/purchase) and credit (payment) ledger for a supplier,
    with running balance. Closing balance should match `supplier.outstanding`.
    """
    return await ReportsService(db, tenant).supplier_ledger(supplier_id)


@router.get("/purchase-summary", response_model=List[PurchaseSummaryLine])
async def purchase_summary(
    from_date: Optional[date] = Query(default=None, description="Start date (YYYY-MM-DD)"),
    to_date:   Optional[date] = Query(default=None, description="End date (YYYY-MM-DD)"),
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_db),
):
    """
    Purchase Summary.

    Per-supplier breakdown of PO count, GRN count, total ordered, total received,
    and current outstanding balance. Optionally filter by date range.
    """
    return await ReportsService(db, tenant).purchase_summary(from_date, to_date)


# ─────────────────────────────────────────────────────────────────────────────
# Studios Catalog
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/studios")
async def list_studios(
    current_user=Depends(get_current_user),
):
    """
    Report Studios Catalog.

    Returns all available report studios and their report definitions.
    The studios catalog is system metadata — static Python dict per approved architecture.
    Visible to all authenticated users regardless of role.
    """
    return {
        "studios": SMRITI_STUDIOS,
        "policyEnforcement": "SMRITI Rule 10 Non-Repudiation Schema Active",
    }


# ─────────────────────────────────────────────────────────────────────────────
# Report Schedule CRUD
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/schedules", response_model=List[ReportScheduleResponse])
async def list_report_schedules(
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    List all report schedules for the current tenant.
    Returns only non-deleted schedules, newest first.
    """
    if current_user.role not in ("SYSADMIN", "ADMIN", "MANAGER", "Report User"):
        raise HTTPException(status_code=403, detail="Access Denied: Insufficient role to view report schedules.")
    return await ReportsService(db, tenant).list_schedules()


@router.post("/schedules", response_model=ReportScheduleResponse, status_code=status.HTTP_201_CREATED)
async def create_report_schedule(
    payload: ReportScheduleCreate,
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Create a new report schedule.
    Report User role is blocked from write operations (preserves legacy Express behavior).
    MANAGER+ only.
    """
    if current_user.role == "Report User":
        raise HTTPException(
            status_code=403,
            detail="Access Denied: Operating under a Read-Only Report User role. Write operations are prohibited.",
        )
    if current_user.role not in ("SYSADMIN", "ADMIN", "MANAGER"):
        raise HTTPException(status_code=403, detail="Access Denied: MANAGER role or above required.")
    return await ReportsService(db, tenant).create_schedule(payload, created_by_id=current_user.id)


@router.delete("/schedules/{schedule_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_report_schedule(
    schedule_id: str,
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Soft-delete a report schedule. Tenant-scoped: cannot delete another tenant's schedule.
    MANAGER role required.
    """
    if current_user.role not in ("SYSADMIN", "ADMIN", "MANAGER"):
        raise HTTPException(status_code=403, detail="Access Denied: MANAGER role or above required.")
    await ReportsService(db, tenant).delete_schedule(schedule_id)
