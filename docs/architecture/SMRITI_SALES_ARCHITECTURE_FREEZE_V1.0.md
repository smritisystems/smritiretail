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

# SMRITI Sales Architecture Freeze & Management Decision Pack (v1.0)

**Document ID:** SMRITI-ARCH-SALES-FREEZE-v1.0  
**Status:** FROZEN ARCHITECTURE SPECIFICATION (Phase 0.2 Management Pack)  
**Effective Date:** 2026-10-01  
**Baseline Principle:** Purchase Phase 2.1 is **FROZEN & ISOLATED** (25/25 Tests Passing). Zero Purchase Code Touched.  

---

## 1. Executive Summary

Following the completion of the read-only forensic audits of SMRITI Retail OS, this document establishes the **formal architecture freeze and management decision pack** for the entire Sales domain.

While **Procurement / Purchase Phase 2.1** has achieved production-grade rigor:
* `25/25` automated tests green across cross-handler, universal lifecycle, approval engine, and GRN attachments suites.
* PostgreSQL database constraint `uq_purchase_bills_company_bill_no` and 100% schema column parity verified.
* Atomic inward and reversal stock ledger movements (`INWARD_GRN`, `RETURN_OUTWARD`) locked into unit-of-work transactions.
* Strict enforcement of line-level 3-way variance matching (PO Qty, GRN Qty, PO Rate limits with ₹0.05 rounding tolerance).

The **Sales domain** remains in an un-hardened, disparate state that cannot be remediated until fundamental business flow decisions are made:
1. **100% Lifecycle Bypass:** Sales Orders, Sales Invoices, Sales Returns, and Fulfillment manifests bypass the `UniversalLifecycleEngine`, mutating document status via ad-hoc direct database writes.
2. **Dual Stock Writer Hazard:** Physical stock can be deducted twice: once on Sales Invoice posting via `CanonicalSalesPostingWriter` (`OUTWARD_SALE`), and a second time on Dispatch via `FulfillmentEngine` (`OUTWARD_DISPATCH`).
3. **Multi-Tenant Constraint Defects:** `sales_orders.order_no` and `sales_returns.return_no` carry global PostgreSQL `UNIQUE` constraints that block two distinct companies from using the same document number.
4. **General Ledger (GL) Disconnect:** No sales transaction currently writes to `general_ledger_entries`.
5. **The Fulfillment Crossroads:** SMRITI currently implements a **Post-Invoice Fulfillment** model ($\text{Order} \to \text{Invoice} \to \text{Dispatch}$). Enforcing a pre-invoice 3-way match ($\text{Order} \ge \text{Delivered} \ge \text{Invoiced}$) without an explicit business flow decision would break Retail and POS operations.

**Governance Mandate:** NO sales implementation, bug fixes, or schema alterations shall occur until management formally signs off on the decisions in this document.

---

## 2. Current Sales Architecture

```text
CURRENT IMPLEMENTATION WORKFLOW:

[Sales Quotation] (Draft)
       │
       ▼ (convert_quotation_to_order)
[Sales Order] (Draft)
       │
       ▼ (reserve_sales_order) ──> [SalesOrderReservation] (Barcode hold)
[Sales Order] (Confirmed / Reserved)
       │
       ▼ (convert_sales_order_to_invoice)
[Draft Sales Invoice] + [SalesOrderInvoiceAllocation]
       │
       ▼ (CanonicalSalesPostingWriter.post_sales_transaction)
[Posted / Paid Sales Invoice] 
       ├──> StockMovement: OUTWARD_SALE (Deducts Batch Inventory)
       ├──> CustomerCreditLedgerEntry (CRM subledger if Credit tender)
       └──> (Zero General Ledger Journal Entries Created)
       │
       ▼ (FulfillmentEngine.create_packing_slip)
[Packing Slip] (Packed) [Foreign Key: sales_invoice_id]
       │
       ▼ (FulfillmentEngine.create_dispatch)
[Dispatch Manifest] (Dispatched)
       └──> IF source_order_id supplied: DUPLICATE StockMovement OUTWARD_DISPATCH!
```

---

## 3. Channel Architecture Matrix

The architecture must support channel-specific workflows through pluggable handlers and configuration, rather than forcing all commercial channels into a single monolithic pipeline.

