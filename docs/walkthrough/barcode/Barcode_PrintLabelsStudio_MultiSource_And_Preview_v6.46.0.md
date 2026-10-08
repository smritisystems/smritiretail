# Barcode_PrintLabelsStudio_MultiSource_And_Preview_v6.46.0

<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.46.0
  Created      : 2026-10-08
  Copyright    : (c) SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal -- SMRITI Walkthrough Governance Policy (WGP) v1.0
-->

## 1. Purpose

Remediate the functional limitations identified during the Barcode Print Studio audit in `PrintLabelsStudio.tsx` (v6.45.0):
1. Wire domain transaction sources (Purchase Orders, GRN Inwards, Sales Return Inwards, Stock Transfer Inwards) into the 3-step wizard.
2. Dynamically synchronize custom user-designed thermal label templates from `/api/v1/barcode/layouts` with baseline presets.
3. Replace synthetic 40-rectangle SVG bar graphics with symbology-accurate `ThermalBarcodeSvg` rendering.
4. Implement the interactive Browser Label Print Sheet Preview modal for printable multi-card rendering.
5. Populate active thermal printer settings dynamically from `/api/v1/barcode/printer-settings`.

---

## 2. Scope

| In Scope | Out of Scope |
|---|---|
| `PrintLabelsStudio.tsx` domain source wiring (PO, GRN, Sales, Transfers) | Direct modifications to `TagLabelPrintingTa.tsx` (kept intact) |
| Dynamic template merging with `GET /api/v1/barcode/layouts` | Backend schema or migration alterations (none required) |
| Integration of `ThermalBarcodeSvg.tsx` for real barcode encoding | Native OS raster driver development |
| Responsive Browser Label Print Sheet Preview Modal | Third-party cloud print proxies |
| Unit verification test suite `printLabelsStudio.test.ts` | Legacy `LabelPrintingSec.tsx` removal (scheduled for future cleanup) |

---

## 3. Files Created

| File | Lines | Purpose |
|---|---|---|
| `src/tests/printLabelsStudio.test.ts` | 88 | Unit verification suite covering multi-source intake, PO quantities, and template merging |
| `docs/walkthrough/barcode/Barcode_PrintLabelsStudio_MultiSource_And_Preview_v6.46.0.md` | this | WGP v1.0 Walkthrough Document |

---

## 4. Files Modified

| File | Change |
|---|---|
| `src/components/barcode/PrintLabelsStudio.tsx` | Added `barcodeTransactionStore` and `ThermalBarcodeSvg` imports; wired multi-source intake (`PURCHASE`, `GRN`, `SALES`, `STOCK_TRANSFER`); dynamic layout synchronization with `/barcode/layouts`; dynamic printer selection from `/barcode/printer-settings`; symbology SVG barcode preview; and full browser print preview sheet modal. |
| `docs/walkthrough/README.md` | Prepending v6.46.0 row to master index table. |

---

## 5. Architecture Decisions

### AD-1: Domain Transaction Store Integration
Rather than isolating `PrintLabelsStudio.tsx` exclusively to catalog product queries (`/products`), domain sources (`PURCHASE`, `GRN`, `SALES`, `STOCK_TRANSFER`) leverage `barcodeTransactionStore` and transaction inward queries with appropriate default quantities (`poQty`, `qty`), allowing instant labeling directly from inward transactions.

### AD-2: Dynamic Layout Template Precedence with Default Presets
Dynamic layout templates fetched from `/api/v1/barcode/layouts` take precedence and are prepended to the selection list, while baseline factory presets (`retail-50x25`, `thermal-40x20`, `jewellery-38x19`, `hang-tag-50x80`, `a4-sheet-21x29`) are preserved as fallbacks.

### AD-3: Hardware-Accurate SVG Symbology
The static 40-rectangle illustrative placeholder bar SVG in the preview card is replaced with `<ThermalBarcodeSvg>`, rendering deterministic Code128 bar widths based on the product's actual barcode value.

---

## 6. Design Rationale

- **Source Selector Continuity:** Switching from `Items` to `Purchase` or `GRN` re-triggers the debounced item intake pipeline, immediately displaying relevant inward document lines.
- **Visual Accuracy:** Users see the actual barcode bars and text in the right-sidebar preview card prior to dispatching physical label print runs.
- **WYSIWYG Sheet Preview:** The `Preview Labels` button opens a high-fidelity modal showing a grid of cards formatted for the target label dimension, with a direct `window.print()` trigger for browser/PDF printing.

---

## 7. Implementation Summary

