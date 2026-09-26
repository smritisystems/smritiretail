<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.30.0
  Created      : 2026-09-09
  Modified     : 2026-09-09
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal — Walkthrough
-->

# Production Readiness Sprint — v3.30.0 (2026-09-09)

## 1. Purpose

Remediate four categories of technical debt identified in an external audit that rated the platform at **7.4/10**:
1. Hardcoded weak secrets in the local `.env` file
2. Runtime version string drift across 4 files (spread: 3.16.0 – 3.30.0)
3. Open TypeScript error audit finding (stale — already 0 errors)
4. Insufficient Vite bundle chunk splitting (2.7MB main chunk with circular chunk warning)

## 2. Scope

| Track | Files | Area |
|---|---|---|
| 1 — Secret Hygiene | `.env`, `SECRETS_NOTICE.md` (new) | Security |
| 2 — Version SSOT | `src/config/version.ts`, `backend/app/core/config.py`, `vite.config.ts` | Foundation |
| 3 — TS Audit Closure | `docs/_audit/07_version_status.md` | Documentation |
| 4 — Bundle Splitting | `vite.config.ts` | Frontend Build |

## 3. Files Created

| File | Purpose |
|---|---|
| `SECRETS_NOTICE.md` | Secret rotation procedure, minimum key requirements, deployment guidance, audit trail |

## 4. Files Modified

| File | Change |
|---|---|
| `.env` | Replaced 3 literal weak secrets with 256-bit random values; added warning comment |
| `src/config/version.ts` | `APP_VERSION` bumped from `3.29.0` → `3.30.0`; header updated |
| `backend/app/core/config.py` | `VERSION` setting bumped from `3.16.0` → `3.30.0`; header updated |
| `vite.config.ts` | Header version `3.17.0` → `3.30.0`; `manualChunks` restructured (8 new chunks) |
| `docs/_audit/07_version_status.md` | RESOLUTION LOG section appended; findings formally closed |
| `CHANGELOG.md` | Entry `[3.30.0-security]` added |

## 5. Architecture Decisions

### AD-1: `3.30.0` as Canonical Runtime Version
`package.json` is the single canonical version source. All four runtime locations now read from or align to this value. Per-file UADHP headers are excluded from the SSOT requirement (they track individual file history).

### AD-2: `db_provisioner.py` `schema_version` Left at `6.16.0`
This value reflects the highest applied Alembic migration revision, not the application version. Changing it would misrepresent the migration state.

### AD-3: Circular Chunk Fix — `scheduler` Added to `vendor-react`
Rollup's circular chunk warning arose because `scheduler` (React's internal scheduler) was being pulled into `vendor-core` while also being needed by `vendor-react`. Explicitly including `/node_modules/scheduler/` in the `vendor-react` check eliminates the circular dependency.

### AD-4: `smriti-billing` Chunk
`BillingWorkspace.tsx` at 776 KB was the single largest application chunk. It is already lazy-loaded in `App.tsx` via `React.lazy()`, so extracting it to its own chunk ensures it is only parsed when the billing route is first accessed.

## 6. Design Rationale

- **Secret rotation over deletion:** The `.env` file is on the `.gitignore` list and has never been committed. Rotating values (not deleting the file) preserves the developer workflow.
- **`SECRETS_NOTICE.md` at root:** Visible to any developer who clones the repo, immediately adjacent to the `.env` they will create from `.env.example`.
- **Formal audit closure vs. deletion:** The audit doc findings are closed in-place with evidence stamps rather than deleted. This preserves the audit trail for future reviewers.

## 7. Implementation Summary

All four tracks were executed sequentially in a single session:

1. **Secrets:** Generated three 256-bit random hex strings in PowerShell; replaced literal values; created `SECRETS_NOTICE.md`.
2. **Version:** Patched `version.ts` (frontend SSOT) and `config.py` (backend runtime setting); updated UADHP headers in both + `vite.config.ts`.
3. **TS Closure:** Ran `npx tsc --noEmit` live to obtain evidence; appended RESOLUTION LOG to audit doc.
4. **Bundle:** Restructured `manualChunks` with 8 new named buckets; ran two production builds — Build 1 confirmed correct output, Build 2 confirmed circular warning eliminated.

## 8. Tests Executed

| Test | Command | Result |
|---|---|---|
| TypeScript compilation | `npx tsc --noEmit 2>&1 \| Measure-Object -Line` | **0 errors (0 output lines)** |
| Production build (first) | `npm run build` | ✓ 3523 modules, 27s. Circular warning present. |
| Production build (second) | `npm run build` | ✓ 3523 modules, 27s. **No circular warning.** |
| Secret rotation check | `Get-Content .env \| Select-String "fallback\|sgip_vault_master_secret\|9a12c418"` | **0 matches** |
| Version SSOT check | PowerShell multi-file grep | All 4 sources read `3.30.0` |

## 9. Verification Results

### Track 1 — Secret Hygiene

**Evidence (Terminal):**
```
Command: Get-Content "f:\SMRITRretailNX\.env" | Select-String "fallback|sgip_vault_master_secret|9a12c418"
Output: (empty — exit code 0, 0 matches)
```
**Status: Done**

### Track 2 — Version SSOT

**Evidence (Terminal):**
```
Command: PowerShell multi-file version audit script
Output:
package.json        :   "version": "3.30.0",
src/config/version.ts: export const APP_VERSION = "3.30.0";
backend/config.py   : F:\SMRITRretailNX\backend\app\core\config.py:7:Version : 3.30.0
vite.config.ts hdr  : * * Version    : 3.30.0
```
**Status: Done**

### Track 3 — TypeScript Audit Closure

**Evidence (Terminal):**
```
Command: npx tsc --noEmit 2>&1 | Measure-Object -Line
Output:
Lines Words Characters Property
----- ----- ---------- --------
    0
```
**Status: Done**

### Track 4 — Bundle Splitting

**Evidence (Build Output — second build):**
```
✓ 3523 modules transformed.
(No circular chunk warning)
smriti-engines-*.js          5.14 kB   [NEW]
smriti-crm-*.js              8.92 kB   [NEW]
vendor-react-*.js          340.73 kB   [NEW — isolated from vendor-core]
vendor-query-*.js            [present]
smriti-billing-*.js        824.67 kB   [NEW — extracted from index]
index-*.js               1,163.85 kB  [was 1,212 kB — 49 kB improvement]
✓ built in 27.18s
```
**Status: Done**

## 10. Known Limitations

- `index-*.js` (1,163 KB) and `smriti-billing-*.js` (824 KB) still exceed 700 KB. Further reduction requires routing-level code splitting in `App.tsx` (lazy route groups), which is a larger architectural change deferred to a future sprint.
- `vendor-documents-*.js` (544 KB) contains `xlsx.js` + `jspdf` which cannot be split further without dynamic import changes at call sites.

## 11. Future Work

- Route-level lazy loading in `App.tsx` to reduce main `index.js` below 700 KB.
- Dynamic import of `xlsx`/`jspdf` at point-of-use to further reduce `vendor-documents`.
- Implement OS-level secret injection via environment manager on test/staging.

## 12. Related ADRs

None specific — this sprint resolves audit debt, not new architecture.

## 13. Related RFCs

None.
