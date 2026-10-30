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

# Walkthrough: SMRITI Sales Phase P3 — Customer Loyalty Points Double-Entry Accounting & POS Redemption

**Document ID:** `WT-SALES-P3-001`
**Status:** Completed
**Version:** 1.0.0
**Effective Date:** 2026-10-02
**Implementation Plan Reference:** [Sales_P3_Loyalty_Points_Double_Entry_Accounting_Plan_v1.0.md](../../implementation/sales/Sales_P3_Loyalty_Points_Double_Entry_Accounting_Plan_v1.0.md) (`IP-SALES-P3-001`)
**Evidence Level:** Level A (Direct Terminal Verification & Real PostgreSQL Test Suite)

---

## 1. Purpose

This walkthrough documents the authoritative implementation of **SMRITI Sales Phase P3: Customer Loyalty Points Double-Entry Accounting and POS Redemption**. It establishes rigorous double-entry General Ledger (GL) posting for loyalty point operations (Accrual, Redemption, Reversal/Clawback, and Breakage Expiry), prevents unbacked or overdrafted point redemptions via pessimistic database row locks, and seamlessly integrates loyalty points as a tender mode in Counter POS checkout.

---

## 2. Scope

- **Accounting & General Ledger:**
  - Auto-provisioning of `2070` ("Customer Loyalty Points Liability"), `5080` ("Customer Loyalty & Reward Program Expense"), and `4060` ("Loyalty Points Breakage & Expiry Income") in `DEFAULT_CHART_OF_ACCOUNTS`.
  - Transactional GL postings with zero cash movement on redemptions (`DR 2070` / `CR 1030`).
  - Breakage income recognition on points expiry (`DR 2070` / `CR 4060`).
  - Reversal on sales returns/clawbacks (`DR 2070` / `CR 5080`).
- **Payments Engine:**
  - Support for `LOYALTY` and `LOYALTY_POINTS` tenders in `PaymentsEngine.process_payment`.
  - Pessimistic concurrency control (`SELECT ... FOR UPDATE` on `loyalty_members`).
  - Automatic `LoyaltyPointsLedger` append with transactional balance sync.
  - Reinstatement of loyalty points on payment refund via `PaymentsEngine.process_refund`.
- **POS Integration & API Services:**
  - Authoritative balance calculation and validation in `POSService.get_customer_loyalty_balance`.
  - Point redemption ratio resolution against member tier (`LoyaltyTier.redemption_ratio`).
  - Multi-tender split settlement in `POSService.pos_checkout`.
  - Endpoints: `GET /api/v1/pos/customer-loyalty/{customer_id}` and `GET /api/v1/loyalty/customer/{customer_id}`.

---

## 3. Files Created

1. `docs/implementation/sales/Sales_P3_Loyalty_Points_Double_Entry_Accounting_Plan_v1.0.md` — Authoritative 19-section implementation plan (`IP-SALES-P3-001`).
2. `backend/app/tests/test_p3_loyalty_double_entry_accounting.py` — Complete test suite containing 9 automated tests for Phase P3.
3. `docs/walkthrough/sales/Sales_P3_Loyalty_Points_Double_Entry_Accounting_v1.0.md` — This walkthrough document (`WT-SALES-P3-001`).

---

## 4. Files Modified

