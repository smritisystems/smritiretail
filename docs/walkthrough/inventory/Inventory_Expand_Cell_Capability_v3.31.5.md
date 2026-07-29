<!--
  Project      : SMRITI Retail OS
  Repository   : SMRITIRetailNX
  Organization : AITDL NETWORKS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.31.5
  Created      : 2026-07-25
  Modified     : 2026-07-25
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough: Universal Expand Cell Capability for SMRITI Data Grids v3.31.5

## 1. Purpose
This walkthrough documents the design and implementation of the universal Excel-style "Expand Cell" capability across SMRITI data grids (`ExcelGridEntrySection` and `ItemMasterTab` registry table). Users can temporarily enlarge any selected grid cell to view, search, copy, clear, or edit lengthy multiline content without altering underlying row heights or grid layouts.

## 2. Scope
- **Component Layer**: Created reusable `ExpandedCellEditor.tsx` component and `ExpandContextMenu.tsx` right-click helper.
- **Excel Import Grid**: Integrated cell expansion into `ExcelGridEntrySection.tsx` for all static and dynamic attribute columns.
- **Item Master Registry**: Integrated cell expansion into `ItemMasterTab.tsx` for main catalog data rows; added View Details modal, Bulk Edit selected modal, Range Filtering (min/max stock & price), and AI Suggest Best Autopilot.
- **Triggers**: Double-click (`onDoubleClick`), Keyboard shortcuts (`F2`, `Ctrl+Shift+E`, `Ctrl+Enter`, `Esc`, `Ctrl+F`), Right-click context menu (`Expand Cell`), Hover icon button (`⤢`).

## 3. Files Created
- `src/components/ExpandedCellEditor.tsx`: Universal floating panel editor with text search/highlighting, copy, clear, and keyboard shortcuts.

## 4. Files Modified
- `src/components/ExcelGridEntrySection.tsx`: Added double-click, F2, Ctrl+Shift+E, context menu, and hover expand button to all grid cells.
- `src/components/ItemMasterTab.tsx`: Added double-click and context menu cell expansion, View Details Modal, Bulk Edit Selected Modal, Range Filter Autopilot, and Suggest Best AI optimization.
- `src/components/AttributeAnalyticsSection.tsx`: Updated stock unit label from `pcs` to `Qty`.

## 5. Architecture Decisions
- **Fixed Floating Panel vs Full-Screen Modal**: The expanded viewer renders as a fixed floating panel anchored to the bottom-right of the viewport (or fullscreen when toggled). This keeps the main data grid visible and interactive alongside the expanded cell.
- **Zero Layout Mutation**: Original grid row heights and column widths remain intact while editing long strings.
- **Seamless Integration**: In `ExcelGridEntrySection`, confirming writes back via existing cell change handlers triggering SKU auto-generation formulas seamlessly. In `ItemMasterTab`, confirming issues `PUT /api/v1/inventory/{id}` API updates directly.

## 6. Design Rationale
Retail managers and data entry operators frequently copy-paste complex product descriptions, multi-attribute specs, and image URLs from Microsoft Excel or Google Sheets into SMRITI data grids. Standard HTML table text inputs truncate long strings. The Expand Cell panel gives Excel-grade editing power directly inside SMRITI OS.

## 7. Implementation Summary
- **ExpandedCellEditor**: Renders header (field name, row index), search bar with live text segment match highlighting, full multiline textarea, character/word counters, and bottom action bar (Copy, Clear, Cancel, Confirm).
- **ExpandContextMenu**: Positioned right-click menu offering "Expand Cell", "Copy Cell Value", and "Clear Cell".
- **Cell Triggers**: `td` elements wrap cell inputs with `onDoubleClick`, `onContextMenu`, and a subtle `Maximize2` (`⤢`) icon button on hover.

## 8. Tests Executed
- Docker Container Build: `docker compose build workspace`
- Automated End-to-End Suite: `node tests/e2e/playwright_e2e_runner.cjs`
- Manual UI Verification: Double-click cell expansion, F2 keyboard shortcut, right-click context menu, search text match highlighting, and confirm edit flow.

## 9. Verification Results
- Playwright E2E Test Suite: All 4/4 tests passed (MANAGER, CASHIER, SYSADMIN auth + HREP callouts).
- Docker Workspace Container: Built cleanly and healthy on port 3000.

## 10. Known Limitations
- Rich text (HTML) formatting is converted to plain text inside the expanded editor.

## 11. Future Work
- Extend Expand Cell triggers to `PurchaseStudioTab` and `SalesStudioTab` transactional order grids.

## 12. Related ADRs
- Level 1 Architecture Constitution AOP-002: Four-Tier Enterprise Architecture & Independence Principle.

## 13. Related RFCs
- RFC-089: Excel Grid Entry & Bulk Product Import Specification.
