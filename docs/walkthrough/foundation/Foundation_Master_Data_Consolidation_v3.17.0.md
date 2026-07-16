<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.17.0
  Created      : 2026-07-14
  Modified     : 2026-07-14
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough: SMRITI Master Data Consolidation

## 1. Purpose
Consolidate dynamic lookup tables (Tier-1) and organizational structures (Tier-2: Company, Branch, Store, Warehouse) onto the FastAPI + Postgres backend, serving as the single system of record. This completes theStrangler-Fig migration for the foundation module, decommissioning redundant Express controllers and repositories.

## 2. Scope
- Mount dynamic schema validation lookup routes under `/api/v1/masters/...`.
- Mount organizational structure (Company, Branch, Store, Warehouse) CRUD routes under `/api/v1/masters/...`.
- Alembic database migration to support soft-deletions on dynamic lookup tables (`master_values`).
- Alembic database migration to drop the decommissioned legacy `master_entities` table.
- Frontend cutover of `MasterManagementTab.tsx` to FastAPI using `apiFetchV1` to enforce JWT propagation and unified HREP error experience.
- Complete decommissioning of legacy Express-side files: `src/routes/masters.ts`, `src/routes/masterLookup.ts`, `src/repositories/masterRepository.ts`.

## 3. Files Created
- [test_masters_consolidation.py](file:///d:/IMP/GitHub/SMRITRretailNX/backend/app/tests/test_masters_consolidation.py): Integration test suite.
- [93e07a92812b_add_master_values_soft_delete.py](file:///d:/IMP/GitHub/SMRITRretailNX/backend/alembic/versions/93e07a92812b_add_master_values_soft_delete.py): Migration adding soft-delete fields.
- [96b45b17b8b1_drop_master_entities.py](file:///d:/IMP/GitHub/SMRITRretailNX/backend/alembic/versions/96b45b17b8b1_drop_master_entities.py): Migration dropping decommissioned legacy table.
- [masters_tier2.py](file:///d:/IMP/GitHub/SMRITRretailNX/backend/app/schemas/masters_tier2.py): Pydantic schemas.
- [master_lookup.py](file:///d:/IMP/GitHub/SMRITRretailNX/backend/app/models/master_lookup.py): SQLAlchemy models.
- [master_lookup.py](file:///d:/IMP/GitHub/SMRITRretailNX/backend/app/schemas/master_lookup.py): Pydantic schemas.
- [master_lookup.py](file:///d:/IMP/GitHub/SMRITRretailNX/backend/app/api/v1/master_lookup.py): FastAPI dynamic lookup endpoints.

## 4. Files Modified
- [env.py](file:///d:/IMP/GitHub/SMRITRretailNX/backend/alembic/env.py): Configured table scopes.
- [masters.py](file:///d:/IMP/GitHub/SMRITRretailNX/backend/app/api/v1/masters.py): Refactored routers for ORM direct queries.
- [main.py](file:///d:/IMP/GitHub/SMRITRretailNX/backend/app/main.py): Registered the lookup routers.
- [server.ts](file:///d:/IMP/GitHub/SMRITRretailNX/server.ts): Decommissioned Express route mounts.
- [MasterManagementTab.tsx](file:///d:/IMP/GitHub/SMRITRretailNX/src/components/MasterManagementTab.tsx): Switched to `apiFetchV1` client fetches.
- [README.md](file:///d:/IMP/GitHub/SMRITRretailNX/docs/implementation/README.md): Marked plan as Completed.
- [README.md](file:///d:/IMP/GitHub/SMRITRretailNX/docs/walkthrough/README.md): Appended index entry.

## 5. Architecture Decisions
- **Strangler-Fig Migration:** Phased migration where the legacy endpoints are routed to FastAPI.
- **FastAPI + Postgres System of Record:** Decommission Express-side state caching in favor of transactional Postgres.
- **Unified Validation Gateway:** Enforces JSON Schema validation directly in FastAPI.

## 6. Design Rationale
- **Type Safety Enforcement:** Fixed mypy column assignments using `setattr`.
- **Soft-Delete Alignment:** Added `is_deleted`, `deleted_at`, and `deleted_by` to ensure historical auditing.

## 7. Implementation Summary
- **Tier-1 Lookups:** Implemented a compiled Draft7 JSON Schema validator cache to avoid recompiling schemas on every request.
- **Tier-2 Restructuring:** Mounted company, branch, store, and warehouse operations under a clean REST structure.
- **Decommissioning:** Dropped legacy `master_entities` table and cleanly excised Express routes.

## 8. Tests Executed
- Executed `test_masters_consolidation.py` verifying full API coverage (Tier-1, Tier-2, Schema validation, soft deletes).
- Executed full frontend compilation checks (`npx tsc --noEmit`).

## 9. Verification Results
- **Backend Tests:** Passed 3/3 tests successfully:
  ```bash
  python -m pytest backend/app/tests/test_masters_consolidation.py
  ======= 3 passed, 67 warnings in 3.86s =======
  ```
- **Type Checking:** Mypy checks on consolidation modules passed with zero errors.
- **Frontend Build:** Completed successfully with zero typescript errors.

## 10. Known Limitations
None. All components function as intended.

## 11. Future Work
Migrate the remaining POS/Shift and Sales/Purchase modules.

## 12. Related ADRs
- `ADR-004`: Database Decoupling & Unified FastAPI Backend.

## 13. Related RFCs
- `RFC-007`: Strangler-Fig Monolith Migration Strategy.
