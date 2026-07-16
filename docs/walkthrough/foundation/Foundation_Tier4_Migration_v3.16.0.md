<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.16.0
  Created      : 2026-07-12
  Modified     : 2026-07-13
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Foundation Walkthrough: Backend Tier 4 FastAPI Migration

This walkthrough details the migration of 10 remaining backend domains from the legacy Express.js server to the unified FastAPI + PostgreSQL backend.

---

## 1. Purpose
Migrate the final 10 functional domains and all remaining long-tail API routes (totaling 66 routes) to the system-of-record backend on port 8000. This accomplishes full alignment with the Backend System-of-Record Policy (HREP, PAL, and Strangler-Fig migration goals).

## 2. Scope
The scope includes database model definitions, Pydantic request/response schemas, API endpoint routers, core services, database schema migrations via Alembic, and test suite execution.

## 3. Files Created
1. `backend/app/models/masters.py`
2. `backend/app/schemas/masters.py`
3. `backend/app/api/v1/masters.py`
4. `backend/app/models/numbering.py`
5. `backend/app/schemas/numbering.py`
6. `backend/app/services/numbering.py`
7. `backend/app/api/v1/numbering.py`
8. `backend/app/models/terms.py`
9. `backend/app/schemas/terms.py`
10. `backend/app/services/terms.py`
11. `backend/app/api/v1/terms.py`
12. `backend/app/models/attributes.py`
13. `backend/app/schemas/attributes.py`
14. `backend/app/services/attributes.py`
15. `backend/app/api/v1/attributes.py`
16. `backend/app/models/barcode.py`
17. `backend/app/schemas/barcode.py`
18. `backend/app/api/v1/barcode.py`
19. `backend/app/models/exchange.py`
20. `backend/app/schemas/exchange.py`
21. `backend/app/api/v1/exchange.py`
22. `backend/app/models/system.py`
23. `backend/app/schemas/system.py`
24. `backend/app/api/v1/system.py`
25. `backend/app/models/role.py`
26. `backend/app/schemas/role.py`
27. `backend/app/api/v1/roles.py`
28. `backend/app/api/v1/ai.py`
29. `backend/alembic/versions/6bc445ac1554_add_tier_4_domains.py`

## 4. Files Modified
1. `backend/app/models/auth.py`
2. `backend/app/schemas/user.py`
3. `backend/app/services/user.py`
4. `backend/app/api/v1/users.py`
5. `backend/app/api/v1/__init__.py`
6. `backend/app/main.py`
7. `backend/alembic/env.py`
8. `docker-compose.yml`
9. `backend/app/tests/test_user_management.py`

## 5. Architecture Decisions
- **Strangler-Fig Migration:** Ported remaining modules directly to the FastAPI + PostgreSQL stack on port 8000.
- **Transactional Row Locking:** Document sequence generation uses standard database lock `select().with_for_update()` to prevent numbering collision during concurrent transactions.
- **Metadata Isolation:** Restricting migrations exclusively to registered SMRITI tables via the `include_object` hook in Alembic config to safeguard third-party or shared tables.

## 6. Design Rationale
- **CamelCase JSON Payload Preservation:** Maintained camelCase naming conventions across Pydantic models (e.g. `branchId`, `fullName`) to match the legacy Express JS client payload expectation without breaking client interfaces.
- **UADHP Compliant Python Docstrings:** Applied correct python triple-quoted comment block format `""" ... """` to avoid Python interpreter syntax parsing errors.

## 7. Implementation Summary
- Extended the core `User` model with 27 additional columns, CRUD service methods, and authorization levels for manager/cashier.
- Added MASTERS module for organizational branches, departments, and entity definitions.
- Implemented Numbering sequence allocator with reset rules and audit tracker.
- Built Terms default resolution service and variants Descartes Cartesian product engine.
- Mounted compliance and vault keys `SGIP_VAULT_MASTER_KEY` directly inside container configurations.

## 8. Tests Executed
- Executed full test suite containing 99 tests using `pytest` inside the dockerized `smriti-python-core` container.
- Customized `test_user_management.py` assertions to align with new REST endpoints.

## 9. Verification Results
- All 99 automated tests passed successfully with 0 failures:
  ```text
  99 passed, 630 warnings in 50.62s
  ```

## 10. Known Limitations
None.

## 11. Future Work
Phase-wise frontend redirection of API requests to FastAPI `/api/v1/*` endpoint.

## 12. Related ADRs
- `ADR-008`: FastAPI System of Record Migration.

## 13. Related RFCs
None.
