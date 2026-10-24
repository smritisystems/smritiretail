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
  * Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
  * License    : Proprietary Commercial Software
  * Classification: Internal
-->

# Implementation Plan: Universal Document Lifecycle Phase 2 (GRN & Purchase Bill)

**Document ID:** IP-PROC-002  
**Version:** 1.0.0  
**Status:** Completed  
**Created:** 2026-10-01  
**Author:** Jawahar Ramkripal Mallah <founder@aitdl.com>  

---

## 1. Objective
Expand the SMRITI Universal Document Lifecycle Framework to encompass downstream procurement documents: Goods Receipt Note (GRN) and Purchase Bill.

## 2. Business Motivation
Procurement operations require an unbroken audit chain connecting initial purchase commitment (PO) to physical goods receipt (GRN) and commercial financial settlement (Purchase Bill). Fragmented lifecycle implementations lead to uncoordinated stock mutations, unaccounted liabilities, and audit discrepancies.

## 3. Scope
- Backfill and forensic verification of historical PO lifecycle commits (Phases A–C).
- Rigorous verification of `ApprovalEngine` execution (Tests A–H).
- Implementation of `GoodsReceiptLifecycleHandler` for GRN state management.
- Implementation of `PurchaseBillLifecycleHandler` and creation of `purchase_bills` table (Alembic `v1513`).
- Cross-handler acceptance test proving coexistence without kernel modifications.

## 4. Current State
- `UniversalLifecycleEngine` was piloted with `PurchaseOrder` in Phase 1.
- `GoodsReceiptNote` and `PurchaseReceipt` had separate, fragmented service methods.
- `PurchaseBill` was recorded only in the Outbox without a persistent PostgreSQL entity table.

## 5. Gap Analysis
- Absence of a standardized state machine for Goods Receipts with optimistic locking and tenant isolation.
- Missing PostgreSQL table `purchase_bills` for tracking supplier bill lifecycles and liability.
- Missing cross-document lifecycle tests exercising multi-document transitions in a single unified flow.

## 6. Architecture Impact
- Extends `LifecycleRegistry` with `GoodsReceipt` and `PurchaseBill` handler strategies.
- Preserves `UniversalLifecycleEngine` as a strictly document-type agnostic kernel (`zero document-specific branching`).
- Establishes single Alembic head `v1513_purchase_bills_table (head)`.

## 7. Proposed Design
1. Register `GoodsReceiptLifecycleHandler` supporting polymorphic retrieval across `PurchaseReceipt` and `GoodsReceiptNote`.
2. Register `PurchaseBillLifecycleHandler` mapping to new `PurchaseBill` entity.
3. Propagate `ctx.notes` seamlessly into handler validation payloads for reason checking.
4. Enforce strict `is_deleted = False` invariant on all cancellation actions.

## 8. Files Created
- `backend/app/services/lifecycle/handlers/goods_receipt.py`
- `backend/app/services/lifecycle/handlers/purchase_bill.py`
- `backend/app/tests/test_approval_engine.py`
- `backend/app/tests/test_cross_handler_lifecycle.py`
- `backend/alembic/versions/v1513_purchase_bills_table.py`
- `scripts/check_procurement_tables.py`
- `scripts/alter_purchase_bills.py`
- `docs/architecture/SMRITI_PO_LIFECYCLE_PHASES_A_C_BACKFILL.md`
- `docs/architecture/SMRITI_DOCUMENT_LIFECYCLE_PHASE2_REPORT.md`
- `docs/implementation/procurement/Universal_Document_Lifecycle_Phase2_GRN_PurchaseBill_v1.0.md`

## 9. Files Modified
- `backend/app/models/purchase.py`: Added `PurchaseBill` entity.
- `backend/app/models/__init__.py`: Exported `PurchaseBill`.
- `backend/app/services/purchase.py`: Persisted `PurchaseBill` entity in `create_purchase_bill`.
- `backend/app/services/approval_engine.py`: Added `MANAGER` role hierarchy mapping.
- `backend/app/services/lifecycle/exceptions.py`: Added `doc_type`/`doc_id` kwargs to `TenantIsolationException`.
- `backend/app/services/lifecycle/engine.py`: Propagated `ctx.notes` to payload notes/reason.
- `backend/app/services/lifecycle/handlers/purchase_order.py`: Incremented `doc.version` on transition.
- `backend/app/services/lifecycle/handlers/__init__.py`: Exported new handlers.
- `backend/app/tests/conftest.py`: Added `VARCHAR(36)` type casting and `purchase_bills` DDL compatibility.

## 10. Dependencies
- PostgreSQL 15+
- SQLAlchemy 2.0+ (Async)
- FastAPI / Pydantic V2
- Alembic

## 11. Risks
- Concurrent mutations: Mitigated via optimistic concurrency version checks (HTTP 409).
- Cross-tenant data leakage: Mitigated via tenant ownership assertion on document load (HTTP 404).

## 12. Rollback Strategy
- Database rollback: `alembic downgrade v1512_po_amendment_audit`.
- Git rollback: Revert handler registration from `backend/app/services/lifecycle/handlers/__init__.py`.

## 13. Verification Plan
- Execute Approval Engine Test Suite (A–H).
- Execute Cross-Handler Acceptance Test Suite.
- Run DB Safety Check and Integrity Baseline.
- Execute Full Regression Battery.

## 14. Test Plan
- Unit tests: Model instantiation, state resolution, available action resolution.
- Integration tests: End-to-end multi-document procurement flow.
- Regression tests: Existing PO and purchase suites.

## 15. Documentation Impact
- Update `CHANGELOG.md`.
- Update `docs/walkthrough/README.md`.
- Update `docs/implementation/README.md`.

## 16. Deployment Plan
1. Run `alembic upgrade head`.
2. Deploy FastAPI backend services.
3. Validate lifecycle health check endpoints.

## 17. Status
Completed (All verification gates passed).

## 18. Related ADRs
- `ADR-001`: Universal Document Lifecycle Kernel
- `ADR-002`: Optimistic Concurrency and Immutable Audit Logging

## 19. Related Walkthroughs
- `Universal_Document_Lifecycle_Phase1_PO_Pilot_v1.0.md`
- `SMRITI_PO_LIFECYCLE_PHASES_A_C_BACKFILL.md`
