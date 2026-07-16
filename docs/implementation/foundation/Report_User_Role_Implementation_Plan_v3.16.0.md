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

# Report User Role & Audit Logging Implementation Plan (v3.16.0)

## 1. Objective
Add a read-only **Report User** role to SMRITI Retail OS that blocks write operations at the backend/gateway API level, limits master/transaction forms to read-only views on the frontend, and records interaction events in audit trails.

## 2. Business Motivation
Allows management, auditors, and external tax consultants to inspect transactions, view ledgers, and download reports without the risk of accidental or malicious alterations to inventory levels or billing records.

## 3. Scope
- Add `REPORT_USER` enum value on FastAPI models.
- DB migration to alter `userrole` enum type in Postgres.
- Map and seed the new role with permissions in Express/local store.
- Gateway middleware to block write verbs (POST, PUT, DELETE, PATCH) for Report Users.
- Inbound endpoint `POST /api/system/audit-logs` for logging UI actions.
- React UI additions: Alert warning banners, input/button locks, context menu limits, and view/search/print/export audit event logs.

## 4. Current State
Only MANAGER, CASHIER, SYSADMIN, and VIEWER roles existed, with no global write-blocking middleware or unified client-side audit logging helper.

## 5. Gap Analysis
- Missing `REPORT_USER` role definition.
- Missing PG type enum migration script.
- Context menus and buttons allowed modifications for non-owner roles in some client areas.
- No client-dispatched logging endpoint for actions like print preview or report exports.

## 6. Architecture Impact
Dependencies point inward. Express acts as the proxy gateway, capturing and validating role headers before relaying requests to transactional databases.

## 7. Proposed Design
- Global Express middleware intercepts incoming requests and returns 403 Forbidden for `Report User` role writes.
- React components use `recordAuditAction` to report UI telemetry.

## 8. Files Created
- `src/tests/reportUser.test.ts`
- `backend/alembic/versions/514c894ed938_add_report_user_role.py`

## 9. Files Modified
- `backend/app/models/auth.py`
- `src/db/postgres/PostgresRepositories.ts`
- `src/state/store.ts`
- `db_store.json`
- `server.ts`
- `src/routes/system.ts`
- `src/lib/apiFetch.ts`
- `src/components/ReportDesignerTab.tsx`
- `src/components/QuickReportsWidget.tsx`
- `src/components/SalesStudioTab.tsx`
- `src/components/ItemMasterTab.tsx`
- `src/App.tsx`

## 10. Dependencies
FastAPI, PostgreSQL, Express, React, Lucide-react.

## 11. Risks
Incorrect middleware path exclusions might block legitimate read operations or audit logging. Exclusions are explicitly verified.

## 12. Rollback Strategy
Revert files to previous commit and restore database schema version.

## 13. Verification Plan
- Unit tests validating permission checks.
- Build linter verification.

## 14. Test Plan
Execute Vitest test runner.

## 15. Documentation Impact
Update user guides, developer guides, and walkthrough indexes.

## 16. Deployment Plan
Sync development repository with test environment, execute Alembic migrations, and restart containers.

## 17. Status
Completed.

## 18. Related ADRs
None.

## 19. Related Walkthroughs
- [Foundation_Report_User_Role_And_Audit_Logging_v3.16.0.md](../../walkthrough/foundation/Foundation_Report_User_Role_And_Audit_Logging_v3.16.0.md)
