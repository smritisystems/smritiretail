<!--
  Project      : SMRITI Retail OS
  Repository   : SMRITIRetailNX
  Organization : AITDL NETWORKS
  Branch       : smritiNX

  Founders

  * Pushpa Devi Jawahar Mallah
    * Founder & Chairperson
    * Phone: [REDACTED_PUBLIC_PII]
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

# Walkthrough: SMRITI Universal Transaction Lifecycle Framework — Phase 1 Purchase Order Pilot

## 1. Purpose
Establish the **SMRITI Universal Transaction Lifecycle Framework**, a document-agnostic, configuration-driven state transition kernel for all SMRITI ERP transaction document types (Purchase, Sales, Inventory, Finance, Distribution). The framework unifies status transitions, optimistic concurrency validation, RBAC gate checks, multi-tier approval policy evaluations, audit event recording, and human-readable error messages under a single authoritative kernel. `PURCHASE_ORDER` serves as the initial reference pilot handler, while strictly preserving zero document-specific conditional branching inside the core engine.

## 2. Scope
- Generic Core Lifecycle Engine (`UniversalLifecycleEngine`) and Handler Contract (`BaseDocumentLifecycleHandler`).
- Dynamic Handler Registry (`LifecycleRegistry`) supporting runtime registration without modifying the engine.
- Purchase Order Reference Handler (`PurchaseOrderLifecycleHandler`) with domain validation and amendment revision tracking.
- Workflow and Approval Engine integration (`WorkflowDefinition`, `WorkflowEvent`, `ApprovalEngine`).
- Tenant isolation and optimistic locking via `version` column matching.
- Elimination of historical PO defects (soft-delete on cancellation/amendment fixed to `is_deleted = False`; accurate audit log state transitions).
- Reusable frontend UI lifecycle components (`UniversalStatusBadge`, `DocumentActionToolbar`) and integration into `POWorkspaceTab.tsx`.
- Automated test coverage including an Architectural Acceptance Test proving dynamic coexistence of multiple document types.

## 3. Files Created
1. `backend/app/services/lifecycle/__init__.py` — Package exports and handler registration discovery.
2. `backend/app/services/lifecycle/exceptions.py` — Domain-typed lifecycle exceptions mapping cleanly to HTTP 400/403/404/409 codes per HREP.
3. `backend/app/services/lifecycle/context.py` — Lifecycle transition context and DTO schemas (`LifecycleTransitionContext`, `LifecycleTransitionResult`, `LifecycleStateResponse`).
4. `backend/app/services/lifecycle/contracts.py` — Authoritative abstract lifecycle contract (`BaseDocumentLifecycleHandler`) defining required hooks.
5. `backend/app/services/lifecycle/registry.py` — Thread-safe `LifecycleRegistry` with decorator `@register_lifecycle_handler`.
6. `backend/app/services/lifecycle/engine.py` — Generic `UniversalLifecycleEngine` orchestrating state transitions with zero document branching.
7. `backend/app/services/lifecycle/handlers/__init__.py` — Handlers package initializer.
8. `backend/app/services/lifecycle/handlers/purchase_order.py` — Concrete PO lifecycle pilot handler.
9. `backend/app/api/v1/lifecycle.py` — Universal lifecycle API router (`POST /{doc_type}/{doc_id}/{action}`, `GET /{doc_type}/{doc_id}/state`, `GET /{doc_type}/{doc_id}/events`).
10. `backend/app/tests/test_universal_lifecycle.py` — Automated verification suite covering full lifecycle, concurrency, permissions, tenant isolation, and architectural pluggability.
11. `src/components/common/lifecycle/UniversalStatusBadge.tsx` — Reusable color-coded document status badge with animated pulse indicators.
12. `src/components/common/lifecycle/DocumentActionToolbar.tsx` — Dynamic action toolbar querying available actions and handling transitions.
13. `src/components/common/lifecycle/index.ts` — Common lifecycle component exports.
14. `docs/implementation/procurement/Universal_Document_Lifecycle_PO_Pilot_v1.0.md` — Implementation plan (19 sections).
15. `docs/architecture/SMRITI_DOCUMENT_LIFECYCLE_PHASE1_REPORT.md` — Phase 1 comprehensive architecture report (21 sections).

## 4. Files Modified
1. `backend/app/db/ctrl_seeder.py` — Seeded `WF_PURCHASE_ORDER` system workflow definition.
2. `backend/app/services/purchase.py` — Eliminated soft-delete defect (`is_deleted=False` on cancel/amend); added accurate `WorkflowEvent` creation.
3. `backend/app/api/v1/workflow.py` — Delegated `PurchaseOrder` state transitions to `UniversalLifecycleEngine`.
4. `backend/app/api/v1/__init__.py` — Exported lifecycle router.
5. `backend/app/main.py` — Mounted `/api/v1/lifecycle` router.
6. `backend/app/tests/test_purchase.py` — Updated 4 assertions to reflect `is_deleted=False` on cancellation/amendment.
7. `src/components/purchase/POWorkspaceTab.tsx` — Replaced hardcoded status badges with `UniversalStatusBadge` and `DocumentActionToolbar`.
8. `src/components/purchase/POAmendDialog.tsx` — Removed unused import and adjusted TypeScript double-assertion.
9. `docs/implementation/README.md` — Updated master implementation plan index.
10. `docs/walkthrough/README.md` — Appended walkthrough entry to master index.
11. `CHANGELOG.md` — Recorded Phase 1 architectural milestone.

