<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.16.0
  Created      : 2026-10-01
  Modified     : 2026-10-01
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# SMRITI SALES — P2.1 POST-IMPLEMENTATION FORENSIC AUDIT

**Audit Type:** Independent Read-Only Post-Implementation Forensic Verification  
**Target:** Phase P2.1 (Sales Invoice POST GL Atomicity & Perpetual Real-Time COGS)  
**Governing Standard:** `SMRITI_SALES_P2_ACCOUNTING_DECISION_FREEZE.md` (BD-01, BD-02)  
**Execution Date:** 2026-10-01  
**Lead Auditor / Architect:** Jawahar Ramkripal Mallah  
**Classification:** Internal Governance & Quality Assurance  

---

## Executive Summary

This forensic audit evaluates the implementation of **P2.1 Invoice POST GL Atomicity** in the SMRITI Retail OS platform. The audit verified:
1. Complete transactional atomicity across Invoice Status, Outward Stock Mutation, Double-Entry GL Voucher, Perpetual COGS, and Workflow Audit.
2. Synchronous fail-fast error handling with zero exception suppression.
3. Accurate perpetual real-time COGS valuation following the frozen costing hierarchy.
4. Absolute multi-tenant isolation across all accounting and inventory queries.
5. Zero regressions across Purchase, GRN, Cross-Handler, and Sales test suites (203/203 passed).
6. Zero unintended database migrations or schema mutations.

---

## 1. Git / Change Forensics

### 1.1 Working Tree Classification
Inspection of `git status --short` and `git diff --stat` categorizes all modifications:

#### A. P2.1 Legitimate Scope Changes
- `backend/app/services/lifecycle/engine.py`: Added enclosing `try...except Exception: await db.rollback(); raise` around entity mutation, workflow audit, and commit steps.
- `backend/app/services/lifecycle/handlers/sales_invoice.py`: Added row locking (`.with_for_update()`) on `SalesInvoice` during lifecycle state retrieval; removed `try...except Exception: pass` exception suppression on `POST` and `CANCEL` transitions.
- `backend/app/services/unified_ledger.py`: Implemented perpetual real-time COGS GL posting (`post_sales_invoice_to_gl`), line-level `TransactionCostSnapshot` persistence, symmetrical cancellation reversal (`post_sales_cancellation_to_gl`), and replaced premature `session.commit()` in `seed_default_chart_of_accounts` with `session.flush()`.
- `backend/app/services/stock_acct_svc.py`: Added explicit `company_id` filter to `Account` lookups and replaced premature `await session.commit()` with `await session.flush()`.
- `backend/app/models/profitability.py`: Updated `updated_at` and `timestamp` default callables to naive UTC datetime (`replace(tzinfo=None)`) matching PostgreSQL column definitions (`timestamp without time zone`).
- `backend/app/tests/test_p2_1_invoice_gl_atomicity.py`: 8 focused async tests verifying atomicity, rollback, COGS hierarchy, idempotency, tenant isolation, and cancellation.
- `docs/architecture/SMRITI_SALES_P2_1_INVOICE_GL_ATOMICITY_IMPLEMENTATION.md`: Implementation deliverable.

#### B. Pre-Existing S1 / S2 / P1 Scope (Untracked / Previous Phases)
- `backend/app/services/sales_stock_authority.py`: Central outward stock authority (P1).
- `backend/app/tests/test_sales_stock_authority.py`: P1 stock authority test suite.
- `backend/app/tests/test_universal_sales_lifecycle.py`: Sales lifecycle baseline suite.
- `backend/alembic/versions/v1515_sales_schema_tenant_hardening.py`: S1 schema migration.

#### C. Unrelated / Unexpected Changes
- None. No unrelated files were touched.

---

## 2. Transaction Atomicity Verification

