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

# Phase 2D: Unified Accounting Ledger Outbox Integration & GL Voucher Posting Plan v4.15.0

## 1. Objective
Establish an authoritative, asynchronous, non-blocking bridge connecting transactional outbox events (`SALES_INVOICE_POSTED`, `PURCHASE_RECEIPT_POSTED`, `PAYMENT_TRANSACTION_POSTED`, `STOCK_AUDIT_RECONCILED`, `SHIFT_CLOSED`) with the `UnifiedAccountingLedgerService`. Ensure that every posted operational document automatically translates into a balanced, immutable, double-entry General Ledger journal voucher (`JournalVoucher` and `GeneralLedgerEntry`) with strict idempotency and zero database locks during publishing.

## 2. Business Motivation
In modern retail enterprise architectures, financial accounting cannot block Point-of-Sale (POS) cashier checkout latency or warehouse receipt throughput. By capturing business transactions in an ACID-compliant transactional outbox table (`integration_outbox_events`) and asynchronously dispatching them to the General Ledger via `OutboxQueueWorker` and `AnalyticsDaemonService`, SMRITI guarantees sub-second POS bill finalization while maintaining 100% mathematical auditability (Total Debits == Total Credits) across all tenant databases.

## 3. Scope
- **Idempotency Hardening:** Add pre-flight existence queries across `JournalVoucher` references (`SALES_INVOICE`, `PURCHASE_RECEIPT`, `PAYMENT_TRANSACTION`, `STOCK_AUDIT`, `POS_SHIFT`) in `UnifiedAccountingLedgerService`.
- **Outbox Event Dispatcher:** Implement `UnifiedAccountingLedgerService.dispatch_outbox_event` as the canonical adapter converting generic outbox event records into double-entry vouchers.
- **Tenant Routing & Session Isolation:** Ensure the dispatcher supports caller-provided sessions as well as standalone dynamic sessions resolved via the Control Plane registry.
- **Worker & Daemon Wiring:** Integrate `OutboxQueueWorker` and `AnalyticsDaemonService` with `dispatch_outbox_event`.
- **Integration Test Coverage:** Create characterization test suite `backend/tests/test_accounting_outbox_integration.py` verifying end-to-end sales, purchase, payment, and daemon cycles.

## 4. Current State
- `CanonicalSalesPostingWriter` posts sales and enqueues an outbox event with `event_type="SALES_INVOICE_POSTED"`, `status="PENDING"`.
- `UnifiedAccountingLedgerService` provided manual methods (`post_sales_invoice_to_gl`, `post_purchase_receipt_to_gl`, `post_payment_transaction_to_gl`, `post_stock_audit_reconciliation_to_gl`), but lacked a unified event subscriber adapter.
- `OutboxQueueWorker` required an authoritative dispatcher callback to bridge outbox events with financial ledger updates.

## 5. Gap Analysis
- No unified callback interface existed to dispatch outbox events to the accounting ledger without manual per-document invocations.
- Replaying outbox events risked duplicate GL postings if idempotency checks were missing on payment and stock audit methods.
- Integration tests did not verify the end-to-end pipeline from `CanonicalSalesPostingWriter` -> Outbox -> `OutboxQueueWorker` -> `JournalVoucher`.

## 6. Architecture Impact
- Enforces strict compliance with the Transactional Outbox Pattern:
  1. Transactional write (Sales / Purchase / Payment) + Outbox record committed atomically.
  2. Phase 1 Claim: `OutboxQueueWorker` claims batch with `SKIP LOCKED` and sets `PROCESSING`.
  3. Phase 2 Dispatch: `dispatch_outbox_event` translates payload to double-entry GL vouchers in an isolated session.
  4. Phase 3 Settle: Outbox status updated to `DISPATCHED` (or scheduled for exponential retry / DLQ).
- Maintains strict tenant isolation: all accounting vouchers reside strictly within tenant databases (`smriti001`, `smriti002`).

## 7. Proposed Design
- `UnifiedAccountingLedgerService.dispatch_outbox_event(event, session=None)`:
  - Normalizes event types, payload schemas, company IDs, and document identifiers.
  - Branches into domain posting routines (`post_sales_invoice_to_gl`, `post_purchase_receipt_to_gl`, `post_payment_transaction_to_gl`, `post_stock_audit_reconciliation_to_gl`, `post_shift_close_to_gl`).
  - Gracefully ignores non-accounting event types without throwing errors.
