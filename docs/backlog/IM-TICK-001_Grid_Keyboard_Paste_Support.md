# Backlog Ticket IM-TICK-001: Item Master High-Volume Grid Keyboard & Direct Paste Support

**Ticket ID:** IM-TICK-001  
**Module:** Item Master & Inventory Studio  
**Priority:** High  
**Status:** Open (Scoped for Next Operational Sprint)  

## Problem Description
Retail operators handling high-volume SKU catalog entry require Excel-like efficiency. Standard HTML input forms without grid keyboard navigation (`ArrowUp`/`ArrowDown`/`Tab` focus trapping) or direct TSV/CSV clipboard paste handling slow down data entry during bulk seasonal inventory onboardings.

## Technical Specifications
1. **Keyboard Navigation**:
   - `ArrowUp` / `ArrowDown`: Move cell focus up/down in list and spreadsheet grid modes.
   - `Tab` / `Shift+Tab`: Move focus to next/previous editable field.
   - `Enter`: Commit cell value edit and move focus down to next row.
   - `Escape`: Cancel current cell edit and restore previous value.

2. **Clipboard Paste Handler (`onPaste`)**:
   - Implement `onPaste` handler on catalog spreadsheet grid table container.
   - Parse `e.clipboardData.getData("text/plain")` into tab-delimited (`\t`) and line-delimited (`\n`) row arrays.
   - Map pasted text columns dynamically to Product master fields (`code`, `name`, `barcode`, `costPrice`, `price`, `mrp`, `category`, `brand`, `stock`).
   - Validate HSN code, GST rate, and barcode uniqueness upon paste commit.

## Accept Criteria
- Pasting 50 rows from Excel immediately populates 50 grid items without page freeze.
- Keyboard navigation allows end-to-end catalog edits without mouse interaction.
- Unit tests written under `src/tests/itemMasterGridNavigation.test.ts`.
