<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.48.2
  Created      : 2026-10-01
  Modified     : 2026-10-01
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Architecture & Business Decision Pack
-->

# SMRITI Sales Architecture & Business Flow Decision Pack

**Document ID:** SMRITI-ARCH-SALES-DECISION-PACK-v1.0  
**Status:** FROZEN DECISION SPECIFICATION (Phase 0.1 Read-Only)  
**Effective Date:** 2026-10-01  
**Purchase Baseline:** Phase 2.1 (25/25 Tests Passing) — **FROZEN & ISOLATED**  

---

## 1. Executive Summary

A comprehensive forensic audit of the SMRITI Retail OS codebase confirmed that while the **Procurement / Purchase Lifecycle** is fully governed by the `UniversalLifecycleEngine` (25/25 tests passing, 100% schema and constraint parity, atomic stock movements), the **Sales Lifecycle** is in a fundamentally disparate state:

1. **100% Lifecycle Bypass:** Sales Orders, Sales Invoices, Sales Returns, and Fulfillment manifests bypass the `UniversalLifecycleEngine` entirely, mutating status and stock via ad-hoc direct database assignments.
2. **Dual Stock Writer Collision:** Physical inventory is at risk of being deducted twice: once on Sales Invoice posting via `CanonicalSalesPostingWriter` (`OUTWARD_SALE`), and a second time on Dispatch via `FulfillmentEngine` (`OUTWARD_DISPATCH`).
3. **Multi-Tenant Constraint Hazards:** `sales_orders.order_no` and `sales_returns.return_no` carry PostgreSQL `UNIQUE` constraints that are global rather than compound `(company_id, document_no)`, creating cross-tenant document numbering collisions.
4. **General Ledger (GL) Disconnect:** No Sales transaction currently emits balanced double-entry rows to `general_ledger_entries`.
5. **The Fundamental Architectural Crossroads:** SMRITI currently implements a **Post-Invoice Fulfillment** model ($\text{Order} \to \text{Invoice} \to \text{Dispatch}$). Attempting to enforce a classic pre-invoice 3-way match ($\text{Order} \ge \text{Delivered} \ge \text{Invoiced}$) without a formal business flow decision would break Retail/POS operations and implement the wrong business logic.

This document serves as the **decision-ready blueprint** for management before any remediation code or migration is written.

---

## 2. Current Sales Architecture

```text
CURRENT IMPLEMENTATION FLOW:

[Sales Order] (Draft)
      │
      ▼ (reserve_sales_order)
[Sales Order] (Confirmed / Reserved)
      │
      ▼ (convert_sales_order_to_invoice)
[Draft Sales Invoice] + [SalesOrderInvoiceAllocation]
      │
      ▼ (CanonicalSalesPostingWriter.post_sales_transaction)
[Posted / Paid Sales Invoice] 
      ├──> Stock Movement: OUTWARD_SALE (Deducts Batch Inventory)
      ├──> CRM Customer Credit Ledger Entry (if Credit tender)
      └──> (Zero General Ledger Posting)
      │
      ▼ (FulfillmentEngine.create_packing_slip)
[Packing Slip] (Packed) [Tied to sales_invoice_id]
      │
      ▼ (FulfillmentEngine.create_dispatch)
[Dispatch Manifest] (Dispatched)
      └──> IF source_order_id passed: DUPLICATE Stock Movement OUTWARD_DISPATCH!
```

---

## 3. Comparative Fulfillment Models: Model A vs Model B

