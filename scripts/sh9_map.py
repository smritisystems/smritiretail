"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 1.0.0
Created      : 2026-08-24
Modified     : 2026-08-24
Copyright    : (c) SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal

Sprint 1 -- Legacy Menu to SMRITI Workspace Mapping Matrix
Reads: docs/legacy/shoper/SH9_MENU_CATALOG.csv
Produces:
  docs/legacy/shoper/SH9_MENU_MAP.md  -- full mapping narrative
  SH9_MAP_MATRIX.csv                  -- machine-readable mapping

Migration statuses:
  MAPPED      -- has a direct 1:1 SMRITI equivalent action/workspace
  MERGED      -- consolidated into a larger SMRITI workspace (multi-function)
  REPLACED    -- functionally replaced by SMRITI's own improved design
  DEPRECATED  -- Shoper-specific (Tally sync, S9Q patch mgmt) -- no SMRITI equiv needed
  NOT_APPLIC  -- internal Shoper infrastructure (Help, Shoper root nodes)
  PENDING     -- requires further analysis before classification
"""

import csv
from pathlib import Path
from datetime import datetime
from collections import defaultdict

INI_DIR = Path(r"F:\SMRITRretailNX\docs\legacy\shoper")
CAT_CSV = INI_DIR / "SH9_MENU_CATALOG.csv"
MAP_CSV = INI_DIR / "SH9_MAP_MATRIX.csv"
MAP_MD  = INI_DIR / "SH9_MENU_MAP.md"

# ─── SMRITI Workspace Registry (from CANONICAL_34_MENU_MATRIX) ───────────────
#  menu_id -> {workspace, action, permission}
SMRITI_WS = {
    "dashboard":       {"menu_id": "menu-dashboard",       "ws": "Dashboard",            "module": "SYSTEM"},
    "pos_workspace":   {"menu_id": "menu-pos",             "ws": "POS Hub",              "module": "SALES"},
    "sales_billing":   {"menu_id": "menu-sales",           "ws": "Sales Workspace",      "module": "SALES"},
    "customer_master": {"menu_id": "menu-customer-master", "ws": "Customer Workspace",   "module": "CRM"},
    "crm_studio":      {"menu_id": "menu-crm",             "ws": "CRM Studio",           "module": "CRM"},
    "loyalty_rewards": {"menu_id": "menu-loyalty",         "ws": "Loyalty Workspace",    "module": "CRM"},
    "inventory_ws":    {"menu_id": "menu-inventory",       "ws": "Inventory Hub",        "module": "INVENTORY"},
    "item_master":     {"menu_id": "menu-item-master",     "ws": "Item Master",          "module": "INVENTORY"},
    "barcode_studio":  {"menu_id": "menu-barcode",         "ws": "Barcode Studio",       "module": "INVENTORY"},
    "stock_ledger":    {"menu_id": "menu-stock-ledger",    "ws": "Stock Ledger",         "module": "INVENTORY"},
    "purchase_studio": {"menu_id": "menu-purchase",        "ws": "Purchase Workspace",   "module": "PURCHASE"},
    "supplier_mgmt":   {"menu_id": "menu-supplier-mgmt",  "ws": "Supplier Management",  "module": "PURCHASE"},
    "business_ledger": {"menu_id": "menu-business-ledger","ws": "Business Ledger",      "module": "FINANCE"},
    "accounting_sync": {"menu_id": "menu-accounting-sync","ws": "Accounting Sync",      "module": "FINANCE"},
    "reports_portal":  {"menu_id": "menu-reports",         "ws": "Reports Portal",       "module": "REPORTS"},
    "report_designer": {"menu_id": "menu-report-designer", "ws": "Report Designer",      "module": "REPORTS"},
    "governance_mast": {"menu_id": "menu-masters",         "ws": "Governance Masters",   "module": "CONFIG"},
    "numbering_eng":   {"menu_id": "menu-document-series", "ws": "Numbering Engine",     "module": "CONFIG"},
    "print_studio":    {"menu_id": "menu-print-studio",    "ws": "Print Studio",         "module": "CONFIG"},
    "data_exchange":   {"menu_id": "menu-data-exchange",   "ws": "Data Exchange",        "module": "CONFIG"},
    "company_setup":   {"menu_id": "menu-company-setup",   "ws": "Company Setup",        "module": "ADMIN"},
    "staff_mgmt":      {"menu_id": "menu-staff-management","ws": "Staff Management",     "module": "ADMIN"},
    "audit_logs":      {"menu_id": "menu-audit-logs",      "ws": "Audit Logs",           "module": "ADMIN"},
    "approval_matrix": {"menu_id": "menu-approval-matrix", "ws": "Approval Matrix",      "module": "ADMIN"},
}

# ─── The Mapping Table (evidence-based, entry by entry) ──────────────────────
# (MnuNo, MenuOpt) -> mapping decision
# Format: (smriti_ws_key, smriti_action, document_type, migration_status, notes)

MAPPING = {
    # ── ROOT (MnuNo=0) ─────────────────────────────────────────────────────────
    (0,100): ("pos_workspace",    "NAVIGATE",  "",          "MERGED",     "SMRITI root nav: POS Hub"),
    (0,200): ("business_ledger",  "NAVIGATE",  "",          "MERGED",     "SMRITI root nav: Business Ledger"),
    (0,300): ("inventory_ws",     "NAVIGATE",  "",          "MERGED",     "SMRITI root nav: Inventory Hub"),
    (0,400): ("reports_portal",   "NAVIGATE",  "",          "MERGED",     "SMRITI root nav: Reports Portal"),
    (0,500): ("governance_mast",  "NAVIGATE",  "",          "MERGED",     "SMRITI root nav: Governance Masters"),
    (0,600): ("item_master",      "NAVIGATE",  "",          "MERGED",     "SMRITI root nav: Item Master (Catalogue)"),
    (0,700): ("company_setup",    "NAVIGATE",  "",          "MERGED",     "SMRITI root nav: Company Setup"),
    (0,800): ("dashboard",        "NAVIGATE",  "",          "NOT_APPLIC", "Help menu -- no SMRITI equivalent needed"),

    # ── SALES (MnuNo=100) ──────────────────────────────────────────────────────
    # SR130000.EXE handles Billing/Return/Cancellation via pgmopt/MultiInstance
    (100,101): ("sales_billing", "NEW_TRANSACTION",    "SALES_INVOICE",      "MAPPED",     "Sales Workspace: New Tax Invoice. MultiInstance=1 preserved via tabbed session."),
    (100,102): ("sales_billing", "NEW_TRANSACTION",    "SALES_RETURN",       "MERGED",     "Sales Workspace: Return document type. Single workspace, doc-type driven."),
    (100,103): ("sales_billing", "NEW_TRANSACTION",    "SALES_CANCELLATION", "MERGED",     "Sales Workspace: Cancellation doc type. TrnType=1600 (Void). Same workspace."),
    (100,104): ("sales_billing", "NEW_TRANSACTION",    "SALES_ADVICE_SLIP",  "MERGED",     "Sales Workspace: Advice Slip sub-mode via pgmopt=2."),
    (100,105): ("sales_billing", "NEW_TRANSACTION",    "SERVICE_ORDER",      "MERGED",     "Sales Workspace: Service Order sub-mode via pgmopt=7."),
    (100,106): ("sales_billing", "NEW_TRANSACTION",    "SALES_ORDER",        "MERGED",     "Sales Workspace: Sales Order sub-mode via pgmopt=3."),
    (100,107): ("sales_billing", "CONVERT",            "SALES_ORDER",        "MAPPED",     "Sales Workspace: Order Conversion action (SR131400.EXE)."),
    (100,108): ("customer_master","WALKIN_ENTRY",       "",                   "MAPPED",     "Customer Workspace: Walk-in registration. Distinct action within Customer WS."),
    (100,109): ("sales_billing", "CHANGE_PAYMENT_MODE","",                   "MAPPED",     "Sales Workspace: Post-bill payment mode amendment. AllowWhenTrnClosed=1."),
    (100,110): ("sales_billing", "RECALL_PENDING",     "",                   "MAPPED",     "Sales Workspace: Recall/close pending transactions. AllowWhenTrnClosed=1."),
    (100,111): ("sales_billing", "GENERATE_EXCISE",    "EXCISE_INVOICE",     "DEPRECATED", "Excise Invoice -- pre-GST. GST era: E-Invoice via compliance gateway instead."),
    (100,112): ("purchase_studio","NEW_TRANSACTION",   "TRANSPORT_RECEIPT",  "MERGED",     "Transport Receipt -- merged into Purchase Workspace inbound logistics."),

    # ── CASH (MnuNo=200) ───────────────────────────────────────────────────────
    (200,201): ("business_ledger","NEW_TRANSACTION",   "CASH_PAYOUT",        "MAPPED",     "Business Ledger: Cash Payout document."),
    (200,202): ("business_ledger","NEW_TRANSACTION",   "CASH_RECEIPT",       "MAPPED",     "Business Ledger: Cash Receipt document."),
    (200,250): ("business_ledger","NAVIGATE",          "",                   "MERGED",     "Credit Card group -- merged into Business Ledger sub-section."),
    (200,260): ("business_ledger","NAVIGATE",          "",                   "MERGED",     "Franchisee A/C group -- merged into Business Ledger."),
    (200,270): ("business_ledger","NAVIGATE",          "",                   "MAPPED",     "Till Management group -- SMRITI Business Ledger: Till section."),
    (200,280): ("business_ledger","NAVIGATE",          "",                   "MAPPED",     "Credit Sale Management group -- Business Ledger: Credit section."),

    # Credit Card sub-group (250)
    (250,251): ("business_ledger","NEW_TRANSACTION",   "CC_SUBMISSION",      "MAPPED",     "Business Ledger: Credit Card Submission."),
    (250,252): ("business_ledger","NEW_TRANSACTION",   "CC_REALISATION",     "MAPPED",     "Business Ledger: Credit Card Realisation."),

    # Franchisee A/C sub-group (260)
    (260,261): ("business_ledger","NEW_TRANSACTION",   "FRANCHISEE_PAYMENT", "PENDING",    "Franchisee HO payments -- assess if SMRITI multi-company covers this."),
    (260,262): ("company_setup",  "VIEW",              "",                   "MERGED",     "Franchisee Details Form -> Company Setup in SMRITI."),
    (260,263): ("business_ledger","VIEW",              "FRANCHISEE_OUTSTANDING","PENDING", "Franchisee outstanding report -- assess vs Business Ledger reports."),
    (260,265): ("business_ledger","NEW_TRANSACTION",   "PAYIN_SLIP",         "PENDING",    "Pay-in Slip -- bank deposit document. Not yet in SMRITI ledger."),

    # Till Management sub-group (270)
    (270,271): ("business_ledger","VIEW",              "TILL_STATUS",        "MAPPED",     "Till Status report in Business Ledger."),
    (270,272): ("business_ledger","SET_OPENING_BAL",   "TILL",               "MAPPED",     "Till: Set Opening Balance action."),
    (270,273): ("business_ledger","NEW_TRANSACTION",   "CASH_LIFT",          "MAPPED",     "Till: Cash Lift action."),
    (270,274): ("business_ledger","RECONCILE",         "TILL",               "MAPPED",     "Till: End-of-day reconciliation."),
    (270,275): ("business_ledger","OPEN_CASH_DRAWER",  "",                   "MAPPED",     "Till: Open Cash Drawer hardware command."),
    (270,276): ("business_ledger","REPRINT",           "TILL_REPORT",        "MAPPED",     "Till: Reprint last till report."),
    (270,277): ("business_ledger","VIEW",              "TILL_ACTIVITY",      "MAPPED",     "Till Activity Log."),

    # Credit Sale Management sub-group (280)
    (280,281): ("business_ledger","COLLECT_PAYMENT",   "CREDIT_SALE",        "MAPPED",     "Credit Sale: Collect payment from credit customer."),
    (280,282): ("business_ledger","SET_OPENING_BAL",   "CREDIT_SALE",        "MAPPED",     "Credit Sale: Set opening balance for credit account."),
    (280,283): ("business_ledger","CLEAR",             "CREDIT_NOTE",        "MAPPED",     "Credit Sale: Clear/apply credit note."),
    (280,284): ("business_ledger","VIEW",              "CREDIT_SALE",        "MAPPED",     "Credit Sale: Transaction list view."),

    # ── STOCK (MnuNo=300) ──────────────────────────────────────────────────────
    (300,311): ("data_exchange",  "IMPORT",            "PT_FILE_DC",         "REPLACED",   "PT File DC import -> SMRITI Data Exchange module. Legacy S9Q mechanism retired."),
    (300,312): ("stock_ledger",   "NEW_TRANSACTION",   "PHYSICAL_VERIFY",    "MAPPED",     "Stock Ledger: Physical Verification (TrnType=9700)."),
    (300,313): ("purchase_studio","NEW_TRANSACTION",   "GOODS_INWARDS",      "MAPPED",     "Purchase Workspace: Goods Inwards / GRN."),
    (300,314): ("purchase_studio","NEW_TRANSACTION",   "GOODS_INWARDS_SIZE", "MERGED",     "Size-wise GRN -- merged into Purchase Workspace with size matrix capability."),
    (300,315): ("stock_ledger",   "NEW_TRANSACTION",   "GOODS_OUTWARDS",     "MAPPED",     "Stock Ledger: Goods Outwards / DC (TrnType=9200)."),
    (300,316): ("data_exchange",  "VIEW",              "PT_FILE_INFO",       "REPLACED",   "PT File Information -> Data Exchange history view."),
    (300,317): ("stock_ledger",   "VIEW",              "AUDIT_TRAIL_SIZE",   "MERGED",     "Audit Trail Size-wise -> Stock Ledger reports."),

    # Stock sub-groups (navigation nodes)
    (300,350): ("stock_ledger",   "NAVIGATE", "STOCK_TAKE",         "MAPPED",  "Stock Take group -> Stock Ledger workspace."),
    (300,360): ("purchase_studio","NAVIGATE", "CARTON_MGMT",        "MAPPED",  "Carton Management group -> Purchase Workspace."),
    (300,370): ("barcode_studio", "NAVIGATE", "BARCODE",            "MAPPED",  "Barcode group -> Barcode Studio."),
    (300,380): ("purchase_studio","NAVIGATE", "PURCHASE_ORDER",     "MAPPED",  "Purchase Order group -> Purchase Workspace."),
    (350,351): ("stock_ledger",   "NEW_TRANSACTION",   "PHYSICAL_STOCK",     "MAPPED",     "Stock Ledger: Physical Stock Management."),
    (350,352): ("stock_ledger",   "VIEW",              "PHY_VS_COMPUTED",    "MAPPED",     "Stock Ledger: Physical vs Computed Stock report."),
    (350,353): ("stock_ledger",   "VIEW",              "PHYSICAL_STOCK_RPT", "MAPPED",     "Stock Ledger: Physical Stock Report."),
    (350,354): ("stock_ledger",   "VIEW",              "PHYS_STK_BATCH",     "MAPPED",     "Stock Ledger: Physical Stock Batch-wise report."),

    # Carton Management sub-group (360)
    (360,361): ("item_master",    "NEW_RECORD",        "CARTON_TYPE",        "MAPPED",     "Item Master: Carton Type master record."),
    (360,362): ("purchase_studio","NEW_TRANSACTION",   "CARTON",             "MAPPED",     "Purchase Workspace: Carton transaction."),
    (360,363): ("purchase_studio","NEW_TRANSACTION",   "PACKING",            "MAPPED",     "Purchase Workspace: Packing slip."),

    # Barcode sub-group (370)
    (370,371): ("barcode_studio", "DESIGN",            "BARCODE_LABEL",      "MAPPED",     "Barcode Studio: Design label for barcode printers."),
    (370,372): ("barcode_studio", "DESIGN",            "STD_LABEL",          "MAPPED",     "Barcode Studio: Design label for standard printers."),
    (370,373): ("barcode_studio", "DESIGN",            "STD_LAYOUT",         "MAPPED",     "Barcode Studio: Design layout for standard printers."),
    (370,374): ("barcode_studio", "PRINT",             "BARCODE_LABELS",     "MAPPED",     "Barcode Studio: Print labels."),

    # Purchase Order sub-group (380)
    (380,381): ("purchase_studio","NEW_TRANSACTION",   "PURCHASE_ORDER",     "MAPPED",     "Purchase Workspace: PO generation."),
    (380,382): ("purchase_studio","IMPORT",            "PURCHASE_ORDER",     "MAPPED",     "Purchase Workspace: Import PO from external."),
    (380,383): ("purchase_studio","FORECLOSE",         "PURCHASE_ORDER",     "MAPPED",     "Purchase Workspace: Foreclose PO."),
    (380,384): ("purchase_studio","REOPEN",            "PURCHASE_ORDER",     "MAPPED",     "Purchase Workspace: Reopen PO."),
    (380,385): ("purchase_studio","EXPORT",            "PURCHASE_ORDER",     "MAPPED",     "Purchase Workspace: Export PO."),
    (380,386): ("purchase_studio","REPRINT",           "PURCHASE_ORDER",     "MAPPED",     "Purchase Workspace: Reprint PO."),
    (380,387): ("purchase_studio","VIEW",              "PO_STATUS",          "MAPPED",     "Purchase Workspace: PO status report."),
    (380,388): ("purchase_studio","CONVERT",           "PO_INDENT",          "MAPPED",     "Purchase Workspace: PO/Indent conversion."),
    (380,389): ("purchase_studio","CONFIGURE",         "PURCHASE_ORDER",     "MERGED",     "PO Configuration -> Purchase Workspace settings panel."),
    (380,390): ("purchase_studio","CONFIGURE",         "PO_CONFIG",          "MERGED",     "Purchase Order Configuration (SE100280.exe) -> Purchase Workspace settings."),

    # ── REPORTS (MnuNo=400 / sub 500s) ────────────────────────────────────────
    (400,410): ("reports_portal", "NAVIGATE",          "SALES_REPORTS",      "MAPPED",     "Reports: Sales sub-group."),
    (400,420): ("reports_portal", "NAVIGATE",          "STOCK_REPORTS",      "MAPPED",     "Reports: Stock sub-group."),
    (400,430): ("reports_portal", "NAVIGATE",          "STOCK_REGISTERS",    "MAPPED",     "Reports: Stock Registers sub-group."),
    (400,440): ("business_ledger","NAVIGATE",          "CASH_REPORTS",       "MERGED",     "Cash reports -> Business Ledger report section."),
    (400,450): ("reports_portal", "NAVIGATE",          "MIS_REPORTS",        "MAPPED",     "Reports: MIS sub-group."),
    (400,460): ("reports_portal", "NAVIGATE",          "ANALYSIS_REPORTS",   "MAPPED",     "Reports: Analysis Reports sub-group."),
    (400,470): ("reports_portal", "NAVIGATE",          "MIS",                "MAPPED",     "Reports: MIS navigation group."),
    (400,900): ("report_designer","NAVIGATE",          "ANALYSIS_REPORTS",   "MAPPED",     "Reports: Analysis Reports navigation -> Report Designer."),

    # ── HOUSEKEEPING (MnuNo=500) ───────────────────────────────────────────────
    (500,501): ("governance_mast","DAY_OPEN",          "",                   "MAPPED",     "Governance: Open Day operation."),
    (500,502): ("governance_mast","DAY_CLOSE",         "",                   "MAPPED",     "Governance: Close Day operation."),
    (500,503): ("governance_mast","BACKUP",            "DATABASE",           "MAPPED",     "Governance: Database Backup."),
    (500,504): ("governance_mast","RESTORE",           "DATABASE",           "MAPPED",     "Governance: Database Restore."),
    (500,505): ("governance_mast","COMPACT",           "DATABASE",           "MAPPED",     "Governance: Compact Database."),
    (500,506): ("governance_mast","TUNE",              "DATABASE",           "MAPPED",     "Governance: Database Tuning."),
    (500,507): ("governance_mast","PURGE",             "DATA",               "MAPPED",     "Governance: Purge Data (restricted action)."),
    (500,508): ("governance_mast","DELETE",            "TEMP_TABLES",        "REPLACED",   "Delete Temp Tables -- SMRITI uses PostgreSQL, no temp table cleanup needed."),
    (500,509): ("governance_mast","DELETE",            "BACKUP_FILE",        "DEPRECATED", "Delete Backup File -- OS-level operation, not in SMRITI scope."),
    (500,540): ("data_exchange",  "NAVIGATE",          "SYNC",               "MAPPED",     "POS-HO Synchronisation group -> Data Exchange sync module."),
    (500,550): ("data_exchange",  "NAVIGATE",          "IMPORT",             "MAPPED",     "Data Import group -> Data Exchange."),
    (500,560): ("governance_mast","NAVIGATE",          "BACKEND_DATA",       "REPLACED",   "Back-end Data -> SMRITI Admin / System Config (Postgres-native)."),
    (500,570): ("governance_mast","MANAGE",            "ALERTS",             "MAPPED",     "Alerts Management -> Governance Masters alerts config."),
    (500,580): ("governance_mast","CONFIGURE",         "COMMUNICATION",      "MAPPED",     "Communication Configuration -> Governance Masters comm settings."),
    (500,590): ("reports_portal", "VIEW",              "ACTIVITY_LOG",       "MAPPED",     "Activity Log -> Reports Portal / Audit Logs."),

    # POS-HO Sync sub-group (540)
    (540,541): ("data_exchange",  "SEND",              "FLAT_FILES",         "REPLACED",   "Send Flat Files to HO -> SMRITI cloud sync via API, not flat files."),
    (540,542): ("data_exchange",  "SYNC",              "MANUAL",             "MAPPED",     "Synchronise Manually -> Data Exchange manual trigger."),
    (540,543): ("data_exchange",  "CONFIGURE",         "SYNC",               "MAPPED",     "Configure Synchronisation -> Data Exchange settings."),
    (540,544): ("data_exchange",  "VIEW",              "SYNC_STATUS",        "MAPPED",     "Sync Status Report -> Data Exchange status dashboard."),

    # Data Import sub-group (550)
    (550,551): ("data_exchange",  "IMPORT",            "ITEM_MASTER",        "MAPPED",     "Import Item Master -> Data Exchange: Item Master import."),
    (550,552): ("data_exchange",  "IMPORT",            "PRICE_REVISION",     "MAPPED",     "Import Price Revision -> Data Exchange: Pricing import."),
    (550,553): ("data_exchange",  "IMPORT",            "CUSTOMER_INFO",      "MAPPED",     "Import Customer Information -> Data Exchange: Customer import."),
    (550,554): ("data_exchange",  "IMPORT",            "SALES_PROMOTIONS",   "MAPPED",     "Import Active Sales Promotions -> Data Exchange: Promotions import."),
    (550,555): ("data_exchange",  "IMPORT",            "SECONDARY_ITEMS",    "PENDING",    "Import Items from Secondary to Primary Db -> assess SMRITI multi-db need."),
    (550,556): ("data_exchange",  "IMPORT",            "SALES_PROMOTIONS",   "MERGED",     "Sales Promotions import variant -- merged with 554."),

    # ── CATALOGUE (MnuNo=600) ──────────────────────────────────────────────────
    (600,601): ("item_master",    "LOOKUP",            "GENERAL",            "MERGED",     "General Lookup -> Item Master lookup/search."),
    (600,602): ("governance_mast","CONFIGURE",         "VENDOR_TAX",         "PENDING",    "Vendor Tax config -- assess if under Supplier Mgmt or Governance."),
    (600,604): ("item_master",    "CONFIGURE",         "ITEM_CLASSIFICATION","MAPPED",     "Item Classification -> Item Master: Category/Class config."),
    (600,605): ("item_master",    "CONFIGURE",         "SIZE_MANAGEMENT",    "MAPPED",     "Size Management -> Item Master: Size/Attribute matrix config."),
    (600,606): ("item_master",    "NEW_RECORD",        "ITEM_MASTER",        "MAPPED",     "Item Master entry -> Item Master workspace."),
    (600,607): ("item_master",    "CONFIGURE",         "PRICE_REVISIONS",    "MAPPED",     "Define Price Revisions -> Item Master: Pricing rules."),
    (600,608): ("governance_mast","CONFIGURE",         "SALES_PROMOTIONS",   "MAPPED",     "Define Sales Promotions -> Governance: Promotions config."),
    (600,610): ("governance_mast","CONFIGURE",         "SALES_FACTORS",      "MERGED",     "Sales Factors -> Governance Masters config."),
    (600,611): ("governance_mast","CONFIGURE",         "PAYMENT_MODE",       "MAPPED",     "Payment Mode config -> Governance Masters."),
    (600,618): ("company_setup",  "CONFIGURE",         "HO_CHAIN",           "PENDING",    "HO Chain Stores config -- assess multi-company setup context."),
    (600,619): ("staff_mgmt",     "CONFIGURE",         "SALES_PERSONNEL",    "MAPPED",     "Sales Personnel -> Staff Management: Personnel records."),
    (600,620): ("governance_mast","CONFIGURE",         "CUSTOMER_PG",        "MAPPED",     "Customer Price Group -> Governance Masters: Pricing rules."),
    (600,621): ("customer_master","NEW_RECORD",        "CUSTOMER",           "MAPPED",     "Customer entry -> Customer Workspace."),
    (600,622): ("customer_master","NEW_TRANSACTION",   "CUSTOMER_MAILER",    "MAPPED",     "Customer Mailer -> Customer Workspace: Bulk communication action."),
    (600,623): ("customer_master","PRINT",             "ADDRESS_LABELS",     "MERGED",     "Print Address Labels -> Customer Workspace print action."),
    (600,624): ("reports_portal", "VIEW",              "CATALOGUE_LISTINGS", "MAPPED",     "Listings -> Reports Portal: Catalogue reports."),

    # Listings sub-group (630-660)
    (630,631): ("reports_portal", "VIEW",              "PRICE_LIST",         "MAPPED",     "Price List report."),
    (630,632): ("reports_portal", "VIEW",              "PRICE_REVISION",     "MAPPED",     "Price Revision report."),
    (630,633): ("reports_portal", "VIEW",              "STYLE_CATALOGUE",    "MAPPED",     "Style Catalogue report."),
    (630,634): ("reports_portal", "VIEW",              "SALES_PROMOTIONS",   "MAPPED",     "Sales Promotions listing."),
    (630,635): ("reports_portal", "VIEW",              "SALES_FACTORS",      "MAPPED",     "Sales Factors listing."),
    (630,636): ("reports_portal", "VIEW",              "SCHEDULE_DETAILS",   "MERGED",     "Schedule Details -> Reports Portal."),
    (630,637): ("numbering_eng",  "VIEW",              "TERMINAL_PREFIX",    "MAPPED",     "Terminal Prefix listing -> Numbering Engine."),
    (640,641): ("staff_mgmt",     "NEW_RECORD",        "PERSONNEL",          "MAPPED",     "Personnel Catalogue -> Staff Management."),
    (640,642): ("staff_mgmt",     "CONFIGURE",         "INCENTIVE",          "MAPPED",     "Incentive Definition -> Staff Management: Incentive config."),
    (650,651): ("item_master",    "CONFIGURE",         "PERIOD",             "MERGED",     "Week/Season Catalogue -> Item Master: Seasonal attributes."),
    (650,652): ("item_master",    "CONFIGURE",         "SEASON",             "MERGED",     "Season Catalogue -> Item Master: Seasonal attributes."),
    (650,661): ("reports_portal", "VIEW",              "PRICE_LISTING",      "MAPPED",     "Price Listing-New -> Reports Portal."),

    # ── SETUP (MnuNo=700) ──────────────────────────────────────────────────────
    (700,711): ("company_setup",  "NEW_RECORD",        "COMPANY",            "MAPPED",     "Company Creation -> Company Setup workspace."),
    (700,712): ("company_setup",  "EDIT",              "COMPANY",            "MAPPED",     "Company Maintenance -> Company Setup workspace."),
    (700,713): ("company_setup",  "NEW_RECORD",        "SECONDARY_DB",       "REPLACED",   "Create Secondary Database -- SMRITI is cloud-native Postgres, not needed."),
    (700,720): ("governance_mast","NAVIGATE",          "GENERAL_SETUP",      "MAPPED",     "General setup group -> Governance Masters."),
    (700,750): ("staff_mgmt",     "NAVIGATE",          "SUPERVISORY",        "MAPPED",     "Supervisory Functions group -> Staff Management / Admin."),

    # General Setup sub-group (720)
    (720,721): ("governance_mast","CONFIGURE",         "SYSTEM_PARAMS",      "MAPPED",     "System Parameters -> Governance Masters: sysParam config."),
    (720,722): ("numbering_eng",  "CONFIGURE",         "BILL_PREFIX",        "MAPPED",     "Bill Prefix -> Numbering Engine: Document series config."),
    (720,723): ("governance_mast","CONFIGURE",         "STOCK_NUMBERING",    "MAPPED",     "Stock Number Methodology -> Governance: Item numbering policy."),
    (720,724): ("print_studio",   "CONFIGURE",         "PRINT_TEMPLATES",    "MAPPED",     "Printing Templates -> Print Studio."),
    (720,725): ("data_exchange",  "CONFIGURE",         "FLAT_FILE",          "REPLACED",   "Flat File Values -> SMRITI uses API exchange, not flat files."),
    (720,727): ("numbering_eng",  "CONFIGURE",         "CASH_PO_PREFIX",     "MAPPED",     "Cash / PO Prefix -> Numbering Engine."),
    (720,728): ("accounting_sync","CONFIGURE",         "TALLY_MAPPING",      "DEPRECATED", "Tally Interface Mapping -- Tally sync deprecated in SMRITI. GST-native."),
    (720,729): ("accounting_sync","CONFIGURE",         "TALLY_HSN",          "DEPRECATED", "Tally HSN Mapping -- deprecated. SMRITI has native HSN/SAC management."),
    (720,740): ("accounting_sync","NAVIGATE",          "TALLY_UTILS",        "DEPRECATED", "Tally Interface Utilities group -- deprecated entirely."),
    (720,804): ("print_studio",   "CONFIGURE",         "PRINT_ENGINE",       "MAPPED",     "Print Engine Configuration -> Print Studio advanced config."),

    # Tally Interface Utilities (740) -- ALL DEPRECATED
    (740,741): ("accounting_sync","CONFIGURE",         "TALLY_CO_INFO",      "DEPRECATED", "Tally: Change Company Info. Not applicable in SMRITI."),
    (740,742): ("accounting_sync","DELETE",            "TALLY_MAPPING",      "DEPRECATED", "Tally: Delete Mapping. Not applicable."),
    (740,743): ("accounting_sync","MANAGE",            "TALLY_CHANGES",      "DEPRECATED", "Tally: Changes Master. Not applicable."),
    (740,744): ("accounting_sync","MANAGE",            "MISSING_VOUCHERS",   "DEPRECATED", "Tally: Missing Vouchers. Not applicable."),
    (740,745): ("accounting_sync","EXECUTE",           "TALLY_REPOST",       "DEPRECATED", "Tally: Offline Re-posting. Not applicable."),
    (740,746): ("accounting_sync","VIEW",              "VOUCHER_COMPARE",    "DEPRECATED", "Tally: Voucher Comparison. Not applicable."),

    # Supervisory Functions (750)
    (750,751): ("staff_mgmt",     "MANAGE",            "USER_AUTHORISATION", "MAPPED",     "User Authorisation -> Staff Management: Role/Permission assignment."),
    (750,752): ("staff_mgmt",     "CHANGE_PASSWORD",   "",                   "MAPPED",     "Change Password -> Staff Management: User credential management."),
    (750,753): ("staff_mgmt",     "CONFIGURE",         "MENU_WEIGHTS",       "REPLACED",   "Menu/User Weights -> SMRITI uses Role/Policy model, not weights."),
    (750,754): ("staff_mgmt",     "CONFIGURE",         "NODE_RESTRICTION",   "REPLACED",   "Menu/Node Restriction -> SMRITI permission matrix replaces node restrictions."),
    (750,755): ("company_setup",  "MANAGE",            "NODE_MANAGEMENT",    "MAPPED",     "Node Management -> Company Setup: Branch/Terminal management."),
    (750,756): ("governance_mast","EXECUTE",           "DATA_REBUILD",       "MAPPED",     "Data Rebuild -> Governance: Admin data integrity operation."),
    (750,757): ("governance_mast","EXECUTE",           "COST_VARIANCE",      "MAPPED",     "Cost Price Variance Fixing -> Governance: Admin cost correction."),
    (750,758): ("governance_mast","EXECUTE",           "YEAR_END",           "MAPPED",     "Year End Process -> Governance: Fiscal year close."),
    (750,759): ("governance_mast","EXECUTE",           "REOPEN_DAY",         "MAPPED",     "Re-Open Day -> Governance: Privileged day re-open."),
    (750,760): ("governance_mast","EXECUTE",           "DB_ARCHIVAL",        "MAPPED",     "Database Archival -> Governance: Archive old data."),
    (750,765): ("governance_mast","MANAGE",            "DAYEND_ACTIVITY",    "MAPPED",     "Manage DayEnd/DayBegin Activity -> Governance: Day process config."),
    (750,770): ("approval_matrix","APPROVE",           "PRICE_REVISION",     "MAPPED",     "Price Revision Authorisation -> Approval Matrix workspace."),
    (750,771): ("item_master",    "RECLASSIFY",        "ITEM",               "MAPPED",     "Item Reclassification -> Item Master: Reclassify action."),
    (750,772): ("governance_mast","EXECUTE",           "TAX_RECOMPUTE",      "MAPPED",     "Tax Re-computation -> Governance: Admin tax recalc."),

    # ── HELP (MnuNo=800) ───────────────────────────────────────────────────────
    (800,801): ("dashboard",      "HELP",              "",                   "NOT_APPLIC", "Shoper Help -> SMRITI has inline Wiki/Help. External EXE not replicated."),
    (800,802): ("dashboard",      "HELP",              "",                   "NOT_APPLIC", "Support Centre -> SMRITI support via smritibooks.com. Not an action."),
    (800,803): ("dashboard",      "ABOUT",             "",                   "NOT_APPLIC", "About Shoper -> SMRITI has About screen. No migration needed."),
    (800,804): ("dashboard",      "HELP",              "",                   "NOT_APPLIC", "Live Chat -> External. Not migrated."),

    # ── SALES REPORTS (MnuNo=410-420) ─────────────────────────────────────────
    (410,411): ("reports_portal", "VIEW",  "DAILY_SALES_BOOK",    "MAPPED", "Reports: Daily Sales Book."),
    (410,412): ("reports_portal", "VIEW",  "BILLWISE_SALES",      "MAPPED", "Reports: Bill-wise Sales."),
    (410,413): ("reports_portal", "VIEW",  "ITEMWISE_SALES",      "MAPPED", "Reports: Item-wise Sales."),
    (410,414): ("reports_portal", "VIEW",  "TAX_REGISTER_SALES",  "MAPPED", "Reports: Tax Register (Sales)."),
    (410,415): ("reports_portal", "VIEW",  "BILLWISE_ITEMS",      "MAPPED", "Reports: Bill-wise Items."),
    (410,416): ("reports_portal", "VIEW",  "DISCOUNT_GIVEN",      "MAPPED", "Reports: Discount Given."),
    (410,417): ("reports_portal", "VIEW",  "TOP_SELLING",         "MAPPED", "Reports: Top Selling Items."),
    (410,418): ("reports_portal", "VIEW",  "SALESPERSON_SALES",   "MAPPED", "Reports: Salesperson Sales."),
    (410,419): ("reports_portal", "VIEW",  "CANCELLED_BILLS",     "MAPPED", "Reports: Cancelled Bills."),
    (410,420): ("reports_portal", "VIEW",  "RETURNED_BILLS",      "MAPPED", "Reports: Returned Bills."),
    (410,421): ("reports_portal", "VIEW",  "ATTR_SIZE_SALES",     "MAPPED", "Reports: Attribute+Size-wise Sales."),
    (410,422): ("reports_portal", "VIEW",  "DAYWISE_SUMMARY",     "MAPPED", "Reports: Day-wise Sales Summary."),
    (410,423): ("reports_portal", "VIEW",  "ITEMWISE_RETURNS",    "MAPPED", "Reports: Item-wise Sales Returns."),
    (410,424): ("reports_portal", "VIEW",  "SALESPERSON_SUMM",    "MAPPED", "Reports: Salesperson Summary."),
    (410,425): ("reports_portal", "VIEW",  "NODEWISE_DETAILS",    "MAPPED", "Reports: Node-wise Details."),
    (410,426): ("reports_portal", "VIEW",  "SALESPERSON_SUMM",    "MAPPED", "Reports: Salesperson Summary (SR221600)."),
    (410,427): ("reports_portal", "VIEW",  "NODEWISE_DETAILS",    "MAPPED", "Reports: Node-wise Details (SR231900)."),

    # ── STOCK REPORTS (MnuNo=420 area) ────────────────────────────────────────
    (420,421): ("stock_ledger",   "VIEW",  "BAL_MOVEMENT",        "MAPPED", "Stock: Balance Movement Analysis."),
    (420,422): ("stock_ledger",   "VIEW",  "BAL_STYLE_MODEL",     "MAPPED", "Stock: Balance Style/Model-wise."),
    (420,423): ("stock_ledger",   "VIEW",  "DISCREPANCY",         "MAPPED", "Stock: Discrepancy report."),
    (420,424): ("stock_ledger",   "VIEW",  "TXN_LEDGER",          "MAPPED", "Stock: Transaction Ledger."),
    (420,425): ("stock_ledger",   "VIEW",  "ATTR_SIZE_BAL",       "MAPPED", "Stock: Attribute+Size-wise Balance."),
    (420,426): ("stock_ledger",   "VIEW",  "BAL_AS_ON_DATE",      "MAPPED", "Stock: Balance as on Date."),
    (420,427): ("stock_ledger",   "VIEW",  "AGING",               "MAPPED", "Stock: Aging report."),
    (420,428): ("stock_ledger",   "VIEW",  "INWARD_DISCREPANCY",  "MAPPED", "Stock: Inward Discrepancy."),

    # ── STOCK LEDGER REPORTS (MnuNo=430) ──────────────────────────────────────
    (430,431): ("stock_ledger",   "VIEW",  "BAL_MOVEMENT",        "MAPPED", "Stock Ledger: Balance Movement Analysis."),
    (430,432): ("stock_ledger",   "VIEW",  "BAL_STYLE_MODEL",     "MAPPED", "Stock Ledger: Balance Style/Model."),
    (430,433): ("stock_ledger",   "VIEW",  "DISCREPANCY",         "MAPPED", "Stock Ledger: Discrepancy."),
    (430,434): ("stock_ledger",   "VIEW",  "TXN_LEDGER",          "MAPPED", "Stock Ledger: Transaction Ledger."),
    (430,435): ("stock_ledger",   "VIEW",  "ATTR_SIZE_BAL",       "MAPPED", "Stock Ledger: Attribute+Size Balance."),
    (430,436): ("stock_ledger",   "VIEW",  "BAL_AS_ON_DATE",      "MAPPED", "Stock Ledger: Balance as on Date."),
    (430,437): ("stock_ledger",   "VIEW",  "AGING",               "MAPPED", "Stock Ledger: Aging."),
    (430,438): ("stock_ledger",   "VIEW",  "INWARD_DISCREPANCY",  "MAPPED", "Stock Ledger: Inward Discrepancy."),
    (430,439): ("stock_ledger",   "VIEW",  "PURCHASE_TAX_REG",    "MAPPED", "Stock Ledger: Tax Register (Purchase)."),
    (430,440): ("stock_ledger",   "VIEW",  "SIZE_MOVEMENT",       "MAPPED", "Stock Ledger: Size-wise Movement."),
    (430,441): ("stock_ledger",   "VIEW",  "VOID_TRANSACTIONS",   "MAPPED", "Stock Ledger: Void Transactions report."),
    (430,442): ("stock_ledger",   "VIEW",  "INWARD_DISCREPANCY",  "MAPPED", "Stock Ledger: Inward Discrepancy (alt)."),
    (430,443): ("stock_ledger",   "VIEW",  "TAX_REGISTER",        "MAPPED", "Stock Ledger: Tax Register."),
    (430,444): ("stock_ledger",   "NEW_TRANSACTION","VOID_TXN",   "MAPPED", "Stock Ledger: Void Transactions action (SR239800.Exe)."),
    (430,445): ("stock_ledger",   "VIEW",  "STOCK_AVAIL",         "MAPPED", "Stock Ledger: Stock Availability."),
    (430,446): ("stock_ledger",   "VIEW",  "PHYSICAL_VER_STATUS", "MAPPED", "Stock Ledger: Physical Verification Status."),

    # ── STOCK REGISTERS (MnuNo=450) ───────────────────────────────────────────
    (450,451): ("stock_ledger",   "VIEW",  "TXN_GOODS_REG",       "MAPPED", "Stock Registers: Transaction-wise Goods Register."),
    (450,452): ("stock_ledger",   "VIEW",  "ITEMWISE_GOODS_REG",  "MAPPED", "Stock Registers: Item-wise Goods Register."),
    (450,453): ("stock_ledger",   "VIEW",  "AUDIT_TRAIL_SIZE",    "MAPPED", "Stock Registers: Audit Trail Size-wise."),

    # ── CASH REPORTS (MnuNo=460) ──────────────────────────────────────────────
    (460,461): ("business_ledger","VIEW",  "CASH_TXN_RPT",        "MAPPED", "Cash Reports: Cash Transaction report."),
    (460,462): ("business_ledger","VIEW",  "CC_SUBMISSION_LIST",  "MAPPED", "Cash Reports: Credit Card Submission/Realisation List."),
    (460,463): ("business_ledger","VIEW",  "PENDING_CC",          "MAPPED", "Cash Reports: Pending Submissions/Realisations."),
    (460,464): ("business_ledger","VIEW",  "COUNTERWISE_DETAILS", "MAPPED", "Cash Reports: Counter-wise Details."),
    (460,465): ("business_ledger","VIEW",  "CREDIT_NOTE_STATUS",  "MAPPED", "Cash Reports: Credit Note Status."),
    (460,466): ("business_ledger","VIEW",  "COUNTER_SUMMARY",     "MAPPED", "Cash Reports: Counter Summary across Cashiers."),
    (460,467): ("business_ledger","VIEW",  "ADVANCE_RECEIPT",     "MAPPED", "Cash Reports: Advance Receipt Status."),
    (460,469): ("business_ledger","VIEW",  "RECONCILIATION_RPT",  "MAPPED", "Cash Reports: Reconciliation Report."),
    (460,470): ("business_ledger","VIEW",  "TILL_STATUS_RPT",     "MAPPED", "Cash Reports: Till Status Report."),
    (460,471): ("business_ledger","VIEW",  "TILL_ACTIVITY_LOG",   "MAPPED", "Till Management: Till Activity Log."),
    (460,4702):("business_ledger","VIEW",  "CREDIT_SALE_RPT",     "MAPPED", "Credit Sale Management: Credit Sale report."),

    # ── MIS REPORTS (MnuNo=470) ───────────────────────────────────────────────
    (470,471): ("reports_portal", "VIEW",  "MONTHLY_SALES_CMP",   "MAPPED", "MIS: Monthly Sales Comparison."),
    (470,472): ("reports_portal", "VIEW",  "RATE_VARIATION",      "MAPPED", "MIS: Rate Variation report."),
    (470,473): ("reports_portal", "VIEW",  "SALES_ANALYSIS",      "MAPPED", "MIS: Sales Analysis."),
    (470,474): ("reports_portal", "VIEW",  "ATTR_SALES_STOCK",    "MAPPED", "MIS: Attribute-wise Sales and Stock."),
    (470,475): ("reports_portal", "VIEW",  "PENDING_TXN",         "MAPPED", "MIS: Pending Transactions."),
    (470,476): ("reports_portal", "VIEW",  "WALKIN_DETAILS",      "MAPPED", "MIS: Walk-in Details."),
    (470,477): ("reports_portal", "VIEW",  "SUPERCLASS_SALES",    "MAPPED", "MIS: Superclass-wise Sales/Stock."),
    (470,478): ("reports_portal", "VIEW",  "STOCK_ACROSS_CHAIN",  "PENDING","MIS: Stock across Chain -- needs multi-company assessment."),
    (470,479): ("reports_portal", "VIEW",  "TXN_DETAILS_IMG",     "MERGED", "MIS: Transaction Details with Image -> SMRITI bill reprint."),
    (470,480): ("reports_portal", "VIEW",  "GROSS_MARGIN",        "MAPPED", "MIS: Gross Margin report."),
    (470,481): ("reports_portal", "VIEW",  "BILL_REPRINT",        "MAPPED", "MIS: Bill Re-Print."),
    (470,482): ("reports_portal", "VIEW",  "SALES_PROMOTIONS_RPT","MAPPED", "MIS: Sales Promotions report."),
    (470,483): ("reports_portal", "VIEW",  "SALESPERSON_DISC",    "MAPPED", "MIS: Salesperson-wise Discount."),
    (470,490): ("reports_portal", "NAVIGATE","CUSTOMER_OFFTAKE",  "MAPPED", "MIS: Customer Offtake sub-group."),
    (470,491): ("reports_portal", "VIEW",  "EXCISE_REPORT",       "DEPRECATED","MIS: Excise Report -- pre-GST. SMRITI uses GST-native reporting."),
    (470,492): ("reports_portal", "VIEW",  "INCENTIVE_ANALYSIS",  "MAPPED", "MIS: Incentive Analysis report."),

    # Customer Offtake sub-group (490)
    (490,491): ("reports_portal", "VIEW",  "OFFTAKE_PERIOD",      "MAPPED", "Customer Offtake: Period-wise."),
    (490,492): ("reports_portal", "VIEW",  "OFFTAKE_BILLWISE",    "MAPPED", "Customer Offtake: Bill-wise."),
    (490,493): ("reports_portal", "VIEW",  "OFFTAKE_PRODUCTWISE", "MAPPED", "Customer Offtake: Product-wise."),

    # ── HOUSEKEEPING sub-entries ───────────────────────────────────────────────
    (500,510): ("governance_mast","DELETE", "BACKUP_FILE",         "DEPRECATED","Delete Backup File (SR329900) -- OS-level. Not in SMRITI scope."),
    (500,520): ("data_exchange",  "NAVIGATE","SYNC",               "MAPPED", "POS-HO Sync group -> Data Exchange."),
    (500,530): ("data_exchange",  "NAVIGATE","IMPORT",             "MAPPED", "Data Import group -> Data Exchange."),
    (500,581): ("audit_logs",     "VIEW",    "ACTIVITY_LOG",       "MAPPED", "Activity Log -> Audit Logs workspace."),

    # POS-HO Sync sub-entries (520)
    (520,521): ("data_exchange",  "SEND",    "FLAT_FILES",         "REPLACED","Send Flat Files to HO -> SMRITI cloud sync via API, not flat files."),
    (520,522): ("data_exchange",  "SYNC",    "MANUAL",             "MAPPED",  "Synchronise Manually -> Data Exchange manual trigger."),
    (520,523): ("data_exchange",  "CONFIGURE","SYNC",              "MAPPED",  "Configure Synchronisation -> Data Exchange settings."),
    (520,524): ("data_exchange",  "VIEW",    "SYNC_STATUS",        "MAPPED",  "Sync Status Report -> Data Exchange status."),

    # Data Import sub-entries (530)
    (530,531): ("data_exchange",  "IMPORT",  "ITEM_MASTER",        "MAPPED",  "Import Item Master."),
    (530,532): ("data_exchange",  "IMPORT",  "PRICE_REVISION",     "MAPPED",  "Import Price Revision."),
    (530,533): ("data_exchange",  "IMPORT",  "CUSTOMER_INFO",      "MAPPED",  "Import Customer Information."),
    (530,534): ("data_exchange",  "IMPORT",  "REPLICATION",        "PENDING", "Replication Import (AST) -- needs multi-db assessment."),
    (530,535): ("data_exchange",  "IMPORT",  "SALES_PROMOTIONS",   "MAPPED",  "Import Active Sales Promotions."),
    (530,536): ("data_exchange",  "IMPORT",  "SECONDARY_ITEMS",    "PENDING", "Import into Secondary Db -- needs multi-db assessment."),
    (530,537): ("data_exchange",  "IMPORT",  "PRIMARY_ITEMS",      "PENDING", "Import Items Secondary-to-Primary -- needs multi-db assessment."),
    (530,538): ("data_exchange",  "IMPORT",  "SALES_PROMOTIONS",   "MAPPED",  "Sales Promotions import (SR430300)."),

    # Data Export sub-entries (550 already partially mapped, add remaining)
    (550,555): ("data_exchange",  "EXPORT",  "CUSTOMER_INFO",      "MAPPED",  "Export Customer Information."),
    (550,558): ("data_exchange",  "EXPORT",  "REPLICATION",        "PENDING", "Replication Export (AST) -- needs multi-db assessment."),

    # Back-end Data sub-group (560)
    (560,561): ("company_setup",  "CONFIGURE","BACKEND_CONFIG",    "REPLACED","Back-end Configure -> SMRITI Admin uses Postgres-native config."),
    (560,562): ("data_exchange",  "IMPORT",  "BACKEND_DATA",       "REPLACED","Back-end Import -> SMRITI Admin uses Postgres-native import."),

    # ── CATALOGUE oddly-keyed sub-entries ─────────────────────────────────────
    (600,602): ("supplier_mgmt",  "NEW_RECORD","VENDOR",           "MAPPED",  "Vendor master (SR442300 after update) -> Supplier Management."),
    (600,650): ("item_master",    "NAVIGATE",  "LISTINGS",         "MERGED",  "Catalogue Listings group -> Item Master reports."),

    # Tax sub-entries with 4-digit MenuOpt (603.xx format in data as 6031/6032/6033)
    (603,6031):("governance_mast","CONFIGURE","SALES_TAX",         "REPLACED","Sales Tax config -- GST replaced this. SMRITI: GST rate master."),
    (603,6032):("governance_mast","CONFIGURE","PURCHASE_TAX",      "REPLACED","Purchase Tax config -- GST replaced this."),
    (603,6033):("governance_mast","CONFIGURE","EXCISE_DUTY",       "DEPRECATED","Excise Duty config -- pre-GST. Not applicable in SMRITI."),

    # Sales/Stock Factors (609.xx)
    (609,6091):("governance_mast","CONFIGURE","SALES_FACTORS",     "MAPPED",  "Sales Factors -> Governance Masters config."),
    (609,6092):("governance_mast","CONFIGURE","STOCK_FACTORS",     "MAPPED",  "Stock Factors -> Governance Masters config."),

    # Personnel (612.xx)
    (612,6121):("staff_mgmt",     "NEW_RECORD","PERSONNEL",        "MAPPED",  "Personnel Catalogue -> Staff Management."),
    (612,6124):("staff_mgmt",     "CONFIGURE", "INCENTIVE",        "MAPPED",  "Incentive Definition -> Staff Management."),

    # Customer group (613.xx)
    (613,6131):("governance_mast","CONFIGURE","CUSTOMER_PG",       "MAPPED",  "Customer Price Group -> Governance Masters."),
    (613,6132):("customer_master","NEW_RECORD","CUSTOMER",         "MAPPED",  "Customer Catalogue -> Customer Workspace."),
    (613,6133):("customer_master","NEW_TRANSACTION","MAILER",      "MAPPED",  "Customer Mailer -> Customer Workspace."),
    (613,6134):("customer_master","PRINT",     "ADDRESS_LABELS",   "MERGED",  "Print Address Labels -> Customer Workspace print action."),

    # Product Combo / Multiple Price (614.xx)
    (614,6140):("item_master",    "CONFIGURE","PRODUCT_BRAND_COMBO","MAPPED", "Product+Brand Combo Settings -> Item Master attribute config."),
    (614,6141):("item_master",    "CONFIGURE","MULTIPLE_PRICE",    "MAPPED",  "Multiple Price -> Item Master: Multi-price policy config."),

    # Period/Season (615.xx)
    (615,6122):("item_master",    "CONFIGURE","WEEK_CATALOGUE",    "MERGED",  "Week Catalogue -> Item Master seasonal attributes."),
    (615,6123):("item_master",    "CONFIGURE","SEASON_CATALOGUE",  "MERGED",  "Season Catalogue -> Item Master seasonal attributes."),

    # Listings sub-entries (650.xx)
    (650,653): ("reports_portal", "VIEW",  "STYLE_CATALOGUE",      "MAPPED",  "Listings: Style Catalogue."),
    (650,654): ("reports_portal", "VIEW",  "SALES_PROMOTIONS",     "MAPPED",  "Listings: Sales Promotions."),
    (650,655): ("reports_portal", "VIEW",  "SALES_FACTORS",        "MAPPED",  "Listings: Sales Factors."),
    (650,656): ("reports_portal", "VIEW",  "SCHEDULE_DETAILS",     "MERGED",  "Listings: Schedule Details."),
    (650,657): ("numbering_eng",  "VIEW",  "TERMINAL_PREFIX",      "MAPPED",  "Listings: Terminal Prefix -> Numbering Engine."),
    (650,658): ("customer_master","VIEW",  "CUSTOMERS_LIST",       "MAPPED",  "Listing: Customers -> Customer Workspace list view."),
    (650,660): ("staff_mgmt",     "VIEW",  "PERSONNEL_LIST",       "MAPPED",  "PersonnelListing: Personnel Listing -> Staff Management."),


    # ── ANALYSIS REPORTS (MnuNo=900) ───────────────────────────────────────────
    (900,910): ("reports_portal", "NAVIGATE",          "SALES_ANALYSIS",     "MAPPED",     "Analysis Reports: Sales sub-group."),
    (900,920): ("reports_portal", "NAVIGATE",          "STOCK_ANALYSIS",     "MAPPED",     "Analysis Reports: Stock sub-group."),
    (900,930): ("reports_portal", "NAVIGATE",          "CUSTOMER_OFFTAKE",   "MAPPED",     "Analysis Reports: Customer Offtake sub-group."),
    (900,940): ("report_designer","NAVIGATE",          "",                   "MAPPED",     "Report Designer sub-group -> SMRITI Report Designer workspace."),

    # Sales Analysis (910)
    (910,911): ("report_designer","VIEW",              "SALES_BILLWISE",     "MAPPED",     "SR435600.EXE pgmopt=2: Bill-wise Sales -> Report Designer."),
    (910,912): ("report_designer","VIEW",              "SALES_PRODUCTWISE",  "MAPPED",     "SR435600.EXE pgmopt=8: Product-wise."),
    (910,913): ("report_designer","VIEW",              "SALES_PRODBRAND",    "MAPPED",     "SR435600.EXE pgmopt=9: Product+Brand-wise."),
    (910,914): ("report_designer","VIEW",              "SALES_ITEMWISE",     "MAPPED",     "SR435600.EXE pgmopt=10: Item-wise Sales."),
    (910,915): ("report_designer","VIEW",              "SALES_MONTHLY",      "MAPPED",     "SR435600.EXE pgmopt=6: Monthly comparison."),

    # Stock Analysis (920)
    (920,921): ("report_designer","VIEW",              "STOCK_ITEMWISE",     "MAPPED",     "SR435600.EXE pgmopt=11: Item-wise Balance."),
    (920,922): ("report_designer","VIEW",              "STOCK_SIZEWISE",     "MAPPED",     "SR435600.EXE pgmopt=12: Size-wise Balance."),
    (920,923): ("report_designer","VIEW",              "STOCK_MOVEMENT",     "MAPPED",     "SR435600.EXE pgmopt=13: Movement Analysis."),
    (920,924): ("report_designer","VIEW",              "STOCK_ANALYSIS",     "MAPPED",     "SR435600.EXE pgmopt=14: Stock Analysis."),

    # Customer Offtake (930)
    (930,931): ("report_designer","VIEW",              "OFFTAKE_SUMMARY",    "MAPPED",     "SR435600.EXE pgmopt=3: Customer Offtake Summary."),
    (930,932): ("report_designer","VIEW",              "OFFTAKE_DETAILED",   "MAPPED",     "SR435600.EXE pgmopt=4: Offtake Detailed."),
    (930,933): ("report_designer","VIEW",              "OFFTAKE_BRAND",      "MAPPED",     "SR435600.EXE pgmopt=5: Brand-wise Offtake."),

    # Report Designer (940)
    (940,941): ("report_designer","RUN",               "RPT_SALES",          "MAPPED",     "Report Designer: Sales template (pgmopt=201, TrnType=2100)."),
    (940,942): ("report_designer","RUN",               "RPT_STOCK",          "MAPPED",     "Report Designer: Stock template (pgmopt=202)."),
    (940,943): ("report_designer","RUN",               "RPT_SALES_STOCK",    "MAPPED",     "Report Designer: Sales & Stock template (pgmopt=203)."),
    (940,944): ("report_designer","RUN",               "RPT_STOCK_DATE",     "MAPPED",     "Report Designer: Stock as on Date (pgmopt=204)."),
    (940,945): ("report_designer","RUN",               "RPT_TENDER",         "MAPPED",     "Report Designer: Tender report (pgmopt=205, MultiInstance=1)."),
    (940,946): ("report_designer","RUN",               "RPT_SLIPS",          "MAPPED",     "Report Designer: Slips (pgmopt=206, MultiInstance=1)."),
}

# ─── Load catalog and build output ───────────────────────────────────────────
catalog = []
with open(CAT_CSV, encoding="utf-8") as f:
    for row in csv.DictReader(f):
        catalog.append(row)

MAP_COLS = ["MnuNo","MenuOpt","MnuName","MnuCap","ExeName","pgmopt",
            "AllowWhenTrnClosed","MultiInstance",
            "SmritiWorkspace","SmritiMenuId","SmritiModule",
            "SmritiAction","DocumentType","MigrationStatus","Notes"]

matrix_rows = []
status_counts = defaultdict(int)
unmapped = []

for row in catalog:
    key = (int(row["MnuNo"]), int(row["MenuOpt"]))
    if key in MAPPING:
        ws_key, action, doc_type, status, notes = MAPPING[key]
        ws_info = SMRITI_WS.get(ws_key, {})
        matrix_rows.append({
            "MnuNo":           row["MnuNo"],
            "MenuOpt":         row["MenuOpt"],
            "MnuName":         row["MnuName"],
            "MnuCap":          row["MnuCap"],
            "ExeName":         row["ExeName"],
            "pgmopt":          row["pgmopt"],
            "AllowWhenTrnClosed": row["AllowWhenTrnClosed"],
            "MultiInstance":   row["MultiInstance"],
            "SmritiWorkspace": ws_info.get("ws",""),
            "SmritiMenuId":    ws_info.get("menu_id",""),
            "SmritiModule":    ws_info.get("module",""),
            "SmritiAction":    action,
            "DocumentType":    doc_type,
            "MigrationStatus": status,
            "Notes":           notes,
        })
        status_counts[status] += 1
    else:
        unmapped.append(row)
        matrix_rows.append({
            "MnuNo":           row["MnuNo"],
            "MenuOpt":         row["MenuOpt"],
            "MnuName":         row["MnuName"],
            "MnuCap":          row["MnuCap"],
            "ExeName":         row["ExeName"],
            "pgmopt":          row["pgmopt"],
            "AllowWhenTrnClosed": row["AllowWhenTrnClosed"],
            "MultiInstance":   row["MultiInstance"],
            "SmritiWorkspace": "",
            "SmritiMenuId":    "",
            "SmritiModule":    "",
            "SmritiAction":    "",
            "DocumentType":    "",
            "MigrationStatus": "PENDING",
            "Notes":           "Not yet classified",
        })
        status_counts["PENDING"] += 1

# Write CSV
with open(MAP_CSV,"w",newline="",encoding="utf-8") as f:
    w = csv.DictWriter(f, fieldnames=MAP_COLS)
    w.writeheader()
    for r in sorted(matrix_rows, key=lambda x:(int(x["MnuNo"]),int(x["MenuOpt"]))):
        w.writerow(r)
print(f"Wrote: {MAP_CSV} ({len(matrix_rows)} rows)")

# ─── Write SH9_MENU_MAP.md ────────────────────────────────────────────────────
total = len(catalog)
covered = total - len(unmapped)
pct = (covered / total * 100) if total else 0

with open(MAP_MD,"w",encoding="utf-8") as f:
    f.write(f"""# SH9 Legacy Menu -> SMRITI Workspace Mapping

