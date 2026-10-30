<!--
  Project      : SMRITI Retail OS
  Repository   : SMRITIRetailNX
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.85.0
  Created      : 2026-10-16
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Procurement Walkthrough Document
-->

# Walkthrough — Supplier Commercial Terms Rich Text Editor & PO Integration

**Area:** Procurement / Vendor Master & Purchase Order Generation  
**Topic:** Supplier Commercial Terms Rich Text Paragraph Editor, Safe HTML Sanitization & PO Snapshot Immutability  
**Version:** v6.85.0  
**Date:** 2026-10-16  

---

## 1. Purpose
To upgrade the single-line `Special Instructions` input in **Supplier Dashboard → Commercial Terms** into a full-width, multiline rich-text paragraph editor. This provides suppliers with comprehensive commercial contract authoring capabilities (headings, bold, italic, ordered/bulleted lists, text alignment, Word paste cleanup, live preview, word and character counters, and 1-click insertion of the statutory 4-clause SMRITI commercial contract). It seamlessly flows these terms into Purchase Order creation and printing without destructive database migrations while permanently locking historical Purchase Order contracts via frozen rule snapshots (`rule_snapshots["commercial_terms"]`).

---

## 2. Scope
- **Supplier Master UI:** Replace single-line input in `VendorCommercialTab.tsx` with `RichTextTermsEditor` under the "Default Purchase Order Commercial Terms" card (`col-span-full`).
- **Standard Terms Template:** Provide an optional "Insert Standard Terms" action with a safety confirmation dialog inserting the authoritative 4-clause SMRITI statutory contract.
- **Data Persistence:** Store rich multiline / HTML terms securely in `Party.metadata_json["commercial_terms"]["business_terms"]` and `["special_instructions"]` via zero-migration dual-write.
- **Security & Sanitization:** Implement `sanitizeTermsHtml` and `cleanWordHtml` (`src/utils/sanitizeTermsHtml.ts`) stripping XSS vectors (`<script>`, `<iframe>`, `onerror`, `javascript:`) and Microsoft Word proprietary XML/Mso attributes.
- **Safe Rendering:** Component `SafeRichTermsRenderer.tsx` rendering sanitized HTML via safe styling, while retaining `whitespace-pre-line` fallback for legacy plain-text supplier records.
- **Purchase Order Flow:** Auto-map supplier commercial terms when generating POs (`PoSizewiseTab.tsx`, `PoGenerateTab.tsx`, and `CommercialDeliveryDrawer.tsx`).
- **Print & PDF Output:** Render formatted terms natively in `PurchaseOrderPrintA4.tsx`, `FootwearPurchaseOrderA4.tsx`, and `SizePivotMatrixA4.tsx` with page-break and pagination protection in `src/index.css`.
- **Snapshot Immutability:** Guarantee historical PO terms remain frozen in `rule_snapshots["commercial_terms"]`, preventing edits to Supplier Master from altering issued POs.

---

## 3. Files Created
1. `src/utils/sanitizeTermsHtml.ts`: Commercial terms HTML sanitizer, Microsoft Word paste cleaner, HTML detector, and canonical standard statutory terms constant.
2. `src/components/common/SafeRichTermsRenderer.tsx`: Secure HTML and plain-text renderer with backward-compatible line-break preservation.
3. `src/components/common/RichTextTermsEditor.tsx`: Full-width multiline rich-text editor with formatting toolbar (H3, H4, P, Bold, Italic, Ordered List, Bullet List, Alignment), Word paste cleaner, live preview toggle, word/character counter, and standard terms template loader with confirmation modal.
4. `src/tests/supplierCommercialTermsRichText.test.tsx`: Automated Vitest test suite covering template insertion, formatting preservation, data isolation, XSS sanitization, Word paste cleaning, legacy fallback, PO print rendering, and snapshot immutability.

---

