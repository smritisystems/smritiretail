<!--
  Project      : SMRITI Retail OS
  Repository   : SMRITIRetailNX
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.99.6
  Created      : 2026-10-29
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Procurement & Purchase Order Walkthrough
-->

# Procurement: Purchase Order Print Collection Type & Season Resolution Walkthrough v1.0.0

## 1. Purpose
This walkthrough documents the end-to-end implementation of **Collection Type** (e.g. *Core Essentials (All-Year)*, *Spring / Summer (SS)*, *Autumn / Winter (AW)*, *Festive & Wedding*, *Active Athletics*, *Casual & Daily*) support across SMRITI Retail OS Purchase Orders. In footwear and fashion retail sourcing, merchandise is planned, ordered, and inwarded around seasonal and capsule collections. SMRITI now captures Collection Type at both the **Order Level** (commercial contract & terms) and the **Article / Reference Level** (style attribute & photo card), and faithfully prints them in the statutory A4 Purchase Order document.

---

## 2. Scope
The scope encompasses:
1. **Order Header & Commercial Delivery Drawer**:
   - Added `collectionType` / `collection_type` to `PurchaseOrderHeader` and `CommercialDeliveryData`.
   - Added `COLLECTION_PRESETS` suggestions and a dedicated `Collection / Season` datalist selector in Section 3 ("Department & Quotation Reference") of `CommercialDeliveryDrawer.tsx`.
2. **Statutory A4 Print Engine Template (`PurchaseOrderPrintA4.tsx`)**:
   - Extended `PurchaseOrderPrintData` with `collectionType?: string`.
   - Rendered statutory `Collection Type : {data.collectionType}` entry in the `COMMERCIAL TERMS` box when provided.
   - Extended `FootwearArticleReference` and `ItemReferenceFieldVisibility` with `collectionType`.
   - Included `Collection: {ref.collectionType}` within dynamic item reference cards with auto-fallbacks.
3. **Print Preview & Customizer Modal (`POPrintPreviewModal.tsx`)**:
   - Added `Collection` toggle checkbox to `ITEM_REFERENCE_FIELD_OPTIONS` and initialized in `itemReferenceFields` (defaulted to `true`).
   - Extended `resolveFootwearAttributes` to extract collection type across aliases (`collectionType`, `collection_type`, `COLLECTION_TYPE`, `collection`, `season`, etc.) and fall back to catalog and order header.
   - Wired `collectionType` into `approvedPrintData` payload and article references.
4. **Automated Test Suite**:
   - Extended `src/tests/poPrintBrandingAndTerms.test.tsx` with Test 13.
   - Updated `src/tests/poSizewiseGrouping.test.tsx` Test 7 to verify robust extraction across aliases.

---

## 3. Files Created
1. `docs/walkthrough/purchase/Purchase_Order_Print_Collection_Type_Walkthrough_v1.0.0.md` — Formal 13-section Walkthrough Governance Policy (WGP) document.

---

## 4. Files Modified
1. `src/components/purchase/types.ts` — Added `collectionType?: string;` and `collection_type?: string;` to `PurchaseOrderHeader`.
2. `src/components/purchase/CommercialDeliveryDrawer.tsx` — Added `collectionType?: string;` to `CommercialDeliveryData`, `COLLECTION_PRESETS`, and `Collection / Season` input field with datalist.
3. `src/print_engine/templates/PurchaseOrderPrintA4.tsx` — Added `collectionType` across `PurchaseOrderPrintData`, `FootwearArticleReference`, `ItemReferenceFieldVisibility`, `derivedMap` fallbacks, `COMMERCIAL TERMS` layout, and Item Reference card attributes.
4. `src/components/purchase/POPrintPreviewModal.tsx` — Extended `ITEM_REFERENCE_FIELD_OPTIONS`, `resolveFootwearAttributes`, `itemReferenceFields` state, `allAvailableArticleReferences`, and `approvedPrintData`.
5. `src/tests/poPrintBrandingAndTerms.test.tsx` — Added Test 13 verifying `Collection Type` rendering in Commercial Terms and `Collection: ...` in Item Reference cards.
6. `src/tests/poSizewiseGrouping.test.tsx` — Updated Test 7 for `collectionType` parity across key casing structures.
7. `CHANGELOG.md` — Documented release `[6.99.6]`.
8. `docs/walkthrough/README.md` — Appended master index entry `v3.138.0`.

---