**Author:** Jawahar Ramkripal Mallah
**Date:** {datetime.now().strftime('%Y-%m-%d')}
**Sprint:** 1 — ID Registry & Mapping Matrix
**Status:** Sprint 1 COMPLETE

## Coverage

| Metric | Count |
|---|---|
| Total active Shoper entries | {total} |
| Classified in this sprint | {covered} |
| Unclassified (PENDING) | {len(unmapped)} |
| Coverage | {pct:.1f}% |

## Migration Status Distribution

| Status | Count | Meaning |
|---|---|---|
""")
    STATUS_DEF = {
        "MAPPED":      "Direct 1:1 equivalent exists in SMRITI",
        "MERGED":      "Consolidated into a broader SMRITI workspace",
        "REPLACED":    "SMRITI has a superior/different implementation",
        "DEPRECATED":  "Legacy-only (Tally, flat files) -- no SMRITI equivalent needed",
        "NOT_APPLIC":  "Internal Shoper infrastructure, not a business action",
        "PENDING":     "Requires further analysis",
    }
    for s, defn in STATUS_DEF.items():
        f.write(f"| {s} | {status_counts.get(s,0)} | {defn} |\n")

    f.write("""
## CANONICAL_34_MENU_MATRIX Reconciliation

The SMRITI codebase contains a hardcoded 34-item matrix.
This sprint confirms the following coverage against 265 real Shoper entries:

