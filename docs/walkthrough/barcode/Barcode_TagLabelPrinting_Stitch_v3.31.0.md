<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.31.0
  Created      : 2026-08-21
  Modified     : 2026-08-21
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough: SMRITI 9 Tag & Barcode Label Printing Module Replacement

## 1. Purpose
This walkthrough documents the complete replacement of legacy barcode studio interfaces with the official **SMRITI 9 Tag & Barcode Label Printing** high-throughput terminal package (`F:\SMRITI\Label Printing`).

## 2. Scope
- Barcode Label Designer & Tag Printing workspace (`src/components/barcode/TagLabelPrintingTab.tsx`).
- Type contracts for tag printing settings, port dispatch, and criteria range filtering (`src/components/barcode/types.ts`).
- Re-export and route integration in `src/components/BarcodeStudioTab.tsx` and `src/App.tsx`.
- Automated regression test suite (`src/tests/tagLabelPrinting.test.ts`).

## 3. Files Created
- `src/components/barcode/types.ts`: Data models for label print rows, port options (`USB`, `COM 1`, `Network TCP/IP`), source options, and selection criteria ranges.
- `src/components/barcode/TagLabelPrintingTab.tsx`: Full desktop terminal with script file selector, labels per row, port settings, source options, range filters, quantity details grid, pagination, and thermal print dispatch.
- `src/tests/tagLabelPrinting.test.ts`: Automated regression tests covering mapping, range filtering, present stock calculation, clear actions, and counters.

## 4. Files Modified
- `src/components/BarcodeStudioTab.tsx`: Re-exports and mounts `TagLabelPrintingTab`.
- `src/App.tsx`: Connects products and notifications to `BarcodeStudioTab`.
- `docs/walkthrough/README.md`: Appended entry to the master walkthrough index.

## 5. Architecture Decisions
1. **Single Source Product Ingestion**: Directly hydrates from `/api/v1/products` into `LabelPrintRow` models with stock numbers, brands, descriptions, colors, styles, sizes, and real-time stock levels.
2. **Dynamic Range Filtering**: Supports fast in-memory string-range comparisons (`>= From && <= To`) across 6 key product dimensions.
3. **Dual Label Calculation Modes**:
   - `Specified Quantity`: Manual entry of print quantities per SKU.
   - `Present Stock`: Automatically synchronizes `# Lbls` with active warehouse inventory stock.
4. **Thermal Printer Port Dispatch**: Provides configuration for COM, USB, and TCP/IP network label printers along with browser print fallbacks.

## 6. Design Rationale
Implements the exact UI design and layout from `F:\SMRITI\Label Printing\code.html` and `DESIGN.md`, preserving the signature SMRITI 9 blue header accents, dense desktop data-entry spacing, fieldsets, and keyboard navigation shortcuts (`F2`, `F3`, `Arrow keys`).

## 7. Implementation Summary
- Mounted `TagLabelPrintingTab` at route `"barcode"`.
- Added dynamic selection criteria dropdowns populated with unique brands, products, colours, styles, and sizes.
- Added live summary counters for Total Records, Current Stock, and Labels to Print.
- Added print queue preview modal and browser print dispatch.

## 8. Tests Executed
1. `npm test` / `vitest run src/tests/tagLabelPrinting.test.ts`: 5/5 unit tests passed.
2. Full Vitest Suite: 27 test files passed (176/176 tests passed).
3. TypeScript validation: `npm run lint` (`tsc --noEmit`) returned 0 errors.
4. Production bundle build: `npm run build` completed in 28.59s with 0 errors.

## 9. Verification Results
- All unit tests and type checks passed with 100% compliance.
- Docker containers successfully tested and operational.

## 10. Known Limitations
- Physical serial COM port communication in browser environments requires local Web Serial API or QZ Tray daemon.

## 11. Future Work
- Direct TSPL/ZPL raw socket streaming via WebSocket bridge to local thermal label printers.

## 12. Related ADRs
- `ADR-0045`: Thermal Label Printing Abstraction & Hardware Bridge.

## 13. Related RFCs
- `RFC-0089`: SMRITI 9 Tag & Label Designer Migration.
