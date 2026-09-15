<!--
  Project      : SMRITI Retail OS
  Repository   : SMRITIRetailNX
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 4.14.0
  Created      : 2026-09-09
  Modified     : 2026-09-09
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Phase 2C — Canonical Sales Writer, Posting Contract & POS Adapter Convergence Walkthrough

**Version:** `v4.14.0`  
**Status:** `Done`  
**Classification:** Enterprise Tier-1 Core Financial Authority  
**Area:** `billing`  

---

## 1. Purpose
This walkthrough documents the full execution and verification of Phase 2C Step 1 & Step 2: the Canonical Sales Posting Writer (`CanonicalSalesPostingWriter`), caller-controlled transactional session management (`commit: bool = True/False`), payments engine transaction boundary safety (`PaymentsEngine.allocate_payment`), POS checkout adapter convergence (`POSService.pos_checkout`), and qualification of the canonical characterization test suite with 100% green assertions.

---

## 2. Scope
- **Canonical Sales Posting Authority**: Establishing `CanonicalSalesPostingWriter.post_sales_transaction` as the sole transactional authority for confirmed sales invoice generation.
- **Transactional Boundary Hardening**: Extending `PaymentsEngine.allocate_payment` to support `commit: bool = True/False`, eliminating hardcoded internal commits during composed transactions.
- **POS Adapter Delegation**: Confirming `POSService.pos_checkout` operates as a thin ingress adapter acquiring shift row locks (`Shift.status == 'OPEN'`) and delegating execution to the canonical writer.
- **Dual-Key & Statutory GST Math**: Validating intra-state (CGST 50% + SGST 50%) and inter-state (IGST 100%) tax calculation, MRP-inclusive vs base-rate exclusive pricing, and line discount deductions prior to GST.
- **Idempotency & Replay Protection**: Deterministic SHA-256 payload hashing protecting against duplicate billings and race conditions.
- **Customer Credit & Identity Control**: Authoritative gating blocking unapproved credit and validating customer scopes.

---

## 3. Files Created
1. `docs/implementation/billing/Phase2C_Canonical_Sales_Writer_And_Posting_Contract_Plan_v4.14.0.md`: Formal 19-section implementation plan.
2. `docs/walkthrough/billing/Phase2C_Canonical_Sales_Writer_Execution_v4.14.0.md`: This formal 13-section walkthrough document.

---

## 4. Files Modified
1. `backend/app/services/payments_engine.py`:
   - Updated `allocate_payment` to accept `commit: bool = True`. Replaced hardcoded `await session.commit()` with `if commit: await session.commit() else: await session.flush()`.
2. `backend/tests/test_canonical_sales_writer.py`:
   - Added automated `.env` loading and path resolution before importing application modules, satisfying runtime secret requirements.
3. `backend/tests/t_payments.py`:
   - Configured `.env` loading and corrected branch context mapping to valid registered branch `BR-MAIN-001`.
4. `backend/tests/conftest.py`:
   - Added global `dotenv` loading ensuring all current and future test files inherit environment secrets cleanly.
5. `docs/implementation/README.md`:
   - Appended Phase 2C implementation plan row to the master index table.

---

## 5. Architecture Decisions
1. **Anti-God Service Boundary Preservation**:
   `CanonicalSalesPostingWriter` does not perform physical stock mutations, multi-tender payment authorizations, or tax math inline. It coordinates strictly with `InventoryWmsService` (stock truth), `PaymentsEngine` (tender truth), and `core/gst_engine.py` (statutory tax math).
2. **Caller-Controlled Transaction Ownership**:
   When `commit=False`, the writer and its collaborators perform `session.flush()` only. The outer caller (orchestrator or adapter) controls the final commit/rollback, ensuring 100% ACID consistency.
3. **Pessimistic Shift Locking**:
   POS checkouts acquire `with_for_update()` row locks on `Shift` to prevent race conditions during register closeout (Z-Reports).

---

## 6. Design Rationale
- **Single Source of Financial Truth**: Unifying POS and wholesale B2B invoices under one authority eliminates dual-writer divergence, inconsistent tax rounding, and untracked inventory decrements.
- **Non-Breaking Ingress Parity**: Retaining existing API request/response structures in `POSService` ensures existing frontend POS terminals (`ProPosBillingTerm.tsx`, `BillingTerm.tsx`) function without regression.

---