| Parameter | Retail Counter | POS Quick Billing | B2B Wholesale | E-Commerce | Distribution (Depot) |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Sales Order Required?** | NO | NO | **YES** | **YES** | **YES** |
| **Stock Reservation Required?** | NO | NO | **YES** (Batch/Barcode) | **YES** (Cart hold) | **YES** (Allocation) |
| **Delivery Note Required?** | NO | NO | **DECISION REQUIRED** | NO (Air Waybill) | **DECISION REQUIRED** |
| **Packing Manifest Required?** | NO | NO | **YES** | **YES** | **YES** |
| **Dispatch Manifest Required?** | NO | NO | **YES** | **YES** (Carrier) | **YES** (Logistics) |
| **Stock Deduction Point** | At Checkout | At Tender Commit | **DECISION REQUIRED** | At Carrier Handover | At Dock Exit |
| **Invoice Creation Point** | At Checkout | At Cashier Scan | **DECISION REQUIRED** | At Pack Complete | At Order Approval |
| **Invoice Posting Point** | Instantaneous | Instantaneous | Commercial Post | On Dispatch | Periodic / Post |
| **Payment Point** | Immediate | Immediate | Net Terms (15/30/60) | Prepaid / COD | Credit Ledger |
| **Partial Fulfillment?** | NO | NO | **YES** | **YES** (Split pack) | **YES** |
| **Partial Invoicing?** | NO | NO | **YES** | **YES** | **YES** |
| **Return Mechanism** | Counter Return | POS Refund | RMA / Return Inward | Reverse Logistics | Depot Return |
| **Credit Note Requirement** | On Refund | Cashier Voucher | Formal Tax Credit Note | Wallet / Refund | Financial Credit Note |
| **Approval Required?** | NO | NO (unless discount) | **YES** (Threshold/Credit) | Automated | **YES** (Credit check) |
| **3-Way Match Relevant?** | **NO** | **NO** | **DECISION REQUIRED** | **NO** | **DECISION REQUIRED** |
| **Lifecycle Family** | `DirectCounter` | `PosCheckout` | `WholesaleOrder` | `EcomFulfillment` | `StockistDispatch` |
| **Audit Requirements** | Shift Log | Terminal Audit | SO-Audit + E-Invoice | Outbox Event | Dispatch Audit |

---

## 4. Model A / Model B Decision by Channel

### Model A: Post-Invoice Fulfillment (Current Architecture)
$$\text{Sales Order} \longrightarrow \text{Sales Invoice} \longrightarrow \text{Stock OUT} \longrightarrow \text{Packing Slip} \longrightarrow \text{Dispatch Manifest}$$

### Model B: Pre-Invoice Goods Issue (Classic 3-Way Match)
$$\text{Sales Order} \longrightarrow \text{Delivery Note / Goods Issue} \longrightarrow \text{Stock OUT} \longrightarrow \text{Sales Invoice} \longrightarrow \text{Dispatch}$$

### Channel Evaluation

#### 1. Retail Counter & POS Quick-Billing
* **Decision:** **MODEL A PERMANENTLY.**
* **Rationale:** Point-of-sale checkout is an atomic, single-step transaction (Scan $\to$ Pay $\to$ Invoice $\to$ Stock OUT $\to$ Bag). Imposing delivery notes or separate goods issue steps would paralyze retail counters.
* **Stock & Invoice Effect:** Handled synchronously in `CanonicalSalesPostingWriter`.

#### 2. E-Commerce
* **Decision:** **MODEL A VARIANT (Carrier Shipment).**
* **Rationale:** Online orders follow Order $\to$ Pick/Pack $\to$ Tax Invoice printed with shipping label $\to$ Carrier Dispatch. Customer requires a tax invoice enclosed in the parcel prior to carrier handover.

#### 3. B2B Wholesale & Depot Distribution
* **Decision:** **MANAGEMENT DECISION REQUIRED (Decision 1 & Decision 2).**
* **Trade-Off Summary:**
  * **Option A (Model A):** Invoice generated first, creating legal GST E-Invoice/IRN; warehouse packs and dispatches against invoice. If warehouse picks a shortage, tax invoice must be legally amended via Credit Note.
  * **Option B (Model B):** Delivery Note generated first; warehouse picks and loads physical goods; stock leaves dock; commercial tax invoice generated only for actual loaded quantities. Complete protection against invoicing variances.

---

## 5. Stock Authority Architecture

