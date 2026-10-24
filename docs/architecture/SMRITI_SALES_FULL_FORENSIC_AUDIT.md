<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.47.4
  Created      : 2026-10-01
  Modified     : 2026-10-01
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Forensic Audit Report
-->

# SMRITI Sales S1–S7 Full Post-Implementation Forensic Audit Report

**Audit Target:** SMRITI Sales S1–S7 Implementation Baseline  
**Active Git Branch:** `smritiNX`  
**Audit Protocol:** Strictly Read-Only Forensic Inspection (Zero Code Edits, Zero DB Writes, Zero Schema Alterations)  
**Auditor Engine:** Antigravity AI Forensic Inspector  
**Baseline Date:** 2026-10-01  

---

## A. Overall Status

### **VERDICT: HOLD**

```text
================================================================================
FINAL VERDICT CLASSIFICATION: HOLD
================================================================================
Critical production defects and severe regressions prevent deployment:

1. CRITICAL PURCHASE REGRESSION:
   Uncommitted modifications in `backend/app/models/purchase.py` (line 94:
   `items = relationship("PurchaseOrderItem", backref="order", cascade="all, delete-orphan")`)
   introduced an unconfigured lazy-loaded relationship without `lazy="selectin"`.
   In asyncpg, line 461 of `backend/app/services/purchase.py` (`order.items = item_rows`)
   triggers synchronous attribute loading, crashing with `sqlalchemy.exc.MissingGreenlet`.
   Literal Result: 24 of 66 tests in `backend/app/tests/test_purchase.py` are FAILING.
   Purchase Phase 2.1 is NOT protected.

2. COMPETING PHYSICAL INVENTORY WRITERS:
   `FulfillmentEngine.dispatch_barcode_shipment` (`backend/app/services/fulfillment_engine.py:306-308`)
   and `DistributionService.process_dispatch` (`backend/app/services/distribution_svc.py:407`)
   bypass `SalesStockAuthority` and `StockSynchronizer`, directly mutating `product.stock`
   and creating uncoordinated `StockMovement` records. This creates a critical double-deduction risk.

3. SILENT FINANCIAL ERROR SUPPRESSION (SWALLOWED EXCEPTIONS):
   `SalesInvoiceLifecycleHandler.apply_transition` (`backend/app/services/lifecycle/handlers/sales_invoice.py:250, 275`)
   swallows all General Ledger posting errors with `except Exception: pass`, directly violating
   the fundamental platform rule that ledger failures must fail the business transaction.

4. UNIVERSAL LIFECYCLE BYPASS IN PRODUCTION API:
   Multiple legacy routes in `backend/app/api/v1/sales.py` (`DELETE /invoices/{id}`,
   `POST /invoices/{id}/void`, `POST /quotations/convert/{id}`) call `SalesService` methods
   that mutate `.status` directly without invoking `UniversalLifecycleEngine`.

5. 3-WAY MATCH BYPASS IN CONVERTED ORDERS:
   `SalesService.convert_sales_order_to_invoice` (`backend/app/services/sales.py:957`)
   defaults `source_document_type` to `"DIRECT"` rather than `"SALES_ORDER"`. As a result,
   `SalesInvoiceLifecycleHandler` evaluates `if doc.source_document_type == "SALES_ORDER"`
   to FALSE, silently skipping 3-way matching on converted orders.
================================================================================
```

---

## B. Phase S1: Sales Schema & Tenant Hardening

### Status: Done (with 1 benign advisory column difference in PostgreSQL)

#### Evidence:
- **Alembic Lineage:** Single head verified at `v1515_sales_schema_tenant_hardening` revising `v1514_purchase_bills_hardening`. Both live databases (`smriti001` and `smritisys` on port `2781`) stamped at `v1515`.
- **Constraint Parity:**
  - Global unique constraints dropped: `sales_orders_order_no_key`, `sales_returns_return_no_key`, `sales_invoices_invoice_no_key`, `packing_slips_packing_slip_number_key`, `dispatches_dispatch_number_key`.
  - Compound tenant constraints enforced: `uq_sales_orders_company_order_no`, `uq_sales_returns_company_return_no`, `uq_sales_invoices_company_invoice_no`, `uq_packing_slips_company_num`, `uq_dispatches_company_num`.