| Dimension | Model A: Post-Invoice Fulfillment (Current Architecture) | Model B: Pre-Invoice Goods Issue (Classic 3-Way Match) |
| :--- | :--- | :--- |
| **Document Sequence** | $\text{Sales Order} \to \text{Sales Invoice} \to \text{Stock OUT} \to \text{Packing} \to \text{Dispatch}$ | $\text{Sales Order} \to \text{Delivery Note} \to \text{Stock OUT} \to \text{Sales Invoice} \to \text{Dispatch}$ |
| **Sales Order Lifecycle** | `DRAFT` $\to$ `CONFIRMED` $\to$ `BILLED` (`Completed` / `In Progress`) | `DRAFT` $\to$ `SUBMITTED` $\to$ `APPROVED` $\to$ `CONFIRMED` $\to$ `DISPATCHED` $\to$ `COMPLETED` |
| **Reservation Point** | On order confirmation via `sales_order_reservations` by barcode. | On order confirmation/picking via batch allocation. |
| **Stock Reservation** | Soft-lock in `sales_order_reservations` and `product.reserved_stock`. | Hard-lock in batch reservation ledger; release upon pick slip or cancellation. |
| **Stock Deduction Point** | At **Sales Invoice Posting** (`OUTWARD_SALE`). | At **Delivery Note / Goods Issue** (`OUTWARD_DISPATCH`). Invoicing has zero stock impact. |
| **Invoice Creation Point** | Directly from Sales Order via `SalesOrderInvoiceAllocation`. | Downstream from verified Delivery Note items. |
| **Invoice Posting Point** | Commercial billing coincides with physical stock release. | Commercial billing follows physical dispatch. |
| **Payment Point** | At invoice creation (Cash/POS) or standard credit ledger terms. | Advance against SO or net terms against Delivery/Invoice. |
| **Packing Point** | Post-invoice (`packing_slips.sales_invoice_id`). | Pre-delivery (Pick List $\to$ Packing Slip $\to$ Delivery Note). |
| **Dispatch Point** | Post-invoice logistics manifest. | Coincides with Delivery Note dock exit. |
| **Partial Delivery Handling** | Requires issuing a partial invoice first. If warehouse finds shortages, invoice must be amended/credited. | Delivery note is generated for available stock; unfulfilled quantity remains pending on SO. |
| **Partial Invoicing Handling** | Direct allocation tracking in `SalesOrderInvoiceAllocation`. | Invoice generated 1:1 with Delivery Notes or batched periodically. |
| **Order Cancellation** | Clean if unbilled; requires voiding invoice, E-Way Bill, and credit note if billed. | Clean at any time prior to Delivery Note generation; zero financial or stock footprint. |
| **Sales Return Flow** | `SalesReturn` directly references `sales_invoices.id`, restores stock via `RETURN_INWARD`. | Goods Return Delivery (restocks inventory) followed by Credit Note (commercial liability refund). |
| **Credit Note Role** | Primary vehicle for post-invoice price/quantity adjustments and cancellations. | Commercial adjustment for verified delivery variances or returned items. |
| **Audit Trail** | Unified legal, tax, and inventory document (`SalesInvoice`). | Granular separation: Custody Transfer (`Delivery`) vs Financial Debt (`Invoice`). |
| **Tenant Implications** | Scoped across SO, Invoice, Fulfillment. | Scoped across SO, Delivery Note, Invoice. |
| **POS Suitability** | **100% Native Fit.** Fast, single-step over-the-counter billing. | **Unsuitable.** Paralyzes cashier checkout lines. |
| **Retail Suitability** | **100% Native Fit.** Instant scan, pay, and take. | **Unsuitable.** Over-engineered for retail. |
| **Wholesale Suitability** | **Moderate.** Awkward when warehouse pick shortages occur after legal tax invoice generation. | **Superior.** Industry standard for FMCG, manufacturing, and distribution. |
| **E-Commerce Suitability** | **High.** Standard for direct-to-consumer parcel shipping. | **Moderate.** Common for multi-warehouse freight fulfillment. |

---

## 4. Channel Requirements Matrix

| Parameter | Retail Counter | POS Quick Billing | B2B Wholesale | E-Commerce | Distribution |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Sales Order Required?** | NO | NO | **YES** | **YES** | **YES** |
| **Stock Reservation Required?** | NO | NO | **YES** | **YES** | **YES** |
| **Delivery Note Required?** | NO | NO | **DECISION REQUIRED** | NO (Air Waybill) | **DECISION REQUIRED** |
| **Stock Deduction Point** | Checkout | Checkout | **DECISION REQUIRED** | Carrier Handover | Dispatch Manifest |
| **Invoice Creation Point** | Counter | Counter | **DECISION REQUIRED** | Pack Complete | Order Approval |
| **Partial Fulfillment?** | NO | NO | **YES** | **YES** | **YES** |
| **Partial Invoicing?** | NO | NO | **YES** | **YES** | **YES** |
| **Payment Timing** | Immediate | Immediate | Post-dispatch (Net 30/60) | Prepaid / COD | Credit Ledger |
| **3-Way Match Relevant?** | **NO** | **NO** | **DECISION REQUIRED** | **NO** | **DECISION REQUIRED** |

