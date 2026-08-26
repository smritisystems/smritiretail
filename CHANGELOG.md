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

  * Version    : 3.62.0
  * Created    : 2026-07-11
  * Modified   : 2026-08-25
  * Copyright  : © SMRITIBooks.com. All Rights Reserved.
  * License    : Proprietary Commercial Software
  * Classification: Internal
-->

# SMRITI Retail OS — Changelog

All notable changes to SMRITI Retail OS will be documented in this file. This project adheres to Semantic Versioning.

### [3.68.0] - 2026-08-27

#### Stock Movement Ledger Safety, FEFO Batch Allocation & Historical Reconciliation Engine
- **Stock Movement Ledger API & Multi-Tenant Isolation (`backend/app/api/v1/inventory.py`, `backend/app/schemas/inventory.py`)**:
  - Implemented exact tenant (`company_id`) and branch (`branch_id`) isolation on `GET /api/v1/inventory/ledger` and canonical route alias `/api/v1/inventory/stock-movements`.
  - Added timestamp range (`from_date`, `to_date`), movement type (`movement_type`), full-text search (`search`/`q`), SKU, and reference document filters.
  - Added `branch_id` to `StockMovementResponse` schema.
- **Sales & Returns Movement Synchronization (`backend/app/services/sales.py`)**:
  - Enforced `OUTWARD_SALE` movement creation on completed sales invoices referencing canonical `sales_invoices.id` as `reference_doc_id`.
  - Emitted batch-level stock deductions respecting FEFO allocations.
  - Enforced `RETURN_INWARD` positive quantity stock movements on sales returns referencing canonical `sales_returns.id`.
  - Excluded `Draft`, `Suspended`, `Hold`, and `Cancelled` invoices as well as `No-stock` tracking mode items from movement generation.
- **Stock Movement Ledger Frontend UI Configuration (`src/components/global/ledger/configs/stockLedger.config.tsx`)**:
  - Standardized canonical movement types: `OUTWARD_SALE`, `RETURN_INWARD`, `INWARD_GRN`, `ADJUSTMENT_IN`, `ADJUSTMENT_OUT`, `TRANSFER_IN`, `TRANSFER_OUT`.
  - Fixed sign display and directional indicators based on movement direction.
- **Historical Stock Reconciliation Engine (`scripts/reconcile_historical_stock.py`)**:
  - Built headless dry-run audit tool reconciling 120 historical sales invoices (6,661 lines).
  - Enforced 5 mandatory apply guards: pre-existing dry-run report, verified disk backup, missing mappings review, stock impact review, and exact confirmation passphrase.
  - Handled 2,903 unmapped legacy item codes without creating guessed/fake products.
  - Protected database against double-deductions when opening stock balances are already adjusted.
- **Test Suite Verification (`backend/tests/test_stock_movement_ledger.py`, `backend/tests/test_stock_reconciliation.py`)**:
  - Implemented 9 automated tests with live API runtime response assertion, draft/return handling, and apply guard validations.

### [3.67.0] - 2026-08-26

#### Shoper9 Legacy Template Blueprint Integration & Sales Orders Business-First Presentation
- **Shoper9 Template Blueprint Integration (`scripts/shoper9_blueprint_parser.py`, `docs/legacy_blueprints/shoper9/`)**:
  - Headless extraction and parsing of 21 Shoper9 legacy template files (`Template.inf`, `*.Sy`, `*.Gl`, `*.Lu`, `*.Dbs`, `*.Mns`, `*.TW`) from `D:\Shoper9\Templates`.
  - Generated normalized JSON schemas: `template_manifest.json`, `retail_blueprint.json`, `distributor_blueprint.json`, `menus.json`, `parameters.json`, `general_lookups.json`, `display_layouts.json`, and `review_report.md`.
  - Quarantined 2 temporary backup dump files (`Distributor_tmp.txt`, `Retail_tmp.txt`) and documented 8 empty 0-byte template stubs.
  - Automated detection and AST pruning of duplicate SQL statements in `Distributor.Mns`.
  - Isolated 30 hardcoded Windows file paths and 26 Retail vs Distributor profile parameter variances.
  - Mapped 5 core Distributor delivery and procurement workflows (`Sales DC`, `Approval Issue DC`, `Transport Receipt Entry`, `DC Type Conversion`, and `PO Consolidation`) to canonical SMRITI Launchpad modules.
- **Sales Orders Business-First Presentation Redesign (`src/components/SalesStudioTab.tsx`, `src/components/ReportDesignerTab.tsx`)**:
  - Reorganized Sales Orders ledger into a clean 10-column commercial table with Order No, PO No, Customer, Date, Items/Qty, Order Value, Billed Value, Pending Value, and Status.
  - Restructured Order Detail side pane with Customer & PO information card, order financials summary, line items table, related invoice allocations, and expandable `Technical Details` accordion.
  - Enhanced KPI labels: `TOTAL SALES ORDER VALUE`, `Converted Orders`, and `Sales Orders` with strict 2-decimal INR currency formatting.
  - Registered 7 dedicated Sales Order report studios in `backend/app/api/v1/reports.py` and dynamic context-aware empty report notifications (`No invoices found for <date>`).

### [3.66.0] - 2026-08-26

#### Phase 1 Historical PO Reconciliation — Tattly Threads (60 Reliance Retail POs)
- **Authoritative PO Ingestion (`scripts/reconcile_historical_pos.py`)**:
  - Ingested and parsed all 60 Reliance Retail PO PDFs (`5182778151.pdf` through `5182778210.pdf`) with 100% calculation precision and zero discrepancies.
  - Created 60 historical `SalesOrder` entities (`SO-5182778151` – `SO-5182778210`) preserving original PO dates and Reliance delivery sites.
  - Inserted 18,036 `SalesOrderItem` lines totaling 25,864.000 EA ordered quantity (INR 30.22M basic / INR 31.73M grand total).
- **Item Master Product Deduplication**:
  - Deduplicated 450 unique SKUs across PO items and populated 303 newly created `Product` records in `smriti001` with 100% line linking coverage.
- **Immutable Legal Terms Snapshots**:
  - Archived 60 complete Terms & Conditions snapshots in `terms_snapshots` linked to historical Sales Orders.
- **Tax Invoice Allocation & Reconciliation**:
  - Reconciled 120 historical tax invoices (`TT2026-2027/18` through `137`) across 58 billed POs and 2 pending POs (`5182778172`, `5182778210`).
  - Recorded 120 structured invoice allocation records in `sales_order_invoice_allocations` tracking 9,027.000 EA billed (INR 10.60M) and 16,837.000 EA pending (INR 21.13M).
  - Maintained zero changes to existing tax invoices (Rule 9), zero stock movements (Rule 10), and zero new tax invoices (Rule 11).

### [3.65.0] - 2026-08-25

#### Distributor Invoicing Screen Layout & Ergonomic Refactoring (1:1 Stitch code.html Parity)
- **Top Header Bar Parity (`src/components/billing/BillingTerm.tsx`)**:
  - Refactored top navigation bar with `receipt_long` icon, "Smriti Distributor" title, live digital clock and date badges (`font-code-md`), quick action toolbar (`New [Ctrl+N]`, `Void [Ctrl+V]`, `Return [Ctrl+R]`, `Reprint [Ctrl+P]`), notifications, item settings, help dialogs, and user avatar.
- **Header Section Two-Row Card (`src/components/billing/BillingTerm.tsx`)**:
  - Standardized two-row header card with `Bill Type` (Product/Service/Both), `Transaction` (Credit/Cash/Retail), `Doc Prefix`, `Doc No.`, `Import`, `Recall`, customer search input with F2 prefix, customer display, quick customer add modal, and `Sales Staff` selector.
- **Detail Section Data Table & Direct Entry Row (`src/components/billing/BillingTerm.tsx`)**:
  - Implemented high-contrast monospace tabular rows for `S.No`, `Stock No`, `Item Description`, `Rate`, `Qty`, `Value`, `Disc Code`, `Disc Qty`, `Disc %`, `Disc Amt`, `Total`, `Sales Staff`, and inline delete actions.
  - Reorganized direct entry row (`F11`/`F1`) into the bottom docking slot with direct scanning, live item metadata preview ribbon, and quick commit button.
- **Footer Section Tabbed Details & Right Totals Grid (`src/components/billing/BillingTerm.tsx`)**:
  - Integrated 3-tab card (`Transporter Details`, `Payment Details`, `AddOns And Deductions`) with `border-t-2 border-t-primary` active tab indicator and document remarks field.
  - Formatted right `Net Values` grid for `Sales`, `Discounts`, `Sales Tax`, `Add-ons`, and `Deductions`.
- **High-Visibility Metric Status Strip (`src/components/billing/BillingTerm.tsx`)**:
  - Implemented 9-metric dark blue status container (`No. of Items`, `Total Qty.`, `Sales Value`, `Item Lvl. Discount`, `Bill Discount`, `Total Tax`, `Total Addons`, `Total Deductions`, and `Net Amount` in `#315384` with 24px bold currency display).
- **Invoice Settlement Studio Parity (`src/components/billing/InvoiceSettlementD.tsx`)**:
  - Upgraded settlement dialog with high-visibility invoice header badges, multi-tender split grid, real-time denomination counter, and high-visibility net payable banner.
- **Global ERP Keyboard Shortcuts (`src/components/billing/BillingTerm.tsx`, `InvoiceSettlementD.tsx`)**:
  - Enforced unified ERP keyboard mappings (`F2: Search Customer`, `F11: Direct Entry`, `F8: Settlement`, `F12: Suspend / Hold`, `Ctrl+N: New Invoice`, `Ctrl+V: Void Bill`, `Ctrl+R: Return / Recall`, `Ctrl+P: Reprint Invoice`, `Ctrl+I: Import PDT`).
- **Bill 136 Store & Address Synchronization (`TT2026-2027/136`)**:
  - Re-anchored Bill 136 from store `TW07` to SIS Code `S4NN/8319` with official Tumkur Distribution Center delivery address and Bangalore Richmond Road corporate billing address.
  - Re-rendered and saved canonical PDF archives (`SIS_8319_TaxInvoice_TT2026-2027_136.pdf`) across client and export repositories with updated SHA-256 verification hashes.
  - Synchronized statutory Excel ledgers and store summaries across all distribution channels.

### [3.64.0] - 2026-08-25

#### Statutory GST Tax Invoices Master Register, Footwear Size Curve Matrix & Live Multi-Sheet Excel Streaming Engine
- **Statutory GST Tax Invoices Master Register (`RPT-TAX-006`)**:
  - Integrated full statutory GST audit register covering all 120 invoices (Bills 18 to 137, including active and cancelled) in Tax & Compliance Studio.
  - Implemented 31 GST statutory attributes: Supplier/Buyer GSTINs, State Codes, Place of Supply, Reverse Charge Mechanism (RCM), PO references, E-Way Bill numbers, full multi-line billing/shipping addresses, round-offs, and English Amount in Words.
- **Article, Color & Size Sales Curve Matrix (`RPT-MRC-005`)**:
  - Created automated footwear variant parser (`<Article>-<Color>-<Size>`) binning sales distribution across Sizes 36 through 42 in Merchandise & Stock Studio.
  - Built cross-tabulation table reporting per-variant pairs sold, taxable value, IGST 5%, and gross sales.
- **Store-Wise SIS Tax Register (`RPT-OPS-006`)**:
  - Added SIS store distribution summary aggregating total invoices, completed vs cancelled counts, pairs sold, and GST revenue across all 61 SIS store locations.
- **Streaming Multi-Sheet Excel Export (`GET /api/v1/reports/export/tax-invoices-excel`)**:
  - Implemented in-memory dynamic Excel workbook generator (`openpyxl`) producing a 6-worksheet audit ledger (`Executive Summary`, `Tax Invoices Register`, `Item Level Details`, `Article & Size Matrix`, `Cancelled Invoices Audit`, `Store-Wise Summary`).
- **Frontend Reporting Studio UI (`src/components/ReportDesignerTab.tsx`)**:
  - Implemented responsive KPI summary cards, Fiori-compliant data grids, and direct 1-click Excel download action buttons.
- **Automated Test Suite (`backend/app/tests/test_reports.py`)**:
  - Added 5 new async test fixtures achieving 100% test pass rate across catalog metadata, master invoice register, size matrix calculations, store summaries, and binary stream payloads.

### [3.63.0] - 2026-08-25

#### Legacy Tally Shoper 9 Configuration Extractor, Retail Governance Policies & Tenant ETL Ingestion Engine
- **Shoper 9 Configuration & Schema Extraction Engine (`scripts/admin/sh9_cfg_extract.py`)**:
  - Built ingestion pipeline parsing 185 `.S9Q` XML schema patch files and 596 UI parameter definition files (`SP_*.INI`) from `D:\Shoper9\ini` and `D:\Shoper9\ParamDef`.
  - Extracted 78 core `SysParam` records categorized across 13 functional domains into structured JSON and Markdown catalogs (`SH9_CONFIG_CATALOG.json`, `SH9_CONFIG_SUMMARY.md`).
  - Cataloged 320 legacy database DDL tables for migration mapping.
- **Control Plane Retail Operational Policies (`backend/app/db/ctrl_seeder.py`)**:
  - Seeded 4 battle-tested retail policies into `smritisys.policy_definitions`:
    - `POLICY_BILLING_CONTROLS`: Scanning during suspended bill recall, quantity-only editing mode, unreferenced return rate alterations, strict stock checks.
    - `POLICY_BARCODE_COST_MASK`: Encoded cost price hang-tag masking dictionary (`{"0":"A", "1":"B", ... "9":"J"}`).
    - `POLICY_INWARDS_PROCUREMENT`: Automated purchase tax calculation and transporter verification.
    - `POLICY_CREDIT_MANAGEMENT`: Customer credit limits, stop-billing flags, and manager pin override policies.
- **Automated Shoper 9 Tenant Database Migrator (`scripts/admin/sh9_migrator.py`)**:
  - Developed transactional ETL ingestion pipeline migrating legacy Customers/Vendors to `UniversalPartyMaster` (`Party`, `PartyRole`, `CustomerProfile`, `SupplierProfile`), Items/Classes/Barcodes to `UniversalItemMaster` (`Item`, `ItemVariant`, `ItemBarcode`, `Product`), and Opening Stock to `StockMovement`.
  - Verified pre-flight dry-run execution against `smriti001` with `Balanced=True` ledger invariant assertion.
- **Architecture Blueprint & Governance**:
  - Published master migration blueprint `docs/architecture/SHOPER9_MIGRATION_BLUEPRINT.md`.
  - Generated WGP Walkthrough `docs/walkthrough/foundation/Shoper9_Migration_Architecture_And_ETL_Engine_v1.0.0.md`.
  - Updated `docs/walkthrough/README.md` master index.

### [3.62.0] - 2026-08-25

#### Sprint 46: Section 13 Production Readiness & Final Frozen Blueprint Certification
- **Clean-Slate Tenant Provisioning & Ephemeral Migration Harness**:
  - Validated ephemeral clean-slate tenant provisioning (`EphemeralTenantHarness` in `backend/tests/t_tenant_migr.py`) executing full Alembic migrations up to canonical head `v1375_backfill_sales_return_cust`.
  - Verified strict forward-only migration lock, complete statutory Chart of Accounts seeding, and multi-currency FX table presence.
- **Tenant Security & Dynamic Connection Routing**:
  - Validated multi-tenant database connection routing (`backend/tests/t_tenant_sec.py`), LRU session pool management, `X-Company-ID` / `X-Database-ID` tenant header security, and fail-closed 403 access denials.
- **Production Certification 29-Check Matrix**:
  - Verified 29-check automated production readiness harness (`backend/tests/t_prod_cert.py` passing 29/29) covering schema integrity, registry resolution, tenant isolation, LRU eviction, transactional outbox atomicity, crash recovery, DLQ retries, replay idempotency, eCom reservation concurrency, PSV toggles, blue/green workflow, reconciliation parity, GST E-Invoice/E-Way bill generation, and end-to-end domain transaction guarantees.
- **Master Platform Regression Battery**:
  - Successfully executed master test battery across all 13 Blueprint Sections: `226/226 tests passed (100% green)`.
  - Validated TypeScript static analysis (`npx tsc --noEmit` passing with 0 errors).
  - Validated naming governance (`scripts/smriti_naming_guard.py` passing with 0 violations).
- **Authoritative Table Ownership Matrix & Runtime Write Audit**:
  - Published complete Table Ownership Matrix separating Control Plane (`smritisys`) and Tenant Data Planes (`smritiXXX`).
  - Marked **SMRITI Enterprise Business Operating Platform Architecture Frozen Blueprint v1.0** as 100% **Completed & Verified** in `docs/architecture/BLUEPRINT_PENDING.md`.
- **Governance**:
  - Generated WGP Walkthrough `docs/walkthrough/foundation/Sprint46_Production_Readiness_Certification_v1.0.0.md`.
  - Updated `docs/walkthrough/README.md` master index.

### [3.61.0] - 2026-08-25

#### Sprint 45: Section 11 & 12 Analytics Plane + Compliance Gateways & Regulatory Audit Plane
- **Analytics & Intelligence Plane (Section 11)**:
  - Verified and hardened tenant-isolated daily sales fact materialization (`AnalyticsDailySalesFact` table in `smriti001`, `smriti002`).
  - Validated read-only transactional aggregation (`AnalyticalIntelligenceService`) computing net sales, tax collections, tender splits (Cash, Digital, Credit), COGS, and gross margin percentages without transactional lock contention.
  - Implemented multi-tenant aggregation daemon (`AnalyticsDaemonService`) with PostgreSQL session-level advisory lock concurrency guards (`ADVISORY_LOCK_KEY = 918273645`) preventing concurrent duplicate worker executions across multi-replica deployments.
  - Verified windowed multi-day category profitability rollups and analytics REST API endpoints (`/api/v1/analytics/*`).
- **Integration Hub, Compliance Gateways & Regulatory Audit Plane (Section 12)**:
  - Validated append-only immutable regulatory audit logging (`ComplianceAuditService`) with SHA-256 tamper-detection digest calculation over state transitions, actors, and payloads.
  - Verified TallyPrime XML integration service (`TallyIntegrationService`) generating balanced double-entry accounting and sales voucher XML envelopes.
  - Verified statutory compliance gateways (`EWayBillService`, `GstGatewayService`) and compliance connector registry / credential vault (`backend/app/compliance/`).
- **Verification & Governance**:
  - Full Section 11 & 12 combined test suite (`t_analytics_hub.py`, `t_daemon_rollup.py`, `t_eway_dispatch.py`, `t_golive_audit.py`, `test_compliance_fou.py`) passing 23/23 tests green (100% green) in 17.60s.
  - Fully certified Blueprint Sections 11 and 12 in `docs/architecture/BLUEPRINT_PENDING.md` per Rule 11 with quantitative metrics and named mechanisms.
  - Created WGP Walkthrough `docs/walkthrough/foundation/Sprint45_Analytics_Compliance_Integration_v1.0.0.md` and updated `docs/walkthrough/README.md`.
  - Passed SMRITI Naming Guard (0 violations).

### [3.60.0] - 2026-08-25

#### Sprint 44: Section 10 P2 Offline-First Foundation & Transactional Outbox Event Architecture
- **Offline-First Synchronization & 5-Tier Conflict Resolution**:
  - Validated and hardened `OfflineConflictResolutionEngine` and `OfflineSyncService` across PostgreSQL tenant databases (`smriti001`, `smriti002`) with durable edge terminal queueing (`POSOfflineSyncQueue`).
  - Enforced 5-tier domain conflict resolution: inventory oversell with configurable `allow_negative_stock` warnings, customer credit limit boundary verification, price book drift with 100% price-at-sale preservation and diagnostic logging, and immutable governance rule version snapshot binding (`SalesInvoice.governance_snapshot_id`).
  - Implemented Store Manager Reconciliation Queue quarantine via `/api/v1/sync/reconciliation-queue` isolating unresolved transaction drifts (`NEEDS_REVIEW`).
  - Validated multi-terminal concurrent conflict resolution via `asyncio.gather` across 5 simultaneous sessions and 20-cycle rolling load testing (`backend/tests/t_soak_conflict.py`).
- **Transactional Outbox & Event Processing Architecture**:
  - Certified atomic transactional outbox event insertion (`IntegrationOutboxEvent`) within domain business database transactions, completely eliminating dual-write hazards.
  - Validated two-phase non-blocking batch claim and dispatch algorithm in `UnifiedOutboxAnalyticsService` with claim expiry timeout and exponential backoff retry scheduling.
  - Verified Dead-Letter Queue (`DLQ`) transitions after 5 consecutive dispatch failures.
  - Verified multi-tenant asynchronous worker polling cycles in `OutboxQueueWorker` across all tenant databases.
- **Verification & Governance**:
  - Full Section 10 test suite (`t_conflict_res.py`, `t_outbox_stats.py`, `t_soak_conflict.py`) passing 19/19 tests green (100% green) in 31.43s.
  - Fully certified Blueprint Section 10 in `docs/architecture/BLUEPRINT_PENDING.md` per Rule 11 with quantitative metrics and named mechanisms.
  - Created WGP Walkthrough `docs/walkthrough/foundation/Sprint44_Offline_Sync_Outbox_v1.0.0.md` and updated `docs/walkthrough/README.md`.
  - Passed SMRITI Naming Guard (0 violations).

### [3.59.0] - 2026-08-25

#### Sprint 43: Section 9 P2 PSV, CGE, and PDT Unification Completion
- **Projected Stock Visibility (PSV)**:
  - Implemented `backend/app/services/psv_projection.py` and created `backend/app/schemas/psv.py` with non-authoritative projection event ingestion, party-scoped visibility filters, and idempotency deduplication on source event ULID (`source_event_id`).
  - Added strict multi-tenant and distributor visibility policy rules (`psv_visibility_policies`, `psv_party_scopes`) constraining access by SKU pattern regex, branch allowances, and maximum lookback days.
  - Guaranteed zero transactional stock mutation (PSV ledger writes strictly to `psv_stock_events` and `psv_stock_balances` without modifying `products.stock` or `stock_movements`).