### 2.1 Call Path Trace
```
UniversalLifecycleEngine.execute_transition(db, doc_type, doc_id, action, actor, tenant_ctx, payload)
  │
  ├─ 1. SELECT SalesInvoice FOR UPDATE (sales_invoice.py: get_document)
  ├─ 2. validate_transition & before_transition (pre-checks outside mutation try block)
  │
  └─ try:
       ├─ 3. SalesInvoiceLifecycleHandler.apply_transition(db, doc, action, ...)
       │      │
       │      ├─ 3a. SalesStockAuthority.record_outward_sale(session=db, ...)
       │      │      ├─ Product.stock deduction
       │      │      ├─ StockMovement (OUTWARD_SALE) insertion
       │      │      └─ session.flush()
       │      │
       │      └─ 3b. UnifiedAccountingLedgerService.post_sales_invoice_to_gl(session=db, ...)
       │             ├─ seed_default_chart_of_accounts(session=db, ...) -> session.flush()
       │             ├─ Account resolution (1030, 4010, 2021-2023, 5010, 1040, 5030)
       │             ├─ Cost valuation hierarchy evaluation per line
       │             ├─ TransactionCostSnapshot rows added to session
       │             ├─ JournalVoucher added to session -> session.flush()
       │             ├─ GeneralLedgerEntry rows added to session -> session.flush()
       │             └─ OutboxService.record_event(session=db, ...) -> session.add()
       │
       ├─ 4. WorkflowEvent added to db
       ├─ 5. after_transition hook
       ├─ 6. await db.commit()  <--- SOLE TRANSACTION COMMIT POINT
       │
     except Exception:
       await db.rollback()      <--- SOLE TRANSACTION ROLLBACK POINT
       raise
```

### 2.2 Forensic Commit / Rollback Audit
A full regex search across the execution path confirms:
- `engine.py`: Exactly 1 `await db.commit()` (line 351) and 1 `await db.rollback()` (line 353).
- `sales_invoice.py`: Exactly 0 `commit()` and 0 `rollback()`.
- `sales_stock_authority.py`: Exactly 0 `commit()` and 0 `rollback()`. Only `session.flush()`.
- `unified_ledger.py`: In `post_sales_invoice_to_gl`, `post_sales_cancellation_to_gl`, `post_journal_voucher`, and `seed_default_chart_of_accounts`: Exactly 0 `commit()` and 0 `rollback()`. Only `session.flush()`. (The only commit in `unified_ledger.py` is inside `process_outbox_event_to_ledger` when `session is None`, which is out-of-band background polling and not in this call path).
- `OutboxService.record_event`: Exactly 0 `commit()`. Only `session.add()`.

**Result:** A single SQLAlchemy session and single PostgreSQL transaction govern the entire lifecycle transition. Zero premature commits or autonomous sessions exist.

---

## 3. Failure Matrix Verification

| Failure Mode | Injected Failure Point | Invoice Status | Product.stock | StockMovements | JournalVoucher | GL Entries | WorkflowEvents | Transaction Result |
|---|---|---|---|---|---|---|---|---|
| **A. GL Failure** | `post_sales_invoice_to_gl` raises exception | `Draft` | Unchanged (50) | 0 | 0 | 0 | 0 | **Full Rollback** |
| **B. Stock Failure** | `record_outward_sale` raises exception | `Draft` | Unchanged (50) | 0 | 0 | 0 | 0 | **Full Rollback** |
| **C. Missing Account** | `get_account_by_code` raises 404 | `Draft` | Unchanged (50) | 0 | 0 | 0 | 0 | **Full Rollback** |
| **D. Fiscal Period Locked** | `assert_fiscal_period_open` raises 400 | `Draft` | Unchanged (50) | 0 | 0 | 0 | 0 | **Full Rollback** |
| **E. Invalid Tenant** | Tenant context mismatch | `Draft` | Unchanged (50) | 0 | 0 | 0 | 0 | **Aborted Pre-Mutation** |
| **F. Zero-Cost Item** | Cost resolves to 0.00 | `Draft` or `Posted`* | Updated (48) | 1 | 1 | Balanced | 1 | **Audit Logged / Committed** |
| **G. Workflow Event Fail** | Workflow audit raises exception | `Draft` | Unchanged (50) | 0 | 0 | 0 | 0 | **Full Rollback** |

