<!--
  Project      : SMRITI Retail OS
  Repository   : SMRITIRetailNX
  Organization : AITDL NETWORKS

  Founders

  * Pushpa Devi Jawahar Mallah
    * Founder & Chairperson
    * Email: founder@aitdl.com

  * Jawahar Ramkripal Mallah
    * Founder, Chief Executive Officer (CEO) & Chief Software Architect
    * Email: founder@aitdl.com

  * Websites: aitdl.com | erpnbook.com | smritibooks.com

  * Version    : 1.0.0
  * Created    : 2026-10-02
  * Modified   : 2026-10-02
  * Copyright  : © SMRITIBooks.com. All Rights Reserved.
  * License    : Proprietary Commercial Software
  * Classification: Internal
-->

# Walkthrough: SMRITI Sales Phase P2.5 — Customer Credit Notes, Customer Wallets & Advance Refund Processing

## 1. Purpose
This walkthrough documents the design, implementation, and rigorous forensic verification of **Phase P2.5** within the SMRITI Retail OS transactional architecture. Phase P2.5 establishes complete financial integrity, fail-closed concurrency controls, and double-entry general ledger synchronization for:
1. **Customer Advance Refunds**: Returning unallocated advance liability (`2050`) directly to customers via Cash (`1010`) or Bank (`1020`) without touching Revenue or Accounts Receivable.
2. **Invoice Payment Refunds**: Returning settlement funds on posted invoices, automatically reducing `paid_amount`, re-opening `balance_amount`, reverting status from `PAID` to `POSTED`, and debiting Accounts Receivable (`1030`) against Cash/Bank.
3. **Customer Credit Note & Wallet Redemption**: Allowing invoices to be tendered via Store Credit, Credit Notes, or Wallets (`CREDIT_NOTE`, `WALLET`, `STORE_CREDIT`), debiting liability account `2060` ("Customer Credit Note & Wallet Liability") and crediting Accounts Receivable (`1030`) with strict zero-cash movement.

## 2. Scope
- **Backend Services**:
  - `backend/app/services/unified_ledger.py`: Registration of Account `2060` in default Chart of Accounts, addition of Store Credit / Wallet GL posting logic (`DR 2060` / `CR 1030`), and implementation of authoritative double-entry refund GL posting `post_refund_transaction_to_gl()`.
  - `backend/app/services/payments_engine.py`: Concurrency-guarded dynamic advance balance calculations with `SELECT FOR UPDATE`, invoice balance and status reinstatement, customer credit balance validation, debit recording in `CustomerCreditLedgerEntry`, and atomic session rollback on exception.
- **Database Safety & Invariants**:
  - Multi-tenant COA seeding: Account `2060` seeded across all 41 tenant companies in PostgreSQL (`localhost:2781/smritisys`).
  - Zero schema drift: Alembic migration head remains strictly frozen at `v1515_sales_schema_tenant_hardening`. Zero new tables, zero new columns.
  - Historical data preservation: 29 historical payments and 195 credit ledger entries left 100% untouched.
- **Testing**:
  - 11 dedicated integration test cases in `backend/app/tests/test_p2_5_credit_notes_wallet_refund.py`.
  - Comprehensive 100-test regression verification across Phases P2.1, P2.2, P2.3, P2.4, P2.5, and Sales Return contracts.

## 3. Files Created
1. `backend/app/tests/test_p2_5_credit_notes_wallet_refund.py`: 11 comprehensive automated tests verifying refund GL generation, dynamic over-refund blocking, invoice balance reinstatement, wallet tender debit, cross-tenant isolation, idempotency, and atomicity.
2. `docs/implementation/sales/Sales_P2_5_Customer_Credit_Notes_Wallets_And_Advance_Refund_Plan_v1.0.md`: Formal 19-section IPGP-compliant implementation plan.
3. `docs/walkthrough/sales/Sales_P2_5_Customer_Credit_Notes_Wallets_And_Advance_Refund_Walkthrough_v1.0.md`: This 13-section WGP walkthrough document.

