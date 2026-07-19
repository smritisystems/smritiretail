<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.17.0
  Created      : 2026-07-14
  Modified     : 2026-07-14
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# SMRITI Master Data Consolidation Implementation Plan

This plan consolidates SMRITI's master and organizational data storage onto the FastAPI + PostgreSQL backend. The legacy Express-side master endpoints will be retired, and the obsolete, generic `master_entities` table (System C) will be decommissioned.

## User Review Required

> [!IMPORTANT]
> **Security Behavior Change (Authorization Gates):** We are adding `require_role(MANAGER, SYSADMIN)` and `get_current_user` dependencies to all write paths (create, update, delete) in both Tier-1 (lookup values) and Tier-2 (companies, branches, stores, warehouses) master API endpoints. On the legacy Express side, Tier-1 write endpoints lacked role-based authorization check. This is a security hardening action that will be audited before go-live.

> [!NOTE]
> **Preserving Contract Shapes:** All new FastAPI endpoints under `/api/v1/masters/...` will return identical JSON payloads matching what the Express masters API returned field-for-field (e.g. mapping boolean properties to status strings/camelCase keys where required) to prevent code churn inside the frontend `MasterManagementTab.tsx`.

## Open Questions

> [!NOTE]
> **Soft-Delete on `master_values`:** This plan implements soft-delete (`is_deleted` BOOLEAN, `deleted_at` TIMESTAMPTZ, `deleted_by` VARCHAR) on `master_values` to align with the rest of the SMRITI domain models. This directive assumes the architect approves this enhancement.

---

## Proposed Changes

### Database Layer (PostgreSQL & Alembic Migrations)

#### [NEW] [xxxx_add_master_values_soft_delete.py](file:///d:/IMP/GitHub/SMRITRretailNX/backend/alembic/versions/xxxx_add_master_values_soft_delete.py)
* Alembic migration to add `is_deleted` (BOOLEAN, default False), `deleted_at` (TIMESTAMPTZ, nullable), and `deleted_by` (VARCHAR(100), nullable) to `master_values`.

#### [NEW] [yyyy_drop_master_entities.py](file:///d:/IMP/GitHub/SMRITRretailNX/backend/alembic/versions/yyyy_drop_master_entities.py)
* Alembic migration to drop the obsolete `master_entities` table and its indexes (executed during Phase 4 decommissioning).

---

### Backend Components (FastAPI & SQLAlchemy Models)

#### [NEW] [master_lookup.py](file:///d:/IMP/GitHub/SMRITRretailNX/backend/app/models/master_lookup.py)
* Define SQLAlchemy models `MasterType` and `MasterValue` mapping the existing `master_types` and `master_values` tables.
* `MasterValue` will include the new soft-delete fields (`is_deleted`, `deleted_at`, `deleted_by`).

#### [MODIFY] [masters.py](file:///d:/IMP/GitHub/SMRITRretailNX/backend/app/api/v1/masters.py)
* Refactor `/api/v1/masters` endpoints to query normalized `Company`, `Branch`, `Store`, and `Warehouse` models instead of `MasterEntity`.
* Maintain plural endpoints `/api/v1/masters/{entity_type}` (`companies`, `branches`, `stores`, `warehouses`).
* Align response schemas to return the exact contract shape.

#### [NEW] [masters_tier2.py](file:///d:/IMP/GitHub/SMRITRretailNX/backend/app/schemas/masters_tier2.py)
* Pydantic request/response schemas for Company, Branch, Store, and Warehouse CRUD operations.

#### [NEW] [master_lookup.py](file:///d:/IMP/GitHub/SMRITRretailNX/backend/app/schemas/master_lookup.py)
* Pydantic schemas for `MasterType` and `MasterValue` (create, update, response).

#### [NEW] [master_lookup.py](file:///d:/IMP/GitHub/SMRITRretailNX/backend/app/api/v1/master_lookup.py)
* Port dynamic lookup endpoints from Express `masterLookup.ts` to FastAPI `/api/v1/masters`.
* Integrate `jsonschema` for validating `data` payloads against the stored `field_schema`.
* Add validation cache for compiled schemas to match the legacy `validatorCache` pattern.

---

### Frontend Components (React & Layout Engine)

#### [MODIFY] [MasterManagementTab.tsx](file:///d:/IMP/GitHub/SMRITRretailNX/src/components/MasterManagementTab.tsx)
* Change backend base URL fetches from `/api/masters/...` to `/api/v1/masters/...`.

---

### Decommissioning & Cleanup

#### [DELETE] [masters.ts](file:///d:/IMP/GitHub/SMRITRretailNX/src/routes/masters.ts)
#### [DELETE] [masterLookup.ts](file:///d:/IMP/GitHub/SMRITRretailNX/src/routes/masterLookup.ts)
#### [DELETE] [masterRepository.ts](file:///d:/IMP/GitHub/SMRITRretailNX/src/repositories/masterRepository.ts)
* Remove obsolete Express-side routes and repositories.

#### [MODIFY] [server.ts](file:///d:/IMP/GitHub/SMRITRretailNX/server.ts)
* Remove middleware registrations for legacy master paths.

#### [DELETE] [masters.py](file:///d:/IMP/GitHub/SMRITRretailNX/backend/app/models/masters.py)
#### [DELETE] [masters.py](file:///d:/IMP/GitHub/SMRITRretailNX/backend/app/schemas/masters.py)
* Remove obsolete generic `MasterEntity` model and schemas.

---

## Verification Plan

### Automated Tests
* Run Python FastAPI unit test suites using pytest:
  ```bash
  pytest backend/app/tests/
  ```
* Run Frontend unit and integration tests using Vitest:
  ```bash
  npm run test
  ```

### Manual Verification
* Run curl requests to check response contracts of:
  * `GET /api/v1/masters/companies`
  * `GET /api/v1/masters/lookup-types`
* Open the browser and visually verify that organizational nodes (Company, Branch, Store, Warehouse) and lookups (Department, Designation, Bank, Currency, Expense Category) can be created, updated, searched, and soft-deleted correctly in SMRITI UI.
