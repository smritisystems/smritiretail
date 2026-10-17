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
  Classification: Internal
-->

# Walkthrough: POS Cashier UI — Customer Loyalty Points Multi-Tender & Split Settlement Wiring

**Document ID:** `WT-POS-LOYALTY-001`
**Status:** Completed
**Version:** 1.0.0
**Effective Date:** 2026-10-02
**Implementation Plan Reference:** [POS_Cashier_UI_Loyalty_Points_Wiring_Plan_v1.0.0.md](../../implementation/pos/POS_Cashier_UI_Loyalty_Points_Wiring_Plan_v1.0.0.md) (`IP-POS-LOYALTY-001`)
**Evidence Level:** Level A (Direct Vitest Terminal Verification & TypeScript Compiler Verification)

---

## 1. Purpose

This walkthrough documents the frontend integration of the React 18 Counter POS Cashier Terminal (`ProPosBillingTerm.tsx`, `ProPosSettlementDl.tsx`, and `types.ts`) with the authoritative Phase P3 backend loyalty endpoints (`GET /api/v1/pos/customer-loyalty/{customer_id}` and `POST /api/v1/pos/checkout` tender `LOYALTY`). It provides retail cashiers with real-time loyalty balance indicators, 1-click redemption capped to available points and remaining balance, and multi-tender split settlement capabilities.

---

## 2. Scope

- **Type Contracts (`types.ts`):** Added `CustomerLoyaltyBalanceResponse`, expanded `POSTenderItem.tender_type` with `"LOYALTY" | "LOYALTY_POINTS"`, and added loyalty state fields (`isLoyaltyEnrolled`, `availableLoyaltyValue`, `loyaltyRedemptionRatio`) to `ProPosCustomer`.
- **Customer Toolbar (`ProPosBillingTerm.tsx`):** Added real-time loyalty balance fetch on customer selection and an interactive toolbar badge (`★ {points} pts (₹{value})`).
- **Settlement Dialog (`ProPosSettlementDl.tsx`):**
  - Live query to `/pos/customer-loyalty/{customer_id}` on dialog open.
  - Dedicated "Loyalty Points" tender mode button displaying available points and monetary value.
  - Interactive Loyalty Points Card with dynamic tier conversion ratio display (`1 pt = ₹{ratio}`) and a 1-click "Redeem Max" button clamped to $\min(\text{balanceRemaining}, \text{availableLoyaltyValue})$.
  - Boundary validations fail-closed against walk-in customers (`cust-01`, `C01`), non-enrolled customers, and redemptions exceeding available point balances.
  - Full multi-tender split calculation generating `POSTenderItem` with `tender_type: "LOYALTY"`.
- **Automated Verification:** 13/13 Vitest tests in `src/tests/posCashierLoyaltyWiring.test.ts` (26/26 combined with `posCashierTendersAndWallet.test.ts`) and 0 errors in `npx tsc --noEmit`.

---

## 3. Files Created

1. `docs/implementation/pos/POS_Cashier_UI_Loyalty_Points_Wiring_Plan_v1.0.0.md` (`IP-POS-LOYALTY-001`)
2. `src/tests/posCashierLoyaltyWiring.test.ts` (Automated Vitest Test Suite)
3. `docs/walkthrough/pos/POS_Cashier_UI_Loyalty_Points_Wiring_v1.0.0.md` (This Walkthrough)

---

## 4. Files Modified

1. `src/components/billing/propos/types.ts` — Added `CustomerLoyaltyBalanceResponse`, expanded `POSTenderItem.tender_type`, and added loyalty properties to `ProPosCustomer`.
2. `src/components/billing/propos/ProPosBillingTerm.tsx` — Added loyalty lookup in `handleCustomerSelection`, rendered toolbar loyalty badge, and added `LOYALTY` fallback tender mapping in `handleSettlementSuccess`.
3. `src/components/billing/propos/ProPosSettlementDl.tsx` — Added loyalty state & fetch, validation in `handleAddPayment`, auto-settle handling in `handleFinalSettle`, and interactive Loyalty Card with `Redeem Max` action.
4. `docs/implementation/README.md` — Updated master implementation table.
5. `docs/walkthrough/README.md` — Appended master walkthrough table.

