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
from fastapi import APIRouter, Depends, Query, HTTPException, status, Response
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
    BillWiseItemsReport,
    DiscountSummaryReport,
    ItemWiseReturnsReport,
    AttributeSizeSalesReport,
    TaxInvoiceMasterRegisterReport,
    ArticleColorSizeMatrixReport,
    StoreWiseSummaryReport,
    SalesOrderSummaryReport,
    PendingOrdersReport,
    BilledVsPendingOrdersReport,
    CustomerWiseOrdersReport,
    ProductWiseOrderedQuantityReport,
    OrderFulfillmentStatusReport,
    InvoiceAllocationReportModel,
    SalesOrderDetailReport,
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
            {"id": "RPT-SO-001", "code": "RPT-SO-001", "title": "Sales Order Summary",                 "description": "Consolidated order counts, total order values, and fulfillment overview across all sales orders.", "category": "Sales Orders",   "format": "Grid",   "owner": "System", "drillDownEnabled": True},
            {"id": "RPT-SO-008", "code": "RPT-SO-008", "title": "Detailed Sales Orders Register",       "description": "Complete line-item breakdown with article, size, quantities, rates, discounts, GST, billed balance & multi-sheet Excel export.", "category": "Sales Orders", "format": "Matrix", "owner": "System", "drillDownEnabled": True},
            {"id": "RPT-SO-009", "code": "RPT-SO-009", "title": "Fulfillment Variance & Backorder Tracker", "description": "Automated SLA aging buckets (0-7d, 8-14d, 15-30d, >30d), store shortages, and 1-click invoice conversion queue.", "category": "Sales Orders", "format": "Matrix", "owner": "System", "drillDownEnabled": True},
            {"id": "RPT-SO-002", "code": "RPT-SO-002", "title": "Pending Orders",                     "description": "Active unfulfilled and partially fulfilled sales orders awaiting billing or shipment.", "category": "Sales Orders",   "format": "Grid",   "owner": "System", "drillDownEnabled": True},
            {"id": "RPT-SO-003", "code": "RPT-SO-003", "title": "Billed vs Pending Orders",           "description": "Comparison breakdown of booked order value versus invoiced value and outstanding balances.", "category": "Sales Orders",   "format": "Matrix", "owner": "System", "drillDownEnabled": True},
            {"id": "RPT-SO-004", "code": "RPT-SO-004", "title": "Customer-wise Orders",               "description": "Customer order aggregates, average order size, and fulfillment distribution by customer.", "category": "Sales Orders",   "format": "Pivot",  "owner": "System", "drillDownEnabled": True},
            {"id": "RPT-SO-005", "code": "RPT-SO-005", "title": "Product-wise Ordered Quantity",       "description": "Ordered quantity, billed quantity, and pending quantity aggregated per product style and article.", "category": "Sales Orders", "format": "Grid", "owner": "System", "drillDownEnabled": True},
            {"id": "RPT-SO-006", "code": "RPT-SO-006", "title": "Order Fulfillment Status",           "description": "Detailed fulfillment status tracking: Fully Billed, Partially Billed, and Unfulfilled orders.", "category": "Sales Orders", "format": "Grid", "owner": "System", "drillDownEnabled": True},
            {"id": "RPT-SO-007", "code": "RPT-SO-007", "title": "Invoice Allocation Report",           "description": "Traceability link map between Sales Orders (Reliance POs) and Tax Invoices with billed vs pending quantities.", "category": "Sales Orders", "format": "Grid", "owner": "System", "drillDownEnabled": True},
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
            {"id": "RPT-TAX-006", "code": "RPT-TAX-006", "title": "Statutory GST Tax Invoices Master Register", "description": "Complete statutory audit ledger of all tax invoices with buyer & seller GSTINs, Place of Supply, RCM, E-Way Bill, full billing/shipping addresses, round-off, and amount in words.", "category": "Tax & Compliance", "format": "Grid", "owner": "System", "drillDownEnabled": True},
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
            {"id": "RPT-MRC-005", "code": "RPT-MRC-005", "title": "Article, Color & Size Sales Matrix", "description": "Cross-tabulated variant curve matrix showing quantity distribution across sizes 36 to 42 for every Article and Color variant.", "category": "Merchandise", "format": "Matrix", "owner": "System", "drillDownEnabled": True},
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
            {"id": "RPT-OPS-006", "code": "RPT-OPS-006", "title": "Store-Wise SIS Tax Register", "description": "Consolidated store-by-store sales, units, and GST distribution across all SIS store locations.", "category": "Operations", "format": "Grid", "owner": "System", "drillDownEnabled": True},
        ],
    },
}

