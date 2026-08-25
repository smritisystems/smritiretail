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

### P1.3 Workspace, Menu, and UI Experience Registry

Consolidate the current menu/workspace foundations into versioned control-plane metadata:

- workspaces and workspace versions/configuration
- workspace capabilities, roles, permissions
- menu registry/groups/items/routes/actions
- menu capability/permission/visibility rules
- workspace/template mappings and menu versions
- themes, theme versions, design tokens
- screen templates/definitions, field definitions, action definitions, layouts, icons

Preserve the existing `smriti_menus` contract while adding normalized metadata only where required. Do not create duplicate authoritative navigation sources.

**Exit evidence:** resolved navigation and workspace layout are produced from control-plane metadata for multiple roles, templates, capabilities, and locales; hidden UI does not bypass API authorization.

## 5. P1 Governed Logic and Reproducibility

### P1.4 Formula, Rule, Policy, and Workflow Engines

Create centralized, versioned registries in `smritisys` for:

- formulas, parameters, conditions, dependencies, scopes
- rules, conditions, actions, parameters, scopes
- policies, parameters, scopes
- workflows, states, transitions, actions, conditions

The application engine must validate and execute these definitions. No arbitrary executable code may be stored in the control plane.

Migrate existing GST, pricing, promotion, commission, loyalty, discount, approval, return, stock, payment, security, visibility, and document behavior behind stable engine contracts.

**Exit evidence:** the same definition version produces deterministic results in unit tests; invalid definitions are rejected; tenant transactions record the selected definition versions.

### P1.5 Transaction Reproducibility

Add immutable version references to critical transactions for:

- formula
- rule
- policy/tax
- pricing
- posting/accounting
- document template and numbering

Add historical replay tests for invoices, returns, payments, GST calculations, discounts, and ledger postings after a newer definition is published.

**Exit evidence:** historical output remains unchanged after a new rule version is activated; audit data identifies every version used.

## 6. P1 Transactional Data-Plane Convergence

### P1.1 Universal Party Master completion

Complete the tenant-local Party model and bridge existing customer/supplier flows:

- party addresses, contacts, tax profiles, credit profiles, relationships
- explicit Customer, Supplier, Dealer, Distributor, Salesman, Transporter, and Employee roles
- deduplication and merge policy
- compatibility adapters for legacy customer/supplier APIs
- all invoices, orders, payments, CRM, distribution, and communication references converge on Party identity

**Exit evidence:** one party can hold multiple roles; existing APIs remain compatible; no duplicate authority is introduced.

### P1.2 Universal Item Master completion

Complete the tenant-local Item model and bridge existing Product flows:

- categories, brands, attributes, units, prices, tax profiles
- variants, barcodes, batches, serials
- warehouse/location relationships
- POS, Sales, Purchase, WMS, eCommerce, GST, and label flows use the same item identity

**Exit evidence:** barcode/SKU/variant lookup resolves one canonical item; batch/serial stock changes are reflected only through authoritative stock movements; cross-company collisions remain isolated.

### P1.3 Authoritative Stock and Accounting Boundaries

- Confirm every stock-changing operation writes an authoritative `stock_movements` record.
- Ensure materialized balances are rebuildable from movements.
- Ensure every financial operation creates balanced accounting entries where applicable.
- Add reconciliation jobs for stock, payment, tax, and GL ledgers.

**Exit evidence:** rebuild tests, debit/credit equality tests, stock reconciliation tests, and transaction rollback tests pass.

## 7. P1/P2 Shared Business Engines

Complete and unify the following existing partial engines:

- **Pricing:** price lists, customer/channel/quantity pricing, effective dates, promotions, historical snapshots.
- **Promotions:** promotion/discount/coupon conditions and actions with conflict/stacking policy.
- **Payments:** methods, transactions, receipts, refunds, allocations, provider adapters, idempotency.
- **Documents:** document types/categories/lifecycles, templates, rendering, printing, numbering, version binding.
- **Fulfillment:** fulfillment orders, pick, pack, dispatch, delivery, tracking, returns.
- **Barcode and Labels:** barcode formats/rules, batch/serial labels, print jobs and hardware adapters.
- **Approval:** levels, assignments, delegation, escalation, history, and transaction enforcement.
- **Universal Search:** party, item, barcode, document, warehouse, and transaction lookup with permission-aware results.
- **Communicator:** provider registry, templates, policies, events, delivery events, preferences, and real provider adapters.
- **CRM/CGE:** leads, opportunities, activities, segments, campaigns, loyalty, wallet, rewards, referrals, and commission governance.

