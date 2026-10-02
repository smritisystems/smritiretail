<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 1.0.0
  Created      : 2026-10-02
  Modified     : 2026-10-02
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Implementation Plan: POS Cashier UI Multi-Tender Split Billing & Store Credit Wallet Wiring

**Document ID:** IP-POS-007
**Version:** 1.0.0
**Status:** In Progress
**Created:** 2026-10-02
**Author:** Jawahar Ramkripal Mallah <support@smritibooks.com>

---

## 1. Objective
Wire the React 18 Point of Sale cashier billing frontend (`ProPosBillingTerm.tsx`, `ProPosSettlementDl.tsx`, and `types.ts`) to consume the hardened backend Phase P2.6 multi-tender split payment API (`tenders: POSTenderItem[]`, `payment_mode: "SPLIT"`) and real-time customer store credit / wallet balance lookup (`GET /api/v1/pos/customer-wallet/{customer_id}`).

## 2. Business Motivation
The Phase P2.6 backend closure introduced multi-tender split checkout, customer wallet redemption, and tender-isolated shift reconciliation in PostgreSQL. However, the React POS cashier terminal previously collapsed all tenders down to a single dominant tender string and omitted the granular `tenders` array in the checkout payload. Cashiers were also unable to inspect a customer's available store credit or redeem customer wallet balances directly at the POS counter with real-time balance validation. Integrating the UI completes the end-to-end commercial POS experience.

## 3. Scope
1. **Frontend Types (`src/components/billing/propos/types.ts`):**
   - Define `POSTenderItem` matching the Pydantic schema in `backend/app/schemas/pos.py`.
   - Define `CustomerWalletBalanceResponse` for real-time customer credit/wallet queries.
   - Update `ProPosTenderSplit` with `wallet` and `walletRef`.
   - Update `ProPosCustomer` with `availableWalletBalance`.
2. **Settlement Modal (`src/components/billing/propos/ProPosSettlementDl.tsx`):**
   - Add `STORE_CREDIT` / `WALLET` tender mode option with live balance indicator.
   - Fetch real-time wallet balance via `GET /api/v1/pos/customer-wallet/{customer_id}` when customer is present.
   - Add "Redeem Max" convenience button populating keypad with `Math.min(balanceRemaining, availableWalletBalance)`.
   - Enforce fail-closed validation rejecting wallet redemption exceeding available balance.
   - Return structured `POSTenderItem[]` alongside legacy `ProPosTenderSplit` on settlement.
3. **POS Billing Terminal (`src/components/billing/propos/ProPosBillingTerm.tsx`):**
   - In `handleSettlementSuccess`, construct granular `tenders` array (`POSTenderItem[]`).
   - Dynamically compute `payment_mode`: `"SPLIT"` if multiple distinct tender types are utilized, or single tender type (`"CASH"`, `"CARD"`, `"UPI"`, `"STORE_CREDIT"`, etc.) if single.
   - Transmit `tenders` array in `POSCheckoutRequest` body to `/api/v1/pos/checkout`.
   - Parse `paid_amount`, `balance_amount`, and `change_amount` from `POSCheckoutResponse`.
   - Display customer's store credit / wallet badge in the customer profile card when selected.
4. **Automated Unit Testing (`src/tests/posCashierTendersAndWallet.test.ts`):**
   - Validate tender array mapping and split payment detection.
   - Validate wallet balance extraction and boundary clamping.
   - Validate payload formatting for `/api/v1/pos/checkout`.

## 4. Current State
- Backend `/api/v1/pos/checkout` supports `tenders: Optional[List[POSTenderItem]]` and `payment_mode="SPLIT"`.
- Backend `/api/v1/pos/customer-wallet/{customer_id}` returns authoritative wallet balances.
- Frontend `ProPosBillingTerm.tsx` currently sends only `payment_mode: "CASH" | "CARD" | "UPI" | "CREDIT"` without `tenders` list.
- Frontend `ProPosSettlementDl.tsx` has modes `CASH`, `CARD`, `UPI`, `GIFT_VOUCHER`, `LOYALTY`, `CREDIT`, `CREDIT_NOTE`, but lacks live wallet balance query and `STORE_CREDIT` / `WALLET` tender integration.

