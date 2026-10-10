<!--
  Project      : SMRITI Retail OS
  Repository   : SMRITIRetailNX
  Organization : AITDL NETWORKS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.52.0
  Created      : 2026-10-10
  Modified     : 2026-10-10
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Implementation Plan: SMRITI Barcode Studio Hidable Sidebar, Advance Filters Toggle & Zero-Armed Printing Architecture (v6.52.0)

## 1. Objective
Upgrade the SMRITI Barcode Label Studio workstation (`TagLabelPrintingTa.tsx`) to maximize workstation screen real estate through a two-axis collapsible interface (hidable left sidebar and collapsible criteria panel), expose a first-class `Barcode` column in the data grid with sorting and per-column filtering, and implement the Zero-Armed Printing Architecture to prevent inadvertent mass spooling to hardware printers.

## 2. Business Motivation
In retail stores and distribution centers, operators work under high physical throughput and variable screen sizes (15" POS touchscreens to 24" warehouse terminals). Inadvertent mass printing caused by default-selecting all catalog items wastes expensive adhesive thermal label rolls ($20-$50 per roll). Additionally, static multi-tier forms reduce visible data rows, forcing tedious scrolling.

## 3. Scope
- Two-axis collapsibility: Left configuration rail and top criteria form.
- Grid data enhancement: First-class Barcode column with sorting, filtering, and monospace formatting.
- Print safety architecture: Zero-armed selection default on initialization and criteria reset.
- Explicit batch control: Added `[Select All]` and `[Select None]` buttons in grid toolbar.

## 4. Current State
- Left configuration rail fixed at `w-72` (288px), consuming horizontal width even after setup.
- Step 2 criteria panel consumed ~250px vertical height even when browsing results.
- Item grid lacked a visible `Barcode` column despite barcodes being present in the underlying data model.
- Window mount and "Clear Criteria" actions hardcoded `setSelectedRowIds(new Set(allRows.map(r => r.id)))`, auto-selecting all 545 catalog items and arming the hardware printer for mass printing.

## 5. Gap Analysis
| Feature | Previous State (v6.51.0) | Target State (v6.52.0) |
|---|---|---|
| Sidebar Width | Static 280px | Collapsible to 0px with hotkey [Alt+S] & persistence |
| Criteria Form | Fixed ~250px height | Collapsible to 32px summary strip with [Alt+F] |
| Grid Barcode Column | Missing from table | Displayed with sorting and per-column filter |
| Mount Selection | Auto-selected 545 items | 0 items selected (Zero-Armed Printing) |
| Clear Criteria Selection | Auto-selected 545 items | 0 items selected (Zero-Armed Printing) |
| Bulk Selection Controls | Only per-row and header checkbox | Dedicated [Select All] & [Select None] toolbar buttons |

## 6. Architecture Impact
- Enforces strict explicit-intent selection contracts before hardware spooling.
- Persists ergonomic preferences (`isSidebarCollapsed`) in `localStorage`.
- Zero backend schema or API contract changes required.

## 7. Proposed Design
- Horizontal axis: CSS transition on `<aside>` between `w-72` and `w-0 overflow-hidden`, paired with a floating vertical toggle handle.
- Vertical axis: Step 2 conditional render: full form vs. compact active filter chips strip.
- Grid architecture: Added `<th>`, filter `<input>`, and `<td>` for barcode, updating empty state `colSpan` from 9 to 10.
- Safety defaults: Set `selectedRowIds` to `new Set()` in `populateGrid` and `handleClear`.

## 8. Files Created
1. `docs/walkthrough/barcode/Barcode_Studio_Hidable_Sidebar_And_Zero_Armed_Printing_Walkthrough_v6.52.0.md`
2. `docs/implementation/inventory/Barcode_Studio_Hidable_Sidebar_And_Zero_Armed_Printing_Plan_v6.52.0.md`

## 9. Files Modified
1. `src/components/barcode/TagLabelPrintingTa.tsx`
2. `docs/walkthrough/README.md`
3. `docs/implementation/README.md`
4. `CHANGELOG.md`

## 10. Dependencies
- React 18, `lucide-react` icons (`PanelLeftClose`, `PanelLeftOpen`, `ChevronDown`, `ChevronUp`).
- Vitest test runner.

## 11. Risks
- Risk: Operators assuming "Clear Criteria" would re-select all items.
  - Mitigation: Clear Criteria resets both inputs and selection to neutral state; explicit `[Select All]` button provided if bulk selection is intended.

## 12. Rollback Strategy
- Revert commit on `TagLabelPrintingTa.tsx` to restore previous static layout.

## 13. Verification Plan
- Execute Vitest barcode test suites: `rangeFilter.test.ts`, `tagPrinting.test.ts`, `printLabelsStudio.test.ts`, `prnInterpolation.test.ts`.
- Run full TypeScript type check: `npx tsc --noEmit`.
- Run production bundle build: `npm run build`.

## 14. Test Plan
- Unit test verification of natural sorting and filtering engine.
- Visual inspection of sidebar collapsing and criteria collapsing states.
- End-to-end verification of zero-armed safety gate.

## 15. Documentation Impact
- Update `docs/walkthrough/README.md`.
- Update `docs/implementation/README.md`.
- Update `CHANGELOG.md`.

## 16. Deployment Plan
- Push to git repository on branch `smritiNX`.
- Deploy to test environment via standard git pull.

## 17. Status
Completed

## 18. Related ADRs
- `ADR-BARCODE-051: Dual-Tier Range Selection & Natural Sorting`
- `ADR-BARCODE-052-1: Zero-Armed Selection Contract`

## 19. Related Walkthroughs
- `Barcode_Studio_Hidable_Sidebar_And_Zero_Armed_Printing_Walkthrough_v6.52.0.md`
