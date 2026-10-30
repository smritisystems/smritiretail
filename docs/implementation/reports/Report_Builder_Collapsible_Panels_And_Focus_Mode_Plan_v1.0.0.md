<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 1.0.0
  Created      : 2026-10-16
  Modified     : 2026-10-16
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Implementation Plan: SMRITI Report Builder — Collapsible Panels, Auto-Adaptive Layout & Focus Mode v1.0.0

## 1. Objective
Enable retail store managers, category planners, and executive analysts to configure reports flexibly and immediately reclaim 100% of the screen workspace for data analysis. Every optional panel (Available Fields Sidebar, Top Field Toolbar, Filters Panel, Advanced Configuration) must be independently collapsible or hideable, with the Report Grid expanding automatically to fill all available width and height. Provide a one-click Focus Mode and persistent layout preferences.

## 2. Business Motivation
In modern retail operations, reports often involve dozens of potential dimensions and metrics (Purchase, Sales, Inventory, Items, Customers, Suppliers, Finance). While configuring a report requires access to all available fields and filter options, once the report is run, these configuration panels take up valuable vertical and horizontal screen real estate. Enabling independent panel visibility controls and a dedicated Focus Mode maximizes the visible grid area, eliminates unnecessary scrolling, and streamlines multi-column transaction analysis without losing configuration state.

## 3. Scope
- **Field Sidebar:** Expanded (tree view), Collapsed (compact icon rail ~48px), and Hidden (0px with header `≡` toggle to reopen).
- **Top Field Toolbar:** Visible (selected field chips with remove/reorder controls) and Hidden (with `[Show Fields ▾]` reopen control).
- **Filters Panel:** Expanded (full date range, branch, and dynamic filter inputs), Compact (summary chips), and Hidden (with `[Filters (count)]` reopen control).
- **Advanced Configuration:** On-demand drawer / popover when clicking `[⚙]` without losing report configuration.
- **Report Grid:** Always the primary workspace; automatically reclaims space when panels are hidden; handles sorting, numeric/currency formatting, totals calculation, and pagination.
- **Focus Mode:** One-click maximize that hides sidebars and toolbars, collapses filters, and expands grid while preserving essential actions (`Run`, `Save View`, `Export`, `Exit Focus Mode`).
- **Adaptive Layout Presets:** Both/Adaptive (Recommended Default), Vertical, Horizontal, and Focus.
- **State Persistence:** Local storage caching of user layout preferences via `localStorage`.
- **Integration:** Integrated seamlessly into `ReportDesignerTab.tsx` and connected with the BI Catalog.

## 4. Current State
- `ReportDesignerTab.tsx` has `activeView: "bi_center" | "designer" | "viewer"`.
- `SmritiReportEngine.tsx` provides grid rendering, grouped accordion views, and basic column toggles, but lacks independent panel visibility controls, a collapsible field tree sidebar, and a dedicated Focus Mode.
- Clicking "New Report" in `ReportDesignerTab.tsx` currently displays an info toast rather than opening an interactive Report Builder.

## 5. Gap Analysis
| Required Capability | Current Codebase Status | Solution |
|---|---|---|
| Available Fields Sidebar | Missing | Implement 3-state sidebar (Expanded, Collapsed Icon Rail, Hidden) with search and 7 categories. |
| Top Field Toolbar | Missing in Builder | Implement horizontal selected-field chips container with remove actions and toggle. |
| Compact/Hidden Filters | Full filters only | Implement 3-state filter panel (Expanded, Compact chip summary, Hidden). |
| Focus Mode | Missing | Implement one-click Focus Mode saving prior visibility state and restoring on exit. |
| Layout Options Menu | Missing | Implement dropdown menu (`[Layout ▾]`) with checkmarks and Reset Layout action. |
| Layout Persistence | Not persisted | Persist layout states into `localStorage` (`smriti_report_builder_layout_v1`). |

## 6. Architecture Impact
- Reuses existing design tokens (`bg-theme-surface-1`, `border-theme-border`, `text-theme-body`).
- Integrates cleanly with `ReportDesignerTab.tsx` without creating a duplicate Reports module or second reporting backend.
- Declares AST capability via `withCapability` and issues Preflight Certificate per SMRITI Architecture Governance Rule 7 & 8.

## 7. Proposed Design
- Component: `src/components/reports/ReportBuilder.tsx`
- Parent Tab: `src/components/ReportDesignerTab.tsx`
- Layout State Machine:
  ```ts
  interface ReportBuilderLayoutState {
    sidebarState: "expanded" | "collapsed" | "hidden";
    toolbarVisible: boolean;
    filtersState: "expanded" | "compact" | "hidden";
    isFocusMode: boolean;
    activePreset: "both" | "vertical" | "horizontal" | "focus";
    density: "compact" | "regular" | "comfortable";
    showGrandTotal: boolean;
    showSubTotals: boolean;
    pageSize: number;
  }
  ```

## 8. Files Created
- `src/components/reports/ReportBuilder.tsx`
- `src/tests/reportBuilder.test.ts`
- `docs/implementation/reports/Report_Builder_Collapsible_Panels_And_Focus_Mode_Plan_v1.0.0.md`
- `docs/walkthrough/reports/Report_Builder_Collapsible_Panels_And_Focus_Mode_v1.0.0.md`

## 9. Files Modified
- `src/components/ReportDesignerTab.tsx`
- `docs/implementation/README.md`
- `docs/walkthrough/README.md`

## 10. Dependencies
- `lucide-react` (icons)
- `motion/react` (smooth accordion & panel transitions)
- `src/utils/formatters.ts` (`formatCurrency`, `formatNumber`, `formatDate`)
- `src/services/globalExportService.ts`

## 11. Risks
- Column key conflicts when switching active fields across categories: resolved by prefixing field IDs or indexing unique field keys.
- State loss during Focus Mode toggle: mitigated by caching previous visibility snapshot and restoring on exit.

## 12. Rollback Strategy
- Revert modifications to `ReportDesignerTab.tsx` and delete `ReportBuilder.tsx` via `git checkout`.

## 13. Verification Plan
- Verify all 5 mockups in the user screenshot:
  1. Default View (Both)
  2. Sidebar Hidden
  3. Top Field Toolbar Collapsed
  4. Filters Panel Collapsed
  5. Layout Options Menu
- Verify Focus Mode enter and exit.
- Verify column additions and removals.
- Verify persistence in `localStorage`.

## 14. Test Plan
- Unit tests in `src/tests/reportBuilder.test.ts`:
  - Panel toggles (sidebar, toolbar, filters).
  - Focus mode enter, exit, prior state preservation.
  - Column addition, removal, and minimum column rule.
  - Layout preset switching and reset layout.
  - LocalStorage persistence.
- TypeScript check: `npx tsc --noEmit`.
- Duplication Gate: `scripts/architecture_duplication_gate.py`.

## 15. Documentation Impact
- Update `docs/implementation/README.md`.
- Generate walkthrough under `docs/walkthrough/reports/`.
- Update `docs/walkthrough/README.md`.

## 16. Deployment Plan
- Pure frontend enhancement; zero database migrations required.

## 17. Status
Completed.

## 18. Related ADRs
- `ADR-0081`: SMRITI Architecture Duplication Gate & Preflight Certificate Policy.
- `ADR-0035`: BI Report Designer Unified Catalog Architecture.

## 19. Related Walkthroughs
- `Report_Builder_Collapsible_Panels_And_Focus_Mode_v1.0.0.md`
- `Procurement_And_Reports_Audit_And_Enhancement_v1.0.0.md`
