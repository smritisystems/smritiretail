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

# Implementation Plan: Unified IM-001 Catalog Governance Across All Surfaces (v6.48.0)

## 1. Objective
Unify catalog item validation across all creation and import surfaces (`AddProductDrawer.tsx` / `POST /api/v1/inventory/`, `UniversalItemMasterService.create_item`, `POST /api/v1/universal/preview`, and `POST /api/v1/universal/commit`) under a single authoritative, fail-closed validator (`IM001ControlledFieldValidator` in `app.services.catalog_validation`). Seed authoritative master types and approved values for footwear dimensions (`heel_type`, `upper_material`, `product_type`, `gender`, `design_attribute`, `outsole_material`, `collection_type`, `color`, `uom`, `gst_rate`) per v2.2 standard, dynamic spreadsheet loading of mandatory classification, and fail-closed enforcement.

## 2. Business Motivation
Previously, item validation was fragmented:
- `AddProductDrawer.tsx` called `POST /api/v1/inventory/` which validated only 6 legacy dimensions and was unaware of promoted footwear dimensions (`heel_type`, `upper_material`, `product_type`, `gender`).
- Universal Import had an inline implementation of IM-001 with custom extraction maps.
- Master lookup values for heel types, upper materials, and product types were partially unseeded, causing silent drift or bypass.
By consolidating validation into one single shared validator and seeding canonical values, we guarantee 100% catalog integrity and zero phantom bypass across manual creation, bulk Excel import, and API integrations.

## 3. Scope
1. **Validator Extraction:** Extract and centralize `IM001ControlledFieldValidator` into `backend/app/services/catalog_validation.py`.
2. **Master Types & Values Seeding:** Alembic migration `v1506` seeding all approved values from the v2.2 standard validation lists plus client-onboarded values (`BRONZE`, `GUNMETAL`, `MUSTARD`, `PEACH`, `ROSE`, `TOUPE`, `ROSE GOLD`, `CUBE HEEL`, `BIG PLATFORM`, `LYCRA`, `HALF SHOE`, `COMFORT`), while explicitly excluding unconfirmed values (`MATERIAL`, `CHIKKU`, `SULTAN`, `MUEL`, `REGULAR`).
3. **Dynamic Mandatory Classification:** Load mandatory Y/N classification dynamically from `"From System Master Lookup"` sheet in `SMRITI_Item_Master_Creation_Standard_v2.2.xlsx`. Enforce strict `BLOCK` on `GENDER`, `MERCHANDISE_CATEGORY`, `PRODUCT_TYPE`, `HEEL_TYPE`, `UPPER_MATERIAL`, `BRAND_NAME`, `COLOR`, `SIZE`, `ARTICLE_STYLE_CODE`, `MERCHANDISE_DEPARTMENT`, `UOM`, `HSN_CODE`, `GST_RATE_PERCENT`.
4. **Surface Re-routing & Wire-up:**
   - `AddProductDrawer.tsx` / `POST /api/v1/inventory/` validates IM-001 first via `IM001ControlledFieldValidator.validate_dict()`.
   - `UniversalItemMasterService.create_item` validates IM-001.
   - `universal_import.py` preview and commit use `IM001ControlledFieldValidator`.
5. **Fail-Closed Guarantee:** Unseeded mandatory dimensions or DB errors result in explicit `IM-001-UNSEEDED [BLOCK]` errors rather than silent skips or bypasses.

## 4. Current State
- `universal_import.py` previously contained an inlined validator class.
- `POST /api/v1/inventory/` bypassed `heel_type`, `upper_material`, `product_type`, and `gender` master lookup checks.
- Several client onboarding footwear dimensions (`CUBE HEEL`, `BIG PLATFORM`, `LYCRA`, `HALF SHOE`) were absent from `master_values`.
- Missing dynamic alias fallback for `style_no` vs `style` in `AttributesService.validate_product_attributes`.

## 5. Gap Analysis
| Surface | Prior State | Target State (v6.48.0) |
|---|---|---|
| `AddProductDrawer.tsx` / `POST /api/v1/inventory/` | Only validated 6 dimensions; ignored `heel_type`, `upper_material`, etc. | Validates all IM-001 dimensions via unified validator; HTTP 422 block on invalid values |
| `UniversalItemMasterService.create_item` | Did not enforce IM-001 before entity allocation | Validates IM-001 before allocating internal technical ID or inserting records |
| Universal Import Preview & Commit | Inlined duplicate validator class in route file | Imported from `app.services.catalog_validation`, exact parity across preview & commit |
| Master Types & Values | Incomplete seeding for footwear dimensions | Alembic `v1506` seeds 11 master types and 147 approved values across all tenant DBs |