---

## 5. Stock Authority Forensics

### Complete Registry of Sales Stock Writers

| Writer Service / Module | Triggering Event | Movement Type | Direct `Product.stock` Mutation? | Authoritative? | Double-Deduction Risk? |
| :--- | :--- | :--- | :---: | :---: | :---: |
| `CanonicalSalesPostingWriter` | Sales Invoice Posting | `OUTWARD_SALE` | NO (Derivation ledger) | **YES** | **CRITICAL HAZARD** with `FulfillmentEngine` |
| `FulfillmentEngine.create_dispatch` | Dispatch Creation | `OUTWARD_DISPATCH` | **YES** (`product.stock -= qty`) | **NO** (Competing) | **CRITICAL HAZARD** with `CanonicalSalesPostingWriter` |
| `SalesService.create_sales_return` | Sales Return Creation | `RETURN_INWARD` | Calls `StockSynchronizer` | **YES** | None |
| `SalesService.cancel_sales_invoice` | Invoice Cancellation | Reversal Movement | NO | **YES** | None |
| `SalesService.cancel_sales_return` | Return Cancellation | Reversal Movement | NO | **YES** | None |
| `EcomEngine.dispatch_order` | E-Com Shipment | `OUTWARD_ECOM` | Trigger sync | Isolated | None |
| `DistributionService.execute_dispatch` | B2B Distribution | `OUTWARD_SALE` | NO | Isolated | None |

### Proof of Double-Deduction Hazard
1. When a B2B Sales Order is invoiced via `CanonicalSalesPostingWriter.post_sales_transaction`, line 665 inserts `StockMovement(movement_type="OUTWARD_SALE")`, immediately deducting batch stock.
2. If the user subsequently creates a dispatch manifest via `FulfillmentEngine.create_dispatch` passing `source_order_id`, lines 306-325 execute:
   ```python
   product.stock = product.stock - quantity
   session.add(StockMovement(movement_type="OUTWARD_DISPATCH", ...))
   ```
3. **Observable Result:** Two separate outward stock movements (`OUTWARD_SALE` + `OUTWARD_DISPATCH`) are created for the exact same goods, causing physical inventory to be decremented **twice**.

---

## 6. Sales Lifecycle Bypass Audit

| Source File | Function Name | Current Status | Next Status | Triggering Action | Permission Checked? | Version Handled? | `WorkflowEvent` Generated? | Engine Used? | Transaction Boundary |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| `sales.py` | `reserve_sales_order` | `Draft` | `Confirmed` | `RESERVE` | Router only | **NO** | **NO** | **NO** | `await self.db.commit()` |
| `sales.py` | `release_sales_order_reservations` | `ACTIVE` | `RELEASED` | `RELEASE` | Router only | **NO** | **NO** | **NO** | In caller session |
| `sales.py` | `convert_sales_order_to_invoice` | `Confirmed` | `Completed` / `In Progress` | `BILL` | Router only | **NO** | **NO** | **NO** | `await self.db.commit()` |
| `sales.py` | `cancel_sales_invoice` | Any | `Cancelled` | `CANCEL` | Router only | **NO** | Outbox only | **NO** | `await self.db.commit()` |
| `sales.py` | `update_sales_order` | Any | Payload status | `UPDATE` | Router only | **NO** | **NO** | **NO** | `await self.db.commit()` |
| `sales.py` | `delete_sales_order` | Any | `Cancelled` | `CANCEL` | Router only | **NO** | **NO** | **NO** | `await self.db.commit()` |
| `sales.py` | `create_sales_return` | None | `Completed` | `POST` | Router only | **NO** | **NO** | **NO** | `TransactionIntegrityEngine` |
| `sales.py` | `cancel_sales_return` | `Completed` | `Cancelled` | `CANCEL` | Router only | **NO** | **NO** | **NO** | `await self.db.commit()` |
| `canonical_sales_writer.py` | `post_sales_transaction` | None | `Completed` / `Paid` | `POST` | Router only | **NO** | **NO** | **NO** | Caller session control |
| `fulfillment_engine.py` | `create_packing_slip` | None | `PACKED` | `PACK` | Router only | **NO** | **NO** | **NO** | `await session.commit()` |
| `fulfillment_engine.py` | `create_dispatch` | None | `DISPATCHED` | `DISPATCH` | Router only | **NO** | **NO** | **NO** | `await session.commit()` |
| `fulfillment_engine.py` | `update_delivery_status` | `DISPATCHED` | Payload status | `UPDATE` | Router only | **NO** | **NO** | **NO** | `await session.commit()` |

