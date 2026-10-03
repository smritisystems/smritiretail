<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.21.0
  Created      : 2026-10-02
  Modified     : 2026-10-02
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Implementation Plan: SMRITI Sales Phase P2.4 — Customer Advance Payment & Invoice Knock-off

**Plan Identifier:** `IPGP-SALES-P2.4-v1.0`  
**Phase:** Sales P2.4 — Customer Advance Payment & Invoice Knock-off  
**Status:** Completed  
**Lifecycle State:** Completed  

---

## 1. Objective
Implement authoritative, double-entry Customer Advance Payments and Sales Invoice Knock-off in SMRITI Retail OS. Guarantee strict accounting integrity:
- Advance Receipt: `DR 1010/1020` / `CR 2050 (Customer Advance Liability)`
- Invoice Knock-Off: `DR 2050 (Customer Advance Liability)` / `CR 1030 (Accounts Receivable)`
- Ensure zero cash movement during knock-off, zero new database tables, zero schema drift, and zero regression across P2.1, P2.2, and P2.3.

---

## 2. Business Motivation
In enterprise wholesale, footwear manufacturing, and retail distribution, customers frequently pay advance deposits prior to dispatch or order fulfillment. Recording customer advance payments directly as invoice settlements or crediting revenue prematurely distorts financial statements, violates statutory Indian accounting standards (AS-9 / Ind AS 115), and obscures accounts receivable aging. Phase P2.4 provides a compliant double-entry liability workflow with subsequent invoice knock-off.

---

## 3. Scope
- **Included:**
  1. Customer advance payment recording via `PaymentTransaction(reference_doc_type="CUSTOMER_ADVANCE", auto_allocate=False)`.
  2. Double-entry advance GL generation (`DR 1010/1020` / `CR 2050`).
  3. Dynamic unallocated balance calculation without duplicate columns.
  4. Advance → Sales Invoice knock-off allocation via `PaymentAllocation`.
  5. Knock-off GL generation (`DR 2050` / `CR 1030`) with zero cash movement.
  6. Pessimistic two-phase row locking on `PaymentTransaction` and `SalesInvoice`.
  7. Multi-tenant and customer party isolation.
  8. Idempotency on payment creation and allocation retries.
  9. Session rollback on GL failures.
  10. Multi-invoice and partial knock-off support.
  11. Real PostgreSQL zero-mock integration test suite (17 tests).
- **Excluded:**
  1. Customer wallets and credit balances (Phase P2.5).
  2. Customer refund processing (Phase P2.5).
  3. New database tables or allocation models.
  4. Historical data backfill or conversion of existing direct payments.

---

## 4. Current State
- `PaymentTransaction` and `PaymentAllocation` existed but were coupled strictly to direct invoice settlement (`SALES_INVOICE`).
- `post_payment_transaction_to_gl()` credited `1030` (Accounts Receivable) for all customer payments.
- Account `2050` ("Customer Advance Liability") was not registered in `DEFAULT_CHART_OF_ACCOUNTS` and missing from tenant company charts of accounts.
- 29 historical payments existed in PostgreSQL, all direct invoice settlements.

---

## 5. Gap Analysis
| Requirement | Baseline State | Required State | Resolution |
|---|---|---|---|
| Advance Liability Account | Missing | Account `2050` active in company COA | Added to `DEFAULT_CHART_OF_ACCOUNTS`, seeded across all 41 companies |
| Advance Receipt GL | Directly credited `1030` (AR) | Must debit `1010/1020` and credit `2050` | Added `CUSTOMER_ADVANCE` branch in `post_payment_transaction_to_gl()` |
| Knock-off GL | Re-credited cash or skipped | Must debit `2050` and credit `1030` with zero cash movement | Built `post_payment_allocation_to_gl()` |
| Concurrency Safety | Optimistic or un-locked | Pessimistic `FOR UPDATE` row lock on advance and invoice | Added `.with_for_update()` in `allocate_payment()` |
| Atomic Rollback | Dirty in-memory state on error | Immediate `await session.rollback()` on error when `commit=True` | Wrapped operations in `try...except` |

---

## 6. Architecture Impact
- Reused `PaymentTransaction` and `PaymentAllocation` tables without adding tables or columns.
- Registered account `2050` into the authoritative Chart of Accounts.
- Preserved single source of truth for payment ledger and invoice balances.
- Kept Alembic migration head frozen at `v1515_sales_schema_tenant_hardening`.

---