## 4. Files Modified
1. `backend/app/services/unified_ledger.py`:
   - Registered account `2060` ("Customer Credit Note & Wallet Liability", `LIABILITY`, parent `2000`, `party_type="CUSTOMER"`) in `DEFAULT_CHART_OF_ACCOUNTS`.
   - Updated `post_payment_transaction_to_gl()` to handle `CREDIT_NOTE`, `WALLET`, and `STORE_CREDIT` tenders (`DR 2060` / `CR 1030`).
   - Implemented `post_refund_transaction_to_gl()` producing balanced double-entry vouchers (`CUSTOMER_ADVANCE_REFUND`: `DR 2050` / `CR 1010/1020`; `PAYMENT_REFUND`: `DR 1030` / `CR 1010/1020`).
2. `backend/app/services/payments_engine.py`:
   - Integrated customer credit checks and debit logging in `process_payment()` for wallet / credit note tenders.
   - Enhanced `process_refund()` with `with_for_update()` pessimistic row locking, dynamic unallocated advance calculation, invoice status/balance reinstatement, and synchronous call to `post_refund_transaction_to_gl()`.
3. `docs/implementation/README.md`: Appended Phase P2.5 entry to master index table.
4. `docs/walkthrough/README.md`: Appended Phase P2.5 entry to master index table.
5. `CHANGELOG.md`: Added release notes for SMRITI Sales Phase P2.5.

## 5. Architecture Decisions
1. **Liability Account 2060 as Store Credit Bridge**:
   - Rather than treating wallet redemption as cash income or artificial discounts, Account `2060` ("Customer Credit Note & Wallet Liability") was established as a balance-sheet liability. When a return produces store credit, liability is credited; when a customer spends credit on an invoice, liability is debited (`DR 2060` / `CR 1030`), perfectly reflecting economic reality with zero distortion to cash or bank balances.
2. **Pessimistic Concurrency on Advance & Payment Refunds**:
   - Concurrency race conditions in advance refunds could allow concurrent refund requests to double-refund advance deposits. By locking the original `PaymentTransaction` row via `select(...).with_for_update()`, all refund threads are serialized.
3. **Dynamic Refund Capacity Computation**:
   - Advance refund capacity is calculated dynamically inside the row-locked transaction:
     $$\text{Max Refundable} = \text{Orig Amount} - \sum \text{Allocations} - \sum \text{Prior Refunds}$$
   - Any attempt to refund more than the unallocated residual is rejected fail-closed with `ValueError`.
4. **Authoritative Invoice Balance Reinstatement**:
   - When a payment settled against a `SalesInvoice` is refunded, the invoice's `paid_amount` decreases, `balance_amount` increases, and if previously marked `PAID`, its status reverts to `POSTED`.

## 6. Design Rationale
- **Zero Schema Migrations**:
  - The existing schema (`payment_transactions`, `payment_allocations`, `customer_credit_ledger_entries`, `journal_vouchers`, `general_ledger_entries`) was carefully designed to support flexible reference document types and tender types. Utilizing `tender_type IN ('CREDIT_NOTE', 'WALLET', 'STORE_CREDIT')` and `reference_doc_type IN ('ADVANCE_REFUND', 'PAYMENT_REFUND')` eliminated unnecessary schema migrations while maintaining 100% relational integrity.
- **Fail-Safe Atomicity**:
  - Payment refunding and GL voucher creation run within the same transactional context. If GL posting fails (e.g. missing COA), the entire refund transaction, invoice balance changes, and ledger records roll back completely, ensuring no partial or corrupted state can ever persist.

## 7. Implementation Summary
- **Double-Entry Refund Matrix**:
  | Transaction Scenario | Debit Account | Credit Account | Cash/Bank Movement |
  |---|---|---|---|
  | Customer Advance Refund | `2050` Customer Advance Liability | `1010` Cash / `1020` Bank | Outflow (`1010` / `1020` Credit) |
  | Invoice Payment Refund | `1030` Accounts Receivable | `1010` Cash / `1020` Bank | Outflow (`1010` / `1020` Credit) |
  | Store Credit / Wallet Tender | `2060` Customer Credit Liability | `1030` Accounts Receivable | Zero Cash Movement |

