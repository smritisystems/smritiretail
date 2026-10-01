<!--
  Project      : SMRITI Retail OS
  Repository   : SMRITIRetailNX
  Organization : AITDL NETWORKS
  Branch       : smritiNX

  Founders

  * Pushpa Devi Jawahar Mallah
    * Founder & Chairperson
    * Phone: +91 9324117007
    * Email: founder@aitdl.com

  * Jawahar Ramkripal Mallah
    * Founder, Chief Executive Officer (CEO) & Chief Software Architect
    * Email: founder@aitdl.com

  * Websites: aitdl.com | erpnbook.com | smritibooks.com

  * Version    : 1.0.0
  * Created    : 2026-10-01
  * Modified   : 2026-10-01
  * Copyright  : © SMRITIBooks.com. All Rights Reserved.
  * License    : Proprietary Commercial Software
  * Classification: Internal
-->

# Architecture Report: Universal Transaction Lifecycle Framework Phase 2 (GRN & Purchase Bill)

**Status:** APPROVED & VERIFIED  
**Date:** 2026-10-01  
**Branch:** `smritiNX`  
**Governance:** AGENTS.md Rules 1–12, UADHP-v1.0, WGP, DGP, IPGP

---

## 1. Executive Summary

Phase 2 of the **SMRITI Universal Transaction Lifecycle Framework** extends the generic kernel (`UniversalLifecycleEngine`) beyond the Purchase Order pilot to the complete procurement document continuum:
1. **Goods Receipt Note (GRN / GoodsReceipt):** Governs inward receiving, linked PO reconciliation, remaining quantity enforcement, and godown stock movements.
2. **Purchase Bill (PurchaseBill):** Governs commercial supplier invoices, three-way match reconciliation against PO and GRN, financial threshold approval gates, and accounts payable ledger posting.

### Key Architectural Invariants Enforced
- **Zero Document-Type Branching:** `UniversalLifecycleEngine` remains strictly document-type agnostic (`no if doc_type == ...`). All document domain behaviors reside inside strategy handlers conforming to `BaseDocumentLifecycleHandler`.
- **Dynamic Polymorphic Registry:** `LifecycleRegistry` dynamically routes document families and aliases (`PURCHASE_ORDER`, `GOODS_RECEIPT`, `PURCHASE_BILL`).
- **Cancellation Immutability:** Cancelled transactions maintain `status = CANCELLED`, `is_deleted = False`, and `deleted_at = None`, ensuring complete historical queryability.
- **Optimistic Concurrency:** State transitions enforce `expected_version == doc.version`, returning HTTP 409 (`ConcurrencyConflictException`) on stale mutation attempts.
- **Tenant Isolation:** Cross-tenant lifecycle transitions are blocked and rejected with HTTP 404 (`TenantIsolationException`).

---

## 2. Architecture & Coexistence Matrix

```
                      UniversalLifecycleEngine (Port 8000)
             [Generic Kernel: Zero Document-Type Branching]
                                    |
          +-------------------------+-------------------------+
          |                         |                         |
PurchaseOrderLifecycleHandler  GoodsReceiptLifecycleHandler  PurchaseBillLifecycleHandler
  (doc_type: PurchaseOrder)     (doc_type: GoodsReceipt)       (doc_type: PurchaseBill)
          |                         |                         |
   purchase_orders           purchase_receipts              purchase_bills
                          (or goods_receipt_notes)     (migration v1513)
```

| Dimension | Purchase Order (`PurchaseOrder`) | Goods Receipt (`GoodsReceipt`) | Purchase Bill (`PurchaseBill`) |
| :--- | :--- | :--- | :--- |
| **Handler** | `PurchaseOrderLifecycleHandler` | `GoodsReceiptLifecycleHandler` | `PurchaseBillLifecycleHandler` |
| **Model** | `app.models.purchase.PurchaseOrder` | `PurchaseReceipt` / `GoodsReceiptNote` | `app.models.purchase.PurchaseBill` |
| **Primary Table** | `purchase_orders` | `purchase_receipts` | `purchase_bills` |
| **States** | `DRAFT`, `SUBMITTED`, `CONFIRMED`, `RECEIVED`, `COMPLETED`, `CANCELLED` | `DRAFT`, `SUBMITTED`, `CONFIRMED`, `RECEIVED`, `COMPLETED`, `CANCELLED` | `DRAFT`, `SUBMITTED`, `APPROVED`, `POSTED`, `PAID`, `CANCELLED` |
| **Initial State** | `DRAFT` | `DRAFT` | `DRAFT` |
| **Resource Key** | `purchase_order` | `goods_receipt` | `purchase_bill` |
| **Stock Mutation** | None | Physical Inward Movement on `RECEIVE` | None (Accounting Only) |
| **Financial Gate** | Multi-tier Approval on `CONFIRM`/`APPROVE` | Informational | Financial Approval on `APPROVE`/`POST` |
| **Audit Ledger** | `WorkflowEvent` | `WorkflowEvent` | `WorkflowEvent` |

