<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 1.0.0
  Created      : 2026-09-30
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough: Purchase Studio Phase 5 — Multi-Image Batch Drag-and-Drop with Automatic Filename-to-Article/Color Binding

**Status:** Completed  
**Version:** 1.0.0  
**Date:** 2026-09-30  
**Capability:** `@SmritiCapability("PURCHASE", "PO_SIZEWISE_ENTRY")`  
**Area:** Purchase / Procurement  

---

## 1. Purpose
Wholesale footwear and apparel merchants receive dozens of product sample photographs from factories, design studios, and vendor WhatsApp catalogs prior to placing purchase orders. Manually uploading each image row-by-row into a 20-line purchase order is time-consuming and error-prone.

Phase 5 introduces high-efficiency bulk ingestion: merchants can drag-and-drop or batch-select 10–50+ sample photos directly onto the Purchase Studio Lookbook tab. The heuristic matching engine automatically analyzes each photo's filename (e.g. `FW-NK-9921_Tan.jpg`, `OXF-990-Rustic Black.png`, `SND-10001 Cherry Red.jpeg`) to bind it to the correct PO line item and colorway, converts every photo to optimized WebP format via the SPIF backend (`POST /api/v1/inventory/upload-image`), and binds the permanent image URLs to both the live Lookbook cards and the landscape statutory print engine in a single click.

---

## 2. Scope
1. **Pure Filename Matching Heuristics (`matchImageFilenameToLines`):**
   - 3-pass heuristic engine analyzing raw file base names against PO line attributes.
   - Pass 1: Exact composite match (Article/ItemCode + Shade/Colorway) with confidence `"exact_composite"`.
   - Pass 2: Article/ItemCode match with confidence `"article_only"`.
   - Pass 3: Distinctive Colorway match with confidence `"color_only"`.
   - Pass 4: Safe non-breaking fallback to the first active PO line with confidence `"none"`.
2. **Visual Lookbook Dropzone & Frosted Overlay:**
   - Drop events attached to the dedicated `2. Images & Articles` container (`#sw-visual-lookbook-dropzone`).
   - Frosted backdrop overlay with upload icon and real-time guidance when files are dragged over the container.
3. **Batch Review & Auto-Binding Modal Dialog (`#sw-batch-upload-modal-dialog`):**
   - Interactive table listing thumbnail previews, file sizes, match confidence tags, target PO line selector dropdowns, and status indicators.
   - Allows buyers to manually reassign or override target lines prior to upload execution.
4. **Concurrent SPIF WebP Upload Pipeline:**
   - Asynchronous queue with concurrency limiter (pool size: 3) converting local files to base64 Data URLs and uploading to `POST /api/v1/inventory/upload-image`.
   - Live progress bar tracking batch completion percentage.
   - Automatic fallback to local Data URL storage in offline or error scenarios.

---

## 3. Files Created
1. `docs/implementation/purchase/Purchase_Studio_Phase_5_Plan_v1.0.0.md` — Mandatory 19-section implementation plan.
2. `docs/walkthrough/purchase/Purchase_Studio_Phase_5_v1.0.0.md` — This architectural walkthrough document.
3. `docs/walkthrough/purchase/evidence/13_po_batch_upload_modal.png` — Headless screenshot showing Batch Upload Modal with auto-matched filenames and target lines.
4. `docs/walkthrough/purchase/evidence/14_po_batch_uploaded_lookbook.png` — Headless screenshot showing Lookbook after batch upload and completion toast notification.

---

## 4. Files Modified
1. `src/components/purchase/PoSizewiseTab.tsx`:
   - Added `FilenameMatchResult`, `BatchUploadItem`, and `BatchUploadState` interfaces.
   - Implemented `normalizeFilenameSegment` and `matchImageFilenameToLines`.
   - Added `batchUploadState` state and `batchFileInputRef`.
   - Added `handleProcessBatchFiles`, `handleUpdateBatchItemLine`, `handleRemoveBatchItem`, and `handleExecuteBatchUpload`.
   - Attached drag-and-drop event handlers and frosted drag overlay to the Visual Lookbook container.
   - Connected `#sw-batch-upload-btn` to the multi-file selector.
   - Rendered `#sw-batch-upload-modal-dialog` at the bottom of the component.
2. `src/tests/poSizewiseUX.test.ts`:
   - Added tests 31–34 verifying exact composite matching, article-only matching, color-only matching, fallback behavior, and batch queue mapping.
3. `src/print_engine/templates/FootwearPurchaseOrderA4.tsx`:
   - Defaulted `isLandscape` safely to portrait when `orientation` is not provided to preserve backwards compatibility.
4. `src/print_engine/templates/SizePivotMatrixA4.tsx`:
   - Defaulted `isLandscape` safely to portrait when `orientation` is not provided.
5. `scripts/capture_purchase_studio_headless.py`:
   - Added Step 13 (Batch Upload Modal) and Step 14 (Lookbook Post-Batch Upload) to headless Playwright capture suite.
6. `docs/implementation/README.md`:
   - Appended Phase 5 entry to the master Implementation Plan index.
7. `docs/walkthrough/README.md`:
   - Appended Phase 5 entry to the master Walkthrough index.
8. `CHANGELOG.md`:
   - Documented Phase 5 features under version `6.52.0`.

---

## 5. Architecture Decisions
- **ADR-PS5-01: Multi-Separator Normalization:**
  - Filenames in the footwear supply chain use arbitrary delimiters (e.g. `FW-NK-9921_Tan.jpg`, `OXF-990-Black.png`, `SND-10001 Cherry Red.jpeg`).
  - `normalizeFilenameSegment` replaces all non-alphanumeric characters with spaces and collapses whitespace, ensuring robust matching regardless of separator style.
