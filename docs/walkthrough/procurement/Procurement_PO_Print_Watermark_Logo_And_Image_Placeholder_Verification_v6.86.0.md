<!--
  Project      : SMRITI Retail OS
  Repository   : SMRITIRetailNX
  Organization : AITDL NETWORKS

  Founders

  * Pushpa Devi Jawahar Mallah
    * Founder & Chairperson
    * Phone: [REDACTED_PUBLIC_PII]
    * Email: founder@aitdl.com

  * Jawahar Ramkripal Mallah
    * Founder, Chief Executive Officer (CEO) & Chief Software Architect
    * Email: founder@aitdl.com

  * Websites: aitdl.com | erpnbook.com | smritibooks.com

  * Version    : 6.86.0
  * Created    : 2026-10-16
  * Copyright  : © SMRITIBooks.com. All Rights Reserved.
  * License    : Proprietary Commercial Software
  * Classification: Internal
-->

# Walkthrough: Purchase Order Print Watermark Logo and Image Placeholder Verification

**Area:** Procurement & PO Print Engine  
**Topic:** Tattly Threads Logo Watermark & SMRITI Branded Image Placeholder Integration  
**Version:** v6.86.0  
**Date:** 2026-10-16  
**Status:** Completed  

---

## 1. Purpose
This walkthrough documents the investigation, root-cause analysis, and end-to-end resolution of two visual and structural issues reported in Purchase Order print preview and printouts:
1. SMRITI branded "Image Not Available" placeholders missing or failing to display in print preview and physical prints.
2. Tattly Threads corporate logo watermark missing in PO print and preview across print templates.

---

## 2. Scope
- Static asset placement: ensuring placeholder graphics (`smriti-image-placeholder.png`, `image_not_available_placeholder.png`) and company logo (`tattly_logo_black.png`) are located in both `public/` and `public/assets/branding/`.
- Print engine templates:
  - `src/print_engine/templates/PurchaseOrderPrintA4.tsx`
  - `src/print_engine/templates/FootwearPurchaseOrderA4.tsx`
  - `src/print_engine/templates/SizePivotMatrixA4.tsx`
- Modal integration: `src/components/purchase/POPrintPreviewModal.tsx`.
- Automated test verification: `src/tests/poPrintBrandingAndTerms.test.tsx`.

---

## 3. Files Created
- `public/smriti-image-placeholder.png` — Canonical static asset copy for root resolution.
- `public/image_not_available_placeholder.png` — Static alias copy for root resolution.
- `public/tattly_logo_black.png` — Canonical static logo for root resolution.
- `public/assets/branding/tattly_logo_black.png` — Static asset copy under branding subdirectory.
- `docs/walkthrough/procurement/Procurement_PO_Print_Watermark_Logo_And_Image_Placeholder_Verification_v6.86.0.md` — This WGP walkthrough.

---

## 4. Files Modified
- `src/print_engine/templates/PurchaseOrderPrintA4.tsx`:
  - Enriched watermark to render the authentic Tattly Threads logo (`tattlyLogoBlack` / `/tattly_logo_black.png`), company name, and document status stamp.
  - Adjusted watermark opacity from `0.035` (faint/invisible) to `0.07` (`print:opacity-[0.08]`) with `mix-blend-multiply` and `z-20` so it floats gracefully over table and card backgrounds without being occluded by solid white card backgrounds.
  - Added robust static fallback chaining to `GoldenRatioImagePlaceholder` and `onError` handlers (`smritiImagePlaceholder || "/smriti-image-placeholder.png"` -> `"/assets/branding/smriti-image-placeholder.png"`).
  - Added automatic line item reference derivation from `sizewiseItems` or `standardItems` when explicit `itemReferences` is empty, guaranteeing reference cards with placeholders are never dropped.
- `src/print_engine/templates/FootwearPurchaseOrderA4.tsx`:
  - Added Tattly Threads logo watermark with `0.07` / `0.08` print opacity.
  - Added static asset fallback chain on footwear photo cells and missing photo placeholders.
