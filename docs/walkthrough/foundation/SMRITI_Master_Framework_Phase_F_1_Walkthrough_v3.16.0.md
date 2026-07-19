<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.16.0
  Created      : 2026-07-13
  Modified     : 2026-07-13
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
-->

# Walkthrough: SMRITI Master Framework — Phase F.1 (Stores & Warehouses Postgres Migration)

## 1. Purpose
Migrate the `stores` and `warehouses` master entities from the in-memory arrays in the Express/local file-based state (`src/state/store.ts`) to proper, standalone relational database tables in PostgreSQL via Alembic.

## 2. Scope
- Add proper SQLAlchemy models for `Store` and `Warehouse` in Python backend.
- Update Alembic config to manage the `stores` and `warehouses` tables in the include_object filter.
- Generate and execute the Alembic migration script to provision the tables.
- Update client Express master routes (`src/routes/masters.ts`) to perform all CRUD operations against PostgreSQL using SQL queries, removing standard memory array pushes/updates/deletes.
- Clean up `stores` and `warehouses` in-memory arrays, load/save helpers, and self-healing initialization in `src/state/store.ts`.

## 3. Files Created
- [51ed6197a1e1_add_stores_and_warehouses.py](file:///d:/IMP/GitHub/SMRITRretailNX/backend/alembic/versions/51ed6197a1e1_add_stores_and_warehouses.py)

## 4. Files Modified
- [inventory.py](file:///d:/IMP/GitHub/SMRITRretailNX/backend/app/models/inventory.py)
- [env.py](file:///d:/IMP/GitHub/SMRITRretailNX/backend/alembic/env.py)
- [masters.ts](file:///d:/IMP/GitHub/SMRITRretailNX/src/routes/masters.ts)
- [store.ts](file:///d:/IMP/GitHub/SMRITRretailNX/src/state/store.ts)
- [README.md](file:///d:/IMP/GitHub/SMRITRretailNX/docs/walkthrough/README.md)
- [CHANGELOG.md](file:///d:/IMP/GitHub/SMRITRretailNX/CHANGELOG.md)

## 5. Architecture Decisions
Keep `stores` and `warehouses` separated into dedicated database tables referencing the `branches` and `companies` tables, adhering to relational normalization instead of nesting them in generic unstructured lookup tables. Use Postgres SQL routing in Express to strangel-fig these Tier-2 masters.

## 6. Design Rationale
Moving configuration files and organization topology nodes to Postgres prevents issues like state loss or synchronization drift across distributed servers and nodes, aligning with the SMRITI System-of-Record Policy.

## 7. Implementation Summary
- **SQLAlchemy Models:** Created `Store` and `Warehouse` models subclassing `BaseEntity` with `code`, `name`, `address` and model-specific properties (e.g. `store_type`, `is_transit`).
- **Alembic Mapping:** Updated `include_object` in `env.py` and ran auto-generation to produce the migration revision `51ed6197a1e1_add_stores_and_warehouses.py`.
- **Database Provisioning:** Successfully upgraded PostgreSQL schema via `alembic upgrade head`.
- **Express Backend CRUD Refactoring:** Replaced all in-memory push, splice, and map logic with standard parameterized Postgres SELECT, INSERT, UPDATE, and soft-delete SQL queries.
- **State Array Retirement:** Deleted all properties, serialization loops, and self-healing seeds associated with stores and warehouses in `store.ts`.

## 8. Tests Executed
- Rebuilt client and server bundles using `npm run build`.
- Ran compiler type-safety check using `npx tsc --noEmit`.
- Validated correct PostgreSQL query compilation and execution.

## 9. Verification Results
All tests passed successfully:
```powershell
npx tsc --noEmit
# Finished with no compilation errors
```

## 10. Known Limitations
None.

## 11. Future Work
Migrate remaining Tier-2 masters (Number Series, Print Templates, Terms Library) in future sub-phases.

## 12. Related ADRs
- None.

## 13. Related RFCs
- None.
