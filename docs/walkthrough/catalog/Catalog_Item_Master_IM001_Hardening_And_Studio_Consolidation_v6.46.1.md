<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.46.1
  Created      : 2026-09-28
  Modified     : 2026-09-28
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough: Catalog Item Master IM-001 Hardening & Studio Consolidation

**Walkthrough ID:** WKT-CATALOG-IM001-HARDENING-v6.46.1  
**Branch:** `smritiNX`  
**Date:** 2026-09-28  
**Area:** catalog / item master / universal import / studio  

---

## 1. Purpose

Document the comprehensive hardening of the SMRITI Item Master ingestion pipeline and the consolidation of `ItemMasterStudio.tsx` to the canonical IM-001 Universal Import API (`/api/v1/universal-import/preview` and `/commit`). This addresses the 11-point hardening directive:
- Mandatory promotion of core catalog dimension fields (`GENDER`, `PRODUCT_TYPE`, `HEEL_TYPE`, `UPPER_MATERIAL`).
- Decoupling style/article resolution from SKU/barcode (enforcing `ARTICLE_STYLE_CODE required`).
- Full consolidation of `ItemMasterStudio.tsx` onto the IM-001 preview/commit pipeline, retiring direct unvalidated writes to `/products/`.
- First-class promotion of footwear dimensions in `unifiedFieldCatalog.ts` eliminating attribute key sprawl (`a1`–`a9`).
- Synchronous IM-001 validation gate in `/commit` blocking illegal bypasses.
- Advisory review flag generation for HSN 6403 paired with synthetic upper materials.
- Full SSOT version alignment to `v6.46.1`.

---

## 2. Scope

1. **Backend Validation Rules (`backend/app/api/v1/universal_import.py`):**
   - `FIELD_MANDATORY_MAP`: `GENDER=True`, `PRODUCT_TYPE=True`, `HEEL_TYPE=True`, `UPPER_MATERIAL=True`.
   - `ARTICLE_STYLE_CODE` mandatory validation check in both preview and commit loops.
   - Active `IM001ControlledFieldValidator.validate_row_controlled_fields` check in `/commit` endpoint.
   - Category extraction parity: direct `category` column read without automatic `"Footwear"` fallback; mapping `"MERCHANDISE CATEGORY"` values (CHAPPAL, SANDAL) to `v22_product_type`.
2. **Backend Attributes Validation (`backend/app/services/attributes.py`):**
   - Delegated core dimension validation (`size`, `color`, `brand`, `category`) to `CatalogDimensionValidator`.
3. **Frontend Unified Field Catalog (`src/services/unifiedFieldCatalog.ts`):**
   - Promoted footwear dimensions (`gender`, `product_type`, `heel_type`, `upper_material`, `outsole_material`, `design_attribute`, `collection_type`, `vendor_code`, `department`, `merchandise_category`) to first-class fields with `required: true` on mandatory fields.
   - Required `style` mapped to `ARTICLE_STYLE_CODE`.
4. **Frontend Studio UX (`src/components/itemMaster/ItemMasterStudio.tsx`):**
   - Decommissioned legacy `/products/` write path.
   - Implemented two-phase `handlePreviewAndImport` using `/api/v1/universal-import/preview` and `/commit`.
   - Added dedicated "Validate Preview" button (`handleRunPreviewOnly`).
   - Dynamic Validity Banner reflecting dropped mandatory columns and IM-001 backend preview errors.
   - Human/CA Review Flag banner (`REQUIRES_REVIEW`).
5. **Version SSOT Hardening (`src/config/version.ts`, `backend/app/core/config.py`, `package.json`, `scripts/validate_version_ssot.py`):**
   - Upgraded all version sources to `v6.46.1`.
6. **Automated & Forensic Verification:**
   - 3 new backend tests in `test_universal_import_item_master.py`.
   - Complete Tattly Threads NEW-sheet forensic audit reconciling per-field failures.

---

## 3. Files Created

- `docs/walkthrough/catalog/Catalog_Item_Master_IM001_Hardening_And_Studio_Consolidation_v6.46.1.md`

---

## 4. Files Modified

1. `backend/app/api/v1/universal_import.py`
2. `backend/app/services/attributes.py`
3. `backend/app/core/config.py`
4. `backend/tests/test_universal_import_item_master.py`
5. `src/components/itemMaster/ItemMasterStudio.tsx`
6. `src/services/unifiedFieldCatalog.ts`
7. `src/config/version.ts`
8. `package.json`
9. `CHANGELOG.md`
10. `scripts/validate_version_ssot.py`
11. `docs/walkthrough/README.md`

---

## 5. Architecture Decisions

