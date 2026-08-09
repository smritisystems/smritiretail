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

  * Websites: smritisys.com | aitdl.com | erpnbook.com | smritibooks.com

  * Version    : 3.33.0
  * Created    : 2026-07-11
  * Modified   : 2026-07-20
  * Copyright  : © SMRITIBooks.com. All Rights Reserved.
  * License    : Proprietary Commercial Software
  * Classification: Internal
-->

# SMRITI Retail OS — Changelog

All notable changes to SMRITI Retail OS will be documented in this file. This project adheres to Semantic Versioning.

## [Unreleased]

### Real-Wiring Audit Remediation & Mock Data Removal (SXP-RW-002)
- **Supplier Dashboard & Kernel (`SupplierDashboardTab.tsx`, `SupplierService.ts`)**:
  - Removed pre-seeded mock suppliers (`SUP-001` TechCorp, `SUP-002` Global Supplies, `SUP-0001` Supreme Garments) from initial states and `localCache`.
  - Fixed `data.length > 0` fetch guards to `if (Array.isArray(data))` to ensure clean databases (0 records) display an honest 0-supplier empty state.
- **Purchase Service Kernel (`PurchaseService.ts`)**:
  - Removed pre-seeded mock PO (`PO-2025-001` Apex Footwear) from `localCache`.
  - Fixed `data.length > 0` fetch guard to `if (Array.isArray(data))` to display 0 POs on clean database.
  - Rethrow backend save and delete errors cleanly instead of returning fallback mock objects.
- **CRM Studio Lead Pipeline (`CRMStudioTab.tsx`)**:
  - Removed 4 hardcoded lead records (`Vikram Malhotra`, `Ananya Sen`, `Karan Johar`, `Priya Desai`) and fake field visit seeds.
  - Wired `CRMStudioTab.tsx` to canonical backend endpoints: `GET /api/v1/leads` on mount and `POST /api/v1/leads` on lead creation.
  - Verified Field Visits: 0 backend endpoints exist; component now displays an honest zero-state without introducing unvetted database tables per Gap 9.
- **Accounting & Audit Services (`AccountingService.ts`, `AuditService.ts`)**:
  - Fixed empty array response handling for vouchers and audit logs.
  - Removed hardcoded 'SPK Bootstrapped' audit log entry from `AuditService.ts` initial cache.
- **Reports & Widgets (`QuickReportsWidget.tsx`, `LoyaltyStudioTab.tsx`, `tallySyncEngine.ts`)**:
  - Removed hardcoded fallback rows (`INV-2026-104`–`108`, `Karan Johar`) from `QuickReportsWidget.tsx`.
  - Cleared seeded wallets from `LoyaltyStudioTab.tsx` and seeded Tally queue from `tallySyncEngine.ts`.

### Test Regression Fix — Phase A Duplicate Barcode Enforcement (SXP-TEST-001)

**Root Cause:** After the Real-Wiring Audit eliminated all mock/seed data, `ItemService.save()` became dependent on a real authenticated API call to persist items. The Phase A unit test `phaseADataIntegrity.test.ts` tested a **pure in-process business rule** (duplicate barcode rejection via `localCache`) but called `save()` without a real auth token, causing the first `save()` to throw `"Unauthenticated session"` before the cache could be populated.

**Fix 1 — `ItemService.ts` (Optimistic Cache Pattern):**
- `save()` now **optimistically upserts** the normalized SKU into `localCache` immediately after the duplicate barcode check passes but **before** the `apiFetchV1` call.
- If the API call fails, the optimistic cache entry is **rolled back** (`previousCacheEntry` is restored; for new items the entry is removed entirely).
- This ensures the duplicate barcode enforcement (a pure in-process guardrail) works correctly in any environment — online, offline, or unit test — without depending on the API round-trip.

**Fix 2 — `phaseADataIntegrity.test.ts` (API Transport Mock):**
- Added `vi.mock("../lib/apiFetchV1.js")` that echoes back the submitted request body as the API response.
- This isolates the unit test from the real API transport layer — the test correctly validates the `DUPLICATE BARCODE REJECTED` business rule without requiring real authentication or a running backend.
- The mock follows the standard Vitest pattern for testing in-process business rules that happen to persist via an API.

**Verified Results:**
- Targeted: `4/4` passed in `phaseADataIntegrity.test.ts`
- Full suite: **1101/1101 tests passed — 155 test files — 0 failures**



### Full Frontend ↔ Backend Real Wiring & Mock Elimination (SXP-RW-001)
- **Authentication Hardening (`ApiAuthProvider.ts`)**:
  - Removed `isLocalDemoEnvironment()` mock fallback in `ApiAuthProvider.ts`. REAL BACKEND failures (401, 403, wrong credentials, network errors) now surface honestly to the user as real errors instead of silently converting into mock logins.
- **Sales & Checkout Engine (`SalesService.ts`, `pos_engine.py`, `AdvancedBillingEngine.tsx`)**:
  - Removed pre-seeded mock invoice `INV-2025-0001` from `SalesService.ts` `localCache`.
  - Updated `SalesService.saveInvoice()` and `ItemService.save()` to rethrow errors on backend save failures rather than returning fake success.
  - Extended `PosEngine.process_checkout` to auto-provision `DEFAULT_SESSION` when missing during direct checkout, eliminating 404 session errors.
  - Aligned `AdvancedBillingEngine.tsx` payload schema with `PosCheckoutReq` (`items: [{product_id, quantity, unit_price}]`).
  - Replaced hardcoded `SALESPERSONS` array in `PosTerminalTab.tsx` and `AdvancedBillingEngine.tsx` with dynamic fetching from `GET /api/v1/users/`.
- **Customer CRM Studio (`CustomerMasterTab.tsx`)**:
  - Removed 3 hardcoded mock customers (`CUST-1001`, `CUST-1002`, `TEMP-CUST-9901`).
  - Wired `CustomerMasterTab` to fetch real customer records from `GET /api/v1/customers` on mount.
  - Wired customer creation to `POST /api/v1/customers` for persistence.
- **Dashboard Operational Intelligence (`DashboardTab.tsx`)**:
  - Wired KPI cards to `GET /api/v1/reports/daily-sales?report_date={today}`.
  - Removed hardcoded KPI base numbers (`deadStockPercent = 24.5`, `Math.round(125000 * scaleFactor)`, base weekly revenue array).
  - Derived `deadStockPercent` dynamically from zero-stock inventory products.

### Organization Module — Real Editing Wire-Up & Multi-Tenant Isolation (SCS-ORG-001)
- **Multi-Tenant Isolation Hardening (`masters.py`)**:
  - Implemented `TenantContext` isolation on all organizational master entities (`Company`, `Branch`, `Organization`, `Store`, `Warehouse`).
  - `list_masters()` now enforces tenant-scoped filtering: `or_(Entity.tenant_id == tid, Entity.tenant_id.is_(None))`.
  - `create_master()` stamps `tenant_id = tenant.tenant_id` on all new entity records.
  - `update_master()` and `delete_master()` enforce strict tenant ownership checks returning `403 Forbidden` for cross-tenant mutation attempts.
- **Company Schema Expansion (`masters_tier2.py`)**:
  - Expanded `CompanyUpdate` and `CompanyResponse` schemas to expose `legal_name`, `short_name`, `company_type`, `industry_type`, `fiscal_year_start_month`, `currency_code`, and `is_gst_registered`.
  - Fixed `from_orm_model()` to serialize all legal and financial parameters, preventing edit forms from resetting company metadata to defaults.
- **Organization Studio UI Modernization (`OrganizationStudio.tsx`)**:
  - Wired real CRUD operations against `/api/v1/masters/*` and `/api/v1/users/`.
  - Created `CompanyEditModal.tsx` for inline company attribute updates.
  - Created data-driven `BranchFormModal.tsx` and `WarehouseFormModal.tsx` for Branch/Store and Warehouse/Stock Room management (Create, Edit, Retire).
  - Removed all hardcoded fallback data (`SMRITI Footwear Pvt Ltd`, hardcoded branches/warehouses), replacing errors with an `AlertCircle` banner and `Retry` action.
  - Replaced static licensing and financial year mockups with honest empty state indicators.
  - Updated `OrganizationSelector.tsx` to dynamically fetch active tenant companies from `/api/v1/auth/tenants` and `/api/v1/masters/company`.

### SMRITI DHI — Quality Score Forensic Audit
- Completed comprehensive forensic audit of the 15% DHI Quality Score (`SMRITI_DHI_QUALITY_FORENSIC_AUDIT_V1.md`).
- Deconstructed score formula (`qualityScore = max(0, 100 - floor(todos/10) - 2 * len(large_components))`).
- Identified root cause of Billing Desk (52%) and CRM & Loyalty (44%) risk flags as stale scanner metadata (`CrmLoyaltyTab.tsx` vs `CrmStudioTab.tsx`) and route prefix exception-list mismatches (`pos.py`).

### Universal Printing Kernel — Real Hardware Certification Audit (IMPACT by Honeywell IH-2)
- **Host OS Printer Queue Discovery (`Get-Printer`)**:
  - Successfully enumerated physical Windows printer queue: `IMPACT by Honeywell IH-2 (300 dpi) - DPL` (Driver: `IMPACT by Honeywell IH-2 (300 dpi) - DPL`, Port: `FILE:`).
  - Classified discovery as `REAL_HOST_DISCOVERED`.
- **Printer Language & Capability Governance**:
  - Audited target language as `DPL` (Datamax Printer Language) at `300 DPI`.
  - Confirmed SMRITI capability engine safely blocks sending raw ZPL (`^XA...^XZ`) directly to a DPL printer with error `UNSUPPORTED_PRINTER`.
  - Identified architectural gap: `DPLRenderer` (`UniversalLabelDocument` $\rightarrow$ DPL command stream) is `NOT_IMPLEMENTED`.
  - Tested DPL payload dry-run generation (`<STX>L...D11...E`) returning checksum `chk-19c807d8`.
  - Verified Multi-PRN coexistence (`PRN-A-Tattly`, `PRN-B-DPL`, `PRN-C-GDI`) and dynamic field mapping without PRN source mutation.
  - Overall status: `IH-2 HARDWARE CERTIFICATION = PARTIALLY PASSED`.
- **Database Safety & Regression**:
  - Confirmed 269 physical PostgreSQL tables strictly frozen (0 migrations).
  - Confirmed 370/370 vitest unit tests passing and `npx tsc --noEmit` clean with 0 errors.