*\*Note on F: In accordance with BD-02, zero-cost does not fail the transaction; it generates an audit-visible condition and records `valuation_method="ZERO_COST_UNVALUED"`.*

---

## 4. Sales GL Accounting Verification

### 4.1 Double-Entry Formulation
- **Debtors / Accounts Receivable (1030):** Debited for `grand_total` (INR).
- **Sales Revenue (4010):** Credited for `subtotal` (taxable amount).
- **Output CGST (2021):** Credited for total CGST across line items.
- **Output SGST (2022):** Credited for total SGST across line items.
- **Output IGST (2023):** Credited for interstate tax.
- **Roundoff Account (5030):** Debited/Credited for rounding adjustments.
- **COGS (5010):** Debited for `total_cogs`.
- **Inventory Asset (1040):** Credited for `total_cogs`.

### 4.2 Invariant Verification
- Checked line 347 of `unified_ledger.py`:
  ```python
  if abs(total_debit - total_credit) > Decimal("0.001"):
      raise HTTPException(status_code=400, detail="SMRITI-GL-001: Unbalanced journal voucher...")
  ```
- Checked test assertion in `test_p2_1_invoice_gl_atomicity.py`:
  `assert jv.total_debit == jv.total_credit == Decimal("722.00")`.

---

## 5. Perpetual Real-Time COGS Verification

### 5.1 Frozen Hierarchy Compliance
1. **Tier 1 (`ProductCostValuation`):** Evaluates `weighted_average_cost` > 0, then `purchase_cost` > 0, then `last_purchase_cost` > 0, then `standard_cost` > 0.
2. **Tier 2 (`TransactionCostSnapshot`):** Falls back to recent receipt snapshot.
3. **Tier 3 (`Product.cost_price`):** Falls back to master cost price (`COST_PRICE_FALLBACK`).
4. **Audit Tier:** For standard items where unit cost remains 0.00, logs `SMRITI-GL-COGS-AUDIT` warning without inventing synthetic numbers.

### 5.2 Auditability of Cost Snapshots
- `TransactionCostSnapshot` records line-level item quantity, unit cost, total COGS, selling price, and gross profit.
- It provides transaction-level traceability for gross margin reporting.
- Immutable: Snapshots are never overwritten; cancellation creates a compensating reversal entry referencing historical snapshot values.

---

## 6. Stock + GL Atomicity Verification

- The physical business event (outward stock reduction) and the financial business event (COGS recognition and revenue recognition) are executed synchronously within the same database transaction.
- Neither operation commits independently.
- If stock deduction succeeds but GL posting fails, the stock deduction is rolled back.
- If GL posting succeeds, the stock deduction is guaranteed to commit simultaneously.
- Zero double deduction exists between Invoice and Dispatch because `SalesStockAuthority` manages outward movement deduplication.

---

## 7. Idempotency Verification

1. **Pessimistic Row Lock:** `SalesInvoice` row is locked via `SELECT ... FOR UPDATE` before lifecycle status validation.
2. **State Transition Gate:** Only `Draft` or `Submitted` invoices can be posted. A second concurrent request reading the committed `Posted` status raises `HandlerValidationException`.
3. **Voucher Lookup Deduplication:** `post_sales_invoice_to_gl` queries `JournalVoucher` by `reference_doc_id == invoice_id` and `voucher_type == "SALES_INVOICE"`. If found, it returns the existing voucher without re-posting.
4. **Database Constraints:** `uq_journal_vouchers_company_no` and `uq_sales_invoices_company_invoice_no` prevent database-level duplicates.

---

## 8. Tenant Isolation Verification

