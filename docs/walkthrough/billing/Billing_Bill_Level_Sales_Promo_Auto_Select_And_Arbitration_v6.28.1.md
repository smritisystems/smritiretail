<!--
  Project      : SMRITI Retail OS
  Repository   : SMRITIRetailNX
  Organization : AITDL NETWORKS

  Founders

  * Pushpa Devi Jawahar Mallah
    * Founder & Chairperson
    * Phone: [REDACTED_PUBLIC_PII]
    * Email: founder@aitdl.com

  * Jawahar Ramkripal Mallah
    * Founder, Chief Executive Officer (CEO) & Chief Software Architect
    * Email: founder@aitdl.com

  * Websites: aitdl.com | erpnbook.com | smritibooks.com

  * Version    : 6.28.1
  * Created    : 2026-09-17
  * Modified   : 2026-09-17
  * Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
  * License    : Proprietary Commercial Software
  * Classification: Internal
-->

# Walkthrough: SMRITI POS Bill-Level Sales Promotion Auto-Select & Basket Value Arbitration

**Topic:** Real-Time Bill-Level Sales Promotion Auto-Resolution Engine & Basket Value Arbitration  
**Version:** v6.28.1  
**Area:** Billing (`src/components/billing/`, `src/services/`)  
**Status:** Completed & Verified  

---

## 1. Purpose
In modern enterprise retail operations (supermarkets, department stores, fashion lifestyle chains), promotional incentives are frequently structured at the **basket / transaction level** (e.g., "Spend ₹3,000 Save ₹500", "Weekend Flat ₹700 Off on ₹3,000+", "10% Off Entire Bill for VIP Members", and seasonal tiered slabs). 

Prior to this phase, bill-level discounts required cashiers to manually press `F6` and pick a scheme from a dialog. This caused:
1. Cashier omission of valid customer promotional entitlements, resulting in customer dissatisfaction at checkout.
2. Inconsistent commercial margin calculations when multiple basket promotions overlapped.
3. Billing checkout friction and extended customer queue wait times.

This implementation delivers **Phase 2: Automated Bill-Level Sales Promotion Auto-Select & Basket Value Arbitration**, seamlessly calculating cart qualifications and applying the optimal basket promotion in real time while preserving cashier manual override authority (`F6`).

---

## 2. Scope
1. **Synchronous Basket Auto-Resolution (`SmritiSalesPromotionService.resolveBestBillPromo`):**
   - Evaluates active `BILL_LEVEL` promotions against cart subtotal, item count, date validity, day of week, happy hours, customer group, and minimum bill threshold (`minBillValue`).
   - Supports both percentage discounts (`BILL_DISCOUNT_PERCENT`, `BILL_VALUE_SLAB`) with ceiling caps (`maxDiscount`) and flat currency markdowns (`BILL_DISCOUNT_FLAT`).
2. **Canonical "Highest Discount Wins" Basket Arbitration:**
   - Multi-candidate ranking based on net customer rupee savings.
   - Deterministic tie-breaking using promotion priority (`1 = highest priority`).
3. **POS Terminal Integration (`ProPosBillingTerm.tsx` & `BillingTerm.tsx`):**
   - Real-time cart observation hook updating `billLevelPromo` without operator intervention.
   - Cashier manual override preservation (`isManualBillPromoOverride`), preventing automated overwrites when a cashier applies bespoke adjustments in the `F6` modal.
   - Visual badge display (`🏷️ {billLevelPromo.code} [F6]`) in the Net Values summary bar.
   - Automatic lifecycle reset upon invoice creation (`Alt+1` New Bill / `handleNewInvoice`).
4. **Verification & Test Coverage:**
   - Expanded unit test suite in `src/tests/smritiAutoSelectPromotion.test.ts` (10/10 tests green).
   - Zero TypeScript errors (`npx tsc --noEmit` clean exit 0).

---

## 3. Files Created
*None (All functionality integrated into canonical core architecture).*

---

## 4. Files Modified
1. `src/services/smritiSalesPromotionService.ts`
   - Added `BillPromoResolutionResult` interface.
   - Implemented `SmritiSalesPromotionService.resolveBestBillPromo(...)`.
   - Supported `BILL_VALUE_SLAB` along with `BILL_DISCOUNT_PERCENT` and `BILL_DISCOUNT_FLAT`.
   - Set inactive defaults for event-specific sample schemes (`CLEAR15`, `TIER_SLAB`).
2. `src/components/billing/propos/ProPosBillingTerm.tsx`
   - Added `isManualBillPromoOverride` state.
   - Added real-time evaluation hook responding to cart subtotal and customer group changes.
   - Wired scheme badge in summary panel with direct `F6` shortcut.
   - Reset override flag on `handleNewBill`.
