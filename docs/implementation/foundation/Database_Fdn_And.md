<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.7.0
  Created      : 2026-07-11
  Modified     : 2026-07-11
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Implementation Plan: SMRITI Database Foundation & Domain Layer — v3.7.0 (Approved)

## Verification Metadata
- Repository State: Verified
- Repository Version: 3.6.0
- Git Revision: 9467340
- Evidence Level: A (Execution + Code Verification)
- Review Method: SGAS Evidence-Based Audit
- Architecture Style: Incremental (Non-Destructive)
- Backward Compatibility: Mandatory

---

## 1. Objective
Refactor database models and repositories in-place, introducing custom SQLAlchemy BaseEntity audit mixins (using Option B convention), a generic reusable BaseRepository class, Pydantic schemas, validation-rich services, and API route controllers verified by unit tests and migrations, maintaining full backward compatibility.

---

## 2. Business Motivation
Provide SMRITI with a reliable database foundation and separation of layers, supporting multi-company, soft delete, auditing, and business services validations.

---

## 3. Scope
- **Models & Repositories preservation:** Enhance existing code in-place under `backend/app/models/` and `backend/app/repositories/`. No directories are renamed, moved, or deleted.
- **SQLAlchemy BaseEntity:** Implement `BaseEntity` mixin with audit/lifecycle/tenant fields (using Option B: `modified_at`).
- **Alembic Scaffold:** Generate missing `env.py`, `versions/` folder, and baseline migration.
- **Pydantic Schemas & Services:** Add Pydantic validation schemas in `backend/app/schemas/` and Service layers in `backend/app/services/`.
- **Verification:** SQLite/PostgreSQL async test suite verifying repositories, schemas, services, and Alembic migrations.

---

## 4. Current State
- `db/base.py`, `models/*.py`, and `repositories/product.py` use SQLAlchemy 2.x async ORM.
- `alembic.ini` is present but the `alembic/` script folder (`env.py`, scaffold) is missing.
- Verification tests in `test_models.py` are simple in-memory assertions with no database or service coverage.

---

## 5. Gap Analysis
- Audit attributes (`uuid`, `company_id`, etc.) are missing from existing models.
- Alembic scaffolding is missing.
- Repository layer lacks reuse; Pydantic schemas and Service validation layers do not exist.

---

## 6. Non Goals
This milestone will NOT:
- Rename existing folders
- Move existing models
- Replace repositories
- Rewrite APIs
- Introduce breaking database changes
- Implement full DDD restructuring
- Implement multi-tenant enforcement
- Replace existing middleware
- Replace existing AI modules

---

## 7. Architecture Impact
- Standard clean architecture separation: `Routes -> Services -> Repositories -> Models`.
- `company_id` and `branch_id` exist as plain string columns.
  - *Note:* `company_id` and `branch_id` are intentionally implemented as VARCHAR columns during this milestone. Foreign key relationships will be introduced only after Company and Branch master entities are implemented. No FK migration is part of v3.7.0.

---

## 8. Proposed Design
- Adopt Option B: Use `modified_at` in `BaseEntity` to match existing conventions.
- Setup `BaseRepository` in `backend/app/repositories/base.py`.
  - *Note:* Existing repositories are not required to inherit `BaseRepository` during this milestone. Adoption shall occur incrementally.
- Services contain all business logic. Repositories contain only persistence logic. Routes remain thin and delegate work to services. Validation occurs through Pydantic schemas and service-layer rules.
- Scaffold `backend/alembic/env.py`.

---