---

## 5. Architecture Decisions

- **AD-POS-003: Front-End Real-Time Loyalty Ratio Resolution:** Rather than hardcoding 1 point = ₹1.00 on the client, the client reads `redemption_ratio` directly from `GET /api/v1/pos/customer-loyalty/{customer_id}`, enabling tier-based dynamic ratios (e.g. Platinum 1 pt = ₹1.50) without client redeployment.
- **AD-POS-004: Fail-Closed Walk-In Customer Guard:** Walk-in customers (`cust-01` / `C01`) are strictly prohibited from redeeming loyalty points, preventing fraudulent redemption or unintended point deductions from default store customer IDs.
- **AD-POS-005: Clamped 1-Click "Redeem Max" Operation:** Clicking "Redeem Max" automatically computes $\min(\text{balanceRemaining}, \text{availableLoyaltyValue})$, populates the keypad input, and clears previous validation warnings.

---

## 6. Design Rationale

Retail checkout counters operate in high-throughput environments where cashiers cannot afford multi-step navigation or mental math to convert points to rupees. By displaying both the available point total and rupee equivalent directly on the tender button and providing a 1-click "Redeem Max" button, cashier settlement time is minimized while guaranteeing that transactions never exceed customer point balances.

---

## 7. Implementation Summary

### A. Types Contract (`types.ts`)
```typescript
export interface CustomerLoyaltyBalanceResponse {
  customer_id: string;
  customer_name?: string;
  is_enrolled: boolean;
  member_id?: string;
  card_number?: string;
  current_points_balance: number;
  redemption_ratio: number;
  available_monetary_value: number;
  total_points_earned?: number;
  total_points_redeemed?: number;
}
```

### B. ProPosBillingTerm Toolbar Badge
```tsx
{customer.isLoyaltyEnrolled && customer.loyaltyPoints !== undefined && customer.loyaltyPoints > 0 && (
  <span className="px-2 h-7 bg-indigo-100 dark:bg-indigo-950/40 border border-indigo-300 dark:border-indigo-700 text-indigo-900 dark:text-indigo-200 rounded text-[11px] font-bold flex items-center gap-1 shadow-2xs whitespace-nowrap" title={`Available Loyalty Points: ${customer.loyaltyPoints.toFixed(0)} pts (₹${(customer.availableLoyaltyValue ?? customer.loyaltyPoints).toFixed(2)})`}>
    <Award size={12} className="text-indigo-600" />
    <span>★ {customer.loyaltyPoints.toFixed(0)} pts</span>
  </span>
)}
```

### C. ProPosSettlementDl Loyalty Card & Quick Redeem
```tsx
{selectedMode === "LOYALTY" && (
  <div className="mt-3 rounded-lg border border-indigo-300 dark:border-indigo-700 bg-indigo-50 dark:bg-indigo-950/30 p-3 text-xs">
    <div className="flex justify-between items-center font-bold">
      <span className="text-indigo-900 dark:text-indigo-200">Customer Loyalty Points Available</span>
      <span className="text-sm font-mono text-indigo-800 dark:text-indigo-300 font-bold">
        {isLoadingLoyalty ? "Checking..." : `${loyaltyBalance.points.toFixed(0)} pts (₹${loyaltyBalance.availableValue.toFixed(2)})`}
      </span>
    </div>
    <div className="mt-1 text-[#565e74] dark:text-[#bec6e0] flex justify-between items-center">
      <span>Rate: 1 pt = ₹{loyaltyBalance.ratio.toFixed(2)} • GL Contra: DR 2070 / CR 1030</span>
      {loyaltyBalance.availableValue > 0 && balanceRemaining > 0 && (
        <button
          type="button"
          onClick={() => {
            const maxRedeem = Math.min(balanceRemaining, loyaltyBalance.availableValue);
            setKeypadInput(maxRedeem.toFixed(2));
            setCreditError("");
          }}
          className="px-2 py-0.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-[11px] font-bold shadow-xs transition"
        >
          Redeem Max (₹{Math.min(balanceRemaining, loyaltyBalance.availableValue).toFixed(2)})
        </button>
      )}
    </div>
    {creditError && <div className="mt-1.5 font-semibold text-[#ba1a1a]">{creditError}</div>}
  </div>
)}
```

