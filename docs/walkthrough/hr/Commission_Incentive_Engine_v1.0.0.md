<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.107.0
  Created      : 2026-08-28
  Modified     : 2026-08-28
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough: Staff Commission & Incentive Engine (v1.0.0-GA)

## 1. Purpose
Documents the Commission Engine — a tiered sales rep commission calculator with progressive slab rates, target-achievement bonus, top-performer branch bonus, payout lifecycle management, and ledger aggregation.

## 2. Scope
- `CommissionEngine` covering `computeTieredCommission()`, `computeRepCommission()`, `computeBranchCommissions()`, `raisePayout()`, `approve()`, `markPaid()`, `dispute()`, and `payoutLedger()`.
- `DEFAULT_COMMISSION_CONFIG`: 4-tier slabs (0–50k: 2%, 50k–100k: 3.5%, 100k–200k: 5%, 200k+: 6.5%), target bonus 0.5%, top-performer bonus 0.25%.
- `computeBranchCommissions()` groups by branch, identifies the rep with highest net sales per branch as top performer, computes all commissions, sorts by net sales descending.
- Payout lifecycle: PENDING → APPROVED → PAID / DISPUTED / CANCELLED.
- `CommissionStudioModal` with ranked leaderboard, tier breakdown waterfall, payout ledger with action buttons.

## 3. Files Created
- `src/utils/commissionEngine.ts`
- `src/components/hr/CommissionStudioModal.tsx`
- `src/tests/commissionEngine.test.ts`
- `docs/walkthrough/hr/Commission_Incentive_Engine_v1.0.0.md`

## 4. Files Modified
- `docs/implementation/README.md`
- `docs/walkthrough/README.md`
- `CHANGELOG.md`

## 5. Architecture Decisions
1. **Progressive slab computation is remainder-based**: `computeTieredCommission()` iterates tiers sequentially, consuming `remaining` sales value slab by slab — a standard waterfall approach ensuring correctness for any net sales value.
2. **`Infinity` as the top tier ceiling**: `tier.toValue === Infinity` signals an open-ended top tier — the entire remaining amount is consumed in one step without requiring a sentinel value.
3. **Top performer is identified per branch**: `computeBranchCommissions()` computes net sales for each rep in a branch independently, identifies the top (highest net) per branch, then passes `isTopPerformer=true` to `computeRepCommission()`. This isolates the bonus to a per-branch comparison, not global.
4. **Target bonus is all-or-nothing at 100%**: `revenueAchievementPct >= 100` triggers the bonus — no partial bonus for 90% achievement. This is configurable via `CommissionConfig.targetAchievementBonusPct`.
5. **Payout is a snapshot of the summary at raise time**: `raisePayout()` captures `netSales` and `totalCommission` from the summary — subsequent edits to sales data do not retroactively affect raised payouts, preserving payout integrity.

## 6. Design Rationale
In retail, commission disputes typically arise because the calculation is opaque — staff don't know which tier they're in or why their bonus wasn't triggered. The tiered breakdown in `appliedTiers` provides a per-slab audit trace that the CommissionStudioModal exposes as a full waterfall, making the calculation verifiable by any rep or HR manager.

## 7. Implementation Summary
- `computeTieredCommission()`: Iterates tiers by ascending `fromValue`, consumes `remaining` per slab, accumulates commission.
- `computeRepCommission()`: Filters entries by repId + period prefix, computes net sales, calls `computeTieredCommission()`, applies target and top-performer bonuses.
- `computeBranchCommissions()`: Groups targets by branch, identifies top performer per branch by highest net sales, delegates to `computeRepCommission()`, sorts results by `netSales` descending.
- `raisePayout()`: Snapshots summary into a `CommissionPayout` with PENDING status and sequenced `payoutNo`.
- `payoutLedger()`: Groups payouts by status, sums commissions, computes `avgCommission` across all payouts.

## 8. Tests Executed
```
npm test
```

## 9. Verification Results
- **`src/tests/commissionEngine.test.ts`**: 4/4 tests passed.
  - Test 1: 4-tier slab spanning netSales=205000 → commission=8075 (1000+1750+5000+325) ✓
  - Test 2: REP-01 target bonus=1025 (205000×0.5%), top-performer bonus=512.5, total=9612.5 ✓
  - Test 3: REP-02 below target → tieredCommission=3350, targetBonus=0, topPerformerBonus=0 ✓
  - Test 4: Payout lifecycle → PAID, APPROVED, PENDING; ledger sums correct ✓
- **Total Frontend Suite**: 78/78 test files, 484/484 tests green in 14.32s, exit code 0.

## 10. Known Limitations
- Commission period is matched by `txnDate.startsWith(period)` (string prefix on YYYY-MM) — production uses Postgres date range filter.
- `payoutCounter` is a static class variable — resets on module reload; production uses Postgres sequence for `payoutNo`.
- No commission dispute resolution workflow in this release — DISPUTED payouts require manual HR intervention.

## 11. Future Work
- FastAPI `GET /api/v1/commission/summaries?period={}&branch={}`, `POST /api/v1/commission/payouts`, `PATCH /api/v1/commission/payouts/{id}/approve` backed by Postgres.
- Rep-facing commission self-service portal (read-only, per-rep auth).
- Custom `CommissionConfig` per branch (different tier rates for different market segments).

## 12. Related ADRs
- `ADR-001`: FastAPI Sole System of Record.
- `ADR-041`: Commission Tier Structure, Target Bonus Policy, Top-Performer Determination, and Payout Lifecycle.

## 13. Related RFCs
- `RFC-110`: Commission Scheme Governance, Payout Approval Authority Matrix, and Dispute Resolution SLA.
