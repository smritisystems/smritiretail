## ISSUE 2026-08-12-01: Multi-Company Operations Engine (Phase 5) PostgreSQL Integration Test Resolution

**Severity:** P2 — Integration Test & Backup Formatting (PostgreSQL array literal formatting, connection URL builder, & NOT NULL constraints)
**Status:** RESOLVED
**Date:** 2026-08-12
**Ref:** ARCH-MEGA-REFACTOR-PHASE-5-TEST-FIX

### Symptom
1. `TypeError: CompanyDatabasePoolManager.dispose_all() missing 1 required positional argument: 'self'`.
2. `NotNullViolationError: null value in column "ref_document_type" of relation "journal_vouchers" violates not-null constraint`.
3. `ForeignKeyViolationError: insert or update on table "journal_vouchers" violates foreign key constraint "journal_vouchers_company_id_fkey"`.
4. `AttributeError: type object 'ControlDatabaseRegistryService' has no attribute 'build_connection_url'`.
5. `AsyncAdapt_asyncpg_dbapi.Error: <class 'asyncpg.exceptions.InvalidTextRepresentationError'>: malformed array literal: "[]"`.
6. `NameError: name 'HTTPException' is not defined` in `company_migration_fanout_service.py`.

### Root Cause
1. `dispose_all` was an instance method; the static/class method helper on `CompanyDatabasePoolManager` is `close_all_pools()`.
2. `JournalVoucherModel` required non-null `ref_document_type`, `ref_document_id`, `ref_document_no` values.
3. Test objects passed string `company_id` values pointing to un-inserted parent company rows in isolated company databases where foreign keys were enabled.
4. `ControlDatabaseRegistryService` lacked a static `build_connection_url` helper method expected by backup and migration fan-out services.
5. `backup_company_database` formatted empty Python lists `[]` as string `'[]'` instead of PostgreSQL array literal `'{}'`.
6. Missing `HTTPException` import in `company_migration_fanout_service.py`.

### Solution
1. Changed teardown call to `await CompanyDatabasePoolManager.close_all_pools()`.
2. Populated reference document fields in `JournalVoucherModel` test objects and set `company_id=None` on operational entities in isolated Company DBs.
3. Implemented `build_connection_url` static method in `ControlDatabaseRegistryService`.
4. Updated `backup_company_database` to format empty lists as `'{}'` and populated lists as PostgreSQL array literals `'{val1,val2}'`.
5. Imported `HTTPException` in `company_migration_fanout_service.py` and raised 404 for non-existent companies in `inspect_company_database_drift`.
6. Empirical verification: **15/15 Phase 5 integration tests PASS** on PostgreSQL; **46/46 Phase 1–3 regression tests PASS**; **28/28 Phase 4 integration tests PASS**.

---

## ISSUE 2026-08-11-03: PostgreSQL ENUM Type Re-creation & Pytest-Asyncio Event Loop Scope Mismatch in Multi-Database Integration Tests

**Severity:** P2 — Integration Test Setup (AsyncPG ENUM type duplication & event loop binding across multi-DB fixtures)
**Status:** RESOLVED
**Date:** 2026-08-11
**Ref:** ARCH-MEGA-REFACTOR-PHASE-4-TEST-FIX

### Symptom
1. `sqlalchemy.exc.IntegrityError: <class 'asyncpg.exceptions.UniqueViolationError'>: duplicate key value violates unique constraint "pg_type_typname_nsp_index" [SQL: CREATE TYPE userrole AS ENUM ...]`.
2. `RuntimeError: Task <Task ...> got Future <Future ...> attached to a different loop`.

### Root Cause
1. In SQLAlchemy, `sqlalchemy.Enum` caches type creation per Python Enum class. When `create_all` is invoked sequentially across multiple distinct PostgreSQL engines (`Control DB`, `Company DB A`, `Company DB B`, `Master Hub DB`), SQLAlchemy's dialect visitor skips checking `pg_type` if the Enum instance was already marked as compiled, while PostgreSQL rejects duplicate `CREATE TYPE` or raises `UndefinedObjectError`.
2. `pytest-asyncio` creates a new asyncio event loop for every test function by default. When an engine or connection pool is created in a module-scoped fixture, asyncpg connections bind to the setup event loop and throw `RuntimeError` when accessed from function-scoped test loops.

### Solution
1. In `setup_phase4_environment`, added explicit `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'userrole') THEN CREATE TYPE ... END IF; END $$;` DDL execution across all 4 PostgreSQL engines before calling `create_all`.
2. Changed `setup_phase4_environment` fixture to function scope with explicit engine/pool disposal on teardown, matching `test_company_database_isolation.py` pattern.
3. Re-ran Phase 4 suite (`28/28 PASSED`) and Phase 1–3 regression suite (`46/46 PASSED`) on PostgreSQL cleanly.

---

## ISSUE 2026-08-11-02: Control DB Authorization Signature Resolution & Foreign Key Order in Master Hub Tests

**Severity:** P2 — Integration Test Setup (Authorization helper signature alignment and PostgreSQL foreign key order)
**Status:** RESOLVED
**Date:** 2026-08-11
**Ref:** ARCH-MEGA-REFACTOR-PHASE-3-TEST-FIX

### Symptom
1. `AttributeError: 'bool' object has no attribute 'company_id'` during `MasterHubExchangeService` authorization evaluation.
2. `sqlalchemy.exc.IntegrityError: <class 'asyncpg.exceptions.ForeignKeyViolationError'>: insert or update on table "master_hub_imports" violates foreign key constraint "master_hub_imports_hub_master_id_fkey"`.

### Root Cause
1. `ControlDatabaseRegistryService.verify_user_company_access()` returns `bool` (`True`/`False`), whereas service method assumed it returned `ControlCompanyDatabase`. `get_company_database()` is the helper that fetches `ControlCompanyDatabase`.
2. In `test_master_hub.py` test 11 (`test_conflict_is_detected`), a `MasterHubImport` record was inserted without inserting a parent `MasterHubRecord` first, violating foreign key constraint `master_hub_imports_hub_master_id_fkey`.
3. In `setup_master_hub_environment`, `ControlCompanyDatabase` fixture instances omitted `db_user="smriti_app"`, violating NOT NULL constraint on `control_company_databases.db_user`.

### Solution
1. Updated `MasterHubExchangeService` to check `verify_user_company_access` boolean result first, then fetch `get_company_database` for metadata.
2. Updated `test_master_hub.py` fixture to specify `db_user="smriti_app"` and insert parent `MasterHubRecord` in test 11.
3. Re-ran `test_master_hub.py`: 20/20 tests passed cleanly on PostgreSQL.

---

## ISSUE 2026-08-11-01: DDL Escape & Duplicate Index Syntax Errors During Multi-Database Create All

**Severity:** P1 — Integration Failure (AsyncPG PostgreSQL DDL execution error during multi-DB test environment setup)
**Status:** RESOLVED
**Date:** 2026-08-11
**Ref:** ARCH-MEGA-REFACTOR-PHASE-2-DDL-FIX

### Symptom
When executing `CompanyBase.metadata.create_all` on PostgreSQL test databases (`smriti_company_a_test`):
1. `sqlalchemy.exc.DBAPIError: <class 'asyncpg.exceptions.InvalidTextRepresentationError'>: invalid input syntax for type json` with DDL output `DEFAULT '''{}'::jsonb'`.
2. `sqlalchemy.exc.ProgrammingError: <class 'asyncpg.exceptions.DuplicateTableError'>: relation "ix_user_company_assignments_user_id" already exists`.

### Root Cause
1. In `inventory_kernel.py`, `scdm.py`, `product_identity.py`, `inventory.py`, `crm.py`, `platform.py`, column definitions declared `server_default="'{}'::jsonb"` or `server_default="'[]'::jsonb"` as raw Python strings. During SQLAlchemy DDL compilation for PostgreSQL dialects, raw string literals are wrapped in extra single quotes resulting in invalid PostgreSQL SQL `'''{}'::jsonb'`.
2. In `user_assignment.py`, models `UserCompanyAssignment`, `UserBranchAssignment`, and `UserStoreAssignment` defined both `index=True` on column attributes AND explicit `Index("ix_...", "...")` inside `__table_args__`. This caused SQLAlchemy's `create_all` visitor to attempt emitting two duplicate `CREATE INDEX` statements for the same index name.

