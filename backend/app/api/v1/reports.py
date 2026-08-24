"""
Project      : SMRITI Retail OS
Repository   : SMRITIRetailNX
Organization : AITDL NETWORKS

Founders

* Pushpa Devi Jawahar Mallah — Founder & Chairperson
* Jawahar Ramkripal Mallah  — Founder, CEO & Chief Software Architect
* Websites: aitdl.com | erpnbook.com | smritibooks.com

* Version    : 3.28.0
* Created    : 2026-07-11
* Modified   : 2026-08-24
* Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
* License    : Proprietary Commercial Software
"""

from datetime import date
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, insert, update

from ...api.deps import get_db, get_company_db, get_tenant_context, get_current_user, TenantContext
from ...schemas.reports import (
    StockValuationReport,
    DailySalesSummary,
    SupplierLedger,
    PurchaseSummaryLine,
    BillWiseSalesReport,
    ItemWiseSalesReport,
    TaxRegisterReport,
    CancelledBillsReport,
    SalespersonDiscountReport,
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
    # ── P1 Sprint 8a: Tax & Compliance ── SR202300/SR202400/SR202000/SR210200
    "tax_studio": {
        "name": "Tax & Compliance Studio",
        "description": "GST/tax register, bill-wise sales, item-wise breakdown, cancelled invoices. Mandatory for statutory audit.",
        "icon": "receipt_long",
        "reports": [
            {"id": "RPT-TAX-001", "code": "RPT-TAX-001", "title": "Tax Register",              "description": "Bill-wise GST/IGST/CGST/SGST breakdowns for a date range — statutory audit register.",              "category": "Tax",            "format": "Grid",   "owner": "System", "drillDownEnabled": False, "sh9_exe": "SR202300"},
            {"id": "RPT-TAX-002", "code": "RPT-TAX-002", "title": "Bill-wise Sales",          "description": "Every invoice with customer, items, quantities, discounts, and net amounts.",                      "category": "Sales Detail",   "format": "Grid",   "owner": "System", "drillDownEnabled": True,  "sh9_exe": "SR202400"},
            {"id": "RPT-TAX-003", "code": "RPT-TAX-003", "title": "Item-wise Sales",          "description": "Consolidated sales quantity and value per item across all invoices in the period.",             "category": "Product",        "format": "Pivot",  "owner": "System", "drillDownEnabled": True,  "sh9_exe": "SR202200"},
            {"id": "RPT-TAX-004", "code": "RPT-TAX-004", "title": "Cancelled Bills",          "description": "All voided/cancelled invoices with cancellation reason and operator.",                         "category": "Audit",          "format": "Grid",   "owner": "Admin",  "drillDownEnabled": False, "sh9_exe": "SR210200"},
            {"id": "RPT-TAX-005", "code": "RPT-TAX-005", "title": "Bill-wise Items Detail",   "description": "Each invoice line expanded: product, barcode, HSN, qty, rate, discount, net.",                "category": "Sales Detail",   "format": "Grid",   "owner": "System", "drillDownEnabled": False, "sh9_exe": "SR202000"},
        ],
    },
    # ── P2 Sprint 8a: MIS & Analytics ── SR203700/SR203900/SR215600/SR216000/SR238400
    "mis_studio": {
        "name": "MIS & Analytics Studio",
        "description": "Monthly comparisons, sales analysis, pending transactions, category-wise, salesperson discount.",
        "icon": "insights",
        "reports": [
            {"id": "RPT-MIS-001", "code": "RPT-MIS-001", "title": "Monthly Sales Comparison",      "description": "Month-over-month revenue, transaction volume, and average ticket comparison.",               "category": "Trend",          "format": "Matrix", "owner": "System", "drillDownEnabled": True,  "sh9_exe": "SR203700"},
            {"id": "RPT-MIS-002", "code": "RPT-MIS-002", "title": "Sales Analysis",              "description": "Multi-dimensional cross-tab: product × salesperson × payment mode × period.",                "category": "Analytics",      "format": "Pivot",  "owner": "System", "drillDownEnabled": True,  "sh9_exe": "SR203900"},
            {"id": "RPT-MIS-003", "code": "RPT-MIS-003", "title": "Pending Transactions",        "description": "Invoices in draft, on-hold, or incomplete payment states.",                                  "category": "Operations",     "format": "Grid",   "owner": "System", "drillDownEnabled": True,  "sh9_exe": "SR215600"},
            {"id": "RPT-MIS-004", "code": "RPT-MIS-004", "title": "Category-wise Sales & Stock", "description": "Superclass/category breakdown of sales revenue and current stock value side-by-side.",        "category": "Merchandise",    "format": "Grid",   "owner": "System", "drillDownEnabled": True,  "sh9_exe": "SR216000"},
            {"id": "RPT-MIS-005", "code": "RPT-MIS-005", "title": "Salesperson-wise Discount",   "description": "Total discount authorised per salesperson — fraud-detection and margin-leakage report.",     "category": "Staff Analysis", "format": "Grid",   "owner": "Admin",  "drillDownEnabled": False, "sh9_exe": "SR238400"},
        ],
    },
    # ── P2 Sprint 8a: Customer Analytics ── SR208400/SR208500/SR208600/SR222800
    "crm_studio": {
        "name": "Customer Analytics Studio",
        "description": "Customer offtake (period/bill/product), walk-in footfall tracking.",
        "icon": "people",
        "reports": [
            {"id": "RPT-CRM-001", "code": "RPT-CRM-001", "title": "Customer Offtake — Period",   "description": "Aggregated purchase value per customer by period.",                                          "category": "CRM",            "format": "Grid",   "owner": "System", "drillDownEnabled": True,  "sh9_exe": "SR208500"},
            {"id": "RPT-CRM-002", "code": "RPT-CRM-002", "title": "Customer Offtake — Bill",    "description": "Bill-by-bill customer purchase history with invoice references.",                          "category": "CRM",            "format": "Grid",   "owner": "System", "drillDownEnabled": True,  "sh9_exe": "SR208400"},
            {"id": "RPT-CRM-003", "code": "RPT-CRM-003", "title": "Customer Offtake — Product", "description": "Products purchased per customer — cross-sell and loyalty analysis.",                       "category": "CRM",            "format": "Pivot",  "owner": "System", "drillDownEnabled": True,  "sh9_exe": "SR208600"},
            {"id": "RPT-CRM-004", "code": "RPT-CRM-004", "title": "Walk-in Details",            "description": "Footfall register: date, time-band, conversions, and average ticket per walk-in slot.",   "category": "CRM",            "format": "Grid",   "owner": "System", "drillDownEnabled": False, "sh9_exe": "SR222800"},
        ],
    },
    # ── P3 Sprint 8a: Merchandise & Stock ── SR236300/SR203800/SR214100/SR430800/SR202000
    "merchandise_studio": {
        "name": "Merchandise & Stock Studio",
        "description": "Attribute/size-wise sales, rate variation, item-wise returns, style catalogue.",
        "icon": "style",
        "reports": [
            {"id": "RPT-MRC-001", "code": "RPT-MRC-001", "title": "Attribute+Size wise Sales",   "description": "Sales volume and revenue broken down by product attribute (colour/size/fit).",             "category": "Merchandise",    "format": "Pivot",  "owner": "System", "drillDownEnabled": True,  "sh9_exe": "SR236300"},
            {"id": "RPT-MRC-002", "code": "RPT-MRC-002", "title": "Rate Variation",             "description": "Products sold below MRP or with price changes — price integrity audit.",                  "category": "Audit",          "format": "Grid",   "owner": "Admin",  "drillDownEnabled": False, "sh9_exe": "SR203800"},
            {"id": "RPT-MRC-003", "code": "RPT-MRC-003", "title": "Item-wise Sales Returns",    "description": "Returns quantity and value per item — identifies high-return products.",                  "category": "Returns",        "format": "Grid",   "owner": "System", "drillDownEnabled": True,  "sh9_exe": "SR214100"},
            {"id": "RPT-MRC-004", "code": "RPT-MRC-004", "title": "Style Catalogue",            "description": "Printable product style catalogue with images, attributes, MRP, and barcode.",            "category": "Catalogue",      "format": "Grid",   "owner": "System", "drillDownEnabled": False, "sh9_exe": "SR430800"},
        ],
    },
    # ── P3 Sprint 8a: Operations ── SR238400/SR231900/SR244700/SR234900/SR233500
    "operations_studio": {
        "name": "Operations Studio",
        "description": "Discount summary, node-wise details, incentive analysis, promotions, bill reprint.",
        "icon": "manage_accounts",
        "reports": [
            {"id": "RPT-OPS-001", "code": "RPT-OPS-001", "title": "Discount Given Summary",      "description": "Total discount granted per day/cashier — margin-leakage monitoring.",                       "category": "Operations",     "format": "Grid",   "owner": "System", "drillDownEnabled": True,  "sh9_exe": "SR202100"},
            {"id": "RPT-OPS-002", "code": "RPT-OPS-002", "title": "Node-wise Details",          "description": "Counter/POS-node level sales and cashier performance details.",                           "category": "Operations",     "format": "Grid",   "owner": "System", "drillDownEnabled": True,  "sh9_exe": "SR231900"},
            {"id": "RPT-OPS-003", "code": "RPT-OPS-003", "title": "Incentive Analysis",         "description": "Staff incentive earned vs. targets achieved — payroll input report.",                     "category": "Staff Analysis", "format": "Grid",   "owner": "Admin",  "drillDownEnabled": False, "sh9_exe": "SR244700"},
            {"id": "RPT-OPS-004", "code": "RPT-OPS-004", "title": "Sales Promotions Analysis",  "description": "Promotion campaign effectiveness: redemptions, revenue uplift, discount cost.",           "category": "Promotions",     "format": "Matrix", "owner": "System", "drillDownEnabled": True,  "sh9_exe": "SR234900"},
            {"id": "RPT-OPS-005", "code": "RPT-OPS-005", "title": "Bill Re-Print",              "description": "Reprint any historical invoice by bill number or date range — audit trail maintained.",    "category": "Operations",     "format": "Grid",   "owner": "System", "drillDownEnabled": False, "sh9_exe": "SR233500"},
        ],
    },
}