| SMRITI Menu ID | Workspace | Shoper MnuNos Covered |
|---|---|---|
""")
    # Group by SmritiMenuId
    by_menu = defaultdict(list)
    for r in matrix_rows:
        if r["SmritiMenuId"]:
            by_menu[r["SmritiMenuId"]].append(r["MnuNo"])
    for mid, mnos in sorted(by_menu.items()):
        unique_mnos = sorted(set(mnos), key=lambda x: int(x))
        ws = next((r["SmritiWorkspace"] for r in matrix_rows if r["SmritiMenuId"]==mid), "")
        f.write(f"| `{mid}` | {ws} | {', '.join(unique_mnos)} |\n")

    f.write("""
## GAP: SMRITI Menu Items With No Shoper Equivalent

The following SMRITI menu items are NEW capabilities (not present in Shoper):

| SMRITI Menu ID | Purpose |
|---|---|
| `menu-wiki` | Integrated documentation/knowledge base |
| `menu-about-smriti` | SMRITI platform info |
| `menu-dev-tracker` | Engineering task tracker |
| `menu-psv` | Product-Service-Variant visibility rules |
| `menu-ufe` | Universal Field Explorer |
| `menu-formulas` | Pricing formula registry |
| `menu-terms-engine` | Payment terms engine |
| `menu-loyalty` | Loyalty/Rewards workspace |
| `menu-approval-matrix` | Multi-level approval workflows |