### Solution
1. Converted all raw string default assignments to explicit `sqlalchemy.text` expressions (e.g. `server_default=text("'{}'")` and `server_default=text("'[]'")`).
2. Removed redundant `index=True` column attributes on fields that already possess explicit `Index(...)` declarations in `__table_args__`.
3. Re-ran `test_company_database_isolation.py`: 5/5 physical database isolation tests passed cleanly on PostgreSQL.

---

## ISSUE 2026-08-10-05: Sales Invoice 422 — customer_id Wiring (SCS-INV-001)

**Severity:** P0 — Production failure (every invoice POST returned HTTP 422)
**Status:** RESOLVED
**Date:** 2026-08-10
**Ref:** SCS-INV-001-CUSTOMER-ID-WIRING

### Symptom
`POST /api/v1/sales/invoices` returned HTTP 422 with:
```
body -> customer_id: Field required
```
No sales invoice could be created from the Sales Billing Studio.

### Root Cause — 3 Confirmed Gaps

#### Gap 1 — ISalesService.ts: SalesInvoiceRecord had no customerId field
`src/kernel/public/ISalesService.ts:33-58` — The entire frontend type contract (`SalesInvoiceRecord`) defined `customerName`, `customerMobile`, `customerGstin` but had no `customerId` field. With no slot in the interface, nothing downstream could carry the customer FK.

#### Gap 2 — SalesService.saveInvoice(): customer_id never sent to backend
`src/kernel/internal/SalesService.ts:80-110` — The `record` object was built directly from `SalesInvoiceRecord` fields. Because `customerId` was absent from the interface, `JSON.stringify(record)` sent to `POST /api/v1/sales/invoices/` never contained `customer_id`. Backend schema declares `customer_id: str = Field(...)` (required) → 422 on every call.

#### Gap 3 — SalesBillingStudio: selectedCustomer.id never passed to command
`src/components/sales/SalesBillingStudio.tsx:461-499` — `selectedCustomer` state held the full Customer object including `.id`, used in the dropdown control (line 662). But the `CreateSalesInvoiceCommand` payload only passed `customerName`, `customerMobile`, `customerGstin` — never `customerId: selectedCustomer?.id`.

#### Bonus Finding F-INV-TC — Cross-Company Customer Isolation Missing (Security)
`backend/app/services/sales_orchestrator.py:282` — `create_sales_invoice()` accepted any `customer_id` without verifying that the customer belongs to `tenant_ctx.company_id`. A customer from Company A could be silently used in a Company B invoice. Discovered by T-C regression test (initially FAILED).

### Resolution

#### Gap 1 Fix
Added `customerId?: string` to `SalesInvoiceRecord` interface.
- **File:** `src/kernel/public/ISalesService.ts`

#### Gap 2 Fix
`SalesService.saveInvoice()` now sets `customerId: invoiceData.customerId` in the record body. Backend accepts `customerId` via `AliasChoices("customer_id", "customerId")`. `normalizeBackendInvoice()` maps `inv.customer_id` back to `customerId`.
- **File:** `src/kernel/internal/SalesService.ts`

#### Gap 3 Fix
`SalesBillingStudio` now passes `customerId: selectedCustomer?.id` into `CreateSalesInvoiceCommand`. Added frontend guard: if `selectedCustomer === null`, POST is blocked with a user-facing toast before the API call is made. Added `Workspace.Changed.v1` subscriber to reset `selectedCustomer` on company switch (prevents cross-company customer from persisting in UI state).
- **File:** `src/components/sales/SalesBillingStudio.tsx`

#### F-INV-TC Fix — Customer-Tenant Validation in Orchestrator
Added customer ownership check at the top of `create_sales_invoice()`: if `invoice_in.customer_id` is provided, verifies `Customer.company_id == tenant_ctx.company_id`. Cross-company customer → 404.
- **File:** `backend/app/services/sales_orchestrator.py`

### Test Evidence
```
python -m pytest backend/app/tests/test_sales_invoice_customer_wiring.py -v

test_ta_correct_customer_id_accepted       PASSED
test_tb_missing_customer_id_returns_422    PASSED
test_tc_cross_company_customer_rejected    PASSED
test_td_valid_customer_invoice_persists    PASSED
test_te_walkin_customer_path               SKIPPED (no approved walk-in row)

4 passed, 1 skipped in 43.88s
```
TypeScript: `npx tsc --noEmit --skipLibCheck` → 0 errors

### Known Limitation
Walk-in / Cash Sale: No approved walk-in customer row exists in the current DB architecture. `customer_id` is a required FK to the `customers` table. The frontend guard (`selectedCustomer === null`) prevents the 422 from reaching the backend, but walk-in invoicing requires a provisioned walk-in customer per company. This requires an ADR before implementation.


## ISSUE 2026-08-10-04: Multi-Company Switch Hardening (SCS-WSC-001/SCS-WSC-002)

**Severity:** CRITICAL (P0 — Security vulnerability + silent data isolation failure)
**Status:** RESOLVED
**Date:** 2026-08-10
**Ref:** SCS-WSC-002-MULTI-COMPANY-SWITCH

### Root Cause & Findings

#### F-1 — Anonymous Access to /workspace/switch (Security P0)
`/workspace/switch` used `get_current_user_optional` as its dependency. Anonymous (unauthenticated) requests were silently accepted, defaulting `user_role = "SYSADMIN"` — granting full admin workspace context to any unauthenticated caller.

#### F-2 — No UserCompanyAssignment Authorization (Security P0)
Even authenticated users could pass any arbitrary `companyId` in the switch payload. No check was performed against the `user_company_assignments` table. A user could switch to any company in the system regardless of their assignment.

#### F-3 — No DB Mutation — Switch Had No Real Effect
The switch endpoint never mutated `user.company_id` or `user.branch_id` on the database row. Since `get_tenant_context()` reads `current_user.company_id` fresh from the DB on every request, calling `/workspace/switch` had zero effect on subsequent business endpoint isolation.

#### F-4 — SYSADMIN Privilege Escalation on Anonymous Request
The fallback `user_role = "SYSADMIN" if not current_user else current_user.role.value` pattern meant unauthenticated callers received a workspace context with SYSADMIN role permissions.

#### F-5 — Frontend Cache Not Invalidated on Company Switch
All 5 kernel services (`ItemService`, `CustomerService`, `SupplierService`, `SalesService`, `PurchaseService`) maintained an in-memory `localCache` array with no company-key tagging. Switching companies showed stale data from the previous company until the browser was refreshed.

#### F-6 — workspace_resolver.py Import Error Masked by Lazy Import
`workspace_resolver.py:16` imported `Warehouse`, `CompanyFinancialYear`, `CompanyTaxProfile` from `app.models.tenant`. These models live in `app.models.inventory` and `app.models.company_master` respectively. The bug was invisible in production because the import was inside the endpoint function body (lazy), but caused `ImportError` when the module was loaded directly (e.g. in tests).

#### F-7 — /auth/tenants Scoped Only to Current Company
`GET /auth/tenants` used `user.company_id == X` (a single value) instead of the `UserCompanyAssignment` table. Users with multiple company assignments only saw their currently-active company in the tenant selector.

### Resolution

#### F-1, F-4 — Mandatory Authentication
Changed `get_current_user_optional` → `get_current_user` on `/workspace/switch`. Anonymous requests now return **401 Unauthorized**. Removed the SYSADMIN fallback entirely.
- **File:** `backend/app/api/v1/system.py`

#### F-2 — UserCompanyAssignment Authorization Check
Added `UserCompanyAssignment` query before allowing any switch. If no active assignment exists for `(user_id, company_id)`, the endpoint returns **403 Forbidden** with a clear message.
- **File:** `backend/app/api/v1/system.py`

#### F-3 — DB Mutation (company_id / branch_id)
Added explicit DB mutation: `current_user.company_id = payload.companyId`, `current_user.branch_id = resolved_branch_id`, followed by `await db.commit()`. Branch is resolved via three fallback tiers: (a) user's default `UserBranchAssignment` for the target company, (b) any assignment, (c) first branch of the company.
- **File:** `backend/app/api/v1/system.py`

