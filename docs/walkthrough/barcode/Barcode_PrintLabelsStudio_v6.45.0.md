# Barcode_PrintLabelsStudio_v6.45.0

<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.45.0
  Created      : 2026-09-26
  Copyright    : (c) SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal -- SMRITI Walkthrough Governance Policy (WGP) v1.0
-->

## 1. Purpose

Implement the **SMRITI Print Labels Studio** -- a clean, wizard-driven 3-step barcode label printing UX
that replaces the direct landing on the legacy Batch Tag & Barcode Printing engine when a user opens the
Barcode Studio. Matches the architect reference screenshot pixel-for-pixel.

The existing `TagLabelPrintingTa.tsx` (2823 lines) is preserved as the "Batch Tag & Barcode Printing"
secondary tab for advanced users; the new component is the discoverable primary entry point.

---

## 2. Scope

| In Scope | Out of Scope |
|---|---|
| `PrintLabelsStudio.tsx` (new) | Backend `barcode.py` endpoint changes (none) |
| `BarcodeStudioTab.tsx` default tab change | `TagLabelPrintingTa.tsx`, VisualLabelDesigner, ZPL Compiler |
| ITEMS/Manual source wired to `/products` | GRN/Sales/PO source API calls (future sprint) |
| Printer health from `/barcode/printer-settings` | Dynamic printer list from backend |
| ZPL dispatch via `POST /barcode/print` | Browser PDF preview of label grid |

---

## 3. Files Created

| File | Lines | Purpose |
|---|---|---|
| `src/components/barcode/PrintLabelsStudio.tsx` | 637 | Print Labels Studio wizard component |
| `docs/walkthrough/barcode/Barcode_PrintLabelsStudio_v6.45.0.md` | this | WGP walkthrough |

---

## 4. Files Modified

| File | Change |
|---|---|
| `src/components/barcode/BarcodeStudioTab.tsx` | Added `print-studio` subTab; imported `PrintLabelsStudio` + `LayoutDashboard` icon; "Print Labels Studio" nav button as first/default tab; back-nav in Visual Designer and ZPL Compiler updated to return to `print-studio` |
| `CHANGELOG.md` | [6.45.0] entry added |
| `docs/walkthrough/README.md` | v6.45.0 row prepended |

---

## 5. Architecture Decisions

### AD-1: New Component, Not Extension of TagLabelPrintingTa.tsx

`TagLabelPrintingTa.tsx` is 2823 lines with a complex multi-mode internal state machine (PT file, PDT,
PO, masters, manual, direct scan). Adding a third UI skin would make it untestable. A new self-contained
file provides a clean wizard.

### AD-2: Reuses Existing Backend Endpoints Unchanged

All API calls map to pre-existing routes -- no backend changes required:
- `GET /api/v1/products?search=...` -- product search (Step 2 table)
- `GET /api/v1/barcode/printer-settings` -- printer health badge
- `POST /api/v1/barcode/test-print` -- Test Print button
- `POST /api/v1/barcode/print` -- Print N Labels button (ZPL dispatch)

### AD-3: Import via `../../lib/apiFetch.ts` Alias

All barcode-area components use the canonical alias (`apiFetch.ts` re-exports `apiFetchV1`). The new
component follows the same convention (corrected from `apiFetchV1.ts` direct path in follow-up commit).

### AD-4: SVG Barcode Strip in Label Preview is a Placeholder

The right-sidebar preview renders a deterministic SVG stripe pattern. The real ZPL barcode generation
happens on the printer side. Replacing with JsBarcode/react-barcode is deferred pending dependency approval.

---

## 6. Design Rationale

- **3-step numbered wizard** matches the architect screenshot (circled step numbers 1/2/3).
- **Source tile row** uses icon + label + sub-label pattern (Items/Manual selected with blue border).
- **Fixed-width right sidebar** (w-72 xl:w-80) -- always visible regardless of item count.
- **Quick Filters** auto-populated from first search-result page -- no separate API call.
- **Advanced Filters** collapse behind a chevron -- primary UX stays clean.
- **Print N Labels button** disabled when `totalLabels === 0 || !printerReady || printing`.
- **Inline Print Qty input** triggers row selection automatically on first edit.

---

## 7. Implementation Summary

### Payload sent to POST /api/v1/barcode/print

```json
{
  "layoutId": "<templateId>",
  "items": [
    {
      "code": "<itemCode>",
      "name": "<product>",
      "brand": "<brand>",
      "style": "<style>",
      "size": "<size>",
      "color": "<shade>",
      "barcode": "<barcode>",
      "mrp": 2999,
      "price": 2999,
      "qty": 5
    }
  ]
}
```

Field names match `PrintRequest.items: List[Dict[str, Any]]` in `backend/app/schemas/barcode.py` (line 60).
`layoutId` resolves a `BarcodeLayout` record or falls back to default ZPL template on the backend.

---

## 8. Tests Executed

| Test | Command | Result |
|---|---|---|
| TSC (template literal fix) | `npx tsc --noEmit --skipLibCheck | Select-String PrintLabelsStudio` | **Exit 0** (task-775) |
| TSC (unused import cleanup) | `npx tsc --noEmit --skipLibCheck | Select-String PrintLabelsStudio` | **Exit 0** (task-788) |
| TSC (import path fix) | `npx tsc --noEmit --skipLibCheck | Select-String PrintLabelsStudio` | **Exit 0** (task-815) |
| Git diff new file | `git add -N; git diff HEAD` | 637+ lines confirmed |
| Git diff BarcodeStudioTab | `git diff HEAD` | 4 hunks confirmed |

---

## 9. Verification Results

**Status: Partially Verified**

| Claim | Status | Evidence |
|---|---|---|
| TSC 0 errors (3 sequential checks) | **Done** | task-775, task-788, task-815 all exit 0 |
| Git diff new file confirmed | **Done** | diff output: `new file mode 100644` |
| Git diff BarcodeStudioTab wiring | **Done** | diff output: 4 hunks |
| Import path matches codebase convention | **Done** | Corrected to `../../lib/apiFetch.ts` |
| Runtime browser render | **Unverified** | No dev server session this session |
| POST /barcode/print end-to-end | **Unverified** | Backend not started this session |

---

## 10. Known Limitations

1. SVG barcode preview in sidebar is a visual placeholder, not a real barcode renderer.
2. Source selector tiles (Item Master, Purchase, GRN, Sales, Stock Transfer) are UI-only; only ITEMS/Manual calls `/products`.
3. Advanced Filter dropdowns (product/category/brand/style/shade/size) show only "All"; master lists not fetched.
4. Printer dropdown is static (4 hardcoded options); dynamic list from `/barcode/printer-settings` is deferred.
5. Preview Labels button is not wired.
6. Pagination shows max 5 page buttons.

---

## 11. Future Work

- Wire source tiles (GRN, Sales, PO, Item Master) to respective backend endpoints.
- Populate Advanced Filter dropdowns from master lookup APIs.
- Integrate JsBarcode/react-barcode for a real barcode preview.
- Implement Preview Labels (browser print of generated PDF label grid).
- Fetch printer list dynamically from `/api/v1/barcode/printer-settings`.
- Add `Alt+L` global keyboard shortcut to open Print Labels Studio.

---

## 12. Related ADRs

- ADR-008: Strangler-Fig Migration (FastAPI sole backend)
- ADR-019: Barcode Studio Component Architecture

---

## 13. Related RFCs

- RFC-118: Print Labels Studio 3-Step Wizard UX (architect reference screenshot 2026-09-26)
