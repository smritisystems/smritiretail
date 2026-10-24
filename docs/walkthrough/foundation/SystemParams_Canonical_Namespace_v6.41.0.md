<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 1.0.0
  Created      : 2026-09-18
  Modified     : 2026-09-18
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal Walkthrough
-->

# SMRITI Canonical Parameter Namespace — v6.41.0 Walkthrough

**Area:** Foundation — System Parameters  
**Date:** 2026-09-18  
**Commit:** `b5f767ea`  
**ADR:** ADR-042 (SMRITI Canonical Parameter Namespace Layer)

---

## 1. Purpose

Introduce a SMRITI-branded `canonical_code` alias layer over the 828 legacy Shoper 9 system parameter keys (`param_code`). This enables:

- Developers to reference parameters by domain-driven SMRITI names (`SMRITI.BILLING.ALLOW_CREDIT_BILLING`)
- Legacy Shoper 9 keys (`AllowCreditBilling`) to continue working unchanged
- Zero risk of regression to existing POS billing, seeding, and test suites

---

## 2. Scope

| Layer | Change |
|---|---|
| PostgreSQL Schema | `canonical_code VARCHAR(150)` column + index on `system_parameters` |
| Alembic Migrations | `v1471` (add column), `v1472` (backfill 2,485 rows) |
| ORM Model | `SystemParameter.canonical_code` field + `idx_sys_param_canonical_code` |
| Pydantic Schema | `SystemParameterResponse.canonical_code` |
| Backend Service | `_get_canonical_map()`, `_is_canonical_key()`, dual-key resolve/update |
| Frontend Service | `canonicalAlias` Map, `_resolveKey()`, all `get*()` accessors |
| Blueprint | `canonical_mapping.json` (828 entries, 0 duplicates, max length 72) |
| Tests | 8 backend Pytest (2 new), 8 frontend Vitest (3 new) |

---

## 3. Files Created

