<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.70.45
  Created      : 2026-10-09
  Modified     : 2026-10-09
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Implementation Plan: Cross-Database Staff Identity & Attendance Reconciliation (v6.70.45)

## 1. Objective
Eliminate HTTP 404 (`Not Found`) exceptions when inspecting or recording staff attendance and leave records for central directory users (e.g. `usr-cashier-direct`, `usr-manager-direct`) across company databases. Guarantee cross-database tenant reconciliation between `smritisys.users` (the control plane authentication and directory authority) and company transactional databases (e.g. `smriti001`), ensuring that queries and mutations seamlessly resolve without architectural or foreign key conflicts.

## 2. Business Motivation
Store administrators, branch managers, and auditors viewing the Staff Management Workspace (`StaffMasterWs.tsx`) or opening attendance and leave tabs encountered persistent HTTP 404 errors for seeded and central accounts (`GET /api/v1/staff/attendance?user_id=usr-cashier-direct` and `GET /api/v1/staff/attendance?user_id=usr-manager-direct`). In multi-tenant environments where user identities originate in the control-plane store (`smritisys`) while operational records live in company databases (`smriti001`), querying company-scoped HR tables without identity reconciliation caused false-negative missing staff failures and broken UI workflows.

## 3. Scope
- **Backend API (`backend/app/api/v1/staff.py`)**:
  - Enhance `_tenant_user` to inspect `company_db` first, fall back to `control_db` (`smritisys.users`), reconcile the identity into `company_db` with `_resolve_company_local_user`, and match by username before returning 404.
  - Update `_resolve_company_local_user` to preserve `control_user.id` when provisioning local identities and detect existing identities by `id` or `username`.
  - Update `list_attendance`, `get_attendance_summary`, `create_attendance`, `record_attendance_punch`, `list_leave_balances`, `list_leave_requests`, and `create_leave_request` to inject `control_db: AsyncSession = Depends(get_db)` and support matching across `{user_id, target_user.id}`.
- **Frontend Workspace (`src/components/staff/StaffMasterWs.tsx`)**:
  - Harden the HR data intake `.catch` handler to reset local state to empty arrays and suppress non-critical 404 notifications for newly provisioned personnel.
- **Automated Verification**:
  - Regression test suite `backend/app/tests/test_staff_attendance_cross_db_reconciliation.py`.

## 4. Current State
- `GET /staff/directory` returned central users from `control_db` (`smritisys.users`).
- When selecting staff, the frontend passed `control_user.id` (`usr-cashier-direct`) into `/staff/attendance?user_id=...`.
- `_tenant_user` queried only `company_db.users` by `User.id == user_id`. Because the user either did not exist in `company_db` or had a different auto-generated local ID (`usr-local-...`), `_tenant_user` raised HTTP 404 `Staff member was not found in the active tenant.`

## 5. Gap Analysis
| Component | Existing Behavior | Target Behavior |
|---|---|---|
| User Identity Resolution | Looked up only in `company_db.users` | Two-tier lookup: `company_db` -> `control_db` with automatic local reconciliation |
| Provisioned Local ID | Assigned random `usr-local-{uuid}` | Retains canonical `control_user.id` matching central directory identity |
| Attendance/Leave Query Filter | `where(AttendanceRecord.user_id == user_id)` | `where(AttendanceRecord.user_id.in_([user_id, target_user.id]))` |
| UI Error Intake | Dispatched popup notification on 404 | Gracefully initializes empty datasets and suppresses false-alarm 404 toasts |

## 6. Architecture Impact
- Enforces SMRITI Multi-Tenant System-of-Record integrity: `smritisys` is the root identity authority; `company_db` is the transactional store.
- Guarantees PostgreSQL `attendance_records` and `leave_requests` foreign key constraints (`ForeignKey("users.id")`) succeed because local user rows are provisioned before child records are inserted.

## 7. Proposed Design
1. `_tenant_user(db, user_id, tenant, control_db=None)`:
   - Primary: `select(User).where(User.id == user_id, User.company_id == tenant.company_id)`.
   - Secondary: Query `control_db` (or session factory `async_session()`) for `User.id == user_id`. If found, invoke `_resolve_company_local_user(control_user, db, tenant)`.
   - Tertiary: Query `company_db` by `User.username == user_id`.
   - Quaternary: Raise HTTP 404 if not found in any store.
2. In query endpoints, query by `user_id.in_([user_id, target_user.id])` to support records created prior to reconciliation.

## 8. Files Created
- `backend/app/tests/test_staff_attendance_cross_db_reconciliation.py`
- `docs/implementation/hr/Cross_Database_Staff_Identity_And_Attendance_Reconciliation_Plan_v6.70.45.md`
- `docs/walkthrough/hr/Cross_Database_Staff_Identity_And_Attendance_Reconciliation_v6.70.45.md`

## 9. Files Modified
- `backend/app/api/v1/staff.py`
- `src/components/staff/StaffMasterWs.tsx`
- `docs/implementation/README.md`
- `docs/walkthrough/README.md`
- `CHANGELOG.md`

## 10. Dependencies
- FastAPI 0.110+
- SQLAlchemy AsyncSession
- PostgreSQL 16+

## 11. Risks
- *Risk:* Performance overhead of dual-database lookup on missing IDs.
  *Mitigation:* The second database is checked only when the primary lookup returns `None`. Cached in memory per request.

## 12. Rollback Strategy
- Revert commit `git revert <commit>` or checkout previous commit.

## 13. Verification Plan
- Run `pytest backend/app/tests/test_staff_attendance_cross_db_reconciliation.py`.
- Run Vitest regression test suite.
- Run `tsc --noEmit`.
- Run production build `npm run build`.

## 14. Test Plan
- Unit assertions for `list_attendance`, `get_attendance_summary`, `list_leave_balances`, and `record_attendance_punch` with control-plane user IDs.

## 15. Documentation Impact
- Updated `CHANGELOG.md` (`v6.70.45`).
- Walkthrough generated and indexed in `docs/walkthrough/README.md`.

## 16. Deployment Plan
- Push to branch `smritiNX` on remote `origin`.
- Pull into test environment `F:\Smriti9` via `git pull`.

## 17. Status
Completed.

## 18. Related ADRs
- `ADR-001`: Multi-Tenant Control Plane vs Company Database Separation.
- `ADR-042`: Canonical HR Ledger & Attendance Identity Policy.

## 19. Related Walkthroughs
- `docs/walkthrough/hr/Cross_Database_Staff_Identity_And_Attendance_Reconciliation_v6.70.45.md`
