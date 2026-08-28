<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.116.0
  Created      : 2026-08-28
  Modified     : 2026-08-28
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough: Barcode & Label Printing Engine (v1.0.0-GA)

## 1. Purpose
Documents the Label Print Engine — SKU-level label template configuration, batch print job lifecycle (QUEUED→PRINTED), reprint with optional SKU filter, and queue-level summary reporting.

## 2. Scope
- `LabelPrintEngine` covering `createJob()`, `addToBatch()`, `startPrint()`, `completePrint()`, `failPrint()`, `reprint()`, `queueSummary()`.
- `DEFAULT_TEMPLATE` (STD-58MM): CODE128 format, 58×40mm, 5 fields (name/barcode/sku/mrp/hsn).
- `totalLabels = Σ(item.qty × item.copies)`.
- Status flow: QUEUED → PRINTING → PRINTED / FAILED.
- `reprint()`: Creates new QUEUED job from a PRINTED job; `skuFilter` allows selective reprint.
- `LabelPrintModal`: job sidebar (status/reprint badge), queue summary strip, 3-tab (Print Items with totals, Template fields, Audit trail).

## 3. Files Created
- `src/utils/labelPrintEngine.ts`
- `src/components/warehouse/LabelPrintModal.tsx`
- `src/tests/labelPrintEngine.test.ts`
- `docs/walkthrough/warehouse/Label_Print_Engine_v1.0.0.md`

## 4. Files Modified
- `docs/walkthrough/README.md`, `docs/implementation/README.md`, `CHANGELOG.md`

## 5. Architecture Decisions
1. **`totalLabels = Σ(qty × copies)` is the single denominator for print accounting**: `qty` = number of distinct labels for a SKU (e.g. how many items are being tagged); `copies` = how many physical stickers per item (e.g. front + back). Keeping them separate allows flexible label count without changing the item list.
2. **`addToBatch()` throws on non-QUEUED jobs**: Prevents adding items to a job that is already printing or complete. Production UIs disable the Add button once printing starts; the guard is a defence-in-depth backstop.
3. **`reprint()` creates a completely new job, not a retry**: A retry would overwrite the FAILED/PRINTED state. A new job preserves the original's audit trail and lets the reprint be tracked independently (separate `jobNo`, `printedAt`, `auditTrail`).
4. **`skuFilter` on `reprint()` enables selective reprinting**: In practice, a printer jam may have ruined labels for 2 of 10 SKUs. The filter avoids reprinting all 10.
5. **`LabelTemplate.fields` is a configurable array**: Different store formats need different label layouts. The field array is the template's "schema" — production allows field visibility, font size, and position to be configured per template.
6. **`DEFAULT_TEMPLATE` is an exported constant**: Components and tests import it directly — no factory function needed for a single well-known default.

## 6. Design Rationale
Label printing is a high-frequency, error-prone operation in retail. A print queue system with explicit status tracking ensures failed jobs don't go unnoticed. The `queueSummary()` function gives a supervisor a real-time view of printing throughput for a shift without querying individual jobs.

## 7. Implementation Summary
- `createJob()`: Maps input items to `PrintItem[]`; computes `totalLabels`; status QUEUED; JOB_CREATED audit.
- `addToBatch()`: Guards QUEUED; appends new items; recomputes `totalLabels`; ITEMS_ADDED audit.
- `startPrint()` / `completePrint()` / `failPrint()`: Guard checks; status transitions; store `printedAt` / `failReason`; audit entries.
- `reprint()`: Filters items by `skuFilter` if provided; maps to new `PrintItem[]` with fresh `itemId`s; new job with `isReprint=true`, `originalJobId`.
- `queueSummary()`: `filter` + `reduce` over job array; counts by status, sums `totalLabels`, counts `isReprint`.

## 8. Tests Executed
```
npm test
```

## 9. Verification Results
- **`src/tests/labelPrintEngine.test.ts`**: 4/4 tests passed.
  - Test 1: 3 items → totalLabels = (5×2)+(3×1)+(2×2) = 17; status QUEUED; JOB_CREATED audit ✓
  - Test 2: addToBatch 1 item (+3 labels → 13 total); QUEUED→PRINTING→PRINTED; 4 audit entries; `printedAt` set ✓
  - Test 3: PRINTING→FAILED with reason; addToBatch on FAILED throws ✓
  - Test 4: Full reprint (17 labels, isReprint=true); filtered reprint (belt only, 4 labels); queueSummary (printed=1, queued=2, reprintCount=2, totalLabels=38) ✓
- **Total Frontend Suite**: 87/87 test files, 520/520 tests green in 16.36s, exit code 0.

## 10. Known Limitations
- `LabelPrintEngine` does not communicate with physical printers — it manages the print queue only. QZ Tray (`src/utils/qzTrayClient.ts`) handles the actual print commands in production.
- Barcode generation (EAN-13 check digit, QR payload) is not implemented in the engine — it expects pre-computed barcode strings from the product master.

## 11. Future Work
- FastAPI `POST /api/v1/label-jobs/`, `PATCH /api/v1/label-jobs/{id}/status`, `POST /api/v1/label-jobs/{id}/reprint`.
- QZ Tray integration: `startPrint()` triggers `qzTrayClient.printLabels(job)` → auto-completes on success, auto-fails on timeout.
- EAN-13 check digit computation added to `LabelPrintEngine.computeBarcode()`.

## 12. Related ADRs
- `ADR-001`: FastAPI Sole System of Record. `ADR-050`: Label Print Queue Design, Template Field Configuration, and Reprint Audit Policy.

## 13. Related RFCs
- `RFC-119`: Label Printing Governance, QZ Tray Integration Policy, and Reprint Authorisation Matrix.