## 5. Gap Analysis
1. **Payload Disconnect:** Frontend does not pass `tenders` list to backend `/pos/checkout`, preventing multi-tender recording in PostgreSQL `payment_transactions`.
2. **Missing Wallet Counter Lookup:** Cashier cannot see or verify available store credit before applying it.
3. **Split Mode Omission:** `payment_mode: "SPLIT"` is never emitted by the frontend.

## 6. Architecture Impact
- Replaces client-side tender collapse with full fidelity multi-tender dispatch.
- Aligns frontend data structures with backend P2.6 contracts without breaking legacy single-tender workflows.
- Zero breaking changes to existing routes or offline synchronization schemas.

## 7. Proposed Design
```text
[Cashier Selects Customer]
       │
       ▼ (GET /api/v1/pos/customer-wallet/{customer_id})
[Live Wallet Balance Displayed]
       │
       ▼ [Press F10: Settle Bill]
[SmritiPosSettlement Dialog Opens]
       ├── Cash: ₹200
       ├── UPI : ₹150
       └── Store Credit (Wallet): ₹150 (Redeem Max from ₹200 balance)
       │
       ▼ [Confirm Settlement]
onSettle(tenders, changeDue, tenderItems)
       │
       ▼ (ProPosBillingTerm.handleSettlementSuccess)
POST /api/v1/pos/checkout
{
  "invoice_no": "POS-INV-101",
  "shift_id": "...",
  "payment_mode": "SPLIT",
  "grand_total": 500.00,
  "customer_id": "cust-01",
  "tenders": [
    { "tender_type": "STORE_CREDIT", "amount": 150.00 },
    { "tender_type": "CASH", "amount": 200.00 },
    { "tender_type": "UPI", "amount": 150.00, "reference_no": "UTR123" }
  ]
}
       │
       ▼ (FastAPI Backend P2.6)
[PaymentTransactions Recorded, Shift Ledger Isolated, Invoice PAID]
```

## 8. Files Created
- `docs/implementation/pos/POS_Cashier_UI_Split_Tenders_And_Wallet_Wiring_Plan_v1.0.0.md`
- `src/tests/posCashierTendersAndWallet.test.ts`

## 9. Files Modified
- `src/components/billing/propos/types.ts`
- `src/components/billing/propos/ProPosSettlementDl.tsx`
- `src/components/billing/propos/ProPosBillingTerm.tsx`
- `docs/implementation/README.md`

## 10. Dependencies
- React 18
- `src/lib/apiFetchV1.ts`
- Backend endpoints `/api/v1/pos/checkout` and `/api/v1/pos/customer-wallet/{customer_id}`

## 11. Risks
- Cashiers attempting wallet redemption without selecting a customer. *Mitigated by disabling wallet tender mode or prompting customer selection.*
- Network latency when fetching wallet balance. *Mitigated by asynchronous non-blocking fetch with cached display.*

## 12. Rollback Strategy
- Git revert of modified frontend components (`ProPosBillingTerm.tsx`, `ProPosSettlementDl.tsx`, `types.ts`).
- Zero database rollback needed (backend remains 100% backward-compatible).

## 13. Verification Plan
- `npx tsc --noEmit` exits with code 0 (zero TypeScript errors).
- Unit tests in `src/tests/posCashierTendersAndWallet.test.ts` pass 100% green.
- Verify live checkout payload matches backend Pydantic contract.

## 14. Test Plan
1. Test tender split mapping from UI `appliedPayments` to `POSTenderItem[]`.
2. Test `payment_mode` calculation: single mode when 1 tender, `"SPLIT"` when multiple.
3. Test wallet balance validation: reject redemption exceeding available balance.
4. Test payload serialization matching `POSCheckoutRequest`.

## 15. Documentation Impact
- Update `docs/implementation/README.md` master index.
- Create walkthrough under `docs/walkthrough/pos/`.

## 16. Deployment Plan
- Frontend hot-reload via Vite development server or production bundle `npm run build`.

## 17. Status
Completed

## 18. Related ADRs
- ADR-POS-002: Shift Cash Transaction Integrity & Payment Ledger Integration
- ADR-P2.6: POS Cashier Multi-Tender & Store Credit Redemption

## 19. Related Walkthroughs
- [`docs/walkthrough/pos/POS_Cashier_UI_Split_Tenders_And_Wallet_v1.0.0.md`](../../walkthrough/pos/POS_Cashier_UI_Split_Tenders_And_Wallet_v1.0.0.md) (WT-POS-007)
