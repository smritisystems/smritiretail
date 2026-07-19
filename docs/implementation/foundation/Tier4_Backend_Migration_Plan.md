<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.16.0
  Created      : 2026-07-12
  Modified     : 2026-07-12
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Tier 4 Backend Migration, Form Standardization & Tier 8 Roadmap Plan

## 1. Objective
Establish complete PostgreSQL transactional compliance for Tier 4 entities (users, companies, branches, customers, customer groups, suppliers, purchase orders, shifts), standardize Indian-market forms, and define the strangler-fig migration roadmap for the 12 remaining legacy long-tail keys.

---

## 2. Phase 1: Tier 4 Backend Migration (Dual-Write Cutover)

### A. Stock Movements Hardening
1. Add `INTERNAL_SERVICE_KEY` in `backend/app/core/config.py` loaded from `.env`.
2. Define `verify_internal_service_key` in `backend/app/api/deps.py` as a FastAPI security dependency.
3. Secure the `/api/v1/products/stock-movements` endpoint in `backend/app/api/v1/inventory.py` to require `X-Internal-Service-Key`.
4. Refactor the stock-movements write path to look up the product's `company_id` and `branch_id` server-side from PostgreSQL, ignoring and rejecting any client-supplied body values.
5. In Express `src/lib/helpers.ts`, configure outgoing proxy calls to pass the `X-Internal-Service-Key` header.

### B. Safe Data Migration
1. Implement a python migration script `scripts/migrate_tier4.py` that:
   - Loads `db_store.json`.
   - Programmatically inserts records for `companies`, `branches`, `customer_groups`, `customers`, `suppliers`, `purchase_orders`, `users`, and `shifts` into PostgreSQL.
   - Handles conflict resolution (Postgres wins, logging warning logs for discrepancies).
   - Establishes relational integrity mappings (e.g. shifts mapping cash registers and cashiers).

### C. Monolith Repointing & JSON Key Purge
1. Reroute `/api/auth/login` to make an HTTP POST to FastAPI `/api/v1/auth/login`. On success, create a local session in Express and fetch user attributes via the Postgres Repository.
2. Repoint Express router handlers (`src/routes/users.ts`, `src/routes/masters.ts`, `src/routes/customers.ts`, `src/routes/purchase.ts`, `src/routes/pos.ts`) to read and write directly using PostgreSQL repositories, bypassing memory storage.
3. Remove dual-write logic from `src/state/store.ts`.
4. Delete legacy JSON keys (`users`, `roles`, `companies`, `branches`, `customers`, `customerGroups`, `suppliers`, `purchaseOrders`, `shifts`) from `db_store.json`.

---

## 3. Phase 2: India-Market Form Standardization & Demo Defaults

### A. Shared Utilities
1. **`src/utils/formatters.ts`**:
   - `formatDate(date, options?)`: Wraps `toLocaleDateString("en-IN", options)` with a default format matching `SalesStudioTab.tsx` (`{ day: "numeric", month: "short" }`).
   - `formatCurrency(value)`: Returns Indian Rupee symbol currency formatting (no fractional digits, e.g. `₹12,450`).
   - `formatDateTime(date)`: Formats timestamps for audit logs (`toLocaleString("en-IN")`).
2. **`src/constants/indianStates.ts`**:
   - Exports the 38 Indian State GST code mappings (e.g. `{"27": "Maharashtra"}`) and a sorted list of state names.
3. **`src/utils/validators.ts`**:
   - `isValidGSTIN(value)`: Validates format against regex `/^\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z\d]{1}Z[A-Z\d]{1}$/`.
   - `isValidPIN(value)`: Validates format against regex `/^\d{6}$/`.
   - `isValidMobile(value)`: Clean value and validate against regex `/^\d{10}$/`.

