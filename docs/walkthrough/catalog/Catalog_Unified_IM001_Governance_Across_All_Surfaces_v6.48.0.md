<!--
  Project      : SMRITI Retail OS
  Repository   : SMRITIRetailNX
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.48.0
  Created      : 2026-09-30
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough: Unified IM-001 Catalog Governance Across All Surfaces (v6.48.0)

## 1. Purpose
Establish a unified, authoritative catalog validation gateway across all item creation and ingestion entry points:
- Manual creation via UI: `AddProductDrawer.tsx` / `POST /api/v1/inventory/`
- Canonical domain service: `UniversalItemMasterService.create_item`
- Batch spreadsheet preview & commit: `POST /api/v1/universal/preview` and `POST /api/v1/universal/commit`

This resolves the discrepancy where item validation was enforced on only one surface, seeds canonical footwear dimensions per v2.2 standard, binds mandatory classification dynamically to workbook sheet `"From System Master Lookup"`, and enforces strict fail-closed blocking.

## 2. Scope
- Centralization of `IM001ControlledFieldValidator` inside `backend/app/services/catalog_validation.py`.
- Alembic database migration `v1506_seed_v22_item_governance_masters.py` seeding:
  - `heel_type` (11 values: `FLAT`, `BLOCK HEEL`, `KITTEN HEEL`, `STILETTO`, `WEDGE`, `PLATFORM`, `PENCIL HEEL`, `SPOOL HEEL`, `CONE HEEL`, `CUBE HEEL`, `BIG PLATFORM`)
  - `upper_material` (13 values: `SYNTHETIC`, `LEATHER`, `CANVAS`, `MESH`, `SUEDE`, `NUBUCK`, `TEXTILE`, `PU`, `PVC`, `PATENT`, `SATIN`, `LYCRA`, `FABRIC`)
  - `product_type` (13 values: `SANDAL`, `SLIPPER`, `SHOE`, `BOOT`, `SNEAKER`, `LOAFER`, `BALLERINA`, `CLOG`, `FLIP FLOP`, `MULE`, `KOLHAPURI`, `JUTTI`, `HALF SHOE`)
  - `gender` (9 values: `BOYS`, `GIRLS`, `KIDS`, `LADIES`, `MEN`, `MENS`, `NA`, `UNISEX`, `WOMEN`)
  - `subcategory` (22 values)
  - `color` (24 values)
  - `outsole_material` (10 values)
  - `collection_type` (8 values)
  - `uom` (5 values)
  - `gst_rate` (5 values)
- Excluded unconfirmed values pending client confirmation: `MATERIAL`, `CHIKKU`, `SULTAN`, `MUEL`, `REGULAR`.
- UI enhancements in `AddProductDrawer.tsx` with dynamic lookups for `product_type`, `heel_type`, and `upper_material`.
- Backward-compatible router mount in `backend/app/main.py` exposing both `/api/v1/import` and `/api/v1/universal` endpoints.

## 3. Files Created
- `backend/alembic/versions/v1506_seed_v22_item_governance_masters.py`
- `backend/tests/test_unified_im001_governance.py`
- `docs/implementation/inventory/Unified_IM001_Catalog_Governance_Across_All_Surfaces_v6.48.0.md`
- `docs/walkthrough/catalog/Catalog_Unified_IM001_Governance_Across_All_Surfaces_v6.48.0.md`

## 4. Files Modified
- `backend/app/services/catalog_validation.py`
- `backend/app/api/v1/universal_import.py`
- `backend/app/schemas/inventory.py`
- `backend/app/services/inventory.py`
- `backend/app/services/item_master_svc.py`
- `backend/app/services/attributes.py`
- `backend/app/main.py`
- `src/components/itemMaster/AddProductDrawer.tsx`
- `docs/implementation/README.md`
- `docs/walkthrough/README.md`
- `CHANGELOG.md`

