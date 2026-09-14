<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.19.0
  Created      : 2026-09-14
  Modified     : 2026-09-14
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough: SMRITI System Parameters Subsystem & 5-Tier Governance Engine (v6.19.0)

## 1. Purpose
This release implements the enterprise **SMRITI System Parameters Subsystem & 5-Tier Governance Engine**, achieving 100% architectural and operational parity with legacy Tally Shoper 9 POS (`shoper9pos`) and Shoper 9 Distributor (`Shoper9Dist`). It provides dynamic runtime control over 828 architectural switches, enforces 5-tier mutability safety (`Fixed`, `Installation`, `One Time`, `Variable`, `Hidden`), resolves profile variances between Retail POS and Wholesale Distribution, and guarantees 0ms synchronous latency for billing terminals.

## 2. Scope
- Multi-tenant PostgreSQL database migration: `system_parameters` table and composite indexes across `smritisys` and tenant databases (`smriti001`).
- SQLAlchemy ORM Model `SystemParameter` with typed columns (`val_boolean`, `val_integer`, `val_text`, `val_decimal`, `val_date`), `effective_value` property, and setter methods.
- Pydantic v2 schemas for single/batch updates, resolution, and profile seeding.
- Backend `SystemParameterService` handling 828 parameters across 20 categories, 26 profile variances, 4-tier scoping hierarchy (`Terminal > Branch > Company > Global`), and mutability enforcement.
- REST API router mounted at `/api/v1/system-parameters` (`list`, `map`, `resolve`, `update`, `save-batch`, `seed-profile`).
- Frontend client service `smritiSystemParameterService.ts` with in-memory caching and synchronous accessors (`getBoolean`, `getNumber`, `getString`, `getValue`).
- Interactive GUI Studio `SmritiSystemParametersStudio.tsx` with 20 category tabs, instant search, mutability filters, profile indicators, and batch commit.
- Dynamic system parameter enforcement in POS billing terminals (`BillingTerm.tsx` and `ProPosBillingTerm.tsx`).
- Comprehensive automated verification via Pytest and Vitest test suites.

## 3. Files Created
- `backend/app/models/system_parameter.py`
- `backend/app/schemas/system_parameter.py`
- `backend/app/services/system_parameter.py`
- `backend/app/api/v1/system_parameters.py`
- `src/services/smritiSystemParameterService.ts`
- `src/components/setup/SmritiSystemParametersStudio.tsx`
- `backend/tests/test_system_parameters.py`
- `src/tests/smritiSystemParameters.test.ts`
- `docs/walkthrough/setup/Setup_Smriti_System_Parameters_And_Governance_Engine_v6.19.0.md`

## 4. Files Modified
- `backend/app/models/__init__.py` (Export `SystemParameter`)
- `backend/app/main.py` (Register `/system-parameters` router)
- `src/App.tsx` (Add `system-parameters` tab route and lazy component import)
- `src/components/billing/BillingTerm.tsx` (Wire `AllowCreditBilling` and `InBillingCustSelectionCompulsary` checks)
- `src/components/billing/propos/ProPosBillingTerm.tsx` (Wire `AllowCreditBilling` and `InBillingCustSelectionCompulsary` checks)
- `docs/walkthrough/README.md` (Update master walkthrough index)
- `CHANGELOG.md` (Record v6.19.0 architectural changes)

## 5. Architecture Decisions
1. **Typed Value Columns with Polymorphic Effective Access:** Rather than storing all parameter values as untyped strings or JSONB blobs, `system_parameters` explicitly defines `val_boolean`, `val_integer`, `val_text`, `val_decimal`, and `val_date`. The ORM model and frontend services provide typed accessors with 0ms evaluation.
2. **5-Tier Mutability Matrix:**
   - `Fixed` (7 params): Architectural constants that can never be modified by users (HTTP 400 `SMRITI-PARAM-001`).
   - `Installation` (3 params): Can only be configured during initial provisioning; locked permanently upon initial save (`SMRITI-PARAM-002`).
   - `One Time` (95 params): Modifiable exactly once; transitions to locked upon first update (`SMRITI-PARAM-003`).
   - `Variable` (282 params): Freely modifiable through the Studio interface or API.
   - `Hidden` (441 params): Internal daemon and system engine flags restricted from standard UI presentation.
