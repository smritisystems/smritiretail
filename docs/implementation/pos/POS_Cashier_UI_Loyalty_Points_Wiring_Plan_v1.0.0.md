<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.49.0
  Created      : 2026-10-02
  Modified     : 2026-10-02
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Implementation Plan
-->

# Implementation Plan: POS Cashier UI — Customer Loyalty Points Multi-Tender & Split Settlement Wiring

**Document Identifier:** `IP-POS-LOYALTY-001`
**Version:** 1.0.0
**Status:** Completed
**Created:** 2026-10-02
**Author:** Jawahar Ramkripal Mallah, Chief Systems Architect & Creator

---

## 1. Objective
Complete the end-to-end frontend integration of the React 18 Counter POS Cashier Terminal (`ProPosBillingTerm.tsx`, `ProPosSettlementDl.tsx`, and `types.ts`) with the authoritative Phase P3 backend loyalty endpoints (`GET /api/v1/pos/customer-loyalty/{customer_id}` and `POST /api/v1/pos/checkout` tender `LOYALTY`), enabling real-time loyalty points balance visualization, 1-click redemption capped to available points and remaining balance, and seamless multi-tender split settlement.

---

## 2. Business Motivation
Following the completion and verification of backend Phase P3 (Customer Loyalty Points Double-Entry Accounting `DR 2070 / CR 1030`), cashiers require direct, seamless access to customer loyalty balances at checkout. Currently, cashiers would need to manually navigate away or use separate dialogs. Integrating live points balance lookup and 1-click redemption inside the F10 settlement dialog accelerates retail counter throughput, eliminates double-entry errors, and enforces strict boundary guards preventing points overdrafts.

---

## 3. Scope
- Update `src/components/billing/propos/types.ts` to add `CustomerLoyaltyBalanceResponse`, extend `POSTenderItem.tender_type` with `"LOYALTY" | "LOYALTY_POINTS"`, and enrich `ProPosCustomer` with loyalty state fields (`isLoyaltyEnrolled`, `availableLoyaltyValue`, `loyaltyRedemptionRatio`).
- Update `src/components/billing/propos/ProPosBillingTerm.tsx`:
  - Fetch live loyalty points balance on customer selection via `GET /api/v1/pos/customer-loyalty/{customer_id}`.
  - Render an interactive, compact loyalty points badge in the Customer toolbar for identified, enrolled customers (`★ 450 pts (₹450)`).
  - In `handleSettlementSuccess`, ensure `LOYALTY` tender is synthesized into `POSTenderItem[]` and payment mode resolves correctly (`SPLIT` vs `LOYALTY`).
- Update `src/components/billing/propos/ProPosSettlementDl.tsx`:
  - Fetch live loyalty balance on settlement modal open for identified customers.
  - Render a dedicated "Loyalty Points" tender selection option with live available point and monetary value counters.
  - Render a structured Loyalty Points Card with a 1-click "Redeem Max" button clamped to $\min(\text{balanceRemaining}, \text{availableLoyaltyValue})$.
  - Enforce fail-closed validation: block walk-in customers (`cust-01`, `C01`), non-enrolled customers, and redemptions exceeding available point balances.
  - Include `LOYALTY` in multi-tender split aggregation and pass `POSTenderItem[]` with `tender_type: "LOYALTY"` to `onSettle`.
- Create comprehensive automated test suite `src/tests/posCashierLoyaltyWiring.test.ts`.

---

## 4. Current State
- Backend Phase P3 is complete, tested (9/9 automated tests passing against real PostgreSQL), and published to `origin/smritiNX`.
- The backend endpoint `GET /api/v1/pos/customer-loyalty/{customer_id}` returns:
  `{ customer_id, customer_name, is_enrolled, member_id, card_number, current_points_balance, redemption_ratio, available_monetary_value, total_points_earned, total_points_redeemed }`.
- Frontend `ProPosSettlementDl.tsx` already handles Cash, Card, UPI, Store Credit / Wallet, and Credit Note, but loyalty points redemption is not wired to the live API or split tender items array.

---

## 5. Gap Analysis
1. `ProPosCustomer` interface lacks `availableLoyaltyValue`, `loyaltyRedemptionRatio`, and `isLoyaltyEnrolled` fields.
2. `POSTenderItem.tender_type` does not explicitly union `"LOYALTY"` or `"LOYALTY_POINTS"`.
3. `ProPosBillingTerm.tsx` does not trigger real-time loyalty balance lookups upon customer selection.
4. `ProPosSettlementDl.tsx` does not fetch live loyalty data, lacks the 1-click "Redeem Max" button for loyalty, and omits `LOYALTY` from `tenderItems` emitted to `onSettle`.

---

## 6. Architecture Impact
- **Client Tier:** React 18 + TypeScript POS cashier terminal. Zero breaking changes to existing cashier workflows.
- **API Communication Layer:** Consumes canonical endpoint `GET /api/v1/pos/customer-loyalty/{customer_id}` via `apiFetchV1.ts`.
- **Backend Convergence:** Emits `POST /api/v1/pos/checkout` payload with `tenders: [{ tender_type: "LOYALTY", amount: X, reference_no: "LOY-..." }]`, which triggers row-locked balance deduction and GL posting (`DR 2070 / CR 1030`).

