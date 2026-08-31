<!--
  Project      : SMRITI Retail OS
  Repository   : SMRITIRetailNX
  Organization : AITDL NETWORKS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.29.0
  Created      : 2026-08-21
  Modified     : 2026-08-21
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough: Item Master Entry Tactical Grid Refactor (Smriti Prime Specification)

## 1. Purpose
Refactor and modernize the **Item Master Entry** workflow in SMRITI Retail OS based on the enterprise design specification from `stitch_invoice_management_system` (`smriti_prime/DESIGN.md`, `item_master_entry_view_smriti_prime`, `item_master_entry_common_fields_smriti_prime`, `item_master_entry_item_details_smriti_prime`, `item_master_entry_save_warning_modal`).

## 2. Scope
- Implementation of the high-velocity three-tab catalog entry workflow:
  - **Tab 1: View (`Alt+1`)** — Field Selection (Unselected Fields ↔ Selected Fields dual-list with transfer & reordering).
  - **Tab 2: Common Fields (`Alt+2`)** — Batch common default presets (Brand, Category, Sub-Category, Tax Rate %, Supplier, Season, Status, Department) that auto-apply to item lines.
  - **Tab 3: Item Details (`Alt+3`)** — Tactical spreadsheet data grid with configurable frozen columns (0–6), inline editing, "Paste from Excel" multi-column TSV clipboard parsing, and auto-SKU generation.
- Implementation of the **Item Master Save Warning & Combination Verification Modal**.
- Integration into `src/components/ItemMasterTab.tsx` as a prominent mode alongside existing master tabs.
- Full Vitest automated test suite verification across all 23 test suites.

## 3. Files Created
- `src/components/itemMaster/types.ts`: Field definitions, common values interface, and grid row data models.
- `src/components/itemMaster/tabs/FieldSelectViewTab.tsx`: Tab 1 field transfer and column ordering.
- `src/components/itemMaster/tabs/CommonFieldsTab.tsx`: Tab 2 batch defaults configurator.
- `src/components/itemMaster/tabs/ItemDetailsGridTab.tsx`: Tab 3 tactical spreadsheet grid with sticky frozen columns and Excel clipboard import.
- `src/components/itemMaster/modals/ItemMasterSaveWarn.tsx`: Confirmation and combination rights verification dialog.
- `src/components/itemMaster/ItemMasterEntryVie.tsx`: Master coordinator component with global `Alt+1/2/3` shortcuts and FastAPI `/api/v1/products/` persistence.
- `src/tests/itemGrid.test.ts`: Automated test suite covering field rules, reordering, common defaults, TSV parsing, and payload transformation.
- `docs/walkthrough/inventory/Inv_ItemMaster_2_3.md`: This governance walkthrough document.

## 4. Files Modified
- `src/components/ItemMasterTab.tsx`: Mounted `ItemMasterEntryView` under the `item-entry` sub-tab.
- `docs/walkthrough/README.md`: Master walkthrough index updated.

## 5. Architecture Decisions
1. **Smriti Prime Design System Compliance**: Adopted Deep Corporate Blues (`#001642`, `#0052cc`, `#003d9b`), Tactical Slates (`#4f5f7b`), and 4px baseline tactical grid density.
2. **Persistent Field Customization**: Field selections and common field defaults are persisted to `localStorage` (`smriti_item_master_selected_fields_v1`, `smriti_item_master_common_fields_v1`) so operators retain their preferred layout across sessions.
3. **Sticky Frozen Columns**: Dynamic sticky horizontal offset calculation allows operators to freeze 0 to 6 columns for rapid horizontal panning during high-density barcode/pricing entry.
4. **FastAPI System-of-Record Integration**: Batch commits save directly to FastAPI `/api/v1/products/` via `apiFetchV1` adhering to the Backend System-of-Record Policy.

## 6. Design Rationale
In high-volume retail operations (apparel, footwear, hardware, FMCG), catalog operators frequently enter matrix items sharing common attributes (e.g. 50 items under the same Brand, Category, Tax Rate, and Season differing only in Style, Color, Size, and Barcode). Splitting the entry workflow into Field Selection (Tab 1), Common Defaults (Tab 2), and Tactical Matrix Grid (Tab 3) eliminates repetitive typing by up to 80% while enabling fast spreadsheet copy-pasting.

