<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.31.0
  Created      : 2026-08-25
  Modified     : 2026-08-25
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Backend Full Test Suite Stabilization & Multi-Tenant Isolation Verification

## 1. Purpose
This walkthrough documents the full stabilization and verification of all standard (`test_*.py`) and auxiliary (`t_*.py`) backend test suites in SMRITI Retail OS, achieving a 100% test pass rate (221/221 backend tests passed, 325/325 frontend tests passed, 0 TypeScript errors).

## 2. Scope
- Verification and repair of 19 standard pytest modules (`backend/app/tests/test_*.py`).
- Verification and repair of 14 auxiliary pytest modules (`backend/app/tests/t_*.py`).
- Resolution of FastAPI dependency injection overrides for `get_company_db`, `get_ecom_webhook_session`, and `get_tenant_context`.
- Mitigation of tenant key collisions using dynamic UUID isolation across test transactions.
- Alignment of target database resolution (`smritisys` vs `postgres`) in database management diagnostics.

## 3. Files Created
- `docs/walkthrough/foundation/Backend_Full_Test_Suite_Stabilization_v3.31.0.md`

## 4. Files Modified
- `backend/app/tests/test_ecom_channel.py`
- `backend/app/tests/test_services.py`
- `backend/app/tests/t_api_v1_migr.py`
- `backend/app/tests/t_company_select.py`
- `backend/app/tests/t_db_manager.py`
- `backend/app/tests/t_dyn_attr.py`
- `backend/app/tests/t_ecom_connect.py`
- `backend/app/tests/t_masters_consol.py`
- `backend/app/tests/t_prod_identity.py`
- `backend/app/tests/t_prod_page.py`
- `backend/app/tests/t_rpt_schedule.py`
- `backend/app/tests/t_staff_verify.py`
- `backend/app/tests/t_supp_payment.py`
- `backend/app/tests/t_tenant_iso.py`
- `backend/app/tests/t_tenant_isolate.py`
- `docs/walkthrough/README.md`

## 5. Architecture Decisions
- **`get_company_db` Test Override Parity**: In multi-database multi-tenant routes, test fixtures systematically override both `get_db` and `get_company_db` so all downstream queries execute against the active test transaction.
- **Dynamic Tenant Key Isolation**: To avoid primary key collisions on `companies` and `branches` across concurrent test executions, all helper fixtures dynamically generate UUID-based identifiers.
- **Strict Parameterless Test Fixtures**: Dependency override helpers in test files avoid `*args, **kwargs` signatures, preventing FastAPI from interpreting them as mandatory HTTP query parameters.

## 6. Design Rationale
Ensures repeatable, deterministic, headless execution of test suites on development and CI/CD pipelines without reliance on external pre-seeded database states.

## 7. Implementation Summary
- Fixed `test_services.py` credit limit validation check and tax inclusive flags.
- Updated `t_ecom_connect.py` webhook authentication headers (`X-Internal-Service-Key`).
- Updated `t_api_v1_migr.py` company setup test by clearing `SystemConfig` `setup_completed` prior to invocation and handling uppercase branch normalization.
- Re-pointed database manager inspection tests in `t_db_manager.py` to the migrated schema database `smritisys`.
- Stabilized dynamic attribute and product identity test models with complete schema attributes (`price`, `mrp`, `gst_percentage`, `hsn_code`, `is_active`).

## 8. Tests Executed
1. `python -m pytest backend/app/tests/` (153/153 passed, 100%)
2. `python -m pytest backend/app/tests/t_*.py` (68/68 passed, 100%)
3. `npm run lint` (`tsc --noEmit`, 0 errors)
4. `npm test -- --run` (325/325 passed across 42 test suites, 100%)

## 9. Verification Results
- **Evidence Level**: A (100% passed terminal verification logs)
- **Backend Standard Tests**: 153/153 Green
- **Backend Auxiliary Tests**: 68/68 Green
- **Frontend Vitest Suites**: 325/325 Green
- **Frontend Typecheck**: 0 Errors

## 10. Known Limitations
- Background task warning logs regarding Pydantic V2 class-based config deprecations remain non-blocking.

## 11. Future Work
- Gradual modernization of remaining Pydantic `parse_raw` calls to `model_validate_json` across legacy models.

## 12. Related ADRs
- `docs/adr/ADR_001_FastAPI_PostgreSQL_Sole_System_of_Record.md`

## 13. Related RFCs
- `docs/rfc/RFC_002_Multi_Database_Multi_Tenant_Architecture.md`