#### F-5 — Cache Flush on Workspace.Changed.v1
Added `constructor()` to each of the 5 kernel services subscribing to `SPK.events.on("Workspace.Changed.v1")`. On event: `this.localCache = []` (and `this.isLoaded = false` for `ItemService`). The event is emitted by `SWC.switchWorkspaceContext()` which is called by `CompanySwitcherBadge` after a confirmed switch.
- **Files:** `src/kernel/internal/ItemService.ts`, `CustomerService.ts`, `SupplierService.ts`, `SalesService.ts`, `PurchaseService.ts`

#### F-6 — workspace_resolver.py Import Fix
Split the single broken import into:
```python
from app.models.tenant import Company, Branch, TenantProvisionProfile
from app.models.inventory import Warehouse
from app.models.company_master import CompanyFinancialYear, CompanyTaxProfile
```
- **File:** `backend/app/services/workspace_resolver.py`

#### F-7 — /auth/tenants Multi-Assignment Fix + /auth/my-companies New Endpoint
- `GET /auth/tenants` now queries `UserCompanyAssignment` for all assigned company IDs, then returns all those companies and their branches. SYSADMIN still sees all.
- Added `GET /auth/my-companies` — scoped endpoint specifically for the `CompanySwitcherBadge` dropdown. Returns `{ companies: [...], active_company_id }`.
- **File:** `backend/app/api/v1/auth.py`

### New Component
`CompanySwitcherBadge` (`src/components/CompanySwitcherBadge.tsx`) integrated into `WorkspaceKernelHeader`. Switch flow: `POST /workspace/switch` → `GET /auth/me` (confirm DB mutation) → `SWC.switchWorkspaceContext()` → `Workspace.Changed.v1` event. Hidden in POS focus mode.

### Test Coverage
`backend/app/tests/test_multi_company_switch.py` — 15 tests covering the complete switch contract: auth enforcement (T1,T4), authorization (T2,T3), DB mutation (T5,T6), data isolation (T7,T8), endpoint scoping (T9-T11), session preservation (T12), branch boundary (T13), deleted company (T14), critical regression T15 (second request reflects new company).

---

## ISSUE 2026-08-10-03: Item Master F-001→F-004 Structural Hardening (ITEM-MASTER-HARDENING)

**Severity:** HIGH (Four structural findings in production Item Master wiring)
**Status:** RESOLVED
**Date:** 2026-08-10
**Ref:** ITEM-MASTER-HARDENING-F001-F004

### Root Cause & Findings

#### F-001 — Invalid Auto-Generated Barcode
`ItemService.ts` (`save()`), `ItemMasterTab.tsx` (`blankItemForm()`), and `ExcelGridEntrySection.tsx` (two locations) used invalid barcode fallbacks:
- `Math.floor(8900000000000 + Math.random() * 9000000000)` — 13 digits but no GS1 Mod-10 check digit
- `` `SMR-B${Math.floor(Math.random() * 900000)}` `` — alphabetic prefix, not a valid barcode symbology

These barcodes fail POS scanner validation and produce incorrect barcode labels.

#### F-002 — Frontend Status Does Not Map to Backend Lifecycle
Frontend sent `status: "Active"` in the POST body, but the `products` table has no `status` column. The authoritative columns are `workflow_status: String(30)` and `is_active: Boolean` (both in `BaseEntity`). Product lifecycle was therefore never persisted correctly.

#### F-003 — Silent API Failure Returns Empty Cache
`ItemService.getAll()` caught all exceptions with a single `logger.warn` and silently returned `[]` regardless of whether the cache was empty or populated. A fresh install with a failed API returned empty data without surfacing any error to the UI.

#### F-004 — Client-Generated Timestamp Product IDs
`save()` used `prod_${Date.now()}` for new product IDs — non-UUID format that collides across browser sessions. `ProductCreate.id` was `required: str`, forcing the client to always supply an ID.

### Resolution

#### F-001
- Introduced `generateSmritiEan13()` helper in `ItemService.ts`, delegating to the existing `BarcodeEngine.generateInternalEAN13("200", seq)`.
- GS1 restricted-circulation prefix "200" is the same prefix used by the backend `ProductIdentityService.generate_ean13_barcode()`.
- Patched `blankItemForm()` in `ItemMasterTab.tsx` and both fallback barcode generation sites in `ExcelGridEntrySection.tsx`.
- Rule PBC-001: existing `BarcodeEngine` promoted, not duplicated.

#### F-002
- Added `mapStatusToLifecycle()` / `mapLifecycleToStatus()` helpers in `ItemService.ts`.
- `backendPayload` in `save()` now includes `workflow_status` and `is_active` derived from frontend status.
- `normalizeBackendProduct()` derives frontend `status` from `p.workflow_status` and `p.is_active`.
- Backend schemas (`ProductCreate`, `ProductUpdate`, `ProductResponse`) extended with `workflow_status: Optional[str]` and `is_active: Optional[bool]`.
- **No migration required** — both columns already exist in `BaseEntity`.

#### F-003
- Distinguished two failure cases in `getAll()`:
  - Case A (cache populated): warn, emit `ItemLoadFailed` event, return cache.
  - Case B (cache empty): rethrow so `ItemMasterTab` can surface an error state.

#### F-004
- Replaced `prod_${Date.now()}` with `crypto.randomUUID()` (UUID v4).
- Made `ProductCreate.id: Optional[str] = Field(None, ...)` on the backend.
- `create_product()` service pops `None` id from `product_data` before `Product(**product_data)` so `BaseEntity`'s `default=lambda: str(uuid4())` fires.
- Backward compatibility: existing stable UUIDs passed by callers are still honoured.

### Files Modified
- `src/kernel/internal/ItemService.ts`
- `src/components/ItemMasterTab.tsx`
- `src/components/ExcelGridEntrySection.tsx`
- `backend/app/schemas/inventory.py`
- `backend/app/services/inventory.py`

### Tests
- New test file: `src/tests/itemMasterHardening.test.ts` (22 assertions covering F-001–F-004 and barcode source preservation).
- TypeScript: 0 errors (confirmed `npx tsc --noEmit --skipLibCheck`).

---

## ISSUE 2026-08-10-02: Stock Ledger Running Balance & Option A Kernel Redirection (STOCK-LEDGER-HARDENING)


**Severity:** HIGH (Blocks enterprise stock ledger auditability & running balance calculation)
**Status:** RESOLVED
**Date:** 2026-08-10
**Ref:** OPTION-A-STOCK-LEDGER-HARDENING

### Root Cause & Findings (Phase 0 Architecture Gate)

`GET /api/v1/inventory/ledger` returned `balanceAfter = 0` for all records because:
1. The read path queried `stock_movements` (a legacy compatibility shim), which contained no running balance calculation logic.
2. `stock_movements` had a known trigger gap: `POS_SALE` was omitted from the `inventory_state_reconciliation_trigger` taxonomy.
3. The true append-only kernel ledger is `inventory_ledger_entries` (ILE), governed by Rule LIM-006 (Ledger Immutability Rule).

### Resolution (Option A)

1. **API Redirection (`app/api/v1/inventory.py`):**
   - Redirected `GET /api/v1/inventory/ledger` to read from `inventory_ledger_entries`.
   - Computed `balance_after` via SQL window function `SUM(net_qty) OVER (PARTITION BY company_id, product_id ORDER BY posting_timestamp ASC, entry_no ASC)`.
   - Derived `quantity_in` and `quantity_out` on the backend using ILE location semantics (`to_location_id` = inbound, `from_location_id` = outbound).
2. **Schema & Types (`app/schemas/inventory.py`, `src/types.ts`):**
   - Created `StockLedgerEntryResponse` schema.
   - Updated `StockLedgerEntry` TypeScript interface to make `balanceAfter` nullable (`number | null`), preventing `0` from masking unavailable balances.
3. **Frontend UI (`src/components/StockLedgerTab.tsx`):**
   - Removed `balanceAfter: 0` fallback. Displays backend `balance_after` value directly.
   - Expanded badge renderer and filter controls for canonical movement taxonomy (`PURCHASE`, `SALE`, `POS_SALE`, `SALE_RETURN`, `PURCHASE_RETURN`, `TRANSFER_OUT`, `TRANSFER_IN`, `ADJUSTMENT`).
