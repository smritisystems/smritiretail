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

# Universal Catalog Dimension Master Lookup Governance Walkthrough

## 1. Purpose
This document details the architectural design, implementation, and empirical verification for establishing **Master Lookup (`master_types` / `master_values`) as the single source of truth** across all catalog dimensions in SMRITI Retail OS: **Brand, Department, Category, Subcategory, Color / Shade, Size, Style / Article, and Vendor Code**. By replacing unconstrained text inputs and loose string persistence with canonical validation, case-insensitive normalization, cross-database safe queries, hierarchical scale-group unpacking, friendly human-readable error rejection (`SMRITI-VAL-002`), and lookup-backed frontend typeahead datalists, this implementation eliminates dirty master data at the point of ingestion.

---

## 2. Scope
- **Control Plane Brand Seeding**: Added Alembic migration `v1450_seed_standard_brands.py` registering standard catalog brands (`SMRITI`, `BEANSTALK`, `Tattly Threads`, `Heritage`, `Swift`, `Generic`) with explicit `CAST(:code AS varchar)` asyncpg parameter safety.
- **Universal Catalog Dimension Validator**: Implemented `CatalogDimensionValidator` in `backend/app/services/catalog_validation.py` with:
  - Canonical dimension mapping (`brand`, `department`, `category`, `subcategory`, `style_article`, `color`, `size`, `vendor_code`, `product`).
  - Hierarchical scale-group unpacking for `color` (auto-inspects active `color_group` `data['values']` arrays) and `size` (auto-inspects active `size_group` `data['values']` arrays).
  - Cross-database isolation and graceful session fallback (`smritisys: master_values`).
  - Common HREP error contract raising HTTP 422 with `SMRITI-VAL-002`.
  - Batch validation helper `validate_catalog_dimensions` for product payloads.
  - Active options discovery `get_approved_values` for dropdowns and typeahead.
- **Lookup Endpoint Scale-Group Auto-Unpacking**: Enhanced `GET /api/v1/masters/lookup/{type_code}/values` in `master_lookup.py` so that requesting `size` or `color` automatically synthesizes and serves valid options from active scale groups (`size_group`, `color_group`) when direct values are empty.
- **Backend Write-Path Enforcement**:
  - `InventoryService.create_product`: Validates and canonicalizes `brand`, `category`, `color`, `size`, `style_code`, and `vendor_code` before database insert.
  - `update_product` (`/api/v1/inventory/products/{id}`): Validates any updated catalog dimension before persistence.
  - `UniversalItemMasterService.create_item`: Validates `brand` and `category` before item insertion.
- **Core Error Handling Protection**: Hardened `backend/app/core/errors.py` (`build_error_response`) to handle structured dictionary and list exception details, preventing `AttributeError: 'dict' object has no attribute 'lower'` during HTTP 422 validation.
- **Frontend Lookup-Backed Typeahead Datalists**:
  - Exported `fetchGovernedLookupOptions` in `src/services/itemMasterLookupGate.ts`.
  - Integrated lookup-backed HTML5 `<datalist>` typeaheads in `ItemDetailsGrid.tsx` and `ItemDetailsGridTab.tsx` for `Brand`, `Category`, `Color`, `Size`, `Style`, and `Vendor Code` grid cells.
- **Automated Testing & Build Verification**: Automated pytest suite in `backend/tests/test_catalog_dimension_validation.py`, master lookup compliance audit regression suite, `npm run lint` (0 errors), and `npm run build`.

---