### Multi-Source Intake Pipeline
```typescript
if (source === 'PURCHASE') {
  const poItems = barcodeTransactionStore.getPurchaseOrders('', '', '');
  // Maps PO records with poQty as default printQty
} else if (source === 'GRN') {
  const grnItems = barcodeTransactionStore.getTransactions('Purchase Inward (GRN)', '', '', '');
  // Maps inward records with inward qty as default printQty
}
```

### Dynamic Template & Printer Synchronization
```typescript
// Layouts
apiFetchV1<any>('/barcode/layouts').then(res => {
  const custom = res.map((l: any) => ({
    id: l.id,
    name: `${l.name} (${l.widthMm}x${l.heightMm}mm)`,
    widthMm: l.widthMm,
    heightMm: l.heightMm,
  }));
  setTemplates([...custom, ...LABEL_TEMPLATES.filter(p => !existingIds.has(p.id))]);
});

// Printers
apiFetchV1<any>('/barcode/printer-settings').then(res => {
  const pName = res?.name ?? res?.printerName ?? (res?.usb_target ? `USB: ${res.usb_target}` : null);
  if (pName) setPrinterName(pName);
});
```

---

## 8. Tests Executed

| Test Suite | Command | Result |
|---|---|---|
| PrintLabelsStudio Domain Suite | `npx vitest run src/tests/printLabelsStudio.test.ts` | **6/6 passed** (exit 0) |
| Barcode & Print Engine Regression | `npx vitest run src/tests/printLabelsStudio.test.ts src/tests/labelPrintEngine.test.ts src/tests/tagPrinting.test.ts src/tests/printEngineHeadlessAudit.test.ts src/tests/qzTrayClient.test.ts src/tests/barcodeManagementIntake.test.ts src/tests/barcodePlaceholderService.test.ts src/tests/grnBarcodeScanner.test.ts` | **84/84 passed** (exit 0) |
| Backend Pytest Hardware Audit | `.\.venv\Scripts\pytest.exe backend\tests\test_printer_service_headless_audit.py backend\tests\t_barcodes.py -v` | **13/13 passed** (exit 0) |
| Backend Pytest Database Suite | `.\.venv\Scripts\pytest.exe backend\app\tests\test_barcode.py backend\app\tests\test_barcode_registry.py -v` | **10/10 passed** (exit 0) |
| Full TypeScript Compilation | `npx tsc --noEmit --skipLibCheck` | **0 errors** (exit 0) |

---

## 9. Verification Results

**Status: Done**

| Claim | Status | Evidence |
|---|---|---|
| Multi-source intake (PO, GRN, Returns, Transfers) | **Done** | `src/tests/printLabelsStudio.test.ts` (tests 1, 2, 3) passed |
| Dynamic layout template merging | **Done** | `src/tests/printLabelsStudio.test.ts` (test 6) passed |
| Symbology-accurate barcode SVG preview | **Done** | `ThermalBarcodeSvg.tsx` integrated into preview card and modal |
| Print Sheet Preview Modal | **Done** | Interactive modal component rendered with `window.print()` trigger |
| TypeScript type soundness | **Done** | `tsc --noEmit --skipLibCheck` clean (exit code 0) |
| Zero regressions across Barcode subsystem | **Done** | 84 frontend tests + 23 backend tests 100% green |

---

## 10. Known Limitations

1. Browser Print Sheet Modal renders using CSS flex grid; direct PDF pagination splitting across physical label roll cutters still relies on QZ Tray or TCP dispatch (`POST /api/v1/barcode/print`).
2. Advanced filters for Category, Warehouse, and Supplier remain static until dedicated master lookup endpoints are wired into filter pills.

---

## 11. Future Work

- Wire server-side live PO and GRN search APIs to complement client-side transaction caches.
- Provide direct SVG-to-canvas image download from the label preview modal.
- Deprecate and remove orphaned `LabelPrintingSec.tsx`.

---

## 12. Related ADRs

- ADR-008: Strangler-Fig Migration (FastAPI Sole System of Record)
- ADR-019: Barcode Studio Component Architecture

---

## 13. Related RFCs

- RFC-118: Print Labels Studio 3-Step Wizard UX
- RFC-129: Multi-Source Barcode Inward Labeling & Browser Preview Sheet

---

## 14. Related Implementation Plans

- [SMRITI Print Labels Studio Multi-Source Inward Intake, Dynamic Layouts & Accurate SVG Preview Plan (v6.46.0)](../../implementation/inventory/Barcode_PrintLabelsStudio_MultiSource_And_Preview_Plan_v6.46.0.md)