1. `backend/app/models/__init__.py` — Pre-loaded `CustomerPurchaseOrder` and `CustomerPurchaseOrderLine` to ensure mapper registry configuration safety.
2. `backend/app/models/loyalty.py` — Standardized `joined_date` and `timestamp` column defaults to timezone-naive UTC datetimes matching PostgreSQL `TIMESTAMP WITHOUT TIME ZONE`.
3. `backend/app/services/unified_ledger.py` — Registered `2070`, `5080`, and `4060` in `DEFAULT_CHART_OF_ACCOUNTS`; implemented `post_loyalty_accrual_to_gl`, `post_loyalty_reversal_to_gl`, and `post_loyalty_expiry_to_gl`; wired `LOYALTY` in `post_payment_transaction_to_gl` and `post_refund_transaction_to_gl`.
4. `backend/app/services/payments_engine.py` — Added pessimistic row-locked loyalty redemption handling to `process_payment` and point reinstatement to `process_refund`.
5. `backend/app/schemas/pos.py` — Added `CustomerLoyaltyBalanceResponse` schema and documented `LOYALTY` / `LOYALTY_POINTS` in `POSTenderItem`.
6. `backend/app/services/pos.py` — Implemented `get_customer_loyalty_balance` and integrated loyalty tender validation into `pos_checkout`.
7. `backend/app/api/v1/pos.py` — Exposed `GET /api/v1/pos/customer-loyalty/{customer_id}` for POS cashier terminals.
8. `backend/app/api/v1/loyalty.py` — Added `GET /api/v1/loyalty/customer/{customer_id}` for direct customer profile and points balance lookup.
9. `docs/implementation/README.md` — Updated master index table with `IP-SALES-P3-001`.
10. `docs/walkthrough/README.md` — Appended `WT-SALES-P3-001` entry to master index table.

---

## 5. Architecture Decisions

- **ADR-P3-01: Zero Cash Impact on Points Redemption**
  Loyalty redemption is an accounts receivable / liability contra-settlement. The general ledger entry debits Account `2070` (Customer Loyalty Points Liability) and credits Account `1030` (Accounts Receivable). Cash (`1010`) and Bank (`1020`) remain strictly untouched.
- **ADR-P3-02: Pessimistic Row Locking on LoyaltyMember**
  To prevent concurrent double-spending across multiple cash registers or mobile apps, `PaymentsEngine` acquires a database row-level lock (`SELECT ... FOR UPDATE`) on the customer's `loyalty_members` record before verifying and deducting points.
- **ADR-P3-03: Dynamic Tier Redemption Ratio Resolution**
  Points-to-currency monetary values are resolved dynamically from the member's assigned `LoyaltyTier` (`redemption_ratio`, defaulting to ₹1.00 per point). This decouples business point value changes from accounting ledger invariants.
- **ADR-P3-04: Symmetrical Point Reinstatement on Refund**
  Refunding an invoice paid via loyalty points automatically reverses the liability relief (`DR 1030` / `CR 2070`), credits the points back to `LoyaltyMember.current_points_balance`, and creates a `LoyaltyPointsLedger(transaction_type="REVERSAL")` audit entry.

---

## 6. Design Rationale

Prior to Phase P3, loyalty points were managed primarily as an operational balance in CRM tables without real-time general ledger integration. This created financial drift where reward point obligations were unreflected on corporate balance sheets, and cashier terminals could not reliably tender points as a partial split settlement against invoice receivables. By introducing accounts `2070`, `5080`, and `4060` with strict double-entry invariants, SMRITI achieves statutory accounting compliance, financial auditability, and fraud protection against points overdraft.

---

## 7. Implementation Summary

### Double-Entry Invariants Matrix

| Lifecycle Event | Debit Account | Credit Account | Cash/Bank Movement |
| :--- | :--- | :--- | :--- |
| **Points Accrual on Sale** | `5080` (Loyalty Expense) | `2070` (Points Liability) | Zero |
| **Points POS Redemption** | `2070` (Points Liability) | `1030` (Accounts Receivable) | Zero |
| **Points Return / Clawback** | `2070` (Points Liability) | `5080` (Loyalty Expense) | Zero |
| **Points Expiry (Breakage)** | `2070` (Points Liability) | `4060` (Breakage Income) | Zero |
| **Loyalty Payment Refund** | `1030` (Accounts Receivable) | `2070` (Points Liability) | Zero |

---

## 8. Tests Executed

The full automated Phase P3 test suite was executed against real PostgreSQL in `backend/app/tests/test_p3_loyalty_double_entry_accounting.py`:

```powershell
f:\SMRITRretailNX\.venv\Scripts\python.exe -m pytest backend/app/tests/test_p3_loyalty_double_entry_accounting.py
```