3. **4-Tier Scoping Precedence:** Parameter evaluation resolves from most specific to least specific:
   `Terminal Specific Override` → `Branch Specific Override` → `Company Policy` → `Global System Default`.
4. **Dual Profile Seeding:** Profile initialization accepts `RETAIL` or `DISTRIBUTOR`, mapping the 26 legacy variances (e.g. `SHOPEREnv` R vs D, `AllowCreditBilling` False vs True, `CustClass1Cap` Religion vs Zone).

## 6. Design Rationale
Retail billing terminals require sub-millisecond parameter evaluation during barcode scanning, tender settlement, and customer lookup. A database query per keystroke would degrade cashier throughput. The architecture combines database-backed system-of-record persistence with a frontend 0ms in-memory cache preloaded during terminal initialization, refreshed automatically upon batch saves.

## 7. Implementation Summary
- Migrated `system_parameters` table into `smritisys` and `smriti001`.
- Seeded baseline 828 parameters across 20 functional domains.
- Exposed RESTful endpoints at `/api/v1/system-parameters`.
- Built `SmritiSystemParametersStudio` modal offering full category filtering, live mutability badges, search, and batch mutation.
- Hardened `BillingTerm` and `ProPosBillingTerm` to block credit transactions and compulsory customer omission when governed parameters are set.

## 8. Tests Executed
1. **Pytest Backend Suite (`backend/tests/test_system_parameters.py`):**
   - `test_01_blueprint_integrity`: Validates 828 parameters and 26 variances in blueprint.
   - `test_02_seed_retail_profile`: Seeds retail profile; asserts `SHOPEREnv="R"` and `CustClass1Cap="Religion"`.
   - `test_03_profile_variance_distributor`: Seeds distributor profile; asserts `SHOPEREnv="D"`, `AllowCreditBilling=True`, and `CustClass1Cap="Zone"`.
   - `test_04_fixed_mutability_enforcement`: Asserts `CompanyCode` raises HTTP 400 `SMRITI-PARAM-001`.
   - `test_05_variable_parameter_update`: Asserts `AllowCreditBilling` can be updated and persisted.
   - `test_06_hierarchical_resolution`: Asserts terminal override takes precedence over company setting.
   **Result:** 6 passed in 5.59s.
2. **Vitest Frontend Suite (`src/tests/smritiSystemParameters.test.ts`):**
   - 0ms synchronous boolean resolution across boolean, string ("true", "1", "yes"), and numeric formats.
   - Number and string accessors with fallback safety.
   - Mutability and lock semantics validation.
   **Result:** 5 passed in 371ms.
3. **TypeScript Compilation:**
   - `npx tsc --noEmit` executed with 0 errors.
4. **Vite Production Build:**
   - `npm run build` completed in 30.16s with clean artifact bundles.

## 9. Verification Results
- Database Column Parity: Column-by-column parity verified against canonical specification across `smritisys` and `smriti001`.
- Zero Regression: All preexisting tests and build pipelines remained green.

## 10. Known Limitations
- Terminal-specific overrides currently require the terminal identifier to be configured in the POS Profile or passed via `x-terminal-id` header.
- Dynamic visual indicator in Studio requires page reload if parameters are altered concurrently from an external terminal.

## 11. Future Work
- Add WebSocket notification push to instantly invalidate client terminal cache when an administrator updates parameters in the Studio.
- Expand parameter import/export via Data Exchange Tab to support JSON and Excel template backups.

## 12. Related ADRs
- `ADR-041`: Multi-Tier System Parameter & Configuration Governance Engine
- `ADR-028`: FastAPI and PostgreSQL System of Record Architecture

## 13. Related RFCs
- `RFC-052`: Legacy Shoper 9 Blueprint Extraction & Profile Variance Normalization
- `RFC-053`: 0ms Synchronous Accessors for High-Frequency Retail Checkouts
