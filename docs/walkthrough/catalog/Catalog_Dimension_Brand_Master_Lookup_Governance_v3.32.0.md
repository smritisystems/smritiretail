<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.32.0
  Created      : 2026-09-13
  Modified     : 2026-09-13
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Catalog Dimension Brand Master Lookup Governance Walkthrough

## 1. Purpose
This document details the architectural design, implementation, and empirical verification for establishing **Master Lookup (`master_lookup:brand`) as the single source of truth** for item and product brands across SMRITI Retail OS. By replacing unconstrained text inputs and loose string persistence with canonical validation, case-insensitive normalization, cross-database safe queries, and friendly human-readable error rejection, this implementation eliminates dirty master data at the point of ingestion and prevents catalog fragmentation across sales, inventory, and regulatory reporting.

---

## 2. Scope
- **Control Plane Master Brand Seeding**: Added Alembic migration `v1450_seed_standard_brands.py` registering core standard brands (`SMRITI`, `BEANSTALK`, `Tattly Threads`, `Heritage`, `Swift`, `Generic`) into `master_values` with explicit PostgreSQL parameter casting for asyncpg compatibility.
- **Cross-Database Safe Dimension Validator**: Created `CatalogDimensionValidator` in `backend/app/services/catalog_validation.py` to validate and normalize dimension values against the control plane (`smritisys: master_values`) without contaminating or locking tenant transaction contexts (`smriti001`).
- **Backend Write-Path Integration**:
  - `InventoryService.create_product`: Validates brand against master lookup before inserting into tenant database.
  - `update_product` (`/api/v1/inventory/products/{id}`): Validates and normalizes brand on product updates.
  - `UniversalItemMasterService.create_item`: Validates and normalizes brand when creating canonical items.
- **Core Error Handling Hardening**: Hardened `backend/app/core/errors.py` (`build_error_response`) to gracefully handle structured dictionary and list exception details, preventing `AttributeError: 'dict' object has no attribute 'lower'` during HTTP 422 validations.
- **End-to-End Automated Testing**: Implemented `backend/tests/test_catalog_dimension_validation.py` validating case-insensitive matching, none/empty bypass, strict rejection (`SMRITI-VAL-002`), non-strict fallback, active approved brand listing, and live FastAPI endpoint creation/update rejection and acceptance.
- **Frontend Lookup Gate Parity**: Verified pre-save validation in `src/services/itemMasterLookupGate.ts` (`validateItemMasterLookupOptions`), ensuring client-side gating aligns with backend enforcement in `ItemEntryView.tsx` and `ItemDetailsGrid.tsx`.

---

