<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.16.0
  Created      : 2026-07-13
  Modified     : 2026-07-13
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough: Excel Grid Header Paste Mapping (v3.16.0)

## 1. Purpose
Integrate automatic column header identification and data alignment inside the Excel data entry grid (`ExcelGridEntrySection.tsx`) to allow non-technical operators to copy-paste spreadsheet data direct from Excel or CSV with variable column orders.

## 2. Scope
- Add clean alphanumeric normalization of column headers.
- Support key mapping aliases for core product parameters (SKU, name, barcode, prices, GST %, and stock quantities).
- Auto-detect dynamic attribute headers (e.g. brand, color, size, outsole, heel) from active business class groups.
- Parse grid row items to map columns by field keys, skipping header rows cleanly.
- Maintain positional fallback parsing logic.

## 3. Files Created
- `docs/implementation/foundation/Excel_Grid_Header_Paste_Mapping_Plan_v3.16.0.md`
- `docs/walkthrough/foundation/Foundation_Excel_Grid_Header_Paste_Mapping_v3.16.0.md`

## 4. Files Modified
- `src/components/ExcelGridEntrySection.tsx`
- `docs/walkthrough/README.md`
- `docs/implementation/README.md`

## 5. Architecture Decisions
Keep paste normalization decoupled within the presentation component boundaries, utilizing dynamic attribute definitions loaded from the PostgreSQL/PAL repository layer.

## 6. Design Rationale
Excel sheets often differ in column orders. Normalizing inputs by header labels prevents manual re-sorting of spreadsheets by users.

## 7. Implementation Summary
- Added `headerMapping` aliases for core grid parameters.
- Added `findFieldKeys` helper to clean input headers and map them to fields or dynamic attribute prefixes (`attr_`).
- Enhanced `handlePaste` to inspect the first line of clipboard data. If >= 2 cells yield matched aliases, it executes header-based mapping, parsing data rows and skipping the headers line.

## 8. Tests Executed
- Compiler checking (`npm run lint`).
- Vitest execution (`npm run test`).

## 9. Verification Results
Zero warnings; 55 tests passed.

## 10. Known Limitations
None.

## 11. Future Work
Extend spreadsheet parsing to client-side CSV file uploads in the bulk tab.

## 12. Related ADRs
None.

## 13. Related RFCs
None.
