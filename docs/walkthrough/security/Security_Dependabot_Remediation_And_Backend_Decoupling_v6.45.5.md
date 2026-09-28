<!--
  Project      : SMRITI Retail OS
  Repository   : SMRITIRetailNX
  Organization : AITDL NETWORKS

  Founders

  * Pushpa Devi Jawahar Mallah
    * Founder & Chairperson
    * Phone: +91 9324117007
    * Email: founder@aitdl.com

  * Jawahar Ramkripal Mallah
    * Founder, Chief Executive Officer (CEO) & Chief Software Architect
    * Email: founder@aitdl.com

  * Websites: aitdl.com | erpnbook.com | smritibooks.com

  * Version    : 6.45.5
  * Created    : 2026-09-28
  * Modified   : 2026-09-28
  * Copyright  : © SMRITIBooks.com. All Rights Reserved.
  * License    : Proprietary Commercial Software
  * Classification: Internal
-->

# Walkthrough: Dependabot Audit Remediation & Backend Node Decoupling v6.45.5

## 1. Purpose
Perform an audit and remediation of security advisories reported by GitHub Dependabot and local `npm audit`, resolve vulnerable packages across the dependency tree without introducing breaking changes, completely sever legacy Node-pg imports from client helpers in accordance with the SMRITI Sole Backend Policy (FastAPI + PostgreSQL), and restore test suite parity to 100% green.

## 2. Scope
- Audit and patch transitive dependency vulnerabilities in `fast-uri`, `browserslist`, `nanoid`, `postcss`, `dompurify`, and `baseline-browser-mapping`.
- Upgrade direct development dependency `vitest` and `@vitest/coverage-v8` to `4.1.11` to resolve the path traversal / arbitrary file read advisory (`GHSA-82fw-gwwq-j7x9`).
- Decouple `allocateVoucherNumber` in `src/lib/helpers.ts` from direct SQL query via `pg.pool` to canonical FastAPI `/numbering/series` and `/numbering/series/{id}/allocate` endpoints.
- Update `tsconfig.json` compiler exclusions to omit legacy decommissioned backend layers (`src/db/**/*` and `src/bootstrap/**/*`).
- Update test expectations in `src/tests/canonicalFieldRegistry.test.ts` to reflect the 137 canonical fields and fingerprint from commit `cee1703b`.
- Update `src/tests/numbering.test.ts` to test HTTP API allocation via mocked `global.fetch` instead of `pool.query`.

## 3. Files Created
- `docs/walkthrough/security/Security_Dependabot_Remediation_And_Backend_Decoupling_v6.45.5.md`

## 4. Files Modified
- `package.json` — Bumped `vitest` and `@vitest/coverage-v8` to `^4.1.11`.
- `package-lock.json` — Updated transitive packages and pruned orphaned `pg` dependencies.
- `tsconfig.json` — Excluded legacy `src/db/**/*` and `src/bootstrap/**/*`.
- `src/lib/helpers.ts` — Removed `import { pool } from "../db/pool.js"`; re-implemented `allocateVoucherNumber` with `apiFetchV1`.
- `src/tests/canonicalFieldRegistry.test.ts` — Updated field count assertion to 137 and fingerprint to `3a0cc10a49a52a367f8cae0c6e2cf7c35bb188719aef404b96cde30b6d8a10d0`.
- `src/tests/numbering.test.ts` — Replaced `pool.query` mock with `global.fetch` mocks for series listing and allocation.
- `docs/walkthrough/README.md` — Appended walkthrough entry to master index.

## 5. Architecture Decisions
- **Non-breaking semver remediation:** High-severity transitive vulnerabilities were resolved via targeted updates without forcing breaking major version upgrades (`--force`), preventing destabilization of Vite/esbuild.
- **FastAPI Sole System of Record:** In alignment with the SMRITI Backend System-of-Record Policy, client helper modules must never execute raw database queries or import server-side driver modules (`pg`). All sequence allocations now flow through FastAPI.

## 6. Design Rationale
- `esbuild <= 0.24.2` and `vite <= 6.4.2` remain pinned because upgrading them to Vite 8 / esbuild 0.28 breaks the plugin architecture and Rollup packaging. Because Vite is used strictly for development and production bundling (never as a production application server), this poses zero runtime exploit surface.
- Excluded `src/db/` and `src/bootstrap/` from the frontend TypeScript compilation context to prevent type errors stemming from uninstalled server-only node dependencies.

## 7. Implementation Summary
1. Executed `npm audit` and mapped all 11 vulnerability categories to discrete GHSA advisories and dependency graphs.
2. Executed non-breaking transitive resolution (`npm audit fix`) updating 10 packages (`fast-uri` 3.1.8, `nanoid` 3.3.19, `postcss` 8.5.28, `browserslist` 4.29.1, `dompurify` 3.4.16, `baseline-browser-mapping` 2.11.26).
3. Bumped `vitest` and `@vitest/coverage-v8` to `4.1.11` to fix the Vitest path traversal advisory.
4. Refactored `allocateVoucherNumber` in `src/lib/helpers.ts` to call `/api/v1/numbering/series` and `/api/v1/numbering/series/{id}/allocate`.
5. Updated `tsconfig.json` compiler exclusions.
6. Synchronized unit tests in `canonicalFieldRegistry.test.ts` and `numbering.test.ts`.

## 8. Tests Executed
1. `npm run lint` (`tsc --noEmit`) — Exit 0, 0 type errors.
2. `npx vitest run` — 155/155 test suites passed (1,091/1,091 unit tests green).
3. `python scripts/architecture_duplication_gate.py` — Exit 0, 11 checks passed, 0 violations.
4. `npm audit` — Verified reduction from 11 vulnerabilities down to 2 (only devServer esbuild/vite).

## 9. Verification Results
```text
Test Files  155 passed (155)
     Tests  1091 passed (1091)
  Duration  28.74s
```
- Total vulnerabilities reduced by 81.8% (from 11 down to 2).
- Zero high-severity transitive vulnerabilities remaining.
- Zero TypeScript compiler diagnostics.

## 10. Known Limitations
- 2 vulnerabilities remain in `esbuild <= 0.24.2` and `vite <= 6.4.2`, which require a breaking upgrade to Vite 8.

## 11. Future Work
- Schedule a dedicated Vite 6/8 migration spike with full regression testing of plugins and bundle targets.

## 12. Related ADRs
- `ADR-001`: Sole Backend System-of-Record (FastAPI + PostgreSQL)
- `ADR-014`: Universal Document Series and Numbering Engine

## 13. Related RFCs
- `RFC-089`: Decommissioning of Express & In-Memory Store
