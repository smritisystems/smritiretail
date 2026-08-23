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
**Authority:** `docs/architecture/SMRITI_PLATFORM_IMPLEMENTATION_STATUS.md`

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

## 3. Immediate P0 Stabilization

### P0.1 Resolve POS FK migration before applying it

**Current state:** `v1360_pos_sct_fk_constraints.py` is untracked and live databases remain at `v1346_pos_cash_denominations`.

**Required work:**

1. Reconcile the migration's FK targets with the canonical accounting schema. The migration currently references `chart_of_accounts`, while the active accounting engine uses `accounts`.
2. Verify the actual `shift_cash_transactions`, `accounts`, and `journal_vouchers` schemas in every supported tenant database.
3. Correct the migration and precondition queries without changing historical migrations.
4. Run the migration on a disposable ephemeral tenant first.
5. Apply to approved tenant databases only after orphan checks pass.
6. Add a focused test proving both FK constraints and forward-only downgrade behavior.
7. Track the migration file and ADR together in version control.

**Exit evidence:** migration head equals `v1360_pos_sct_fk_constraints`; both FKs exist; orphan count is zero; focused POS suite passes.

### P0.2 Repair and secure eCommerce routing

**Current state:** `backend/app/api/v1/ecom.py` expects `res["connection_url"]`, but the resolver intentionally omits credential-bearing URLs. The webhook dependency also uses a service identity and default company headers rather than a fully verified request context.

**Required work:**

1. Replace URL extraction with the approved session dependency/pool path.
2. Remove hardcoded default tenant routing from production request handling.
3. Define authenticated service-to-company resolution for webhook intake.
4. Add HMAC/signature verification for every external connector.
5. Make idempotency key/correlation handling unique at the database level.
6. Ensure accepted orders converge into company-local Sales, Inventory, Payment, Tax, and Fulfillment engines.
7. Add negative tests for cross-company webhook submission and replay.

**Exit evidence:** internal eCommerce reserve, webhook intake, replay, and cross-company denial tests pass; no resolver response contains credentials or connection URLs.

### P0.3 Make production security configuration fail closed

**Required work:**

- Remove or disable development credential defaults when `ENVIRONMENT=production`.
- Require strong `JWT_SECRET_KEY`, `INTERNAL_SERVICE_KEY`, database credentials, and integration secrets at startup.
- Add startup tests for missing/weak production secrets.
- Review direct database creation sites and require registry authorization for every tenant engine.
- Replace unsafe raw SQL paths with allowlisted identifiers and parameterized values where applicable.

**Exit evidence:** production configuration starts only with valid secrets; security tests pass; resolver and session factories have one authorized routing path.

## 4. P1 Control Plane Completion

### P1.1 Global Reference Data and Localization

Implement and seed versioned control-plane registries for:

- countries, states, districts, cities, postal codes, geographies
- languages, locales, translation keys, translations, translation versions
- currencies, currency formats, number formats, date formats, time zones
- units and unit conversions
- tax reference codes, GST codes, HSN, SAC, tax categories, jurisdictions
- system constants and platform reference data

**Required contracts:** locale fallback, translation version selection, currency/number/date formatting, tenant override rules, and cache invalidation.

**Exit evidence:** migrations, models, CRUD/read APIs, seed data, tenant-resolution tests, and at least two non-English locale tests pass.

### P1.2 Capability and Module Registry

Complete the control-plane registry for:

- capabilities and capability versions
- capability dependencies
- business capability entitlements
- feature flags
- modules, module versions, dependencies, capability mappings, registry state
- plans, subscriptions, licenses, license features, status, and versions

Expand the current limited standard catalog to cover the frozen capability map: POS, Sales, Purchase, Inventory, Warehouse, Distribution, eCommerce, PSV, PDT, CGE, CRM, Accounting, GST, Payments, Pricing, Promotions, Fulfillment, Barcode, Label Printing, Reporting, Communicator, Document, Approval, Search, Integration, and Audit.

**Exit evidence:** a tenant can enable/disable a capability through control-plane metadata; dependency violations fail closed; license and role permissions remain separate; API and menu visibility agree.

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

- [Current implementation tracker](SMRITI_PLATFORM_IMPLEMENTATION_STATUS.md)
- [Canonical multi-company architecture](SMRITI_MULTI_COMPANY_DATABASE_ARCHITECTURE.md)
- [Mandatory architecture rules](../AI_AGENT_ARCHITECTURE_RULES.md)
- [POS FK deferral ADR](../adr/ADR-POS-002-ShiftCashTransaction-FK-Deferral.md)
