<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.16.0
  Created      : 2026-10-02
  Modified     : 2026-10-02
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# SMRITI Walkthrough: POS Cashier UI Split Tenders & Customer Store Credit / Wallet Integration (v1.0.0)

**Document Identifier:** `WT-POS-007`
**Related Implementation Plan:** [`IP-POS-007`](../../implementation/pos/POS_Cashier_UI_Split_Tenders_And_Wallet_Wiring_Plan_v1.0.0.md)
**Target Module:** POS Cashier Experience (`ProPosBillingTerm.tsx`, `ProPosSettlementDl.tsx`)
**Status:** Completed
**Author:** Jawahar Ramkripal Mallah, Chief Systems Architect & Creator

---

## 1. Purpose
This walkthrough documents the full-stack client wiring between the React 18 Counter POS Cashier UI and the backend Sales & Finance Phase P2.6 APIs. The implementation enables retail cashiers to:
1. Accept multiple concurrent tenders on a single POS sale (e.g. Cash + UPI + Store Credit) mapped to the canonical `POSTenderItem[]` contract.
2. Inquire real-time customer prepaid wallet and credit note liability balances (`GET /api/v1/pos/customer-wallet/{customer_id}`).
3. Redeem customer store credit at checkout with boundary clamping (`Math.min(balanceRemaining, walletBalance)`), auto-populating "Redeem Max", and preventing walk-in/anonymous redemption.
4. Elevate the payment mode dynamically to `"SPLIT"` when multiple distinct tenders are used, properly posting to backend `PaymentTransaction` records with zero cashier friction.

---

## 2. Scope
- **Client Billing Terminal (`ProPosBillingTerm.tsx`):**
  - Integrated `apiFetchV1<CustomerWalletBalanceResponse>(/pos/customer-wallet/{customer_id})` upon customer selection.
  - Displayed live store credit badge (`Wallet: ₹{bal}`) in the customer identification toolbar.
  - Updated `handleSettlementSuccess` to accept `tenderItems?: POSTenderItem[]` and synthesize granular `POSTenderItem[]` with `amount > 0`.
  - Dynamically set `payment_mode`: `"SPLIT"` when multi-tender, or specific single tender (`"CASH"`, `"CARD"`, `"UPI"`, `"STORE_CREDIT"`).
  - Wired `change_amount`, `paid_amount`, and `balance_amount` from the checkout response to the cashier completed bill record.
- **Settlement Dialog (`ProPosSettlementDl.tsx`):**
  - Added `STORE_CREDIT` ("Store Credit / Wallet") tender option with gold/amber iconography.
  - Auto-fetched live wallet balance upon opening modal.
  - Implemented one-click "Redeem Max" action.
  - Added boundary validation preventing redemption exceeding available store credit balance or for unverified walk-in customers (`cust-01` / `C01`).
  - Passed structured `POSTenderItem[]` directly to `onSettle`.
- **Type Definitions (`types.ts`):**
  - Exported `POSTenderItem` matching backend Pydantic contract.
  - Exported `CustomerWalletBalanceResponse`.
  - Added `availableWalletBalance?: number` to `ProPosCustomer`.
  - Added `wallet?: number; walletRef?: string;` to `ProPosTenderSplit`.
- **Automated Unit Tests (`src/tests/posCashierTendersAndWallet.test.ts`):**
  - 13 comprehensive unit tests validating split tender synthesis, payment mode resolution, wallet redemption validation, boundary clamping, and API payload contracts.

---

## 3. Files Created
1. `docs/implementation/pos/POS_Cashier_UI_Split_Tenders_And_Wallet_Wiring_Plan_v1.0.0.md` (`IP-POS-007`)
2. `src/tests/posCashierTendersAndWallet.test.ts`
3. `docs/walkthrough/pos/POS_Cashier_UI_Split_Tenders_And_Wallet_v1.0.0.md` (`WT-POS-007`)

---