- **AD-IM001-01: Synchronous Commit Enforcement Gate:** Validation cannot be purely advisory in the preview step. The `/commit` route must synchronously execute `IM001ControlledFieldValidator.validate_row_controlled_fields()` to prevent direct API bypass or forged client payloads.
- **AD-IM001-02: Strict Style/Article Invariance:** The Item Master schema strictly segregates SKU (variant-level identifier) from Style/Article (design-level identifier). Generating style codes from SKU strings or barcodes leads to duplicate styles, corrupts matrix pricing, and breaks vendor-article reconciliation. Style is now strictly mandatory.
- **AD-IM001-03: Footwear Dimension Normalization:** Rather than overloading generic key slots (`a1`–`a9`), footwear attributes (`gender`, `product_type`, `heel_type`, `upper_material`, etc.) are first-class catalog fields with exact database column targets (`v22_*`).
- **AD-IM001-04: Single Pipeline Consolidation:** All batch item import interfaces (`ItemMasterStudio`, CSV import, Excel drag-and-drop, API feeds) must converge on `/api/v1/universal-import/*` to ensure uniform governance.

---

## 6. Design Rationale

- **Why promote GENDER, PRODUCT_TYPE, HEEL_TYPE, UPPER_MATERIAL to mandatory?**
  Retail footwear inventory, statutory compliance, HSN cross-checks, and e-commerce channel syndication require complete dimension definitions. Allowing blank values causes inventory ambiguity and corrupts variant aggregation.
- **Why map MERCHANDISE CATEGORY to PRODUCT_TYPE?**
  Retail catalog analysis of customer data (e.g., Tattly Threads) revealed that client spreadsheets use "MERCHANDISE CATEGORY" to record values like `CHAPPAL` and `SANDAL`. In SMRITI's hierarchy, these are product types, while Department is `FOOTWEAR`.

---

## 7. Implementation Summary

- **Mandatory Map & Validation:**
  Updated `FIELD_MANDATORY_MAP` in `universal_import.py` with `GENDER: True`, `PRODUCT_TYPE: True`, `HEEL_TYPE: True`, `UPPER_MATERIAL: True`. Added blocking logic if `ARTICLE_STYLE_CODE` is empty.
- **Commit Guard:**
  Integrated `IM001ControlledFieldValidator.validate_row_controlled_fields()` into `commit_universal_import()`.
- **ItemMasterStudio Consolidation:**
  Refactored import pipeline to post to `/universal-import/preview` and `/commit`. Wired "Validate Preview" button to fetch preview telemetry. Added missing mandatory column alert, preview error alert, and HSN 6403 review flag alert.
- **Version SSOT:**
  Synchronized `6.46.1` across `package.json`, `backend/app/core/config.py`, `src/config/version.ts`, and `CHANGELOG.md`.

---

## 8. Tests Executed

1. **TypeScript Typecheck:**
   `npx tsc --noEmit` — 0 errors.
2. **Frontend Vitest Suite:**
   `npm run test` — 155/155 test suites passed (1,091/1,091 tests green).
3. **Backend Pytest Suite:**
   `$env:PYTHONUTF8="1"; pytest backend/tests/test_universal_import_item_master.py backend/tests/test_catalog_dimension_validation.py` — 15/15 tests passed.
4. **Version SSOT Verification:**
   `python scripts/validate_version_ssot.py` — Pass (0 drift).
5. **Tattly Sheet 'NEW' Forensic Audit:**
   `python scratch/tattly_forensic_audit.py` on 842 data rows.

---

## 9. Verification Results

| Verification Item | Command / Mechanism | Status | Evidence |
|---|---|---|---|
| Mandatory Field Map | `universal_import.py` inspection | Done | `FIELD_MANDATORY_MAP` has 4 fields `True` |
| Style Required Enforcement | Pytest `test_article_style_code_missing_rejection_never_derive_from_sku` | Done | Passed (Preview & Commit blocked) |
| IM-001 Commit Gate | Pytest `test_im001_commit_enforcement_rejects_unapproved_values` | Done | Passed (HTTP 422 raised) |
| HSN 6403 Review Flag | Pytest `test_hsn_6403_synthetic_upper_review_flag` | Done | Passed (`REQUIRES_REVIEW` flagged) |
| Studio Pipeline Consolidation | `ItemMasterStudio.tsx` code inspection | Done | Calls `/api/v1/universal-import/*` |
| Dimension Catalog Fields | `unifiedFieldCatalog.ts` inspection | Done | First-class footwear fields registered |
| Frontend Test Suite | `npm run test` | Done | 155/155 suites passed (1,091 tests) |
| TypeScript Build | `npx tsc --noEmit` | Done | 0 errors |
| Version SSOT | `validate_version_ssot.py` | Done | `v6.46.1` across 4 SSOT files |

---

## 10. Known Limitations

- The Tattly client file contains unapproved client-specific terms (`CHIKKU`, `BRONZE`, `R-GOLD` in Color; `CUBE HEEL`, `BIG PLATFORM` in Heel Type; `FABRIC`, `LYCRA` in Upper Material; `HALF SHOE` in Product Type). These must be registered into `master_values` via the Master Lookup UI or seeded before import can succeed with 0 validation errors.

---

## 11. Future Work

- Provide an inline bulk master-value registration shortcut directly from the ItemMasterStudio preview error drawer for authorized administrators.

---

## 12. Related ADRs

- `ADR-0042`: Universal Import Two-Tier IM-001 Architecture
- `ADR-0051`: FastAPI Sole System-of-Record Architecture

---

## 13. Related RFCs

- `RFC-CATALOG-019`: Dynamic Footwear Attribute Standardization
