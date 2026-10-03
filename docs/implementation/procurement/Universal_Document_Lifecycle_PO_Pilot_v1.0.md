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
  Classification: Internal
-->

# Universal Document Lifecycle Framework — Phase 1: Purchase Order Pilot Implementation Plan

**Document ID:** SMRITI-IP-LIFECYCLE-PO-PILOT-v1.0  
**Status:** In Progress (Phase 1 Pilot)  
**Target Branch:** `smritiNX`  
**Area:** Procurement / Foundation Lifecycle Kernel  

---

## 1. Objective
Establish the canonical, production-grade, configuration-driven **Universal Document Lifecycle Framework** for SMRITI Retail OS, utilizing `PURCHASE_ORDER` as the initial pilot document. The framework provides an authoritative kernel (`UniversalLifecycleEngine`) orchestrating state-machine resolution, tenant verification, RBAC permissions, threshold-based approval gates, domain handler hooks, and immutable audit logs without hardcoding document-specific domain logic into the kernel.

---

## 2. Business Motivation
In the existing codebase, document lifecycle operations are fragmented:
- `backend/app/api/v1/workflow.py` hardcodes state changes for a small set of documents, bypassing `workflow_definitions` and `ApprovalEngine`.
- A critical audit mismatch exists where `PurchaseOrder` submission (`SUBMIT`) is logged as transition `to_status="CONFIRMED"` even though the database records `SUBMITTED`.
- Cancellation and amendment in `PurchaseService` mark business records as `is_deleted = True`, hiding historical transactions from normal query lookups.
- Multiple modules (Sales, Purchase, Inventory, Accounts) duplicate status transition, approval checks, and audit logging.

By implementing `UniversalLifecycleEngine` with pluggable domain handlers, SMRITI achieves consistent governance, auditable state transitions, multi-tier approval enforcement, and zero data loss across all business documents.

---

## 3. Scope & Non-Goals

### In-Scope (Phase 1):
1. **Core Lifecycle Kernel:** Implement `UniversalLifecycleEngine`, `BaseDocumentLifecycleHandler`, and `LifecycleRegistry` in `backend/app/services/lifecycle/`.
2. **Purchase Order Handler:** Implement `PurchaseOrderLifecycleHandler` for `PURCHASE_ORDER` / `PurchaseOrder`.
3. **Workflow Definition Seeder:** Seed declarative workflow `WF_PURCHASE_ORDER` into `workflow_definitions`.
4. **Audit Mismatch Fix:** Ensure `SUBMIT` correctly transitions `DRAFT` → `SUBMITTED` and writes matching `WorkflowEvent` (`from_status="DRAFT"`, `to_status="SUBMITTED"`).
5. **No Soft-Delete Defect Fix:** Remove `is_deleted = True` on PO cancellation and amendment; ensure cancelled and amended records remain visible, auditable, and queryable with `is_deleted = False`.
6. **Optimistic Concurrency:** Enforce `expected_version` against `BaseEntity.version` with `HTTP 409 Conflict`.
7. **Approval Engine Gate:** Integrate `ApprovalEngine.check_transaction_enforcement` during lifecycle transitions.
8. **Universal & Backward-Compatible API:** Expose `/api/v1/lifecycle/{doc_type}/{doc_id}/{action}` and adapt legacy `/orders/{id}/submit`, `/confirm`, `/cancel`, `/amend` to delegate to the engine.
9. **Frontend Reusable UI Components:** Provide universal lifecycle UI components (`UniversalStatusBadge`, `DocumentActionToolbar`) and integrate them into `POWorkspaceTab.tsx`.
10. **Comprehensive Test Suite:** Automated verification covering transitions, RBAC, approvals, concurrency, cancellation immutability, and atomicity.