### B. UI Sweep & Standardizations
1. Replace bare `toLocaleDateString()`, `toLocaleString()`, and `toLocaleTimeString()` calls with the formatting helpers.
2. Add validation logic inside forms (customer creation in `SalesStudioTab.tsx`, supplier creation in `PurchaseStudioTab.tsx`, and company/branch setup in `SetupWizardTab.tsx`).
3. Replace the hardcoded Maharashtra state assignment in branch setup (`SetupWizardTab.tsx`) with a `<select>` dropdown populated from `indianStates.ts`.
4. Add an optional `landmark?: string` field to `types.ts` address interfaces (`User`, `Supplier`, `Customer`, `StoreConfig`) and corresponding form fields in `SetupWizardTab.tsx`.

### C. Demo / Default Company Address Updates
1. Replace the default demo store entry in `SetupWizardTab.tsx` (initial `stores` state) with:
   - `name`: "Main Flagship Store"
   - `code`: "GKP01"
   - `address`: "Plot No. X-10, Sector 1A, Belvadari, Jaitpur, Kalesar Industrial Area, GIDA"
   - `city`: "Gorakhpur"
   - `pinCode`: "273209"
   - `state`: "Uttar Pradesh"
2. Update the demo/default company values loaded in `setWelcomeMode("demo")`:
   - `businessName`: "AITDL NETWORKS"
   - `gstin`: "09AAACS1234A1Z1" (using state code "09" for Uttar Pradesh) so that the auto-detect GSTIN logic automatically resolves state to "Uttar Pradesh".

---

## 4. Phase 3: Tier 8 Long-Tail Data Migration Roadmap

The remaining 12 keys in `db_store.json` represent secondary workflows. We map them below to components and outline their migration path.

### A. Key-to-Component Mapping
1. `documentSeriesList` & `numberingAuditLogs`:
   - **Usage:** Used by the numbering engine inside `DocumentSeriesTab.tsx`.
   - **Entity Group:** Document Numbering System.
2. `termsLibraryList`, `termsDefaultsList` & `termsSnapshots`:
   - **Usage:** Used by the terms and conditions mapping engine inside `TermsEngineTab.tsx`.
   - **Entity Group:** Legal & Terms Management.
3. `approvalWorkflowLogs`:
   - **Usage:** Used by audit/workflow managers inside `ApprovalMatrixTab.tsx` and `TermsEngineTab.tsx`.
   - **Entity Group:** Approval Governance.
4. `partnersList`, `transformationMappings` & `exchangeLogs`:
   - **Usage:** Used by EDI / Partner sync workflows in `DataExchangeTab.tsx`.
   - **Entity Group:** EDI Data Exchange.
5. `fields`:
   - **Usage:** Custom metadata fields used by `FieldExplorerTab.tsx` (UDF engine).
   - **Entity Group:** Metadata & Custom Fields.
6. `formulas`:
   - **Usage:** Calculation formulas used in `FormulaRegistryTab.tsx`, `ExplainModal.tsx`, and `DashboardTab.tsx`.
   - **Entity Group:** Pricing & Formulas Engine.
7. `psvParties`:
   - **Usage:** Partner stock validation details used in `PsvTab.tsx`, `QuickReportsWidget.tsx`, and `DashboardTab.tsx`.
   - **Entity Group:** Partner Stock Validation.

### B. Postgres Target Tables & API Routes
We will model these into the PostgreSQL database under the following proposed schemas:
- **Numbering System:** `document_series`, `numbering_audit_logs`
- **Terms Engine:** `terms_library`, `terms_defaults`, `terms_snapshots`
- **Governance:** `approval_workflow_logs`
- **EDI Data Exchange:** `exchange_partners`, `transformation_mappings`, `exchange_logs`
- **Custom Fields:** `custom_fields`
- **Pricing Formulas:** `pricing_formulas`
- **Partner Stock:** `psv_parties`

FastAPI endpoints under `/api/v1/...` will replace the mock routing gateway in Express.

---

## 5. Verification Plan

### Automated Tests
- Run Pytest suite: `python -m pytest backend/app/tests`
- Run Vitest suite: `npm run test`
- Run linter/validator scripts.

### Manual Verification
- Direct curl call to `/api/v1/products/stock-movements` to verify unauthorized access yields a `403 Forbidden`.
- Check GSTIN/PIN validation fields in customer and supplier forms.
- Verify state select dropdown works when adding branches in the setup wizard.
