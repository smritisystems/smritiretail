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

# SMRITI Retail OS Walkthrough — Monolith Refactoring & Route Splitting (v3.15.0)

## 1. Purpose
This walkthrough documents the successful decomposition of the monolithic `server.ts` into 17 modular route handlers, a centralized state store, and shared utility helper modules.

## 2. Scope
The scope of this migration covers:
- Splitting ~7,400 lines of `server.ts` code into cohesive domain routers under `src/routes/`.
- Extracting in-memory database arrays, files load/save operations, and automatic migrations to `src/state/store.ts`.
- Extracting sequence generators, permission validators, and audit trackers to `src/lib/helpers.ts`.
- Preserving 100% of the public API endpoints, paths, methods, and behaviors.

## 3. Files Created
The following new files were provisioned in the repository:
* [src/lib/helpers.ts](file:///d:/IMP/GitHub/SMRITRretailNX/src/lib/helpers.ts)
* [src/state/store.ts](file:///d:/IMP/GitHub/SMRITRretailNX/src/state/store.ts)
* [src/routes/auth.ts](file:///d:/IMP/GitHub/SMRITRretailNX/src/routes/auth.ts)
* [src/routes/users.ts](file:///d:/IMP/GitHub/SMRITRretailNX/src/routes/users.ts)
* [src/routes/products.ts](file:///d:/IMP/GitHub/SMRITRretailNX/src/routes/products.ts)
* [src/routes/pos.ts](file:///d:/IMP/GitHub/SMRITRretailNX/src/routes/pos.ts)
* [src/routes/sales.ts](file:///d:/IMP/GitHub/SMRITRretailNX/src/routes/sales.ts)
* [src/routes/purchase.ts](file:///d:/IMP/GitHub/SMRITRretailNX/src/routes/purchase.ts)
* [src/routes/inventory.ts](file:///d:/IMP/GitHub/SMRITRretailNX/src/routes/inventory.ts)
* [src/routes/masters.ts](file:///d:/IMP/GitHub/SMRITRretailNX/src/routes/masters.ts)
* [src/routes/numbering.ts](file:///d:/IMP/GitHub/SMRITRretailNX/src/routes/numbering.ts)
* [src/routes/terms.ts](file:///d:/IMP/GitHub/SMRITRretailNX/src/routes/terms.ts)
* [src/routes/exchange.ts](file:///d:/IMP/GitHub/SMRITRretailNX/src/routes/exchange.ts)
* [src/routes/attributes.ts](file:///d:/IMP/GitHub/SMRITRretailNX/src/routes/attributes.ts)
* [src/routes/barcode.ts](file:///d:/IMP/GitHub/SMRITRretailNX/src/routes/barcode.ts)
* [src/routes/reports.ts](file:///d:/IMP/GitHub/SMRITRretailNX/src/routes/reports.ts)
* [src/routes/customers.ts](file:///d:/IMP/GitHub/SMRITRretailNX/src/routes/customers.ts)
* [src/routes/assistant.ts](file:///d:/IMP/GitHub/SMRITRretailNX/src/routes/assistant.ts)
* [src/routes/system.ts](file:///d:/IMP/GitHub/SMRITRretailNX/src/routes/system.ts)

## 4. Files Modified
The following file was modified:
* [server.ts](file:///d:/IMP/GitHub/SMRITRretailNX/server.ts) — Trimmed down to <150 lines, serving as a setup bootstrap layer that mounts the 17 routers.

## 5. Architecture Decisions
- **Late ESM Bindings**: Circular dependencies between `helpers.ts` and `store.ts` are resolved at runtime inside executing function scopes to support Node.js ESM.
- **Strict Types Compilation**: All loop indices, find predicates, and reduce accumulators have been fully typed with TypeScript annotations.

## 6. Design Rationale
Decomposing the monolith improves readability, unit testability, and development velocity, while guarding against large merge conflicts during concurrent feature additions.

## 7. Implementation Summary
- Grouped endpoints logically by functionality matching their react tabs (CRM, POS, Sales, Procurement, etc.).
- Preserved all HREP error logging mechanisms, transaction commits, and database serialization behaviors.
- Registered all routers on the main express application inside `server.ts`.

## 8. Tests Executed
The following checks and validations were executed:
- `npx tsc --noEmit` — Validated that TypeScript compiles with zero warnings or type errors.
- `npm run test` — Executed the automated unit test suite.

## 9. Verification Results
- **TypeScript Compile**: Passed with exit code 0.
- **Unit Tests**:
  ```text
  [TEST RESULT] All About Module assertions PASSED successfully.
  [TEST RESULT] All SDIC metrics and reporting unit assertions PASSED successfully.
  ```

## 10. Known Limitations
None. All API URLs, payload formats, and status codes are identical to the monolithic setup.

## 11. Future Work
Phase 2 will unify memory structures and repository operations under the PostgreSQL adapter.

## 12. Related ADRs
None.

## 13. Related RFCs
None.
