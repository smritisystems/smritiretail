<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.5.0
  Created      : 2026-08-22
  Modified     : 2026-08-22
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough: Comprehensive Multi-Source Barcode Printing Engine (Transactions, PO, Masters, Direct Scan)

**Version:** 6.5.0  
**Date:** 2026-08-22  
**Area:** Inventory & Barcode  
**Author:** Jawahar Ramkripal Mallah  

---

## 1. Purpose
To deliver and verify the full operational matrix for SMRITI Retail OS Barcode Label Printing across all remaining transaction sources:
1. **Against Transactions** (GRN Inward, Sales Returns, Transfers)
2. **Against Purchase Orders** (Cumulative PO aggregation)
3. **Against Masters** (Date Range period filter & Unprinted confirmation dialog)
4. **Against Direct Scan** (High-speed barcode scanner with instant 1-label auto-print)
5. **Against Purchase (PT File)** (Delimited purchase file parsing)
6. **Manual Selection** (6-dimension range criteria with F2 Master product browse)

---

## 2. Scope
- **Source Mode Sub-Panels**: Dynamic workspace rendering based on selected `sourceOption`.
- **Transaction & PO Query Engine (`barcodeTransactionStore.ts`)**: Fast retrieval and cumulative quantity aggregation across documents.
- **Master Date Range Dialog**: Interactive 3-way modal prompting whether to display only unprinted items or all items in period.
- **Direct Scan Engine**: Instant barcode lookup, scan log history table, and configurable label count override.
- **Sequential 4-Way Item Navigation (`|<<`, `<`, `>`, `>>|`)**: Synchronized across all source modes with real-time active item preview.
- **Thermal Label Spooling**: Vector SVG barcodes with exact 50x25mm dimensions, Honeywell IH-2 (300 dpi) DPL script generation, and browser print spooling.

---

## 3. Files Created
- `src/components/barcode/barcodeTransactionStore.ts`: In-memory store and query utilities for transactions, purchase orders, master items with creation timestamps, and label printed status.

---

## 4. Files Modified
- `src/components/barcode/TagLabelPrintingTab.tsx`: Integrated dynamic sub-panels, direct scan forms, date range dialogs, and manifest table rendering across all modes.
- `src/tests/tagLabelPrinting.test.ts`: Expanded automated test suite to 14 test cases covering all 6 source modes.
- `CHANGELOG.md`: Added release notes for v6.5.0.
- `docs/walkthrough/README.md`: Appended master index entry.

---

## 5. Architecture Decisions
- **ADR-BARCODE-MULTI-01 (Unified Dataset Strategy)**: All source modes map their output to the standardized `LabelPrintRow` model so navigation, preview, and print dispatch remain 100% uniform.
- **ADR-BARCODE-MULTI-02 (Cumulative PO Quantity Aggregation)**: Multiple PO lines targeting the same SKU are automatically aggregated into a single line item with combined purchase quantities.

---

## 6. Design Rationale
Retail cashiers and warehouse receiving staff require different workflows at different stages (receiving goods against GRN/PO vs relabeling unprinted items vs direct scanning incoming stock). Providing dedicated sub-panels for each mode eliminates user error and enforces inventory governance.

---

## 7. Implementation Summary
- **Against Transactions**: Select document type, prefix, and document number range.
- **Against Purchase Orders**: Specify PO prefix and number range to load cumulative quantities.
- **Against Masters**: Select date range; clicking `OK` prompts for unprinted vs all items.
- **Against Direct Scan**: Scan or enter stock numbers for instant 1-click label output.

---

## 8. Tests Executed
```powershell
npx vitest run src/tests/tagLabelPrinting.test.ts
```

---

## 9. Verification Results
```text
 RUN  v4.1.10 F:/SMRITRretailNX

 ✓ src/tests/tagLabelPrinting.test.ts (14 tests) 18ms

 Test Files  1 passed (1)
      Tests  14 passed (14)
   Start at  09:38:07
   Duration  681ms
```

---

## 10. Known Limitations
- Background database synchronization for transaction tables relies on active tenant context.

---

## 11. Future Work
- Add Bluetooth handheld mobile terminal batch sync.

---

## 12. Related ADRs
- `ADR-0023-Barcode-Label-Printing-Architecture`
- `ADR-BARCODE-MULTI-01`

---

## 13. Related RFCs
- `RFC-2026-Barcode-Multi-Source-Architecture`