- **Item Elevation to `BaseEntity`:**
  - `sales_order_items`, `sales_invoice_items`, `sales_return_items`, `sales_quotation_items` upgraded with `uuid`, `company_id`, `branch_id`, `version`, `is_deleted`, `created_at`, `modified_at`.
- **Data Parity:**
  - `smriti001`: `sales_order_items` (18,050 rows): 0 null uuid, 0 duplicate uuid, 0 null company_id, 0 parent mismatch.
  - `smriti001`: `sales_invoice_items` (16,743 rows): 0 null uuid, 0 duplicate uuid, 0 null company_id, 0 parent mismatch.
- **ORM vs PostgreSQL Column Count Diff:**
  - 11 of 12 tables have 100% exact column count and name AST parity.
  - `sales_invoices` has 83 ORM columns and 84 PostgreSQL columns. The extra column in PostgreSQL is `is_reverse_charge` (boolean), which is a historical synonym for `reverse_charge`.

#### Interpretation:
Phase S1 is structurally and historically complete. Multi-tenant document numbering isolation is achieved in the database schema.

#### Recommendation:
Add `is_reverse_charge = Column(Boolean, default=False)` as a formal ORM column or keep `synonym("reverse_charge")` aligned to eliminate the 1-column AST difference.

---

## C. Phase S2: Sales Stock Authority

### Status: Partially Verified (Defect Identified)

#### Evidence:
`backend/app/services/sales_stock_authority.py` implements `SalesStockAuthority`:
- `record_outward_sale`: Deducts batch stock, creates `OUTWARD_SALE` `StockMovement`, synchronizes `Product.stock` materialized cache via `StockSynchronizer.sync_product_stock_cache`.
- `record_return_inward`: Restores batch stock, creates `RETURN_INWARD` `StockMovement`.
- `record_sales_cancellation_reversal`: Creates compensating `SALES_INVOICE_CANCEL` `StockMovement`.
- `record_dispatch_outward`: Checks `if invoice_already_deducted: skip duplicate deduction`.

#### Defect:
Competing writers still exist in production code:
1. `FulfillmentEngine.dispatch_barcode_shipment` (`backend/app/services/fulfillment_engine.py:306-308`):
   ```python
   product.stock = product.stock - quantity
   session.add(StockMovement(movement_type="OUTWARD_DISPATCH", ...))
   ```
2. `DistributionService.process_dispatch` (`backend/app/services/distribution_svc.py:407`):
   ```python
   session.add(StockMovement(movement_type="OUTWARD_SALE", ...))
   ```
Neither writer calls `SalesStockAuthority` or `StockSynchronizer`.

#### Interpretation:
While `SalesStockAuthority` is internally correct and tested (6/6 passing in `test_sales_stock_authority.py`), it is not yet the sole authorizer in the broader codebase due to surviving legacy writers.

#### Recommendation:
Deprecate and route `FulfillmentEngine.dispatch_barcode_shipment` and `DistributionService.process_dispatch` through `SalesStockAuthority`.

---

## D. Phase S3: Universal Sales Lifecycle

### Status: Partially Verified (Defect Identified)

#### Evidence:
Five domain handlers were implemented under `backend/app/services/lifecycle/handlers/`:
1. `sales_order.py` (`SalesOrderLifecycleHandler`)
2. `sales_invoice.py` (`SalesInvoiceLifecycleHandler`)
3. `sales_return.py` (`SalesReturnLifecycleHandler`)
4. `sales_quotation.py` (`SalesQuotationLifecycleHandler`)
5. `fulfillment.py` (`FulfillmentLifecycleHandler`)

Registered in `LifecycleRegistry`. Zero document-type branching in `UniversalLifecycleEngine`. Tested via `test_universal_sales_lifecycle.py` (10/10 passed).