- **ADR-PS5-02: Bounded Concurrency Worker Pool:**
  - When merchants upload 20+ high-resolution camera photos (2–5 MB each), triggering 20 concurrent HTTP uploads can exhaust browser sockets and server memory.
  - A client-side worker pool of 3 concurrent workers processes the queue sequentially, updating the progress bar deterministically.
- **ADR-PS5-03: Zero-Friction Pre-Binding Review:**
  - Rather than silently committing uploaded photos to lines, the batch review modal presents the auto-detected bindings in an editable dropdown table, allowing merchants to verify or reassign line items in seconds.

---

## 6. Design Rationale
In footwear and apparel retail:
- The article number identifies the silhouette and tooling (e.g. `FW-NK-9921`).
- The color/shade identifies the upper material and dye lot (e.g. `Tan`, `Black`, `Cognac`).
- The size assortment (e.g. `36-44`) is ordered per article and shade.
By combining article and shade into the heuristic matching logic, sample photos map directly to their exact matrix row with zero manual configuration.

---

## 7. Implementation Summary

### Filename Heuristics Engine
```typescript
export function matchImageFilenameToLines(
  filename: string,
  lines: Array<{ articleNo?: string; itemCode?: string; shade?: string }>
): FilenameMatchResult {
  // Pass 1: Exact Composite Match (Article/ItemCode + Shade)
  // Pass 2: Article-Only / ItemCode-Only Match
  // Pass 3: Color-Only Match
  // Pass 4: Fallback to first line
}
```

### Visual Lookbook Frosted Drag-and-Drop Overlay
```tsx
{batchUploadState.isDragging && (
  <div className="absolute inset-0 z-50 bg-indigo-900/50 backdrop-blur-xs border-4 border-dashed border-indigo-400 flex flex-col items-center justify-center p-6 text-white pointer-events-none animate-in fade-in duration-150">
    <div className="p-4 bg-white/20 rounded-2xl mb-3 shadow-lg">
      <span className="material-symbols-outlined text-[48px] text-white">cloud_upload</span>
    </div>
    <h3 className="text-xl font-black tracking-wide">Drop Article Photos Here</h3>
    <p className="text-xs text-indigo-100 max-w-md text-center mt-1">
      Batch auto-match filenames to Article # and Colorway with instant SPIF WebP compression
    </p>
  </div>
)}
```

---

## 8. Tests Executed

### Vitest Unit Tests (`src/tests/poSizewiseUX.test.ts`)
```bash
npx vitest run src/tests/poSizewiseUX.test.ts
```
**Literal Console Output:**
```text
 RUN  v4.1.11 F:/SMRITRretailNX

 ✓ src/tests/poSizewiseUX.test.ts (34 tests) 31ms

 Test Files  1 passed (1)
      Tests  34 passed (34)
   Start at  22:02:36
   Duration  807ms (transform 421ms, setup 0ms, import 509ms, tests 31ms, environment 0ms)
```

### Print Engine Headless Audit Tests (`src/tests/printEngineHeadlessAudit.test.ts`)
```bash
npx vitest run src/tests/printEngineHeadlessAudit.test.ts
```
**Literal Console Output:**
```text
 RUN  v4.1.11 F:/SMRITRretailNX

 ✓ src/tests/printEngineHeadlessAudit.test.ts (24 tests) 79ms

 Test Files  1 passed (1)
      Tests  24 passed (24)
   Start at  22:02:29
   Duration  626ms (transform 196ms, setup 0ms, import 270ms, tests 79ms, environment 0ms)
```

### TypeScript Strict Compilation Check
```bash
npx tsc --noEmit
```
**Exit Code:** `0` (Zero compilation errors).

---

## 9. Verification Results

### Visual Proof 1: Batch Photo Upload Review Modal
![13_po_batch_upload_modal.png](file:///F:/SMRITRretailNX/docs/walkthrough/purchase/evidence/13_po_batch_upload_modal.png)
*Evidence: Headless Chromium capture showing multi-file batch upload modal with preview thumbnails, filename size indicators, exact composite matching badges (`✓ Exact Article + Color`), target line item selectors, and "Upload & Auto-Bind All" action.*

### Visual Proof 2: Lookbook Post-Batch Upload & Toast Notification
![14_po_batch_uploaded_lookbook.png](file:///F:/SMRITRretailNX/docs/walkthrough/purchase/evidence/14_po_batch_uploaded_lookbook.png)
*Evidence: Headless Chromium capture showing live visual lookbook with SPIF-persisted WebP images bound to cards and completion notification toast.*

---

## 10. Known Limitations
- Filenames containing non-Latin characters or non-standard glyphs may require manual assignment in the target PO line dropdown.
- Upload speeds depend on the client's network upload bandwidth when processing raw images exceeding 10 MB per file.

---

## 11. Future Work
- Client-side Canvas downscaling prior to transmission for ultra-large DSLR photos (>15 MB).
- OCR barcode and price tag scanning directly from sample photo EXIF/bitmap metadata.

---

## 12. Related ADRs
- `ADR-0014: FastAPI Backend Sole System-of-Record`
- `ADR-0032: SPIF Media Processing & WebP Standardization`
- `ADR-PS5-01: Multi-Separator Normalization`
- `ADR-PS5-02: Bounded Concurrency Worker Pool`

---

## 13. Related RFCs
- `RFC-2026-09-PURCHASE-STUDIO-V2`
- `RFC-2026-09-SPIF-IMAGE-OPTIMIZATION`