- **Commercial Growth Engine (CGE) Unified Policies**:
  - Implemented `backend/app/services/cge_unified_svc.py` and created `backend/app/schemas/cge_unified.py` unifying loyalty, referral, tier, and commission rules under versioned `CGEUnifiedPolicy` records.
  - Implemented multi-vector anti-abuse evaluation checking for self-referral fraud (matching emails, phones, user IDs), minimum order values, and daily velocity points accrual caps.
  - Implemented cascading refund compensation engine executing atomic clawbacks of earned loyalty points on `LoyaltyMember.current_points_balance` and salesperson commissions on `CommissionLedger`.
- **Predictive Distribution Twin (PDT)**:
  - Implemented `backend/app/services/pdt_engine.py` and created `backend/app/schemas/pdt.py` with model version registration (`PDTModelRegistry`), external demand signal capture (`PDTDemandSignal`), SKU twin velocity simulation cache (`PDTSkuTwinCache`), and read-only replenishment predictions (`PDTDistributionPrediction`).
  - Enforced 100% strict read-only transactional isolation and multi-factor explainability scoring (factor weights for velocity, seasonal trends, and macro demand signals).
- **REST Endpoints (`/api/v1/psv/*`, `/api/v1/cge-unified/*`, `/api/v1/pdt/*`)**:
  - Provisioned and mounted routers in `backend/app/api/v1/psv.py`, `backend/app/api/v1/cge_unified.py`, and `backend/app/api/v1/pdt.py`, mounted under `/api/v1/` in `backend/app/main.py`.
- **Verification & Governance**:
  - Added integration test suites `backend/tests/t_psv_scope.py` (4/4 tests green), `backend/tests/t_pdt_engine.py` (4/4 tests green), and `backend/tests/t_cge_unified.py` (3/3 tests green).
  - All 11 tests in Section 9 suite passing 100% green.
  - Certified Blueprint Section 9 (`P2 PSV, CGE, and PDT Unification`) as `Done / Verified` per Rule 11.
  - Created WGP Walkthrough `docs/walkthrough/foundation/Sprint43_PSV_CGE_PDT_Unification_v1.0.0.md`, updated master index, and passed SMRITI Naming Guard (0 violations).

### [3.58.0] - 2026-08-25

#### Sprint 42: Section 8 P2 Distribution Core & eCommerce Expansion Completion
- **Authoritative Multi-Tier Wholesale Distribution**:
  - Implemented `backend/app/services/distribution_svc.py` and created `backend/app/schemas/distribution.py` providing end-to-end governance for dealer assignments with credit limit/days enforcement, delivery route provisioning with ordered drop sequences, primary vs secondary distribution orders with statutory GST place-of-supply calculation, vehicle loading sheet consolidation, dealer claims dispute review with automatic Credit Note generation (`CN-YYYYMMDD-HEX`), and driver route trip financial/inventory settlement.
  - Provisioned multi-tenant database DDL across `smriti001` and `smriti002` for `distribution_routes`, `distribution_route_stops`, `loading_sheets`, `loading_sheet_items`, `distribution_claims`, and `distribution_settlements`.
- **Omnichannel eCommerce Growth Engine**:
  - Implemented `backend/app/services/ecom_engine.py` and created `backend/app/schemas/ecom.py` featuring 6 marketplace connector adapters (`Internal Store`, `Shopify`, `WooCommerce`, `Amazon SP-API`, `Flipkart`, `Customer Portal`).
  - Added strict HMAC SHA-256 signature verification across all adapters to prevent webhook forgery.
  - Implemented deterministic order deduplication via idempotency keys (`{channel_code}_{external_order_id}`).
  - Implemented atomic stock reservation utilizing `SELECT FOR UPDATE` row locks (`with_for_update()`) on `Product.reserved_stock` ensuring zero oversell rate.
  - Implemented order convergence transforming imported marketplace payloads into authoritative SMRITI `SalesInvoice` records and outward `StockMovement` rows with automatic trigger reconciliation.
  - Implemented Dead Letter Queue (DLQ) retry cycle with exponential backoff (`max_retries = 3`) and channel revenue financial reconciliation against external GMV reports.
- **REST Endpoints (`/api/v1/distribution/*`, `/api/v1/ecom/*`)**:
  - Mounted routes, stops, loading sheets, claims, and settlements in `backend/app/api/v1/distribution.py`.
  - Mounted channels, SKU mappings, webhook ingress, order convergence, DLQ retry, and reconciliations in `backend/app/api/v1/ecom.py` and registered under `/api/v1/ecom` in `backend/app/main.py`.
- **Verification & Governance**:
  - Added integration test suites `backend/tests/t_distribution.py` (7/7 tests green) and `backend/tests/t_ecom_connect.py` (7/7 tests green).
  - All 23 tests in Section 8 distribution and eCommerce suite passing 100% green.
  - Certified Blueprint Section 8 (`P2 Distribution & eCommerce Expansion`) as `Done / Verified` per Rule 11.
  - Updated WGP Walkthrough index and passed SMRITI Naming Guard (0 violations).

### [3.57.0] - 2026-08-25

#### Sprint 41: Section 7 Shared Business Engines: CRM / Commercial Growth Engine (CGE) Completion
- **Authoritative CRM & Commercial Growth Engine (CGE)**:
  - Implemented `backend/app/services/crm_engine.py` and created `backend/app/schemas/crm_cge.py` providing end-to-end governance for lead pipelines, deal opportunities, customer RFM value segmentation, immutable multi-tier loyalty points ledgers, salesperson and driver commission calculation rules, and referral reward credits.
  - Implemented Lead & Opportunity pipeline management with unique sequence generation (`LED-YYYYMMDD-HEX`, `OPP-YYYYMMDD-HEX`), stage progression (`NEW`, `CONTACTED`, `QUALIFIED`, `PROPOSAL`, `WON`, `LOST`), and revenue forecasting.
  - Implemented Customer RFM value segmentation algorithmically evaluating recency (days), frequency (order count), and monetary (lifetime gross spend) into 5 distinct customer tiers (`VIP`, `FREQUENT`, `NEW`, `AT_RISK`, `DORMANT`).
  - Implemented Authoritative Loyalty Points Ledger engine supporting points earning, burning, bonus, and reversal with fail-closed non-negative balance protection.
  - Implemented Universal Commission & Incentive calculation engine supporting salesperson percentage rates (2%), fixed delivery driver payouts (₹50.00), and custom partner tiers with immutable postings to `CommissionLedger`.
  - Implemented Referral Relationship & Reward engine with code attribution and qualifying purchase order reward credits in `ReferralReward`.
- **REST Endpoints (`/api/v1/crm-growth/*`)**:
  - Mounted `/leads`, `/leads/{id}`, `/opportunities`, `/customers/{id}/segmentation`, `/loyalty/enroll-member`, `/loyalty/adjust-points`, `/loyalty/members/{id}/ledger`, `/commissions/calculate`, `/referrals/enroll`, and `/referrals/credit-reward` in `backend/app/api/v1/crm_cge.py` and registered in `backend/app/main.py`.
- **Database Layer**:
  - Synchronized `crm_leads`, `crm_opportunities`, `crm_campaigns`, and `crm_customer_activities` schemas across tenant databases `smriti001` and `smriti002`.
- **Verification & Governance**:
  - Added integration test suite `backend/tests/t_crm_cge.py` (6/6 tests green, 129/129 full platform regression tests green).
  - Certified Blueprint Section 7 (`CRM / CGE Completion`) as `Done / Verified` per Rule 11.
  - Updated WGP Walkthrough index and passed SMRITI Naming Guard (0 violations).

### [3.56.0] - 2026-08-25

#### Sprint 40: Section 7 Shared Business Engines: Communicator Engine Completion
- **Authoritative Multi-Channel Communicator Engine & Regulatory Compliance Guard**:
  - Implemented `backend/app/services/communicator_engine.py` and created `backend/app/schemas/communicator.py` providing unified multi-channel messaging (WhatsApp, SMS, Email, Push) with mustache variable interpolation, TRAI regulatory quiet hours & DLT compliance, multi-channel fallback cascading, high-throughput batch dispatch, and inbound delivery receipts.
  - Implemented 4 standardized provider adapters (`WhatsAppMockAdapter`, `SmsMockAdapter`, `EmailMockAdapter`, `PushMockAdapter`) with normalized responses.
  - Implemented TRAI regulatory quiet hours policy guard (`is_in_quiet_hours`) strictly blocking promotional notifications between 21:00 and 09:00 IST while permitting transactional and OTP traffic.
  - Implemented automated multi-channel fallback cascading (e.g., auto-routing from failed WhatsApp to SMS) with comprehensive delivery audit logging in PostgreSQL `CommunicatorLog`.
  - Implemented inbound webhook receiver processing delivery receipt callbacks (`DELIVERED`, `READ`, `FAILED`, `BOUNCED`).
- **REST Endpoints (`/api/v1/communicator/*`)**:
  - Mounted `/send`, `/send/batch`, `/templates` (GET & POST), `/templates/{id}` (PUT), `/logs`, `/webhook/{provider}`, and `/providers` in `backend/app/api/v1/communicator.py` and registered in `backend/app/main.py`.
- **Verification & Governance**:
  - Added integration test suite `backend/tests/t_communicator.py` (6/6 tests green, 123/123 full platform regression tests green).
  - Certified Blueprint Section 7 (`Communicator Engine Completion`) as `Done / Verified` per Rule 11.
  - Updated WGP Walkthrough index and passed SMRITI Naming Guard (0 violations).

### [3.55.0] - 2026-08-25

#### Sprint 39: Section 7 Shared Business Engines: Universal Search Engine Completion
- **Authoritative Universal Search Engine & 4-Tier POS Barcode Resolver**:
  - Implemented `backend/app/services/search_engine.py` and created `backend/app/schemas/search.py` providing unified omni-search discovery across Items, Parties, Barcodes, Documents, Warehouses, and Transactions with 4-tier barcode scanner resolution and strict role-based domain filtering.
  - Implemented fast 4-tier POS barcode scanner resolution across exact Barcodes (`ItemBarcode`), Variant SKUs (`ItemVariant`), Item Codes (`Item`), and fail-safe handling with full item master metadata and tax rates.
  - Implemented multi-domain omni-search aggregation combining entity matching across Item Master, Universal Parties (Customers, Suppliers, Transporters), Documents (Sales Invoices, Purchase Orders, Dispatches, Approval Requests), Warehouses, and Payment Transactions.
  - Implemented fail-closed RBAC domain filtering restricting Cashiers from sensitive transaction/financial/party domains while granting full visibility to Store Managers and Sysadmins.
- **REST Endpoints (`/api/v1/search/*`)**:
  - Mounted `/universal` (POST & GET), `/barcode-scan`, and `/domains` in `backend/app/api/v1/search.py` and registered in `backend/app/main.py`.
- **Verification & Governance**:
  - Added integration test suite `backend/tests/t_search.py` (6/6 tests green, 117/117 full platform regression tests green).
  - Certified Blueprint Section 7 (`Universal Search Engine Completion`) as `Done / Verified` per Rule 11.
  - Updated WGP Walkthrough index and passed SMRITI Naming Guard (0 violations).

### [3.54.0] - 2026-08-25

#### Sprint 38: Section 7 Shared Business Engines: Approval Matrix Engine Completion
- **Authoritative Approval Matrix Service & Hierarchical Transaction Gating**:
  - Implemented `backend/app/services/approval_engine.py` and created `backend/app/schemas/approval.py` governing multi-tier threshold policies, real-time transaction gating, fail-closed RBAC decision execution, and request escalation.
  - Implemented multi-tier threshold policies (`ApprovalPolicy`) mapping document types (`SALES_INVOICE`, `PURCHASE_ORDER`, `CREDIT_MEMO`, `DISCOUNT_EXCEPTION`, `MANUAL_JOURNAL`) and monetary amounts to required roles (`STORE_MANAGER`, `FINANCE_CONTROLLER`, `DIRECTOR`, `SYSADMIN`).
  - Implemented real-time transaction enforcement checks gating high-value documents and unapproved discount exceptions into pending `ApprovalRequest` state machine rows (`APR-YYYYMMDD-HEX`).
  - Implemented strict RBAC action authorization (`APPROVE`, `REJECT`, `REQUEST_CHANGES`) rejecting unauthorized callers and logging decision records in PostgreSQL `ApprovalAction`.
  - Implemented hierarchical request escalation reassigning pending approval workflows to senior roles.
- **REST Endpoints (`/api/v1/approval/*`)**:
  - Mounted `/policies`, `/enforce`, `/requests`, `/action`, and `/escalate` in `backend/app/api/v1/approval.py` and registered in `backend/app/main.py`.
- **Verification & Governance**:
  - Added integration test suite `backend/tests/t_approval.py` (6/6 tests green, 111/111 full platform regression tests green).
  - Certified Blueprint Section 7 (`Approval Matrix Engine Completion`) as `Done / Verified` per Rule 11.
  - Updated WGP Walkthrough index and passed SMRITI Naming Guard (0 violations).

### [3.53.0] - 2026-08-25

#### Sprint 37: Section 7 Shared Business Engines: Barcode & Labels Engine Completion
- **Authoritative Barcode & Labels Engine Service & Thermal Hardware Compilation**:
  - Implemented `backend/app/services/barcodes_engine.py` and created `backend/app/schemas/barcodes.py` providing symbology validation, Modulo 10 check digit algorithms, native printer byte stream compilation, and print history auditing.
  - Implemented GS1 Modulo 10 check digit calculation and validation for EAN-13 and UPC-A barcodes, plus alphanumeric formatting for CODE128, CODE39, ITF14, and QR codes.
  - Implemented multi-DPI thermal label compilation generating Zebra ZPL-II (`^XA...^XZ`), TSC TSPL (`SIZE...PRINT`), and ESC/POS command byte streams scaling across 203, 300, and 600 DPI.
  - Implemented multi-item batch label print spooling with PostgreSQL `PrintHistory` audit ledger tracking.
- **REST Endpoints (`/api/v1/barcodes/*`)**:
  - Mounted `/generate`, `/validate`, `/compile`, `/print/batch`, and `/history` in `backend/app/api/v1/barcodes.py` and registered in `backend/app/main.py`.
- **Verification & Governance**:
  - Added integration test suite `backend/tests/t_barcodes.py` (6/6 tests green, 105/105 full platform regression tests green).
  - Certified Blueprint Section 7 (`Barcode and Labels Engine Completion`) as `Done / Verified` per Rule 11.
  - Updated WGP Walkthrough index and passed SMRITI Naming Guard (0 violations).

### [3.52.0] - 2026-08-25

#### Sprint 36: Section 7 Shared Business Engines: Fulfillment Engine Completion
- **Authoritative Fulfillment Engine Service & Logistics Dispatching**:
  - Implemented `backend/app/services/fulfillment_engine.py` and created `backend/app/schemas/fulfillment.py` managing pick & pack slips, dispatch manifests, live AWB tracking, driver commission settlements, reverse logistics, and aggregated fulfillment timelines.
  - Implemented pick & pack slip generation (`PackingSlip`, `PackingSlipItem`) tracking package counts, weight in kg, packer identity, and item quantities.
  - Implemented dispatch manifesting (`Dispatch`, `DispatchItem`) with courier partner assignment (Delhivery, BlueDart, In-House Fleet), AWB tracking, delivery fees, and driver commissions.
  - Implemented milestone delivery state transitions (`DISPATCHED` -> `IN_TRANSIT` -> `OUT_FOR_DELIVERY` -> `DELIVERED`), recording delivery timestamps and automatically settling driver commissions (`DeliveryCommissionSettlement`).
  - Implemented reverse logistics return processing (`ReverseLogisticsReturn`) with restock categorization and commission clawback flags.
  - Implemented chronological fulfillment lifecycle timeline aggregation (`get_fulfillment_timeline`).
- **REST Endpoints (`/api/v1/fulfillment/*`)**:
  - Mounted `/pack`, `/pack/{packing_slip_id}`, `/dispatch`, `/delivery/status`, `/tracking/{tracking_number}`, `/returns`, and `/timeline/{invoice_id}` in `backend/app/api/v1/fulfillment.py` and registered in `backend/app/main.py`.
- **Verification & Governance**:
  - Added integration test suite `backend/tests/t_fulfillment.py` (6/6 tests green, 99/99 full platform regression tests green).
  - Certified Blueprint Section 7 (`Fulfillment Engine Completion`) as `Done / Verified` per Rule 11.
  - Updated WGP Walkthrough index and passed SMRITI Naming Guard (0 violations).

### [3.51.0] - 2026-08-25

#### Sprint 35: Section 7 Shared Business Engines: Documents Engine Completion
- **Authoritative Documents Engine Service & Lifecycle State Machine**:
  - Implemented `backend/app/services/documents_engine.py` and created `backend/app/schemas/documents.py` managing gapless sequential numbering, layout templates, rendering, print dispatch, and lifecycle state machines.
  - Implemented atomic sequence number allocation with row-level locks (`SELECT ... FOR UPDATE`) guaranteeing gapless statutory numbering continuity.
  - Implemented versioned layout template management with SHA256 configuration hashing and frozen versions (`V1`).
  - Implemented dynamic document rendering and persisted immutable `InvoiceDocumentArtifact` records with SHA256 integrity verification.
  - Implemented print job dispatch with reprint tracking and statutory legal watermarks ("ORIGINAL FOR RECIPIENT", "DUPLICATE COPY (REPRINT #N)").
  - Implemented governed document lifecycle state transition validator enforcing valid workflow graph paths.
- **REST Endpoints (`/api/v1/documents/*`)**:
  - Mounted `/numbering/series`, `/numbering/allocate`, `/templates`, `/render`, `/print`, and `/lifecycle` in `backend/app/api/v1/documents.py` and registered in `backend/app/main.py`.
- **Verification & Governance**:
  - Added integration test suite `backend/tests/t_documents.py` (6/6 tests green, 93/93 full platform regression tests green).
  - Certified Blueprint Section 7 (`Documents Engine Completion`) as `Done / Verified` per Rule 11.
  - Updated WGP Walkthrough index and passed SMRITI Naming Guard (0 violations).

### [3.50.0] - 2026-08-25

#### Sprint 34: Section 7 Shared Business Engines: Payments Engine Completion
- **Authoritative Payments Engine Service & Multi-Tender Settlement**:
  - Implemented `backend/app/services/payments_engine.py` and created `backend/app/schemas/payments.py` supporting 9 tender methods (`CASH`, `CARD`, `UPI`, `NETBANKING`, `WALLET`, `CREDIT_NOTE`, `CHEQUE`, `LOYALTY_POINTS`, `BANK_TRANSFER`).
  - Implemented strict idempotency key deduplication returning existing payment records upon repeated submissions and preventing double settlement.
  - Implemented full and partial refund processing with over-refund protection, tracking remaining balances, and auditing refund reason codes.
  - Implemented dynamic multi-invoice payment balance allocation across invoice debts.
  - Implemented structured payment receipt generation aggregating tender lines and allocation records.
- **REST Endpoints (`/api/v1/payments/*`)**:
  - Mounted `/process`, `/refund`, `/{payment_id}/allocate`, `/receipt/{reference_doc_id}`, and `/transactions` in `backend/app/api/v1/payments.py` and registered in `backend/app/main.py`.
- **Verification & Governance**:
  - Added integration test suite `backend/tests/t_payments.py` (6/6 tests green, 87/87 full platform regression tests green).
  - Certified Blueprint Section 7 (`Payments Engine Completion`) as `Done / Verified` per Rule 11.
  - Updated WGP Walkthrough index and passed SMRITI Naming Guard (0 violations).

### [3.49.0] - 2026-08-25

#### Sprint 33: Section 7 Shared Business Engines: Promotions Engine Completion
- **Authoritative Promotions Engine Service & Stacking Policy Engine**:
  - Implemented `backend/app/services/promotions_engine.py` and created `backend/app/schemas/promotions.py` providing rich discount and offer mechanics: Percentage discounts, Flat fixed discounts, Buy-X-Get-Y (BOGO/BXGY), Buy-X-at-Price, and Combo bundle pricing.
  - Implemented conflict resolution and stacking policies: `EXCLUSIVE_OVERRIDE` (exclusive promotions suppress all others), `BEST_BENEFIT` (maximizes customer savings), and multi-campaign stacking bounded by `max_stacked_discount_percent` safety caps.
  - Enforced single-use and multi-use coupon code lifecycle and rate limiting, rejecting expired or limit-exhausted coupons.
  - Implemented immutable redemption ledger logging (`PromotionRedemption`) with campaign snapshot auditing.
- **REST Endpoints (`/api/v1/promotions/*`)**:
  - Mounted `/campaigns`, `/campaigns/{campaign_id}/rules`, `/coupons`, `/evaluate`, and `/redeem` in `backend/app/api/v1/promotions.py` and registered in `backend/app/main.py`.
- **Verification & Governance**:
  - Added integration test suite `backend/tests/t_promotions.py` (6/6 tests green, 81/81 full platform regression tests green).
  - Certified Blueprint Section 7 (`Promotions Engine Completion`) as `Done / Verified` per Rule 11.
  - Updated WGP Walkthrough index and passed SMRITI Naming Guard (0 violations).

### [3.48.0] - 2026-08-25

#### Sprint 32: Section 7 Shared Business Engines: Pricing Engine Completion
- **Authoritative Pricing Engine Service & Hierarchical Resolution**:
  - Upgraded `backend/app/services/pricing_engine.py` and created `backend/app/schemas/pricing.py` establishing 6-tier hierarchical price resolution (Volume Breaks -> Customer Price Tiers -> Variant Master -> Item Master -> Product Master).
  - Implemented date validity gating (`valid_from` to `valid_to`) preventing expired price lists from altering active transactions.
  - Implemented `calculate_bulk_pricing` for multi-line cart/order calculation and `generate_pricing_snapshot` for capturing frozen calculation snapshots with zero-drift historical replay.
- **REST Endpoints (`/api/v1/pricing/*`)**:
  - Mounted `/books`, `/books/{book_id}/entries`, `/tiers`, `/resolve`, `/resolve/bulk`, and `/snapshot` in `backend/app/api/v1/pricing.py` and registered in `backend/app/main.py`.
