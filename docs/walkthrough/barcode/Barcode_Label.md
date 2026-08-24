<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.6.0
  Created      : 2026-08-22
  Modified     : 2026-08-22
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough: Complete Replacement & Integration of Stitch Barcode Label Designer & Printer Module

**Version:** 6.6.0  
**Date:** 2026-08-22  
**Area:** Barcode & Inventory  
**Author:** Jawahar Ramkripal Mallah  

---

## 1. Purpose
To fully replace the legacy barcode label and tag printing module with the authentic **Stitch Barcode Label Designer & Printer (Industrial Logic)** module from `F:\SMRITI\barcode_label_designer_and_printer_Final\stitch_barcode_label_designer_and_printer`.

---

## 2. Scope
- **Stitch Design System Tokens (`industrial_logic/DESIGN.md`)**:
  - Integrated complete palette: Deep Navy `#041632`, Slate Blue `#3e5f90`, Soft Grey Surface `#fbf8fb`, High-Contrast Error Red `#ba1a1a`, and Monospaced JetBrains typography.
- **Unified Two-Column Industrial Layout (`TagLabelPrintingTab.tsx`)**:
  - **Left Fixed Sidebar (280px)**: Label Printing Parameters (Script, Labels Per Row, Target Port, Output Port/File), Option Radios (7 Modes), Labels to Print summary.
  - **Main Content Area**:
    - Mode-Specific Input Card: Manual Selection, Against Purchase PT File, Against Transactions, Against Purchase Order, Against Masters, Against Direct Scan.
    - Full-Featured Item Preview & Results Grid: Header with search filter, sortable columns (`Stock No`, `Product`, `Brand`, `Style`, `Shade`, `Size`, `# Labels` inline input), summary footer.
- **Persistent Bottom Action Bar / Footer**:
  - Contextual status text, `Clear` (red border), `Exit`, `Print Current`, and `Print All (N)` primary button.
- **Barcode Script Designer & Compiler (`BarcodeScriptGenerationView.tsx`)**:
  - Dark VS Code style editor (`#1E1E1E`), line numbers column, Identification settings, Values cards, token injection, and export/load capabilities.

---

## 3. Files Created
- `docs/walkthrough/barcode/Barcode_Label_Designer_And_Printer_Stitch_Module_Replacement_v6.6.0.md`: WGP Walkthrough record.

---

## 4. Files Modified
- `src/index.css`: Added Industrial Logic design tokens and typography classes.
- `src/components/barcode/TagLabelPrintingTab.tsx`: Full replacement with Stitch Industrial Logic layout, components, and workflows.
- `src/components/barcode/BarcodeScriptGenerationView.tsx`: Full replacement with Stitch dark-theme script compiler.
- `src/tests/tagLabelPrinting.test.ts`: Verified 14/14 automated test assertions.
- `CHANGELOG.md`: Appended release notes for v6.6.0.
- `docs/walkthrough/README.md`: Appended master index entry.

---

## 5. Architecture Decisions
- **ADR-STITCH-REPLACE-01 (Single Component Replacement)**: The replacement cleanly integrates via `TagLabelPrintingTab.tsx` and `BarcodeStudioTab.tsx` so that `App.tsx`, launchpads, and navigation menus require zero breaking changes.
- **ADR-STITCH-REPLACE-02 (Zero-Latency Inline Editing)**: Inline number inputs in the results grid allow direct editing of `# Labels` for instantaneous queue updates.

---

## 6. Design Rationale
The Stitch Industrial Logic specification replaces cluttered legacy group boxes with structured section cards, soft borders, and clear typographic hierarchy, minimizing cashier fatigue during high-volume batch tag printing.

---

## 7. Implementation Summary
- Integrated all Stitch HTML source screens (`tag_printing_manual_selection_redesign`, `tag_printing_against_purchase_pt_file_redesign`, `tag_printing_against_transactions_redesign`, `tag_printing_results_grid_view`, and `barcode_script_generation`).
- Preserved 50x25mm vector SVG barcode generation and browser thermal print integration.

---

## 8. Tests Executed
```powershell
npx vitest run src/tests/tagLabelPrinting.test.ts
```

---

## 9. Verification Results
```text
 RUN  v4.1.10 F:/SMRITRretailNX

 ✓ src/tests/tagLabelPrinting.test.ts (14 tests) 10ms

 Test Files  1 passed (1)
      Tests  14 passed (14)
   Start at  10:43:03
   Duration  416ms
```

---

## 10. Known Limitations
- None.

---

## 11. Future Work
- Bluetooth handheld wireless scanner pairing direct bridge.

---

## 12. Related ADRs
- `ADR-0023-Barcode-Label-Printing-Architecture`
- `ADR-STITCH-REPLACE-01`

---

## 13. Related RFCs
- `RFC-2026-Stitch-Module-Replacement`