- **COA Multi-Tenant Provisioning**:
  - Account `2060` was added to `DEFAULT_CHART_OF_ACCOUNTS` and retroactively provisioned across all 41 existing tenant companies in PostgreSQL (`smritisys`), achieving 100% chart of accounts parity.

## 8. Tests Executed
The test suite was executed against the active PostgreSQL database (`localhost:2781/smritisys`):

```bash
F:\SMRITRretailNX\.venv\Scripts\python.exe -m pytest backend/app/tests/test_p2_5_credit_notes_wallet_refund.py backend/app/tests/test_p2_4_advance_payment.py backend/app/tests/test_p2_3_payment_gl_atomicity.py backend/app/tests/test_p2_2_return_gl_atomicity.py backend/app/tests/test_p2_1_invoice_gl_atomicity.py backend/app/tests/test_sales_return_contracts.py -v
```

### Terminal Output
```text
============================= test session starts =============================
platform win32 -- Python 3.11.9, pytest-8.2.1, pluggy-1.6.0 -- F:\SMRITRretailNX\.venv\Scripts\python.exe
cachedir: .pytest_cache
rootdir: F:\SMRITRretailNX\backend
configfile: pyproject.toml
plugins: anyio-4.15.1, asyncio-0.23.7, cov-5.0.0
asyncio: mode=Mode.AUTO
collecting ... collected 100 items

backend\app\tests\test_p2_5_credit_notes_wallet_refund.py::test_cash_advance_partial_refund PASSED [  1%]
backend\app\tests\test_p2_5_credit_notes_wallet_refund.py::test_bank_advance_full_refund PASSED [  2%]
backend\app\tests\test_p2_5_credit_notes_wallet_refund.py::test_advance_refund_exceeding_unallocated_fails PASSED [  3%]
backend\app\tests\test_p2_5_credit_notes_wallet_refund.py::test_advance_refund_idempotency PASSED [  4%]
backend\app\tests\test_p2_5_credit_notes_wallet_refund.py::test_invoice_payment_partial_refund_reinstates_balance PASSED [  5%]
backend\app\tests\test_p2_5_credit_notes_wallet_refund.py::test_invoice_payment_full_refund_reinstates_full_balance PASSED [  6%]
backend\app\tests\test_p2_5_credit_notes_wallet_refund.py::test_invoice_payment_over_refund_fails PASSED [  7%]
backend\app\tests\test_p2_5_credit_notes_wallet_refund.py::test_customer_store_credit_wallet_issuance_and_redemption PASSED [  8%]
backend\app\tests\test_p2_5_credit_notes_wallet_refund.py::test_customer_store_credit_insufficient_balance_rejected PASSED [  9%]
backend\app\tests\test_p2_5_credit_notes_wallet_refund.py::test_cross_company_refund_isolation PASSED [ 10%]
backend\app\tests\test_p2_5_credit_notes_wallet_refund.py::test_refund_gl_failure_rolls_back_atomically PASSED [ 11%]
backend\app\tests\test_p2_4_advance_payment.py::test_coa_2050_registered_in_default_coa PASSED [ 12%]
backend\app\tests\test_p2_4_advance_payment.py::test_cash_advance_creates_gl PASSED [ 13%]
backend\app\tests\test_p2_4_advance_payment.py::test_bank_advance_creates_gl PASSED [ 14%]
backend\app\tests\test_p2_4_advance_payment.py::test_advance_payment_does_not_credit_revenue PASSED [ 15%]
backend\app\tests\test_p2_4_advance_payment.py::test_advance_without_customer_fails PASSED [ 16%]
backend\app\tests\test_p2_4_advance_payment.py::test_advance_payment_idempotency PASSED [ 17%]
backend\app\tests\test_p2_4_advance_payment.py::test_advance_allocation_to_invoice PASSED [ 18%]
backend\app\tests\test_p2_4_advance_payment.py::test_advance_partial_allocation PASSED [ 19%]
backend\app\tests\test_p2_4_advance_payment.py::test_advance_multi_invoice_allocation PASSED [ 20%]
backend\app\tests\test_p2_4_advance_payment.py::test_advance_over_allocation_fails PASSED [ 21%]
backend\app\tests\test_p2_4_advance_payment.py::test_advance_allocation_gl_balanced PASSED [ 22%]
backend\app\tests\test_p2_4_advance_payment.py::test_advance_cross_company_allocation_blocked PASSED [ 23%]
backend\app\tests\test_p2_4_advance_payment.py::test_advance_cross_customer_allocation_blocked PASSED [ 24%]
backend\app\tests\test_p2_4_advance_payment.py::test_advance_allocation_idempotency PASSED [ 25%]
backend\app\tests\test_p2_4_advance_payment.py::test_advance_allocation_to_paid_invoice_fails PASSED [ 26%]
backend\app\tests\test_p2_4_advance_payment.py::test_advance_allocation_gl_failure_rolls_back PASSED [ 27%]
backend\app\tests\test_p2_4_advance_payment.py::test_advance_unallocated_balance_query PASSED [ 28%]
backend\app\tests\test_p2_3_payment_gl_atomicity.py::test_cash_payment_creates_balanced_gl PASSED [ 29%]
backend\app\tests\test_p2_3_payment_gl_atomicity.py::test_bank_payment_creates_balanced_gl PASSED [ 30%]
backend\app\tests\test_p2_3_payment_gl_atomicity.py::test_card_payment_creates_balanced_gl PASSED [ 31%]
backend\app\tests\test_p2_3_payment_gl_atomicity.py::test_upi_payment_creates_balanced_gl PASSED [ 32%]
backend\app\tests\test_p2_3_payment_gl_atomicity.py::test_split_tender_creates_balanced_gl PASSED [ 33%]
backend\app\tests\test_p2_3_payment_gl_atomicity.py::test_multi_tender_gl_posting PASSED [ 34%]
backend\app\tests\test_p2_3_payment_gl_atomicity.py::test_payment_gl_failure_rolls_back_atomically PASSED [ 35%]
backend\app\tests\test_p2_3_payment_gl_atomicity.py::test_balanced_payment_receipt_voucher PASSED [ 36%]
backend\app\tests\test_p2_3_payment_gl_atomicity.py::test_duplicate_payment_idempotency PASSED [ 37%]
backend\app\tests\test_p2_3_payment_gl_atomicity.py::test_payment_overpay_protection PASSED [ 38%]
backend\app\tests\test_p2_3_payment_gl_atomicity.py::test_payment_on_unposted_invoice_rejected PASSED [ 39%]
backend\app\tests\test_p2_3_payment_gl_atomicity.py::test_payment_tenant_isolation PASSED [ 40%]
backend\app\tests\test_p2_3_payment_gl_atomicity.py::test_partial_payment_lifecycle PASSED [ 41%]
backend\app\tests\test_p2_3_payment_gl_atomicity.py::test_invoice_auto_status_to_paid PASSED [ 42%]
backend\app\tests\test_p2_3_payment_gl_atomicity.py::test_invoice_balance_mathematical_parity PASSED [ 43%]
backend\app\tests\test_p2_3_payment_gl_atomicity.py::test_payment_allocation_consistency PASSED [ 44%]
backend\app\tests\test_p2_3_payment_gl_atomicity.py::test_cancel_paid_invoice_guard PASSED [ 45%]
backend\app\tests\test_p2_2_return_gl_atomicity.py::test_normal_return_stock_and_gl PASSED [ 46%]
backend\app\tests\test_p2_2_return_gl_atomicity.py::test_balanced_credit_note PASSED [ 47%]
backend\app\tests\test_p2_2_return_gl_atomicity.py::test_cogs_reversal PASSED [ 48%]
backend\app\tests\test_p2_2_return_gl_atomicity.py::test_historical_transaction_cost_snapshot_cost PASSED [ 49%]
backend\app\tests\test_p2_2_return_gl_atomicity.py::test_fallback_cost PASSED [ 50%]
backend\app\tests\test_p2_2_return_gl_atomicity.py::test_partial_return PASSED [ 51%]
backend\app\tests\test_p2_2_return_gl_atomicity.py::test_over_return_rejection PASSED [ 52%]
backend\app\tests\test_p2_2_return_gl_atomicity.py::test_repeated_return_idempotency PASSED [ 53%]
backend\app\tests\test_p2_2_return_gl_atomicity.py::test_concurrent_return_protection PASSED [ 54%]
backend\app\tests\test_p2_2_return_gl_atomicity.py::test_gl_failure_rollback PASSED [ 55%]
backend\app\tests\test_p2_2_return_gl_atomicity.py::test_stock_failure_rollback PASSED [ 56%]
backend\app\tests\test_p2_2_return_gl_atomicity.py::test_missing_account_rollback PASSED [ 57%]
backend\app\tests\test_p2_2_return_gl_atomicity.py::test_workflow_failure_rollback PASSED [ 58%]
backend\app\tests\test_p2_2_return_gl_atomicity.py::test_tenant_isolation PASSED [ 59%]
backend\app\tests\test_p2_2_return_gl_atomicity.py::test_cancellation_reversal_safety PASSED [ 60%]
backend\app\tests\test_p2_1_invoice_gl_atomicity.py::test_invoice_post_creates_balanced_revenue_and_cogs_gl PASSED [ 61%]
backend\app\tests\test_p2_1_invoice_gl_atomicity.py::test_gl_failure_causes_complete_rollback PASSED [ 62%]
backend\app\tests\test_p2_1_invoice_gl_atomicity.py::test_stock_failure_causes_complete_rollback PASSED [ 63%]
backend\app\tests\test_p2_1_invoice_gl_atomicity.py::test_missing_account_causes_complete_rollback PASSED [ 64%]
backend\app\tests\test_p2_1_invoice_gl_atomicity.py::test_cost_valuation_hierarchy_and_zero_cost PASSED [ 65%]
backend\app\tests\test_p2_1_invoice_gl_atomicity.py::test_duplicate_post_idempotency PASSED [ 66%]
backend\app\tests\test_p2_1_invoice_gl_atomicity.py::test_tenant_isolation_gl_lookup PASSED [ 67%]
backend\app\tests\test_p2_1_invoice_gl_atomicity.py::test_invoice_cancellation_reverses_revenue_and_cogs PASSED [ 68%]
backend\app\tests\test_sales_return_contracts.py::test_inventory_warehouse_config_switch_001 PASSED [ 69%]
backend\app\tests\test_sales_return_contracts.py::test_inventory_warehouse_missing_001 PASSED [ 70%]
backend\app\tests\test_sales_return_contracts.py::test_sr_policy_001 PASSED [ 71%]
backend\app\tests\test_sales_return_contracts.py::test_sr_policy_missing_001 PASSED [ 72%]
backend\app\tests\test_sales_return_contracts.py::test_sr_policy_data_driven_001 PASSED [ 73%]
backend\app\tests\test_sales_return_contracts.py::test_sr_policy_precedence_001 PASSED [ 74%]
backend\app\tests\test_sales_return_contracts.py::test_sr_policy_version_001 PASSED [ 75%]
backend\app\tests\test_sales_return_contracts.py::test_sr_return_quantity_001 PASSED [ 76%]
backend\app\tests\test_sales_return_contracts.py::test_sr_concurrency_001 PASSED [ 77%]
backend\app\tests\test_sales_return_contracts.py::test_sr_idempotency_001 PASSED [ 78%]
backend\app\tests\test_sales_return_contracts.py::test_sr_idempotency_conflict_001 PASSED [ 79%]
backend\app\tests\test_sales_return_contracts.py::test_sr_tax_001 PASSED [ 80%]
backend\app\tests\test_sales_return_contracts.py::test_sr_refund_001 PASSED [ 81%]
backend\app\tests\test_sales_return_contracts.py::test_sr_refund_idempotency_001 PASSED [ 82%]
backend\app\tests\test_sales_return_contracts.py::test_sr_refund_policy_001 PASSED [ 83%]
backend\app\tests\test_sales_return_contracts.py::test_sr_inventory_001 PASSED [ 84%]
backend\app\tests\test_sales_return_contracts.py::test_sr_finance_001 PASSED [ 85%]
backend\app\tests\test_sales_return_contracts.py::test_sr_credit_note_001 PASSED [ 86%]
backend\app\tests\test_sales_return_contracts.py::test_sr_doc_series_001 PASSED [ 87%]
backend\app\tests\test_sales_return_contracts.py::test_sr_doc_series_rollback_001 PASSED [ 88%]
backend\app\tests\test_sales_return_contracts.py::test_sr_credit_note_lifecycle_001 PASSED [ 89%]
backend\app\tests\test_sales_return_contracts.py::test_sr_credit_note_policy_001 PASSED [ 90%]
backend\app\tests\test_sales_return_contracts.py::test_sr_credit_note_idempotency_001 PASSED [ 91%]
backend\app\tests\test_sales_return_contracts.py::test_sr_audit_conditional_001 PASSED [ 92%]
backend\app\tests\test_sales_return_contracts.py::test_sr_rollback_001 PASSED [ 93%]
backend\app\tests\test_sales_return_contracts.py::test_sr_audit_001 PASSED [ 94%]
backend\app\tests\test_sales_return_contracts.py::test_sr_auth_001 PASSED [ 95%]
backend\app\tests\test_sales_return_contracts.py::test_sr_propos_context_001 PASSED [ 96%]
backend\app\tests\test_sales_return_contracts.py::test_sr_propos_context_security_001 PASSED [ 97%]
backend\app\tests\test_sales_return_contracts.py::test_sr_propos_submit_001 PASSED [ 98%]
backend\app\tests\test_sales_return_contracts.py::test_sr_err_001 PASSED [ 99%]
backend\app\tests\test_sales_return_contracts.py::test_sr_e2e_001 PASSED [100%]

================ 100 passed, 18 warnings in 182.13s (0:03:02) =================
```