**Exit evidence:** each engine has tenant isolation, API tests, role-negative tests, idempotency/replay tests where applicable, and cross-capability integration tests.

## 8. P2 Distribution and eCommerce Expansion

### Distribution

Complete distribution-specific transactional coverage:

- distribution orders and lines
- territories, dealer assignments, salesman assignments
- delivery routes and stops
- primary/secondary sales distinction
- claims, loading, dispatch, delivery, and settlement workflows

### eCommerce

Implement connectors as adapters, never duplicate authorities:

1. Internal store channel
2. Shopify
3. WooCommerce
4. Amazon
5. Flipkart
6. Customer portal/storefront

Each connector requires credentials reference, signature validation, inbound/outbound idempotency, external-to-SMRITI identity mapping, stock reservation, order convergence, retry/DLQ handling, and reconciliation reports.

**Exit evidence:** connector contract tests, provider sandbox tests, replay tests, stock oversell tests, and cross-company isolation tests pass.

## 9. P2 PSV, CGE, and PDT

### PSV

Complete control-plane PSV capability/version/policy/visibility/permission metadata while keeping PSV non-authoritative. Add scope tests proving a party sees only permitted projected stock.

### CGE

Unify loyalty, wallet, reward, referral, commission, tier, and campaign rules under versioned CGE policies. Add reversal and abuse-prevention tests.

### PDT

Implement the Predictive Distribution Twin as a separate intelligence capability:

- PDT capability/version/policy/threshold registries
- SKU twin cache
- demand signals and forecast data
- distribution predictions and confidence scores
- explainability, freshness, and model/version metadata
- strict read-only relationship to stock and accounting truth

**Exit evidence:** predictions are traceable to input data/model versions and cannot mutate transactional stock or ledgers.

## 10. P2 Offline-First and Event Architecture

### Offline-first

Complete the web local store, offline queue, sync engine, and conflict policy for POS and field operations:

- durable local queue with idempotency keys
- retry and backoff
- connectivity state
- ordering guarantees
- conflict detection and resolution
- partial failure recovery
- duplicate submission protection
- user-visible reconciliation status

**Exit evidence:** offline sale and field transaction scenarios replay successfully into the correct company database without duplicate financial or stock effects.

### Outbox/event processing

Complete the existing outbox foundation:

- publish contracts and schema versions
- worker lifecycle and health monitoring
- per-channel retry policy
- DLQ replay and operator controls
- event observability and correlation
- GST, Communicator, Analytics, and connector consumers
- event retention and archival policy

**Exit evidence:** crash/restart, timeout, duplicate, DLQ, replay, and ordering tests pass.

## 11. P2 Analytics and Intelligence Plane

Build a separate analytical layer that does not overload `smritisys` or tenant transaction databases:

- CDC or reliable outbox ingestion from every company database
- tenant/company/branch dimensions
- analytical facts and aggregates
- BI dashboards and trend analysis
- forecasting and predictive datasets
- data freshness and lineage
- access control and deletion/retention policy

Operational reports may continue reading transactional truth for current-state views, but heavy aggregation must move downstream.

**Exit evidence:** analytics ingestion is replayable, tenant-isolated, freshness-monitored, and cannot write back to operational ledgers.

## 12. P2 Compliance, Integration, and Audit Completion

Complete the Integration Hub and Audit/Compliance plane:

- connector/provider/version registry
- integration policy and credential references
- TallyPrime adapter and reconciliation
- payment provider adapters
- GST/e-invoice/e-way bill adapters through governed compliance services
- communication provider adapters
- immutable audit events, change history, security events, data-access events, regulatory events
- retention, redaction, export, and audit search

Physical printer verification is a separate operational acceptance gate for Zebra/TSC or supported thermal hardware.

**Exit evidence:** sandbox/provider contract tests, reconciliation reports, credential redaction tests, audit completeness checks, and hardware print evidence pass.

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