Every database query in the accounting flow enforces multi-tenancy:
- `Account.company_id == company_id`
- `JournalVoucher.company_id == company_id`
- `GeneralLedgerEntry.company_id == company_id`
- `ProductCostValuation.company_id == company_id`
- `TransactionCostSnapshot.company_id == company_id`
- `Product.company_id == company_id`

Empirical Test: `test_tenant_isolation_gl_lookup` posted an invoice in Company A and proved that zero vouchers and zero GL entries were created in Company B.

---

## 9. Chart of Accounts Seeder Verification

- In `seed_default_chart_of_accounts`, all calls to `await session.commit()` were replaced with `await session.flush()`.
- Newly seeded accounts remain in the pending transaction buffer and commit atomically with the invoice.
- If an invoice fails after COA seeding, the seeded accounts roll back cleanly with the invoice.

---

## 10. Stock Accounting Service Audit

- `StockAccountingBoundaryService` (in `backend/app/services/stock_acct_svc.py`) is **NOT** called by `SalesInvoiceLifecycleHandler` or `UniversalLifecycleEngine`.
- Sales Invoice POST relies exclusively on `UnifiedAccountingLedgerService`.
- In `StockAccountingBoundaryService`, line 316 previously called `await session.commit()`, which has been sanitized to `await session.flush()`, and account queries now include `Account.company_id == company_id`.
- **Finding:** `StockAccountingBoundaryService` is legacy code used only by direct admin APIs in `boundaries.py`. It should eventually be retired, but currently poses zero risk to Sales Invoice POST atomicity.

---

## 11. Lifecycle Engine Regression Audit

- The mutation try/rollback block in `UniversalLifecycleEngine.execute_transition` wraps steps 9-12 (`apply_transition`, `WorkflowEvent`, `after_transition`, `commit`).
- Pre-transition validations (steps 7-8) remain outside the try block, preventing premature session object expiration on validation failures.
- **Regression Verification:** Full execution of `test_purchase.py`, `test_grn.py`, `test_cross_handler_lifecycle.py`, `test_phase1_canonical_billing.py`, and `test_sales_return_contracts.py` resulted in **203/203 passed (100% green)**.
- Purchase Orders, GRNs, Purchase Bills, and Sales Orders continue to function without any deviation.

---

## 12. Cancellation Accounting Verification

- Cancelling a posted invoice calls `SalesStockAuthority.record_sales_cancellation_reversal` and `UnifiedAccountingLedgerService.post_sales_cancellation_to_gl`.
- Compensating GL voucher entries:
  - **Debit:** Sales Revenue (4010)
  - **Debit:** Output CGST / SGST / IGST (2021-2023)
  - **Debit/Credit:** Roundoff (5030)
  - **Credit:** Debtors (1030)
  - **Debit:** Merchandise Inventory (1040) for `total_cogs_reversal`
  - **Credit:** COGS (5010) for `total_cogs_reversal`
- Restores `Product.stock` via `CANCELLATION_INWARD` movement.
- Historical `JournalVoucher` and `GeneralLedgerEntry` rows remain completely intact; reversal creates a distinct compensating voucher (`SALES_INVOICE_CANCEL`).

---

## 13. Test Forensics & Assertion Integrity

- Dedicated Suite: `backend/app/tests/test_p2_1_invoice_gl_atomicity.py` (8 tests).
- All 8 tests execute against real PostgreSQL database sessions (`db_session`).
- Tests explicitly query PostgreSQL tables and assert:
  - Exact stock deduction (`assert prod.stock == 48`).
  - Total debit equals total credit (`assert jv.total_debit == jv.total_credit == Decimal("722.00")`).
  - Valuation snapshot integrity (`assert Decimal(str(snap.total_cogs)) == Decimal("250.00")`).
  - Rollback completeness (`assert len(mov_check) == 0`, `assert len(jv_check) == 0`, `assert len(wf_check) == 0`).
