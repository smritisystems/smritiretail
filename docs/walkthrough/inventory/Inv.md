<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.29.1
  Created      : 2026-08-21
  Modified     : 2026-08-21
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough: Dynamic Item Attributes Unification & Single Source of Truth v3.29.1

## 1. Purpose
Establish the backend Attribute Definition (`/api/v1/attributes/definitions`) as the authoritative, single source of truth across all retail catalog entry interfaces, ensuring that dynamically created attributes (e.g. `Fabric Type`, `Care Instructions`) automatically appear, validate, import, persist to `products.attributes` JSONB, and handle deactivation consistently across both **Item Master Entry (Prime)** (`ItemMasterEntryVie.tsx`) and **Excel Quick Entry** (`ExcelGridEntrySec.tsx`).

## 2. Scope
- Unified consumption of dynamic attribute definitions from `GET /api/v1/attributes/definitions`.
- Dynamic column selection and rendering in `ItemMasterEntryView` (Alt+1 Field Selection, Alt+3 Item Details Grid).
- Dynamic column mapping and clipboard paste auto-detection in `ExcelGridEntrySection` via `HeaderMappingEngine`.
- Cross-surface constraint validation (`isMandatory`, `validValues`, `dataType`).
- Persistence to PostgreSQL `products.attributes` JSONB and retrieval.
- Graceful deactivation (`isEnabled: false`) filtering active entry while preserving historical records.

## 3. Files Created
- `src/tests/itemAttrs.test.ts`
- `backend/app/tests/t_dyn_attr.py`
- `docs/walkthrough/inventory/Inv.md`

## 4. Files Modified
- `src/components/itemMaster/types.ts`
- `src/components/itemMaster/ItemMasterEntryVie.tsx`
- `src/components/itemMaster/tabs/FieldSelectViewTab.tsx`
- `src/components/itemMaster/tabs/ItemDetailsGridTab.tsx`
- `src/components/ExcelGridEntrySec.tsx`
- `docs/walkthrough/README.md`

## 5. Architecture Decisions
- **AD-ATTRIBUTES-01**: Backend `/api/v1/attributes/definitions` (backed by PostgreSQL `attribute_definitions`) is the single authoritative source of truth. Neither frontend surface shall maintain an ad-hoc or duplicated attribute schema.
- **AD-ATTRIBUTES-02**: All custom and dynamic product attributes persist to PostgreSQL `products.attributes` JSONB with GIN indexing (`idx_products_attributes`), preserving multi-tenant isolation and fast search capability.
- **AD-ATTRIBUTES-03**: Attribute deactivation (`isEnabled: false`) filters attributes out of active catalog entry views while preserving existing historical values in stored product records.

## 6. Design Rationale
Prior to this refactoring, `ItemMasterEntryView` relied on a static TypeScript list and omitted dynamic attributes from its save payload, while `ExcelGridEntrySection` fetched definitions independently. By introducing `buildUnifiedItemMasterFields` and standardizing payload construction, both entry modes now guarantee identical data fidelity and zero schema drift.

## 7. Implementation Summary
1. **Dynamic Attribute Transformation**: Created `transformAttributeDefinitionToItemField` and `buildUnifiedItemMasterFields` in `types.ts` to merge dynamic definitions with standard retail fields.
2. **Item Master Entry Refactoring**: Added `useEffect` to fetch `/attributes/definitions` via `apiFetchV1`, wired dynamic fields into `FieldSelectionViewTab` and `ItemDetailsGridTab`, and serialized all dynamic custom fields into `payload.attributes` for `POST /api/v1/products/`.
3. **Excel Quick Entry Hardening**: Ensured active attribute resolution includes all active definitions, and mapped definitions in `handlePaste` to allow seamless clipboard detection.
4. **Unified Attribute Validation**: Created `validateProductAttributes` enforcing mandatory presence, allowed option values, and type safety across surfaces.
5. **Deactivation Filter**: Excluded `isEnabled: false` definitions from active column lists while maintaining read compatibility for historical records.

## 8. Tests Executed
- `vitest run src/tests/itemAttrs.test.ts` (11/11 passed)
- `npm test` (155/155 passed across 24 test suites)
- `npm run lint` (`tsc --noEmit` passed with 0 errors)
- `pytest backend/app/tests/t_dyn_attr.py` (1/1 passed)

## 9. Verification Results
- **Evidence Level A**: Full automated test verification on both frontend (Vitest) and backend (Pytest) with literal terminal outputs and zero regressions.

## 10. Known Limitations
- Rich media attributes (e.g. video attachments) continue to be stored as URL references in `Product.gallery_images` rather than raw binaries in attributes JSONB.

## 11. Future Work
- Dynamic multi-language label translation for attribute definitions based on tenant locale settings.

## 12. Related ADRs
- `docs/architecture/ADR_INVENTORY_ATTRIBUTES_JSONB.md`

## 13. Related RFCs
- `RFC-INVENTORY-004-DYNAMIC-ATTRIBUTES`
