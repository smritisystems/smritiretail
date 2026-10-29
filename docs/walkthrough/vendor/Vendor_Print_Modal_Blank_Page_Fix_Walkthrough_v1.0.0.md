<!--
  Project      : SMRITI Retail OS
  Repository   : SMRITIRetailNX
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.99.12
  Created      : 2026-10-29
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Walkthrough Document
-->

# Walkthrough: Vendor Form Print & Export Studio Blank Print Fix

## 1. Purpose
To eliminate the blank print preview failure in `VendorPrintModal.tsx` when operators attempt to print either a filled vendor dossier or a blank KYC application form. Replaces the displaced portal structure with the unified print architecture proven in `POPrintPreviewModal.tsx`.

## 2. Scope
- Component: `src/components/vendor/VendorPrintModal.tsx`
- Styles: `src/index.css`
- Verification Suite: `src/tests/vendorPrintModal.test.tsx`
- Documentation: `CHANGELOG.md`, `docs/walkthrough/README.md`

## 3. Files Created
- `src/tests/vendorPrintModal.test.tsx`
- `docs/walkthrough/vendor/Vendor_Print_Modal_Blank_Page_Fix_Walkthrough_v1.0.0.md`

## 4. Files Modified
- `src/components/vendor/VendorPrintModal.tsx`
- `src/index.css`
- `CHANGELOG.md`
- `docs/walkthrough/README.md`

## 5. Architecture Decisions
1. **Modal Body Portaling & Single Document Tree**: The entire preview modal mounts directly into `document.body` via `createPortal(modalContent, document.body)`. This guarantees that `#root` is a sibling, not an ancestor or parent of the print container.
2. **Explicit `#root` Display Suppression**: During `@media print`, `#root { display: none !important; }` removes the entire main application viewport from document flow, eliminating invisible 100vh height displacement.
3. **Static Layout Restoration**: `.vendor-print-modal-root`, `.vendor-print-canvas-wrapper`, and `.vendor-printable-sheet` are transformed from screen fixed/overflow containers into `position: static !important; display: block !important; overflow: visible !important;` with zero margins and shadows.
4. **Global `.print-only-container` Display Parity**: Added `display: block !important;` to `.print-only-container` under `@media print` in `src/index.css` to override `@media screen { display: none !important; }`.
5. **Universal Keyboard Shortcuts**: Added `Escape` (close) and `F9` / `Ctrl+P` (instant print) listeners for ergonomic operator parity with Purchase Order printing.

## 6. Design Rationale
- **Root Cause of Blank Print**:
  1. The screen modal was wrapped in `no-print`, which applied `display: none` during print.
  2. The separate portal (`#smriti-vendor-print-root`) relied on `.print-only-container`. In `src/index.css`, `@media screen` had `.print-only-container { display: none !important; }`, but `@media print` only set `visibility: visible` without setting `display: block !important;`. In Chromium/Blink, `visibility: visible` cannot override `display: none !important`.
  3. `#root` had `visibility: hidden`, leaving its 100vh layout box in the normal flow. Since the portal had `position: relative`, it was placed below `#root` onto Page 2, causing the browser to render a single empty blank page.
- **Unified Gold Standard**: Adopting the proven architectural pattern from `POPrintPreviewModal.tsx` unifies print rendering across the enterprise.

## 7. Implementation Summary
- Upgraded `VendorPrintModal.tsx`:
  - Replaced legacy dual-portal structure with single unified `createPortal(modalContent, document.body)`.
  - Added embedded `@media print` style sheet declaring `@page { size: A4 portrait; margin: 8mm 10mm 10mm 10mm; }`, `#root { display: none !important; }`, and `.vendor-print-toolbar { display: none !important; }`.
  - Added `customCompanyName?: string` property supporting deterministic testing and tenant overrides.
  - Added `Escape`, `F9`, and `Ctrl+P` keyboard shortcut handlers.
- Upgraded `src/index.css`:
  - Added `display: block !important;` to `.print-only-container` under `@media print`.

## 8. Tests Executed
1. `src/tests/vendorPrintModal.test.tsx`:
   - `1. returns null when modal is not open (isOpen=false)`
   - `2. strictly blocks printing when statutory company identity is not configured`
   - `3. unblocks printing and renders document sheet when statutory company identity is present`
   - `4. embeds @media print CSS with #root { display: none !important; } and modal positioning`
   - `5. renders filled vendor dossier in With Data mode`
   - `6. renders blank onboarding application form when without data`
   - `7. renders print button with enabled state and correct testid`
2. `src/tests/poPrintCorporateIdentityUnblocking.test.tsx`:
   - 7/7 regression tests green.

## 9. Verification Results
- 7/7 automated Vitest tests passed in `src/tests/vendorPrintModal.test.tsx` (151ms).
- 7/7 automated Vitest tests passed in `src/tests/poPrintCorporateIdentityUnblocking.test.tsx` (128ms).

## 10. Known Limitations
- Background colors and headers require the user to leave "Background graphics" checked in the browser print dialog (enabled by default in modern Chrome/Edge).

## 11. Future Work
- Add multi-page pagination indicators for vendors with more than 10 banking accounts or more than 15 branch addresses.

## 12. Related ADRs
- `ADR-VEND-01`: Vendor Master Capability-Driven Workspace & Dossier Architecture

## 13. Related RFCs
- `RFC-PRINT-002`: SMRITI Enterprise React Print Engine Unified Portal & Flow Standard
