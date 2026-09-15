"""
Project      : SMRITI Retail OS
Repository   : SMRITIRetailNX
Organization : AITDL NETWORKS

Founders

* Pushpa Devi Jawahar Mallah
  * Founder & Chairperson
  * Phone: +91 9324117007
  * Email: founder@aitdl.com

* Jawahar Ramkripal Mallah
  * Founder, Chief Executive Officer (CEO) & Chief Software Architect
  * Email: founder@aitdl.com

* Websites: aitdl.com | erpnbook.com | smritibooks.com

* Version    : 1.0.0
* Created    : 2026-07-11
* Modified   : 2026-09-09
* Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
* License    : Proprietary Commercial Software
"""

import json
import os
import re
import subprocess
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

def normalize_api_route(route: str) -> str:
    if not route:
        return ""
    clean = route.split("?")[0].strip().strip("'\"/")
    clean = re.sub(r"^api/v1/", "", clean)
    clean = re.sub(r"^api/", "", clean)
    return clean.lower()

# Dynamic Module Registry Mapping
MODULES_MAP = {
    "dashboard": {
        "name": "Executive Hub",
        "category": "Operations",
        "frontend": "DashboardTab.tsx",
        "routes": ["control-center", "dashboard", "metadata"],
        "tables": ["companies"],
        "tests": ["dashboard", "company", "control_center"],
        "docs": ["dashboard", "architecture", "readme"]
    },
    "item-master": {
        "name": "Item Master",
        "category": "Inventory & Sourcing",
        "frontend": "ItemMasterWs.tsx",
        "routes": ["inventory", "items", "attributes", "variants"],
        "tables": ["items", "products", "attributes", "variants"],
        "tests": ["item", "inventory", "barcode", "product"],
        "docs": ["item", "procurement", "inventory"]
    },
    "purchase": {
        "name": "Purchase Studio",
        "category": "Inventory & Sourcing",
        "frontend": "PurchaseStudioTab.tsx",
        "routes": ["purchase", "purchases", "po", "grn"],
        "tables": ["purchase_orders", "goods_receipt_notes"],
        "tests": ["purchase", "grn", "supplier"],
        "docs": ["purchase", "procurement"]
    },
    "sales": {
        "name": "Sales Studio",
        "category": "Sales & POS",
        "frontend": "SalesStudioTab.tsx",
        "routes": ["sales", "invoices"],
        "tables": ["sales_invoices", "sales_orders"],
        "tests": ["sales", "invoice"],
        "docs": ["sales"]
    },
    "pos": {
        "name": "Billing Desk",
        "category": "Sales & POS",
        "frontend": "PosTerminalTab.tsx",
        "routes": ["pos", "billing"],
        "tables": ["pos_transactions", "pos_payments", "sales_invoices"],
        "tests": ["pos", "billing", "sales"],
        "docs": ["pos", "billing"]
    },
    "crm": {
        "name": "CRM & Loyalty",
        "category": "Sales & POS",
        "frontend": "CrmStudioTab.tsx",
        "routes": ["customers", "crm", "campaigns"],
        "tables": ["customers", "customer_groups", "crm_leads"],
        "tests": ["crm", "customer", "sice"],
        "docs": ["crm", "customer"]
    },
    "customer-master": {
        "name": "Customer Master",
        "category": "Sales & POS",
        "frontend": "CustomerMasterTab.tsx",
        "routes": ["customers", "customers/groups", "customers/validate-add"],
        "tables": ["customers", "customer_groups"],
        "tests": ["customer", "crm"],
        "docs": ["customer"]
    },
    "loyalty": {
        "name": "Loyalty Studio",
        "category": "Sales & POS",
        "frontend": "LoyaltyStudioTab.tsx",
        "routes": ["loyalty", "wallets"],
        "tables": ["loyalty_wallets", "loyalty_tiers", "customers"],
        "tests": ["loyalty", "customer", "crm"],
        "docs": ["loyalty", "crm"]
    },
    "sales-promotions": {
        "name": "Promotions Studio",
        "category": "Sales & POS",
        "frontend": "SmritiSalesPromotionsStudio.tsx",
        "routes": ["promotions", "schemes", "promotion_campaigns"],
        "tables": ["promotion_campaigns", "promotion_rules", "promotion_slab_allocations"],
        "tests": ["smritiSalesPromotionsStudio", "smritiSalesPromotionEngine", "test_promotions_schemes_api", "promotion"],
        "docs": ["promotions", "promotion", "Sales_Promotions"]
    },
    "stock-ledger": {
        "name": "Stock Ledger",
        "category": "Inventory & Sourcing",
        "frontend": "StockLedgerTab.tsx",
        "routes": ["inventory", "stock"],
        "tables": ["stock_movements", "items", "products"],
        "tests": ["stock", "inventory", "grn"],
        "docs": ["stock", "inventory"]
    },
    "about-smriti": {
        "name": "About SMRITI",
        "category": "System",
        "frontend": "AboutSmritiTab.tsx",
        "routes": ["metadata", "changelog"],
        "tables": [],
        "tests": ["about", "changelog"],
        "docs": ["about", "changelog", "readme"]
    },
    "billing-workspace": {
        "name": "Billing Workspace",
        "category": "Sales & POS",
        "frontend": "BillingWorkspace.tsx",
        "routes": ["billing", "pos", "sales", "payments", "invoices"],
        "tables": ["sales_invoices", "pos_transactions", "shift_cash_transactions", "payment_transactions", "shifts"],
        "tests": ["canonical_sales_writer", "pos", "payments", "billing", "invoice"],
        "docs": ["billing", "pos", "sales", "walkthrough"]
    },
    "vendor-360": {
        "name": "Vendor 360 Workspace",
        "category": "Inventory & Sourcing",
        "frontend": "VendorMasterWs.tsx",
        "routes": ["vendors", "purchase/vendors", "parties", "suppliers"],
        "tables": ["parties", "supplier_profiles", "party_roles", "party_addresses", "party_contacts", "supplier_bank_accounts"],
        "tests": ["vendor", "party", "supplier"],
        "docs": ["vendor", "procurement", "purchase", "supplier"]
    },
    "supplier-mgmt": {
        "name": "Vendor 360 Workspace",
        "category": "Inventory & Sourcing",
        "frontend": "VendorMasterWs.tsx",
        "routes": ["vendors", "purchase/vendors", "parties", "suppliers"],
        "tables": ["parties", "supplier_profiles", "party_roles", "party_addresses", "party_contacts", "supplier_bank_accounts"],
        "tests": ["vendor", "party", "supplier"],
        "docs": ["vendor", "procurement", "purchase", "supplier"]
    },
    "wiki": {
        "name": "SMRITI Gyan Kendra",
        "category": "Operations",
        "frontend": "WikiTab.tsx",
        "routes": ["wiki", "metadata"],
        "tables": [],
        "tests": ["wikiGyanKendra", "wiki", "readme"],
        "docs": ["wiki", "architecture", "readme"]
    },
    "profiles": {
        "name": "POS Terminals",
        "category": "Sales & POS",
        "frontend": "PosProfilesTab.tsx",
        "routes": ["profiles", "pos", "terminals"],
        "tables": ["pos_profiles", "pos_terminals", "shifts"],
        "tests": ["profiles", "pos", "storeTerminalBroadcast"],
        "docs": ["pos", "profiles"]
    },
    "business-ledger": {
        "name": "Business Ledger",
        "category": "Accounts Sync",
        "frontend": "BusinessLedgerTab.tsx",
        "routes": ["ledger", "accounting", "reports/ledger"],
        "tables": ["journal_entries", "accounts", "general_ledger"],
        "tests": ["ledger", "consolidatedBalanceSheet", "plDashboardEngine"],
        "docs": ["ledger", "accounting"]
    },
    "accounting-sync": {
        "name": "Accounting Sync",
        "category": "Accounts Sync",
        "frontend": "AccountingSyncTab.tsx",
        "routes": ["accounting", "sync", "tally"],
        "tables": ["accounting_sync_logs", "accounts"],
        "tests": ["accounting", "sync"],
        "docs": ["accounting", "sync"]
    },
    "report-designer": {
        "name": "Report Designer",
        "category": "Data & Config",
        "frontend": "ReportDesignerTab.tsx",
        "routes": ["reports", "designer"],
        "tables": ["report_templates", "custom_reports"],
        "tests": ["report", "scheduleReportModal"],
        "docs": ["report"]
    },
    "barcode": {
        "name": "Barcode Studio",
        "category": "Inventory & Sourcing",
        "frontend": "BarcodeStudioTab.tsx",
        "routes": ["barcode", "barcodes", "labels"],
        "tables": ["items", "products", "item_barcodes"],
        "tests": ["barcode", "tagPrinting", "labelPrintEngine"],
        "docs": ["barcode", "inventory"]
    },
    "wms-dashboard": {
        "name": "Warehouse & Batch Hub",
        "category": "Inventory & Sourcing",
        "frontend": "WmsStudioTab.tsx",
        "routes": ["wms", "inventory", "stock", "batches"],
        "tables": ["stock_batches", "stock_movements", "warehouses"],
        "tests": ["wms", "batch", "warehouseWavePicking"],
        "docs": ["wms", "inventory"]
    },
    "stock-transfers": {
        "name": "Inter-Godown Transfers",
        "category": "Inventory & Sourcing",
        "frontend": "WmsStudioTab.tsx",
        "routes": ["stock-transfers", "transfers", "stock/transfers"],
        "tables": ["stock_transfers", "stock_transfer_items", "stock_movements"],
        "tests": ["stockTransferEngine", "interBranchTransferEngine"],
        "docs": ["stock", "transfers"]
    },
    "masters": {
        "name": "Master Framework",
        "category": "Data & Config",
        "frontend": "MasterMgmtTab.tsx",
        "routes": ["masters", "metadata", "master-types", "master-values"],
        "tables": ["master_types", "master_values", "system_parameters"],
        "tests": ["master", "metaRegistry", "globalFieldRegistry"],
        "docs": ["master", "architecture"]
    },
    "ufe": {
        "name": "Field Explorer (UFE)",
        "category": "Data & Config",
        "frontend": "FieldExplorerTab.tsx",
        "routes": ["ufe", "fields", "universal-fields"],
        "tables": ["field_definitions", "custom_fields", "metadata_fields"],
        "tests": ["fieldSearch", "globalFieldRegistry"],
        "docs": ["ufe", "field"]
    },
    "formulas": {
        "name": "KPI Registry",
        "category": "Data & Config",
        "frontend": "FormulaRegistryTab.tsx",
        "routes": ["formulas", "kpi", "formula"],
        "tables": ["formula_definitions", "business_rule_definitions", "commission_rules"],
        "tests": ["kpiRegistry", "formula", "kpi", "commissionEngine"],
        "docs": ["kpi", "formula", "financial_policy"]
    },
    "psv": {
        "name": "Channel Visibility",
        "category": "Data & Config",
        "frontend": "PsvTab.tsx",
        "routes": ["psv", "visibility"],
        "tables": ["psv_parties", "vendor_shares"],
        "tests": ["psvEngine", "psv"],
        "docs": ["psv"]
    },
    "document-series": {
        "name": "Numbering Engine",
        "category": "Data & Config",
        "frontend": "DocumentSeriesTab.tsx",
        "routes": ["document-series", "series", "sequences"],
        "tables": ["document_series"],
        "tests": ["documentSeries", "numbering", "numberWords", "series"],
        "docs": ["document", "series", "naming"]
    },
    "approval-matrix": {
        "name": "Approval Matrix",
        "category": "Data & Config",
        "frontend": "ApprovalMatrixTab.tsx",
        "routes": ["approval-matrix", "approvals"],
        "tables": ["approval_policies", "approval_requests", "approval_actions", "approval_workflow_logs"],
        "tests": ["approval", "matrix"],
        "docs": ["approval"]
    },
    "staff-management": {
        "name": "Staff Management",
        "category": "Operations",
        "frontend": "StaffManagementTab.tsx",
        "routes": ["staff", "employees", "users"],
        "tables": ["users", "staff", "employees"],
        "tests": ["staff", "employeeAttendanceEngine", "staffPlacementHelpers"],
        "docs": ["staff", "employee"]
    },
    "user-profile": {
        "name": "My Profile Dashboard",
        "category": "Operations",
        "frontend": "UserProfileTab.tsx",
        "routes": ["profile", "user", "me"],
        "tables": ["users"],
        "tests": ["user", "profile"],
        "docs": ["profile", "user"]
    },
    "print-studio": {
        "name": "Print Studio",
        "category": "Documents & Print",
        "frontend": "PrintStudioTab.tsx",
        "routes": ["print", "templates", "print/templates"],
        "tables": ["print_templates"],
        "tests": ["print", "tagPrinting", "labelPrintEngine"],
        "docs": ["print"]
    },
    "print-history": {
        "name": "Print History Logs",
        "category": "Documents & Print",
        "frontend": "PrintHistoryTab.tsx",
        "routes": ["print-history", "print/logs", "print-logs"],
        "tables": ["print_logs"],
        "tests": ["print", "tagPrinting"],
        "docs": ["print"]
    },
    "terms-engine": {
        "name": "Terms & Conditions",
        "category": "Data & Config",
        "frontend": "TermsEngineTab.tsx",
        "routes": ["terms", "store-policies", "policies"],
        "tables": ["terms_clauses", "terms_defaults", "terms_snapshots"],
        "tests": ["termsEngine", "billingTerm", "custPolicy", "terms"],
        "docs": ["terms", "policy"]
    },
    "data-exchange": {
        "name": "Data Exchange Hub",
        "category": "Data & Config",
        "frontend": "DataExchangeTab.tsx",
        "routes": ["data-exchange", "exchange", "import", "export"],
        "tables": ["data_exchange_tasks", "data_exchange_field_mappings"],
        "tests": ["universalImportEngine", "globalExport"],
        "docs": ["exchange", "import", "export"]
    },
    "company-setup": {
        "name": "Company Setup Wizard",
        "category": "Operations",
        "frontend": "SetupWizardTab.tsx",
        "routes": ["company", "setup", "companies"],
        "tables": ["companies"],
        "tests": ["companySelect", "company"],
        "docs": ["company", "setup"]
    },
    "dev-tracker": {
        "name": "Dev Intelligence Center",
        "category": "System",
        "frontend": "DevTrackerTab.tsx",
        "routes": ["dev-tracker", "scanner"],
        "tables": [],
        "tests": ["devTracker"],
        "docs": ["dev_tracker", "architecture"]
    },
    "audit-logs": {
        "name": "Audit Logs",
        "category": "System",
        "frontend": "AuditLogsTab.tsx",
        "routes": ["audit", "audit-logs", "logs"],
        "tables": ["compliance_immutable_audit_logs", "module_audit_logs", "smriti_audit_log"],
        "tests": ["audit"],
        "docs": ["audit"]
    }
}

