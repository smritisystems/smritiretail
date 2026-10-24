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
  Classification: Pricing Architecture & Bulk Workflow Walkthrough
-->

# Walkthrough: SMRITI Bulk Price Revision Studio Architecture (Phase 4)

## 1. Purpose
This document presents the complete end-to-end implementation and verification of the **SMRITI Bulk Price Revision Studio** workflow (`BulkPriceRevisionWorkflow.tsx`), providing enterprise merchandising and pricing operations teams with an interactive 4-step wizard to execute mass price adjustments across large item catalogs. The architecture guarantees strict statutory compliance (`Selling Price <= MRP`), wholesale distributor pricing rules (`Distributor Price <= Selling Price`), permanent Cost Price read-only protection, and zero database mutations during preview.

## 2. Scope
The scope of this implementation encompasses:
1. **Interactive 4-Step Merchandising Workflow:**
   - **Step 1 (Select Items):** Multi-facet filtering across Style Code, Article No, Brand, Category, Color, Size, Supplier, and Status, plus instant toggle to CSV/TSV import with header alias normalization and BOM stripping.
   - **Step 2 (Configure Revision):** Revision target checkboxes (Selling Price, MRP, Distributor Price editable; Cost Price permanently locked), method selector (Percentage 5% default increase, Amount, Fixed Price), effective date, and reason code.
   - **Step 3 (Preview & Validate):** Live comparison table detailing current vs. proposed prices, percentage/absolute deltas, status badges (`VALID`, `WARNING`, `ERROR`), search filter, rejected row export (`[Export Rejected Rows]`), and 50-row pagination. Zero database mutations occur in preview.
   - **Step 4 (Confirm & Submit):** Batch summary review with dual-action submission (`[Save as Draft]`, `[Submit for Approval]`).
2. **Backend API Contracts & Service Enhancements:**
   - Catalog filtering endpoints: `POST /api/v1/pricing/revisions/filter-items` and `GET /api/v1/pricing/revisions/filter-items`.
   - Batch creation enhancements in `PriceRevisionService` supporting `revised_distributor_price` and stripping `revised_cost_price`.
   - Invariant validation enforcing `Selling Price <= MRP` (`SMRITI-PRICE-001`) and `Distributor Price <= Selling Price` (`SMRITI-PRICE-002`).

## 3. Files Created
- `src/components/pricing/BulkPriceRevisionWorkflow.tsx`: 4-step Bulk Price Revision Studio wizard component containing pure calculation engines (`calculateProposedPrice`, `computeItemPreviewPrices`, `parseBulkPriceCsv`).
- `docs/implementation/pricing/Bulk_Price_Revision_Studio_v1.5.0.md`: Formal 19-section implementation plan.
- `docs/walkthrough/pricing/Bulk_Price_Revision_Studio_v1.5.0.md`: This 13-section walkthrough report.

## 4. Files Modified
- `backend/app/schemas/pricing.py`: Added `BulkItemFilterRequest`, `BulkItemCandidate`, `BulkItemFilterResponse`, alias normalization validator for `PriceRevisionBulkItem`, and distributor price response fields.
- `backend/app/services/price_revision_service.py`: Implemented `filter_bulk_items`, updated `create_revision` and `bulk_create_revisions` to capture distributor price in `metadata_json` and update `ItemPrice.wholesale_price` upon activation.
- `backend/app/api/v1/pricing.py`: Added `/revisions/filter-items` endpoints and resolved route shadowing.
- `src/components/pricing/PriceRevisionStudioWorkspace.tsx`: Mounted `BulkPriceRevisionWorkflow` in Tab 4 (`BULK`) and set it active by default.
- `src/tests/priceRevisionStudio.test.ts`: Expanded Vitest test suite with 16 comprehensive tests.
- `backend/tests/test_price_revisions.py`: Added 3 dedicated bulk test cases, passing 40/40 tests.
- `docs/walkthrough/README.md`: Master walkthrough index update.
- `docs/implementation/README.md`: Master implementation plan index update.

## 5. Architecture Decisions
1. **Cost Price Permanently Read-Only:**
   - *Rationale:* In Indian retail compliance and standard ERP accounting, Cost Price is strictly governed by Inward Purchase (GRN/Vendor Invoices) and moving average / FIFO valuation ledgers. Allowing pricing revisions to mutate Cost Price would compromise gross margin and inventory valuation integrity.
   - *Implementation:* Cost Price checkbox is permanently disabled in Step 2 with explicit tooltip explanation, stripped from write payloads in backend validators, and ignored with an advisory warning if present in CSV/TSV import files.
2. **Statutory Ceiling & Distributor Invariant Enforcement:**
   - *Statutory Ceiling:* Under Legal Metrology rules in India, no packaged commodity may be sold at a price exceeding its Maximum Retail Price (MRP). Enforced via database constraint `chk_ipr_sp_le_mrp`, service exception `SMRITI-PRICE-001`, and UI preview error flagging.
   - *Distributor Invariant:* A distributor (wholesale) price cannot exceed the retail selling price (`SMRITI-PRICE-002`), preventing commercial margin inversions.
3. **Pure Arithmetic Zero-Mutation Preview:**
   - *Rationale:* Generating live previews for 500+ items must never write staging rows into the database until the operator explicitly confirms Step 4. All preview logic is computed strictly client-side via `computeItemPreviewPrices` and `calculateProposedPrice`.
