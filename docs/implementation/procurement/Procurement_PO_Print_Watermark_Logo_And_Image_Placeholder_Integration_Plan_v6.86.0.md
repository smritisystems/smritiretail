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

# Implementation Plan: Purchase Order Print Watermark Logo & Image Placeholder Integration

**Area:** Procurement & PO Print Engine  
**Topic:** Tattly Threads Logo Watermark & SMRITI Branded Image Placeholder Integration  
**Version:** v6.86.0  
**Date:** 2026-10-16  
**Status:** Completed  

---

## 1. Objective
Eliminate visual and asset resolution regressions in Purchase Order print preview and physical A4 printouts by ensuring the SMRITI branded "Image Not Available" placeholder and Tattly Threads corporate logo watermark render with 100% reliability, proper layering, and optimal print opacity across dev and production environments.

---

## 2. Business Motivation
The Purchase Order is a legally binding commercial contract and vendor-facing brand showcase. Missing image placeholders produce unsightly broken image icons or collapse lookbook cards, while an invisible watermark lacks brand authority and anti-counterfeiting protection. Providing a crisp, elegant watermark with the Tattly Threads logo and robust image placeholders elevates print professionalism and satisfies footwear sourcing standards.

---

## 3. Scope
- Static asset placement in `public/` and `public/assets/branding/`.
- Print templates:
  - `PurchaseOrderPrintA4.tsx`
  - `FootwearPurchaseOrderA4.tsx`
  - `SizePivotMatrixA4.tsx`
- Modal integration: `POPrintPreviewModal.tsx`.
- Automated test suite: `src/tests/poPrintBrandingAndTerms.test.tsx`.

---

## 4. Current State
- `smriti-image-placeholder.png` and `tattly_logo_black.png` resided only in `myImages/`.
- Watermark in `PurchaseOrderPrintA4.tsx` contained only text, had no logo image, had faint `0.035` opacity, and was occluded behind opaque white table containers at `z-0`.
- Templates `FootwearPurchaseOrderA4.tsx` and `SizePivotMatrixA4.tsx` had no watermark.
- Missing lines in `itemReferences` suppressed the entire 2-column image preview grid.

---

## 5. Gap Analysis
1. Asset Accessibility Gap: Files outside `public/` are not guaranteed to resolve via absolute static paths in production or print popups.
2. Graphic Watermark Gap: Lack of logo graphic in the watermark stamp violated brand identity guidelines.
3. Contrast & Layering Gap: 3.5% opacity is below printer dot thresholds, and `z-0` placement allows white table cells to blot out watermarks.
4. Line Item Fallback Gap: Empty `itemReferences` dropped the reference section entirely instead of rendering placeholders for active lines.

---

## 6. Architecture Impact
- Zero database schema migrations or backend mutations required.
- Purely presentation and asset pipeline hardening.
- Establishes canonical static asset paths (`/smriti-image-placeholder.png`, `/tattly_logo_black.png`).
- Introduces `mix-blend-multiply` with `z-20` overlay pattern for watermark printing.

---

## 7. Proposed Design
- Copy assets to `public/` and `public/assets/branding/`.
- Structure watermark with:
  - `tattlyLogoBlack` logo graphic (`w-36 h-auto max-h-20`).
  - Company name "TATTLY THREADS".
  - Document status stamp ("PURCHASE ORDER" or "PURCHASE ORDER — DRAFT").
  - Opacity `0.07` (`print:opacity-[0.08]`), `mix-blend-multiply`, `pointer-events-none`, `z-20`.
- Chain image error handlers: bundled asset -> `/smriti-image-placeholder.png` -> `/assets/branding/smriti-image-placeholder.png`.
- Auto-derive item references from `sizewiseItems` or `standardItems` when `itemReferences` is empty.

---

## 8. Files Created
- `public/smriti-image-placeholder.png`
- `public/image_not_available_placeholder.png`
- `public/tattly_logo_black.png`
- `public/assets/branding/tattly_logo_black.png`
- `docs/implementation/procurement/Procurement_PO_Print_Watermark_Logo_And_Image_Placeholder_Integration_Plan_v6.86.0.md`

---

## 9. Files Modified
- `src/print_engine/templates/PurchaseOrderPrintA4.tsx`
- `src/print_engine/templates/FootwearPurchaseOrderA4.tsx`
- `src/print_engine/templates/SizePivotMatrixA4.tsx`
- `src/components/purchase/POPrintPreviewModal.tsx`
- `src/tests/poPrintBrandingAndTerms.test.tsx`
- `docs/walkthrough/README.md`
- `docs/implementation/README.md`
- `CHANGELOG.md`

---

## 10. Dependencies
- Vite static asset serving via `public/`.
- Vitest test runner.
- Tailwind CSS print utilities (`print:opacity-*`, `mix-blend-multiply`).

---

## 11. Risks
- Risk: Watermark obscuring high-density text in complex sizewise tables.
  - Mitigation: `opacity-[0.07] print:opacity-[0.08]` with `mix-blend-multiply` ensures black text stays 100% black and legible.

---

## 12. Rollback Strategy
- Changes are fully tracked in Git. Reverting template edits restores previous text-only watermark and bundled-only asset paths.

---

## 13. Verification Plan
- Unit testing with Vitest (`poPrintBrandingAndTerms.test.tsx`).
- Type check with `tsc --noEmit`.
- Linter verification with `npm run lint`.
- Browser rendering inspection of print preview and print CSS layout.

---

## 14. Test Plan
- Test 1: Verify company coordinates and logo in header.
- Test 2: Verify background watermark renders Tattly Threads logo graphic.
- Test 3: Verify GoldenRatioImagePlaceholder renders official graphic without borders.
- Test 4: Verify auto-derivation of item references when `itemReferences` is empty.
- Test 5: Verify 120-day payment terms defaulting.
- Test 6: Verify 5% statutory footwear GST calculation.

---

## 15. Documentation Impact
- Walkthrough: `docs/walkthrough/procurement/Procurement_PO_Print_Watermark_Logo_And_Image_Placeholder_Verification_v6.86.0.md`.
- Indices: `docs/walkthrough/README.md` and `docs/implementation/README.md`.
- Release notes: `CHANGELOG.md` [6.86.0].

---

## 16. Deployment Plan
- Commit changes to repository.
- Deploy to test environment via `git pull` per environment rule.
- Build production bundle with `npm run build`.

---

## 17. Status
Completed

---

## 18. Related ADRs
- ADR-014: Print Engine Architecture & A4 Statutory Compliance.
- ADR-042: SMRITI Dual-Key System Parameter Governance.

---

## 19. Related Walkthroughs
- [Procurement_PO_Print_Watermark_Logo_And_Image_Placeholder_Verification_v6.86.0.md](../../walkthrough/procurement/Procurement_PO_Print_Watermark_Logo_And_Image_Placeholder_Verification_v6.86.0.md)
