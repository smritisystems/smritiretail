<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.7.0
  Created      : 2026-07-11
  Modified     : 2026-07-11
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Public
-->

# Foundation: Database Foundation & Domain Layer Walkthrough — v3.7.0

## 1. Purpose
This walkthrough documents the design and implementation of SMRITI Retail OS version `3.7.0`, establishing a standardized database foundation and domain services layer without breaking existing schemas or Express APIs.

## 2. Scope
- Mapped SQLAlchemy `BaseEntity` with audit logs, workspace tenant tags, soft deletion, and model versioning.
- Implemented `BaseRepository` interface supporting async PostgreSQL operations.
- Added Pydantic schemas under `backend/app/schemas/` (`crm.py`, `inventory.py`, `sales.py`).
- Added services under `backend/app/services/` (`crm.py`, `inventory.py`, `sales.py`) containing credit limit logic, stock checking, and transaction creation.
- Scaffolded Alembic migrations using async engines and including `include_object` schema isolation.
- Created extensive pytest coverage and verified no regressions.

## 3. Files Created
- [conftest.py](file:///d:/IMP/GitHub/SMRITRretailNX/backend/app/tests/conftest.py) — pytest fixtures for transactional db testing
- [test_repositories.py](file:///d:/IMP/GitHub/SMRITRretailNX/backend/app/tests/test_repositories.py) — Repository async CRUD tests
- [test_schemas.py](file:///d:/IMP/GitHub/SMRITRretailNX/backend/app/tests/test_schemas.py) — Pydantic schema validation tests
- [test_services.py](file:///d:/IMP/GitHub/SMRITRretailNX/backend/app/tests/test_services.py) — Business logic services tests
- [crm.py](file:///d:/IMP/GitHub/SMRITRretailNX/backend/app/schemas/crm.py) — CRM pydantic schemas
- [inventory.py](file:///d:/IMP/GitHub/SMRITRretailNX/backend/app/schemas/inventory.py) — Inventory pydantic schemas
- [sales.py](file:///d:/IMP/GitHub/SMRITRretailNX/backend/app/schemas/sales.py) — Sales billing pydantic schemas
- [crm.py](file:///d:/IMP/GitHub/SMRITRretailNX/backend/app/services/crm.py) — CRM business services
- [inventory.py](file:///d:/IMP/GitHub/SMRITRretailNX/backend/app/services/inventory.py) — Inventory business services
- [sales.py](file:///d:/IMP/GitHub/SMRITRretailNX/backend/app/services/sales.py) — Sales billing business services
- [README.md](file:///d:/IMP/GitHub/SMRITRretailNX/backend/alembic/README.md) — Alembic usage instructions
- [12b68ccebec7_baseline_schema.py](file:///d:/IMP/GitHub/SMRITRretailNX/backend/alembic/versions/12b68ccebec7_baseline_schema.py) — First-run baseline migration

## 4. Files Modified
- [env.py](file:///d:/IMP/GitHub/SMRITRretailNX/backend/alembic/env.py) — Configured async Alembic runner and `include_object` table filter
- [config.py](file:///d:/IMP/GitHub/SMRITRretailNX/backend/app/core/config.py) — Version default bumped to 3.7.0
- [base.py](file:///d:/IMP/GitHub/SMRITRretailNX/backend/app/db/base.py) — Fixed uuid import shadowing, added UADHP header
- [crm.py](file:///d:/IMP/GitHub/SMRITRretailNX/backend/app/models/crm.py) — Model columns aligned with Postgres Standalone schema
- [inventory.py](file:///d:/IMP/GitHub/SMRITRretailNX/backend/app/models/inventory.py) — Aligned fields and GIN indexes
- [sales.py](file:///d:/IMP/GitHub/SMRITRretailNX/backend/app/models/sales.py) — Aligned columns and relationships
- [package.json](file:///d:/IMP/GitHub/SMRITRretailNX/package.json) — Version default bumped to 3.7.0
- [CHANGELOG.md](file:///d:/IMP/GitHub/SMRITRretailNX/CHANGELOG.md) — Recorded v3.7.0 release history
- [test_models.py](file:///d:/IMP/GitHub/SMRITRretailNX/backend/app/tests/test_models.py) — Cleaned memory assertion tests

## 5. Architecture Decisions
- **Option B (modified_at)**: Confirmed timestamp audit column named `modified_at` to remain backward-compatible with Node schema.
- **Table Filter (`include_object`)**: Restricted Alembic from touching/dropping non-Python tables like `shifts` or `pos_profiles`, preserving old schema.

## 6. Design Rationale
- Standardized Pydantic models validate input constraints early at the API border, preventing invalid database records.
- Service-layer methods contain the core calculations (taxation, credit controls) to separate database mapping (repositories/models) from runtime constraints.

## 7. Implementation Summary
All backend Python structures have been successfully linked to an active PostgreSQL session. Bumping the package version to `3.7.0` has verified no typescript compilation regressions or test breakages.

## 8. Tests Executed
```powershell
python -m pytest app/tests
npx tsc --noEmit
npm run test
```

## 9. Verification Results
```
============================= test session starts =============================
platform win32 -- Python 3.14.3, pytest-9.0.2, pluggy-1.6.0
collected 15 items

app\tests\test_main.py ......                                            [ 40%]
app\tests\test_models.py ...                                             [ 60%]
app\tests\test_repositories.py .                                         [ 66%]
app\tests\test_schemas.py ...                                            [ 86%]
app\tests\test_services.py ..                                            [100%]
======================= 15 passed, 25 warnings in 1.92s =======================
```

## 10. Known Limitations
`company_id` and `branch_id` remain plain strings in `BaseEntity` without Foreign Key constraints, as company master tables are not yet present in the workspace.

## 11. Future Work
Incrementally migrate remaining models (e.g. shifts, POS registers, payments) into Python models and link relationships dynamically.

## 12. Related ADRs
- None.

## 13. Related RFCs
- None.
