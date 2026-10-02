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

# Implementation Plan: SMRITI Sales Phase P3 — Customer Loyalty Points Double-Entry Accounting, Accrual & POS Settlement

**Document Identifier:** `IP-SALES-P3-001`
**Version:** 1.0.0
**Status:** Completed
**Created:** 2026-10-02
**Author:** Jawahar Ramkripal Mallah, Chief Systems Architect & Creator

---

## 1. Objective
Establish full-fidelity, double-entry financial general ledger (GL) integration and atomic point transactions for Customer Loyalty Points across earning (accrual on invoice), POS counter redemption (tender offset against AR), sales return reversal, and point expiry (breakage income).

---

## 2. Business Motivation
In retail enterprises, loyalty points issued to customers represent deferred commercial obligations and marketing liabilities. Currently:
1. `LoyaltyMember` and `LoyaltyPointsLedger` track points as numeric balances in PostgreSQL, but transactions produce **zero General Ledger accounting entries**.
2. Sales invoices do not accrue the liability `2070` ("Customer Loyalty Points Liability") against marketing expense `5080`.
3. POS cashier point redemptions are not mapped to double-entry settlement (`DR 2070` / `CR 1030`), leading to balance sheet divergence between loyalty balances and financial liabilities.
4. Point expiration lacks statutory breakage income recognition (`DR 2070` / `CR 4060`).

Phase P3 closes this loop, bringing customer loyalty points into 100% statutory double-entry compliance with zero cash movement on redemptions.

---

## 3. Scope
1. **Chart of Accounts (COA) Registration:**
   - Register Liability Account `2070` ("Customer Loyalty Points Liability", party_type="CUSTOMER") in `DEFAULT_CHART_OF_ACCOUNTS`.
   - Register Expense Account `5080` ("Customer Loyalty & Reward Program Expense") in `DEFAULT_CHART_OF_ACCOUNTS`.
   - Register Income Account `4060` ("Loyalty Points Breakage & Expiry Income") in `DEFAULT_CHART_OF_ACCOUNTS`.
   - Implement idempotent COA auto-provisioning for all active tenant databases.
2. **Double-Entry General Ledger Methods (`UnifiedAccountingLedgerService`):**
   - `post_loyalty_accrual_to_gl`: `DR 5080 (Expense)` / `CR 2070 (Liability)`, party_id=customer_id.
   - `post_loyalty_redemption_to_gl`: `DR 2070 (Liability)` / `CR 1030 (Debtors)`, party_id=customer_id.
   - `post_loyalty_reversal_to_gl`: `DR 2070 (Liability)` / `CR 5080 (Expense)` on sales return/clawback.
   - `post_loyalty_expiry_to_gl`: `DR 2070 (Liability)` / `CR 4060 (Breakage Income)`.
3. **Multi-Tender POS Checkout & Payments Engine Alignment:**
   - Support `tender_type="LOYALTY"` in `PaymentsEngine.record_payment_transaction` and `/pos/checkout`.
   - Enforce row locks (`SELECT FOR UPDATE` on `loyalty_members`) during redemption to prevent double-spending.
   - Atomic update of `LoyaltyMember.current_points_balance` and insertion of `LoyaltyPointsLedger`.
4. **Automated Forensic Verification Suite:**
   - Comprehensive Pytest test battery verifying accrual, redemption, reversal, over-redemption guard, tenant isolation, and zero cash movement.

---

## 4. Current State
- `backend/app/models/loyalty.py` defines `LoyaltyTier`, `LoyaltyRule`, `LoyaltyMember`, and `LoyaltyPointsLedger`.
- `backend/app/services/crm_engine.py` provides `CrmGrowthEngine.enroll_loyalty_member` and `record_points_transaction`.
- `DEFAULT_CHART_OF_ACCOUNTS` in `backend/app/services/unified_ledger.py` contains accounts up to `2060` (Credit Note/Wallet), but lacks `2070`, `5080`, and `4060`.
- `UnifiedAccountingLedgerService.post_payment_receipt_to_gl` handles `CREDIT_NOTE`, `WALLET`, and `STORE_CREDIT`, but not `LOYALTY`.

---

## 5. Gap Analysis
| Component | Existing Implementation | Required Target State |
|---|---|---|
| **COA Accounts** | Accounts 2050 and 2060 present. | Accounts 2070 (Liability), 5080 (Expense), and 4060 (Income) registered. |
| **Accrual GL** | Points incremented in member row only. | Balanced JournalVoucher `DR 5080 / CR 2070` posted synchronously. |
| **Redemption GL** | Tender accepted in frontend; backend does not post GL. | Balanced JournalVoucher `DR 2070 / CR 1030` with zero cash movement. |
| **Concurrency Guard** | No pessimistic row locking on `loyalty_members`. | `SELECT FOR UPDATE` on `loyalty_members` preventing concurrent overdrafts. |
| **Breakage GL** | Expiry flips status or points without GL entry. | Balanced JournalVoucher `DR 2070 / CR 4060` recognizing expired point breakage. |

---

## 6. Architecture Impact
- Enforces strict double-entry balance invariants: `Sum(Debit) == Sum(Credit)` on all loyalty events.
- Zero cash movement (`1010` and `1020` untouched) during loyalty point redemptions.
- Backward compatibility: Zero Alembic schema migrations required; existing tables `loyalty_members`, `loyalty_points_ledgers`, `journal_vouchers`, and `general_ledger_entries` are reused as-is.

---

## 7. Proposed Design

