<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.73.0
  Created      : 2026-10-13
  Modified     : 2026-10-13
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# SMRITI Retail OS — MRP & Selling Price Revision Engine Walkthrough

## 1. Purpose
This walkthrough documents the design, database schema, transactional services, UI studio, and verification of the SMRITI Retail OS **MRP, Selling Price, and Cost Price Revision Architecture**. 

Prior to this implementation, price updates in the item master directly mutated active record rates without temporal history, approval threshold gating, effective-date boundary protection, or audit trail traceability. This release introduces an immutable, auditable, temporal price revision architecture that guarantees:
- **Statutory Ceiling Compliance**: Strictly prevents Selling Price from exceeding Maximum Retail Price (MRP) at both database check constraint and API validation layers.
- **Temporal Integrity**: Supports past and future-effective price revisions. Future revisions remain safely quarantined in `SCHEDULED` status and never leak into active checkout billing until their exact timestamp is reached.
- **Historical Reconstruction**: Enables point-in-time price replay for any historical date and time.
- **Supervisor & Role Governance**: Automatically routes price alterations exceeding configured discount or change thresholds through an approval state machine.
- **Invoice Immutability**: Guarantees that historical submitted sales invoices and billing line snapshots remain 100% immutable when item prices are revised.
- **Single Authoritative Engine**: Reuses the core `PricingEngine` and PostgreSQL database without introducing redundant or secondary pricing engines.

---

## 2. Scope
The scope of this implementation encompasses:
- **Relational Data Model & Migrations**: Creation of the `item_price_revisions` table with foreign keys, check constraints, composite indices, and multi-tenant schema compatibility (`smriti001` and `smritisys`) via Alembic migration `v1530_item_price_revisions.py`.
- **Centralized Revision Domain Service**: `PriceRevisionService` orchestrating single and bulk revisions, state machine transitions (`DRAFT`, `PENDING_APPROVAL`, `APPROVED`, `REJECTED`, `SCHEDULED`, `ACTIVE`, `SUPERSEDED`, `EXPIRED`), auto-approval policies, and transactional synchronization with `item_variants` and `item_prices`.
- **Temporal Price Engine Integration**: Integration of temporal price lookup into `PricingEngine.calculate_effective_price` with fallback to active catalog prices.
- **RESTful API Surface**: Endpoints under `/api/v1/pricing/revisions` for revision creation, listing, detail retrieval, supervisor approval, rejection, bulk import, and scheduled activation.
- **POS & Billing Core Protection**: Integration with `HeadlessBillingCore` to resolve authoritative backend rates and block unauthorized cashier price tampering without supervisor PIN override.
- **Offline Client Synchronization**: Addition of `resolveEffectiveProductPrice` to `ProPosMasterCatalogCache.ts` ensuring offline POS clients honor effective dates.
- **Price Revision Studio UI**: Full-featured React/TypeScript modal (`PriceRevisionStudioModal.tsx`) providing single revision entry, margin calculation, approval queue review, revision timeline, and bulk CSV intake.

---

## 3. Files Created
1. `backend/alembic/versions/v1530_item_price_revisions.py`: Alembic migration creating the `item_price_revisions` table and indexes.
2. `backend/alembic/versions/v1531_harden_item_price_revisions_fk.py`: Phase 7A migration hardening foreign keys to `ON DELETE RESTRICT`.
3. `backend/app/services/price_revision_service.py`: Centralized price revision domain service and temporal state machine.
4. `src/components/pricing/PriceRevisionStudioModal.tsx`: Visual Studio component for price revisions, approval queue, and bulk CSV operations.
5. `backend/tests/test_price_revisions.py`: Comprehensive automated test suite containing 13 integration and edge-case tests.
6. `docs/implementation/pricing/MRP_And_Selling_Price_Revision_Architecture_Plan_v1.0.0.md`: Formal IPGP implementation plan.
7. `docs/walkthrough/pricing/MRP_And_Selling_Price_Revision_Engine_v1.0.0.md`: This comprehensive walkthrough document.

