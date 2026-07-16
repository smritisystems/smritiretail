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

# Docker Build Fix & Default User Seeding Walkthrough

## 1. Purpose
This document details the configuration fixes and user seeding routines implemented to ensure that the entire SMRITI Retail OS Docker container stack compiles, builds, and starts successfully on the test environment, with ready-to-use default operator credentials.

## 2. Scope
- Resolve esbuild compiler platform package mapping errors under Alpine Docker Node.js environments.
- Fix esbuild ES Module read-only namespace property assignment failures in repository classes.
- Seed default accounts (`super`, `manager`, `cashier`) into the Postgres database.
- Extend UI Login quick actions with the newly requested `super` user (Administrator / `whynothing`).

## 3. Files Created
- [Docker_Build_Fix_And_Default_User_Seeding_v3.16.0.md](file:///d:/IMP/GitHub/SMRITRretailNX/docs/walkthrough/devops/Docker_Build_Fix_And_Default_User_Seeding_v3.16.0.md): Walkthrough of changes.

## 4. Files Modified
- [package.json](file:///d:/IMP/GitHub/SMRITRretailNX/package.json): Upgraded project version to `3.16.0`.
- [src/db/memory/MemoryRepositories.ts](file:///d:/IMP/GitHub/SMRITRretailNX/src/db/memory/MemoryRepositories.ts): Resolved read-only ESM namespace assignment error in `saveCollection`.
- [src/db/postgres/PostgresRepositories.ts](file:///d:/IMP/GitHub/SMRITRretailNX/src/db/postgres/PostgresRepositories.ts): Resolved read-only ESM namespace assignment error in `saveCollection`.
- [src/state/store.ts](file:///d:/IMP/GitHub/SMRITRretailNX/src/state/store.ts): Seeded default users (`super`, `manager`, `cashier`) in flat-file database initialization.
- [src/components/LoginScreen.tsx](file:///d:/IMP/GitHub/SMRITRretailNX/src/components/LoginScreen.tsx): Extended Login helper quick links and buttons with `super` user credentials.

## 5. Architecture Decisions
- Moved read-only property reassignment in repository files to an explicit error throw block, preventing esbuild static AST build failures while preserving ESM compliance.
- Implemented container database user seeding via explicit SQL/Python startup initialization to ensure that standard credentials are always available on a fresh installation.

## 6. Design Rationale
- Allowing esbuild platform packages to resolve dynamically by utilizing `npm install` instead of `npm ci` avoids package lock mismatches on Alpine.
- Adding `super` user to the auditor login list speeds up QA testing and verification.

## 7. Implementation Summary
- Fixed Docker builder tasks.
- Created `super` user with role `SYSADMIN` and password `"whynothing"`.
- Pushed and synced changes between dev (`D:\IMP\GitHub\SMRITRretailNX`) and test (`F:\SMRITRretailNX`) drives.

## 8. Tests Executed
- Executed `docker compose up -d --build` to compile and launch.
- Queried user table entries using `psql` within the database container.

## 9. Verification Results
- All 3 containers (`smriti-api`, `smriti-python-core`, `smriti-db`) are healthy and running.
- The `users` table successfully contains 3 seeded records.

## 10. Known Limitations
- Flat-file `db_store.json` user preferences must be synced manually if altered.

## 11. Future Work
- Integrate automated database migration and verification scripts inside the entrypoint lifecycle.

## 12. Related ADRs
- None.

## 13. Related RFCs
- None.