- **Verification & Governance**:
  - Added integration test suite `backend/tests/t_pricing_engine.py` (6/6 tests green, 75/75 full platform regression tests green).
  - Certified Blueprint Section 7 (`Pricing Engine Completion`) as `Done / Verified` per Rule 11.
  - Updated WGP Walkthrough index and passed SMRITI Naming Guard (0 violations).

### [3.47.0] - 2026-08-25

#### Sprint 31: P1.3 Authoritative Stock and Accounting Boundaries (Data Plane Convergence)
- **Authoritative Stock Movement & Double-Entry Ledger Service Engine**:
  - Created `backend/app/services/stock_acct_svc.py` and `backend/app/schemas/stock_acct.py` establishing immutable stock movement journaling across 10 movement types, on-hand balance rebuilds from movement logs, and strict fail-closed double-entry balance validation (`Total Debits == Total Credits`).
  - Implemented automated multi-ledger audit engines: `run_stock_reconciliation` (stock drift detection), `run_gl_reconciliation` (trial balance equality and voucher integrity), and `run_financial_reconciliation`.
- **REST Endpoints (`/api/v1/boundaries/*`)**:
  - Mounted `/stock-movements`, `/stock/rebuild`, `/gl/post`, `/reconcile/stock`, `/reconcile/gl`, and `/reconcile/financial` in `backend/app/api/v1/boundaries.py` and registered in `backend/app/main.py`.
- **Verification & Governance**:
  - Added integration test suite `backend/tests/t_stock_acct.py` (6/6 tests green, 69/69 full platform regression tests green).
  - Certified Blueprint Section 6.3 (`P1.3 Authoritative Stock and Accounting Boundaries`) as `Done / Verified` per Rule 11.
  - Updated WGP Walkthrough index and passed SMRITI Naming Guard (0 violations).

### [3.46.0] - 2026-08-25

#### Sprint 30: P1.2 Universal Item Master Completion (Data Plane Convergence)
- **Universal Item Master Database Models & Sub-Entities**:
  - Extended `backend/app/models/item_master.py` with `ItemBatch` (batch/lot tracking with expiration and batch-level MRPs), `ItemSerial` (serialized unit tracking with status lifecycle), and `ItemWarehouseLocation` (warehouse-specific bins and min/max reorder levels).
  - Executed migration script `backend/app/db/migr_item_ext.py` migrating tenant databases `smriti001` and `smriti002`.
- **Schemas & Service Engine**:
  - Created `backend/app/schemas/item_master.py` and `backend/app/services/item_master_svc.py` providing atomic item and variant provisioning, Cartesian matrix variant generator (Size x Color dimensions with automated unique EAN-13 barcodes), fast 4-tier scanner resolver (`Barcode -> Variant SKU -> Item Code -> Serial Number`), batch/serial managers, and legacy product projection adapters.
- **REST Endpoints (`/api/v1/universal/items`)**:
  - Mounted `/items`, `/items/{item_id}`, `/items/{item_id}/variants/matrix`, `/items/{item_id}/batches`, `/items/{item_id}/serials`, `/items/resolve`, and `/items/{item_id}/adapter/product` in `backend/app/api/v1/universal_master.py`.
- **Verification & Governance**:
  - Added integration test suite `backend/tests/t_item_master.py` (6/6 tests green, 63/63 platform regression tests green).
  - Certified Blueprint Section 6.2 (`P1.2 Universal Item Master completion`) as `Done / Verified` per Rule 11.
  - Updated WGP Walkthrough index and passed SMRITI Naming Guard (0 violations).

### [3.45.0] - 2026-08-25

#### Sprint 29: P1.1 Universal Party Master Completion (Data Plane Convergence)
- **Universal Party Master Database Models & DDL**:
  - Extended `Party` in `backend/app/models/party.py` with `merged_into_party_id` and sub-entity relationship models: `PartyAddress` (multi-address store), `PartyContact` (multi-contact store), `CustomerProfile`, `SupplierProfile`, and `PartyRelationship`.
  - Executed migration script `backend/app/db/migr_party_ext.py` migrating tenant databases `smriti001` and `smriti002`.
- **Schemas & Service Engine**:
  - Created `backend/app/schemas/party_master.py` and `backend/app/services/party_master_svc.py` providing atomic party provisioning across 7 polymorphic roles (`CUSTOMER`, `SUPPLIER`, `DEALER`, `DISTRIBUTOR`, `SALESMAN`, `TRANSPORTER`, `EMPLOYEE`), multi-tier deduplication (GSTIN -> Phone -> Email -> Code), audit-preserving merge policy, and legacy customer/supplier projection adapters.
- **REST Endpoints (`/api/v1/universal/parties`)**:
  - Mounted `/parties`, `/parties/{party_id}`, `/parties/{party_id}/roles`, `/parties/merge`, and `/adapter/*` in `backend/app/api/v1/universal_master.py`.
- **Verification & Governance**:
  - Added integration test suite `backend/tests/t_party_master.py` (6/6 tests green, 57/57 regression tests green).
  - Certified Blueprint Section 6.1 (`P1.1 Universal Party Master completion`) as `Done / Verified` per Rule 11.
  - Updated WGP Walkthrough index and passed SMRITI Naming Guard (0 violations).

### [3.44.0] - 2026-08-25

#### Sprint 28: P1.5 Transaction Reproducibility & Historical Replay Engine (Governed Logic)
- **Transaction Version Anchoring & Schemas**:
  - Added Pydantic schemas in `backend/app/schemas/tx_reproduce.py` for `GovernanceSnapshot`, `SnapshotCreateRequest`, `LedgerEntryReplay`, `TransactionReplayRequest`, and `TransactionReplayResponse`.
  - Enhanced `TransactionReproducibilityService` in `backend/app/services/tx_reproduce_svc.py` to capture complete 6-part version snapshots (`formula_versions`, `rule_versions`, `policy_versions`, `pricing_version`, `accounting_rule_version`, `doc_template_version`).
  - Built historical recalculation replay engine executing exact snapshot-anchored rules from `smritisys` with balanced double-entry accounting ledger generation (Debit Cash/Debtors == Credit Revenue + Output Taxes) and automated drift detection.
- **REST Endpoints Exposed (`/api/v1/governed-logic/`)**:
  - Mounted `/snapshot/create` and `/replay` in `backend/app/api/v1/governed_logic.py`.
- **Verification & Governance**:
  - Added integration test suite `backend/tests/t_tx_reproduce.py` (7/7 tests green, 51/51 regression tests green).
  - Verified 0.00% calculation drift between historical invoices and catalog rule updates.
  - Certified Blueprint Section 5.2 (`P1.5 Transaction Reproducibility`) as `Done / Verified` per Rule 11.
  - Updated WGP Walkthrough index and passed SMRITI Naming Guard (0 violations).

### [3.43.0] - 2026-08-25

#### Sprint 27: P1.4 Formula, Rule, Policy, and Workflow Engines (Governed Logic)
- **Governed Logic Schemas & Service Engines**:
  - Added Pydantic schemas in `backend/app/schemas/gov_logic.py` for `FormulaDefinitionResponse`, `FormulaEvalRequest`, `FormulaEvalResponse`, `BusinessRuleResponse`, `BusinessRuleEvalRequest`, `BusinessRuleEvalResponse`, `PolicyDefinitionResponse`, `GstTaxPolicyEvalRequest`, `WorkflowDefinitionResponse`, `WorkflowTransitionRequest`, `WorkflowTransitionResponse`, and `DefinitionValidationResponse`.
  - Enhanced `GovernedRuleEngine` in `backend/app/services/governed_rules.py` with pure AST formula interpretation (zero arbitrary code execution, Decimal math), multi-clause declarative condition trees, statutory multi-line GST intrastate/interstate place of supply tax engine, and RBAC-enforced workflow state machine transitions.
- **REST Endpoints Exposed (`/api/v1/governed-logic/`)**:
  - Mounted `/formulas`, `/formulas/evaluate`, `/rules`, `/rules/evaluate`, `/policies`, `/policies/gst/evaluate`, `/workflows`, `/workflows/transition`, and `/validate` in `backend/app/api/v1/governed_logic.py`.
- **Master Data Seeding**:
  - Seeded canonical formulas (`FORM_GST_INTR_SPLIT`, `FORM_LINE_DISCOUNT_NET`, `FORM_LOYALTY_ACCRUAL`, `FORM_STAFF_COMMISSION`, `FORM_ROUNDING_NEAREST`), business rules, statutory GST policies, and purchase order/sales return workflows in `smritisys` via `backend/app/db/seed_gov_logic.py`.
- **Verification & Governance**:
  - Added integration test suite `backend/tests/t_gov_logic.py` (9/9 tests green, 44/44 regression tests green).
  - Certified Blueprint Section 5.1 (`P1.4 Formula, Rule, Policy, and Workflow Engines`) as `Done / Verified` per Rule 11.
  - Updated WGP Walkthrough index and passed SMRITI Naming Guard (0 violations).

### [3.42.0] - 2026-08-25

#### Sprint 26: P1.3 Workspace, Menu, and UI Experience Registry (Control Plane)
- **Control Plane Workspace & UI Experience Schemas**:
  - Added Pydantic schemas in `backend/app/schemas/ui_registry.py` for `WorkspaceTemplateResponse`, `WorkspaceResolutionResponse`, `ResolvedNavNode`, `DesignTokensResponse`, `FieldMetadataItem`, `ActionMetadataItem`, and `CompleteScreenPackageResponse`.
  - Implemented `WorkspaceUIRegistryService` in `backend/app/services/workspace_ui_svc.py` providing dynamic workspace layout resolution, capability-aware and role-gated navigation tree generation from `smriti_menus` with recursive parent pruning, and CSS design token generation.
- **REST Endpoints Exposed (`/api/v1/ui/`)**:
  - Mounted `/templates`, `/workspaces/resolve`, `/navigation/resolved`, `/themes/tokens`, and `/screens/{screen_code}/complete` in `backend/app/api/v1/workspace_ui.py` and registered in `backend/app/main.py`.
- **Master Data Seeding**:
  - Seeded 6 workspace templates, 4 persona profiles, 3 standard themes with visual variants, and 4 core screen definition packages in `smritisys` via `backend/app/db/seed_ui_master.py`.
- **Verification & Governance**:
  - Added test suite `backend/tests/t_workspace_ui.py` (8/8 tests green, 35/35 regression tests green).
  - Certified Blueprint Section 4.3 (`P1.3 Workspace, Menu, and UI Experience Registry`) as `Done / Verified` per Rule 11.
  - Updated WGP Walkthrough index and passed SMRITI Naming Guard (0 violations).

### [3.41.0] - 2026-08-25

#### Sprint 25: P1.2 Capability & Module Registry (Control Plane)
- **Control Plane Capability Catalog & Schemas**:
  - Added Pydantic schemas in `backend/app/schemas/capabilities.py` for `PlatformCapabilityResponse`, `CapabilityValidationRequest`, `CapabilityValidationResponse`, `PlanTierResponse`, `PlanResolutionRequest`, `TenantEffectiveCapabilitiesResponse`, `TenantCapabilityBindingResponse`, `TenantCapabilityToggleRequest`, `FeatureFlagResponse`, and `ModuleStateResponse`.
  - Added `ModuleState` and `ModuleAuditLog` models in `backend/app/models/capability_template.py`.
  - Enhanced `CapabilityService` in `backend/app/services/capability_service.py` with async database-backed methods for platform capability DAG resolution, tenant capability toggling with fail-closed dependency checks, feature flag evaluations with company-level overrides, and module lifecycle state tracking.
- **REST Endpoints Exposed (`/api/v1/capabilities/`)**:
  - Mounted `/catalog`, `/plans`, `/validate` (POST), `/resolve` (POST), `/tenant`, `/tenant/toggle` (POST), `/feature-flags`, `/feature-flags/{key}/toggle` (POST), and `/modules`.
- **Master Data Seeding**:
  - Seeded all 32 platform capabilities with dependency DAGs, 3 subscription plan tiers, 5 platform feature flags, and 7 system module states across `smritisys`, `smriti001`, and `smriti002` via `backend/app/db/seed_cap_master.py`.
- **Verification & Governance**:
  - Added test suite `backend/tests/t_cap_registry.py` (8/8 tests green, 27/27 regression tests passing).
  - Certified Blueprint Section 4.2 (`P1.2 Capability and Module Registry`) as `Done / Verified` per Rule 11.
  - Updated WGP Walkthrough index and passed SMRITI Naming Guard (0 violations).

### [3.40.0] - 2026-08-25

#### Sprint 24: P1.1 Control Plane Reference Data & Global Localization Engine
- **Control Plane Registries & Master Schemas**:
  - Added Pydantic models in `backend/app/schemas/localization.py` for `CountryResponse`, `StateResponse`, `CurrencyResponse`, `UOMResponse`, `UOMConversionResponse`, `TaxReferenceResponse`, `HsnSacCodeResponse`, `LanguageResponse`, `LocaleResponse`, `TranslationDictionaryResponse`, and `PlatformReferenceResponse`.
  - Implemented `GlobalReferenceService` in `backend/app/services/localization_svc.py` providing fast master lookup for ISO countries, Indian states with statutory GST codes, currencies, UOMs, tax slabs, and HSN/SAC codes.
  - Implemented `LocalizationDictionaryService` with multi-lingual dictionary resolution for English, Hindi (`hi`), and Marathi (`mr`) featuring automated fallback to English for missing or unapproved keys.
  - Built locale-aware number formatters supporting both Indian numbering system (Lakh/Crore: `₹ 12,34,567.89`) and International system (Million/Billion: `$ 1,234,567.89`).
- **REST Endpoints Exposed (`/api/v1/control/reference/`)**:
  - Mounted `/countries`, `/states`, `/states/by-gst-code/{code}`, `/currencies`, `/uoms`, `/uoms/convert` (POST), `/tax-references`, `/hsn-sac`, `/languages`, `/locales`, `/translations/{code}`, `/platform/{category}`, and `/format/currency` (POST).
- **Master Data Seeding**:
  - Seeded all 36 Indian states and union territories with official GST 2-digit codes (`01` through `38`, `97`).
  - Seeded 7 global currencies, 10 statutory UOMs with GST UQC codes, 4 bidirectional UOM conversion ratios, 6 statutory GST tax slabs, retail HSN codes, and initial multi-lingual translation dictionaries across `smritisys`, `smriti001`, and `smriti002`.
- **Verification & Governance**:
  - Added test suite `backend/tests/t_ctrl_ref.py` (10/10 tests green).
  - Certified Blueprint Section 4.1 (`P1.1 Global Reference Data and Localization`) as `Done / Verified` per Rule 11.
  - Updated WGP Walkthrough index and passed SMRITI Naming Guard (0 violations).

### [3.39.0] - 2026-08-25

#### Sprint 23: Reports Portal Gap Closure (Shoper9 Sales & Audit Report Parity)
- **Backend API & Response Models**:
  - Implemented 4 new endpoints in `backend/app/api/v1/reports.py`: `/bill-wise-items`, `/discount-summary`, `/item-wise-returns`, `/attribute-size-sales`.
  - Added Pydantic schemas in `backend/app/schemas/reports.py`: `BillWiseItemsReport`, `DiscountSummaryReport`, `ItemWiseReturnsReport`, `AttributeSizeSalesReport`.
  - Implemented async aggregator methods in `backend/app/services/reports.py` with multi-table joins, tenant isolation, and date-range filtering.
  - Refactored `bill_wise_sales`, `item_wise_sales`, and `tax_register` with eager loading (`selectinload`) and clean mathematical aggregations.
- **Database Schema Migration**:
  - Executed Alembic migrations `v1371` through `v1375_backfill_sales_return_cust` across `smriti001`, `smriti002`, and `smritisys`.
- **Frontend BI Center UI (`ReportDesignerTab.tsx`)**:
  - Wired live `apiFetchV1` calls in `loadReportsData()` across all 9 Shoper9 sales/audit reports.
  - Built interactive, high-contrast data table components with KPI summary stat banners.
  - Connected `GlobalExportService` to export live loaded lines into XLSX, CSV, or TXT.
- **Automated Test Suite**:
  - Created `backend/tests/t_reports_parity.py` (9/9 integration tests passed).
- **Parity Governance**:
  - Updated `docs/legacy/shoper/SH9_PARITY_GAPS.md`: MnuNo 410 parity score elevated from 6/15 to 14/15 VERIFIED.

### [3.27.0] - 2026-08-24

#### Shoper9 â†’ SMRITI Legacy Menu Migration â€” Sprints 0â€“5 Complete

Full end-to-end implementation of the Shoper9 (EE) vaMenu â†’ SMRITI workspace
migration stack. Covers extraction, classification, database, API, and frontend.

**Sprint 0 â€” Legacy Extraction (commits: f7384642, b7c877bc, 17e67f2b)**
- `scripts/sh9_extract.py` v2: S9Q parser with INSERT + DELETE handling,
  ZIP-vs-disk source conflict resolution (ZIP takes priority).
- 7 governance CSVs produced (immutable): `SH9_MENU_CATALOG.csv` (265 active),
  `SH9_MENU_TREE.csv`, `SH9_MENU_EXEC.csv` (177 executables),
  `SH9_TXN_TYPES.csv` (63 codes), `SH9_SYSPARAM.csv`, `SH9_MENU_DELETES.csv`
  (18 ghost entries), `SH9_USERS.csv`.
- `.gitignore` updated: `!docs/legacy/**/*.csv` unignored.

**Sprint 1 â€” Mapping Matrix (commit: 03423dec)**
- `scripts/sh9_map.py`: classifies all 265 entries against `CANONICAL_34_MENU_MATRIX`.
- `SH9_MAP_MATRIX.csv` + `SH9_MENU_MAP.md` produced.
- Coverage: **265/265 (100%)** â€” MAPPED:201, MERGED:27, PENDING:8,
  DEPRECATED:14, REPLACED:10, NOT_APPLIC:5.
- Key findings: 8 MultiInstance entries need multi-tab session support;
  9 SMRITI-new capabilities have no Shoper predecessor.

**Sprint 2 â€” Database Schema (commit: cf0788a6)**
- `backend/app/models/legacy_menu_map.py`: `LegacyMenuMap` SQLAlchemy model.
- `backend/alembic/versions/v1371_legacy_menu_map.py`: Alembic migration.
  Creates `smriti_legacy_menu_map` (29 columns, 2 CHECK constraints, 4 indexes).
  Revision chain: v1370 â†’ v1371. Idempotent upgrade.
- `scripts/sh9_seed.py`: idempotent INSERT-or-UPDATE seed script.
  Dry-run validated: 265 rows parsed, 0 errors.
- `backend/app/models/__init__.py`: registered `LegacyMenuMap`.

**Sprint 3 â€” API Layer (commit: 957ae753)**
- `backend/app/api/v1/legacy_menu_map.py`: 5 read-only GET endpoints.
  - `GET /api/v1/legacy-menu-map/stats` (MANAGER+)
  - `GET /api/v1/legacy-menu-map/` (paginated, filterable)
  - `GET /api/v1/legacy-menu-map/{id}`
  - `GET /api/v1/legacy-menu-map/sh9/{mnu_no}/{menu_opt}`
  - `GET /api/v1/legacy-menu-map/by-workspace/{smriti_menu_id}`
- `backend/app/schemas/legacy_menu_map.py`: Pydantic read-only schemas.
- Write path blocked at API level; seed-only governance.
- OpenAPI: 5/5 endpoints confirmed.

**Sprint 4 â€” Frontend Dashboard (commit: 670c966d)**
- `src/components/LegacyMigDashTab.tsx`: React migration dashboard.
  - Overview: arc-gauge (coverage %), 6 status chips (clickable â†’ browse),
    module bar chart, multi-instance alert, source info card.
  - Browse: paginated table, search, status filter pills, pagination.
- `src/App.tsx`: route `case 'legacy-migration'` registered.
- `src/components/shell/AppShell.tsx`: `'legacy-migration'` in system nav group.

**Sprint 5 â€” Launchpad Tile (commit: 2589fb83)**
- `src/components/launchpad/launchpadCatalog.ts` v4.2.0:
  Tile `legacy-migration` added â€” title "Shoper9 â†’ SMRITI Migration",
  group "System & Operations", roles: [MANAGER, SYSADMIN], accentColor: violet.

**Sprint 7 â€” Migration Bugfix & Live DB Seed (commit: 29e6d569)**
- `v1371_legacy_menu_map.py`: fixed `down_revision` mismatch.
  Root cause: v1370's `revision = "v1370_tcb_status"` (short form)
  but v1371 referenced `"v1370_tenant_capability_binding_status"` (filename stem).
  Caused `KeyError` in Alembic revision map on `alembic current` and `upgrade head`.
- `alembic upgrade head` applied successfully:
  `Running upgrade v1370_tcb_status -> v1371_legacy_menu_map`.
- `alembic current` post-upgrade: `v1371_legacy_menu_map (head)`.
- `sh9_seed.py` live run â€” literal output:
  `Inserted: 265 / Updated: 0 / Errors: 0 / Total: 265/265`.
- DB verification (live Postgres, `information_schema.columns`):
  30 columns confirmed, 265 rows total.
  Status: MAPPED=201, MERGED=27, DEPRECATED=14, REPLACED=10, PENDING=8, NOT_APPLIC=5.
  Multi-instance (`sh9_multi_inst=1`): 4 entries.
- Pushed: `d57844b6..29e6d569 smritiNX -> smritiNX`.

**Governance:**
- NGP naming guard: 0 violations across all 7 sprints.
- WGP walkthrough: `docs/walkthrough/foundation/Legacy_Shoper9_SMRITI_Migration_v1.0.0.md`.
- Deployment guide: `docs/implementation/foundation/Legacy_Migration_Deploy_v1.0.0.md`.
- DB seeded in live Postgres: **Done** â€” 265 rows, 0 errors.
- Walkthrough index: **Done** (updated from Partially Verified).

### [3.26.0] - 2026-08-24


#### Blueprint v1.0 â€” UI/Experience Engine & Integration Hub: Migrations Applied, Seeded, Verified