## 3. Files Created
- [v1450_seed_standard_brands.py](file:///F:/SMRITRretailNX/backend/alembic/versions/v1450_seed_standard_brands.py): Alembic migration seeding standard catalog brands into control plane `master_values` with explicit `CAST(:code AS varchar)` asyncpg type safety.
- [catalog_validation.py](file:///F:/SMRITRretailNX/backend/app/services/catalog_validation.py): Core service `CatalogDimensionValidator` implementing `validate_and_normalize_brand` and `get_approved_brands` with cross-database fallback.
- [test_catalog_dimension_validation.py](file:///F:/SMRITRretailNX/backend/tests/test_catalog_dimension_validation.py): Automated test suite covering direct validator lifecycle, case normalization, strict rejection, and live REST endpoint creation and update.
- [Catalog_Dimension_Brand_Master_Lookup_Governance_v3.32.0.md](file:///F:/SMRITRretailNX/docs/walkthrough/catalog/Catalog_Dimension_Brand_Master_Lookup_Governance_v3.32.0.md): This walkthrough document.

---

## 4. Files Modified
- [inventory.py](file:///F:/SMRITRretailNX/backend/app/services/inventory.py): Added `CatalogDimensionValidator.validate_and_normalize_brand` call in `create_product`.
- [inventory.py](file:///F:/SMRITRretailNX/backend/app/api/v1/inventory.py): Added `CatalogDimensionValidator.validate_and_normalize_brand` call in `update_product` before updating product attributes.
- [item_master_svc.py](file:///F:/SMRITRretailNX/backend/app/services/item_master_svc.py): Added `CatalogDimensionValidator.validate_and_normalize_brand` call in `create_item`.
- [errors.py](file:///F:/SMRITRretailNX/backend/app/core/errors.py): Added type guard for `isinstance(explanation, str)` in `build_error_response` to protect structured error payloads.

---

## 5. Architecture Decisions
1. **Cross-Database Isolation & Graceful Session Fallback**:
   Because `master_values` resides in the control plane (`smritisys`) while `products` and `items` reside in tenant databases (`smriti001`), directly querying `master_values` using a tenant database session fails if schemas or tables are isolated. `CatalogDimensionValidator` inspects the active session and gracefully falls back to `async_session()` (pointing to the control plane) whenever a tenant DB session is passed. This guarantees multi-tenant isolation without breaking validation.
2. **Case-Insensitive Canonical Mapping**:
   Human operators frequently type brands with variable capitalization (e.g., `smriti`, `Smriti`, `SMRITI`). The validator performs a case-insensitive lookup (`LOWER(mv.code) = LOWER(:brand) OR LOWER(mv.name) = LOWER(:brand)`) and returns the canonical casing defined in `master_values.code`.
3. **Human-Readable Error Policy (HREP) Compliance**:
   When an unapproved brand is submitted in strict mode, the validator raises an HTTP 422 exception with structured error code `SMRITI-VAL-002`, including the exact rejected value, guidance on how to approve it in Master Management, and a support reference ID.
4. **Tiered Dimension Governance Model**:
   - **Tier 1 (Canonical Master Lookup)**: `brand`, `department`, `category` use flat canonical `master_values`.
   - **Tier 2 (Hierarchical Dimension Scales)**: `size` and `color` remain hierarchical dimension scales linked via `size_group` and `color_group` in `data.values`.
   - **Tier 3 (Universal Party Master)**: `vendor_code` remains authoritatively anchored to Universal Party Master (`parties` + `PartyRole.SUPPLIER`).

---

## 6. Design Rationale
- **Single Source of Truth**: Having a unified `master_lookup:brand` type prevents duplicate brand tables and keeps the system lightweight and maintainable.
- **Preventing Cascade Errors**: Rejecting unapproved brands at the API ingestion boundary stops invalid data before it propagates into inventory, purchase orders, sales invoices, and E-Way bills.
- **Non-Breaking Operational Workflow**: For bulk legacy migrations or lenient tenants, `strict=False` mode provides automatic casing normalization when a match exists, while allowing unmatched values to proceed without raising an error.

---

## 7. Implementation Summary
- **Migration & Seeding**: Executed `v1450_seed_standard_brands.py`, registering 6 canonical brands (`SMRITI`, `BEANSTALK`, `Tattly Threads`, `Heritage`, `Swift`, `Generic`) with active status in `master_values`.
- **Validation Engine**: Built `CatalogDimensionValidator` with `validate_and_normalize_brand` and `get_approved_brands`.
- **Service Integration**: Connected `InventoryService` (`create_product`), `UniversalItemMasterService` (`create_item`), and `inventory.py` (`update_product`).
- **Error Pipeline Protection**: Resolved `AttributeError` in `build_error_response` for dictionary payloads.
- **Automated Test Coverage**: 2/2 tests passed in `test_catalog_dimension_validation.py` in 9.93s.
- **Regression Testing**: Master lookup compliance audit suite verified passing (1/1 in 8.55s).
- **TypeScript & Production Bundle**: Verified 0 TypeScript errors via `tsc --noEmit` and compiled production bundle via `npm run build`.

---

## 8. Tests Executed

### Automated Pytest Execution:
Command:
```bash
pytest backend/tests/test_catalog_dimension_validation.py
```
Output:
```text
============================= test session starts =============================
platform win32 -- Python 3.13.11, pytest-9.1.1, pluggy-1.6.0
rootdir: F:\SMRITRretailNX\backend
configfile: pyproject.toml
plugins: anyio-4.14.2, asyncio-1.4.0
asyncio: mode=Mode.AUTO, debug=False, asyncio_default_fixture_loop_scope=None, asyncio_default_test_loop_scope=function
collected 2 items

backend\tests\test_catalog_dimension_validation.py ..                    [100%]

============================== warnings summary ===============================
-- Docs: https://docs.pytest.org/en/stable/how-to/capture-warnings.html
======================= 2 passed, 11 warnings in 9.93s ========================
```

### TypeScript Typecheck:
Command:
```bash
npm run lint
```
Output:
```text
> smriti-retail-os@3.30.0 lint
> tsc --noEmit
```
(Clean exit with code 0, zero errors)

---

## 9. Verification Results

| Component | Test Case | Target Mechanism | Status |
| :--- | :--- | :--- | :--- |
| `CatalogDimensionValidator` | Case-Insensitive Normalization | `LOWER(code) = LOWER(:brand)` canonical mapping | **Done** |
| `CatalogDimensionValidator` | Strict Rejection (`SMRITI-VAL-002`) | Raises HTTP 422 on unapproved brands | **Done** |
| `CatalogDimensionValidator` | Non-Strict Mode Normalization | Returns canonical if exists, raw if not | **Done** |
| `CatalogDimensionValidator` | Empty/None Value Handling | Safe bypass on optional brands | **Done** |
| `CatalogDimensionValidator` | Approved Brand Listing | Queries active `master_values` for brand type | **Done** |
| `InventoryService` | Live Endpoint Brand Rejection | HTTP 422 on unapproved brand in `create_product` | **Done** |
| `InventoryService` | Live Endpoint Brand Acceptance | HTTP 201 with normalized brand on create | **Done** |
| `inventory.py` | Live Endpoint Update Rejection | HTTP 422 on unapproved brand in `update_product` | **Done** |
| `backend/app/core/errors.py` | Dict Exception Details Guard | Prevents `AttributeError` on structured errors | **Done** |
| `src/services/itemMasterLookupGate.ts`| Client-Side Pre-Save Validation | Gating in `ItemEntryView` and `ItemDetailsGrid` | **Done** |

---

## 10. Known Limitations
- Brand validation currently queries `master_values` joined with `master_types` on each mutation without in-memory TTL caching. For high-throughput bulk import pipelines (>10,000 rows/sec), adding a 60-second in-memory LRU cache or Redis cache for approved brands is recommended.
- Validation is currently enforced on `brand`; extending this pattern to `department` and `category` will follow the same `CatalogDimensionValidator` pattern.

---

## 11. Future Work
- Extend `CatalogDimensionValidator` to cover `department` and `category` canonical lookup governance.
- Add Redis/in-memory LRU caching with cache-invalidation hooks on `master_values` mutations.
- Expose batch validation endpoint `/api/v1/catalog/validate-dimensions` for bulk Excel/CSV catalog uploads.

---

## 12. Related ADRs
- `ADR-001`: Multi-Tenant Dual-Plane Architecture (`smritisys` vs `smriti001`).
- `ADR-FROZEN-001`: Universal Item Master as Canonical System of Record.

---

## 13. Related RFCs
- `RFC-CATALOG-002`: Master Lookup as Authoritative Source of Truth for Catalog Dimensions.
- `RFC-HREP-001`: SMRITI Human-Readable Error Policy Specification.
