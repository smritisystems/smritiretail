<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.73.5
  Created      : 2026-10-13
  Modified     : 2026-10-13
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Pricing Architecture & Bulk Workflow Implementation Plan
-->

# Implementation Plan: SMRITI Bulk Price Revision Studio Architecture (Phase 4)

## 1. Objective
Design, build, and verify the complete end-to-end **SMRITI Bulk Price Revision Studio** workflow (`BulkPriceRevisionWorkflow.tsx`) within the Price Revision Studio (`PriceRevisionStudioWorkspace.tsx`). The system empowers retail merchandising teams to execute mass price adjustments (Percentage, Amount, or Fixed Price) across hundreds or thousands of products via interactive multi-facet filtering or bulk CSV/TSV copy-paste intake, enforcing strict statutory invariants, distributor pricing rules, Cost Price read-only immutability, zero database mutation previewing, and atomic batch submission for approval or drafting.

## 2. Business Motivation
Large retail catalogs (e.g. footwear, apparel) require regular seasonal indexation, margin revisions, and promotional adjustments. Manually updating individual SKU prices is slow and prone to statutory violations (e.g., selling price exceeding legal MRP). Merchandisers need a high-velocity 4-step wizard that:
1. Filters items live across Style Code, Article No, Brand, Category, Color, Size, Supplier, and Status, or accepts bulk CSV/TSV spreadsheets.
2. Configures granular revisions targeting Selling Price, MRP, or Distributor Price while permanently protecting Cost Price from modification.
3. Previews deltas, margin percentages, and statutory checks with zero side-effects on live databases.
4. Atomically submits approved batches or saves drafts with audit lineage.

## 3. Scope
- **Backend Schemas & Validators (`backend/app/schemas/pricing.py`):**
  - Enhanced `PriceRevisionBulkItem` with alias normalization (`revised_sp`, `sp`, `selling_price` $\rightarrow$ `revised_selling_price`; `dp`, `distributor_price`, `wholesale_price` $\rightarrow$ `revised_distributor_price`; `mrp`, `new_mrp` $\rightarrow$ `revised_mrp`).
  - Strict stripping and exclusion of `revised_cost_price` to preserve inward cost integrity.
  - Added `BulkItemFilterRequest`, `BulkItemCandidate`, `BulkItemFilterResponse` with query/search alias normalization.
  - Extended `PriceRevisionResponse` and `PriceRevisionCreateRequest` with `previous_distributor_price` and `revised_distributor_price`.
- **Backend Service & REST Endpoints (`backend/app/services/price_revision_service.py`, `backend/app/api/v1/pricing.py`):**
  - Created `PriceRevisionService.filter_bulk_items` querying `Item`, `ItemVariant`, `ItemPrice`, `ItemBarcode` with subquery deduplication and multi-facet aggregations.
  - Registered `POST /api/v1/pricing/revisions/filter-items` and `GET /api/v1/pricing/revisions/filter-items` positioned before parameterized routes to avoid routing collisions.
  - Extended `create_revision` and `bulk_create_revisions` to capture distributor price in `metadata_json`, enforce DP $\le$ SP, and update `ItemPrice.wholesale_price` upon activation.
- **Frontend 4-Step Interactive Workflow (`src/components/pricing/BulkPriceRevisionWorkflow.tsx`):**
  - Step 1: Live faceted item selector with instant CSV/TSV clipboard toggle.
  - Step 2: Revision configuration defaulting to `Percentage (%)`, `Increase`, `5%`, with SP, MRP, DP selectable and CP permanently read-only.
  - Step 3: Interactive review grid with deltas, warning/error status badges, search, filter, rejected rows export (`[Export Rejected Rows]`), and pagination (50 rows/page).
  - Step 4: Submission buttons for `[Save as Draft]` and `[Submit for Approval]`.
- **Testing & Verification:**
  - 16/16 Vitest tests green (`src/tests/priceRevisionStudio.test.ts`).
  - 40/40 Pytest tests green (`backend/tests/test_price_revisions.py`).

## 4. Current State
Prior to this implementation:
- Price revisions supported single-item revision modal and basic single-item resolution.
- Tab 4 (`BULK`) in `PriceRevisionStudioWorkspace.tsx` was a placeholder with basic file upload controls.
- Backend lacked faceted candidate query endpoints for bulk catalog selection.
- Distributor price was not tracked in `item_price_revisions`.

## 5. Gap Analysis
1. **Catalog Candidate Discovery:** No tenant-scoped faceted endpoint existed to fetch items by style, article, brand, category, color, size, or supplier.
2. **Distributor Price Representation:** No schema support for Wholesale / Distributor Price revision in bulk imports.
3. **Statutory & Business Invariant Enforcement:** Bulk endpoints lacked automatic DP $\le$ SP validation and CSV alias normalization.
4. **Interactive 4-Step UI:** Merchandisers lacked the 4-step wizard UI matching the enterprise mockup specifications.

## 6. Architecture Impact
```text
React 18 Frontend Layer
  └── PriceRevisionStudioWorkspace.tsx (Tab 4: BULK)
        └── BulkPriceRevisionWorkflow.tsx
              ├── Step 1: Item Filter / CSV Import
              ├── Step 2: Configuration (5% Increase default, CP read-only)
              ├── Step 3: Read-Only Preview & Validation Grid
              └── Step 4: Atomic Batch Submission
                    ↓
FastAPI Transactional Backend Layer
  ├── POST /api/v1/pricing/revisions/filter-items
  ├── GET /api/v1/pricing/revisions/filter-items
  └── POST /api/v1/pricing/revisions/bulk
        ↓
PostgreSQL Storage Layer
  ├── item_price_revisions (metadata_json: DP tracked, SP <= MRP constraint)
  ├── item_prices (wholesale_price, selling_price, mrp updated on activation)
  └── items / item_variants (cost_price preserved and protected)
```