## 5. Architecture Decisions
- **Single Source of Truth:** `IM001ControlledFieldValidator` is the sole validator for catalog controlled dimensions across all 3 entry surfaces. Duplicate inlined classes in router handlers were eliminated.
- **Fail-Closed Policy:** Any mandatory dimension missing approved values in `master_values` or encountering DB errors halts creation with an explicit `IM-001-UNSEEDED [BLOCK]` error (`HTTP 422`).
- **Dynamic Policy Ingestion:** Mandatory classification is parsed from `"From System Master Lookup"` sheet in the v2.2 standard workbook, ensuring architectural changes to field mandatory rules update without code redeployments.
- **Dual Router Alias Mounting:** Mounted `universal_import` router under both `/import` and `/universal` in `backend/app/main.py` to support canonical REST paths without breaking existing integrations.

## 6. Design Rationale
- **N+1 Optimization:** In batch processing (`validate_batch_controlled_fields`), all 14 dimension values are loaded in 14 database queries total. Every row is then validated in memory, keeping import latency under 1.5 seconds for 50 rows.
- **Float and Percentage Normalization:** Tax rate percentages (`12.0`, `12%`, `12`) are normalized dynamically to integer codes (`12`) before comparison with `master_values`.
- **Case-Insensitive & Dynamic Attribute Aliasing:** Dynamic attributes for styles (`style_no`, `style`, `style_code`) and articles (`article_no`, `article_code`) are aliased bidirectionally, preventing false validation rejections.

## 7. Implementation Summary
1. **Migration `v1506`:** Created linear Alembic migration down from `v1505`. Executed bootstrap engine against control plane (`smritisys`) and all 4 tenant databases (`smriti001`–`smriti004`). Verified 11 master types and 147 master values active.
2. **Catalog Validation Service:** Centralized `IM001ControlledFieldValidator`, implemented `validate_dict()`, and hooked into `InventoryService.create_product` and `UniversalItemMasterService.create_item`.
3. **UI Step 1 Expansion:** Added `product_type`, `heel_type`, and `upper_material` fields to `AddProductDrawer.tsx` with dynamic lookups.
4. **Verification Suite:** Implemented 6 automated tests in `backend/tests/test_unified_im001_governance.py`.

## 8. Tests Executed
```powershell
F:\SMRITRretailNX\.venv\Scripts\python.exe -m pytest tests/test_unified_im001_governance.py -s -v
```
All 6 tests executed successfully:
1. `test_01_negative_test_invalid_heel_type_blocked_at_inventory`: Verifies invalid `heel_type="INVALID_HEEL"` is blocked with HTTP 422.
2. `test_02_negative_test_invalid_upper_material_blocked`: Verifies invalid `upper_material="INVALID_MATERIAL_UNKNOWN"` is blocked with HTTP 422.
3. `test_03_positive_test_onboarded_dimensions_pass`: Verifies newly onboarded dimensions (`CUBE HEEL`, `LYCRA`, `HALF SHOE`, `BRONZE`) succeed with HTTP 201 Created.
4. `test_04_system_master_lookup_registry_loaded_dynamically`: Confirms dynamic parsing of workbook sheet `"From System Master Lookup"`.
5. `test_05_universal_import_preview_tattly_new_sheet`: Confirms preview of 50 rows from Tattly `NEW` sheet.
6. `test_06_universal_import_commit_tattly_new_sheet`: Confirms idempotent commit of rows from Tattly `NEW` sheet.

## 9. Verification Results
- **Pytest:** 6/6 passed in 39.17s.
- **Alembic Heads:** Exactly 1 head (`v1506 (head)`).
- **Frontend Build (`npm run build`):** Built 3621 modules cleanly in 37.52s with 0 errors.

## 10. Known Limitations
- Unconfirmed client values (`MATERIAL`, `CHIKKU`, `SULTAN`, `MUEL`, `REGULAR`) remain unseeded pending explicit client sign-off. Rows in Excel imports referencing these values are flagged with `IM-001 [BLOCK]` or advisory warnings.

## 11. Future Work
- Upon client confirmation, seed `CHIKKU` and `SULTAN` as colors, `MUEL` as alias for `MULE`, and `REGULAR` under subcategories via an incremental Alembic migration.
- Add real-time client-side lookup validation badge in `AddProductDrawer.tsx`.

## 12. Related ADRs
- `ADR-0041`: Universal Catalog Master Value Governance
- `ADR-0042`: IM-001 Dynamic System Parameters and Fail-Closed Validation

## 13. Related RFCs
- `RFC-2026-CAT-01`: Standard Item Master v2.2 Attribute Promotion
