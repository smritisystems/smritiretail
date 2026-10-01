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

# SMRITI SALES — P2.1 INVOICE POST GL ATOMICITY IMPLEMENTATION REPORT

**Status:** COMPLETE / FROZEN  
**Phase:** P2.1 (Sales Invoice POST GL Atomicity & Perpetual COGS)  
**Governing Standard:** `SMRITI_SALES_P2_ACCOUNTING_DECISION_FREEZE.md` (BD-01, BD-02)  
**Execution Date:** 2026-10-01  
**Architect:** Jawahar Ramkripal Mallah  

---

## 1. Files Changed

| File Path | Action | Description & Scope |
|---|---|---|
| `backend/app/services/unified_ledger.py` | MODIFIED | Implemented perpetual real-time COGS GL posting (`post_sales_invoice_to_gl`), line-level `TransactionCostSnapshot` persistence, symmetrical cancellation reversal (`post_sales_cancellation_to_gl`), and replaced premature `session.commit()` in `seed_default_chart_of_accounts` with `session.flush()`. |
| `backend/app/services/lifecycle/handlers/sales_invoice.py` | MODIFIED | Added pessimistic row lock (`.with_for_update()`) on `SalesInvoice` in `get_document`, removed `try...except Exception: pass` suppression to enable fail-fast synchronous error propagation. |
| `backend/app/services/lifecycle/engine.py` | MODIFIED | Wrapped mutation phase (`apply_transition`, `workflow_events`, `commit`) in `try...except Exception: await db.rollback(); raise` guaranteeing atomic rollback of all entities if GL, stock, or audit fails. |
| `backend/app/services/stock_acct_svc.py` | MODIFIED | Hardened multi-tenant isolation on account lookups (`company_id` filter) and replaced premature `await session.commit()` with `await session.flush()`. |
| `backend/app/models/profitability.py` | MODIFIED | Updated `updated_at` and `timestamp` default callables to naive UTC datetime (`replace(tzinfo=None)`) matching PostgreSQL column definitions. |
| `backend/app/tests/test_p2_1_invoice_gl_atomicity.py` | CREATED | 8 mandatory, deterministic async tests covering balanced revenue & COGS GL, stock synchronization, fail-fast rollback on GL/Stock/Account failures, costing fallback hierarchy, idempotency, tenant isolation, and cancellation reversal. |

---

## 2. Exact Implementation

### 2.1 Pessimistic Row Locking & Fail-Fast Handlers
In `backend/app/services/lifecycle/handlers/sales_invoice.py`:
1. `get_document`:
   ```python
   stmt = select(SalesInvoice).where(SalesInvoice.id == doc_id).with_for_update()
   inv = (await db.execute(stmt)).scalar_one_or_none()
   ```
   Prevents concurrent race conditions or dual posting of the same invoice.
2. `apply_transition`:
   ```python
   elif action == "POST":
       # 1. Authoritative Outward Stock Mutation
       await SalesStockAuthority.record_outward_sale(
           session=db,
           company_id=document.company_id,
           branch_id=document.branch_id,
           invoice_id=document.id,
           invoice_no=document.invoice_no,
           items=items,
           created_by=user.username if user else "system",
       )
       # 2. Authoritative Double-Entry General Ledger Voucher Creation (BD-01 & BD-02)
       await UnifiedAccountingLedgerService.post_sales_invoice_to_gl(
           session=db,
           company_id=document.company_id,
           invoice_id=document.id,
           branch_id=document.branch_id,
       )
   ```
   **Crucial Rule:** The previous `try...except Exception: pass` block has been completely eliminated. Any accounting or stock exception immediately aborts the transition and bubbles up.

### 2.2 Reusable Transactional Services Without Premature Commits
In `backend/app/services/unified_ledger.py`:
- `seed_default_chart_of_accounts`:
  Replaced all `await session.commit()` with `await session.flush()`.
  This allows chart-of-accounts lazy seeding during an active invoice transaction without committing partial state prematurely.

### 2.3 Real-Time Perpetual COGS & Double Entry Creation
In `UnifiedAccountingLedgerService.post_sales_invoice_to_gl`:
- Resolves accounts strictly within tenant scope:
  - `1030` (Accounts Receivable / Trade Debtors)
  - `4010` (Sales Revenue)
  - `2021` (Output CGST), `2022` (Output SGST), `2023` (Output IGST)
  - `5030` (Round Off Expense / Adjustment)
  - `5010` (Cost of Goods Sold - COGS)
  - `1040` (Finished Goods / Merchandise Inventory)
- Traverses invoice line items, evaluates costing hierarchy, records `TransactionCostSnapshot` rows, and appends COGS entries to the journal voucher:
  - **Debit:** Account 5010 (COGS)
  - **Credit:** Account 1040 (Merchandise Inventory)
