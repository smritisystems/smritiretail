"""
Project      : SMRITI Retail OS
Repository   : SMRITIRetailNX
Organization : AITDL NETWORKS

Founders

* Pushpa Devi Jawahar Mallah — Founder & Chairperson
* Jawahar Ramkripal Mallah  — Founder, CEO & Chief Software Architect
* Websites: aitdl.com | erpnbook.com | smritibooks.com

* Version    : 3.23.0
* Created    : 2026-07-11
* Modified   : 2026-08-15
* Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
* License    : Proprietary Commercial Software
"""

from datetime import date
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, insert, update

from ...api.deps import get_db, get_tenant_context, get_current_user, TenantContext
from ...schemas.reports import (
    StockValuationReport,
    DailySalesSummary,
    SupplierLedger,
    PurchaseSummaryLine,
)
from ...schemas.report_schedule import ReportScheduleCreate, ReportScheduleResponse
from ...services.reports import ReportsService
from ...models.reporting import ReportDefinition, ReportSavedView, Dashboard, DashboardWidget

router = APIRouter(prefix="/reports")

# ─────────────────────────────────────────────────────────────────────────────
# Studios Catalog — System metadata; stored as Python dict per approved design.
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
    "profitability_studio": {
        "name": "Profitability & Cost Studio",
        "description": "Multi-cost valuation (WAC, FIFO, Landed Cost) & Net Contribution waterfall.",
        "icon": "trending_up",
        "reports": [
            {"id": "RPT-PRF-001", "code": "RPT-PRF-001", "title": "Invoice Net Contribution Ledger",   "description": "Gross sales minus COGS, commissions, discounts, loyalty, referral, and delivery costs.",    "category": "Profitability",   "format": "Matrix", "owner": "System", "drillDownEnabled": True},
        ],
    },
}

@router.get("/stock-valuation", response_model=StockValuationReport)
async def stock_valuation_report(
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_db),
):
    return await ReportsService(db, tenant).stock_valuation()

@router.get("/daily-sales", response_model=DailySalesSummary)
async def daily_sales_report(
    report_date: date = Query(description="Date to report (YYYY-MM-DD)"),
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_db),
):
    return await ReportsService(db, tenant).daily_sales(report_date)

@router.get("/supplier-ledger/{supplier_id}", response_model=SupplierLedger)
async def supplier_ledger(
    supplier_id: str,
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_db),
):
    return await ReportsService(db, tenant).supplier_ledger(supplier_id)

@router.get("/purchase-summary", response_model=List[PurchaseSummaryLine])
async def purchase_summary(
    from_date: Optional[date] = Query(default=None, description="Start date (YYYY-MM-DD)"),
    to_date:   Optional[date] = Query(default=None, description="End date (YYYY-MM-DD)"),
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_db),
):
    return await ReportsService(db, tenant).purchase_summary(from_date, to_date)

@router.get("/studios")
async def list_studios(
    current_user=Depends(get_current_user),
):
    return {
        "studios": SMRITI_STUDIOS,
        "policyEnforcement": "SMRITI Rule 10 Non-Repudiation Schema Active",
    }

# ─────────────────────────────────────────────────────────────────────────────
# Flexi Report Studio & Report Definitions API
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/definitions")
async def list_report_definitions(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """List all available report definitions."""
    res = await db.execute(select(ReportDefinition).where(ReportDefinition.is_active == True))
    items = res.scalars().all()
    return {"definitions": items}

@router.post("/definitions", status_code=status.HTTP_201_CREATED)
async def create_report_definition(
    payload: Dict[str, Any],
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Create a new custom report definition via Report Studio."""
    report = ReportDefinition(
        code=payload.get("code"),
        name=payload.get("name"),
        category=payload.get("category", "Custom"),
        data_source=payload.get("data_source", "custom_view"),
        dimensions=payload.get("dimensions", []),
        measures=payload.get("measures", []),
        default_filters=payload.get("default_filters", {}),
        query_schema=payload.get("query_schema", {}),
        is_system_report=False
    )
    db.add(report)
    await db.commit()
    await db.refresh(report)
    return report

# ─────────────────────────────────────────────────────────────────────────────
# Dashboard Manager & Widget Library API
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/dashboards")
async def list_dashboards(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """List available system and custom dashboards."""
    res = await db.execute(select(Dashboard))
    items = res.scalars().all()
    return {"dashboards": items}

@router.get("/dashboards/{dashboard_id}")
async def get_dashboard_detail(
    dashboard_id: str,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Get dashboard detail with composed widgets."""
    res = await db.execute(select(Dashboard).where(Dashboard.id == dashboard_id))
    dash = res.scalar_one_or_none()
    if not dash:
        raise HTTPException(status_code=404, detail="Dashboard not found")
    
    widget_res = await db.execute(select(DashboardWidget).where(DashboardWidget.dashboard_id == dashboard_id))
    widgets = widget_res.scalars().all()
    
    return {
        "dashboard": dash,
        "widgets": widgets
    }

@router.post("/dashboards", status_code=status.HTTP_201_CREATED)
async def create_dashboard(
    payload: Dict[str, Any],
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Create custom Dashboard in Dashboard Manager."""
    dash = Dashboard(
        code=payload.get("code"),
        name=payload.get("name"),
        category=payload.get("category", "General"),
        owner_user_id=current_user.id,
        is_system_dashboard=False,
        is_shared=payload.get("is_shared", True),
        layout_config=payload.get("layout_config", {})
    )
    db.add(dash)
    await db.commit()
    await db.refresh(dash)
    return dash

# ─────────────────────────────────────────────────────────────────────────────
# Report Schedule CRUD
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/schedules", response_model=List[ReportScheduleResponse])
async def list_report_schedules(
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
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
    if current_user.role not in ("SYSADMIN", "ADMIN", "MANAGER"):
        raise HTTPException(status_code=403, detail="Access Denied: MANAGER role or above required.")
    await ReportsService(db, tenant).delete_schedule(schedule_id)
