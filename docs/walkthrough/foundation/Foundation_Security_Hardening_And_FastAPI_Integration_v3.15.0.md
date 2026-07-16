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

# Security Hardening and FastAPI Integration Walkthrough — Phase 3 to Phase 7

## 1. Purpose
This document details the implementation of security fixes (Phase 3), the expansion of the test suite with coverage targeting (Phase 4), CI pipeline integration (Phase 5), version unification (Phase 6), and FastAPI client integration (Phase 7).

## 2. Scope
- Upgrading password hashing iterations to 600,000.
- Extracting session resolution to a dedicated Express middleware and registering it globally.
- Replacing string-based role name assertions with permission checks (`hasPermission`).
- Securing the SMRITI Assistant AI and local Wiki search endpoints.
- Implementing test coverage for the GST 2.0 price-tier calculation and voucher numbering sequence engines.
- Automating CI builds and test executions via GitHub Actions.
- Exposing the local FastAPI proxy and credentials configuration across services.

## 3. Files Created
- `src/middleware/sessionResolver.ts` — session decoder and authorization request-enricher middleware
- `src/tests/numbering.test.ts` — unit tests for the voucher numbering sequences
- `src/tests/gst.test.ts` — unit tests for the GST 2.0 price-tier calculations
- `.github/workflows/ci.yml` — GitHub Actions CI pipeline configuration
- `src/lib/apiFetch.ts` — client-side fetch helper for Express `/api` routes
- `src/lib/apiFetchV1.ts` — client-side fetch helper for FastAPI `/api/v1` routes

## 4. Files Modified
- `package.json` — bumped version to 3.15.0
- `server.ts` — registered global sessionResolver middleware
- `vite.config.ts` — configured API proxy mapping for `/api/v1` to local FastAPI port 8000
- `vitest.config.ts` — configured test include pattern and excluded standalone verify script
- `docker-compose.yml` — exposed GEMINI_API_KEY to Express and Python services
- `src/lib/helpers.ts` — upgraded PBKDF2 iterations to 600,000, validated GST override logic
- `src/routes/reports.ts` — replaced hardcoded role checks with hasPermission helper checks
- `src/routes/exchange.ts` — secured partners management and consignment log approvals
- `src/routes/assistant.ts` — restricted local wiki index and Gemini explainer access to logged-in users

## 5. Architecture Decisions
- Configured a transparent Vite dev server proxy to map `/api/v1` traffic directly to the standalone FastAPI server, allowing seamless frontend integration.
- Bound the `GEMINI_API_KEY` compose environment variable to read from host configuration, ensuring AI capability switches smoothly between local sandbox models and live Gemini APIs.

## 6. Design Rationale
- Using a centralized request-enrichment middleware (`sessionResolver.ts`) replaces ad-hoc session parsing in individual route files, reducing code duplication and making authentication highly auditable.
- Requiring `hasPermission(req, ...)` instead of `role === "Store Manager"` decouples application logic from user roles, allowing roles to be configured dynamically in the database without modifying code.

## 7. Implementation Summary
- Upgraded default password iterations to 600,000, ensuring industry-standard protection against offline brute-force attacks.
- Configured the GitHub Actions build script to boot a PostgreSQL container service, install Node and Python dependencies, compile TypeScript via `npm run lint`, and execute all test suites.

## 8. Tests Executed
- Executed `npm test` running 27 assertions under Vitest.
- Run `npx vitest run --coverage` to measure code coverage for helpers and authorization logic.

## 9. Verification Results
```bash
Test Files  4 passed (4)
     Tests  27 passed (27)
  Duration  6.97s

% Coverage report from v8
-------------------|---------|----------|---------|---------|-------------------
File               | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s 
-------------------|---------|----------|---------|---------|-------------------
  helpers.ts       |   74.54 |    48.95 |   57.14 |   77.14 | ...78-184,189-245 
  sessionResolver.ts|   87.5  |       75 |     100 |    87.5 | 26,39             
  auth.ts          |   56.47 |    50.79 |   42.85 |   56.47 | ...75-195,200-218 
-------------------|---------|----------|---------|---------|-------------------
```

## 10. Known Limitations
- Consignment log parsing requires a valid partner configuration; testing local dry-runs is mock-dependent.

## 11. Future Work
- Deploy frontend telemetry hooks to capture API metrics via the SMRITI Development Intelligence Center.

## 12. Related ADRs
- ADR-015: Role-Based Access Control and Permission-Level Enforcement

## 13. Related RFCs
- RFC-012: Frontend-Backend Routing & Proxy Integration