- **Migrations executed:** `alembic upgrade head` applied `v1368_ui_experience_engine` and `v1369_integration_hub_registry` against smritisys. `alembic current` confirms `v1369_integration_hub_registry (head)`. 11 new tables created in smritisys Control Plane database.
- **Seeder extended â€” Phase 9 (`ctrl_seeder.py`):**
  - `seed_layout_definitions()` â€” 6 canonical layout templates (FULL_WIDTH, SIDEBAR_LEFT, SPLIT, DETAIL, DASHBOARD, WIZARD_STEPS).
  - `seed_screen_definitions()` â€” 5 top business flow screens: POS Billing Terminal, Sales Invoice List, Purchase Order List, Inventory Dashboard, Party Master List. Each carries `layout_config`, `capability_code`, `route_path`, and `icon_key` linkages.
  - `seed_action_definitions()` â€” 18 toolbar and row actions across all 5 screens. Action types: NAVIGATE, API_CALL, DOWNLOAD, PRINT, WORKFLOW_TRANSITION. Role-gated and capability-gated per Blueprint Rule 09.
  - All seed methods are idempotent (`SELECT to_regclass()` guard + duplicate key skip).
- **Database row counts (verified by literal terminal query output):** `icon_registry`: 36, `provider_registry`: 6, `layout_definitions`: 6, `screen_definitions`: 5, `action_definitions`: 18. Total: 71 rows seeded in 8 smritisys tables.
- **alembic `env.py` updated:** 11 new table names added to `include_object` filter; `ScreenDefinition`, `FieldDefinition`, `ActionDefinition`, `LayoutDefinition`, `IconRegistry`, `ProviderRegistry`, `ConnectorRegistry`, `IntegrationRegistry`, `IntegrationCredentialReference`, `IntegrationPolicy`, `IntegrationVersion` models registered for autogenerate correctness.
- **Architecture tracker:** UI/Experience Engine (Â§11) promoted from **Partial** â†’ **Verified**. Integration Hub Connector Registry (Â§45) promoted from **Partial** â†’ **Verified**. Milestone 6 appended to `SMRITI_PLATFORM_IMPLEMENTATION_STATUS.md`.

### [3.25.0] - 2026-08-24

#### Blueprint v1.0 â€” UI/Experience Engine Schema & Integration Hub Registry
- **Blueprint ss54 Rules Cross-Check (2026-08-24)**: All 25 architecture rules verified against source code and migration chain. 25-rule adherence table added to `SMRITI_PLATFORM_IMPLEMENTATION_STATUS.md`.
- **UI/Experience Engine smritisys schema (`v1368_ui_experience_engine.py`)**: Created 5 smritisys-resident tables: `screen_definitions`, `field_definitions`, `action_definitions`, `layout_definitions`, `icon_registry`. Closes Blueprint ss11 named gap.
- **Integration Hub Connector Registry smritisys schema (`v1369_integration_hub_registry.py`)**: Created 6 smritisys-resident tables: `integration_registry`, `connector_registry`, `provider_registry`, `integration_credentials_reference`, `integration_policies`, `integration_versions`. Closes Blueprint ss45 named gap.
- **SQLAlchemy models**: `ui_control_plane.py` extended with `ScreenDefinition`, `FieldDefinition`, `ActionDefinition`, `LayoutDefinition`, `IconRegistry`. New `integration_hub.py` with `ProviderRegistry`, `ConnectorRegistry`, `IntegrationRegistry`, `IntegrationCredentialReference`, `IntegrationPolicy`, `IntegrationVersion`.
- **Control Plane Seeder**: Added `seed_icon_registry()` (35 platform icons, Material Symbols Outlined) and `seed_integration_providers()` (6 providers: GSTN, NIC E-Way Bill, TallyPrime, Shopify, WooCommerce, Twilio) to `ControlPlaneSeeder.seed_all()`.
- **API**: `ui_control_plane.py` extended with 4 new Control Plane read endpoints (`GET /ui/screens`, `/ui/fields`, `/ui/actions`, `/ui/icons`). `integration.py` extended with 3 Integration Hub registry endpoints (`GET /integration/hub/providers`, `/hub/connectors`, `/hub/integrations`).
- **Architecture tracker**: Added Milestone 5, Blueprint ss54 rules table (25 rows), and two new gap rows to `SMRITI_PLATFORM_IMPLEMENTATION_STATUS.md`.

### [3.23.0] - 2026-08-23

#### Enterprise Blueprint Delivery â€” Sections 11 & 12 (Analytics & Intelligence Plane, Integration Hub & Compliance Audit)
- **Analytics & Intelligence Plane (`v1367`, `analytics.py`, `analytics_svc.py`)**:
  - Implemented `analytics_daily_sales_facts` downstream aggregate table to decouple analytical metric calculations from core transactional tables.
  - Implemented `AnalyticalIntelligenceService` computing invoice counts, total revenue, tax totals, payment mode breakdowns (cash, digital, credit), estimated COGS, and gross margin percentages.
  - Added category-level profitability rollups and sales velocity endpoints under `/api/v1/analytics/*`.
- **TallyPrime Integration Hub (`tally_service.py`, `integration.py`)**:
  - Implemented native TallyPrime XML voucher generator for B2B/B2C Sales Invoices and Double-Entry General Ledger Journal Vouchers.
  - Enforces standard Tally XML DTD envelopes (`ENVELOPE -> HEADER -> BODY -> IMPORTDATA -> REQUESTDATA -> TALLYMESSAGE -> VOUCHER`) with exact ledger and inventory allocations.
- **Compliance & Immutable Regulatory Audit Engine (`audit.py`, `compliance_audit.py`)**:
  - Implemented `compliance_immutable_audit_logs` storing append-only regulatory audit records.
  - Integrated deterministic cryptographic SHA-256 payload checksums for mathematical tamper-evidence detection.
  - Added audit search and verification endpoints under `/api/v1/integration/audit/*`.
- **Test Harness and Migration Verification**:
  - Expanded master regression suite to 87 tests (100% pass across all 13 suites in 91.06s).
  - Verified clean-slate ephemeral tenant database harness on `v1367` migration head.

### [3.22.0] - 2026-08-23

#### Enterprise Blueprint Delivery â€” Sections 9 & 10 (PSV, CGE, PDT, and Durable Offline Sync Queue)
- **Durable Tenant-Local Offline Sync Queue (`v1366`, `sync.py`, `offline_sync_svc.py`)**:
  - Implemented `pos_offline_sync_queue` table in all tenant databases via forward-only migration `v1366_cge_pdt_offline_sync.py`.
  - Upgraded `/api/v1/sync/push` and `/api/v1/cge/*` routes to route through `get_company_db`, ensuring offline transactions and CGE records are persisted authoritatively in tenant-isolated databases.
  - Implemented durable ingestion state machine (`PENDING` -> `COMMITTED` / `ALREADY_PROCESSED` / `FAILED`) with automatic exception capture and retry counting.
- **Commercial Growth Engine (CGE) Enhancements (`commercial_growth.py`, `cge.py`)**:
  - Implemented multi-tier loyalty progression, lifetime spend tracking, points accrual multiplier calculation, and coupon validation caps.
  - Added referral reward ledger and universal salesperson/agent commission posting.
- **Predictive Distribution Twin (PDT) Core (`pdt_analytics.py`)**:
  - Implemented deterministic PostgreSQL transactional running velocity, days-of-stock-cover projections, and reorder point simulations derived from `stock_movements`.
  - Enriched analytics payload with model version metadata (`v1.0.0-deterministic-sql`), data freshness tracking, dynamic confidence scores, and formula explainability.
- **Partner Stock Visibility (PSV) Integration (`psv_projection.py`)**:
  - Implemented partner stock projection service, audit events, and ledger balances across vendor and franchise nodes.
- **Test Harness and Migration Verification**:
  - Expanded master regression suite to 79 tests (100% pass across all 12 suites).
  - Verified clean-slate ephemeral tenant database harness on `v1366` migration head.

### [6.16.0] - 2026-08-23

#### ProPOS & Accounting â€” Physical Denominations, Mid-Shift Cash Movements, Concurrency & Multi-Tenant Routing Hardening
- **Company Multi-Tenant Database Routing (`pos.py`)**:
  - Replaced control-plane `get_db` session dependency with `get_company_db` across all operational endpoints (`/registers/`, `/pos/shifts/open`, `/pos/shifts/close/{id}`, `/pos/shifts/{id}/cash-in`, `/pos/shifts/{id}/cash-drop`, `/pos/shifts/{id}/till-expense`, `/pos/shifts/{id}/z-report`, `/pos/checkout`).
- **PostgreSQL Row-Level Locking & Concurrency Control (`pos.py`, `services/pos.py`)**:
  - Wired `.with_for_update()` on shift queries during open, close, cash movements, and checkout to eliminate race conditions between checkout and closing.
- **Database-Enforced Invariants (`v1346_pos_cash_denominations.py`)**:
  - Added partial unique index `uq_shifts_active_per_register` preventing concurrent open shifts on the same register at the database engine level.
  - Added unique index `uq_sct_idempotency` enforcing physical uniqueness of client idempotency keys across shift cash movements.
- **Client Idempotency Deduplication**:
  - Added client nonce / `idempotency_key` deduplication on cash in, cash drop, till expense, and shift close requests.
- **Role-Based Access Control (RBAC)**:
  - Guarded operational endpoints with explicit `require_role(UserRole.CASHIER, UserRole.MANAGER, UserRole.SYSADMIN)`.
- **Chart of Accounts Validation**:
  - Verified account active status, company ownership, and ledger categories (Asset vs Expense) before posting balancing Journal Vouchers.
- **Verification & Test Coverage**:
  - 14/14 automated test suites in `backend/tests/t_pos_drawer.py` passed in 32.03s.
  - `npm run lint` and `npm run build` passed with zero errors.

#### Warehouse & Logistics â€” WMS Phase 4: Physical Inventory Audit, Stock Discrepancy Reconciliation & Barcode Batch Counting
- **Stock Audit Domain & Baseline Snapshotting Engine (`stock_audit_service.py`, `inventory.py`)**:
  - Implemented `StockAudit` and `StockAuditItem` models in PostgreSQL (`smriti001` and `smritisys`) with scoped unique indexes.
  - Snapshotting engine captures baseline on-hand batch quantities (`system_qty`), ensuring mathematical variance stability during counts without locking godown operations.
- **Rapid Barcode Scanner Batch Counting (`POST /wms/audits/{id}/scan`)**:
  - Auto-resolves scanned barcodes / SKUs to product batch lines and increments physical count (+1.0 or custom quantity) in real time.
  - Automatically identifies unlisted items in warehouse and adds them as surplus lines (`SURPLUS_FOUND`).
- **Variance Analysis & Statutory Loss Attribution**:
  - Dynamic computation of `variance_qty = counted_qty - system_qty` and `variance_value`.
  - Attribution reasons: `DAMAGED`, `EXPIRED`, `THEFT_LOSS`, `SURPLUS_FOUND`, `COUNTING_ERROR`.
- **Atomic Ledger Reconciliation & Product Cache Sync**:
  - Finalizing audit mutates `ProductBatchStock` quantities, generates audit ledger records in `StockMovement` (`OUTWARD_LOSS` / `INWARD_SURPLUS`), and resynchronizes aggregate `products.stock`.
- **WMS Studio UI Workstation (`WmsStudioTab.tsx`)**:
  - First-class "Stock Audit & Recon" sub-tab featuring godown audit creation, real-time barcode scanner input, color-coded variance grid, KPI cards, and 1-click ledger reconciliation.
- **Verification & Test Coverage**:
  - Added automated test suite `t_wms_phase4.py` (4 tests) and live HTTP smoke test `smoke_test_wms_phase4.py` (7 steps). Full 19/19 multi-module pytest suite passed in 9.14s.

#### Security & Access Control â€” Security Management: Menu Access Control & Security Configuration
- **Menu Access Control Workspace (`MenuAccessControlV.tsx`)**:
  - Unified User / Group / Node selector with browsing and company-wise scoping.
  - Multi-level hierarchical expandable menu tree over existing `smriti_menus` PostgreSQL table.
  - Fine-grained action operations matrix (`NEW`, `VOID`, `RETURN`, `VOID RETURN`, `ADD`, `EDIT`, `DELETE`, `VIEW`).
- **Security Configuration Workspace (`SecurityConfigView.tsx`)**:
  - 2-pane category inspector for Password Configuration (min/max length, uppercase, lowercase, numeric counts, history count, reset days, max invalid attempts) and Housekeeping policies (log retention days, country code, patch reminder, company-wise menu activation toggle, custom reports count, refresh interval).
- **Backend Security Authority (`security.py`, `deps.py`)**:
  - Endpoints `/api/v1/security/menu-access` and `/api/v1/security/config` backed by `smriti_permissions`, `system_configs`, and `smriti_audit_log`.
  - Added action-level RBAC guard factory `require_permission(resource, action)` returning `SMRITI-AUTH-001` 403 Forbidden rejection when unauthorized.
  - Zero duplicate tables or engines created â€” 100% database reuse.
- **Verification & Testing**:
  - Added unit test suite `menuAccess.test.ts` (6 tests) and backend test `t_sec_menu.py` (1 test).
  - All 39 test suites passing (288/288 tests). Frontend built in 24.67s.

### [6.15.0] - 2026-08-22

#### CRM & Sales â€” Customer Flow, Policy Enforcement & Database Referential Integrity Hardening
- **Backend Credit Limit & Credit Hold Enforcement (`crm.py`, `sales.py`)**:
  - Implemented transactional credit validation in `CrmService.check_credit_limit`.
  - Blocks invoicing and returns structured business errors `SMRITI-CREDIT-001` (credit limit exceeded) and `SMRITI-CREDIT-002` (credit hold active) when limits are breached.
- **Canonical Walk-In / Cash Customer Resolution (`seed_customers.py`, `customerStore.ts`)**:
  - Seeded canonical `CUST-WALKIN` entity ("Walk-In / Cash Customer") to ensure 100% foreign-key compliance for counter sales without unresolvable customer IDs.
- **Automated Database Orphan Customer Reconciler (`reconcile_customers.py`)**:
  - Created automated reconciliation script to scan all invoices in PostgreSQL and repair orphan references.
- **Policy Enforcement Unit Test Suite (`custPolicy.test.ts`)**:
  - Added 5 automated unit tests covering credit limit thresholds, warning percentages, credit hold policies, and Price Group tax inclusiveness.

### [6.14.0] - 2026-08-22

#### Security & Shell â€” Dual-Mode Contextual Inspector HUD (Zero Data on Login & Full Active Capabilities in Session)
- **Dual-Mode HUD Architecture (`CtxInspectorHUD.tsx`)**:
  - **Login Screen Mode**: Displays a secure "SMRITI Security Portal â€¢ Authentication Required" banner with 0 business data, 0 invoice text, and 0 credentials exposure.
  - **Authenticated Session Mode**: Activates all 18+ contextual master categories, live query inspections, and Ctrl+K search integration.
- **Safe Authentication Input Tracking (`ActiveFieldContext.tsx`)**:
  - Automatically isolates login/password fields to generic security category without value tracking or data query broadcasting.
- **Full Operational Parity**:
  - Zero features eliminated for logged-in operators (Ctrl+K Global Search, F2 Master Browse, DrillDown Side Panel, Shortcut Palette).

### [6.13.0] - 2026-08-22

#### Security & Shell â€” Public Data Exposure Hardening & Bottom Workspace Taskbar Removal
- **Zero-Trust Auth Guards on Context Overlays**:
  - Moved `ContextRenderer`, `GlobalSearch`, `GlobalF2BrowseModal`, `ContextualInspectorHUD`, `DrillDownSidePanel`, and `ShortcutPalette` inside `<AppShell>` inside the authenticated `AppContent` session.
  - Injected direct token authentication guards (`smriti_jwt_token` / `smriti_session_token`) across `ContextualInspectorHUD`, `GlobalSearch`, `GlobalF2BrowseModal`, and `ActiveFieldContext`.
  - Prevented unauthenticated visitors and login screen interactions from triggering the HUD popup, Global Search (Ctrl+K), or master browsing (F2).
- **Workspace Canvas Streamlining**:
  - Completely removed `WorkspaceTaskbar` and bottom `pb-13` padding from `src/App.tsx`.
  - Maximized unobstructed vertical screen estate for POS and ERP workspaces.

### [6.12.0] - 2026-08-22

#### Inventory & Item Master â€” Decommissioning & Removal of "Common Fields Setup" Module
- **Module Purge**: Permanently removed `SmritiCommonFieldsSetup.tsx` and `tabs/CommonFieldsTab.tsx`.
- **Item Master Workspace Streamlining (`ItemMasterWs.tsx`)**:
  - Removed "Common Fields" from the left navigation sidebar.
  - Streamlined workflow directly to Item Details, View Configuration, Bulk Imports, Attributes Catalog, Image Path Config, and Variant Templates.
  - Re-aligned global keyboard shortcuts (Alt+1 View Config, Alt+2 Item Details, Alt+3 Imports, Alt+4 Attributes, Alt+5 Image Config, Alt+6 Variants).
- **Component Decoupling**:
  - Decoupled `ItemDetGrid.tsx` and `ItemMasterEntryVie.tsx` from `CommonFieldsData` interface and props.
  - Updated `KeyboardKeysDlg.tsx` shortcut references.

### [6.11.0] - 2026-08-22

#### POS & Inventory â€” Dual-Field Item Auto-Search, Auto-Population & 14+ Attribute Inspection
- **Universal Multi-Attribute Typeahead Overlay (`ItemTypeaheadDrop.tsx`)**:
  - Reusable dropdown displaying **5 Key Identifiers** (Barcode, Stock No, Code, SKU, Name/Description), **6 Core Commercial Details** (MRP, Rate, Cost Price, Stock, Size, Color, GST%), and **6 Extended Tactical Attributes** (Brand, Category, HSN, Pricing Mode, Tracking Mode, Weight, Image Preview).
  - Smooth keyboard navigation (Arrow Up/Down, Enter selection, Escape dismissal) with auto-scroll.
- **Dual-Field Search Trigger & Synchronization**:
  - Integrated interchangeable lookup across `Barcode / Scan` and `Stock No / SKU` in `ProPosBillingTerm.tsx` and `BillingTerm.tsx`.
  - Automatic synchronization of both identifiers and live line rate/description upon item selection.
  - Added live Selected Item Multi-Attribute Inspection HUD banner across billing workspaces.
- **Backend Search Expansion (`ProductRepository.search`)**:
  - Extended multi-column SQL ILIKE search to include `sku`, `style_code`, `hsn_code`, `brand`, `category`, and JSONB `attributes`.

### [6.10.0] - 2026-08-22

#### Sales & POS â€” Zero-Touch Automated GST & Customer Classification Engine
- **Centralized GST Engines (`backend/app/core/gst_engine.py` & `src/utils/gstEngine.ts`)**:
  - Implemented automatic 2x2 matrix calculation: Registered (B2B) vs. Unregistered (B2C) across Intra-State (CGST+SGST) and Inter-State (IGST).
  - High-precision decimal calculations with banker's rounding for Gross Total, Taxable Value, CGST, SGST, IGST, and Net Total.
  - Automatic GSTIN regex validation and 2-digit State Code extraction with Indian state lookup directory.
  - Deterministic statutory GSTR-1 classification (`B2B` Table 4A, `B2CL` Table 5A, `B2CS` Table 7).
- **Backend Sales & Invoicing (`backend/app/services/sales.py`, `backend/app/schemas/sales.py`)**:
  - Automatically derives store state vs. customer Place of Supply (POS) state code.
  - Immutably persists `taxable_value`, `cgst_amount`, `sgst_amount`, `igst_amount`, and `line_total` on `sales_invoice_items`.
- **ProPOS Billing Terminal Guardrails (`ProPosBillingTerm.tsx`, `CustBrowseDlg.tsx`)**:
  - Added live header `Tax Jurisdiction` badge showing `B2B` vs. `B2C` and `Intra-State (CGST+SGST)` vs. `Inter-State (IGST)` in real time.
  - Automatic recalculation of line totals and tax splits upon customer selection.
  - Locked tax rates and formulas to prevent cashier input errors.
- **Thermal & Standard Print Receipt (`ProPosTaxInvoiceRc.tsx`)**:
  - Displays customer GSTIN and Place of Supply.
  - Formats explicit GST Tax Analysis breakdown table (Taxable, CGST, SGST, IGST).

### [6.9.0] - 2026-08-22

#### CRM & Customer Master â€” Customer Price Group Master & Database Flow Integrity
- **Customer Price Group Master Window (`CustPriceGroupDlg.tsx`)**:
  - Implemented authentic desktop ERP layout for managing Customer Price Groups.
  - Fields: `Code`, `Description`, `Payment Terms`, `Credit Days`, `Dest-Wise Tax Type`, `Credit Limit`, `Item Classification-wise Price Factor Applicable`.
  - `Transactions Allowed` Group Box: `Credit Invoice` (Alt+R), `Cash Invoice` (Alt+S), `Tax Exclusive Invoice` (Alt+T), `Misc. Issue` (Alt+M).
  - Actions: `Ok` (Alt+O / Enter), `Cancel` (Alt+C), `Add` (Alt+A), `Edit` (Alt+E), `Delete` (Alt+D), `Exit` (Alt+X / Escape).
  - Quick catalogue table drawer for instantaneous inspection and group selection.
- **Customer Form Tab Integration (`CustFormTab.tsx`)**:
  - Connected dynamic Price Group dropdown populated from store.
  - Added inline `[...]` / `Manage Groups` launcher directly opening the configuration modal.
- **PostgreSQL Database Flow Integrity (`seed_customers.py`)**:
  - Seeded 4 canonical Customer Groups (`CG-Retail`, `CG-LargeRetail`, `CG-Branches`, `CG-Franchises`) and 7 canonical Customers (`CUST-001` .. `CUST-007`) in PostgreSQL with tenant isolation (`COMP-001` / `BR-MAIN-001`).
  - Preserved historical invoice-linked customer ID `cust-rrl-192b561d` (Reliance Retail) across database and frontend store.
- **Mock Fallback Removal**:
  - Removed silent `DEFAULT_CUSTOMERS` fallback from `CustBrowseDlg.tsx` and `BillingTerm.tsx`, ensuring explicit empty state when database is empty.
  - Connected live API fetch via `apiFetchV1("/customers")`.
