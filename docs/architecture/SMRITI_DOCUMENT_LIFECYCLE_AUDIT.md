<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.47.4
  Created      : 2026-10-01
  Modified     : 2026-10-01
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# SMRITI Universal Document Lifecycle Framework
## Phase 0 — Cross-Module Read-Only Architecture Audit

---

## 1. Executive Summary

This architecture audit evaluates the state machine, workflow, approval, audit, authorization, numbering, and downstream ledger mechanics across all transaction document entities in **SMRITI Retail OS**. The objective is to design a unified, configuration-driven **Universal Document Lifecycle Framework** capable of supporting all transactional document types, with **Purchase Order (PO)** serving as the first pilot implementation.

### Key Audit Findings

1. **Rich Existing Building Blocks, Disconnected Execution:**
   SMRITI already contains the primary database tables, models, and domain engines needed for an enterprise lifecycle system:
   - Declarative workflow metadata table `workflow_definitions` (`backend/app/models/governed_logic.py`, Alembic `v1363_governed_logic.py`).
   - Pure transition evaluator `GovernedRuleEngine.evaluate_workflow_transition` (`backend/app/services/governed_rules.py`).
   - Immutable audit transition log `workflow_events` (`backend/app/models/workflow.py`, Alembic `g3h4i5j6k7l8_add_workflow_events_table.py`).
   - Complete multi-tier approval system `ApprovalPolicy`, `ApprovalRequest`, `ApprovalAction`, and `ApprovalEngine` (`backend/app/models/approval.py`, `backend/app/services/approval_engine.py`, Alembic `v1385_crm_and_approvals.py`).
   - Granular action-level security `SmritiPermission` (`smriti_permissions`), `security_matrix.py`, and `require_permission` in `backend/app/api/deps.py`.
   - Sequential document series engine `DocumentSeries`, `NumberingService`, and `NumberingAuditLog` (`backend/app/models/numbering.py`).
   - Authoritative double-entry and inventory ledgers (`UnifiedLedgerService`, `StockMovement`, `ProductBatchStock`, `GeneralLedgerEntry`).

2. **The Core Architectural Gap — Disconnected Silos:**
   Despite having these sophisticated engines, **no orchestration layer connects them**.
   - `backend/app/api/v1/workflow.py` was created as an ad-hoc router (AD-3 resolution) hardcoding transitions for only three entities (`PurchaseOrder`, `SalesInvoice`, `SalesQuotation`). It completely bypasses `workflow_definitions`, `GovernedRuleEngine`, and `ApprovalEngine`.
   - Domain services (`PurchaseService`, `SalesService`) implement bespoke state transitions in parallel, often directly mutating document statuses without emitting `WorkflowEvent` audit rows.
   - `ApprovalEngine` evaluates financial policy thresholds, but neither `workflow.py` nor domain controllers invoke it during document submission or confirmation.
   - Status strings suffer from casing fragmentation (`DRAFT`/`CONFIRMED`/`SUBMITTED` in Purchase vs. `Draft`/`Confirmed`/`Submitted` in Sales).

3. **Zero-Migration Opportunity:**
   Because all core relational tables (`workflow_definitions`, `workflow_events`, `approval_policies`, `approval_requests`, `approval_actions`, `document_series`) **already exist in PostgreSQL**, the target Universal Document Lifecycle Framework requires **ZERO database migrations** and **ZERO destructive data mutations**. The framework can be realized purely through configuration and service orchestration.

---

## 2. Existing Lifecycle Architecture

The codebase currently contains two disconnected workflow layers:

```
┌────────────────────────────────────────────────────────────────────────┐
│                   CURRENT FRAGMENTED ARCHITECTURE                      │
├──────────────────────────────────┬─────────────────────────────────────┤
│  Layer A: Declarative Metadata   │  Layer B: Imperative Execution      │
│  (smritisys / Governed Rules)    │  (Core Workflow API / AD-3)         │
├──────────────────────────────────┼─────────────────────────────────────┤
│ • Model: WorkflowDefinition      │ • Model: WorkflowEvent              │
│   (workflow_definitions)         │   (workflow_events)                 │
│ • Service: GovernedRuleEngine    │ • Router: api/v1/workflow.py        │
│   .evaluate_workflow_transition  │ • Hardcoded docTypes:               │
│ • API: api/v1/governed_logic.py  │   - PurchaseOrder (submit, cancel)  │
│   POST /workflows/transition     │   - SalesInvoice (approve, cancel)  │
│ • Status: PURE EVALUATION ONLY   │   - SalesQuotation (approve, cancel)│
│   Does not load document, does   │ • Status: DIRECT MUTATION           │
│   not check approvals, does not  │   Bypasses WorkflowDefinition,      │
│   invoke downstream actions.     │   bypasses ApprovalEngine.          │
└──────────────────────────────────┴─────────────────────────────────────┘
```

### Layer A: Declarative Metadata (`backend/app/models/governed_logic.py`)
- **Table:** `workflow_definitions` (Alembic `v1363_governed_logic.py`)
- **Columns:** `id`, `uuid`, `code`, `version`, `doc_type`, `name`, `initial_state`, `states` (JSONB array), `transitions` (JSONB array of `{from, to, action, required_roles}`), `is_active`, `status`.
- **Seeded Example:** `ctrl_seeder.py` line 683 seeds `WF_SALES_INVOICE` with states `["DRAFT", "PENDING_APPROVAL", "APPROVED", "CANCELLED"]` and transitions for `APPROVE`, `SUBMIT_FOR_APPROVAL`, and `REJECT`.
- **Evaluator:** `GovernedRuleEngine.evaluate_workflow_transition` (`backend/app/services/governed_rules.py` line 270) matches `(from, action)` against the transition graph and validates `user_roles`.
- **Limitation:** It is a stateless validator. It does not load entities, does not persist state changes, does not check financial approval gates, and does not execute downstream ledger effects.