### Core Invariant
$$\text{LEDGER IS TRANSACTIONAL AUTHORITY} \quad \Big\vert \quad \text{PRODUCT/BATCH STOCK IS DERIVED CACHE ONLY}$$

### Target Authority Answers

1. **Authoritative Source of Stock:** The PostgreSQL `stock_movements` ledger table is the sole source of truth. Physical inventory balance is derived exclusively via `SUM(quantity)`.
2. **Event Causing Stock Deduction:**
   - **For Model A (Retail, POS, Direct B2B):** Sales Invoice posting is the sole stock deduction event (`movement_type="OUTWARD_SALE"`).
   - **For Model B (Wholesale Delivery Note, if approved):** Delivery Note dispatch is the sole stock deduction event (`movement_type="OUTWARD_DISPATCH"`). Invoicing has zero stock impact.
3. **Can Invoice and Dispatch Both Deduct Stock?** **ABSOLUTELY NOT.** SMRITI enforces the **Rule of Single Stock Deduction**. No order line shall trigger more than one outward movement.
4. **Service Owning `OUTWARD_SALE`:** `CanonicalSalesPostingWriter` (or `SalesInvoiceLifecycleHandler` in Model A).
5. **Service Owning `OUTWARD_DISPATCH`:** `FulfillmentEngine` (or `DeliveryNoteLifecycleHandler` in Model B).
6. **Direct `Product.stock` Mutation:** **STRICTLY PROHIBITED.** All legacy direct assignments (`product.stock = product.stock - qty` in `fulfillment_engine.py:306`) must be decommissioned.
7. **Rule for Preventing Duplicate Deductions:**
   - If a channel uses Model A, `FulfillmentEngine.create_dispatch` is strictly a logistics tracking manifest and is **blocked from inserting stock movements**.
   - If a channel uses Model B, `SalesInvoice` posting is purely commercial and is **blocked from inserting stock movements**.
8. **Cancellation & Reversal:** Every cancellation inserts a compensating `StockMovement` row (`movement_type="RETURN_INWARD"` or `"RETURN_OUTWARD"`). Rows are never deleted.
9. **Partial Fulfillment:** Stock movements record only the exact line quantities physically moved in that specific document transaction.

---

## 6. Sales Lifecycle Architecture

All Sales documents shall be governed by `UniversalLifecycleEngine` via pluggable handlers implementing `BaseDocumentLifecycleHandler`.

```text
UniversalLifecycleEngine.execute_transition(db, tenant_ctx, user, ctx)
          │
          ├──> LifecycleRegistry.get_handler(doc_type)
          ├──> Optimistic Concurrency Check (doc.version == ctx.expected_version)
          ├──> Permission & Role Matrix Check
          ├──> ApprovalEngine Policy Check (if configured)
          ├──> handler.validate_transition(db, doc, action, ...)
          ├──> handler.apply_transition(db, doc, action, ...)  <── (Staged Ledger Effects)
          ├──> WorkflowEvent Persistence (Immutable Audit)
          └──> await db.commit()  <── (Atomic Unit-of-Work Boundary)
```

### Conceptual Document Lifecycle Matrix

