<!--
  Project      : SMRITI Retail OS
  Repository   : SMRITIRetailNX
  Organization : AITDL NETWORKS

  Founders

  * Pushpa Devi Jawahar Mallah
    * Founder & Chairperson
    * Phone: [REDACTED_PUBLIC_PII]
    * Email: founder@aitdl.com

  * Jawahar Ramkripal Mallah
    * Founder, Chief Executive Officer (CEO) & Chief Software Architect
    * Email: founder@aitdl.com

  * Websites: aitdl.com | erpnbook.com | smritibooks.com

  * Version    : 6.70.49
  * Created    : 2026-10-09
  * Modified   : 2026-10-09
  * Copyright  : © SMRITIBooks.com. All Rights Reserved.
  * License    : Proprietary Commercial Software
  * Classification: Internal
-->

# Smart Import Header Disambiguation & Style/SKU Parity Walkthrough (v6.70.49)

## 1. Purpose
Diagnose and eliminate bulk-import validation errors (`Validation Error: A database operations conflict occurred or referential integrity check failed.` / `SMRITI-DATA-001` or 400 Bad Request) when importing multi-column retail catalogs (e.g. 21-column footwear TSV containing `BARCODE NO`, `PRODUCT STYLE CODE`, `ITEM DESCRIPTION`, `BRAND NAME`, `COLOR`, `SIZE`, `SKU`, `PLANNED MRP`, `COST PRICE`, `PRODUCT TAX`, `HSN CODE`, `GENDER`, `VENDOR CODE`, `PURCHASE CLASS`, `DEPARTMENT`, `MERCHANDISE CATEGORY`, `Sub category`, `HEELS`, `UPPER MATERIAL`, `OUTSOLE`, `IMAGE LINK`).

---

## 2. Scope
- Disambiguate `PRODUCT STYLE CODE` (`style_code`) from `SKU` (`sku` / `code`) across frontend and backend alias catalogs so that both columns coexist cleanly without key collision.
- Clean up alias registries:
  - Remove `"item description"` from `collection_type` aliases to prevent description hijacking.
  - Remove `"category"` from `PRODUCT_TYPE` aliases in `IM001ControlledFieldValidator`.
  - Add missing aliases (`"planned mrp"`, `"product_style_code"`, `"product_style"`) to their respective canonical target fields (`mrp`, `style_code`).
- Update backend universal import resolution (`universal_import.py`) to safely resolve both `style_code` and `sku` simultaneously and propagate them to `Item` and `ItemVariant` entities.
- Ensure 100% test pass rate across Vitest and Pytest test suites.

---

## 3. Files Created
1. `src/tests/smartImportHeaderDisambiguation.test.ts` — Frontend test suite asserting 21-column TSV disambiguation, style vs SKU co-existence, and absence of description hijacking.
2. `docs/walkthrough/inventory/Smart_Import_Header_Disambiguation_And_Style_SKU_Parity_Walkthrough_v6.70.49.md` — Formal engineering walkthrough.

---

## 4. Files Modified
1. `src/lib/headerMapping/HeaderAliasRegistry.ts` — Separated `style_code` from `code` in `SMRITI_ITEM_MASTER_FIELDS`.
2. `src/services/unifiedFieldCatalog.ts` — Segregated `stockNo` vs `style` definitions, cleaned `collectionType` aliases, added `planned mrp` to `mrp`.
3. `backend/app/services/catalog_validation.py` — Updated `DIMENSION_FIELD_MAP` and `FIELD_EXTRACTION_MAP` to include `product_style_code`, `product_style`, `vendor`, and removed `"category"` from `PRODUCT_TYPE`.
4. `backend/app/api/v1/universal_import.py` — Multi-key fallback for `style_code`, `sku`, `name`, `tax_rate`, and `upper_mat` review check.
5. `backend/app/tests/test_smart_import_studio.py` — Added `test_smart_import_style_and_sku_disambiguation` and validated 7/7 tests.
6. `backend/app/tests/test_item_master_import_pipeline.py` — Aligned test parameters with standard master lookup data and branch context; verified 7/7 tests.
7. `src/tests/aliasMap.test.ts` — Synchronized expectations for separate `code` and `style_code` fields.
8. `src/tests/headerMap.test.ts` — Synchronized mapping expectations.
9. `src/tests/databridgeWorkspace.test.ts` — Synchronized mapping expectations.
10. `src/tests/itemMasterStudioIntake.test.ts` — Synchronized mapping expectations.
11. `package.json`, `src/config/version.ts`, `backend/app/core/config.py`, `CHANGELOG.md` — Synchronized SSOT version to `6.70.49`.
12. `docs/walkthrough/README.md` — Master index table updated with v6.70.49 entry.

---

