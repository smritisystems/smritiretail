<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.85.0
  Created      : 2026-10-16
  Modified     : 2026-10-16
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Procurement Walkthrough: Global SMRITI Image Placeholder & Borderless Clean Layout Integration

## 1. Purpose
Integrate the official SMRITI branded "Image Not Available" artwork (`smriti-image-placeholder.png`) into the Purchase Order print preview and templates, establishing a safe, loop-free fallback when product imagery is missing, empty, or returns an error. Simultaneously eliminate any redundant borders, nested container outlines, or badge decorations around the placeholder artwork to preserve original asset aesthetics and prevent visual clutter.

## 2. Scope
- Public and internal image assets: `public/assets/branding/smriti-image-placeholder.png`, `public/assets/branding/image_not_available_placeholder.png`, `myImages/smriti-image-placeholder.png`, and `myImages/image_not_available_placeholder.png`.
- Purchase Order print template: `src/print_engine/templates/PurchaseOrderPrintA4.tsx`.
- Footwear Purchase Order template: `src/print_engine/templates/FootwearPurchaseOrderA4.tsx`.
- Size Pivot Matrix template: `src/print_engine/templates/SizePivotMatrixA4.tsx`.
- Automated test suite: `src/tests/poPrintBrandingAndTerms.test.tsx`.

## 3. Files Created
- `public/assets/branding/smriti-image-placeholder.png` — Canonical approved branded placeholder artwork (1024x614, 5:3 aspect ratio).
- `myImages/smriti-image-placeholder.png` — Bundler-imported asset copy for Vite/React templates.
- `docs/walkthrough/procurement/Procurement_PO_Global_Placeholder_And_Borderless_Integration_v6.85.0.md` — This walkthrough document.

## 4. Files Modified
- `public/assets/branding/image_not_available_placeholder.png` — Synchronized with the approved 1024x614 asset.
- `myImages/image_not_available_placeholder.png` — Synchronized with the approved 1024x614 asset.
- `src/print_engine/templates/PurchaseOrderPrintA4.tsx` — Updated `GoldenRatioImagePlaceholder` and Item Reference image preview to use 5:3 container ratio, removed double borders, removed floating badge decorations over placeholder, and ensured safe `onError` handling (`imgElem.onerror = null`).
- `src/print_engine/templates/FootwearPurchaseOrderA4.tsx` — Removed nested borders and padding around placeholder image.
- `src/print_engine/templates/SizePivotMatrixA4.tsx` — Removed nested borders and padding around placeholder image.
- `src/tests/poPrintBrandingAndTerms.test.tsx` — Expanded tests to verify 5:3 container, borderless placeholder, original image rendering on valid URL, and fallback on missing/invalid URL.
- `docs/walkthrough/README.md` — Appended walkthrough to chronological master index.

## 5. Architecture Decisions
1. **Asset Proportions & Golden Aspect Ratio Alignment:**
   The approved placeholder artwork has native dimensions of 1024 × 614 px (5:3 aspect ratio = 1.667:1). The PO preview containers were updated to `aspectRatio: "5 / 3"` with `maxHeight: "92px"` and `object-fit: contain` to ensure zero distortion and centered alignment.
2. **Loop-Free Image Error Handler:**
   Whenever a remote `imageUrl` fails or 404s, `onError` reassigns `imgElem.src = smritiImagePlaceholder` and immediately unsets `imgElem.onerror = null`, eliminating infinite retry loops.
3. **Borderless Clean Aesthetic Policy:**
   Because the approved artwork includes its own rounded card contour, all outer container borders (`border-slate-200`) and overlay badges (`absolute bottom-1 right-1.5 ...`) were removed. The article number remains displayed in the card header, avoiding visual collision.

## 6. Design Rationale
- Embedding article codes as dark pill badges directly on top of the placeholder degraded the readability of the SMRITI logo and `smritisys.com` footer URL.
- A 5:3 ratio container with `object-fit: contain` perfectly preserves high-DPI rendering for both screen viewports and A4 portrait physical print/PDF exports.

## 7. Implementation Summary
- Copied user-approved image `media_1792127683765.png` to canonical repository asset paths.
- Updated `PurchaseOrderPrintA4.tsx` to cleanly toggle between authentic product URLs and `smritiImagePlaceholder`.
- Removed borders and decorations around placeholder in all PO print templates.
- Validated via Vitest unit tests and TypeScript compiler.

## 8. Tests Executed
```bash
npx vitest run src/tests/poPrintBrandingAndTerms.test.tsx
npx vitest run src/tests/poSizewiseGrouping.test.tsx
npx tsc --noEmit
```

## 9. Verification Results
- `src/tests/poPrintBrandingAndTerms.test.tsx`: 7/7 tests passed (0 failures).
- `src/tests/poSizewiseGrouping.test.tsx`: 6/6 tests passed (0 failures).
- `npx tsc --noEmit`: Exited with code 0, 0 compiler errors.

## 10. Known Limitations
- Does not automatically backfill images on remote CDN endpoints; missing images will display the clean placeholder until an operator uploads a product image.

## 11. Future Work
- Add client-side pre-fetch probe before rendering image thumbnails in high-throughput Lookbook mode.

## 12. Related ADRs
- `ADR-048`: Universal PO Print Architecture and Company Branding Governance.

## 13. Related RFCs
- `RFC-2026-PO-IMG-01`: Standardized Product Image Fallback and Brand Consistency.