| Document | States | Allowed Actions | Required Permission | Approval Point | Stock Effect | Financial Effect | Audit Event |
| :--- | :--- | :--- | :--- | :---: | :---: | :---: | :---: |
| **`SALES_QUOTATION`** | `DRAFT`, `SUBMITTED`, `APPROVED`, `CONVERTED`, `CANCELLED` | `SUBMIT`, `APPROVE`, `CONVERT`, `CANCEL` | `quotation:read/write` | Manager (if discount > X) | None | None | `QUOTATION_TRANSITION` |
| **`SALES_ORDER`** | `DRAFT`, `SUBMITTED`, `CONFIRMED`, `PARTIALLY_DELIVERED`, `COMPLETED`, `CANCELLED` | `SUBMIT`, `APPROVE`, `CONFIRM`, `CANCEL` | `sales_order:read/write` | Manager / Director (Thresholds) | Reserve on Confirm; Release on Cancel | None | `SALES_ORDER_TRANSITION` |
| **`DELIVERY_NOTE`** *(Model B)* | `DRAFT`, `PICKED`, `DISPATCHED`, `CANCELLED` | `PICK`, `DISPATCH`, `CANCEL` | `dispatch:read/write` | Warehouse Lead | Deduct stock on Dispatch (`OUTWARD_DISPATCH`) | COGS in transit | `DELIVERY_TRANSITION` |
| **`SALES_INVOICE`** | `DRAFT`, `APPROVED`, `POSTED`, `PAID`, `CANCELLED` | `APPROVE`, `POST`, `RECORD_PAYMENT`, `CANCEL` | `invoice:read/write` | Finance Manager | Deduct stock on Post (Model A only) | AR / Tax / Revenue | `SALES_INVOICE_TRANSITION` |
| **`SALES_RETURN`** | `DRAFT`, `SUBMITTED`, `APPROVED`, `RESTOCKED`, `CANCELLED` | `SUBMIT`, `APPROVE`, `RESTOCK`, `CANCEL` | `sales_return:read/write` | Store / Finance Manager | Restore stock on Restock (`RETURN_INWARD`) | Credit Note / Contra | `SALES_RETURN_TRANSITION` |
| **`PACKING_SLIP`** | `PENDING`, `PACKED`, `CANCELLED` | `PACK`, `CANCEL` | `packing:read/write` | None | None | None | `PACKING_TRANSITION` |
| **`DISPATCH`** | `MANIFESTED`, `DISPATCHED`, `IN_TRANSIT`, `DELIVERED`, `RETURNED` | `DISPATCH`, `DELIVER`, `FAIL` | `dispatch:read/write` | None | None (in Model A) | Driver Commission | `DISPATCH_TRANSITION` |

---

## 7. Tenant Architecture & Schema Hardening

### Target Entity & Constraint Specification

| Table | Target Entity Heritage | Multi-Tenant Scoping | PostgreSQL Constraints Required | Legacy Constraint to Drop |
| :--- | :--- | :--- | :--- | :--- |
| **`sales_orders`** | `BaseEntity` | `company_id`, `branch_id` | `UniqueConstraint("company_id", "order_no", name="uq_sales_orders_company_order_no")` | Drop global `sales_orders_order_no_key` |
| **`sales_order_items`** | Elevate to `BaseEntity` | Add `company_id`, `branch_id` | `uuid`, `version`, `created_at`, `is_deleted`. Foreign key to `variants.id` | N/A (Migrate from raw Base) |
| **`sales_invoices`** | `BaseEntity` | `company_id`, `branch_id` | Retain `uq_sales_invoices_company_invoice_no` | Drop redundant global `sales_invoices_invoice_no_key` |
| **`sales_invoice_items`** | Elevate to `BaseEntity` | Add `company_id`, `branch_id` | `uuid`, `version`, `created_at`, `is_deleted`. Fix runtime `TypeError: 'uuid'` | N/A (Migrate from raw Base) |
| **`sales_returns`** | `BaseEntity` | `company_id`, `branch_id` | `UniqueConstraint("company_id", "return_no", name="uq_sales_returns_company_return_no")` | Drop global `sales_returns_return_no_key` |
| **`sales_return_items`** | Elevate to `BaseEntity` | Add `company_id`, `branch_id` | `uuid`, `version`, `created_at`, `is_deleted` | N/A (Migrate from raw Base) |
| **`packing_slips`** | `BaseEntity` | Add `branch_id` | `UniqueConstraint("company_id", "packing_slip_number", name="uq_packing_slips_company_num")` | Drop global `packing_slips_packing_slip_number_key` |
| **`dispatches`** | `BaseEntity` | Add `branch_id` | `UniqueConstraint("company_id", "dispatch_number", name="uq_dispatches_company_num")` | Drop global `dispatches_dispatch_number_key` |

---

## 8. Sales 3-Way Match Policy

### Evaluation: $\text{Ordered Qty} \ge \text{Delivered Qty} \ge \text{Invoiced Qty}$

* **Retail Counter:** **NOT APPLICABLE.**
* **POS Quick Billing:** **NOT APPLICABLE.**
* **E-Commerce:** **NOT APPLICABLE.**
* **B2B Wholesale & Distribution:** **BUSINESS DECISION REQUIRED.**
  - If Model B is chosen by management, a strict line-level 3-way match must be implemented inside `SalesInvoiceLifecycleHandler.validate_transition`:
    1. $\text{Billed Qty} \le \text{Delivered Qty}$ (raises `SALES_3WAY_QTY_EXCEEDED`).
    2. $\text{Delivered Qty} \le \text{Ordered Qty}$ (raises `DELIVERY_QTY_EXCEEDED`).
    3. $\text{Billed Rate} = \text{Agreed Order Rate}$ (raises `SALES_3WAY_RATE_MISMATCH`).
  - If Model A is maintained, 3-way matching does not exist; allocation limit ($\text{Billed Qty} \le \text{Ordered Qty}$) remains the operational constraint.