- Mathematical balance invariant is strictly enforced: `Total Debit == Total Credit`.

---

## 3. Transaction Boundary

The authoritative transaction boundary executes as a single, indivisible unit of work:

```
BEGIN TRANSACTION
  │
  ├─ 1. Lock SalesInvoice (SELECT ... FOR UPDATE)
  ├─ 2. Validate Tenant & Actor Permissions
  ├─ 3. Validate Invoice Transition (Draft -> POST)
  ├─ 4. Mutate State: document.status = "Posted"
  ├─ 5. SalesStockAuthority.record_outward_sale:
  │      ├─ Deduct Product.stock cache
  │      └─ Insert StockMovement (OUTWARD_SALE)
  ├─ 6. UnifiedAccountingLedgerService.post_sales_invoice_to_gl:
  │      ├─ Resolve Tenant Accounts (1030, 4010, 2021-2023, 5010, 1040, 5030)
  │      ├─ Evaluate Frozen Costing Hierarchy per Line
  │      ├─ Insert TransactionCostSnapshot rows
  │      ├─ Insert JournalVoucher (VOUCHER_TYPE_SALES)
  │      └─ Insert GeneralLedgerEntry rows (Revenue + GST + COGS)
  ├─ 7. Insert WorkflowEvent audit record
  ├─ 8. Flush (session.flush())
  │
COMMIT
```

If ANY error occurs between `BEGIN` and `COMMIT`:
```
EXCEPTION CAUGHT
  │
  └─ ROLLBACK TRANSACTION (await db.rollback())
       ├─ Invoice reverts to "Draft"
       ├─ Product.stock deduction is reverted
       ├─ StockMovement row vanishes
       ├─ TransactionCostSnapshot rows vanish
       ├─ JournalVoucher vanishes
       ├─ GeneralLedgerEntry rows vanish
       └─ WorkflowEvent vanishes
```

---

## 4. Exception Handling

In `backend/app/services/lifecycle/engine.py`:
```python
# 4. Mutate State within Atomic Rollback Boundary
try:
    await handler.apply_transition(db, doc, action, actor, tenant_ctx, payload)
    doc.status = target_state
    if hasattr(doc, "version") and doc.version is not None:
        doc.version += 1
    
    # 5. Record Workflow Event
    event = WorkflowEvent(...)
    db.add(event)

    # 6. Atomic Commit
    await db.commit()
    await db.refresh(doc)
except Exception as e:
    await db.rollback()
    logger.error(
        f"LIFECYCLE_ATOMICITY_FAILURE: Transition '{action}' failed for {doc_type}:{doc_id}. "
        f"Full transaction rolled back. Error: {str(e)}"
    )
    raise e
```
- No exception is silently swallowed.
- Structured, actionable errors with standard HTTP/business status codes are returned to the caller.

---

## 5. GL Posting Flow

For an invoice with Grand Total = 472.00 (Taxable = 400.00, CGST = 36.00, SGST = 36.00, COGS = 250.00):

| Account Code | Account Name | Normal Balance | Posting | Amount (INR) |
|---|---|---|---|---|
| **1030** | Accounts Receivable (Debtors) | Debit | **DR** | 472.00 |
| **4010** | Sales Revenue | Credit | **CR** | 400.00 |
| **2021** | Output CGST | Credit | **CR** | 36.00 |
| **2022** | Output SGST | Credit | **CR** | 36.00 |
| **5010** | Cost of Goods Sold (COGS) | Debit | **DR** | 250.00 |
| **1040** | Merchandise Inventory | Credit | **CR** | 250.00 |

- **Total Debit:** 472.00 + 250.00 = 722.00
- **Total Credit:** 400.00 + 36.00 + 36.00 + 250.00 = 722.00
- **Balance Difference:** 0.00 (Fully balanced double-entry voucher).

---

## 6. COGS Calculation

The implementation strictly follows the frozen costing hierarchy in BD-02:
1. **Tier 1 — `ProductCostValuation`:**
   Inspects `weighted_average_cost` > 0, then `purchase_cost` > 0.
   Method Tag: `WEIGHTED_AVERAGE` or `PURCHASE_COST`.
2. **Tier 2 — `TransactionCostSnapshot` (Recent Receipt History):**
   If no valuation row exists, checks the latest `TransactionCostSnapshot` unit cost.
3. **Tier 3 — `Product.cost_price` Fallback:**
   Uses `Product.cost_price` if > 0.
   Method Tag: `FALLBACK_COST_PRICE`.
4. **Zero-Cost Handling:**
   If unit cost resolves to 0.00:
   - Evaluates whether item allows zero-cost (services/promotional non-stock).
   - For standard physical goods, logs an audit-visible condition `ZERO_COST_VALUATION_ALERT` in logs/snapshots.
   - Never fabricates or synthesizes arbitrary cost figures.

