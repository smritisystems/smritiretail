<!--
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

  * Version    : 3.17.0
  * Created    : 2026-07-11
  * Modified   : 2026-07-14
  * Copyright  : © SMRITIBooks.com. All Rights Reserved.
  * License    : Proprietary Commercial Software
  * Classification: Internal
-->

# SMRITI Retail OS — Changelog

All notable changes to SMRITI Retail OS will be documented in this file. This project adheres to Semantic Versioning.

### [5.4.0] - 2026-08-21

#### UI Platform & Inventory — Universal View Configuration as Global Schema & Visibility Control
- **Global Field Visibility & Ordering Engine (`unifiedFieldCatalog.ts`)**:
  - `saveGlobalFieldVisibility` persists visible columns and sequence ordering across client state.
  - `isFieldGloballyVisible` and `getGloballyVisibleFields` dynamically filter and sort catalog definitions.
  - Reactive `smriti_field_visibility_updated` CustomEvent broadcasts layout changes across all active components and tabs with sub-millisecond overhead.
- **Application-Wide Visibility Enforcement**:
  - **Item Master Details Spreadsheet Grid (`SmritiItemDetailsGrid.tsx`)**: Reflects custom column sets and sequence in real time.
  - **Item Catalog Search Browser (`SmritiItemCatalogGrid.tsx`)**: Dynamically hides unselected columns and sorts active ones.
  - **Report Designer & Operational BI Hub (`ReportDesignerTab.tsx`)**: All ledger, sales, stock, and inventory report tables automatically conform to the active field visibility schema.
- **Stock No & Barcode Real-Time Uniqueness Alerts**:
  - `onBlur` cell alerts identifying duplicate Stock Nos and Barcodes against in-grid entries and database records with conflicting product names.
  - Pre-save integrity blocker stopping duplicates before database insertion.

### [5.3.0] - 2026-08-21

#### Inventory & Catalog — Item Master Stitch Management System Architecture & Image Resolver
- **Item Master Management System Suite (`Itemmaster3`)**: Integrated complete suite from `F:\SMRITI\Itemmaster3\stitch_item_master_management_system`:
  - **Item Details Master Grid (`SmritiItemDetailsGrid.tsx`)**: High-density matrix grid and classic single-record view, inline Add/Duplicate/Delete row actions, `F1` keyboard shortcuts guide, and `F2` SKU/Barcode generator.
  - **Common Fields Baseline Setup (`SmritiCommonFieldsSetup.tsx`)**: Session-level baseline presets (Category, Brand, Vendor, HSN, Tax %, UOM) that auto-fill all newly entered items.
  - **Dual-List View Configuration (`SmritiViewConfiguration.tsx`)**: Dual-list column selector, order manager, and frozen column count selector (0–6).
  - **Full CRUD Lifecycle Safeguards**: Mode selector for Adding, Editing (with non-editable greyed Stock No and Data Loading confirmation modal), and Deleting (with transaction protection guard preventing hard deletion of items with sales history).
  - **Global Find & Replace Data Utility (`SmritiReplaceDataModal.tsx`)**: Global batch find and replace across all matrix columns and dynamic attributes.
  - **Product Image Filename & Resolver Studio (`SmritiImagePathConfigStudio.tsx`)**: Operators only enter image filenames (`imageName`). Configured base paths for SMRITI Server (`/api/v1/products/images/`), Cloud CDN, and Local Network paths with interactive live resolution tester and hover thumbnail previews.
  - **Barcode Positioned Adjacent to Stock No**: Core standard fields catalog updated to render `Barcode` directly next to `Stock No / SKU`.
  - **PostgreSQL Persistence**: Fully connected to transactional FastAPI endpoint `POST /api/v1/products/`.

### [3.29.0] - 2026-08-21

#### Inventory & Catalog — Item Master Entry Tactical Grid Refactor (Smriti Prime Specification)
- **Smriti Prime Three-Tab Catalog Workflow**: Refactored Item Master Entry to match the high-velocity tactical layout from `stitch_invoice_management_system` (`src/components/itemMaster/`):
  - **Tab 1: View (`Alt+1`)** — Field Selection: Dual list (Unselected Fields ↔ Selected Fields) with transfer controls (`>`, `>>`, `<`, `<<`), reordering controls (`Move Up`, `Move Down`), and mandatory lock rules for `stockNo`, `product`, and `mrp`.
  - **Tab 2: Common Fields (`Alt+2`)** — Batch Common Presets: Form controls for Brand, Category, Sub-Category, Tax Rate %, Supplier, Season, Department, and Status that auto-apply to item rows.
  - **Tab 3: Item Details (`Alt+3`)** — Tactical Spreadsheet Grid: High-speed matrix table featuring customizable sticky frozen columns (0–6), inline cell editing, row indicators ("Row X of Y"), Auto-SKU generator, and "Paste from Excel" multi-column TSV clipboard parsing.
- **Save Warning & Rights Confirmation Dialog**: Integrated `ItemMasterSaveWarningModal.tsx` displaying a clean confirmation dialog when creating unverified Brand/Category matrix combinations.
- **Persistence & Backend Integration**: Saved field layout and common defaults to `localStorage`, directly persisting rows to FastAPI backend (`/api/v1/products/`) via `apiFetchV1`.
- **Automated Test Coverage**: Added `src/tests/itemMasterTacticalGrid.test.ts` (10 tests) covering mandatory attributes, column reordering, common presets, TSV parsing, and payload transformation (all 23 test suites passing 100%).

#### Database & Operations — SMRITI Database Manager & Studio (DB Studio)
- **Multi-Tenant PostgreSQL Studio**: Introduced a dedicated, enterprise-grade Database Manager (`src/components/DatabaseManagerTab.tsx`) allowing `SYSADMIN` operators to switch between control plane and tenant databases (`smritisys`, `smriti001`, `smriti002`, `smriti_test_fresh`) with live size, table count, and row count telemetry.
- **Table Data Grid & Column Schema Inspector**: Built an interactive paginated table data browser with column search, dynamic sorting, JSON row detail inspector drawer, and one-click CSV export, alongside a complete column schema and foreign key constraint viewer.
- **Alembic Migration Version Tracking**: Added real-time tracking of current `alembic_version` versus head migration revision with sync status indicators.
- **Safe Read-Only SQL Query Console**: Implemented an administrative SQL execution console (`POST /api/v1/database-manager/query`) supporting `SELECT`, `WITH`, and `EXPLAIN` statements with automatic execution time measurement and strict rejection of destructive DDL/DML operations.
- **Strict Role Authorization**: Gated all backend endpoints and frontend launchpad tiles strictly to `SYSADMIN` with deny-by-default access for non-admin roles and zero exposure of database connection credentials.

#### Printing & Hardware — Optional QZ Tray Print Dispatch (Spike + Hybrid)
- **Hybrid Tri-Mode Dispatch Architecture**: Implemented support for `server_tcp` (default backend port 9100 socket transport), `qz_tray` (feature-flagged browser WebSocket dispatch), and `prn` (direct offline script download) in `backend/app/services/printer_service.py` and `backend/app/api/v1/barcode.py`.
- **Asynchronous Print Job Acknowledgment**: Added `POST /api/v1/barcode/print-jobs/{job_id}/ack` route allowing the browser client to report execution status (`Success` or `Failed`), updating `PrintHistory` audit logs idempotently with strict tenant isolation.
- **Feature-Flagged Frontend Client (`qzTrayClient.ts`)**: Created `src/utils/qzTrayClient.ts` gated by `VITE_ENABLE_QZ_TRAY` (default `false`), implementing official `qz-tray.js` SDK hooks with a native WebSocket RPC fallback on `ws://localhost:8182`.
- **Barcode & Label Studio Integration**: Updated `LabelPrintingSection.tsx` with a dispatch mode toggle, live QZ Tray flag indicator badge, and automated ACK triggers on print completion or failure.
- **Zero Invariant Regressions**: Server TCP remains the default; POS billing, item master, and launchpad are completely untouched. Verified with 6 backend Pytest tests, 3 frontend Vitest tests, and clean `tsc --noEmit`.

