# SMRITI Retail OS — Existing Development Module Audit v1.0

**Audit date:** 2026-10-23 (Asia/Calcutta)  
**Scope:** Static repository audit with non-mutating runtime probes attempted. No application files, database records, or Git state were changed by the audit. The five deliverables in this directory are the requested audit output.

## Executive summary

The repository is a large React/Vite frontend backed by FastAPI and PostgreSQL. It contains substantial code for inventory, sales, POS, purchasing, warehouse, payments, accounting, CRM, reporting, and platform services. Presence of these implementations is not equivalent to verified business operation: no database-backed end-to-end workflow was run, no test suite was run, and the available command output did not establish an active healthy API/database pair.

The matrix contains **35 discovered domain modules**. Static primary-status counts are:

| Primary status | Modules |
|---|---:|
| IMPLEMENTED_AND_VERIFIED | 0 |
| IMPLEMENTED_BUT_UNVERIFIED | 14 |
| PARTIALLY_IMPLEMENTED | 16 |
| DUPLICATE_OR_OVERLAPPING | 4 |
| PLACEHOLDER_OR_MOCK | 1 |
| UI_ONLY / BACKEND_ONLY / MISSING / BLOCKED_BY_DEPENDENCY | 0 |

These counts describe this audit’s grouped domain inventory, not the count of router files. Repository discovery also found 88 files under `backend/app/api/v1`, 95 `APIRouter` declarations, 75 top-level ORM model files, 229 migration files, and 214 Python service files. Duplicate router mounts and aliases mean those are source counts, not unique business capabilities.

The strongest reuse candidates are canonical item identity, product/barcode lookup, inventory and warehouse services, purchase orders and receipts, sales orders/invoices/returns, payment allocations, customer records, and shared company/branch context. They require runtime and schema verification before template provisioning.

**Readiness:** Distributor/wholesale is **not ready to provision**; retail billing is **not ready to provision**; hybrid is **not ready to provision**. The blockers are unverified transaction paths, overlapping billing entry points, unverified channel-specific pricing/authorization, and lack of current DB schema/runtime evidence.

**Prioritized findings:** P0 conditional deployment-secret risk in `docker-compose.yml`; P2 overlapping billing and route aliases; P2 unverified migration/schema state while the working tree includes a modified migration. No P1 business failure was confirmed from the available evidence.

## Evidence

### Repository and Git baseline

Commands run: `Get-Location`, `Get-ChildItem -Force`, `git status --short`, `git branch --show-current`, `git rev-parse HEAD`, `git log -8 --oneline --decorate`.

Literal baseline output:

```text
Path
F:\SMRITRretailNX

 M backend/alembic/versions/v1541_triage_quarantine_items.py
 M backend/app/logs/canonical_resolution_telemetry.jsonl
 A scripts/headless_child_billing_screenshot.py
 M src/components/billing/BillingWorkspace.tsx
 M src/components/billing/SmritiCreditBillingTerminal.tsx
?? scripts/seed_child_billing_demo.py

smritiNX
c92a7ecf466cff03ab4467521d04231c55ef5255
c92a7ecf (HEAD -> smritiNX, origin/smritiNX) feat(crm): end-to-end customer lifecycle audit and child billing guard hardening
e4bf2be1 feat(crm): parent-controlled child customer visibility in billing (v6.99.13)
631c2080 feat(classic-ux): enterprise menu portal architecture, nested submenus and viewport overflow remediation (v6.99.12)
ccae806b feat(foundation): implement Classic UX Workspace Directory and traditional ERP top menu ribbon v6.99.11
53c7a6bd docs(foundation): complete Premium UX Switcher walkthrough and mark plan completed
8c174199 feat(backup): critical backup integrity remediation, native pg_dump full recovery & UX completion overhaul
9301bebc feat(foundation): Premium UX Switcher (Regular UX <-> Classic UX) v6.99.9
448d971b feat(backup): master backup engine, windows cli suite, live logging and crash reconciliation
```

The status was dirty at the initial snapshot and changed between read-only Git snapshots. The final source paths reported by `git status --short` were:

```text
 M backend/alembic/versions/v1541_triage_quarantine_items.py
 M backend/app/cli/commands/db_cmd.py
 M backend/app/logs/canonical_resolution_telemetry.jsonl
 M backend/app/services/invoice_pdf_service.py
 M package.json
 A scripts/auto_migrate.py
 A scripts/headless_child_billing_screenshot.py
 A scripts/migrate.ps1
 M src/components/PrintPreviewModal.tsx
 M src/components/billing/BillingWorkspace.tsx
 M src/components/billing/SmritiCreditBillingTerminal.tsx
 M src/components/templates/TaxInvoiceA4.tsx
?? scripts/seed_child_billing_demo.py
```