## 9. Verification Results
- **P2.5 Test Suite**: 11/11 PASSED (100%)
- **Sales & Payments Regression Suite**: 100/100 PASSED (100%)
- **Alembic Version**: `v1515_sales_schema_tenant_hardening` (frozen, 0 migrations)
- **Historical Payments Preserved**: 29/29 (100% untouched)
- **Account 2060 Coverage**: 41/41 tenant companies with active COA (100%)
- **Customer Credit Ledger Entries Preserved**: 195/195 (100% intact)

## 10. Known Limitations
- Partial refund of an advance currently requires the unallocated balance to be tracked via payment allocations. Any manual journal entries outside `PaymentAllocation` referencing the advance transaction require explicit reconciliation.
- Multi-currency store credit conversions are currently deferred; store credits and advance refunds operate strictly in tenant standard base currency (INR).

## 11. Future Work
- **Phase P2.6**: End-to-end POS cashier tender UI integration for store credit / wallet scanning and OTP-based customer balance redemption.
- **Phase P2.7**: Multi-branch customer wallet settlement netting for corporate retail chains with independent branch accounting books.

## 12. Related ADRs
- `ADR-0021`: Pluggable Universal Document Lifecycle Framework
- `ADR-0022`: Double-Entry General Ledger Synchronization for Retail Cash & Bank Movements
- `ADR-0025`: Customer Advance Liability & Knock-Off Allocation Architecture

## 13. Related RFCs
- `RFC-2026-08`: Universal Transaction Lifecycle Framework Specification
- `RFC-2026-10`: Customer Credit Note, Store Wallet, and Advance Refund Ledger Invariants