- `src/print_engine/templates/SizePivotMatrixA4.tsx`:
  - Added Tattly Threads logo watermark with `0.07` / `0.08` print opacity.
  - Added static asset fallback chain on pivot photo column.
- `src/components/purchase/POPrintPreviewModal.tsx`:
  - Enriched `mappedItemReferences` to parse `itemCode`, `style`, and `barcode` fallbacks in addition to `articleNo` and `stockNo`.
- `src/tests/poPrintBrandingAndTerms.test.tsx`:
  - Added assertion verifying Tattly Threads logo image is present in document watermark.
  - Added Test 8 verifying automatic reference derivation and placeholder rendering when `itemReferences` is empty.

---

## 5. Architecture Decisions
- **Static Public Asset Parity:** Assets loaded via Vite imports from outside `src` (`myImages/`) can face origin or bundling boundaries in production (`https://tattlythreads.smritisys.com/`) and popup/iframe print windows. Placing identical assets into Vite's `public/` directory ensures `/tattly_logo_black.png` and `/smriti-image-placeholder.png` are unconditionally accessible at runtime.
- **Watermark Layering via `mix-blend-multiply`:** Positioning the watermark at `z-0` resulted in it being completely hidden behind the opaque white backgrounds of document tables and cards (`bg-white`, `bg-[#f8fafc]`). Moving the watermark to `z-20` with `pointer-events-none` and `mix-blend-multiply` allows it to overlay the document cleanly on white paper and canvas without obscuring dark text or blocking user interactions.
- **Fail-Safe Fallback Chaining:** Image elements utilize multi-tier fallback: Vite bundled asset -> `/smriti-image-placeholder.png` -> `/assets/branding/smriti-image-placeholder.png` with loop-free termination (`img.onerror = null`).

---

## 6. Design Rationale
- Opacity of `0.035` was mathematically too low for physical laser and inkjet printers (which threshold drop dots below ~5% density), causing watermarks to vanish in paper prints. Raising opacity to `0.07` on screen and `0.08` in print balances distinct watermark visibility with 100% typographic legibility of numbers and text.
- When purchase orders are opened without explicit pre-computed catalog lookups, auto-deriving references from active line items ensures the approved "ITEM REFERENCE (IMAGES)" lookbook section always appears with 5:3 golden ratio placeholders rather than displaying an empty dashed box.

---

## 7. Implementation Summary
- Copied required assets to `public/` and `public/assets/branding/`.
- Updated all three print templates (`PurchaseOrderPrintA4.tsx`, `FootwearPurchaseOrderA4.tsx`, `SizePivotMatrixA4.tsx`).
- Hardened `POPrintPreviewModal.tsx` mapping logic.
- Expanded Vitest test suite in `poPrintBrandingAndTerms.test.tsx` to 8/8 passing tests.
- Re-ran TypeScript compiler (`tsc --noEmit`), certifying 0 errors.

---

## 8. Tests Executed
```bash
npx vitest run src/tests/poPrintBrandingAndTerms.test.tsx
npx tsc --noEmit
npm run lint
```

---

## 9. Verification Results
- `src/tests/poPrintBrandingAndTerms.test.tsx`: 8 passed (8 tests), duration 508ms.
- `npx tsc --noEmit`: exit code 0, 0 compiler errors.
- `npm run lint`: exit code 0, 0 linter errors.

---

## 10. Known Limitations
- The watermark opacity is configured for standard white paper. On dark preview themes, the modal canvas maintains a white sheet wrapper (`bg-white`) ensuring consistent contrast.

---

## 11. Future Work
- Optional tenant-configurable watermark opacity slider in the print preview toolbar.

---

## 12. Related ADRs
- ADR-014: Print Engine Architecture & A4 Statutory Compliance.
- ADR-042: SMRITI Dual-Key System Parameter Governance.

---

## 13. Related RFCs
- RFC-2026-PO-PRINT-BRANDING