All were preserved and none were edited by the audit. The four audit reports shown in the final Git status are the requested deliverables. The staged/unstaged state was not changed by the audit; branch and HEAD remained unchanged.

### Architecture and configuration

- `package.json`, `src/App.tsx`, and `vite.config.ts` identify React 18 + Vite, TypeScript, and a development proxy for `/api/v1`.
- `backend/app/main.py` builds FastAPI and mounts a router registry. `backend/app/core/config.py` declares PostgreSQL/SQLAlchemy settings and defaults `USE_FASTAPI_SALES`, `USE_FASTAPI_PURCHASE`, `USE_FASTAPI_POS`, and `USE_MULTI_DB_ROUTER` to `False`; statutory strict mode also defaults false. The report did not inspect `.env` values or disclose secrets.
- `docker-compose.yml` defines PostgreSQL, web, FastAPI, and SQL Server services. `docker-compose.dev.yml` defines a separate development PostgreSQL/API/web stack and sets `SKIP_MIGRATIONS=true`; the standard compose API sets `SKIP_MIGRATIONS` to false by default and contains literal fallback secret values. Whether runtime overrides are present was not verified.
- `src/lib/apiFetchV1.ts` is the common frontend API client and states it attaches bearer and company/branch context headers. `backend/app/api/deps.py` resolves tenant context from the authenticated user plus request context and checks company/branch assignments for non-SYSADMIN users. Static inspection supports the intended isolation path; runtime isolation was not exercised.
- `backend/app/main.py` contains a router registry with broad business and platform domains and several explicitly labeled legacy aliases. This is the effective API registry found in code. Frontend navigation/workspace definitions also exist under `src/navigation`, `src/components`, and application state; a single authoritative template manifest tying all these registries together was not verified.

### Static source inventory

Discovery excluded generated dependencies/build output such as `node_modules`, `dist`, `.venv`, bytecode, and pytest cache where `rg` supported exclusions. Source inventory covered `src`, `backend/app`, `backend/alembic`, and test directories. Top-level source structure includes `src/components`, `src/modules`, `src/navigation`, `src/services`, `src/lib`, `backend/app/api/v1`, `backend/app/models`, `backend/app/services`, and `backend/alembic/versions`. Legacy directories `shoper9/` and `shoper9pos/` are present at repository root and were not fully traced.

Static scan output recorded 88 router-module files, 95 router declarations, 1,170 route-decorator matches, 75 top-level model files, 229 migration files, 214 Python service files, and 387 immediate test files under `backend/tests` plus `backend/app/tests`. These counts are repository structure counts, not proof that every route or test is reachable or correct.

### Transaction and persistence evidence

- `backend/app/models/inventory.py` defines `Product.stock` as a cached aggregate and comments that authoritative stock is in `product_batch_stocks` and `stock_movements`, synchronized by `StockSynchronizer`. `StockMovement` includes product, item, warehouse, batch, serial, location, source, and idempotency fields.
- `backend/app/services/sales_stock_authority.py` states `stock_movements` and `product_batch_stocks` are the transactional authorities. `backend/app/services/sales_ledger_svc.py` posts invoice-linked stock movements.
- `backend/app/models/payment_ledger.py` defines `PaymentTransaction` and `PaymentAllocation`; `backend/app/services/payments_engine.py` and `backend/app/services/unified_ledger.py` provide write/posting paths. These are static code paths; no transaction was executed.
- `backend/app/services/canonical_sales_writer.py`, `backend/app/services/sales.py`, `backend/app/api/v1/sales.py`, and `backend/app/api/v1/pos.py` expose invoice/POS transaction paths. `backend/app/api/v1/purchase.py`, `backend/app/api/v1/grn.py`, and purchase models expose purchase-order, receipt, bill, amendment, and cost-related paths.
- ORM classes and migrations provide schema intent only. No live DB connection, column/constraint comparison, migration-head check against a database, or read/write verification was established. Schema parity is therefore **unverified**.

### Billing overlap and implementation evidence

The codebase has multiple billing UI surfaces, including `src/components/billing/BillingWorkspace.tsx`, `BillingTerm.tsx`, `SmritiBillingStudio.tsx`, `SmritiCreditBillingTerminal.tsx`, and `src/components/standalone/StandaloneWindowView.tsx`. The sources include separate bill suspension/recall behavior, offline local fallbacks, a dedicated offline queue call in `SmritiBillingStudio.tsx`, and a temporary draft-total fallback in the credit terminal. `backend/app/main.py` also mounts sales, POS, unified billing, and legacy aliases. The code presence establishes overlap, not that all surfaces are simultaneously active or that their financial rules diverge in production.

