<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.16.0
  Created      : 2026-08-15
  Modified     : 2026-08-15
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# SMRITI Company Control Center Authentication & Authorization Hardening Walkthrough v1.0

## 1. Purpose
Document the security defect remediation for Company Control Center and Dev Tracker API endpoints to eliminate unauthenticated access and header spoofing (`x-user-id: usr_sysadmin`).

## 2. Scope
- `backend/app/api/v1/company_control_center.py`
- `backend/app/api/v1/dev_tracker.py`
- `backend/app/main.py`
- `backend/app/services/company_database_resolver.py`
- `backend/tests/test_company_control_center_security.py`

## 3. Files Created
- `backend/tests/test_company_control_center_security.py`

## 4. Files Modified
- `backend/app/api/v1/company_control_center.py`
- `backend/app/api/v1/dev_tracker.py`
- `backend/app/main.py`
- `backend/app/services/company_database_resolver.py`
- `backend/tests/test_company_control_center_e2e.py`

## 5. Architecture Decisions
- Replaced header-based mock user parameters (`x_user_id = Header("usr_sysadmin")`) with server-verified JWT authentication (`Depends(get_current_user)`).
- Restricted administrative control center endpoints (`/companies`, `/companies/create-request`, `/lifecycle/action`) and development intelligence endpoints (`/dev-tracker`, `/dev-tracker/scan`) to `UserRole.SYSADMIN`.
- Enforced tenant scope for non-SYSADMIN users requesting company detail or module entitlements (`company_id == current_user.company_id`).

## 6. Design Rationale
Identity and permissions must be derived exclusively from server-side JWT verification against the PostgreSQL control plane database (`smritisys`), failing closed with HTTP 401/403 on missing or invalid authentication.

## 7. Implementation Summary
Removed default administrative headers, added `require_role(UserRole.SYSADMIN)` dependencies, mounted `company_control_center` router in `main.py`, and added a regression security test suite.

## 8. Tests Executed
- `pytest backend/tests/test_company_control_center_security.py`
- `pytest backend/tests/test_company_control_center_e2e.py`
- Full Pytest Regression Suite (82 tests passed across 28 test suites in 5.96s)
- `npx vite build` (Exit Code 0 in 34.20s)

## 9. Verification Results
- Anonymous Request -> 401 Unauthorized
- Spoofed SYSADMIN Header -> 401 Unauthorized
- Ordinary CASHIER Request to Admin Route -> 403 Forbidden
- SYSADMIN Request -> 200 OK

## 10. Known Limitations
None. All 6 control center endpoints fail closed.

## 11. Future Work
Continued standing security scanning across newly added internal endpoints.

## 12. Related ADRs
- ADR-002: Multi-Company Control Plane Database Architecture

## 13. Related RFCs
- RFC-014: Tenant Identity & Security Governance