#### Defect:
Direct `.status =` mutations persist across 38 locations in `backend/app/services/`:
- `backend/app/services/sales.py:426`: `order.status = "Confirmed"` in `reserve_sales_order`.
- `backend/app/services/sales.py:1000`: `so.status = "Completed"` in `convert_sales_order_to_invoice`.
- `backend/app/services/sales.py:1003`: `so.status = "In Progress"` in `convert_sales_order_to_invoice`.
- `backend/app/services/sales.py:1739`: `invoice.status = "Cancelled"` in `cancel_sales_invoice`.
- `backend/app/services/sales.py:2051`: `invoice.status = "Confirmed"` in `approve_sales_invoice`.
- `backend/app/services/sales.py:2134`: `quotation.status = "Converted"` in `convert_quotation_to_invoice`.
- `backend/app/services/sales_ledger_svc.py:312`: `invoice.status = "Cancelled"`.
- `backend/app/services/fulfillment_engine.py:346`: `ps.status = "DISPATCHED"`.

#### Interpretation:
New code uses the Universal Lifecycle Engine, but legacy REST routes continue mutating database status directly, bypassing optimistic concurrency, transition rules, and audit logs.

#### Recommendation:
Refactor legacy methods in `SalesService` to delegate to `UniversalLifecycleEngine.execute_transition(...)`.

---

## E. Phase S4: Sales Regression

### Status: Done

#### Evidence:
Running the modernized test suite against the live database:
```bash
pytest backend/app/tests/test_sales.py \
       backend/app/tests/test_sales_return_contracts.py \
       backend/app/tests/test_sales_stock_authority.py \
       backend/app/tests/test_universal_sales_lifecycle.py \
       backend/app/tests/test_cross_handler_lifecycle.py -v
```
**Literal Terminal Output:**
```text
================= 93 passed, 14 warnings in 123.39s (0:02:03) =================
```
- `test_sales.py`: 28 passed
- `test_sales_return_contracts.py`: 32 passed
- `test_sales_stock_authority.py`: 6 passed
- `test_universal_sales_lifecycle.py`: 10 passed
- `test_cross_handler_lifecycle.py`: 9 passed

#### Interpretation:
All 13 legacy test failures previously reported have been eliminated. Client-supplied IDs were removed from tests, assertion queries were shifted from `Product.stock` to `stock_movements`, and the quotation conversion bug was resolved.

---

## F. Phase S5: Sales 3-Way Matching

### Status: Partially Verified (Defect Identified)

#### Evidence:
Validation logic resides in `SalesInvoiceLifecycleHandler.validate_transition` (`backend/app/services/lifecycle/handlers/sales_invoice.py:159-184`):
```python
if doc.source_document_type == "SALES_ORDER" and doc.source_document_id:
    # 1. Quantity Check
    if Decimal(str(inv_it.quantity)) > Decimal(str(matched_so_item.quantity)):
        raise HandlerValidationException(...)
    # 2. Rate Check
    if Decimal(str(inv_it.price)) > Decimal(str(matched_so_item.price)):
        raise HandlerValidationException(...)
```

#### Defects:
1. **Source Type Disconnect:** In `SalesService.convert_sales_order_to_invoice` (`backend/app/services/sales.py:957`), `db_inv` is instantiated without explicitly passing `source_document_type="SALES_ORDER"` or `source_document_id=so.id`. The model defaults `source_document_type="DIRECT"`, causing the handler's 3-way check to evaluate to `False` and be completely bypassed on converted invoices.
2. **Missing Cumulative Check:** The check compares `inv_it.quantity > matched_so_item.quantity` rather than checking remaining unbilled quantity (`matched_so_item.quantity - matched_so_item.billed_quantity`). Two partial invoices billing 6 units each against an order of 10 units will both pass individually.
3. **No Delivery Note Validation:** Delivered quantity is not checked because no pre-invoice delivery note model exists in Model A.

#### Interpretation:
3-way match validation exists in the handler, but is partially specified and bypassed in production order conversion.

#### Recommendation:
1. Explicitly populate `source_document_type="SALES_ORDER"` and `source_document_id=so.id` in `convert_sales_order_to_invoice`.
2. Check cumulative invoiced quantity against original ordered quantity.

---

## G. Phase S6: Sales GL Integration

### Status: Failed / Unverified in Production

