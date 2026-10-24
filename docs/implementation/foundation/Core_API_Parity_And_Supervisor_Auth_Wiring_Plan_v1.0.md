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
  Classification: Internal
-->

# SMRITI Core API Parity & Supervisor Auth Wiring Implementation Plan (v1.0)

## 1. Objective
Remediate Priority 1 and Priority 2 frontend-to-backend connectivity gaps identified during the comprehensive system audit. Specifically:
1. Resolve the `/universal-import/preview` and `/universal-import/commit` route mismatches for `ItemMasterStudio.tsx`.
2. Implement authoritative POS Supervisor PIN verification endpoint (`POST /api/v1/auth/verify-supervisor-pin`) to support manager overrides on price overrides, high cash variances, negative cash drawer pulls, and forced shift resets.
3. Wire the `/api/v1/warehouses` alias to the WMS warehouse listing endpoint to support `fieldContext.ts` godown lookups.
4. Wire the read/query endpoint (`GET /api/v1/security/audit-log`) in `backend/app/api/v1/security.py` to power `AuditLogView.tsx`.

## 2. Business Motivation
In retail POS and catalog management operations:
- Cashiers and store operators requiring price overrides, shift resets, or negative drawer pulls are blocked if the supervisor PIN authorization endpoint returns a 404.
- Catalog operators using ItemMasterStudio for batch file import encounter 404 failures if the backend routes are only mapped under `/import` and `/universal` without `/universal-import`.
- Store managers reviewing security trails and warehouse managers selecting godown destinations require live audit journals and warehouse lookups.

## 3. Scope
- **In Scope:**
  - `backend/app/main.py`: Add route aliases for `/universal-import` and `/warehouses`.
  - `backend/app/schemas/auth.py`: Add `SupervisorPinVerifyRequest` and `SupervisorPinVerifyResponse`.
  - `backend/app/api/v1/auth.py`: Implement `POST /api/v1/auth/verify-supervisor-pin` verifying manager/sysadmin roles, credentials, and generating signed override tokens.
  - `backend/app/api/v1/security.py`: Implement `GET /api/v1/security/audit-log` querying `SmritiAuditLog` with tenant scoping and pagination.
  - `backend/tests/test_supervisor_auth_api.py`: Automated pytest test suite verifying PIN verification, role enforcement, lockout, and invalid credentials.
- **Out of Scope:**
  - Full rewrite of analytical report queries (scheduled for Priority 4).
  - Retirement of orphaned modals (scheduled for Priority 3).

## 4. Current State
- `ProPosSupervisorAuthModal.tsx` queries `/api/v1/auth/verify-supervisor-pin`, which returns 404 (endpoint missing).
- `ItemMasterStudio.tsx` queries `/api/v1/universal-import/preview` and `/commit`, which returns 404 because `universal_import.py` is only mounted at `/import` and `/universal`.
- `fieldContext.ts` queries `/api/v1/warehouses`, while the backend route is `/api/v1/wms/warehouses`.
- `AuditLogView.tsx` queries `/api/v1/security/audit-log`, returning a placeholder state.

## 5. Gap Analysis
- Missing API definitions in `backend/app/api/v1/auth.py` and `backend/app/api/v1/security.py`.
- Router prefix mounting omissions in `backend/app/main.py`.

## 6. Architecture Impact
Zero database schema changes required. All database tables (`users`, `smriti_audit_log`, `warehouses`) already exist with complete Alembic migrations.

## 7. Proposed Design
1. **Supervisor PIN Verification:**
   - Endpoint: `POST /api/v1/auth/verify-supervisor-pin`
   - Validates that the authenticating user exists, is active, and possesses `SYSADMIN` or `MANAGER` role.
   - Compares plain PIN against `hashed_password` using `verify_password()`.
   - On success, returns `{ verified: True, supervisor_id, supervisor_name, auth_token, action_type, authorized_at, reason }`.
   - On failure, returns `{ verified: False, message: "Invalid Supervisor PIN or insufficient privileges." }`.
2. **Universal Import Router Alias:**
   - Mount `(universal_import, "/universal-import", ["Universal Import"])` in `_ROUTER_REGISTRY` of `main.py`.
3. **Warehouse Lookups Alias:**
   - Mount `(wms, "", ["Warehouse Management Core"])` or alias `/warehouses` in `main.py`.
4. **Security Audit Log Query:**
   - Endpoint: `GET /api/v1/security/audit-log`
   - Queries `SmritiAuditLog`, orders by `changed_at.desc()`, returns `{ entries: List[AuditEntryResponse], total: int }`.

## 8. Files Created
- `docs/implementation/foundation/Core_API_Parity_And_Supervisor_Auth_Wiring_Plan_v1.0.md`
- `backend/tests/test_supervisor_auth_api.py`

## 9. Files Modified
- `backend/app/schemas/auth.py`
- `backend/app/api/v1/auth.py`
- `backend/app/api/v1/security.py`
- `backend/app/main.py`
- `docs/implementation/README.md`

## 10. Dependencies
- FastAPI 0.111+
- SQLAlchemy 2.0+
- Passlib (bcrypt / Argon2)

## 11. Risks
- Minimal: additions are purely additive to existing routers without mutating existing contracts.

## 12. Rollback Strategy
- Revert modifications in `backend/app/api/v1/auth.py`, `backend/app/api/v1/security.py`, and `backend/app/main.py`.

## 13. Verification Plan
- Run automated pytest suite `backend/tests/test_supervisor_auth_api.py`.
- Run Vitest suite `npx vitest run src/tests/proposSupervisorAuth.test.ts`.
- Re-run `python scripts/audit_fe_be_parity.py` and confirm unmatched endpoints decrease.

## 14. Test Plan
- Test valid manager PIN verification.
- Test invalid PIN rejection.
- Test non-supervisor user (Cashier/Viewer) rejection even with valid credentials.
- Test `/api/v1/universal-import/preview` availability.
- Test `/api/v1/warehouses` availability.
- Test `/api/v1/security/audit-log` listing.

## 15. Documentation Impact
- Update `docs/implementation/README.md` master index.
- Create Walkthrough under `docs/walkthrough/foundation/`.

## 16. Deployment Plan
- Apply backend code changes; no migration step required.
- Restart FastAPI dev server.

## 17. Status
- In Progress

## 18. Related ADRs
- ADR-0014: Canonical System-of-Record Backend (FastAPI + Postgres)

## 19. Related Walkthroughs
- `docs/walkthrough/pos/POS_Cashier_UI_Split_Tenders_And_Wallet_v1.0.0.md`