### Layer B: Imperative Router (`backend/app/api/v1/workflow.py`)
- **Router:** `POST /api/v1/workflow/{doc_type}/{doc_id}/{action}`
- **Audit Table:** `workflow_events` (`id`, `doc_type`, `doc_id`, `action`, `from_status`, `to_status`, `performed_by_id`, `performed_by_name`, `company_id`, `branch_id`, `notes`, `created_at`).
- **Defects:**
  1. Hardcodes `_SUPPORTED = {"PurchaseOrder": {"submit", "cancel"}, "SalesInvoice": {"approve", "cancel"}, "SalesQuotation": {"approve", "cancel"}}`.
  2. For `PurchaseOrder`, it calls `purchase_svc.submit_purchase_order(doc_id)` but hardcodes audit log `from_status="DRAFT"`, `to_status="CONFIRMED"`, contradicting `PurchaseService` which sets `SUBMITTED`.
  3. For `SalesInvoice`, it calls `sales_svc.approve_sales_invoice(doc_id)` and hardcodes `from_status="Draft"`, `to_status="Confirmed"`.
  4. For `SalesQuotation`, it directly mutates `SalesQuotation.status = "Approved"` inside the router, bypassing any service layer.
  5. It does not consult `workflow_definitions` or `ApprovalEngine`.

---

## 3. Document Inventory

The table below catalogs all major transaction/document entities currently existing in the SMRITI codebase:

| Document Type | Backend Model | Database Table | Primary API Router | Service Layer | Status Field | Status Values | Approval Support | Audit Support | Revision Support | Permission Support | Tenant Support | Current Lifecycle Flow |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Purchase Order** | `PurchaseOrder` (`purchase.py`) | `purchase_orders` | `/api/v1/purchase/orders` | `PurchaseService` | `status` | `DRAFT`, `SUBMITTED`, `CONFIRMED`, `RECEIVED`, `COMPLETED`, `CANCELLED` | Supported in schema; unhooked in execution | `workflow_events` (via workflow API only) + audit columns (`submitted_at`, `confirmed_at`) | `parent_order_id`, `amend_revision` | `require_role(MANAGER, SYSADMIN)` | `company_id`, `branch_id` (`BaseEntity`) | `DRAFT` → `SUBMITTED` → `CONFIRMED` → `RECEIVED` → `COMPLETED` \| `CANCELLED` \| `AMENDED` |
| **Goods Receipt (GRN - Legacy/PO)** | `PurchaseReceipt` (`purchase.py`) | `purchase_receipts` | `/api/v1/purchase/receipts` | `PurchaseService` | `status` | `PENDING`, `RECEIVED` | None | Audit notes string | None | `require_role(MANAGER, SYSADMIN)` | `company_id`, `branch_id` | `PENDING` → `RECEIVED` |
| **Goods Receipt (GRN - Canonical)** | `GoodsReceiptNote` (`goods_receipt.py`) | `goods_receipt_notes` | `/api/v1/grn` | `GoodsReceiptNote` (ORM direct / service) | `status` | `DRAFT`, `POSTED`, `CANCELLED` | None | Dedicated audit columns (`posted_by`, `posted_at`, `cancelled_by`) | None | Role & permission | `company_id`, `branch_id` | `DRAFT` → `POSTED` \| `CANCELLED` |
| **Purchase Bill** | None (Schema only: `PurchaseBillCreate`) | None (Outbox event + `journal_vouchers`) | `/api/v1/purchase/bills` | `PurchaseService` | None (Implicit `POSTED`) | `POSTED` | None | Outbox event `PURCHASE_BILL_POSTED` | None | Role guard | `company_id`, `branch_id` | Event-driven (no persistent document state machine) |
| **Purchase Return / Debit Note** | None (Schema only: `DebitNoteCreate`) | None (Outbox event + ledger) | `/api/v1/purchase/debit-notes` | `PurchaseService` | None (Implicit `POSTED`) | `POSTED` | None | Outbox event `DEBIT_NOTE_POSTED` | None | Role guard | `company_id`, `branch_id` | Event-driven (no persistent document state machine) |
| **Purchase Request** | **MISSING** | **MISSING** | **MISSING** | **MISSING** | N/A | N/A | N/A | N/A | N/A | N/A | N/A | Module does not exist in codebase |
| **Sales Order** | `SalesOrder` (`sales.py`) | `sales_orders` | `/api/v1/sales/orders` | `SalesService` | `status`, `fulfillment_status` | `status`: `Draft`, `Submitted`, `Approved`, `Rejected`, `Confirmed`, `Shipped`, `Cancelled`<br>`fulfillment`: `UNFULFILLED`, `PARTIALLY_BILLED`, `FULLY_BILLED` | Policy evaluated via `PolicyDefinition` | Column timestamps (`closed_at`, `closed_by`) | Allocation links (`SalesOrderInvoiceAllocation`) | Role guard | `company_id`, `branch_id` (`BaseEntity`) | `Draft` → `Submitted` → `Approved`/`Confirmed` → `Shipped` \| `Cancelled` |
| **Sales Invoice** | `SalesInvoice` (`sales.py`) | `sales_invoices` | `/api/v1/sales/invoices`, `/api/v1/billing` | `CanonicalSalesPostingWriter`, `SalesService` | `status`, `e_invoice_status` | `status`: `Draft`, `Submitted`, `Confirmed`, `Cancelled`<br>`e_invoice`: `NOT_APPLICABLE`, `PENDING`, `GENERATED`, `FAILED` | Supported via `ApprovalPolicy` / `ApprovalEngine` (unhooked) | `workflow_events` (via workflow API), `ComplianceImmutableAuditLog` | None (Immutable tax invoice law) | `require_permission("sales_billing", "...")` | `company_id`, `branch_id` (`BaseEntity`) | POS/B2B: `Submitted` (immediate posting)<br>Quotation convert: `Draft` → `Confirmed` |
| **Sales Quotation** | `SalesQuotation` (`sales.py`) | `sales_quotations` | `/api/v1/sales/quotations` | `SalesService` | `status` | `Draft`, `Submitted`, `Approved`, `Rejected`, `Cancelled`, `Converted` | Unhooked | Direct modification in router | Conversion link `sales_order_id` | Role guard | `company_id`, `branch_id` (`BaseEntity`) | `Draft` → `Submitted` → `Approved` → `Converted` \| `Cancelled` |
| **Sales Return** | `SalesReturn` (`sales.py`) | `sales_returns` | `/api/v1/sales/returns` | `SalesService` | `status` | `Draft`, `Submitted`, `Approved`, `Cancelled` | `SalesReturnPolicyResolver` | Snapshot JSONB | Credit note link | Role guard | `company_id`, `branch_id` (`BaseEntity`) | `Draft` → `Submitted` → `Approved` \| `Cancelled` |
| **Stock Transfer** | `StockTransfer` (`inventory.py`) | `stock_transfers` | `/api/v1/inventory/transfers` | `InventoryService` | `status` | `DRAFT`, `DISPATCHED`, `IN_TRANSIT`, `RECEIVED`, `PARTIAL`, `CANCELLED` | Supported in `WorkflowDefinition` seed | Timestamp columns (`dispatch_date`, `received_date`) | None | Role guard | `company_id`, `branch_id` (`BaseEntity`) | `DRAFT` → `DISPATCHED` → `IN_TRANSIT` → `RECEIVED` \| `PARTIAL` \| `CANCELLED` |
| **Payment Transaction** | `PaymentTransaction` (`payment_ledger.py`) | `payment_transactions` | `/api/v1/payments` | `PaymentsEngine` | `status` | `SUCCESS`, `REVERSED`, `FAILED`, `PENDING` | None | Immutable ledger row | Allocations (`PaymentAllocation`) | Role guard | `company_id`, `branch_id` (`BaseEntity`) | `PENDING` → `SUCCESS` \| `FAILED` \| `REVERSED` |
| **Supplier Payment** | `SupplierPayment` (`supplier_payment.py`) | `supplier_payments` | `/api/v1/purchase/supplier-payments` | `PurchaseService` | None (Atomic debit) | Immediate settlement | None | Immutable ledger row | None | Role guard | `company_id`, `branch_id` (`BaseEntity`) | Direct ledger decrement |
| **Distribution Order** | `DistributionOrder` (`distribution.py`) | `distribution_orders` | `/api/v1/distribution/orders` | `DistributionService` | `status` | `DRAFT`, `CONFIRMED`, `LOADED`, `DISPATCHED`, `DELIVERED`, `SETTLED`, `CANCELLED` | Unhooked | Timestamps | Route stops | Role guard | `company_id`, `branch_id` (`BaseEntity`) | Multi-stage dispatch workflow |

