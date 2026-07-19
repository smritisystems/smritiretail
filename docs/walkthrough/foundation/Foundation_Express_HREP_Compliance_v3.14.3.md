<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.14.3
  Created      : 2026-07-11
  Modified     : 2026-07-11
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
-->

# Foundation — Express HREP Compliance — Walkthrough v3.14.3

**Date:** 2026-07-11  
**Status:** Done  

---

## 1. Purpose
Introduce standard error formatting inside the Node.js Express server to ensure that unhandled database query issues, access authorization failures, and validation syntax exceptions are caught globally and returned in human-readable SMRITI-HREP formatted payloads rather than raw stacks.

---

## 2. Scope
- Create a global `hrepErrorHandler` middleware function inside `server.ts` checking error categories (Database, Permission, Validation, System).
- Format errors with fields `title`, `explanation`, `suggestedAction`, `referenceId` (using date and random hex format), and `code` (standard SMRITI code).
- Register the error middleware at the end of the routing stack in `server.ts`.

---

## 3. Files Created
None.

---

## 4. Files Modified
- [server.ts](file:///d:/IMP/GitHub/SMRITRretailNX/server.ts) — Implemented and registered `hrepErrorHandler` middleware.

---

## 5. Architecture Decisions
- **Express Stack Placement:** Registered the error-handler middleware right after general routes and static middleware fallbacks in `startServer()`, ensuring it captures all downstream routing execution tracebacks safely.

---

## 6. Design Rationale
A unified, schema-validated error formatter in the Express gateway ensures that external clients receive clean and predictable responses on failures, satisfying the HREP-v1.0 standards.

---

## 7. Implementation Summary
1. Implemented the custom `hrepErrorHandler` middleware catching database, authorization, and syntax exceptions.
2. Appended `app.use(hrepErrorHandler)` to the server launch bootstrap.
3. Successfully compiled and verified local TypeScript rules.

---

## 8. Tests Executed
```bash
npm run lint
```

---

## 9. Verification Results
- **TypeScript compilation:** Done (`npm run lint` returns exit code 0).
- **Container health check:** Done (Express gateway running healthy).

---

## 10. Known Limitations
None.

---

## 11. Future Work
Extend and mapping specific operational domain validations to validation error codes.

---

## 12. Related ADRs
None.

---

## 13. Related RFCs
None.
