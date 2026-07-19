<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.14.5
  Created      : 2026-07-12
  Modified     : 2026-07-12
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Public
-->

# Foundation — Security & API Integration Walkthrough (v3.14.5)

## 1. Purpose
This walkthrough documents the integration of secure password hashing using Node's native `crypto` module (PBKDF2 with HMAC-SHA512), self-healing user credential migration during Express application startup, and the alignment of the Gemini AI integration model config strings.

## 2. Scope
- Add PBKDF2 hashing utility functions (`hashPassword` and `verifyPassword`) in the Node Express server.
- Add self-healing password migration logic during database load/seed operations.
- Upgrade plaintext passwords dynamically to hashed formats upon successful user logins.
- Apply secure hashing to all newly created user profiles.
- Correct Gemini model identifier from `"gemini-3.5-flash"` to the standard `"gemini-2.5-flash"` for AI features.
- Consolidate package and metadata versions to `3.14.5`.

## 3. Files Created
None.

## 4. Files Modified
- [server.ts](file:///d:/IMP/GitHub/SMRITRretailNX/server.ts) — Added secure hashing utilities, self-healing migration, and login password upgrades.
- [package.json](file:///d:/IMP/GitHub/SMRITRretailNX/package.json) — Updated package version to `3.14.5`.

## 5. Architecture Decisions
We selected Node's native `crypto` module (`pbkdf2Sync`) to perform password hashing to ensure portability and avoid platform-specific C++ binary compilation issues (e.g. node-gyp with bcrypt) across development and production environments.

## 6. Design Rationale
- **Seamless Self-Healing Migration:** Ensuring existing users are upgraded dynamically when they log in prevents requiring a database reset or breaking legacy accounts.
- **AI Model Alignment:** Aligning model configurations to `"gemini-2.5-flash"` ensures compatibility with available Gemini APIs and avoids 404/invalid model API errors.

## 7. Implementation Summary
- **Hashing Utilities:** Implemented 1000-iteration PBKDF2 hashing using HMAC-SHA512 with a 16-byte random salt.
- **Self-Healing Loop:** Added checks during `migrateUsersAndSeedOrganizationData()` to scan user records and pre-hash any plaintext fields matching a pattern that does not start with the `pbkdf2$` prefix.
- **Login Verification & Auto-Upgrade:** Integrated `verifyPassword` into the POST login handler, upgrading the stored password hash dynamically if verified.

## 8. Tests Executed
Node.js tests:
```bash
npm run test
```
Python test suite (post host database migration):
```bash
python -m pytest
```

## 9. Verification Results
- **Node.js Test Suite:**
```
[TEST RESULT] All About Module assertions PASSED successfully.
[TEST RESULT] All SDIC metrics and reporting unit assertions PASSED successfully.
```
- **FastAPI / Pytest Suite:**
```
====================== 89 passed, 525 warnings in 39.78s ======================
```

## 10. Known Limitations
None.

## 11. Future Work
Add multi-factor authentication (MFA) and token revocation endpoints to the user profile dashboard.

## 12. Related ADRs
None.

## 13. Related RFCs
None.
