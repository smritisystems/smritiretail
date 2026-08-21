<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.1.0
  Created      : 2026-08-21
  Modified     : 2026-08-21
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Item Master Non-Editable SKU and Barcode Enforcement in Edit Mode (v6.1.0)

## 1. Purpose
To ensure transactional data integrity and stock ledger consistency across SMRITI Retail OS by locking Stock Number (SKU/Code) and Barcode as immutable identifiers when editing existing products in the Item Master workspace and master drawer forms, while preserving full editability for all other core and dynamic product attributes.

## 2. Scope
- **Item Master Matrix Grid (`SmritiItemDetailsGrid.tsx`)**: Enforce `readOnly` and disabled cursor styling on SKU and Barcode columns when `activeMode === "edit"`.
- **Item Master Classic View (`SmritiItemDetailsGrid.tsx`)**: Enforce `readOnly` and disabled styling on Stock No and Barcode inputs during single-record editing.
- **Global Master Form Drawer (`MasterFormDrawer.tsx`)**: Propagate `isEdit` boolean into field `disabled` condition callbacks.
- **Item Master Config (`itemMaster.config.tsx`)**: Configure `code` and `barcode` fields as `disabled: (_form, isEdit) => Boolean(isEdit)`.
- **Automated Test Suite (`itemMasterTacticalGrid.test.ts`)**: Add Section 7 unit tests to verify edit mode immutability for SKU/Barcode and editability for all other retail attributes.

## 3. Files Created
- `docs/walkthrough/inventory/Inventory_ItemMaster_NonEditable_Sku_Barcode_Enforcement_v6.1.0.md`

## 4. Files Modified
- `src/components/itemMaster/SmritiItemDetailsGrid.tsx`
- `src/components/global/master/types.ts`
- `src/components/global/master/MasterFormDrawer.tsx`
- `src/components/global/configs/itemMaster.config.tsx`
- `src/tests/itemMasterTacticalGrid.test.ts`
- `docs/walkthrough/README.md`

## 5. Architecture Decisions
1. **Identifier Immutability vs Mutable Retail Attributes**: In retail inventory systems, modifying an existing SKU code or EAN-13 barcode breaks relational ledger references (purchase orders, POS transactions, barcode labels, and audit logs). Locking SKU and Barcode during edit operations prevents accidental corruption while allowing retail managers to update pricing, names, categories, descriptions, taxes, and dynamic attributes.
2. **Context-Aware Field Disabling**: Extended `MasterFormFieldDef.disabled` signature to receive `(formState, isEdit)` so generic master drawers can differentiate between create mode and update mode without hardcoded component hacks.

## 6. Design Rationale
- **Visual Feedback**: Disabled inputs in both the tactical grid and classic inspector receive `cursor-not-allowed`, muted text colors (`text-[#515f74] dark:text-[#bec6e0]`), and tooltip titles explaining that SKU and Barcodes are permanent identifiers.
- **Add Mode Usability**: In Add Mode (`activeMode === "add"`), SKU and Barcode remain fully editable and support auto-generation via F2 code generator shortcuts.

## 7. Implementation Summary
1. Updated `SmritiItemDetailsGrid.tsx` to include `isBarcode` in `isNonEditableInEditMode` when `activeMode === "edit"`.
2. Updated classic single-record inspector in `SmritiItemDetailsGrid.tsx` to set `readOnly={activeMode === "edit" || activeMode === "delete"}` and styling for Barcode and Stock No.
3. Updated `src/components/global/master/types.ts` and `src/components/global/master/MasterFormDrawer.tsx` to supply `isEdit` to `field.disabled`.
4. Updated `src/components/global/configs/itemMaster.config.tsx` to disable `code` and `barcode` fields when editing.
5. Expanded `src/tests/itemMasterTacticalGrid.test.ts` with 3 test cases for edit mode immutability.

## 8. Tests Executed
```bash
npx vitest run src/tests/itemMasterTacticalGrid.test.ts
```

## 9. Verification Results
```text
 RUN  v4.1.10 F:/SMRITRretailNX

 ✓ src/tests/itemMasterTacticalGrid.test.ts (13 tests) 13ms

 Test Files  1 passed (1)
      Tests  13 passed (13)
   Start at  21:48:55
   Duration  560ms
```

## 10. Known Limitations
- Does not affect backend database directly if raw SQL scripts are executed outside the application layer.

## 11. Future Work
- Optional admin override toggle in Company Settings if administrators explicitly require SKU re-indexing.

## 12. Related ADRs
- `ADR-0021`: Master Data Entity Identification & Primary Key Immutability
- `ADR-0044`: Platform Abstraction Layer (PAL) & Single Source of Truth

## 13. Related RFCs
- `RFC-2026-08-01`: SMRITI Item Master Tactical Grid & Catalog Protection Policy