#### Governance & Field Readiness — Commercial Pilot Origin-Gap Remediation & Hardening
- **Origin-Truth Deliverables (D1–D6)**: Standardized application version SSOT (`APP_VERSION = "3.29.0"`), documented dual-run architecture for `DocumentStudioScreen`, created formal pilot smoke checklist (`docs/PILOT_SMOKE_CHECKLIST.md`), froze commercial pilot scope boundary (Section 6 of `docs/PHASE1_PILOT_SUPPORTED_MODULES.md`), and updated `CompanyDatabaseProvisioner` to require Alembic migration head ≥ `v1337_backfill_variant_id`.
- **Deny-by-Default Role-Based Access Control (RBAC)**: Eliminated `(role || "SYSADMIN")` fallback elevations in `launchpadCatalog.ts`, `FioriLaunchpad.tsx`, `App.tsx`, and `navigationResolver.ts`. Users with null/blank roles are strictly restricted to public/unrestricted tiles.
- **Multi-Tenant Database Discovery & Alembic HEAD**: Discovered and migrated all control plane and company databases (`smritisys`, `smriti001`, `smriti_test_fresh`) to Alembic HEAD (`v1338_company_isolated_barcodes`). Confirmed 0 NULL `variant_id`s across 588 products in `smriti001`. Recorded evidence in `docs/PILOT_DB_MIGRATE_RESULTS.md`.
- **Commercial Pilot Go-Live Runbook**: Authored `docs/PILOT_GO_LIVE_RUNBOOK.md` detailing environment variable prerequisites, operator provisioning, checkout happy path, non-destructive `pg_dump`/`pg_restore` backup/rollback strategy, hardware pairing, and emergency support escalation.
- **Smoke Test Results Sign-Off**: Recorded formal `GO_SOFTWARE` sign-off in `docs/PILOT_SMOKE_RESULTS.md` with 20 Vitest files (128 tests) and 39 Pytest tests passing 100%.

#### Security & Quality — UI/UX Duplication & Hardcode Remediation
- **Hardcoded Credential Elimination**: Removed hardcoded plaintext passwords (`whynothing`) from `src/state/store.ts` and `src/db/init.ts`. Confirmed zero remaining occurrences in `src/`.
- **Canonical Indian Currency Words Formatter**: Extracted `numberToIndianWords` into `src/utils/indianNumberWords.ts` and updated Python `number_to_indian_words` in `backend/app/services/invoice_pdf_service.py` to identically handle sub-rupee values (`0.50` -> `"Zero Rupees and Fifty Paisa Only"`) and singular/plural rupees (`1.00` -> `"One Rupee Only"`). Added matching 14-test parity suites in Vitest and Pytest.
- **Invoice Template Decoupling**: Decoupled `TaxInvoiceA4.tsx` (dedicated statutory GST invoice) and `StandardInvoiceA4.tsx` (generic Print Studio design catalog), removing duplicate formatting code and dead imports.
- **Dynamic Printer IP Configuration**: Removed hardcoded `192.168.1.200` initial state from `LabelPrintingSection.tsx`, converting it to an empty default that dynamically populates from `/api/v1/barcode/printer-settings` (`SystemConfig`).
- **Single Source of Truth for Application Version**: Established `src/config/version.ts` exporting `APP_VERSION`, `APP_RELEASE_STAGE`, and `APP_VERSION_LABEL`. Replaced all hand-typed version strings across the UI (`LoginScreen.tsx`, `CompanySelectionScreen.tsx`, `layout_manager.tsx`, `DashboardTab.tsx`, `QuickReportsWidget.tsx`, `PrintPreviewModal.tsx`) and synchronized `package.json` to 3.29.0.
- **Centralized API Target Host Configuration**: Created `src/config/api.ts` managing `FASTAPI_BASE_URL` with environment and Docker container network resolution, replacing duplicate fallback strings in `helpers.ts`.

#### Testing & Infrastructure — Test Fixture Environment Dependency & Multi-Tenant Routing
- **Deterministic 20/20 Test Suite**: Stabilized `test_e2e_tenant_security_and_routing.py`, `test_ecom_connectors.py`, and `test_company_control_center_security.py` across full multi-suite test runs.
- **Explicit Routing Registry Seeding (RC2)**: Seeded `company_database_registries` with `COMP-001 -> smriti001` in conftest so dynamic database resolution (`CompanyDatabaseResolver`) functions out-of-the-box on fresh database migrations.
- **Fail-Fast Fixture Execution (RC3)**: Replaced silent `try/except` fixture warning prints with immediate `pytest.fail()` calls to surface environmental and setup failures loudly.
- **Compound and Partial Unique Index Handling**: Fixed fixture upsert statements for `user_company_assignments` (targeting `(user_id, company_id) WHERE (is_deleted = false)`), `roles`, and `branches` (preventing `branches_code_key` unique violations and `users_branch_id_fkey` foreign key failures).
- **Cross-Test State Isolation**: Scoped control plane test fixture seeding to `function` level to prevent per-test teardown functions (`clear_db()`) from contaminating subsequent test authorization contexts.

### [3.26.0] - 2026-08-20

#### Security — Multi-Tenant Database Routing & Credential Sanitization
- **Hardened `get_company_db` Dependency**: Removed all raw unvalidated client header (`X-Company-Id`) and query parameter parsing. Tenant resolution strictly composes with `get_tenant_context(get_current_user)`, deriving tenant database scope from cryptographic JWT verification and database assignments in `smritisys`.
- **100% Operational Router Wiring**: Replaced legacy `get_db` with `get_company_db` across all operational endpoints in `sales.py`, `inventory.py`, `purchase.py`, and `barcode.py`. Zero occurrences of `get_db` remain in operational routes.
- **Barcode Subsystem Tenant Isolation**: Isolated `BarcodeLayout` CRUD, printer connection configuration (`printer_connection_{company_id}`), diagnostics, test-prints, and `PrintHistory` audit logging by tenant `company_id` and `branch_id`.
- **Financial Credential Sanitization**: Sanitized `db_store.json`, legacy export scripts, test fixtures, and JSON geometry reports to eliminate real bank accounts and IFSC codes. Implemented dynamic environment-based fallback chain in `InvoicePdfService`.
- **Automated CI Secret & Reachability Guard**: Created `scripts/ci_secret_and_reachability_guard.py` scanning for credential exposures and verifying complete router wiring.
- **Consolidated Canonical Exporter**: Replaced 5 redundant invoice export scripts with unified CLI tool `scripts/export_tax_invoices_canonical.py` supporting PDF, HTML, JSON, and CSV exports.
- **Retroactive Invoice Audit**: Audited all 93 active sales invoices in `smriti001` with 0 itemless invoices and 0 GST calculation discrepancies.

### [3.25.0] - 2026-08-15