---

## 9. Returns Architecture

```text
[Customer Returns Goods]
           │
           ▼
[SalesReturn Created] (Draft)
           │
           ▼ (UniversalLifecycleEngine: APPROVE)
[SalesReturn Approved] ──> Authoritative Restocking: StockMovement (RETURN_INWARD)
           │
           ▼ (UniversalLifecycleEngine: ISSUE_CREDIT)
[Credit Note Allocated via DocumentsEngine]
           │
           ├──> CRM Customer Credit Ledger Adjustment
           └──> General Ledger Contra-Revenue Posting (Phase S7)
```

1. **Return Against Invoice:** `original_invoice_id` is mandatory. Remaining returnable quantity is strictly enforced:
   $$\text{requested\_qty} \le \text{invoice\_qty} - \sum \text{prior\_returns}$$
2. **Restocking Authority:** Restocking is triggered exclusively during lifecycle transition via `SalesReturnLifecycleHandler`, generating `StockMovement(movement_type="RETURN_INWARD")`.
3. **Credit Note Generation:** Linked to `DocumentsEngine` for sequential credit note allocation (`CREDIT_NOTE`).

---

## 10. Partial Fulfillment Architecture

| Fulfillment Event | Model A Behavior | Model B Behavior |
| :--- | :--- | :--- |
| **Partial Sales Order Allocation** | Billed line quantity increments `sales_order_items.billed_quantity`. Pending balance stays open as `pending_quantity`. | Delivery Note generated for available items, incrementing `delivered_quantity`. Pending balance stays open on SO. |
| **Partial Delivery** | Occurs post-invoice. If packing slip has fewer items than invoiced, requires credit note. | Clean: Delivery note reflects only what is on the truck. Customer is not yet billed. |
| **Partial Invoicing** | Invoice generated for a subset of the order. Order status moves to `In Progress`. | Invoice generated for one specific Delivery Note. Other delivery notes billed separately. |
| **Cancellation of Balance** | Remaining unbilled balance on SO can be closed via `CLOSE_ORDER` action, releasing remaining reservations. | Remaining undelivered balance cancelled with zero financial footprint. |

---

## 11. Approval Architecture (Configurable Dimensions)

Approval rules shall be evaluated by the existing `ApprovalEngine` via database-driven policies in `approval_policies`, avoiding hardcoded thresholds in code.

| Approval Dimension | Scope / Evaluation Point | Current Status in Code | Target Policy Type |
| :--- | :--- | :---: | :--- |
| **Sales Order Total Value** | `SalesOrder` `SUBMIT` transition | CONFIGURABLE | `SALES_ORDER_VALUE_TIER` |
| **Line-Level Discount %** | Line discount > policy limit | CONFIGURABLE | `MAX_DISCOUNT_THRESHOLD` |
| **Customer Credit Limit Breach** | Outstanding balance + Order > Limit | CONFIGURABLE | `CREDIT_LIMIT_OVERRIDE` |
| **Gross Margin Protection** | Selling Price < Cost Price + Min Margin | NOT IMPLEMENTED | `NEGATIVE_MARGIN_BLOCK` |
| **Credit Term Deviation** | Payment terms > Standard policy | NOT IMPLEMENTED | `PAYMENT_TERMS_APPROVAL` |
| **Sales Return Authorization** | Return Value > Supervisor Limit | CONFIGURABLE (in policy resolver) | `RETURN_SUPERVISOR_THRESHOLD` |

* **Invariant:** Zero arbitrary monetary values or thresholds shall be seeded until management provides formal commercial authorization matrices.

---

## 12. Accounting Boundary (General Ledger Separation)