### A. Accounting Invariant Mapping
```text
1. Points Earned on Invoice:
   DR 5080  Customer Loyalty Expense                     ₹50.00
      CR 2070  Customer Loyalty Points Liability (Party)          ₹50.00

2. Points Redeemed at Checkout / Payment:
   DR 2070  Customer Loyalty Points Liability (Party)    ₹50.00
      CR 1030  Accounts Receivable (Debtors) (Party)              ₹50.00

3. Points Reversed on Sales Return:
   DR 2070  Customer Loyalty Points Liability (Party)    ₹50.00
      CR 5080  Customer Loyalty Expense                           ₹50.00

4. Points Expired (Breakage):
   DR 2070  Customer Loyalty Points Liability (Party)    ₹50.00
      CR 4060  Loyalty Points Breakage Income                     ₹50.00
```

### B. Concurrency & Concurrency Isolation
- Concurrency control: `SELECT * FROM loyalty_members WHERE customer_id = :cid AND company_id = :comp FOR UPDATE`
- Check: `current_points_balance >= points_to_redeem`
- Deduct: `current_points_balance -= points_to_redeem`
- Post GL: `UnifiedAccountingLedgerService.post_payment_receipt_to_gl` with `tender_type="LOYALTY"`

---

## 8. Files Created
1. `docs/implementation/sales/Sales_P3_Loyalty_Points_Double_Entry_Accounting_Plan_v1.0.md` (`IP-SALES-P3-001`)
2. `backend/app/tests/test_p3_loyalty_double_entry_accounting.py`
3. `docs/walkthrough/sales/Sales_P3_Loyalty_Points_Double_Entry_Accounting_v1.0.md` (upon completion)

---

## 9. Files Modified
1. `backend/app/models/__init__.py` (re-export `CustomerPurchaseOrder` to fix mapper configure)
2. `backend/app/services/unified_ledger.py` (COA registration + loyalty GL posting methods)
3. `backend/app/services/payments_engine.py` (tender LOYALTY handling with row lock)
4. `backend/app/services/crm_engine.py` (synchronous GL posting on points transactions)
5. `docs/implementation/README.md` (master index update)
6. `docs/walkthrough/README.md` (master index update)

---

## 10. Dependencies
- PostgreSQL transactional database (`smritisys` and tenant databases)
- SQLAlchemy async session with transactional commit/rollback
- Existing tables: `accounts`, `journal_vouchers`, `general_ledger_entries`, `loyalty_members`, `loyalty_points_ledgers`

---

## 11. Risks & Mitigation
- **Risk:** Attempted redemption by a customer without an active loyalty membership.
  *Mitigation:* Fail-closed validation rejecting redemption with clear error message before invoice commit.
- **Risk:** Concurrent checkout requests double-spending points.
  *Mitigation:* Row-level locking via `SELECT FOR UPDATE` on `loyalty_members`.
- **Risk:** GL voucher posting failure leaving loyalty ledger inconsistent.
  *Mitigation:* Atomic database transaction enclosing both point balance mutation and GL voucher creation.

---

## 12. Rollback Strategy
- Revert changes to `unified_ledger.py`, `payments_engine.py`, and `crm_engine.py`.
- No database column drops needed (purely reuses existing schema).

---

## 13. Verification Plan
- Verify COA auto-provisioning creates accounts `2070`, `5080`, and `4060` idempotently.
- Verify `DR 5080 / CR 2070` on points accrual.
- Verify `DR 2070 / CR 1030` on points redemption with zero cash impact.
- Verify overdraft attempt is blocked fail-closed under row lock.
- Verify all tests in `test_p3_loyalty_double_entry_accounting.py` pass 100% green against real PostgreSQL.

---

## 14. Test Plan
1. `test_p3_coa_provisioning_accounts_2070_5080_4060`: Idempotent creation across tenant DBs.
2. `test_p3_loyalty_points_accrual_gl_atomicity`: Earning points creates balanced JournalVoucher `DR 5080 / CR 2070`.
3. `test_p3_loyalty_points_redemption_gl_atomicity`: Redeeming points at checkout creates balanced JournalVoucher `DR 2070 / CR 1030` with party_id set.
4. `test_p3_loyalty_points_redemption_zero_cash_movement`: Cash (1010) and Bank (1020) entries are zero.
5. `test_p3_loyalty_points_insufficient_balance_rejected`: Over-redemption raises error fail-closed.
6. `test_p3_loyalty_points_expiry_breakage_gl`: Points expiration creates `DR 2070 / CR 4060`.
7. `test_p3_loyalty_concurrent_redemption_prevents_double_spend`: Two-phase concurrent row-lock test.

---

## 15. Documentation Impact
- Update `docs/implementation/README.md`.
- Update `docs/walkthrough/README.md`.
- Create formal Walkthrough `docs/walkthrough/sales/Sales_P3_Loyalty_Points_Double_Entry_Accounting_v1.0.md`.

---

## 16. Deployment Plan
- Backend restart/hot reload with automatic COA migration check.
- Zero downtime schema requirement.

---

## 17. Status
In Progress

---

## 18. Related ADRs
- `ADR-0041`: Universal Accounting & Double-Entry Ledger Integration
- `ADR-0045`: Customer Loyalty Program Liability & Breakage Accounting

---

## 19. Related Walkthroughs
- `docs/walkthrough/sales/Sales_P2_5_Customer_Credit_Notes_Wallets_And_Advance_Refund_Walkthrough_v1.0.md`
- `docs/walkthrough/sales/Sales_P3_Loyalty_Points_Double_Entry_Accounting_v1.0.md` (to be created)