## 7. Proposed Design
1. **Receipt Endpoint:** `PaymentsEngine.process_payment(req)` where `req.reference_doc_type = "CUSTOMER_ADVANCE"`.
2. **Receipt GL:** `UnifiedAccountingLedgerService.post_payment_transaction_to_gl()` checks `ref_type == "CUSTOMER_ADVANCE"`. Emits `DR 1010/1020` / `CR 2050`.
3. **Allocation Endpoint:** `PaymentsEngine.allocate_payment()` locks `PaymentTransaction` and `SalesInvoice` with `SELECT FOR UPDATE`.
4. **Knock-Off GL:** `UnifiedAccountingLedgerService.post_payment_allocation_to_gl()` emits `DR 2050` / `CR 1030` for `reference_doc_type = "PAYMENT_ALLOCATION"`.

---

## 8. Files Created
1. `backend/app/tests/test_p2_4_advance_payment.py`
2. `docs/architecture/SMRITI_SALES_P2_4_ADVANCE_PAYMENT_FORENSIC_AUDIT.md`
3. `docs/architecture/SMRITI_SALES_P2_4_ADVANCE_PAYMENT_IMPLEMENTATION.md`
4. `docs/implementation/sales/Sales_P2_4_Customer_Advance_Payment_And_Invoice_Knockoff_Implementation_Plan_v1.0.md`
5. `docs/walkthrough/sales/Sales_P2_4_Customer_Advance_Payment_And_Invoice_Knockoff_Walkthrough_v1.0.md`

---

## 9. Files Modified
1. `backend/app/schemas/payments.py`
2. `backend/app/services/lifecycle/handlers/sales_invoice.py`
3. `backend/app/services/payments_engine.py`
4. `backend/app/services/unified_ledger.py`

---

## 10. Dependencies
- FastAPI + PostgreSQL (`smritisys`).
- `UnifiedAccountingLedgerService` double-entry posting engine.
- `UniversalLifecycleEngine` document state transitions.

---

## 11. Risks & Mitigation
- **Risk:** Race conditions over-allocating advance balances during concurrent requests.
  - **Mitigation:** Applied pessimistic `SELECT ... FOR UPDATE` row locks before computing unallocated amounts.
- **Risk:** Duplicate knock-off GL postings on network retries.
  - **Mitigation:** Enforced idempotency check and deterministic UUID5 allocation IDs backed by DB PK constraint.
- **Risk:** Partial state committed when GL service fails.
  - **Mitigation:** Enforced atomic session rollback inside `PaymentsEngine` when `commit=True`.

---

## 12. Rollback Strategy
If any runtime issue is discovered in production:
1. Advance receipt operations can be halted by refusing `reference_doc_type = "CUSTOMER_ADVANCE"`.
2. All 29 historical payments remain direct invoice settlements and are unaffected.
3. Code revert does not require database rollback as zero database migrations or DDL changes were introduced.

---

## 13. Verification Plan
1. Schema verification: Confirm 0 new tables, 0 altered columns, Alembic head unchanged.
2. 2050 account audit: Confirm 41/41 companies have exactly 1 active 2050 account.
3. Historical data audit: Confirm 29/29 historical payments remain untouched.
4. Live integration test suite execution against PostgreSQL.

---

## 14. Test Plan
- Run 17 dedicated tests in `backend/app/tests/test_p2_4_advance_payment.py`.
- Run P2.3 regression suite (17 tests).
- Run P2.2 regression suite (15 tests).
- Run P2.1 regression suite (8 tests).
- Run sales lifecycle regression suite (32 tests).
- Target: 100% green, 0 failures, 0 regressions.

---

## 15. Documentation Impact
- Created `docs/architecture/SMRITI_SALES_P2_4_ADVANCE_PAYMENT_IMPLEMENTATION.md`.
- Created `docs/walkthrough/sales/Sales_P2_4_Customer_Advance_Payment_And_Invoice_Knockoff_Walkthrough_v1.0.md`.
- Updated `docs/walkthrough/README.md`.
- Updated `docs/implementation/README.md`.
- Updated `CHANGELOG.md`.

---

## 16. Deployment Plan
1. Code changes deployed to FastAPI application.
2. Execute `seed_default_chart_of_accounts()` for any newly provisioned company tenants.
3. Zero database schema migrations required.

---

## 17. Status
**Completed & Fully Verified** (89/89 tests green, 0 regressions).

---

## 18. Related ADRs
- `ADR-SALES-P2.4-01`: Reusing Canonical Payment Ledger Tables for Advance Accounting.
- `ADR-SALES-P2.4-02`: Zero Cash Movement Invariant on Invoice Knock-off Settlement.
- `ADR-SALES-P2.4-03`: Pessimistic Two-Phase Row Locking Hierarchy on Allocation.

---

## 19. Related Walkthroughs
- [Sales_P2_4_Customer_Advance_Payment_And_Invoice_Knockoff_Walkthrough_v1.0.md](../../walkthrough/sales/Sales_P2_4_Customer_Advance_Payment_And_Invoice_Knockoff_Walkthrough_v1.0.md)
