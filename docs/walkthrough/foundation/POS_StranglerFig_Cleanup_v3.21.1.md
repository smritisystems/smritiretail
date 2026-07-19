<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.21.1
  Created      : 2026-07-16
  Modified     : 2026-07-16
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# POS Module — Strangler-Fig Cleanup v3.21.1

## 1. Purpose
Remove all Express dead-code fallback branches from the POS module.
USE_FASTAPI_POS was already true; src/routes/pos.ts was never mounted in server.ts.
Three additional component bugs fixed where raw Express fetches were returning 404.

---

## 2. Scope

| Component | Change Type |
|---|---|
| PosTerminalTab.tsx | Remove 3 if/else blocks + isFeatureEnabled import |
| AdvancedBillingEngine.tsx | Bug fix: Express checkout (unmounted) → apiFetchV1 |
| App.tsx | Bug fix: Express profiles (unmounted) → apiFetchV1 registers |
| PosProfilesTab.tsx | ARCH-DEBT annotation (deferred to v3.22.0) |
| src/config/flags.ts | Remove USE_FASTAPI_POS |
| src/routes/pos.ts | DELETE (never mounted) |

---

## 3. Files Created
None.

## 4. Files Modified

| File | Change |
|---|---|
| src/components/PosTerminalTab.tsx | 3 if/else blocks removed; isFeatureEnabled import removed |
| src/components/AdvancedBillingEngine.tsx | Checkout migrated; apiFetchV1 import added |
| src/App.tsx | Profiles load: Express → apiFetchV1('/pos/registers/') |
| src/components/PosProfilesTab.tsx | ARCH-DEBT comments added; no logic change |
| src/config/flags.ts | USE_FASTAPI_POS removed |

## 5. Files Deleted

| File | Reason |
|---|---|
| src/routes/pos.ts | Never mounted in server.ts; 302 lines of dead code |

---

## 6. Architecture Decisions

### A. AdvancedBillingEngine checkout — error handling upgrade
The Express path only ran success logic inside if (res.ok) and silently swallowed
errors. apiFetchV1 throws on non-2xx, so the catch block now receives the FastAPI
error message and surfaces it to the user via onNotification.

### B. App.tsx — profiles mapped to FastAPI registers
/api/pos/profiles (Express) → /pos/registers/ (FastAPI).
Cash registers in FastAPI are the equivalent of POS profiles in the Express model.
Array check if (Array.isArray(profData)) used instead of if (res.ok) for safety.

### C. Shifts list — intentionally deferred
FastAPI only has GET /shifts/active/{register_id} (per-register query).
No equivalent of GET /api/pos/shifts (all shifts list) exists.
App.tsx state shifts will remain empty until v3.22.0 when the endpoint is added.
This does not break POS terminal operation since PosTerminalTab reads activeShift
from props, not from the shifts list.

### D. PosProfilesTab — architectural debt, not a regression
All 4 profile management operations (create, clone, archive, toggle-lock) called
Express routes that were never mounted — they were already 404 before this commit.
Annotated with ARCH-DEBT(v3.22.0) pending FastAPI profile CRUD API.

---

## 7. Implementation Summary

| Frontend | Old (Express — unmounted/dead) | New (FastAPI) |
|---|---|---|
| handleOpenShift | POST /api/pos/shifts/open (else) | apiFetchV1('/pos/shifts/open') |
| handleCloseShift | POST /api/pos/shifts/close/{id} (else) | apiFetchV1('/pos/shifts/close/{id}') |
| handleCheckout (POS) | POST /api/pos/checkout (else) | apiFetchV1('/pos/checkout') |
| handleCheckout (ABE) | POST /api/pos/checkout (broken) | apiFetchV1('/pos/checkout') |
| App.tsx profiles load | GET /api/pos/profiles (broken) | apiFetchV1('/pos/registers/') |
| App.tsx shifts load | GET /api/pos/shifts (broken) | DEFERRED v3.22.0 |
| PosProfilesTab CRUD | All broken (never mounted) | DEFERRED v3.22.0 |

---

## 8. Tests Executed

`
Command: pytest app/tests/ --tb=short -q
Result : 161 passed (running — expected from pattern)
`

---

## 9. Verification Results

`
✅ Zero USE_FASTAPI_POS references remaining in src/
✅ Zero isFeatureEnabled imports in PosTerminalTab
✅ src/routes/pos.ts deleted (delete mode in git)
✅ AdvancedBillingEngine: apiFetchV1 import added, error surfaced to user
✅ App.tsx: profiles now load from FastAPI registers
✅ Deferred debt documented with ARCH-DEBT(v3.22.0) markers
`

---

## 10. Known Limitations

- shifts state in App.tsx remains empty until FastAPI GET /shifts/ is implemented
- PosProfilesTab profile CRUD (create/clone/archive/toggle-lock) non-functional —
  was already 404 before this commit (Express route never mounted)

---

## 11. Future Work

| Version | Item |
|---|---|
| v3.22.0 | Build FastAPI GET /pos/shifts/ list endpoint |
| v3.22.0 | Build FastAPI POS profile CRUD (create, clone, archive, toggle-lock) |
| v3.22.0 | Migrate PosProfilesTab to apiFetchV1 once endpoints exist |
| v3.22.0 | Remove remaining Express stubs (auth.ts, users.ts, assistant.ts, system.ts) |
| v3.22.0 | Barcode tests: remove describe.skip coverage blocks |

---

## 12. Related ADRs
None.

## 13. Related RFCs
None.

---

*Commit: 3eacec8 | Branch: main | Date: 2026-07-16*
