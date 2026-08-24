<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.17.0
  Created      : 2026-08-16
  Modified     : 2026-08-16
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal Audit Document
-->

# SMRITI RETAIL OS — AUTHORITATIVE MODULE INVENTORY

| Module ID | Purpose | Primary User | Primary Tasks | Primary Component | APIs / Routes | Backend Service & Tables | Status |
|---|---|---|---|---|---|---|---|
| **`pos`** | Fast retail billing & checkout desk | Billing Operator / Cashier | Item scan, cart update, discount, multi-tender payment, invoice print | [`PosTerminalTab.tsx`](file:///F:/SMRITRretailNX/src/components/PosTerminalTab.tsx) | `POST /api/v1/pos/bill`, `GET /api/v1/master-lookup` | `backend/app/api/v1/pos.py`, `sales_invoices`, `stock_movements` | **`Done`** |
| **`sales`** | Sales management studio | Sales Executive / Manager | Quotation, sales order, delivery challan, credit note, invoice ledger | [`SalesStudioTab.tsx`](file:///F:/SMRITRretailNX/src/components/SalesStudioTab.tsx) | `GET/POST /api/v1/sales/*` | `backend/app/api/v1/sales.py`, `sales_orders`, `invoices` | **`Done`** |
| **`item-master`** | Catalog & SKU management | Inventory Manager | Product creation, variant matrix, HSN mapping, price lists | [`ItemMasterTab.tsx`](file:///F:/SMRITRretailNX/src/components/ItemMasterTab.tsx) | `GET/POST /api/v1/attributes/*`, `GET /api/v1/masters/*` | `backend/app/api/v1/attributes.py`, `products`, `variants` | **`Done`** |
| **`purchase`** | Procurement & GRN studio | Purchase Officer | Purchase order, GRN receipt, vendor invoice, debit note | [`PurchaseStudioTab.tsx`](file:///F:/SMRITRretailNX/src/components/PurchaseStudioTab.tsx) | `GET/POST /api/v1/purchase/*` | `backend/app/api/v1/purchase.py`, `purchase_orders`, `grn` | **`Done`** |
| **`barcode-studio`**| Barcode printing & labeling | Inventory Clerk | Label generation, template design, barcode mapping | [`BarcodeStudioTab.tsx`](file:///F:/SMRITRretailNX/src/components/BarcodeStudioTab.tsx) | `GET/POST /api/v1/barcode/*` | `backend/app/api/v1/barcode.py`, `barcode_templates` | **`Done`** |
| **`customer-master`**| Universal customer master | Sales Manager | Customer onboarding, GST validation, credit limit setting | [`CustomerMasterTab.tsx`](file:///F:/SMRITRretailNX/src/components/CustomerMasterTab.tsx) | `GET/POST /api/v1/crm/customers` | `backend/app/api/v1/crm.py`, `customers`, `customer_groups` | **`Done`** |
| **`crm`** | CRM & relationship studio | CRM Specialist | Lead tracking, interaction history, campaign management | [`CrmStudioTab.tsx`](file:///F:/SMRITRretailNX/src/components/CrmStudioTab.tsx) | `GET/POST /api/v1/crm/*` | `backend/app/api/v1/crm.py`, `crm_leads`, `interactions` | **`Done`** |
| **`loyalty`** | Loyalty & reward engine | Marketing Manager | Tier rules, points accumulation, redemption coupons | [`LoyaltyStudioTab.tsx`](file:///F:/SMRITRretailNX/src/components/LoyaltyStudioTab.tsx) | `GET/POST /api/v1/crm/loyalty` | `backend/app/api/v1/crm.py`, `loyalty_accounts`, `points_ledger` | **`Done`** |
| **`business-ledger`**| General ledger & accounting | Accountant | Ledger posting, voucher entry, trial balance, P&L | [`BusinessLedgerTab.tsx`](file:///F:/SMRITRretailNX/src/components/BusinessLedgerTab.tsx) | `GET /api/v1/reports/*` | `backend/app/api/v1/reports.py`, `gl_entries`, `vouchers` | **`Done`** |
| **`stock-ledger`** | Real-time stock audit ledger | Store Supervisor | Batch tracking, stock adjustments, ledger audit | [`StockLedgerTab.tsx`](file:///F:/SMRITRretailNX/src/components/StockLedgerTab.tsx) | `GET /api/v1/inventory/*` | `backend/app/api/v1/inventory.py`, `stock_ledger_entries` | **`Done`** |
| **`report-designer`**| BI & custom report engine | Business Analyst | Custom report creation, SQL queries, export to Excel/PDF | [`ReportDesignerTab.tsx`](file:///F:/SMRITRretailNX/src/components/ReportDesignerTab.tsx) | `GET/POST /api/v1/reports/*` | `backend/app/api/v1/reports.py`, `report_templates` | **`Done`** |
| **`terms-engine`** | Contractual terms & T&C | Legal / Compliance | Terms configuration, clause management, document mapping | [`TermsEngineTab.tsx`](file:///F:/SMRITRretailNX/src/components/TermsEngineTab.tsx) | `GET/POST /api/v1/terms/*` | `backend/app/api/v1/terms.py`, `terms_clauses` | **`Done`** |
| **`data-exchange`**| Import/Export & ETL hub | System Admin | Bulk Excel import, data migration, backup & restore | [`DataExchangeTab.tsx`](file:///F:/SMRITRretailNX/src/components/DataExchangeTab.tsx) | `POST /api/v1/exchange/*` | `backend/app/api/v1/exchange.py`, `import_jobs` | **`Done`** |
| **`accounting-sync`**| Tally & ERP integration | Accountant | External ledger sync, mapping rules, reconciliation | [`AccountingSyncTab.tsx`](file:///F:/SMRITRretailNX/src/components/AccountingSyncTab.tsx) | `POST /api/v1/exchange/sync` | `backend/app/api/v1/exchange.py`, `sync_logs` | **`Done`** |
| **`supplier-dashboard`**| Supplier portal & tracking | Vendor Manager | Supplier metrics, purchase history, payment schedule | [`SupplierDashboardTab.tsx`](file:///F:/SMRITRretailNX/src/components/SupplierDashboardTab.tsx) | `GET /api/v1/purchase/suppliers` | `backend/app/api/v1/purchase.py`, `suppliers` | **`Done`** |
| **`approval-matrix`**| Workflow approval engine | Enterprise Admin | Multi-level approvals, limit checks, escalation rules | [`ApprovalMatrixTab.tsx`](file:///F:/SMRITRretailNX/src/components/ApprovalMatrixTab.tsx) | `GET/POST /api/v1/workflow/*` | `backend/app/api/v1/workflow.py`, `approval_rules` | **`Done`** |
| **`document-series`**| Numbering & invoice prefix | System Admin | Voucher prefixing, sequence reset rules, fiscal year tags | [`DocumentSeriesTab.tsx`](file:///F:/SMRITRretailNX/src/components/DocumentSeriesTab.tsx) | `GET/POST /api/v1/numbering/*` | `backend/app/api/v1/numbering.py`, `document_series` | **`Done`** |
| **`staff-management`**| HR & cashier management | HR Manager | User roles, shift assignments, permission matrix | [`StaffManagementTab.tsx`](file:///F:/SMRITRretailNX/src/components/StaffManagementTab.tsx) | `GET/POST /api/v1/users/*`, `/roles` | `backend/app/api/v1/users.py`, `users`, `user_roles` | **`Done`** |
| **`audit-logs`** | Security & audit trail | Compliance Officer | User activity logs, system events, security audit | [`AuditLogsTab.tsx`](file:///F:/SMRITRretailNX/src/components/AuditLogsTab.tsx) | `GET /api/v1/system/audit` | `backend/app/api/v1/system.py`, `audit_logs` | **`Done`** |
| **`training-academy`**| Interactive sandbox academy | Trainee / Staff | Interactive tutorials, simulated transactions | [`TrainingAcademyTab.tsx`](file:///F:/SMRITRretailNX/src/components/training/TrainingAcademyTab.tsx) | Local sandbox store | `src/services/trainingSandboxStore.ts` | **`Done`** |
| **`dev-tracker`** | System health & release readiness | Systems Architect | DHI score, quality metrics, commit tracker | [`DevTrackerTab.tsx`](file:///F:/SMRITRretailNX/src/modules/dev_tracker/ui/DevTrackerTab.tsx) | `GET /api/v1/dev-tracker/*` | `backend/app/api/v1/dev_tracker.py`, `dev_metrics` | **`Done`** |
| **`user-profile`** | User settings & credentials | All Users | Password change, avatar, theme preference | [`UserProfileTab.tsx`](file:///F:/SMRITRretailNX/src/components/UserProfileTab.tsx) | `GET/POST /api/v1/auth/me` | `backend/app/api/v1/auth.py`, `users` | **`Done`** |
| **`ecommerce`** | eCommerce & omnichannel sync | Commerce Manager | Channel inventory reservation, online order intake, sync outbox | [`CompanyControlCenter.tsx`](file:///F:/SMRITRretailNX/src/components/CompanyControlCenter.tsx) | `POST /api/v1/ecom/*`, Outbox `ECOM_QUEUE` | `backend/app/services/ecom_reservation_service.py`, `sales_orders`, `products` | **`Partially Verified`** |
| **`about`** | SMRITI version & system info | All Users | License verification, version details, system specs | [`AboutSmritiTab.tsx`](file:///F:/SMRITRretailNX/src/components/AboutSmritiTab.tsx) | Static / system state | `src/services/metadataRegistry.ts` | **`Done`** |
