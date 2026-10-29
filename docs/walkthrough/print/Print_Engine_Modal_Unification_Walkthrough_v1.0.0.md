<!--
  Project      : SMRITI Retail OS
  Repository   : SMRITIRetailNX
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.99.13
  Created      : 2026-10-29
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Walkthrough Document
-->

# Walkthrough: SMRITI Print Engine Platform-Wide Modal Unification & Layout Safety

## 1. Purpose
To systematically unify print preview modals across SMRITI Retail OS (`GrnPrintModal.tsx`, `StaffPrintModal.tsx`, alongside `VendorPrintModal.tsx` and `POPrintPreviewModal.tsx`), establishing a hardened architecture that prevents blank print previews, viewport height displacements, and dual-tree rendering bugs across all browser native print workflows (`window.print()`).

## 2. Scope
- Components:
  - `src/components/purchase/GrnPrintModal.tsx` (Goods Receipt Note & Landed Cost Receiving Slip)
  - `src/components/staff/StaffPrintModal.tsx` (Staff Registration Form & CR-80 Physical ID Card)
- Verification Suites:
  - `src/tests/staffPrintModal.test.tsx` (New automated test suite)
  - `src/tests/grnLogisticsAndTerms.test.tsx` (Regression suite)
  - `src/tests/vendorPrintModal.test.tsx` (Regression suite)
  - `src/tests/poPrintCorporateIdentityUnblocking.test.tsx` (Regression suite)
- Documentation:
  - `CHANGELOG.md`
  - `docs/walkthrough/README.md`

## 3. Files Created
- `src/tests/staffPrintModal.test.tsx`
- `docs/walkthrough/print/Print_Engine_Modal_Unification_Walkthrough_v1.0.0.md`

## 4. Files Modified
- `src/components/purchase/GrnPrintModal.tsx`
- `src/components/staff/StaffPrintModal.tsx`
- `CHANGELOG.md`
- `docs/walkthrough/README.md`

## 5. Architecture Decisions
1. **Single-Tree Body Mounting (`createPortal`)**: Modals mount their primary UI container directly into `document.body`, completely eliminating the fragile legacy dual-portal pattern where a screen modal was rendered inside `#root` while a duplicate document clone was appended to `document.body`.
2. **Deterministic `#root` Flow Suppression**: Active modals inject `@media print { #root { display: none !important; } }`. In Chromium/Blink, this guarantees that `#root` generates zero formatting boxes during print layout, preventing full-viewport height displacement from pushing documents onto subsequent pages.
3. **Static Layout & Flow Restoration**: Modal roots, canvas viewports, and printable sheet containers automatically unroll into static block elements (`position: static !important; display: block !important; overflow: visible !important; width: 100% !important;`) with zero margins, shadows, or zoom transforms.
4. **Universal Keyboard Ergonomics**: Bound `Escape` (close preview) and `F9` / `Ctrl+P` (instant print) listeners across all modals.
5. **Dynamic `@page` Configuration**: In `StaffPrintModal.tsx`, dynamically adjusts `@page` between `A4 portrait` (for standard registration forms) and `85.6mm 53.98mm` with `margin: 0` (for CR-80 plastic badge printing).

## 6. Design Rationale
- Dual-tree portal duplication previously resulted in state divergence, excess DOM memory overhead, and severe blank page rendering when `@media print` rules failed to resolve `display: none !important;` vs `visibility: hidden;`.
- Centralizing on the unified portal pattern proven in `POPrintPreviewModal.tsx` eliminates legacy technical debt and delivers platform-wide printing reliability.

## 7. Implementation Summary
- **`GrnPrintModal.tsx`**:
  - Replaced legacy dual-portal with single `createPortal(modalContent, document.body)`.
  - Added embedded `@media print` CSS block with `#root { display: none !important; }`.
  - Upgraded toolbar and canvas wrapper with print-safe utility classes (`print:hidden`, `print:overflow-visible`).
- **`StaffPrintModal.tsx`**:
  - Replaced legacy dual-portal with single `createPortal(modalContent, document.body)`.
  - Added embedded `@media print` CSS with dynamic CR-80 badge vs A4 form `@page` sizing.
  - Added `Escape` and `F9` / `Ctrl+P` keyboard event listeners.
  - Added `customCompanyName?: string` property for testing and tenant overrides.
  - Included company legal name in the registration document subtitle.

## 8. Tests Executed
1. `src/tests/staffPrintModal.test.tsx`:
   - 6/6 tests passing (null gate, fail-closed blocking, filled data rendering, blank registration form, print CSS rules, print button state).
2. `src/tests/grnLogisticsAndTerms.test.tsx`:
   - 4/4 tests passing.
3. `src/tests/vendorPrintModal.test.tsx`:
   - 7/7 tests passing.
4. `src/tests/poPrintCorporateIdentityUnblocking.test.tsx`:
   - 7/7 tests passing.

## 9. Verification Results
- 24/24 tests green across the unified print test suite.
- TypeScript compiler static check (`npx tsc --noEmit`) clean with 0 errors.

## 10. Known Limitations
- Thermal receipt printing (POS / ProPOS) uses continuous roll drivers rather than page-based A4/CR-80 modals and is handled via dedicated raw slip ESC/POS formatters.

## 11. Future Work
- Consolidate common `@media print` style string generators into a shared helper `createPrintStyles({ pageSize, margins })` under `src/print_engine/`.

## 12. Related ADRs
- `ADR-PRINT-01`: SMRITI Enterprise Print Architecture & Single-Tree Body Portal Standard

## 13. Related RFCs
- `RFC-PRINT-002`: SMRITI Enterprise React Print Engine Unified Portal & Flow Standard