- **Backend Tenant Resolution & Error Handling (`deps.py`, `crm.py`, `schemas/crm.py`)**:
  - Corrected branch mapping (`BR-MAIN-001`) and enhanced `IntegrityError` reporting in `CrmService`.
  - Made schema IDs optional with automatic deterministic UUID generation.
- **Automated Tests**:
  - Added `custPriceGrp.test.ts` (6/6 pass) and `custFlow.test.ts` (4/4 pass).
  - All 34 vitest suites (258/258 tests) passing 100%.

### [6.7.0] - 2026-08-22

#### POS & Billing â€” Distributor Invoicing, Settlement & PDT Import Integration (Stitch UX)
- **Distributor Invoicing Terminal (`BillingTerm.tsx`)**:
  - Implemented the authentic Stitch layout from `invoicing_smritisystems/code.html`.
  - Header: `Bill Type`, `Transaction`, `Doc Prefix` (`D1DS13`), `Doc No.`, `Import`, `Recall`, `Customer` with `F2` search, Name display & `Add` button, `Sales Staff`.
  - **F11 Direct Entry Row**: 11-column inline buffer (`Stock No` with F2 catalog lookup, `Description`, `Rate`, `Qty`, `Value`, `Disc Code`, `Disc Qty`, `Disc %`, `Disc Amt`, `Total`, `Staff`).
  - **Main 12-Column Table**: Real-time line item grid with alternating row striping and row deletion.
  - **Tabbed Footer**: `Transporter Details` (freight/courier breakdown), `Payment Details`, `AddOns & Deductions`, and `Document Remarks`.
  - **Right Totals & Bottom Summary Bar**: 9 summary cells with large highlighted `Net Amount` display.
- **Multi-Tender Settlement Studio (`InvoiceSettlementD.tsx`)**:
  - Implemented `invoice_settlement_smritisystems/code.html` split-view modal.
  - Left: Invoice summary & dynamic multi-row payment entry table (`Cash`, `Credit Card`, `Debit Card`, `UPI`, `Cheque`, `Credit Note`).
  - Right: Calculation breakdown card, cash denomination counter (`2000` to `Coins`), and action bar (`Cancel Esc`, `Hold F12`, `Complete Settlement F8/Enter`).
- **PDT Import Dialog (`PdtImportModal.tsx`)**:
  - Implemented `pdt_import_dialog/code.html` dual-mode radio toggle (`Import from File` vs `Import from Transaction`).
- **Billing Suite Integration (`ProPosWs.tsx` & `PosTerminalTab.tsx`)**:
  - Integrated `Distributor Invoicing` and `Speed POS Terminal` under one unified suite.

### [6.6.0] - 2026-08-22

#### Barcode & Inventory â€” Stitch Barcode Label Designer & Printer Replacement
- **Complete Module Replacement (`TagLabelPrintingTa.tsx` & `BarcodeScriptGenVi.tsx`)**:
  - Fully replaced previous implementation with the authentic **Stitch Barcode Label Designer & Printer** module from `F:\SMRITI\barcode_label_designer_and_printer_Final\stitch_barcode_label_designer_and_printer`.
  - Implemented the **Industrial Logic** design system tokens (Deep Navy `#041632`, Slate Blue `#3e5f90`, Soft Grey Surface `#fbf8fb`, High-Contrast Error `#ba1a1a`).
- **Sidebar & Workflow Architecture**:
  - 280px left sidebar housing Label Printing Parameters, Option Mode Selector (7 modes), and Quantity Summaries.
  - Interactive top Selection/Ingestion Card (Manual, PT File, Transactions, PO, Masters, Direct Scan).
  - Dedicated **Item Preview & Results Grid View** with real-time search filter, sort indicators, and instant inline `# Labels` number inputs.
  - Persistent bottom action bar (`Clear`, `Exit`, `Print Current`, `Print All`).
- **Barcode Script Designer & Compiler Studio**:
  - Integrated dark-themed editor (`#1E1E1E`) with line numbers, fullscreen mode, macro token compiler, and export/load actions.

### [6.5.0] - 2026-08-22

#### Barcode & Inventory â€” Full Multi-Source Printing Engine (Transactions, PO, Masters by Date, Direct Scan)
- **Against Transactions (`TagLabelPrintingTa.tsx` & `barcodeTransactionS.ts`)**:
  - Added support for filtering items across transaction types (`Purchase Inward (GRN)`, `Sales Return Inward`, `Stock Transfer Inward`, `POS Exchange`), Doc No prefix, and document number ranges.
  - Manifest table displays transaction references, stock details, and transaction quantities.
- **Against Purchase Orders (Cumulative PO Ingestion)**:
  - Supports PO prefix, PO number ranges, and cumulative purchase order quantity aggregation per stock item.
  - Locked `Specified Quantity` & `Present Stock` (quantities strictly bound to purchase orders).
- **Against Masters with Period Date Filter & Unprinted Dialog**:
  - Implemented Date Range filtering (`Date From` to `Date To`) on product master creation dates.
  - Added 3-way modal confirmation dialog: `Yes` (Unprinted items only), `No` (All items in period), `Cancel` (Abort).
- **Against Direct Scan with Auto-Print & Custom Count**:
  - Autofocused barcode scanner input with instant SKU/Barcode catalog lookup.
  - `Automatically Print One Label on Scan` toggle (default on) and custom `# Lbls` override.
  - Real-time scanned items history log and instant thermal dispatch.
- **Comprehensive Automated Tests (`tagPrinting.test.ts`)**:
  - Expanded test suite to 14 test cases covering all 6 source modes.

### [6.4.0] - 2026-08-22

#### Barcode & Inventory â€” Printing Against Purchase (PT File) & Sequential Manifest
- **PT File Parser & Ingestion (`ptFileParser.ts`)**:
  - Supports delimited text/CSV PT files with column mapping for SKU, Product, Brand, Style, Shade, Size, Purchase Qty, MRP, and Barcode.
- **Purchase Transaction Manifest Table**:
  - Integrated full manifest table with active row highlighting and 4-way sequential navigation (`|<<`, `<`, `>`, `>>|`).
- **Quantity Policy & Spooling**:
  - Enforced fixed purchase quantities from PT file, disabled manual overrides, and linked `Print` / `Print All` to exact purchase quantities.

### [6.3.0] - 2026-08-21

#### UI / UX & Launchpad â€” Enterprise Look & Feel Modernization
- **Fiori Launchpad Redesign (`FioriLaunchpad.tsx`)**:
  - Replaced flat white workspace cards with category-accented cards (`border-l-4` color indicators for Retail Operations, Master Data, Finance, Administration, and Analytics).
  - Enhanced card hover depth with subtle vertical lift (`hover:-translate-y-1`), elevated drop-shadow (`hover:shadow-md`), and category-matched animated forward arrows.
  - Implemented real-time interactive search filtering directly within the hero banner to instantly isolate workspaces as operators type.
- **Primary Quick Actions Bar (`launchpadCatalog.ts`)**:
  - Color-coded quick action icons with rich background containers (Emerald for POS, Indigo for Tax Invoice, Purple for Item Master, Amber for Barcode, Blue for Stock Ledger).
  - Added global keyboard hotkey badges (<kbd>F1</kbd>, <kbd>F3</kbd>, <kbd>F4</kbd>, <kbd>F5</kbd>, <kbd>F6</kbd>) with immediate keyboard shortcut routing.
- **Hero Operational Banner**:
  - Applied deep navy mesh gradient (`from-[#041632] via-[#0b254a] to-[#1b3a6b]`) with live store indicators (Store Status, Role Access, Backend Health, Active Workspace Count).

### [6.2.0] - 2026-08-21

#### Barcode & Inventory â€” Industrial Logic Barcode Label Designer & Printing Modernization
- **Dual-Workspace Architecture (`TagLabelPrintingTa.tsx` & `BarcodeStudioTab.tsx`)**:
  - Implemented 12-column industrial layout based on Stitch **Industrial Logic** design system.
  - Divided workspace into **Tag & Barcode Printing Terminal** and **Barcode Script Generation & Compiler Studio**.
- **Selection Criteria Range & Live Inspector**:
  - 6-dimension range matrix (Stock No, Product, Brand, Style, Shade, Size) with instant F2 master product search browse.
  - Selected Item Live Preview card with first (`|<<`), previous (`<`), next (`>`), and last (`>>|`) item navigation controls.
- **Edit Quantity Details Modal (`EditQuantityDetDlg.tsx`)**:
  - High-density matrix modal allowing granular per-item `# Lbls` adjustment, batch fill shortcuts ("All = 1", "All = Stock", "Reset 0"), and real-time total label recalculation.
- **Thermal Barcode Script Compiler (`BarcodeScriptGenVi.tsx`)**:
  - Monospaced code editor with line numbers, ZPL/TSPL macro token generation (`@@@field;dir;type;start;length@@@`), string slicing (From Left / From Right), and compiler status indicator.
- **Thermal Printer Provisioning (`BarcodePrinterSele.tsx`)**:
  - Auto-detection and target provisioning modal for modern `.blf` script files and thermal printer selection (USB, Serial, Network TCP/IP, QZ Tray).
- **Unit Test Suite (`tagPrinting.test.ts`)**:
  - Added 7 comprehensive test suites covering range filtering, batch/per-item quantities, and script token formatting.

### [6.1.0] - 2026-08-21

#### Inventory & Master Data â€” Non-Editable SKU & Barcode Enforcement
- **Item Master Details Grid (`ItemDetGrid.tsx`)**:
  - Locked SKU (`code`, `sku`, `stockNo`) and Barcode (`barcode`) inputs as read-only with disabled cursor styling and helper tooltips in Edit Mode (`activeMode === "edit"`).
  - Maintained full editability for all other attributes (Name, Brand, Style, Shade, Size, MRP, Sale Price, Cost Price, Tax Rate, HSN Code, UOM, and Dynamic Attributes a1â€“a9).
  - Enforced read-only locking on Stock No and Barcode in Classic Single-Record inspector view.
- **Global Master Form Drawer (`MasterFormDrawer.tsx` & `itemMaster.config.tsx`)**:
  - Propagated `isEdit` boolean into field `disabled` callbacks across generic master entities.
  - Disabled `code` and `barcode` editing in `itemMasterConfig` when modifying existing items.
- **Unit Tests (`itemGrid.test.ts`)**:
  - Added Section 7 test suite asserting SKU/Barcode locking in Edit Mode and editability in Add Mode.

### [6.0.0] - 2026-08-21

#### POS & Invoicing â€” ProPOS Unified Enterprise Billing Suite
- **ProPOS Billing Terminal (`ProPosBillingTerm.tsx`)**:
  - Implemented high-speed retail checkout terminal based on Stitch ProPOS specifications.
  - Rapid item scanning with quantity stepping, salesperson tagging, and live calculation summary.
  - Keyboard shortcuts enabled: `[F7]` Exact Cash, `[F8]` Settlement, `[F10]` Settle & Print.
- **Multi-Tender Settlement (`ProPosSettlementDl.tsx`)**:
  - Split tenders supported: Cash, Credit/Debit Card, UPI Dynamic QR, Gift Vouchers, Credit Notes, and Loyalty Rewards.
  - Virtual 3x4 POS keypad with auto-balance calculation and instant change calculation.
- **Queue Park & Recall (`ProPosRecallDlg.tsx`)**:
  - Hold and recall suspended carts with full item, customer, and sales staff restoration.
- **Invoice Cancellation & Void Audit (`ProPosCancellation.tsx`)**:
  - Void invoice workflow with mandatory reason code selection and manager PIN authorization.
- **Loyalty Rewards & Tier Lookup (`ProPosLoyaltyLooku.tsx`)**:
  - Customer tier points lookup, redemption value conversion, and checkout balance deduction.
- **Sales Return & Credit Note Engine (`ProPosSalesReturnD.tsx`)**:
  - Referenced invoice return and blind manager-approved return workflows with item condition tags.
- **End-of-Day (EOD) Z-Report & Drawer Audit (`ProPosEodReportVie.tsx`)**:
  - Day-end closeout summary with system expected vs physical drawer count variance auditing.
- **Daily Analytics & Shift Reports (`ProPosDailyReports.tsx`)**:
  - Hourly rush-hour trends and cashier performance tracking.
- **Promotion & Commission Engines (`ProPosPromotionEng.tsx`, `ProPosCommissionBu.tsx`)**:
  - Buy X Get Y, flat discount schemes, and tiered salesperson commission builders.
- **Tax Invoice Receipt Engine (`ProPosTaxInvoiceRc.tsx`)**:
  - Clean thermal slip and A4/A5 laser invoice formatting.

### [5.6.0] - 2026-08-21

#### Item Master & Platform â€” View Configuration, Excel Mapper & Alias Stabilization
- **Persistent Alias Suppression Engine (`HeaderAliasRegistry.ts`)**:
  - Implemented `REMOVED_ALIASES_STORAGE_KEY` blacklist to permanently suppress deleted default or custom aliases.
  - Automatically un-blacklists aliases upon re-addition and provides per-attribute "Reset Defaults" action in Attribute Management Studio.
- **Intelligent Delimiter Parsing & Normalized Header Extraction (`ItemMasterStudio.tsx`, `HeaderMappingEngine.ts`)**:
  - Support for multi-delimiters: Tabs (`\t`), Commas (CSV), Semicolons (`;`), and Multiple Spaces (`\s{2,}`).
  - Integrated `normalizeHeader` in `isKnownHeader` and `detectHeaderRow` to accurately extract Row 1 as the true Header Row without false fallbacks to generic `Col 1` columns.
- **Auto-Mapper Field Candidate Registry Alignment**:
  - Fixed property lookup bug where `f.canonicalKey` evaluated to `undefined`, resolving the issue of dropdowns defaulting to `(Skip Column)` in red.
  - Preselects target fields accurately (Barcode, Stock No, Product Name, Brand, Color, Size, MRP, Cost Price, Selling Price).
- **View Configuration & Global Column Arrangement Engine (`ViewConfig.tsx`)**:
  - Dynamic attribute loading and custom label resolution from `/attributes/definitions`.
  - Added double-click transfers between Available (Hidden) and Selected (Visible) lists.
  - Added 4-way reordering controls (Move to Top, Move Up, Move Down, Move to Bottom).
  - Added quick layout presets: Essential (8 cols), Standard (14 cols), and Full Catalog.
  - Universal reactive event broadcast (`smriti_field_visibility_updated`) across all grids, spreadsheets, and operational reports.

### [5.5.0] - 2026-08-21

#### Retail CRM & Customer Master â€” Retail Customer Catalogue & Advanced Search Suite
- **Retail Customer Catalogue Architecture (`src/components/customer/CustMasterWs.tsx`)**:
  - Implemented 3-tab central customer account manager:
    - **1. The "Form" Tab (`CustFormTab.tsx`)**: General details (Customer Code, Name, Price Group, Mail List summary), Classification (Religion, Ethnicity, Age Group, Profession, Customer Type), Profile notes & preferences, and Shoper environment parameters (Comp Code, Environment, Flat File Format, Delimiter, Buying/Selling factor).
    - **2. The "Retail Details" Tab (`CustRetailDetTab.tsx`)**: Sub-Ordinate/dependant linkage, dependant list CRUD, Personal demographics (Gender radio, Date of Birth, Marital Status toggle, Anniversary date picker), and Loyalty Program details (ID, Code, Tier, Points Balance).
    - **3. The "Additional Details" Tab (`CustAddlDetTab.tsx`)**: Payment category & terms, Credit limits & utilization progress bar, Transport & Logistics modes, Bank details, Retail/Dealer factors, Destination tax types, Transaction permission checkboxes (Allow Cash Bill, DC Gen, Credit Invoice, Misc Issue/Receipts), LST/CST numbers, and Tax Forms.
- **Mailing Address Sub-Form Dialog (`CustMailingDlg.tsx`)**:
  - Multi-profile address dialog supporting Address lines 1 to 5, locality, city, state, postal code, zone, country, office/home/mobile/fax phone numbers, and emails 1 to 3.
- **Advanced Customer Search Utility (`AdvancedCustSearch.tsx`)**:
  - Dual-column search engine with general and multivariate demographic selection filters, instant matrix grid matching, and double-click / Enter key catalogue loading.
- **Operational Ergonomics & Navigation**:
  - Full keyboard shortcuts (<kbd>Alt+N</kbd> for New, <kbd>F2</kbd> / <kbd>Alt+S</kbd> for Search, <kbd>Ctrl+S</kbd> for Save, <kbd>Alt+D</kbd> for Delete, <kbd>Alt+1..3</kbd> for tab navigation).
  - Previous / Next record browser with real-time record index counter and dirty-state notification.

### [5.4.0] - 2026-08-21

#### UI Platform & Inventory â€” Universal View Configuration as Global Schema & Visibility Control
- **Global Field Visibility & Ordering Engine (`unifiedFieldCatalog.ts`)**:
  - `saveGlobalFieldVisibility` persists visible columns and sequence ordering across client state.
  - `isFieldGloballyVisible` and `getGloballyVisibleFields` dynamically filter and sort catalog definitions.
  - Reactive `smriti_field_visibility_updated` CustomEvent broadcasts layout changes across all active components and tabs with sub-millisecond overhead.
- **Application-Wide Visibility Enforcement**:
  - **Item Master Details Spreadsheet Grid (`ItemDetGrid.tsx`)**: Reflects custom column sets and sequence in real time.
  - **Item Catalog Search Browser (`ItemCatGrid.tsx`)**: Dynamically hides unselected columns and sorts active ones.
  - **Report Designer & Operational BI Hub (`ReportDesignerTab.tsx`)**: All ledger, sales, stock, and inventory report tables automatically conform to the active field visibility schema.
- **Stock No & Barcode Real-Time Uniqueness Alerts**:
  - `onBlur` cell alerts identifying duplicate Stock Nos and Barcodes against in-grid entries and database records with conflicting product names.
  - Pre-save integrity blocker stopping duplicates before database insertion.

### [5.3.0] - 2026-08-21

#### Inventory & Catalog â€” Item Master Stitch Management System Architecture & Image Resolver
- **Item Master Management System Suite (`Itemmaster3`)**: Integrated complete suite from `F:\SMRITI\Itemmaster3\stitch_item_master_management_system`:
  - **Item Details Master Grid (`ItemDetGrid.tsx`)**: High-density matrix grid and classic single-record view, inline Add/Duplicate/Delete row actions, `F1` keyboard shortcuts guide, and `F2` SKU/Barcode generator.
  - **Common Fields Baseline Setup (`SmritiCommonFieldsSetup.tsx`)**: Session-level baseline presets (Category, Brand, Vendor, HSN, Tax %, UOM) that auto-fill all newly entered items.
  - **Dual-List View Configuration (`ViewConfig.tsx`)**: Dual-list column selector, order manager, and frozen column count selector (0â€“6).
  - **Full CRUD Lifecycle Safeguards**: Mode selector for Adding, Editing (with non-editable greyed Stock No and Data Loading confirmation modal), and Deleting (with transaction protection guard preventing hard deletion of items with sales history).
  - **Global Find & Replace Data Utility (`ReplaceDataDlg.tsx`)**: Global batch find and replace across all matrix columns and dynamic attributes.
  - **Product Image Filename & Resolver Studio (`ImagePathConfigStu.tsx`)**: Operators only enter image filenames (`imageName`). Configured base paths for SMRITI Server (`/api/v1/products/images/`), Cloud CDN, and Local Network paths with interactive live resolution tester and hover thumbnail previews.
  - **Barcode Positioned Adjacent to Stock No**: Core standard fields catalog updated to render `Barcode` directly next to `Stock No / SKU`.
  - **PostgreSQL Persistence**: Fully connected to transactional FastAPI endpoint `POST /api/v1/products/`.

### [3.29.0] - 2026-08-21

#### Inventory & Catalog â€” Item Master Entry Tactical Grid Refactor (Smriti Prime Specification)
- **Smriti Prime Three-Tab Catalog Workflow**: Refactored Item Master Entry to match the high-velocity tactical layout from `stitch_invoice_management_system` (`src/components/itemMaster/`):
  - **Tab 1: View (`Alt+1`)** â€” Field Selection: Dual list (Unselected Fields â†” Selected Fields) with transfer controls (`>`, `>>`, `<`, `<<`), reordering controls (`Move Up`, `Move Down`), and mandatory lock rules for `stockNo`, `product`, and `mrp`.
  - **Tab 2: Common Fields (`Alt+2`)** â€” Batch Common Presets: Form controls for Brand, Category, Sub-Category, Tax Rate %, Supplier, Season, Department, and Status that auto-apply to item rows.
  - **Tab 3: Item Details (`Alt+3`)** â€” Tactical Spreadsheet Grid: High-speed matrix table featuring customizable sticky frozen columns (0â€“6), inline cell editing, row indicators ("Row X of Y"), Auto-SKU generator, and "Paste from Excel" multi-column TSV clipboard parsing.
- **Save Warning & Rights Confirmation Dialog**: Integrated `ItemMasterSaveWarn.tsx` displaying a clean confirmation dialog when creating unverified Brand/Category matrix combinations.
- **Persistence & Backend Integration**: Saved field layout and common defaults to `localStorage`, directly persisting rows to FastAPI backend (`/api/v1/products/`) via `apiFetchV1`.
- **Automated Test Coverage**: Added `src/tests/itemGrid.test.ts` (10 tests) covering mandatory attributes, column reordering, common presets, TSV parsing, and payload transformation (all 23 test suites passing 100%).