```text
OPERATIONAL TIER (Current Scope)
[Sales Order] ──> [Sales Invoice] ──> [Payments] ──> [Sales Return]
        │                   │                 │                │
        ▼                   ▼                 ▼                ▼
[SO Reservations]   [stock_movements]   [CRM Credit Ledger] [RETURN_INWARD]
                    (Inventory Ledger)  [POS Shift Cash]    (Stock Ledger)
═══════════════════════════════════════════════════════════════════════════════
FINANCIAL LEDGER TIER (Dedicated Separate Phase S7)
        │                   │                 │                │
        ▼                   ▼                 ▼                ▼
[Unbilled Deliveries] [Sales Revenue]   [Cash/Bank Asset]   [Contra Revenue]
[Inventory in Transit][GST Output Tax]  [Accounts Rec]      [GST Output Tax Reversal]
        │                   │                 │                │
        └───────────────────┴─────────────────┴────────────────┘
                                    │
                                    ▼
                        [general_ledger_entries]
                        [JournalVoucher Engine]
```

* **Boundary Declaration:** The runtime Sales posting pipeline is strictly separated from General Ledger accounting. GL journal generation is an independent, standing capability to be wired during Phase S7.

---

## 13. Universal Lifecycle Compatibility (Formal Proof)

### Architectural Proof of Zero Kernel Modification
1. **Generic Resolution:** `UniversalLifecycleEngine.execute_transition` lines 70–80:
   ```python
   handler_cls = LifecycleRegistry.get_handler(ctx.doc_type)
   if not handler_cls:
       raise HandlerNotFoundException(...)
   handler = handler_cls()
   ```
   Contains zero references to specific document types.
2. **Pluggable Registration:** The acceptance test in `test_universal_lifecycle.py:458` proved that registering `@register_lifecycle_handler("SalesOrder", "SALES_ORDER")` dynamically executes complete transitions with full audit logging, RBAC, and concurrency controls without touching a single line of engine code.
3. **Target Handlers to be Created:**
   - `SalesQuotationLifecycleHandler` (`SALES_QUOTATION`)
   - `SalesOrderLifecycleHandler` (`SALES_ORDER`)
   - `DeliveryNoteLifecycleHandler` (`DELIVERY_NOTE`) *(if Model B approved)*
   - `SalesInvoiceLifecycleHandler` (`SALES_INVOICE`)
   - `SalesReturnLifecycleHandler` (`SALES_RETURN`)

---

## 14. Current → Target Gap Matrix

| Area | Current Implementation State | Target Implementation State | Gap Severity | Target Remediation Phase |
| :--- | :--- | :--- | :---: | :---: |
| **Sales Lifecycle** | 100% bypass of lifecycle engine; direct ad-hoc mutations | Governed by `UniversalLifecycleEngine` via pluggable handlers | **CRITICAL** | Phase S3 |
| **Stock Authority** | Dual writer collision (`CanonicalWriter` vs `FulfillmentEngine`) | Single authoritative stock movement; direct `product.stock` mutation removed | **CRITICAL** | Phase S2 |
| **Tenant Isolation** | Global `UNIQUE` constraints on `order_no`, `return_no`, `invoice_no` | Composite `UniqueConstraint(company_id, doc_no)` | **CRITICAL** | Phase S1 |
| **Item Schema Parity** | `SalesOrderItem` and `SalesInvoiceItem` inherit from raw `Base` | Elevate to `BaseEntity` (`uuid`, `company_id`, `version`, `audit`) | **HIGH** | Phase S1 |
| **3-Way Match** | Does not exist | Pre-invoice delivery matching for Wholesale (if approved) | **MEDIUM** | Phase S5 |
| **Partial Fulfillment** | Managed via ad-hoc allocation tracking | Governed lifecycle state transitions (`PARTIALLY_DELIVERED`, etc.) | **HIGH** | Phase S3 |
| **Sales Return** | Operational in `SalesService`, but bypasses lifecycle engine | Governed by `SalesReturnLifecycleHandler` | **HIGH** | Phase S3 |
| **Fulfillment / Packing** | Post-invoice packing slips in `fulfillment_engine.py` | Governed `PackingSlipLifecycleHandler` | **MEDIUM** | Phase S5 |
| **Dispatch Manifest** | Post-invoice dispatch in `fulfillment_engine.py` | Governed `DispatchLifecycleHandler` | **MEDIUM** | Phase S5 |
| **Approval Engine** | Zero policies in production DB; engine bypassed by Sales | Governed by `ApprovalEngine` via dynamic policies | **HIGH** | Phase S6 |
| **General Ledger** | Disconnected from runtime sales posting | Automated double-entry GL journal vouchers | **DEFERRED** | Phase S7 |
| **Test Suite Health** | 75 passed / 13 failed (legacy schema drift, client ID rejection) | 88 passed / 0 failed with modernized assertions | **CRITICAL** | Phase S4 |
| **Optimistic Concurrency**| No version check during sales mutations | Enforced `doc.version += 1` with concurrency conflict handling | **HIGH** | Phase S3 |

