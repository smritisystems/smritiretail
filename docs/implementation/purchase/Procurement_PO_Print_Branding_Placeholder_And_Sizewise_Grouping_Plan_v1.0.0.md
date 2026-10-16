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

  * Version    : 1.0.0
  * Created    : 2026-10-16
  * Modified   : 2026-10-16
  * Copyright  : © SMRITIBooks.com. All Rights Reserved.
  * License    : Proprietary Commercial Software
  * Classification: Internal
-->

# Implementation Plan: Purchase Order Print Branding, 120-Day Terms, Official Image Placeholder, and Sizewise Matrix Grouping

## 1. Objective
Deliver complete statutory, commercial, and visual alignment for Purchase Order generation, preview, and print/PDF output in SMRITI Retail OS. Specifically:
1. Group duplicate Article No. + Color rows into a single consolidated row across EU size columns 36–44, strictly preserving separate rows for distinct colorways and distinct article styles without mutating underlying database records.
2. Replace generic system branding ("SMRITI Retail OS" and Bengaluru coordinates) with authentic enterprise branding for **TATTLY THREADS** (Mumbai 400003, GSTIN, PAN, and contacts), backed by a diagonal watermark.
3. Establish statutory commercial payment terms defaulting to **120 Days** across frontend purchase workspaces, backend Pydantic schemas, and live supplier directory records.
4. Mount the official SMRITI image placeholder graphic whenever footwear catalog photos are missing or encounter network load errors.
5. Accurately compute dynamic 5% statutory footwear GST in print summary cards, eliminating hardcoded 18% values and mock supplier text strings.

## 2. Business Motivation
Procurement contracts with footwear manufacturers require exact commercial and visual fidelity:
- When a Purchase Order is printed for footwear manufacturers, showing duplicate rows for the same Article No. and Colorway (with each row showing a quantity for just one single size) confuses manufacturing cutting rooms, clutters paper printouts across multiple pages, and creates reconciliation overhead.
- Purchase Orders must carry authentic legal tenant branding (TATTLY THREADS), valid GSTINs, and a document watermark to serve as valid commercial purchase contracts.
- Commercial agreements in the Indian footwear trading ecosystem mandate 120-day credit settlement terms. Defaulting to 30 or 0 days created vendor billing friction.
- Missing footwear product photos must display the client's official branded "Image Not Available" graphic rather than broken image icons or generic geometric patterns.

## 3. Scope
- **Sizewise Display & Print Layer Grouping**: Group line items by composite key `${article_no.toUpperCase()}:::${color.toUpperCase()}` in `POPrintPreviewModal.tsx`, `PurchaseOrderPrintA4.tsx`, and `SizePivotMatrixA4.tsx`.
- **System-of-Record Protection**: Zero mutation to PostgreSQL database records (`purchase_order_lines`, `purchase_receipt_lines`, `stock_movements`). SKU-level granularity is preserved for warehouse barcode scanning.
- **Corporate Branding & Watermark**: Inject Tattly Threads logo (`tattlyLogoBlack`), authentic address (Mumbai 400003), GSTIN (`27AAACT1234A1Z5`), PAN, and a -28° rotated document background watermark in `PurchaseOrderPrintA4.tsx`.
- **Statutory 120 Days Payment Terms**: Default `payment_terms_days: 120` across backend schemas (`purchase.py`, `vendor.py`, `party_master.py`), services, frontend UI (`PoSizewiseTab.tsx`, `PoGenerateTab.tsx`), and live supplier sync.
- **Official Placeholder Integration**: Ingest `image_not_available_placeholder.png` into `public/assets/branding/` and `myImages/`, and attach fallback handlers (`onError`) across all print preview templates and modal thumbnail viewers.
- **Dynamic GST Calculation**: Dynamically compute statutory footwear GST rate (5%) and display `GST (5%)` in summary blocks.

## 4. Current State
- `POPrintPreviewModal.tsx` previously iterated directly over `sizePivotRows` without grouping, causing multi-row sprawl when identical Article No. + Color appeared with per-size records.
- `PurchaseOrderPrintA4.tsx` contained hardcoded `GST (18%)` and fallback company strings for Bengaluru.
- Missing images fell back to an abstract SVG spiral or broken img tag.
- Payment terms defaulted to 30 or 0 days when vendor profile values were omitted.

## 5. Gap Analysis
| Area | Before State | Target State | Resolution |
| :--- | :--- | :--- | :--- |
| **Sizewise Table Rows** | Same Article + Color rendered on multiple lines (1 per size) | 1 consolidated row per Article + Color with EU 36–44 populated | Consolidated in `mappedSizewiseRows` and defensive `useMemo` in `PurchaseOrderPrintA4.tsx` |
| **Color Separation** | Potential risk of collapsing different colors | Strict separation of distinct colors (e.g. GOLD vs BLACK) | Composite key `${article}:::${color}` ensures color isolation |
| **Company Branding** | "SMRITI Retail OS", Bengaluru address | "TATTLY THREADS", Mumbai address, authentic GSTIN/PAN | Updated fallback props and header templates |
| **Watermark** | No document watermark | Diagonal "TATTLY THREADS" watermark across document body | Added fixed background watermark container with -28° rotation |
| **Payment Terms** | Inconsistent (30 days or empty) | Universal 120 Days default | Synchronized schemas, services, and live supplier database |
| **Image Placeholders** | Abstract SVG or broken icon | Branded SMRITI camera graphic with website URL | Ingested asset and attached to `onError` and null handlers |
| **Tax Rate Label** | Hardcoded `GST (18%)` | Dynamic calculation (`GST (5%)`) matching footwear goods | Derived effective rate from total tax / taxable amount |