### Non-Goals (Future Phases):
- Implementing handlers for Sales Orders, Sales Invoices, GRN, Stock Transfers, or Payments (scheduled for Phase 2+).
- Article numbering or document series refactoring (Article Numbering system remains completely untouched).
- Unrelated Purchase UX redesigns (e.g. F2 lookup shortcuts, general toolbar restructuring).
- Bulk historical data migration or schema alteration.

---

## 4. Existing Infrastructure Being Reused
Zero new database tables or duplicate infrastructure are created:
1. `workflow_definitions` (Alembic `v1363`, `backend/app/models/governed_logic.py`): Stores JSON state-transition graphs.
2. `workflow_events` (Alembic `g3h4i5j6k7l8`, `backend/app/models/workflow.py`): Stores immutable transition audit logs.
3. `approval_policies`, `approval_requests`, `approval_actions` (Alembic `v1385`, `backend/app/models/approval.py`): Multi-tier financial threshold policies and requests.
4. `GovernedRuleEngine.evaluate_workflow_transition` (`backend/app/services/governed_rules.py`): Transition graph and role evaluator.
5. `ApprovalEngine` (`backend/app/services/approval_engine.py`): Transaction enforcement and escalation engine.
6. `SmritiPermission` & `evaluate_action_permission` (`backend/app/core/security_matrix.py`): Tenant-scoped RBAC evaluator.
7. `BaseEntity.version`: Row-level optimistic concurrency locking counter.
8. `parent_order_id` + `amend_revision` (`backend/app/models/purchase.py`): Historical document revision chain.

---

## 5. Target Architecture
```text
Client Request (Universal API or Legacy Compatibility Route)
                           ↓
               UniversalLifecycleEngine
   ┌───────────────────────┴────────────────────────┐
   │ 1. Resolve & Enforce Tenant Context             │
   │ 2. Load Document via Handler                    │
   │ 3. Optimistic Concurrency Check (expected_ver)  │
   │ 4. Resolve WorkflowDefinition (GovernedRule)    │
   │ 5. RBAC Permission Check (security_matrix)      │
   │ 6. Approval Policy Check (ApprovalEngine)       │
   │ 7. Handler.before_transition() Hook             │
   │ 8. Handler.apply_transition() State Mutation    │
   │ 9. Immutable WorkflowEvent Creation             │
   │ 10. Handler.after_transition() Post Hook        │
   │ 11. Atomic Commit                               │
   └───────────────────────┬────────────────────────┘
                           ↓
             PurchaseOrderLifecycleHandler
        (Zero Soft-Delete, Canonical Revisions,
         Audit Actor Stamping, Invariant Guard)
```

---

## 6. Purchase Order Lifecycle & Target States
Authoritative PO lifecycle states:
- `DRAFT`: Initial draft purchase order; lines and quantities freely editable.
- `SUBMITTED`: Submitted by buyer/clerk awaiting managerial confirmation or approval.
- `CONFIRMED`: Formally confirmed purchase order, authorized for vendor dispatch.
- `RECEIVED`: Goods physically received at warehouse via GRN.
- `COMPLETED`: Invoiced, fully received, and closed.
- `CANCELLED`: Terminal state indicating order cancellation before receiving.

---