def discover_modules(file_contents: dict[str, str]) -> list[dict[str, str]]:
    default_modules = [
        {"id": "dashboard", "name": "Executive Hub", "category": "Operations"},
        {"id": "item-master", "name": "Item Master", "category": "Inventory & Sourcing"},
        {"id": "purchase", "name": "Purchase Studio", "category": "Inventory & Sourcing"},
        {"id": "sales", "name": "Sales Studio", "category": "Sales & POS"},
        {"id": "pos", "name": "Billing Desk", "category": "Sales & POS"},
        {"id": "crm", "name": "CRM & Loyalty", "category": "Sales & POS"},
        {"id": "customer-master", "name": "Customer Master", "category": "Sales & POS"},
        {"id": "loyalty", "name": "Loyalty Studio", "category": "Sales & POS"},
        {"id": "stock-ledger", "name": "Stock Ledger", "category": "Inventory & Sourcing"},
        {"id": "about-smriti", "name": "About SMRITI", "category": "System"}
    ]

    layout_content = file_contents.get("src/layout_engine/layout_store.tsx", "")
    if not layout_content:
        return default_modules

    modules = []
    workspace_pattern = re.compile(
        r"\{[\s\S]*?id:\s*[\"'](.*?)[\"'][\s\S]*?label:\s*[\"'](.*?)[\"'][\s\S]*?icon:\s*[\"'](.*?)[\"'][\s\S]*?category:\s*[\"'](.*?)[\"'][\s\S]*?\}"
    )

    for m in workspace_pattern.finditer(layout_content):
        m_id = m.group(1)
        m_label = m.group(2)
        m_cat = m.group(4)
        if not any(x["id"] == m_id or x["name"] == m_label for x in modules):
            modules.append({"id": m_id, "name": m_label, "category": m_cat})

    return modules if modules else default_modules