The route registry explicitly mounts aliases such as `/sales-invoices` and `/sales`, multiple purchase prefixes, several inventory/product/variant prefixes, and duplicate CRM/POS/loyalty paths. Some are explicitly marked legacy. They create an API compatibility surface that should be mapped before a new template layer is introduced.

### Tests and runtime verification

- Test configuration exists: root `vitest.config.ts` sets `DATABASE_PROVIDER=memory`, `NODE_ENV=test`, and includes `src/tests/**/*.test.ts(x)` except one excluded file. `backend/pyproject.toml` configures pytest paths and marks integration tests that need a live database.
- Existing concrete test references include `src/tests/menuRegistryRouting.test.ts`, `src/tests/menuAccess.test.ts`, `backend/app/tests/test_purchase.py`, `backend/app/tests/test_barcode.py`, and `backend/app/tests/test_item_master_422_validation.py`.
- **Targeted frontend tests run:** `npm.cmd run test -- src/tests/menuRegistryRouting.test.ts src/tests/menuAccess.test.ts`. Vitest uses `DATABASE_PROVIDER=memory` per `vitest.config.ts`; output:

  ```text
  > smriti-retail-os@6.99.1 test
  > vitest run src/tests/menuRegistryRouting.test.ts src/tests/menuAccess.test.ts

   RUN  v4.1.11 F:/SMRITRretailNX

   Test Files  2 passed (2)
        Tests  10 passed (10)
     Start at  09:37:37
     Duration  22.43s (transform 2.77s, setup 0ms, import 22.11s, tests 20ms, environment 0ms)
  ```

  This verifies only those two frontend navigation/access-control test files. No sales, inventory, POS, billing, database integration, or backend test suite was run.
- Local `/live` probes on ports 1981 and 1982 were attempted, but the tool returned no captured response. Runtime health and API reachability therefore remain unverified. Services were not started or restarted.
- No real billing transaction, production DB query, migration, cleanup, export, or data mutation was run.

## Interpretation

The repository has a broad set of implemented domain surfaces and real backend write paths, but the evidence supports only static existence and local code wiring. The audit does not claim any module is end-to-end verified. Features that depend on runtime DB credentials, route execution, migration parity, or a user/company data set remain unverified.

Several core records carry both canonical ledgers and cached/master-table fields. Inventory explicitly treats the `products.stock` column as a cache, but actual ledger/master consistency cannot be asserted without a read-only schema/data audit and safe reconciliation evidence. Payment allocation relationships exist in models; successful balanced accounting is not established by those models alone.

The `docker-compose.yml` fallback secrets create a P0 conditional risk: if the standard compose deployment runs without overriding the documented environment variables, its authentication/internal/vault keys are predictable literals in source. This is a code/configuration risk finding, not proof that a deployed environment is using those defaults.

The working tree has a modified migration `v1541_triage_quarantine_items.py`, while later migration files exist. Without inspecting the live database revision and schema, no migration/schema-drift conclusion can be made; the dirty migration makes that verification a prerequisite to provisioning.

## Recommendation

Before implementation, establish a known isolated test database, compare its migration revision and critical tables column-by-column against ORM/migration contracts, choose one canonical billing UI and transaction writer, and specify the channel/pricing/permission model. Keep the three templates disabled until their feature manifests are mapped to verified APIs and tests. Review the compose secret fallbacks before using the standard compose file in any environment that handles real data.

## Full inventory and supporting deliverables

- `SMRITI_MODULE_TEMPLATE_MATRIX.csv` contains all 35 grouped modules, paths, API/persistence references, status, and template eligibility.
- `SMRITI_MODULE_AUDIT.json` is the machine-readable version with dependencies, evidence, and gaps.
- `SMRITI_DUPLICATION_AND_GAPS.md` records overlaps, unverified links, and prioritized actions.
- `SMRITI_TEMPLATE_READINESS.md` gives separate readiness assessments for distributor, retail, and hybrid templates.

### Review checklist

**Evidence:** Static code, Git status, migrations/models, and test configuration were inspected. No test or live DB proof was obtained.  
**Interpretation:** Worktree changes are preserved; domain code is extensive but not verified end-to-end.  
**Recommendation:** Treat all three templates as not ready for provisioning until the blockers in the readiness document are resolved and reviewed.