---

## 7. Sales Tenant & Schema Audit

| Table Name | `company_id` | `branch_id` | `uuid` | `version` | Audit Timestamps | Soft-Delete (`is_deleted`) | Unique Constraints in PostgreSQL | BaseEntity Parity? | Defect / Risk Identified |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :--- | :---: | :--- |
| **`sales_orders`** | YES | YES | YES | YES | YES | YES | `UNIQUE (order_no)` | **YES** | **GLOBAL UNIQUE:** Collides multi-tenant order numbering. Missing `(company_id, order_no)`. |
| **`sales_order_items`** | **NO** | **NO** | **NO** | **NO** | **NO** | **NO** | `PRIMARY KEY (id)` | **NO (Raw Base)** | Lacks direct tenant scope, uuid, version, and audit columns. `variant_id` unconstrained. |
| **`sales_invoices`** | YES | YES | YES | YES | YES | YES | `UNIQUE (company_id, invoice_no)` & `UNIQUE (invoice_no)` | **YES** | **REDUNDANT GLOBAL UNIQUE:** Global constraint causes cross-tenant collisions. |
| **`sales_invoice_items`** | **NO** | **NO** | **NO** | **NO** | **NO** | **NO** | `PRIMARY KEY (id)` | **NO (Raw Base)** | Lacks tenant scope, uuid, version. Causes runtime `TypeError: 'uuid'` in quotation convert. |
| **`sales_returns`** | YES | YES | YES | YES | YES | YES | `UNIQUE (return_no)` | **YES** | **GLOBAL UNIQUE:** Blocks identical return numbering across companies. |
| **`sales_return_items`** | **NO** | **NO** | **NO** | **NO** | **NO** | **NO** | `PRIMARY KEY (id)` | **NO (Raw Base)** | Lacks tenant scope, uuid, version. |
| **`packing_slips`** | YES | **NO** | YES | YES | YES | YES | `UNIQUE (packing_slip_number)` | **PARTIAL** | Global unique numbering. |
| **`dispatches`** | YES | **NO** | YES | YES | YES | YES | `UNIQUE (dispatch_number)` | **PARTIAL** | Global unique numbering. |

---

## 8. Sales Accounting Boundary

### Current Architectural Integration Status

```text
[Sales Transactions]
        │
        ├──> stock_movements ledger                 [CONNECTED]
        ├──> customer_credit_ledger_entries (CRM)   [CONNECTED]
        ├──> shift_cash_transactions (POS)          [CONNECTED]
        │
        └───X───> general_ledger_entries            [DISCONNECTED]
        └───X───> JournalVoucher                    [DISCONNECTED]
        └───X───> UnifiedAccountingLedgerService    [DISCONNECTED IN PRODUCTION PIPELINE]
```

* **WHAT EXISTS:**
  - `backend/app/services/unified_ledger.py` defines full double-entry logic:
    `post_sales_invoice_to_gl`, `post_shift_close_to_gl`, `post_payment_transaction_to_gl`, `post_stock_audit_reconciliation_to_gl`.
  - Chart of accounts (Assets 1000, Liabilities 2000, Equity 3000, Revenue 4000, Expenses 5000).
* **WHAT IS CONNECTED:**
  - Shift closing tests in `backend/tests/t_pos_shift_gl.py`.
  - Invoice cancellation in `sales.py:1689` attempts `post_sales_cancellation_to_gl` inside a warning-suppressed try/except block.
* **WHAT IS NOT CONNECTED:**
  - `CanonicalSalesPostingWriter.post_sales_transaction` emits **0 GL rows**.
  - `SalesService.create_sales_invoice` emits **0 GL rows**.
  - `PaymentsEngine.process_payment` emits **0 GL rows**.
  - `SalesService.create_sales_return` emits **0 GL rows**.
* **Governance Rule:** Accounting & GL posting is formally designated as a **separate future phase**. No manual journal mappings shall be coded during Sales workflow remediation.

---

## 9. Sales 3-Way Match Analysis

