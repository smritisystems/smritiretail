<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.102.0
  Created      : 2026-08-28
  Modified     : 2026-08-28
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough: Store-Level Profit & Loss Dashboard (v1.0.0-GA)

## 1. Purpose
Documents the implementation of the P&L Dashboard Engine — a branch-level financial analytics engine computing daily/weekly/monthly Gross Sales, Returns, Net Revenue, COGS, Gross Margin (GM%), Shrinkage Cost, Markdown Cost above policy threshold, Operating Cost, and Net Profit; with multi-period trend analysis and multi-branch ranking.

## 2. Scope
- `PLDashboardEngine` covering `computePL()`, `computeTrend()`, `compareBranches()`.
- `PLDashboardModal` with 3-tab view: P&L waterfall statement, trend sparklines, branch ranking comparison.
- Markdown cost policy: only discount above `PL_CONFIG.markdownPolicyThresholdPct` (10%) of gross sales is classified as markdown cost.
- Multi-period trend auto-sorts unsorted period input ascending.

## 3. Files Created
- `src/utils/plDashboardEngine.ts`
- `src/components/finance/PLDashboardModal.tsx`
- `src/tests/plDashboardEngine.test.ts`
- `docs/walkthrough/finance/PL_Dashboard_v1.0.0.md`

## 4. Files Modified
- `docs/implementation/README.md`
- `docs/walkthrough/README.md`
- `CHANGELOG.md`

## 5. Architecture Decisions
1. **Branch filter on all inputs**: `computePL()` filters transactions, shrinkage entries, and operating costs to the target branch — callers pass a unified pool; engine scopes internally.
2. **Markdown cost above policy threshold only**: Discount given that stays within the 10% policy threshold is considered normal trading discount (already deducted from revenue as part of `grossSales`). Only excess above threshold is classified as a separate markdown cost line — correctly separates normal discounting from margin-eroding markdown events.
3. **Operating cost period-matched externally**: `OperatingCost.period` is a display field; the caller is responsible for loading the correct period's costs into the pool. The engine aggregates all provided `OperatingCost` entries for the branch.
4. **pctOfRevenue on all deduction lines**: Every deduction line carries `pctOfRevenue` for drill-through analysis without requiring re-computation at the UI layer.
5. **Trend auto-sort**: `computeTrend()` sorts reports by `periodLabel` lexicographically ascending — works correctly for ISO period labels (YYYY-MM, YYYY-WXX, YYYY-MM-DD).

## 6. Design Rationale
Most retail P&L tools show only top-line GM%. Shrinkage and markdown are equally important — a store may show 40% GM but 8% shrinkage (a critical signal for theft or damage). Separating them as explicit P&L lines forces attention on the non-revenue drivers of net profit erosion.

## 7. Implementation Summary
- `computePL()`: Filters → revenue → COGS → gross margin → shrinkage → markdown above threshold → operating → net profit. Rounds to 2 decimal places throughout.
- `computeTrend()`: Sorts by periodLabel, extracts key metrics per period, computes averages and MoM revenue growth.
- `compareBranches()`: Sorts by `netProfit` descending — highest-profit branch first.

## 8. Tests Executed
```
npm test
```

## 9. Verification Results
- **`src/tests/plDashboardEngine.test.ts`**: 4/4 tests passed.
  - Test 1: P&L computation with branch filtering, markdown threshold logic ✓
  - Test 2: Return rate (3.33%) and avg order value ✓
  - Test 3: Trend auto-sort + revenue growth (22.88% MoM) ✓
  - Test 4: Branch comparison sort ✓
- **Total Frontend Suite**: 75/75 test files, 472/472 tests green in 14.26s, exit code 0.

## 10. Known Limitations
- Operating cost matching uses full pool — multiple months of OP costs for the same branch will be summed; production scopes by `period` field at the API level.
- No GST-adjusted COGS — VAT/GST on purchases is treated as a cost element in `cogs`; production separates input tax credit (ITC) recovery.

## 11. Future Work
- FastAPI `GET /api/v1/reports/pl?branch={code}&from={date}&to={date}` backed by Postgres aggregates over `sales_transactions`, `stock_adjustments`, `operating_costs` tables.
- Auto-shrinkage import from stock adjustment module.
- Export P&L as PDF / Excel.

## 12. Related ADRs
- `ADR-001`: FastAPI Sole System of Record.
- `ADR-036`: Branch P&L Engine, Markdown Cost Policy, and Trend Computation.

## 13. Related RFCs
- `RFC-105`: Markdown Cost Policy Threshold, Shrinkage Reporting Cadence, Branch P&L Review Schedule.