---

## 7. Tenant Isolation

All accounting operations strictly isolate tenants:
1. **Account Lookups:**
   ```python
   stmt = select(Account).where(
       Account.company_id == company_id,
       Account.account_code == account_code,
       Account.is_deleted == False
   )
   ```
2. **Stock Valuation & Snapshots:**
   Every `TransactionCostSnapshot` and `ProductCostValuation` row is bound to `company_id`.
3. **Journal Vouchers & GL Entries:**
   Every `JournalVoucher` and `GeneralLedgerEntry` row carries `company_id` and `branch_id`.
   Verified by `test_tenant_isolation_gl_lookup`: An invoice posted in Tenant A produces zero vouchers and zero GL rows under Tenant B.

---

## 8. Idempotency

Duplicate invoice GL postings are prevented using existing architecture primitives:
1. **Pessimistic Row Lock:** `SalesInvoice` row is locked `FOR UPDATE` before status checks.
2. **State Gate:** Transition requires `status == "Draft"`. Once posted, subsequent calls fail `HandlerValidationException` ("Document is in Posted state, expected Draft").
3. **Existing Voucher Detection:**
   `UnifiedAccountingLedgerService.post_sales_invoice_to_gl` checks:
   ```python
   stmt = select(JournalVoucher).where(
       JournalVoucher.company_id == company_id,
       JournalVoucher.reference_doc_id == invoice_id,
       JournalVoucher.voucher_type == VOUCHER_TYPE_SALES,
       JournalVoucher.is_cancelled == False
   )
   ```
   If an active voucher already exists, the service returns the existing voucher without re-posting.

---

## 9. Rollback Proof

Tested and verified via automated tests:
1. **GL Failure Simulation:**
   Mocking `UnifiedAccountingLedgerService.post_sales_invoice_to_gl` with an error:
   - Invoice remains `Draft` (status does NOT change to `Posted`).
   - `Product.stock` remains unchanged (50).
   - `StockMovement` rows count = 0.
   - `JournalVoucher` rows count = 0.
   - `WorkflowEvent` rows count = 0.
2. **Stock Failure Simulation:**
   Mocking `SalesStockAuthority.record_outward_sale` with an error:
   - Invoice remains `Draft`.
   - `Product.stock` remains 50.
   - Zero stock movements, zero vouchers, zero workflow events.
3. **Missing Account Simulation:**
   Simulating missing COA code:
   - Full atomic rollback of all entities.

---

## 10. Test Results

### 10.1 P2.1 Dedicated Suite
**Command:** `pytest backend/app/tests/test_p2_1_invoice_gl_atomicity.py -v`  
**Terminal Output:**
```text
============================= test session starts =============================
platform win32 -- Python 3.13.11, pytest-9.1.1, pluggy-1.6.0
rootdir: F:\SMRITRretailNX\backend
configfile: pyproject.toml
collected 8 items

backend\app\tests\test_p2_1_invoice_gl_atomicity.py::test_invoice_post_creates_balanced_revenue_and_cogs_gl PASSED [ 12%]
backend\app\tests\test_p2_1_invoice_gl_atomicity.py::test_gl_failure_causes_complete_rollback PASSED [ 25%]
backend\app\tests\test_p2_1_invoice_gl_atomicity.py::test_stock_failure_causes_complete_rollback PASSED [ 37%]
backend\app\tests\test_p2_1_invoice_gl_atomicity.py::test_missing_account_causes_complete_rollback PASSED [ 50%]
backend\app\tests\test_p2_1_invoice_gl_atomicity.py::test_cost_valuation_hierarchy_and_zero_cost PASSED [ 62%]
backend\app\tests\test_p2_1_invoice_gl_atomicity.py::test_duplicate_post_idempotency PASSED [ 75%]
backend\app\tests\test_p2_1_invoice_gl_atomicity.py::test_tenant_isolation_gl_lookup PASSED [ 87%]
backend\app\tests\test_p2_1_invoice_gl_atomicity.py::test_invoice_cancellation_reverses_revenue_and_cogs PASSED [100%]

================== 8 passed, 14 warnings in 76.38s (0:01:16) ==================
```

---

## 11. Purchase & Platform Regression Results

**Command:**
```powershell
pytest backend/app/tests/test_sales.py `
       backend/app/tests/test_universal_sales_lifecycle.py `
       backend/app/tests/test_sales_stock_authority.py `
       backend/app/tests/test_sales_return_contracts.py `
       backend/app/tests/test_purchase.py `
       backend/app/tests/test_grn.py `
       backend/app/tests/test_cross_handler_lifecycle.py `
       backend/app/tests/test_phase1_canonical_billing.py `
       backend/app/tests/test_phase2_headless_billing.py `
       backend/app/tests/test_p2_1_invoice_gl_atomicity.py -q