---

## 4. Files Modified
1. `backend/app/models/pricing.py`: Added `ItemPriceRevision` ORM model with check constraints and `ondelete="RESTRICT"`.
2. `backend/app/models/__init__.py`: Registered `ItemPriceRevision` in the centralized model registry.
3. `backend/app/schemas/pricing.py`: Added Pydantic v2 validation models and response schemas for price revisions.
4. `backend/app/services/pricing_engine.py`: Integrated temporal price resolution into `PricingEngine.calculate_effective_price`.
5. `backend/app/services/headless_billing.py`: Integrated authoritative backend revision price verification and supervisor override check.
6. `backend/app/services/outbox_worker.py`: Wired concurrency-safe scheduled price revision activation cycle into Outbox worker.
7. `backend/app/api/v1/pricing.py`: Mounted REST API endpoints for price revisions.
8. `src/components/pricing/PricingStudioModal.tsx`: Added launch button and modal binding for `PriceRevisionStudioModal`.
9. `src/sync/ProPosMasterCatalogCache.ts`: Added `resolveEffectiveProductPrice` with temporal intervals, statutory ceiling, and staleness handling.
10. `src/tests/proposCatalogCache.test.ts`: Added unit tests for offline POS temporal pricing resolution.
9. `docs/implementation/README.md`: Updated master implementation plans index.
10. `docs/walkthrough/README.md`: Updated master walkthroughs index.
11. `CHANGELOG.md`: Added release changelog entry.
12. `RELEASE_NOTES.md`: Added formal release notes entry.

---

## 5. Architecture Decisions
- **ADR-PRV-001: Immutable Audit Ledger**: Rather than in-place overwriting of pricing columns, every price revision is persisted as an immutable row in `item_price_revisions`. When an active revision is superseded by a newer approved revision, its status is updated to `SUPERSEDED` while retaining all previous timestamps, actors, and reasons.
- **ADR-PRV-002: Check Constraint Statutory Ceiling**: A database-level check constraint `ck_item_price_rev_sp_le_mrp` enforces `revised_selling_price <= revised_mrp`. This prevents any application bug or ad-hoc query from violating consumer protection regulations in retail jurisdictions.
- **ADR-PRV-003: Temporal Resolution Fallback**: Price resolution checks `item_price_revisions` for an approved/active record valid at the query timestamp. If no temporal revision exists, it seamlessly falls back to canonical rates on `item_variants` or `item_prices`, ensuring 100% backward compatibility.
- **ADR-PRV-004: Dual Database Schema Parity**: Migrations were applied to both tenant database `smriti001` and control database `smritisys` on PostgreSQL port 2781 to ensure schema parity across environments.

---

## 6. Design Rationale
- **Timezone Awareness**: All timestamps utilize `DateTime(timezone=True)` / UTC to prevent timezone skew between client browsers, cloud servers, and POS terminals.
- **Granular Approvals**: Revisions under 10% price delta or initiated by `SYSADMIN` / `ADMIN` qualify for auto-approval. Changes exceeding 10% or created by store staff require explicit supervisor approval or supervisor PIN authorization.
- **Safe Asyncpg Relationship Handling**: In FastAPI endpoint serialization, loaded relationships are accessed via instance dictionary state (`rev.__dict__.get(...)`) rather than unmanaged lazy loaders, preventing async `MissingGreenlet` errors in FastAPI request pipelines.

---

## 7. Implementation Summary

