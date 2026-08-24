<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.20.0
  Created      : 2026-07-15
  Modified     : 2026-07-15
  Copyright    : (c) SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# MC2 Phase 5 -- Express Business Route Retirement

## 1. Purpose
Remove 10 dead Express business route modules from server.ts and migrate the last
remaining Express-only API call (audit-log) to FastAPI.

## 2. Scope
Frontend routing, Express server configuration, FastAPI system.py, flags.ts.
No Postgres schema changes. No service layer changes.

## 3. Files Created
None.

## 4. Files Modified

| File | Change |
|---|---|
| backend/app/api/v1/system.py | Added POST + GET /api/v1/system/audit-logs |
| src/lib/apiFetch.ts | recordAuditAction now calls apiFetchV1 (not Express) |
| src/config/flags.ts | 12 new USE_FASTAPI_* flags, version 3.20.0 |
| server.ts | Removed 10 import + app.use() blocks |

## 5. Files Tagged Deprecated (not deleted)
src/routes/pos.ts, sales.ts, purchase.ts, inventory.ts, numbering.ts,
terms.ts, exchange.ts, barcode.ts, reports.ts, customers.ts

## 6. Architecture Decisions
**AD-4 DEFERRED:** auth.ts kept on Express (App.tsx uses fetch('/api/auth/me') directly)
**AD-5 RESOLVED:** db_store.json not found -- no data migration required
**AD-6 DEFERRED:** assistant.ts kept on Express (no FastAPI AI module per policy)

## 7. Final Architecture (post Phase 5)
`
Browser
  -> Express :3000
       [Auth Enforcement: requireAuth middleware]
       [Session Resolver: sessionResolver]
       /api/v1/* -> PROXY -> FastAPI :8000    (ALL business logic)
       /api/auth/* -> auth.ts (still Express) (App.tsx uses raw fetch)
       /api/assistant/* -> assistant.ts       (no FastAPI equiv)
       /* -> Vite SPA (catch-all)
`

## 8. New Flags (flags.ts v3.20.0)
USE_FASTAPI_INVENTORY, USE_FASTAPI_REPORTS, USE_FASTAPI_BARCODE,
USE_FASTAPI_CUSTOMERS, USE_FASTAPI_NUMBERING, USE_FASTAPI_TERMS,
USE_FASTAPI_EXCHANGE, USE_FASTAPI_USERS, USE_FASTAPI_SYSTEM,
USE_FASTAPI_MASTERS, USE_FASTAPI_ATTRIBUTES, USE_FASTAPI_ROLES
All set to true. Removal target: v3.21.0

## 9. Tests Executed
`
python -m pytest app/tests/test_pos.py app/tests/test_sales.py app/tests/test_purchase.py
`
Result: 75/75 passed, 382 warnings in 42.90s

## 10. Verification Results
Evidence: commit 0017433 -- 14 files, +92 insertions, -25 deletions
Interpretation: All 10 route modules cleanly removed from server.ts without test regressions.
Recommendation: Phase 6 = auth.ts migration (requires App.tsx login flow update) and
assistant.ts FastAPI stub, targeting v3.21.0.

## 11. Known Limitations
1. auth.ts: Express auth still handles /api/auth/me for the App.tsx bootstrap check.
2. assistant.ts: AI routes have no FastAPI equivalent (per AI policy: scaffolding only).
3. system.ts: Tally, layout, UFE routes still on Express (not called by frontend via apiFetchV1).
4. Deprecated route files still exist on disk (git history preserved, safe to delete v3.21.0+).

## 12. Future Work
- v3.21.0: Migrate App.tsx auth check to apiFetchV1('/auth/me') and delete auth.ts
- v3.21.0: Delete deprecated Express route files from src/routes/
- v3.21.0: Remove compatibility alias URLs from FastAPI (Phase 4A aliases)

## 13. Related ADRs
- ADR-001: Compatibility Alias strategy (Phase 4A)
- ADR-002: Express as Auth Gateway (permanent per PAL architecture)
- ADR-003: Workflow as Core Service (Phase 4B)

## 14. Related Walkthroughs (previous phases)
- MC2_Phase4A_URL_Contract_Alignment_v3.19.0.md
- MC2_Phase4B_New_Endpoints_v3.19.1.md