@router.get("/studios")
async def get_report_studios(
    current_user=Depends(get_current_user),
):
    """List all report studios with their registered report catalog."""
    return {"studios": SMRITI_STUDIOS}

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

@router.get("/bill-wise-items", response_model=BillWiseItemsReport)
async def bill_wise_items(
    from_date: Optional[date] = Query(default=None, description="Start date YYYY-MM-DD"),
    to_date:   Optional[date] = Query(default=None, description="End date YYYY-MM-DD"),
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_company_db),
    current_user=Depends(get_current_user),
):
    """RPT-TAX-005 — Bill-wise Items Detail (Shoper9: SR202000.EXE)."""
    return await ReportsService(db, tenant).bill_wise_items(from_date, to_date)

@router.get("/discount-summary", response_model=DiscountSummaryReport)
async def discount_summary(
    from_date: Optional[date] = Query(default=None, description="Start date YYYY-MM-DD"),
    to_date:   Optional[date] = Query(default=None, description="End date YYYY-MM-DD"),
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_company_db),
    current_user=Depends(get_current_user),
):
    """RPT-OPS-001 — Discount Given Summary (Shoper9: SR202100.EXE)."""
    return await ReportsService(db, tenant).discount_summary(from_date, to_date)

@router.get("/item-wise-returns", response_model=ItemWiseReturnsReport)
async def item_wise_returns(
    from_date: Optional[date] = Query(default=None, description="Start date YYYY-MM-DD"),
    to_date:   Optional[date] = Query(default=None, description="End date YYYY-MM-DD"),
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_company_db),
    current_user=Depends(get_current_user),
):
    """RPT-MRC-003 — Item-wise Sales Returns (Shoper9: SR214100.EXE)."""
    return await ReportsService(db, tenant).item_wise_returns(from_date, to_date)

@router.get("/attribute-size-sales", response_model=AttributeSizeSalesReport)
async def attribute_size_sales(
    from_date: Optional[date] = Query(default=None, description="Start date YYYY-MM-DD"),
    to_date:   Optional[date] = Query(default=None, description="End date YYYY-MM-DD"),
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_company_db),
    current_user=Depends(get_current_user),
):
    """RPT-MRC-001 — Attribute+Size wise Sales (Shoper9: SR236300.EXE)."""
    return await ReportsService(db, tenant).attribute_size_sales(from_date, to_date)


@router.get("/tax-invoices-master-register", response_model=TaxInvoiceMasterRegisterReport)
async def tax_invoices_master_register(
    from_date: Optional[date] = Query(default=None, description="Start date YYYY-MM-DD"),
    to_date:   Optional[date] = Query(default=None, description="End date YYYY-MM-DD"),
    bill_from: Optional[int] = Query(default=None, description="Starting Bill Number"),
    bill_to:   Optional[int] = Query(default=None, description="Ending Bill Number"),
    status:    Optional[str] = Query(default=None, description="Status filter (COMPLETED/CANCELLED)"),
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_company_db),
    current_user=Depends(get_current_user),
):
    """RPT-TAX-006 — Statutory GST Tax Invoices Master Register."""
    return await ReportsService(db, tenant).tax_invoices_master_register(
        from_date=from_date, to_date=to_date, bill_from=bill_from, bill_to=bill_to, status_filter=status
    )


@router.get("/article-color-size-matrix", response_model=ArticleColorSizeMatrixReport)
async def article_color_size_matrix(
    from_date: Optional[date] = Query(default=None, description="Start date YYYY-MM-DD"),
    to_date:   Optional[date] = Query(default=None, description="End date YYYY-MM-DD"),
    article:   Optional[str] = Query(default=None, description="Article filter"),
    color:     Optional[str] = Query(default=None, description="Color filter"),
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_company_db),
    current_user=Depends(get_current_user),
):
    """RPT-MRC-005 — Article, Color & Size Sales Curve Matrix."""
    return await ReportsService(db, tenant).article_color_size_matrix(
        from_date=from_date, to_date=to_date, article_filter=article, color_filter=color
    )


@router.get("/store-wise-summary", response_model=StoreWiseSummaryReport)
async def store_wise_summary(
    from_date: Optional[date] = Query(default=None, description="Start date YYYY-MM-DD"),
    to_date:   Optional[date] = Query(default=None, description="End date YYYY-MM-DD"),
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_company_db),
    current_user=Depends(get_current_user),
):
    """RPT-OPS-006 — Store-Wise SIS Tax Register."""
    return await ReportsService(db, tenant).store_wise_summary(from_date, to_date)


