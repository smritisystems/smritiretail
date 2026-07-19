<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.15.0
  Created      : 2026-07-12
  Modified     : 2026-07-12
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough: Reports module migration to FastAPI & Postgres (v3.15.0)

## 1. Purpose
This walkthrough documents the successful migration of the SMRITI reporting module from local client-side mocks to live backend transactional statistics served by the FastAPI + Postgres backend, along with the alignment of governance structures in `AGENTS.md`.

## 2. Scope
- Verify PostgreSQL database health connection status.
- Implement hybrid PBKDF2 / Bcrypt password resolution backend verification fallback.
- Configure client-side background FastAPI login bridge (Option A) to handle session tokens and JWTs.
- Wire dashboard statistics and BI designer drilldowns to FastAPI reports endpoints.
- Freeze new Express route development in `server.ts` and `src/routes/`.

## 3. Files Created
None.

## 4. Files Modified
- [docs/implementation/db/FastAPI_Reports_Migration_And_Governance_Update_Plan_v3.15.0.md](file:///d:/IMP/GitHub/SMRITRretailNX/docs/implementation/db/FastAPI_Reports_Migration_And_Governance_Update_Plan_v3.15.0.md) (Detailed bridge details and verified results)
- [.agents/AGENTS.md](file:///d:/IMP/GitHub/SMRITRretailNX/.agents/AGENTS.md) (Governance rules mapping the strangler-fig migration and Express freeze)
- [backend/app/core/security.py](file:///d:/IMP/GitHub/SMRITRretailNX/backend/app/core/security.py) (Added legacy PBKDF2 hash support to FastAPI password checker)
- [src/App.tsx](file:///d:/IMP/GitHub/SMRITRretailNX/src/App.tsx) (Clear `smriti_jwt_token` on logout)
- [src/components/LoginScreen.tsx](file:///d:/IMP/GitHub/SMRITRretailNX/src/components/LoginScreen.tsx) (Fetches FastAPI JWT in background on login)
- [src/lib/apiFetchV1.ts](file:///d:/IMP/GitHub/SMRITRretailNX/src/lib/apiFetchV1.ts) (Passes `smriti_jwt_token` in authentication headers)
- [src/components/QuickReportsWidget.tsx](file:///d:/IMP/GitHub/SMRITRretailNX/src/components/QuickReportsWidget.tsx) (Daily revenue, payment modes, safety stock capital locked wired to FastAPI)
- [src/components/ReportDesignerTab.tsx](file:///d:/IMP/GitHub/SMRITRretailNX/src/components/ReportDesignerTab.tsx) (BI Designer table drilldowns wired to `/reports/daily-sales` and `/reports/purchase-summary`)

## 5. Architecture Decisions
To advance the Strangleg-Fig Reports migration without waiting for a full Authentication endpoint revamp, we adopted **Option A**:
- Express auth remains the primary login resolver, issuing opaque session tokens.
- On successful Express login, `LoginScreen.tsx` client-side queries FastAPI `/api/v1/auth/login` to get a signed JWT.
- FastAPI's `verify_password` validates the credentials against PostgreSQL using legacy PBKDF2 algorithm matching for migrated seeds.
- The JWT is saved as `smriti_jwt_token` and injected into the Bearer headers of all `/api/v1` routes.

## 6. Design Rationale
- Binding UI elements dynamically using React `useEffect` hooks allows the client to retrieve fresh statistics from Postgres.
- Retaining hardcoded modifiers as fallback arrays maintains system stability and visual cues in offline/disconnected mode.

## 7. Implementation Summary
- Extended `/health` endpoint validations to ensure PostgreSQL connection state is active.
- Added PBKDF2 HMAC algorithm verification to `security.py` using `hashlib.pbkdf2_hmac` SHA-512 check.
- Wired React components to request `/reports/daily-sales`, `/reports/stock-valuation`, `/reports/purchase-summary`, and `/reports/supplier-ledger/{id}`.

## 8. Tests Executed
- TypeScript compile checks: `npm run lint` (`tsc --noEmit`).
- Vitest suite check: `npm test` (`vitest run`).
- Production bundles check: `npm run build`.

## 9. Verification Results
- All 27 Vitest unit assertions passed.
- Compilation and bundling completed with zero warnings/errors.
- Verified local PostgreSQL database is healthy and returns correct records.

## 10. Known Limitations
- If connection to the python-core FastAPI service drops, the components will log errors to the console and fall back to displaying legacy local mock data.

## 11. Future Work
- Move Authentication migration forward to fully retire Express `/api/auth` endpoints.

## 12. Related ADRs
- ADR-016: Strangler-Fig Migration to FastAPI + PostgreSQL.

## 13. Related RFCs
None.