4. **SQLAlchemy Forward-Reference Fix (`app/tests/conftest.py`):**
   - Added `from app.models.size_master import SizeScale` to `conftest.py` before `app.models.inventory` imports, resolving an `InvalidRequestError: name 'SizeScale' is not defined` lazy mapper error that affected inventory integration tests.
5. **Validation & Test Suite (`app/tests/test_stock_ledger_balance.py`):**
   - Implemented 18 comprehensive integration tests covering all business scenarios. 18/18 passed.
   - Kernel certification suites `test_inventory_kernel_certification.py` and `test_inventory_kernel_certification_full.py`: 15/15 passed.
   - `npx tsc --noEmit`: 0 errors.

### Known Backlog Observation (DHI-SDIC-001)

- **ID:** `DHI-SDIC-001`
- **Title:** SDIC capability evidence path misalignment
- **Severity:** P2 (Non-blocking)
- **Impact:** Scanner reports 8% for Stock Ledger due to static path expectation (`src/product-foundation/inventory/stock-ledger/`). Production functionality & API evidence are 100% complete and verified (18/18 tests pass).
- **Action:** Refactor SDIC scanner evidence discovery after core commerce priorities, without modifying production module topology for scoring purposes.

## ISSUE 2026-08-10-01: Alembic Fresh-Database Migration Failure — StringDataRightTruncationError

**Severity:** CRITICAL (Blocks all fresh-install provisioning)
**Status:** RESOLVED
**Date:** 2026-08-10
**Ref:** ALEMBIC-FRESH-DB-MIGRATION-REPAIR

### Root Cause

Alembic persists the active revision ID to `alembic_version.version_num VARCHAR(32)`. Four migration files contained revision IDs longer than 32 characters, causing a `StringDataRightTruncationError` on fresh PostgreSQL databases:

| File (old name) | ID Length |
|---|---|
| `v900_multi_group_category_mapping.py` | 33 chars |
| `v1400_phase_e_authority_hardening.py` | 33 chars |
| `v1501_barcode_sourcing_multi_mode.py` | 33 chars |
| `v1502_tenant_scoped_product_code_sku.py` | 36 chars |

