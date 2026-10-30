<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.72.8
  Created      : 2026-10-30
  Modified     : 2026-10-30
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough: Item Master Taxonomy Lookup Validation and Category Decoupling v6.72.8

## 1. Purpose
This implementation enforces that Item Master create and update requests strictly resolve controlled product taxonomy dimensions (Brand, Category, Product Type, Gender, Department, Heel Type, Upper Material, Outsole Material, and Sub-Category) against active Master Registry lookups. Unapproved or ad-hoc entries are rejected with human-readable guidance directing users to approve them in Master Registry first. Furthermore, implicit default category assumptions (`"Footwear"` / `"General"`) have been removed across frontend grids and backend schemas to enforce explicit categorization, while decoupling `category`, `productType`, `merchandiseCategory`, and `subCategory`.

## 2. Scope
- Server-side resolution in `backend/app/services/item_taxonomy.py` and integration in `backend/app/api/v1/inventory.py`.
- Schema-level requiredness and validator updates in `backend/app/schemas/inventory.py`.
- Database model index alignment for `product_type` in `backend/app/models/inventory.py` and Alembic migration `backend/alembic/versions/v1393_product_type_dimension.py`.
- Audit event emission (`ITEM_TAXONOMY_ASSIGNED` and `ITEM_TAXONOMY_UPDATED`) via `ComplianceAuditService`.
- Frontend grid, form, and header mapping alignment across `src/components/itemMaster/ItemEntryView.tsx`, `ItemDetailsGrid.tsx`, `ItemMasterStudio.tsx`, `types.ts`, `HeaderAliasRegistry.ts`, and `unifiedFieldCatalog.ts`.
- Comprehensive test coverage across backend (`test_item_taxonomy.py`, `test_schemas.py`) and frontend (`headerMap.test.ts`, `itemAttrs.test.ts`).

## 3. Files Created
- `backend/app/services/item_taxonomy.py`
- `backend/app/tests/test_item_taxonomy.py`
- `backend/alembic/versions/v1393_product_type_dimension.py`
- `docs/walkthrough/catalog/Item_Master_Taxonomy_Lookup_Validation_And_Category_Decoupling_v6.72.8.md`

## 4. Files Modified
- `backend/app/api/v1/inventory.py`
- `backend/app/models/inventory.py`
- `backend/app/schemas/inventory.py`
- `backend/app/services/inventory.py`
- `backend/app/tests/test_schemas.py`
- `src/components/itemMaster/ItemDetailsGrid.tsx`
- `src/components/itemMaster/ItemEntryView.tsx`
- `src/components/itemMaster/ItemMasterStudio.tsx`
- `src/components/itemMaster/types.ts`
- `src/lib/headerMapping/HeaderAliasRegistry.ts`
- `src/services/unifiedFieldCatalog.ts`
- `src/tests/headerMap.test.ts`
- `src/tests/itemAttrs.test.ts`
- `docs/walkthrough/README.md`

## 5. Architecture Decisions
1. **Server-Side Gate as System-of-Record:** Validation is anchored in the backend API layer (`inventory.py` and `item_taxonomy.py`) so that bulk imports, direct REST API calls, and UI forms are all subject to identical controlled-field validation.
2. **Recommendation Over Silent Correction:** Unmatched taxonomy values raise HTTP 422 with actionable guidance (`SMRITI-VAL-002`) directing operators to onboard new dimensions via Master Registry rather than silently accepting free text or auto-generating unapproved entries.
3. **Casing Disambiguation:** Preserves exact casing matches for Brand names when multiple casing variants exist in lookup values, preventing unintentional normalization of stylized brand trademarks.
4. **Independent Dimension Mapping:** Header mapping treats `Category`, `Product Type`, `Sub-Category`, and `Merchandise Category` as completely independent fields, removing legacy fallbacks where `Merchandise Category` or `Department` substituted for `Category`.

## 6. Design Rationale
Previously, items could be created with arbitrary brand names or categories that bypassed master catalogs, creating reporting fragmentation and downstream POS filter anomalies. Furthermore, fallback logic previously defaulted missing categories to `"Footwear"`, masking data entry omissions in non-footwear items (e.g. accessories or apparel). Requiring explicit category input and resolving all controlled fields against the active control plane guarantees catalog data integrity.

## 7. Implementation Summary
- **Taxonomy Service (`item_taxonomy.py`):** Added `resolve_product_taxonomy_value` and `resolve_product_attribute_lookup_values` querying `MasterType` and `MasterValue`.
- **Inventory Service & Router (`inventory.py`, `services/inventory.py`):** Wired taxonomy resolution into `create_product` and `update_product`, with audit logging via `ComplianceAuditService`.
- **Schemas (`schemas/inventory.py`):** Removed default `"Footwear"`; added `Field(..., max_length=100)` for `category` and explicit whitespace validation. Added `product_type` column and index to `Product` model.
- **Frontend Item Master Views (`ItemEntryView.tsx`, `ItemDetailsGrid.tsx`, `ItemMasterStudio.tsx`):** Removed default fallback strings; required explicit category selection before row validation.
- **Header Mapping Engine (`HeaderAliasRegistry.ts`, `unifiedFieldCatalog.ts`):** Decoupled aliases so `merchandiseCategory` does not alias `category`.

## 8. Tests Executed
1. `backend/app/tests/test_item_taxonomy.py` (6 tests) — PASSED
2. `backend/app/tests/test_schemas.py` (5 tests) — PASSED
3. `src/tests/headerMap.test.ts` (14 tests) — PASSED
4. `src/tests/itemAttrs.test.ts` (12 tests) — PASSED
5. `src/tests/itemGrid.test.ts` (13 tests) — PASSED
6. `src/tests/itemFilter.test.ts` (12 tests) — PASSED

## 9. Verification Results
- **Pytest:** 11/11 tests passed in 18.97s (0 failures).
- **Vitest:** 51/51 tests passed across 4 suites (0 failures).
- **Git diff & formatting check:** `git diff --check` returned 0 (no whitespace/formatting violations).

## 10. Known Limitations
- Master Lookup validation currently queries `MasterType` and `MasterValue` in the control database (`control_db`). Offline standalone mode without control-plane database access must seed local lookup tables before validation.

## 11. Future Work
- Wire dynamic category-attribute group mappings to dynamically toggle mandatory status of technical footwear attributes (heel type, upper material) based on selected category.

## 12. Related ADRs
- `ADR-0012`: Control Plane Master Registry & Universal Lookup Architecture
- `ADR-0021`: Item Master Domain Hierarchy & Variant Physical Attribute Separation

## 13. Related RFCs
- `RFC-0034`: Item Master Schema Governance & Master Registry Ingestion Gating