### Universal Printing Kernel — Phase H Refactor (Universal Print Execution & Spooling Kernel)
- **Universal Print Execution & Spooling Architecture (`UniversalPrintOrchestrator.ts`, `UniversalPrintJob.ts`, `UniversalPrintSpooler.ts`)**:
  - Implemented `UniversalPrintJob` model supporting job lifecycle states (`QUEUED`, `PREPARING`, `RENDERING`, `READY`, `PRINTING`, `COMPLETED`, `FAILED`, `CANCELLED`, `RETRYING`, `SENT_UNKNOWN_RESULT`).
  - Implemented payload checksum calculation (`computeChecksum()`) for strict idempotency and double-print protection.
  - Implemented `UniversalPrintSpooler` with FIFO queueing, priority support, pause/resume controls, retry management, and cancellation using `IPrintJobStore` (`MemoryPrintJobStore`).
  - Implemented isolated `PrinterAdapter` transport architecture supporting `USB` (`UsbPrinterAdapter`), `TCP RAW 9100` (`TcpRawPrinterAdapter`), `WINDOWS_SPOOLER` (`WindowsSpoolerPrinterAdapter`), `LOCAL_AGENT` (`LocalAgentPrinterAdapter`), and `FILE` (`FilePrinterAdapter`).
  - Implemented retry governance (retrying ONLY transport failures like `NETWORK_TIMEOUT`, `CONNECTION_RESET`, `AGENT_UNAVAILABLE`, `TEMPORARY_SPOOLER_ERROR`).
  - Implemented `UniversalPrintOrchestrator.dryRun()` preview engine providing resolved fields, canvas verification, checksums, and compatibility diagnostics without physical dispatch.
  - Added 75 new unit tests across 4 test suites (`universalPrintJob.test.ts`, `universalPrintSpooler.test.ts`, `printerAdapter.test.ts`, `printExecutionIntegration.test.ts`), bringing total printing kernel test suite to **370 passing tests**.
  - Strictly preserved 269 PostgreSQL physical tables (0 schema mutations) and legacy printing code (`src/dop/`, `src/print_engine/`, `BarcodePrintDialog.tsx`).