#### Evidence:
`UnifiedAccountingLedgerService.post_sales_invoice_to_gl` (`backend/app/services/unified_ledger.py:440-580`) implements double-entry accounting:
- Debit: Accounts Receivable (1030) or Cash (1010) = Grand Total
- Credit: Sales Revenue (4010) = Taxable Subtotal
- Credit: Output CGST (2021) = CGST Total
- Credit: Output SGST (2022) = SGST Total
- Credit: Output IGST (2023) = IGST Total
- Debit/Credit: Roundoff (5030) = Roundoff difference
- Checked for idempotency via `reference_doc_type == "SALES_INVOICE"`.

#### Critical Defect: Swallowed Exceptions
In `backend/app/services/lifecycle/handlers/sales_invoice.py:243-252`:
```python
# 2. Financial GL Posting via UnifiedAccountingLedgerService
try:
    await UnifiedAccountingLedgerService.post_sales_invoice_to_gl(...)
except Exception:
    # If GL is not configured or in test environments without COA, do not crash invoice posting
    pass
```
And on cancellation (`lines 266-276`):
```python
try:
    await UnifiedAccountingLedgerService.post_sales_cancellation_to_gl(...)
except Exception:
    pass
```
And in `sales_return.py:224`:
```python
except Exception as e:
    logger.warning("Could not post sales return %s to GL: %s", doc.id, e, exc_info=True)
```

#### Interpretation:
Any database error, missing COA, or balancing exception during GL voucher creation is silently discarded with `pass`. The invoice transition succeeds while zero financial ledger entries are created. This directly violates financial ledger integrity and Section 6 of the Audit Protocol.

#### Recommendation:
Remove `except Exception: pass`. If GL posting is mandatory for posted invoices, let exceptions bubble up and abort the transaction. If GL posting is deferred, formalize it in configuration rather than swallowing errors.

---

## H. Phase S7: Tenant Isolation & Concurrency

### Status: Done

#### Evidence:
- **Optimistic Concurrency:** All sales tables implement `version = Column(Integer, nullable=False, default=1, server_default="1")`. Tested in `test_universal_sales_lifecycle.py::test_sales_order_concurrency_conflict` (returns HTTP 409 `ConcurrencyConflictException`).
- **Tenant Scoping:** `get_document` filters by `company_id`. Tested in `test_universal_sales_lifecycle.py::test_sales_tenant_isolation_rejection` (cross-tenant access raises HTTP 404).
- **Zero Cross-Tenant Leaks:** Audited 34,793 live item rows in `smriti001`. 100% belong to the same `company_id` as their parent document.

---

## I. Database Integrity

### Live Database Audited Counts:

| Metric | `smriti001` (Primary Production) | `smritisys` (System Database) |
| :--- | :---: | :---: |
| Alembic Version | `v1515_sales_schema_tenant_hardening` | `v1515_sales_schema_tenant_hardening` |
| `sales_orders` rows | 74 | 0 |
| `sales_orders` duplicates | 0 | 0 |
| `sales_orders` null `company_id` | 0 | 0 |
| `sales_order_items` rows | 18,050 | 0 |
| `sales_order_items` null UUID | 0 | 0 |
| `sales_order_items` duplicate UUID | 0 | 0 |
| `sales_order_items` orphan rows | 0 | 0 |
| `sales_invoices` rows | 2,776 | 180 |
| `sales_invoices` within-company duplicates | 0 | 0 |
| `sales_invoices` cross-company duplicates | 0 | 0 |
| `sales_invoices` null `company_id` | 43 (historical legacy) | 0 |
| `sales_invoice_items` rows | 16,743 | 180 |
| `sales_invoice_items` null UUID | 0 | 0 |
| `sales_invoice_items` duplicate UUID | 0 | 0 |
| `sales_invoice_items` orphan rows | 0 | 0 |
| `sales_returns` rows | 10 | 0 |
| `sales_return_items` rows | 10 | 0 |
| `packing_slips` rows | 68 | 0 |
| `dispatches` rows | 53 | 0 |

---

## J. Tenant Integrity

1. **Foreign Key Integrity:** All items reference valid parent IDs (`order_id`, `invoice_id`, `return_id`, `packing_slip_id`, `dispatch_id`).
2. **Compound Unique Scoping:** Unique constraints on all sales documents now include `company_id`. Cross-tenant document number collisions are impossible at the database engine level.
3. **43 Legacy Rows:** In `smriti001`, 43 sales invoices created prior to multi-tenant enforcement retain `company_id = NULL`. They are historical and unmodified.