## 5. Architecture Decisions
1. **Dual-Level Resolution (Header vs Article)**:
   - Retail merchandising functions at two distinct granularities: an entire purchase order may represent a seasonal booking indent (e.g. `Spring / Summer 2026`), or individual footwear articles within a multi-line order may belong to specific product sub-collections (e.g. `Active Athletics` vs `Core Essentials`). SMRITI supports both levels cleanly: if an article has an explicit collection attribute, it is displayed on its card; otherwise, it inherits the order-level collection seamlessly.
2. **Promoted Column Parity**:
   - The PostgreSQL `item_master` table already maintains `collection_type` as a promoted column (`VARCHAR(100)`). The frontend PO types and print engine now directly align with this canonical database schema without requiring ad-hoc JSON parsing.
3. **Fail-Safe Attribute Resolution**:
   - `resolveFootwearAttributes` inspects multiple candidate keys (`collectionType`, `collection_type`, `COLLECTION_TYPE`, `collection`, `season`, `Season`, `SEASON`) and falls back to `lookupFootwearStyleMetadata` and the order header.

---

## 6. Design Rationale
- **Zero Space Penalty on Page 1**:
  - In `COMMERCIAL TERMS`, `Collection Type` is conditionally rendered only when defined. When present, it fits into the standard 2-column key-value grid without altering font metrics or pushing summary boxes down.
  - In Item Reference cards, the attribute is gated behind `itemReferenceFields.collectionType` (user configurable in the modal) and rendered within the responsive wrapping metadata container above the preview image canvas.
- **Operator Autocomplete Flexibility**:
  - `CommercialDeliveryDrawer.tsx` uses `<input list="comm-collection-list">` with standard retail presets (`Core Essentials (All-Year)`, `Spring / Summer (SS)`, `Autumn / Winter (AW)`, `Festive & Wedding`, `Active Athletics`, `Bridal Special`, `Casual & Daily`, `Formal & Office`) while allowing freeform custom text entry for boutique or international seasons.

---

## 7. Implementation Summary
- **Header Type & Drawer**:
  - Extended interfaces and added interactive datalist-backed field in Commercial Delivery Drawer Section 3.
- **A4 Print Engine**:
  - Conditionally rendered `Collection Type : {data.collectionType}` in `COMMERCIAL TERMS`.
  - Added `{ key: "collectionType", label: "Collection", value: ref.collectionType }` to item reference field mapping.
- **Preview Modal Customizer**:
  - Added toggle control to the Field Visibility dropdown, persisted in `localStorage`.
  - Mapped header and line collection values through `resolveFootwearAttributes`.
- **Testing**:
  - 83/83 Vitest tests passing across all procurement and print suites.

---

## 8. Tests Executed
```bash
npx vitest run src/tests/poPrintBrandingAndTerms.test.tsx src/tests/poGenerate.test.ts src/tests/poGenerateUX.test.ts src/tests/poModeConversion.test.ts src/tests/poSizewiseGrouping.test.tsx src/tests/poSizewiseUX.test.ts
```

Output:
```
 RUN  v4.1.11 F:/SMRITRretailNX

 ✓ src/tests/poPrintBrandingAndTerms.test.tsx (15 tests) 180ms
 ✓ src/tests/poSizewiseUX.test.ts (38 tests) 44ms
 ✓ src/tests/poSizewiseGrouping.test.tsx (10 tests) 127ms
 ✓ src/tests/poModeConversion.test.ts (6 tests) 13ms
 ✓ src/tests/poGenerate.test.ts (3 tests) 5ms
 ✓ src/tests/poGenerateUX.test.ts (11 tests) 11ms

 Test Files  6 passed (6)
      Tests  83 passed (83)
   Duration  3.62s
```

---

## 9. Verification Results
- **Vitest Unit/Integration Tests**: 83/83 PASSED.
- **TypeScript Static Verification**: `npx tsc --noEmit` exit code 0.
- **Render Output Check**: Test 13 verifies both `Collection Type` in commercial terms and `Collection:` in reference cards.

---

## 10. Known Limitations
- If a user prints an older draft PO created before this version without opening the Commercial Drawer or selecting a collection, `collectionType` remains `undefined` and is cleanly omitted from the print output (zero layout regression).

---

## 11. Future Work
- Auto-populate `collectionType` on PO generation from merchandise planning season calendars (e.g. OTB / Open-To-Buy budgets).
- Support multi-collection filter grouping in GRN Inwarding.

---

## 12. Related ADRs
- `ADR-0042`: Footwear Sourcing Multi-Attribute Resolution & Fallback Hierarchy.
- `ADR-0048`: Statutory Single-Page A4 Purchase Order Geometry Governance.

---

## 13. Related RFCs
- `RFC-2026-PO-018`: Retail Seasonal Collection & Capsule Merchandise Attributes in Procurement.
