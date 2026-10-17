<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 4.15.0
  Created      : 2026-09-09
  Modified     : 2026-09-09
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Phase 2D: Unified Accounting Ledger Outbox Integration & GL Voucher Posting v4.15.0

## 1. Purpose
This walkthrough documents the end-to-end integration between the Transactional Outbox Engine (`IntegrationOutboxEvent`, `OutboxQueueWorker`) and the `UnifiedAccountingLedgerService`. It validates that operational transactions emitted across retail point-of-sale, procurement, payments, and stock audit are asynchronously converted into balanced, double-entry General Ledger journal vouchers with strict idempotency and zero database locks during publishing.

## 2. Scope
1. **Idempotency Hardening:** Pre-flight existence validation in `UnifiedAccountingLedgerService` across:
   - `post_sales_invoice_to_gl`
   - `post_purchase_receipt_to_gl`
   - `post_payment_transaction_to_gl`
   - `post_stock_audit_reconciliation_to_gl`
   - `post_shift_close_to_gl`
2. **Transactional Outbox Dispatcher:** Implementation of `UnifiedAccountingLedgerService.dispatch_outbox_event(event, session=None)`.
3. **Multi-Tenant Daemon Orchestration:** Integration of `OutboxQueueWorker` and `AnalyticsDaemonService.run_accounting_outbox_cycle`.
4. **End-to-End Characterization Test Suite:** Verification via `backend/tests/test_accounting_outbox_integration.py` (5/5 tests green).
5. **Full Regression Test Suite:** Verification of 36/36 tests green across accounting, outbox, canonical sales writer, and daemon rollups.

## 3. Files Created
- `backend/tests/test_accounting_outbox_integration.py`
- `docs/implementation/accounting/Phase2D_Unified_Accounting_Ledger_Outbox_Integration_Plan_v4.15.0.md`
- `docs/walkthrough/accounting/Phase2D_Unified_Accounting_Ledger_Outbox_Integration_v4.15.0.md`

## 4. Files Modified
- `backend/app/services/unified_ledger.py`
- `backend/app/services/analytics_daemon.py`
- `backend/tests/t_daemon_rollup.py`
- `docs/implementation/README.md`
- `docs/walkthrough/README.md`

## 5. Architecture Decisions
- **Decoupled Asynchronous GL Posting:** Operational billing write operations committed via `CanonicalSalesPostingWriter` do not synchronously block on GL journal entry generation. Instead, an atomic outbox event (`SALES_INVOICE_POSTED`) is recorded in the same database transaction.
- **Two-Phase Non-Blocking Batch Dispatching:** `OutboxQueueWorker` claims batches with PostgreSQL `SKIP LOCKED`, marks them `PROCESSING`, commits the claim to release outbox table locks, executes `dispatch_outbox_event` in an isolated session, and subsequently settles the event to `DISPATCHED`.
- **Strict Idempotency Invariant:** Every posting method checks for existing `JournalVoucher` by `(company_id, reference_doc_type, reference_doc_id)` before posting, ensuring at-least-once outbox message delivery yields strictly exactly-once ledger entries.
- **Mathematical Double-Entry Equality:** `JournalVoucher.total_debit == JournalVoucher.total_credit` is strictly enforced on every generated voucher.

## 6. Design Rationale
- High-volume retail checkout environments cannot tolerate transaction locks or latency degradation caused by complex chart-of-accounts traversal.
- The two-phase claim and settle mechanism completely prevents deadlocks between POS cashier threads and ledger consolidation background workers.
- Handling outbox dispatching inside the FastAPI service layer ensures that business rules, tax ledgers, roundoff accounts, and customer outstanding entries remain governed by domain-driven Python models rather than opaque database triggers.