---

## 4. Purchase Order Audit (Phase 0C)

### 4.1 Order Creation & Status Persistence
In `backend/app/services/purchase.py`:
- `create_purchase_order(req: PurchaseOrderCreate)`:
  - Allocates sovereign identity code via `IdentityEngine.allocate_internal(entity_type="PURCHASE_ORDER")`.
  - Lines 407–412 inspect `req.status`:
    ```python
    _ALLOWED_CREATE_STATUSES = {"DRAFT", "SUBMITTED", "CONFIRMED"}
    raw_status = str(req.status or "DRAFT").strip().upper()
    if raw_status not in _ALLOWED_CREATE_STATUSES:
        raw_status = "DRAFT"
    po_status = raw_status if raw_status == "DRAFT" else "DRAFT"
    ```
  - **Defect Identified:** Line 412 forcibly sets `po_status = "DRAFT"` regardless of whether `raw_status` was `"SUBMITTED"` or `"CONFIRMED"`. While intended as a security guard to prevent client payloads from self-confirming, it causes any explicit save action specifying a higher state to silently downgrade to `DRAFT`.
  - Frontend `src/components/purchase/PoGenerateTab.tsx` line 1015 sends `status: "Draft"`.

### 4.2 Lifecycle Transitions
- **Submit (`DRAFT` → `SUBMITTED`):**
  - Implemented in `PurchaseService.submit_purchase_order` (`backend/app/services/purchase.py` line 1649).
  - Validates `order.status == "DRAFT"`.
  - Updates `status = "SUBMITTED"`, records `submitted_by` and `submitted_at = now`.
  - Endpoint: `POST /api/v1/purchase/orders/{order_id}/submit`.
- **Confirm (`SUBMITTED` → `CONFIRMED`):**
  - Implemented in `PurchaseService.confirm_purchase_order` (line 1679).
  - Validates `order.status == "SUBMITTED"`.
  - Updates `status = "CONFIRMED"`, records `confirmed_by` and `confirmed_at = now`.
  - Endpoint: `POST /api/v1/purchase/orders/{order_id}/confirm`.
- **Contradiction with Core Workflow API:**
  - `backend/app/api/v1/workflow.py` line 144:
    ```python
    if doc_type == "PurchaseOrder":
        if action == "submit":
            result = await purchase_svc.submit_purchase_order(doc_id)
            await _log_event(db, doc_type, doc_id, action,
                             from_status="DRAFT", to_status="CONFIRMED",
                             user=current_user, tenant_ctx=tenant_ctx)
            await db.commit()
            return result
    ```
  - The Core Workflow router claims in docstring and in `_log_event` that `submit` moves `DRAFT` → `CONFIRMED`. However, `purchase_svc.submit_purchase_order` actually transitions to `SUBMITTED`. The audit log in `workflow_events` records a false `to_status="CONFIRMED"` while the database row has `status="SUBMITTED"`.

### 4.3 Cancellation & Destructive Flag Defect
- Implemented in `PurchaseService.cancel_purchase_order` (line 1400).
- Accepts structured reason codes (e.g., `VENDOR_UNAVAILABLE`, `PRICE_DISAGREEMENT`, `ORDER_ABANDONED`).
- Records `cancelled_by`, `cancelled_at`, and `cancellation_reason`.
- **Architectural Policy Violation:**
  Line 1425 sets:
  ```python
  order.status = "CANCELLED"
  order.is_deleted = True
  order.deleted_at = now
  ```
  Setting `is_deleted = True` violates Safety Rule 9 ("No destructive deletion of business documents") and Safety Rule 10 ("Historical confirmed state must remain traceable"). Because `get_purchase_order` filters by `is_deleted == False`, a cancelled PO becomes unqueryable through standard detail endpoints unless an explicit bypass is used.

### 4.4 Amendment & Revision Chain
- Implemented in `PurchaseService.amend_purchase_order` (line 1451).
- Can only amend `CONFIRMED` POs.
- Sets original PO `status = "CANCELLED"`, `is_deleted = True`, `amended_by`, `amended_at`.
- Creates a new `CONFIRMED` PO with `parent_order_id = original.id` and `amend_revision = original.amend_revision + 1`.
- History traversal: `get_amendment_history` performs a 20-hop root traversal and BFS collection of the amendment tree.
- Defect: Same as cancellation — soft-deleting the predecessor breaks standard relational joins unless `is_deleted` is ignored.

---

## 5. Sales Findings (SO & Quotation)