## 7. Implementation Summary
- `CanonicalSalesPostingWriter.post_sales_transaction` was verified across all 5 canonical test dimensions:
  1. Retail POS MRP-inclusive posting with dual-key items.
  2. B2B wholesale base-rate exclusive posting with pre-tax line discounting.
  3. Idempotency replay returning cached results with identical payload hashes.
  4. Credit limit enforcement blocking unauthorized over-limit billing.
  5. Session rollback verification proving zero partial writes on simulated failure.
- `PaymentsEngine.allocate_payment` transaction boundary was made safe for multi-step transactional composition.
- Missing foreign key constraints on `shift_cash_transactions` (`fk_sct_account_id`, `fk_sct_gl_voucher_id`) were harmonized across tenant database `smriti002`.

---

## 8. Tests Executed
1. `python -m pytest backend/tests/test_canonical_sales_writer.py -v`:
   - 5/5 passed in 4.98s.
2. `python -m pytest backend/tests/t_pos_sct_fk.py -v`:
   - 4/4 passed in 2.32s.
3. `python -m pytest backend/tests/t_payments.py -v`:
   - 6/6 passed in 12.69s.
4. `python -m pytest backend/tests/t_univ_item.py -v`:
   - 10/10 passed in 10.00s.
5. `npx tsc --noEmit`:
   - 0 errors, 0 warnings.
6. `python scripts/architecture_duplication_gate.py`:
   - CI Gate Passed (0 P0/P1 violations).

---

## 9. Verification Results
```text
============================= test session starts =============================
backend/tests/test_canonical_sales_writer.py::test_01_retail_pos_mrp_inclusive_posting PASSED [ 20%]
backend/tests/test_canonical_sales_writer.py::test_02_b2b_wholesale_base_rate_exclusive_with_discount PASSED [ 40%]
backend/tests/test_canonical_sales_writer.py::test_03_idempotency_replay_protection PASSED [ 60%]
backend/tests/test_canonical_sales_writer.py::test_04_credit_limit_enforcement_and_supervisor_override PASSED [ 80%]
backend/tests/test_canonical_sales_writer.py::test_05_caller_controlled_session_rollback PASSED [100%]
============================== 5 passed in 4.98s ==============================

backend/tests/t_pos_sct_fk.py::test_pos_sct_fk_constraints_and_zero_orphans PASSED [ 25%]
backend/tests/t_pos_sct_fk.py::test_v1360_forward_only_migration_governance PASSED [ 50%]
backend/tests/t_pos_sct_fk.py::test_pos_sct_fk_rejection_on_invalid_account_id PASSED [ 75%]
backend/tests/t_pos_sct_fk.py::test_pos_sct_fk_rejection_on_invalid_gl_voucher_id PASSED [100%]
============================== 4 passed in 2.32s ==============================

backend/tests/t_payments.py::test_multi_tender_split_payment_processing PASSED [ 16%]
backend/tests/t_payments.py::test_idempotency_key_duplicate_prevention PASSED [ 33%]
backend/tests/t_payments.py::test_full_and_partial_refund_with_balance_guard PASSED [ 50%]
backend/tests/t_payments.py::test_payment_allocation_across_invoices PASSED [ 66%]
backend/tests/t_payments.py::test_payment_receipt_generation PASSED      [ 83%]
backend/tests/t_payments.py::test_api_payments_endpoints PASSED          [100%]
======================= 6 passed, 10 warnings in 12.69s =======================
```

---

## 10. Known Limitations
- **POS Bill-Level Discount Allocation**: Marked as `NEEDS_APPROVAL` in architecture blueprints. Currently, line-level discount percentage is allocated proportionally before GST.
- **Wholesale Matrix Cart Entry**: Wholesale sizing matrix entry (`Alt+3`) in `BillingWorkspace.tsx` is being unified in subsequent frontend convergence steps.

---

## 11. Future Work
- Step 13–14: Complete frontend convergence in `src/components/billing/BillingWorkspace.tsx`, routing launchpad tiles (`pos`, `sales`, `create-tax-invoice`) to the unified workspace.
- Step 15: Apply the 8-Point Safe Retirement Standard to decommission obsolete legacy duplicate files.

---

## 12. Related ADRs
- `ADR-POS-002`: Forward-Only Accounting & Foreign Key Governance.
- `ADR-FIN-001`: Phase 2B Canonical Financial Policy & Tax Determination.
- `ADR-WMS-004`: Atomic Batch Mutation & FEFO Movement Cardinality.

---

## 13. Related RFCs
- `RFC-2026-09-08-01`: SMRITI Enterprise Billing Workspace Consolidation.
- `RFC-2026-09-08-02`: Canonical Sales Transaction Authority Contract.
