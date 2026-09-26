<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.30.0
  Created      : 2026-09-17
  Modified     : 2026-09-17
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Walkthrough — POS Counter Resilience, F12 Park & Recall, Return Integrity & Mid-Bill Switch
-->

# Walkthrough: SMRITI POS Counter Resilience, F12 Park & Recall, Return Integrity & Mid-Bill Switch (v6.30.0)

## 1. Purpose
This implementation delivers Phase 1 of the Shoper 9 Competitive Counter Resilience Roadmap, closing key operational gaps in high-traffic checkout environments:
1. **F12 Bill Park & Recall Engine**: Immediate cashier lane unfreezing with dual-layer local storage and PostgreSQL persistence (`pos_parked_carts`), auto-generating canonical `HOLD-YYYYMMDD-XXXX` hold slips with a strict 4-hour auto-expiration window to protect shift-end cash reconciliation from stale morning carts.
2. **B2G1 Return Integrity & Statutory GST Section 15 Clawback Engine**: Querying invoice promotion redemptions to block or deduct clawbacks when customers return paid items while retaining promotional free goods, ensuring Credit Note taxable values strictly conform to CGST Section 15.
3. **Alt+M Mid-Bill Customer Switch & Audit Ledger**: Frictionless mid-transaction customer change dynamically re-evaluating promotions across all cart lines (`resolveBestItemPromo` and `resolveBestBillPromo`) and recording audit records to `invoice_customer_change_logs`.
4. **Alt+6 Quick Last-Receipt Reprint**: Dedicated counter hotkey to instantly display or reprint the last completed tax invoice receipt without leaving the billing canvas.
5. **Supervisor-Gated Void Authorization (`Alt+2`)**: Mandates supervisor PIN verification for voiding or cancelling transactions to prevent checkout shrinkage.
6. **Least Saleable Quantity (LSQ) Integrity Gate**: Positive integer multiple validation gate on item scanning/committing (`items.least_saleable_qty`).
7. **End-of-Shift Denomination Breakdown**: PostgreSQL ledger `pos_shift_denomination_counts` for cashier handover and manager balance sheet reconciliation.

---

## 2. Scope
- **Backend Migrations**: Alembic migration `v1458_pos_parked_carts_lsq_and_customer_switch_audit.py` (down_revision: `v1457_canonical_smriti_promotions_engine`).
- **Backend ORM Models**:
  - `backend/app/models/pos.py`: Added `POSParkedCart` and `POSShiftDenominationCount`.
  - `backend/app/models/sales.py`: Added `InvoiceCustomerChangeLog`.
  - `backend/app/models/item_master.py`: Added `least_saleable_qty` to `Item` and `ItemBarcode`.
- **Backend APIs**:
  - `backend/app/api/v1/pos.py`: Added `/pos/parked-carts` (POST, GET), `/pos/parked-carts/{slip}/recall` (POST), `/pos/customer-switch-log` (POST), `/pos/shifts/{id}/denominations` (POST).
  - `backend/app/api/v1/promotions.py`: Added `/promotions/declines` (POST) to persist promotion decline records to `smriti_promotion_declines`.
- **Frontend Service Layer**:
  - `src/services/smritiPosParkedCartService.ts`: Full Park/Recall lifecycle with 4-hour expiration filter and dual-storage resilience.
  - `src/services/smritiPromotionClawbackService.ts`: Statutory GST Section 15 bundle clawback calculation.
- **Frontend POS Billing**:
  - `src/components/billing/propos/ProPosBillingTerm.tsx`: Wired `F12` hotkey, top ribbon `[Park / Recall (N)]` badge, `Alt+M` customer switch with auto-reevaluation, `Alt+6` quick receipt reprint, and LSQ validation gate.
  - `src/components/billing/propos/ProPosCancellation.tsx`: Enforced manager PIN requirement before confirming bill void.
  - `src/components/billing/propos/ProPosHotkeysDlg.tsx`: Updated hotkeys cheat sheet.
- **Unit Testing**:
  - `src/tests/smritiPosParkedCart.test.ts` (7 tests).
  - `src/tests/smritiPromotionClawback.test.ts` (5 tests).

---

## 3. Files Created
1. `backend/alembic/versions/v1458_pos_parked_carts_lsq_and_customer_switch_audit.py`
2. `src/services/smritiPosParkedCartService.ts`
3. `src/services/smritiPromotionClawbackService.ts`
4. `src/tests/smritiPosParkedCart.test.ts`
5. `src/tests/smritiPromotionClawback.test.ts`

---

## 4. Files Modified
1. `backend/app/models/pos.py`
2. `backend/app/models/sales.py`
3. `backend/app/models/item_master.py`
4. `backend/app/api/v1/pos.py`
5. `backend/app/api/v1/promotions.py`
6. `src/components/billing/propos/ProPosBillingTerm.tsx`
7. `src/components/billing/propos/ProPosCancellation.tsx`
8. `src/components/billing/propos/ProPosHotkeysDlg.tsx`
9. `docs/walkthrough/README.md`
10. `CHANGELOG.md`

