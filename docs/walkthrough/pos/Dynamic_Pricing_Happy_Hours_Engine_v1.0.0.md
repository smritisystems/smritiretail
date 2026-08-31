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

# Walkthrough: Real-Time Dynamic Pricing & Happy Hours POS Discount Engine (v1.0.0-GA)

## 1. Purpose
Documents the implementation and verification of the Real-Time Dynamic Pricing & Happy Hours POS Discount Engine, enabling automated time-window and day-of-week promotional discount calculation directly at POS register checkout.

## 2. Scope
- Dynamic Pricing & Happy Hours Calculation Engine (`src/utils/dynamicPricingEngine.ts`).
- Interactive Dynamic Pricing Studio Modal (`src/components/billing/propos/DynamicPricingStudioModal.tsx`).
- Evaluation rules: `HAPPY_HOURS`, `TIERED_DISCOUNT`, `BOGO_BUNDLE`, `FLAT_DISCOUNT`.
- Time-of-day and day-of-week time-window evaluators.
- Vitest certification suite (`src/tests/dynamicPricingEngine.test.ts`).

## 3. Files Created
- `src/utils/dynamicPricingEngine.ts`
- `src/components/billing/propos/DynamicPricingStudioModal.tsx`
- `src/tests/dynamicPricingEngine.test.ts`
- `docs/implementation/pos/Dynamic_Pricing_Happy_Hours_Engine_v1.0.0.md`
- `docs/walkthrough/pos/Dynamic_Pricing_Happy_Hours_Engine_v1.0.0.md`

## 4. Files Modified
- `docs/implementation/README.md`
- `docs/walkthrough/README.md`
- `CHANGELOG.md`

## 5. Architecture Decisions
1. **Minute-Level Clock Evaluation:** Evaluates time ranges in total elapsed minutes from midnight to guarantee exact start/stop boundary enforcement.
2. **Category & SKU Level Targeting:** Limits percentage happy hour cuts to specific target product categories while preserving full margins on excluded lines.
3. **Interactive Simulation Mode:** Provides live time scrubbing so store managers can verify cart discounts before publishing rules live.

## 6. Design Rationale
Maximizes promotional velocity during low-traffic afternoon hours while eliminating manual cashier discount override risks.

## 7. Implementation Summary
- `isRuleActiveAt`: Evaluates day-of-week and time-range eligibility.
- `evaluateCart`: Applies active rules to item lines and calculates original subtotal, discount, and final payable subtotal.

## 8. Tests Executed
```bash
npm test
```

## 9. Verification Results
- **Frontend Test Suite:** 57/57 test files passed (400/400 tests green).
- **Production Build:** Vite production bundle built in 26.92s with 0 errors.

## 10. Known Limitations
- Time checks rely on the POS terminal's local system clock.

## 11. Future Work
- Dynamic competitor price-matching integration via cloud API.

## 12. Related ADRs
- `ADR-001`: FastAPI Sole System of Record.
- `ADR-020`: Dynamic Pricing & Real-Time POS Promotion Engine.

## 13. Related RFCs
- `RFC-089`: Dynamic Pricing Rules Engine & Time-Window Evaluation Standard.
