<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 1.0.0
  Created      : 2026-09-24
  Modified     : 2026-09-24
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough: API Routers Runtime Parity & Phase C Store Retirement

**Document ID:** WT-FDN-API-PARITY-v1.0.0  
**Classification:** Technical / Implementation Walkthrough  
**Status:** Completed  

---

## 1. Purpose
This walkthrough documents the comprehensive audit and remediation of runtime errors (`NameError`, `ImportError`, uninitialized variables, and schema drift) across FastAPI routers and test suites. Specifically, it eliminates runtime 500 errors occurring on fresh installations and external nodes by aligning routers with the Phase C `stores` table retirement (v1454) and restoring test suite collection parity.

## 2. Scope
- [backend/app/api/v1/finance.py](file:///F:/SMRITRretailNX/backend/app/api/v1/finance.py): Cash reconciliation & till status report endpoints.
- [backend/app/api/v1/inventory_reports.py](file:///F:/SMRITRretailNX/backend/app/api/v1/inventory_reports.py): Sales returns and stock adjustments reporting endpoints.
- [backend/app/api/v1/universal_import.py](file:///F:/SMRITRretailNX/backend/app/api/v1/universal_import.py): Batch purchase inward and sales return import loops.
- [backend/app/api/v1/company_center.py](file:///F:/SMRITRretailNX/backend/app/api/v1/company_center.py): Company directory listing & control-plane database connection.
- [backend/app/api/v1/staff.py](file:///F:/SMRITRretailNX/backend/app/api/v1/staff.py): Staff placement options, placements listing, assignment, and reassignment endpoints.
- [backend/app/tests/t_staff_verify.py](file:///F:/SMRITRretailNX/backend/app/tests/t_staff_verify.py): Pytest test battery for staff management and placements.

## 3. Files Created
None (Bugfix & Parity Hardening).

## 4. Files Modified
- `backend/app/api/v1/finance.py`: Added missing `datetime`, `timezone`, and `text` imports.
- `backend/app/api/v1/inventory_reports.py`: Added missing `Any` typing import.
- `backend/app/api/v1/universal_import.py`: Initialized `purchase_items` and `return_items` accumulator lists before row dispatch loop.
- `backend/app/api/v1/company_center.py`: Imported `psycopg2` and `CONTROL_PLANE_DB_URL`.
- `backend/app/api/v1/staff.py`: Severed `select(Store)` queries across 4 endpoints per Phase C migration `v1454_retire_stores_table.py`.
- `backend/app/tests/t_staff_verify.py`: Removed retired `Store` model import; migrated tests to branch-scoped placements.

## 5. Architecture Decisions
- **Phase C Store Retirement Alignment (ADR-v1454)**: The `stores` table was formally dropped via migration `v1454_retire_stores_table.py`. Staff placements are strictly branch-scoped with optional legacy string identifiers for store compatibility, without querying nonexistent tables.
- **Fail-Safe Import Initialization**: All accumulator collections in bulk data processors must be initialized prior to control flow loops to prevent unbound local reference errors.

## 6. Design Rationale
On fresh tenant database initializations, calling an endpoint with an unimported symbol or an ORM query to a non-existent table generates an immediate HTTP 500 error that impairs frontend initialization. Ensuring clean imports and full AST compliance prevents runtime crashes.

## 7. Implementation Summary
- Fixed 4 missing symbol imports in reporting and finance endpoints.
- Replaced 4 invalid `select(Store)` calls in `staff.py` with empty mappings/safe pass-throughs.
- Fixed 2 uninitialized loop accumulators in `universal_import.py`.
- Removed broken `Store` import in `t_staff_verify.py`.

## 8. Tests Executed
1. `pytest backend/app/tests/ --collect-only`: Verified all 391 test items across 61 test modules collect with 0 collection errors.
2. `pytest backend/app/tests/test_loyalty.py backend/app/tests/test_audit_chain.py`: Verified 15/15 passed.
3. `pytest backend/app/tests/test_schemas.py`: Verified 3/3 passed.
4. `py_compile`: Verified clean compilation across all modified modules.
5. AST Static Scope Analysis: Verified zero undefined identifiers across all modified routers.

## 9. Verification Results
- **Collection Status**: 391/391 tests collected cleanly (0 errors).
- **Unit Tests**: 18/18 passed in targeted test runs.
- **Import Verification**: All 6 modified files compile and import without warnings or errors.

## 10. Known Limitations
None.

## 11. Future Work
- Add pre-commit AST lint hook to detect unimported symbols automatically before staging.

## 12. Related ADRs
- `ADR-0042`: Phase C Legacy Store Entity Deprecation & Multi-Tenant Branch Model.

## 13. Related RFCs
- `RFC-0019`: Canonical Backend Architecture & Error Elimination.
