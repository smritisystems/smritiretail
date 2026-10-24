# SMRITI Retail OS — Phase P2.5 Operational Tenant Database (`smriti001`) Forensic Audit

**Audit Target:** Commit `80385301` — *"feat: implement customer credit notes, wallet settlements, and advance refund processing (Phase P2.5)"*  
**Auditor:** SMRITI Forensic Code & Architecture Engine  
**Governance Standard:** SMRITI UI & Agent Verification Governance Rules (`AGENTS.md`)  
**Target Operational Database:** `localhost:2781/smriti001` (Active Operational Tenant DB for `COMP-001`)  
**Control Plane Database:** `localhost:2781/smritisys`  
**Date:** 2026-10-02  

---

## 1. Executive Summary

This forensic audit evaluates the Phase P2.5 implementation against the **actual operational tenant database** (`smriti001`), rather than the control-plane database (`smritisys`).

### Key Audit Findings:
1. **Production vs Test Database Mismatch:**  
   - Normal production API requests route transactional business data to `smriti001` via `get_company_db()` in `backend/app/api/deps.py`.
   - Automated pytest suites (including `test_p2_5_credit_notes_wallet_refund.py`) execute against ephemeral disposable test databases (`smriti_test_<pid>_<uuid>`), while previous manual audit scripts ran against the control-plane database `smritisys`.
   - In `smriti001`, **Accounts 2050 and 2060 currently do not exist** (Count = 0). The P2.4 and P2.5 seeding scripts ran exclusively against `smritisys`.
2. **Critical Concurrency Defect (Customer Double-Spend Race):**  
   - In `PaymentsEngine.process_payment()`, available credit balance is queried via `SELECT SUM(...)` without acquiring a pessimistic row lock (`SELECT FOR UPDATE`) on the `Customer` record. Concurrent wallet checkouts can double-spend the same customer balance.
3. **Credit Ledger Uniqueness Defect:**  
   - In `CustomerCreditLedgerEntry`, a unique constraint `uq_customer_credit_ledger_reference UNIQUE (reference_type, reference_id)` is enforced. `payments_engine.py` sets `reference_id = req.reference_doc_id` (the invoice ID). If an invoice receives more than one wallet tender (e.g. split tender or installment), the second transaction crashes with a `UniqueViolation`.
4. **Historical Credit Ledger Semantic Conflict:**  
   - In `smriti001`, 219 historical `DEBIT` entries (totaling ₹324,407.95) exist with the note `"Credit sale posted"`. In legacy billing, credit sales were recorded as debits (representing customer receivables). Evaluating these customers under $\sum \text{CREDIT} - \sum \text{DEBIT}$ yields negative balances (179 customers), preventing valid store credit redemption unless filtered by reference type.
5. **Double-Entry Balance Sheet Purity:**  
   - In `smriti001`, all 1,382 existing journal vouchers and 3,587 general ledger entries are 100% mathematically balanced (`sum(debit) == sum(credit)`). Zero orphan entries exist.
6. **Test Suite Parity:**  
   - All 123 tests across 8 suites passed 100% green against real PostgreSQL in 179.72s.

---

## 2. Database Routing Proof

### 2.1 Production Request Routing Chain
```text
HTTP Request (Client)
   ↓
FastAPI Business Route (e.g. /api/v1/payments/process)
   ↓
Dependency: get_company_db() [backend/app/api/deps.py:338]
   ↓
resolve_company_database_name(tenant_ctx.company_id) [backend/app/db/session.py:245]
   ↓
Query smritisys.company_database_registries WHERE company_id = 'COMP-001'
   ↓
Resolved Database: 'smriti001'
   ↓
Connection Pool: get_company_sessionmaker('smriti001')
   ↓
AsyncSession bound to localhost:2781/smriti001
```

### 2.2 Control-Plane Safeguard
In `backend/app/api/deps.py` lines 348–352:
```python
if target_db_name == "smritisys":
    raise HTTPException(
        status_code=500,
        detail="Routing invariant violated: business data cannot use the control-plane database."
    )
```
The architecture strictly forbids business data from being stored in `smritisys` at runtime.

---

## 3. Test Database Proof

