<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.15.0
  Created      : 2026-07-12
  Modified     : 2026-07-12
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
-->

# DB Unification and Security Hotfix Walkthrough — Phase 2 & Phase 0

## 1. Purpose
This document details the implementation of Phase 0 (CORS Security Hotfix), Phase 1b (Characterization Test Suite Setup), and Phase 2 (Database Unification) in the SMRITIRetailNX codebase.

## 2. Scope
The scope includes securing FastAPI CORS headers, setting up the Vitest testing suite, writing unit and integration tests for password hashing, GST calculations, terms text resolution, and authentication routes, unifying the database interface layer (PAL) to postgres, and refactoring six route modules to utilize these repositories.

## 3. Files Created
- `vitest.config.ts` — configuration file for running tests in a Node.js environment
- `src/tests/helpers.test.ts` — unit tests for password hashing, GST tiers, and terms text resolution
- `src/tests/auth.test.ts` — integration tests for login, session check, logout, and locks
- `src/db/memory/MemoryRepositories.ts` — in-memory repository mock layer for test execution

## 4. Files Modified
- `backend/app/core/config.py` — added ALLOWED_ORIGINS and made JWT_SECRET_KEY mandatory
- `backend/app/main.py` — constrained CORS allowance to settings.ALLOWED_ORIGINS
- `package.json` — updated devDependencies and test script to execute `vitest run`
- `server.ts` — exported app and wrapped server start for tests
- `src/core/interfaces/db.ts` — declared missing repository interfaces and update methods
- `src/bootstrap/di.ts` — registered new repositories and the memory provider
- `src/db/sqlite/SqliteRepositories.ts` — added SQLite stubs throwing offline errors
- `src/db/indexeddb/IndexedDbRepositories.ts` — added IndexedDB stubs throwing offline errors
- `src/state/store.ts` — removed sessions from flat-file database serialization
- `src/routes/auth.ts` — refactored authentication endpoints to utilize repository layer
- `src/routes/users.ts` — refactored user management endpoints to use repository layer
- `src/routes/customers.ts` — refactored CRM endpoints to use repository layer
- `src/routes/pos.ts` — refactored POS shift and checkout endpoints to use repositories
- `src/routes/sales.ts` — refactored sales invoicing endpoints to use repositories
- `src/routes/purchase.ts` — refactored procurement endpoints to use repositories

## 5. Architecture Decisions
- Constrained CORS allowed origins dynamically using configurations to prevent credential exposure.
- Implemented in-memory repository class mocks inside `MemoryRepositories.ts` to allow fully functioning unit/integration tests without running live databases.
- Threw explicit `Method not implemented in offline mode` exceptions from SQLite and IndexedDB repositories instead of silently failing with empty values.

## 6. Design Rationale
- Creating a testing safety net (Phase 1b) before refactoring routing modules (Phase 2) prevents regressions.
- Restricting CORS origins with credentials disabled security breaches where cross-origin websites could hijack active session logs.

## 7. Implementation Summary
- Refactored 6 core route files (`auth.ts`, `users.ts`, `customers.ts`, `pos.ts`, `sales.ts`, `purchase.ts`) to use `container` instead of local arrays, eliminating `saveDb()` for database-migrated fields.
- Seeded memory and postgres tables cleanly from configuration properties.

## 8. Tests Executed
- Executed `npm test` running 18 tests under Vitest.

## 9. Verification Results
```
 ✓ src/tests/helpers.test.ts (12 tests) 34ms
 ✓ src/tests/auth.test.ts (6 tests) 102ms
 Test Files  2 passed (2)
      Tests  18 passed (18)
```

## 10. Known Limitations
- Offline SQLite and IndexedDB modules do not yet fully replicate postgres schemas; operations throw offline-mode errors.

## 11. Future Work
- Complete Phase 2b (migrating remaining in-memory lists to postgres tables).
- Upgrade PBKDF2 iterations to 600,000 in Phase 3.

## 12. Related ADRs
- ADR-014: Platform Abstraction Layer (PAL) Database Unification

## 13. Related RFCs
- RFC-009: Unified Testing & Security Standards