def get_module_resource_mapping(module_id: str, module_name: str, module_category: str = "Workspace") -> dict[str, Any]:
    if module_id in MODULES_MAP:
        mapping = dict(MODULES_MAP[module_id])
        if "category" not in mapping or not mapping["category"] or mapping["category"] == "Workspace":
            if module_category and module_category != "Workspace":
                mapping["category"] = module_category
        return mapping

    first_word = module_name.split()[0].lower() if module_name else module_id
    return {
        "name": module_name or module_id,
        "category": module_category or "Workspace",
        "frontend": f"{module_id.replace('-', ' ').title().replace(' ', '')}Tab.tsx",
        "routes": [normalize_api_route(module_id)],
        "tables": [module_id.replace("-", "_")],
        "tests": [module_id, first_word],
        "docs": [module_id, first_word]
    }

def scan_codebase() -> dict[str, Any]:
    configured_root = os.environ.get("SDIC_REPOSITORY_ROOT")
    if configured_root:
        root_dir = Path(configured_root).expanduser().resolve()
    else:
        candidates = [
            Path(__file__).resolve().parent.parent.parent.parent,
            Path.cwd(),
        ]
        root_dir = next(
            (candidate for candidate in candidates if (candidate / "package.json").exists() and (candidate / "src").is_dir()),
            candidates[0],
        )

    if not root_dir.is_dir():
        raise RuntimeError(f"SDIC repository root does not exist: {root_dir}")
    
    # 1. Recurse and gather files
    files_list = []
    file_contents = {}
    todos_count = 0
    fixmes_count = 0
    hacks_count = 0
    large_components = []
    
    routes_in_server = []
    fetched_routes_in_frontend = []
    tables_in_db = []
    test_files = []
    doc_files = []

    extensions = {".ts", ".tsx", ".js", ".jsx", ".css", ".sql", ".md", ".json", ".py"}
    exclude_dirs = {"node_modules", "dist", "build", ".git", ".gemini", ".agents", "backups", "coverage", "exports", "scratch", ".venv", "venv"}

    for dirpath, dirnames, filenames in os.walk(root_dir):
        # Filter directories to avoid recursion overhead
        dirnames[:] = [d for d in dirnames if d not in exclude_dirs]
        for f in filenames:
            ext = os.path.splitext(f)[1]
            if ext in extensions:
                full_path = Path(dirpath) / f
                rel_path = full_path.relative_to(root_dir).as_posix()
                files_list.append(rel_path)
                
                # Test/Doc categorization (Vitest & Pytest)
                if rel_path.startswith("src/tests/") or rel_path.startswith("backend/tests/") or "/tests/" in rel_path or rel_path.endswith(".test.ts") or rel_path.endswith(".test.tsx") or rel_path.endswith("_test.py") or f.startswith("test_"):
                    test_files.append(rel_path)
                elif rel_path.startswith("docs/") and rel_path.endswith(".md"):
                    doc_files.append(rel_path)

                try:
                    with open(full_path, encoding="utf-8", errors="ignore") as file_obj:
                        content = file_obj.read()
                        file_contents[rel_path] = content
                        
                        # Count comments
                        todos_count += len(re.findall(r"\bTODO\b", content, re.IGNORECASE))
                        fixmes_count += len(re.findall(r"\bFIXME\b", content, re.IGNORECASE))
                        hacks_count += len(re.findall(r"\bHACK\b", content, re.IGNORECASE))

                        # Size check
                        if rel_path.startswith("src/components/") and ext in {".ts", ".tsx"}:
                            line_count = len(content.splitlines())
                            if line_count > 500:
                                large_components.append(f"{rel_path} ({line_count} lines)")

                        # FastAPI & Express server routes
                        if rel_path.startswith("backend/app/api/") or rel_path == "server.ts":
                            fastapi_routes = re.findall(r"@(router|app)\.(?:get|post|put|delete|patch)\(\s*['\"](/.*?)['\"]", content)
                            for _, r in fastapi_routes:
                                full_r = r if r.startswith("/api/") else f"/api/v1{r if r.startswith('/') else '/' + r}"
                                if full_r not in routes_in_server:
                                    routes_in_server.append(full_r)
                                if r not in routes_in_server:
                                    routes_in_server.append(r)
                            express_routes = re.findall(r"app\.(?:get|post|put|delete)\(\s*['\"](/api/.*?)['\"]", content)
                            for r in express_routes:
                                if r not in routes_in_server:
                                    routes_in_server.append(r)

                        # Frontend fetches (apiFetchV1, apiFetch, fetch)
                        if rel_path.startswith("src/") and ext in {".ts", ".tsx"} and rel_path != "server.ts":
                            fetches = re.findall(r"(?:apiFetchV1|apiFetch|fetch)\(\s*['\"](/.*?)['\"]", content)
                            for ft in fetches:
                                full_ft = ft if ft.startswith("/api/") else f"/api/v1{ft if ft.startswith('/') else '/' + ft}"
                                if full_ft not in fetched_routes_in_frontend:
                                    fetched_routes_in_frontend.append(full_ft)
                                if ft not in fetched_routes_in_frontend:
                                    fetched_routes_in_frontend.append(ft)

                        # DB schemas (SQLAlchemy models + schema.sql)
                        if rel_path.startswith("backend/app/models/") or rel_path == "src/db/schema.sql" or rel_path == "server.ts":
                            sqla_tables = re.findall(r"__tablename__\s*=\s*['\"](\w+)['\"]", content)
                            for tbl in sqla_tables:
                                tbl_lower = tbl.lower()
                                if tbl_lower not in tables_in_db:
                                    tables_in_db.append(tbl_lower)
                            tables = re.findall(r"CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(\w+)", content, re.IGNORECASE)
                            for tbl in tables:
                                tbl_lower = tbl.lower()
                                if tbl_lower not in tables_in_db:
                                    tables_in_db.append(tbl_lower)

                except Exception as e:
                    print(f"[SDIC Python] Failed to read {rel_path}: {e}")

    # 2. Compute metrics for modules
    modules = []
    total_frontend = 0
    total_backend = 0
    total_db = 0
    total_api = 0
    total_tests = 0
    total_docs = 0
    total_security = 0

    all_backend_content = "\n".join(content for rel_p, content in file_contents.items() if rel_p.startswith("backend/app/") or rel_p == "server.ts")

    normalized_server_routes = [normalize_api_route(r) for r in routes_in_server]
    normalized_fetched_routes = [normalize_api_route(r) for r in fetched_routes_in_frontend]
    all_normalized_routes = set(normalized_server_routes + normalized_fetched_routes)

    discovered_modules = discover_modules(file_contents)

    for m_item in discovered_modules:
        m_id = m_item["id"]
        m_cfg = get_module_resource_mapping(m_id, m_item["name"], m_item.get("category", "Workspace"))
        frontend_file = next((f for f in files_list if m_cfg["frontend"] in f), None)
        ui_designed = bool(frontend_file)
        frontend_started = ui_designed
        frontend_complete = False
        accessibility_complete = False
        localization_complete = False
        mobile_complete = False

        if frontend_file:
            content = file_contents.get(frontend_file, "")
            frontend_complete = "Coming Soon" not in content and "TODO stub" not in content and len(content) > 500
            accessibility_complete = "aria-" in content or "role=" in content or "title=" in content
            localization_complete = "en-IN" in content or "locale" in content or "Currency" in content
            mobile_complete = "sm:" in content or "md:" in content or "hidden lg:flex" in content

        registered_routes = [r for r in m_cfg["routes"] if r in all_normalized_routes or any(nr.startswith(r) or r.startswith(nr) for nr in all_normalized_routes)]
        api_complete = len(registered_routes) > 0
        backend_started = any(r in all_backend_content.lower() for r in m_cfg["routes"]) or api_complete
        backend_complete = False
        business_logic_complete = False
        validation_complete = False
        security_complete = False
        authentication_complete = False
        authorization_complete = False

        if api_complete or backend_started:
            backend_complete = True
            business_logic_complete = "Session" in all_backend_content or "select" in all_backend_content or "query" in all_backend_content or "saveDb" in all_backend_content
            validation_complete = "HTTPException" in all_backend_content or "status_code=400" in all_backend_content or "validate" in all_backend_content
            security_complete = "get_tenant_context" in all_backend_content or "get_current_user" in all_backend_content or "role" in all_backend_content or "token" in all_backend_content
            authentication_complete = "get_current_user" in all_backend_content or "auth" in all_backend_content or "currentUser" in all_backend_content
            authorization_complete = "role" in all_backend_content or "admin" in all_backend_content or "permissions" in all_backend_content

        database_complete = len(m_cfg["tables"]) == 0 or any(tbl in tables_in_db for tbl in m_cfg["tables"])
        
        # Extrapolate reports, printing, tests and docs
        reports_complete = "QuickReports" in file_contents.get(frontend_file, "") if frontend_file else False
        printing_complete = "print" in file_contents.get(frontend_file, "") if frontend_file else False
        barcode_complete = "barcode" in file_contents.get(frontend_file, "") if frontend_file else False
        ai_complete = "ai" in file_contents.get(frontend_file, "") or "GenAI" in file_contents.get(frontend_file, "") if frontend_file else False

        # Tests
        test_keywords = m_cfg.get("tests", [m_id])
        test_file = next((t for t in test_files if any(k.lower() in t.lower() for k in test_keywords)), None)
        unit_tests_complete = bool(test_file)
        integration_tests_complete = unit_tests_complete and ("assert" in file_contents.get(test_file, "") or "expect" in file_contents.get(test_file, "") or "def test_" in file_contents.get(test_file, ""))

        # Docs
        doc_keywords = m_cfg.get("docs", [m_id])
        doc_file = next((d for d in doc_files if any(k.lower() in d.lower() for k in doc_keywords)), None)
        documentation_complete = bool(doc_file)

        qa_complete = unit_tests_complete and "TODO" not in all_backend_content
        performance_complete = ("debounce" in file_contents.get(frontend_file, "") or "useMemo" in file_contents.get(frontend_file, "")) if frontend_file else False
        production_ready = frontend_complete and backend_complete and database_complete and unit_tests_complete and documentation_complete

        # Compute overall %
        scores = [
            100 if ui_designed else 0,
            100 if frontend_started else 0,
            100 if frontend_complete else 0,
            100 if backend_started else 0,
            100 if backend_complete else 0,
            100 if database_complete else 0,
            100 if api_complete else 0,
            100 if business_logic_complete else 0,
            100 if validation_complete else 0,
            100 if security_complete else 0,
            100 if authentication_complete else 0,
            100 if authorization_complete else 0,
            100 if reports_complete else 0,
            100 if printing_complete else 0,
            100 if barcode_complete else 0,
            100 if ai_complete else 0,
            100 if unit_tests_complete else 0,
            100 if integration_tests_complete else 0,
            100 if accessibility_complete else 0,
            100 if performance_complete else 0,
            100 if localization_complete else 0,
            100 if mobile_complete else 0,
            100 if documentation_complete else 0,
            100 if qa_complete else 0,
            100 if production_ready else 0
        ]
        overall_percentage = int(sum(scores) / len(scores))

        # Risk rating
        risk_rating = "Low"
        if not frontend_started and not backend_started:
            risk_rating = "Critical"
        elif not frontend_complete or not backend_complete:
            risk_rating = "High"
        elif not unit_tests_complete or not documentation_complete:
            risk_rating = "Medium"

        modules.append({
            "id": m_id,
            "name": m_cfg["name"],
            "category": m_cfg["category"],
            "uiDesigned": ui_designed,
            "frontendStarted": frontend_started,
            "frontendComplete": frontend_complete,
            "backendStarted": backend_started,
            "backendComplete": backend_complete,
            "databaseComplete": database_complete,
            "apiComplete": api_complete,
            "businessLogicComplete": business_logic_complete,
            "validationComplete": validation_complete,
            "securityComplete": security_complete,
            "authenticationComplete": authentication_complete,
            "authorizationComplete": authorization_complete,
            "reportsComplete": reports_complete,
            "printingComplete": printing_complete,
            "barcodeComplete": barcode_complete,
            "aiComplete": ai_complete,
            "unitTestsComplete": unit_tests_complete,
            "integrationTestsComplete": integration_tests_complete,
            "accessibilityComplete": accessibility_complete,
            "performanceComplete": performance_complete,
            "localizationComplete": localization_complete,
            "mobileComplete": mobile_complete,
            "documentationComplete": documentation_complete,
            "qaComplete": qa_complete,
            "productionReady": production_ready,
            "missingDependencies": ["Unit tests missing"] if not unit_tests_complete else [],
            "recommendations": ["Write automated unit tests."] if not unit_tests_complete else [],
            "riskRating": risk_rating,
            "overallPercentage": overall_percentage
        })

        total_frontend += 100 if frontend_complete else (50 if frontend_started else 0)
        total_backend += 100 if backend_complete else (50 if backend_started else 0)
        total_db += 100 if database_complete else 0
        total_api += 100 if api_complete else 0
        total_tests += 100 if unit_tests_complete else 0
        total_docs += 100 if documentation_complete else 0
        total_security += 100 if security_complete else 0

    module_count = len(discovered_modules) or 1
    avg_frontend = int(total_frontend / module_count)
    avg_backend = int(total_backend / module_count)
    avg_db = int(total_db / module_count)
    avg_api = int(total_api / module_count)
    avg_tests = int(total_tests / module_count)
    avg_docs = int(total_docs / module_count)
    avg_security = int(total_security / module_count)

    dhi = int(
        (avg_frontend * 0.18) +
        (avg_backend * 0.18) +
        (avg_db * 0.12) +
        (avg_api * 0.12) +
        (avg_tests * 0.16) +
        (avg_docs * 0.12) +
        (avg_security * 0.12)
    )

    grade = "D"
    if dhi >= 90:
        grade = "A"
    elif dhi >= 80:
        grade = "B"
    elif dhi >= 70:
        grade = "C"

    # Git metadata
    git_info = {
        "branch": "main",
        "lastCommitHash": "e4c2149",
        "lastCommitMessage": "style: Phase 3C - rollout standardized project headers",
        "lastCommitAuthor": "Jawahar Ramkripal Mallah",
        "lastCommitDate": "2026-07-11",
        "pendingChangesCount": 0,
        "commitCount": 145,
        "releaseVersion": "3.5.0",
        "pendingFiles": []
    }

    try:
        git_kwargs = {"text": True, "cwd": str(root_dir)}
        git_info["branch"] = subprocess.check_output(["git", "rev-parse", "--abbrev-ref", "HEAD"], **git_kwargs).strip()
        git_info["lastCommitHash"] = subprocess.check_output(["git", "log", "-n", "1", "--format=%h"], **git_kwargs).strip()
        git_info["lastCommitMessage"] = subprocess.check_output(["git", "log", "-n", "1", "--format=%s"], **git_kwargs).strip()
        git_info["lastCommitAuthor"] = subprocess.check_output(["git", "log", "-n", "1", "--format=%an"], **git_kwargs).strip()
        git_info["lastCommitDate"] = subprocess.check_output(["git", "log", "-n", "1", "--format=%ad", "--date=short"], **git_kwargs).strip()
        git_info["commitCount"] = int(subprocess.check_output(["git", "rev-list", "--count", "HEAD"], **git_kwargs).strip())
        status_out = subprocess.check_output(["git", "status", "--porcelain"], **git_kwargs).strip()
        if status_out:
            git_info["pendingFiles"] = [line[3:].strip() for line in status_out.splitlines()]
            git_info["pendingChangesCount"] = len(git_info["pendingFiles"])
            
        with open(root_dir / "package.json") as p_file:
            pkg_data = json.load(p_file)
            git_info["releaseVersion"] = pkg_data.get("version", "3.5.0")
    except Exception as e:
        print(f"[SDIC Python] Git metadata gather warning: {e}")

    # Code Health
    code_health = {
        "todoCount": todos_count,
        "fixmeCount": fixmes_count,
        "hackCount": hacks_count,
        "largeComponents": large_components,
        "unusedComponents": [],
        "unusedApis": [rt for rt in routes_in_server if rt not in fetched_routes_in_frontend],
        "deadFiles": [],
        "duplicateComponents": [],
        "duplicateCssCount": 0,
        "circularDependencies": []
    }

    # Risk analysis
    critical_count = sum(1 for m in modules if m["riskRating"] == "Critical")
    high_count = sum(1 for m in modules if m["riskRating"] == "High")
    medium_count = sum(1 for m in modules if m["riskRating"] == "Medium")
    low_count = sum(1 for m in modules if m["riskRating"] == "Low")

    # Historical entries loader
    history = []
    history_path = root_dir / "docs" / "reports" / "history.json"
    if history_path.exists():
        try:
            with open(history_path, encoding="utf-8") as hist_file:
                history = json.load(hist_file)
        except Exception as e:
            print(f"[SDIC Python] Failed to load history.json: {e}")

    quality_penalty = min(35, int((todos_count + (fixmes_count * 2) + (hacks_count * 3)) / 100))
    large_component_penalty = min(25, len(large_components))
    quality_score = max(0, 100 - quality_penalty - large_component_penalty)
    release_score = int(round(
        (dhi * 0.40)
        + (quality_score * 0.20)
        + (avg_tests * 0.15)
        + (avg_docs * 0.10)
        + (avg_security * 0.15)
    ))

    return {
        "repositoryRoot": str(root_dir),
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "gitInfo": git_info,
        "releaseScores": {
            "dhi": dhi,
            "developmentScore": int((avg_frontend + avg_backend + avg_db + avg_api) / 4),
            "qualityScore": quality_score,
            "releaseScore": release_score,
            "securityScore": avg_security,
            "testCoverage": avg_tests,
            "documentation": avg_docs,
            "grade": grade
        },
        "riskAnalysis": {
            "critical": critical_count,
            "high": high_count,
            "medium": medium_count,
            "low": low_count
        },
        "codeHealth": code_health,
        "modules": modules,
        "history": history
    }