### Relational Schema (`item_price_revisions`)
```sql
CREATE TABLE item_price_revisions (
    id VARCHAR(36) PRIMARY KEY,
    company_id VARCHAR(50) NOT NULL,
    branch_id VARCHAR(50),
    item_id VARCHAR(36) NOT NULL REFERENCES items(id),
    variant_id VARCHAR(36) NOT NULL REFERENCES item_variants(id),
    price_book_id VARCHAR(36) REFERENCES price_books(id),
    currency VARCHAR(10) NOT NULL DEFAULT 'INR',
    previous_mrp NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    revised_mrp NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    previous_selling_price NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    revised_selling_price NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    previous_cost_price NUMERIC(12, 2),
    revised_cost_price NUMERIC(12, 2),
    effective_from TIMESTAMPTZ NOT NULL,
    effective_to TIMESTAMPTZ,
    status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    reason_code VARCHAR(50) NOT NULL,
    justification TEXT,
    approval_required BOOLEAN NOT NULL DEFAULT FALSE,
    approved_by VARCHAR(50),
    approved_at TIMESTAMPTZ,
    rejection_reason TEXT,
    source VARCHAR(30) NOT NULL DEFAULT 'MANUAL',
    batch_id VARCHAR(50),
    created_by VARCHAR(50) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    CONSTRAINT ck_item_price_rev_sp_le_mrp CHECK (revised_selling_price <= revised_mrp),
    CONSTRAINT ck_item_price_rev_mrp_pos CHECK (revised_mrp >= 0),
    CONSTRAINT ck_item_price_rev_sp_pos CHECK (revised_selling_price >= 0)
);
```

### State Machine Lifecycle
```text
  [Draft] 
     │
     ▼
[PendingApproval] ────(Authorized Approval)────► [Approved]
     │                                               │
     ▼ (Rejected)                                    ├──(Effective Now)──────► [Active] ──(Replaced)──► [Superseded]
 [Rejected]                                          └──(Future Timestamp)──► [Scheduled] ─(Time Reached)─► [Active]
```

---

## 8. Tests Executed
The test suite `backend/tests/test_price_revisions.py` was executed against the live PostgreSQL database (`localhost:2781/smriti001`):

```powershell
.\.venv\Scripts\pytest.exe backend/tests/test_price_revisions.py -v
```

Tests verified:
1. `test_statutory_ceiling_invariant_sp_cannot_exceed_mrp`: Verifies statutory ceiling rejection when `Selling Price > MRP`.
2. `test_immediate_price_revision_activation_and_sync`: Verifies immediate activation and synchronization with catalog price columns.
3. `test_future_effective_revision_does_not_leak_prematurely`: Verifies future-dated revisions remain scheduled and active prices are preserved.
4. `test_historical_price_reconstruction_and_replay`: Verifies temporal reconstruction of prices at any past timestamp.
5. `test_pending_and_rejected_revisions_workflow`: Verifies approval threshold routing, pending status, rejection, and supervisor PIN bypass.
6. `test_overlapping_identical_timestamp_conflict_prevention`: Verifies rejection of duplicate revision requests targeting identical timestamps.
7. `test_bulk_create_revisions_processing`: Verifies row-level validation, SKU lookup, and batch reporting during bulk intake.
8. `test_pos_billing_authoritative_price_resolution_and_override`: Verifies backend rate validation and price tampering blocking in billing engine.
9. `test_submitted_invoice_snapshot_immutability`: Verifies submitted invoice line snapshots remain unchanged after subsequent revisions.
10. `test_api_create_and_list_price_revisions`: Verifies REST API router endpoints for creation, query filtering, and serialization.
11. `test_restrict_foreign_key_blocks_hard_delete_of_item_with_revisions`: (Phase 7A) Verifies that `ON DELETE RESTRICT` blocks catalog deletion when revisions exist.
12. `test_system_parameter_driven_approval_threshold`: (Phase 7C) Verifies dynamic resolution of approval thresholds and authorized roles via System Parameter Service.
13. `test_concurrency_safe_scheduled_activation`: (Phase 7D) Verifies periodic background activation with `with_for_update(skip_locked=True)` preventing worker race conditions.

---