### 5.1 Sales Quotation
- Model: `SalesQuotation` (`sales_quotations` table).
- Lifecycle: `Draft` → `Submitted` → `Approved` → `Converted` | `Cancelled` | `Rejected`.
- In `backend/app/api/v1/workflow.py`, `approve` directly executes SQL update statements without invoking any domain service, setting `status = "Approved"`.
- Conversion: `SalesService.convert_quotation_to_invoice` transforms an `Approved` quotation into a `SalesInvoice`, marking the quotation as `Converted`.

### 5.2 Sales Order
- Model: `SalesOrder` (`sales_orders` table).
- Lifecycle: `Draft` → `Submitted` → `Approved` / `Confirmed` → `Shipped` | `Cancelled`.
- Dual Status: Tracks both workflow status and `fulfillment_status` (`UNFULFILLED`, `PARTIALLY_BILLED`, `FULLY_BILLED`).
- Line Item Status: Each line item (`SalesOrderItem`) maintains `line_status` (`OPEN`, `PARTIALLY_BILLED`, `BILLED`, `CLOSED`, `CANCELLED`).
- Stock Linkage: Holds inventory reservations via `SalesOrderReservation` keyed by barcode, but does not alter physical batch stock until invoiced.

---

## 6. Invoice Findings (Sales Invoice & Purchase Bill)

### 6.1 Sales Invoice
- Model: `SalesInvoice` (`sales_invoices` table).
- Primary Writer: `CanonicalSalesPostingWriter.post_sales_transaction` (`backend/app/services/canonical_sales_writer.py`).
- Ingress Behavior:
  - When POS or B2B sales invoices are posted, `CanonicalSalesPostingWriter` sets `status = "Submitted"` immediately (line 548).
  - Downstream effects occur **at creation time**: physical stock is decremented via `StockMovement` and `ProductBatchStock`, payment allocations are recorded in `PaymentTransaction`, and an outbox event is staged.
  - Secondary Approval: `POST /api/v1/workflow/SalesInvoice/{id}/approve` (or `SalesService.approve_sales_invoice`) moves `Draft` or `Submitted` → `Confirmed`. However, this approval is cosmetic: the physical stock and financial payments have already been executed during initial posting.
- Statutory Immutability: Per Policy STIF-IMMUTABLE-v1.0, posted tax invoices cannot be mutated. Adjustments must use Credit/Debit Notes or formal cancellation.

### 6.2 Purchase Bill
- There is **no dedicated `purchase_bills` table** in PostgreSQL.
- Handled in `PurchaseService.create_purchase_bill` as an outbox event `PURCHASE_BILL_POSTED` and mapped in `UnifiedLedgerService` to `JournalVoucher(voucher_type="PURCHASE_BILL")`.
- No independent state machine exists for supplier bills.

---

## 7. Inventory/Stock Findings (GRN & Stock Transfer)

### 7.1 Goods Receipt Note (GRN) Dual Model
The codebase contains two competing Goods Receipt Note models:
1. `PurchaseReceipt` (`purchase_receipts` table, `purchase.py`):
   - Created on initial receipt with status `RECEIVED`.
   - Directly triggers WMS stock increments and updates linked `PurchaseOrder.status = "RECEIVED"`.
2. `GoodsReceiptNote` (`goods_receipt_notes` table, `goods_receipt.py`):
   - Created on 2026-09-23 as the canonical GRN.
   - Status: `DRAFT` → `POSTED` | `CANCELLED`.
   - Posting triggers `InwardStockMovement`, three-way match against the linked PO, and landed cost component allocations.

### 7.2 Stock Transfer
- Model: `StockTransfer` (`stock_transfers` table, `backend/app/models/inventory.py`).
- Status Flow: `TransferStatus` enum:
  `DRAFT` → `DISPATCHED` → `IN_TRANSIT` → `RECEIVED` | `PARTIAL` | `CANCELLED`.
- Physical Ledger Effect:
  - `DISPATCHED`: Stock removed from source warehouse (`TRANSFER_OUT`).
  - `RECEIVED`: Stock added to destination warehouse (`TRANSFER_IN`).

---

## 8. Existing Approval Engine Audit (Phase 0D)

SMRITI possesses an advanced, dedicated Approval Matrix engine located in `backend/app/models/approval.py` and `backend/app/services/approval_engine.py` (Alembic migration `v1385_crm_and_approvals.py`).

```
┌────────────────────────────────────────────────────────────────────────┐
│                        SMRITI APPROVAL ENGINE                          │
├────────────────────────────────────────────────────────────────────────┤
│  ApprovalPolicy (approval_policies)                                    │
│  - code, document_type, min_amount, max_amount, required_role, priority│
│                                ↓                                       │
│  ApprovalRequest (approval_requests)                                   │
│  - request_no, reference_doc_type, reference_doc_id, document_amount,  │
│    status (PENDING, APPROVED, REJECTED, CANCELLED), assigned_role      │
│                                ↓                                       │
│  ApprovalAction (approval_actions)                                     │
│  - action (APPROVE, REJECT, REQUEST_CHANGES), action_by, role, comments│
└────────────────────────────────────────────────────────────────────────┘
```

### Direct Assessment of Phase 0D Criteria

1. **Is approval reusable across document types?**
   **YES.** `ApprovalPolicy.document_type` is a generic string (e.g. `PURCHASE_ORDER`, `SALES_INVOICE`, `CREDIT_MEMO`). `ApprovalRequest` links to any document via `reference_doc_type` and `reference_doc_id`.
2. **Is document type configurable?**
   **YES.** Policies can be created dynamically via `POST /api/v1/approvals/policies` without altering code.
3. **Can different documents have different approval rules?**
   **YES.** Policies are filtered by `company_id` and `document_type`.
4. **Can approval be conditional?**
   **YES.** Policies trigger based on financial amount brackets (`min_amount <= amount <= max_amount`) and priority ordering.
5. **Can multiple approval levels exist?**
   **PARTIAL.** `ApprovalEngine` enforces a 6-tier role hierarchy:
   `CASHIER (1) < SALES_EXECUTIVE (2) < STORE_MANAGER (3) < FINANCE_CONTROLLER (4) < DIRECTOR (5) < SYSADMIN (10)`.
   It checks `caller_level >= required_level` and supports manual escalation (`escalate_approval_request`). However, it does not currently execute automated sequential approval chains (e.g. Step 1 Manager, then automatically Step 2 Director).
6. **Can rejection return a document to Draft?**
   **PARTIAL.** `ApprovalAction` records `REJECT` (setting request status to `REJECTED`) or `REQUEST_CHANGES` (setting request status to `CHANGES_REQUESTED`). However, **no callback exists** to update the underlying business document (such as `PurchaseOrder.status = "DRAFT"`).
