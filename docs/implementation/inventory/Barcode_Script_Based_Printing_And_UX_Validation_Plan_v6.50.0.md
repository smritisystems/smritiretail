<!--
  Project      : SMRITI Retail OS
  Repository   : SMRITIRetailNX
  Organization : AITDL NETWORKS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.50.0
  Created      : 2026-10-10
  Modified     : 2026-10-10
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Implementation Plan: SMRITI Barcode Studio Script-Based PRN Printing & Front-End UX Validation (v6.50.0)

## 1. Objective
Enable true script-driven barcode and tag printing based on user-browsed `.prn`, `.zpl`, or `.blf` files with dynamic token interpolation, resolve the critical viewport footer clipping bug, expand data grid column formatting, and wire native POS keyboard shortcuts.

---

## 2. Business Motivation
Store operators receive pre-configured label scripts from apparel and footwear brands. Previously, browsing custom files was cosmetic—the actual file contents were ignored in favor of hardcoded server templates. Delivering real client-side script compilation allows operators to immediately print custom supplier designs with zero backend configuration drift.

---

## 3. Scope
- Ingestion of custom template text from client file upload events.
- Client-side token replacement (`{style_code}`, `{barcode}`, `{colour}`, `{size}`, `{mrp}`, `{brand}`) across multiple copies.
- Elimination of viewport-pinned footer collision with the SMRITI global status bar.
- Prevention of premature text truncation on data grid columns.
- Addition of native `[F8]`, `[F7]`, and `[F11]` keyboard hotkeys.

---

## 4. Current State
- `TagLabelPrintingTa.tsx` captured only `file.name` upon file selection, discarding file contents.
- `handleExecutePrintDispatch` only routed to `"tattly-threads-footwear-100x50.7"` or `"retail-50x25"`.
- Action footer used `fixed bottom-0`, cutting off buttons on standard desktop viewports.
- Product descriptions were capped at `max-w-[160px]`, causing unnecessary truncation (`Tattly Threads Footw...`).

---

## 5. Gap Analysis
1. Missing template text storage in `LabelPrintSettings`.
2. Lack of dynamic token interpolator for custom scripts.
3. Hardcoded print job dispatch ignoring uploaded scripts.
4. CSS fixed positioning conflict with global application shell.
5. Inaccessible hotkey shortcuts without physical keydown bindings.

---

## 6. Architecture Impact
- Introduction of `prnInterpolation.ts` utility providing client-side token substitution and protocol detection.
- Clean isolation between template file ingestion and printer spooling.
- Flexbox-constrained UI layout avoiding z-index and viewport coordinate collisions.

---

## 7. Proposed Design
1. Extend `LabelPrintSettings` with `customScriptContent?: string`.
2. Implement `interpolatePrnScript`, `compilePrnBatch`, and `detectPrnProtocol`.
3. Read file text asynchronously via `await file.text()` in `fileInputRef`.
4. Replace server template routing with compiled client-side stream if custom script is active.
5. Switch footer to container-scoped `shrink-0` flex element.
6. Register window `keydown` listener for `F8`, `F7`, and `F11`.

---

## 8. Files Created
- `src/components/barcode/prnInterpolation.ts`
- `src/tests/prnInterpolation.test.ts`
- `docs/walkthrough/barcode/Barcode_Script_Based_Printing_And_UX_Validation_Walkthrough_v6.50.0.md`
- `docs/implementation/inventory/Barcode_Script_Based_Printing_And_UX_Validation_Plan_v6.50.0.md`

---

## 9. Files Modified
- `src/components/barcode/types.ts`
- `src/components/barcode/TagLabelPrintingTa.tsx`
- `docs/walkthrough/README.md`
- `docs/implementation/README.md`
- `CHANGELOG.md`

---

## 10. Dependencies
- Vitest test runner.
- QZ Tray WebSocket daemon (optional hardware target).

---

## 11. Risks
- Malformed custom PRN scripts uploaded by users might lack valid printer syntax.
- **Mitigation:** The protocol detector validates command prefixes and provides clean notifications without crashing the UI.

---

## 12. Rollback Strategy
If script interpolation encounters edge cases, users can click the "Clear" button beside the template selector to immediately fall back to the standard built-in layout compiler.

---

## 13. Verification Plan
- Unit tests asserting token replacements for both bracket and hash syntax.
- Regression tests validating grid filtering, quantity calculations, and safety gates.
- TypeScript Monorepo compilation check (`npx tsc --noEmit`).

---

## 14. Test Plan
- `vitest run src/tests/prnInterpolation.test.ts`
- `vitest run src/tests/tagPrinting.test.ts`
- `vitest run src/tests/printLabelsStudio.test.ts`
- `pytest backend/tests/test_zpl_footwear_label.py`

---

## 15. Documentation Impact
- Walkthrough document created in `docs/walkthrough/barcode/`.
- Master index updated in `docs/walkthrough/README.md`.
- Implementation index updated in `docs/implementation/README.md`.
- CHANGELOG updated with version 6.50.0.

---

## 16. Deployment Plan
Pure frontend component update with backward-compatible types. Zero database migrations or schema alterations required.

---

## 17. Status
`Completed`

---

## 18. Related ADRs
- `ADR-048`: Client-Side Multi-Protocol Thermal Printing Abstraction.
- `ADR-062`: POS Keyboard Ergonomics & Single-Key Transaction Routing.

---

## 19. Related Walkthroughs
- `docs/walkthrough/barcode/Barcode_Script_Based_Printing_And_UX_Validation_Walkthrough_v6.50.0.md`
