<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.88.0
  Created      : 2026-08-28
  Modified     : 2026-08-28
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Implementation Plan: Universal Customer 360 & Loyalty Tier Progression Matrix (v1.0.0)

## Objective
Implement a dynamic 5-tier VIP loyalty engine with lifetime spend tracking, points earning at tier-specific rates, birthday month multipliers, automatic tier upgrades with bonus points, and point redemption as cash discount.

## Business Motivation
Loyalty programs increase repeat visit frequency and average transaction value. A 5-tier system (Bronze → Diamond) creates aspirational progression that incentivizes larger purchases and retains high-value customers.

## Scope
- 5-tier structure: Bronze, Silver, Gold, Platinum, Diamond.
- Tier-based points earn rates (1–10 pts per ₹100).
- Birthday month purchase multiplier (2x–5x).
- Automatic tier upgrade with welcome bonus points.
- Point-to-cash redemption at tier-specific conversion rates.

## Current State
The existing `crmLoyalty.test.ts` covers basic CRM loyalty features. The new `loyaltyEngine.ts` provides a complete, deterministic tier engine not previously implemented.

## Gap Analysis
- No multi-tier earn rate differentiation.
- No birthday month multiplier.
- No automatic tier upgrade with bonus points.
- No tier-specific redemption rates.

## Architecture Impact
- New engine: `src/utils/loyaltyEngine.ts`.
- Production: FastAPI `POST /api/v1/loyalty/earn`, `POST /api/v1/loyalty/redeem`, `GET /api/v1/loyalty/customer/{id}/360` endpoints.
- PostgreSQL: `loyalty_customers`, `loyalty_events`, `loyalty_tiers` tables.

## Proposed Design
See `src/utils/loyaltyEngine.ts` for full engine implementation.

## Files Created
- `src/utils/loyaltyEngine.ts`
- `src/components/crm/Customer360LoyaltyModal.tsx`
- `src/tests/loyaltyEngine.test.ts`
- `docs/implementation/crm/Customer360_Loyalty_Tier_Progression_v1.0.0.md`
- `docs/walkthrough/crm/Customer360_Loyalty_Tier_Progression_v1.0.0.md`

## Files Modified
- `docs/implementation/README.md`
- `docs/walkthrough/README.md`
- `CHANGELOG.md`

## Dependencies
No new third-party dependencies.

## Risks
- Tier thresholds defined client-side; must be loaded from PostgreSQL `loyalty_tiers` configuration table in production.

## Rollback Strategy
Remove `loyaltyEngine.ts` and `Customer360LoyaltyModal.tsx`; restore index docs.

## Verification Plan
- 4/4 Vitest unit tests covering tier resolution, birthday multiplier, tier upgrade bonus, and redemption guards.

## Test Plan
```bash
npm test
```

## Documentation Impact
- Implementation Plan (this document)
- Walkthrough document
- CHANGELOG

## Deployment Plan
1. Merge to main.
2. Backend loyalty API endpoints in next sprint.

## Status
Completed

## Related ADRs
- `ADR-001`: FastAPI Sole System of Record.
- `ADR-022`: Loyalty Tier Architecture and Points Ledger Standard.

## Related Walkthroughs
- [Customer 360 Loyalty Tier Progression Walkthrough](../../walkthrough/crm/Customer360_Loyalty_Tier_Progression_v1.0.0.md)