7. **Is approval tenant/company scoped?**
   **YES.** `ApprovalPolicy`, `ApprovalRequest`, and `ApprovalAction` inherit `BaseEntity` and explicitly filter and enforce `company_id`.
8. **Are approval actions audited?**
   **YES.** Every decision generates an immutable row in `approval_actions` capturing `request_id`, `action`, `action_by`, `action_by_role`, `comments`, and `action_at`.

**Conclusion:** The engine is production-grade and fully reusable. It must not be rebuilt. It only requires an integration adapter connecting document transitions to `ApprovalEngine.check_transaction_enforcement`.

---

## 9. Existing Audit Engine Audit (Phase 0E)

The codebase contains three separate audit facilities:

| Audit Facility | Model & Table | Scope & Purpose | Represent Lifecycle Transitions? | What It Captures |
| :--- | :--- | :--- | :--- | :--- |
| **Workflow Event Audit** | `WorkflowEvent`<br>(`workflow_events`) | Core Document State Machine Transitions | **YES (Exact Match)** | Who (`performed_by_id`, `performed_by_name`), When (`created_at`), Document (`doc_type`, `doc_id`), Action (`action`), Old State (`from_status`), New State (`to_status`), Reason/Notes (`notes`), Tenant (`company_id`, `branch_id`). |
| **Entity Configuration Audit** | `SmritiAuditLog`<br>(`smriti_audit_log`) | System, menu, master data, and configuration changes | **PARTIAL** (Field-level mutation diffs) | `changed_table`, `changed_record_id`, `field_name`, `old_value`, `new_value`, `change_type`, `change_reason`, `changed_by`, `sha256_hash`. |
| **Immutable Compliance Log** | `ComplianceImmutableAuditLog`<br>(`compliance_immutable_audit_logs`) | Regulatory financial audit with SHA-256 hash chaining (Section 12 WORM) | **YES (Overkill for internal draft/submit transitions)** | `event_type`, `entity_name`, `entity_id`, `actor_user_id`, `payload_hash`, `previous_hash`, `before_state_json`, `after_state_json`. |

**Recommendation:** `WorkflowEvent` is the exact model intended for document lifecycle audit. It captures all nine required attributes (`Who`, `When`, `Document`, `Action`, `Old State`, `New State`, `Reason`, `Revision`, `Tenant`). The framework should standardize all transitions across all modules onto `WorkflowEvent`.

---

## 10. Permission / RBAC Audit (Phase 0F)

### 10.1 Existing RBAC Capabilities
1. **Coarse Role Enums:** `UserRole` (`SYSADMIN`, `MANAGER`, `CASHIER`, `REPORT_USER`, `VIEWER`) in `backend/app/models/auth.py`.
2. **Custom Role Definitions:** `Role` (`roles` table) with `permissions_json` list.
3. **Granular Action Security:** `SmritiPermission` (`smriti_permissions` table) in `backend/app/models/security.py`:
   - Columns: `code`, `resource`, `action`, `scope`, `module`, `tenant_id`, `is_active`.
   - Scope examples: `User:002`, `Group:002`, `Node:NODE-01`.
4. **Authoritative Evaluator:** `evaluate_action_permission` (`backend/app/core/security_matrix.py` line 92):
   - Precedence:
     1. `SYSADMIN` wildcard (`*`).
     2. User-specific explicit grant/denial in `smriti_permissions` (tenant-scoped).
     3. Assigned role permissions in `roles.permissions_json` (supports `{resource}.{action}` and `{resource}.*`).
     4. Default scoped role rules (`MANAGER` standard operations; `CASHIER` POS operations).
5. **Guard Factory:** `require_permission(resource, action)` in `backend/app/api/deps.py` line 430 raises standardized business error `SMRITI-AUTH-001`.

### 10.2 Mapping to Generic `document_type + action`
The existing architecture natively supports `(document_type, action)` permissions without creating any new tables:
- `resource`: normalized document type (e.g. `purchase_order`, `sales_order`, `goods_receipt`).
- `action`: lifecycle action (e.g. `CREATE`, `VIEW`, `EDIT`, `SUBMIT`, `APPROVE`, `CONFIRM`, `CANCEL`, `AMEND`, `RECEIVE`, `PRINT`).
- Example permission strings: `purchase_order.submit`, `purchase_order.approve`, `sales_order.confirm`.

---

## 11. Revision / Amendment Audit (Phase 0G)

### 11.1 Concurrency Locking vs. Business Revision
Inspection of `BaseEntity.version` in `backend/app/db/base.py` and repository layer in `backend/app/repositories/base.py` line 76:
```python
if hasattr(db_obj, "version") and isinstance(db_obj.version, int):
    db_obj.version = db_obj.version + 1
```
- **Evidence:** `BaseEntity.version` increments on **every row update or soft-delete**. If a user edits a draft PO description three times before submitting, `version` becomes 4.
- **Interpretation:** `BaseEntity.version` is strictly an **optimistic concurrency locking mechanism**. It is **NOT** a business revision counter.
- **Rule:** Do NOT reuse `BaseEntity.version` as a business revision number.

### 11.2 Business Amendment Mechanism
- `PurchaseOrder` has dedicated fields:
  - `parent_order_id`: foreign key to predecessor order.
  - `amend_revision`: integer (0 for original, 1 for R1, 2 for R2).
  - `amended_by`, `amended_at`: audit tracking.
- Safe amendment pattern:
  1. Original document remains in the database with status `AMENDED` / `SUPERSEDED`.
  2. Original document MUST NOT have `is_deleted = True` (reversing the current defect).
  3. Replacement document references `parent_order_id = original.id` with `amend_revision = original.amend_revision + 1`.
  4. Historical lineage is queryable through the parent-pointer graph.

---

## 12. Tenancy Audit (Phase 0H)

### 12.1 Isolation Layers
- **Control Plane (`smritisys`):** Holds global catalogues, icons, system users, and global definitions.
- **Tenant Scope (`company_id`):** Primary tenant boundary (e.g. `COMP-001`). Enforced via `get_tenant_context` and `get_company_db`.
- **Branch Scope (`branch_id`):** Physical location boundary (e.g. `BR-MAIN-001`).
- **User Scope (`user_id`):** Authenticated actor context.