$$\text{Ordered Qty} \ge \text{Delivered Qty} \ge \text{Invoiced Qty}$$

* **Line-Level Location of Quantities:**
  - $\text{Ordered Qty}$: Lives in `sales_order_items.quantity`.
  - $\text{Invoiced Qty}$: Lives in `sales_invoice_items.quantity` and tracked in `sales_order_items.billed_quantity`.
  - $\text{Delivered Qty}$: **DOES NOT EXIST in any pre-invoice table.** `dispatch_items.quantity` is strictly post-invoice.
* **Can the Current Schema Support Line-Level 3-Way Matching?**
  - **NO.**
  - `sales_invoice_items` has no `delivery_item_id` foreign key.
  - No pre-invoice Delivery Note model or table exists in the database.
  - Attempting to enforce $\text{Delivered Qty} \ge \text{Invoiced Qty}$ today is architecturally impossible because goods are not dispatched until after the invoice is posted.

---

## 10. Sales Test Health Reconciliation

Total Tests Run Across Sales: **88** | Passed: **75** | Failed: **13** | Warnings: **56**

```text
BREAKDOWN OF 13 TEST FAILURES:
├── Category A: Real Product Bug (1)
│     └── test_convert_quotation_to_invoice (TypeError: 'uuid' on SalesInvoiceItem)
├── Category B: Outdated Tests / Client ID Rejection (5)
│     ├── test_create_sales_order_as_cashier (HTTP 422: client-supplied ID rejected)
│     ├── test_create_sales_order_duplicate_rejected (HTTP 422)
│     ├── test_create_sales_order_rejects_missing_or_invalid_item (HTTP 422)
│     ├── test_get_sales_order_by_id (HTTP 422)
│     └── test_update_and_delete_sales_order (HTTP 422)
├── Category C: Schema Drift / Legacy Status Codes (2)
│     ├── test_list_sales_orders (assert 400 == 201)
│     └── test_create_sales_return_duplicate_rejected (assert 409 == 400)
├── Category D: Architectural Derivation Gaps (Legacy Stock Assertions) (3)
│     ├── test_sales_return_increments_stock (assert 0 == 6)
│     ├── test_sr_inventory_001 (assert 0 == 6)
│     └── test_sr_e2e_001 (assert 0 == 11)
└── Category E: Test Infrastructure / Async Session Flush (2)
      ├── test_sr_concurrency_001 (MissingGreenlet during flush)
      └── test_sr_refund_policy_001 (Snapshot comparison mismatch)
```

---

## 11. Universal Lifecycle Compatibility

Can Sales be integrated into `UniversalLifecycleEngine` without adding `if doc_type == "SALES_ORDER"`?

**YES — 100% PROVEN BY STATIC INSPECTION:**
1. `UniversalLifecycleEngine.execute_transition` contains **zero document-specific branching**. Handler resolution is completely pluggable:
   ```python
   handler_cls = LifecycleRegistry.get_handler(ctx.doc_type)
   ```
2. The acceptance test in `test_universal_lifecycle.py:458` demonstrated this by registering `MockSalesOrder` dynamically with `@register_lifecycle_handler("SalesOrder", "SALES_ORDER")` and executing full transitions with 0 engine modifications.
3. Handlers to be introduced during Sales remediation:
   - `SalesOrderLifecycleHandler` (`SALES_ORDER`)
   - `SalesInvoiceLifecycleHandler` (`SALES_INVOICE`)
   - `SalesReturnLifecycleHandler` (`SALES_RETURN`)

---

## 12. Required Business Decisions (For Management)

The following six decisions are exclusively business-domain choices and must be answered by management before coding begins:

### Decision 1: Wholesale Delivery Model
* **Question:** Should B2B Wholesale transition to **Model B** (pre-invoice Delivery Note / Goods Issue with stock leaving on dispatch), or maintain **Model A** (stock leaving on invoice, with packing/dispatch as post-invoice fulfillment manifests)?
* **Impact:** Dictates whether a new `delivery_notes` table and handler are required.

### Decision 2: Retail / POS Flow Independence
* **Question:** Do Retail Counters and POS Quick-Billing remain permanently anchored to **Model A** (instant scan $\to$ invoice $\to$ stock deduction $\to$ pay), completely exempt from delivery documents?
* **Impact:** Preserves high-throughput cashier operations.

