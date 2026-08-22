<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.4.0
  Created      : 2026-08-22
  Modified     : 2026-08-22
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough: Printing Barcode Labels against Purchase (PT File) & Manifest Navigation

**Version:** 6.4.0  
**Date:** 2026-08-22  
**Area:** Inventory & Barcode  
**Author:** Jawahar Ramkripal Mallah  

---

## 1. Purpose
To implement and verify the **"Printing Barcode Labels against Purchase (PT File)"** workflow in SMRITI Retail OS Barcode Studio, enabling retail operators to ingest purchase transaction files (`.pt`, `.txt`, `.csv`), navigate sequential items via standard 4-way navigation (`|<<`, `<`, `>`, `>>|`), enforce fixed purchase quantities from the PT file, and spool single or batch thermal barcode labels.

---

## 2. Scope
- **PT File Ingestion Engine (`ptFileParser.ts`)**: Supports parsing comma, tab, or pipe delimited purchase transaction files with columns for Stock No, Product, Brand, Style, Shade, Size, Purchase Qty, MRP, Selling Price, and Barcode.
- **Purchase Transaction Item Manifest Table**: Replaces manual selection range criteria with a real-time PT item manifest grid when `sourceOption === "Against Purchase (PT File)"`.
- **Selected Item Live Inspector**: Displays active item details, synchronizing `# Lbls` with the exact purchase quantity from the PT file.
- **Quantity Policy Enforcement**:
  - `Specified Quantity`: Disabled / locked in PT File mode.
  - `Present Stock`: Disabled / locked in HO.
  - `Current Stock`: Marked as N/A (HO).
  - `Labels to Print`: Displays the active item's purchase quantity for single prints, and total purchase quantity sum for batch prints.
- **Action Controls (`Print`, `Print All`, `Clear`, `Exit`, `OK`)**:
  - `Print`: Dispatches tags for the currently selected item in the grid using its purchase quantity.
  - `Print All`: Dispatches tags for all items in the PT file according to their individual purchase quantities.
  - `Clear`: Resets the loaded PT file and all active parameters.
  - `Exit`: Closes the terminal.
  - `OK`: Triggers target printer selection modal if `.blf` script is loaded.

---

## 3. Files Created
- `src/components/barcode/ptFileParser.ts`: PT file text/CSV parser utility and built-in sample purchase transaction dataset.

---

## 4. Files Modified
- `src/components/barcode/TagLabelPrintingTab.tsx`: Integrated PT file ingestion, manifest table, quantity rule enforcement, and active item synchronization.
- `src/tests/tagLabelPrinting.test.ts`: Added automated unit tests covering PT file parsing, fixed quantity enforcement, and sequential navigation.
- `CHANGELOG.md`: Appended release notes for v6.4.0.
- `docs/walkthrough/README.md`: Appended master index entry.

---

## 5. Architecture Decisions
- **ADR-BARCODE-PT-01 (In-Memory Streaming Parser)**: Implemented lightweight in-memory parsing for `.pt`, `.txt`, `.tsv`, and `.csv` files so operators can import purchase files directly in the browser with zero round-trip latency.
- **ADR-BARCODE-PT-02 (Strict Purchase Quantity Binding)**: In PT File mode, user-specified quantity overrides are disabled to maintain strict audit integrity between the Purchase Transaction / Goods Receipt Note (GRN) and the printed barcode sticker quantities.

---

## 6. Design Rationale
By presenting the full Purchase Transaction Manifest Table alongside the Selected Item Inspector, operators can easily verify purchase details, scroll through hundreds of incoming stock items, and verify barcode alignment before spooling to thermal printers.

---

## 7. Implementation Summary
- **Source Option Detection**: Selecting *"Against Purchase (PT File)"* activates the PT file sub-panel and manifest table.
- **Sequential Navigation**: Integrated 4-way pagination buttons (`|<<`, `<`, `>`, `>>|`) to iterate through items in the PT file.
- **Live Thermal Preview**: Visual sticker preview renders crisp vector SVG barcodes with exact 50x25mm dimensions.

---

## 8. Tests Executed
```powershell
npx vitest run src/tests/tagLabelPrinting.test.ts
```

---

## 9. Verification Results
```text
 RUN  v4.1.10 F:/SMRITRretailNX

 ✓ src/tests/tagLabelPrinting.test.ts (10 tests) 10ms

 Test Files  1 passed (1)
      Tests  10 passed (10)
   Start at  09:35:13
   Duration  1.19s
```

---

## 10. Known Limitations
- Custom proprietary binary PT formats must be converted to standard delimited text (`.pt` or `.csv`) before loading.

---

## 11. Future Work
- Add direct integration with live Purchase Orders / GRN database records via FastAPI backend endpoint (`/api/v1/purchase/grn/{id}/tags`).

---

## 12. Related ADRs
- `ADR-0023-Barcode-Label-Printing-Architecture`
- `ADR-BARCODE-PT-01`

---

## 13. Related RFCs
- `RFC-2026-PT-Barcode-Ingestion`
