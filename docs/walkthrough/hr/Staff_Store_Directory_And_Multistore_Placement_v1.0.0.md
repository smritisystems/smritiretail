<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.17.0
  Created      : 2026-10-18
  Modified     : 2026-10-18
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough: Store Directory, Multi-Store Placement Governance & Customer 360 Integration (v1.0.0)

## 1. Purpose
This release implements the SMRITI Store Directory Workspace, multi-store staff roaming governance, and servicing store responsibility visibility in Customer 360. It retires the legacy global one-user-one-placement restriction in favor of a granular partial-unique-index architecture enforced in PostgreSQL (migration `v1538`).

## 2. Scope
- Unified Store Directory resolving internal company branches (`Branch`) and partner retail stores (`CustomerDeliveryLocation`).
- Collision-safe store identity (`INTERNAL_BRANCH:<id>` vs `CUSTOMER_STORE:<id>`).
- Live attendance integration strictly returning `NOT_LOGGED` when no physical check-in exists.
- Role exclusivity: at most one active `STORE_MANAGER` per internal branch and one active `PRIMARY_REPRESENTATIVE` per partner store.
- Multi-store roaming for sales representatives and field staff without duplicate assignments at the same store.
- Customer 360 Servicing Store & Responsibility badge with live data binding.
- Alembic migration `v1538` with fail-fast guards, control-plane pass-through, and post-DDL verification.

## 3. Files Created
1. `backend/alembic/versions/v1538_staff_multistore_placement_policy.py`: Migration replacing legacy global unique index with four partial unique indexes and safe rollback pre-flight check.
2. `backend/tests/test_store_staff_assignments.py`: 16 comprehensive backend unit tests covering roaming staff, role conflicts, attendance isolation, PSV integration, and migration target routing.
3. `src/components/store/StoreDirectoryWs.tsx`: Enterprise Store Directory & Responsibility Matrix Workspace.
4. `src/tests/storeDirectoryAndAssignments.test.ts`: 9 frontend unit tests for composite store IDs, strict attendance semantics, and placement validation.
5. `docs/walkthrough/hr/Staff_Store_Directory_And_Multistore_Placement_v1.0.0.md`: This governance walkthrough document.

## 4. Files Modified
1. `backend/app/models/staff_placement.py`: SQLAlchemy `StaffPlacementAssignment` indexes reconciled with 100% AST parity to migration `v1538`.
2. `backend/app/api/v1/staff.py`: Store Directory APIs (`/stores/directory`, `/stores/{code}/details`, `/stores/{code}/roster`, `/stores/{code}/history`, `/stores/{code}/customers`) and role exclusivity enforcement in `create_staff_placement`.
3. `src/types.ts`: Extended `Customer` interface with `storeCode`, `servicingStoreName`, and `primaryRepName`.
4. `src/components/customer/CustomerProfile.tsx`: Displayed Servicing Store & Responsibility badge.
5. `docs/walkthrough/README.md`: Appended entry to master walkthrough index.

## 5. Architecture Decisions
- **ADR-STORE-001 (Collision-Safe Store Identity):** Store codes can collide across internal company branches and partner retail delivery locations (e.g. Code `1888`). The system generates `${store_type}:${canonical_id}` to uniquely address and route store operations.
- **ADR-STAFF-002 (Decoupled Attendance vs Contractual Placement):** Scheduled or contractual placement at a store location never implies physical attendance. Physical presence requires an explicit unclosed check-in in `attendance_records`. Missing attendance is strictly `NOT_LOGGED`.
- **ADR-MIG-003 (Fail-Fast Migration Routing):** Migration `v1538` explicitly checks the active database. Control plane (`smritisys`) executes a documented pass-through to advance the linear revision pointer. System/template databases and tenant databases missing prerequisite tables fail fast immediately.

## 6. Design Rationale
Replacing the single compound unique index `COALESCE(host_delivery_location_id, internal_branch_id)` with two distinct partial unique indexes (`internal_branch_id IS NOT NULL` and `host_delivery_location_id IS NOT NULL`) avoids PostgreSQL NULL handling quirks and ensures exact parity between Alembic DDL and SQLAlchemy ORM metadata.

## 7. Implementation Summary
- **Migration v1538:** Dropped `uq_staff_placement_active_user`. Created `uq_staff_placement_active_branch_user`, `uq_staff_placement_active_cdl_user`, `uq_store_active_primary_rep`, and `uq_branch_active_manager`. Verified live in PostgreSQL.
- **Backend Endpoints:** Added unified directory with search, filter, and pagination; store details view; active roster with live attendance; historical placement audit logs; and mapped customer portfolios.
- **Frontend Workspace:** Built high-density Store Directory Workspace using SMRITI semantic tokens (`bg-theme-surface-1`, `border-theme-divider`, etc.), KPI summary cards, Store 360 slide-over drawer with 3 tabs, and safe assignment modal.

## 8. Tests Executed
- `pytest backend/tests/test_store_staff_assignments.py`: 16/16 passed (0 failures).
- `npx vitest run src/tests/storeDirectoryAndAssignments.test.ts src/tests/customerLocationHydration.test.ts src/tests/staffPlacementHelpers.test.ts src/tests/psvEngine.test.ts`: 24/24 passed across 4 suites.
- `npx tsc --noEmit`: 0 errors.
- `git diff --check`: 0 syntax or whitespace errors.

## 9. Verification Results
- All four partial unique indexes verified live in PostgreSQL databases `smriti001` and `smriti002`.
- Rollback pre-flight safety verified: multiple active placements block destructive downgrade.
- Role exclusivity verified: duplicate store managers or primary representatives raise HTTP 409 and violate PostgreSQL unique constraints (`23505`).

## 10. Known Limitations
Downgrading from `v1538` to `v1537` is intentionally blocked if any users hold multiple active store placements. Administrators must expire or suspend secondary placements with `status = 'SUSPENDED_ROLLBACK'` prior to downgrade. Historical records are never deleted.

## 11. Future Work
- Integration with biometric facial recognition hardware for automated attendance reconciliation.
- Geofenced mobile check-in verification for roaming field representatives.
- Store-level commission split matrix for shared store manager overrides.

## 12. Related ADRs
- ADR-STORE-001: Collision-Safe Store Identity Architecture
- ADR-STAFF-002: Strict Decoupling of Contractual Placement and Physical Presence
- ADR-MIG-003: Multi-Tenant Fail-Fast Migration Verification

## 13. Related RFCs
- RFC-2026-STORE-ROSTER: Unified Store Staffing & Responsibility Matrix
- RFC-2026-CUSTOMER-360: Servicing Store & Primary Representative Integration