4. **Route Shadowing Resolution:**
   - *Issue:* In FastAPI, static route `/revisions/filter-items` was being shadowed by `/revisions/{revision_id}`, causing 404 errors when `{revision_id}` captured `"filter-items"`.
   - *Resolution:* Moved static filter endpoints ahead of parameterized detail routes.

## 6. Design Rationale
- **Default Configuration:** The default is configured to `Percentage (%)`, `Increase`, `5%` across both MRP and Selling Price, reflecting the most common annual or seasonal retail price revision requirement.
- **Header Alias Tolerance:** Real-world CSV/TSV exports from legacy POS or spreadsheets contain variable headers (`sp`, `revised_sp`, `selling_price`, `dp`, `distributor_price`, `mrp`, `new_mrp`). Both Pydantic model validators and TypeScript parsers normalize these aliases transparently.
- **BOM Stripping:** Microsoft Excel commonly prefixes CSV files with UTF-8 Byte Order Marks (`\uFEFF`). The parser strips this prefix cleanly to prevent identifier corruption on the first column.

## 7. Implementation Summary
```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                   BulkPriceRevisionWorkflow (4-Step Wizard)                 │
├─────────────────────────────────────────────────────────────────────────────┤
│ Step 1: Select Items                                                        │
│  - Multi-facet filters: Style, Article, Brand, Category, Color, Size, Status│
│  - Or toggle to CSV/TSV Import (BOM-safe, alias-aware, CP-warning)          │
├─────────────────────────────────────────────────────────────────────────────┤
│ Step 2: Configure Revision                                                  │
│  - Target Checkboxes: [x] Selling Price  [x] MRP  [ ] Dist Price  [🔒] Cost  │
│  - Method: Percentage (%) [Default: 5% Increase] | Amount | Fixed Price     │
│  - Direction: Increase / Decrease                                           │
│  - Effective Date & Reason Code                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│ Step 3: Preview & Validate (Zero DB Mutation)                               │
│  - Current vs Proposed prices (MRP, SP, DP, CP)                             │
│  - Deltas: Absolute (₹) and Percentage (%)                                  │
│  - Badges: VALID / WARNING (Below CP) / ERROR (SP > MRP, DP > SP)           │
│  - Interactive Search & Filter (All, Valid, Warning, Error)                 │
│  - Export: [Export Rejected Rows] CSV generator                             │
├─────────────────────────────────────────────────────────────────────────────┤
│ Step 4: Confirm & Submit                                                    │
│  - Summary KPI cards: Total, Valid, Warning, Error rows                     │
│  - Actions: [Save as Draft] | [Submit for Approval]                         │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 8. Tests Executed
1. **Frontend Tests (`src/tests/priceRevisionStudio.test.ts`):**
   - Routing invariant resolution (`mapModuleId`).
   - Pure delta and margin percentage calculations.
   - `calculateProposedPrice` 5% default increase, percentage decrease, amount adjustment, fixed price.
   - Non-negative price clamping and NaN fallback.
   - Valid revision preview calculations.
   - Statutory ceiling violation detection (`SMRITI-PRICE-001`).
   - Distributor price invariant violation detection (`SMRITI-PRICE-002`).
   - Commercial warning on pricing below Cost Price.
   - CSV header alias parsing and Cost Price exclusion advisory.
   - UTF-8 BOM stripping.
   - Tab-separated (TSV) clipboard paste parsing.
   - CSV row-level statutory error reporting.
2. **Backend Tests (`backend/tests/test_price_revisions.py`):**
   - `test_bulk_create_revisions_processing`: Basic bulk revision creation.
   - `test_bulk_create_revisions_distributor_price_and_cost_price_protection`: DP tracked, CP untouched.
   - `test_bulk_create_revisions_distributor_price_invariant_violation`: DP > SP rejected.
   - `test_bulk_filter_items_api_endpoint`: POST and GET catalog filter endpoints.
   - All 40 existing and new tests across temporal pricing, statutory invariants, and security boundaries.

## 9. Verification Results
```text
Implementation Status

✓ Code Complete
✓ Tests Passed (16/16 Vitest, 40/40 Pytest)
✓ Documentation Updated (Implementation Plan & Walkthrough)
✓ CHANGELOG Updated
✓ RELEASE_NOTES Updated
✓ Links Verified

Evidence Level: A
```
- **Vitest:** `16 passed (16)` in 3.92s.
- **Pytest:** `40 passed, 24 warnings in 41.24s`.
- **TypeScript:** `npx tsc --noEmit --skipLibCheck` exited 0.

## 10. Known Limitations
- Candidate item pagination in Step 1 is clamped to a maximum of 500 items per request to maintain sub-second response times on low-bandwidth POS connections.
- Bulk CSV import processes up to 1,000 rows per client session. Larger datasets should be imported via background data pipelines.

## 11. Future Work
- Add asynchronous background worker processing for bulk imports exceeding 10,000 items.
- Support Excel `.xlsx` binary workbook drag-and-drop in addition to CSV/TSV copy-paste.

## 12. Related ADRs
- `ADR-038`: Temporal Price Revision & Historical Snapshot Immutability.
- `ADR-042`: System Parameter Dual-Key Governance Architecture.

## 13. Related RFCs
- `RFC-019`: Enterprise Merchandising & Bulk Price Revision Workflows.