### 3.1 Test Database Mechanism (`backend/app/tests/conftest.py`)
1. Pytest initializes `session_template_database` (`smriti_test_template_<pid>_<uuid>`).
2. Runs `EphemeralTenantHarness.run_alembic_upgrade(template_name, "head")`.
3. For each test, `disposable_company_database` executes:
   ```sql
   CREATE DATABASE "smriti_test_<pid>_<uuid>" WITH TEMPLATE "<session_template_database>";
   ```
4. Fixture `auto_override_company_db` overrides both `get_db` and `get_company_db` to yield `db_session` bound to the disposable database.
5. Tests execute against this disposable database and drop it on teardown.

### 3.2 Proof of Database Disconnect
- **Normal API business requests:** Execute against **`smriti001`**.
- **Pytest automated test suites:** Execute against **`smriti_test_<pid>_<uuid>`**.
- **Previous P2.4 / P2.5 audit scripts:** Executed against **`smritisys`**.
- **Evidence:** Tests **bypass `smriti001` completely** to ensure disposable isolation.

---

## 4. `smriti001` Live Database Inventory

Inventory gathered via read-only SQL queries on `localhost:2781/smriti001`:

| Table Name | Total Rows | Active Rows (`is_deleted=false`) | Deleted Rows (`is_deleted=true`) |
|---|---|---|---|
| `payment_transactions` | 868 | 868 | 0 |
| `payment_allocations` | 744 | 744 | 0 |
| `sales_invoices` | 2,776 | 2,626 | 150 |
| `sales_invoice_items` | 16,743 | 16,743 | 0 |
| `customer_credit_ledger_entries` | 242 | 242 | 0 |
| `journal_vouchers` | 1,382 | 1,382 | 0 |
| `general_ledger_entries` | 3,587 | 3,587 | 0 |
| `accounts` | 681 | 681 | 0 |
| `customers` | 1,078 | 783 | 295 |
| `stock_movements` | 9,420 | 9,416 | 4 |
| `companies` | 683 | 683 | 0 |
| `branches` | 1,266 | 1,266 | 0 |

### Tenant Ownership:
- 2,733 of 2,776 sales invoices belong to `COMP-001`.
- All 868 payment transactions belong to `COMP-001`.
- All 1,382 journal vouchers belong to `COMP-001`.

---

## 5. Chart of Accounts Verification in `smriti001`

SQL inspection of key accounts across all companies in `smriti001`:

| Account Code | Account Name | Count in `smriti001` | Count in `COMP-001` | Status |
|---|---|---|---|---|
| `1010` | Cash in Hand | 21 | 1 | Present & Active |
| `1020` | Bank Accounts | 21 | 1 | Present & Active |
| `1030` | Accounts Receivable / Debtors | 21 | 1 | Present & Active |
| `1040` | Stock in Hand (Inventory) | 21 | 1 | Present & Active |
| `2050` | Customer Advance Liability | **0** | **0** | **MISSING IN TENANT DB** |
| `2060` | Customer Credit Note & Wallet Liability | **0** | **0** | **MISSING IN TENANT DB** |

### Root Cause Analysis:
- `seed_2050_coas.py` (Phase P2.4) and `seed_2060_coas.py` (Phase P2.5) connected to `DATABASE_URL` (`localhost:2781/smritisys`) and seeded `smritisys`.
- Neither script targeted `smriti001`.
- In `backend/app/services/unified_ledger.py` (lines 208–214), `get_account_by_code()` has an automated self-healing fallback:
  ```python
  if not account:
      await cls.seed_default_chart_of_accounts(session, company_id)
      account = (await session.execute(stmt)).scalar_one_or_none()
  ```
- Because no transaction has yet been processed against `smriti001` under P2.5, on-demand seeding has not triggered. However, until triggered, Account `2050` and Account `2060` are physically missing in `smriti001`.

---

## 6. Advance Refund Verification

### 6.1 Accounting Rule:
$$\mathbf{Debit:}\; 2050\text{ (Customer Advance Liability)} \quad/\quad \mathbf{Credit:}\; 1010\text{ (Cash)} \;\text{or}\; 1020\text{ (Bank)}$$
- Revenue (`4010`) and Accounts Receivable (`1030`) remain untouched.
- Enforces dynamic residual calculation under row lock `PaymentTransaction.with_for_update()`:
  $$\text{Max Refundable} = \text{Original Amount} - \sum \text{Allocations} - \sum \text{Prior Refunds}$$
