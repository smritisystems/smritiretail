<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.70.50
  Created      : 2026-10-09
  Modified     : 2026-10-09
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Implementation Plan: Smart Import 504 Footwear Ingestion & Catalog Pagination Scaling v6.70.50

## 1. Objective
Ensure end-to-end relational ingestion, database persistence, and complete catalog visibility for 504 footwear variants across 36 distinct styles on local and live PostgreSQL databases, eliminating pagination truncation in the Article / Design Master UI.

## 2. Business Motivation
Footwear retailers manage high-density style-size matrices (typically 14 sizes/colors per style). Truncating catalog views at 200 items prevents merchandising managers from reviewing complete inventory lots, printing batch labels, or creating purchase orders for all styles.

## 3. Scope
- Backend FastAPI inventory query pagination upper bound expansion.
- Frontend initial system state catalog hydration scaling to 5,000 items.
- Full E2E parity verification across `items`, `item_variants`, `item_barcodes`, and `products` tables.

## 4. Current State
- Backend `inventory.py` restricted `page_size` with `le=500`.
- Frontend `App.tsx`, `PoGenerateTab.tsx`, and `PoSizewiseTab.tsx` hardcoded `page_size=200`.
- UI displayed "200 Articles Live" despite all 504 items existing in the database.

## 5. Gap Analysis
- Gap 1: Inability to fetch beyond 200 items in single-fold UI grids without pagination.
- Gap 2: Disconnect between user expectation ("504 imported items") and UI badge ("200 Articles Live").

## 6. Architecture Impact
- No breaking schema changes.
- Safe upper-bound scaling on `GET /api/v1/inventory/` endpoint to `le=5000`.
- Preserved PostgreSQL query performance with indexed lookup on `created_at` and `name`.

## 7. Proposed Design
- Expand `page_size: int = Query(25, ge=1, le=5000)` in `backend/app/api/v1/inventory.py`.
- Update `apiFetchV1` calls in `src/App.tsx`, `PoGenerateTab.tsx`, and `PoSizewiseTab.tsx` to request `page_size=5000`.

## 8. Files Created
- `scripts/verify_live_catalog.py`
- `docs/walkthrough/catalog/Catalog_Smart_Import_Pagination_And_Footwear_Ingestion_v6.70.50.md`
- `docs/implementation/catalog/Catalog_Smart_Import_Pagination_And_Footwear_Ingestion_Plan_v6.70.50.md`

## 9. Files Modified
- `backend/app/api/v1/inventory.py`
- `src/App.tsx`
- `src/components/purchase/PoGenerateTab.tsx`
- `src/components/purchase/PoSizewiseTab.tsx`
- `docs/walkthrough/README.md`
- `docs/implementation/README.md`
- `CHANGELOG.md`

## 10. Dependencies
- FastAPI 0.110+
- SQLAlchemy AsyncSession & PostgreSQL 15+
- React 18 + Vite 5

## 11. Risks
- Memory footprint increase in client browser for stores with > 10,000 articles. Mitigated by `le=5000` upper bound.

## 12. Rollback Strategy
- Revert `App.tsx` and `inventory.py` changes via Git commit revert if memory issues occur on low-spec mobile POS devices.

## 13. Verification Plan
- Automated SQL parity audit script (`scratch/run_audit.py`).
- Direct live HTTP API verification (`scripts/verify_live_catalog.py`).
- Playwright E2E UI verification.

## 14. Test Plan
- Run full Vitest regression suite (175 test files).
- Run production bundle build (`npm run build`).

## 15. Documentation Impact
- Updated Walkthrough Master Index (`docs/walkthrough/README.md`).
- Updated Implementation Plan Master Index (`docs/implementation/README.md`).
- Updated `CHANGELOG.md`.

## 16. Deployment Plan
- Push commit to `smritiNX`.
- Live server: `git pull origin smritiNX` and `docker compose up -d --build smriti-web` (and restart `smriti-api`).

## 17. Status
Completed

## 18. Related ADRs
- `ADR-CAT-081: Safe Upper-Bound Pagination Scaling`
- `ADR-CAT-082: Dual-Layer Ingestion Synchronization`

## 19. Related Walkthroughs
- `docs/walkthrough/catalog/Catalog_Smart_Import_Pagination_And_Footwear_Ingestion_v6.70.50.md`
