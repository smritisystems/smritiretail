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

# Implementation Plan: Excel Grid Header Paste Mapping

## 1. Objective
Add automated column-to-field header mapping for the manual data entry grid (`ExcelGridEntrySection.tsx`) to allow non-technical operators to copy-paste Excel/CSV spreadsheets directly without requiring strict manual column alignment or matching.

## 2. Business Motivation
Minimizes input errors and speeds up catalog seeding by automatically aligning Excel copy-pastes based on column header labels (e.g. mapping `BARCODE NO` to `barcode`, and `PRODUCT STYLE CODE` to `code`).

## 3. Scope
Enhance the spreadsheet's `handlePaste` function in `ExcelGridEntrySection.tsx` to automatically parse column headers, clean up text tokens, identify matched labels, map dynamic core & custom attributes, and populate rows correctly.

## 4. Current State
Pasting was strictly positional relative to the focused input cell, which could misalign columns if the pasted spreadsheet's column order differed from the UI grid structure.

## 5. Gap Analysis
- No header identification in paste clipboard handler.
- Pasting entire spreadsheets with custom header rows resulted in headers being treated as product rows.
- Strict ordering requirements caused input errors for non-technical users.

## 6. Architecture Impact
None. Isolated purely to the UI/clipboard parsing layer in the presentation components.

## 7. Proposed Design
1. Analyze the first line of the clipboard data.
2. Clean up header strings (lowercase, alphanumeric only).
3. Match against known aliases for core fields (`code`, `name`, `barcode`, `costPrice`, `price`, `mrp`, `gstPercentage`, `stock`).
4. Match against labels/names of active dynamic attributes (e.g. `brand`, `color`, `size`).
5. If >= 2 matches succeed, skip the header row and map the columns of subsequent lines by matching indexes.
6. Fall back to standard positional paste if headers are not detected.

## 8. Files Created
None.

## 9. Files Modified
- `src/components/ExcelGridEntrySection.tsx`

## 10. Dependencies
None.

## 11. Risks
Incorrectly detecting a data row as a header row. High threshold check (>= 2 verified header matches) prevents false positives.

## 12. Rollback Strategy
Revert changes to `ExcelGridEntrySection.tsx` via Git.

## 13. Verification Plan
- Verify no compiler errors in TypeScript workspace.
- Check Vitest assertions.

## 14. Test Plan
Execute `npm run lint` and `npm run test`.

## 15. Documentation Impact
Update SMRITI Developer Guide and user instructions.

## 16. Deployment Plan
Standard compilation release pipeline.

## 17. Status
Completed

## 18. Related ADRs
None.

## 19. Related Walkthroughs
- [Foundation_Excel_Grid_Header_Paste_Mapping_v3.16.0.md](../../walkthrough/foundation/Foundation_Excel_Grid_Header_Paste_Mapping_v3.16.0.md)