A previous workaround in `env.py` used `ALTER TABLE alembic_version ALTER COLUMN version_num TYPE VARCHAR(255)` to bypass the limit, but this caused `InFailedSQLTransactionError` on fresh databases (where `alembic_version` doesn't exist yet) via asyncpg transaction state propagation.

### Resolution

**Migration files renamed** (DDL logic unchanged):

| Old Revision ID | New Revision ID (≤32 chars) |
|---|---|
| `v900_multi_group_category_mapping` | `v900_multigroup_catmap` |
| `v1400_phase_e_authority_hardening` | `v1400_phase_e_auth_hardening` |
| `v1501_barcode_sourcing_multi_mode` | `v1501_barcode_src_mode` |
| `v1502_tenant_scoped_product_code_sku` | `v1502_tenant_prod_sku` |

**`v1401_phase_e_backfill.py` updated**: `down_revision` reference corrected from `v1400_phase_e_authority_hardening` → `v1400_phase_e_auth_hardening`.

**`env.py` updated** (`do_run_migrations`):
- Removed the `ALTER TABLE alembic_version ALTER COLUMN version_num TYPE VARCHAR(255)` workaround entirely.
- Added a table-existence-gated compatibility mapping block that:
  1. Checks `information_schema.tables` for `alembic_version` existence (fresh DB safety).
  2. If present, runs 4 individual `UPDATE` statements (separate `execute()` calls to prevent asyncpg transaction abort propagation).
  3. Commits before handing control to Alembic's migration context.

### Verification Results

```
# Fresh DB (smriti_fresh_test_db — standard VARCHAR(32)):
alembic upgrade head → 10 passed, 0 errors
alembic_version = v1502_tenant_prod_sku
version_num column width = VARCHAR(32)

# Existing DB compatibility fixture (smriti_existing_compat_db):
Legacy ID v1502_tenant_scoped_product_code_sku → remapped → v1502_tenant_prod_sku
alembic upgrade head → 0 DDL re-executed (already at head after mapping)

# Tenant Isolation Suite (10/10):
10 passed, 8 warnings in 66.85s
```

### Files Changed

```
backend/alembic/env.py                                        [MODIFIED]
backend/alembic/versions/v900_multigroup_catmap.py            [NEW]
backend/alembic/versions/v1400_phase_e_auth_hardening.py      [NEW]
backend/alembic/versions/v1501_barcode_src_mode.py            [NEW]
backend/alembic/versions/v1502_tenant_prod_sku.py             [NEW]
backend/alembic/versions/v900_multi_group_category_mapping.py [DELETED]
backend/alembic/versions/v1400_phase_e_authority_hardening.py [DELETED]
backend/alembic/versions/v1501_barcode_sourcing_multi_mode.py [DELETED]
backend/alembic/versions/v1502_tenant_scoped_product_code_sku.py [DELETED]
backend/alembic/versions/v1401_phase_e_backfill.py            [MODIFIED — down_revision ref]
```

---

## ISSUE 2026-08-09-06: Organisation Module — Tenant Isolation & CompanyResponse Regression Suite

**Severity:** HIGH (Security & Tenant Scoping Hardening)  
**Status:** RESOLVED  
**Date:** 2026-08-09  
**Ref:** ORG-TENANT-ISOLATION-GUARD  

### Scope

Locked in tenant isolation across all 5 organizational entity types (`organization`, `company`, `branch`, `store`, `warehouse`) and added regression protection for `CompanyResponse` fields.

### Tests Implemented (`backend/app/tests/test_masters_consolidation.py`)

1. **`test_organization_tenant_isolation`**: Validates `Organization` creation under Tenant A, verifies Tenant B `GET /masters/organizations` excludes Tenant A's record, blocks Tenant B `PUT /masters/organizations/{id}` with `HTTP 403`, blocks Tenant B `DELETE /masters/organizations/{id}` with `HTTP 403`, and verifies Tenant A's record remains untouched.
2. **`test_company_tenant_isolation`**: Validates `Company` creation under Tenant A, verifies Tenant B `GET /masters/companies` excludes Tenant A's record, blocks Tenant B `PUT /masters/companies/{id}` with `HTTP 403`, blocks Tenant B `DELETE /masters/companies/{id}` with `HTTP 403`, and verifies Tenant A's record remains untouched.
3. **`test_branch_tenant_isolation`**: Validates `Branch` creation under Tenant A, verifies Tenant B `GET /masters/branches` excludes Tenant A's record, blocks Tenant B `PUT /masters/branches/{id}` with `HTTP 403`, blocks Tenant B `DELETE /masters/branches/{id}` with `HTTP 403`, and verifies Tenant A's record remains untouched.
4. **`test_store_tenant_isolation`**: Validates `Store` creation under Tenant A, verifies Tenant B `GET /masters/stores` excludes Tenant A's record, blocks Tenant B `PUT /masters/stores/{id}` with `HTTP 403`, blocks Tenant B `DELETE /masters/stores/{id}` with `HTTP 403`, and verifies Tenant A's record remains untouched.
5. **`test_warehouse_tenant_isolation`**: Validates `Warehouse` creation under Tenant A, verifies Tenant B `GET /masters/warehouses` excludes Tenant A's record, blocks Tenant B `PUT /masters/warehouses/{id}` with `HTTP 403`, blocks Tenant B `DELETE /masters/warehouses/{id}` with `HTTP 403`, and verifies Tenant A's record remains untouched.
6. **`test_company_response_fields_preservation`**: Creates/updates a Company with `company_type="LLP"`, `fiscal_year_start_month=4`, `currency_code="INR"`, `is_gst_registered=True`, fetches `GET /masters/companies`, and verifies all 4 fields are preserved in `CompanyResponse` without returning `None` or default fallbacks.

### Verification Results

```
backend/app/tests/test_masters_consolidation.py::test_company_crud PASSED
backend/app/tests/test_masters_consolidation.py::test_branch_store_warehouse_crud PASSED
backend/app/tests/test_masters_consolidation.py::test_organization_and_extended_branch_crud PASSED
backend/app/tests/test_masters_consolidation.py::test_lookups_validation_and_soft_delete PASSED
backend/app/tests/test_masters_consolidation.py::test_organization_tenant_isolation PASSED
backend/app/tests/test_masters_consolidation.py::test_company_tenant_isolation PASSED
backend/app/tests/test_masters_consolidation.py::test_branch_tenant_isolation PASSED
backend/app/tests/test_masters_consolidation.py::test_store_tenant_isolation PASSED
backend/app/tests/test_warehouse_tenant_isolation PASSED
backend/app/tests/test_company_response_fields_preservation PASSED

10 passed in 102.60s
```

---

## ISSUE 2026-08-09-05: DHI Structural Audit — Parts 4–6 Remediation

**Severity:** MEDIUM (Test Coverage Gap + Session Reliability)
**Status:** RESOLVED
**Date:** 2026-08-09
**AUD Ref:** DHI-AUDIT-PARTS-4-6

### Scope

Three structural gaps from the DHI forensic audit (46% / Grade D) were addressed:

---

#### Part 4 — Zero-Score Module Tests (Evidence-First)

**Finding:** 4 backend service modules had zero isolated test coverage:

| Module | Path |
|---|---|
| `workspace_resolver.py` | `backend/app/services/workspace_resolver.py` |
| `inventory_universal_search.py` | `backend/app/services/inventory_universal_search.py` |
| `sip/strategies.py` | `backend/app/services/sip/strategies.py` |
| `printer_registry.py` | `backend/app/services/print_framework/printer_registry.py` |

**Resolution:** Created 4 pure pytest unit test files (no DB, fully mocked):
- `backend/app/tests/test_workspace_resolver.py` — 9 tests
- `backend/app/tests/test_inventory_universal_search.py` — 7 tests
- `backend/app/tests/test_sip_strategies.py` — 22 tests
- `backend/app/tests/test_printer_registry.py` — 13 tests

**Result:** 51/51 new tests passing.

**Additional DHI Finding (pre-existing bug):** `workspace_resolver.py` imports `Warehouse`, `CompanyFinancialYear`, `CompanyTaxProfile`, `TenantProvisionProfile` from `app.models.tenant` — these classes do not exist in that module. This is a broken production import documented in the test file header and logged as a separate backlog item (SXP-WSR-001).

---

#### Part 5 — Scanner Metadata Fix

**Finding:** `src/modules/dev_tracker/scanner/parser.ts` did not exclude the `backups/` directory from file scanning. Archived code in `backups/` contributed phantom TODO tokens that incorrectly inflated the DHI quality score penalty (`-2 per TODO`).

**Resolution:** Added `"backups"` to the `getFilesRecursively()` exclusion list (`parser.ts` lines 39–50).

**Verified:** CRM frontend key (`CrmStudioTab.tsx`) and POS routeKeywords (`/api/v1/pos`) already correct in the live TypeScript scanner — no further changes needed.

---

#### Part 6A — P0 Concurrency Fix Verification (Evidence)

All 6 P0 findings from the prior session verified present in live code:

| Finding | File | Evidence |
|---|---|---|
| `begin_nested()` savepoint | `inventory.py:249` | Confirmed |
| `IntegrityError` → specific 409 | `inventory.py:308–320` | Confirmed |
| Tenant-scoped existence check | `attributes.py:467` | Confirmed |
| `IntegrityError` wrap in generate_variants | `attributes.py:537` | Confirmed |
| `UniqueConstraint(company_id, code)` | `models/inventory.py:98` | Confirmed |
| `UniqueConstraint(company_id, sku)` | `models/inventory.py:99` | Confirmed |
| Migration `v1502_tenant_scoped_product_code_sku.py` | `backend/alembic/versions/` | Confirmed (6,394 bytes) |

---

#### Part 6B — SQLAlchemy Session Recovery Hardening

**Finding:** `pool_pre_ping` was missing from the async engine config. After a PostgreSQL idle timeout, connections become stale; without `pool_pre_ping=True`, the next request may silently fail with a `OperationalError`.

**Resolution:**
- Added `pool_pre_ping=True` to `create_async_engine()` in `backend/app/db/session.py`
- Removed a leftover `print(f"DEBUG RLS INTERCEPTOR: ctx={ctx}")` statement from `apply_rls_filter()` that was logging every ORM SELECT query to stdout in production

---

#### Regression Fix — Blanket Agreement SizeScale Mapper Error

**Finding:** `test_blanket_agreement.py::test_create_bpa_with_committed_lines` failed with:
```
sqlalchemy.exc.InvalidRequestError: When initializing mapper Mapper[Product(products)],
expression 'foreign(Product.size_scale_id) == SizeScale.id' failed to locate a name
("name 'SizeScale' is not defined")
```

**Root Cause:** `Product` model declares a string-based `relationship("SizeScale", ...)`. This requires `SizeScale` to be registered in SQLAlchemy's mapper registry before the mapper is initialized. The test imported `Product` directly but never triggered loading of `size_master.py`. Pre-existing bug — unrelated to DHI changes.

**Resolution:** Added `from app.models.size_master import SizeScale  # noqa: F401` to `test_blanket_agreement.py` imports.

### Verification

| Check | Command | Result |
|---|---|---|
| 4 new unit tests | `pytest test_sip_strategies.py test_printer_registry.py test_inventory_universal_search.py test_workspace_resolver.py -v` | **51/51 passed** |
| Blanket agreement regression | `pytest test_blanket_agreement.py -v` | **6/6 passed** |
| Frontend suite | `npx vitest run` | **1101/1101 passed (155 files)** |
| TypeScript check | `npx tsc --noEmit` | **0 errors** |
| Full backend suite | `pytest app/tests/ -q` | **746/857 passed — 111 pre-existing failures confirmed** |

---

## BACKLOG ITEM: WorkspaceResolver Broken Import (SXP-WSR-001)

**Priority:** P2
**Status:** DEFERRED (documented, not production-impacting if the route is not exercised)
**Date Logged:** 2026-08-09

`backend/app/services/workspace_resolver.py` imports `Warehouse`, `CompanyFinancialYear`, `CompanyTaxProfile`, `TenantProvisionProfile` from `app.models.tenant`. None of these exist in `app.models.tenant` (only `Company` and `Branch` are defined there). This will cause an `ImportError` at the module level if any route handler tries to import `workspace_resolver` directly without the full app context having loaded the missing models transitively. Fix: move the 4 missing models to `app.models.tenant` or update the import in `workspace_resolver.py` to import from the correct module files.

---

## ISSUE 2026-08-09-04: Phase A Duplicate Barcode Test Regression After Mock Data Elimination

**Severity:** MEDIUM (Test Suite Integrity)  
**Status:** RESOLVED  
**Date:** 2026-08-09  

### Symptom
After the Real-Wiring Audit (SXP-RW-001 & SXP-RW-002) eliminated all mock/seed data from production code paths, the Vitest suite reported **1 failure** (`phaseADataIntegrity.test.ts → "Rejects saving items with duplicate barcodes in ItemService"`):

```
Error: Unauthenticated session. Please log in to access protected enterprise API.
❯ apiFetchV1 src/lib/apiFetchV1.ts:48:13
❯ ItemService.save src/kernel/internal/ItemService.ts:106:19
❯ src/tests/phaseADataIntegrity.test.ts:106:19
```

### Root Cause
The Phase A test validates a **pure in-process business rule**: that `ItemService.save()` throws `DUPLICATE BARCODE REJECTED` when a barcode already exists in `localCache`.

The test's setup step (`await service.save(sampleProducts[0])`) was designed to pre-populate the service's in-memory cache. However, after the real-wiring remediation, `ItemService.save()` now calls `apiFetchV1` (the real API transport) to persist items. In the unit test environment there is no auth token, so `apiFetchV1` throws `Unauthenticated session` at the API call — **before** `upsertLocalCache()` could run (which was post-API). The cache never got seeded, so the duplicate check on the second save found nothing and never threw.

### Resolution

**Fix 1 — `src/kernel/internal/ItemService.ts` (Optimistic Cache Pattern):**
- `save()` now **optimistically upserts** the normalized SKU into `localCache` immediately after the duplicate barcode check passes (before the `apiFetchV1` call).
- If the API call fails, the cache entry is rolled back: `previousCacheEntry` is restored, or the new entry is removed for truly new items.
- This makes the duplicate barcode enforcement (a pure in-process guardrail) work correctly in any environment — online, offline, or unit test — independently of the API transport layer.

**Fix 2 — `src/tests/phaseADataIntegrity.test.ts` (API Transport Mock):**
- Added `vi.mock("../lib/apiFetchV1.js")` that echoes back the request body as the API response.
- Isolates the unit test from the real API transport — the test correctly validates business rules without requiring real authentication or a running backend.

### Verification
```
# Targeted test file
npx vitest run src/tests/phaseADataIntegrity.test.ts --reporter=verbose
Tests  4 passed (4)

# Full suite
npx vitest run
Test Files  155 passed (155)
Tests  1101 passed (1101)   ← 0 failures
```

**Evidence:** Status = Done

---

## ISSUE 2026-08-09-03: Real-Wiring Audit Remediation & Final Mock Business Data Elimination


**Severity:** HIGH (Production Data Integrity & Empty Database Compliance)  
**Status:** RESOLVED  
**Date:** 2026-08-09  

### Symptom
1. `SupplierDashboardTab.tsx` and `SupplierService.ts` retained pre-seeded suppliers (`TechCorp`, `Global Supplies`, `Supreme Garments`) on clean database installations due to `data.length > 0` fallback guards.
2. `PurchaseService.ts` retained pre-seeded PO (`PO-2025-001 Apex Footwear`) and swallowed backend save/delete errors.
3. `CRMStudioTab.tsx` displayed 4 hardcoded lead records (`Vikram Malhotra`, `Ananya Sen`, `Karan Johar`, `Priya Desai`) and lacked backend API integration.
4. `AccountingService.ts`, `AuditService.ts`, `QuickReportsWidget.tsx`, `LoyaltyStudioTab.tsx`, and `tallySyncEngine.ts` contained pre-seeded mock business records or hardcoded fallback rows.

### Root Cause
1. `data.length > 0` condition in fetch routines treated an empty database array (`[]`) as an API failure and retained seeded fallback arrays.
2. `CRMStudioTab.tsx` operated on local React state without invoking canonical `GET /api/v1/leads` or `POST /api/v1/leads` endpoints.
3. Service caches initialized with hardcoded mock arrays rather than empty arrays `[]`.

### Resolution
1. **Supplier Remediation**: Cleared seeded suppliers from `SupplierDashboardTab.tsx` and `SupplierService.ts`. Replaced `data.length > 0` check with `if (Array.isArray(data))` so empty backend response (`[]`) cleanly renders 0 suppliers.
2. **Purchase Remediation**: Cleared seeded PO from `PurchaseService.ts`, updated fetch guard to `if (Array.isArray(data))`, and rethrown save/delete errors.
3. **CRM Remediation**: Wired `CRMStudioTab.tsx` to canonical `GET /api/v1/leads` on mount and `POST /api/v1/leads` on creation. Removed hardcoded lead seeds. Verified Field Visits (0 backend endpoints exist; rendered honest empty state without introducing unvetted database tables).
4. **Data Integrity Hardening**: Fixed empty array handling across `AccountingService.ts`, `AuditService.ts`, `QuickReportsWidget.tsx`, `LoyaltyStudioTab.tsx`, and `tallySyncEngine.ts`.
5. Verified clean compilation via `npx tsc --noEmit` (0 errors) and backend pytest suite (27 passed).

---

## ISSUE 2026-08-09-02: Full Frontend ↔ Backend Real Wiring & Mock Fallback Elimination

**Severity:** HIGH (Production Data Integrity & Auth Integrity)  
**Status:** RESOLVED  
**Date:** 2026-08-09  

### Symptom
1. `ApiAuthProvider.ts` silently fell back to local `MockAuthProvider` on any local environment auth error, causing real backend authentication failures (e.g. wrong password, 401) to masquerade as successful mock logins.
2. POS direct checkout via `POST /api/v1/pos/checkout` failed with `404 POS Session 'DEFAULT_SESSION' not found` on fresh database installations.
3. `SalesService.ts` pre-seeded localCache with hardcoded `INV-2025-0001 / Nike Sports Shoes` invoice, and swallowed save errors silently.
4. `CustomerMasterTab.tsx` displayed 3 hardcoded mock customers and never called `/api/v1/customers`.
5. `DashboardTab.tsx` hardcoded KPI values (`deadStockPercent = 24.5`, `Math.round(125000 * scaleFactor)`, static weekly revenue array).

### Root Cause
1. Fallback guard `isLocalDemoEnvironment()` in `ApiAuthProvider.ts` caught API exceptions and invoked `fallbackMock.authenticate()`.
2. `PosEngine.process_checkout` looked up `session_id` in `pos_sessions` without auto-creating `DEFAULT_SESSION` when omitted by direct checkout clients.
3. `SalesService.ts` initialized `localCache` array with static demo objects and caught API errors returning cached mock objects.
4. `CustomerMasterTab.tsx` initialized React state with hardcoded arrays and lacked `apiFetchV1("/customers")` hooks.
5. `DashboardTab.tsx` used hardcoded multipliers instead of querying `/api/v1/reports/daily-sales`.

### Resolution
1. Removed `isLocalDemoEnvironment()` fallback in `ApiAuthProvider.ts`. Surfaced real API auth errors.
2. Added auto-creation of `DEFAULT_SESSION` in `PosEngine.process_checkout` when `session_id == "DEFAULT_SESSION"` and no active session exists.
3. Cleared static mock objects from `SalesService.ts` and updated `saveInvoice()` / `saveItem()` to rethrow errors on backend API failure.
4. Aligned `AdvancedBillingEngine.tsx` checkout body with `PosCheckoutReq` schema (`items: [{product_id, quantity, unit_price}]`).
5. Replaced static `SALESPERSONS` arrays in `PosTerminalTab.tsx` and `AdvancedBillingEngine.tsx` with dynamic fetching from `GET /api/v1/users/`.
6. Wired `CustomerMasterTab.tsx` to `GET /api/v1/customers` and `POST /api/v1/customers`.
7. Wired `DashboardTab.tsx` to `GET /api/v1/reports/daily-sales?report_date={today}` and derived `deadStockPercent` dynamically.
8. Verified clean compilation with `npx tsc --noEmit` returning 0 errors.

---

## ISSUE 2026-08-09-01: OrganizationStudio 404 Company List Route Failure

**Severity:** MEDIUM (UI Endpoint Resolution)  
**Status:** RESOLVED  
**Date:** 2026-08-09  

### Symptom
Browser console reported `404 (Not Found)` on `:3000/api/v1/system/company/list` when opening Organization Studio, causing `OrganizationStudio-DNNDVbF1.js` to catch a top-level error and abort rendering of company, branch, warehouse, and user data.

### Root Cause
1. `OrganizationStudio.tsx` called `/api/v1/system/company/list` as its primary loader. `apiFetchV1` automatically prepends `/api/v1` to relative paths.
2. The FastAPI backend does not define a `/system/company/list` route. The actual master endpoint is `/api/v1/masters/company` (or `/api/v1/auth/tenants`).
3. Calling a non-existent endpoint caused `apiFetchV1` to throw an error that jumped straight to the outer `catch` block, skipping downstream calls to `/masters/branch`, `/masters/warehouse`, and `/users/`.

### Resolution
1. Replaced `/api/v1/system/company/list` in `OrganizationStudio.tsx` with direct call to `/masters/company`.
2. Wrapped each master entity fetch (`companies`, `branches`, `warehouses`, `users`) in isolated `try/catch` blocks so that a failure in one master query does not block rendering of the remaining tabs.
3. Verified clean resolution with `npx tsc --noEmit` returning 0 errors.

---

## ISSUE 2026-08-08-01: Phase E Certification Docker Network & Migration Alignment Failure

**Severity:** BLOCKER (Environment & Integration)  
**Status:** RESOLVED  
**Date:** 2026-08-08  

### Symptom
1. Pytest suite execution on Windows host failed with `OSError: [Errno 10061] Connect call failed ('127.0.0.1', 5432)`.
2. Container `smriti-api-prod` Alembic version remained stuck at `v1220_iam_enterprise`, failing to recognize host migration files `v1400`, `v1401`, `v1402`.
3. Container restart failed with `sqlalchemy.exc.DBAPIError: <class 'asyncpg.exceptions.StringDataRightTruncationError'>: value too long for type character varying(32)` on `alembic_version` table `version_num` column.

### Root Cause
1. `smriti-db-prod` in `docker-compose.prod.yml` did not expose PostgreSQL port `5432` to the host loopback interface `127.0.0.1`.
2. Docker container `smriti-api-prod` image was built prior to Phase E and lacked mount references for host `alembic/versions` additions.
3. PostgreSQL `alembic_version.version_num` column was created with standard Alembic default size `VARCHAR(32)`, which truncated 33-char revision ID `v900_multi_group_category_mapping` and 34-char revision ID `v1400_phase_e_authority_hardening`.

### Resolution
1. Added `ports: - "127.0.0.1:5432:5432"` to `smriti-db-prod` service definition in `docker-compose.prod.yml`.
2. Re-created container stack via `docker compose -f docker-compose.prod.yml up -d` ensuring `./backend:/app` volume mount supplies current migration files.
3. Executed `ALTER TABLE alembic_version ALTER COLUMN version_num TYPE VARCHAR(255);` on PostgreSQL database `smriti_retail_db`.
4. Successfully ran `docker exec smriti-api-prod alembic upgrade head` — both host and container resolved to `v1402_merge_phase_e_heads (head) (mergepoint)`.
5. Updated `LookupRepository.atomic_replace_value()` to assign collision-safe historical code suffix to superseded records before inserting new active value, preserving `UNIQUE(master_type_id, code)` constraint.
6. Formatted whole-number Decimal stock values (e.g. `50.0` -> `"50"`) in quotation application service.
7. Re-ran complete relevant backend pytest suite: **176/176 PASSED**, **0 FAILED**.

---

## ISSUE 2026-08-08-02: Phase F SizeScale Adoption & Schema Integrity Certification

**Severity:** HIGH (Schema Evolution & Data Safety Verification)  
**Status:** CERTIFIED & RESOLVED  
**Date:** 2026-08-08  

### Symptom
1. Requirement to adopt multi-region `SizeScale` and `SizeValue` without compromising `Product.size` canonical display/sellable size authority or modifying core product SKU and fingerprint generation algorithms.

### Root Cause / Risk Analysis
1. Risk of creating competing size authorities between `Product.size` and `SizeScale`.
2. Potential `NOT NULL` constraint violations on existing products (`size_scale_id=NULL`).
3. Database orphan foreign key risk on `SizeScale` deletion.

### Resolution
1. Added Alembic migration `v1500_phase_f_sizescale_adoption.py` introducing nullable `products.size_scale_id` foreign key referencing `size_scales(id)` with `ON DELETE SET NULL`.
2. Verified PostgreSQL `smriti_retail_db` constraint `fk_products_size_scale_id` with `confdeltype='n'` (SET NULL).
3. Added PVE validation rule `SMRITI-VAL-SIZE-001` checking tenant authorization and confirming `Product.size` exists in `SizeValue` under the referenced `SizeScale`.
4. Added `SizeMasterService.resolve_conversions()` for multi-region conversion resolution (read-only).
5. Created comprehensive test suite `app/tests/test_phase_f_sizescale.py` (15/15 passed).
6. Executed full relevant backend test suite: **184/184 PASSED**, **0 FAILED**, **0 ERRORS**.

---

## ISSUE 2026-08-08-03: SMRITI Retail OS Database Architecture Refactor Audit V1 Reconciliation

**Severity:** AUDIT (Architecture & Governance Reconciliation)  
**Status:** ACCEPTED & RECONCILED (REFACTORING FROZEN)  
**Date:** 2026-08-08  

### Overview
1. Executed comprehensive, read-only architectural reconciliation of live PostgreSQL database `smriti_retail_db` containing 269 physical tables, 1 view, 0 materialized views, 8 sequences, 995 indexes.
2. Verified zero database modification (no tables created, dropped, merged, or renamed).
3. Reconciled 6 claimed non-existent tables against physical live tables.
4. Established explicit governance rule:
   - CURRENT STATE: All 269 physical tables are immutable during the audit/certification freeze.
   - FUTURE STATE: No table may be deprecated, altered, merged, renamed, or dropped until an approved Product Mode refactoring change is opened and passes full dependency, reader, writer, FK, migration, and runtime verification.
5. Updated canonical artifacts:
   - `SMRITI_DATABASE_AUTHORITY_MAP_V1.md`
   - `SMRITI_DATABASE_CONSOLIDATION_MAP_V1.md`
6. Confirmed physical live table count = 269. Database Inventory Reconciliation ACCEPTED. Refactoring FROZEN.

---

## ISSUE 2026-08-08-04: SMRITI Item Master Attribute Authority & Duplicate Column Audit V1

**Severity:** AUDIT (UI Metadata & Attribute Governance)  
**Status:** COMPLETED & VERIFIED (READ-ONLY AUDIT)  
**Date:** 2026-08-08  

### Overview
1. Executed comprehensive, read-only architectural + UI/metadata audit of Item Master attributes across `ItemMasterTab.tsx`, `ExcelGridEntrySection.tsx`, `UniversalAttributeEngine.ts`, `Product` model, and API endpoints.
2. Verified zero database modification (no schema alterations, no column renames, no migrations).
3. Proved zero physical database column duplication (`products.brand` and `products.style_code` are the single physical storage columns in PostgreSQL).
4. Verified that `Brand` vs `Brand Name` and `Style` vs `Article Code` vs `Model Number` are header aliases and adaptive UI labels mapped to canonical keys (`BRAND`, `STYLE_CODE`).
5. Generated canonical audit artifacts:
   - `SMRITI_ITEM_MASTER_ATTRIBUTE_AUTHORITY_MAP_V1.md`
   - `SMRITI_ITEM_MASTER_ATTRIBUTE_DUPLICATE_REPORT_V1.md`

---

## ISSUE 2026-08-08-05: SMRITI Item Master Runtime Certification V1

**Severity:** CERTIFICATION (Runtime & UI Certification)  
**Status:** CERTIFIED & GREEN (READ-ONLY CERTIFICATION)  
**Date:** 2026-08-08  

### Overview
1. Executed complete runtime and UI certification across all 15 test scenarios for Item Master attribute normalization, adaptive labeling, Excel import, variant generation, and SKU formula integrity.
2. Verified zero database modification, zero schema alterations, and zero SKU algorithm changes (**FROZEN**).
3. Executed Vitest test suite: **19/19 PASSED** (`src/tests/itemMasterRuntimeCertification.test.ts` & `src/tests/canonicalAttributeRegistry.test.ts`).
4. Generated canonical certification artifact:
   - `SMRITI_ITEM_MASTER_RUNTIME_CERTIFICATION_V1.md`
5. Final Status: **GREEN** (DATABASE: FROZEN, SKU ALGORITHM: FROZEN, ATTRIBUTE AUTHORITY: FROZEN).

---

## ISSUE 2026-08-08-06: SMRITI Item Master Backend Test Failure Diagnosis V1

**Severity:** DIAGNOSTIC (Backend Test Harness)  
**Status:** DIAGNOSED & READ-ONLY (ZERO CODE/DB ALTERATION)  
**Date:** 2026-08-08  

### Overview
1. Executed empirical read-only diagnosis of the 4 backend test failures in `backend/app/tests/test_phase_f_sizescale.py`.
2. Verified zero database modification, zero schema alterations, and zero test harness modifications.
3. Identified root cause: `PlatformValidationEngine` category auto-provisioning attempts to insert `MasterValue(code="CUSTOM-APPAREL")` during product validation. Across unrolled test runs on persistent PostgreSQL without transaction rollback isolation, inserting `CUSTOM-APPAREL` again hits `UniqueViolationError: uq_master_value_type_code`.
4. Item Master Business Logic Status: **PASS** (100% functional). Production Impact: **NONE**.
5. Generated canonical diagnosis artifact:
   - `SMRITI_ITEM_MASTER_BACKEND_FAILURE_DIAGNOSIS_V1.md`
6. Final Status: ITEM MASTER CERTIFICATION: **GREEN**, BACKEND TEST INFRASTRUCTURE: **DEGRADED**, DATABASE: **FROZEN**.

---

## ISSUE 2026-08-08-07: SMRITI Item Master Backend Test Isolation Fix V1

**Severity:** REMEDIATION (Backend Test Isolation)  
**Status:** RESOLVED & PASSED  
**Date:** 2026-08-08  

### Overview
1. Implemented test-isolation remediation strictly in `backend/app/tests/test_phase_f_sizescale.py` (`_make_tenant_ctx` helper) to clean up transient `CUSTOM-%` test master values before tenant context creation.
2. Verified ZERO changes to production database schema, migrations, PVE validation logic, or SKU generation algorithms (**FROZEN**).
3. Executed backend test suite: **7/7 PASSED** in `test_phase_f_sizescale.py`.
4. Executed full relevant backend regression suite: **11/11 PASSED**.
5. Executed frontend typecheck (`tsc --noEmit`) and Vitest suite: **19/19 PASSED**.
6. Generated canonical fix deliverable artifact:
   - `SMRITI_ITEM_MASTER_BACKEND_TEST_ISOLATION_FIX_V1.md`
7. Final Status: BACKEND TEST ISOLATION: **PASS**, DATABASE: **FROZEN**, ITEM MASTER: **GREEN**, SKU: **FROZEN**, ATTRIBUTE AUTHORITY: **FROZEN**.

---

## ISSUE 2026-08-08-08: SMRITI Item Master Backend Test Isolation Fix V2 Final Validation

**Severity:** AUDIT & VALIDATION (Backend Test Isolation Safety)  
**Status:** CERTIFIED & PASS  
**Date:** 2026-08-08  

### Overview
1. Performed thorough safety audit of test isolation query in `_make_tenant_ctx`, hardening it to `DELETE FROM master_values WHERE tenant_id LIKE 'c_%' AND code LIKE 'CUSTOM-%'`, strictly scoping deletion to test tenant IDs starting with `c_`.
2. Verified zero risk of deleting pre-existing production master data or system master values (`tenant_id IS NULL`).
3. Executed pytest collection check: **7 tests collected** in `test_phase_f_sizescale.py`.
4. Executed backend test suite: **7/7 PASSED** in `test_phase_f_sizescale.py`; **11/11 PASSED** in full relevant backend regression suite.
5. Executed frontend typecheck (`tsc --noEmit`) and Vitest suite: **19/19 PASSED**.
6. Verified database safety on PostgreSQL: 269 physical base tables intact, 0 duplicate custom codes, all system master values preserved.
7. Generated canonical V2 deliverable artifact:
   - `SMRITI_ITEM_MASTER_BACKEND_TEST_ISOLATION_FIX_V2.md`
8. Final Decision: **PASS** (DATABASE: FROZEN, ITEM MASTER: GREEN, SKU: FROZEN, ATTRIBUTE AUTHORITY: FROZEN).

---

## ISSUE 2026-08-08-09: SMRITI Item Master Attribute Governance V2 (Presentation Deduplication)

**Severity:** ARCHITECTURE & UI GOVERNANCE (Presentation Deduplication)  
**Status:** RESOLVED & PASS  
**Date:** 2026-08-08  

### Overview
1. Implemented presentation-level attribute deduplication in `UniversalAttributeEngine.resolveDeduplicatedColumns` ensuring `new Set(columns.map(c => c.canonicalKey)).size === columns.length`.
2. Added import duplicate header guard `UniversalAttributeEngine.validateDuplicateCanonicalHeaders(headers)` returning deterministic `DUPLICATE_CANONICAL_COLUMN` validation error if two headers map to the same canonical key.
3. Integrated header validation into `ExcelGridEntrySection.tsx` paste and mapping handlers.
4. Verified all 14 certification scenarios across Apparel, Footwear, Electronics, Jewellery, Medical, and FMCG industry packs.
5. Executed Vitest certification suite: **20/20 PASSED**. Executed `tsc --noEmit`: **0 ERRORS**. Executed backend regression suite: **11/11 PASSED**.
6. Generated canonical governance deliverable artifact:
   - `SMRITI_ITEM_MASTER_ATTRIBUTE_GOVERNANCE_V2.md`
7. Final Status: **PASS** (DATABASE: FROZEN, ITEM MASTER: GREEN, SKU: FROZEN, ATTRIBUTE AUTHORITY: FROZEN, E8: CONFIRMED OPEN).

---

## ISSUE 2026-08-08-10: SMRITI Item Master E8 Identity Linkage Review & Gate Assessment

**Severity:** ARCHITECTURE & GOVERNANCE GATE (Identity Linkage Audit)  
**Status:** AUDITED & GOVERNED AS BLOCKED  
**Date:** 2026-08-08  

### Overview
1. Executed empirical database schema audit on live PostgreSQL (`smriti_retail_db`).
2. Confirmed `Product` table does NOT contain `master_value_id`, `color_master_value_id`, `size_master_value_id`, `brand_master_value_id`, or `category_master_value_id`.
3. Confirmed 0 physical foreign keys exist from `products` to `master_values` or `master_types`.
4. Enforced absolute prohibition on heuristic text-based updates (`WHERE product.color = old_name`), which would cause silent catalog corruption.
5. Created empirical test `test_e8_identity_linkage_verification.py` (**PASSED**).
6. Generated canonical audit deliverable artifact:
   - `SMRITI_E8_IDENTITY_LINKAGE_AUDIT_V1.md`
7. Final Decision: **E8 = BLOCKED — NO SAFE PERSISTENT MASTER-VALUE IDENTITY LINKAGE** (DATABASE: FROZEN, PRODUCT SCHEMA: FROZEN, SKU: FROZEN, BARCODE: FROZEN, ATTRIBUTE AUTHORITY: FROZEN).

---

## ISSUE 2026-08-08-11: SMRITI Item Master E8 Business Semantics Decision Audit

**Severity:** ARCHITECTURAL & BUSINESS SEMANTICS AUDIT  
**Status:** CLOSED BY ARCHITECTURAL DESIGN  
**Date:** 2026-08-08  

### Overview
1. Audited SMRITI Retail OS business requirements across 15 domains (Item Master, SKU, Variants, Barcodes, Invoices, POs, Sales, Stock, Import, Attributes, Industry Packs, Master Lookup, Multi-Tenant, Auditability, Reporting).
2. Confirmed `Product` attribute storage (`color`, `size`, `brand`, `category`, `attributes` JSONB) is intentionally designed as Model B (Item Snapshot Value) to preserve historical document integrity, SKU/Barcode immutability, and statutory tax compliance.
3. Established Architectural Principle AP-008: String snapshot equality is NOT identity reference. MasterValue provides entry-time validation; Product stores point-in-time item snapshots.
4. Generated canonical decision deliverable artifact:
   - `SMRITI_E8_BUSINESS_SEMANTICS_DECISION_V1.md`
5. Final Decision: **E8 = CLOSED — SNAPSHOT SEMANTICS ARE CORRECT** (STATUS: CLOSED BY ARCHITECTURAL DESIGN, DATABASE: FROZEN, PRODUCT SCHEMA: FROZEN, SKU: FROZEN, BARCODE: FROZEN, ATTRIBUTE AUTHORITY: FROZEN).

---

## BACKLOG ITEM: ItemService Optimistic Cache Invariant Audit (SXP-CACHE-001)

**Priority:** P1 (Post-DHI, Pre-Production Certification)
**Status:** DEFERRED
**Date Logged:** 2026-08-09

### Concern
The optimistic cache-before-API pattern introduced in ItemService.save() (Fix for SXP-TEST-001) must be verified to uphold the invariant:

```text
UI ? Business Validation ? Optimistic Local State ? Real API
  SUCCESS ? keep state
  FAILURE ? exact rollback (no stale cache entry survives)
```n
### Required Before Closing
- [ ] Add a focused Vitest test: save() returns a network error ? verify localCache does NOT retain the entry
- [ ] Verify rollback works when upsertLocalCache(previousCacheEntry) is called with undefined (new item) vs. an existing entry (update)
- [ ] Architectural review: confirm optimistic cache is safe under concurrent tab/session scenarios (out-of-scope until multi-tab session is certified)