### Decision 3: Scope of Sales 3-Way Matching
* **Question:** If Model B is selected for Wholesale, should the 3-way match ($\text{Order} \ge \text{Delivered} \ge \text{Invoiced}$) be strictly confined to B2B Wholesale orders, while Retail/POS continues using 1-step direct billing?
* **Impact:** Prevents operational paralysis in store checkouts.

### Decision 4: Sales Order Approval Matrices
* **Question:** What monetary thresholds, discount percentages, or customer credit limit breaches mandate manager or director approval before a Sales Order can transition from `SUBMITTED` to `CONFIRMED`?
* **Impact:** Defines the configuration for `approval_policies`.

### Decision 5: Sales Order Cancellation & Amendment Policy
* **Question:** What is the approved business policy when an order is cancelled or amended after stock has been reserved? Should reservations release automatically with a documented audit reason?
* **Impact:** Defines invariants inside `SalesOrderLifecycleHandler`.

### Decision 6: Financial Posting Milestone
* **Question:** Should commercial invoices and payments generate formal double-entry General Ledger journal vouchers immediately, or should this remain deferred to a dedicated Accounting / Financial Ledger Phase?
* **Impact:** Establishes engineering scope boundaries.

---

## 13. Engineering Remediation Required (Once Approved)

1. **Schema & Multi-Tenant Hardening:**
   - Drop global unique constraint `sales_orders_order_no_key`; create composite `UniqueConstraint("company_id", "order_no")`.
   - Drop global unique constraint `sales_returns_return_no_key`; create composite `UniqueConstraint("company_id", "return_no")`.
   - Drop redundant global unique constraint `sales_invoices_invoice_no_key`; retain `uq_sales_invoices_company_invoice_no`.
   - Migrate `sales_order_items`, `sales_invoice_items`, and `sales_return_items` to `BaseEntity` heritage (`uuid`, `company_id`, `branch_id`, `version`, `is_deleted`).
2. **Stock Authority Convergence:**
   - Remove competing stock deduction and direct `product.stock` mutation from `FulfillmentEngine.create_dispatch`.
   - Anchor stock deduction strictly to the chosen authoritative event.
3. **Universal Lifecycle Handlers:**
   - Implement `SalesOrderLifecycleHandler`, `SalesInvoiceLifecycleHandler`, and `SalesReturnLifecycleHandler`.
   - Route all API endpoints through `UniversalLifecycleEngine.execute_transition`.
4. **Test Suite Modernization:**
   - Remove client-supplied IDs in `test_sales.py`.
   - Update stock assertions to query `stock_movements` rather than `Product.stock`.
   - Fix `TypeError: 'uuid'` in quotation conversion.

---

## 14. Explicit NON-GO Areas

During this phase and immediate subsequent remediation, all agents and developers must strictly adhere to these boundaries:
* **NON-GO 1:** DO NOT touch Purchase Phase 2.1 code, models, or tests.
* **NON-GO 2:** DO NOT implement Sales 3-Way Matching until Decision 1 and Decision 3 are frozen by management.
* **NON-GO 3:** DO NOT implement General Ledger (GL) journal postings during Sales remediation.
* **NON-GO 4:** DO NOT create arbitrary database triggers on sales tables.
* **NON-GO 5:** DO NOT seed fictitious approval policies into production databases.

---

## 15. Proposed Future Implementation Sequence

```text
[PHASE 0.1: Architecture & Flow Freeze]  <=== (WE ARE HERE)
              │
              ▼
[PHASE 0.2: Management Business Decisions 1–6]
              │
              ▼
[PHASE 1: Sales Schema & Tenant Hardening]
(Drop global uniques, elevate Item models to BaseEntity, migration v1515)
              │
              ▼
[PHASE 2: Stock Authority Convergence]
(Eliminate double-deduction hazard in FulfillmentEngine)
              │
              ▼
[PHASE 3: Sales Universal Lifecycle Integration]
(SalesOrderLifecycleHandler, SalesInvoiceLifecycleHandler, SalesReturnLifecycleHandler)
              │
              ▼
[PHASE 4: Sales Test Suite Modernization]
(Fix 13 legacy test defects -> Achieve 88/88 green)
              │
              ▼
[PHASE 5: Separate General Ledger Accounting Phase]
(Automated balanced journal vouchers for Purchase & Sales)
```
