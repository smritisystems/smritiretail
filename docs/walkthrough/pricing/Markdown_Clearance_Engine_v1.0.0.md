<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.106.0
  Created      : 2026-08-28
  Modified     : 2026-08-28
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough: Markdown & Clearance Planning Engine (v1.0.0-GA)

## 1. Purpose
Documents the Markdown Engine — SKU-level markdown schedule management with progressive discount steps, sell-through recording and auto-completion, auto-trigger recommendation when sell-through falls behind pace at 60% campaign duration, and a sell-through report.

## 2. Scope
- `MarkdownEngine` covering plan lifecycle (DRAFT → ACTIVE → COMPLETED/CANCELLED/PAUSED), `applyStep()`, `recordSellThrough()`, `checkAutoTrigger()`, and `generateReport()`.
- `MARKDOWN_CONFIG`: `autoTriggerCheckPct=60`, `autoTriggerThreshold=50`.
- Auto-trigger fires when `elapsedPct ≥ 60%` AND `currentAvgSellThrough < 50%` AND not already fired — marks `autoTriggerFired=true` and sets `nextRecommendedStep`.
- `generateReport()` emits `recommendation` whenever `nextRecommendedStep` is set (regardless of `onTrack`) or when `!onTrack`.
- `MarkdownPlanningModal` with plan list, sell-through gauge, clickable step cards, SKU table, and sell-through report tab.

## 3. Files Created
- `src/utils/markdownEngine.ts`
- `src/components/pricing/MarkdownPlanningModal.tsx`
- `src/tests/markdownEngine.test.ts`
- `docs/walkthrough/pricing/Markdown_Clearance_Engine_v1.0.0.md`

## 4. Files Modified
- `src/utils/markdownEngine.ts` (patch: `generateReport()` recommendation emits on `nextRecommendedStep` set, not only when `!onTrack`)
- `src/tests/markdownEngine.test.ts` (patch: Test 4 `asOf` date corrected to Aug 15 — 23% time elapsed → threshold 18.7% → `onTrack=true` with 40% ST)
- `docs/implementation/README.md`
- `docs/walkthrough/README.md`
- `CHANGELOG.md`

## 5. Architecture Decisions
1. **Sell-through auto-completion is atomic in `recordSellThrough()`**: When `currentAvgSellThrough >= targetSellThroughPct`, the plan status transitions to COMPLETED immediately — no separate close call needed.
2. **Auto-trigger is idempotent**: `autoTriggerFired` guard ensures the trigger fires at most once per plan, preventing repeated recommendations on every `checkAutoTrigger()` call.
3. **Steps are applied per-SKU**: `applyStep()` recomputes `effectivePrice = basePrice × (1 - discountPct/100)` for every SKU line using its own `basePrice` — consistent across heterogeneous price points.
4. **`generateReport()` emits recommendation when `nextRecommendedStep` is set**: The recommendation is a pending action regardless of current pace — surfacing it even when the plan is technically on-track prevents it from being silently ignored.
5. **`onTrack` uses proportional pace**: `currentAvgSellThrough >= targetSellThroughPct × (timeElapsedPct / 100)` — if 30% of time has elapsed, the plan is on-track if at least 30% of the target is achieved.

## 6. Design Rationale
In retail, markdown decisions are typically made too late — by the time a manager notices slow movement, the campaign has only days left and needs a deep slash that destroys margin. The auto-trigger at 60% time with 50% ST threshold gives the team a structured, data-driven warning while there is still enough campaign runway to apply a moderate step and recover.

## 7. Implementation Summary
- `createPlan()`: Initialises SKU lines with `basePrice` as `currentEffectivePrice`, all steps inactive.
- `applyStep()`: Marks `isActive` on the specified step, sets `activatedAt`, recomputes all SKU effective prices.
- `recordSellThrough()`: Per-SKU `unitsSold`/`openingStock` → `sellThroughPct`; averages across SKUs; transitions to COMPLETED if target hit.
- `checkAutoTrigger()`: Computes `elapsedPct`; fires if above `autoTriggerCheckPct` and `currentAvgSellThrough < autoTriggerThreshold`; identifies `nextRecommendedStep` as first step with `stepNo > currentStep`.
- `generateReport()`: Full analytics snapshot — `daysElapsed`, `timeElapsedPct`, `onTrack`, recommendation, per-SKU breakdown.

## 8. Tests Executed
```
npm test
```

## 9. Verification Results
- **`src/tests/markdownEngine.test.ts`**: 4/4 tests passed.
  - Test 1: Plan creation + step 1 → effectivePrice cotton=108, denim=225 ✓
  - Test 2: 80%/80% sell-through → COMPLETED ✓
  - Test 3: Auto-trigger at 65% elapsed / 20% ST → `autoTriggerFired=true`, `nextRecommendedStep=2` ✓
  - Test 4: Report at Aug 15 (23% time, 40% ST) → `onTrack=true`, `recommendation` contains "Step 2" ✓
- **Total Frontend Suite**: 78/78 test files, 484/484 tests green in 14.32s, exit code 0.

## 10. Known Limitations
- Sell-through is per-unit averaged across all SKUs — production weights by opening stock value for a revenue-weighted sell-through %.
- `checkAutoTrigger()` is called manually — production wires it into a nightly APScheduler cron over all ACTIVE plans.
- Step `effectivePrice` in `MarkdownStep` is currently 0 (computed per-SKU in `skuLines`); production computes a reference price per step for display in the steps panel.

## 11. Future Work
- FastAPI `POST /api/v1/markdown-plans/`, `PATCH /api/v1/markdown-plans/{id}/apply-step`, `POST /api/v1/markdown-plans/{id}/sell-through` backed by Postgres.
- Nightly cron `checkAutoTrigger()` over all ACTIVE plans with notification to branch manager.
- Integration with Pricing Engine — applying a markdown step auto-updates the effective price in the price list.

## 12. Related ADRs
- `ADR-001`: FastAPI Sole System of Record.
- `ADR-040`: Markdown Plan Lifecycle, Auto-Trigger Policy, and Sell-Through Computation Method.

## 13. Related RFCs
- `RFC-109`: Markdown Authorisation Matrix, Auto-Trigger Threshold Calibration, and Clearance Campaign Review Schedule.
