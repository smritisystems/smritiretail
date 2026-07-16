<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 1.0.0
  Created      : 2026-07-11
  Modified     : 2026-07-11
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# SMRITI Development Intelligence Center (SDIC)

This module provides automated codebase diagnostics, implementation progress tracking, DHI calculations, technical debt analysis, git integration, and release readiness audits.

---

## Module Directory Layout

```text
src/modules/dev_tracker/
├── scanner/
│   ├── scanner.ts      # Main orchestration runner
│   ├── parser.ts       # AST/regex parsing engine
│   ├── metrics.ts      # DHI and risk profiling calculations
│   ├── markdown.ts     # Markdown templates for 15 reports
│   └── reporter.ts     # File writers and history.json loggers
├── api/
│   ├── devTracker.routes.ts
│   └── devTracker.controller.ts
├── ui/
│   ├── DevTrackerTab.tsx
│   └── widgets/        # Internal dashboard panels
├── models/
│   └── interfaces.ts   # Common types definitions
└── README.md           # Module documentation
```

---

## API Endpoints

### 1. GET `/api/dev-tracker`
Returns cached codebase diagnostics and scores. Performs an initial scan on server boot if no cache is present.

### 2. POST `/api/dev-tracker/scan`
Triggers an on-demand re-scan, updates all 15 markdown reports, appends scores to `docs/reports/history.json`, and returns fresh JSON results.

---

## Calculation Rules (DHI)

The Development Health Index (DHI) is calculated as a weighted average:
- **Frontend Completeness (15%):** Checks if components in `/src/components/` exist and are implemented.
- **Backend Completeness (15%):** Checks if API endpoints exist in `server.ts`.
- **Database Schema (10%):** Checks if SQL table schemas are registered in `src/db/schema.sql`.
- **APIs Connected (10%):** Validates routes mapping.
- **Test Coverage (15%):** Verifies if corresponding `.test.ts` files exist in `/src/tests/`.
- **Documentation (10%):** Checks for guides and walkthroughs.
- **Security Check (10%):** Inspects authorization and cryptographical checking code.
- **Performance (5%):** Checks optimization keywords.
- **Technical Debt (5%):** Checks TODO/FIXME comments density.
- **Release Readiness (5%):** Checks compile and safety gates.