### 12.2 Cross-Tenant Protection & Gaps
- **Protected Paths:**
  `PurchaseService` and `SalesService` universally inject `where(Model.company_id == self.tenant.company_id)`. If a user from Company A submits an ID belonging to Company B, the query returns 404.
- **Identified Gaps:**
  In `backend/app/api/v1/workflow.py`:
  - `SalesQuotation` explicitly filters by `company_id` and `branch_id`.
  - For `PurchaseOrder` and `SalesInvoice`, the router delegates to service methods which enforce `company_id`.
  - However, `workflow_events` filtering in `list_workflow_events` only checks `company_id` and `branch_id` without verifying user permission to read the underlying document.

---

## 13. Numbering Audit (Phase 0J)

### 13.1 Numbering Engines
SMRITI operates two parallel numbering engines:
1. **Governed Engine (`DocumentSeries` & `NumberingService`):**
   - Configurable per `document_type`, `company_id`, `branch_id`, and `terminal_id`.
   - Supports reset rules (`Financial Year`, `Calendar Year`, `Monthly`, `Never`).
   - Supports segment formats (`PREFIX_NUM_SUFFIX`, `PREFIX_YEAR_SEP_NUM`, `NUM_ONLY`, `PREFIX_SEP_NUM`).
   - Validates statutory GST Rule 46(b) (max 16 alphanumeric characters).
   - Generates audit rows in `numbering_audit_logs`.
   - Used by: Sales Invoices.
2. **Ad-Hoc Regex Max Scan (`PurchaseService.get_next_order_number`):**
   - Scans existing `purchase_orders.order_no` matching `{prefix}-{digits}` and returns `max + 1`.
   - Does NOT use `document_series`.
   - Susceptible to race conditions when multiple users draft orders simultaneously.

### 13.2 Timing and Gap Analysis
- **Draft Allocation:** Both Purchase Orders and Sales Invoices consume document numbers at creation time (`DRAFT` / `Submitted`).
- **Gaps on Rollback:** `NumberingService.generate_next_number` executes `await self.db.commit()` inside the allocation method. If the calling document transaction subsequently fails or aborts, the sequence counter has already been advanced, creating a gap. Counters are not restored on rollback.

---

## 14. Ledger / Downstream Effect Audit (Phase 0I)

The table below catalogs downstream mutations triggered by each document lifecycle state:

| Document Type | Lifecycle State | Stock Movement | Batch Stock Mutation | Inventory Reservation | Liability Entry | Accounting GL Entry | Downstream Document Generated |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Purchase Order** | `DRAFT` | None | None | None | None | None | None |
| | `SUBMITTED` | None | None | None | None | None | None |
| | `CONFIRMED` | None | None | None | None | None | Unlocks GRN creation |
| | `RECEIVED` | None | None | None | None | None | Marked by GRN receipt |
| | `COMPLETED` | None | None | None | None | None | None |
| | `CANCELLED` | None | None | None | None | None | Prevents GRN receipt |
| **Goods Receipt (GRN)** | `DRAFT` | None | None | None | None | None | None |
| | `POSTED` / `RECEIVED` | `INWARD_GRN` | Increments `quantity` on `ProductBatchStock` | None | Accrued purchase liability | Debit Inventory, Credit GRN Clearing (`UnifiedLedgerService`) | Updates linked PO status |
| **Sales Order** | `Draft` / `Submitted` | None | None | None | None | None | None |
| | `Confirmed` | None | None | Creates `SalesOrderReservation` | None | None | Unlocks dispatch / billing |
| | `Shipped` | None | None | Consumes `SalesOrderReservation` | None | None | Invoice generated |
| **Sales Invoice** | `Submitted` (POS/B2B) | `OUTWARD_SALE` | Decrements `quantity` on `ProductBatchStock` | Consumes SO reservation | Accounts Receivable / Cash | Debit Cash/Receivables, Credit Revenue & GST (`UnifiedLedgerService`) | `PaymentTransaction`, Outbox event |
| | `Confirmed` (Quotation) | None (if already posted) | None | None | None | None | None |
| **Stock Transfer** | `DRAFT` | None | None | None | None | None | None |
| | `DISPATCHED` | `TRANSFER_OUT` | Decrements source warehouse stock | None | None | Inventory in Transit | None |
| | `RECEIVED` | `TRANSFER_IN` | Increments dest warehouse stock | None | None | Closes In Transit | Completes transfer |

---

## 15. Frontend UX Audit (Phase 0L)

### 15.1 UI Component Duplication
- **Status Badges:**
  - `POStatusBadge` in `src/components/purchase/POWorkspaceTab.tsx` line 167.
  - `StatusBadge` in `src/components/PhysicalStockTab.tsx` line 83.
  - `StatusBadge` in `src/components/billing/BarcodeCSVImportModal.tsx` line 102.
  - `POProductStatusBadge` in `src/components/purchase/POProductStatusBadge.tsx` line 117.
  - Hardcoded status switch in `src/components/drilldown/DrillDownSidePanel.tsx` line 194.
- **Action Button Conditions:**
  - `POWorkspaceTab.tsx` lines 537–570 manually evaluates `isPOSubmittable(s) && isManager`, `isPOConfirmable(s) && isManager`, `isPOCancellable(s) && isManager`, and `isPOAmendable(s) && isManager`.
  - Other modules (e.g. Sales, Physical Stock) repeat similar ad-hoc boolean checks for their respective actions.

### 15.2 Missing Shared Frontend Primitives
1. `UniversalStatusBadge`: A single, shared component accepting `status` and `docType`, resolving standard colors, icons, and labels.
2. `DocumentActionToolbar`: A unified toolbar receiving allowed actions from the server and rendering standard Submit, Confirm, Approve, Amend, Cancel, and Print buttons.
3. `WorkflowTimelineDrawer`: A reusable audit timeline rendering chronological `WorkflowEvent` rows.

---

## 16. Duplication Findings (Phase 0P)