#### Security — Company Control Center Authentication & Authorization Hardening
- **Eliminated Header Spoofing**: Replaced unauthenticated `x-user-id` header defaults with server-verified OAuth2 Bearer JWT authentication (`Depends(get_current_user)`).
- **Enforced Role-Based Access Control**: Restricted administrative company control center operations (`/companies`, `/companies/create-request`, `/lifecycle/action`) and development intelligence endpoints (`/dev-tracker`, `/dev-tracker/scan`) to `UserRole.SYSADMIN`.
- **Tenant Scope Isolation**: Enforced company context validation for ordinary users attempting to access company detail or module entitlements (`company_id == current_user.company_id`).
- **Security Regression Test Suite**: Added `test_company_control_center_security.py` verifying HTTP 401/403 fail-closed protection for anonymous, spoofed, or unauthorized calls.

#### Added — SMRITI Fiori Light Enterprise UI Redesign & Visual QA Gate
- **Light Mode Only Baseline**: Locked application theme to Light Enterprise Mode (`#f8f9fa` base background, `#ffffff` surface, `#0070f2` action blue, `#32363a` slate text, `#d9d9d9` crisp borders). Completely eliminated dark mode, theme toggles, `#1c222b`, and `prefers-color-scheme` overrides.
- **Fiori Horizon Application Shell**: Refactored global App Shell with Fiori header bar, global search, company selector dropdown, notification popover, workspace navigation, breadcrumbs, and page filter bars.
- **10 Core Visual Screens QA Verified**: Verified Application Shell, POS/Billing, Item Master, Customer/CRM, Purchase, Fulfillment, Promotions, Report Studio, Dashboard Manager, and Excel Grid.
- **Invariants Maintained**: 82/82 backend Pytest test suites passed, Vite production build clean, zero unapproved database creations (`smriti002-smriti999` count = 0), Single Workspace Principle and Single Authoritative Dataset Rule (`Grid = Chart = Pivot = Dashboard KPI = Export`) strictly intact.

### [3.24.0] - 2026-08-15

#### Added — SMRITI Reporting Platform & Data Integrity Engine Architecture
- **Reporting Engine & Flexi Studio**: Excel-style analytical grid (filters, column drag, multi-sort, group-by, subtotals, pivot, copy/paste to Excel), Flexi report builder with Dimensions & Measures, and user saved views (`ReportSavedView`).
- **Chart Visualizer & Dashboard Manager**: Multi-chart visual abstraction (Bar, Line, Pie, Area, Stacked, Combo, Scatter, KPI, Funnel, Ranking) and Dashboard Manager for CEO, Sales, Store Manager, CRM, and Profitability dashboards (`DashboardWidget`).
- **Single Authoritative Dataset Rule Locked**: Guaranteed dataset metric consistency where `Grid total = Chart total = Pivot total = Dashboard KPI total = Export total`.
- **20-Point Forensic Runtime Data Integrity**: Runtime report execution verified across 10 business domains with zero unapproved database creations and strict tenant isolation (`HTTP 403` on cross-tenant access).

### [3.23.0] - 2026-08-15

#### Added — Commercial Growth, Customer 360, Operations & Fulfillment, and Cost Profitability Engine Architecture
- **Commercial Growth & Customer 360**: Co-located CRM, Loyalty Program (CGE), Promotions & Campaigns, Referral Engine, and Universal Incentive & Commission Engine (SICE) inside `smriti001`.
- **Promotion Conflict & Pricing Resolution Engine**: Priority ranking, exclusivity override (`is_exclusive`), stacking rules, maximum combined discount cap (50%), and evaluation audit snapshots (`evaluated_campaigns_snapshot`).
- **Operations & Fulfillment Engine**: Order Pick & Pack (`packing_slips`), Dispatch manifests & driver assignments (`dispatches`), driver delivery commission settlement (`delivery_commission_settlements`), and reverse logistics returns with stock restock and commission reversal (`reverse_logistics_returns`).
- **Cost & Profitability Intelligence Engine**: Multi-valuation cost prices (Purchase, WAC, Last Purchase, FIFO, Landed Cost, Standard Cost, MRP, Replacement Cost), line-item COGS snapshots, and transaction Net Contribution waterfall ledger.

### [3.20.0-cleanup] - 2026-07-15

#### Removed -- MC2 Phase 5D: Deprecated URL Aliases