## 9. Files Created
- `[NEW]` [Database_Foundation_And_Domain_Layer_Plan_v3.7.0.md](file:///d:/IMP/GitHub/SMRITRretailNX/docs/implementation/foundation/Database_Foundation_And_Domain_Layer_Plan_v3.7.0.md) (this file)
- `[NEW]` [Foundation_Database_Foundation_And_Domain_Layer_Walkthrough_v3.7.0.md](file:///d:/IMP/GitHub/SMRITRretailNX/docs/walkthrough/foundation/Foundation_Database_Foundation_And_Domain_Layer_Walkthrough_v3.7.0.md)
- `[NEW]` [base.py](file:///d:/IMP/GitHub/SMRITRretailNX/backend/app/repositories/base.py)
- `[NEW]` [crm.py](file:///d:/IMP/GitHub/SMRITRretailNX/backend/app/schemas/crm.py)
- `[NEW]` [inventory.py](file:///d:/IMP/GitHub/SMRITRretailNX/backend/app/schemas/inventory.py)
- `[NEW]` [sales.py](file:///d:/IMP/GitHub/SMRITRretailNX/backend/app/schemas/sales.py)
- `[NEW]` [crm.py](file:///d:/IMP/GitHub/SMRITRretailNX/backend/app/services/crm.py)
- `[NEW]` [inventory.py](file:///d:/IMP/GitHub/SMRITRretailNX/backend/app/services/inventory.py)
- `[NEW]` [sales.py](file:///d:/IMP/GitHub/SMRITRretailNX/backend/app/services/sales.py)
- `[NEW]` [test_repositories.py](file:///d:/IMP/GitHub/SMRITRretailNX/backend/app/tests/test_repositories.py)
- `[NEW]` [test_schemas.py](file:///d:/IMP/GitHub/SMRITRretailNX/backend/app/tests/test_schemas.py)
- `[NEW]` [test_services.py](file:///d:/IMP/GitHub/SMRITRretailNX/backend/app/tests/test_services.py)
- `[NEW]` `backend/alembic/env.py`
- `[NEW]` `backend/alembic/README.md`
- `[NEW]` `backend/alembic/versions/` (folder for versions)

---

## 10. Files Modified
- `[MODIFY]` [base.py](file:///d:/IMP/GitHub/SMRITRretailNX/backend/app/db/base.py) — Add BaseEntity subclass.
- `[MODIFY]` [crm.py](file:///d:/IMP/GitHub/SMRITRretailNX/backend/app/models/crm.py) — Standardize header, inherit BaseEntity.
- `[MODIFY]` [inventory.py](file:///d:/IMP/GitHub/SMRITRretailNX/backend/app/models/inventory.py) — Standardize header, inherit BaseEntity.
- `[MODIFY]` [sales.py](file:///d:/IMP/GitHub/SMRITRretailNX/backend/app/models/sales.py) — Standardize header, inherit BaseEntity/Base.
- `[MODIFY]` [__init__.py](file:///d:/IMP/GitHub/SMRITRretailNX/backend/app/models/__init__.py) — Standardize header.
- `[MODIFY]` [product.py](file:///d:/IMP/GitHub/SMRITRretailNX/backend/app/repositories/product.py) — Standardize header, inherit BaseRepository.
- `[MODIFY]` [__init__.py](file:///d:/IMP/GitHub/SMRITRretailNX/backend/app/repositories/__init__.py) — Standardize header.
- `[MODIFY]` [test_models.py](file:///d:/IMP/GitHub/SMRITRretailNX/backend/app/tests/test_models.py) — Standardize header, assert BaseEntity attributes.
- `[MODIFY]` [package.json](file:///d:/IMP/GitHub/SMRITRretailNX/package.json) — Update version to 3.7.0 (gated on tests passing).
- `[MODIFY]` [CHANGELOG.md](file:///d:/IMP/GitHub/SMRITRretailNX/CHANGELOG.md) — Document version 3.7.0.
- `[MODIFY]` [README.md](file:///d:/IMP/GitHub/SMRITRretailNX/docs/implementation/README.md) — Register plan.
- `[MODIFY]` [CONSOLIDATED_PLANS.md](file:///d:/IMP/GitHub/SMRITRretailNX/docs/implementation/CONSOLIDATED_PLANS.md) — Consolidate plan.
- `[MODIFY]` [README.md](file:///d:/IMP/GitHub/SMRITRretailNX/docs/walkthrough/README.md) — Register walkthrough.
- `[MODIFY]` [CONSOLIDATED_WALKTHROUGHS.md](file:///d:/IMP/GitHub/SMRITRretailNX/docs/walkthrough/CONSOLIDATED_WALKTHROUGHS.md) — Consolidate walkthrough.

---

## 11. Dependencies
- standard Python dependencies (SQLAlchemy 2.x, asyncpg, alembic, pytest).

---

## 12. Risks
- None. Fully backward compatible and additive changes.

---

## 13. Rollback Strategy
- Revert modifications using Git checkout or reset.

---

## 14. Verification Plan
- Execute `pytest backend/app/tests/ --cov=backend/app`
- Test baseline migrations applying and reversing: `alembic upgrade head` and `alembic downgrade -1`.
- Run `npm run test` and `npm run lint` (`tsc --noEmit`).

### Testing Baseline
- Existing baseline: 9/9 tests passing.
- Post-implementation: All existing tests must remain green. New repository, schema, and service tests must pass.

---

## 15. Acceptance Criteria
- No deleted files
- No renamed files
- No moved folders
- Existing APIs remain functional
- Existing UI remains functional
- Existing tests remain green
- New tests pass
- Alembic baseline migration verified
- Documentation updated
- No duplicate implementations introduced
- Backward compatibility preserved

---

## 16. Deferred Milestones
- Domain-based module restructuring
- Permissions package
- Validators package
- ADR documentation
- Multi-tenant enforcement
- Company & Branch master entities
- Warehouse isolation
- Full DDD migration

---

## 17. Final Review
- Status                 : APPROVED
- Implementation Style   : Incremental
- Architecture Risk      : LOW
- Backward Compatibility : PRESERVED
- Evidence Quality       : VERIFIED
- Scope                  : ADDITIVE

**Recommendation:**
Proceed with implementation. Do not introduce destructive refactoring. Maintain existing architecture while extending functionality.