## 4. Files Modified
1. `src/components/vendor/tabs/VendorCommercialTab.tsx`: Replaced single-line input with `RichTextTermsEditor` spanning `col-span-full`.
2. `src/components/vendor/VendorMasterWs.tsx`: Normalized vendor detail to preserve commercial fields and avoid state wiping during tab switching.
3. `backend/app/schemas/purchase.py`: Added `business_terms` to `SupplierResponse`.
4. `backend/app/services/vendor_svc.py`: Added dual-write and read for `special_instructions` and `business_terms` in `party.metadata_json["commercial_terms"]`.
5. `backend/app/services/purchase.py`: Mapped `special_instructions` and `business_terms` in `list_suppliers` and `get_supplier`.
6. `src/components/purchase/PoSizewiseTab.tsx`: Mapped supplier `business_terms` upon vendor selection, during initial load, and saved in `rule_snapshots["commercial_terms"]`.
7. `src/components/purchase/PoGenerateTab.tsx`: Mapped supplier `business_terms` upon vendor selection, change dialog, and saved in `rule_snapshots["commercial_terms"]`.
8. `src/components/purchase/CommercialDeliveryDrawer.tsx`: Added interactive Preview Terms toggle using `SafeRichTermsRenderer`.
9. `src/print_engine/templates/PurchaseOrderPrintA4.tsx`: Replaced raw text with `SafeRichTermsRenderer` for Special Instructions and Business Terms.
10. `src/print_engine/templates/FootwearPurchaseOrderA4.tsx`: Replaced raw text with `SafeRichTermsRenderer`.
11. `src/print_engine/templates/SizePivotMatrixA4.tsx`: Replaced raw text with `SafeRichTermsRenderer`.
12. `src/index.css`: Added typography styling and print pagination rules for `.rich-terms-rendered`.
13. `docs/walkthrough/README.md`: Appended entry to the master walkthrough index.

---

## 5. Architecture Decisions
- **Zero-Migration JSONB Storage:** Stored rich terms in `Party.metadata_json["commercial_terms"]`. Because PostgreSQL JSONB fields have no VARCHAR limit, multiline HTML is preserved safely across tenant boundaries without altering table columns.
- **Dual-Write Backward Compatibility:** Both `special_instructions` and `business_terms` are dual-written, ensuring existing consumers that read `special_instructions` continue to receive the full terms without interruption.
- **Client-Side Safe Whitelist Sanitizer:** Built a lightweight, zero-dependency HTML sanitizer using DOMParser and an allowed-tags whitelist (`h1-h6`, `p`, `br`, `hr`, `b`, `strong`, `i`, `em`, `u`, `ol`, `ul`, `li`, `div`, `span`, `blockquote`) with safe style attribute filtering (`text-align` only).
- **Snapshot Immutability Contract:** When a Purchase Order is saved or confirmed, its commercial terms are frozen in `purchase_orders.rule_snapshots["commercial_terms"]`. Recalling the PO in UI or rendering print previews always reads from the snapshot, preventing historical contract tampering.

---

## 6. Design Rationale
- Standard `input` elements truncate long legal clauses and strip line breaks.
- A full-featured yet dependency-free editor prevents bundle bloat while offering professional Word paste cleanup, live HTML preview, and exact standard terms injection.
- Scoped print CSS rules (`page-break-inside: avoid` on list items and `page-break-after: avoid` on headings) guarantee that long terms flow across multiple pages naturally without overlapping signatures or tables.

---

## 7. Implementation Summary
- **Editor:** Users can format text with headings, lists, bold/italic styles, and text alignment. Clicking "Insert Standard Terms" displays a confirmation modal before inserting the 4 statutory clauses.
- **Sanitization:** Strips `<script>`, `<style>`, `<iframe>`, `on*` attributes, and `mso-` attributes from Microsoft Word pastes.
- **PO Integration:** Selecting a vendor automatically sets `header.businessTerms`. Opening the Commercial Drawer allows previewing the formatted terms. Printing the PO invokes `SafeRichTermsRenderer`, rendering headings and numbered lists cleanly.

---

## 8. Tests Executed
1. `npx vitest run src/tests/supplierCommercialTermsRichText.test.tsx src/tests/poPrintBrandingAndTerms.test.tsx`
2. `npx vitest run src/tests/poSizewiseGrouping.test.tsx`
3. `npx tsc --noEmit`

---

## 9. Verification Results
- `supplierCommercialTermsRichText.test.tsx`: 13/13 passed (100% green).
- `poPrintBrandingAndTerms.test.tsx`: 7/7 passed (100% green).
- `poSizewiseGrouping.test.tsx`: 6/6 passed (100% green).
- Total tests: 26/26 passed.
- TypeScript check (`npx tsc --noEmit`): Exit code 0, zero errors.

---

## 10. Known Limitations
- Rich text editor supports inline tags, lists, and headings; table embedding inside terms is not supported in this version.
- Content editing is restricted to users with supplier master write permissions.

---

## 11. Future Work
- Support localized terms templates (e.g. Hindi, Marathi, Gujarati) for regional suppliers.
- Enable digital signature stamping alongside commercial terms on PDF generation.

---

## 12. Related ADRs
- `ADR-0042`: Canonical Commercial Terms Storage & Rule Snapshots in PostgreSQL.
- `ADR-0068`: Sole FastAPI + Postgres Backend Architecture & Express Decommissioning.

---

## 13. Related RFCs
- `RFC-2026-08`: Purchase Order Contract Snapshotting & Statutory Terms Governance.