## 9. Verification Results
- **Pytest Execution (13/13 Green)**:
  ```text
  ============================= test session starts =============================
  platform win32 -- Python 3.11.9, pytest-8.2.1, pluggy-1.6.0 -- F:\SMRITRretailNX\.venv\Scripts\python.exe
  cachedir: .pytest_cache
  rootdir: F:\SMRITRretailNX\backend
  configfile: pyproject.toml
  plugins: anyio-4.15.1, asyncio-0.23.7, cov-5.0.0
  asyncio: mode=Mode.AUTO
  collecting ... collected 13 items

  backend\tests\test_price_revisions.py::test_statutory_ceiling_invariant_sp_cannot_exceed_mrp PASSED [  7%]
  backend\tests\test_price_revisions.py::test_immediate_price_revision_activation_and_sync PASSED [ 15%]
  backend\tests\test_price_revisions.py::test_future_effective_revision_does_not_leak_prematurely PASSED [ 23%]
  backend\tests\test_price_revisions.py::test_historical_price_reconstruction_and_replay PASSED [ 30%]
  backend\tests\test_price_revisions.py::test_pending_and_rejected_revisions_workflow PASSED [ 38%]
  backend\tests\test_price_revisions.py::test_overlapping_identical_timestamp_conflict_prevention PASSED [ 46%]
  backend\tests\test_price_revisions.py::test_bulk_create_revisions_processing PASSED [ 53%]
  backend\tests\test_price_revisions.py::test_pos_billing_authoritative_price_resolution_and_override PASSED [ 61%]
  backend\tests\test_price_revisions.py::test_submitted_invoice_snapshot_immutability PASSED [ 69%]
  backend\tests\test_price_revisions.py::test_api_create_and_list_price_revisions PASSED [ 76%]
  backend\tests\test_price_revisions.py::test_restrict_foreign_key_blocks_hard_delete_of_item_with_revisions PASSED [ 84%]
  backend\tests\test_price_revisions.py::test_system_parameter_driven_approval_threshold PASSED [ 92%]
  backend\tests\test_price_revisions.py::test_concurrency_safe_scheduled_activation PASSED [100%]

  ====================== 13 passed, 24 warnings in 26.81s =======================
  ```
- **Vitest Frontend Offline Cache Execution (5/5 Green)**:
  ```text
  RUN  v4.1.11 F:/SMRITRretailNX

  ✓ src/tests/proposCatalogCache.test.ts (5 tests) 12ms

  Test Files  1 passed (1)
       Tests  5 passed (5)
    Duration  388ms
  ```
- **TypeScript Static Compilation**:
  ```powershell
  npx tsc --noEmit --skipLibCheck
  # Exit code 0 (0 errors)
  ```
- **Python Syntax Compilation**:
  ```powershell
  python -m py_compile backend/app/models/pricing.py backend/app/schemas/pricing.py backend/app/services/price_revision_service.py backend/app/services/pricing_engine.py backend/app/services/headless_billing.py backend/app/api/v1/pricing.py backend/alembic/versions/v1530_item_price_revisions.py backend/tests/test_price_revisions.py
  # Exit code 0 (0 errors)
  ```

---

## 10. Known Limitations
- Background scheduler daemon for activating `SCHEDULED` revisions when wall-clock time passes relies on periodic invocations of `POST /api/v1/pricing/revisions/activate-scheduled` or outbox daemon execution.

---

## 11. Future Work
- Integration with electronic shelf label (ESL) sync gateways for automated digital price tag updates upon revision activation.
- Expansion of bulk Excel (`.xlsx`) direct file upload alongside RFC-4180 CSV in Price Revision Studio.

---

## 12. Related ADRs
- `ADR-042`: Master Data Parameter Governance and Dual-Key Architecture.
- `ADR-PRV-001`: Immutable Temporal Price Ledger.
- `ADR-PRV-002`: Statutory Ceiling Database Check Constraints.

---

## 13. Related RFCs
- `RFC-PRICE-REV-01`: Standard Temporal Price Revision Specification.
- `RFC-POS-TAMPER-02`: POS Price Integrity & Supervisor Override Policy.