---

## 8. Tests Executed

### Command
```bash
npx vitest run src/tests/posCashierLoyaltyWiring.test.ts src/tests/posCashierTendersAndWallet.test.ts
```

### Output
```text
 RUN  v4.1.11 F:/SMRITRretailNX

 ✓ src/tests/posCashierLoyaltyWiring.test.ts (13 tests) 12ms
 ✓ src/tests/posCashierTendersAndWallet.test.ts (13 tests) 13ms

 Test Files  2 passed (2)
      Tests  26 passed (26)
   Start at  17:24:58
   Duration  416ms (transform 126ms, setup 0ms, import 186ms, tests 25ms, environment 2ms)
```

---

## 9. Verification Results

| Test Scenario | Condition Verified | Status |
| :--- | :--- | :--- |
| `Type Contract` | `POSTenderItem.tender_type` supports `"LOYALTY"` and `"LOYALTY_POINTS"` | **Done** |
| `API Parsing` | `CustomerLoyaltyBalanceResponse` parsed with points, ratio, and ₹ value | **Done** |
| `Tier Ratios` | Non-1.0 tier ratios (e.g. 1 pt = ₹0.50) accurately convert available ₹ value | **Done** |
| `Walk-in Guard` | Walk-in customer (`cust-01` / `C01`) fails closed with friendly message | **Done** |
| `Non-Enrolled Guard` | Unenrolled customer rejected with fail-closed validation | **Done** |
| `Zero Balance Guard` | Enrolled customer with 0 points balance rejected | **Done** |
| `Overdraft Prevention` | Attempted tender exceeding available points value fails closed | **Done** |
| `Valid Amount` | Valid tender within available points accepted and applied | **Done** |
| `Redeem Max (Balance < Points)` | Clamped to `balanceRemaining` when invoice total is less than points | **Done** |
| `Redeem Max (Points < Balance)` | Clamped to `availableLoyaltyValue` when points total is less than invoice | **Done** |
| `Split Tender Synthesis` | Cash + Card + Loyalty correctly synthesized into `POSTenderItem[]` | **Done** |
| `Solo Loyalty Settlement` | Resolves `payment_mode: "LOYALTY"` when 100% settled with loyalty | **Done** |
| `Fallback Synthesis` | `ProPosTenderSplit` fallback cleanly creates `LOYALTY` tender item | **Done** |

---

## 10. Known Limitations

- Offline POS terminals must buffer loyalty redemption events locally and sync against central PostgreSQL row locks upon reconnection.
- Tier upgrades triggered mid-transaction require re-opening the settlement dialog to refresh the redemption ratio.

---

## 11. Future Work

- Expose real-time points accrual projection in the settlement dialog before final tender confirmation (e.g. "Customer will earn 45 points on this bill").
- Integrate customer OTP or biometric verification for high-value loyalty points redemptions (> ₹1,000.00).

---

## 12. Related ADRs

- `ADR-007`: Unified General Ledger & Statutory Double-Entry Accounting
- `ADR-012`: Canonical Sales Transaction Writing Authority & Multi-Tender Settlement
- `ADR-018`: Universal Document Lifecycle & Concurrency Protection

---

## 13. Related RFCs

- `RFC-SALES-003`: SMRITI Multi-Tender POS Split Settlement
- `RFC-FIN-008`: Customer Loyalty Obligation & Breakage Income Accounting