## 7. Proposed Design
1. **Cost Price Protection:**
   - CP is permanently disabled with tooltip: `"Cost Price is permanently read-only and governed strictly by Purchase/Inwarding GRN."`
   - Stripped from all JSON write payloads and CSV parsers.
2. **Statutory Ceiling & Distributor Invariants:**
   - Invariant 1: Proposed Selling Price $\le$ Proposed MRP (`SMRITI-PRICE-001`).
   - Invariant 2: Proposed Distributor Price $\le$ Proposed Selling Price (`SMRITI-PRICE-002`).
   - Advisory 1: Selling Price below Cost Price triggers a warning (`Commercial Warning`).
3. **Pure Arithmetic Engine:**
   - `calculateProposedPrice`: handles Percentage, Amount, and Fixed Price with 2-decimal rounding.
   - `computeItemPreviewPrices`: pure preview calculation with zero DB mutations.
   - `parseBulkPriceCsv`: strips UTF-8 BOM, parses TSV and CSV, normalizes header aliases, and flags errors.

## 8. Files Created
1. `src/components/pricing/BulkPriceRevisionWorkflow.tsx`: Full-featured 4-step Bulk Price Revision Studio workflow component.
2. `docs/implementation/pricing/Bulk_Price_Revision_Studio_v1.5.0.md`: This 19-section implementation plan.
3. `docs/walkthrough/pricing/Bulk_Price_Revision_Studio_v1.5.0.md`: Formal 13-section walkthrough document.

## 9. Files Modified
1. `backend/app/schemas/pricing.py`: Added bulk filter schemas, alias validator on `PriceRevisionBulkItem`, and DP fields.
2. `backend/app/services/price_revision_service.py`: Added `filter_bulk_items`, updated `create_revision` and `bulk_create_revisions`.
3. `backend/app/api/v1/pricing.py`: Registered `/revisions/filter-items` routes before parameterized routes.
4. `src/components/pricing/PriceRevisionStudioWorkspace.tsx`: Mounted `BulkPriceRevisionWorkflow` in Tab 4.
5. `src/tests/priceRevisionStudio.test.ts`: Expanded Vitest test suite to 16 unit and invariant tests.
6. `backend/tests/test_price_revisions.py`: Added 3 dedicated bulk test cases, total 40 tests green.
7. `docs/walkthrough/README.md`: Master index update.
8. `docs/implementation/README.md`: Master index update.

## 10. Dependencies
- FastAPI 0.111+
- SQLAlchemy 2.0+ (asyncpg)
- Pydantic v2
- React 18 & Lucide React
- Vitest 4.1+ & Pytest 8.2+

## 11. Risks
- **High-volume queries:** Multi-facet queries on large catalogs could encounter query latency.
  *Mitigation:* Clamped queries to `limit=500` max (default 50), added index-friendly `base_conditions`, and grouped barcodes via subquery.
- **Routing collisions:** `/revisions/{revision_id}` shadowing `/revisions/filter-items`.
  *Mitigation:* Explicitly declared static filter endpoints before parameterized `{revision_id}` endpoint.

## 12. Rollback Strategy
- The implementation is purely additive to existing APIs and DB schemas.
- In the event of rollback, revert frontend component to previous tab stub and remove `/revisions/filter-items` route declarations without altering existing core revision tables.

## 13. Verification Plan
- Unit tests verifying pure calculation engines and CSV parser.
- Integration tests verifying FastAPI endpoints with auth tokens.
- TypeScript compiler verification with zero errors.
- Schema invariant verification ensuring CP immutability.

## 14. Test Plan
- **Frontend (Vitest):**
  - `calculateProposedPrice`: 5% increase, percentage decrease, amount add/sub, fixed price.
  - `computeItemPreviewPrices`: valid delta calculation, SP > MRP violation, DP > SP violation, below-cost warning.
  - `parseBulkPriceCsv`: alias mapping, BOM stripping, TSV handling, CP exclusion warning.
- **Backend (Pytest):**
  - `test_bulk_create_revisions_processing`: basic SKU/Barcode revision creation.
  - `test_bulk_create_revisions_distributor_price_and_cost_price_protection`: DP tracked, CP untouched.
  - `test_bulk_create_revisions_distributor_price_invariant_violation`: DP > SP rejected.
  - `test_bulk_filter_items_api_endpoint`: POST and GET filter candidate items.

## 15. Documentation Impact
- Updated `docs/walkthrough/pricing/Bulk_Price_Revision_Studio_v1.5.0.md`.
- Updated master indices in `docs/walkthrough/README.md` and `docs/implementation/README.md`.
- Updated `RELEASE_NOTES.md` and `CHANGELOG.md`.

## 16. Deployment Plan
1. Commit code to `smritiNX` branch.
2. Run standard pre-flight CI checks (`npx tsc --noEmit`, `vitest run`, `pytest`).
3. Deploy frontend bundle and restart backend service in test environment.

## 17. Status
**Completed** — Fully implemented, tested, and certified.

## 18. Related ADRs
- `ADR-042`: System Parameter Dual-Key Governance Architecture.
- `ADR-038`: Temporal Price Revision & Historical Snapshot Immutability.

## 19. Related Walkthroughs
- `docs/walkthrough/pricing/Bulk_Price_Revision_Studio_v1.5.0.md`
- `docs/walkthrough/pricing/Price_Revision_Menu_Registry_And_Connected_UX_v1.4.0.md`