@router.get("/export/tax-invoices-excel")
async def export_tax_invoices_excel(
    from_date: Optional[date] = Query(default=None, description="Start date YYYY-MM-DD"),
    to_date:   Optional[date] = Query(default=None, description="End date YYYY-MM-DD"),
    bill_from: Optional[int] = Query(default=None, description="Starting Bill Number"),
    bill_to:   Optional[int] = Query(default=None, description="Ending Bill Number"),
    status:    Optional[str] = Query(default=None, description="Status filter"),
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_company_db),
    current_user=Depends(get_current_user),
):
    """Direct Excel export of Statutory GST Tax Invoices Master Workbook."""
    excel_bytes = await ReportsService(db, tenant).export_tax_invoices_master_excel(
        from_date=from_date, to_date=to_date, bill_from=bill_from, bill_to=bill_to, status=status
    )
    filename = f"Tax_Invoices_Master_Report_{date.today().strftime('%Y%m%d')}.xlsx"
    return Response(
        content=excel_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


# ─────────────────────────────────────────────────────────────────────────────
# Sales Orders BI Reports API Endpoints (RPT-SO-001 to RPT-SO-007)
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/sales-orders/summary", response_model=SalesOrderSummaryReport)
async def get_sales_order_summary(
    from_date:   Optional[date] = Query(default=None, description="Start date YYYY-MM-DD"),
    to_date:     Optional[date] = Query(default=None, description="End date YYYY-MM-DD"),
    customer_id: Optional[str]  = Query(default=None, description="Customer filter"),
    status:      Optional[str]  = Query(default=None, description="Fulfillment status filter"),
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_company_db),
    current_user=Depends(get_current_user),
):
    """RPT-SO-001 — Sales Order Summary."""
    return await ReportsService(db, tenant).sales_order_summary(
        from_date=from_date, to_date=to_date, customer_id=customer_id, status=status
    )


@router.get("/sales-orders/pending", response_model=PendingOrdersReport)
async def get_pending_orders(
    from_date:   Optional[date] = Query(default=None, description="Start date YYYY-MM-DD"),
    to_date:     Optional[date] = Query(default=None, description="End date YYYY-MM-DD"),
    customer_id: Optional[str]  = Query(default=None, description="Customer filter"),
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_company_db),
    current_user=Depends(get_current_user),
):
    """RPT-SO-002 — Pending Orders."""
    return await ReportsService(db, tenant).pending_orders(
        from_date=from_date, to_date=to_date, customer_id=customer_id
    )


@router.get("/sales-orders/billed-vs-pending", response_model=BilledVsPendingOrdersReport)
async def get_billed_vs_pending_orders(
    from_date:   Optional[date] = Query(default=None, description="Start date YYYY-MM-DD"),
    to_date:     Optional[date] = Query(default=None, description="End date YYYY-MM-DD"),
    customer_id: Optional[str]  = Query(default=None, description="Customer filter"),
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_company_db),
    current_user=Depends(get_current_user),
):
    """RPT-SO-003 — Billed vs Pending Orders."""
    return await ReportsService(db, tenant).billed_vs_pending_orders(
        from_date=from_date, to_date=to_date, customer_id=customer_id
    )


@router.get("/sales-orders/customer-wise", response_model=CustomerWiseOrdersReport)
async def get_customer_wise_orders(
    from_date: Optional[date] = Query(default=None, description="Start date YYYY-MM-DD"),
    to_date:   Optional[date] = Query(default=None, description="End date YYYY-MM-DD"),
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_company_db),
    current_user=Depends(get_current_user),
):
    """RPT-SO-004 — Customer-wise Orders."""
    return await ReportsService(db, tenant).customer_wise_orders(
        from_date=from_date, to_date=to_date
    )


@router.get("/sales-orders/product-wise", response_model=ProductWiseOrderedQuantityReport)
async def get_product_wise_ordered_qty(
    from_date:  Optional[date] = Query(default=None, description="Start date YYYY-MM-DD"),
    to_date:    Optional[date] = Query(default=None, description="End date YYYY-MM-DD"),
    product_id: Optional[str]  = Query(default=None, description="Product / Style / Article filter"),
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_company_db),
    current_user=Depends(get_current_user),
):
    """RPT-SO-005 — Product-wise Ordered Quantity."""
    return await ReportsService(db, tenant).product_wise_ordered_qty(
        from_date=from_date, to_date=to_date, product_id=product_id
    )