#### Database & Operations â€” SMRITI Database Manager & Studio (DB Studio)
- **Multi-Tenant PostgreSQL Studio**: Introduced a dedicated, enterprise-grade Database Manager (`src/components/DatabaseManagerTab.tsx`) allowing `SYSADMIN` operators to switch between control plane and tenant databases (`smritisys`, `smriti001`, `smriti002`, `smriti_test_fresh`) with live size, table count, and row count telemetry.
- **Table Data Grid & Column Schema Inspector**: Built an interactive paginated table data browser with column search, dynamic sorting, JSON row detail inspector drawer, and one-click CSV export, alongside a complete column schema and foreign key constraint viewer.
- **Alembic Migration Version Tracking**: Added real-time tracking of current `alembic_version` versus head migration revision with sync status indicators.
- **Safe Read-Only SQL Query Console**: Implemented an administrative SQL execution console (`POST /api/v1/database-manager/query`) supporting `SELECT`, `WITH`, and `EXPLAIN` statements with automatic execution time measurement and strict rejection of destructive DDL/DML operations.
- **Strict Role Authorization**: Gated all backend endpoints and frontend launchpad tiles strictly to `SYSADMIN` with deny-by-default access for non-admin roles and zero exposure of database connection credentials.

#### Printing & Hardware â€” Optional QZ Tray Print Dispatch (Spike + Hybrid)
- **Hybrid Tri-Mode Dispatch Architecture**: Implemented support for `server_tcp` (default backend port 9100 socket transport), `qz_tray` (feature-flagged browser WebSocket dispatch), and `prn` (direct offline script download) in `backend/app/services/printer_service.py` and `backend/app/api/v1/barcode.py`.
- **Asynchronous Print Job Acknowledgment**: Added `POST /api/v1/barcode/print-jobs/{job_id}/ack` route allowing the browser client to report execution status (`Success` or `Failed`), updating `PrintHistory` audit logs idempotently with strict tenant isolation.
- **Feature-Flagged Frontend Client (`qzTrayClient.ts`)**: Created `src/utils/qzTrayClient.ts` gated by `VITE_ENABLE_QZ_TRAY` (default `false`), implementing official `qz-tray.js` SDK hooks with a native WebSocket RPC fallback on `ws://localhost:8182`.
- **Barcode & Label Studio Integration**: Updated `LabelPrintingSec.tsx` with a dispatch mode toggle, live QZ Tray flag indicator badge, and automated ACK triggers on print completion or failure.
- **Zero Invariant Regressions**: Server TCP remains the default; POS billing, item master, and launchpad are completely untouched. Verified with 6 backend Pytest tests, 3 frontend Vitest tests, and clean `tsc --noEmit`.

#### Governance & Field Readiness â€” Commercial Pilot Origin-Gap Remediation & Hardening
- **Origin-Truth Deliverables (D1â€“D6)**: Standardized application version SSOT (`APP_VERSION = "3.29.0"`), documented dual-run architecture for `DocumentStudioScreen`, created formal pilot smoke checklist (`docs/PILOT_SMOKE_CHECKLIST.md`), froze commercial pilot scope boundary (Section 6 of `docs/PHASE1_PILOT_SUPPORTED_MODULES.md`), and updated `CompanyDatabaseProvisioner` to require Alembic migration head â‰¥ `v1337_backfill_variant_id`.
- **Deny-by-Default Role-Based Access Control (RBAC)**: Eliminated `(role || "SYSADMIN")` fallback elevations in `launchpadCatalog.ts`, `FioriLaunchpad.tsx`, `App.tsx`, and `navigationResolver.ts`. Users with null/blank roles are strictly restricted to public/unrestricted tiles.
- **Multi-Tenant Database Discovery & Alembic HEAD**: Discovered and migrated all control plane and company databases (`smritisys`, `smriti001`, `smriti_test_fresh`) to Alembic HEAD (`v1338_company_isolated_barcodes`). Confirmed 0 NULL `variant_id`s across 588 products in `smriti001`. Recorded evidence in `docs/PILOT_DB_MIGRATE_RESULTS.md`.
- **Commercial Pilot Go-Live Runbook**: Authored `docs/PILOT_GO_LIVE_RUNBOOK.md` detailing environment variable prerequisites, operator provisioning, checkout happy path, non-destructive `pg_dump`/`pg_restore` backup/rollback strategy, hardware pairing, and emergency support escalation.
- **Smoke Test Results Sign-Off**: Recorded formal `GO_SOFTWARE` sign-off in `docs/PILOT_SMOKE_RESULTS.md` with 20 Vitest files (128 tests) and 39 Pytest tests passing 100%.

#### Security & Quality â€” UI/UX Duplication & Hardcode Remediation
- **Hardcoded Credential Elimination**: Removed hardcoded plaintext passwords (`whynothing`) from `src/state/store.ts` and `src/db/init.ts`. Confirmed zero remaining occurrences in `src/`.
- **Canonical Indian Currency Words Formatter**: Extracted `numberToIndianWords` into `src/utils/indianNumberWords.ts` and updated Python `number_to_indian_words` in `backend/app/services/invoice_pdf_service.py` to identically handle sub-rupee values (`0.50` -> `"Zero Rupees and Fifty Paisa Only"`) and singular/plural rupees (`1.00` -> `"One Rupee Only"`). Added matching 14-test parity suites in Vitest and Pytest.
- **Invoice Template Decoupling**: Decoupled `TaxInvoiceA4.tsx` (dedicated statutory GST invoice) and `StandardInvoiceA4.tsx` (generic Print Studio design catalog), removing duplicate formatting code and dead imports.
- **Dynamic Printer IP Configuration**: Removed hardcoded `192.168.1.200` initial state from `LabelPrintingSec.tsx`, converting it to an empty default that dynamically populates from `/api/v1/barcode/printer-settings` (`SystemConfig`).
- **Single Source of Truth for Application Version**: Established `src/config/version.ts` exporting `APP_VERSION`, `APP_RELEASE_STAGE`, and `APP_VERSION_LABEL`. Replaced all hand-typed version strings across the UI (`LoginScreen.tsx`, `CompanySelectScree.tsx`, `layout_manager.tsx`, `DashboardTab.tsx`, `QuickReportsWidget.tsx`, `PrintPreviewModal.tsx`) and synchronized `package.json` to 3.29.0.
- **Centralized API Target Host Configuration**: Created `src/config/api.ts` managing `FASTAPI_BASE_URL` with environment and Docker container network resolution, replacing duplicate fallback strings in `helpers.ts`.

#### Testing & Infrastructure â€” Test Fixture Environment Dependency & Multi-Tenant Routing
- **Deterministic 20/20 Test Suite**: Stabilized `t_tenant_sec.py`, `t_ecom_connect.py`, and `t_comp_ctr_sec.py` across full multi-suite test runs.
- **Explicit Routing Registry Seeding (RC2)**: Seeded `company_database_registries` with `COMP-001 -> smriti001` in conftest so dynamic database resolution (`CompanyDatabaseResolver`) functions out-of-the-box on fresh database migrations.
- **Fail-Fast Fixture Execution (RC3)**: Replaced silent `try/except` fixture warning prints with immediate `pytest.fail()` calls to surface environmental and setup failures loudly.
- **Compound and Partial Unique Index Handling**: Fixed fixture upsert statements for `user_company_assignments` (targeting `(user_id, company_id) WHERE (is_deleted = false)`), `roles`, and `branches` (preventing `branches_code_key` unique violations and `users_branch_id_fkey` foreign key failures).
- **Cross-Test State Isolation**: Scoped control plane test fixture seeding to `function` level to prevent per-test teardown functions (`clear_db()`) from contaminating subsequent test authorization contexts.

### [3.26.0] - 2026-08-20

#### Security â€” Multi-Tenant Database Routing & Credential Sanitization
- **Hardened `get_company_db` Dependency**: Removed all raw unvalidated client header (`X-Company-Id`) and query parameter parsing. Tenant resolution strictly composes with `get_tenant_context(get_current_user)`, deriving tenant database scope from cryptographic JWT verification and database assignments in `smritisys`.
- **100% Operational Router Wiring**: Replaced legacy `get_db` with `get_company_db` across all operational endpoints in `sales.py`, `inventory.py`, `purchase.py`, and `barcode.py`. Zero occurrences of `get_db` remain in operational routes.
- **Barcode Subsystem Tenant Isolation**: Isolated `BarcodeLayout` CRUD, printer connection configuration (`printer_connection_{company_id}`), diagnostics, test-prints, and `PrintHistory` audit logging by tenant `company_id` and `branch_id`.
- **Financial Credential Sanitization**: Sanitized `db_store.json`, legacy export scripts, test fixtures, and JSON geometry reports to eliminate real bank accounts and IFSC codes. Implemented dynamic environment-based fallback chain in `InvoicePdfService`.
- **Automated CI Secret & Reachability Guard**: Created `scripts/ci_secret_and_reachability_guard.py` scanning for credential exposures and verifying complete router wiring.
- **Consolidated Canonical Exporter**: Replaced 5 redundant invoice export scripts with unified CLI tool `scripts/export_tax_invoices_canonical.py` supporting PDF, HTML, JSON, and CSV exports.
- **Retroactive Invoice Audit**: Audited all 93 active sales invoices in `smriti001` with 0 itemless invoices and 0 GST calculation discrepancies.

### [3.25.0] - 2026-08-15

#### Security â€” Company Control Center Authentication & Authorization Hardening
- **Eliminated Header Spoofing**: Replaced unauthenticated `x-user-id` header defaults with server-verified OAuth2 Bearer JWT authentication (`Depends(get_current_user)`).
- **Enforced Role-Based Access Control**: Restricted administrative company control center operations (`/companies`, `/companies/create-request`, `/lifecycle/action`) and development intelligence endpoints (`/dev-tracker`, `/dev-tracker/scan`) to `UserRole.SYSADMIN`.
- **Tenant Scope Isolation**: Enforced company context validation for ordinary users attempting to access company detail or module entitlements (`company_id == current_user.company_id`).
- **Security Regression Test Suite**: Added `t_comp_ctr_sec.py` verifying HTTP 401/403 fail-closed protection for anonymous, spoofed, or unauthorized calls.

#### Added â€” SMRITI Fiori Light Enterprise UI Redesign & Visual QA Gate
- **Light Mode Only Baseline**: Locked application theme to Light Enterprise Mode (`#f8f9fa` base background, `#ffffff` surface, `#0070f2` action blue, `#32363a` slate text, `#d9d9d9` crisp borders). Completely eliminated dark mode, theme toggles, `#1c222b`, and `prefers-color-scheme` overrides.
- **Fiori Horizon Application Shell**: Refactored global App Shell with Fiori header bar, global search, company selector dropdown, notification popover, workspace navigation, breadcrumbs, and page filter bars.
- **10 Core Visual Screens QA Verified**: Verified Application Shell, POS/Billing, Item Master, Customer/CRM, Purchase, Fulfillment, Promotions, Report Studio, Dashboard Manager, and Excel Grid.
- **Invariants Maintained**: 82/82 backend Pytest test suites passed, Vite production build clean, zero unapproved database creations (`smriti002-smriti999` count = 0), Single Workspace Principle and Single Authoritative Dataset Rule (`Grid = Chart = Pivot = Dashboard KPI = Export`) strictly intact.

### [3.24.0] - 2026-08-15

#### Added â€” SMRITI Reporting Platform & Data Integrity Engine Architecture
- **Reporting Engine & Flexi Studio**: Excel-style analytical grid (filters, column drag, multi-sort, group-by, subtotals, pivot, copy/paste to Excel), Flexi report builder with Dimensions & Measures, and user saved views (`ReportSavedView`).
- **Chart Visualizer & Dashboard Manager**: Multi-chart visual abstraction (Bar, Line, Pie, Area, Stacked, Combo, Scatter, KPI, Funnel, Ranking) and Dashboard Manager for CEO, Sales, Store Manager, CRM, and Profitability dashboards (`DashboardWidget`).
- **Single Authoritative Dataset Rule Locked**: Guaranteed dataset metric consistency where `Grid total = Chart total = Pivot total = Dashboard KPI total = Export total`.
- **20-Point Forensic Runtime Data Integrity**: Runtime report execution verified across 10 business domains with zero unapproved database creations and strict tenant isolation (`HTTP 403` on cross-tenant access).

### [3.23.0] - 2026-08-15

#### Added â€” Commercial Growth, Customer 360, Operations & Fulfillment, and Cost Profitability Engine Architecture
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


## [3.38.0] - 2026-08-25

### Verified & Hardened -- Sprint 22: P0 Production Blockers Stabilization

#### Financial POS Foreign Key Constraints (P0.1)
- Certified 1360_pos_sct_fk_constraints across tenant databases (smriti001, smriti002, smritisys)
- Verified DEFERRABLE INITIALLY DEFERRED Foreign Key constraints on shift_cash_transactions (k_sct_account_id -> ccounts.id, k_sct_gl_voucher_id -> journal_vouchers.id)
- Asserted 0 orphan account references and 0 orphan journal vouchers in all active tenant databases
- Validated ADR-POS-002 forward-only migration governance blocking backward downgrades
- Added dedicated test suite ackend/tests/t_pos_sct_fk.py (4/4 tests green)

#### Secure eCommerce Omnichannel Routing & Ingress (P0.2)
- Certified ackend/app/api/v1/ecom.py and CompanyDatabaseResolver ensuring zero credential leakage
- Validated HMAC-SHA256 signature verification for Shopify (X-Shopify-Hmac-Sha256) and WooCommerce (X-WC-Webhook-Signature)
- Enforced database-level idempotency via unique correlation IDs in integration_outbox_events
- Verified test suite ackend/tests/t_ecom_webhooks.py (5/5 tests green)

#### Fail-Closed Production Security Configuration (P0.3)
- Validated Settings.load_settings() fail-closed guard raising ValueError on development default keys in production
- Enforced minimum 32-character length on JWT_SECRET_KEY and INTERNAL_SERVICE_KEY
- Validated test suite ackend/tests/t_prod_sec.py (6/6 tests green)

#### Architecture Governance Update
- Transitioned Section 3 (P0.1, P0.2, P0.3) of docs/architecture/BLUEPRINT_PENDING.md to Done / Verified per Rule 11
- Fixed test fixture in ackend/tests/test_wms_phase1.py (4/4 tests green)
- Generated WGP Walkthrough docs/walkthrough/foundation/Sprint22_P0_Production_Blockers_v1.0.0.md
## [3.37.0] - 2026-08-25

### Added -- Tattly Threads Batch 2 Tax Invoices (TT2026-2027/129 to 137)

#### B2B Multi-Store Batch Invoicing (Sheet2 of RIL_Dispatch_09-08-2026-2.xlsx)
- Generated 9 canonical A4 Tax Invoices (TT2026-2027/129 to TT2026-2027/137)
- Total Quantity: 456 pairs across 10 cartons (213 through 222)
- Total Taxable Value: ₹5,10,854.28 | Total IGST: ₹25,542.72 | Total Value: ₹5,36,397.00
- 9 Destination Stores: TVB6, TMV9, TUK5, TVP2, TW97, TXSR, TXSU, TW07, TYAC
- Created pre-generation confirmation register: Tax_Invoice_Store_PO_Address_Confirmation_Batch2_2026-08-25.xlsx
- Rendered 9 high-fidelity A4 PDFs with Playwright, Code128 barcodes, and VERIFY INVOICE QR codes
- Persisted records to smriti001 (sales_invoices, sales_invoice_items, invoice_document_artifacts)
- System-wide total active TT tax invoices: 120 (TT2026-2027/18 through TT2026-2027/137)
- Updated Dispatch Status column in Sheet2 of RIL_Dispatch_09-08-2026-2.xlsx
## [3.36.0] - 2026-08-25

### Added -- Sprint 21: LoyaltyAdjPanel Member Search + Alembic v1375 Back-fill (commit 971f2581)

#### CrmStudioTab.tsx: LoyaltyAdjPanel Member Search (v3.29.0 -> v3.30.0)
- CustomerHit interface added: { id, name, mobile?, code? }
- Replaced free-text memberId input with debounced search-to-select widget
    State: searchQ, searchResults, searching, selectedMember, debounceRef
    useEffect: 350ms debounce -> GET /crm/customers/search?q=&limit=5
    Dropdown: up to 5 results, each id=lyl-member-hit-{id}
    Selected card: name + id + mobile, X button (id=lyl-clear-member)
    Submit guard: disabled={!selectedMember} -- no empty-ID submissions
    Flash: uses selectedMember.name in success message
    Import: X icon added from lucide-react (fixes TS2304)

#### Alembic v1375: SalesReturn.customer_id Back-fill (new file)
- backend/alembic/versions/v1375_backfill_sales_return_cust.py
    revision=v1375, down_revision=v1374
    upgrade(): UPDATE sales_returns SET customer_id = si.customer_id
      FROM sales_invoices si WHERE original_invoice_id = si.id
      AND customer_id IS NULL AND si.customer_id IS NOT NULL
    downgrade(): no-op (non-destructive; v1374 handles column removal)
    Chain: v1372 -> v1373 -> v1374 -> v1375 (verified)
    Python ast.parse: OK

TSC: exit code 0 (0 errors). NGP: 0 violations.
## [3.35.0] - 2026-08-25

### Added -- Sprint 20: PHY-008 Barcode Scan-to-Count + CRM Loyalty Adjustment UI (commit f2c9726b)

#### PHY-008: Barcode Scan-to-Count in PhysicalStockTab.tsx (v1.1.0 -> v1.2.0)
- src/components/PhysicalStockTab.tsx: ScanBar component (new, ~75 lines)
    Input: id='phy-scan-input', autoFocus, Enter key submits
    Lookup: matches scanned value against count_lines by sku or product_id
    Action: PATCH PHY-006 /sessions/:id/lines/:lid with counted_qty = current + 1
    Flash: green 'Product -> N pcs' on success; red 'SKU not found' on miss; 2s auto-clear
    Guard: editable=false returns null (only shown for OPEN/IN_PROGRESS sessions)
    Render: inserted above Count Lines Table (after filter chips)
    Import: ScanLine icon added from lucide-react
    Header: v1.2.0 -- API endpoint list updated PHY-001..008

#### CRM Loyalty Adjustment UI in CrmStudioTab.tsx (v3.28.0 -> v3.29.0)
- src/components/CrmStudioTab.tsx: LoyaltyAdjPanel component (new, ~155 lines)
    Tab: 'Loyalty Adjustments' pill with Star icon added to sub-nav bar
    Toggle: BONUS (emerald) / EXPIRE (red) button pair (id: lyl-adj-bonus-btn, lyl-adj-expire-btn)
    Fields: memberId (id: lyl-member-id), points (id: lyl-points), reason, reference_id (optional)
    Guard: role not in [ADMIN,SYSADMIN,SUPERADMIN,MANAGER] shows amber warning banner
    Submit: POST /api/v1/crm/loyalty/members/{id}/bonus|expire (LYL-ADJ-001/002)
    Flash: green on success (granted/expired message), red on API error message
    Imports: Gift, Minus, Star, Loader2 (lucide-react) + apiFetchV1

TSC: exit code 0 (0 errors). NGP: 0 violations.
## [3.34.0] - 2026-08-25

### Added -- Sprint 19: PHY-007 + Loyalty BONUS/EXPIRY + TSC Zero-Error Fix

#### Sprint 19 -- PHY-007 Complete Endpoint + Loyalty Adjustments (commit 65a4950f)
- backend/app/api/v1/physical_stock.py: PHY-007 PATCH /physical-stock/sessions/{id}/complete
    Guards: OPEN or IN_PROGRESS + at least 1 counted_qty set (SMRITI-VAL-002)
    Action: status -> COMPLETED, completed_by recorded
    Returns: { id, status, completed_by, counted_lines, message }
    Closes CompleteBtn gap from PhysicalStockTab.tsx v1.1
- backend/app/services/sales_hook.py: write_loyalty_bonus + write_loyalty_expiry (2 new helpers, total 5)
    BONUS: INSERT loyalty_transactions(type=BONUS), balance += points, total_earned += points
    EXPIRY: INSERT loyalty_transactions(type=EXPIRY), balance -= points (clamped >= 0)
    Both: graceful silent swallow on exception
- backend/app/api/v1/crm.py: LYL-ADJ-001 POST /crm/loyalty/members/{id}/bonus (MANAGER+)
    LYL-ADJ-002 POST /crm/loyalty/members/{id}/expire (MANAGER+)
    get_current_user added to deps import (NameError fix)

### Fixed -- TSC Zero-Error Remediation (commit f12b82e5)

#### Root cause: Sprint 17 launchpad tile insert truncated export functions
- src/components/launchpad/launchpadCatalog.ts [FIXED]
    Restored getVisibleLaunchpadTiles() and getQuickActionTiles() exports
    Fixes: FioriLaunchpad.tsx TS2305 x2, TS2345, TS2322 x3
- src/components/barcode/types.ts [FIXED]
    PortType union: added 'PRN File Download'
    Fixes: TagLabelPrintingTa.tsx TS2367 x4
- src/components/sales/components/TaxHeaderBar.tsx [FIXED]
    ExportButton: removed invalid 'filename' and 'buttonLabel' props
    Fixes: TS2322 x2
- src/components/sales/DistTaxInvoice.tsx [FIXED]
    billType default: 'Product' -> 'Tax Invoice'
    transactionMode default: 'Credit' -> 'Tax Invoice'
    exportColumns: header/alignment/type -> label/align/datatype
    Fixes: TS2322 x3
- src/components/global/ledger/LedgerScreen.tsx [FIXED]
    onNotification: narrowed to 'error'|'success' only
    Fixes: TS2345
- src/components/itemMaster/types.ts [FIXED]
    ItemMasterCommonFieldValues: added optional hsnCode?: string
    Fixes: TS2339
- src/components/itemMaster/ItemEntryView.tsx [FIXED]
    Default commonFieldValues: added hsnCode: ''

TSC: 14 errors -> 0 errors. Exit code 0.
## [3.33.0] - 2026-08-25

### Added -- Sprints 17-18: Physical Stock Count UI + Inline Count Entry + Alembic v1374

#### Sprint 17 -- Physical Stock Count React Workspace (commit 66ba0b2f)
- src/components/PhysicalStockTab.tsx [NEW 585 lines]
  Shoper9 SR323400 MnuNo 350/351 parity React workspace
  - Session List tab: status badges, variance count chip, sorted OPEN->IN_PROGRESS->COMPLETED->APPROVED
  - New Session Modal (POST PHY-002): warehouse, date, description, notes fields
  - Session Detail Panel: meta grid, count lines table (read-only v1.0)
  - Variance Report tab (GET PHY-004): full table with color-coded variance
  - Approve CTA (PATCH PHY-005): MANAGER role guard