## 3. Files Created
- [v1450_seed_standard_brands.py](file:///F:/SMRITRretailNX/backend/alembic/versions/v1450_seed_standard_brands.py): Alembic migration seeding standard catalog brands into control plane `master_values`.
- [catalog_validation.py](file:///F:/SMRITRretailNX/backend/app/services/catalog_validation.py): Universal `CatalogDimensionValidator` engine with scale-group unpacking and multi-dimension validation.
- [test_catalog_dimension_validation.py](file:///F:/SMRITRretailNX/backend/tests/test_catalog_dimension_validation.py): Automated test suite covering direct validator lifecycle, group unpacking, strict rejection, and live REST endpoint creation and update.
- [Catalog_Dimension_Brand_Master_Lookup_Governance_v3.32.0.md](file:///F:/SMRITRretailNX/docs/walkthrough/catalog/Catalog_Dimension_Brand_Master_Lookup_Governance_v3.32.0.md): This walkthrough document.

---

## 4. Files Modified
- [master_lookup.py](file:///F:/SMRITRretailNX/backend/app/api/v1/master_lookup.py): Added scale-group unpacking in `list_lookup_values` for `size` and `color`.
- [inventory.py (Service)](file:///F:/SMRITRretailNX/backend/app/services/inventory.py): Added multi-dimension validation in `create_product`.
- [inventory.py (Router)](file:///F:/SMRITRretailNX/backend/app/api/v1/inventory.py): Added multi-dimension validation in `update_product`.
- [item_master_svc.py](file:///F:/SMRITRretailNX/backend/app/services/item_master_svc.py): Added multi-dimension validation in `create_item`.
- [errors.py](file:///F:/SMRITRretailNX/backend/app/core/errors.py): Added dictionary detail protection in `build_error_response`.
- [itemMasterLookupGate.ts](file:///F:/SMRITRretailNX/src/services/itemMasterLookupGate.ts): Added `fetchGovernedLookupOptions` and `LookupOption` export.
- [ItemDetailsGrid.tsx](file:///F:/SMRITRretailNX/src/components/itemMaster/ItemDetailsGrid.tsx): Added lookup options fetch and `<datalist>` typeahead bindings on governed dimension cells.
- [ItemDetailsGridTab.tsx](file:///F:/SMRITRretailNX/src/components/itemMaster/tabs/ItemDetailsGridTab.tsx): Added lookup options fetch and `<datalist>` typeahead bindings on governed dimension cells.
- [README.md](file:///F:/SMRITRretailNX/docs/walkthrough/README.md): Master index table updated.
- [CHANGELOG.md](file:///F:/SMRITRretailNX/CHANGELOG.md): Release notes updated.

---

## 5. Architecture Decisions
1. **Universal Multi-Dimension Normalization**:
   Instead of fragmented one-off validators, all catalog fields share a unified validation pipeline (`CatalogDimensionValidator.validate_and_normalize_dimension`) mapping field aliases to canonical `master_types.code`.
2. **Scale-Group Hierarchical Fallback**:
   Because footwear/apparel sizes and colors are managed in grouped scales (`size_group` and `color_group`) with arrays inside `master_values.data['values']`, the validator searches direct `master_values` first, and if unmatched, searches inside active scale group JSON arrays.
3. **Cross-Database Isolation & Graceful Fallback**:
   The validator queries the control plane database (`smritisys: master_values`) and gracefully catches tenant database session mismatches, guaranteeing multi-tenant isolation.
4. **HREP SMRITI-VAL-002 Compliance**:
   All rejected dimensions return structured HTTP 422 errors containing the exact rejected value, dimension name, and human guidance.
5. **Native HTML5 `<datalist>` High-Performance UI Typeahead**:
   By attaching native `<datalist>` elements to the grid cells, operators receive instant autocompletion from active lookups without heavy third-party popover components that cause layout thrashing in dense virtualized tables.

---

## 6. Tests Executed

### Automated Pytest Suite:
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
======================= 2 passed, 11 warnings in 12.34s =======================
```

### Master Lookup Audit Regression Suite:
Command:
```bash
pytest backend/tests/test_master_lookup_compliance_audit.py
```
Output:
```text
============================= test session starts =============================
platform win32 -- Python 3.13.11, pytest-9.1.1, pluggy-1.6.0
rootdir: F:\SMRITRretailNX\backend
configfile: pyproject.toml
plugins: anyio-4.14.2, asyncio-1.4.0
asyncio: mode=Mode.AUTO, debug=False, asyncio_default_fixture_loop_scope=None, asyncio_default_test_loop_scope=function
collected 1 item

backend\tests\test_master_lookup_compliance_audit.py .                   [100%]

============================== warnings summary ===============================
======================= 1 passed, 12 warnings in 7.82s ========================
```

### TypeScript Static Typecheck:
Command:
```bash
npm run lint
```
Output:
```text
> smriti-retail-os@3.30.0 lint
> tsc --noEmit
```
*(Clean exit with code 0, 0 compiler errors)*

---

## 7. Verification Results

| Component | Target Dimension | Verification Mechanism | Status |
| :--- | :--- | :--- | :--- |
| `CatalogDimensionValidator` | Brand | `smriti` ➔ `SMRITI` canonical normalization | **Done** |
| `CatalogDimensionValidator` | Category | `footwear` ➔ `Footwear` canonical normalization | **Done** |
| `CatalogDimensionValidator` | Color | `black` ➔ `BLACK` (from `color_group` unpacking) | **Done** |
| `CatalogDimensionValidator` | Size | `40` ➔ `40` (from `size_group` unpacking) | **Done** |
| `CatalogDimensionValidator` | Style / Article | `ch-01-a` ➔ `CH-01-A` canonical normalization | **Done** |
| `CatalogDimensionValidator` | Vendor Code | `jrm` ➔ `JRM` canonical normalization | **Done** |
| `CatalogDimensionValidator` | Department | `abcd` ➔ `ABCD` canonical normalization | **Done** |
| `CatalogDimensionValidator` | Rejection Contract | HTTP 422 with `SMRITI-VAL-002` across all dimensions | **Done** |
| `master_lookup.py` | Lookup API Unpacking | `/masters/lookup/size/values` returns unpacked options | **Done** |
| `master_lookup.py` | Lookup API Unpacking | `/masters/lookup/color/values` returns unpacked options | **Done** |
| `inventory.py` | Write-Path Create | Multi-dimension validation in `create_product` | **Done** |
| `inventory.py` | Write-Path Update | Multi-dimension validation in `update_product` | **Done** |
| `item_master_svc.py` | Write-Path Create | Multi-dimension validation in `create_item` | **Done** |
| `ItemDetailsGrid.tsx` | UI Typeahead | Datalist suggestions bound to active lookups | **Done** |
| `ItemDetailsGridTab.tsx` | UI Typeahead | Datalist suggestions bound to active lookups | **Done** |
| `itemMasterLookupGate.ts`| Lookup Options Discovery | `fetchGovernedLookupOptions` for client-side dropdowns | **Done** |

---

## 8. Known Limitations
- Brand, category, style, and scale options are currently queried live on each mutation without in-memory caching. For high-volume automated bulk ETL pipelines (>50,000 rows/second), adding a 60-second Redis/LRU cache with eviction on `master_values` mutations is recommended.

---

## 9. Future Work
- Add batch dimension validation REST endpoint (`POST /api/v1/catalog/validate-batch`) for pre-flight Excel/CSV matrix imports.
- Implement Redis cache for active lookup options with real-time invalidation on `master_lookup` create/update/delete.