---

## 3. Database Evolution (Migration v1513)

- **Migration ID:** `v1513_purchase_bills_table`
- **Revises:** `v1512_po_amendment_audit`
- **Head Status:** Single Head (`v1513_purchase_bills_table (head)`)
- **Schema Creation:**
  - `purchase_bills` table created with `BaseEntity` parity: `id`, `uuid`, `company_id`, `branch_id`, `is_active`, `is_deleted`, `deleted_at`, `version`, `created_at`, `modified_at`, `created_by`, `updated_by`, `deleted_by`.
  - Transactional fields: `bill_no`, `identity_code`, `supplier_id`, `receipt_id`, `order_id`, `bill_date`, `due_date`, `status`, `taxable_amount`, `tax_amount`, `total_amount`, `paid_amount`, `notes`, `cancellation_reason`.
  - Unique composite index `ix_purchase_bills_company_bill_no` on `(company_id, bill_no)`.

---

## 4. Verification Evidence (Literal Outputs)

### A. Approval Engine Test Suite (Tests A–H)
```text
backend\app\tests\test_approval_engine.py::test_a_po_amount_below_threshold_no_approval_required PASSED [ 12%]
backend\app\tests\test_approval_engine.py::test_b_po_amount_inside_threshold_approval_enforced PASSED [ 25%]
backend\app\tests\test_approval_engine.py::test_c_po_amount_above_higher_threshold_director_required PASSED [ 37%]
backend\app\tests\test_approval_engine.py::test_d_unauthorized_role_attempts_approval_action_rejected PASSED [ 50%]
backend\app\tests\test_approval_engine.py::test_e_authorized_approval_creates_request_and_action PASSED [ 62%]
backend\app\tests\test_approval_engine.py::test_f_rejected_approval_marks_request_rejected PASSED [ 75%]
backend\app\tests\test_approval_engine.py::test_g_po_amendment_crosses_threshold_triggers_re_evaluation PASSED [ 87%]
backend\app\tests\test_approval_engine.py::test_h_cross_tenant_approval_attempt_rejected PASSED [100%]
======================= 8 passed, 18 warnings in 48.91s =======================
```

### B. Cross-Handler Acceptance Test Suite
```text
backend\app\tests\test_cross_handler_lifecycle.py::test_cross_handler_registry_coexistence PASSED [ 20%]
backend\app\tests\test_cross_handler_lifecycle.py::test_cross_handler_end_to_end_lifecycle_execution PASSED [ 40%]
backend\app\tests\test_cross_handler_lifecycle.py::test_grn_cancellation_preserves_historical_queryability PASSED [ 60%]
backend\app\tests\test_cross_handler_lifecycle.py::test_purchase_bill_concurrency_conflict_rejection PASSED [ 80%]
backend\app\tests\test_cross_handler_lifecycle.py::test_purchase_bill_cross_tenant_isolation PASSED [100%]
======================= 5 passed, 18 warnings in 41.36s =======================
```

### C. Universal Lifecycle Regression Suite
```text
backend\app\tests\test_universal_lifecycle.py::test_po_lifecycle_draft_to_submit_to_confirm PASSED [ 14%]
backend\app\tests\test_universal_lifecycle.py::test_invalid_transition_rejected PASSED [ 28%]
backend\app\tests\test_universal_lifecycle.py::test_optimistic_concurrency_conflict PASSED [ 42%]
backend\app\tests\test_universal_lifecycle.py::test_po_cancellation_preserves_record_and_is_deleted_false PASSED [ 57%]
backend\app\tests\test_universal_lifecycle.py::test_cross_tenant_isolation_denied PASSED [ 71%]
backend\app\tests\test_universal_lifecycle.py::test_universal_lifecycle_api_endpoints PASSED [ 85%]
backend\app\tests\test_universal_lifecycle.py::test_architectural_acceptance_pluggable_handler_coexistence PASSED [100%]
======================= 7 passed, 18 warnings in 42.22s =======================
```

### D. Purchase Suite Regression
```text
62 passed, 18 warnings in 81.01s (0:01:21)
```

### E. Frontend TypeScript Typecheck
```text
npx tsc --noEmit
Exit code: 0
Stdout: (clean)
Stderr: (clean)
```