## 7. Authoritative Transition Matrix
| From State | Action | Next State | Allowed Roles / Permissions | Preconditions & Side Effects |
|---|---|---|---|---|
| `DRAFT` | `SUBMIT` | `SUBMITTED` | `STORE_MANAGER`, `MANAGER`, `SYSADMIN` | Must contain ≥1 line item. Stamped with `submitted_by`, `submitted_at`. |
| `DRAFT` | `CANCEL` | `CANCELLED` | `STORE_MANAGER`, `MANAGER`, `SYSADMIN` | Order not processed. `is_deleted = False` strictly enforced. |
| `SUBMITTED` | `CONFIRM` | `CONFIRMED` | `MANAGER`, `SYSADMIN` | Evaluates `ApprovalEngine` threshold. Stamped with `confirmed_by`, `confirmed_at`. |
| `SUBMITTED` | `REJECT` | `DRAFT` | `MANAGER`, `SYSADMIN` | Returns order back to draft for buyer corrections. |
| `SUBMITTED` | `CANCEL` | `CANCELLED` | `MANAGER`, `SYSADMIN` | Cancelled before confirmation. `is_deleted = False`. |
| `CONFIRMED` | `AMEND` | `CONFIRMED` (New) / `CANCELLED` (Old) | `MANAGER`, `SYSADMIN` | Creates new revision (`parent_order_id`, `amend_revision + 1`). Predecessor marked `CANCELLED` with `is_deleted = False`. |
| `CONFIRMED` | `CANCEL` | `CANCELLED` | `MANAGER`, `SYSADMIN` | Allowed only if zero GRNs received. `is_deleted = False`. |
| `CONFIRMED` | `RECEIVE` | `RECEIVED` | System / WMS / Inward | Triggered on complete GRN receipt. |
| `RECEIVED` | `COMPLETE` | `COMPLETED` | `ACCOUNTANT`, `MANAGER`, `SYSADMIN` | Finalizes purchase transaction. |

---

## 8. Permission Requirements (RBAC)
Lifecycle actions map to canonical SMRITI action permissions:
- `purchase_order:view`: View PO details and lifecycle timeline.
- `purchase_order:submit`: Submit draft PO (`DRAFT` → `SUBMITTED`).
- `purchase_order:confirm`: Confirm submitted PO (`SUBMITTED` → `CONFIRMED`).
- `purchase_order:cancel`: Cancel PO (`DRAFT` / `SUBMITTED` / `CONFIRMED` → `CANCELLED`).
- `purchase_order:amend`: Amend confirmed PO.

Permissions are evaluated through `evaluate_action_permission(db, user, tenant_ctx, resource="purchase_order", action=action.lower())`.

---

## 9. Approval Integration
- The engine invokes `ApprovalEngine.check_transaction_enforcement(db, company_id, req)` passing `document_type="PURCHASE_ORDER"` and `document_amount=order.grand_total`.
- If a matching `ApprovalPolicy` requires a higher role than the caller:
  - Transition raises HTTP 403 or generates an `ApprovalRequest` with state `PENDING_APPROVAL`.
  - The transaction cannot transition to `CONFIRMED` until an authorized approver performs the approval action.

---

## 10. Concurrency Strategy
- Requests accept an optional `expected_version: int`.
- If provided, the engine asserts `doc.version == expected_version`.
- If mismatched, the engine raises `HTTP 409 Conflict` with: `"Document has been modified by another user (expected version {expected_version}, current version {doc.version}). Please refresh."`
- `BaseEntity.version` is strictly used for this optimistic locking counter.

---

## 11. Amendment / Revision Strategy
- Concurrency version (`BaseEntity.version`) is NOT used for amendment revision numbering.
- Amendment uses existing columns `parent_order_id` and `amend_revision`:
  - `original.amend_revision` is read.
  - New PO is created with `parent_order_id = original.id` and `amend_revision = original.amend_revision + 1`.
  - The predecessor record is marked `status = "CANCELLED"`, notes updated to `"Amended & Superseded by PO..."`, and `is_deleted = False` is maintained.
  - The predecessor remains queryable in the amendment audit trail.

---

## 12. Audit Strategy
Every state transition atomically writes one row to `workflow_events`:
- `doc_type`: `"PurchaseOrder"`
- `doc_id`: `order.id`
- `action`: Canonical action string (`SUBMIT`, `CONFIRM`, `CANCEL`, `AMEND`, etc.)
- `from_status`: Exact previous state (`"DRAFT"`, `"SUBMITTED"`, `"CONFIRMED"`)
- `to_status`: Exact new state (`"SUBMITTED"`, `"CONFIRMED"`, `"CANCELLED"`)
- `performed_by_id`: Active user ID
- `performed_by_name`: Active username / name
- `company_id`: Tenant company ID
- `branch_id`: Tenant branch ID
- `notes`: User-supplied notes or cancellation reason
- `created_at`: UTC timestamp