- Verified in code: [backend/app/services/payments_engine.py](file:///F:/SMRITRretailNX/backend/app/services/payments_engine.py#L415-L440) and [backend/app/services/unified_ledger.py](file:///F:/SMRITRretailNX/backend/app/services/unified_ledger.py#L1673-L1693).
- Real DB status in `smriti001`: Total advance transactions = 24 (`ADVANCE_PAYMENT` legacy), advance refund vouchers = 0.

---

## 7. Invoice Payment Refund Verification

### 7.1 Accounting Rule:
$$\mathbf{Debit:}\; 1030\text{ (Accounts Receivable)} \quad/\quad \mathbf{Credit:}\; 1010\text{ (Cash)} \;\text{or}\; 1020\text{ (Bank)}$$
- Enforces invoice balance reinstatement under row lock `SalesInvoice.with_for_update()`:
  - Decreases `paid_amount`.
  - Increases `balance_amount`.
  - Reverts status from `PAID` to `POSTED` if outstanding balance remains.
- Verified in code: [backend/app/services/payments_engine.py](file:///F:/SMRITRretailNX/backend/app/services/payments_engine.py#L508-L525) and [backend/app/services/unified_ledger.py](file:///F:/SMRITRretailNX/backend/app/services/unified_ledger.py#L1695-L1715).

---

## 8. Customer Credit / Wallet Verification

### 8.1 Accounting Rule:
$$\mathbf{Debit:}\; 2060\text{ (Customer Credit Note \& Wallet Liability)} \quad/\quad \mathbf{Credit:}\; 1030\text{ (Accounts Receivable)}$$
- Pure liability-to-receivable settlement.
- Cash (`1010`), Bank (`1020`), and Revenue (`4010`) are 100% untouched.
- Verified in code: [backend/app/services/unified_ledger.py](file:///F:/SMRITRretailNX/backend/app/services/unified_ledger.py#L1456-L1477).
- Real DB status in `smriti001`: Wallet tenders count = 0.

---

## 9. Critical Condition #1: Customer Concurrency Analysis

### 9.1 The Concurrency Race Condition
In `backend/app/services/payments_engine.py` (lines 175–196):
```python
stmt_credit = select(
    func.coalesce(
        func.sum(
            case(
                (CustomerCreditLedgerEntry.entry_type == "CREDIT", CustomerCreditLedgerEntry.amount),
                else_=-CustomerCreditLedgerEntry.amount
            )
        ),
        0
    )
).where(
    CustomerCreditLedgerEntry.customer_id == effective_cust_id,
    CustomerCreditLedgerEntry.company_id == company_id,
    CustomerCreditLedgerEntry.is_deleted == False
)
avail_credit = Decimal(str(await session.scalar(stmt_credit) or 0.00))

if tender_amt > avail_credit:
    raise ValueError(f"Tender amount ₹{tender_amt} exceeds available customer store credit / wallet balance ₹{avail_credit}.")
```

### 9.2 Defect Mechanics:
- In PostgreSQL, `SELECT SUM(...)` cannot use `FOR UPDATE` because it is an aggregate query.
- The code does **NOT** lock the parent `Customer` row before running `stmt_credit`.
- If two cashier checkouts for the same customer arrive concurrently:
  1. Transaction A reads `avail_credit = 1,000.00`.
  2. Transaction B reads `avail_credit = 1,000.00`.
  3. Both transactions pass the `tender_amt <= avail_credit` check.
  4. Both transactions insert `CustomerCreditLedgerEntry(DEBIT, amount=1000.00)`.
  5. The customer's balance becomes negative (-₹1,000.00), creating an unbacked double-spend liability.
- **Classification:** **CRITICAL CONDITION / BLOCKER FOR PRODUCTION CONCURRENCY**.

---

## 10. Critical Condition #2: Credit Ledger Reference Uniqueness Analysis

### 10.1 Schema Constraint in `customer_credit_ledger_entries`:
```sql
CONSTRAINT uq_customer_credit_ledger_reference UNIQUE (reference_type, reference_id)
```

### 10.2 Defect Mechanics:
In `backend/app/services/payments_engine.py` line 208:
```python
session.add(
    CustomerCreditLedgerEntry(
        ...
        reference_type="SALES_INVOICE",
        reference_id=req.reference_doc_id or tx_id,
        ...
    )
)
```
- When an invoice (e.g. `INV-9001`) is tendered via `WALLET` for partial amount ₹200:
  `reference_type = 'SALES_INVOICE'`, `reference_id = 'INV-9001'`.
- If the customer later pays another ₹300 using `WALLET` on the same invoice:
  `payments_engine.py` attempts to insert `reference_type = 'SALES_INVOICE'`, `reference_id = 'INV-9001'`.
- PostgreSQL immediately throws:
  ```text
  asyncpg.exceptions.UniqueViolationError: duplicate key value violates unique constraint "uq_customer_credit_ledger_reference"
  ```
- Any second wallet payment against the same invoice crashes fail-closed.
- **Remediation Required:** `reference_id` must reference the unique payment transaction (`tx_id`) or composite `f"{req.reference_doc_id}:{tx_id}"`.
- **Classification:** **CRITICAL CONDITION / BLOCKER FOR SPLIT/MULTI-TENDER**.

---

## 11. Idempotency Analysis

| Flow | Mechanism | Database Constraint | Idempotent Retry Protection |
|---|---|---|---|
| **Advance Refund** | `idempotency_key` search on `PaymentTransaction` | `uq_payment_idempotency_key UNIQUE (idempotency_key)` | Returns existing refund response without duplicate GL |
| **Invoice Payment Refund** | `idempotency_key` search on `PaymentTransaction` | `uq_payment_idempotency_key UNIQUE (idempotency_key)` | Returns existing refund response without duplicate GL |
| **Wallet Redemption** | Sub-key `f"{clean_key}_{idx}"` on `PaymentTransaction` | `uq_payment_idempotency_key UNIQUE (idempotency_key)` | Enforced on transaction; missing on `CustomerCreditLedgerEntry` |
| **Credit Note Settlement** | Sub-key `f"{clean_key}_{idx}"` on `PaymentTransaction` | `uq_payment_idempotency_key UNIQUE (idempotency_key)` | Enforced on transaction; missing on `CustomerCreditLedgerEntry` |

---

## 12. Atomicity Analysis

- All operations (`PaymentTransaction`, original transaction status update, `SalesInvoice` balance/status reinstatement, `JournalVoucher`, and `GeneralLedgerEntry`) execute within a single session transaction.
- When `commit=True`, an outer `try ... except` block executes `await session.rollback()` on any failure.
- When `commit=False`, the transaction is flushed (`await session.flush()`), deferring the commit/rollback boundary to the calling coordinator.
- Zero partial business transactions were detected.

---

## 13. Tenant Isolation Analysis

- All queries filter strictly on `company_id`.
- Cross-company refund attempts fail closed with:
  `ValueError: Original payment transaction '...' not found.`
- Cross-company allocations fail closed with:
  `ValueError: Cross-company payment allocation is prohibited.`
- Verified in `test_cross_company_refund_isolation`.

---

## 14. `smriti001` Database Integrity Metrics

SQL inspection of 100% of rows in `smriti001`:

| Metric | Measured Value | Standard | Status |
|---|---|---|---|
| Unbalanced Journal Vouchers | **0** / 1,382 | 0 | Perfect Debit == Credit Parity |
| Orphan General Ledger Entries | **0** / 3,587 | 0 | 100% Linked to Vouchers |
| Duplicate Vouchers for same Ref | **0** | 0 | Zero Duplicate Postings |
| Orphan Allocations | **0** / 744 | 0 | 100% Linked to Payments |
| Cross-Company Allocations | **0** | 0 | Complete Tenant Isolation |
| Over-Refunded Payments | **0** / 868 | 0 | Zero Over-Refunds |
| Negative Credit Customers | **179** | 0 | **Historical Semantic Conflict** |
| Invoices with Math Discrepancy | **1,419** | 0 | **Historical Legacy Offline Invoices** |

### Explanation of Discrepancies:
1. **Negative Credit Customers (179):** Caused by historical September 2026 credit sales logged as `DEBIT` with notes `'Credit sale posted'`. They represent receivables, not store credit reductions.
2. **Invoices with Math Discrepancy (1,419):** Caused by historical offline invoices imported with `paid_amount = 0` and `balance_amount = 0` without undergoing the `POST` transition.

---

## 15. Regression Test Results

Execution of all 8 test suites against live PostgreSQL (`localhost:2781`):
```bash
python -m pytest backend/app/tests/test_p2_5_credit_notes_wallet_refund.py backend/app/tests/test_p2_4_advance_payment.py backend/app/tests/test_p2_3_payment_gl_atomicity.py backend/app/tests/test_p2_2_return_gl_atomicity.py backend/app/tests/test_p2_1_invoice_gl_atomicity.py backend/app/tests/test_universal_sales_lifecycle.py backend/app/tests/test_sales_stock_authority.py backend/app/tests/test_sales_return_contracts.py -v
```

### Terminal Results:
```text
================ 123 passed, 18 warnings in 179.72s (0:02:59) =================
```
- `test_p2_5_credit_notes_wallet_refund.py`: **11 passed**
- `test_p2_4_advance_payment.py`: **17 passed**
- `test_p2_3_payment_gl_atomicity.py`: **17 passed**
- `test_p2_2_return_gl_atomicity.py`: **15 passed**
- `test_p2_1_invoice_gl_atomicity.py`: **8 passed**
- `test_universal_sales_lifecycle.py`: **10 passed**
- `test_sales_stock_authority.py`: **13 passed**
- `test_sales_return_contracts.py`: **32 passed**
- **Failures:** 0
- **Errors:** 0
- **Skipped:** 0

---

## 16. Consolidated Findings

1. **Architecture & Routing Integrity:** Production requests route to `smriti001`. Control plane routes to `smritisys`. Test suites execute against ephemeral databases.
2. **Double-Entry Accuracy:** All P2.5 accounting logic (advance refunds, invoice refunds, wallet redemptions) produces balanced vouchers with zero cash/revenue leakage.
3. **Database-Level Protection:** Payment transactions have database-level unique idempotency keys.
4. **Tenant Isolation:** Complete isolation verified across all queries.
5. **Gaps Identified:**
   - Account 2050 and Account 2060 are unseeded in `smriti001`.
   - Customer-level row lock is missing in wallet redemption.
   - Credit ledger reference uniqueness constraint collides on multiple wallet tenders per invoice.
   - Historical credit sales entries in `customer_credit_ledger_entries` distort wallet credit calculations.

---

## 17. Conditions & Blockers

The following items must be resolved before Phase P2.5 can be considered fully production-ready for multi-terminal retail deployment:

1. **[BLOCKER 1] Provision Accounts 2050 & 2060 in `smriti001`:**  
   Execute `seed_default_chart_of_accounts` on `smriti001` for `COMP-001` so that accounts `2050` and `2060` exist prior to live transaction volume.
2. **[BLOCKER 2] Customer Concurrency Pessimistic Lock:**  
   In `PaymentsEngine.process_payment()`, add:
   ```python
   stmt_cust_lock = select(Customer.id).where(Customer.id == effective_cust_id, Customer.company_id == company_id).with_for_update()
   await session.execute(stmt_cust_lock)
   ```
   prior to calculating `stmt_credit` to prevent concurrent double-spends.
3. **[BLOCKER 3] Credit Ledger Reference Uniqueness Fix:**  
   In `CustomerCreditLedgerEntry` creation during wallet tender, change:
   ```python
   reference_id=tx_id  # or f"{req.reference_doc_id}:{tx_id}"
   ```
   to prevent unique constraint collisions on multiple wallet tenders per invoice.
4. **[BLOCKER 4] Historical Credit Sales Disambiguation:**  
   Filter `stmt_credit` to exclude legacy credit sales:
   ```python
   CustomerCreditLedgerEntry.reference_type != "SALES_INVOICE" # or filter strictly to SALES_RETURN / WALLET_TOPUP / ADVANCE
   ```
   so that historical credit purchases do not produce artificial negative wallet balances.

---

## 18. Final Verdict

According to the strict audit governance criteria:
- Production / Test DB Mismatch: Present (Tests ran against ephemeral DBs, while `smriti001` lacks 2050/2060).
- Customer Concurrency Race: Present (Missing `with_for_update()` on Customer).
- Incorrect Credit Reference Uniqueness: Present (Collides on multiple tenders per invoice).
- Missing Mandatory COA in `smriti001`: Present (Count = 0 for 2050 and 2060).

Because these four conditions fall under the mandatory blocking criteria defined by the task:

P2.5 FORENSIC AUDIT COMPLETE  
VERDICT: BLOCKED

---

## 19. Exact Evidence

### 19.1 SQL Evidence: COA Distribution in `localhost:2781/smriti001`
Query executed against `smriti001`:
```sql
SELECT code, name, count(*) 
FROM accounts 
WHERE code IN ('1010', '1020', '1030', '1040', '2050', '2060') 
  AND is_deleted = false 
GROUP BY code, name;
```
Literal Query Output:
```text
 code |              name               | count 
------+---------------------------------+-------
 1010 | Cash in Hand                    |    21
 1020 | Bank Accounts                   |    21
 1030 | Accounts Receivable / Debtors   |    21
 1040 | Stock in Hand (Inventory)       |    21
(4 rows)

Accounts 2050 and 2060 return 0 rows in smriti001.
```

### 19.2 SQL Evidence: Accounting Balance Parity in `localhost:2781/smriti001`
Query executed against `smriti001`:
```sql
SELECT jv.id, jv.voucher_no,
       coalesce(sum(gle.debit_amount), 0) as tot_deb,
       coalesce(sum(gle.credit_amount), 0) as tot_cred
FROM journal_vouchers jv
LEFT JOIN general_ledger_entries gle ON gle.voucher_id = jv.id
GROUP BY jv.id, jv.voucher_no
HAVING coalesce(sum(gle.debit_amount), 0) != coalesce(sum(gle.credit_amount), 0);
```
Literal Query Output:
```text
(0 rows)
Total unbalanced vouchers: 0 / 1,382 (100% balanced).
```

### 19.3 SQL Evidence: Customer Credit Ledger Semantic Collision
Query executed against `smriti001`:
```sql
SELECT entry_type, count(*), sum(amount) 
FROM customer_credit_ledger_entries 
WHERE is_deleted = false 
GROUP BY entry_type;
```
Literal Query Output:
```text
 entry_type | count |    sum     
------------+-------+------------
 CREDIT     |    23 |   33785.44
 DEBIT      |   219 |  324407.95
(2 rows)

Query for negative balances:
SELECT count(distinct customer_id)
FROM (
    SELECT customer_id, sum(CASE WHEN entry_type = 'CREDIT' THEN amount ELSE -amount END) as net_bal
    FROM customer_credit_ledger_entries
    WHERE is_deleted = false
    GROUP BY customer_id
    HAVING sum(CASE WHEN entry_type = 'CREDIT' THEN amount ELSE -amount END) < 0
) t;
count: 179
```

### 19.4 Code Evidence: Missing Row Lock in `PaymentsEngine.process_payment()`
Source: `backend/app/services/payments_engine.py` lines 175–199:
```python
# Check customer credit balance if tender is WALLET or CREDIT_NOTE
if tender_mode in (PaymentMethod.WALLET.value, PaymentMethod.CREDIT_NOTE.value, "STORE_CREDIT"):
    if not effective_cust_id:
        raise ValueError(f"Customer is required for payment mode '{tender_mode}'.")
    
    stmt_credit = select(
        func.coalesce(
            func.sum(
                case(
                    (CustomerCreditLedgerEntry.entry_type == "CREDIT", CustomerCreditLedgerEntry.amount),
                    else_=-CustomerCreditLedgerEntry.amount
                )
            ),
            0
        )
    ).where(
        CustomerCreditLedgerEntry.customer_id == effective_cust_id,
        CustomerCreditLedgerEntry.company_id == company_id,
        CustomerCreditLedgerEntry.is_deleted == False
    )
    avail_credit = Decimal(str(await session.scalar(stmt_credit) or 0.00))

    if tender_amt > avail_credit:
        raise ValueError(
            f"Tender amount ₹{tender_amt} exceeds available customer store credit / wallet balance ₹{avail_credit}."
        )
```
Evidence: No `SELECT ... FROM customers WHERE id = :customer_id FOR UPDATE` is issued before querying available credit balance.

### 19.5 Code Evidence: `CustomerCreditLedgerEntry` Reference Uniqueness Collision
Source: `backend/app/services/payments_engine.py` lines 205–216:
```python
session.add(
    CustomerCreditLedgerEntry(
        id=f"ccl_{uuid.uuid4().hex[:12]}",
        company_id=company_id,
        customer_id=effective_cust_id,
        entry_type="DEBIT",
        amount=tender_amt,
        reference_type="SALES_INVOICE",
        reference_id=req.reference_doc_id or tx_id,
        notes=f"Settlement of invoice {req.reference_doc_id} via {tender_mode}",
        is_deleted=False
    )
)
```
Evidence: `reference_id=req.reference_doc_id` causes `uq_customer_credit_ledger_reference UNIQUE (reference_type, reference_id)` violation on any subsequent wallet payment for the same invoice.

### 19.6 Regression Test Output
Exact terminal output from running the full 8-suite regression battery:
```text
Command: python -m pytest backend/app/tests/test_p2_5_credit_notes_wallet_refund.py backend/app/tests/test_p2_4_advance_payment.py backend/app/tests/test_p2_3_payment_gl_atomicity.py backend/app/tests/test_p2_2_return_gl_atomicity.py backend/app/tests/test_p2_1_invoice_gl_atomicity.py backend/app/tests/test_universal_sales_lifecycle.py backend/app/tests/test_sales_stock_authority.py backend/app/tests/test_sales_return_contracts.py -v

============================= test session starts =============================
platform win32 -- Python 3.12.8, pytest-8.3.4, pluggy-1.5.0 -- C:\Users\netma\AppData\Local\Programs\Python\Python312\python.exe
cachedir: .pytest_cache
rootdir: F:\SMRITRretailNX
configfile: pytest.ini
plugins: anyio-4.8.0, asyncio-0.25.3
asyncio: mode=Mode.AUTO, default_loop_scope=None
collecting ... collected 123 items

backend/app/tests/test_p2_5_credit_notes_wallet_refund.py::test_customer_advance_refund_accounting_and_gl PASSED [  0%]
backend/app/tests/test_p2_5_credit_notes_wallet_refund.py::test_advance_refund_exceeds_available_balance PASSED [  1%]
backend/app/tests/test_p2_5_credit_notes_wallet_refund.py::test_advance_refund_idempotency PASSED [  2%]
backend/app/tests/test_p2_5_credit_notes_wallet_refund.py::test_invoice_payment_refund_accounting_and_gl PASSED [  3%]
backend/app/tests/test_p2_5_credit_notes_wallet_refund.py::test_invoice_refund_exceeds_paid_amount PASSED [  4%]
backend/app/tests/test_p2_5_credit_notes_wallet_refund.py::test_invoice_refund_reopens_paid_invoice PASSED [  4%]
backend/app/tests/test_p2_5_credit_notes_wallet_refund.py::test_customer_wallet_settlement_accounting_and_gl PASSED [  5%]
backend/app/tests/test_p2_5_credit_notes_wallet_refund.py::test_wallet_settlement_insufficient_credit_rejected PASSED [  6%]
backend/app/tests/test_p2_5_credit_notes_wallet_refund.py::test_cross_company_refund_isolation PASSED [  7%]
backend/app/tests/test_p2_5_credit_notes_wallet_refund.py::test_refund_nonexistent_payment_rejected PASSED [  8%]
backend/app/tests/test_p2_5_credit_notes_wallet_refund.py::test_refund_voided_payment_rejected PASSED [  8%]
backend/app/tests/test_p2_4_advance_payment.py::test_advance_payment_atomic_gl_and_allocation PASSED [  9%]
backend/app/tests/test_p2_4_advance_payment.py::test_advance_payment_split_allocation_two_invoices PASSED [ 10%]
...
backend/app/tests/test_sales_return_contracts.py::test_credit_note_generation_from_return PASSED [100%]

================ 123 passed, 18 warnings in 179.72s (0:02:59) =================
```

### 19.7 Git Working Tree Status & Commit Verification
Command: `git status`
```text
On branch smritiNX
Your branch is up to date with 'origin/smritiNX'.

Untracked files:
  (use "git add <file>..." to include in what will be committed)
	docs/architecture/SMRITI_SALES_P2_5_FORENSIC_AUDIT.md
	docs/architecture/SMRITI_SALES_P2_5_TENANT_DB_FORENSIC_AUDIT.md

nothing added to commit but untracked files present (use "git add" to track)
```
Command: `git log -1 --oneline`
```text
80385301 feat: implement customer credit notes, wallet settlements, and advance refund processing (Phase P2.5)
```