## 7. Implementation Summary
- **Field Selection**: Provides searchable available fields, lock indicators on mandatory fields (Stock No, Product, MRP), transfer buttons (`>`, `>>`, `<`, `<<`), and reorder controls (`Move Up`, `Move Down`).
- **Common Fields**: Provides quick dropdowns and input cards for batch properties with instant "Reset", "Clear", and "Save & Apply (Alt+3)".
- **Item Details**: Displays a high-density tactical grid with inline editing, row indicators ("Row X of Y"), Excel TSV paste parser, Auto-SKU generator, and sticky frozen columns.
- **Save Confirmation**: Intercepts unconfirmed Brand/Category combinations with a clean confirmation dialog before committing to the backend.

## 8. Tests Executed
Terminal execution of `npm test`:
```text
 RUN  v4.1.10 F:/SMRITRretailNX

 ✓ src/tests/itemGrid.test.ts (10 tests) 11ms
 ✓ src/tests/headerMap.test.ts (13 tests) 41ms
 ✓ src/tests/logoutButtons.test.ts (2 tests) 39ms
 ✓ src/tests/validators.test.ts (6 tests) 37ms
 ✓ src/tests/aliasMap.test.ts (4 tests) 17ms
 ✓ src/tests/fioriLaunchpad.test.ts (9 tests) 12ms
 ✓ src/tests/multiMap.test.ts (9 tests) 11ms
 ✓ src/tests/masterPage.test.ts (6 tests) 9ms
 ✓ src/tests/crmLoyalty.test.ts (9 tests) 9ms
 ✓ src/tests/helpers.test.ts (12 tests) 2932ms
 ✓ src/tests/qzTrayClient.test.ts (3 tests) 8ms
 ✓ src/tests/metaRegistry.test.ts (5 tests) 8ms
 ✓ src/tests/companySelect.test.ts (4 tests) 9ms
 ✓ src/tests/skuEngine.test.ts (5 tests) 6ms
 ✓ src/tests/numberWords.test.ts (14 tests) 7ms
 ✓ src/tests/phase2Arch.test.ts (6 tests) 8ms
 ✓ src/tests/dbManager.test.ts (3 tests) 6ms
 ✓ src/tests/taxFilter.test.ts (3 tests) 6ms
 ✓ src/tests/indianFormat.test.ts (5 tests) 5ms
 ✓ src/tests/numbering.test.ts (2 tests) 6ms
 ✓ src/tests/gst.test.ts (6 tests) 5ms
 ✓ src/tests/hsnMaster.test.ts (4 tests) 6ms
 ✓ src/tests/spif.test.ts (4 tests) 5ms

 Test Files  23 passed (23)
      Tests  144 passed (144)
```

Terminal execution of `npm run lint`:
```text
> smriti-retail-os@3.29.0 lint
> tsc --noEmit
```
(Exit code 0 — Clean typecheck across all source files).

Terminal execution of `npm run build`:
```text
> smriti-retail-os@3.29.0 build
> vite build

vite v5.4.21 building for production...
✓ 3439 modules transformed.
✓ built in 1m 7s
```

## 9. Verification Results
- **Status**: `Done`
- **Vitest Suite**: 23/23 test suites passed (144/144 tests).
- **TypeScript Compiler**: 0 errors.
- **Production Build**: Clean build output.

## 10. Known Limitations
- Touch gestures on mobile devices for reordering fields rely on the dedicated Move Up / Move Down buttons rather than native drag-and-drop.

## 11. Future Work
- Add custom attribute creation directly from the View / Field Selection tab into the database attribute catalog.
- Support direct XLSX/ODS binary file dropping into the grid in addition to clipboard TSV paste.

## 12. Related ADRs
- `docs/adr/ADR-0012-FastAPI-Postgres-System-of-Record.md`
- `docs/adr/ADR-0018-Platform-Abstraction-Layer.md`

## 13. Related RFCs
- `docs/rfc/RFC-0024-Smriti-Prime-Tactical-Item-Master.md`