## 4. Files Modified
1. `src/components/billing/propos/types.ts`
2. `src/components/billing/propos/ProPosSettlementDl.tsx`
3. `src/components/billing/propos/ProPosBillingTerm.tsx`
4. `docs/implementation/README.md`
5. `docs/walkthrough/README.md`

---

## 5. Architecture Decisions
- **AD-POS-01: Zero-Amount Filtering for Backend Tenders:**
  The backend Pydantic schema in `backend/app/schemas/pos.py` enforces `gt=0` on `POSTenderItem.amount`. The frontend explicitly filters out all tenders with `amount <= 0` prior to dispatching `POST /api/v1/pos/checkout`.
- **AD-POS-02: Automatic Payment Mode Elevation:**
  When more than one valid tender exists in `backendTenders`, `payment_mode` is automatically elevated to `"SPLIT"`. If exactly one tender exists, its specific `tender_type` is used. If none, the system falls back to the dominant tender.
- **AD-POS-03: Strict Walk-in Customer Isolation:**
  Store credit redemption creates a double-entry liability reduction (`DR 2060` / `CR 1030`) linked to the customer. Therefore, store credit redemption is strictly blocked when the customer is anonymous, missing, or identified as a default walk-in (`cust-01` or `C01`).

---

## 6. Design Rationale
- **Cashier Ergonomics:** Retail counters operate under high speed. Providing a "Redeem Max" button allows the cashier to apply customer wallet balance with a single click without manually calculating the remaining balance or re-typing the amount.
- **Dual Compatibility:** `ProPosSettlementDl` continues to output `ProPosTenderSplit` for legacy consumers, but also provides the modern `POSTenderItem[]` array directly, preventing duplicate conversion logic.

---

## 7. Implementation Summary
```text
React 18 POS UI (Billing Terminal & Settlement Dialog)
    ├── Customer Selection:
    │     └── GET /api/v1/pos/customer-wallet/{customer_id}
    │           └── Badged in Toolbar (Wallet: ₹1,250.00)
    │
    ├── F10 Settlement Dialog:
    │     ├── STORE_CREDIT Tender Mode Option
    │     ├── Live Available Balance Display
    │     ├── "Redeem Max" (Clamped to Remaining Due)
    │     └── Boundary Check (customer !== walk-in && amt <= walletBalance)
    │
    └── Checkout Dispatch:
          └── POST /api/v1/pos/checkout
                ├── payment_mode: "SPLIT" (or single tender type)
                ├── tenders: POSTenderItem[] (amount > 0 filtered)
                └── Idempotency-Key: POS-BILL-XXX
```

---

## 8. Tests Executed
- **TypeScript Static Verification:**
  - Command: `npx tsc --noEmit`
  - Output: Exit Code 0 (0 compilation errors)
- **Unit Test Suite:**
  - Command: `npx vitest run src/tests/posCashierTendersAndWallet.test.ts`
  - Output: 13/13 tests passed green in 1.36s

---

## 9. Verification Results
```text
Implementation Status

✓ Code Complete
✓ Tests Passed (13/13 Vitest tests green)
✓ TypeScript Clean (tsc --noEmit exit 0)
✓ Documentation Updated
✓ Implementation Plan Updated (IP-POS-007 Completed)
✓ Walkthrough Index Updated

Evidence Level: Level A (Automated Vitest execution + TypeScript compilation)
```

---

## 10. Known Limitations
- Offline/Local POS mode: When the cashier terminal is operating in offline mode without backend connectivity, live customer wallet balances cannot be fetched; cashiers are notified that wallet redemption requires online connectivity.

---

## 11. Future Work
- OTP-based Store Credit Authorization: Optional SMS OTP prompt when redeeming store credit balances above a configurable threshold (e.g. > ₹2,000).

---

## 12. Related ADRs
- `ADR-0041`: Universal Accounting & Ledger Integration
- `ADR-0044`: Multi-Tender & Split Settlement Architecture

---

## 13. Related RFCs
- `RFC-POS-009`: Cashier Experience Modernization & Split Settlement