- src/App.tsx: PhysicalStockTab registered for workspace keys physical-stock, stock-count, physical-inventory
- backend/app/services/sales.py: REDEEM hook customer_id resolved from orig_invoice (not db_sr)
- backend/alembic/versions/v1373_sales_invoice_ext.py: already landed Sprint 14

#### Sprint 17 Governance (commit ba259696)
- docs/walkthrough/Legacy_Shoper9_SMRITI_Migration_v1.2.0.md [NEW]
  WGP 13-section walkthrough for Sprints 14-17
- docs/walkthrough/README.md: v1.2.0 row appended
- src/components/launchpad/launchpadCatalog.ts: physical-stock tile added
  id='physical-stock', icon=fact_check, group='Master Data & Stock', roles=MANAGER+SYSADMIN, accentColor=emerald

#### Sprint 18 -- Inline Count Entry + PHY-006 + Alembic v1374 (commit 81da1375)
- backend/app/api/v1/physical_stock.py [MODIFIED: +90 lines]
  PHY-006: PATCH /api/v1/physical-stock/sessions/{take_id}/lines/{line_id}
    Pydantic: CountLineUpdate { counted_qty, notes }
    Guards: session OPEN or IN_PROGRESS; line belongs to session
    Updates counted_qty, recalculates variance_qty = counted_qty - computed_qty
    Side-effect: transitions session OPEN -> IN_PROGRESS on first edit
    Returns { id, counted_qty, variance_qty, status }
- backend/alembic/versions/v1374_sales_return_cust.py [NEW]
  down_revision: v1373_sales_invoice_ext
  upgrade: ADD COLUMN customer_id String(50) nullable + ix_sales_returns_customer_id index
  downgrade: drop index + column
- backend/app/models/sales.py [MODIFIED]
  SalesReturn.customer_id = Column(String(50), nullable=True, index=True)  # v1374
- backend/app/services/sales.py [MODIFIED]
  db_sr constructor: customer_id=orig_invoice.customer_id if orig_invoice else None
- src/components/PhysicalStockTab.tsx [MODIFIED: 585 -> 631 lines, v1.1.0]
  CountCell: click-to-edit counted_qty, Enter=save, Esc=cancel, PATCH PHY-006
  Progress bar: X/total lines counted
  Filter chips: All | Not Counted | Has Variance
  Row color: yellow=not counted, red=variance
  CompleteBtn: IN_PROGRESS sessions only
## [3.32.0] - 2026-08-25

### Added -- Sprints 14-16: SalesInvoice schema extension, transaction hooks, ORM mapping

#### Sprint 14 -- SalesInvoice schema extension + Sales line hooks (commit 0f7624a4)
- Alembic v1373: 8 new columns on sales_invoices (salesperson_id, salesperson_name, terminal_id, counter_id, paid_amount, balance_amount, discount_amount, net_amount), 2 new indexes
- backend/app/services/sales_hook.py [NEW]: write_invoice_lines + write_loyalty_earn
  - write_invoice_lines: writes one sales_invoice_lines row per item on every POST /sales/invoices
  - write_loyalty_earn: writes loyalty_transactions EARN row + updates loyalty_members balance
  - Both injected atomically pre-commit in SalesService.create_sales_invoice
- backend/app/services/sales.py: db_invoice constructor wired with v1373 fields (getattr backward-compat)

#### Sprint 15 -- Loyalty REVERSAL hook + schema addendum (commit f28ca801)
- backend/app/schemas/sales.py: SalesInvoiceBase extended with 8 Optional v1373 fields (AliasChoices camelCase)
- backend/app/services/sales_hook.py: write_loyalty_redeem added
  - Reverses earn points on sales return, clamps to zero minimum
  - Inserts loyalty_transactions REVERSAL row + deducts loyalty_members.current_points_balance
  - Injected atomically pre-commit in SalesService.create_sales_return
- backend/app/services/sales.py: Sprint 15 REVERSAL hook at lines 630-642

#### Sprint 16 -- ORM model mapping + salesperson report SQL fix (commit this)
- backend/app/models/sales.py: SalesInvoice ORM model -- 8 v1373 columns declared (all with server_default=0 for numeric)
- backend/app/api/v1/sales_reports.py: _row() helper rewritten -- all getattr fallbacks removed
  - invoice_number -> invoice_no (confirmed ORM field)
  - total_amount   -> grand_total (correct sales_invoices column)
  - tax_amount     -> tax_total   (correct sales_invoices column)
  - Added: terminal, gross, paid, balance fields to _row() output
- backend/app/api/v1/sales_reports.py: salesperson-summary SQL corrected
  - SUM(total_amount) -> SUM(grand_total)
  - SUM(tax_amount)   -> SUM(tax_total)
  - AVG(net_amount)   -> AVG(grand_total)
- backend/app/api/v1/sales_reports.py: salesperson-sales ORM -- getattr fallbacks removed
## [3.31.0] - 2026-08-24

### Added -- Sprints 8-13: Shoper9 Legacy Migration Parity (Phase 1 Complete)

**Shoper9 EXE Parity Coverage:** 200+ menu entries analyzed across MnuNo 100/200/350/410/430/460/612/613/650.
**New API Files:** 7 new files. **New Endpoints:** 57 across 9 commits.
**Alembic migration:** v1372 (4 new tables: stock_takes, stock_count_lines, sales_invoice_lines, loyalty_transactions).

#### Sprint 8a -- Reports Portal (commit 0bad6f91)
- `reports.py` extended: 5 P1 endpoints covering 22 RPT IDs, 5 Studios (Billing, Inventory, Finance, CRM, Compliance)

#### Sprint 8b -- Business Ledger / Finance (commit a70c400b)
- `finance.py` [NEW]: 5 cash/counter report endpoints
- `GET /finance/cash-transactions` RPT-FIN-001 (SR210900)
- `GET /finance/counter-wise` RPT-FIN-002 (SR241700)
- `GET /finance/credit-note-status` RPT-FIN-003 (SR242000)
- `GET /finance/counter-summary` RPT-FIN-004 (SR241500)
- `GET /finance/advance-receipts` RPT-FIN-005 (SR231300)

#### Sprint 8c -- Governance Masters (commit 7dfd338b)
- `governance.py` [NEW]: 10 endpoints -- tax codes, HSN/SAC, GSTIN, payment terms, business rules, audit

#### Sprint 8d -- Inventory Reports (commit d2eec9e8)
- `inventory_reports.py` [NEW]: 6 RPT-INV endpoints
- balance (SR232100), movement (SR209800), availability (SR232200), aging (SR234200), goods-register (SR237400)

#### Sprint 9 -- Sales Reports + Finance Extensions (commit 73c63406)
- `sales_reports.py` [NEW]: 6 endpoints -- top-selling, day-wise, salesperson-sales/summary, returned-bills, node-wise
- `finance.py` extended: 4 new endpoints -- reconciliation, till-status, till-activity, credit-sale

#### Sprint 10 -- CRM Reports + Staff Management (commit 14ab50be)
- `crm_reports.py` [NEW]: walk-in register, mailer list, outstanding, bill-items (JSONB fallback)
- `staff.py` [NEW]: personnel catalogue, incentive definition (GET+POST), programs list
- Backed by confirmed DB tables: commission_participants, commission_rules, customers, loyalty_members

#### Sprint 11 -- Loyalty + Returns + Stock Adjustments (commit 219da0be)
- `inventory_reports.py` extended: returns (SR210200/SR239800), adjustments (SR211600/SR233700)
- `crm_reports.py` extended: loyalty member report, loyalty tier summary

#### Sprint 12 -- Physical Stock Management + Alembic v1372 (commit 627ce349)
- Migration v1372: stock_takes, stock_count_lines, sales_invoice_lines, loyalty_transactions
- `physical_stock.py` [NEW]: 5 endpoints
  - `GET /physical-stock/sessions` PHY-001 (SR323400)
  - `POST /physical-stock/sessions` PHY-002 (auto-numbered, MANAGER role guard)
  - `GET /physical-stock/sessions/{id}` PHY-003 (detail + lines)
  - `GET /physical-stock/variance` PHY-004 (SR211000 Physical vs Computed)
  - `PATCH /physical-stock/sessions/{id}/approve` PHY-005

#### Sprint 13 -- Sales Line-item + Loyalty Ledger (commit 5800c713)
- `sales_reports.py` extended: bill-items-live (RPT-SAL-013), size-wise (RPT-SAL-014), item-returns-live (RPT-SAL-015)
- `crm_reports.py` extended: loyalty-ledger (CRM-006, loyalty_transactions table)

### Technical Notes
- All table presence verified by live information_schema probe before each sprint
- SalesInvoice confirmed: no salesperson_id/discount_amount/net_amount columns (getattr fallbacks correct)
- sales_invoice_lines absent until Sprint 12; bill-items JSONB fallback superseded by bill-items-live
- NGP: 0 violations across all 9 commits; full 7-router regression passed every sprint


## [3.20.0] - 2026-07-15

### Changed -- MC2 Phase 5: Express Business Route Retirement

