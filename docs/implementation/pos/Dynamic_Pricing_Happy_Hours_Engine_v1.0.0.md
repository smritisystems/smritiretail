<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.86.0
  Created      : 2026-08-28
  Modified     : 2026-08-28
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Implementation Plan: Real-Time Dynamic Pricing & Happy Hours POS Discount Engine (v1.0.0-GA)

## 1. Objective
Establish a Real-Time Dynamic Pricing & Happy Hours Automated Discount Engine (`DynamicPricingEngine.ts` and `DynamicPricingStudioModal.tsx`) in SMRITI Retail OS, providing time-of-day, day-of-week, category-tiered, and cart-level promotional discounting with live POS simulation and register synchronization.

## 2. Business Motivation
Retailers leverage afternoon happy hours, flash weekend sales, and off-peak promotional discounts to drive store footfall without relying on manual cashier discount entry.

## 3. Scope
- Dynamic Pricing & Happy Hours Calculation Engine (`src/utils/dynamicPricingEngine.ts`).
- Interactive Dynamic Pricing Studio Modal (`src/components/billing/propos/DynamicPricingStudioModal.tsx`).
- Evaluation rules: `HAPPY_HOURS`, `TIERED_DISCOUNT`, `BOGO_BUNDLE`, `FLAT_DISCOUNT`.
- Time-of-day and day-of-week time-window evaluators.
- Vitest certification suite (`src/tests/dynamicPricingEngine.test.ts`).

## 4. Current State
Promotional rules existed in basic catalog forms without time-window clock evaluators or live cart simulation.

## 5. Gap Analysis
- Needed automated clock-driven evaluation that recalculates line totals dynamically as time transitions into happy hours.

## 6. Architecture Impact
- Re-verifies Rule 1 & Rule 5: Promotional rules and sales discounts flow to FastAPI/PostgreSQL double-entry general ledger as trade discount vouchers.

## 7. Proposed Design
```text
┌────────────────────────────────────────────────────────────────────────────┐
│         REAL-TIME DYNAMIC PRICING & HAPPY HOURS RULES ENGINE               │
├────────────────────────────────┬───────────────────────────────────────────┤
│  TIME WINDOW EVALUATOR         │  CART DISCOUNT ALLOCATION                 │
│  - 14:00 - 17:00 (Happy Hour)  │  - Apparel Line Total: ₹2,000 -> ₹1,600   │
│  - Days: Mon-Fri               │  - Total Discount: -₹400 (20% Happy Hour) │
│  - Trigger Status: ACTIVE      │  - Final Payable Subtotal: ₹1,600         │
└────────────────────────────────┴───────────────────────────────────────────┘
```

## 8. Files Created
- `src/utils/dynamicPricingEngine.ts`
- `src/components/billing/propos/DynamicPricingStudioModal.tsx`
- `src/tests/dynamicPricingEngine.test.ts`
- `docs/implementation/pos/Dynamic_Pricing_Happy_Hours_Engine_v1.0.0.md`
- `docs/walkthrough/pos/Dynamic_Pricing_Happy_Hours_Engine_v1.0.0.md`

## 9. Files Modified
- `docs/implementation/README.md`
- `docs/walkthrough/README.md`
- `CHANGELOG.md`

## 10. Dependencies
- React 18+
- Tailwind CSS
- Vitest 4.1+

## 11. Risks
- *Risk:* Conflicting stackable discounts creating negative line totals.
  *Mitigation:* Engine enforces non-stackable caps and floors line total at zero.

## 12. Rollback Strategy
Non-destructive modular utility and studio modal with dedicated test suite.

## 13. Verification Plan
- Unit tests verifying rule activation by date/time, category matching, discount calculation, and inactive window protection.
- Full Vitest suite pass rate (`400/400 green`).

## 14. Test Plan
- Run `npm test`.

## 15. Documentation Impact
- Update SMRITI Pricing & Promotional Campaigns Governance Manual.

## 16. Deployment Plan
- Build and bundle with frontend client package.

## 17. Status
Completed & Verified (`400/400 frontend tests green`).

## 18. Related ADRs
- `ADR-001`: FastAPI Sole System of Record.
- `ADR-020`: Dynamic Pricing & Real-Time POS Promotion Engine.

## 19. Related Walkthroughs
- `docs/walkthrough/pos/Dynamic_Pricing_Happy_Hours_Engine_v1.0.0.md`.