## 5. Architecture Decisions
- **Zero-Conditional Engine Kernel:** `UniversalLifecycleEngine` operates purely against `BaseDocumentLifecycleHandler` interfaces (`get_resource_name()`, `get_document_amount()`, `validate_transition()`, `apply_transition()`). No `if doc_type == "PURCHASE_ORDER"` statements exist within the engine.
- **Workflow & Approval Reuse:** Rather than duplicating state machines, the engine queries existing `WorkflowDefinition` models (falling back to handler defaults if unconfigured) and evaluates multi-level threshold approval policies via `ApprovalEngine.evaluate_approval()`.
- **Dual-Phase Audit Trail:** State transitions record an immutable `WorkflowEvent` row with old status, new status, transition action, user identity, and metadata.
- **Explicit Invariant on Cancellation:** Cancelled and amended records maintain `is_deleted = False` and `deleted_at = None`. A cancellation is an operational terminal state, not a soft deletion.

## 6. Design Rationale
In enterprise retail ERPs, business documents share common lifecycle behavior: draft creation, submission, approval gating, confirmation/authorization, cancellation, amendment revisioning, and audit logging. Hardcoding state transitions inside individual module routers produces code drift, security vulnerabilities, and fragmented audit histories. SMRITI's Universal Lifecycle Framework centralizes governance while allowing domain-specific handlers to enforce localized business invariants.

## 7. Implementation Summary
The framework was built following a bottom-up strategy:
1. Defined generic typed exceptions and transition schemas.
2. Created `BaseDocumentLifecycleHandler` specifying contracts for document retrieval, version checking, validation, and transition application.
3. Engineered `UniversalLifecycleEngine` executing: tenant check -> lock verification -> workflow resolution -> RBAC check -> approval policy gate -> pre-transition hook -> status mutation -> post-transition hook -> immutable audit log.
4. Implemented `PurchaseOrderLifecycleHandler` adhering strictly to SMRITI purchase domain rules.
5. Delegated legacy `/api/v1/workflow/` routes to the universal engine for backward compatibility.
6. Built reusable frontend components (`UniversalStatusBadge`, `DocumentActionToolbar`) and integrated them directly into `POWorkspaceTab.tsx`.

## 8. Tests Executed
1. `backend/app/tests/test_universal_lifecycle.py` (7 tests, all PASSED):
   - `test_po_lifecycle_draft_to_submit_to_confirm`
   - `test_invalid_transition_rejected`
   - `test_optimistic_concurrency_conflict`
   - `test_po_cancellation_preserves_record_and_is_deleted_false`
   - `test_cross_tenant_isolation_denied`
   - `test_universal_lifecycle_api_endpoints`
   - `test_architectural_acceptance_pluggable_handler_coexistence`
2. `backend/app/tests/test_purchase.py` (62 tests, all PASSED):
   - All supplier, purchase order, GRN, cancellation, amendment, and workflow audit tests green.
3. `npx tsc --noEmit` (Frontend TypeScript compilation, 0 errors, exit 0).

## 9. Verification Results
```
======================= 7 passed, 18 warnings in 46.48s =======================
backend/app/tests/test_universal_lifecycle.py: 100% PASSED

================= 62 passed, 18 warnings in 81.12s (0:01:21) ==================
backend/app/tests/test_purchase.py: 100% PASSED

npx tsc --noEmit: EXIT 0 (0 errors)
```
Status: **Done** (All changes verified with literal terminal outputs).

## 10. Known Limitations
- Approval workflows currently fall back to automatic pass when no active approval policies are seeded for the tenant.
- GRN, Sales Order, and Stock Transfer handlers are scheduled for subsequent phases.

## 11. Future Work
- Phase 2: Register Goods Receipt Note (`GRN`) and Purchase Bill handlers.
- Phase 3: Register Sales Order (`SALES_ORDER`) and Sales Invoice (`SALES_INVOICE`) handlers.
- Phase 4: Register Inventory Stock Transfer and Stock Adjustment handlers.

## 12. Related ADRs
- `ADR-0042` — SMRITI Universal Document Lifecycle Architecture
- `ADR-0038` — PostgreSQL Soft Deletion and Document Audit Immutability

## 13. Related RFCs
- `RFC-2026-08` — Strangler-Fig Decommissioning of Express & Consolidation on FastAPI/PostgreSQL
- `RFC-2026-11` — Unified Document State Machine and Approval Matrix Specification
