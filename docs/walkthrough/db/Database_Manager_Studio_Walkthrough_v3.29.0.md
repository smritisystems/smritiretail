<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.29.0
  Created      : 2026-08-20
  Modified     : 2026-08-20
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# SMRITI Database Manager (DB Studio) Walkthrough v3.29.0

## 1. Purpose
This walkthrough documents the design, architecture, implementation, and verification of the dedicated, enterprise-grade **Database Manager & Studio** within the SMRITI Retail OS frontend and FastAPI backend.

## 2. Scope
- Multi-database telemetry & switching (`smritisys`, `smriti001`, `smriti002`, `smriti_test_fresh`).
- Real-time table explorer with live row counts, category tags, disk sizes, and column metadata.
- Paginated table records viewer with column search, sorting, and CSV export.
- Column structure, primary keys, foreign key constraints (with delete rules), and index inspector.
- Alembic migration version tracking and synchronization status.
- Safe, read-only SQL query console (`SELECT`, `WITH`, `EXPLAIN`) with destructive statement prevention.
- Strict `SYSADMIN` role gating and zero credentials exposure.

## 3. Files Created
1. `backend/app/schemas/database_manager.py`: Pydantic models for database summary, table summary, column schema, table data, migrations, and SQL query execution.
2. `backend/app/api/v1/database_manager.py`: FastAPI router providing 6 administrative endpoints.
3. `backend/app/tests/test_database_manager.py`: Pytest suite covering all database manager endpoints and security role gates.
4. `src/components/DatabaseManagerTab.tsx`: Modern Fiori Horizon styled workspace for database administration.
5. `src/tests/databaseManager.test.ts`: Vitest suite verifying launchpad catalog registration and role-based access.
6. `docs/walkthrough/db/Database_Manager_Studio_Walkthrough_v3.29.0.md`: Formal WGP walkthrough document.

## 4. Files Modified
1. `backend/app/main.py`: Imported and mounted `database_manager.router` at `/api/v1/database-manager`.
2. `src/components/launchpad/launchpadCatalog.ts`: Registered `database-manager` tile under `System & Operations` (gated to `SYSADMIN`).
3. `src/App.tsx`: Mounted `DatabaseManagerTab` in `renderTab`.
4. `src/components/shell/navigationResolver.ts`: Added `database-manager` to `system` context navigation.
5. `src/tests/fioriLaunchpad.test.ts`: Added `database-manager` to `REGISTERED_APP_TABS`.
6. `docs/walkthrough/README.md`: Appended new walkthrough entry to master index.
7. `CHANGELOG.md`: Added release notes under `[3.29.0]`.

## 5. Architecture Decisions
- **Strict Read-Only Guard:** The SQL console rejects all DDL and DML write operations (`DROP`, `DELETE`, `TRUNCATE`, `UPDATE`, `INSERT`, `ALTER`, `CREATE`, `GRANT`, `REVOKE`) to ensure zero risk of accidental data loss.
- **Dynamic Database Switching:** Multi-tenant databases are resolved and queried via safe parameter validation using configured PostgreSQL engine credentials without hardcoded passwords or raw connection string leakage.
- **Category Heuristics:** Tables are automatically classified into functional business categories (Sales & POS, Inventory & Catalog, Procurement, CRM, Security, Masters, Reporting) for rapid navigation.

## 6. Design Rationale
Retail administrators frequently need to inspect database state, confirm Alembic migration revisions, view row counts, and verify schema constraints across multiple company databases. Embedding a native, secure DB Studio into SMRITI eliminates reliance on external GUI tools like pgAdmin while maintaining strict RBAC governance.

## 7. Implementation Summary
- **Backend API:** Built `/api/v1/database-manager/databases`, `/tables`, `/tables/{table}/schema`, `/tables/{table}/data`, `/migrations`, and `/query`.
- **Frontend Studio:** Created `DatabaseManagerTab.tsx` with 4 interactive sub-tabs (Table Data, Schema & FKs, Alembic Migrations, SQL Console), row inspector drawer, and CSV exporter.
- **Role Gating:** Only users with `SYSADMIN` role can access the endpoints and launchpad tile.

## 8. Tests Executed
1. `backend/app/tests/test_database_manager.py`: 5 passed.
2. `src/tests/databaseManager.test.ts`: 3 passed.
3. `src/tests/fioriLaunchpad.test.ts`: 9 passed.
4. `npx vitest run`: 22 test files, 134 tests passed.
5. `npx tsc --noEmit`: 0 errors.

## 9. Verification Results
All backend endpoints and frontend components passed automated verification.

## 10. Known Limitations
- SQL Console is strictly read-only by design. Data modifications must be performed through business domain APIs or controlled Alembic migrations.

## 11. Future Work
- Visual table relationship diagram generator (ERD view).
- Table vacuum & reindex trigger for maintenance windows.

## 12. Related ADRs
- `ADR-004`: PostgreSQL Tenant Isolation & Database Routing.
- `ADR-009`: Platform Abstraction Layer (PAL) & Backend System of Record.

## 13. Related RFCs
- `RFC-022`: System Operations & Database Telemetry Console.