@router.get("/stock-valuation", response_model=StockValuationReport)
async def stock_valuation_report(
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_company_db),
):
    return await ReportsService(db, tenant).stock_valuation()

@router.get("/daily-sales", response_model=DailySalesSummary)
async def daily_sales_report(
    report_date: Optional[date] = Query(default=None, description="Date to report (YYYY-MM-DD)"),
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_company_db),
):
    return await ReportsService(db, tenant).daily_sales(report_date)

@router.get("/supplier-ledger/{supplier_id}", response_model=SupplierLedger)
async def supplier_ledger(
    supplier_id: str,
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_company_db),
):
    return await ReportsService(db, tenant).supplier_ledger(supplier_id)

@router.get("/purchase-summary", response_model=List[PurchaseSummaryLine])
async def purchase_summary(
    from_date: Optional[date] = Query(default=None, description="Start date (YYYY-MM-DD)"),
    to_date:   Optional[date] = Query(default=None, description="End date (YYYY-MM-DD)"),
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_company_db),
):
    return await ReportsService(db, tenant).purchase_summary(from_date, to_date)

@router.get("/studios")
async def list_studios(
    current_user=Depends(get_current_user),
):
    return {
        "studios": SMRITI_STUDIOS,
        "total_studios": len(SMRITI_STUDIOS),
        "total_reports": sum(len(s["reports"]) for s in SMRITI_STUDIOS.values()),
        "policyEnforcement": "SMRITI Rule 10 Non-Repudiation Schema Active",
    }

