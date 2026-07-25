<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.33.0
  Created      : 2026-07-25
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
-->

# Walkthrough: Universal SMRITI Label Printing Engine Service v3.33.0

## 1. Purpose
This walkthrough documents the implementation of the centralized, reusable **Universal SMRITI Label Printing Engine Service & Modal Component** (`UniversalLabelPrinterModal.tsx` & `universalLabelPrinterService.ts`). It enables store operators to print barcode and QR code labels directly across any current or future module (Item Master, Purchase, GRN, POS/Sales, Stock Transfer, Barcode Master, Excel Grid Entry) without opening individual transaction detail views.

## 2. Scope
- **Centralized Service Architecture (`universalLabelPrinterService.ts`)**: Normalized schema (`UniversalLabelItem`) supporting 20+ auto-populated tokens (`{item_code}`, `{barcode}`, `{sku}`, `{name}`, `{category}`, `{brand}`, `{department}`, `{vendor}`, `{warehouse}`, `{batch_no}`, `{lot_no}`, `{serial_no}`, `{cost_price}`, `{price}`, `{mrp}`, `{mfg_date}`, `{expiry_date}`, `{stock_qty}`, `{style}`).
- **Multi-Selection & Record Filtering**:
  - `Selected Records Only` (Checkbox selections)
  - `Print All Filtered Records` (Search query output)
  - `Print Range Boundary` (SKU `A` to `B`)
  - Multi-attribute filter drawer (Category, Brand, Vendor, Warehouse, Stock Status).
- **Quantity Source Engine**: `Fixed Copies`, `Stock Quantity (On-Hand)`, `Received Quantity (GRN/PO)`, `Sold Quantity (POS)`, `Custom Overrides`.
- **PRN Script & Hardware Engine**: PRN script / ZPL / TSPL template selector, custom PRN script editor, hardware profile selector (Zebra ZD421, TSC TE244, Virtual PDF), and live sample label preview.
- **Cross-Module Integration**: Wired into `ItemMasterTab.tsx`, `ExcelGridEntrySection.tsx`, and `BarcodeStudioTab.tsx`.

## 3. Files Created
- `src/services/universalLabelPrinterService.ts`: Core data structures, token extractor, PRN script renderer, and default templates.
- `src/components/UniversalLabelPrinterModal.tsx`: Reusable label printing modal dialog.
- `docs/walkthrough/inventory/Universal_Label_Printing_Engine_v3.33.0.md`: WGP documentation walkthrough.

## 4. Files Modified
- `src/components/ItemMasterTab.tsx`: Added Universal Label Printer modal launcher in toolbar and bulk selection.
- `src/components/ExcelGridEntrySection.tsx`: Added Universal Label Printer button for grid rows.
- `src/components/BarcodeStudioTab.tsx`: Connected Universal Label Engine modal.
- `docs/walkthrough/README.md`: Updated master index table with version v3.33.0.

## 5. Architecture Decisions
- **Decoupled Central Service**: Every module passes normalized `UniversalLabelItem[]` records to `UniversalLabelPrinterModal`, eliminating module-specific label logic.
- **Offline Hardware Queue**: Dispatched print runs are cached in LocalStorage (`smriti_barcode_reprint_queue`) with ZPL code inspection.

## 6. Design Rationale
- **Zero Friction Warehouse Printing**: Operators can select 100+ items from search results or range filters and print labels in a single click without opening individual records.

## 7. Implementation Summary
- Built `universalLabelPrinterService.ts` with 4 default label templates and token extractor.
- Built `UniversalLabelPrinterModal.tsx` with selection modes, attribute filters, quantity sources, and live barcode preview.
- Integrated modal across Item Master, Excel Grid Entry, and Barcode Studio.

## 8. Tests Executed
- Playwright E2E automation suite on Docker container `smriti-workspace`.

## 9. Verification Results
- All tests passed cleanly with 0 console errors and zero regression.

## 10. Known Limitations
- Network ZPL direct printing relies on local TCP bridge or QZ Tray plugin.

## 11. Future Work
- Add direct WebUSB / Bluetooth print driver bridge.

## 12. Related ADRs
- `ADR-0008`: Barcode Studio Modularization.

## 13. Related RFCs
- `RFC-LABEL-001`: Universal Label Printing Engine.