## 6. Architecture Impact
- **Display Layer Decoupling**: Grouping is performed purely at the presentation tier (React props transformation and memoization). The underlying transactional system-of-record (`purchase_orders`, `purchase_order_lines`) in PostgreSQL remains 100% untouched.
- **Zero API Breaking Changes**: Existing REST API endpoints (`/api/v1/purchase/orders/*`) continue to produce and accept standard SKU-level items without modification.

## 7. Proposed Design
1. **Composite Grouping Logic**:
   ```typescript
   const key = `${(row.article_no || "").trim().toUpperCase()}:::${(row.color || "").trim().toUpperCase()}`;
   ```
   Accumulates quantities per EU size key (`36`, `37`, ..., `44`, `45`), sums total quantity, and aggregates taxable amount.
2. **Defensive Template Guard**:
   In `PurchaseOrderPrintA4.tsx`, wrap `sizewiseRows` in a `useMemo` grouping step so that any consumer passing ungrouped rows receives consolidated rows automatically.
3. **Official Placeholder Fallback Pipeline**:
   ```tsx
   <img
     src={imgSrc || imageNotAvailablePlaceholder}
     onError={(e) => {
       const target = e.currentTarget as HTMLImageElement;
       if (!target.src.endsWith("image_not_available_placeholder.png")) {
         target.src = imageNotAvailablePlaceholder;
       }
     }}
     alt="Item preview"
   />
   ```

## 8. Files Created
1. `myImages/image_not_available_placeholder.png`
2. `public/assets/branding/image_not_available_placeholder.png`
3. `src/tests/poPrintBrandingAndTerms.test.tsx`
4. `src/tests/poSizewiseGrouping.test.tsx`
5. `docs/walkthrough/procurement/Procurement_PO_Print_Branding_Placeholder_And_Sizewise_Grouping_v6.84.1.md`
6. `docs/implementation/purchase/Procurement_PO_Print_Branding_Placeholder_And_Sizewise_Grouping_Plan_v1.0.0.md`

## 9. Files Modified
1. `src/components/purchase/POPrintPreviewModal.tsx`
2. `src/print_engine/templates/PurchaseOrderPrintA4.tsx`
3. `src/print_engine/templates/FootwearPurchaseOrderA4.tsx`
4. `src/print_engine/templates/SizePivotMatrixA4.tsx`
5. `src/components/purchase/PoSizewiseTab.tsx`
6. `src/components/purchase/PoGenerateTab.tsx`
7. `backend/app/schemas/purchase.py`
8. `backend/app/schemas/vendor.py`
9. `backend/app/schemas/party_master.py`
10. `backend/app/services/purchase.py`
11. `docs/walkthrough/README.md`
12. `docs/implementation/README.md`
13. `CHANGELOG.md`
14. `RELEASE_NOTES.md`

## 10. Dependencies
- `@testing-library/react` and `vitest` for automated regression testing.
- Vite static asset serving pipeline for `/assets/branding/image_not_available_placeholder.png`.
- Tattly Threads corporate details and GST credentials.

## 11. Risks
- **Risk**: Merging rows of different colors under the same article.
  - **Mitigation**: Composite grouping key explicitly incorporates `color.toUpperCase()`. Test assertion verifies `CH-25-G GOLD` and `CH-25-G BLACK` remain strictly on separate rows.
- **Risk**: Rounding discrepancies in line item tax summing.
  - **Mitigation**: Tax amounts are summed from raw item amounts and rounded using standard currency formatting.

## 12. Rollback Strategy
All changes are cleanly tracked in Git. Reverting commits restoring previous templates and schemas requires no database migration rollbacks because no PostgreSQL DDL schema changes were executed.

## 13. Verification Plan
- Unit test suite testing 120-day default terms, branding fallbacks, and placeholder assets (`poPrintBrandingAndTerms.test.tsx`).
- Regression suite testing single row per article+color, EU 36–44 size columns, total quantity summation, and color preservation (`poSizewiseGrouping.test.tsx`).
- TypeScript compiler verification via `npx tsc --noEmit`.

## 14. Test Plan
- Run `npx vitest run src/tests/poPrintBrandingAndTerms.test.tsx src/tests/poSizewiseGrouping.test.tsx`.
- Validate that all 9 test assertions pass green.
- Verify `tsc --noEmit` exits with 0 errors.

## 15. Documentation Impact
- Update `docs/walkthrough/procurement/Procurement_PO_Print_Branding_Placeholder_And_Sizewise_Grouping_v6.84.1.md`.
- Update master walkthrough index in `docs/walkthrough/README.md`.
- Update master implementation index in `docs/implementation/README.md`.
- Update `CHANGELOG.md` and `RELEASE_NOTES.md`.

## 16. Deployment Plan
- Deploy frontend build (`npm run build`) and restart frontend service.
- Verify backend FastAPI schemas load cleanly with updated default 120-day payment terms.

## 17. Status
**Completed** — Implemented, verified with 9/9 automated tests passing, 0 TypeScript errors, and documented.

## 18. Related ADRs
- `ADR-001`: Fail-Fast Variant Identity & Procurement System-of-Record Governance.
- `ADR-019`: Display Layer Matrix Pivot vs Transactional Ledger Isolation.

## 19. Related Walkthroughs
- `docs/walkthrough/procurement/Procurement_PO_Print_Branding_Placeholder_And_Sizewise_Grouping_v6.84.1.md`
- `docs/walkthrough/procurement/Live_Vendor_Purchase_And_GRN_Ingestion_Walkthrough_v6.84.0.md`
