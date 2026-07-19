<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.16.0
  Created      : 2026-07-13
  Modified     : 2026-07-13
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Foundation: Report User Role & Audit Logging Walkthrough (v3.16.0)

This walkthrough documents the implementation of the new **Report User** role, its read-only view restrictions, and the audit log event triggers across SMRITI Retail OS.

## 1. Purpose
Introduces the `"Report User"` role which allows full visibility into reports (with print and export privileges) and read-only verification access to transaction forms while completely blocking any creation, edit, or deletion write actions at both the frontend and backend API layers. Captures vital UI events (views, exports, prints, searches, and filters) in the system audit logs.

## 2. Scope
- Add `REPORT_USER` to backend Python enums and database schema.
- Map the new role between DB values and client representations.
- Seed the role with its associated permissions (`reports.view`, `reports.print`, `reports.export`, `reports.email`, `reports.schedule`).
- Enforce a global API middleware filter on the Express gateway blocking all POST, PUT, DELETE, and PATCH requests for `"Report User"`.
- Implement a `POST /api/system/audit-logs` endpoint in the gateway.
- Integrate audit logging hooks and read-only views on the frontend React UI (Report Designer, Quick Reports, Sales Studio, and Item Master catalog).
- Write and pass integration tests for permission restrictions.

## 3. Files Created
- [reportUser.test.ts](file:///d:/IMP/GitHub/SMRITRretailNX/src/tests/reportUser.test.ts) (Integration test suite for role checking)
- [514c894ed938_add_report_user_role.py](file:///d:/IMP/GitHub/SMRITRretailNX/backend/alembic/versions/514c894ed938_add_report_user_role.py) (Alembic DB migration)

## 4. Files Modified
- [backend/app/models/auth.py](file:///d:/IMP/GitHub/SMRITRretailNX/backend/app/models/auth.py) (Added `REPORT_USER` enum value)
- [src/db/postgres/PostgresRepositories.ts](file:///d:/IMP/GitHub/SMRITRretailNX/src/db/postgres/PostgresRepositories.ts) (Added role mappings)
- [src/state/store.ts](file:///d:/IMP/GitHub/SMRITRretailNX/src/state/store.ts) (Added role seeding and updated default user types)
- [db_store.json](file:///d:/IMP/GitHub/SMRITRretailNX/db_store.json) (Seeded Report User role config)
- [server.ts](file:///d:/IMP/GitHub/SMRITRretailNX/server.ts) (Injected Report User write operations guard middleware)
- [src/routes/system.ts](file:///d:/IMP/GitHub/SMRITRretailNX/src/routes/system.ts) (Added audit log endpoint)
- [src/lib/apiFetch.ts](file:///d:/IMP/GitHub/SMRITRretailNX/src/lib/apiFetch.ts) (Exported `recordAuditAction` helper)
- [src/components/ReportDesignerTab.tsx](file:///d:/IMP/GitHub/SMRITRretailNX/src/components/ReportDesignerTab.tsx) (Simulated Report User permissions and logs)
- [src/components/QuickReportsWidget.tsx](file:///d:/IMP/GitHub/SMRITRretailNX/src/components/QuickReportsWidget.tsx) (Added print, preview, and export logs)
- [src/components/SalesStudioTab.tsx](file:///d:/IMP/GitHub/SMRITRretailNX/src/components/SalesStudioTab.tsx) (Enforced read-only controls, banners, and logs)
- [src/components/ItemMasterTab.tsx](file:///d:/IMP/GitHub/SMRITRretailNX/src/components/ItemMasterTab.tsx) (Enforced read-only catalog controls, banners, and logs)
- [src/App.tsx](file:///d:/IMP/GitHub/SMRITRretailNX/src/App.tsx) (Passed `currentUser` prop to sub-tabs)

## 5. Architecture Decisions
- **Middleware-Based Protection**: Applied a global Express middleware after `sessionResolver` to intercept and drop unauthorized write actions (POST/PUT/DELETE/PATCH) for Report Users, rather than having to modify every single route file.
- **Double Audit Recording**: Auditing logs to both the PostgreSQL DB repository (via PAL) and the memory array (via `logAudit`) ensures they render properly on both legacy layouts and true database logs.

## 6. Design Rationale
- **Visual Alert Banners**: Warns users immediately upon loading that they are operating in Read-Only Verification Mode.
- **Debounced Search Logging**: Searches are logged using a 1.2-second debounce timer to avoid clogging the database with intermediate character typing logs.

## 7. Implementation Summary
- Added `REPORT_USER` role to PostgreSQL type enum via Alembic revision.
- Implemented global protection middleware on Express gateway.
- Leveraged `recordAuditAction` helper on frontend components to dispatch UI actions (like report views, print previews, exports, and searches) to the audit log.
- Disabled checkout, create, edit, save, import, and delete controls on Sales and Item Master panels.

## 8. Tests Executed
- Running `npm run lint` for TypeScript compilation: Passed.
- Running `npm run test` with Vitest (including `reportUser.test.ts`): Passed.

## 9. Verification Results
```bash
> smriti-retail-os@3.16.0 test
> vitest run

 ✓ src/tests/helpers.test.ts (12 tests) 1890ms
 ✓ src/tests/reportUser.test.ts (5 tests) 935ms
 ✓ src/tests/validatorsAndFormatters.test.ts (5 tests) 34ms
 ✓ src/tests/numbering.test.ts (3 tests) 6ms
 ✓ src/tests/gst.test.ts (6 tests) 6ms
 ✓ src/tests/indianFormat.test.ts (5 tests) 5ms
 ✓ src/tests/hsnMaster.test.ts (4 tests) 5ms
 ✓ src/tests/auth.test.ts (6 tests) 4699ms

 Test Files  8 passed (8)
      Tests  46 passed (46)
   Duration  6.46s
```

## 10. Known Limitations
None. All API protection and UI restriction requirements are fully resolved.

## 11. Future Work
Extend audit log detail captures to cover specific filter parameter breakdowns.

## 12. Related ADRs
- None.

## 13. Related RFCs
- None.