# ─────────────────────────────────────────────────────────────────────────────
# Sprint 8a P1 Endpoints — Tax & Compliance (Shoper9 parity: SR202300/202400/202200/210200/202000)
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/bill-wise-sales", response_model=BillWiseSalesReport)
async def bill_wise_sales(
    from_date: Optional[date] = Query(default=None, description="Start date YYYY-MM-DD"),
    to_date:   Optional[date] = Query(default=None, description="End date YYYY-MM-DD"),
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_company_db),
    current_user=Depends(get_current_user),
):
    """RPT-TAX-002 — Bill-wise Sales (Shoper9: SR202400.EXE)."""
    return await ReportsService(db, tenant).bill_wise_sales(from_date, to_date)

@router.get("/item-wise-sales", response_model=ItemWiseSalesReport)
async def item_wise_sales(
    from_date: Optional[date] = Query(default=None, description="Start date YYYY-MM-DD"),
    to_date:   Optional[date] = Query(default=None, description="End date YYYY-MM-DD"),
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_company_db),
    current_user=Depends(get_current_user),
):
    """RPT-TAX-003 — Item-wise Sales (Shoper9: SR202200.EXE)."""
    return await ReportsService(db, tenant).item_wise_sales(from_date, to_date)

@router.get("/tax-register", response_model=TaxRegisterReport)
async def tax_register(
    from_date: Optional[date] = Query(default=None, description="Start date YYYY-MM-DD"),
    to_date:   Optional[date] = Query(default=None, description="End date YYYY-MM-DD"),
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_company_db),
    current_user=Depends(get_current_user),
):
    """RPT-TAX-001 — Tax Register (Shoper9: SR202300.EXE)."""
    return await ReportsService(db, tenant).tax_register(from_date, to_date)

@router.get("/cancelled-bills", response_model=CancelledBillsReport)
async def cancelled_bills(
    from_date: Optional[date] = Query(default=None, description="Start date YYYY-MM-DD"),
    to_date:   Optional[date] = Query(default=None, description="End date YYYY-MM-DD"),
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_company_db),
    current_user=Depends(get_current_user),
):
    """RPT-TAX-004 — Cancelled Bills (Shoper9: SR210200.EXE)."""
    return await ReportsService(db, tenant).cancelled_bills(from_date, to_date)

@router.get("/salesperson-discount", response_model=SalespersonDiscountReport)
async def salesperson_discount(
    from_date: Optional[date] = Query(default=None, description="Start date YYYY-MM-DD"),
    to_date:   Optional[date] = Query(default=None, description="End date YYYY-MM-DD"),
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_company_db),
    current_user=Depends(get_current_user),
):
    """RPT-MIS-005 — Salesperson-wise Discount (Shoper9: SR238400.EXE)."""
    return await ReportsService(db, tenant).salesperson_discount(from_date, to_date)

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