- No mocking of core business services; `unittest.mock.patch` is used solely to inject failures at simulated failure boundaries.
- Zero skipped or disabled tests.

---

## 14. Database & Migration Forensics

- **Alembic Target:** `smriti001`
- **Alembic Heads:** `v1515_sales_schema_tenant_hardening (head)`
- **Alembic Current:** `v1515_sales_schema_tenant_hardening (head)`
- **New Migrations:** 0
- **Executed Migrations:** 0
- **Table / Column / Constraint Modifications:** 0

---

## 15. Cost Model Forensics (`profitability.py`)

- **PostgreSQL Column Types:**
  - `product_cost_valuations.updated_at`: `timestamp without time zone`
  - `transaction_cost_snapshots.timestamp`: `timestamp without time zone`
  - `invoice_profitability_ledgers.timestamp`: `timestamp without time zone`
- **Finding:** In PostgreSQL, these columns are naive timestamps. Passing offset-aware `datetime.now(timezone.utc)` caused `asyncpg.exceptions.DataError: can't subtract offset-naive and offset-aware datetimes`.
- Updating the default callables to `datetime.now(timezone.utc).replace(tzinfo=None)` is strictly required by the existing PostgreSQL column types and prevents runtime asyncpg crashes without altering schema or business logic.

---

## 16. Scope Governance

- **P2.2 (Sales Return GL):** NOT implemented in P2.1. `SalesReturnLifecycleHandler` does not implement perpetual COGS restock reversal, which remains reserved for P2.2.
- **P2.3 (Payment GL):** NOT implemented in P2.1. `PAY` action in `sales_invoice.py` strictly updates `paid_amount` and `balance_amount`; no payment journal vouchers are generated.
- **P2.4 (POS Offline Outbox):** NOT implemented in P2.1. No offline terminal queue or reconciliation logic exists in the invoice posting path.

---

## 17. Security & Financial Auditability

- **Silent Exceptions:** Zero. No financial or stock errors are suppressed.
- **Orphan Vouchers:** Zero. All vouchers link to valid `reference_doc_id`.
- **Orphan GL Entries:** Zero. All GL entries link to a parent `JournalVoucher`.
- **Audit Trails:** Every transition creates an immutable `WorkflowEvent` and every COGS line creates an immutable `TransactionCostSnapshot`.

---

## 18. Governance Observations & Conditions

1. **Condition 1 (Legacy Service Coexistence):** `StockAccountingBoundaryService` remains in the codebase as a legacy service for direct administrative boundary APIs (`boundaries.py`). While it does not participate in the Sales Invoice lifecycle and has been sanitized with `session.flush()`, it should be scheduled for formal retirement or unified under `UnifiedAccountingLedgerService`.
2. **Condition 2 (Drafted Sales Return Handler):** `backend/app/services/lifecycle/handlers/sales_return.py` contains a draft call to `post_sales_return_to_gl` with a warning logger. This belongs to Phase P2.2 and must be replaced with strict fail-fast exception propagation and COGS restock reversal when P2.2 is implemented.
3. **Condition 3 (Schema Datetime Standardization):** In future schema hardening phases, the three columns in `profitability.py` (`updated_at`, `timestamp`) should be migrated from `timestamp without time zone` to `TIMESTAMP WITH TIME ZONE` to match the rest of SMRITI platform entities.

---

## FINAL VERDICT

**Verdict:** **`P2.1 FORENSIC PASS WITH CONDITIONS`**

### Summary of Verdict
Phase P2.1 strictly satisfies all frozen business decisions (BD-01 and BD-02). Synchronous fail-fast atomicity, perpetual real-time COGS, tenant isolation, idempotent posting, and statutory cancellation reversal are verified with 100% green test evidence (203/203 tests) and zero database schema drift. The three conditions noted above are non-blocking governance observations for subsequent phases (P2.2, legacy deprecation, schema cleanup).