---

## K. Stock Ledger Integrity

### Inventory of All Production Stock Writers:

| # | File | Class | Method | Event | Stock Effect | Competing? |
| :---: | :--- | :--- | :--- | :--- | :--- | :---: |
| 1 | `backend/app/services/sales_stock_authority.py` | `SalesStockAuthority` | `record_outward_sale` | Invoice Posted | `OUTWARD_SALE` (Batch & Sync) | **Authoritative** |
| 2 | `backend/app/services/sales_stock_authority.py` | `SalesStockAuthority` | `record_return_inward` | Return Processed | `RETURN_INWARD` (Batch & Sync) | **Authoritative** |
| 3 | `backend/app/services/sales_stock_authority.py` | `SalesStockAuthority` | `record_sales_cancellation_reversal` | Invoice Cancelled | `SALES_INVOICE_CANCEL` (Compensating) | **Authoritative** |
| 4 | `backend/app/services/sales_stock_authority.py` | `SalesStockAuthority` | `record_dispatch_outward` | Dispatch Created | `OUTWARD_DISPATCH` (Safe check) | **Authoritative** |
| 5 | `backend/app/services/canonical_sales_writer.py` | `CanonicalSalesPostingWriter` | `post_sales_transaction` | POS/Direct Sale | `OUTWARD_SALE` | Co-exists (POS) |
| 6 | `backend/app/services/fulfillment_engine.py` | `FulfillmentEngine` | `dispatch_barcode_shipment` | Barcode Dispatch | `product.stock -= qty` (Direct) | **COMPETING / HAZARD** |
| 7 | `backend/app/services/distribution_svc.py` | `DistributionService` | `process_dispatch` | Distribution Dispatch | `OUTWARD_SALE` (Direct SM) | **COMPETING / HAZARD** |

---

## L. Financial Ledger Integrity

### Key Finding: Financial Ledger Error Suppression
- **`UnifiedAccountingLedgerService` Logic:** Sound double-entry math (balanced debit and credit, roundoff accounts, party tagging).
- **Handler Defect:**
  - `sales_invoice.py` lines 250-252:
    ```python
    except Exception:
        pass
    ```
  - `sales_invoice.py` lines 275-276:
    ```python
    except Exception:
        pass
    ```
  - `sales_return.py` line 224:
    ```python
    except Exception as e:
        logger.warning(...)
    ```
- **Audited Financial Rows:** Zero GL vouchers are emitted when sales transactions occur through standard API endpoints unless the lifecycle transition explicitly succeeds without triggering the swallowed exception block.

---

## M. Lifecycle Integrity

### Status Mutation Classification:

| File & Line | Code Snippet | Classification | Action Required |
| :--- | :--- | :---: | :--- |
| `sales_invoice.py:211` | `doc.status = next_state` | **VALID** | Lifecycle Handler Managed |
| `sales_order.py:196` | `doc.status = next_state` | **VALID** | Lifecycle Handler Managed |
| `sales_quotation.py:185` | `doc.status = next_state` | **VALID** | Lifecycle Handler Managed |
| `sales_return.py:185` | `doc.status = next_state` | **VALID** | Lifecycle Handler Managed |
| `fulfillment.py:145, 257` | `doc.status = next_state` | **VALID** | Lifecycle Handler Managed |
| `sales_order.py:212` | `r.status = "RELEASED"` | **VALID** | Compensating Reservation Release |
| `sales.py:426` | `order.status = "Confirmed"` | **BYPASS** | Must use `UniversalLifecycleEngine` |
| `sales.py:1000` | `so.status = "Completed"` | **BYPASS** | Must use `UniversalLifecycleEngine` |
| `sales.py:1003` | `so.status = "In Progress"` | **BYPASS** | Must use `UniversalLifecycleEngine` |
| `sales.py:1739` | `invoice.status = "Cancelled"` | **BYPASS** | Must use `UniversalLifecycleEngine` |
| `sales.py:2051` | `invoice.status = "Confirmed"` | **BYPASS** | Must use `UniversalLifecycleEngine` |
| `sales.py:2134` | `quotation.status = "Converted"` | **BYPASS** | Must use `UniversalLifecycleEngine` |
| `sales_ledger_svc.py:312` | `invoice.status = "Cancelled"` | **LEGACY** | Deprecated service |
| `fulfillment_engine.py:346` | `ps.status = "DISPATCHED"` | **BYPASS** | Must use `FulfillmentLifecycleHandler` |
| `fulfillment_engine.py:389` | `dsp.status = target_status` | **BYPASS** | Must use `FulfillmentLifecycleHandler` |