| Domain | Duplicated Element | Affected Locations | Proposed Shared Abstraction |
| :--- | :--- | :--- | :--- |
| **Backend State Machine** | Transition validation and state mutation | `api/v1/workflow.py`, `PurchaseService`, `SalesService`, `governed_rules.py` | `UniversalLifecycleEngine` |
| **Backend Audit Trail** | Recording state transition history | `api/v1/workflow.py` (`_log_event`), domain service notes | Centralized `WorkflowEvent` logging inside transition engine |
| **Frontend Status Badges** | Mapping status strings to badge styles | `POWorkspaceTab.tsx`, `PhysicalStockTab.tsx`, `BarcodeCSVImportModal.tsx`, `DrillDownSidePanel.tsx` | `UniversalStatusBadge.tsx` |
| **Frontend Action Guards** | Determining which action buttons to show | `poLifecycle.ts`, `POWorkspaceTab.tsx`, POS action menus | Server-driven `allowed_actions` payload + `DocumentActionToolbar.tsx` |
| **Status Casing** | Upper vs Title case status strings | `purchase.py` (`DRAFT`), `sales.py` (`Draft`) | Normalized canonical upper-case enum with backward-compatible parser |

---

## 17. Reusable Components (Phase 0Q)

The following components already exist and must be **reused without modification**:

1. **`WorkflowDefinition` model & table** (`backend/app/models/governed_logic.py`, table `workflow_definitions`): Reusable as the configuration storage for all document lifecycles.
2. **`WorkflowEvent` model & table** (`backend/app/models/workflow.py`, table `workflow_events`): Reusable as the universal immutable audit ledger.
3. **`GovernedRuleEngine.evaluate_workflow_transition`** (`backend/app/services/governed_rules.py`): Reusable for validating `{from, to, action, required_roles}` graphs.
4. **`ApprovalPolicy`, `ApprovalRequest`, `ApprovalAction` & `ApprovalEngine`** (`backend/app/services/approval_engine.py`): Reusable for multi-tier threshold governance.
5. **`SmritiPermission` & `evaluate_action_permission`** (`backend/app/core/security_matrix.py`): Reusable for granular `(doc_type, action)` security checks.
6. **`UnifiedLedgerService`** (`backend/app/services/unified_ledger.py`): Authoritative ledger handler for financial and inventory postings.

---

## 18. Missing Components (Phase 0Q)

To complete the framework without duplicate code, the following minimal components must be created:

1. **`DocumentLifecycleEngine` (Backend Service):**
   A unified service in `backend/app/services/lifecycle/` that:
   - Loads the document entity and current state.
   - Fetches the active `WorkflowDefinition` for `doc_type`.
   - Validates the transition using `GovernedRuleEngine.evaluate_workflow_transition`.
   - Evaluates caller permissions via `evaluate_action_permission`.
   - Evaluates financial approval gates via `ApprovalEngine.check_transaction_enforcement`.
   - Invokes registered domain hooks (e.g. `on_confirmed`, `on_cancelled`).
   - Appends an immutable `WorkflowEvent`.
   - Atomically commits the transition.
2. **`DocumentLifecycleHandler` Interface (Backend Protocol):**
   A clean protocol that domain services (e.g. `PurchaseService`, `SalesService`) implement to define their document-specific side effects.
3. **`UniversalStatusBadge` (Frontend Component):**
   A shared React component replacing local status badge duplicates.
4. **`DocumentActionToolbar` (Frontend Component):**
   A shared toolbar component driven by server-supplied `allowed_actions`.

---

## 19. Recommended Target Architecture

```
                    Incoming Workflow Request
                 POST /api/v1/lifecycle/{doc_type}/{doc_id}/{action}
                                   │
                                   ▼
             ┌───────────────────────────────────────────┐
             │       UniversalLifecycleEngine            │
             └─────────────────────┬─────────────────────┘
                                   │
      ┌────────────────────────────┼────────────────────────────┐
      ▼                            ▼                            ▼
Step 1: Context & Tenant     Step 2: State Graph          Step 3: RBAC Check
• TenantContext validation   • Load WorkflowDefinition    • evaluate_action_permission
• Document existence check     for doc_type                 (resource=doc_type,
• Optimistic concurrency     • evaluate_workflow_           action=action)
                               transition(from, action)
                                   │
                                   ▼
                             Step 4: Approval Gate
                             • Check ApprovalPolicy thresholds
                             • If required & caller lacks senior role:
                               create ApprovalRequest (status: PENDING)
                               halt auto-transition
                                   │
                                   ▼
                             Step 5: Domain Handler Hook
                             • Execute document-specific effects
                               (e.g., PO: update audit columns)
                               (e.g., GRN: trigger WMS stock increment)
                                   │
                                   ▼
                             Step 6: Immutable Audit
                             • Insert WorkflowEvent row
                               (doc_type, doc_id, action, from, to, actor)
                                   │
                                   ▼
                             Step 7: Atomic Commit & Response
                             • Return updated state & allowed_actions
```

### Architectural Distinctions
- **EXISTING:** `workflow_definitions`, `workflow_events`, `approval_policies`, `approval_requests`, `approval_actions`, `ApprovalEngine`, `GovernedRuleEngine`, `evaluate_action_permission`.
- **REUSABLE:** All of the above are 100% reusable as-is.
- **NEEDS EXTENSION:** `backend/app/api/v1/workflow.py` must transition from its hardcoded switch statement to delegate directly to `UniversalLifecycleEngine`.
- **MISSING:** The orchestrator `UniversalLifecycleEngine` and domain handler hooks.

---

## 20. Configuration Model

The lifecycle for any document type is defined declaratively as a row in `workflow_definitions`.

### Example 1: Purchase Order Lifecycle Definition
```json
{
  "code": "WF_PURCHASE_ORDER",
  "version": 1,
  "doc_type": "PurchaseOrder",
  "name": "Standard Purchase Order 2-Step Approval Lifecycle",
  "initial_state": "DRAFT",
  "states": ["DRAFT", "SUBMITTED", "CONFIRMED", "RECEIVED", "COMPLETED", "CANCELLED"],
  "transitions": [
    {
      "from": "DRAFT",
      "to": "SUBMITTED",
      "action": "SUBMIT",
      "required_roles": ["CASHIER", "MANAGER", "SYSADMIN"],
      "requires_approval_check": false
    },
    {
      "from": "SUBMITTED",
      "to": "CONFIRMED",
      "action": "CONFIRM",
      "required_roles": ["MANAGER", "SYSADMIN"],
      "requires_approval_check": true
    },
    {
      "from": "DRAFT",
      "to": "CANCELLED",
      "action": "CANCEL",
      "required_roles": ["MANAGER", "SYSADMIN"],
      "requires_approval_check": false
    },
    {
      "from": "SUBMITTED",
      "to": "CANCELLED",
      "action": "CANCEL",
      "required_roles": ["MANAGER", "SYSADMIN"],
      "requires_approval_check": false
    },
    {
      "from": "CONFIRMED",
      "to": "CANCELLED",
      "action": "CANCEL",
      "required_roles": ["MANAGER", "SYSADMIN"],
      "requires_approval_check": false
    },
    {
      "from": "CONFIRMED",
      "to": "RECEIVED",
      "action": "RECEIVE",
      "required_roles": ["MANAGER", "SYSADMIN"],
      "system_only": true
    },
    {
      "from": "RECEIVED",
      "to": "COMPLETED",
      "action": "COMPLETE",
      "required_roles": ["MANAGER", "SYSADMIN"],
      "system_only": true
    }
  ],
  "status": "ACTIVE"
}
```

