<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.31.3
  Created      : 2026-07-19
  Modified     : 2026-07-19
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough: SMRITI Setup Wizard Database Conflict Fix — v3.31.3

## 1. Purpose
Document the resolution of database operations conflict and `UniqueViolationError` on `setup_completed` configuration during onboarding setup wizard submission.

## 2. Scope
- Fix setup status checks and configuration queries in `backend/app/api/v1/system.py` to correctly handle `NULL` values.
- Update `backend/app/db/seed.py` to seed boolean configuration fields with standard defaults (`true`/`false`) and backfill existing entries.
- Add robust database logging for debugging future exceptions.

## 3. Files Created
None.

## 4. Files Modified
- [system.py](file:///f:/SMRITRretailNXmgrt/backend/app/api/v1/system.py)
- [error_handlers.py](file:///f:/SMRITRretailNXmgrt/backend/app/core/error_handlers.py)
- [seed.py](file:///f:/SMRITRretailNXmgrt/backend/app/db/seed.py)

## 5. Architecture Decisions
Utilize `is_not(True)` instead of `== False` in SQLAlchemy select filters when querying nullable boolean columns (e.g. `is_deleted`) to avoid SQL three-valued logic mismatch where NULL behaves differently than False.

## 6. Design Rationale
The default database seeds populated `setup_completed` as `true` but left its `is_active` and `is_deleted` values as `NULL` (due to raw SQL insert statements). Consequently, queries like `SystemConfig.is_deleted == False` returned zero rows, making the system report that setup was incomplete. When the wizard tried to re-submit and insert the setup key, the database threw a unique constraint violation (`UniqueViolationError`). Correcting both the seed insertions, backfilling NULL values, and modifying the query filter resolves the issue.

## 7. Implementation Summary
- Modified `get_system_config` in `system.py` to check `is_deleted.is_not(True)`.
- Updated `seed.py` to explicitly set `is_active=True` and `is_deleted=False` on the setup completed config and backfill existing databases.
- Added standard traceback logger output to `db_exception_handler` in `error_handlers.py`.

## 8. Tests Executed
Checked setup status and API responses:
```powershell
docker exec smriti-python-core python /app/test_setup_api.py
```

## 9. Verification Results
API response checks verified successful setup completion mapping:
```text
LOGIN STATUS: 200
SETUP STATUS: {'setupCompleted': True}
SETUP RESPONSE STATUS: 400
SETUP RESPONSE BODY: {'detail': 'Company setup has already been completed.'}
```

## 10. Known Limitations
None.

## 11. Future Work
None.

## 12. Related ADRs
None.

## 13. Related RFCs
None.