### Literal Terminal Output:

```text
============================= test session starts =============================
platform win32 -- Python 3.11.9, pytest-8.2.1, pluggy-1.6.0
rootdir: F:\SMRITRretailNX\backend
configfile: pyproject.toml
plugins: anyio-4.15.1, asyncio-0.23.7, cov-5.0.0
asyncio: mode=Mode.AUTO
collected 9 items

backend\app\tests\test_p3_loyalty_double_entry_accounting.py .........   [100%]

======================= 9 passed, 18 warnings in 58.82s =======================
```

Combined regression testing with CRM loyalty suite (`test_loyalty.py`):

```powershell
f:\SMRITRretailNX\.venv\Scripts\python.exe -m pytest backend/app/tests/test_loyalty.py backend/app/tests/test_p3_loyalty_double_entry_accounting.py
```

### Literal Terminal Output:

```text
============================= test session starts =============================
platform win32 -- Python 3.11.9, pytest-8.2.1, pluggy-1.6.0
rootdir: F:\SMRITRretailNX\backend
configfile: pyproject.toml
plugins: anyio-4.15.1, asyncio-0.23.7, cov-5.0.0
asyncio: mode=Mode.AUTO
collected 15 items

backend\app\tests\test_loyalty.py ......                                 [ 40%]
backend\app\tests\test_p3_loyalty_double_entry_accounting.py .........   [100%]

====================== 15 passed, 21 warnings in 59.25s =======================
```

---

## 9. Verification Results

| Test Case | Scenario Verified | Status |
| :--- | :--- | :--- |
| `test_p3_coa_provisioning_loyalty_accounts` | Accounts 2070, 5080, and 4060 provisioned; second run is strictly idempotent | **Done** |
| `test_p3_loyalty_points_accrual_gl_posting` | Balanced JV created with `DR 5080 / CR 2070`, zero cash movement | **Done** |
| `test_p3_loyalty_points_redemption_payments_engine` | Split tender (₹100 LOYALTY + ₹400 CASH) posts `DR 2070 / CR 1030` | **Done** |
| `test_p3_loyalty_redemption_overdraft_guard` | Tender exceeding balance fails closed with ValueError; balance untouched | **Done** |
| `test_p3_loyalty_redemption_non_enrolled_customer_fails` | Non-enrolled customer fails closed with business-friendly error | **Done** |
| `test_p3_loyalty_points_reversal_gl_posting` | Reversal posts balanced JV with `DR 2070 / CR 5080` | **Done** |
| `test_p3_loyalty_points_expiry_breakage_gl_posting` | Expiry posts balanced JV with `DR 2070 / CR 4060` | **Done** |
| `test_p3_pos_service_loyalty_balance_and_checkout` | POS loyalty balance query, split checkout, and balance deduction | **Done** |
| `test_p3_loyalty_payment_refund_reinstates_points_and_gl` | Refund reinstates member points and generates reverse GL voucher | **Done** |

---

## 10. Known Limitations

- Periodic automated points expiry requires an external scheduled cron runner to trigger `post_loyalty_expiry_to_gl` in batches for expiring member balances.
- Points earning rules currently calculate on gross invoice amount before promotions unless configured at the line-item level.

---

## 11. Future Work

- Implement scheduled cron task for automated daily points expiry batch processing.
- Add real-time SMS / WhatsApp loyalty points balance notification hooks via Outbox events.
- Expose loyalty points accrual preview in Counter POS UI before final tender settlement.

---

## 12. Related ADRs

- `ADR-007`: Unified General Ledger & Statutory Double-Entry Accounting
- `ADR-012`: Canonical Sales Transaction Writing Authority & Multi-Tender Settlement
- `ADR-018`: Universal Document Lifecycle & Concurrency Protection

---

## 13. Related RFCs

- `RFC-SALES-003`: SMRITI Multi-Tender POS Split Settlement
- `RFC-FIN-008`: Customer Loyalty Obligation & Breakage Income Accounting