## 5. Architecture Decisions
1. **Strict Separation of Article Style Code and Variant SKU**:
   - `style_code` represents the parent article design identifier (e.g. `CH-01-A`).
   - `code` / `sku` represents the specific variant identifier (e.g. `CH-01-A-CREAM-36`).
   - By creating two dedicated canonical definitions in `SMRITI_ITEM_MASTER_FIELDS` and `UNIFIED_FIELD_CATALOG`, auto-matching algorithms no longer assign both column headers to the same key.
2. **First-Class Column Storage Parity**:
   - In Item Master Standard v2.2, promoted attributes (`gender`, `purchase_class`, `product_type`, `design_attribute`, `heel_type`, `upper_material`, `outsole_material`, `collection_type`) are stored directly in typed SQL columns on `items`, with pass-through extras retained in `attributes_json`.

---

## 6. Design Rationale
When retail files include both `PRODUCT STYLE CODE` and `SKU`, legacy greedy mapping matched `PRODUCT STYLE CODE` to `code` (because `code` had `"product style code"` in its aliases). Consequently, when the actual `SKU` column was processed, it encountered a collision or was left unmapped. Segregating these aliases at the registry level ensures that auto-mapping resolves all 21 columns deterministically on intake.

---

## 7. Implementation Summary
- **Registry Alignment**:
  - `HeaderAliasRegistry.ts`: Defined `style_code` with aliases `["product style code", "product style", "style code", "style", "article"]` and `code` with aliases `["sku", "variant sku", "sku code", "item code"]`.
  - `unifiedFieldCatalog.ts`: Disambiguated `stockNo` and `style`, removed `"item description"` from `collectionType`.
- **Backend Import Engine**:
  - `catalog_validation.py`: Mapped `product_style_code` and `product_style` to `style_article`. Removed `"category"` from `PRODUCT_TYPE`.
  - `universal_import.py`: Enhanced `_text(row, ...)` lookups to recognize all vendor and footwear attribute variants, and updated the synthetic HSN material check to inspect `v22_upper_material`.

---

## 8. Tests Executed
1. **Pytest Suite (`test_smart_import_studio.py`)**:
   - `test_smart_import_preview_structured_errors`: PASSED
   - `test_smart_import_in_file_duplicate_detection`: PASSED
   - `test_smart_import_partial_commit_strategy`: PASSED
   - `test_smart_import_strict_strategy_aborts`: PASSED
   - `test_smart_import_preview_empty_rows`: PASSED
   - `test_smart_import_safe_float_and_currency_parsing`: PASSED
   - `test_smart_import_style_and_sku_disambiguation`: PASSED
   - *Result: 7/7 PASSED*

2. **Pytest Suite (`test_item_master_import_pipeline.py`)**:
   - `test_import_item_pricing_routes_to_authoritative_price_book_entry`: PASSED
   - `test_import_item_vendor_code_linkage_success`: PASSED
   - `test_import_item_vendor_code_linkage_unregistered_supplier_rejected`: PASSED
   - `test_import_footwear_attributes_routing_to_attributes_json`: PASSED
   - `test_style_code_consistency_validation_flags_snd_row_bug`: PASSED
   - `test_hsn_material_mismatch_flags_requires_review`: PASSED
   - `test_gst_rate_slab_mismatch_flags_requires_review`: PASSED
   - *Result: 7/7 PASSED*

3. **Vitest Frontend Suites**:
   - `src/tests/smartImportHeaderDisambiguation.test.ts`: 3/3 PASSED
   - `src/tests/headerMap.test.ts`: 13/13 PASSED
   - `src/tests/aliasMap.test.ts`: 4/4 PASSED
   - `src/tests/itemMasterStudioIntake.test.ts`: 4/4 PASSED
   - `src/tests/databridgeWorkspace.test.ts`: 11/11 PASSED
   - *Result: 35/35 PASSED*

4. **SSOT Synchronizer**:
   - `py -3.13 scripts/validate_version_ssot.py`: PASSED (4-point consistency at `6.70.49`)

---

## 9. Verification Results
- **Evidence Level**: A (Direct verifiable terminal test outputs and code diffs).
- **Status**: Done.

---

## 10. Known Limitations
None identified within the Smart Import Studio disambiguation and import pipeline.

---

## 11. Future Work
- Extend automatic alias suggestions in the Smart Import Studio UI when custom column headers with low edit distances are encountered.

---

## 12. Related ADRs
- `ADR-048`: Item Master Canonical Two-Tier Architecture and IM-001 Governance.
- `ADR-045`: Express Cutover and FastAPI System-of-Record Consolidation.

---

## 13. Related RFCs
- `RFC-8594`: Sunset and Deprecation Header Standards.
- `RFC-4180`: Common Format and MIME Type for Comma-Separated Values (CSV) Files.