---

## 7. Proposed Design
1. **Types Contract (`types.ts`):**
   - Add `CustomerLoyaltyBalanceResponse` interface.
   - Expand `POSTenderItem.tender_type` union to include `"LOYALTY" | "LOYALTY_POINTS"`.
   - Add `availableLoyaltyValue?: number`, `loyaltyRedemptionRatio?: number`, `isLoyaltyEnrolled?: boolean` to `ProPosCustomer`.
2. **Terminal Customer Synchronization (`ProPosBillingTerm.tsx`):**
   - On `handleCustomerSelection`, if `nextCustomer.id` is not walk-in, invoke `apiFetchV1<CustomerLoyaltyBalanceResponse>(/pos/customer-loyalty/${nextCustomer.id})` and store state.
   - Render badge `★ {customer.loyaltyPoints} pts (₹{customer.availableLoyaltyValue})` in customer toolbar.
3. **Settlement Dialog (`ProPosSettlementDl.tsx`):**
   - Query `/pos/customer-loyalty/${customer.id}` on dialog mount.
   - Add "Loyalty Points" tender button with badge.
   - In Middle Column, when `selectedMode === "LOYALTY"`, render conversion details (`1 pt = ₹{ratio}`), available value, and `Redeem Max` action.
   - On add payment / auto-settle, validate eligibility and clamp to available value.
   - Emit `POSTenderItem` with `tender_type: "LOYALTY"` to `onSettle`.

---

## 8. Files Created
1. `docs/implementation/pos/POS_Cashier_UI_Loyalty_Points_Wiring_Plan_v1.0.0.md` (This Plan)
2. `src/tests/posCashierLoyaltyWiring.test.ts` (Automated Vitest Test Suite)
3. `docs/walkthrough/pos/POS_Cashier_UI_Loyalty_Points_Wiring_v1.0.0.md` (Walkthrough)

---

## 9. Files Modified
1. `src/components/billing/propos/types.ts`
2. `src/components/billing/propos/ProPosBillingTerm.tsx`
3. `src/components/billing/propos/ProPosSettlementDl.tsx`
4. `docs/implementation/README.md`
5. `docs/walkthrough/README.md`

---

## 10. Dependencies
- React 18, Lucide React (`Award`, `Coins`, `CreditCard`, `Banknote`, `QrCode`, `WalletCards`)
- `src/lib/apiFetchV1.ts`
- FastAPI endpoint `/api/v1/pos/customer-loyalty/{customer_id}`

---

## 11. Risks & Mitigation
- **Risk:** Unidentified walk-in customer attempts loyalty redemption.
  *Mitigation:* Fail-closed check rejecting redemption with `"Select an identified customer before redeeming loyalty points."`
- **Risk:** Customer points balance insufficient for requested tender.
  *Mitigation:* Clamping via `Math.min(balanceRemaining, availableLoyaltyValue)` and blocking payments exceeding available monetary value.
- **Risk:** Redemption ratio is non-1.0 (e.g. 1 point = ₹0.50).
  *Mitigation:* Dynamic calculation using `redemption_ratio` received from authoritative backend response.

---

## 12. Rollback Strategy
Git revert of modified frontend files. Zero backend database or schema migrations are involved.

---

## 13. Verification Plan
1. Type check via `npx tsc --noEmit` (0 errors).
2. Automated Vitest tests in `src/tests/posCashierLoyaltyWiring.test.ts`.
3. Combined regression testing with `src/tests/posCashierTendersAndWallet.test.ts`.

---

## 14. Test Plan
- Test 1: Type validity of `POSTenderItem` with `LOYALTY` tender.
- Test 2: Balance query response parsing and tier ratio calculation.
- Test 3: Walk-in customer redemption prevention (fail-closed).
- Test 4: Non-enrolled customer redemption rejection.
- Test 5: Overdraft prevention when requested amount > available points value.
- Test 6: One-click "Redeem Max" calculation clamped to remaining invoice balance.
- Test 7: Multi-tender split calculation combining Cash + Loyalty Points + UPI.
- Test 8: Elevation of `payment_mode` to `"SPLIT"` when loyalty points are combined with other tenders.
- Test 9: Solo loyalty points settlement resolving `payment_mode: "LOYALTY"`.

---

## 15. Documentation Impact
- Update `docs/implementation/README.md`.
- Update `docs/walkthrough/README.md`.
- Create `docs/walkthrough/pos/POS_Cashier_UI_Loyalty_Points_Wiring_v1.0.0.md`.

---

## 16. Deployment Plan
Commit and push to `origin/smritiNX`. Sync testing environment via `git pull` on `F:\Smriti9`.

---

## 17. Status
In Progress

---

## 18. Related ADRs
- `ADR-007`: Unified General Ledger & Statutory Double-Entry Accounting
- `ADR-012`: Canonical Sales Transaction Writing Authority & Multi-Tender Settlement

---

## 19. Related Walkthroughs
- `WT-SALES-P3-001`: SMRITI Sales Phase P3 — Customer Loyalty Points Double-Entry Accounting & POS Redemption
- `WT-POS-001`: POS Cashier UI — Split Tenders & Customer Store Credit / Wallet Integration