---

## 15. Implementation Roadmap (Safe Sequence)

```text
[PHASE S0: Business Flow Decision & Freeze]  <=== (CURRENT STAGE - COMPLETE)
              │
              ▼
[PHASE S1: Sales Schema & Tenant Hardening]
- Alembic migration v1515: Drop global uniques, add compound (company_id, doc_no)
- Elevate SalesOrderItem and SalesInvoiceItem to BaseEntity
              │
              ▼
[PHASE S2: Stock Authority Convergence]
- Eliminate double-deduction hazard in FulfillmentEngine
- Decommission all direct product.stock mutations
              │
              ▼
[PHASE S3: Sales Universal Lifecycle Handlers]
- Implement SalesOrderLifecycleHandler, SalesInvoiceLifecycleHandler, SalesReturnLifecycleHandler
- Connect API routes strictly to UniversalLifecycleEngine.execute_transition
              │
              ▼
[PHASE S4: Sales Test Suite Modernization]
- Fix 13 failing legacy tests (remove client IDs, assert against stock_movements)
- Achieve 88/88 tests green
              │
              ▼
[PHASE S5: Fulfillment & 3-Way Match Integration]
- Implement Delivery Note flow (if Model B approved) or harden post-invoice fulfillment
              │
              ▼
[PHASE S6: Sales Approval Engine Integration]
- Seed verified business approval threshold policies
              │
              ▼
[PHASE S7: Dedicated General Ledger Accounting Phase]
- Automated balanced double-entry journal vouchers for Purchase & Sales
```

---

## 16. Test Strategy

No sales implementation phase shall be signed off until its dedicated automated test suite passes with **zero failures**:

1. **Multi-Tenant Numbering Tests:** Validate that Tenant A and Tenant B can concurrently create identical order numbers (`ORD-001`) and invoice numbers (`INV-001`).
2. **Lifecycle State Transition Tests:** Validate all valid state progressions and assert that unsupported jumps raise `InvalidTransitionException`.
3. **Optimistic Concurrency Tests:** Assert that concurrent updates with stale versions raise `ConcurrencyConflictException` (HTTP 409).
4. **Stock Movement Atomicity Tests:** Assert that stock movements are committed in the same database transaction as the document transition.
5. **Double-Deduction Prevention Tests:** Rigorously verify that invoicing followed by dispatch produces exactly one outward stock movement per item.
6. **Stock Derivation Invariant Tests:** Assert that `Product.stock` is never directly mutated, and inventory is derived solely from `stock_movements`.
7. **Line-Level Matching Tests (if Model B):** Assert that billed quantity exceeding delivery raises `SALES_3WAY_QTY_EXCEEDED`.
8. **Soft-Delete & Audit Event Tests:** Assert that cancelled orders and invoices generate immutable `WorkflowEvent` rows and retain records with `is_deleted=True`.

---

## 17. Management Decision Register

