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

  * Version    : 6.84.1
  * Created    : 2026-10-16
  * Modified   : 2026-10-16
  * Copyright  : © SMRITIBooks.com. All Rights Reserved.
  * License    : Proprietary Commercial Software
  * Classification: Internal
-->

# Walkthrough: Purchase Order Print Format Modernization — Branding, 120-Day Payment Terms, Official Image Placeholder & Sizewise Matrix Grouping

**Document ID:** `SMRITI-WGP-PROC-20261016-01`  
**Area:** Procurement & PO Print Engine (`procurement`)  
**Version:** `v6.84.1`  
**Date:** 2026-10-16  
**Status:** Completed & Certified  
**Classification:** Internal System Walkthrough  

---

## 1. Purpose
This walkthrough documents the comprehensive visual, statutory, and architectural remediation of the SMRITI Retail OS Purchase Order print format and preview pipeline. It establishes authentic corporate branding for Tattly Threads, enforces statutory 120-Day commercial payment terms across all layers, deploys the official "Image Not Available" placeholder graphic across all templates and error states, and resolves the sizewise row duplication defect by consolidating discrete per-size SKUs into a unified Article + Color matrix.

---

## 2. Scope
1. **Corporate Identity & Branding:** Replaced mock "SMRITI Retail Private Limited" text and Bengaluru address with the official Tattly Threads brand logo, registered Mumbai corporate address, GSTIN (`27AAXFT2508H1ZR`), PAN (`AAXFT2508H`), website, accounts email, and document background watermark (`rotate-[-28deg]`).
2. **Payment Terms Standardization:** Upgraded vendor master defaults, backend Pydantic schemas, and frontend PO creation workspaces to strictly default to **120 Days**. Synchronized all live suppliers on `https://tattlythreads.smritisys.com/` with 120-day terms and authentic addresses.
3. **Official Image Placeholder:** Ingested the client's official graphic (`image_not_available_placeholder.png`) and established it as the canonical image fallback and `onError` handler across `PurchaseOrderPrintA4`, `FootwearPurchaseOrderA4`, and `SizePivotMatrixA4`.
4. **Sizewise Table Grouping:** Consolidated multiple discrete single-size SKU lines sharing the same Article No. and Color into a single horizontal matrix row, correctly populating EU size columns 36–44, calculating Total Quantity, and preserving rates, 5% footwear GST, and taxable values.
5. **System-of-Record Preservation:** Guaranteed zero mutation to underlying transactional records in PostgreSQL (`purchase_orders`, `purchase_order_lines`, `stock_movements`).

---

## 3. Files Created
1. `myImages/image_not_available_placeholder.png` — Canonical image asset for missing product photos.
2. `public/assets/branding/image_not_available_placeholder.png` — Public static asset copy for runtime web delivery.
3. `src/tests/poPrintBrandingAndTerms.test.tsx` — Vitest suite verifying corporate branding, watermarks, 120-day terms, and 5% GST calculations (5/5 passing).
4. `src/tests/poSizewiseGrouping.test.tsx` — Vitest suite verifying sizewise matrix grouping, size curve population, and color isolation (4/4 passing).

---

## 4. Files Modified
1. `src/print_engine/templates/PurchaseOrderPrintA4.tsx` — Added brand logo, Tattly Threads header coordinates, background watermark, dynamic 5% GST computation, official image placeholder container, and defensive `useMemo` grouping by `Article No. + Color`.
2. `src/print_engine/templates/FootwearPurchaseOrderA4.tsx` — Replaced raw SVG with official placeholder graphic and added `onError` fallback.
3. `src/print_engine/templates/SizePivotMatrixA4.tsx` — Replaced "No Pic" text with official placeholder graphic and added `Article No. + Color` grouping.
4. `src/components/purchase/POPrintPreviewModal.tsx` — Grouped `validRows`, `lineItems`, and `mappedFootwearItems` by `Article No. + Color` composite key and harmonized fallback branding.
5. `src/components/purchase/PoSizewiseTab.tsx` — Updated default payment terms to 120 Days and added placeholder previews to image modal and table thumbnails.
6. `src/components/purchase/PoGenerateTab.tsx` — Updated default payment terms to 120 Days.
7. `backend/app/services/purchase.py` — Updated supplier profile default payment terms days from 30 to 120.
8. `backend/app/schemas/purchase.py` — Updated `SupplierResponse` schema default payment terms to 120 Days.
9. `backend/app/schemas/vendor.py` — Updated `VendorCommercialProfileDTO` default payment terms to 120 Days.
10. `backend/app/schemas/party_master.py` — Updated `SupplierProfileData` default payment terms to 120 Days.
11. `docs/walkthrough/README.md` — Appended walkthrough record to master registry.