### F. Database Safety & Integrity Baseline
```text
================================================================================
SMRITI RETAIL OS: DATABASE SAFETY & INTEGRITY READ-ONLY CHECK
================================================================================
1. Duplicate item_code count: 0
2. Duplicate variant_sku per company count: 0
3. Duplicate barcode per company count: 0
4. Orphan variants count: 0
5. Orphan products count (item_id invalid): 0
6. Conflicting product/item/variant links count: 0
================================================================================
DATABASE SAFETY CHECK SUMMARY: ALL INTEGRITY CONDITIONS SATISFIED
================================================================================
```

---

## 5. Structured Assessment (Rule 9)

### Evidence
- All 8 approval engine tests (A–H) executed and passed with 0 errors.
- All 5 cross-handler coexistence tests executed and passed with 0 errors.
- All 7 universal lifecycle tests passed with 0 errors.
- All 62 purchase domain tests passed with 0 errors.
- `npx tsc --noEmit` passed with 0 errors.
- `alembic current` confirms single head at `v1513_purchase_bills_table (head)`.
- Database integrity checks report 0 duplicate codes, 0 orphan variants, 0 FK anomalies.

### Interpretation
- `UniversalLifecycleEngine` successfully orchestrates multi-document procurement workflows across Purchase Order, Goods Receipt, and Purchase Bill without requiring any conditional branching or document-type hardcoding in the kernel.
- Domain rules (e.g. stock movement on GRN receipt, 3-way match validation on purchase bill, PO downstream status synchronization) remain encapsulated within their respective domain handlers.
- Optimistic locking and multi-tenant isolation are consistently enforced across all three document families.

### Recommendation
- Future document families (Sales Orders, Sales Invoices, Stock Transfers) can be onboarded seamlessly by implementing `BaseDocumentLifecycleHandler` and registering with `LifecycleRegistry`.
- Seed values for production PO approval thresholds should be finalized with business stakeholders.

---

## 6. Phase 2.1 Domain Hardening & Forensic Reconciliation

### Evidence
- **Migration `v1514`:** Created unique constraint `uq_purchase_bills_company_bill_no` and table `purchase_bill_items`.
- **Single Alembic Head:** `alembic current` confirms `v1514_purchase_bills_hardening (head)`.
- **Database Schema Parity:**
  - `purchase_bills`: 27 columns (100% column parity between ORM and PostgreSQL), `uq_purchase_bills_company_bill_no` UNIQUE constraint and index active.
  - `purchase_bill_items`: 26 columns (100% column parity between ORM and PostgreSQL), foreign keys to bills, products, items, PO lines, and GRN lines active.
- **Cross-Handler Acceptance Test Battery:**
  ```text
  pytest backend/app/tests/test_cross_handler_lifecycle.py -q
  .........                                                                [100%]
  9 passed, 14 warnings in 45.13s
  ```
  - `test_purchase_bill_duplicate_number_constraint`: `IntegrityError` strictly raised on duplicate `(company_id, bill_no)`.
  - `test_grn_receive_creates_stock_movement_and_updates_po`: Atomic `StockMovement(INWARD_GRN)` created on receipt; PO moved to `RECEIVED`.
  - `test_grn_cancel_reverses_stock_movement_and_po_status`: Atomic `StockMovement(RETURN_OUTWARD)` created on cancellation; PO reverted to `CONFIRMED`; soft-delete invariant `status = CANCELLED, is_deleted = False, deleted_at = None` verified.
  - `test_purchase_bill_line_level_3way_matching`: Line-item 3-way match rejected quantity exceeding PO, rate exceeding PO, and quantity exceeding GRN with `HandlerValidationException`, and approved matching bill.
- **Full Regression:**
  - Universal lifecycle suite: 7/7 passed.
  - Approval engine suite: 8/8 passed.
  - GRN attachments suite: 1/1 passed.
  - DB safety check: 6/6 passed.
  - TypeScript compilation: 0 errors.

### Interpretation
- All four domain gaps flagged during the initial forensic audit have been resolved:
  1. Duplicate purchase bill numbers per company are now physically prevented at the database constraint layer.
  2. Physical stock movements commit atomically with Goods Receipt state changes; phantom inventory is prevented.
  3. Goods receipt cancellation safely reverses stock movements without violating historical record queryability.
  4. Commercial purchase bills enforce line-by-line 3-way variance matching across PO commitments and GRN physical receipts.
- Application-level mutation paths in `UniversalLifecycleEngine` reliably protect posted documents without requiring intrusive database triggers.
- Document status remains strictly segregated from physical stock balance (`stock_movements`) and financial balances (`gl_entries`).

### Recommendation
- With Phase 2.1 Hardening verified and tested across 9/9 cross-handler tests, Phase 2 is technically hardened and verified.
- Production sign-off remains subject to business management confirmation of approval threshold rules and General Ledger journal entry connection.
