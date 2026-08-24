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
-->

# Walkthrough: SMRITI Master Framework — Phase F.2 (Atomic Number Series Postgres Migration)

## 1. Purpose
Migrate the document number series allocation engine to a fully atomic database-backed model in PostgreSQL via Alembic, resolving sequence allocation race conditions and removing standard in-memory arrays.

## 2. Scope
- Fix string `padStart` JS-specific call bug on Python strings using `zfill` inside `backend/app/services/numbering.py`.
- Update FastAPI router `backend/app/api/v1/numbering.py` to allow both user-based JWT authentication and Express backend-to-FastAPI `X-Internal-Service-Key` requests.
- Re-route Express number series GET/POST/PUT/DELETE APIs to read/write `document_series` and `numbering_audit_logs` in Postgres directly.
- Refactor the Live sequence allocation route `/api/numbering/series/:id/allocate` and helper `allocateVoucherNumber()` in `src/lib/helpers.ts` to call the FastAPI atomic allocation endpoint.
- Retire in-memory arrays `documentSeriesList` and `numberingAuditLogs` in `src/state/store.ts`.

## 3. Files Created
- None.

## 4. Files Modified
- [numbering.py](file:///d:/IMP/GitHub/SMRITRretailNX/backend/app/services/numbering.py)
- [numbering.py](file:///d:/IMP/GitHub/SMRITRretailNX/backend/app/api/v1/numbering.py)
- [numbering.ts](file:///d:/IMP/GitHub/SMRITRretailNX/src/routes/numbering.ts)
- [system.ts](file:///d:/IMP/GitHub/SMRITRretailNX/src/routes/system.ts)
- [sales.ts](file:///d:/IMP/GitHub/SMRITRretailNX/src/routes/sales.ts)
- [purchase.ts](file:///d:/IMP/GitHub/SMRITRretailNX/src/routes/purchase.ts)
- [helpers.ts](file:///d:/IMP/GitHub/SMRITRretailNX/src/lib/helpers.ts)
- [store.ts](file:///d:/IMP/GitHub/SMRITRretailNX/src/state/store.ts)
- [numbering.test.ts](file:///d:/IMP/GitHub/SMRITRretailNX/src/tests/numbering.test.ts)
- [README.md](file:///d:/IMP/GitHub/SMRITRretailNX/docs/walkthrough/README.md)
- [CHANGELOG.md](file:///d:/IMP/GitHub/SMRITRretailNX/CHANGELOG.md)

## 5. Architecture Decisions
Utilize Python core FastAPI's `SELECT ... FOR UPDATE` row-level database locks as the single transactional authority for voucher numbering sequence allocations across both Node.js Express and Python servers.

## 6. Design Rationale
Removing configuration state mutations from transient Node memory prevents sequence gaps, collisions, and duplicate invoice IDs under concurrent POS sales loads.

## 7. Implementation Summary
- **Python Backend Fix:** Resolved padStart string method error and supported internal authorization dispatch in `/api/v1/numbering/series/{id}/allocate`.
- **Node API Refactoring:** Integrated pg pool queries into `/api/numbering/series` and `/api/numbering/logs` CRUD endpoints.
- **Voucher Helper Async Conversion:** Transformed `allocateVoucherNumber` into an asynchronous Promise-based handler, modifying sales invoice, purchase order, and GRN creators to await results.
- **Seeding Update:** Refactored dynamic setup provisioning in `system.ts` to INSERT document series configurations directly into PostgreSQL.

## 8. Tests Executed
- Rebuilt client and server bundles using `npm run build`.
- Ran compiler type-safety check using `npx tsc --noEmit`.
- Ran Vitest suite using `npm run test`.
- Executed 25 concurrent number allocation requests from Python client.

## 9. Verification Results
All tests passed successfully:
- vitest: 54/54 tests passed.
- concurrency: 25 unique, gapless numbers allocated successfully from 101 to 125.

## 10. Known Limitations
None.

## 11. Future Work
Migrate print templates and terms library (Phase F.3) in next sub-phases.

## 12. Related ADRs
- None.

## 13. Related RFCs
- None.