---

## 5. Architecture Decisions
- **ADR-PROC-084-1 (Two-Tier View-Layer Consolidation):** Grouping is implemented both in `POPrintPreviewModal.tsx` (payload layer) and inside `PurchaseOrderPrintA4.tsx` (defensive template layer) using composite key `${articleNo.toUpperCase()}:::${color.toUpperCase()}`. This ensures that regardless of whether the print format is called from the UI modal or headless PDF generator, duplicate rows are prevented.
- **ADR-PROC-084-2 (System of Record Immutability):** Operational PO lines in PostgreSQL remain at SKU/barcode granularity. This preserves relational integrity for Goods Receipt Notes (GRN), warehouse barcode scanning, and serial/variant inventory movements while delivering a clean matrix format to suppliers.

---

## 6. Design Rationale
Footwear procurement contracts are traded by article style and color with an agreed size run (e.g. EU 36–44). Displaying one row per size artificially expanded a 4-article PO into 24 confusing rows on printouts. Consolidating rows at the display layer provides a clean, professional supplier-facing document without breaking low-level inventory tracking.

---

## 7. Implementation Summary
- **Logo & Watermark:** Embedded `tattlyLogoBlack` in the header and created a non-intrusive 3.5% opacity rotated document watermark (`rotate-[-28deg]`).
- **Placeholder Engine:** Configured `GoldenRatioImagePlaceholder` to render `image_not_available_placeholder.png` with container-relative sizing and article tag badge.
- **Dynamic Tax:** Replaced hardcoded 18% labels with dynamic tax rate calculation defaulting to footwear statutory 5%.
- **Sizewise Matrix Consolidation:** Grouped incoming rows, merged `sizeQuantities` per size key, summed `totalQty`, and computed exact financial sums (`amount`, `taxAmount`).

---

## 8. Tests Executed
```bash
# PO Branding, Watermarks & 120-Day Terms
npx vitest run src/tests/poPrintBrandingAndTerms.test.tsx

# PO Sizewise Matrix Grouping by Article No. + Color
npx vitest run src/tests/poSizewiseGrouping.test.tsx

# Full TypeScript Compilation & Linter Check
npm run lint
```

---

## 9. Verification Results
- `src/tests/poPrintBrandingAndTerms.test.tsx`: 5/5 passed (100% green).
- `src/tests/poSizewiseGrouping.test.tsx`: 4/4 passed (100% green).
- Total tests passing in suite: 9/9 passed in 513ms.
- TypeScript compiler (`tsc --noEmit`): 0 errors, exit code 0.

---

## 10. Known Limitations
- The sizewise consolidation is active for Euro sizes 36–44 and alphanumeric Alpha sizes (S–XXL). Non-standard specialized bespoke sizes fall back to the first available size run column.

---

## 11. Future Work
- Add user-configurable watermark opacity in `Settings → Document Branding`.
- Introduce drag-and-drop batch photo association directly within the print preview modal.

---

## 12. Related ADRs
- `ADR-042`: System Parameter Dual-Key Architecture
- `ADR-084`: Procurement Sizewise Matrix Auto-Filtering & Identity Resolution

---

## 13. Related RFCs
- `RFC-2026-PROC-01`: SMRITI Retail OS Footwear Purchase Order & Procurement Standards

---
*Certified by Chief Systems Architect — Jawahar Ramkripal Mallah (support@smritibooks.com)*