**Architecture:** Express is now a pure Auth Enforcement Gateway + SPA host.
All /api/v1/* business requests: Browser -> Express (auth check) -> FastAPI proxy -> FastAPI.

**Phase 5A â€” Audit-log migrated to FastAPI:**
- POST /api/v1/system/audit-logs (new FastAPI endpoint)
- apiFetch.ts recordAuditAction now calls apiFetchV1 (not Express)

**Phase 5B â€” 10 Express route modules unmounted from server.ts:**
pos, sales, purchase, inventory, numbering, terms, exchange, barcode, reports, customers
(Files tagged DEPRECATED, not deleted -- safe to remove v3.21.0)

**Phase 5C â€” flags.ts updated to v3.20.0:**
12 new USE_FASTAPI_* flags added (all true, removal v3.21.0)

**Tests:** 75/75 passed

**Deferred to Phase 6 (v3.21.0):**
- auth.ts migration (App.tsx uses raw fetch /api/auth/me)
- assistant.ts FastAPI stub
- Deprecated route file deletion


## [3.19.1-fix1] - 2026-07-15

### Fixed â€” MC2 Phase 4B model column corrections

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

### Added â€” MC2 Phase 4A: URL Contract Alignment

**Compatibility aliases (dual-mount, backward-safe):**
- `POST /api/v1/pos/shifts/open` â€” canonical POS shift open
- `POST /api/v1/pos/shifts/close/{id}` â€” canonical POS shift close
- `GET/POST /api/v1/sales/invoices` â€” canonical sales invoice list/create
- `GET/POST /api/v1/purchase/orders/` â€” canonical purchase order list/create
- `GET /api/v1/purchase/suppliers/` â€” canonical supplier list
- `GET /api/v1/health/flags` â€” feature flag health check endpoint

**Deprecated (removal: v3.20.0):**
- `POST /api/v1/shifts/open` â†’ use `/pos/shifts/open`
- `POST /api/v1/shifts/{id}/close` â†’ use `/pos/shifts/close/{id}`
- `GET/POST /api/v1/sales-invoices/` â†’ use `/sales/invoices`
- `GET/POST /api/v1/purchase-orders/` â†’ use `/purchase/orders/`

**Tests:** 65/65 passed (57 legacy + 8 new contract URL tests)


## [3.18.3] - 2026-07-15

### Refactored â€” Architectural Debt Cleanup

- `datetime.utcnow()` -> `datetime.now(timezone.utc)` across 8 first-party files
- Pydantic `class Config` -> `model_config = ConfigDict(...)` in 7 schema files (21 occurrences)
- FastAPI `@app.on_event("startup")` -> `asynccontextmanager lifespan()` in `main.py`

**Result:** Deprecation warnings: 680 -> 304 (55% reduction, 376 eliminated)
**Tests:** 57/57 passed â€” no regressions


## [3.18.2] - 2026-07-15

### Added â€” MC2 Phase 3: Purchase CANCEL/AMEND/Supplier UPDATE+DELETE

- `POST /api/v1/purchase-orders/{id}/cancel` â€” cancel a Confirmed PO (status=CANCELLED, soft-delete)
- `POST /api/v1/purchase-orders/{id}/amend`  â€” cancel original, create new Confirmed PO (strangler-fig pattern)
- `PUT  /api/v1/suppliers/{id}`              â€” partial update supplier contact details
- `DELETE /api/v1/suppliers/{id}`            â€” soft-delete supplier

### Service
- `PurchaseService.cancel_purchase_order()` â€” with RECEIVED guard
- `PurchaseService.amend_purchase_order()` â€” atomic cancel+create
- `PurchaseService.update_supplier()` â€” partial patch
- `PurchaseService.delete_supplier()` â€” soft-delete

### Schemas
- `SupplierUpdate`, `PurchaseOrderCancelRequest`, `PurchaseOrderAmendRequest`

### Tests
- 8 new integration tests; combined regression: 57/57 passed (POS+Sales+Purchase)


## [3.17.0] â€” 2026-07-14 â€” Master Data Consolidation

### Added
- **FastAPI Tier-1 Dynamic Lookups (`backend/app/models/master_lookup.py`, `backend/app/schemas/master_lookup.py`, `backend/app/api/v1/master_lookup.py`)** â€” Added dynamic schema-driven Master Type and Master Value persistence on FastAPI + PostgreSQL with JSON Schema validators cache and soft-delete features.
- **FastAPI Tier-2 Organization Structure (`backend/app/schemas/masters_tier2.py`, `backend/app/api/v1/masters.py`)** â€” Created REST endpoints and Pydantic validation schemas for Company, Branch, Store, and Warehouse.
- **Database Migrations (`backend/alembic/versions/93e07a92812b_add_master_values_soft_delete.py`, `backend/alembic/versions/96b45b17b8b1_drop_master_entities.py`)** â€” Generated migrations to add soft-delete fields to `master_values` and drop the decommissioned `master_entities` table.
- **Unit & Integration Tests (`backend/app/tests/t_masters_consol.py`)** â€” Built complete backend integration test suite.

### Changed
- **Frontend Master Management Cutover (`src/components/MasterMgmtTab.tsx`)** â€” Repointed all organizational and lookup fetches to `/api/v1/masters/...` using `apiFetchV1` to ensure token propagation and HREP alignment.
- **Alembic env config (`backend/alembic/env.py`)** â€” Added `master_types` and `master_values` tables to the allowed tables filter.

### Decommissioned
- **Express-side legacy master code** â€” Deleted `src/routes/masters.ts`, `src/routes/masterLookup.ts`, and `src/repositories/masterRepository.ts` and unmounted them from `server.ts`.
- **FastAPI legacy master model scaffolding** â€” Removed `backend/app/models/masters.py` and `backend/app/schemas/masters.py`.


## [3.16.0] â€” 2026-07-13 â€” Backend Tier 4 FastAPI Migration

### Added
- **SMRITI Product Image Framework (SPIF) v1.0 (`backend/app/services/spif.py`, `src/components/common/ProductImage.tsx`, `src/components/common/ImageDisplayPolicy.tsx`)** â€” Centralized product image support, auto-optimization (WebP transcode, maximum bounds scaling, and alpha channel flattening), tenant-isolated storage path persistence, React thumbnail/preview rendering, and dynamic configuration policies.
- **SMRITI Master Framework â€” Phase F.3 (`backend/app/models/barcode.py`, `src/routes/terms.ts`, `src/routes/barcode.ts`, `src/routes/system.ts`)** â€” Migrated terms library, terms defaults, terms snapshots, approval workflow logs, print templates, and print profiles configurations from memory arrays to PostgreSQL.
- **SMRITI Master Framework â€” Phase F.2 (`backend/app/services/numbering.py`, `src/routes/numbering.ts`, `src/lib/helpers.ts`)** â€” Migrated document number series configuration and atomic allocation engine to PostgreSQL and FastAPI `FOR UPDATE` transaction locks.
- **SMRITI Master Framework â€” Phase F.1 (`backend/app/models/inventory.py`, `src/routes/masters.ts`, `src/state/store.ts`)** â€” Migrated stores and warehouses master entities from legacy in-memory arrays to PostgreSQL tables via Alembic.
- **Masters Module (`backend/app/models/masters.py`)** â€” Added organizational branch/department master entities.
- **Numbering Engine (`backend/app/models/numbering.py`)** â€” Atomic sequence generation with select-for-update locking.
- **Terms & Conditions Engine (`backend/app/models/terms.py`)** â€” Defaults, snapshots, default resolution service.
- **Attributes & Variants (`backend/app/models/attributes.py`)** â€” Variant Cartesian generation service and schema definitions.
- **Barcode Studio (`backend/app/models/barcode.py`)** â€” Barcode definitions and layout designer stubs.
- **Data Exchange Hub (`backend/app/models/exchange.py`)** â€” DB table CSV dump/restore importer converter stubs.
- **AI Assistant (`backend/app/api/v1/ai.py`)** â€” Analytical AI forecasting stubs.
- **SMRITIDocker Repository** â€” Created standalone private Git repository for containerization, orchestration, and startup automation files.
- **One-Command Installers (`install.ps1`, `install.sh`)** â€” Added automated single-command installers for Windows, Linux, and macOS with prerequisite checking, stable Python detection, and visual branding.
- **System Configs & Tally (`backend/app/models/system.py`)** â€” Global system configurations registry.
- **Roles Module (`backend/app/models/role.py`)** â€” Permissions matrix mapping database entities.
- **Alembic Migration (`backend/alembic/versions/6bc445ac1554_add_tier_4_domains.py`)** â€” Automated schema changes for long-tail domains.
- **Regression Tests (`backend/app/tests/test_exchange.py`, `backend/app/tests/t_staff_verify.py`)** â€” Regression testing for data exchange task execution and staff response schemas.
- **Indian Market Formatters (`src/utils/indianFormat.ts`, `src/utils/hsnMaster.ts`)** â€” Frontend utility functions for lakh/crore grouping and HSN code GST rate determination.
- **Excel manual data entry grid (`src/components/ExcelGridEntrySec.tsx`)** â€” Spreadsheet-style grid interface supporting Arrow keyboard navigation, Excel copy-paste, and auto row creation.
- **Dynamic Business Templates (`backend/app/services/attributes.py`)** â€” Auto-seeding templates for Apparel, Footwear, Grocery, Electronics, and Jewellery directly into Postgres.
- **Extended Attributes (`backend/alembic/versions/d4e5f6a7b8c9_extend_attribute_definitions.py`)** â€” Added searchable, filterable, display order, default values, and tooltips columns in Postgres.
- **Dynamic Attributes Search (`backend/app/repositories/product.py`)** â€” Cast JSONB properties to text for global matching in PostgreSQL GIN indexes.
- **Enterprise Label Printing Framework (ELPF) (`backend/app/models/barcode.py`, `src/components/LabelPrintingSec.tsx`)** â€” 3-step thermal ZPL print wizard, raw TCP/IP socket connection dispatcher, print history logger, and system config settings persistence.
- **Dynamic Barcode PRN Template Mapping (`backend/app/api/v1/barcode.py`, `src/components/LabelPrintingSec.tsx`)** â€” Replaced hardcoded print field replacements with dynamic key traversal of all item attributes, preserved all pasted CSV column headers in state, and added an interactive variable insertion guide with standard and dynamic column click badges.
- **Default User Seeding (`src/state/store.ts`)** â€” Seeded default users (`super` / `whynothing`, `manager`, `cashier`) in flat-file database initialization.
- **Login Quick Actions (`src/components/LoginScreen.tsx`)** â€” Added `super` user quick login button with System Admin access level.
- **Report User Role & Audit Logging** â€” Added read-only `Report User` role with write-block Express middleware protection, visual warning banners, disabled creation/edit inputs, context menu role mappings, and integration test coverage for audit logs.
- **Save Barcode as PRN File** â€” Extended PrintRequest schema and barcode REST api with an optional `saveAsPrn` flag to bypass thermal printer communication and download ZPL commands directly as a `.prn` file from the browser.

### Modified
- **`backend/app/models/auth.py`** â€” Extended User schema with 27 profile and setting fields.
- **`backend/app/tests/t_user_mgmt.py`** â€” Updated unit test assertions to match REST specifications.
- **`docker-compose.yml`** â€” Forwarded `SGIP_VAULT_MASTER_KEY` env parameters to Python container.
- **Data Exchange Backend (`backend/app/api/v1/exchange.py`)** â€” Fixed timezone offset database update constraint violation.
- **Staff User Schemas (`backend/app/schemas/user.py`)** â€” Standardized PaymentDetails schema to declare Aadhaar, PAN, PF UAN, ESIC, Father/Spouse name, Marital Status, Blood Group, and Permanent Address.
- **PAL Repository Layer (`src/core/interfaces/db.ts`, `src/bootstrap/di.ts`, `src/db/`)** â€” Implemented `IStateRepository` to abstract Express legacy `saveDb()` mutations and ensure 0 routes call `saveDb()` directly.
- **Express route unmount (`server.ts`, `src/routes/attributes.ts`)** â€” Retired all legacy attributes Express routing, migrating completely to FastAPI + Postgres.
- **`src/db/memory/MemoryRepositories.ts` & `src/db/postgres/PgRepos.ts`** â€” Fixed esbuild compilation failures on read-only ESM namespace property reassignments.
- **`src/masters_registry.ts` & `src/components/MasterMgmtTab.tsx`** â€” Refactored configuration schemas and Master Management tab to dynamically retrieve and render schema-driven lookup data generically from backend meta registries.


## [3.16.0] â€” 2026-07-12 â€” Form Standardization & Setup Defaults

### Added
- **`backend/app/templates/errors/`** â€” Created branded HTML base layout, landing page, and status code error templates for SEEF v1.0.
- **`backend/app/tests/test_seef.py`** â€” Added integration tests validating content negotiation and HTML/JSON status outputs.
- **`docs/implementation/foundation/SMRITI_Error_Experience_Framework_v1.0_Plan.md`** â€” SEEF v1.0 implementation plan.
- **`docs/walkthrough/foundation/Foundation_SEEF_v1.0_Error_Experience_v3.16.0.md`** â€” Walkthrough document for SEEF v1.0.
- **`src/constants/indianStates.ts`** â€” Shared Indian state constants.
- **`src/utils/validators.ts`** â€” Indian-market form validators (GSTIN, PIN, Mobile).
- **`src/utils/formatters.ts`** â€” Regional display formatters (date, datetime, currency).
- **`src/tests/validators.test.ts`** â€” Unit tests for the new validators and formatters.
- **`backend/app/compliance/`** â€” Built the complete bounded context compliance framework (Milestone 1 foundation) containing model persistence, cryptographically isolated credential vault, and registry system.
- **`backend/app/tests/test_inventory.py`** â€” Added regression testing for the product soft-delete API.
- **`backend/mypy-baseline.txt`** â€” Configured a mypy type error baseline to track legacy type warnings.
- **`docs/walkthrough/foundation/Foundation_SGIP_Milestone1_Compliance_Foundation_v3.16.0.md`** â€” Walkthrough document for SGIP Milestone 1.

### Changed
- **`backend/production.txt`** â€” Added `jinja2==3.1.4` dependency.
- **`backend/app/core/errors.py`** â€” Expanded HREP error dictionary catalog to support custom titles and new error families (SMRITI-AUTH, SMRITI-CONN, SMRITI-CFG, SMRITI-INT).
- **`backend/app/core/error_handlers.py`** â€” Integrated template rendering, content negotiation (`Accept: text/html` vs `application/json`), and backward-compatible JSON error formats.
- **`backend/app/main.py`** â€” Registered `GET /` API landing page endpoint displaying service diagnostic parameters, tracked application uptime, and consolidated import structures.
- **`backend/app/api/v1/inventory.py`** â€” Fixed a runtime crash (`AttributeError` on `TenantContext.user_id`) in product soft-deletion by correctly extracting user identity from request dependencies.
- **`backend/app/repositories/base.py`** â€” Type-safely bound repository models to `BaseEntity`.
- **`backend/pyproject.toml` & `.github/workflows/ci.yml`** â€” Enforced automated baseline-filtered MyPy type checks in the build pipeline.
- **Setup Wizard Defaults** â€” Updated default demo seeding company to "AITDL NETWORKS" located at GIDA Gorakhpur, Uttar Pradesh, with "Pushpa" (9324117007) as default contact.
- **Form Controls** â€” Integrated street address, landmark, and state selection dropdowns into the setup wizard store registration form. Enforced GSTIN and Pincode validation gates before transitioning wizard steps.
- **Validation Standardization** â€” Replaced ad hoc regular expression checks in `SalesStudioTab.tsx` and `src/routes/customers.ts` with shared helpers.
- **`backend/app/tests/conftest.py`** â€” Set up a session-scoped event loop to prevent async loop mismatch issues across test suites.
- **`backend/pyproject.toml`** â€” Wired python paths and silenced FastAPI parameter warnings.

## [3.15.0] â€” 2026-07-12 â€” Database Unification & Security Hardening

### Added
- **`src/middleware/sessionResolver.ts`** â€” New global Express middleware decoding session tokens, mounting active user objects, and enriching downstream request headers with permission context.
- **`src/tests/helpers.test.ts` & `src/tests/auth.test.ts`** â€” Standalone characterization test suites to protect password verification and failed-attempt account locking pipelines.
- **`src/tests/numbering.test.ts` & `src/tests/gst.test.ts`** â€” Unit tests covering the voucher numbering sequences and the dynamic GST 2.0 price-tier tax calculations.
- **`.github/workflows/ci.yml`** â€” Continuous integration pipeline running linter and Vitest suite on push/pull requests.

### Changed
- **Database Refactoring** â€” Decoupled route modules (`auth`, `users`, `customers`, `pos`, `sales`, `purchase`) from direct `saveDb()` flat-file persistence, routing operations through Platform Abstraction Layer (PAL) DI container stubs.
- **FastAPI CORS Hardening** â€” Restricted FastAPI middleware origins using dynamic configuration properties and enforced strict `JWT_SECRET_KEY` requirements.
- **Security Hardening** â€” Upgraded PBKDF2 hash strength to 600,000 iterations and replaced all string-based RBAC cashier checks in `reports.ts`, `exchange.ts`, and `assistant.ts` with permission checks (`hasPermission`).

### Removed
- **Flat-File Serials** â€” Eliminated active disk-writing of sessions into flat-file databases (`db_store.json`), migrating authorization context to transient in-memory structures.

---

## [3.14.4] â€” 2026-07-11 â€” Alembic Schema Unification

### Added
- **`backend/alembic/versions/a1b2c3d4e5f6_add_missing_core_tables.py`** â€” New root-level migration creating all missing core tables with default auto-generated UUID columns.
- **Node-compatibility Columns** â€” Added columns `cashier`, `warehouse`, `branch`, `start_time`, `end_time`, `opening_cash`, `closing_cash`, `sales_count`, `sales_value` to `shifts` table to ensure seamless dual API support.

### Changed
- **`src/db/init.ts`** â€” Removed direct schema.sql DDL executions, moving database connection check and flat-file seeding to bootstrap.
- **`Dockerfile` & `docker-compose.yml`** â€” Removed COPY statements for `schema.sql`. Added wait health checks so Node standalone container initializes only after python-core schema migrations finish.
- **`db_store.json`** â€” Resolved data integrity and foreign key constraints for initial product IDs.

### Removed
- **`src/db/schema.sql`** â€” Deprecated and deleted from the repository.

---

## [3.13.0] â€” 2026-07-11 â€” Supplier Payments

### Added
- **`POST /api/v1/supplier-payments/`** â€” MANAGER/SYSADMIN records a payment to a supplier. Atomically decrements `supplier.outstanding` in the same transaction.
- **`GET /api/v1/supplier-payments/`** â€” Lists all payments; optional `?supplier_id=` filter.
- **`GET /api/v1/supplier-payments/{id}`** â€” Gets a single payment record.
- **`models/supplier_payment.py`** â€” `SupplierPayment` entity (extends `BaseEntity`).
- **`schemas/supplier_payment.py`** â€” `SupplierPaymentCreate` with Pydantic validators for amount > 0 and valid `payment_mode`; `SupplierPaymentResponse`.
- **`services/supplier_payment.py`** â€” `SupplierPaymentService` with overpayment guard and atomic outstanding decrement.
- **`alembic/versions/9862a004de1c`** â€” Creates `supplier_payments` table (19 columns).
- **10 new tests** in `t_supp_payment.py`.

### Business Rules Enforced
- Amount must be > 0 (Pydantic `field_validator` â†’ 422 on failure).
- `payment_mode` must be one of: `CASH`, `BANK_TRANSFER`, `CHEQUE`, `UPI` (422 on unknown mode).
- Payment amount must not exceed `supplier.outstanding` (overpayment guard â†’ 400).
- `supplier.outstanding` is decremented atomically within the same DB transaction as the payment record.
- CASHIER role cannot record payments (403).
- All queries scoped to `company_id + branch_id` tenant.

### Changed
- `models/__init__.py`, `alembic/env.py` â€” Added `SupplierPayment` imports; version â†’ 3.13.0.
- `main.py` â€” Registered `supplier_payment.router`; version â†’ 3.13.0.
- `config.py` â€” `VERSION = "3.13.0"`.
- `t_supp_payment.py` â€” Fixture expanded to clean purchase tables (FK-safe order) before suppliers, preventing FK violations from `test_purchase.py` leftovers.

### Test Results
```
82 passed, 472 warnings in 35.00s
```
72 prior tests continue to pass. 10 new supplier payment tests added.

---


### Added
- **`POST /api/v1/registers/`** â€” MANAGER/SYSADMIN creates a new POS cash register (physical counter).
- **`GET /api/v1/registers/`** â€” Lists all registers for the current tenant.
- **`GET /api/v1/registers/{id}`** â€” Gets a single register.
- **`POST /api/v1/shifts/open`** â€” Any authenticated user opens a shift on a register with an opening cash balance. Only one shift may be OPEN per register at a time.
- **`POST /api/v1/shifts/{id}/close`** â€” Closes an open shift: aggregates all linked `SalesInvoice` records by `payment_mode` (CASH/CARD/UPI), computes `expected_cash = opening_balance + cash_sales_total`, `variance = closing_balance âˆ’ expected_cash`.
- **`GET /api/v1/shifts/active/{register_id}`** â€” Gets the currently open shift for a register; returns 404 if none (POS UI cue to prompt shift open).
- **`GET /api/v1/shifts/`** â€” Lists all shifts; optional `?register_id=` filter.
- **`GET /api/v1/shifts/{id}`** â€” Gets a specific shift by ID.
- **`models/pos.py`** â€” `CashRegister`, `Shift` (both extend `BaseEntity`).
- **`schemas/pos.py`** â€” `CashRegisterCreate/Response`, `ShiftOpen`, `ShiftClose`, `ShiftResponse`.
- **`services/pos.py`** â€” `POSService` with full validation, one-open-shift guard, and shift close reconciliation.
- **`alembic/versions/cc8a527deb42`** â€” Creates `cash_registers`, `shifts`; adds `shift_id` and `payment_mode` columns to `sales_invoices`.
- **10 new tests** in `test_pos.py`.

### Business Rules Enforced
- Only one shift may be OPEN per register at a time; second open returns 400.
- Opening balance must be >= 0.
- Closing a CLOSED shift returns 400.
- `expected_cash = opening_balance + cash_sales_total` (only CASH mode sales count towards expected float).
- `variance = closing_balance âˆ’ expected_cash` (positive = overage, negative = short).
- Register and shift both scoped to `company_id + branch_id` tenant.
- CASHIER role cannot create registers (403); any authenticated user can open/close a shift.

### Changed
- `models/sales.py` â€” Added `shift_id` (nullable FK to `shifts`) and `payment_mode` (`CASH|CARD|UPI|CREDIT`, default `CASH`).
- `main.py` â€” Registered `pos.router` at `/api/v1`; version â†’ 3.12.0.
- `config.py` â€” `VERSION` bumped to `3.12.0`.
- `models/__init__.py`, `alembic/env.py` â€” Added POS model imports.

### Migration Note
The pre-existing `shifts` table (from an earlier, different schema with `profile_id`, `sales_count`) was detected during `alembic autogenerate`. It was dropped and recreated with the correct schema via a direct SQL repair script. The `CREATE TABLE IF NOT EXISTS` guard was used in the migration to handle idempotency.

### Test Isolation Fix
The `test_pos.py` autouse fixture was upgraded to a `try/finally` teardown pattern that cleans POS tables in FK-safe order (`sales_invoices` â†’ `shifts` â†’ `cash_registers` â†’ `users`) after every test, preventing FK violations in subsequent test modules.

### Test Results
```
72 passed, 381 warnings in 29.75s
```
62 prior tests continue to pass. 10 new POS tests added.

---

## [3.11.0] â€” 2026-07-11 â€” Purchase Module

### Added
- **`POST /api/v1/suppliers/`** â€” MANAGER/SYSADMIN creates a new supplier master record.
- **`GET /api/v1/suppliers/`** â€” Lists all suppliers scoped to the current tenant.
- **`GET /api/v1/suppliers/{supplier_id}`** â€” Retrieves a single supplier.
- **`POST /api/v1/purchase-orders/`** â€” MANAGER/SYSADMIN creates a confirmed Purchase Order; calculates subtotal, tax, and grand total per line item. Stock is NOT updated at this stage.
- **`GET /api/v1/purchase-orders/`** â€” Lists all purchase orders for the tenant.
- **`GET /api/v1/purchase-orders/{order_id}`** â€” Retrieves a purchase order with line items.
- **`POST /api/v1/purchase-receipts/`** â€” MANAGER/SYSADMIN posts a Goods Receipt Note (GRN); atomically increments `product.stock` by `quantity_received` and increments `supplier.outstanding` by `grand_total`.
- **`GET /api/v1/purchase-receipts/`** â€” Lists all GRNs for the tenant.
- **`GET /api/v1/purchase-receipts/{receipt_id}`** â€” Retrieves a GRN with line items.
- **`models/purchase.py`** â€” `Supplier`, `PurchaseOrder`, `PurchaseOrderItem`, `PurchaseReceipt`, `PurchaseReceiptItem` (all extend `BaseEntity` for automatic tenant scope).
- **`schemas/purchase.py`** â€” Full Pydantic input/output schemas for all purchase entities.
- **`services/purchase.py`** â€” `PurchaseService` with full validation: supplier/product tenant ownership, non-empty items, positive quantities, PO linkage.
- **Alembic migration `59cbc26b919c`** â€” Creates all 5 purchase tables.
- **10 new tests** in `test_purchase.py`.

### Business Rules Enforced
- Supplier must belong to the same tenant (company + branch) as the order/receipt.
- Products must belong to the same tenant before they can be ordered or received.
- PO creation does NOT update stock â€” only a posted GRN updates stock.
- `quantity_received` must be > 0; zero quantity returns 400.
- GRN increments `supplier.outstanding` (accounts-payable liability tracker).
- CASHIER role cannot create suppliers, purchase orders, or GRNs â€” returns 403.
- Duplicate order_no / receipt_no returns 400 with a plain business message.

### Changed
- `main.py` â€” registered `purchase.router` at `/api/v1`; version â†’ 3.11.0.
- `config.py` â€” `VERSION` bumped to `3.11.0`.
- `models/__init__.py` â€” added purchase model exports.
- `alembic/env.py` â€” added purchase model imports.

### Migration Note
The autogenerate produced an empty migration (models were registered in `env.py` after `autogenerate` scanned). The migration DDL was written manually and verified against the SQLAlchemy model column definitions. Tables were confirmed present in PostgreSQL before tests were run.

### Test Results
```
62 passed, 296 warnings in 25.51s
```
52 prior tests continue to pass. 10 new purchase tests added.

---

## [3.10.0] â€” 2026-07-11 â€” User Management

### Added
- **`POST /api/v1/users/`** â€” SYSADMIN creates a new platform user with role + tenant assignment.
- **`GET /api/v1/users/`** â€” SYSADMIN lists all users with optional `?role=` and `?company_id=` filters and pagination (`skip`, `limit`).
- **`GET /api/v1/users/{user_id}`** â€” SYSADMIN can retrieve any user; non-SYSADMIN may only retrieve their own profile.
- **`PATCH /api/v1/users/{user_id}`** â€” SYSADMIN updates email, mobile, role, is_active, company/branch assignment.
- **`POST /api/v1/users/{user_id}/deactivate`** â€” SYSADMIN soft-deactivates a user (sets `is_active=False`, `is_deleted=True`); blocked for self-deactivation.
- **`PATCH /api/v1/users/me/password`** â€” Any authenticated user changes their own password; requires correct current password and minimum 8-character length.
- **`UserService`** (`services/user.py`) â€” create, list, get, update, deactivate, change_password; all DB mutations wrapped in `IntegrityError` handlers per HREP.
- **`schemas/user.py`** â€” `UserCreate`, `UserUpdate`, `PasswordChange`, `UserResponse`, `UserListResponse`.
- **17 new tests** in `t_user_mgmt.py` â€” CRUD, RBAC guards, duplicate username rejection, self-deactivate protection, wrong-password and short-password rejection.

### Changed
- `main.py` â€” registered `users.router` at `/api/v1/users`; version bumped to 3.10.0.
- `config.py` â€” `VERSION` bumped to `3.10.0`.
- `test_auth.py` fixture â€” added explicit `DELETE FROM users` + `DELETE FROM refresh_token_blacklist` before each test to prevent bootstrap-blocked false positives across runs.

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

## [3.9.0] â€” 2026-07-11 â€” Authentication Layer

### Added
- **JWT Authentication** (`python-jose[cryptography]`) â€” HS256-signed access tokens (60-min) and refresh tokens (7-day).
- **`POST /api/v1/auth/bootstrap`** â€” first-run SYSADMIN account creation; blocked when users exist.
- **`POST /api/v1/auth/login`** â€” returns `access_token` + `refresh_token` + `role`.
- **`POST /api/v1/auth/refresh`** â€” exchange refresh token for new access token; rejects blacklisted tokens.
- **`POST /api/v1/auth/logout`** â€” writes token JTI to `refresh_token_blacklist` table; idempotent.
- **`GET /api/v1/auth/me`** â€” returns authenticated user profile.
- **`User` model** (`users` table) â€” id, uuid, username, email, mobile, hashed_password, role (SYSADMIN/MANAGER/CASHIER/VIEWER), company_id, branch_id, is_active.
- **`RefreshTokenBlacklist` model** (`refresh_token_blacklist` table) â€” JTI-based revocation.
- **`get_current_user` dependency** â€” decodes Bearer JWT, loads User from DB, raises 401 on invalid/expired tokens.
- **`require_role(*roles)` guard factory** â€” raises 403 if caller's role is not in the allowed set.
- **Role enforcement on write endpoints**: `POST /products/` â†’ MANAGER/SYSADMIN only; `POST /customers` â†’ CASHIER+; `POST /customer-groups` â†’ MANAGER+; `POST /sales-invoices/` â†’ CASHIER+.
- **All read endpoints** now require authentication (any valid role).
- **Alembic migration** `8cf33df7b76a_add_users_and_token_blacklist` â€” creates `users` and `refresh_token_blacklist` tables.
- **14 new tests** in `test_auth.py` â€” bootstrap, login, /me, refresh, logout+blacklist, RBAC guards.
- `passlib[bcrypt]==1.7.4` â€” replaces custom PBKDF2 hashing.

### Changed
- `core/security.py` â€” fully rewritten: `hash_password` now uses bcrypt; `create_access_token` uses `python-jose`; new `create_refresh_token()` and `decode_token()` added.
- `api/deps.py` â€” `get_tenant_context` now reads `company_id`/`branch_id` from the validated JWT token (not X-Company-Id/X-Branch-Id headers).
- `config.py` â€” `ACCESS_TOKEN_EXPIRE_MINUTES` set to 60; `REFRESH_TOKEN_EXPIRE_DAYS=7` added.
- `t_tenant_isolate.py` â€” autouse fixture now also overrides `get_current_user` and `get_tenant_context`; tests use `set_test_tenant()` contextvar helper instead of HTTP headers.
- All version headers bumped to 3.9.0.

### Test Results
```
35 passed, 122 warnings in 8.93s
```
All 21 prior tests continue to pass. 14 new auth tests added.

---

## [3.8.0] â€” 2026-07-11

### Added
- Plumbed `TenantContext` in `backend/app/api/deps.py` extracting and validating `X-Company-Id` and `X-Branch-Id` headers against active records.
- Implemented `Company` and `Branch` SQLAlchemy models in `backend/app/models/tenant.py` and schemas in `backend/app/schemas/tenant.py`.
- Scaffolded Alembic migrations adding `companies`/`branches` tables, and nullable Foreign Key constraints to existing tables (`products`, `customers`, `customer_groups`, `sales_invoices`) pointing to tenants.
- Created `CustomerRepository` and `SalesInvoiceRepository` extending `BaseRepository` with tenant-scoped searches.
- Implemented REST API routers for inventory (`/api/v1/products`), crm (`/api/v1/customers` and `/api/v1/customer-groups`), and sales (`/api/v1/sales-invoices`).
- Added robust integration/unit tests in `backend/app/tests/t_tenant_isolate.py` validating 6 tenant isolation constraints including a concurrent-write race-condition test.
- Created `backend/Dockerfile` and `backend/entrypoint.sh` â€” runs `alembic upgrade head` then starts gunicorn with UvicornWorker.
- Added `python-core` service to `docker-compose.yml` wiring the FastAPI backend with healthcheck and `db` dependency.

### Changed
- Refactored `BaseRepository` query layer to automatically inject tenant filters on reads and stamp tenant IDs on creations.
- Plumbed `TenantContext` propagation through `InventoryService`, `CrmService`, and `SalesService` checking duplicates and stock levels within tenant boundaries.
- Updated FastAPI bootstrap in `backend/app/main.py` and Alembic config in `backend/alembic/env.py`.
- Wrapped `await self.db.commit()` in `create_product`, `create_customer_group`, `create_customer`, and `create_sales_invoice` with `try/except IntegrityError` â€” concurrent duplicate inserts return HTTP 400 with business-language detail instead of an unhandled 500 traceback (per HREP Rule 1).

---

## [3.7.0] â€” 2026-07-11

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

## [3.6.0] â€” 2026-07-11

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

## [3.5.0] â€” 2026-07-11

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

## [3.4.0] â€” 2026-07-11

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

## [3.3.0] â€” 2026-07-11

### Changed
- Standardized project-wide headers across all eligible first-party source, script, style, and documentation files to uniform AITDL NETWORKS branding, copyright, and founding leadership metadata.
- Preserved existing file created dates and codebase versions while updating modified dates.

### Documentation
- Created implementation plan `Project_Header_Standardization_Plan_v3.3.0.md` and walkthrough `Project_Header_Standardization_Walkthrough_v3.3.0.md`.
- Consolidated plans| Date | Walkthrough Version | Module / Topic | Walkthrough Document | Related Plan | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 2026-08-24 | v3.25.0 | Blueprint UI/Experience Engine & Integration Hub Registry | [Walkthrough](./foundation/Blueprint_UIExperience_IntegrationHub_v1.0.md) | â€” | Completed |

### Added
- Created `src/db/pool.ts` to manage PostgreSQL connection pools.
- Created `src/db/schema.sql` defining database schemas, relational foreign keys, GIN-indexed JSONB columns, and optimized computed fields.
- Created `src/db/init.ts` containing automatic database migration execution and JSON data seeding scripts.

---

## [2.1.4] â€” 2026-07-11

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

## [2.1.3] â€” 2026-07-11

### Added
- Created `src/components/ErrorBoundary.tsx` component to handle individual workspace tab crashes.

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

## [2.1.2] â€” 2026-07-11

### Added
- Integrated central middleware audit logging on all backend mutating HTTP endpoints (POST, PUT, DELETE).
- Created `/api/customers` and `/api/customers/groups` endpoints.

### Changed
- Upgraded `/api/pos/checkout` to support split payment tenders and credit account mappings.
- Bound terminal hotkey events (F2, F3, F12, Escape) to corresponding operations inside the POS billing engine.

---

## [2.1.1] â€” 2026-07-10

### Changed
- Modernized subview layouts and animations in the Sales & Commerce Studio (`SalesStudioTab.tsx`).
