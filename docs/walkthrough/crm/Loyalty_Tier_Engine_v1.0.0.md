<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.110.0
  Created      : 2026-08-28
  Modified     : 2026-08-28
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough: Customer Loyalty Tier Upgrade Engine (v1.0.0-GA)

## 1. Purpose
Documents the Loyalty Tier Upgrade Engine — automated BRONZE → SILVER → GOLD → PLATINUM tier transitions with downgrade cooldown enforcement, anniversary bonus rewards, batch evaluation, and immutable audit trails.

## 2. Scope
- `LoyaltyTierEngine` covering `createMember()`, `accrue()`, `evaluateTier()`, `checkAnniversary()`, `evaluateBatch()`, `tierSummary()`.
- `DEFAULT_TIER_POLICY`: evaluation window 12 months, downgrade cooldown 3 months.
- Thresholds: SILVER ≥15k spend/1500pts, GOLD ≥50k/5000pts, PLATINUM ≥150k/15000pts.
- Anniversary bonuses: BRONZE 100pts, SILVER 300pts, GOLD 750pts, PLATINUM 2000pts.
- Downgrade blocked when `monthsElapsed(lastTierChangeAt, asOf) < downgradeCooldownMonths`.
- `LoyaltyTierModal` with member list, detail (KPIs, tier threshold reference, audit history), bulk evaluate tab, tier distribution summary.

## 3. Files Created
- `src/utils/loyaltyTierEngine.ts`
- `src/components/crm/LoyaltyTierModal.tsx`
- `src/tests/loyaltyTierEngine2.test.ts`
- `docs/walkthrough/crm/Loyalty_Tier_Engine_v1.0.0.md`

## 4. Files Modified
- `src/tests/loyaltyTierEngine2.test.ts` (patch: Test 4 sets `lastTierChangeAt` to 1 month ago so downgrade cooldown blocks, keeping m1 SILVER through batch evaluation)
- `docs/implementation/README.md`
- `docs/walkthrough/README.md`
- `CHANGELOG.md`

## 5. Architecture Decisions
1. **`evaluateTier()` is non-destructive**: The function returns a new `LoyaltyMember` and a `TierEvaluation` object — the caller decides whether to persist the result. This makes it safe to run speculatively for previews without committing.
2. **Downgrade cooldown uses floating-point months**: `(asOfMs - lastChangeMs) / (30 × 86400000)` — approximation sufficient for policy enforcement at month granularity; production uses Postgres `age()` for exact calendar months.
3. **Upgrade is immediate; downgrade is deferred**: Upgrading on threshold crossing rewards the customer instantly. Downgrading after a period of lower spend protects customers from accidental tier loss (e.g., one low month due to travel).
4. **`checkAnniversary()` fires on exact date match**: `asOf.getDate() === anniversary.getDate() && asOf.getMonth() === anniversary.getMonth()` — production calls this from a nightly cron and processes all members whose anniversary falls on that day.
5. **`resolveTier()` picks the highest earned tier**: Filters all tiers where `windowSpend >= minSpend && windowPoints >= minPoints`, then sorts by `TIER_RANK` descending and returns the top — a member qualifying for GOLD also qualifies for SILVER but earns the higher tier.

## 6. Design Rationale
Tier transitions in loyalty programs are high-stakes customer communications. An unexpected downgrade email erodes trust more than the original tier benefit was worth. The 3-month cooldown creates a buffer — customers who had a bad month don't lose their tier the following month, reducing churn and support complaints.

## 7. Implementation Summary
- `createMember()`: Initialises member with `currentTier`, zero points/spend, `lastTierChangeAt = joinDate`.
- `accrue()`: Adds to `currentPoints`, `lifetimePoints`, `lifetimeSpend`, `windowSpend`, `windowPoints` — does not trigger evaluation.
- `evaluateTier()`: Resolves proposed tier; if upgrade → immediate; if downgrade → check cooldown; if no change → update `lastEvaluatedAt` only.
- `checkAnniversary()`: Matches `asOf` date against member join anniversary; awards tier-specific bonus points; logs `ANNIVERSARY_REWARD` audit entry with `pointsDelta`.
- `evaluateBatch()`: Maps `evaluateTier()` over all members; returns updated members + evaluations.
- `tierSummary()`: Counts members per tier — `{ BRONZE, SILVER, GOLD, PLATINUM }`.

## 8. Tests Executed
```
npm test
```

## 9. Verification Results
- **`src/tests/loyaltyTierEngine2.test.ts`**: 4/4 tests passed.
  - Test 1: BRONZE + 55k/5500pts → GOLD upgrade, audit trail entry ✓
  - Test 2: GOLD + 1mo lastTierChange + low spend → downgrade blocked (cooldown) ✓
  - Test 3: GOLD + 6mo lastTierChange + low spend → downgrade to BRONZE (cooldown elapsed) ✓
  - Test 4: SILVER anniversary bonus 300pts; batch eval: m1 cooldown-locked (SILVER), m2 GOLD; tierSummary SILVER=1, GOLD=1 ✓
- **Total Frontend Suite**: 81/81 test files, 496/496 tests green in 15.37s, exit code 0.

## 10. Known Limitations
- `windowSpend` and `windowPoints` are lifetime-accumulated in this release — production resets them at the start of each evaluation window (rolling 12 months using Postgres date-range sums).
- Anniversary check requires daily cron invocation — not self-scheduling in the engine.
- `TIER_RANK` map and `AUTHORITY_RANK` (override engine) are separate — no shared rank utility yet.

## 11. Future Work
- FastAPI `POST /api/v1/loyalty/members/evaluate-batch`, `GET /api/v1/loyalty/members/{id}/tier-history`.
- Nightly anniversary cron over all active members with automated reward email.
- Configurable tier policy per branch / loyalty scheme.

## 12. Related ADRs
- `ADR-001`: FastAPI Sole System of Record.
- `ADR-044`: Loyalty Tier Evaluation Policy, Downgrade Cooldown, Anniversary Reward Configuration.

## 13. Related RFCs
- `RFC-113`: Loyalty Tier Governance, Tier Change Communication Policy, and Cooldown Calibration Review Schedule.
