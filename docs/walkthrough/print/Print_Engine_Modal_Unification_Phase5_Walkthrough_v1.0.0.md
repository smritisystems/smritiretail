<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.147.0
  Created      : 2026-10-29
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Print Engine Modal Unification Phase 5 (WMS Delivery Challans, Thermal Barcode Rolls & Label Sheet Previews) Walkthrough v1.0.0

## 1. Purpose
This walkthrough document details the Phase 5 platform-wide unification of print preview modals across SMRITI Retail OS:
1. WMS Delivery Challan Modal (Statutory Rule 55 CGST Rules, 2017) in `WmsStudioTab.tsx`.
2. Thermal Roll Label Printing Area (Exact 50mm x 25mm stickers) in `TagLabelPrintingTa.tsx`.
3. Labels Print Sheet Preview Modal in `PrintLabelsStudio.tsx`.

Prior to Phase 5, these components were rendered inline inside the `#root` tree or used legacy `body * { visibility: hidden !important; }` and `position: fixed` CSS rules, resulting in blank sheets, bounding box displacement, or page overflows when printing via Chromium.

---

## 2. Scope
- Area: Warehouse Management (WMS), Barcode & Thermal Roll Hardware Printing (`src/components/wms/`, `src/components/barcode/`)
- Modals Modernized:
  - `WmsStudioTab.tsx` (`v6.99.16`)
  - `TagLabelPrintingTa.tsx` (`v6.99.16`)
  - `PrintLabelsStudio.tsx` (`v6.99.16`)
- Test Suites Authored:
  - `src/tests/wmsDeliveryChallanModal.test.tsx` (2 tests)
  - `src/tests/tagLabelPrintThermalPortal.test.tsx` (2 tests)
  - `src/tests/printLabelsStudioPreviewModal.test.tsx` (2 tests)

---

## 3. Files Created
- `src/tests/wmsDeliveryChallanModal.test.tsx`
- `src/tests/tagLabelPrintThermalPortal.test.tsx`
- `src/tests/printLabelsStudioPreviewModal.test.tsx`
- `docs/walkthrough/print/Print_Engine_Modal_Unification_Phase5_Walkthrough_v1.0.0.md`

---

## 4. Files Modified
- `src/components/wms/WmsStudioTab.tsx`
- `src/components/barcode/TagLabelPrintingTa.tsx`
- `src/components/barcode/PrintLabelsStudio.tsx`
- `CHANGELOG.md`
- `docs/walkthrough/README.md`

---

## 5. Architecture Decisions
- **Single-Tree Body Portal Standard**: All printable modals mount directly as children of `document.body` via `createPortal(modalContent, document.body)`.
- **Active Root Suppression**: Injected `@media print { #root { display: none !important; } }` across all components, preventing viewport height displacement.
- **Dynamic @page Sizing**:
  - `WmsStudioTab.tsx`: enforces `@page { size: A4 portrait; margin: 10mm 12mm 12mm 12mm; }`.
  - `TagLabelPrintingTa.tsx`: enforces `@page { size: 50mm 25mm; margin: 0; }` with `page-break-after: always !important;` per sticker.
  - `PrintLabelsStudio.tsx`: dynamically applies template width and height (`size: ${selectedTemplate.widthMm}mm ${selectedTemplate.heightMm}mm; margin: 0;`).
- **Static Flow Unrolling**: Modals unroll into `position: static !important; display: block !important; overflow: visible !important;` sheets in `@media print`.
- **Keyboard Shortcuts**: Added universal `Escape` (close) and `F9` / `Ctrl+P` (instant print) listeners across all modals.

---

## 6. Design Rationale
Chromium's print engine respects the layout box of DOM elements even when hidden via `visibility: hidden`. If an invisible container like `#root` occupies the screen, elements placed after it are rendered after that layout box, pushing content onto secondary pages or producing blank pages. Direct portal mounting to `document.body` combined with `#root { display: none !important; }` completely decouples the printing canvas from the host application flow.

---

## 7. Implementation Summary
- Upgraded `WmsStudioTab.tsx` Delivery Challan to portal directly to `document.body`, suppress `#root`, hide control toolbars (`wms-challan-toolbar`), and unroll consignor/consignee tables to clean high-contrast print layouts.
- Upgraded `TagLabelPrintingTa.tsx` thermal label printing container to a body portal, eliminated legacy `visibility: hidden` rules, and enforced exact `50mm x 25mm` thermal roll pages.
- Upgraded `PrintLabelsStudio.tsx` Label Sheet Preview to a body portal with dynamic `@page` template sizing, `#root` suppression, and toolbar hiding.

---

## 8. Tests Executed
```bash
npx vitest run src/tests/vendorPrintModal.test.tsx src/tests/vendorStatementOfAccountModal.test.tsx src/tests/grnLogisticsAndTerms.test.tsx src/tests/staffPrintModal.test.tsx src/tests/poPrintCorporateIdentityUnblocking.test.tsx src/tests/batchBarcodePrintModal.test.tsx src/tests/packingSlipManagementModal.test.tsx src/tests/proposTaxInvoiceReceipt.test.tsx src/tests/proposShiftCloseModal.test.tsx src/tests/employeeAttendancePayslipModal.test.tsx src/tests/wmsDeliveryChallanModal.test.tsx src/tests/tagLabelPrintThermalPortal.test.tsx src/tests/printLabelsStudioPreviewModal.test.tsx
```

---

## 9. Verification Results
```text
 Test Files  13 passed (13)
      Tests  50 passed (50)
   Start at  20:00:01
   Duration  3.96s
```
- WMS Delivery Challan: 2/2 tests passed.
- Tag Label Thermal Portal: 2/2 tests passed.
- Print Labels Studio Sheet Preview: 2/2 tests passed.
- All 10 prior print test suites: 44/44 tests passed.

---

## 10. Known Limitations
- When exporting raw DPL/PRN directly to industrial hardware via serial/COM ports (Honeywell IH-2 / Zebra ZT410), browser printing is bypassed. The body portal applies strictly to the Windows Print Driver / Browser Print pathway.

---

## 11. Future Work
- Consider adding a unified `printReceiptDirect()` hook across all transaction screens.

---

## 12. Related ADRs
- `ADR-0042`: Canonical Print Preview & Hardware Spool Architecture
- `ADR-0045`: Single-Tree Body Portal Migration for Multi-Format Output

---

## 13. Related RFCs
- `RFC-2026-PRINT-01`: Chromium Layout Displacement & Modal Print Isolation