These are genuine SMRITI innovations with no Shoper predecessor.
They do NOT need legacy compatibility entries.

## Unclassified Entries (PENDING)

""")
    if unmapped:
        f.write("| MnuNo | MenuOpt | MnuName | MnuCap | ExeName |\n|---|---|---|---|---|\n")
        for r in unmapped:
            f.write(f"| {r['MnuNo']} | {r['MenuOpt']} | {r['MnuName']} | {r['MnuCap']} | {r['ExeName']} |\n")
    else:
        f.write("None. All entries classified.\n")

    f.write(f"""
## MultiInstance Flag Summary

Shoper entries with `MultiInstance=1` require SMRITI to support
concurrent multi-session or multi-tab operation for those document types:

| MnuNo | MenuOpt | MnuCap | SMRITI Action |
|---|---|---|---|
""")
    for r in sorted(matrix_rows, key=lambda x:(int(x["MnuNo"]),int(x["MenuOpt"]))):
        if r.get("MultiInstance") == "1":
            f.write(f"| {r['MnuNo']} | {r['MenuOpt']} | {r['MnuCap']} | {r['SmritiAction']} |\n")

print(f"Wrote: {MAP_MD}")
print(f"\n{'='*60}")
print(f"SPRINT 1 COMPLETE")
print(f"{'='*60}")
print(f"Total entries  : {total}")
print(f"Classified     : {covered}  ({pct:.1f}%)")
print(f"PENDING        : {len(unmapped)}")
for s, c in sorted(status_counts.items()):
    print(f"  {s:<14}: {c}")