- Idempotency guards in each posting function check for active `JournalVoucher` by `(company_id, reference_doc_type, reference_doc_id)` and return existing voucher if present.

## 8. Files Created
- `backend/tests/test_accounting_outbox_integration.py`
- `docs/implementation/accounting/Phase2D_Unified_Accounting_Ledger_Outbox_Integration_Plan_v4.15.0.md`
- `docs/walkthrough/accounting/Phase2D_Unified_Accounting_Ledger_Outbox_Integration_v4.15.0.md`

## 9. Files Modified
- `backend/app/services/unified_ledger.py`
- `backend/app/services/analytics_daemon.py`
- `backend/tests/t_daemon_rollup.py`
- `docs/implementation/README.md`
- `docs/walkthrough/README.md`

## 10. Dependencies
- FastAPI Core & SQLAlchemy AsyncEngine.
- Control Plane registry (`company_database_registries` in `smritisys`).
- Tenant PostgreSQL databases (`smriti001`, `smriti002`).

## 11. Risks
- **Risk:** Concurrent processing of duplicate outbox events creating duplicate ledger postings.
  - **Mitigation:** Strict idempotency pre-check querying `JournalVoucher` by `reference_doc_id` prior to voucher creation.
- **Risk:** Database lock contention between outbox worker and POS billing transactions.
  - **Mitigation:** Two-phase non-blocking dispatch algorithm; publishing executes outside the outbox table lock.

## 12. Rollback Strategy
- Changes are fully backward compatible. If the dispatcher fails, outbox events remain in `PENDING` / `FAILED` state without corrupting operational sales documents.
- Any incomplete or failed transaction rolls back cleanly without persisting unbalanced vouchers.

## 13. Verification Plan
- Automated pytest regression suite covering `test_accounting_outbox_integration.py`, `t_unified_ledger.py`, `t_outbox_stats.py`, `test_canonical_sales_writer.py`, and `t_daemon_rollup.py`.
- Complete verification of double-entry balance invariant: `assert voucher.total_debit == voucher.total_credit`.
- TypeScript compiler zero-error verification (`npx tsc --noEmit`).
- Pre-commit architecture duplication gate execution (`python scripts/architecture_duplication_gate.py`).

## 14. Test Plan
- `test_canonical_sales_writer_to_gl_outbox_dispatch`: Verify end-to-end sales outbox publishing to GL voucher.
- `test_outbox_gl_dispatcher_strict_idempotency`: Verify idempotent replay protection across duplicate outbox deliveries.
- `test_purchase_receipt_outbox_to_gl_dispatch`: Verify purchase GRN outbox event translation to balanced GL voucher.
- `test_payment_transaction_outbox_to_gl_dispatch`: Verify payment transaction outbox event translation to balanced GL voucher.
- `test_analytics_daemon_accounting_outbox_cycle`: Verify multi-tenant outbox execution cycle via `AnalyticsDaemonService`.

## 15. Documentation Impact
- Update `docs/implementation/README.md` master index table.
- Create comprehensive walkthrough in `docs/walkthrough/accounting/`.
- Update `docs/walkthrough/README.md` master index table.

## 16. Deployment Plan
- Deploy backend service update to `D:\Smriti_Retail_OS\apps\smriti_retail_os`.
- Run database migrations / parity checks.
- Pull to test environment `F:\Smriti9\apps\smriti_retail_os`.

## 17. Status
Completed

## 18. Related ADRs
- `ADR-0019`: Multi-Tenant Outbox Publishing Architecture.
- `ADR-0024`: Double-Entry Unified Accounting Sub-System.
- `ADR-0028`: Two-Phase Non-Blocking Batch Dispatching.

## 19. Related Walkthroughs
- `docs/walkthrough/accounting/Phase2D_Unified_Accounting_Ledger_Outbox_Integration_v4.15.0.md`
- `docs/walkthrough/billing/Phase2C_Canonical_Sales_Writer_Execution_v4.14.0.md`