| Decision ID | Area | Current Fact in Code | Architectural Options | Recommended Direction | Decision Owner | Blocks Phase |
| :--- | :--- | :--- | :--- | :--- | :--- | :---: |
| **DECISION 1** | **Wholesale Delivery Model** | Currently Model A (Post-invoice dispatch). | **Opt A:** Model A (Invoice first).<br>**Opt B:** Model B (Delivery Note first). | **Model B for Wholesale; Model A for Retail/POS.** | Head of Supply Chain | Phase S5 |
| **DECISION 2** | **Retail / POS Model** | Model A (Instant counter invoice & stock deduction). | **Opt A:** Maintain Model A.<br>**Opt B:** Introduce delivery step. | **Model A Permanently.** | Head of Retail Operations | Phase S3 |
| **DECISION 3** | **Sales 3-Way Matching** | Does not exist in Sales code. | **Opt A:** B2B Wholesale only.<br>**Opt B:** All channels.<br>**Opt C:** Omit entirely. | **Confine to B2B Wholesale (if Model B chosen).** | Chief Financial Officer | Phase S5 |
| **DECISION 4** | **Sales Order Approval Tiers** | Zero approval policies in DB; engine bypassed. | **Opt A:** Value tiers.<br>**Opt B:** Discount % limits.<br>**Opt C:** Credit limit breach. | **Implement multi-dimensional approval policies.** | Commercial Director | Phase S6 |
| **DECISION 5** | **Cancellation / Amendment Policy** | Ad-hoc status assignment in service. | **Opt A:** Auto-release reservation.<br>**Opt B:** Require supervisor auth. | **Auto-release reservation with WorkflowEvent audit.** | Head of Operations | Phase S3 |
| **DECISION 6** | **GL Accounting Timing** | Runtime sales pipeline disconnected from GL. | **Opt A:** Wire GL immediately.<br>**Opt B:** Separate Phase S7. | **Separate Phase S7 (Dedicated Accounting Phase).** | Chief Financial Officer | Phase S7 |
| **DECISION 7** | **Document Numbering Scope** | Global `UNIQUE` constraints in PostgreSQL. | **Opt A:** Company-scoped.<br>**Opt B:** Branch-scoped. | **Compound UNIQUE(company_id, document_no).** | Chief Software Architect | Phase S1 |
| **DECISION 8** | **Stockist Depot Fulfillment** | Direct invoice distribution. | **Opt A:** Model A.<br>**Opt B:** Model B. | **Align with Wholesale decision (Model B).** | Head of Logistics | Phase S5 |
| **DECISION 9** | **Over-Delivery Tolerance** | Overbilled quantity column exists, unconstrained. | **Opt A:** Strict zero tolerance.<br>**Opt B:** Defined percentage (e.g. 5%). | **Strict zero tolerance unless contractually approved.** | Commercial Director | Phase S5 |

---

## 18. Mandatory Architecture Principles

1. **SMRITI is the Product:** No third-party platform assumptions; proprietary architectural sovereignty.
2. **Universal Lifecycle Engine is Generic:** Zero document-type branching inside the universal kernel.
3. **Pluggable Handlers:** Document-specific business rules belong exclusively to dedicated handler classes.
4. **Ledger is Authority:** `stock_movements` and `general_ledger_entries` are the sole transactional authorities.
5. **Master / Cache Fields are Derived:** Master fields (`Product.stock`, `Customer.outstanding`) are derived read caches, never direct mutation targets.
6. **Multi-Tenant Isolation is Non-Negotiable:** All primary documents and line items carry compound tenant scoping.
7. **No Destructive Deletion:** Cancelled documents remain queryable with `is_deleted=True` and status `CANCELLED`.
8. **Audited State Transitions:** Every lifecycle transition records an immutable `WorkflowEvent`.
9. **Optimistic Concurrency:** State changes require version matching (`version + 1`).
10. **Retail Must Remain Fast:** Retail checkout must never be gated behind wholesale multi-step fulfillment barriers.
11. **Wholesale Must Support Operational Realities:** Wholesale must accommodate loading shortages and pick splits.
12. **Single Stock Authority:** No transaction shall allow competing stock deduction mechanisms.

---

## 19. Explicit Non-Goals (Boundaries for this Phase)

* **NON-GO 1:** DO NOT touch Purchase Phase 2.1 code, models, or tests (FROZEN).
* **NON-GO 2:** DO NOT write migration v1515 until Decision 7 is signed off.
* **NON-GO 3:** DO NOT implement Sales 3-Way Matching until Decisions 1 and 3 are frozen.
* **NON-GO 4:** DO NOT implement General Ledger journal entries during Sales workflow remediation.
* **NON-GO 5:** DO NOT seed arbitrary approval thresholds into production databases.
* **NON-GO 6:** DO NOT modify any existing source code or test files in Phase 0.2.

---

## 20. Final Release Gate

No production release candidate for the Sales domain shall be approved until:
* [ ] Management Decision Register (Decisions 1–9) signed off by commercial leadership.
* [ ] Schema migration v1515 applied establishing compound tenant uniqueness.
* [ ] Line-item models elevated to `BaseEntity` parity.
* [ ] Dual stock writer hazard eliminated.
* [ ] Pluggable lifecycle handlers active for all Sales documents.
* [ ] Sales automated test battery achieving **88/88 passed (0 failures, 0 errors)**.
* [ ] Purchase Phase 2.1 confirmed 100% green and undisturbed.
