<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.92.3
  Created      : 2026-10-19
  Modified     : 2026-10-19
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Implementation Plan: Full Item Master Harmonization, Export Attribute Flattening & DB Studio Verification (v6.92.3)

## 1. Objective
Establish 100% data fidelity and referential integrity between the exported client item master workbook (`FullItemmaster.xlsx`) and the multi-tenant production environment (`https://tattlythreads.smritisys.com/`), remove duplicate generic export columns, eliminate all empty attribute blanks, and verify live database state via SMRITI Database Manager & Studio SQL queries.

## 2. Business Motivation
Exporting duplicate columns (`HEELS`, `UPPER MATERIAL`, `Attribute 3 (A3)`) created user confusion and degraded report clarity for client retail operations. Furthermore, missing attribute values in the export prevented automated procurement and inventory analytics. Harmonizing all fields and eliminating duplicates delivers a pristine, authoritative catalog suitable for statutory tax filing, physical stock audit, and automated order generation.

## 3. Scope
- Analysis and population of 15 yellow-highlighted missing attributes across all 1,284 products in `F:\Smriti-Clients Data\ItemmasterExported\FullItemmaster.xlsx`.
- Pruning 3 duplicate generic columns (`HEELS`, `UPPER MATERIAL`, `Attribute 3 (A3)`), standardizing the workbook on exactly 32 canonical columns.
- Updating `ItemDetailsGrid.tsx` to filter out legacy generic slots `["a1", "a2", "a3"]` and dynamically flatten first-class attributes from `p.attributes`.
- Registering missing client categories (`CHAPPAL`, `SANDAL`, `SHOE`, `OTHERS`, `Apparel`, `HALF SHOE`) in the authoritative control plane (`smritisys.master_values`) under Master Lookup type `category`.
- Synchronizing all 1,284 products on the remote database (`smriti001`) via `PUT /api/v1/inventory/{id}` and verifying zero blanks via the Database Manager & Studio SQL console.

## 4. Current State
- `FullItemmaster.xlsx` had 35 columns, thousands of blank cells, and 3 redundant columns at indices 32, 33, 34.
- Remote products had partial attribute symmetry (e.g. `outsole` populated but `outsole_material` absent on 28 products, `vendor_code` on column but absent from JSONB attributes on 531 products).
- Client category dimensions (`CHAPPAL`, `SANDAL`, etc.) were missing from `master_values` in `smritisys`, triggering IM-001 validation blocks during API updates.

## 5. Gap Analysis
- Gap 1: Duplicate generic alias columns in Excel caused by legacy fallback slots `a1`, `a2`, `a3`.
- Gap 2: Incomplete JSONB attribute symmetry between column definitions and dynamic JSONB attributes.
- Gap 3: Unseeded category dimensions in control plane master lookup.
- Gap 4: Direct SQL execution in Database Manager is strictly read-only, requiring updates through validated REST APIs.

## 6. Architecture Impact
- Reaffirms single source of truth for dimensional attributes: first-class dimensional fields take precedence over generic `a1-a9` fallback slots.
- Maintains strict read-only security boundary for SMRITI Database Manager & Studio (`POST /api/v1/database-manager/query`).
- Enforces IM-001 unified catalog dimension governance where every dimension value must be seeded in `smritisys.master_values`.

## 7. Proposed Design
1. Prune columns 33, 34, 35 from `FullItemmaster.xlsx` using `openpyxl`.
2. Populate missing fields using canonical style attributes and clear yellow fills.
3. Update `ItemDetailsGrid.tsx` export mapper to exclude `["a1", "a2", "a3"]` from `catalogFields`.
4. Register unseeded category values in `smritisys` via `POST /api/v1/lookup/category/values`.
5. Execute batch synchronization on remote products via `PUT /api/v1/inventory/{id}` with concurrency limits.
6. Verify live zero blanks using Database Manager SQL Console.

## 8. Files Created
- `scripts/remove_duplicate_columns_from_excel.py`
- `scripts/fix_full_itemmaster_excel.py`
- `scripts/compare_excel_to_remote.py`
- `scripts/analyze_exported_full_itemmaster.py`
- `scripts/harmonize_remote_product_attributes.py`

## 9. Files Modified
- `src/components/itemMaster/ItemDetailsGrid.tsx`
- `F:\Smriti-Clients Data\ItemmasterExported\FullItemmaster.xlsx`
- `CHANGELOG.md`
- `docs/walkthrough/README.md`

## 10. Dependencies
- `openpyxl` for Excel manipulation.
- `httpx` for async API requests.
- `psycopg2` / `asyncpg` for PostgreSQL connectivity.

## 11. Risks
- Risk: Overwriting client Excel file without backup.
  - Mitigation: Preserved original file as `FullItemmaster.backup.xlsx`.
- Risk: Product identity corruption during batch update.
  - Mitigation: Immutable fields (`code`, `barcode`, `sku`) excluded from PUT payloads to avoid identity conflict errors.

## 12. Rollback Strategy
- Restore `FullItemmaster.xlsx` from `FullItemmaster.backup.xlsx`.
- Revert `ItemDetailsGrid.tsx` changes via `git checkout`.

## 13. Verification Plan
- Automated column count and blank count audit on Excel workbook.
- Parity comparison script checking all 1,284 products between Excel and live server.
- Database Manager SQL console query validating 0 missing values across all governed fields.
- Full TypeScript type-check and Vite production build.

## 14. Test Plan
- Unit: Validate `toNum` conversion helper in `ItemDetailsGrid.tsx`.
- Integration: `compare_excel_to_remote.py` verifying 0 discrepancies.
- Live SQL: Query `smriti001.products` for null/blank counts across 21 fields.

## 15. Documentation Impact
- Updated `CHANGELOG.md` with version `6.92.3`.
- Created walkthrough `Catalog_Full_Item_Master_Harmonization_And_Studio_Verification_v6.92.3.md`.
- Appended walkthrough entry to `docs/walkthrough/README.md`.

## 16. Deployment Plan
- Code committed and pushed from `D:\Smriti_Retail_OS\apps\smriti_retail_os`.
- Pulled into test/production runtime.
- Client workbook delivered to business operations team.

## 17. Status
Completed

## 18. Related ADRs
- `ADR-004`: Dual-Plane SMRITI Control Plane (`smritisys`) vs Tenant Database (`smriti001`) Partitioning.
- `ADR-019`: IM-001 Unified Catalog Dimension Governance and Fail-Closed Validation.

## 19. Related Walkthroughs
- `Catalog_Full_Item_Master_Harmonization_And_Studio_Verification_v6.92.3.md`
- `Catalog_Live_Footwear_GST_Harmonization_v6.72.5.md`
- `Live_Tattly_Threads_Item_Master_Seeding_v6.72.3.md`
