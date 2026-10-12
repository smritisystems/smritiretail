<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.72.3
  Created      : 2026-10-12
  Modified     : 2026-10-12
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Implementation Plan: Live Tattly Threads Item Master Seeding & Multy Exclusion v6.72.3

## 1. Objective
Seed 602 validated footwear catalog items across 52 distinct styles into the live production environment (`https://tattlythreads.smritisys.com/`) from `OLD TO NEW (1).xlsx`, while strictly excluding all variants designated with color `MULTY` / `MULTI` (168 rows from Sheet2), ensuring zero validation errors, full master dimension lookup alignment, and 100% database persistence parity.

## 2. Business Motivation
The live Tattly Threads instance required an authoritative item master ingestion for newly mapped inventory. The source workbook contained 770 records; however, the retail merchandising team mandated the exclusion of unsegmented multi-color items (`Sheet2`), focusing exclusively on solid color variants across `Sheet1` (154 items) and `021026` (448 items). Automated, validated ingestion eliminates manual entry errors and establishes complete SKU/barcode integrity for store billing and purchasing.

## 3. Scope
- Source dataset: `F:\Smriti-Clients Data\Tattly Threads\ItemMaster\OLD TO NEW (1).xlsx`.
- Normalization and dimension mapping for Category, Subcategory, Heel Type, Upper Material, Outsole Material, Brand, and Supplier.
- Target environment: Live production instance `https://tattlythreads.smritisys.com/` (`COMP-001`).
- Endpoint pipeline: `/api/v1/universal-import/preview` followed by chunked batch `/api/v1/universal-import/commit`.
- Complete verification of database counts and styles via `/api/v1/universal/items`.

## 4. Current State
- Prior to seeding, the live production database had 38 styles and 534 barcodes.
- Certain master dimension lookup values (`OTHERS`, `HALF SHOE`, `MULE`, `MULTY`, `L-GREEN`, `L-BLUE`, `OFF WHITE`) and in-house supplier `TT` (`Tattly Threads In-House`) were unseeded in company `COMP-001`, which would cause IM-001 validation rejections during bulk commit.

## 5. Gap Analysis
- Gap 1: In-house supplier `TT` was unmapped in the control plane `suppliers` table for `COMP-001`.
- Gap 2: Specific lookup dimension values used in the client workbook were missing from `master_values`.
- Gap 3: Source workbook contained 168 rows with color `MULTY` that had to be programmatically filtered out prior to staging.

## 6. Architecture Impact
- Enforces SMRITI IM-001 two-tier validation governance without relaxing constraints.
- Creates master lookup values via canonical control plane endpoints (`POST /api/v1/masters/lookup/{type}/values`).
- Registers supplier `TT` via canonical supplier management API (`POST /api/v1/suppliers/`).
- Commits normalized variants in bounded batches of 150 items to prevent gateway timeouts.

## 7. Proposed Design
- Implement an automated async pipeline (`scripts/seed_live_tattlythreads_items.py`) executing:
  1. Data ingestion from Excel, filtering out `MULTY` variants.
  2. Master lookup & supplier pre-registration on the live server.
  3. Pre-commit dry-run preview verification (`/api/v1/universal-import/preview`).
  4. Chunked sequential commit (`/api/v1/universal-import/commit`) across 5 batches.
  5. Post-commit paginated verification of live catalog items.

## 8. Files Created
- `scripts/seed_live_tattlythreads_items.py` — Automated client-side seeding and live verification script.
- `docs/walkthrough/catalog/Live_Tattly_Threads_Item_Master_Seeding_v6.72.3.md` — Canonical walkthrough report.
- `docs/implementation/catalog/Live_Tattly_Threads_Item_Master_Seeding_Plan_v6.72.3.md` — This implementation plan.

## 9. Files Modified
- `docs/walkthrough/README.md` — Updated master walkthrough index.
- `docs/implementation/README.md` — Updated master implementation plan index.
- `CHANGELOG.md` — Updated repository changelog for release v6.72.3.

## 10. Dependencies
- Python 3.10+ with `httpx` and `openpyxl`.
- Live SMRITI API running at `https://tattlythreads.smritisys.com/`.

## 11. Risks
- Risk: Rejection of unmapped lookups causing batch abortion.
  - Mitigation: Registered all candidate dimension values (`OTHERS`, `MULE`, etc.) prior to running preview.
- Risk: Duplicate barcode collisions against existing live items.
  - Mitigation: Pre-import preview returned 0 blocking errors and 0 barcode collisions.

## 12. Rollback Strategy
- Transactional rollback on preview failure; if needed, newly added styles (`8909087900001` through `8909087900770`) can be queried and soft-deleted via canonical item lifecycle APIs.

## 13. Verification Plan
- Preview check: Verify 602 valid rows, 0 blocking errors, and `READY_FOR_IMPORT` status.
- Batch commit verification: Verify all 5 commit batches return HTTP 200 with 602 total created rows.
- Post-commit query: Query `/api/v1/universal/items` on the live server and assert styles increased from 38 to 90 (+52) and barcodes increased from 534 to 1,136 (+602).
- Multy exclusion verification: Assert 0 barcodes with color `MULTY` exist in the newly imported batch.

## 14. Test Plan
- Run automated read-only verification query against `https://tattlythreads.smritisys.com/api/v1/universal/items`.
- Confirm 1,136 total barcodes, 90 styles, and 0 `MULTY` barcodes in `8909087900*`.

## 15. Documentation Impact
- Update `docs/implementation/README.md`.
- Update `docs/walkthrough/README.md`.
- Update `CHANGELOG.md`.

## 16. Deployment Plan
- Script executed directly against live production server `https://tattlythreads.smritisys.com/`.
- Code changes and governance records committed and pushed to `origin/smritiNX`.

## 17. Status
Completed

## 18. Related ADRs
- `ADR-CAT-001`: IM-001 Two-Tier Validation Governance and Master Lookup Standards.
- `ADR-CAT-081`: Safe Upper-Bound Pagination Scaling.

## 19. Related Walkthroughs
- `docs/walkthrough/catalog/Live_Tattly_Threads_Item_Master_Seeding_v6.72.3.md`
- `docs/walkthrough/catalog/Catalog_Smart_Import_Pagination_And_Footwear_Ingestion_v6.70.50.md`
