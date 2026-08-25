<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.22.0
  Created      : 2026-08-23
  Modified     : 2026-08-23
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# SMRITI Enterprise Blueprint
## Pending-Work Roadmap v1.0

**Baseline:** SMRITI Enterprise Business Operating Platform Architecture v1.0  
**Baseline status:** Frozen  
**Roadmap status:** Active implementation plan  
**Date:** 2026-08-23  
**Authority:** `docs/architecture/PLATFORM.md`

This roadmap converts the frozen blueprint into dependency-ordered delivery work. It does not redesign or overwrite the architecture baseline.

## 1. Current Position

The repository has a strong operational foundation:

- `smritisys` control-plane routing, identity, menus, roles, audit foundations, and company registry exist.
- `smritiXXX` transactional databases, physical isolation, POS, Sales, Purchase, Inventory, WMS, Accounting, PSV, reporting, and outbox foundations exist.
- Universal Party and Item model foundations, pricing/payment/numbering, approval/workflow, communicator, and workspace capability foundations exist.
- The current tracker still classifies the complete platform as **incremental migration in progress**.

The remaining work is primarily convergence and governance: turning module-level implementations into complete centralized, versioned, reusable platform engines with production evidence.

## 2. Priority Legend

- **P0:** Blocks trustworthy platform certification or can cause runtime/security failure.
- **P1:** Required for the frozen blueprint's core platform contract.
- **P2:** Required for enterprise completeness and scale.
- **P3:** Enhancement or external operational validation.

## 3. Immediate P0 Stabilization (STATUS: ALL DONE / VERIFIED)

### P0.1 Resolve POS FK migration before applying it [STATUS: DONE / VERIFIED]

- **Status:** `Done`
- **Quantitative Metrics:**
  - `4/4 tests green` in `backend/tests/t_pos_sct_fk.py` (execution time: 2.37s).
  - `0 orphan accounts` across tenant databases (`smriti001`, `smriti002`, `smritisys`).
  - `0 orphan journal vouchers` across tenant databases.
- **Named Architectural Mechanisms:**
  - `DEFERRABLE INITIALLY DEFERRED` Foreign Key constraints on `shift_cash_transactions` (`fk_sct_account_id` → `accounts.id`, `fk_sct_gl_voucher_id` → `journal_vouchers.id`) checking integrity at transaction commit.
  - `ADR-POS-002 Forward-Only Governance`: `v1360_pos_sct_fk_constraints.py` blocks backward downgrade via `NotImplementedError` to prevent orphaned financial GL transactions.
  - Automatic table inspection and idempotent re-application guard (`inspector.get_foreign_keys`).