3. `src/components/billing/BillingTerm.tsx`
   - Added `isManualBillPromoOverride` state.
   - Added real-time evaluation hook responding to `summaryTotals.salesValue`.
   - Wired promo code badge into Bill Discount cell in summary grid.
   - Reset override flag on `handleNewInvoice` and set override on manual `onApplyPromos`.
4. `src/tests/smritiAutoSelectPromotion.test.ts`
   - Added unit tests 7, 8, 9, 10 verifying bill slab thresholds, ceiling caps, customer group inheritance, and arbitration.

---

## 5. Architecture Decisions
1. **GST Section 15 Compliance Isolation:**
   - Bill discounts directly participate in `SmritiBillLevelPromoState`, which is proportionally apportioned across line items before GST calculations (`ABOVE_TAX` statutory trade discount) or post-tax net payable adjustments per Section 15 of the CGST Act.
2. **Deterministic Priority Arbitration Matrix:**
   ```
   Candidate Promos Qualified:
     [Scheme A: ₹700 Flat Off (Priority 5)] vs [Scheme B: 20% Capped @ ₹900 (Priority 6)]
   Cart Subtotal: ₹4,000
     Scheme A Rupee Savings: ₹700.00
     Scheme B Rupee Savings: 20% * ₹4,000 = ₹800.00 (<= ₹900 cap)
   Decision: Scheme B Wins (₹800 > ₹700) -> Customer receives maximum discount.
   ```
3. **Cashier Authority Protection:**
   - If a cashier modifies discounts manually via the `F6` modal, `isManualBillPromoOverride` is latched to `true`, preventing subsequent cart changes from overriding the cashier's intentional trade discount.

---

## 6. Design Rationale
- **Zero-Latency In-Memory Execution:** Promotion resolution executes in < 1ms synchronously in client state, ensuring high-throughput retail checkout lanes experience zero lag during rapid scanning.
- **Visual Transparency:** The applied scheme code is rendered directly in the Net Values summary bar with an interactive `F6` affordance, keeping the cashier and customer informed of applied discounts.

---

## 7. Implementation Summary
- **SMRITI Sales Promotion Service:**
  `resolveBestBillPromo` accepts `subtotal`, `itemsCount`, `customerGroup`, `customerCode`, and `evalDate`. It filters eligible schemes based on date windows, active days of week, happy hours, customer group permissions, and `minBillValue`. Candidates are ranked by net rupee savings, with priority as the secondary tie-breaker.
- **Pro POS & Standard Billing Terminal:**
  Real-time `useEffect` listeners monitor subtotal and customer changes. When eligible, `billLevelPromo` updates automatically with the scheme code, percentage, amount, reason, and badge text, triggering instant re-calculation of net payable amount and GST taxes.

---

## 8. Tests Executed
1. `npm test -- src/tests/smritiAutoSelectPromotion.test.ts` (10/10 tests passed in 29ms)
   - Test 1: Direct item-level discount on single product scan
   - Test 2: Commercial Customer Group Auto-Inheritance (Reliance Retail 43.76%)
   - Test 3: Highest Discount Wins Arbitration (Item-level)
   - Test 4: Incremental duplicate scan progression (B2G1 unlocking on 3rd unit)
   - Test 5: Happy Hours time restrictions
   - Test 6: Flat discount computation
   - Test 7: Bill-Level slab threshold qualification (`FEST500` activates when subtotal >= ₹3,000)
   - Test 8: Bill-Level ceiling cap enforcement (`MEGA20` 20% strictly capped at `maxDiscount: 400`)
   - Test 9: Customer group contract inheritance for bill-level promos (`VIP10` 10% for `VIP`)
   - Test 10: Highest Discount Wins arbitration across competing bill schemes
2. `npm test -- src/tests/smritiSalesPromotionEngine.test.ts` (15/15 tests passed in 35ms)
3. `npx tsc --noEmit` (TypeScript 0 errors)

---

## 9. Verification Results
```
Implementation Status

✓ Code Complete
✓ Tests Passed (25/25 green across promotion suites)
✓ Documentation Updated
✓ CHANGELOG Updated
✓ No Broken Links
✓ TypeScript Compilation: 0 Errors

Evidence Level: A (Terminal verified, AST validated)
```

---

## 10. Known Limitations
- Bill-level tiered slab progression currently calculates discount on total qualifying subtotal. Complex multi-tier tiered brackets (e.g., 5% on first ₹2,000, 10% on next ₹3,000) are resolved against the highest matched slab tier.

---

## 11. Future Work
- Support for coupon code redemption inputs at bill level combined with automated basket promotions.
- Support for payment method-specific bill discounts (e.g., additional 5% off when paying with UPI / specific bank cards).

---

## 12. Related ADRs
- `ADR-001`: Statutory GST Section 15 Discount Apportionment
- `ADR-005`: One-Way Projections & Statutory Snapshot Rule

---

## 13. Related RFCs
- `RFC-2026-09-01`: SMRITI Sales Promotion Engine & Unified Rule Architecture