- POST /api/v1/shifts/open (canonical: POST /api/v1/pos/shifts/open)
- POST /api/v1/shifts/{id}/close (canonical: POST /api/v1/pos/shifts/close/{id})
- GET/POST /api/v1/sales-invoices/* (canonical: /api/v1/sales/*)
- GET/POST /api/v1/purchase-orders/* (canonical: /api/v1/purchase/orders/*)

#### Fixed
- PurchaseService.create_purchase_order: order.items now populated before return

#### Tests migrated
- 65 test URL lines updated to canonical paths across 3 test files
- 75/75 tests pass


## [3.20.0] - 2026-07-15

### Changed -- MC2 Phase 5: Express Business Route Retirement

**Architecture:** Express is now a pure Auth Enforcement Gateway + SPA host.
All /api/v1/* business requests: Browser -> Express (auth check) -> FastAPI proxy -> FastAPI.

**Phase 5A — Audit-log migrated to FastAPI:**
- POST /api/v1/system/audit-logs (new FastAPI endpoint)
- apiFetch.ts recordAuditAction now calls apiFetchV1 (not Express)

**Phase 5B — 10 Express route modules unmounted from server.ts:**
pos, sales, purchase, inventory, numbering, terms, exchange, barcode, reports, customers
(Files tagged DEPRECATED, not deleted -- safe to remove v3.21.0)

**Phase 5C — flags.ts updated to v3.20.0:**
12 new USE_FASTAPI_* flags added (all true, removal v3.21.0)

**Tests:** 75/75 passed

**Deferred to Phase 6 (v3.21.0):**
- auth.ts migration (App.tsx uses raw fetch /api/auth/me)
- assistant.ts FastAPI stub
- Deprecated route file deletion


## [3.19.1-fix1] - 2026-07-15

### Fixed — MC2 Phase 4B model column corrections

- purchase service: self.tenant_ctx -> self.tenant
- PurchaseOrderItem FK: purchase_order_id -> order_id
- PurchaseReceipt FK: purchase_order_id -> order_id
- PurchaseOrderItem cost field: unit_cost -> cost_price
- SalesInvoice constructor: removed invalid notes= field
- Convert route: removed SalesInvoiceResponse (customer_id required but missing)
- Added 10 Phase 4B tests (75/75 passing)


## [3.19.1] - 2026-07-15

### Added -- MC2 Phase 4B: New Business Logic Endpoints

**Architect Decisions resolved:**
- AD-1: GET/POST /api/v1/purchase/settings (alias to jurisdiction config)
- AD-2: GET /api/v1/purchase/suppliers/{id}/default-rate (last GRN cost, PO fallback)
- AD-3: POST /api/v1/workflow/{docType}/{id}/{action} -- Core Workflow API (workflow.py)

**New routes:** settings, settings/jurisdiction, orders/{id}/submit,
reports/outstanding, reports/pending-delivery, suppliers/{id}/default-rate,
sales/quotations/convert/{id}, workflow/{docType}/{id}/{action}

**Tests:** 65/65 passed


## [3.19.0] - 2026-07-15

### Added — MC2 Phase 4A: URL Contract Alignment

**Compatibility aliases (dual-mount, backward-safe):**
- `POST /api/v1/pos/shifts/open` — canonical POS shift open
- `POST /api/v1/pos/shifts/close/{id}` — canonical POS shift close
- `GET/POST /api/v1/sales/invoices` — canonical sales invoice list/create
- `GET/POST /api/v1/purchase/orders/` — canonical purchase order list/create
- `GET /api/v1/purchase/suppliers/` — canonical supplier list
- `GET /api/v1/health/flags` — feature flag health check endpoint

**Deprecated (removal: v3.20.0):**
- `POST /api/v1/shifts/open` → use `/pos/shifts/open`
- `POST /api/v1/shifts/{id}/close` → use `/pos/shifts/close/{id}`
- `GET/POST /api/v1/sales-invoices/` → use `/sales/invoices`
- `GET/POST /api/v1/purchase-orders/` → use `/purchase/orders/`

**Tests:** 65/65 passed (57 legacy + 8 new contract URL tests)


## [3.18.3] - 2026-07-15

### Refactored — Architectural Debt Cleanup

- `datetime.utcnow()` -> `datetime.now(timezone.utc)` across 8 first-party files
- Pydantic `class Config` -> `model_config = ConfigDict(...)` in 7 schema files (21 occurrences)
- FastAPI `@app.on_event("startup")` -> `asynccontextmanager lifespan()` in `main.py`

**Result:** Deprecation warnings: 680 -> 304 (55% reduction, 376 eliminated)
**Tests:** 57/57 passed — no regressions


## [3.18.2] - 2026-07-15

### Added — MC2 Phase 3: Purchase CANCEL/AMEND/Supplier UPDATE+DELETE

- `POST /api/v1/purchase-orders/{id}/cancel` — cancel a Confirmed PO (status=CANCELLED, soft-delete)
- `POST /api/v1/purchase-orders/{id}/amend`  — cancel original, create new Confirmed PO (strangler-fig pattern)
- `PUT  /api/v1/suppliers/{id}`              — partial update supplier contact details
- `DELETE /api/v1/suppliers/{id}`            — soft-delete supplier

### Service
- `PurchaseService.cancel_purchase_order()` — with RECEIVED guard
- `PurchaseService.amend_purchase_order()` — atomic cancel+create
- `PurchaseService.update_supplier()` — partial patch
- `PurchaseService.delete_supplier()` — soft-delete

### Schemas
- `SupplierUpdate`, `PurchaseOrderCancelRequest`, `PurchaseOrderAmendRequest`

### Tests
- 8 new integration tests; combined regression: 57/57 passed (POS+Sales+Purchase)


## [3.17.0] — 2026-07-14 — Master Data Consolidation

### Added
- **FastAPI Tier-1 Dynamic Lookups (`backend/app/models/master_lookup.py`, `backend/app/schemas/master_lookup.py`, `backend/app/api/v1/master_lookup.py`)** — Added dynamic schema-driven Master Type and Master Value persistence on FastAPI + PostgreSQL with JSON Schema validators cache and soft-delete features.
- **FastAPI Tier-2 Organization Structure (`backend/app/schemas/masters_tier2.py`, `backend/app/api/v1/masters.py`)** — Created REST endpoints and Pydantic validation schemas for Company, Branch, Store, and Warehouse.
- **Database Migrations (`backend/alembic/versions/93e07a92812b_add_master_values_soft_delete.py`, `backend/alembic/versions/96b45b17b8b1_drop_master_entities.py`)** — Generated migrations to add soft-delete fields to `master_values` and drop the decommissioned `master_entities` table.
- **Unit & Integration Tests (`backend/app/tests/test_masters_consolidation.py`)** — Built complete backend integration test suite.

### Changed
- **Frontend Master Management Cutover (`src/components/MasterManagementTab.tsx`)** — Repointed all organizational and lookup fetches to `/api/v1/masters/...` using `apiFetchV1` to ensure token propagation and HREP alignment.
- **Alembic env config (`backend/alembic/env.py`)** — Added `master_types` and `master_values` tables to the allowed tables filter.

### Decommissioned
- **Express-side legacy master code** — Deleted `src/routes/masters.ts`, `src/routes/masterLookup.ts`, and `src/repositories/masterRepository.ts` and unmounted them from `server.ts`.
- **FastAPI legacy master model scaffolding** — Removed `backend/app/models/masters.py` and `backend/app/schemas/masters.py`.


## [3.16.0] — 2026-07-13 — Backend Tier 4 FastAPI Migration

### Added
- **SMRITI Product Image Framework (SPIF) v1.0 (`backend/app/services/spif.py`, `src/components/common/ProductImage.tsx`, `src/components/common/ImageDisplayPolicyModal.tsx`)** — Centralized product image support, auto-optimization (WebP transcode, maximum bounds scaling, and alpha channel flattening), tenant-isolated storage path persistence, React thumbnail/preview rendering, and dynamic configuration policies.
- **SMRITI Master Framework — Phase F.3 (`backend/app/models/barcode.py`, `src/routes/terms.ts`, `src/routes/barcode.ts`, `src/routes/system.ts`)** — Migrated terms library, terms defaults, terms snapshots, approval workflow logs, print templates, and print profiles configurations from memory arrays to PostgreSQL.
- **SMRITI Master Framework — Phase F.2 (`backend/app/services/numbering.py`, `src/routes/numbering.ts`, `src/lib/helpers.ts`)** — Migrated document number series configuration and atomic allocation engine to PostgreSQL and FastAPI `FOR UPDATE` transaction locks.
- **SMRITI Master Framework — Phase F.1 (`backend/app/models/inventory.py`, `src/routes/masters.ts`, `src/state/store.ts`)** — Migrated stores and warehouses master entities from legacy in-memory arrays to PostgreSQL tables via Alembic.
- **Masters Module (`backend/app/models/masters.py`)** — Added organizational branch/department master entities.
- **Numbering Engine (`backend/app/models/numbering.py`)** — Atomic sequence generation with select-for-update locking.
- **Terms & Conditions Engine (`backend/app/models/terms.py`)** — Defaults, snapshots, default resolution service.
- **Attributes & Variants (`backend/app/models/attributes.py`)** — Variant Cartesian generation service and schema definitions.
- **Barcode Studio (`backend/app/models/barcode.py`)** — Barcode definitions and layout designer stubs.
- **Data Exchange Hub (`backend/app/models/exchange.py`)** — DB table CSV dump/restore importer converter stubs.
- **AI Assistant (`backend/app/api/v1/ai.py`)** — Analytical AI forecasting stubs.
- **SMRITIDocker Repository** — Created standalone private Git repository for containerization, orchestration, and startup automation files.
- **One-Command Installers (`install.ps1`, `install.sh`)** — Added automated single-command installers for Windows, Linux, and macOS with prerequisite checking, stable Python detection, and visual branding.
- **System Configs & Tally (`backend/app/models/system.py`)** — Global system configurations registry.
- **Roles Module (`backend/app/models/role.py`)** — Permissions matrix mapping database entities.
- **Alembic Migration (`backend/alembic/versions/6bc445ac1554_add_tier_4_domains.py`)** — Automated schema changes for long-tail domains.
- **Regression Tests (`backend/app/tests/test_exchange.py`, `backend/app/tests/test_staff_verification.py`)** — Regression testing for data exchange task execution and staff response schemas.
- **Indian Market Formatters (`src/utils/indianFormat.ts`, `src/utils/hsnMaster.ts`)** — Frontend utility functions for lakh/crore grouping and HSN code GST rate determination.
- **Excel manual data entry grid (`src/components/ExcelGridEntrySection.tsx`)** — Spreadsheet-style grid interface supporting Arrow keyboard navigation, Excel copy-paste, and auto row creation.
- **Dynamic Business Templates (`backend/app/services/attributes.py`)** — Auto-seeding templates for Apparel, Footwear, Grocery, Electronics, and Jewellery directly into Postgres.
- **Extended Attributes (`backend/alembic/versions/d4e5f6a7b8c9_extend_attribute_definitions.py`)** — Added searchable, filterable, display order, default values, and tooltips columns in Postgres.
- **Dynamic Attributes Search (`backend/app/repositories/product.py`)** — Cast JSONB properties to text for global matching in PostgreSQL GIN indexes.
- **Enterprise Label Printing Framework (ELPF) (`backend/app/models/barcode.py`, `src/components/LabelPrintingSection.tsx`)** — 3-step thermal ZPL print wizard, raw TCP/IP socket connection dispatcher, print history logger, and system config settings persistence.
- **Dynamic Barcode PRN Template Mapping (`backend/app/api/v1/barcode.py`, `src/components/LabelPrintingSection.tsx`)** — Replaced hardcoded print field replacements with dynamic key traversal of all item attributes, preserved all pasted CSV column headers in state, and added an interactive variable insertion guide with standard and dynamic column click badges.
- **Default User Seeding (`src/state/store.ts`)** — Seeded default users (`super` / `whynothing`, `manager`, `cashier`) in flat-file database initialization.
- **Login Quick Actions (`src/components/LoginScreen.tsx`)** — Added `super` user quick login button with System Admin access level.
- **Report User Role & Audit Logging** — Added read-only `Report User` role with write-block Express middleware protection, visual warning banners, disabled creation/edit inputs, context menu role mappings, and integration test coverage for audit logs.
- **Save Barcode as PRN File** — Extended PrintRequest schema and barcode REST api with an optional `saveAsPrn` flag to bypass thermal printer communication and download ZPL commands directly as a `.prn` file from the browser.

### Modified
- **`backend/app/models/auth.py`** — Extended User schema with 27 profile and setting fields.
- **`backend/app/tests/test_user_management.py`** — Updated unit test assertions to match REST specifications.
- **`docker-compose.yml`** — Forwarded `SGIP_VAULT_MASTER_KEY` env parameters to Python container.
- **Data Exchange Backend (`backend/app/api/v1/exchange.py`)** — Fixed timezone offset database update constraint violation.
- **Staff User Schemas (`backend/app/schemas/user.py`)** — Standardized PaymentDetails schema to declare Aadhaar, PAN, PF UAN, ESIC, Father/Spouse name, Marital Status, Blood Group, and Permanent Address.
- **PAL Repository Layer (`src/core/interfaces/db.ts`, `src/bootstrap/di.ts`, `src/db/`)** — Implemented `IStateRepository` to abstract Express legacy `saveDb()` mutations and ensure 0 routes call `saveDb()` directly.
- **Express route unmount (`server.ts`, `src/routes/attributes.ts`)** — Retired all legacy attributes Express routing, migrating completely to FastAPI + Postgres.
- **`src/db/memory/MemoryRepositories.ts` & `src/db/postgres/PostgresRepositories.ts`** — Fixed esbuild compilation failures on read-only ESM namespace property reassignments.
- **`src/masters_registry.ts` & `src/components/MasterManagementTab.tsx`** — Refactored configuration schemas and Master Management tab to dynamically retrieve and render schema-driven lookup data generically from backend meta registries.


## [3.16.0] — 2026-07-12 — Form Standardization & Setup Defaults

### Added
- **`backend/app/templates/errors/`** — Created branded HTML base layout, landing page, and status code error templates for SEEF v1.0.
- **`backend/app/tests/test_seef.py`** — Added integration tests validating content negotiation and HTML/JSON status outputs.
- **`docs/implementation/foundation/SMRITI_Error_Experience_Framework_v1.0_Plan.md`** — SEEF v1.0 implementation plan.
- **`docs/walkthrough/foundation/Foundation_SEEF_v1.0_Error_Experience_v3.16.0.md`** — Walkthrough document for SEEF v1.0.
- **`src/constants/indianStates.ts`** — Shared Indian state constants.
- **`src/utils/validators.ts`** — Indian-market form validators (GSTIN, PIN, Mobile).
- **`src/utils/formatters.ts`** — Regional display formatters (date, datetime, currency).
- **`src/tests/validatorsAndFormatters.test.ts`** — Unit tests for the new validators and formatters.
- **`backend/app/compliance/`** — Built the complete bounded context compliance framework (Milestone 1 foundation) containing model persistence, cryptographically isolated credential vault, and registry system.
- **`backend/app/tests/test_inventory.py`** — Added regression testing for the product soft-delete API.
- **`backend/mypy-baseline.txt`** — Configured a mypy type error baseline to track legacy type warnings.
- **`docs/walkthrough/foundation/Foundation_SGIP_Milestone1_Compliance_Foundation_v3.16.0.md`** — Walkthrough document for SGIP Milestone 1.

### Changed
- **`backend/production.txt`** — Added `jinja2==3.1.4` dependency.
- **`backend/app/core/errors.py`** — Expanded HREP error dictionary catalog to support custom titles and new error families (SMRITI-AUTH, SMRITI-CONN, SMRITI-CFG, SMRITI-INT).
- **`backend/app/core/error_handlers.py`** — Integrated template rendering, content negotiation (`Accept: text/html` vs `application/json`), and backward-compatible JSON error formats.
- **`backend/app/main.py`** — Registered `GET /` API landing page endpoint displaying service diagnostic parameters, tracked application uptime, and consolidated import structures.
- **`backend/app/api/v1/inventory.py`** — Fixed a runtime crash (`AttributeError` on `TenantContext.user_id`) in product soft-deletion by correctly extracting user identity from request dependencies.
- **`backend/app/repositories/base.py`** — Type-safely bound repository models to `BaseEntity`.
- **`backend/pyproject.toml` & `.github/workflows/ci.yml`** — Enforced automated baseline-filtered MyPy type checks in the build pipeline.
- **Setup Wizard Defaults** — Updated default demo seeding company to "AITDL NETWORKS" located at GIDA Gorakhpur, Uttar Pradesh, with "Pushpa" (9324117007) as default contact.
- **Form Controls** — Integrated street address, landmark, and state selection dropdowns into the setup wizard store registration form. Enforced GSTIN and Pincode validation gates before transitioning wizard steps.
- **Validation Standardization** — Replaced ad hoc regular expression checks in `SalesStudioTab.tsx` and `src/routes/customers.ts` with shared helpers.
- **`backend/app/tests/conftest.py`** — Set up a session-scoped event loop to prevent async loop mismatch issues across test suites.
- **`backend/pyproject.toml`** — Wired python paths and silenced FastAPI parameter warnings.

## [3.15.0] — 2026-07-12 — Database Unification & Security Hardening

### Added
- **`src/middleware/sessionResolver.ts`** — New global Express middleware decoding session tokens, mounting active user objects, and enriching downstream request headers with permission context.
- **`src/tests/helpers.test.ts` & `src/tests/auth.test.ts`** — Standalone characterization test suites to protect password verification and failed-attempt account locking pipelines.
- **`src/tests/numbering.test.ts` & `src/tests/gst.test.ts`** — Unit tests covering the voucher numbering sequences and the dynamic GST 2.0 price-tier tax calculations.
- **`.github/workflows/ci.yml`** — Continuous integration pipeline running linter and Vitest suite on push/pull requests.

### Changed
- **Database Refactoring** — Decoupled route modules (`auth`, `users`, `customers`, `pos`, `sales`, `purchase`) from direct `saveDb()` flat-file persistence, routing operations through Platform Abstraction Layer (PAL) DI container stubs.
- **FastAPI CORS Hardening** — Restricted FastAPI middleware origins using dynamic configuration properties and enforced strict `JWT_SECRET_KEY` requirements.
- **Security Hardening** — Upgraded PBKDF2 hash strength to 600,000 iterations and replaced all string-based RBAC cashier checks in `reports.ts`, `exchange.ts`, and `assistant.ts` with permission checks (`hasPermission`).

### Removed
- **Flat-File Serials** — Eliminated active disk-writing of sessions into flat-file databases (`db_store.json`), migrating authorization context to transient in-memory structures.

---

## [3.14.4] — 2026-07-11 — Alembic Schema Unification

### Added
- **`backend/alembic/versions/a1b2c3d4e5f6_add_missing_core_tables.py`** — New root-level migration creating all missing core tables with default auto-generated UUID columns.
- **Node-compatibility Columns** — Added columns `cashier`, `warehouse`, `branch`, `start_time`, `end_time`, `opening_cash`, `closing_cash`, `sales_count`, `sales_value` to `shifts` table to ensure seamless dual API support.

### Changed
- **`src/db/init.ts`** — Removed direct schema.sql DDL executions, moving database connection check and flat-file seeding to bootstrap.
- **`Dockerfile` & `docker-compose.yml`** — Removed COPY statements for `schema.sql`. Added wait health checks so Node standalone container initializes only after python-core schema migrations finish.
- **`db_store.json`** — Resolved data integrity and foreign key constraints for initial product IDs.

### Removed
- **`src/db/schema.sql`** — Deprecated and deleted from the repository.

---

## [3.13.0] — 2026-07-11 — Supplier Payments

### Added
- **`POST /api/v1/supplier-payments/`** — MANAGER/SYSADMIN records a payment to a supplier. Atomically decrements `supplier.outstanding` in the same transaction.
- **`GET /api/v1/supplier-payments/`** — Lists all payments; optional `?supplier_id=` filter.
- **`GET /api/v1/supplier-payments/{id}`** — Gets a single payment record.
- **`models/supplier_payment.py`** — `SupplierPayment` entity (extends `BaseEntity`).
- **`schemas/supplier_payment.py`** — `SupplierPaymentCreate` with Pydantic validators for amount > 0 and valid `payment_mode`; `SupplierPaymentResponse`.
- **`services/supplier_payment.py`** — `SupplierPaymentService` with overpayment guard and atomic outstanding decrement.
- **`alembic/versions/9862a004de1c`** — Creates `supplier_payments` table (19 columns).
- **10 new tests** in `test_supplier_payment.py`.

### Business Rules Enforced
- Amount must be > 0 (Pydantic `field_validator` → 422 on failure).
- `payment_mode` must be one of: `CASH`, `BANK_TRANSFER`, `CHEQUE`, `UPI` (422 on unknown mode).
- Payment amount must not exceed `supplier.outstanding` (overpayment guard → 400).
- `supplier.outstanding` is decremented atomically within the same DB transaction as the payment record.
- CASHIER role cannot record payments (403).
- All queries scoped to `company_id + branch_id` tenant.

### Changed
- `models/__init__.py`, `alembic/env.py` — Added `SupplierPayment` imports; version → 3.13.0.
- `main.py` — Registered `supplier_payment.router`; version → 3.13.0.
- `config.py` — `VERSION = "3.13.0"`.
- `test_supplier_payment.py` — Fixture expanded to clean purchase tables (FK-safe order) before suppliers, preventing FK violations from `test_purchase.py` leftovers.

### Test Results
```
82 passed, 472 warnings in 35.00s
```
72 prior tests continue to pass. 10 new supplier payment tests added.

---


### Added
- **`POST /api/v1/registers/`** — MANAGER/SYSADMIN creates a new POS cash register (physical counter).
- **`GET /api/v1/registers/`** — Lists all registers for the current tenant.
- **`GET /api/v1/registers/{id}`** — Gets a single register.
- **`POST /api/v1/shifts/open`** — Any authenticated user opens a shift on a register with an opening cash balance. Only one shift may be OPEN per register at a time.
- **`POST /api/v1/shifts/{id}/close`** — Closes an open shift: aggregates all linked `SalesInvoice` records by `payment_mode` (CASH/CARD/UPI), computes `expected_cash = opening_balance + cash_sales_total`, `variance = closing_balance − expected_cash`.
- **`GET /api/v1/shifts/active/{register_id}`** — Gets the currently open shift for a register; returns 404 if none (POS UI cue to prompt shift open).
- **`GET /api/v1/shifts/`** — Lists all shifts; optional `?register_id=` filter.
- **`GET /api/v1/shifts/{id}`** — Gets a specific shift by ID.
- **`models/pos.py`** — `CashRegister`, `Shift` (both extend `BaseEntity`).
- **`schemas/pos.py`** — `CashRegisterCreate/Response`, `ShiftOpen`, `ShiftClose`, `ShiftResponse`.
- **`services/pos.py`** — `POSService` with full validation, one-open-shift guard, and shift close reconciliation.
- **`alembic/versions/cc8a527deb42`** — Creates `cash_registers`, `shifts`; adds `shift_id` and `payment_mode` columns to `sales_invoices`.
- **10 new tests** in `test_pos.py`.

### Business Rules Enforced
- Only one shift may be OPEN per register at a time; second open returns 400.
- Opening balance must be >= 0.
- Closing a CLOSED shift returns 400.
- `expected_cash = opening_balance + cash_sales_total` (only CASH mode sales count towards expected float).
- `variance = closing_balance − expected_cash` (positive = overage, negative = short).
- Register and shift both scoped to `company_id + branch_id` tenant.
- CASHIER role cannot create registers (403); any authenticated user can open/close a shift.

### Changed
- `models/sales.py` — Added `shift_id` (nullable FK to `shifts`) and `payment_mode` (`CASH|CARD|UPI|CREDIT`, default `CASH`).
- `main.py` — Registered `pos.router` at `/api/v1`; version → 3.12.0.
- `config.py` — `VERSION` bumped to `3.12.0`.
- `models/__init__.py`, `alembic/env.py` — Added POS model imports.

### Migration Note
The pre-existing `shifts` table (from an earlier, different schema with `profile_id`, `sales_count`) was detected during `alembic autogenerate`. It was dropped and recreated with the correct schema via a direct SQL repair script. The `CREATE TABLE IF NOT EXISTS` guard was used in the migration to handle idempotency.

### Test Isolation Fix
The `test_pos.py` autouse fixture was upgraded to a `try/finally` teardown pattern that cleans POS tables in FK-safe order (`sales_invoices` → `shifts` → `cash_registers` → `users`) after every test, preventing FK violations in subsequent test modules.

### Test Results
```
72 passed, 381 warnings in 29.75s
```
62 prior tests continue to pass. 10 new POS tests added.

---

## [3.11.0] — 2026-07-11 — Purchase Module

### Added
- **`POST /api/v1/suppliers/`** — MANAGER/SYSADMIN creates a new supplier master record.
- **`GET /api/v1/suppliers/`** — Lists all suppliers scoped to the current tenant.
- **`GET /api/v1/suppliers/{supplier_id}`** — Retrieves a single supplier.
- **`POST /api/v1/purchase-orders/`** — MANAGER/SYSADMIN creates a confirmed Purchase Order; calculates subtotal, tax, and grand total per line item. Stock is NOT updated at this stage.
- **`GET /api/v1/purchase-orders/`** — Lists all purchase orders for the tenant.
- **`GET /api/v1/purchase-orders/{order_id}`** — Retrieves a purchase order with line items.
- **`POST /api/v1/purchase-receipts/`** — MANAGER/SYSADMIN posts a Goods Receipt Note (GRN); atomically increments `product.stock` by `quantity_received` and increments `supplier.outstanding` by `grand_total`.
- **`GET /api/v1/purchase-receipts/`** — Lists all GRNs for the tenant.
- **`GET /api/v1/purchase-receipts/{receipt_id}`** — Retrieves a GRN with line items.
- **`models/purchase.py`** — `Supplier`, `PurchaseOrder`, `PurchaseOrderItem`, `PurchaseReceipt`, `PurchaseReceiptItem` (all extend `BaseEntity` for automatic tenant scope).
- **`schemas/purchase.py`** — Full Pydantic input/output schemas for all purchase entities.
- **`services/purchase.py`** — `PurchaseService` with full validation: supplier/product tenant ownership, non-empty items, positive quantities, PO linkage.
- **Alembic migration `59cbc26b919c`** — Creates all 5 purchase tables.
- **10 new tests** in `test_purchase.py`.

### Business Rules Enforced
- Supplier must belong to the same tenant (company + branch) as the order/receipt.
- Products must belong to the same tenant before they can be ordered or received.
- PO creation does NOT update stock — only a posted GRN updates stock.
- `quantity_received` must be > 0; zero quantity returns 400.
- GRN increments `supplier.outstanding` (accounts-payable liability tracker).
- CASHIER role cannot create suppliers, purchase orders, or GRNs — returns 403.
- Duplicate order_no / receipt_no returns 400 with a plain business message.

### Changed
- `main.py` — registered `purchase.router` at `/api/v1`; version → 3.11.0.
- `config.py` — `VERSION` bumped to `3.11.0`.
- `models/__init__.py` — added purchase model exports.
- `alembic/env.py` — added purchase model imports.

### Migration Note
The autogenerate produced an empty migration (models were registered in `env.py` after `autogenerate` scanned). The migration DDL was written manually and verified against the SQLAlchemy model column definitions. Tables were confirmed present in PostgreSQL before tests were run.

### Test Results
```
62 passed, 296 warnings in 25.51s
```
52 prior tests continue to pass. 10 new purchase tests added.

---

## [3.10.0] — 2026-07-11 — User Management

### Added
- **`POST /api/v1/users/`** — SYSADMIN creates a new platform user with role + tenant assignment.
- **`GET /api/v1/users/`** — SYSADMIN lists all users with optional `?role=` and `?company_id=` filters and pagination (`skip`, `limit`).
- **`GET /api/v1/users/{user_id}`** — SYSADMIN can retrieve any user; non-SYSADMIN may only retrieve their own profile.
- **`PATCH /api/v1/users/{user_id}`** — SYSADMIN updates email, mobile, role, is_active, company/branch assignment.
- **`POST /api/v1/users/{user_id}/deactivate`** — SYSADMIN soft-deactivates a user (sets `is_active=False`, `is_deleted=True`); blocked for self-deactivation.
- **`PATCH /api/v1/users/me/password`** — Any authenticated user changes their own password; requires correct current password and minimum 8-character length.
- **`UserService`** (`services/user.py`) — create, list, get, update, deactivate, change_password; all DB mutations wrapped in `IntegrityError` handlers per HREP.
- **`schemas/user.py`** — `UserCreate`, `UserUpdate`, `PasswordChange`, `UserResponse`, `UserListResponse`.
- **17 new tests** in `test_user_management.py` — CRUD, RBAC guards, duplicate username rejection, self-deactivate protection, wrong-password and short-password rejection.

### Changed
- `main.py` — registered `users.router` at `/api/v1/users`; version bumped to 3.10.0.
- `config.py` — `VERSION` bumped to `3.10.0`.
- `test_auth.py` fixture — added explicit `DELETE FROM users` + `DELETE FROM refresh_token_blacklist` before each test to prevent bootstrap-blocked false positives across runs.

### Business Rules Enforced
- Non-SYSADMIN roles (MANAGER, CASHIER, VIEWER) **must** receive both `company_id` and `branch_id`; creating one without them returns 400.
- SYSADMIN accounts may have NULL `company_id`/`branch_id` (global scope).
- A SYSADMIN cannot deactivate their own account.
- Duplicate usernames/emails return 400 with a plain business-language message, never a raw DB traceback.

### Test Results
```
52 passed, 196 warnings in 20.59s
```
All 35 prior tests continue to pass. 17 new user management tests added.

---

## [3.9.0] — 2026-07-11 — Authentication Layer

### Added
- **JWT Authentication** (`python-jose[cryptography]`) — HS256-signed access tokens (60-min) and refresh tokens (7-day).
- **`POST /api/v1/auth/bootstrap`** — first-run SYSADMIN account creation; blocked when users exist.
- **`POST /api/v1/auth/login`** — returns `access_token` + `refresh_token` + `role`.
- **`POST /api/v1/auth/refresh`** — exchange refresh token for new access token; rejects blacklisted tokens.
- **`POST /api/v1/auth/logout`** — writes token JTI to `refresh_token_blacklist` table; idempotent.
- **`GET /api/v1/auth/me`** — returns authenticated user profile.
- **`User` model** (`users` table) — id, uuid, username, email, mobile, hashed_password, role (SYSADMIN/MANAGER/CASHIER/VIEWER), company_id, branch_id, is_active.
- **`RefreshTokenBlacklist` model** (`refresh_token_blacklist` table) — JTI-based revocation.
- **`get_current_user` dependency** — decodes Bearer JWT, loads User from DB, raises 401 on invalid/expired tokens.
- **`require_role(*roles)` guard factory** — raises 403 if caller's role is not in the allowed set.
- **Role enforcement on write endpoints**: `POST /products/` → MANAGER/SYSADMIN only; `POST /customers` → CASHIER+; `POST /customer-groups` → MANAGER+; `POST /sales-invoices/` → CASHIER+.
- **All read endpoints** now require authentication (any valid role).
- **Alembic migration** `8cf33df7b76a_add_users_and_token_blacklist` — creates `users` and `refresh_token_blacklist` tables.
- **14 new tests** in `test_auth.py` — bootstrap, login, /me, refresh, logout+blacklist, RBAC guards.
- `passlib[bcrypt]==1.7.4` — replaces custom PBKDF2 hashing.

### Changed
- `core/security.py` — fully rewritten: `hash_password` now uses bcrypt; `create_access_token` uses `python-jose`; new `create_refresh_token()` and `decode_token()` added.
- `api/deps.py` — `get_tenant_context` now reads `company_id`/`branch_id` from the validated JWT token (not X-Company-Id/X-Branch-Id headers).
- `config.py` — `ACCESS_TOKEN_EXPIRE_MINUTES` set to 60; `REFRESH_TOKEN_EXPIRE_DAYS=7` added.
- `test_tenant_isolation.py` — autouse fixture now also overrides `get_current_user` and `get_tenant_context`; tests use `set_test_tenant()` contextvar helper instead of HTTP headers.
- All version headers bumped to 3.9.0.

### Test Results
```
35 passed, 122 warnings in 8.93s
```
All 21 prior tests continue to pass. 14 new auth tests added.

---

## [3.8.0] — 2026-07-11

### Added
- Plumbed `TenantContext` in `backend/app/api/deps.py` extracting and validating `X-Company-Id` and `X-Branch-Id` headers against active records.
- Implemented `Company` and `Branch` SQLAlchemy models in `backend/app/models/tenant.py` and schemas in `backend/app/schemas/tenant.py`.
- Scaffolded Alembic migrations adding `companies`/`branches` tables, and nullable Foreign Key constraints to existing tables (`products`, `customers`, `customer_groups`, `sales_invoices`) pointing to tenants.
- Created `CustomerRepository` and `SalesInvoiceRepository` extending `BaseRepository` with tenant-scoped searches.
- Implemented REST API routers for inventory (`/api/v1/products`), crm (`/api/v1/customers` and `/api/v1/customer-groups`), and sales (`/api/v1/sales-invoices`).
- Added robust integration/unit tests in `backend/app/tests/test_tenant_isolation.py` validating 6 tenant isolation constraints including a concurrent-write race-condition test.
- Created `backend/Dockerfile` and `backend/entrypoint.sh` — runs `alembic upgrade head` then starts gunicorn with UvicornWorker.
- Added `python-core` service to `docker-compose.yml` wiring the FastAPI backend with healthcheck and `db` dependency.

### Changed
- Refactored `BaseRepository` query layer to automatically inject tenant filters on reads and stamp tenant IDs on creations.
- Plumbed `TenantContext` propagation through `InventoryService`, `CrmService`, and `SalesService` checking duplicates and stock levels within tenant boundaries.
- Updated FastAPI bootstrap in `backend/app/main.py` and Alembic config in `backend/alembic/env.py`.
- Wrapped `await self.db.commit()` in `create_product`, `create_customer_group`, `create_customer`, and `create_sales_invoice` with `try/except IntegrityError` — concurrent duplicate inserts return HTTP 400 with business-language detail instead of an unhandled 500 traceback (per HREP Rule 1).

---

## [3.7.0] — 2026-07-11

### Added
- Configured SQLAlchemy 2.0-compatible `BaseEntity` mixin declaring audit trail, multi-tenant workspace keys, and soft delete hooks.
- Configured generic `BaseRepository` class to handle common async CRUD query operations.
- Added Pydantic validation schemas in `backend/app/schemas/` (`crm.py`, `inventory.py`, `sales.py`).
- Added service layers in `backend/app/services/` (`crm.py`, `inventory.py`, `sales.py`) executing business validations, credit limit rules, and transactional stock deductions.
- Established Alembic migrations scaffold and created baseline schema migration (`12b68ccebec7_baseline_schema.py`) to manage database schema updates.
- Added comprehensive unit tests for models, repositories, schemas, and services in `backend/app/tests/`.

### Changed
- Refactored CRM, Inventory, and Sales database models to inherit from `BaseEntity` mixin.
- Upgraded `package.json` package version from `3.6.0` to `3.7.0`.

---

## [3.6.0] — 2026-07-11

### Added
- Created top-level `backend/` folder separating Python backend services from Node resources.
- Configured FastAPI bootstrap framework in `backend/app/main.py` with CORS, Request ID bindings, and request logging middleware.
- Configured Pydantic Settings core config with environmental priority rules.
- Setup SQLAlchemy 2.x asyncpg session pools and Alembic migrations configurations.
- Exposed health checks (`/health`, `/ready`, `/live`, `/version`, `/metrics`).
- Version-controlled API routers under `/api/v1/` for metadata, changelog, and dev-tracker.
- Implemented static code scanner and reports builder in Python.
- Created `test_main.py` Pytest suite asserting FastAPI core logic.
- Stubbed AI sub-modules structure (Assistant, Forecast, OCR, Recommendations, Analytics, Embeddings, LLM, Prompt Engine).

### Changed
- Registered `start:fastapi` launch command runner in `package.json`.

---

## [3.5.0] — 2026-07-11

### Added
- Implemented **SMRITI Development Intelligence Center (SDIC)** module at `src/modules/dev_tracker/`.
- Created codebase AST/regex scanner mapping 18 tracking dimensions (UI, Logic, DB, APIs, Auth, Reports, Printing, Barcodes, AI, Security, etc.).
- Created GET `/api/dev-tracker` and POST `/api/dev-tracker/scan` controllers and routers.
- Designed comprehensive `DevTrackerTab.tsx` dashboard displaying DHI gauges, Recharts progress line charts, and check matrices.
- Added test suite `src/modules/dev_tracker/tests/devTracker.test.ts` asserting report writes.
- Dynamically generate 15 markdown reports inside `docs/reports/` (with timestamped folders) and root `DEVELOPMENT_STATUS.md`.

### Changed
- Integrated baseline scanner execution on backend server boot sequence.
- Registered new workspace tab configurations in `layout_store.tsx` and routed in `App.tsx`.
- Updated test runner script in `package.json` to execute multiple test suites.

---

## [3.4.0] — 2026-07-11

### Added
- Created backend Express router GET `/api/changelog` in `server.ts` to dynamically serve the changelog text content.
- Created `src/tests/about.test.ts` to assert package properties, config structure, and changelog contents.

### Changed
- Redesigned `AboutSmritiTab.tsx` with a responsive split pane structure featuring 20 sub-navigation items, interactive search filtering, visual timelines, and diagnostic dashboards.
- Added print-friendly styles enabling high-contrast monochrome printing of active reference sheets.
- Updated `package.json` to register automated test suite run scripts.

### Documentation
- Registered plan and walkthrough index entries in the `docs` registry.
- Consolidated plan and walkthrough files.

---

## [3.3.0] — 2026-07-11

### Changed
- Standardized project-wide headers across all eligible first-party source, script, style, and documentation files to uniform AITDL NETWORKS branding, copyright, and founding leadership metadata.
- Preserved existing file created dates and codebase versions while updating modified dates.

### Documentation
- Created implementation plan `Project_Header_Standardization_Plan_v3.3.0.md` and walkthrough `Project_Header_Standardization_Walkthrough_v3.3.0.md`.
- Consolidated plans and walkthroughs.
- Updated master indices and changelogs.

---

## [2.1.4] — 2026-07-11

### Added
- Created `src/db/pool.ts` to manage PostgreSQL connection pools.
- Created `src/db/schema.sql` defining database schemas, relational foreign keys, GIN-indexed JSONB columns, and optimized computed fields.
- Created `src/db/init.ts` containing automatic database migration execution and JSON data seeding scripts.

### Changed
- Refactored `server.ts` to load environment configurations and run PostgreSQL initialization asynchronously on startup before listening to ports.

### Documentation
- Created PostgreSQL connection and tables seeding walkthrough (`PostgreSQL_Initialization_Walkthrough_v2.1.4.md`).
- Appended database walkthrough to the consolidated ledger and updated the README index.
- Updated wiki homepage with recent database integration logs.

---

## [2.1.3] — 2026-07-11

### Added
- Created `src/components/SmritiErrorBoundary.tsx` component to handle individual workspace tab crashes.

### Changed
- Fixed hardcoded 18% GST in POS Terminal checkout summary to calculate average taxation dynamically based on per-product GST rates.
- Enabled session storage caching for held billing records, persisting parked transactions across page reloads.
- Integrated `useMemo` hooks and a 150ms debounce delay inside the POS product filter search bar.
- Stabilized keyboard listener dependency array using `useCallback` on invoice hold handlers.
- Integrated barcode auto-addition to carts when the search input captures exact barcode matches on Enter keypresses.
- Added Loyalty Account customer autocomplete support using HTML5 `<datalist>` populated from `customerStore`.
- Modified `App.tsx` tab rendering to wrap all workspace areas inside the new Error Boundary.
- Refactored `PrintPreviewModal` to only parse and mount conditionally when print draws are triggered.

---

## [2.1.2] — 2026-07-11

### Added
- Integrated central middleware audit logging on all backend mutating HTTP endpoints (POST, PUT, DELETE).
- Created `/api/customers` and `/api/customers/groups` endpoints.

### Changed
- Upgraded `/api/pos/checkout` to support split payment tenders and credit account mappings.
- Bound terminal hotkey events (F2, F3, F12, Escape) to corresponding operations inside the POS billing engine.

---

## [2.1.1] — 2026-07-10

### Changed
- Modernized subview layouts and animations in the Sales & Commerce Studio (`SalesStudioTab.tsx`).