---

## 5. Architecture Decisions
- **ADR-P1.1: 4-Hour Parked Cart Auto-Expiration Window**:
  Parked carts are essential for clearing counter deadlocks when a customer steps away to pick up another item. However, stale parked carts from a morning shift can corrupt evening cash drawer reconciliation and inventory counts. We enforce an immutable `expires_at` timestamp (default: 4 hours from parking). Any cart past its expiration is excluded from active count badges and rejected upon recall attempt.
- **ADR-P1.2: Statutory GST Section 15 Credit Note Integrity**:
  Issuing a sales return credit note for paid items while allowing the customer to retain the free item from a B2G1 bundle breaches Section 15 of the CGST Act by claiming an overstated deduction of taxable value. SMRITI's return engine automatically calculates the clawback deduction from the refund credit note:
  $$\text{Net Refund} = \max(0, \text{Gross Refund of Returned Items} - (\text{Retained Free Items} \times \text{Regular Unit Price}))$$
  If the clawback equals or exceeds the refund, the system alerts the cashier that the free item must also be physically surrendered.
- **ADR-P1.3: Invariant Mid-Bill Customer Switch**:
  When an operator switches the customer (e.g. Walk-in to Corporate VIP via `Alt+M`), customer-tier pricing and promotions must apply to all items already in the grid. SMRITI automatically triggers `resolveBestItemPromo` across all cart lines, recalculates line GST, and logs the transition into `invoice_customer_change_logs`.

---

## 6. Design Rationale
- **Single Keystroke Counter Ergonomics**: Cashiers process 200+ transactions per shift. Forcing mouse clicks or multi-step navigation for routine operations (Parking, Recalling, Customer Switching, and Last Bill Reprint) significantly impairs lane throughput. Standardizing on single keystrokes (`F12`, `Alt+M`, `Alt+6`) provides immediate Shoper 9 parity.
- **Dual-Storage Resilience**: Local storage provides 0ms counter response time even if network latency spikes occur, while asynchronous background posting to PostgreSQL ensures durability across multi-register terminals.

---

## 7. Implementation Summary
- **F12 Park & Recall**:
  - Hold slips format: `HOLD-YYYYMMDD-XXXX`.
  - Stored in `pos_parked_carts` and local storage.
  - Active list filtered by `expires_at > now()`.
  - Prominent badge on main ribbon: `[Park / Recall (N)] [F12]`.
- **Return Integrity**:
  - `SmritiPromotionClawbackService` checks B2G1 ratio (2 buy -> 1 free).
  - Handles full bundle return (100% refund, 0 clawback).
  - Handles partial paid return with retained free item (clawback deducted).
- **Customer Switch**:
  - `Alt+M` triggers customer search.
  - On select, re-evaluates all cart items and posts change log.
- **LSQ Gate**:
  - Grid commit validates `qty % lsq === 0`.
- **Void Authorization**:
  - `SmritiProPosCancelDlg` requires manager PIN.

---

## 8. Tests Executed
1. `src/tests/smritiPosParkedCart.test.ts` (7/7 tests passed in 35ms)
2. `src/tests/smritiPromotionClawback.test.ts` (5/5 tests passed in 6ms)
3. `src/tests/smritiSalesPromotionEngine.test.ts` (15/15 tests passed in 34ms)
4. `src/tests/smritiAutoSelectPromotion.test.ts` (14/14 tests passed in 46ms)
5. `npx tsc --noEmit` (0 errors)
6. `python -m py_compile` across all modified Python files (0 errors)

---

## 9. Verification Results
- All 41 unit tests green.
- TypeScript compiler passed with 0 errors.
- Python compilation passed with 0 errors.
- Database migration `v1458` created with down_revision pointing to `v1457`.

---

## 10. Known Limitations
- Redis hot path for parked carts is configured for single-store environments; multi-store cross-counter cart recall requires central Redis cluster deployment.

---

## 11. Future Work
- Line-level sales staff commission calculation report.
- Printable end-of-shift denomination balance sheet template for POS thermal slips.

---

## 12. Related ADRs
- ADR-001: Strangler-Fig Backend Architecture
- ADR-005: Immutability and Statutory Snapshot Rule
- ADR-P1.1: 4-Hour Parked Cart Auto-Expiration Window
- ADR-P1.2: Statutory GST Section 15 Credit Note Integrity

---

## 13. Related RFCs
- RFC-2026-POS-01: Shoper 9 Ergonomics Parity & Counter Resilience
- RFC-2026-PROMO-02: Canonical Promotion Engine Lifecycle