### Example 2: Simple Document Lifecycle (Stock Transfer)
```json
{
  "code": "WF_STOCK_TRANSFER",
  "version": 1,
  "doc_type": "StockTransfer",
  "name": "Direct Stock Transfer Lifecycle",
  "initial_state": "DRAFT",
  "states": ["DRAFT", "DISPATCHED", "RECEIVED", "CANCELLED"],
  "transitions": [
    { "from": "DRAFT", "to": "DISPATCHED", "action": "DISPATCH", "required_roles": ["MANAGER", "SYSADMIN"] },
    { "from": "DISPATCHED", "to": "RECEIVED", "action": "RECEIVE", "required_roles": ["MANAGER", "SYSADMIN"] },
    { "from": "DRAFT", "to": "CANCELLED", "action": "CANCEL", "required_roles": ["MANAGER", "SYSADMIN"] }
  ],
  "status": "ACTIVE"
}
```

---

## 21. Migration Impact

- **Database Migrations:** **NONE.** No new tables or schema changes are needed.
- **Existing Records:** **UNTOUCHED.** All existing business records retain their current `status` column values.
- **Backward Compatibility:**
  - Existing endpoints (e.g. `POST /api/v1/purchase/orders/{id}/submit`, `POST /api/v1/purchase/orders/{id}/confirm`) remain active and delegate internally to `UniversalLifecycleEngine`.
  - Contract routes are preserved.
  - Zero downtime, zero data risk.

---

## 22. Test Architecture Audit (Phase 0S)

### Current Test Coverage Matrix

| Test Suite File | Domain Covered | Tests Lifecycle Transitions? | Gaps Identified |
| :--- | :--- | :--- | :--- |
| `backend/app/tests/test_purchase.py` | Purchase Orders, GRN, Landed Cost | **Partial** (`test_workflow_submit_purchase_order`, `test_workflow_cancel_purchase_order`) | Tests `workflow.py` submit returning `SUBMITTED`, but does not test approval gate thresholds, amendment chain traversal, or rejected status returns. |
| `backend/app/tests/test_sales.py` | Sales Invoices, Quotations, Orders | **Partial** (`test_workflow_approve_sales_invoice`, `test_workflow_cancel_sales_invoice`) | Does not test sales order reservation consumption or approval policy triggers. |
| `backend/app/tests/test_approval.py` | Approvals | **MISSING (0 tests)** | `ApprovalEngine` (`ApprovalPolicy`, `ApprovalRequest`, `ApprovalAction`) has **no dedicated unit tests** in `backend/app/tests/`. |
| `backend/app/tests/test_audit_chain.py` | WORM Compliance Audit | **Yes** (WORM hash-chain verification) | Tests `ComplianceImmutableAuditLog`, but not `WorkflowEvent`. |
| `backend/app/tests/t_tenant_iso.py` | Multi-Tenant Isolation | **Yes** | Verifies database isolation, but does not verify workflow event cross-tenant isolation. |

---

## 23. Risks & Edge Cases

1. **Soft-Delete Collision on Cancellation:**
   Current `PurchaseService.cancel_purchase_order` and `amend_purchase_order` set `is_deleted = True`. This causes standard queries filtering `is_deleted == False` to lose visibility of cancelled or historical amended records.
   *Resolution:* Cancelled documents must remain `is_deleted = False` with `status = "CANCELLED"`.
2. **Approval Threshold Race Condition:**
   If a user submits a PO below the approval threshold, and an amendment subsequently increases the amount above the threshold, the amendment must trigger the approval gate.
3. **Casing Discrepancies:**
   Status values must be parsed case-insensitively while being persisted in canonical uppercase (`DRAFT`, `CONFIRMED`, `SUBMITTED`).
4. **Numbering Counter Advance on Aborted Transactions:**
   If document validation fails after a number is generated, sequential numbering may experience gaps. For regulatory documents (Tax Invoices), numbers must only be allocated at final posting.

---

## 24. Phase 1 Implementation Plan (Purchase Order Pilot)

### Step 1: Seed Declarative Workflow Definition
- Insert `WF_PURCHASE_ORDER` definition into `workflow_definitions` via `ctrl_seeder.py`.

### Step 2: Implement `UniversalLifecycleEngine`
- Create `backend/app/services/lifecycle/engine.py`.
- Wire `GovernedRuleEngine.evaluate_workflow_transition` for state validation.
- Wire `evaluate_action_permission` for RBAC validation.
- Wire `ApprovalEngine.check_transaction_enforcement` for threshold checking.
- Wire `WorkflowEvent` creation for immutable transition audit.

### Step 3: Implement `PurchaseOrderLifecycleHandler`
- Create domain handler in `backend/app/services/lifecycle/handlers/purchase_order.py`.
- Handle PO-specific side effects:
  - Setting `submitted_by` / `submitted_at`.
  - Setting `confirmed_by` / `confirmed_at`.
  - Recording structured cancellation reasons.
  - Ensuring `is_deleted = False` on cancellation.

### Step 4: Refactor `api/v1/workflow.py`
- Delegate `POST /api/v1/workflow/{doc_type}/{doc_id}/{action}` to `UniversalLifecycleEngine`.
- Update `PurchaseService` methods to delegate to the lifecycle engine.

### Step 5: Frontend Shared Component Integration
- Implement `UniversalStatusBadge.tsx` and `DocumentActionToolbar.tsx`.
- Refactor `POWorkspaceTab.tsx` to consume the shared components.

### Step 6: Automated Verification & Testing
- Add comprehensive pytest suite covering all PO transitions, approval enforcement gates, rejection flows, and audit trail verification.

---

*Audit Complete. Strict Read-Only Policy Observed. Awaiting explicit user instruction before proceeding to Phase 1.*
