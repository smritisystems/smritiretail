<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.16.0
  Created      : 2026-07-13
  Modified     : 2026-07-13
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Foundation FastAPI v13 to v14 Migration Walkthrough

## 1. Purpose
This walkthrough documents the successful post-verification corrections of the FastAPI backend and Express routes, migrating `saveDb()` calls to the repository abstraction layer, verifying staff response schema attributes population, and establishing Indian market specific numbering and HSN master lookup utilities.

## 2. Scope
- Resolved timezone-naive database column constraint violation during `execute_task` in `backend/app/api/v1/exchange.py`.
- Developed `IStateRepository` to encapsulate legacy state mutations and eliminate all direct invocations of `saveDb()` inside `src/routes/`.
- Verified 35 fields inside `StaffUserResponse` and sub-schemas.
- Implemented client-side Indian format and HSN/GST master lookup table.

## 3. Files Created
- [test_staff_verification.py](file:///d:/IMP/GitHub/SMRITRretailNX/backend/app/tests/test_staff_verification.py) - Integration test validating the 35 fields on `StaffUserResponse` and sub-schemas.
- [indianFormat.ts](file:///d:/IMP/GitHub/SMRITRretailNX/src/utils/indianFormat.ts) - Indian numbering formatter utility.
- [indianFormat.test.ts](file:///d:/IMP/GitHub/SMRITRretailNX/src/tests/indianFormat.test.ts) - Unit tests for the Indian format utility.
- [hsnMaster.ts](file:///d:/IMP/GitHub/SMRITRretailNX/src/utils/hsnMaster.ts) - Indian HSN GST mapping master table and resolution utility.
- [hsnMaster.test.ts](file:///d:/IMP/GitHub/SMRITRretailNX/src/tests/hsnMaster.test.ts) - Unit tests for HSN lookup utility.

## 4. Files Modified
- [exchange.py](file:///d:/IMP/GitHub/SMRITRretailNX/backend/app/api/v1/exchange.py) - Timezone-naive date resolution for tasks.
- [user.py](file:///d:/IMP/GitHub/SMRITRretailNX/backend/app/schemas/user.py) - Pydantic schemas updated with compliance/HR fields.
- [db.ts](file:///d:/IMP/GitHub/SMRITRretailNX/src/core/interfaces/db.ts) - Added `IStateRepository` definition.
- [di.ts](file:///d:/IMP/GitHub/SMRITRretailNX/src/bootstrap/di.ts) - Registered `state` repository.
- [MemoryRepositories.ts](file:///d:/IMP/GitHub/SMRITRretailNX/src/db/memory/MemoryRepositories.ts) - Implemented `MemoryStateRepository`.
- [PostgresRepositories.ts](file:///d:/IMP/GitHub/SMRITRretailNX/src/db/postgres/PostgresRepositories.ts) - Implemented `PostgresStateRepository`.
- [SqliteRepositories.ts](file:///d:/IMP/GitHub/SMRITRretailNX/src/db/sqlite/SqliteRepositories.ts) - Stubbed `SqliteStateRepository`.
- [IndexedDbRepositories.ts](file:///d:/IMP/GitHub/SMRITRretailNX/src/db/indexeddb/IndexedDbRepositories.ts) - Stubbed `IndexedDbStateRepository`.
- Modified 12 Express route files under `src/routes/` to call `await container.state.saveDb()`.

## 5. Architecture Decisions
Created a general repository adapter `IStateRepository` mapping to `MemoryStateRepository` and `PostgresStateRepository` to encapsulate legacy state modifications and keep route handlers decoupled from memory data-stores.

## 6. Design Rationale
Leveraged a unified state wrapper repository to isolate legacy JSON file writing operations, guaranteeing that no routes bypass the Platform Abstraction Layer (PAL).

## 7. Implementation Summary
- Fixed timezone parsing bug in backend task executor.
- Replaced 52 direct `saveDb()` calls across 12 files in `src/routes/`.
- Configured 14 compliance fields in `PaymentDetails` Pydantic models.
- Set up lakhs/crores formatting regex and master HSN prefix lookup.

## 8. Tests Executed
- Python Pytest:
  - `pytest app/tests/test_exchange.py`
  - `pytest app/tests/test_staff_verification.py`
- Node Vitest:
  - `npm test`

## 9. Verification Results
- All 2 integration test suites passed in `smriti-python-core`.
- All 41 Vitest specs passed on the frontend client (including Indian formatters and HSN lookup tests).

## 10. Known Limitations
None.

## 11. Future Work
None.

## 12. Related ADRs
None.

## 13. Related RFCs
None.
