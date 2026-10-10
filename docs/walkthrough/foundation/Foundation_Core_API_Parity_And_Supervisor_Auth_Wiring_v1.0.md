<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.64.0
  Created      : 2026-10-03
  Modified     : 2026-10-03
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal Walkthrough
-->

# Walkthrough: SMRITI Core API Parity & Supervisor Auth Wiring (v1.0)

## 1. Purpose
Remediate critical route mismatches and wire missing core backend operational endpoints identified during the forensic pending audit, restoring parity between frontend UI components (`ProPosSupervisorAuthModal.tsx`, `ItemMasterStudio.tsx`, `AuditLogView.tsx`, `fieldContext.ts`) and the FastAPI backend.

## 2. Scope
- Authoritative Supervisor PIN verification endpoint (`POST /api/v1/auth/verify-supervisor-pin`).
- Router alias mounting for ItemMasterStudio (`/api/v1/universal-import/*`).
- Root alias mounting for Warehouse & Godown lookups (`/api/v1/warehouses`).
- Security configuration and activity audit log query endpoint (`GET /api/v1/security/audit-log`).
- Automated backend and frontend regression test suites.

## 3. Files Created
- `docs/implementation/foundation/Core_API_Parity_And_Supervisor_Auth_Wiring_Plan_v1.0.md`
- `backend/tests/test_core_api_parity_wiring.py`
- `docs/walkthrough/foundation/Foundation_Core_API_Parity_And_Supervisor_Auth_Wiring_v1.0.md`

## 4. Files Modified
- `backend/app/schemas/auth.py`
- `backend/app/api/v1/auth.py`
- `backend/app/api/v1/security.py`
- `backend/app/main.py`
- `docs/implementation/README.md`
- `docs/walkthrough/README.md`

## 5. Architecture Decisions
- **Role-Gated Supervisor Verification:** Only active users possessing `SYSADMIN` or `MANAGER` roles are permitted to authorize operational overrides in ProPOS.
- **Passlib Argon2/Bcrypt Credential Verification:** Standard `verify_password()` handles authentication against user password hashes with backward-compatible support for baseline seeded demo store managers.
- **Zero Schema Mutation:** Re-used existing PostgreSQL tables (`users`, `smriti_audit_log`, `warehouses`) without requiring database migrations.
- **Zero Breaking Risk Aliasing:** Retained `/import` and `/universal` while adding `/universal-import` and `/warehouses` in `backend/app/main.py`.

## 6. Design Rationale
- Cashiers operating ProPOS frequently encounter price overrides, forced shift resets, and high cash variances. Having a non-existent or failing endpoint resulted in blocked register operations.
- `ItemMasterStudio.tsx` explicitly documents its contract to call `/api/v1/universal-import/preview` and `/commit`; mounting this alias directly in FastAPI restores instant compatibility without frontend code edits.

## 7. Implementation Summary
1. Added Pydantic schemas `SupervisorPinVerifyRequest` and `SupervisorPinVerifyResponse` in `backend/app/schemas/auth.py`.
2. Implemented `verify_supervisor_pin` in `backend/app/api/v1/auth.py` verifying username, active status, supervisor role, and credential hash, returning a signed `token-sup-*` token.
3. Added `(universal_import, "/universal-import", ["Universal Import"])` and `(wms, "", ["Warehouse Management Core"])` to `_ROUTER_REGISTRY` in `backend/app/main.py`.
4. Implemented `get_security_audit_log` in `backend/app/api/v1/security.py` querying `smriti_audit_log` with pagination and tenant isolation.
5. Created pytest suite `backend/tests/test_core_api_parity_wiring.py`.

## 8. Tests Executed
```bash
# Backend pytest suite
.venv\Scripts\python.exe -m pytest backend/tests/test_core_api_parity_wiring.py -v

# Frontend Vitest suite
npx vitest run src/tests/proposSupervisorAuth.test.ts

# Quantitative Parity Verification
.venv\Scripts\python.exe scripts/audit_fe_be_parity.py
```

## 9. Verification Results
- `backend/tests/test_core_api_parity_wiring.py`: 6/6 passed in 19.29s.
- `src/tests/proposSupervisorAuth.test.ts`: 4/4 passed in 428ms.
- Unmatched API endpoints decreased from 42 unique endpoints to 37 unique endpoints (matched calls increased from 395 to 403).

## 10. Known Limitations
- The 31 analytical reports in `ReportDesignerTab.tsx` and 28 in-memory mock modals remain to be wired in subsequent priority waves.

## 11. Future Work
- Priority 3: Clean up and retire 44 orphaned / unreferenced components.
- Priority 4: Implement analytical query aggregators in `reports.py` and `sales_reports.py`.

## 12. Related ADRs
- ADR-0014: FastAPI + PostgreSQL Sole Backend Architecture

## 13. Related RFCs
- RFC-6021: ProPOS Real-Time Shift & Cash Drawer Control Plane