| File | Purpose |
|---|---|
| [`backend/alembic/versions/v1471_add_canonical_code_to_system_parameters.py`](file:///f:/SMRITRretailNX/backend/alembic/versions/v1471_add_canonical_code_to_system_parameters.py) | Adds `canonical_code` column and index |
| [`backend/alembic/versions/v1472_backfill_canonical_codes.py`](file:///f:/SMRITRretailNX/backend/alembic/versions/v1472_backfill_canonical_codes.py) | Backfills all 2,485 rows |
| [`docs/legacy_blueprints/shoper9/canonical_mapping.json`](file:///f:/SMRITRretailNX/docs/legacy_blueprints/shoper9/canonical_mapping.json) | 828 param_code → canonical_code entries |

---

## 4. Files Modified

| File | Change |
|---|---|
| [`backend/app/models/system_parameter.py`](file:///f:/SMRITRretailNX/backend/app/models/system_parameter.py) | Added `canonical_code` column + index |
| [`backend/app/schemas/system_parameter.py`](file:///f:/SMRITRretailNX/backend/app/schemas/system_parameter.py) | Added `canonical_code` to response schema |
| [`backend/app/services/system_parameter.py`](file:///f:/SMRITRretailNX/backend/app/services/system_parameter.py) | Dual-key resolution, canonical map cache, seeding, resolve_parameters_map |
| [`backend/tests/test_system_parameters.py`](file:///f:/SMRITRretailNX/backend/tests/test_system_parameters.py) | Added test_07 (canonical populated), test_08 (dual-key resolution) |
| [`src/services/smritiSystemParameterService.ts`](file:///f:/SMRITRretailNX/src/services/smritiSystemParameterService.ts) | canonicalAlias map, _resolveKey(), all get* accessors updated |
| [`src/tests/smritiSystemParameters.test.ts`](file:///f:/SMRITRretailNX/src/tests/smritiSystemParameters.test.ts) | Added 3 Dual-Key Resolution (ADR-042) tests |

---

## 5. Architecture Decisions

### 5.1 No Destructive Rename of `param_code`

The 828 Shoper 9 `param_code` values (e.g. `AllowCreditBilling`, `GIRWithoutPORef`) are permanently immutable. They are hardcoded in:
- Live POS billing components (`BillingTerm.tsx`, `ProPosBillingTerm.tsx`)
- Blueprint `parameters.json` (the seeding source of truth)
- All existing Pytest and Vitest test assertions

**Decision:** Add a new nullable `canonical_code` column as a parallel key, never modify `param_code`.

### 5.2 Canonical Namespace Format

```
SMRITI.<DOMAIN>[.<SUBDOMAIN>].<UPPER_SNAKE_CASE>
```

| Shoper 9 Category | SMRITI Domain |
|---|---|
| `11. Billing` | `SMRITI.BILLING.*` |
| `09. Inwards` | `SMRITI.STOCK.INWARDS.*` |
| `10. Outwards` | `SMRITI.STOCK.OUTWARDS.*` |
| `14. Bill - Printing` | `SMRITI.BILLING.PRINT.*` |
| `01. Setup` | `SMRITI.SETUP.*` |
| `05. Customer` | `SMRITI.CUSTOMER.*` |
| `03. Item Classification` | `SMRITI.CATALOG.CLASSIFICATION.*` |

### 5.3 Dual-Key Resolution (Backend)

```python
is_canonical = cls._is_canonical_key(param_code)  # starts with "SMRITI."
col = SystemParameter.canonical_code if is_canonical else SystemParameter.param_code
# All 4 tier queries use `col` instead of hardcoded param_code column
```

### 5.4 Dual-Key Resolution (Frontend)

```typescript
private _resolveKey(key: string): string {
  if (key.startsWith("SMRITI.")) {
    return this.canonicalAlias.get(key) ?? key;
  }
  return key;
}
```
The `canonicalAlias` map is populated during `load()` from `def.canonical_code` in API definitions. No cache entries are duplicated — only an alias pointer is stored.

### 5.5 In-Memory Canonical Map Cache

`SystemParameterService._canonical_map_cache` is populated once from `canonical_mapping.json` (or derived at runtime if absent). Zero database hits for canonical lookups during seeding.

---

## 6. Design Rationale

- **ADR-042 Compliance:** The `smritiMapping.storageKey` field in `parameters.json` had already anticipated this design — it was simply never activated in the database. This walkthrough activates it.
- **Zero-downgrade risk:** Both migrations have correct `downgrade()` methods (drop column / null all values).
- **Memory-efficient alias map:** Rather than duplicating 828 cache entries in the frontend, a single `Map<canonical, legacy>` alias lookup is used.

---

## 7. Implementation Summary

### Phase 0: Schema (v1471)
- `ALTER TABLE system_parameters ADD COLUMN canonical_code VARCHAR(150)`
- `CREATE INDEX idx_sys_param_canonical_code ON system_parameters(canonical_code)`

### Phase 1: Backfill (v1472)
- 828 `UPDATE` statements (one per `param_code`)
- Applied across all 3 scopes: GLOBAL, COMP-001, COMP-002 = 2,485 rows updated
- Result: 2,485 with canonical_code set, 0 NULL

### Phase 2–5: Code Changes
All described in Files Modified above.

---

## 8. Tests Executed

### Backend — `python -m pytest tests/test_system_parameters.py -v`

```
tests/test_system_parameters.py::test_01_blueprint_integrity PASSED
tests/test_system_parameters.py::test_02_seed_retail_profile PASSED
tests/test_system_parameters.py::test_03_profile_variance_distributor PASSED
tests/test_system_parameters.py::test_04_fixed_mutability_enforcement PASSED
tests/test_system_parameters.py::test_05_variable_parameter_update PASSED
tests/test_system_parameters.py::test_06_hierarchical_resolution PASSED
tests/test_system_parameters.py::test_07_canonical_code_populated PASSED
tests/test_system_parameters.py::test_08_dual_key_resolution PASSED

8 passed in 5.76s
```

### Frontend — `npx vitest run src/tests/smritiSystemParameters.test.ts --reporter=verbose`

```
✓ 0ms Synchronous Accessor Behaviors > should return default fallback when parameter is not present in cache
✓ 0ms Synchronous Accessor Behaviors > should correctly resolve boolean values across multiple formats
✓ 0ms Synchronous Accessor Behaviors > should correctly resolve numeric values
✓ 0ms Synchronous Accessor Behaviors > should correctly resolve string and generic values
✓ 5-Tier Governance & Mutability Semantics > should correctly verify definitions and mutability classifications
✓ Dual-Key Resolution (ADR-042) > should resolve SMRITI.* canonical keys to the same value as the legacy param_code
✓ Dual-Key Resolution (ADR-042) > should return defaultValue when SMRITI.* key has no alias mapping
✓ Dual-Key Resolution (ADR-042) > should return canonical definition via getDefinition using SMRITI.* key

Tests 8 passed (1 file)
```

### TypeScript — `npx tsc --noEmit`
```
Exit code: 0 — 0 errors
```

---

## 9. Verification Results

| Verification | Result |
|---|---|
| `canonical_code` column exists | `character varying(150)` ✓ |
| `idx_sys_param_canonical_code` index exists | ✓ |
| Rows with canonical_code set | **2,485** |
| Rows with NULL canonical_code | **0** |
| Distinct canonical codes in DB | **828** (matches blueprint exactly) |
| Max canonical_code length | **72** (well within 150 limit) |
| Duplicate canonical codes | **0** |
| Legacy param_code values modified | **0** (zero regressions) |
| Backend tests | **8/8 green** |
| Frontend Vitest | **8/8 green** |
| TypeScript compilation | **0 errors** |

### Spot-Check Evidence

```
'AllowCreditBilling'                     -> 'SMRITI.BILLING.ALLOW_CREDIT_BILLING'
'SHOPEREnv'                              -> 'SMRITI.SETUP.SHOPER_ENV'
'GIRWithoutPORef'                        -> 'SMRITI.STOCK.INWARDS.GIR_WITHOUT_PO_REF'
'CompanyCode'                            -> 'SMRITI.SETUP.COMPANY_CODE'
'CustClass1Cap'                          -> 'SMRITI.CUSTOMER.CUST_CLASS1_CAP'
'InBillingCustSelectionCompulsary'       -> 'SMRITI.BILLING.IN_BILLING_CUST_SELECTION_COMPULSARY'
'StockOutActionInBill'                   -> 'SMRITI.BILLING.STOCK_OUT_ACTION_IN_BILL'
```

---

## 10. Known Limitations

1. **`smritiMapping.storageKey`** in `parameters.json` (original blueprint format `sysparam_allowcreditbilling`) is now superseded by the SMRITI.DOMAIN.FEATURE format in `canonical_mapping.json`. The old field is not removed but not used.
2. **New SMRITI-only parameters** (e.g. for GST 2026, UPI) should use `param_code` = the canonical code directly (no legacy Shoper 9 key), with `canonical_code` = same value.

---

## 11. Future Work

- Phase 6: Update `SmritiSystemParametersStudio.tsx` to display `canonical_code` as primary label with legacy code as a reference badge.
- Phase 7: Rename `system_parameters` table → `smriti_system_parameters` with backward-compat view (lower-priority, Phase 7 of roadmap).
- New parameter governance: enforce that any new `param_code` added to SMRITI must start with `SMRITI.` (guard script recommended).

---

## 12. Related ADRs

- **ADR-042**: SMRITI Canonical Parameter Namespace Layer (activated by this walkthrough)

---

## 13. Related RFCs

- RFC-2026-09-18-001: System Parameters Rebranding Strategy — Alias over Rename