### Architecture & Governance (Item Master E8 Business Semantics Decision Audit — CLOSED BY DESIGN)
- **SMRITI Business Semantics Audit V1**:
  - Audited SMRITI Retail OS business requirements across 15 domains (Item Master, SKU, Variants, Barcodes, Invoices, POs, Sales, Stock, Import, Attributes, Industry Packs, Master Lookup, Multi-Tenant, Auditability, Reporting).
  - Confirmed `Product` attribute storage (`color`, `size`, `brand`, `category`, `attributes` JSONB) is intentionally designed as Model B (Item Snapshot Value) to preserve historical document integrity, SKU/Barcode immutability, and statutory tax compliance.
  - Established Architectural Principle AP-008: String snapshot equality is NOT identity reference. MasterValue provides entry-time validation; Product stores point-in-time item snapshots.
  - Governed decision: **E8 = CLOSED — SNAPSHOT SEMANTICS ARE CORRECT** (STATUS: CLOSED BY ARCHITECTURAL DESIGN).
  - Generated canonical decision deliverable artifact:
    - [`SMRITI_E8_BUSINESS_SEMANTICS_DECISION_V1.md`](file:///f:/SMRITRretailNXmgrt/SMRITI_E8_BUSINESS_SEMANTICS_DECISION_V1.md)

### Architecture & Governance (Item Master E8 Identity Linkage Review & Gate — BLOCKED)
- **Empirical Database Identity Linkage Audit V1**:
  - Executed empirical database audit on live PostgreSQL (`smriti_retail_db`).
  - Proved zero persistent `master_value_id` or FK linkage on `Product` table (columns `color`, `size`, `brand`, `category`, and `attributes` JSONB behave as text snapshots).
  - Enforced absolute prohibition on heuristic text-based updates (`WHERE product.color = old_name`), preventing catalog data corruption.
  - Created empirical test `test_e8_identity_linkage_verification.py` (**PASSED**).
  - Governed decision: **E8 = BLOCKED — NO SAFE PERSISTENT MASTER-VALUE IDENTITY LINKAGE**.
  - Generated canonical audit deliverable artifact:
    - [`SMRITI_E8_IDENTITY_LINKAGE_AUDIT_V1.md`](file:///f:/SMRITRretailNXmgrt/SMRITI_E8_IDENTITY_LINKAGE_AUDIT_V1.md)

### Architecture & Governance (Item Master Attribute Governance V2 — PASSED)
- **Presentation-Level Attribute Deduplication & Industry Pack Resolution V2**:
  - Implemented presentation-level attribute deduplication in `UniversalAttributeEngine.resolveDeduplicatedColumns` enforcing `new Set(columns.map(c => c.canonicalKey)).size === columns.length`.
  - Added import duplicate header guard `UniversalAttributeEngine.validateDuplicateCanonicalHeaders(headers)` returning deterministic `DUPLICATE_CANONICAL_COLUMN` validation error if two headers map to the same canonical key.
  - Integrated header validation into `ExcelGridEntrySection.tsx` paste and mapping handlers.
  - Verified all 14 certification scenarios across Apparel, Footwear, Electronics, Jewellery, Medical, and FMCG industry packs.
  - Executed Vitest certification suite: **20/20 PASSED**. Executed `tsc --noEmit`: **0 ERRORS**. Executed backend regression suite: **11/11 PASSED**.
  - Generated canonical governance deliverable artifact:
    - [`SMRITI_ITEM_MASTER_ATTRIBUTE_GOVERNANCE_V2.md`](file:///f:/SMRITRretailNXmgrt/SMRITI_ITEM_MASTER_ATTRIBUTE_GOVERNANCE_V2.md)

### Architecture & Governance (Item Master Backend Test Isolation Fix V2 Final Validation — PASSED)
- **Backend Scoped Test Isolation Safety Audit & Validation V2**:
  - Performed safety audit of test isolation query in `_make_tenant_ctx`, hardening it to `DELETE FROM master_values WHERE tenant_id LIKE 'c_%' AND code LIKE 'CUSTOM-%'`, strictly scoping cleanup to synthetic test tenant IDs starting with `c_`.
  - Verified zero risk of deleting pre-existing production master data or system master values (`tenant_id IS NULL`).
  - Verified exact collected test count: **7 tests collected** in `test_phase_f_sizescale.py`.
  - Executed backend test suite: **7/7 PASSED** in `test_phase_f_sizescale.py`; **11/11 PASSED** in full relevant backend regression suite.
  - Executed frontend typecheck (`tsc --noEmit`) and Vitest suite: **19/19 PASSED**.
  - Generated canonical V2 deliverable artifact:
    - [`SMRITI_ITEM_MASTER_BACKEND_TEST_ISOLATION_FIX_V2.md`](file:///f:/SMRITRretailNXmgrt/SMRITI_ITEM_MASTER_BACKEND_TEST_ISOLATION_FIX_V2.md)

### Architecture & Governance (Item Master Backend Test Isolation Fix V1 — PASSED & GREEN)
- **Backend Test Isolation Hardening V1**:
  - Implemented test-isolation remediation strictly in `backend/app/tests/test_phase_f_sizescale.py` (`_make_tenant_ctx` helper) to clean up transient `CUSTOM-%` test master values before tenant context creation.
  - Verified zero modifications to production code, PVE engine, database schema, or Alembic migrations (**FROZEN**).
  - Executed backend test suite: **7/7 PASSED** in `test_phase_f_sizescale.py`; **11/11 PASSED** in full relevant backend regression suite.
  - Executed frontend typecheck (`tsc --noEmit`) and Vitest suite: **19/19 PASSED**.
  - Generated canonical fix deliverable artifact:
    - [`SMRITI_ITEM_MASTER_BACKEND_TEST_ISOLATION_FIX_V1.md`](file:///f:/SMRITRretailNXmgrt/SMRITI_ITEM_MASTER_BACKEND_TEST_ISOLATION_FIX_V1.md)

### Architecture & Governance (Item Master Backend Test Failure Diagnosis V1 — DIAGNOSED)
- **Read-Only Backend Test Failure Diagnosis V1**:
  - Executed empirical read-only diagnosis of 4 backend test failures in `test_phase_f_sizescale.py`.
  - Proved zero production bug: failures stem from test fixture collision on `MasterValue(code="CUSTOM-APPAREL")` across unrolled test runs against persistent PostgreSQL without transaction rollback isolation.
  - Item Master business logic verified 100% functional (Business Logic Status: **PASS**; Production Impact: **NONE**).
  - Generated canonical diagnosis artifact:
    - [`SMRITI_ITEM_MASTER_BACKEND_FAILURE_DIAGNOSIS_V1.md`](file:///f:/SMRITRretailNXmgrt/SMRITI_ITEM_MASTER_BACKEND_FAILURE_DIAGNOSIS_V1.md)

### Architecture & Governance (Item Master Runtime Certification V1 — CERTIFIED & GREEN)
- **Item Master Runtime & UI Attribute Authority Certification V1**:
  - Executed complete runtime and UI certification across all 15 scenarios for Item Master attribute normalization, adaptive labeling, Excel import, variant generation, and SKU formula integrity.
  - Verified zero database modification, zero schema alterations, and zero SKU algorithm changes (**FROZEN**).
  - Executed Vitest test suite: **19/19 PASSED** (`src/tests/itemMasterRuntimeCertification.test.ts` & `src/tests/canonicalAttributeRegistry.test.ts`).
  - Generated canonical certification artifact:
    - [`SMRITI_ITEM_MASTER_RUNTIME_CERTIFICATION_V1.md`](file:///f:/SMRITRretailNXmgrt/SMRITI_ITEM_MASTER_RUNTIME_CERTIFICATION_V1.md)

### Architecture & Governance (Item Master Attribute Authority & Duplicate Column Audit V1 — COMPLETED)
- **Read-Only Item Master Attribute Authority & Duplicate Column Audit V1**:
  - Executed complete read-only architectural and UI/metadata audit of Item Master attribute definitions across `ItemMasterTab.tsx`, `ExcelGridEntrySection.tsx`, `UniversalAttributeEngine.ts`, `Product` model, and API schemas.
  - Proved zero physical database column duplication (`products.brand` and `products.style_code` are single PostgreSQL columns).
  - Verified that `Brand` vs `Brand Name` and `Style` vs `Article Code` vs `Model Number` are import header aliases and business-model display labels mapped to canonical keys `BRAND` and `STYLE_CODE`.
  - Generated canonical audit artifacts:
    - [`SMRITI_ITEM_MASTER_ATTRIBUTE_AUTHORITY_MAP_V1.md`](file:///f:/SMRITRretailNXmgrt/SMRITI_ITEM_MASTER_ATTRIBUTE_AUTHORITY_MAP_V1.md)
    - [`SMRITI_ITEM_MASTER_ATTRIBUTE_DUPLICATE_REPORT_V1.md`](file:///f:/SMRITRretailNXmgrt/SMRITI_ITEM_MASTER_ATTRIBUTE_DUPLICATE_REPORT_V1.md)

### Architecture & Governance (Database Architecture Refactor Audit V1 — COMPLETED)
- **Read-Only Database Architectural Audit V1**:
  - Executed complete read-only audit of live PostgreSQL database `smriti_retail_db` across 269 physical tables, 1 view, 0 materialized views, 8 sequences, and 995 indexes.
  - Strict compliance with `AFR-001`, `AFR-002`, `PROD-003`, `PROD-004`: zero tables modified, created, dropped, merged, or renamed.
  - Generated canonical architectural artifacts:
    - [`SMRITI_DATABASE_AUTHORITY_MAP_V1.md`](file:///f:/SMRITRretailNXmgrt/SMRITI_DATABASE_AUTHORITY_MAP_V1.md)
    - [`SMRITI_DATABASE_CONSOLIDATION_MAP_V1.md`](file:///f:/SMRITRretailNXmgrt/SMRITI_DATABASE_CONSOLIDATION_MAP_V1.md)
  - Documented 240 clean production baseline empty tables (0 rows), 29 active operational tables, 8 legacy shadow table families (`smriti_*`), and defined 5-phase Strangler Fig pattern refactoring roadmap.

### Added & Hardened (Barcode Sourcing Multi-Mode Support & GS1 Governance — CERTIFIED)
- **Barcode Sourcing Multi-Mode Support**:
  - Added `gs1_company_prefix` (nullable string), `barcode_source` (`AUTO` | `IMPORT` | `MANUAL`), and `barcode_counter` (sequential integer allocator) columns to `Company` model in `app/models/tenant.py` via Alembic migration `v1501_barcode_sourcing_multi_mode.py`.
  - Added `ProductIdentityService.validate_gs1_company_prefix()` strictly enforcing digits-only format and 6–11 character length constraint.
  - Eliminated hardcoded `"8901000"` fake prefix across `identity_service.py` and `sip/strategies.py`.
  - Implemented multi-tenant GS1 company prefix formatting (`{gs1_company_prefix}{item_ref}{check_digit}`) when configured.
  - Implemented GS1 restricted-circulation range (`200` series, e.g. `200{seq:09d}{check_digit}`) for internal retail numbering when `gs1_company_prefix` is None.
  - Updated `/attributes/import-commit` and variant creation endpoints to enforce `barcode_source` company policy (`AUTO` auto-generates; `IMPORT` and `MANUAL` preserve supplied barcode or raise HTTP 422 if missing).
  - Added comprehensive backend test suite `app/tests/test_barcode_sourcing_multi_mode.py` (4/4 passed).

### Hardened (Phase F SizeScale Adoption — CERTIFIED)
- **Phase F SizeScale Adoption & Schema Integrity**:
  - `Product.size` preserved as canonical product display/sellable size value across all billing, POS, and inventory workflows.
  - Added optional `size_scale_id` foreign key reference to `products` table (`ForeignKey("size_scales.id", ondelete="SET NULL")`) via Alembic migration `v1500_phase_f_sizescale_adoption.py`.
  - Updated `Product` model relationship `size_scale` (`lazy="selectin"`).
  - PlatformValidationEngine (`PVE`) updated to validate `size_scale_id` tenant authorization and verify `Product.size` belongs to `SizeValue.display_size` for that scale, raising HTTP 422 `SMRITI-VAL-SIZE-001` on invalid size combination or scale ID.
  - Added `SizeMasterService.resolve_conversions(scale_id, display_size)` multi-region resolution engine returning mapped regional size labels (e.g. `{"UK": "7", "US": "8", "EU": "41"}`) without region fabrication. Read-only.
  - Added comprehensive automated test suite `app/tests/test_phase_f_sizescale.py` verifying aggregate creation, PVE validation, multi-region resolution, tenant isolation, DB `ON DELETE SET NULL` behavior, and algorithm preservation.

### Fixed & Hardened (MasterReferenceStudio UI/UX & Attribute Governance — CERTIFIED)
- **MasterReferenceStudio (8 UI/UX Hardening Fixes)**:
  - **FIX 1:** Category mapping creation now binds category `code` (`value={cat.code}`) rather than display name, aligning with backend schema constraints.
  - **FIX 2:** Corrected datatype option value typo from `"Text font-sans"` to `"Text"`.
  - **FIX 3:** Implemented full JSX Groups tab panel and `CreateGroupForm` helper component for creating and displaying attribute groups (`POST /attributes/groups`).
  - **FIX 4:** Enforced UI action lock for `SYSTEM` category types (`disabled={selectedType?.is_system}`) rendering `<ShieldAlert />` icon, tooltip, and cursor lock.
  - **FIX 5:** Integrated toast notification system (`{toast && ...}`) with auto-dismiss timer and added `isSaving` loading spinners (`<Loader2 className="animate-spin" />`) on submit actions.
  - **FIX 6:** Category mappings table primary column now resolves human-readable Attribute Group Name via `groups.find(...)?.name`.
  - **FIX 7:** Removed hardcoded fallback master types array; implemented explicit `<ShieldAlert />` error container (`masterTypesError`) when server returns empty/error response.
  - **FIX 8:** Added advanced flags section exposing `is_searchable`, `is_filterable`, `is_printable`, `is_barcode_enabled`, `is_enabled`, and `display_order` to attribute definition POST body.
  - Verified with `npx tsc --noEmit` (0 errors) and Vitest frontend test suite (137/137 files passed, 685/685 tests passed).
  - Core identity algorithms `generate_sku_business_key()` and `generate_fingerprint_hash()` 100% unedited and preserved.
  - Verified 100% test pass rate across complete relevant backend test suite (`184/184 PASSED`, `0 FAILED`).

### Hardened (Phase E Authority Hardening — CERTIFIED)
- **Product Category & Attribute Authority Reconciliation (Phase E)**:
  - Hardened product update path: `Product.category` and `Product.brand` frozen at creation (`422 Unprocessable Entity` on update attempt). `style_code` frozen for variant products.
  - Added PostgreSQL DB constraint `UniqueConstraint('master_type_id', 'code', name='uq_master_value_type_code')` on `master_values` via Alembic migration `v1400_phase_e_authority_hardening.py`.
  - Added indexed nullable `category_code` `String(50)` column to `products` table and `category_attribute_group_mappings` table, backed by tenant-scoped SQL backfill `v1401_phase_e_backfill.py`.
  - PlatformValidationEngine (`PVE`) captures and populates `category_code` from authoritative `MasterValue.code` during product validation and auto-creation.
  - Standardized JSONB mirror keys to canonical uppercase `"Color"` and `"Size"`. Direct and variant product creation paths perform bidirectional sync (`Product.color`/`Product.size` DB columns <-> `attributes["Color"]`/`attributes["Size"]` JSONB mirror), stripping legacy lowercase keys.
  - PVE enforces strict non-negative, finite numeric validation for `attributes["cbm"]` (`SMRITI-VAL-CBM-001`/`002`). Added typed `cbm_m3` `NUMERIC(10,4)` column to `products`.
  - `LandedCostEngine` upgraded to three-tier CBM resolution: (1) `Product.cbm_m3` typed column -> (2) `attributes["cbm"]` JSONB fallback -> (3) `Decimal("0.01")` default.
  - `LookupRepository.atomic_replace_value()` updated to assign a collision-safe historical code to superseded records before inserting the new active record, preserving `UNIQUE(master_type_id, code)` DB constraint and full versioning history.
  - 100% test pass rate achieved across complete relevant backend test suite (`176/176 PASSED`, `0 FAILED`).
  - `generate_sku_business_key()` and `generate_fingerprint_hash()` 100% unedited and preserved.
  - SizeScale adoption explicitly deferred to Phase F.

### Added
- **Master & Reference Studio & Dynamic Attribute Architecture (`MasterReferenceStudio.tsx` / `ItemMasterStudio.tsx` / `NavigationRegistry.ts` / `attributes.py`)**:
  - Implemented unified `MasterReferenceStudio.tsx` in [src/features/masters/components/MasterReferenceStudio.tsx](file:///f:/SMRITRretailNXmgrt/src/features/masters/components/MasterReferenceStudio.tsx) adhering to Single Workspace Principle (Rule PROD-002 / SWP-001) and Promote Before Create (Rule PBC-001).
  - Mounted `MasterReferenceStudio` in `src/App.tsx` under switch cases (`master-studio`, `master-reference-studio`, `masters-reference`).
  - Hardened tenant isolation in `AttributesService` (`list_definitions`, `list_groups`, `list_templates`, `list_category_mappings`) with mandatory `company_id` filter.
  - Replaced single `unique=True` on `CategoryAttributeGroupMapping.category` with composite `UniqueConstraint('category', 'attribute_group_id')` allowing multi-group category mappings, supported by Alembic migration [v900_multi_group_category_mapping.py](file:///f:/SMRITRretailNXmgrt/backend/alembic/versions/v900_multi_group_category_mapping.py).
  - Replaced free-text category and attribute group inputs in `MasterReferenceStudio.tsx` with `<select>` dropdowns populated from `product_category` master values and loaded `AttributeGroup` records.
  - Corrected `apiFetchV1` import path in `MasterReferenceStudio.tsx` to `../../../lib/apiFetchV1`.
  - Registered `NAV_MASTER_STUDIO` in [NavigationRegistry.ts](file:///f:/SMRITRretailNXmgrt/src/kernel/upr/navigation/NavigationRegistry.ts).
  - Verified 100% clean test suite in [attributeCategoryMaster.test.ts](file:///f:/SMRITRretailNXmgrt/src/tests/attributeCategoryMaster.test.ts) (56/56 total passed).
- **Company Code Provisioning & Intelligent Suggestion Engine (`CompanyCodeSuggestionService.ts` / `system.py` / `SetupWizardTab.tsx`)**:
  - Refactored Enterprise Organization Studio & Company Provisioning Wizard so Company Code is explicitly visible in UX/UI, suggested from `CITY(3) + PIN_LAST3(3) + SEQUENCE(3)` (e.g. `MUM067001`), and overridable by users.
  - Implemented `GET /api/v1/company/code/availability` returning strictly `{ "available": boolean }` without exposing tenant secrets.
  - Implemented `GET /api/v1/company/code/suggest` calculating sequence `01..99` for city+pin prefixes and stopping automatic suggestion when all 99 sequences are occupied.
  - Hardened backend `POST /api/v1/company/setup` with pre-flight uniqueness checks and `IntegrityError` handling, returning `HTTP 409 Conflict` on duplicate codes.
  - Enforced OLE event ordering: duplicate failures emit `Company.Provisioning.Started.v1` ──► `Company.Provisioning.Failed.v1` (NEVER `Activated`).
  - Added full test suite in [companyCodeProvisioning.test.ts](file:///f:/SMRITRretailNXmgrt/src/tests/companyCodeProvisioning.test.ts) covering all 15 test scenarios (including sequence exhaustion and async race protection).

### Fixed
- **Session Expiry & Workspace Unlock Server-Side Password Verification (`SessionExpiredDialog.tsx` / `LockScreen.tsx` / `LockService.ts` / `SessionService.ts` / `auth.py`)**:
  - Eliminated critical security vulnerability where entering an incorrect or arbitrary password unlocked the session/workspace.
  - Implemented `POST /api/v1/auth/session/resume` enforcing authoritative server-side password verification and identity resolution.
  - Enforced server-side rate limiting (returns `HTTP 429 Too Many Requests` after 5 failed password attempts).
  - Enforced fail-closed security invariants: session remains locked on 401, 403, 429, 500, network errors, or malformed HTTP 200 payloads.
  - Added comprehensive automated security test suite in [sessionExpiryAuth.test.ts](file:///f:/SMRITRretailNXmgrt/src/tests/sessionExpiryAuth.test.ts) covering 14 security test scenarios.
- **Fail-Closed Pre-Resolution Security & Pre-Login Environment Discovery (`EnvironmentContext.tsx` / `EnvironmentResolver.ts` / `apiFetchV1.ts`)**:
  - `EnvironmentProvider` initializes state as `EnvironmentResolver.unresolved()` (`mode: "UNKNOWN"`, `showDevCredentials: false`, `badgeLabel: "RESOLVING..."`), completely eliminating brief dev credential exposure flashes on page load.
  - Configured `apiFetchV1.ts` to allow pre-login access to `/admin/environment/profile` (public bootstrap environment profile metadata) without throwing unauthenticated errors.
  - Added unit test cases in [environmentResolver.test.ts](file:///f:/SMRITRretailNXmgrt/src/tests/environmentResolver.test.ts) verifying pre-resolution fail-closed security.
- **Unified Environment Context & Shared State Propagation (`EnvironmentContext.tsx` — Rule PROD-004 & PROD-005 Compliance)**:
  - Created [src/kernel/config/EnvironmentContext.tsx](file:///f:/SMRITRretailNXmgrt/src/kernel/config/EnvironmentContext.tsx) (`EnvironmentProvider` / `useEnvironmentContext`) to propagate one authoritative backend-resolved `EnvironmentInfo` state across the application.
  - Mounted `<EnvironmentProvider>` at application root in [App.tsx](file:///f:/SMRITRretailNXmgrt/src/App.tsx), eliminating split-brain environment states between [EnvironmentBadge.tsx](file:///f:/SMRITRretailNXmgrt/src/components/EnvironmentBadge.tsx) and [LoginCard.tsx](file:///f:/SMRITRretailNXmgrt/src/features/auth/components/LoginCard.tsx).
  - Implemented **Fail-Closed Security Rule** in [EnvironmentResolver.ts](file:///f:/SMRITRretailNXmgrt/src/kernel/config/EnvironmentResolver.ts) (`shouldShowDevCredentials()`), ensuring dev credentials are automatically hidden whenever environment state is pending, unknown, staging, or production.
- **Authentication JWT `access_token` Field Mapping (`ApiAuthProvider.ts`)**:
  - Updated [src/features/auth/providers/ApiAuthProvider.ts](file:///f:/SMRITRretailNXmgrt/src/features/auth/providers/ApiAuthProvider.ts) to extract `access_token` and `refresh_token` from FastAPI `/api/v1/auth/login` responses.
  - Eliminates `401 (Unauthorized)` errors caused by falling back to mock token strings (`smriti_jwt_*`) during real backend authentication sessions.
- **API Fetch Live Backend Direct Dispatch (`apiFetchV1.ts`)**:
  - Removed `isLocalMockToken` short-circuit return (`if (isLocalMockToken(token)) return []`) in [src/lib/apiFetchV1.ts](file:///f:/SMRITRretailNXmgrt/src/lib/apiFetchV1.ts).
  - Ensures requests executed under developer/quick-fill sessions (`super` / `manager` / `cashier`) dispatch directly to the live FastAPI backend server (`/api/v1/*`) to create and read real PostgreSQL database records.
- **Backend Multi-Company Provisioning Lock (`system.py`)**:
  - Updated `/company/setup` in [backend/app/api/v1/system.py](file:///f:/SMRITRretailNXmgrt/backend/app/api/v1/system.py) to allow onboarding additional legal entities when executed by authenticated admin users or when `ignoreWarnings=true`.
- **Backend FastAPI `main.py` Exchange Router Module Import**:
  - Fixed `NameError: name 'exchange' is not defined` at line 271 of [backend/app/main.py](file:///f:/SMRITRretailNXmgrt/backend/app/main.py) by adding `exchange` to the `from .api.v1 import (...)` module list.
- **Backend FastAPI `smriti-api-prod` Container Circular Import Fix (`PROD-004`)**:
  - Fixed `ImportError: cannot import name 'environment_router' from partially initialized module 'app.api.v1'` in [backend/app/api/v1/__init__.py](file:///f:/SMRITRretailNXmgrt/backend/app/api/v1/__init__.py).
  - Created [backend/app/api/v1/endpoints/__init__.py](file:///f:/SMRITRretailNXmgrt/backend/app/api/v1/endpoints/__init__.py) package initializer and updated `__init__.py` to import `environment_router` from `.endpoints`, allowing Gunicorn / Uvicorn workers in Docker container `smriti-api-prod` to boot cleanly and pass health checks.
- **Organization Studio & OLE Lifecycle Event Architecture (`Company Provisioning Wizard → SPK.events → OLE`)**:
  - Replaced the placeholder string notice on the **Create New Company** button in [OrganizationStudio.tsx](file:///f:/SMRITRretailNXmgrt/src/components/admin/OrganizationStudio.tsx) with a modal overlay launching [SetupWizardTab.tsx](file:///f:/SMRITRretailNXmgrt/src/components/SetupWizard/SetupWizardTab.tsx) (provisioning UI/workflow).
  - Emits standard infrastructure-neutral domain events (`Company.Provisioning.Started.v1`, `Company.Provisioning.Completed.v1`, `Company.Activated.v1`, `Company.Provisioning.Failed.v1`) through `SPK.events` carrying explicit `oleState` lifecycle metadata (`Draft ──► Provisioning ──► Active / ProvisionedWithWarning / Failed`).
  - Automatically closes modal and refetches registered entities upon completion.
- **Setup Wizard Fallback Transparency & PDF Health Check Hardening (Rule PROD-006 Compliance)**:
  - Eliminated silent masking of backend company creation failures when the `"Upstream python-core"` fallback triggers in `SetupWizardTab.tsx`.
  - Added `isFallbackMode` state tracking and persistent Amber alert badge (`Status: LOCAL FALLBACK MODE — Pending Backend Confirmation`) on the success screen and stored explicit `smriti_setup_fallback_mode` metadata in `localStorage`.
  - Replaced hardcoded literal health checks (`{ status: "PASS", durationMs: 14 }`) in `downloadSetupReportPDF` with dynamic, truthfully measured execution metrics (`performance.now()`) and dynamic statuses (`PASS` vs `WARNING` depending on fallback mode).
  - Fixed `setSetupNotice({ message: msg, canIgnore })` to use the computed `canIgnore` boolean instead of hardcoding `true`, preventing non-skippable critical system errors from being offered as skippable.
- **Item Master Accessibility & Notification Hardening**:
  - Wrapped all 12 `onNotification` calls in `ItemMasterTab.tsx` and `BarcodePrintDialog.tsx` with a safe dispatcher (`notify`) and console fallback logger (`[ItemMaster Notification - ERROR/SUCCESS]: ...`) to eliminate silent data integrity failures on catalog CRUD operations ("Creation Failed", "Save Failed", "Delete Failed").
  - Added explicit `aria-label` attributes to icon-only buttons across `ItemMasterTab`, `ItemMasterToolbar`, `ItemMasterContextSidebar`, `ItemMasterBatchBar`, `ItemMasterFormInspector`, and `FioriObjectPage`.
  - Added async loading states (`isSavingProduct`, `isDeletingProduct`, `isExporting`) with visual spinners and disabled button states for catalog save, delete, item creation, and batch export actions.
  - Scoped backlog tickets `IM-TICK-001` (Grid Keyboard & Clipboard Paste Support) and `IM-TICK-002` (Product Master Visual Image & Variant Thumbnail Gallery).

### Security
- Migrated JWT authentication engine from legacy `python-jose` to `PyJWT` (`pyjwt[crypto]>=2.13.0`), achieving **0 known vulnerabilities** in `pip-audit`.
- Updated FastAPI/Starlette dependencies (`fastapi>=0.115.11`, `starlette>=0.47.2`, `python-multipart>=0.0.20`).

### Fixed
- Exported `AsyncSessionLocal` in `backend/app/db/session.py` and resolved MyPy type errors across backend services.
- Enhanced `apiFetchV1` to inspect `Authorization` headers in request options prior to `localStorage` lookup, enabling clean API execution in server-side/headless test environments.
- Aligned `NAV_IDS.POS` mapping in `NavigationRegistry.ts` to `sales-billing-studio` (SWP-001 Single Workspace Principle compliance).
- Verified full test suite headlessly (131/131 test files passed, 630/630 unit tests passed).



### Added
- **SRUX-001 to SRUX-012 Responsive UX Foundation**:
  - Added the approved responsive UX constitution and linked it from repository governance.
  - Added shared responsive breakpoints, container, touch-target, dialog-margin, and density tokens.
  - Added mobile-safe shared dialog sizing and a responsive workspace-toolbar overflow menu.
  - Updated the shared workspace shell for dynamic viewport height, safe-area insets, min-width containment, and page-level horizontal overflow protection.
  - Removed the redundant outer workspace scrollbar and kept module content as the single vertical scroll owner.
  - Restricted the Layout Inspector to development builds so its debug trigger cannot overlap production content.
  - Added responsive scrollbar behavior: touch-sized viewports hide the visual scrollbar while retaining full scrolling interaction.
  - Added a shared mobile navigation drawer with backdrop dismissal and touch-safe menu controls.
  - Updated shared SEEF form tabs with 44px touch targets, mobile scrollbar hiding, and width containment.
  - Removed the empty workspace-tab strip that rendered as a black bar when no workspace tabs were open.

### Added
- Added governance artifacts for Stage 3B registration runtime, including ADR-0006 and a stage-3B registration exit-evidence document.
- Documented the Stage 3B scope boundary, lifecycle policy, compatibility policy, and deferred work.

### Modern Trade
- Added the SCDM customer `billing_policy` field with `InvoiceOnDispatch` as the backward-compatible default.
- Added additive migration `v1330_scdm_billing_policy` for configurable InvoiceOnDispatch, InvoiceOnSellOut, InvoiceWeekly, InvoiceMonthly, and Hybrid policies.
- Policy storage is now available for partner configuration; invoice-posting enforcement remains a follow-up integration step.
- SCDM dispatches now snapshot the active billing policy for audit and reconciliation without creating additional accounting entries.

## [3.39.0] — 2026-07-30

### Fixed
- **Standalone Buffer & Process Polyfill Browser Compatibility**:
  - Added `!scripts/build_buffer_polyfill.js` to `.dockerignore` ensuring Docker container build context receives polyfill generator.
  - Removed unused Node.js `pg` PostgreSQL driver import from `src/lib/helpers.ts` and unused `fs`/`path` imports from `src/state/store.ts`.
  - Added `process` object polyfill with `cwd: () => '/'`, `env: {}`, and `nextTick` stubs in `public/buffer.min.js`, `src/polyfill.ts`, and `vite.config.ts`.
  - Verified live Docker container workspace (`http://localhost:3000`) with Playwright Chromium headless runner — zero uncaught errors.

## [7.2.0] — 2026-07-30


### Added
- **SMRITI Master Publish Command v1.0 & Release Orchestrator**:
  - Implemented `scripts/master_publish.py` CLI orchestrator executing all 15 release phases automatically.
  - Automated Wiki page updates with standardized SMRITI Systems version footers.
  - Generates `docs/releases/<version>/RELEASE_COMPLETION_SUMMARY.md` certifying release readiness.
- **SMRITI Master Release Pipeline — Phase 14 GitHub Announcement Orchestration**:

  - Created `docs/governance/SMRITI_MASTER_RELEASE_PIPELINE.md` specifying the 15-phase release pipeline architecture.
  - Implemented `scripts/generate_release_announcement.py` multi-format announcement generator producing all 6 specified formats under `docs/releases/<version>/announcement/` (GitHub Release, Discussion, Org, Community Markdown, HTML, PDF) with 10 release statistics.
  - Added `.github/workflows/release-announcement.yml` GitHub Actions workflow.
  - Updated `docs/wiki/Release_Pipeline.md`, `docs/wiki/Enterprise_Release_Management.md`, and `docs/governance/RELEASE_CHECKLIST.md`.

### Fixed
- **Company Setup Onboarding State Machine (`LOCKED`)**:
  - Fixed setup wizard re-triggering with permanent HTTP 400 Bad Request lock guard.
  - Updated `get_system_config` to bypass RLS isolation on global setup lock queries.

## [7.1.0] — 2026-07-28


### Added
- **Task 6-1: AI Advisory Settings & Key Registry (CR-2026-1761, Rule AOP-001)**:
  - Created `AiAdvisoryConfigEngine` in `backend/app/core/ai_advisory_config.py`.
  - Enforces offline-first default (`AI_ENABLED=false`), RBAC gate (`AI_ADMIN`/`AI_CONFIGURATION`), and API key obscuration.
- **Task 6-2: Production & BOM Kitting Assembly Engine (CR-2026-1762)**:
  - Created `BillOfMaterialsEngine` in `backend/app/core/bom_kitting.py`.
  - Supports BOM definition, component availability audit, and atomic raw material deduction + finished good stock addition.
- **Task 6-3: Multi-Company Financial Consolidation Engine (CR-2026-1763)**:
  - Created `FinancialConsolidationEngine` in `backend/app/core/financial_consolidation.py`.
  - Consolidates Trial Balances across parent/subsidiary companies with Ind AS 110 inter-company elimination.
- **Task 6-4: Data Archival & Cold-Storage Export Engine (CR-2026-1764, AOP-004)**:
  - Created `DataArchivalEngine` in `backend/app/core/data_archival.py`.
  - Supports dry-run manifest, blocked dependency protection, and FK-safe JSON cold-storage export.
- **ADR-015: SMRITI Foundation Platform v3.0 — Sprint 1 Database Layer**:
  - Created `backend/app/models/foundation.py` — 10 Foundation Engine ORM models: `SmritiEntityRegistry`, `SmritiAddress`, `SmritiContact`, `SmritiBank`, `SmritiBankAccount`, `SmritiCommChannel`, `SmritiSetting`, `SmritiTheme`, `SmritiThemeVariant`, `SmritiBranding`, `SmritiReportTemplate`, `SmritiSocialProfile`, `SmritiAuditLog`.
  - Created `backend/app/models/company_master.py` — `Organization`, `CompanyTaxProfile`, `CompanyFinancialYear`.
  - Extended `backend/app/models/tenant.py` — Company + Branch additive columns (AOP-004).
  - Created Alembic migration `v1217_adr015_foundation_platform_v3.py` — 13 DDL groups, 20 tables created, 20+ indexes, seed data for 20 Indian banks.
  - Architecture governed by ADR-015 (Foundation Platform v3.0 FREEZE).

## [7.0.0] — 2026-07-28


### Added
- **SMRITI Engineering Intelligence Platform (SEIP v7.0)**:
  - Created `scripts/system_health.py` master CLI engine unifying SCS, CVE, AGE, AIE, GVE, and RRE engines.
  - Implemented dynamic Architecture Quality Score KPI calculation (96.9%).
  - Added trend & history tracking in `docs/architecture/ARCHITECTURE_HISTORY_LOG.json`.
  - Added automated evidence generation script `scripts/generate_architecture_report.py`.

## [6.1.0] — 2026-07-28


### Added
- **Task 5-1: GST GSTR-2B vs Purchase Register Automated Reconciliation Engine (CR-2026-1751)**:
  - Created `GstReconciliationEngine` in `backend/app/core/gstr2b_reconciler.py` for CGST Act Section 16(2)(aa) Input Tax Credit (ITC) reconciliation.
  - Added unit test suite `backend/app/tests/test_gstr2b_reconciler.py`.
- **Task 5-2: Multi-Tier Promotional Pricing & Discount Matrix Engine (CR-2026-1752)**:
  - Created `PromotionalPricingEngine` in `backend/app/core/promotional_pricing.py` for tiered volume pricing, BOGO free items, and promo code discounts.
  - Added unit test suite `backend/app/tests/test_promotional_pricing.py`.
- **Task 5-3: Customer Credit Limit & Soft/Hard Block Rule Engine (CR-2026-1753)**:
  - Created `CustomerCreditControlEngine` in `backend/app/core/customer_credit_control.py` for B2B credit risk & hard block enforcement.
  - Added unit test suite `backend/app/tests/test_customer_credit_control.py`.
- **Task 5-4: Fixed Asset Management & Depreciation Engine (CR-2026-1754)**:
  - Created `FixedAssetDepreciationEngine` in `backend/app/core/fixed_asset_depreciation.py` for SLM & WDV depreciation under Income Tax Act 1961 & Companies Act 2013.
  - Added unit test suite `backend/app/tests/test_fixed_asset_depreciation.py`.

## [6.0.1] — 2026-07-28


### Fixed
- **Immutable Audit Ledger JSON Serialization Fix**: Fixed `json.dumps` parameter in `backend/app/core/immutable_audit_ledger.py` (`default=str`).

## [6.0.0] — 2026-07-28


### Added
- **SMRITI Change Verification Engine (CVE v6.0) Architecture & 17-Step Constitution**:
  - Implemented `verify` subcommand in `scripts/smriti_change_engine.py` with "No Code Until Green" gatekeeper policy.
- **Task 4-1: Inter-Store Stock Transfer & In-Transit Reservation Engine (CR-2026-1741)**:
  - Created `StockTransferEngine` in `backend/app/core/stock_transfer.py` for multi-store movement and in-transit stock locking.
  - Added unit test suite `backend/app/tests/test_stock_transfer.py`.
- **Task 4-2: Automated GST E-WayBill Distance & Validity Calculator (CR-2026-1742)**:
  - Created `calculate_ewaybill_validity` in `backend/app/core/ewaybill_calculator.py` for NIC Rule 138(10) statutory validity calculation.
  - Added unit test suite `backend/app/tests/test_ewaybill_calculator.py`.
- **Task 4-3: Statutory Tax Audit Trail & Immutable Change Ledger (CR-2026-1743)**:
  - Created `ImmutableAuditLedger` in `backend/app/core/immutable_audit_ledger.py` for MCA Notification G.S.R. 235(E) SHA-256 hash-chained audit trail.
  - Added unit test suite `backend/app/tests/test_immutable_audit_ledger.py`.
- **Task 4-4: Multi-Currency Exchange Rate & Forex Realization Engine (CR-2026-1744)**:
  - Created `ForexGainLossCalculator` in `backend/app/core/forex_engine.py` for Ind AS 21 realized & unrealized foreign exchange gain/loss calculation.
  - Added unit test suite `backend/app/tests/test_forex_engine.py`.

## [5.7.1] — 2026-07-28


### Fixed
- **HSN & SAC Validator Compatibility Fix**: Added `is_sac` property to `HSNValidationResult` and aliased `validate_hsn_code` to `validate_hsn` in `backend/app/core/hsn_validator.py`.

## [5.7.0] — 2026-07-28


### Added
- **SMRITI Public Gateway & Ecosystem Integrations (Milestone 6)**:
  - Public API Gateway router in `backend/app/api/public/v1/gateway.py` with `verify_public_api_key` authentication and `/catalog` and `/inventory/availability` endpoints (AOP-002 & AOP-005).
  - Razorpay and Cashfree payment gateway webhook handlers in `backend/app/api/v1/webhooks.py`.
  - `ECommerceSyncPipeline` in `backend/app/services/ecommerce_sync.py` for real-time stock push and channel order processing.
  - REST endpoints for e-commerce channel sync in `backend/app/api/v1/ecommerce.py`.
  - **Task 3-4: HSN & SAC Statutory Tax Rate Validator (CR-2026-1718)**:
    - Executed Task 3-4 under SMRITI Change Studio (SCS v4.0).
    - Updated `hsn_validator.py` in `backend/app/core/` for HSN 4/6/8-digit & SAC 99-series statutory rate slab lookup.
    - Added unit test suite `backend/app/tests/test_hsn_validator.py`.
  - **Task 3-3: NPCI UPI Dynamic QR Code Generator (CR-2026-1717)**:

    - Executed Task 3-3 under SMRITI Change Studio (SCS v4.0).
    - Created `DynamicUPIQRGenerator` in `backend/app/services/upi_qr_generator.py` for NPCI UPI specification v1.6 QR string formatting.
    - Added unit test suite `backend/app/tests/test_upi_qr.py`.
  - **Task 3-2: Indian State GST Jurisdiction Registry (CR-2026-1715)**:

    - Executed Task 3-2 under SMRITI Change Studio (SCS v4.0).
    - Updated `indian_state_registry.py` in `backend/app/core/` for 38 GST state/UT code mappings and Place of Supply rules.
    - Added unit test suite `backend/app/tests/test_indian_state_registry.py`.
  - **Task 3-1: MSME Delayed Payment Interest Calculator (CR-2026-1659)**:

    - Executed Task 3-1 under SMRITI Change Studio (SCS v4.0).
    - Updated `msme_compliance.py` in `backend/app/core/` for MSMED Act Section 15 45-day payment timer and 3x RBI bank rate compound interest calculation.
    - Added unit test suite `backend/app/tests/test_msme_compliance.py`.
  - **Task 2-4: GS1 Barcode AI Scanner & Parsing Engine (CR-2026-1655)**:

    - Executed Task 2-4 under SMRITI Change Studio (SCS v4.0).
    - Updated `gs1_barcode_parser.py` in `backend/app/core/` for GS1-128 and DataMatrix 2D barcode Application Identifier (AI-01, AI-10, AI-17, AI-21) parsing.
    - Added unit test suite `backend/app/tests/test_gs1_barcode.py`.
  - **Task 2-3: Franchise Royalty & Settlement Engine (CR-2026-1653)**:

    - Executed Task 2-3 under SMRITI Change Studio (SCS v4.0).
    - Created `FranchiseRoyaltyService` in `backend/app/services/franchise_royalty.py` for store sales royalty % fee and marketing fund calculation.
    - Added unit test suite `backend/app/tests/test_franchise_royalty.py`.
  - **Task 2-2: WhatsApp & SMS Receipt Notification Gateway (CR-2026-1651)**:

    - Executed Task 2-2 under SMRITI Change Studio (SCS v4.0).
    - Created `WhatsAppGatewayService` in `backend/app/services/whatsapp_gateway.py` with WhatsApp Cloud API template rendering and E.164 phone formatting.
    - Added unit test suite `backend/app/tests/test_whatsapp_gateway.py`.
  - **Task 2-1: E-Invoice & NIC GSTN Gateway (CR-2026-1641)**:

    - Executed Task 2-1 under SMRITI Change Studio (SCS v4.0).
    - Created `NICEInvoiceGatewayService` in `backend/app/services/nic_einvoice_gateway.py` with 64-char SHA256 IRN hash computation and Schema v1.03 payload compilation.
    - Created REST API router `backend/app/api/v1/nic_gst.py`.
    - Added unit test suite `backend/app/tests/test_nic_einvoice.py`.
  - **Task 4: POS Touch UI & Thermal Print Engine (CR-2026-1637)**:

    - Executed Task 4 under SMRITI Change Studio (SCS v4.0).
    - Created `ESCPOSThermalPrinter` byte encoder in `backend/app/services/esc_pos_printer.py` for 80mm/58mm thermal receipts.
    - Created `POSTouchLayout.tsx` touch-screen quick billing interface in `frontend/src/modules/pos/`.
    - Added unit test suite `backend/app/tests/test_esc_pos.py`.
  - **Task 3: Production Deployment Infrastructure (CR-2026-1635)**:

    - Executed Task 3 under SMRITI Change Studio (SCS v4.0).
    - Created `docker-compose.prod.yml` multi-container production stack with PostgreSQL 15, FastAPI, React Workspace, and Nginx.
    - Created `deploy/nginx/nginx.conf` Nginx reverse proxy & SSL termination config.
    - Created `deploy/systemd/smriti-retail.service` Linux systemd service unit.
    - Created `scripts/deploy_prod.sh` zero-downtime deployment script.
  - **Task 2: Apparel Color / Size Variant Grid Engine (CR-2026-1632)**:

    - Executed Task 2 under SMRITI Change Studio (SCS v4.0).
    - Added `ApparelMatrixVariantModel` in `backend/app/models/apparel.py` and migration `v1216_new_table_apparelvariantgrid_apparel_matrix_grid.py`.
    - Added `ApparelMatrixService` in `backend/app/services/apparel_matrix.py` for 2D Color x Size SKU variant generation.
    - Added unit test suite `backend/app/tests/test_apparel_matrix.py`.
  - **Task 1: Pharma FEFO & Batch Expiry Tracker (CR-2026-1629)**:

    - Executed Task 1 under SMRITI Change Studio (SCS v4.0).
    - Added `PharmaBatchModel` in `backend/app/models/pharma.py` and migration `v1216_new_table_pharmabatch_pharma_batch_fefo.py`.
    - Added `PharmaFEFOService` in `backend/app/services/pharma_fefo.py` with automated FEFO batch sorting and allocation.
    - Added unit test suite `backend/app/tests/test_pharma_fefo.py`.
  - **Change Request CR-2026-1615 (Sales Executive Field)**:

    - Executed Change Request CR-2026-1615 under SMRITI Change Studio (SCS v4.0).
    - Added `sales_person_id` column to `sales_invoices` via migration `v1216_new_field_salesinvoice_sales_person_id.py`.
    - Updated ORM Model `SalesInvoice`, Pydantic Schema `SalesInvoiceBase`, and Central Field Catalog `field_registry.py`.
  - **Field Change Lifecycle (FCL) & Field Registry Studio (FRS) (ADR-014 & AOP-008)**:

    - Implemented Level 1 SMRITI Architecture Constitution Principle AOP-008 for enterprise field change management.
    - Created ADR-014 (`docs/adr/ADR-014-Field-Change-Lifecycle-And-Registry-Studio.md`).
    - Added automated 13-layer field impact analyzer tool (`scripts/fcl_impact_analyzer.py`).
  - **Performance & Latency Benchmark Suite**:

    - Added `scripts/benchmark_performance.py` automated API performance benchmarking tool (measuring Avg, Min, Max, P95, P99 latencies against enterprise SLA <100ms).
  - **Full-Stack Operational Health Check Utility**:

    - Added `scripts/health_check.py` diagnostic script for full-stack Docker, UI, and API health monitoring.
  - **Public API Gateway Router Mount**:
    - Mounted `public_gateway_router` (`/api/public/v1/*`) in `backend/app/main.py` per AOP-002 & AOP-005.
  - **Database Backup & Restore Automation**:

    - Added `scripts/backup_restore.py` CLI utility for PostgreSQL database backup, integrity verification, and point-in-time restore automation (conforming to AOP-004).
  - **Analytics & WMS Router Import Fix**:

    - Added missing `get_tenant_context` imports in `backend/app/api/v1/analytics.py` and `backend/app/api/v1/wms.py`.
  - **CRM API List Import Fix**:

    - Added missing `List` import from `typing` in `backend/app/api/v1/crm.py`.
  - **Accounting Service Import Fix**:

    - Added missing `BankAccount`, `CostCenter`, `TdsEntry`, `GstReturnLock` imports in `backend/app/services/accounting.py`.
  - **CRM Model Deduplication Refactoring**:

    - Consolidated duplicate `CustomerAddress`, `CustomerContact`, `CustomerCreditProfile`, `CustomerTaxProfile`, `CustomerChannelPreference` definitions in `backend/app/models/crm.py`.
  - Full SMRITI Retail OS Enterprise Implementation Roadmap v1.0 (Milestones 1 through 6) completed and verified.

## [5.6.0] — 2026-07-28


### Added
- **SMRITI WMS Multi-Bin Location Management (Milestone 5)**:
  - Models for `WarehouseZone`, `WarehouseBin`, and `StockBinAssignment` in `backend/app/models/wms.py`.
  - Alembic migration `v1215_wms_loyalty_expansion.py` creating `warehouse_zones`, `warehouse_bins`, `stock_bin_assignments`, `loyalty_point_transactions` tables.
  - REST endpoints for WMS Zones and Bins in `backend/app/api/v1/wms.py`.
- **SMRITI Customer Loyalty & Rewards Engine (Milestone 5)**:
  - `LoyaltyEngineService` in `backend/app/services/loyalty.py` implementing point accrual (₹100=1pt), redemption (1pt=₹1 discount), and automated tier upgrades (BRONZE, SILVER, GOLD, PLATINUM).
  - `LoyaltyTransactionModel` in `backend/app/models/loyalty.py`.
  - REST endpoints for Loyalty account, points earn, and points redeem in `backend/app/api/v1/loyalty.py`.

## [5.5.0] — 2026-07-28


### Added
- **SMRITI Accounting Expansion (Milestone 2)**:
  - Models for Bank Accounts, Cost Centers, TDS Entry tracking, and GST Return Locks in `backend/app/models/accounting.py`.
  - Alembic migration `v1213_accounting_expansion.py` creating `bank_accounts`, `cost_centers`, `tds_entries`, `gst_return_locks` tables.
  - Financial Period Lock enforcement in `post_journal()` service raising 422 HTTP error on locked dates.
  - REST endpoints for Bank Accounts, Cost Centers, TDS Entries, AP/AR Ageing Reports in `backend/app/api/v1/accounting.py`.
- **SMRITI Full CRM Pipeline & Support Desk (Milestone 3)**:
  - Models for Leads, Opportunities, Marketing Campaigns, Support Tickets, Ticket Comments, and Customer Activity Logs in `backend/app/models/crm.py`.
  - Alembic migration `v1214_crm_expansion.py` creating `crm_leads`, `crm_opportunities`, `crm_campaigns`, `crm_support_tickets`, `crm_ticket_comments`, `crm_customer_activities` tables.
  - Lead-to-Customer conversion engine in `backend/app/services/crm.py`.
  - REST endpoints for Leads, Opportunities, Campaigns, and Support Tickets in `backend/app/api/v1/crm.py`.
- **Statutory Indian GST Compliance**:
  - `GSTR3BReport` dataclass and `compile_gstr3b_report` compiler in `backend/app/services/indian_gst_reports.py`.
- **Event-Driven Core & Executive Analytics (Milestone 4)**:
  - Event listeners for stock alerts, purchase order creation, and customer credit block in `backend/app/services/event_listeners.py`.
  - Dead Letter Queue (DLQ) logger `log_event_to_dlq()`.
  - Executive Sales & Profitability Dashboard API `/analytics/dashboard/executive`.
  - Inventory Turnaround & Stock Valuation Analytics API `/analytics/inventory-turnaround`.


## [5.4.0] — 2026-07-28


### Added
- **SMRITI Database Blueprint v1.0 & Governance (ADR-012)**:
  - Created authoritative `SMRITI_DATABASE_BLUEPRINT_v1.0.md` documenting all 204 PostgreSQL tables across 46 model files.
  - Formulated `SMRITI_CANONICAL_DATA_MODEL_v1.0.md`, `TABLE_OWNERSHIP_REGISTRY.md`, and `SMRITI_TABLE_HEALTH_MATRIX_v1.0.md` (20 Tier-1 tables scored, 78% baseline average).
  - Created 5 Mermaid ERD diagrams (`ERD_core.mmd`, `ERD_accounting.mmd`, `ERD_inventory.mmd`, `ERD_sales.mmd`, `ERD_purchase.mmd`).
  - Added Alembic migration `v1211_financial_year.py` and `FinancialYear` model for GST financial period locking.
- **Repository Architecture Expansion (ADR-006)**:
  - Implemented `ProductRepository`, `StockMovementRepository`, and `WarehouseRepository` in `backend/app/repositories/inventory.py`.
  - Implemented `SupplierRepository`, `PurchaseOrderRepository`, and `PurchaseReceiptRepository` in `backend/app/repositories/purchase.py`.
  - Implemented `CustomerRepository`, `CustomerGroupRepository`, and `PricingGroupRepository` in `backend/app/repositories/crm.py`.
- **Canonical Event Bus Selection (ADR-013)**:
  - Authored `ADR-013-Canonical-Event-Bus.md` selecting transactional `SmritiEventBus` (`event_bus.py`) as the canonical event bus.
  - Deprecated legacy fire-and-forget `domain_events.py`.
  - Wired domain events `PurchaseOrderCreated` and `GRNCompleted` into `purchase.py`, and `CustomerCreated` into `crm.py`.

## [5.3.0] — 2026-07-27


### Added
- **SMRITI Global Keyboard Escape Key Remediation**:
  - Standardized window-level `Escape` key event handling across SEEF Command Palette, Context Dialogs, Bottom Sheets, Lookup Pickers, Explain Modals, and Workspace Window Engine.
- **SMRITI Fiori Multi-Theme Engine & Switcher**:
  - Integrated authentic `fiori-light` / `enterprise` theme tokens (`#ffffff` surfaces, `#f4f6f9` canvas, `#0a6ed1` Fiori Horizon Blue accents).
  - Added interactive Fiori Theme Switcher dropdown control directly in `AdaptiveWorkspaceHeader.tsx` allowing single-click switching between SAP Fiori Horizon Light, SAP Fiori Quartz Dark, and SAP Fiori Corporate Navy.
- **SMRITI Typography Audit & Auto-Remediation**:
  - Integrated SEDS Centralized Typography Scale utility classes (`.seds-text-display` through `.seds-text-error`) into `src/index.css`.
  - Replaced ad-hoc font sizes (`text-[10px]`, `text-[13px]`, `text-[15px]`) across Launchpad, Header, Sidebar, and Taskbar with standardized design tokens.
  - Achieved 100% typography scale compliance across all operational workspace components.
- **SMRITI Fiori Theme Canvas & Navigation Bar Refactoring**:
  - Replaced legacy purplish background canvas (`#1a2b5c`) with authentic SAP Fiori Quartz Dark slate navy canvas (`#1c222b`) and surface tokens (`#232a35`, `#2b3442`).
  - Standardized Contextual Sidebar active items and return button to SAP Fiori Primary Blue (`#0a6ed1`).
  - Updated Taskbar (`WorkspaceTaskbar.tsx`) launcher buttons, indicators, and window tags to `#0a6ed1` accents.
  - Aligned Launchpad outer viewport layout dimensions to 100% width and height (`w-full h-full overflow-y-auto`).
- **SAP HANA Fiori Theme Alignment & Launchpad UI Standardization**:
  - Refactored `Launchpad.tsx` to match 100% authentic SAP HANA Fiori 3 (Quartz) & Fiori Horizon Theme design specifications.
  - Converted category buttons to SAP Fiori Segmented Control buttons (`bg-theme-surface-2`, active segment `#0a6ed1` SAP Fiori Blue).
  - Replaced rainbow card borders with 8px Fiori card geometry (`rounded-lg`), subtle Fiori elevation (`shadow-xs hover:shadow-md`), and SAP Fiori blue focus borders (`hover:border-[#0a6ed1]`).
  - Added SAP Fiori Group Category Section Dividers ("Operations & POS Transactions", "Master Data & Registry Hub", "Analytics, Ledger & Reports", "Administration & System RBAC").

### Fixed
- **SMRITI Slate Navy Header & Original Theme Alignment**:
  - Aligned `AdaptiveWorkspaceHeader.tsx` header navigation bar across all application workspace modules with the authentic SMRITI Slate Navy theme (`#354a5e`).
  - Added Waffle matrix 9-dots app launcher icon, high-contrast search input, and slate blue brand badges.
- **Indian Rupee (₹) Currency Standardization**:
  - Replaced legacy dollar ($) symbols with Indian Rupee (₹) in `PrintPreviewModal.tsx` and across all spreadsheet data grid schemas.
- **SMRITI Spreadsheet Platform (SSP)**:
  - Implemented decoupled enterprise spreadsheet platform under `src/spreadsheet/` featuring `FormulaEngine.ts` (=GST, =MARGIN, =MRP, =ROUND), `ClipboardEngine.ts` (MS Excel 5,000+ row TSV/CSV parser), `ValidationEngine.ts`, `HistoryEngine.ts` (Ctrl+Z Undo / Ctrl+Y Redo), `TransactionEngine.ts` (Pending changes, Commit, Rollback), `PermissionEngine.ts`, and `AIAssistant.ts`.
  - Created Domain Data Adapters (`ItemMasterAdapter.ts`, `CustomerAdapter.ts`, `SupplierAdapter.ts`) mapping domain entities to SSP grid schemas.
  - Created universal `SmritiSpreadsheetPlatform.tsx` workspace UI component and wired into `ItemMasterTab.tsx` Live Excel Workspace tab.
  - Created Vitest test suite `smritiSpreadsheetPlatform.test.ts` (100% pass rate).
- **Barcode Print Studio & PRN Script Generator**:
  - Built `prnGenerator.ts` supporting raw TSPL and ZPL thermal printer command mapping based on Item Master products.
  - Created `BarcodePrintStudioModal.tsx` modal with live visual thermal label mockup, TSPL/ZPL language switcher, copy PRN script, and .PRN file downloader.
  - Wired Barcode Print Studio launcher into `ItemMasterTab.tsx` toolbar and batch actions.
- **SMRITI Launchpad Refactoring**:
  - Rebranded Launchpad and ContextualSidebar from legacy Fiori labels to SMRITI Launchpad (`SMRITI Launchpad v5.3`).
  - Added Luhn Modulus 36 GSTIN checksum validation in `validators.ts` and inline SVG favicon in `index.html`.
  - Disambiguated duplicate `print-studio` workspace ID collision in `layout_store.tsx`.
  - Added metadata auto-registration override in `MetadataRegistry` to support explicit component metadata enrichment.
  - Aligned prop interfaces across `ImageDisplayPolicyModal`, `ExpandedCellEditor`, `SEEFDataTable`, `SEEFSkeleton`, `SalesStudioTab`, and `CustomerMasterTab`.
  - Resolved all `tsc --noEmit` compilation warnings and ensured 100% test pass rate across all 13 Vitest test suites (69 tests).


## [5.2.2] — 2026-07-21

### Added
- **Remediation Plan Phase 3 & Phase 4 Implementation**:
  - **Phase 3 (Schema Consistency)**:
    - Aligned `VariantTemplate` Pydantic schemas (`VariantTemplateCreate`, `VariantTemplateUpdate`, `VariantTemplateResponse`) to use `Decimal` for financial attributes (`basePrice`, `baseMrp`, `gstPercentage`).
    - Configured explicit `primaryjoin="foreign(Product.variant_template_id) == VariantTemplate.id"` on `Product.variant_template` relationship for clean ORM query execution.
  - **Phase 4 (Performance & Telemetry)**:
    - Added `validate_batch` async method to `PlatformValidationEngine` for high-throughput bulk validation during multi-item POS billing and product imports.
    - Added automated unit test `test_pve_batch_validation` verifying bulk batch entity validation.
  - **Test Verification**: 55/55 tests passing across `test_sales.py`, `test_inventory.py`, `test_platform_validation_engine.py`, and `test_master_hybrid.py`.

## [5.2.1] — 2026-07-21

### Added
- **Remediation Plan Phase 1 & Phase 2 Implementation**:
  - **Phase 1 (Data Integrity)**:
    - Canonical GST recalculation in Sales Billing using `InventoryService.resolve_effective_gst_percentage(product)`.
    - Unified primary and secondary barcode uniqueness validation across `Product.barcode` and `ProductBarcode.barcode`.
    - Eager loading (`selectinload(SalesInvoice.payments)`) in sales invoice queries.
  - **Phase 2 (Tax & Transaction Validation)**:
    - Made `gst_percentage` in Product Master nullable (`Numeric(5, 2), nullable=True`).
    - Aligned GST resolution in Purchase Service with Product Master default rate.
    - Added SQLAlchemy 2.0 query compilation cache isolation (`track_closure_variables=True`) for dynamic tenant RLS filtering.

## [5.2.0] — 2026-07-21

### Added
- **SMRITI Universal Platform Validation Engine (PVE v5.2.0)**:
  - Created `backend/app/core/validation/` framework containing `schemas.py`, `rules.py`, and `engine.py`.
  - Supports 4 validation modes (`NONE`, `WARNING`, `STRICT`, `AUTO_CREATE`) and casing normalization rules (`UPPER`, `LOWER`, `TITLE`, `NONE`).
  - Implemented priority-based conditional rule evaluator (`RuleEvaluator`) resolving multi-field rule conflicts deterministically.
  - Implemented low-latency `ValidationPolicyCache` with TTL invalidation to avoid DB overhead during high-speed POS checkouts.
  - Added role-based governance guardrails (`auto_create_allowed_roles`) for `AUTO_CREATE` mode.
  - Integrated PVE into `backend/app/services/inventory.py` product creation.
  - Created policy configuration REST API endpoints (`/api/v1/validation-policies/{entity_type}`) for GET policy, PUT policy, and POST reset.
  - Created 6 unit & integration tests in `backend/app/tests/test_platform_validation_engine.py` (16/16 total suite passed).

## [5.1.0] — 2026-07-21

### Added
- **Hybrid Master Values System (`is_system`, `tenant_id`)**:
  - Implemented Alembic revision `add_hybrid_master_values` adding `is_system` (`Boolean`, default `False`) and `tenant_id` (`String(50)`, nullable `True`) to `master_values`.
  - Updated `seed_default_users` to seed standard reference values (`product_color`, `product_size`, `product_brand`, `product_category`) as system defaults (`is_system=True`, `tenant_id=NULL`).
  - Added system deletion guard (`SMRITI-VAL-020`) and system edit guard (`SMRITI-VAL-021`) returning HTTP 403 Access Denied.
  - Exposed `/lookup/{type_code}/values/{id}/toggle-active` endpoint allowing tenants to deactivate system values without deleting them.
- **Item Master Field Validation Engine & SKU Auto-Generation**:
  - Implemented `_build_sku(p)` in `backend/app/services/inventory.py` to auto-generate SKUs from `style_code`, `color`, and `size` when blank.
  - Implemented `_validate_master_field` in `backend/app/services/inventory.py` to normalize casing (`product_size` → `UPPER()`, others → Title Case) and validate input against system/tenant lookup values.
  - Returns structured HREP error `SMRITI-VAL-010` (HTTP 422) listing valid lookup options on validation failure.
- **Automated Verification Suite**:
  - Created 10-test suite in `backend/app/tests/test_master_hybrid.py` covering hybrid lookups, tenant isolation, system value protection, toggle-active, casing normalization, item validation, and SKU auto-generation (10/10 passed).

## [5.0.0] — 2026-07-20

### Added
- **Enterprise Billing Terminal Framework Refactoring (SMRITI Retail OS v5.0 Master Release)**:
  - Decoupled POS Terminal (`PosTerminalTab`) and B2B Tax Invoice Terminal (`AdvancedBillingEngine`) from the administrative Sales Studio into true standalone fullscreen layouts.
  - Implemented standalone fullscreen routing triggers in `App.tsx` utilizing `?terminal=pos` and `?terminal=tax` search parameters to bypass outer layout wrappers.
  - Created global Keyboard Override Engine React hook `useTerminalShortcuts` to capture cashier F-keys (F2, F3, F12, Esc) and suppress native browser event defaults.
  - Implemented **Salesperson & Commission Engine** in POS and Tax Invoice systems, supporting both "single salesperson per bill" and "line-level salesperson" assignment models mapped to Employee Masters.
  - Configured Logistics & Transporter details input manager (E-Way bill number, vehicle number, LR/GR numbers, payment terms) and B2B Account/Sales Managers maps.
  - Automated Statutory TCS (Tax Collected at Source) rate calculations and nearest rupee rounding.
  - Added 12 fine-grained security permissions (`billing.pos`, `billing.tax`, `billing.return`, `billing.void`, `billing.import`, `billing.recall`, `billing.discount`, `billing.override`, `billing.reprint`, `billing.salesperson.view`, `billing.salesperson.assign`, `billing.salesperson.override`) to permissions registry manifest and seeded them automatically.
  - Implemented **Hideable Navigation & UI Panels**:
    - Independent visibility state controls for top Navbar, side Navigation Sidebar, and bottom Workspace Taskbar in `layout_store.tsx`.
    - Added floating edge unhide trigger buttons (`Show Navbar`, `Show Sidebar`, `Show Bottombar`) when any panel is hidden.
    - Added global hotkeys (`Alt+Shift+N` for Navbar, `Alt+Shift+S` for Sidebar, `Alt+Shift+B` for Bottombar) and controls in the Layout Configuration dropdown.

### Fixed
- **Advanced Billing Engine & Terminal Grid Fixes**:
  - Resolved `ReferenceError: useMemo is not defined` inside `AdvancedBillingEngine.tsx` by importing `useMemo` from React.
  - Added missing `totalQty` and `totalGstTax` properties to the returned totals object in `calculateInvoiceTotals` to resolve TypeScript compilation errors in the footer of `AdvancedBillingEngine.tsx`.
  - Corrected `gst_percentage` to `gstPercentage` in `SMRITIGrid.tsx` to align with the `Product` type definition and resolve compiler errors.

---

## [3.39.0] — 2026-07-20

### Added
- **SGIP Phase 2: NIC E-Way Bill & E-Invoice Automated Integration Gateway**:
  - Stateless NIC connectors `NICEWayBillConnectorV1` and `NICEInvoiceConnectorV1` in `backend/app/compliance/connectors/nic.py`.
  - Pydantic models for E-Way Bill generation, 64-character SHA-256 IRN calculation, signed QR codes, and cancellation in `backend/app/compliance/schemas/nic.py`.
  - Background task queue processing engine `ComplianceQueueEngine` (`backend/app/compliance/services/queue_engine.py`) with exponential backoff retries and audit logging (`ComplianceAuditLog`).
  - FastAPI endpoints `/api/v1/compliance/ewaybill/generate`, `/api/v1/compliance/einvoice/generate`, and `/api/v1/compliance/queue/process`.
  - Automated test suite `backend/app/compliance/tests/test_nic_compliance_gateway.py` (4/4 passed).

---

## [3.38.0] — 2026-07-20

### Added
- **Multi-Level Approval Engine (Phase 6)**: 12 ORM entities (`backend/app/models/approval.py`), AST DSL safe evaluator (`ASTSafeEvaluator`), FSM state machine (`ApprovalFSM`), and REST API router `/api/v1/approvals`.
- **Scoped Service Account API Keys (Phase 7)**: 4 ORM entities (`backend/app/models/api_key.py`), HMAC-SHA256 secret hashing (`APIKeyService`), IP CIDR containment checks, sliding rate limiting, and REST API router `/api/v1/api-keys`.
- **Security-Aware Studio UI (Phase 8)**: React component `ApiKeyManagementSection.tsx` and updated `ApprovalMatrixTab.tsx` with real-time approval queue fetching, single-view secret copy modals, key revocation, and audit logs drawer.
- **High-Concurrency Stress Testing (Phase 9)**: Test suite `backend/app/tests/test_enterprise_stress_and_concurrency.py` verifying 50 concurrent API Key authentications, optimistic concurrency locking (`ValueError("Concurrency conflict...")`), and AST DSL performance (<0.1s over 100 evaluations).
- **Governance Release & Synchronization (Phase 10)**: Updated master implementation plan index, master walkthrough index, IPGP plans, and WGP documentation.

---

## [3.33.0] — 2026-07-20

### Added

- **Permission Sets Composition**: Renamed and migrated policy models to `SMRITIPermissionSet`, `SMRITIRolePermissionSet`, and `SMRITIPermissionSetPermission` supporting dynamic role aggregation.
- **Identity-Agnostic Platform Admin Bypass**: Extracted Platform Administrator bypass checks to a boolean database flag (`is_platform_admin`) in the `User` model, deprecating string-based SYSADMIN role checks.
- **Enterprise Access Upgrade Alembic Migrations**: Added migrations `6a5a1f89c59e` and `382862b3ec00` representing the schema changes.
- **Seeding and conftest cleanup**: Standardized database seeding routines to automatically populate roles, permissions, permission sets, and assignments on system initialize and test teardowns.

---

## [3.25.3] — 2026-07-19

### Added

- **Integration Security Tests**: Created `backend/app/tests/test_sales_pos_purchase_security.py` verifying namespaced permission rules, dynamic cashier limits, supervisor shifts, tenant & branch boundaries isolation, and SYSADMIN god mode bypass.

### Changed

- **Sales Endpoint Security Migration**: Migrated core endpoints in `sales.py` from role-based checks to namespaced permission checks (`SALES.CREATE`, `SALES.VIEW`, `SALES.UPDATE`, `SALES.DELETE`).
- **POS Endpoint Security Migration**: Migrated registers, profile configurations, and cashier checkouts in `pos.py` to dynamic checks (`SYSTEM.CONFIG`, `SALES.CREATE`, `SALES.VIEW`).
- **Purchase Endpoint Security Migration**: Refactored supplier and purchase order endpoints in `purchase.py` to require `SUPPLIER.MANAGE`, `PURCHASE.CREATE`, `PURCHASE.APPROVE`, and `PURCHASE.DELETE`.

---

## [3.25.2] — 2026-07-19

### Added

- **Integration Security Tests**: Implemented `backend/app/tests/test_crm_inventory_security.py` verifying namespaced permission rules, dynamic cashier policy checks, and SYSADMIN bypass functionality.

### Changed

- **CRM Endpoint Security Migration**: Migrated all endpoints in `crm.py` from role-based constraints to dynamic namespaced `require_permission("CRM.MANAGE_CUSTOMERS")` checks.
- **Inventory Endpoint Security Migration**: Migrated all endpoints in `inventory.py` to `require_permission` guards matching `ITEM.CREATE`, `ITEM.UPDATE`, and `ITEM.DELETE`.
- **Barcode & Attribute Security Migration**: Migrated printer configuration, label layouts, and variant definitions endpoints to namespaced permission codes (`ITEM.UPDATE`, `SYSTEM.CONFIG`, `ITEM.CREATE`).
- **HTTPException Parser Refactoring**: Patched `http_exception_handler` in `error_handlers.py` to support dictionary payload details natively, preventing crash regressions due to type mismatches.

---

## [3.25.0] — 2026-07-18 (Draft Roadmap)

### Added — SSACF Phase 2 Roadmap

- Formal implementation plan created: `docs/implementation/foundation/SSACF_Phase2_Roadmap_v3.25.0.md`
- Captures 9 sub-phases:
  - **2.1** Cache Provider Abstraction (`PermissionCacheProvider` ABC → `MemoryPermissionCache` / `RedisPermissionCache`)
  - **2.2** Frontend `usePermission()` hook and `useMenus()` hook consuming `/api/v1/security/check` and `/api/v1/security/menus`
  - **2.3** Role / Policy / Menu Administration UI
  - **2.4** Role Cycle Detection (BFS visited-set guard, validate-hierarchy API endpoint)
  - **2.5** Scoped Permissions (`OWN_DOCUMENT`, `OWN_BRANCH`, `ALL_BRANCHES`, `GLOBAL`)
  - **2.6** Field-Level Security (`smriti_field_policies` table, `/field-rules` endpoint)
  - **2.7** Workflow Approval Integration (`approval_limit`, `approval_document_states` on `SMRITIPolicyPermission`)
  - **2.8** Plugin Permission & Menu Registration Framework (manifest-driven `lifespan` hook)
  - **2.9** Legacy `UserRole` Enum Retirement (after all guards migrated to SSACF)

---

## [3.24.0] — 2026-07-18

### Added — SSACF: Security & Access Control Framework (Phase 1)

**Architecture Rating: 9.8/10 — Release Candidate quality for backend foundation.**

- `backend/app/models/security.py` — 8 new SQLAlchemy ORM models:
  - `SMRITIRole` (hierarchical, self-referencing FK)
  - `SMRITIPermission` (resource + action + scope + module)
  - `SMRITIPolicy` (reusable permission bundles)
  - `SMRITIRolePolicy` (Role ↔ Policy junction)
  - `SMRITIPolicyPermission` (Policy ↔ Permission with ALLOW/DENY tri-state)
  - `SMRITIUserRole` (User ↔ Dynamic Role mapping)
  - `SMRITIMenu` (permission-driven dynamic sidebar metadata)
  - `SMRITISecurityAudit` (configuration change audit trail)
- `backend/app/schemas/security.py` — Pydantic v2 schemas for all SSACF entities
- `backend/app/services/security.py` — `SecurityService`:
  - BFS hierarchical role traversal (`get_effective_roles`)
  - DENY-wins tri-state permission resolution (`resolve_user_permissions`)
  - Module-level in-memory permission cache with explicit invalidation
  - Permission-gated dynamic menu filter (`get_visible_menus`)
  - Security configuration audit logging (`log_security_change`)
- `backend/app/api/v1/security.py` — `/api/v1/security/*` router:
  - `GET /menus` — dynamic menus for current user
  - `POST /check` — runtime permission verification
  - `GET /permissions`, `GET /roles`, `GET /policies` — admin lookup (gated by `SECURITY.VIEW_SETTINGS`)
- `backend/app/tests/test_security_engine.py` — 3 integration tests (all passing):
  - `test_role_inheritance_resolves_all_roles`
  - `test_permissions_resolution_precedence`
  - `test_dynamic_menu_presentation_filtering`

### Modified

- `backend/app/api/deps.py` — `require_permission(code)` FastAPI dependency guard factory
- `backend/app/main.py` — registered `/api/v1/security` router
- `backend/app/models/__init__.py` — exports all 8 security models
- `backend/app/db/seed.py` — full rewrite: 13 master lookup types, 4 default dept/desig values, 5 system roles, 5 permissions, 4 menus, 3 users with dynamic SSACF role mappings
- `backend/alembic/env.py` — imports security models; 8 new table names in `include_object` whitelist
- `backend/app/tests/conftest.py` — 8 SSACF tables added to `clear_db` truncation set

### Database

- Alembic revision `8c4309461afc` — column-nullability fixes (autogenerated)
- Alembic revision `9d5410572bdf` — explicit `CREATE TABLE` for all 8 SSACF tables; confirmed at `HEAD`

---

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