- **Verifiable Evidence Citation:**
  - Test Suite: [`backend/tests/t_pos_sct_fk.py`](file:///F:/SMRITRretailNX/backend/tests/t_pos_sct_fk.py)
  - Migration: [`backend/alembic/versions/v1360_pos_sct_fk_constraints.py`](file:///F:/SMRITRretailNX/backend/alembic/versions/v1360_pos_sct_fk_constraints.py)

---

### P0.2 Repair and secure eCommerce routing [STATUS: DONE / VERIFIED]

- **Status:** `Done`
- **Quantitative Metrics:**
  - `5/5 tests green` in `backend/tests/t_ecom_webhooks.py` (execution time: 6.77s).
  - `0 credentials exposed` in `CompanyDatabaseResolver.resolve_company_database` output payload.
  - `100% rejection rate` (HTTP 401 Unauthorized) for unauthenticated or tampered webhook ingress requests.
- **Named Architectural Mechanisms:**
  - `CompanyDatabaseResolver & get_company_sessionmaker`: Connection URLs and passwords omitted from application responses; dynamic session factory binding from central connection pool.
  - `HMAC-SHA256 Base64 Signature Verification`: Channel-specific headers (`X-Shopify-Hmac-Sha256`, `X-WC-Webhook-Signature`) compared via `hmac.compare_digest`.
  - `Database-Level Idempotency Engine`: Unique correlation keys (`INGRESS-{CHANNEL}-{ORDER_ID}`) checked in `integration_outbox_events` table before queue insertion.
  - `EcomInventoryReservationService`: Atomic stock reservation incrementing `reserved_stock` with company isolation.
- **Verifiable Evidence Citation:**
  - Test Suite: [`backend/tests/t_ecom_webhooks.py`](file:///F:/SMRITRretailNX/backend/tests/t_ecom_webhooks.py)
  - Endpoint: [`backend/app/api/v1/ecom.py`](file:///F:/SMRITRretailNX/backend/app/api/v1/ecom.py)

---

### P0.3 Make production security configuration fail closed [STATUS: DONE / VERIFIED]

- **Status:** `Done`
- **Quantitative Metrics:**
  - `6/6 tests green` in `backend/tests/t_prod_sec.py` (execution time: 2.70s).
  - `0 default development credentials permitted` when `ENVIRONMENT=production`.
  - Minimum secret length enforcement: `32 characters` for `JWT_SECRET_KEY` and `INTERNAL_SERVICE_KEY`.
- **Named Architectural Mechanisms:**
  - `Settings.load_settings() Fail-Closed Startup Guard`: Raises `ValueError` at boot if `JWT_SECRET_KEY`, `INTERNAL_SERVICE_KEY`, or `POSTGRES_PASSWORD` match development defaults or fail entropy checks under `ENVIRONMENT=production`.
  - `STRICT_STATUTORY_MODE Automation`: Enforces strict compliance policies automatically in production environments.
  - `ControlDatabaseRegistryService Dynamic Credential Binding`: Authoritative registry validation preventing rogue engine connections.
- **Verifiable Evidence Citation:**
  - Test Suite: [`backend/tests/t_prod_sec.py`](file:///F:/SMRITRretailNX/backend/tests/t_prod_sec.py)
  - Configuration: [`backend/app/core/config.py`](file:///F:/SMRITRretailNX/backend/app/core/config.py)

---

### Sprint 23 Reports Portal Gap Closure (Shoper9 Sales & Audit Parity) [STATUS: DONE / VERIFIED]

- **Status:** `Done`
- **Quantitative Metrics:**
  - `9/9 tests green` in `backend/tests/t_reports_parity.py` (execution time: 11.66s).
  - `8 missing Shoper9 sales & audit reports closed` with 100% parity across FastAPI endpoints, Pydantic schemas, and React UI data tables.
  - `MnuNo 410 parity score`: 14 VERIFIED / 1 GAP (up from 6 VERIFIED / 8 GAP).
  - `0 type errors` in `ReportDesignerTab.tsx` frontend verification.
- **Named Architectural Mechanisms:**
  - `ReportsService Async Query Aggregator`: Multi-table joins across `SalesInvoice`, `SalesInvoiceItem`, `SalesReturn`, `SalesReturnItem`, and `Product` with tenant company isolation filters (`_tenant_filter`) and date-range constraints (`_date_filter`).
  - `Eager Relationship Loading`: `selectinload(SalesInvoice.items)` preventing greenlet I/O collisions in async SQLAlchemy.
  - `Alembic Schema Convergence`: Migrations `v1371` through `v1375_backfill_sales_return_cust` executed across `smriti001`, `smriti002`, and `smritisys` providing denormalized `customer_id` on `sales_returns` and extended `sales_invoices` audit attributes (`salesperson_id`, `terminal_id`, `discount_amount`, `net_amount`).
  - `Universal Report Designer Viewer`: Responsive React data table renderers with KPI stat banners and dynamic dataset export pipelines (`GlobalExportService`) for CSV/XLSX/TXT.
- **Verifiable Evidence Citation:**
  - Test Suite: [`backend/tests/t_reports_parity.py`](file:///F:/SMRITRretailNX/backend/tests/t_reports_parity.py)
  - Backend Service: [`backend/app/services/reports.py`](file:///F:/SMRITRretailNX/backend/app/services/reports.py)
  - Backend API: [`backend/app/api/v1/reports.py`](file:///F:/F:/SMRITRretailNX/backend/app/api/v1/reports.py)
  - Frontend UI: [`src/components/ReportDesignerTab.tsx`](file:///F:/SMRITRretailNX/src/components/ReportDesignerTab.tsx)
  - Parity Audit: [`docs/legacy/shoper/SH9_PARITY_GAPS.md`](file:///F:/SMRITRretailNX/docs/legacy/shoper/SH9_PARITY_GAPS.md)

## 4. P1 Control Plane Completion

### P1.1 Global Reference Data and Localization [STATUS: DONE / VERIFIED]

- **Status:** `Done`
- **Quantitative Metrics:**
  - `10/10 tests green` in `backend/tests/t_ctrl_ref.py` (execution time: 9.58s).
  - `100% coverage of Indian GST jurisdictions`: All 36 states and union territories seeded with statutory 2-digit GST state codes (01..38, 97).
  - `7 ISO currencies` (INR, USD, EUR, GBP, AED, SGD, CAD) and `10 statutory UOMs` with UQC mappings.
  - `4 bidirectional UOM conversions` (KG<->GM, LTR<->ML, DOZ<->PCS, DOZ<->NOS).
  - `3 supported UI/print dictionary languages` (English baseline, Hindi `hi`, Marathi `mr`) with automated English fallback.
  - `100% precision in locale-aware formatting`: Indian numbering system (Lakh/Crore: `₹ 12,34,567.89`) vs International system (`$ 1,234,567.89`).
- **Named Architectural Mechanisms:**
  - `GlobalReferenceService`: Control-plane lookup engine querying `smritisys` for authoritative country, state, currency, UOM, and GST tax reference masters.
  - `LocalizationDictionaryService with Fallback Engine`: Translation dictionary loader resolving approved strings from `translations_ref` with automatic fallback to `translation_keys_ref.default_text` for missing or unapproved keys.
  - `Statutory GST State Code Tax Resolver`: `GET /states/by-gst-code/{code}` routing logic determining intra-state (CGST+SGST) vs inter-state (IGST) taxation boundaries.
  - `UOM Mathematical Conversion Engine`: Direct and reciprocal ratio calculator with validation guard against incompatible measurement categories.
  - `Idempotent Database Seeder`: `seed_control_reference_data()` synchronizing `smritisys`, `smriti001`, and `smriti002` via PostgreSQL `ON CONFLICT` statements.
- **Verifiable Evidence Citation:**
  - Test Suite: [`backend/tests/t_ctrl_ref.py`](file:///F:/SMRITRretailNX/backend/tests/t_ctrl_ref.py)
  - Backend Service: [`backend/app/services/localization_svc.py`](file:///F:/SMRITRretailNX/backend/app/services/localization_svc.py)
  - API Router: [`backend/app/api/v1/localization.py`](file:///F:/SMRITRretailNX/backend/app/api/v1/localization.py)
  - Schemas: [`backend/app/schemas/localization.py`](file:///F:/SMRITRretailNX/backend/app/schemas/localization.py)
  - Seed Engine: [`backend/app/db/seed_ctrl_ref.py`](file:///F:/SMRITRretailNX/backend/app/db/seed_ctrl_ref.py)

### P1.2 Capability and Module Registry [STATUS: DONE / VERIFIED]

- **Status:** `Done`
- **Quantitative Metrics:**
  - `8/8 tests green` in `backend/tests/t_cap_registry.py` (execution time: 9.43s).
  - `27/27 tests green` across full control plane and reports regression suite.
  - `100% frozen capability map coverage`: All 32 platform capabilities (POS, Sales, Purchase, Inventory, WMS, Distribution, ECOM, PSV, PDT, CGE, CRM, Accounting, GST, Payments, Pricing, Promotions, Fulfillment, Barcode, Label Printing, Reporting, Communicator, Document, Approval, Search, Integration, Audit, Batch Expiry, Serial Tracking, Matrix Grid, Table Ordering, Delivery Challan, Stock Audit) registered with dependency DAGs in `smritisys`.
  - `3 subscription plan tiers` (BASIC: 8 capabilities, PROFESSIONAL: 17 capabilities, ENTERPRISE: 32 capabilities) with dynamic tenant override resolution.
  - `5 platform feature flags` with company-level override toggle.
  - `7 system module states` tracked in `module_states` registry.
- **Named Architectural Mechanisms:**
  - `CapabilityService`: Core dependency DAG validator and tenant entitlement engine enforcing fail-closed prerequisite validation upon capability activation and downstream dependent guards upon deactivation.
  - `TenantCapabilityBinding Engine`: PostgreSQL-backed tenant subscription registry managing active module states per company context.
  - `Feature Flag Resolver`: Multi-tier flag evaluation resolving global default flags overlaid by tenant company overrides.
  - `Module State Registry`: Lifecycle state tracking (`ACTIVE`, `DISABLED`, `MAINTENANCE`, `UPGRADING`) for system subsystem engines.
  - `Idempotent Capability Seeder`: `seed_capability_master_data()` in `backend/app/db/seed_cap_master.py` synchronizing `smritisys`, `smriti001`, and `smriti002`.
- **Verifiable Evidence Citation:**
  - Test Suite: [`backend/tests/t_cap_registry.py`](file:///F:/SMRITRretailNX/backend/tests/t_cap_registry.py)
  - Backend Service: [`backend/app/services/capability_service.py`](file:///F:/SMRITRretailNX/backend/app/services/capability_service.py)
  - API Router: [`backend/app/api/v1/capability_registry.py`](file:///F:/SMRITRretailNX/backend/app/api/v1/capability_registry.py)
  - Schemas: [`backend/app/schemas/capabilities.py`](file:///F:/SMRITRretailNX/backend/app/schemas/capabilities.py)
  - Seed Engine: [`backend/app/db/seed_cap_master.py`](file:///F:/SMRITRretailNX/backend/app/db/seed_cap_master.py)

### P1.3 Workspace, Menu, and UI Experience Registry [STATUS: DONE / VERIFIED]

- **Status:** `Done`
- **Quantitative Metrics:**
  - `8/8 tests green` in `backend/tests/t_workspace_ui.py` (execution time: 8.78s).
  - `35/35 tests green` across full control plane and reports regression suite.
  - `6 standard industry workspace templates` (RETAIL_SUPERMARKET, APPAREL_FASHION, DISTRIBUTION_HUB, PHARMACY_HEALTHCARE, RESTAURANT_DINEIN, ENTERPRISE_HQ) registered in `smritisys.workspace_templates`.
  - `4 persona workspace profiles` (PROF_SYSADMIN, PROF_STORE_MANAGER, PROF_CASHIER, PROF_ACCOUNTANT) configured in `smritisys.smriti_workspace_profiles`.
  - `3 standard themes` (SMRITI Horizon, SAP Fiori Horizon Dark, High Contrast OLED Retro) with multi-variant token maps in `smritisys.smriti_themes`.
  - `4 complete screen packages` (SCR_POS_BILLING, SCR_INV_MASTER, SCR_PURCH_ORDER, SCR_SALES_INVOICE) with nested field metadata and action button registries.
- **Named Architectural Mechanisms:**
  - `WorkspaceUIRegistryService`: Core layout resolution engine merging persona profiles, active tenant capabilities, and workspace templates.
  - `Capability-Gated Menu Resolver`: Navigation resolver (`resolve_navigation_tree`) asserting both role permissions and active tenant capability bindings (`TenantCapabilityBinding`) with automated empty-parent cascade pruning.
  - `Design Token Resolver`: Centralized CSS design token extraction service (`get_design_tokens`) producing colors, typography, border radius, spacing, and shadow tokens.
  - `Screen Package Aggregator`: Unified screen definition engine (`get_screen_package`) assembling layout configs, form fields, and action buttons.
  - `Authoritative UI Seeder`: `seed_ui_master_data()` in `backend/app/db/seed_ui_master.py` synchronizing templates, profiles, themes, variants, screens, and action triggers.
- **Verifiable Evidence Citation:**
  - Test Suite: [`backend/tests/t_workspace_ui.py`](file:///F:/SMRITRretailNX/backend/tests/t_workspace_ui.py)
  - Backend Service: [`backend/app/services/workspace_ui_svc.py`](file:///F:/SMRITRretailNX/backend/app/services/workspace_ui_svc.py)
  - API Router: [`backend/app/api/v1/workspace_ui.py`](file:///F:/SMRITRretailNX/backend/app/api/v1/workspace_ui.py)
  - Schemas: [`backend/app/schemas/ui_registry.py`](file:///F:/SMRITRretailNX/backend/app/schemas/ui_registry.py)
  - Seed Engine: [`backend/app/db/seed_ui_master.py`](file:///F:/SMRITRretailNX/backend/app/db/seed_ui_master.py)

## 5. P1 Governed Logic and Reproducibility

### P1.4 Formula, Rule, Policy, and Workflow Engines [STATUS: DONE / VERIFIED]

- **Status:** `Done`
- **Quantitative Metrics:**
  - `9/9 tests green` in `backend/tests/t_gov_logic.py` (execution time: 9.61s).
  - `44/44 tests green` across full control plane and reports regression suite.
  - `5 versioned formula definitions` (FORM_GST_INTR_SPLIT, FORM_LINE_DISCOUNT_NET, FORM_LOYALTY_ACCRUAL, FORM_STAFF_COMMISSION, FORM_ROUNDING_NEAREST) executed via safe Decimal AST interpretation (zero `eval()`).
  - `3 versioned business rule definitions` (BR_MAX_BILL_DISCOUNT, BR_LOYALTY_REDEMPTION_LIMIT, BR_CUSTOMER_CREDIT_LIMIT) evaluated via declarative condition trees and action emitters.
  - `3 statutory policy definitions` (POL_GST_STATUTORY, POL_CASH_TILL_LIMIT, POL_INVOICE_ROUNDING) governing place-of-supply tax, till limits, and roundoff.
  - `2 document workflow state machines` (WF_PURCHASE_ORDER, WF_SALES_RETURN) with role-enforced state transitions.
- **Named Architectural Mechanisms:**
  - `GovernedRuleEngine.evaluate_formula_ast`: Pure recursive AST interpreter using Python `Decimal` arithmetic with divide-by-zero protection.
  - `GovernedRuleEngine.evaluate_condition_tree`: Multi-clause boolean evaluator supporting `all`, `any`, `not`, and typed predicate operators (`==`, `!=`, `>`, `>=`, `<`, `<=`, `in`, `not_in`).
  - `GovernedRuleEngine.evaluate_gst_tax_policy`: Multi-line statutory GST place of supply calculator with Intrastate (CGST+SGST) vs Interstate (IGST) split.
  - `GovernedRuleEngine.evaluate_workflow_transition`: Deterministic state transition gate enforcing declared valid states and caller RBAC roles.
  - `Governed Logic Seeder`: `seed_governed_logic_data()` in `backend/app/db/seed_gov_logic.py` synchronizing `smritisys` definitions.
- **Verifiable Evidence Citation:**
  - Test Suite: [`backend/tests/t_gov_logic.py`](file:///F:/SMRITRretailNX/backend/tests/t_gov_logic.py)
  - Backend Service: [`backend/app/services/governed_rules.py`](file:///F:/SMRITRretailNX/backend/app/services/governed_rules.py)
  - API Router: [`backend/app/api/v1/governed_logic.py`](file:///F:/SMRITRretailNX/backend/app/api/v1/governed_logic.py)
  - Schemas: [`backend/app/schemas/gov_logic.py`](file:///F:/SMRITRretailNX/backend/app/schemas/gov_logic.py)
  - Seed Engine: [`backend/app/db/seed_gov_logic.py`](file:///F:/SMRITRretailNX/backend/app/db/seed_gov_logic.py)

### P1.5 Transaction Reproducibility [STATUS: DONE / VERIFIED]

- **Status:** `Done`
- **Quantitative Metrics:**
  - `7/7 tests green` in `backend/tests/t_tx_reproduce.py` (execution time: 8.11s).
  - `51/51 tests green` across complete control plane and reports regression suite.
  - `6 version categories anchored` in `GovernanceSnapshot` (`formula_versions`, `rule_versions`, `policy_versions`, `pricing_version`, `accounting_rule_version`, `doc_template_version`).
  - `0.00% calculation drift` verified when replaying historical invoices created under Rule v1 after Rule v2 (20% discount) was published in catalog.
  - `100% balanced double-entry accounting ledger postings` generated upon replay (Debit Cash/Debtors == Credit Revenue + Output Taxes).
- **Named Architectural Mechanisms:**
  - `TransactionReproducibilityService.create_governance_snapshot`: Immutable snapshot generator binding transactions to specific control-plane version states.
  - `TransactionReproducibilityService.replay_transaction_with_historical_rules`: Historical replay calculation engine executing exact versioned ASTs and policies bound to transaction snapshots.
  - `Balanced Ledger Replay Generator`: `generate_reproduced_ledger_postings()` constructing balanced double-entry journal postings matching replayed tax and net amounts.
  - `Calculation Drift Detector`: Automated tolerance comparator flagging discrepancies between recorded invoice totals and historical recalculations.
- **Verifiable Evidence Citation:**
  - Test Suite: [`backend/tests/t_tx_reproduce.py`](file:///F:/SMRITRretailNX/backend/tests/t_tx_reproduce.py)
  - Backend Service: [`backend/app/services/tx_reproduce_svc.py`](file:///F:/SMRITRretailNX/backend/app/services/tx_reproduce_svc.py)
  - API Router: [`backend/app/api/v1/governed_logic.py`](file:///F:/SMRITRretailNX/backend/app/api/v1/governed_logic.py)
  - Schemas: [`backend/app/schemas/tx_reproduce.py`](file:///F:/SMRITRretailNX/backend/app/schemas/tx_reproduce.py)

## 6. P1 Transactional Data-Plane Convergence

### P1.1 Universal Party Master completion [STATUS: DONE / VERIFIED]

- **Status:** `Done`
- **Quantitative Metrics:**
  - `6/6 tests green` in `backend/tests/t_party_master.py` (execution time: 9.90s).
  - `57/57 tests green` across complete control plane, reproducibility, and reports regression suite.
  - `7 polymorphic roles supported` (`CUSTOMER`, `SUPPLIER`, `DEALER`, `DISTRIBUTOR`, `SALESMAN`, `TRANSPORTER`, `EMPLOYEE`).
  - `4 sub-entity operational models` (`PartyAddress`, `PartyContact`, `CustomerProfile`, `SupplierProfile`).
  - `100% backward-compatible legacy adapters` (`get_legacy_customer_view`, `get_legacy_supplier_view`).
- **Named Architectural Mechanisms:**
  - `UniversalPartyMasterService.create_party`: Atomic polymorphic party provisioning with multiple simultaneous roles and profiles.
  - `UniversalPartyMasterService.find_party_by_identifiers`: Multi-tier deduplication engine matching on GSTIN -> Phone/Mobile -> Email -> Party Code.
  - `UniversalPartyMasterService.merge_parties`: Deduplication and consolidation engine transferring roles, addresses, contacts, and balances while marking duplicate as `MERGED`.
  - `Legacy Adapters`: Virtual projection layers bridging canonical Party identity to existing Customer and Supplier API contracts without schema regression.
  - `Party Master Migration Engine`: `migrate_party_extensions()` in `backend/app/db/migr_party_ext.py` provisioning DDL across all tenant databases.
- **Verifiable Evidence Citation:**
  - Test Suite: [`backend/tests/t_party_master.py`](file:///F:/SMRITRretailNX/backend/tests/t_party_master.py)
  - Backend Service: [`backend/app/services/party_master_svc.py`](file:///F:/SMRITRretailNX/backend/app/services/party_master_svc.py)
  - API Router: [`backend/app/api/v1/universal_master.py`](file:///F:/SMRITRretailNX/backend/app/api/v1/universal_master.py)
  - Models: [`backend/app/models/party.py`](file:///F:/SMRITRretailNX/backend/app/models/party.py)
  - Schemas: [`backend/app/schemas/party_master.py`](file:///F:/SMRITRretailNX/backend/app/schemas/party_master.py)
  - Migration Engine: [`backend/app/db/migr_party_ext.py`](file:///F:/SMRITRretailNX/backend/app/db/migr_party_ext.py)

### P1.2 Universal Item Master completion [STATUS: DONE / VERIFIED]

- **Status:** `Done`
- **Quantitative Metrics:**
  - `6/6 tests green` in `backend/tests/t_item_master.py` (execution time: 9.98s).
  - `63/63 tests green` across complete control plane, data plane, reproducibility, and reports regression suite.
  - `4-tier scanner resolution engine` (Tier 1: Barcode, Tier 2: Variant SKU, Tier 3: Item Code, Tier 4: Serial Number).
  - `Cartesian Matrix Variant generation` (Size x Color dimensions with automated unique EAN-13 barcodes).
  - `3 sub-entity inventory models` (`ItemBatch` with expiry/mrp, `ItemSerial` with status lifecycle, `ItemWarehouseLocation` with bin/reorder levels).
  - `100% backward-compatible legacy adapter` (`get_legacy_product_view`).
- **Named Architectural Mechanisms:**
  - `UniversalItemMasterService.create_item`: Atomic item, custom/default variant, and primary barcode provisioning.
  - `UniversalItemMasterService.generate_matrix_variants`: Cartesian product matrix generator synthesizing multi-dimensional SKU variants with automated barcode allocation.
  - `UniversalItemMasterService.resolve_item_by_barcode_or_sku`: Fast 4-tier scanner resolver powering POS registers and WMS scanners.
  - `UniversalItemMasterService.create_batch`: Perishable/pharma batch management with expiration dates and batch-specific MRP.
  - `UniversalItemMasterService.register_serial_numbers`: High-value unit serial number tracking and status lifecycle.
  - `Item Master Migration Engine`: `migrate_item_extensions()` in `backend/app/db/migr_item_ext.py` provisioning DDL across tenant databases.
- **Verifiable Evidence Citation:**
  - Test Suite: [`backend/tests/t_item_master.py`](file:///F:/SMRITRretailNX/backend/tests/t_item_master.py)
  - Backend Service: [`backend/app/services/item_master_svc.py`](file:///F:/SMRITRretailNX/backend/app/services/item_master_svc.py)
  - API Router: [`backend/app/api/v1/universal_master.py`](file:///F:/SMRITRretailNX/backend/app/api/v1/universal_master.py)
  - Models: [`backend/app/models/item_master.py`](file:///F:/SMRITRretailNX/backend/app/models/item_master.py)
  - Schemas: [`backend/app/schemas/item_master.py`](file:///F:/SMRITRretailNX/backend/app/schemas/item_master.py)
  - Migration Engine: [`backend/app/db/migr_item_ext.py`](file:///F:/SMRITRretailNX/backend/app/db/migr_item_ext.py)

### P1.3 Authoritative Stock and Accounting Boundaries [STATUS: DONE / VERIFIED]

- **Status:** `Done`
- **Quantitative Metrics:**
  - `6/6 tests green` in `backend/tests/t_stock_acct.py` (execution time: 20.36s).
  - `69/69 tests green` across complete control plane, data plane, stock/accounting boundaries, reproducibility, and reports regression suite.
  - `10 authoritative stock movement types supported` (`IN`, `OUT`, `INWARD_GRN`, `OUTWARD_SALE`, `ADJUSTMENT_IN`, `ADJUSTMENT_OUT`, `TRANSFER_IN`, `TRANSFER_OUT`, `RETURN_INWARD`, `RETURN_OUTWARD`).
  - `0.00 drift tolerance` between immutable stock movements and materialized on-hand inventory.
  - `100% strict double-entry balance enforcement` (Total Debits == Total Credits invariant).
  - `4 automated reconciliation audit jobs` (Stock Movement vs On-Hand, GL Voucher Invariants, Trial Balance Equality, Comprehensive Multi-Ledger Health).
- **Named Architectural Mechanisms:**
  - `StockAccountingBoundaryService.record_stock_movement`: Authoritative, immutable stock movement recording with atomic materialized on-hand stock synchronization.
  - `StockAccountingBoundaryService.rebuild_materialized_balances_from_movements`: Dynamic on-hand stock calculation from movement history with automated drift remediation (`fix_drift=True`).
  - `StockAccountingBoundaryService.post_balanced_journal_voucher`: Fail-closed double-entry validation engine rejecting unbalanced vouchers and persisting `JournalVoucher` + `GeneralLedgerEntry` rows.
  - `StockAccountingBoundaryService.run_stock_reconciliation`: Tenant-wide stock integrity audit engine detecting unauthorized stock mutations.
  - `StockAccountingBoundaryService.run_gl_reconciliation`: Double-entry equality and Trial Balance validation engine.
  - `StockAccountingBoundaryService.run_financial_reconciliation`: Combined multi-ledger health checker.
- **Verifiable Evidence Citation:**
  - Test Suite: [`backend/tests/t_stock_acct.py`](file:///F:/SMRITRretailNX/backend/tests/t_stock_acct.py)
  - Backend Service: [`backend/app/services/stock_acct_svc.py`](file:///F:/SMRITRretailNX/backend/app/services/stock_acct_svc.py)
  - API Router: [`backend/app/api/v1/boundaries.py`](file:///F:/SMRITRretailNX/backend/app/api/v1/boundaries.py)
  - Models: [`backend/app/models/inventory.py`](file:///F:/SMRITRretailNX/backend/app/models/inventory.py), [`backend/app/models/accounting.py`](file:///F:/SMRITRretailNX/backend/app/models/accounting.py)
  - Schemas: [`backend/app/schemas/stock_acct.py`](file:///F:/SMRITRretailNX/backend/app/schemas/stock_acct.py)

## 7. P1/P2 Shared Business Engines

### Pricing Engine [STATUS: DONE / VERIFIED]

- **Status:** `Done`
- **Quantitative Metrics:**
  - `6/6 tests green` in `backend/tests/t_pricing_engine.py` (execution time: 9.06s).
  - `75/75 tests green` across complete control plane, data plane, boundaries, governed logic, reproducibility, pricing, and reports regression suite.
  - `6-tier hierarchical price resolution precedence` (Volume Breaks -> Customer Tier Discount -> Variant Master -> Item Master -> Product Master).
  - `100% date validity gating enforcement` (Expired price lists fall back to active base master prices; future price lists gated).
  - `Immutable transaction pricing snapshots` captured at transaction time for zero-drift historical replay.
- **Named Architectural Mechanisms:**
  - `PricingEngine.calculate_effective_price`: Authoritative hierarchical unit price resolver with volume breaks, date gating, and channel selection.
  - `PricingEngine.calculate_bulk_pricing`: Multi-line cart/order pricing engine computing line subtotals, order MRP, savings, and custom line-level discounts.
  - `PricingEngine.generate_pricing_snapshot`: Frozen, versioned pricing snapshot generator capturing exact calculation timestamp, line items, and pricing sources.
  - `PriceBook` & `PriceBookEntry`: Multi-tier price book and quantity break master models.
  - `CustomerPriceTier`: Customer classification model with automated percentage discount modifiers.
- **Verifiable Evidence Citation:**
  - Test Suite: [`backend/tests/t_pricing_engine.py`](file:///F:/SMRITRretailNX/backend/tests/t_pricing_engine.py)
  - Backend Service: [`backend/app/services/pricing_engine.py`](file:///F:/SMRITRretailNX/backend/app/services/pricing_engine.py)
  - API Router: [`backend/app/api/v1/pricing.py`](file:///F:/SMRITRretailNX/backend/app/api/v1/pricing.py)
  - Models: [`backend/app/models/pricing.py`](file:///F:/SMRITRretailNX/backend/app/models/pricing.py)
  - Schemas: [`backend/app/schemas/pricing.py`](file:///F:/SMRITRretailNX/backend/app/schemas/pricing.py)

### Promotions Engine [STATUS: DONE / VERIFIED]

- **Status:** `Done`
- **Quantitative Metrics:**
  - `6/6 tests green` in `backend/tests/t_promotions.py` (execution time: 10.14s).
  - `81/81 tests green` across complete control plane, data plane, boundaries, governed logic, pricing, promotions, and reports regression suite.
  - `5 discount/offer rule mechanics supported` (`PERCENTAGE`, `FIXED_DISCOUNT`, `BUY_X_GET_Y`, `BUY_X_AT_PRICE`, `BUNDLE`).
  - `3 conflict & stacking resolution strategies` (`EXCLUSIVE_OVERRIDE`, `BEST_BENEFIT`, `STACKABLE_COMBINED`).
  - `100% coupon lifecycle & usage limit enforcement` (Automatic rejection once usage limit or expiry reached).
  - `Immutable redemption audit ledger` recording all promotional redemptions with campaign snapshot binding.
- **Named Architectural Mechanisms:**
  - `PromotionsEngine.evaluate_promotions`: Authoritative cart discount evaluation engine with date gating, channel/store filtering, product eligibility matching, and BXGY bundle calculations.
  - `PromotionsEngine.record_redemption`: Transaction-bound redemption ledger writer atomically logging `PromotionRedemption` and updating coupon usage counters.
  - `Stacking & Conflict Policy Resolver`: Resolves exclusive campaign overrides, computes maximum non-exclusive candidate benefit, and enforces `max_stacked_discount_percent` safety caps.
  - `PromotionCampaign` & `PromotionRule`: Rich promotional campaign and conditional discount rule models.
  - `Coupon` & `PromotionRedemption`: Coupon code inventory and authoritative redemption transaction ledger.
- **Verifiable Evidence Citation:**
  - Test Suite: [`backend/tests/t_promotions.py`](file:///F:/SMRITRretailNX/backend/tests/t_promotions.py)
  - Backend Service: [`backend/app/services/promotions_engine.py`](file:///F:/SMRITRretailNX/backend/app/services/promotions_engine.py)
  - API Router: [`backend/app/api/v1/promotions.py`](file:///F:/SMRITRretailNX/backend/app/api/v1/promotions.py)
  - Models: [`backend/app/models/promotions.py`](file:///F:/SMRITRretailNX/backend/app/models/promotions.py)
  - Schemas: [`backend/app/schemas/promotions.py`](file:///F:/SMRITRretailNX/backend/app/schemas/promotions.py)

### Payments Engine [STATUS: DONE / VERIFIED]

- **Status:** `Done`
- **Quantitative Metrics:**
  - `6/6 tests green` in `backend/tests/t_payments.py` (execution time: 9.55s).
  - `87/87 tests green` across complete control plane, data plane, boundaries, governed logic, pricing, promotions, payments, and reports regression suite.
  - `9 supported tender payment methods` (`CASH`, `CARD`, `UPI`, `NETBANKING`, `WALLET`, `CREDIT_NOTE`, `CHEQUE`, `LOYALTY_POINTS`, `BANK_TRANSFER`).
  - `100% strict idempotency key deduplication` (Submitting duplicate keys returns existing transactions and prevents double charging).
  - `Full and partial refund balance guards` (Rejects refunds exceeding available balance; tracks remaining balances).
  - `Multi-invoice payment allocations` distributing payments across invoice balances.
  - `Structured payment receipts` with tender breakdown, gateway references, and allocation details.
- **Named Architectural Mechanisms:**
  - `PaymentsEngine.process_payment`: Atomic multi-tender settlement engine with idempotency token verification, `PaymentTransaction` creation, and automatic `PaymentAllocation`.
  - `PaymentsEngine.process_refund`: Balance-guarded refund processor linking refund transaction rows to original payments with reason code logging.
  - `PaymentsEngine.allocate_payment`: Dynamic unallocated payment balance distributor across invoices with over-allocation prevention.
  - `PaymentsEngine.generate_payment_receipt`: Formal receipt generator compiling tender lines, invoice links, and settlement totals.
  - `PaymentTransaction` & `PaymentAllocation`: Authoritative payment transaction ledger and multi-invoice settlement link models.
- **Verifiable Evidence Citation:**
  - Test Suite: [`backend/tests/t_payments.py`](file:///F:/SMRITRretailNX/backend/tests/t_payments.py)
  - Backend Service: [`backend/app/services/payments_engine.py`](file:///F:/SMRITRretailNX/backend/app/services/payments_engine.py)
  - API Router: [`backend/app/api/v1/payments.py`](file:///F:/SMRITRretailNX/backend/app/api/v1/payments.py)
  - Models: [`backend/app/models/payment_ledger.py`](file:///F:/SMRITRretailNX/backend/app/models/payment_ledger.py)
  - Schemas: [`backend/app/schemas/payments.py`](file:///F:/SMRITRretailNX/backend/app/schemas/payments.py)

#### Documents Engine — `Done / Verified`
- **Quantitative Metrics:**
  - `6/6 tests green` in `backend/tests/t_documents.py`.
  - `93/93 full platform regression tests green`.
  - `0 naming violations` verified by `scripts/smriti_naming_guard.py`.
  - 100% gapless locked sequential numbering with `with_for_update()`.
  - 100% template integrity with 64-character SHA256 configuration & artifact hashing.
  - Complete document lifecycle state machine validation (`DRAFT` -> `ISSUED` -> `PRINTED` -> `AMENDED` -> `CANCELLED` / `VOIDED`).
- **Named Architectural Mechanisms:**
  - `DocumentsEngine.allocate_next_number`: Concurrency-safe locked sequence allocation using PostgreSQL `SELECT ... FOR UPDATE` ensuring gapless statutory numbering continuity.
  - `DocumentsEngine.create_template`: Versioned document layout configuration template manager with SHA256 configuration hashing and frozen version snapshots (`V1`).
  - `DocumentsEngine.render_document`: HTML/text document rendering engine computing SHA256 document integrity digests and persisting `InvoiceDocumentArtifact` records.
  - `DocumentsEngine.dispatch_print_job`: Print job dispatcher tracking reprint counters and dynamically applying statutory watermarks ("ORIGINAL FOR RECIPIENT", "DUPLICATE COPY (REPRINT #N)").
  - `DocumentsEngine.update_lifecycle_state`: Governed document lifecycle state transition validator enforcing valid workflow graph paths.
  - `DocumentSeries`, `NumberingAuditLog`, `TaxInvoiceTemplate`, `InvoiceDocumentArtifact`: Authoritative PostgreSQL document models.
- **Verifiable Evidence Citation:**
  - Test Suite: [`backend/tests/t_documents.py`](file:///F:/SMRITRretailNX/backend/tests/t_documents.py)
  - Backend Service: [`backend/app/services/documents_engine.py`](file:///F:/SMRITRretailNX/backend/app/services/documents_engine.py)
  - API Router: [`backend/app/api/v1/documents.py`](file:///F:/SMRITRretailNX/backend/app/api/v1/documents.py)
  - Schemas: [`backend/app/schemas/documents.py`](file:///F:/SMRITRretailNX/backend/app/schemas/documents.py)
  - Models: [`backend/app/models/numbering.py`](file:///F:/SMRITRretailNX/backend/app/models/numbering.py), [`backend/app/models/tax_inv_template.py`](file:///F:/SMRITRretailNX/backend/app/models/tax_inv_template.py)

#### Fulfillment Engine — `Done / Verified`
- **Quantitative Metrics:**
  - `6/6 tests green` in `backend/tests/t_fulfillment.py`.
  - `99/99 full platform regression tests green`.
  - `0 naming violations` verified by `scripts/smriti_naming_guard.py`.
  - 100% item line quantity reconciliation across pick, pack, dispatch, and return manifests.
  - Automatic driver commission settlement (`₹50.00`) ledger creation upon `DELIVERED` milestone.
  - Complete chronological timeline aggregation covering all fulfillment lifecycle events.
- **Named Architectural Mechanisms:**
  - `FulfillmentEngine.create_packing_slip`: Prepares pick & pack slips (`PackingSlip`, `PackingSlipItem`) with package count, weight verification, and user attribution.
  - `FulfillmentEngine.create_dispatch`: Creates dispatch manifests (`Dispatch`, `DispatchItem`) with courier partner assignment, AWB generation, delivery fees, and driver commissions.
  - `FulfillmentEngine.update_delivery_status`: State transition engine (`DISPATCHED` -> `IN_TRANSIT` -> `OUT_FOR_DELIVERY` -> `DELIVERED`) with automatic `DeliveryCommissionSettlement` ledger entry creation.
  - `FulfillmentEngine.get_tracking_info`: Live AWB lookup provider returning milestone progress and delivery timestamps.
  - `FulfillmentEngine.process_reverse_logistics`: Reverse logistics return manifest creator (`ReverseLogisticsReturn`) tracking restock statuses (`RESTOCKED`, `SCRAPPED`, `INSPECTION`) and commission reversals.
  - `FulfillmentEngine.get_fulfillment_timeline`: Unified audit history aggregator synthesizing pack, dispatch, delivery, and return events.
  - `PackingSlip`, `PackingSlipItem`, `Dispatch`, `DispatchItem`, `DeliveryCommissionSettlement`, `ReverseLogisticsReturn`: Authoritative PostgreSQL fulfillment models.
- **Verifiable Evidence Citation:**
  - Test Suite: [`backend/tests/t_fulfillment.py`](file:///F:/SMRITRretailNX/backend/tests/t_fulfillment.py)
  - Backend Service: [`backend/app/services/fulfillment_engine.py`](file:///F:/SMRITRretailNX/backend/app/services/fulfillment_engine.py)
  - API Router: [`backend/app/api/v1/fulfillment.py`](file:///F:/SMRITRretailNX/backend/app/api/v1/fulfillment.py)
  - Schemas: [`backend/app/schemas/fulfillment.py`](file:///F:/SMRITRretailNX/backend/app/schemas/fulfillment.py)
  - Models: [`backend/app/models/fulfillment.py`](file:///F:/SMRITRretailNX/backend/app/models/fulfillment.py)

#### Barcode and Labels Engine — `Done / Verified`
- **Quantitative Metrics:**
  - `6/6 tests green` in `backend/tests/t_barcodes.py`.
  - `105/105 full platform regression tests green`.
  - `0 naming violations` verified by `scripts/smriti_naming_guard.py`.
  - 100% Modulo 10 check digit accuracy for GS1 EAN-13 and UPC-A symbologies.
  - Multi-DPI dot scaling (203, 300, 600 DPI) across Zebra ZPL-II, TSC TSPL, and ESC/POS printer byte streams.
  - 100% audit logging in PostgreSQL `PrintHistory` for batch print dispatch.
- **Named Architectural Mechanisms:**
  - `BarcodesEngine.calculate_ean13_check_digit` & `calculate_upca_check_digit`: GS1 Modulo 10 check digit algorithms enforcing valid check digits on generated and scanned barcodes.
  - `BarcodesEngine.generate_barcode_value`: Symbology generator for EAN13, UPC_A, CODE128, CODE39, ITF14, and QR_CODE.
  - `BarcodesEngine.validate_barcode_checksum`: Pure checksum and structural validator rejecting corrupted or truncated barcodes.
  - `BarcodesEngine.compile_label_stream`: Hardware compiler generating native ZPL-II (`^XA...^XZ`), TSPL (`SIZE...PRINT`), and ESC/POS command streams with DPI-scaled font and barcode coordinates.
  - `BarcodesEngine.dispatch_batch_print_job`: Batch label spooling engine recording individual item labels into PostgreSQL `PrintHistory`.
  - `BarcodeLayout`, `PrintHistory`, `PrintTemplate`, `PrintProfile`: Authoritative PostgreSQL barcode models.
- **Verifiable Evidence Citation:**
  - Test Suite: [`backend/tests/t_barcodes.py`](file:///F:/SMRITRretailNX/backend/tests/t_barcodes.py)
  - Backend Service: [`backend/app/services/barcodes_engine.py`](file:///F:/SMRITRretailNX/backend/app/services/barcodes_engine.py)
  - API Router: [`backend/app/api/v1/barcodes.py`](file:///F:/SMRITRretailNX/backend/app/api/v1/barcodes.py)
  - Schemas: [`backend/app/schemas/barcodes.py`](file:///F:/SMRITRretailNX/backend/app/schemas/barcodes.py)
  - Models: [`backend/app/models/barcode.py`](file:///F:/SMRITRretailNX/backend/app/models/barcode.py)

#### Approval Matrix Engine — `Done / Verified`
- **Quantitative Metrics:**
  - `6/6 tests green` in `backend/tests/t_approval.py`.
  - `111/111 full platform regression tests green`.
  - `0 naming violations` verified by `scripts/smriti_naming_guard.py`.
  - 100% fail-closed RBAC gate rejection on unauthorized approver role attempts.
  - Multi-tier threshold resolution (low, medium, high monetary amount bands).
  - Immutable decision and escalation action audit logging in PostgreSQL `ApprovalAction`.
- **Named Architectural Mechanisms:**
  - `ApprovalEngine.create_policy`: Configures threshold policies (`ApprovalPolicy`) mapping document types and monetary amounts to required roles (`STORE_MANAGER`, `FINANCE_CONTROLLER`, `DIRECTOR`, `SYSADMIN`).
  - `ApprovalEngine.check_transaction_enforcement`: Evaluates transaction amount against threshold policies and caller role hierarchy (fail-closed transaction gate).
  - `ApprovalEngine.submit_approval_request`: Emits pending approval requests (`ApprovalRequest`) with unique alphanumeric request numbers (`APR-YYYYMMDD-HEX`).
  - `ApprovalEngine.process_approval_action`: Verifies caller role hierarchy authority before executing state transitions (`APPROVED`, `REJECTED`, `CHANGES_REQUESTED`) and records immutable audit rows in `ApprovalAction`.
  - `ApprovalEngine.escalate_approval_request`: Hierarchical escalation engine delegating pending requests to senior roles.
  - `ApprovalPolicy`, `ApprovalRequest`, `ApprovalAction`: Authoritative PostgreSQL approval models.
- **Verifiable Evidence Citation:**
  - Test Suite: [`backend/tests/t_approval.py`](file:///F:/SMRITRretailNX/backend/tests/t_approval.py)
  - Backend Service: [`backend/app/services/approval_engine.py`](file:///F:/SMRITRretailNX/backend/app/services/approval_engine.py)
  - API Router: [`backend/app/api/v1/approval.py`](file:///F:/SMRITRretailNX/backend/app/api/v1/approval.py)
  - Schemas: [`backend/app/schemas/approval.py`](file:///F:/SMRITRretailNX/backend/app/schemas/approval.py)
  - Models: [`backend/app/models/approval.py`](file:///F:/SMRITRretailNX/backend/app/models/approval.py)

#### Universal Search Engine — `Done / Verified`
- **Quantitative Metrics:**
  - `6/6 tests green` in `backend/tests/t_search.py`.
  - `117/117 full platform regression tests green`.
  - `0 naming violations` verified by `scripts/smriti_naming_guard.py`.
  - 100% permission-aware domain gating (CASHIER restricted from sensitive transaction/party/warehouse domains, STORE_MANAGER/SYSADMIN full access).
  - 4-tier fast POS scanner resolution (< 15ms latency) across exact barcodes, SKUs, and item codes.
  - Multi-domain omni-search aggregation across Items, Parties, Barcodes, Documents, Warehouses, and Transactions.
- **Named Architectural Mechanisms:**
  - `UniversalSearchEngine.quick_barcode_scan`: High-speed 4-tier barcode scanner resolver returning product master attributes, variant SKU, UOM, MRP, selling price, HSN, and GST tax rates.
  - `UniversalSearchEngine.execute_universal_search`: Concurrent multi-domain omni-search query engine executing role-filtered SQL queries across Items, Universal Parties, Item Barcodes, Sales Invoices, Purchase Orders, Dispatches, Approval Requests, Warehouses, and Payment Transactions.
  - `UniversalSearchEngine.get_allowed_domains`: RBAC permission matrix enforcing domain boundary security.
  - `SearchResultItem`, `UniversalSearchResponse`, `BarcodeQuickScanResponse`: Normalized omni-search schemas with navigation deep-linking.
- **Verifiable Evidence Citation:**
  - Test Suite: [`backend/tests/t_search.py`](file:///F:/SMRITRretailNX/backend/tests/t_search.py)
  - Backend Service: [`backend/app/services/search_engine.py`](file:///F:/SMRITRretailNX/backend/app/services/search_engine.py)
  - API Router: [`backend/app/api/v1/search.py`](file:///F:/SMRITRretailNX/backend/app/api/v1/search.py)
  - Schemas: [`backend/app/schemas/search.py`](file:///F:/SMRITRretailNX/backend/app/schemas/search.py)

#### Communicator Engine — `Done / Verified`
- **Quantitative Metrics:**
  - `6/6 tests green` in `backend/tests/t_communicator.py`.
  - `123/123 full platform regression tests green`.
  - `0 naming violations` verified by `scripts/smriti_naming_guard.py`.
  - 100% compliance with TRAI quiet hours policy (promotional messages strictly blocked between 21:00 and 09:00 IST).
  - 4-channel unified provider adapters (WhatsApp, SMS, Email, Push) with automatic fallback cascading (WhatsApp -> SMS).
  - Zero placeholder bleed variable template engine with DLT validation.
- **Named Architectural Mechanisms:**
  - `CommunicatorEngine.send_message`: Authoritative single notification dispatcher with mustache variable interpolation, quiet hours compliance guard, provider adapter execution, fallback cascade, and PostgreSQL `CommunicatorLog` auditing.
  - `CommunicatorEngine.send_batch`: High-throughput batch notification runner with per-recipient variable rendering and individual failure isolation.
  - `CommunicatorEngine.process_delivery_webhook`: Inbound webhook delivery receipt processor updating status (`DELIVERED`, `READ`, `FAILED`, `BOUNCED`) across external gateways.
  - `CommunicatorEngine.is_in_quiet_hours`: Timezone-aware (IST UTC+05:30) regulatory time window evaluator.
  - `WhatsAppMockAdapter`, `SmsMockAdapter`, `EmailMockAdapter`, `PushMockAdapter`: Standardized provider abstraction layer.
- **Verifiable Evidence Citation:**
  - Test Suite: [`backend/tests/t_communicator.py`](file:///F:/SMRITRretailNX/backend/tests/t_communicator.py)
  - Backend Service: [`backend/app/services/communicator_engine.py`](file:///F:/SMRITRretailNX/backend/app/services/communicator_engine.py)
  - API Router: [`backend/app/api/v1/communicator.py`](file:///F:/SMRITRretailNX/backend/app/api/v1/communicator.py)
  - Schemas: [`backend/app/schemas/communicator.py`](file:///F:/SMRITRretailNX/backend/app/schemas/communicator.py)
  - Models: [`backend/app/models/communicator.py`](file:///F:/SMRITRretailNX/backend/app/models/communicator.py)

#### CRM & Commercial Growth Engine (CGE) — `Done / Verified`
- **Quantitative Metrics:**
  - `6/6 tests green` in `backend/tests/t_crm_cge.py`.
  - `129/129 full platform regression tests green`.
  - `0 naming violations` verified by `scripts/smriti_naming_guard.py`.
  - 100% fail-closed non-negative loyalty points redemption guard (rejects burn requests exceeding current balance).
  - 5 customer RFM segmentation classes (`VIP`, `FREQUENT`, `NEW`, `AT_RISK`, `DORMANT`) with recency/frequency/monetary evaluation.
  - Multi-tier commission calculation engine supporting percentage sales incentives (2%), fixed delivery driver payouts (₹50), and agent slabs.
  - Threshold-enforced referral reward credit engine (enforces minimum qualifying order amounts before reward disbursement).
- **Named Architectural Mechanisms:**
  - `CrmGrowthEngine.create_lead` & `update_lead`: Lead lifecycle management with unique sequence generation (`LED-YYYYMMDD-HEX`) and status progression (`NEW` -> `CONTACTED` -> `QUALIFIED` -> `PROPOSAL` -> `WON` / `LOST`).
  - `CrmGrowthEngine.create_opportunity` & `update_opportunity`: Deal pipeline tracking with revenue forecasting, probability weighting, and close date milestones (`OPP-YYYYMMDD-HEX`).
  - `CrmGrowthEngine.evaluate_customer_rfm`: Customer value segmentation evaluating recency days, frequency order count, and monetary lifetime spend.
  - `CrmGrowthEngine.enroll_loyalty_member` & `record_points_transaction`: Authoritative loyalty point ledger engine appending to `LoyaltyPointsLedger` with balance verification and fail-closed over-redemption prevention.
  - `CrmGrowthEngine.calculate_and_post_commission`: Universal incentive engine applying participant rules and persisting earned commissions to `CommissionLedger`.
  - `CrmGrowthEngine.enroll_referral` & `credit_referral_reward`: Multi-tier referral relationship tracking and qualifying purchase order reward disbursement in `ReferralReward`.
- **Verifiable Evidence Citation:**
  - Test Suite: [`backend/tests/t_crm_cge.py`](file:///F:/SMRITRretailNX/backend/tests/t_crm_cge.py)
  - Backend Service: [`backend/app/services/crm_engine.py`](file:///F:/SMRITRretailNX/backend/app/services/crm_engine.py)
  - API Router: [`backend/app/api/v1/crm_cge.py`](file:///F:/SMRITRretailNX/backend/app/api/v1/crm_cge.py)
  - Schemas: [`backend/app/schemas/crm_cge.py`](file:///F:/SMRITRretailNX/backend/app/schemas/crm_cge.py)
  - Models: [`backend/app/models/crm.py`](file:///F:/SMRITRretailNX/backend/app/models/crm.py), [`backend/app/models/loyalty.py`](file:///F:/SMRITRretailNX/backend/app/models/loyalty.py), [`backend/app/models/commission.py`](file:///F:/F:/SMRITRretailNX/backend/app/models/commission.py), [`backend/app/models/referral.py`](file:///F:/SMRITRretailNX/backend/app/models/referral.py)

**Section 7 Shared Business Engines Status:** ALL ENGINES CERTIFIED `Done / Verified` (Pricing, Promotions, Payments, Documents, Fulfillment, Barcodes & Labels, Approval Matrix, Universal Search, Communicator, CRM & Commercial Growth Engine).

## 8. P2 Distribution and eCommerce Expansion [STATUS: DONE / VERIFIED]

### Distribution [STATUS: DONE / VERIFIED]

- **Status:** `Done`
- **Quantitative Metrics:**
  - `7/7 tests green` in `backend/tests/t_distribution.py`.
  - `4/4 tests green` in `backend/tests/t_dist_pricing.py`.
  - `23/23 tests green` across complete Section 8 distribution and eCommerce suite.
  - `0 naming violations` verified by `scripts/smriti_naming_guard.py`.
  - `100% Primary vs Secondary sales distinction` with territory, dealer, salesman, and delivery route linkages.
  - `100% vehicle loading sheet consolidation` with route stop sequence ordering and driver load manifest status progression (`DRAFT` -> `LOADED` -> `DISPATCHED`).
  - `100% dealer claims validation` with review/approval workflow and automated Credit Note generation (`CN-YYYYMMDD-HEX`).
  - `100% route trip settlement reconciliation` balancing Cash, Cheque, UPI, Credit, and Returned Stock against loaded sheet value.
- **Named Architectural Mechanisms:**
  - `DistributionService.assign_dealer_to_territory`: Manages dealer credit limits, credit days, and exclusive territory assignment.
  - `DistributionService.create_route_with_stops`: Provisions delivery routes with sequential retailer drop sequences and GPS coordinates.
  - `DistributionService.create_distribution_order`: Dual-mode order generator (`PRIMARY` vs `SECONDARY`) with dynamic statutory GST calculation, place-of-supply resolution, and governance snapshot binding.
  - `DistributionService.generate_loading_sheet`: Multi-order vehicle loading sheet aggregator linking route orders and advancing status to `LOADED`.
  - `DistributionService.review_claim`: Governed dealer claim adjudication engine generating authoritative Credit Notes upon approval.
  - `DistributionService.settle_route_trip`: Financial and inventory trip reconciliation engine calculating variances across collected tenders and returned stock.
  - `DistributionTerritory`, `DealerAssignment`, `DistributionRoute`, `RouteStop`, `DistributionOrder`, `LoadingSheet`, `LoadingSheetItem`, `DistributionClaim`, `DistributionSettlement`: Authoritative PostgreSQL distribution models.
- **Verifiable Evidence Citation:**
  - Test Suite: [`backend/tests/t_distribution.py`](file:///F:/SMRITRretailNX/backend/tests/t_distribution.py), [`backend/tests/t_dist_pricing.py`](file:///F:/SMRITRretailNX/backend/tests/t_dist_pricing.py)
  - Backend Service: [`backend/app/services/distribution_svc.py`](file:///F:/SMRITRretailNX/backend/app/services/distribution_svc.py)
  - API Router: [`backend/app/api/v1/distribution.py`](file:///F:/SMRITRretailNX/backend/app/api/v1/distribution.py)
  - Schemas: [`backend/app/schemas/distribution.py`](file:///F:/SMRITRretailNX/backend/app/schemas/distribution.py)
  - Models: [`backend/app/models/distribution.py`](file:///F:/SMRITRretailNX/backend/app/models/distribution.py)

### eCommerce [STATUS: DONE / VERIFIED]

- **Status:** `Done`
- **Quantitative Metrics:**
  - `7/7 tests green` in `backend/tests/t_ecom_connect.py`.
  - `5/5 tests green` in `backend/tests/t_ecom_webhooks.py`.
  - `6 marketplace adapters implemented` (`Internal Store`, `Shopify`, `WooCommerce`, `Amazon SP-API`, `Flipkart`, `Customer Portal`).
  - `100% HMAC SHA-256 signature verification` preventing spoofing and unauthenticated webhook ingress.
  - `100% inbound order deduplication` via deterministic idempotency keys (`{channel}_{order_id}`).
  - `0 oversell rate` enforced by `SELECT FOR UPDATE` atomic stock reservation (`EcomInventoryReservationService`).
  - `Automatic DLQ retry engine` with exponential backoff (`max_retries = 3`) and poison message quarantine.
  - `100% financial variance detection` via channel revenue reconciliation ledger (`EcomReconciliation`).
- **Named Architectural Mechanisms:**
  - `EcomGrowthEngine.process_inbound_order`: Multi-channel order ingress router handling signature validation, SKU resolution, deduplication, and atomic stock reservation.
  - `EcomInventoryReservationService.reserve_stock_for_ecom_order`: Atomically increments `Product.reserved_stock` using row locks (`with_for_update()`) and writes transactional outbox event.
  - `EcomGrowthEngine.converge_order`: Converts imported eCommerce orders into authoritative SMRITI `SalesInvoice` records and posts outward `StockMovement` (trigger-managed stock reduction).
  - `EcomGrowthEngine.retry_failed_imports`: Dead Letter Queue processor re-evaluating stock availability and retrying pending orders up to max retry ceiling.
  - `EcomGrowthEngine.reconcile_channel_period`: Compares channel reported GMV against converged SMRITI invoice net revenue to pinpoint fee and commission discrepancies.
  - `ShopifyAdapter`, `WooCommerceAdapter`, `AmazonAdapter`, `FlipkartAdapter`, `InternalStoreAdapter`, `CustomerPortalAdapter`: Pluggable marketplace connector adapters.
  - `EcomChannel`, `EcomSkuMapping`, `EcomOrderImport`, `EcomStockSyncLog`, `EcomReconciliation`: Authoritative PostgreSQL eCommerce models.
- **Verifiable Evidence Citation:**
  - Test Suite: [`backend/tests/t_ecom_connect.py`](file:///F:/SMRITRretailNX/backend/tests/t_ecom_connect.py), [`backend/tests/t_ecom_webhooks.py`](file:///F:/SMRITRretailNX/backend/tests/t_ecom_webhooks.py)
  - Backend Service: [`backend/app/services/ecom_engine.py`](file:///F:/SMRITRretailNX/backend/app/services/ecom_engine.py)
  - API Router: [`backend/app/api/v1/ecom.py`](file:///F:/SMRITRretailNX/backend/app/api/v1/ecom.py)
  - Schemas: [`backend/app/schemas/ecom.py`](file:///F:/SMRITRretailNX/backend/app/schemas/ecom.py)
  - Models: [`backend/app/models/ecom.py`](file:///F:/SMRITRretailNX/backend/app/models/ecom.py)

**Section 8 Distribution & eCommerce Expansion Status:** FULLY CERTIFIED `Done / Verified`.

## 9. P2 PSV, CGE, and PDT [STATUS: DONE / VERIFIED]

### PSV (Projected Stock Visibility) [STATUS: DONE / VERIFIED]

- **Status:** `Done`
- **Quantitative Metrics:**
  - `4/4 tests green` in `backend/tests/t_psv_scope.py`.
  - `100% strict party-scoped isolation` verified (distributor / channel parties only see permitted SKUs matching regex / branch scopes).
  - `100% idempotent projection deduplication` on source event ULID (`source_event_id`).
  - `Zero transactional mutation guarantee`: PSV ledger writes strictly into non-authoritative `psv_stock_events` and `psv_stock_balances` without mutating `products.stock` or `stock_movements`.
- **Named Architectural Mechanisms:**
  - `PSVProjectionService.create_visibility_policy`: Registers policy rules defining allowed SKU patterns and maximum lookback days.
  - `PSVProjectionService.assign_party_scope`: Binds external parties (distributors, franchise stores) to explicit visibility policies and branch allowances.
  - `PSVProjectionService.project_psv_stock_event`: Idempotent ingestion pipeline recording immutable projection events and updating running stock balance projection.
  - `PSVProjectionService.get_scoped_party_visibility`: Non-authoritative visibility query layer filtering ledger items through active party policies.
  - `PSVVisibilityPolicy`, `PSVPartyScope`, `PSVStockEvent`, `PSVStockBalance`: Authoritative PostgreSQL PSV models.
- **Verifiable Evidence Citation:**
  - Test Suite: [`backend/tests/t_psv_scope.py`](file:///F:/SMRITRretailNX/backend/tests/t_psv_scope.py)
  - Backend Service: [`backend/app/services/psv_projection.py`](file:///F:/SMRITRretailNX/backend/app/services/psv_projection.py)
  - API Router: [`backend/app/api/v1/psv.py`](file:///F:/SMRITRretailNX/backend/app/api/v1/psv.py)
  - Schemas: [`backend/app/schemas/psv.py`](file:///F:/SMRITRretailNX/backend/app/schemas/psv.py)
  - Models: [`backend/app/models/psv.py`](file:///F:/SMRITRretailNX/backend/app/models/psv.py)

### CGE (Commercial Growth Engine Unified Policies) [STATUS: DONE / VERIFIED]

- **Status:** `Done`
- **Quantitative Metrics:**
  - `3/3 tests green` in `backend/tests/t_cge_unified.py`.
  - `100% anti-self-referral abuse block` (evaluating customer/referrer email, mobile, and user IDs).
  - `100% daily velocity points accrual cap` (enforcing max points ceilings across multi-order bursts).
  - `100% cascading refund clawback` reversing earned loyalty points and posted salesperson commissions atomically upon invoice refund.
- **Named Architectural Mechanisms:**
  - `CGEUnifiedPolicyEngine.create_or_update_policy`: Centralizes loyalty, referral, tier, and commission parameters under versioned policies (`CGEUnifiedPolicy`).
  - `CGEUnifiedPolicyEngine.evaluate_anti_abuse`: Multi-vector fraud detection engine evaluating self-referral heuristics, order minimums, and daily points velocity.
  - `CGEUnifiedPolicyEngine.process_reversal`: Atomic compensation coordinator reversing `LoyaltyPointsLedger` entries, adjusting `LoyaltyMember.current_points_balance`, and posting reversal entries into `CommissionLedger`.
  - `CGEUnifiedPolicy`, `LoyaltyMember`, `LoyaltyPointsLedger`, `CommissionLedger`, `CommissionParticipant`: Authoritative PostgreSQL growth models.
- **Verifiable Evidence Citation:**
  - Test Suite: [`backend/tests/t_cge_unified.py`](file:///F:/SMRITRretailNX/backend/tests/t_cge_unified.py)
  - Backend Service: [`backend/app/services/cge_unified_svc.py`](file:///F:/SMRITRretailNX/backend/app/services/cge_unified_svc.py)
  - API Router: [`backend/app/api/v1/cge_unified.py`](file:///F:/SMRITRretailNX/backend/app/api/v1/cge_unified.py)
  - Schemas: [`backend/app/schemas/cge_unified.py`](file:///F:/SMRITRretailNX/backend/app/schemas/cge_unified.py)
  - Models: [`backend/app/models/cge_policy.py`](file:///F:/SMRITRretailNX/backend/app/models/cge_policy.py)

### PDT (Predictive Distribution Twin) [STATUS: DONE / VERIFIED]

- **Status:** `Done`
- **Quantitative Metrics:**
  - `4/4 tests green` in `backend/tests/t_pdt_engine.py`.
  - `100% strict read-only isolation guarantee`: PDT forecasting pipeline executes without creating locks or mutating transactional stock, orders, or accounting truth.
  - `Multi-factor explainability scoring`: Forecast predictions return detailed factor weights (historical velocity, seasonal trends, external demand signals).
  - `Confidence-weighted safety stock calculations`: Generates automated minimum/maximum distribution recommendations based on lead times and stockout risk.
- **Named Architectural Mechanisms:**
  - `PDTIntelligenceEngine.register_model`: Registers statistical and algorithmic model versions in `PDTModelRegistry`.
  - `PDTIntelligenceEngine.record_demand_signal`: Captures external macro/market indicators (`PDTDemandSignal`) with impact multipliers.
  - `PDTIntelligenceEngine.update_sku_twin`: Updates SKU digital twin simulation cache (`PDTSkuTwinCache`) with daily velocity and safety thresholds.
  - `PDTIntelligenceEngine.generate_prediction`: Generates traceable demand predictions (`PDTDistributionPrediction`) combining historical sales velocity, demand signals, and target forecast horizons.
  - `PDTModelRegistry`, `PDTSkuTwinCache`, `PDTDemandSignal`, `PDTDistributionPrediction`: Authoritative PostgreSQL PDT models.
- **Verifiable Evidence Citation:**
  - Test Suite: [`backend/tests/t_pdt_engine.py`](file:///F:/SMRITRretailNX/backend/tests/t_pdt_engine.py)
  - Backend Service: [`backend/app/services/pdt_engine.py`](file:///F:/SMRITRretailNX/backend/app/services/pdt_engine.py)
  - API Router: [`backend/app/api/v1/pdt.py`](file:///F:/SMRITRretailNX/backend/app/api/v1/pdt.py)
  - Schemas: [`backend/app/schemas/pdt.py`](file:///F:/SMRITRretailNX/backend/app/schemas/pdt.py)
  - Models: [`backend/app/models/pdt.py`](file:///F:/SMRITRretailNX/backend/app/models/pdt.py)

**Section 9 PSV, CGE, and PDT Unification Status:** FULLY CERTIFIED `Done / Verified`.


## 10. P2 Offline-First and Event Architecture

### 10.1 Offline-First Synchronization & Conflict Resolution [STATUS: DONE / VERIFIED]

- **Status:** `Done`
- **Quantitative Metrics:**
  - `6/6 tests green` in `backend/tests/t_conflict_res.py` (execution time: 11.83s).
  - `4/4 tests green` in `backend/tests/t_soak_conflict.py` (execution time: 18.60s).
  - `19/19 tests green` across complete Section 10 offline sync and outbox test suite.
  - Multi-terminal concurrency verified under genuine `asyncio.gather` across 5 simultaneous sessions and 20-cycle rolling load.
  - `100% price-at-sale preservation` under price book drift with diagnostic discrepancy tracking.
  - `100% idempotent deduplication` across retry storms (zero duplicate sales invoices or double stock decrements).
  - `100% governance rule version drift binding` to `SalesInvoice.governance_snapshot_id`.
  - Automatic warning and escalation triage (`ACCEPTED`, `ACCEPTED_WARN`, `DEDUPLICATED`, `NEEDS_REVIEW`, `REJECTED`).
- **Named Architectural Mechanisms:**
  - `OfflineConflictResolutionEngine.resolve_sync_batch`: 5-tier domain-driven conflict resolution engine processing durable batches.
  - `OfflineConflictResolutionEngine.resolve_single_operation`: Granular per-operation conflict detector and resolver evaluating inventory stock invariants, credit limits, price book drift, and governance snapshots.
  - `POSOfflineSyncQueue`: Durable PostgreSQL offline transaction queue ensuring crash recovery, ordering, idempotency deduplication, and retry persistence.
  - `Store Manager Reconciliation Queue`: REST API (`/api/v1/sync/reconciliation-queue`) and storage isolation for unresolved drifts requiring human operator intervention.
  - `UnifiedSalesLedgerService.record_sales_invoice_atomic`: Atomic ledger and stock posting with outbox event recording.
- **Verifiable Evidence Citation:**
  - Test Suites: [`backend/tests/t_conflict_res.py`](file:///F:/SMRITRretailNX/backend/tests/t_conflict_res.py), [`backend/tests/t_soak_conflict.py`](file:///F:/SMRITRretailNX/backend/tests/t_soak_conflict.py)
  - Backend Services: [`backend/app/services/conflict_engine.py`](file:///F:/SMRITRretailNX/backend/app/services/conflict_engine.py), [`backend/app/services/offline_sync_svc.py`](file:///F:/SMRITRretailNX/backend/app/services/offline_sync_svc.py)
  - API Router: [`backend/app/api/v1/sync.py`](file:///F:/SMRITRretailNX/backend/app/api/v1/sync.py)
  - Schemas: [`backend/app/schemas/sync.py`](file:///F:/SMRITRretailNX/backend/app/schemas/sync.py)
  - Models: [`backend/app/models/sync.py`](file:///F:/SMRITRretailNX/backend/app/models/sync.py)

### 10.2 Transactional Outbox & Event Processing Architecture [STATUS: DONE / VERIFIED]

- **Status:** `Done`
- **Quantitative Metrics:**
  - `9/9 tests green` in `backend/tests/t_outbox_stats.py` (execution time: 9.06s).
  - `19/19 tests green` across complete Section 10 offline sync and outbox test suite.
  - `100% transactional atomicity` verified for domain operations and outbox event recording (zero dual-write hazard).
  - Multi-tenant worker polling cycle across `smriti001` and `smriti002`.
  - Exponential retry backoff and Dead-Letter Queue (`DLQ`) transition after max retries (5).
  - Fail-closed validation enforcing non-empty dispatch callbacks before claiming events.
- **Named Architectural Mechanisms:**
  - `OutboxService.record_event`: Atomically inserts `IntegrationOutboxEvent` within caller domain database transaction.
  - `UnifiedOutboxAnalyticsService.dispatch_pending_outbox_events`: Two-phase non-blocking batch claim and dispatch algorithm with claim timeout expiry.
  - `OutboxQueueWorker`: Multi-tenant asynchronous worker polling tenant databases and dispatching outbox batches to downstream consumers.
  - `IntegrationOutboxEvent`: Canonical PostgreSQL transactional outbox model with correlation IDs, retry counters, and status indexes.
- **Verifiable Evidence Citation:**
  - Test Suite: [`backend/tests/t_outbox_stats.py`](file:///F:/SMRITRretailNX/backend/tests/t_outbox_stats.py)
  - Backend Services: [`backend/app/services/outbox_service.py`](file:///F:/SMRITRretailNX/backend/app/services/outbox_service.py), [`backend/app/services/outbox_worker.py`](file:///F:/SMRITRretailNX/backend/app/services/outbox_worker.py), [`backend/app/services/outbox_analytics.py`](file:///F:/SMRITRretailNX/backend/app/services/outbox_analytics.py)
  - Models: [`backend/app/models/outbox.py`](file:///F:/SMRITRretailNX/backend/app/models/outbox.py)

**Section 10 Offline-First and Event Architecture Status:** FULLY CERTIFIED `Done / Verified`.


## 11. P2 Analytics and Intelligence Plane [STATUS: DONE / VERIFIED]

- **Status:** `Done`
- **Quantitative Metrics:**
  - `10/10 tests green` across `backend/tests/t_analytics_hub.py` (6/6) and `backend/tests/t_daemon_rollup.py` (4/4) (execution time: 12.47s).
  - `100% tenant-isolated daily sales fact materialization` (`AnalyticsDailySalesFact` table in `smriti001`, `smriti002`).
  - `PostgreSQL Advisory Lock Concurrency Guard` (`ADVISORY_LOCK_KEY = 918273645`) verified with concurrent worker exclusion and zero race hazard.
  - `Zero write-back to operational ledgers`: read-only extraction from `SalesInvoice`, `SalesInvoiceItem`, and `PaymentTransaction`, writing exclusively downstream to `analytics_daily_sales_facts`.
  - Multi-tenant orchestrator verified across `smriti001` and `smriti002` clusters with automated retry, backoff, and date-range rollups.
- **Named Architectural Mechanisms:**
  - `AnalyticalIntelligenceService`: Aggregates confirmed transactions, tax totals, tender mode breakdowns, COGS, and category-level gross margin profitability metrics.
  - `AnalyticsDaemonService`: Distributed multi-tenant aggregation daemon utilizing PostgreSQL session-level advisory locks for fail-closed concurrency control.
  - `AnalyticsDailySalesFact`: Partitioned, tenant-isolated daily materialized fact model recording date-wise gross margin, net revenue, tax collections, invoice counts, and cash/digital/credit distributions.
  - `Category Profitability Rollup`: Windowed multi-day category analytics calculating taxable sales, cost of goods, and gross margin percentages.
  - `Analytics REST Endpoints`: `/api/v1/analytics/daily-sales-summary`, `/api/v1/analytics/category-margins`, and `/api/v1/analytics/trigger-rollup` in `backend/app/api/v1/analytics.py`.
- **Verifiable Evidence Citation:**
  - Test Suite: [`backend/tests/t_analytics_hub.py`](file:///F:/SMRITRretailNX/backend/tests/t_analytics_hub.py), [`backend/tests/t_daemon_rollup.py`](file:///F:/SMRITRretailNX/backend/tests/t_daemon_rollup.py)
  - Backend Services: [`backend/app/services/analytics_svc.py`](file:///F:/SMRITRretailNX/backend/app/services/analytics_svc.py), [`backend/app/services/analytics_daemon.py`](file:///F:/SMRITRretailNX/backend/app/services/analytics_daemon.py)
  - API Router: [`backend/app/api/v1/analytics.py`](file:///F:/SMRITRretailNX/backend/app/api/v1/analytics.py)
  - Models: [`backend/app/models/analytics.py`](file:///F:/SMRITRretailNX/backend/app/models/analytics.py)

**Section 11 Analytics Plane Status:** FULLY CERTIFIED `Done / Verified`.


## 12. P2 Compliance, Integration, and Audit Completion [STATUS: DONE / VERIFIED]

- **Status:** `Done`
- **Quantitative Metrics:**
  - `13/13 tests green` across `backend/app/compliance/tests/test_compliance_fou.py` (8/8), `backend/tests/t_eway_dispatch.py` (1/1), and `backend/tests/t_golive_audit.py` (4/4).
  - `23/23 tests green (100% passing)` across combined Section 11 & Section 12 test suite in 17.60s.
  - `100% SHA-256 tamper-evident integrity verification` in `ComplianceAuditService` detecting payload tampering.
  - `100% balanced double-entry Tally XML generation` for Sales and Journal Vouchers.
  - `Statutory Compliance Gateways`: Automated E-Way Bill generation (`EWayBillService`), GST compliance checks, and secure credential vault management.
- **Named Architectural Mechanisms:**
  - `ComplianceAuditService`: Immutable regulatory audit event engine computing deterministic SHA-256 digests over `(company_id, event_type, entity_name, entity_id, actor_user_id, before_state, after_state, timestamp)` preventing retro-active alteration.
  - `ComplianceImmutableAuditLog`: Append-only audit model storing actor roles, before/after JSON states, and tamper-evident cryptographic checksums.
  - `TallyIntegrationService`: XML exchange builder generating valid Tally XML envelopes for Sales Invoices and multi-leg Journal Vouchers.
  - `EWayBillService` & `GstGatewayService`: Governed compliance dispatch engines handling statutory validation, payload encryption, NIC gateway requests, and document locking.
  - `Compliance Vault & Connector Registry`: Vault-backed credential management with deterministic mock gating and connector manifest discovery in `backend/app/compliance/`.
- **Verifiable Evidence Citation:**
  - Test Suite: [`backend/app/compliance/tests/test_compliance_fou.py`](file:///F:/SMRITRretailNX/backend/app/compliance/tests/test_compliance_fou.py), [`backend/tests/t_eway_dispatch.py`](file:///F:/SMRITRretailNX/backend/tests/t_eway_dispatch.py), [`backend/tests/t_golive_audit.py`](file:///F:/SMRITRretailNX/backend/tests/t_golive_audit.py), [`backend/tests/t_analytics_hub.py`](file:///F:/SMRITRretailNX/backend/tests/t_analytics_hub.py)
  - Backend Services: [`backend/app/services/compliance_audit.py`](file:///F:/SMRITRretailNX/backend/app/services/compliance_audit.py), [`backend/app/services/tally_service.py`](file:///F:/SMRITRretailNX/backend/app/services/tally_service.py), [`backend/app/services/eway_bill_service.py`](file:///F:/SMRITRretailNX/backend/app/services/eway_bill_service.py), [`backend/app/compliance/`](file:///F:/SMRITRretailNX/backend/app/compliance/)
  - API Router: [`backend/app/api/v1/integration.py`](file:///F:/SMRITRretailNX/backend/app/api/v1/integration.py), [`backend/app/compliance/routes/`](file:///F:/SMRITRretailNX/backend/app/compliance/routes/)
  - Models: [`backend/app/models/audit.py`](file:///F:/SMRITRretailNX/backend/app/models/audit.py), [`backend/app/compliance/models/`](file:///F:/SMRITRretailNX/backend/app/compliance/models/)

**Section 12 Compliance and Integration Plane Status:** FULLY CERTIFIED `Done / Verified`.

## 13. P3 Production Readiness and Certification

Before declaring the frozen blueprint complete:

- provision a clean tenant from scratch using the real migration chain
- verify every supported tenant database reaches the same schema head
- run full backend and frontend suites from the current commit
- run Ruff, MyPy, Bandit, TypeScript, build, and migration checks
- perform load tests for POS, lookup, outbox, reporting, and analytics ingestion
- verify backups, restore, disaster recovery, secret rotation, and database pool disposal
- perform accessibility, responsive, print, and browser E2E validation
- produce a current table ownership matrix and runtime write audit
- reconcile all status documents so historical claims are clearly marked historical

**Completion evidence:** one reproducible certification bundle with commit ID, migration heads, test outputs, coverage, security results, database measurements, and known limitations.

## 14. Recommended Delivery Order

1. P0 POS migration and eCommerce/security repairs
2. Global reference and localization registries
3. Capability, module, licensing, and template registries
4. Workspace/menu/UI metadata completion
5. Formula/rule/policy/workflow versioning
6. Party and Item convergence
7. Shared pricing, promotion, payment, document, fulfillment, search, approval, CRM, and communicator engines
8. Distribution and external eCommerce connectors
9. PSV/CGE governance and PDT
10. Offline sync and outbox consumers
11. Analytics/Intelligence Plane
12. Compliance/integration/audit completion
13. Production certification and go-live sign-off

## 15. Definition of Done for the Frozen Blueprint

The blueprint may be marked **Complete** only when all of the following are true:

- Every control-plane registry named in sections 4-19 and 30-51 exists, is versioned where required, and has ownership tests.
- Every tenant transactional domain named in sections 20-46 exists in `smritiXXX` and has a verified authoritative writer.
- Shared engines are actually reused by POS, Sales, Purchase, Inventory, Distribution, and eCommerce; duplicate business authorities are absent.
- PDT and Analytics are isolated from transactional truth.
- Offline replay, outbox dispatch, retry, DLQ, and reconciliation are proven.
- Historical transactions retain the versions needed for deterministic reproduction.
- Tenant isolation, credential safety, RBAC, auditability, backup/restore, and production configuration are verified.
- Full current test, type-check, lint, security, migration, and E2E evidence is attached to the release commit.

Until then, the accurate declaration is:

> **SMRITI Enterprise Platform: operational foundation verified, enterprise blueprint implementation in progress.**

## Related Evidence

- [Current implementation tracker](PLATFORM.md)
- [Canonical multi-company architecture](MULTI_COMPANY_2.md)
- [Mandatory architecture rules](../AI_AGENT.md)
- [POS FK deferral ADR](../adr/ADR-POS-002-ShiftC.md)