## 6. Architecture Impact
- Re-routed all catalog writes through single gateway validator `IM001ControlledFieldValidator`.
- Unified schema in `ProductBase` (`schemas/inventory.py`) carrying `gender`, `product_type`, `heel_type`, `upper_material`, `design_attribute`, `outsole_material`, `collection_type`.
- Linear Alembic lineage converging at single head `v1506 (head)`.

## 7. Proposed Design
1. `IM001ControlledFieldValidator` in `app/services/catalog_validation.py` provides:
   - `load_system_master_lookup_registry(workbook_path)`: dynamic sheet parser with cache.
   - `validate_batch_controlled_fields(rows, company_id)`: O(14) pre-query batch validator.
   - `validate_row_controlled_fields(row, row_num, company_id)`: single-row wrapper.
   - `validate_dict(payload, company_id, strict)`: API payload dictionary validator raising HTTP 422 with `SMRITI-VAL-002`.
2. UI Step 1 in `AddProductDrawer.tsx` renders 3-column selects for `product_type`, `heel_type`, and `upper_material` populated from `/api/v1/masters/lookup/{dimension}/values`.

## 8. Files Created
- `backend/alembic/versions/v1506_seed_v22_item_governance_masters.py`
- `backend/tests/test_unified_im001_governance.py`
- `docs/implementation/inventory/Unified_IM001_Catalog_Governance_Across_All_Surfaces_v6.48.0.md`
- `docs/walkthrough/catalog/Catalog_Unified_IM001_Governance_Across_All_Surfaces_v6.48.0.md`

## 9. Files Modified
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

## 10. Dependencies
- PostgreSQL 15+
- Python 3.11+
- openpyxl (workbook sheet extraction)
- Alembic 1.13+

## 11. Risks
- *Risk:* Performance impact during bulk import if master values are queried per-row.
  *Mitigation:* `validate_batch_controlled_fields` pre-loads all master values across dimensions in O(14) database queries, validating all rows in-memory.
- *Risk:* Strict blocking might stop operations on client-specific abbreviations.
  *Mitigation:* Intelligent singular/plural and prefix/suffix near-match matching with architectural advisory feedback.

## 12. Rollback Strategy
Alembic downgrade: `alembic downgrade v1505`. Code changes can be rolled back via `git revert`.

## 13. Verification Plan
- Negative tests: Attempt item creation with invalid `heel_type='INVALID_HEEL'` and `upper_material='INVALID_MATERIAL_UNKNOWN'`. Verify HTTP 422 BLOCK.
- Positive tests: Create item with newly onboarded values (`CUBE HEEL`, `LYCRA`, `HALF SHOE`, `BRONZE`). Verify HTTP 201 Created.
- Dynamic sheet verification: Verify `From System Master Lookup` registry returns `True` for mandatory dimensions.
- Universal import preview & commit: Execute preview and commit on Tattly `NEW` sheet.
- Single Alembic head verification: Verify `alembic heads` outputs exactly `v1506 (head)`.

## 14. Test Plan
Automated test suite `backend/tests/test_unified_im001_governance.py` executing 6 end-to-end tests via `pytest`.

## 15. Documentation Impact
- Updated Walkthrough Master Index (`docs/walkthrough/README.md`).
- Updated Implementation Master Index (`docs/implementation/README.md`).
- Updated `CHANGELOG.md`.

## 16. Deployment Plan
1. Pull branch `smritiNX`.
2. Run `docker exec smriti-api python -m app.db.bootstrap_engine` to apply migration `v1506` across control and tenant databases.
3. Build frontend assets: `npm run build`.

## 17. Status
Completed

## 18. Related ADRs
- `ADR-0041`: Universal Catalog Master Value Governance
- `ADR-0042`: IM-001 Dynamic System Parameters and Fail-Closed Validation

## 19. Related Walkthroughs
- `docs/walkthrough/catalog/Catalog_Unified_IM001_Governance_Across_All_Surfaces_v6.48.0.md`