---

## N. Approval / RBAC Integrity

- Evaluated via `ApprovalEngine.check_transaction_enforcement`.
- Policies are stored dynamically in the `approval_policies` table, queried by `company_id`, `document_type`, and transaction amount.
- **Engine Capability vs Production Policy:**
  - The engine correctly resolves policies dynamically.
  - No arbitrary hardcoded production monetary thresholds were invented in code.
  - Role hierarchy: `CASHIER (1) < SALES_EXECUTIVE (2) < STORE_MANAGER/MANAGER (3) < FINANCE_CONTROLLER (4) < DIRECTOR (5) < SYSADMIN (10)`.

---

## O. Historical Data Integrity

- Zero historical document numbers altered.
- Zero historical invoice totals modified.
- Zero historical records deleted.
- 43 pre-tenant invoices in `smriti001` preserved with untouched NULL `company_id`.
- Total historical rows preserved: 2,776 invoices, 16,743 invoice items, 74 orders, 18,050 order items.

---

## P. Purchase Regression (CRITICAL FINDING)

### **CRITICAL DEFECT IDENTIFIED: 24 FAILED TESTS IN `test_purchase.py`**

#### Evidence:
Running the purchase suite:
```bash
pytest backend/app/tests/test_purchase.py backend/app/tests/test_grn.py -v
```
**Literal Terminal Output:**
```text
=========================== short test summary info ===========================
FAILED backend\app\tests\test_purchase.py::test_create_purchase_order - asser...
FAILED backend\app\tests\test_purchase.py::test_grn_links_to_po - AssertionEr...
FAILED backend\app\tests\test_purchase.py::test_grn_tracks_multiple_po_allocations_by_line
FAILED backend\app\tests\test_purchase.py::test_amend_purchase_order - fastap...
FAILED backend\app\tests\test_purchase.py::test_workflow_submit_purchase_order
FAILED backend\app\tests\test_purchase.py::test_phaseA_01_create_po_saves_as_draft
FAILED backend\app\tests\test_purchase.py::test_phaseA_02_draft_can_be_retrieved
FAILED backend\app\tests\test_purchase.py::test_phaseA_03_draft_remains_draft_on_resave
FAILED backend\app\tests\test_purchase.py::test_phaseA_04_draft_does_not_create_stock_movement
FAILED backend\app\tests\test_purchase.py::test_phaseA_05_draft_stock_unchanged
FAILED backend\app\tests\test_purchase.py::test_phaseA_06_draft_to_submitted
FAILED backend\app\tests\test_purchase.py::test_phaseA_07_submitted_by_populated
FAILED backend\app\tests\test_purchase.py::test_phaseA_08_submitted_at_populated
FAILED backend\app\tests\test_purchase.py::test_phaseA_15_full_lifecycle_draft_submit_confirm
FAILED backend\app\tests\test_purchase.py::test_phaseA_19_draft_no_accounting_entry
FAILED backend\app\tests\test_purchase.py::test_phaseB_21_status_filter_draft
FAILED backend\app\tests\test_purchase.py::test_phaseB_22_status_filter_submitted
FAILED backend\app\tests\test_purchase.py::test_phaseB_23_no_status_filter_returns_all
FAILED backend\app\tests\test_purchase.py::test_phaseB_24_status_filter_confirmed_excludes_draft
FAILED backend\app\tests\test_purchase.py::test_phaseB_25_multi_status_filter
FAILED backend\app\tests\test_purchase.py::test_phaseD_29_amend_confirmed_po_creates_new_revision
FAILED backend\app\tests\test_purchase.py::test_phaseD_30_amendment_sets_parent_order_id_and_revision
FAILED backend\app\tests\test_purchase.py::test_phaseD_32_amendment_history_returns_chain
FAILED backend\app\tests\test_purchase.py::test_phaseD_33_original_notes_marked_superseded
============ 24 failed, 42 passed, 14 warnings in 87.82s (0:01:27) ============
```