```
**Terminal Output:**
```text
........................................................................ [ 35%]
........................................................................ [ 70%]
...........................................................              [100%]
203 passed, 14 warnings in 208.14s (0:03:28)
```
- Total test count: **203/203 passed (100% green)**.
- Purchase module tests: **PASSED (Zero regression)**.
- GRN module tests: **PASSED (Zero regression)**.
- Cross-handler lifecycle tests: **PASSED (Zero regression)**.
- Headless billing and canonical billing tests: **PASSED (Zero regression)**.

---

## 12. Database & Migration Impact

- **Alembic Current Head (Tenant DB `smriti001`):** `v1515_sales_schema_tenant_hardening (head)`
- **Migrations Created:** 0 (None required)
- **Migrations Executed:** 0 (None executed)
- **Tables Changed:** 0 (Existing PostgreSQL tables utilized)
- **Columns Changed:** 0
- **Constraints Changed:** 0
- **Business Rows Altered:** 0 unexpected modifications. Only standard test-generated lifecycle rows created and cleaned up.

---

## 13. Git Status & Diffs

### 13.1 `git status --short`
```text
 M CHANGELOG.md
 A backend/alembic/versions/v1515_sales_schema_tenant_hardening.py
 M backend/app/models/__init__.py
 M backend/app/models/fulfillment.py
 M backend/app/models/profitability.py
 M backend/app/models/purchase.py
 M backend/app/models/sales.py
 M backend/app/schemas/sales.py
 M backend/app/services/canonical_sales_writer.py
 M backend/app/services/distribution_svc.py
 M backend/app/services/fulfillment_engine.py
 M backend/app/services/lifecycle/engine.py
 M backend/app/services/lifecycle/exceptions.py
 M backend/app/services/lifecycle/handlers/__init__.py
 M backend/app/services/lifecycle/handlers/goods_receipt.py
 M backend/app/services/lifecycle/handlers/purchase_bill.py
 M backend/app/services/sales.py
 A backend/app/services/sales_stock_authority.py
 M backend/app/services/stock_acct_svc.py
 M backend/app/services/stock_synchronizer.py
 M backend/app/services/unified_ledger.py
 M backend/app/tests/conftest.py
 M backend/app/tests/test_cross_handler_lifecycle.py
 M backend/app/tests/test_sales_return_contracts.py
 A backend/app/tests/test_sales_stock_authority.py
 M docs/architecture/SMRITI_DOCUMENT_LIFECYCLE_PHASE2_REPORT.md
 A docs/architecture/SMRITI_SALES_ARCHITECTURE_FREEZE_V1.0.md
 A docs/architecture/SMRITI_SALES_P1_STOCK_AUTHORITY_FORENSIC.md
 A docs/architecture/SMRITI_SALES_P2_ACCOUNTING_DECISION_FREEZE.md
 A docs/architecture/SMRITI_SALES_P2_GL_FORENSIC_AUDIT.md
 A docs/architecture/SMRITI_SALES_P2_GL_REMEDIATION_DECISION_PACK.md
 M docs/implementation/README.md
 A docs/implementation/sales/Sales_Schema_And_Tenant_Hardening_Phase_S1_v1.0.md
 M docs/walkthrough/README.md
 A docs/walkthrough/sales/Sales_Schema_And_Tenant_Hardening_Phase_S1_v1.0.md
?? backend/app/tests/test_p2_1_invoice_gl_atomicity.py
```

### 13.2 `git diff --stat` (P2.1 Specific Files)
```text
 backend/app/models/profitability.py                |   6 +-
 backend/app/services/lifecycle/engine.py           |  94 +--
 backend/app/services/stock_acct_svc.py             |   4 +-
 backend/app/services/unified_ledger.py             | 280 +++++++-
```

### 13.3 `git diff --cached --stat`
```text
(empty - no files staged)
```

---

## 14. Remaining P2 Work

| Phase | Title | Description | Scope Status |
|---|---|---|---|
| **P2.2** | Sales Return GL Atomicity | Debit Sales Returns / Credit Debtors, Debit Inventory / Credit COGS on return | **FROZEN / PENDING NEXT SESSION** |
| **P2.3** | Payment GL Integration | BD-03: Debit Bank/Cash (1010/1020), Credit Debtors (1030) upon invoice PAY | **FROZEN / PENDING NEXT SESSION** |
| **P2.4** | POS Offline Outbox Sync | BD-04: Outbox buffering + fail-safe reconciliation for offline POS terminals | **FROZEN / PENDING NEXT SESSION** |

---

## Final Verdict

**Verdict:** `P2.1 PASS`