## 7. Implementation Summary
1. **`UnifiedAccountingLedgerService` Updates:**
   - Added idempotency checks to `post_payment_transaction_to_gl` and `post_stock_audit_reconciliation_to_gl`.
   - Implemented `dispatch_outbox_event(cls, event: Any, session: Optional[AsyncSession] = None) -> Optional[JournalVoucher]`.
   - Normalizes event types (`SALES_INVOICE_POSTED`, `PURCHASE_RECEIPT_POSTED`, `PAYMENT_TRANSACTION_POSTED`, `STOCK_AUDIT_RECONCILED`, `SHIFT_CLOSED`).
   - Automatically provisions per-tenant session if called without an active session, committing transactions on completion.
2. **`AnalyticsDaemonService` Updates:**
   - Added `run_accounting_outbox_cycle(cls, tenants=None, limit=50)` method to execute tenant-by-tenant outbox processing via `OutboxQueueWorker`.
3. **Multi-Tenant Fixture & Parity Stabilization:**
   - Populated default `Branch` (`BR-001`) in tenant database `smriti002` for `COMP-002`.
   - Harmonized `t_daemon_rollup.py` auth headers with valid active branch context (`MAIN`).

## 8. Tests Executed
```bash
pytest backend/tests/test_accounting_outbox_integration.py backend/tests/t_unified_ledger.py backend/tests/t_outbox_stats.py backend/tests/test_canonical_sales_writer.py backend/tests/t_daemon_rollup.py -v
```

## 9. Verification Results

### A. Literal Test Runner Terminal Output
```
============================= test session starts =============================
platform win32 -- Python 3.13.11, pytest-9.1.1, pluggy-1.6.0 -- C:\Users\netma\AppData\Local\Programs\Python\Python313\python.exe
cachedir: .pytest_cache
rootdir: F:\SMRITRretailNX\backend
configfile: pyproject.toml
plugins: anyio-4.14.2, asyncio-1.4.0
asyncio: mode=Mode.AUTO, debug=False, asyncio_default_fixture_loop_scope=None, asyncio_default_test_loop_scope=function
collecting ... collected 36 items

backend\tests\test_accounting_outbox_integration.py::test_canonical_sales_writer_to_gl_outbox_dispatch PASSED [  2%]
backend\tests\test_accounting_outbox_integration.py::test_outbox_gl_dispatcher_strict_idempotency PASSED [  5%]
backend\tests\test_accounting_outbox_integration.py::test_purchase_receipt_outbox_to_gl_dispatch PASSED [  8%]
backend\tests\test_accounting_outbox_integration.py::test_payment_transaction_outbox_to_gl_dispatch PASSED [ 11%]
backend\tests\test_accounting_outbox_integration.py::test_analytics_daemon_accounting_outbox_cycle PASSED [ 13%]
backend\tests\t_unified_ledger.py::test_chart_of_accounts_idempotent_seeding PASSED [ 16%]
backend\tests\t_unified_ledger.py::test_manual_journal_voucher_posting_balance_invariant PASSED [ 19%]
backend\tests\t_unified_ledger.py::test_unbalanced_journal_voucher_rejection_400 PASSED [ 22%]
backend\tests\t_unified_ledger.py::test_sales_invoice_automated_gl_posting PASSED [ 25%]
backend\tests\t_unified_ledger.py::test_purchase_receipt_automated_gl_posting PASSED [ 27%]
backend\tests\t_unified_ledger.py::test_trial_balance_equality_guarantee PASSED [ 30%]
backend\tests\t_unified_ledger.py::test_profit_and_loss_calculation PASSED [ 33%]
backend\tests\t_unified_ledger.py::test_accounting_tenant_isolation PASSED [ 36%]
backend\tests\t_unified_ledger.py::test_payment_transaction_cash_automated_gl_posting PASSED [ 38%]
backend\tests\t_unified_ledger.py::test_payment_transaction_upi_bank_automated_gl_posting PASSED [ 41%]
backend\tests\t_unified_ledger.py::test_stock_audit_deficit_gl_posting PASSED [ 44%]
backend\tests\t_unified_ledger.py::test_stock_audit_surplus_gl_posting PASSED [ 47%]
backend\tests\t_unified_ledger.py::test_account_period_balance_snapshotting PASSED [ 50%]
backend\tests\t_outbox_stats.py::test_real_domain_service_sales_invoice_outbox_atomicity PASSED [ 52%]
backend\tests\t_outbox_stats.py::test_real_domain_service_sales_invoice_cancellation_outbox_atomicity PASSED [ 55%]
backend\tests\t_outbox_stats.py::test_outbox_transaction_rollback_guarantee PASSED [ 58%]
backend\tests\t_outbox_stats.py::test_outbox_dispatcher_two_phase_claim_and_retry_backoff PASSED [ 61%]
backend\tests\t_outbox_stats.py::test_outbox_dead_letter_queue_transition PASSED [ 63%]
backend\tests\t_outbox_stats.py::test_outbox_dispatcher_rejects_missing_callback PASSED [ 66%]
backend\tests\t_outbox_stats.py::test_authoritative_operational_analytics_summary PASSED [ 69%]
backend\tests\t_outbox_stats.py::test_outbox_and_analytics_tenant_isolation PASSED [ 72%]
backend\tests\t_outbox_stats.py::test_outbox_queue_worker_multi_tenant_cycle PASSED [ 75%]
backend\tests\test_canonical_sales_writer.py::test_01_retail_pos_mrp_inclusive_posting PASSED [ 77%]
backend\tests\test_canonical_sales_writer.py::test_02_b2b_wholesale_base_rate_exclusive_with_discount PASSED [ 80%]
backend\tests\test_canonical_sales_writer.py::test_03_idempotency_replay_protection PASSED [ 83%]
backend\tests\test_canonical_sales_writer.py::test_04_credit_limit_enforcement_and_supervisor_override PASSED [ 86%]
backend\tests\test_canonical_sales_writer.py::test_05_caller_controlled_session_rollback PASSED [ 88%]
backend\tests\t_daemon_rollup.py::test_analytics_daemon_advisory_lock_concurrency_guard PASSED [ 91%]
backend\tests\t_daemon_rollup.py::test_analytics_daemon_tenant_daily_rollup_execution PASSED [ 94%]
backend\tests\t_daemon_rollup.py::test_analytics_daemon_multi_tenant_cycle PASSED [ 97%]
backend\tests\t_daemon_rollup.py::test_analytics_daemon_api_trigger PASSED [100%]

====================== 36 passed, 11 warnings in 36.09s =======================
```