#### Exact Root Cause Analysis:
In `backend/app/models/purchase.py` line 94, an uncommitted change added:
```python
class PurchaseOrder(BaseEntity):
    ...
    items = relationship("PurchaseOrderItem", backref="order", cascade="all, delete-orphan")
```
In `backend/app/services/purchase.py` line 461 (`create_purchase_order`):
```python
order.items = item_rows          # attach items for response serialisation
```
Prior to the modification of `backend/app/models/purchase.py`, `order.items` was a transient non-relationship Python attribute attached to the instance for response serialization.
Adding `relationship("PurchaseOrderItem")` without `lazy="selectin"` turned `order.items` into a SQLAlchemy managed relationship attribute. When line 461 executes, SQLAlchemy attempts to synchronously lazy-load the collection. In `asyncpg`, this triggers:
```text
sqlalchemy.exc.MissingGreenlet: greenlet_spawn has not been called; can't call await_only() here. Was IO attempted in an unexpected place?
```
This single uncommitted change breaks PO creation, PO amendments, and 24 PO lifecycle tests.

#### Interpretation:
The claim that "Purchase Phase 2.1 remains protected" is disproven by terminal evidence. A major regression exists in the working tree.

---

## Q. API / UI Contract Integrity

- `src/components/ReportDesignerTab.tsx:727` calls `/api/v1/sales/orders/{id}/convert-to-invoice`.
- `src/components/ProcessSalesReturn.tsx:104` calls `/api/v1/sales/returns/`.
- `src/components/PrepareDispatchDlg.tsx:65` calls `/api/v1/sales/eway-bills/`.
- Frontend expects lifecycle actions and document numbers to remain backward-compatible.
- Because `convert_sales_order_to_invoice` defaults `source_document_type="DIRECT"`, the UI conversion flow succeeds but silently bypasses 3-way matching.

---

## R. Migration Integrity

- **Alembic Version:** `v1515_sales_schema_tenant_hardening`
- **Lineage:** Clean, single linear head:
  `v1514_purchase_bills_hardening -> v1515_sales_schema_tenant_hardening`
- **Downgrade Method:** Implemented cleanly. Recreates dropped unique constraints and drops added columns.
- **Safety:** Zero destructive operations on historical data. Null backfill ran before applying `NOT NULL` constraints.

---

## S. Architecture Duplication

1. **Dual Stock Movement Engines:**
   - Canonical: `SalesStockAuthority`
   - Competing: `FulfillmentEngine.dispatch_barcode_shipment` & `DistributionService.process_dispatch`
2. **Dual Status Mutators:**
   - Canonical: `UniversalLifecycleEngine`
   - Competing: Legacy methods in `SalesService` (`cancel_sales_invoice`, `approve_sales_invoice`, `convert_quotation_to_invoice`)

---

## T. Security Findings

- Tenant isolation is strictly enforced at database and repository levels.
- Direct cross-company requests return HTTP 404.
- Concurrency conflicts return HTTP 409.
- RBAC permissions (`sales_billing:NEW`, `sales_billing:EDIT`, `sales_billing:VOID`) are checked at the router level.
- Universal Lifecycle transitions check fine-grained action permissions via `evaluate_action_permission`.

---

## U. Business Governance Findings

Comparison against `SMRITI_SALES_BUSINESS_FLOW_DECISION_PACK.md`:

| Decision Item | Decision Status | Implementation Status | Finding / Violation |
| :--- | :---: | :---: | :--- |
| **Decision 1:** Wholesale Delivery Model | UNRESOLVED | PENDING | Premature partial 3-way matching was introduced in S5 without an approved Model B Delivery Note schema. |
| **Decision 2:** Retail/POS Flow Independence | APPROVED | IMPLEMENTED | Direct billing without delivery documents is supported. |
| **Decision 3:** Scope of 3-Way Matching | UNRESOLVED | PARTIAL / BYPASSED | Implemented in handler, but bypassed during order conversion due to `"DIRECT"` document type default. |
| **Decision 4:** Approval Policy Matrices | APPROVED (Engine) / PENDING (Policy) | IMPLEMENTED | Engine capability is dynamic; no arbitrary hardcoded thresholds were seeded into production tables. |
| **Decision 5:** Cancellation & Amendment Policy | APPROVED | IMPLEMENTED | Reservations release automatically upon cancellation with reason audit. |
| **Decision 6:** Financial GL Posting | DEFERRED (NON-GO 3) | PREMATURELY ATTEMPTED | Violated Decision Pack NON-GO 3 by coding GL integration in S6, which then had to be wrapped in `except: pass`. |

---

## V. Test Results

### 1. Sales Suites (Reported 93/93 Passed):
```bash
pytest backend/app/tests/test_sales.py \
       backend/app/tests/test_sales_return_contracts.py \
       backend/app/tests/test_sales_stock_authority.py \
       backend/app/tests/test_universal_sales_lifecycle.py \
       backend/app/tests/test_cross_handler_lifecycle.py -v
```
**Output:** `93 passed, 14 warnings in 123.39s (0:02:03)` (100% Passed)

### 2. Purchase Regression Suite:
```bash
pytest backend/app/tests/test_purchase.py backend/app/tests/test_grn.py -v
```
**Output:** `24 failed, 42 passed, 14 warnings in 87.82s (0:01:27)` (36% Failed)

---

## W. Known Technical Debt

1. 43 legacy invoices in `smriti001` with `company_id = NULL`.
2. 38 direct status assignment lines across `backend/app/services/`.
3. Competing stock deduction logic in `FulfillmentEngine` and `DistributionService`.
4. Advisory column difference `is_reverse_charge` between ORM and PostgreSQL on `sales_invoices`.

---

## X. Production Blockers

1. **Purchase Regression:** 24 broken tests in `test_purchase.py` caused by `MissingGreenlet` on `PurchaseOrder.items`.
2. **Silent GL Error Suppression:** Swallowing exceptions in `SalesInvoiceLifecycleHandler` with `except Exception: pass`.
3. **Double-Deduction Hazard:** `FulfillmentEngine.dispatch_barcode_shipment` directly deducting physical stock outside `SalesStockAuthority`.

---

## Y. Required Fixes (For Subsequent Implementation Phase)

1. **Fix Purchase Regression in `backend/app/models/purchase.py`:**
   Change line 94:
   ```python
   # Either configure selectin loading:
   items = relationship("PurchaseOrderItem", backref="order", cascade="all, delete-orphan", lazy="selectin")
   # OR remove the relationship if purchase.py expects items to be a dynamic response attribute.
   ```
2. **Fix Swallowed GL Exceptions in `sales_invoice.py`:**
   Remove `try ... except Exception: pass` around `UnifiedAccountingLedgerService` calls. Let errors fail the transaction, or provide an explicit transactional compensation policy.
3. **Eliminate Competing Stock Writers in `fulfillment_engine.py`:**
   Replace direct `product.stock -= quantity` in `FulfillmentEngine.dispatch_barcode_shipment` with a call to `SalesStockAuthority.record_dispatch_outward`.
4. **Fix 3-Way Match Linkage in `sales.py`:**
   In `SalesService.convert_sales_order_to_invoice`, set `source_document_type="SALES_ORDER"` and `source_document_id=so.id`.
5. **Route Legacy Status Endpoints Through `UniversalLifecycleEngine`:**
   Refactor `cancel_sales_invoice` and `approve_sales_invoice` in `SalesService` to call `UniversalLifecycleEngine.execute_transition`.

---

## Z. Commit / Release Recommendation

### **DO NOT COMMIT. DO NOT PUSH. DO NOT RELEASE.**

The codebase must remain on **HOLD** until:
1. The `MissingGreenlet` regression in `backend/app/models/purchase.py` is resolved and `pytest backend/app/tests/test_purchase.py` passes 66/66 green.
2. The swallowed GL exceptions in `SalesInvoiceLifecycleHandler` are properly handled.
3. The competing stock writers are converged into `SalesStockAuthority`.

**AUDIT COMPLETE. STOPPING ALL ACTIONS.**
