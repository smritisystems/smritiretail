<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.2.0
  Created      : 2026-08-21
  Modified     : 2026-08-21
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough: Barcode Label Designer & Printer Modernization (Industrial Logic)

**Version:** 6.2.0  
**Date:** 2026-08-21  
**Area:** Inventory / Barcode Studio  
**Status:** Completed & Verified  

---

## 1. Purpose
To modernize and refactor the SMRITI 9 Tag & Barcode Label Printing and Designer subsystem according to the Stitch **Industrial Logic** design specifications and manual selection business rules.

---

## 2. Scope
- Dual-workspace architecture: **Tag & Barcode Printing Terminal** and **Barcode Script Generation & Compiler Studio**.
- Multi-dimensional selection criteria range matrix (Stock No, Product, Brand, Style, Shade, Size) with F2 Master Product Browse support.
- Selected Item Live Preview with first, previous, next, and last record navigation.
- Tactical **Edit Quantity Details** modal allowing per-item `# Lbls` customization and batch fill actions.
- Target thermal printer provisioning modal when using modern `.blf` script files.
- Monospaced ZPL/TSPL/EPL script editor with macro token injection (`@@@field;dir;type;start;length@@@`) and compiler status indicators.

---

## 3. Files Created
- [`src/components/barcode/EditQuantityDetailsModal.tsx`](file:///f:/SMRITRretailNX/src/components/barcode/EditQuantityDetailsModal.tsx) — High-density modal dialog for adjusting per-item `# Lbls` quantities.
- [`src/components/barcode/BarcodeScriptGenerationView.tsx`](file:///f:/SMRITRretailNX/src/components/barcode/BarcodeScriptGenerationView.tsx) — Monospaced script editor with syntax highlighting, token extraction, and compilation status.
- [`src/components/barcode/BarcodePrinterSelectModal.tsx`](file:///f:/SMRITRretailNX/src/components/barcode/BarcodePrinterSelectModal.tsx) — Target printer selector for thermal USB, Serial, Network TCP/IP, and QZ Tray.

---

## 4. Files Modified
- [`src/components/barcode/types.ts`](file:///f:/SMRITRretailNX/src/components/barcode/types.ts) — Extended interfaces for script tokens, printer configs, and batch parameters.
- [`src/components/barcode/TagLabelPrintingTab.tsx`](file:///f:/SMRITRretailNX/src/components/barcode/TagLabelPrintingTab.tsx) — Complete refactor based on 12-column industrial layout, range matrix, and action bar.
- [`src/tests/tagLabelPrinting.test.ts`](file:///f:/SMRITRretailNX/src/tests/tagLabelPrinting.test.ts) — Comprehensive 7-test suite for range filtering, batch/per-item quantities, and script token generation.

---

## 5. Architecture Decisions
- **Decoupled Workspaces**: Separated daily store printing operations (Tag Printing Terminal) from technical template engineering (Script Generation Studio).
- **Non-Destructive Macro Engine**: Standardized industrial token interpolation (`@@@field;dir;type;start;length@@@`) compatible with TSPL/ZPL label printers.
- **F2 Product Browse Integration**: Connected selection criteria directly to `PurchaseProductBrowseModal` for instantaneous SKU search and lookup.

---

## 6. Design Rationale
- Adopted the Stitch **Industrial Logic** theme (Deep Navy `#041632`, Slate Blue `#3e5f90`, surface `#fbf8fb`, container `#efedf0`, and `#ffffff` cards).
- Structured information in section cards with clear 1px borders instead of cluttered legacy nested group boxes.

---

## 7. Implementation Summary
- **Selection Range**: Filters active rows dynamically across 6 dimensions.
- **Selected Item Preview**: Displays current item attributes and lets operators page through matching items.
- **Labels to Print**: Allows fast batch quantity entry or detailed `# Lbls` grid editing via `F2`.
- **Script Compiler**: Line-numbered code editor supporting live macro insertion from left/right string slices.

---

## 8. Tests Executed
```bash
npx vitest run src/tests/tagLabelPrinting.test.ts
npm run build
```

---

## 9. Verification Results
- `src/tests/tagLabelPrinting.test.ts`: **7/7 Passed (100%)**.
- `npm run build`: **Vite production bundle built successfully (0 errors)**.

---

## 10. Known Limitations
- Direct hardware raw socket dispatch for Network TCP/IP requires local network access or SMRITI Agent bridge in production.

---

## 11. Future Work
- Add visual WYSIWYG drag-and-drop thermal label element canvas.
- Support RFID inlay encoding commands alongside 1D/2D barcodes.

---

## 12. Related ADRs
- `ADR-0042-Thermal-Label-Engine.md`

---

## 13. Related RFCs
- `RFC-0089-Industrial-Barcode-Printing.md`
