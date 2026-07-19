<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.5.0
  Created      : 2026-07-11
  Modified     : 2026-07-11
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Implementation Plan: SMRITI Development Intelligence Center (SDIC) — v3.5.0

This document defines the plan to implement the automated Development Intelligence Center (SDIC) for SMRITI Retail OS.

---

## 1. Objective
Design and implement an automated **SMRITI Development Intelligence Center (SDIC)** that scans codebase files, routers, schemas, tests, and documentation, generates 15 live markdown reports in the workspace root, tracks historical metrics over time, and renders an interactive dashboard page in the application.

---

## 2. Business Motivation
Provide engineering teams, QA leads, and steering management with real-time, evidence-based metrics showing the exact implementation status of each codebase module, technical debt levels, and release scores without manual updates.

---

## 3. Scope

### In Scope
- **Scanning Service:** A Node-based code parser `src/modules/dev_tracker/scanner/` executing AST and regex lookups.
- **REST Endpoints:** Register `/api/dev-tracker` and `/api/dev-tracker/scan` in backend Express app.
- **Markdown Reports:** Dynamically create 15 markdown reports in the workspace root.
- **Frontend Dashboard:** Register `dev-tracker` tab in `layout_store.tsx` and build `src/modules/dev_tracker/ui/DevTrackerTab.tsx`.
- **Unit Testing:** Implement test validation script `src/modules/dev_tracker/tests/devTracker.test.ts`.

---

## 4. Current State
- No codebase status tracker is present.
- Walkthroughs and implementation plans indices are updated manually.

---

## 5. Gap Analysis
- **Scanners Gap:** Lacks automated logic to map frontend components to backend endpoints.
- **Dashboard Gap:** No visual UI charts indicating Frontend/Backend completeness alignments.

---

## 6. Architecture Impact
- **Endpoint Additions:** Adds router endpoints to backend Express server.
- **Performance impact:** Code scanning reads multiple files from disk.
  - *Mitigation:* Cache results in server RAM, only performing file scanning on server start or on-demand trigger requests.

---

## 7. Proposed Design

### Module Registry Rules
The scanner will track discovered modules. For each module, it checks:
- **Frontend File existence:** Checks files in `/src/components/`.
- **Backend Route registration:** Validates GET/POST paths matching inside `server.ts`.
- **DB Table schemas:** Validates SQL CREATE TABLE directives inside `src/db/schema.sql`.
- **Test File presence:** Verifies corresponding `.test.ts` files in `/src/tests/`.
- **Doc File presence:** Verifies markdown reference guides.

### Completion Calculation
Development Health Index (DHI) will be computed with the following weights:
- Frontend Completion: 15%
- Backend Completion: 15%
- Database: 10%
- APIs: 10%
- Test Coverage: 15%
- Documentation: 10%
- Security: 10%
- Performance: 5%
- Technical Debt: 5%
- Release Readiness: 5%

---

## 8. Files Created
- `src/modules/dev_tracker/scanner/scanner.ts`
- `src/modules/dev_tracker/scanner/parser.ts`
- `src/modules/dev_tracker/scanner/metrics.ts`
- `src/modules/dev_tracker/scanner/markdown.ts`
- `src/modules/dev_tracker/scanner/reporter.ts`
- `src/modules/dev_tracker/api/devTracker.routes.ts`
- `src/modules/dev_tracker/api/devTracker.controller.ts`
- `src/modules/dev_tracker/ui/DevTrackerTab.tsx`
- `src/modules/dev_tracker/models/interfaces.ts`
- `src/modules/dev_tracker/README.md`
- `src/modules/dev_tracker/tests/devTracker.test.ts`

---

## 9. Files Modified
- [MODIFY] [server.ts](file:///d:/IMP/GitHub/SMRITRretailNX/server.ts) — Integrate scanner runs on server startup and register API endpoints.
- [MODIFY] [layout_store.tsx](file:///d:/IMP/GitHub/SMRITRretailNX/src/layout_engine/layout_store.tsx) — Register `dev-tracker` tab under System category.
- [MODIFY] [App.tsx](file:///d:/IMP/GitHub/SMRITRretailNX/src/App.tsx) — Import and route the new `DevTrackerTab` component.

---

## 10. Dependencies
- Native `fs`, `path`, and regex engines.
- `recharts` for UI metrics graphs.

---

## 11. Risks
- **Scan execution overhead:** Scan asynchronously only on demand, preventing request blocks.

---

## 12. Rollback Strategy
`git checkout` on changed files, delete the created testing and service files.

---

## 13. Verification Plan
- Run linter check: `npm run lint`.
- Run test runner: `npm run test` to verify API results and file writes.

---

## 14. Test Plan
- Assert GET `/api/dev-tracker` returns valid module arrays.
- Assert POST `/api/dev-tracker/scan` successfully writes files to the workspace root.

---

## 15. Documentation Impact
- Update Walkthroughs.
- Update indices.

---

## 16. Deployment Plan
Commit and push from development.

---

## 17. Status
Approved.

---

## 18. Related ADRs
- None.

---

## 19. Related Walkthroughs
- None.