@router.get("/sales-orders/fulfillment-status", response_model=OrderFulfillmentStatusReport)
async def get_order_fulfillment_status(
    from_date: Optional[date] = Query(default=None, description="Start date YYYY-MM-DD"),
    to_date:   Optional[date] = Query(default=None, description="End date YYYY-MM-DD"),
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_company_db),
    current_user=Depends(get_current_user),
):
    """RPT-SO-006 — Order Fulfillment Status."""
    return await ReportsService(db, tenant).order_fulfillment_status(
        from_date=from_date, to_date=to_date
    )


@router.get("/sales-orders/invoice-allocations", response_model=InvoiceAllocationReportModel)
async def get_invoice_allocations_report(
    from_date: Optional[date] = Query(default=None, description="Start date YYYY-MM-DD"),
    to_date:   Optional[date] = Query(default=None, description="End date YYYY-MM-DD"),
    order_id:  Optional[str]  = Query(default=None, description="Order No / PO Number filter"),
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_company_db),
    current_user=Depends(get_current_user),
):
    """RPT-SO-007 — Invoice Allocation Report."""
    return await ReportsService(db, tenant).invoice_allocations(
        from_date=from_date, to_date=to_date, order_id=order_id
    )


@router.get("/sales-orders/detailed", response_model=SalesOrderDetailReport)
async def get_sales_order_detailed(
    from_date:   Optional[date] = Query(default=None, description="Start date YYYY-MM-DD"),
    to_date:     Optional[date] = Query(default=None, description="End date YYYY-MM-DD"),
    customer_id: Optional[str]  = Query(default=None, description="Customer filter"),
    status:      Optional[str]  = Query(default=None, description="Fulfillment status filter"),
    site_code:   Optional[str]  = Query(default=None, description="Store / Site code filter"),
    search:      Optional[str]  = Query(default=None, description="Search Order No / PO Number / Article"),
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_company_db),
    current_user=Depends(get_current_user),
):
    """RPT-SO-008 — Detailed Line-Item Sales Orders Register & Fulfillment Trace."""
    return await ReportsService(db, tenant).sales_order_detailed(
        from_date=from_date,
        to_date=to_date,
        customer_id=customer_id,
        status=status,
        site_code=site_code,
        search=search,
    )


@router.get("/sales-orders/export-excel")
async def export_sales_orders_excel(
    from_date:   Optional[date] = Query(default=None, description="Start date YYYY-MM-DD"),
    to_date:     Optional[date] = Query(default=None, description="End date YYYY-MM-DD"),
    customer_id: Optional[str]  = Query(default=None, description="Customer filter"),
    status:      Optional[str]  = Query(default=None, description="Fulfillment status filter"),
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_company_db),
    current_user=Depends(get_current_user),
):
    """Generates and downloads full 6-sheet Master Sales Orders Excel workbook (.xlsx)."""
    excel_bytes = await ReportsService(db, tenant).export_sales_orders_master_excel(
        from_date=from_date,
        to_date=to_date,
        customer_id=customer_id,
        status=status,
    )
    filename = f"Sales_Orders_Master_Report_{date.today().strftime('%Y%m%d')}.xlsx"
    return Response(
        content=excel_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.get("/sales-orders/export-csv")
async def export_sales_orders_csv(
    from_date:   Optional[date] = Query(default=None, description="Start date YYYY-MM-DD"),
    to_date:     Optional[date] = Query(default=None, description="End date YYYY-MM-DD"),
    customer_id: Optional[str]  = Query(default=None, description="Customer filter"),
    status:      Optional[str]  = Query(default=None, description="Fulfillment status filter"),
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_company_db),
    current_user=Depends(get_current_user),
):
    """Generates and downloads flat Line-Item Sales Orders CSV export."""
    csv_str = await ReportsService(db, tenant).export_sales_orders_csv(
        from_date=from_date,
        to_date=to_date,
        customer_id=customer_id,
        status=status,
    )
    filename = f"Sales_Orders_Detailed_{date.today().strftime('%Y%m%d')}.csv"
    return Response(
        content=csv_str.encode("utf-8"),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.get("/sales-orders/fulfillment-variance")
async def get_sales_order_fulfillment_variance(
    from_date:   Optional[date] = Query(default=None, description="Start date YYYY-MM-DD"),
    to_date:     Optional[date] = Query(default=None, description="End date YYYY-MM-DD"),
    customer_id: Optional[str]  = Query(default=None, description="Customer filter"),
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_company_db),
    current_user=Depends(get_current_user),
):
    """Automated Fulfillment Variance & Backorder Analytics with aging buckets."""
    return await ReportsService(db, tenant).sales_order_fulfillment_variance(
        from_date=from_date,
        to_date=to_date,
        customer_id=customer_id,
    )




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