---

## 13. Tenant Isolation Strategy
- All document lookups in handlers enforce `company_id == tenant.company_id` and `branch_id == tenant.branch_id`.
- Cross-tenant requests produce `HTTP 404 Not Found` (never leaking existence across tenants).
- `WorkflowEvent` records are tenant-scoped with `company_id` and `branch_id`.

---

## 14. API Backward Compatibility
Existing routes in `backend/app/api/v1/purchase.py`:
- `POST /orders/{order_id}/submit`
- `POST /orders/{order_id}/confirm`
- `POST /orders/{order_id}/cancel`
- `POST /orders/{order_id}/amend`
remain identical in URL and payload contract, but their implementation bodies are replaced with thin delegators calling `UniversalLifecycleEngine.execute_transition(...)`.

New universal route:
- `POST /api/v1/lifecycle/{doc_type}/{doc_id}/{action}`
- `GET /api/v1/lifecycle/{doc_type}/{doc_id}/state`
- `GET /api/v1/lifecycle/{doc_type}/{doc_id}/events`

---

## 15. Frontend Impact
- Introduce reusable `UniversalStatusBadge.tsx` and `DocumentActionToolbar.tsx` under `src/components/common/lifecycle/`.
- Update `src/components/purchase/POWorkspaceTab.tsx` to consume the universal status badge and action components, passing dynamic available actions returned from the lifecycle API.
- Prevent hardcoded action availability in UI.

---

## 16. Database Impact
- **Zero Schema Migrations:** All required tables (`workflow_definitions`, `workflow_events`, `approval_policies`, `approval_requests`, `purchase_orders`) already exist.
- **Zero Soft-Delete on Cancel:** Elimination of `order.is_deleted = True` bug prevents disappearance of cancelled records from query views.
- **Seeder Addition:** Seed `WF_PURCHASE_ORDER` in `ctrl_seeder.py` and `seed_gov_logic.py`.

---

## 17. Test Strategy
1. **Transition Suite:** Validates `DRAFT` → `SUBMITTED` → `CONFIRMED` and `CANCELLED`.
2. **Audit Integrity:** Asserts `from_status`, `to_status`, and `action` in `workflow_events`.
3. **Concurrency:** Tests simultaneous updates with mismatched `expected_version` returning `409`.
4. **Approval Gate:** Tests high-value PO triggering `ApprovalPolicy` requirement.
5. **No Soft-Delete:** Asserts `order.is_deleted == False` after cancellation and amendment.
6. **Cross-Tenant Guard:** Asserts rejection of cross-company document transition attempts.
7. **Transaction Rollback:** Injects handler exception and verifies no partial transition or orphaned `workflow_events`.

---

## 18. Rollback / Safety Strategy
- Code-only implementation: If issues occur, code can be reverted without database rollbacks or data restorations.
- All database state transitions occur within atomic `session.begin_nested()` / `session.commit()` blocks.

---

## 19. Definition of Done
- [x] Implementation Plan registered in `docs/implementation/README.md`.
- [ ] `backend/app/services/lifecycle/` package created (engine, registry, contracts, context, handlers).
- [ ] `PurchaseOrderLifecycleHandler` implemented and registered.
- [ ] `WF_PURCHASE_ORDER` seeded in `ctrl_seeder.py`.
- [ ] `POST /api/v1/lifecycle/{doc_type}/{doc_id}/{action}` implemented.
- [ ] Legacy PO endpoints delegated to `UniversalLifecycleEngine`.
- [ ] Soft-delete on cancel/amend eliminated.
- [ ] Frontend reusable badge and action toolbar created and integrated.
- [ ] Pytest verification suite passed with literal terminal output.
- [ ] Walkthrough document created under `docs/walkthrough/procurement/`.
- [ ] Master indices updated.