### B. TypeScript Compilation
```bash
npx tsc --noEmit
# Result: Exited with code 0 (0 errors)
```

### C. Architecture Duplication Gate
```
================================================================================
 CI GATE STATUS: PASSED — Zero unapproved canonical duplications detected.
 Checks Executed: 10 | P0/P1 Violations: 0 | Registered Debt: 5
================================================================================
```

### D. Status
`Done`

## 10. Known Limitations
- E-commerce cart reservation timeouts currently write events to `ECOM_STREAM` channel; these are decoupled from accounting ledger posting.
- Offline desktop POS terminals queue local SQLite outbox records that sync to the server outbox via batch replication prior to ledger consolidation.

## 11. Future Work
- Add automated end-of-year profit & loss closing journal voucher generation (equity roll-forward).
- Add foreign currency revaluation automated journal voucher generation for cross-border wholesale transactions.

## 12. Related ADRs
- `ADR-0019`: Multi-Tenant Outbox Publishing Architecture.
- `ADR-0024`: Double-Entry Unified Accounting Sub-System.
- `ADR-0028`: Two-Phase Non-Blocking Batch Dispatching.

## 13. Related RFCs
- `RFC-0082`: Canonical Sales Posting Writer & Universal Contract.
- `RFC-0089`: Transactional Outbox to Accounting Ledger Event Dispatch Pipeline.
