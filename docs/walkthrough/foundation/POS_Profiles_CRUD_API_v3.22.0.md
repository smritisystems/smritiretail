<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.22.0
  Created      : 2026-07-16
  Modified     : 2026-07-16
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# POS Profiles CRUD API v3.22.0

## 1. Purpose
Build the missing FastAPI POS Profiles CRUD endpoints and clear all 4 ARCH-DEBT(v3.22.0) 
markers that were placed in PosProfilesTab.tsx during the POS Strangler-Fig cleanup (v3.21.1).
Also delivers GET /pos/shifts/ to complete App.tsx shifts state migration.

---

## 2. Scope

| Layer | Component | Change |
|---|---|---|
| DB | cash_registers | Added cashier, warehouse, is_locked columns |
| Migration | 94fdee7fd6ab | ALTER TABLE cash_registers ADD COLUMN |
| Backend | models/pos.py | 3 new columns on CashRegister |
| Backend | schemas/pos.py | POSProfileCreate, POSProfileResponse, extended CashRegisterCreate/Response |
| Backend | services/pos.py | 5 new service methods |
| Backend | api/v1/pos.py | 6 new endpoints |
| Frontend | PosProfilesTab.tsx | 4 fetch() → apiFetchV1, import added |
| Frontend | App.tsx | /pos/profiles/ + /pos/shifts/ endpoints wired in |

---

## 3. Files Created

| File | Purpose |
|---|---|
| ackend/alembic/versions/94fdee7fd6ab_add_...py | DDL migration: 3 new columns |

---

## 4. Files Modified

| File | Change |
|---|---|
| ackend/app/models/pos.py | +cashier, +warehouse, +is_locked on CashRegister |
| ackend/app/schemas/pos.py | +POSProfileCreate, +POSProfileResponse, extended existing schemas |
| ackend/app/services/pos.py | +create_profile, +clone_register, +archive_register, +toggle_lock_register, +list_shifts |
| ackend/app/api/v1/pos.py | +6 endpoints: profiles CRUD + shifts list |
| src/components/PosProfilesTab.tsx | Full rewrite: 4 apiFetchV1 calls, import added |
| src/App.tsx | Profiles→/pos/profiles/, Shifts→/pos/shifts/ |

---

## 5. Architecture Decisions

### A. CashRegister IS the POS Profile
Rather than creating a separate POSProfile model, the existing CashRegister model was extended with cashier/warehouse/is_locked fields. This avoids join complexity and keeps a single source of truth for terminal configuration.

### B. POSProfileResponse as a camelCase projection
The frontend POSProfile type uses camelCase (isActive, isLocked, cashier, warehouse). POSProfileResponse.from_register() performs the mapping at the schema boundary, keeping SQLAlchemy model names snake_case while returning frontend-compatible JSON.

### C. Auto-generated ID and code in create_profile
The Express profiles used frontend-generated IDs (e.g. "PROF-..."). FastAPI auto-generates both to ensure uniqueness. Code pattern: PROF-{8 hex chars}, REG-{6 hex chars uppercase}.

### D. list_shifts — 100-record cap
The shifts list is capped at 100 most recent to avoid unbounded queries. Pagination can be added in v3.23.0 if needed.

### E. Graceful fallback in App.tsx for shifts
App.tsx uses .catch(() => []) on the shifts fetch so that an empty database (new install, no shifts yet) doesn't crash the initial load.

---

## 6. API Endpoints (v3.22.0)

| Method | URL | Description |
|---|---|---|
| POST | /api/v1/pos/profiles/ | Create POS Profile |
| GET | /api/v1/pos/profiles/ | List POS Profiles |
| POST | /api/v1/pos/profiles/{id}/clone | Clone Profile |
| POST | /api/v1/pos/profiles/{id}/archive | Archive Profile (soft-delete) |
| POST | /api/v1/pos/profiles/{id}/toggle-lock | Toggle Lock |
| GET | /api/v1/pos/shifts/ | List Shifts (100 most recent) |

---

## 7. Migration Details

`sql
-- Migration: 94fdee7fd6ab
ALTER TABLE cash_registers ADD COLUMN cashier VARCHAR(100);
ALTER TABLE cash_registers ADD COLUMN warehouse VARCHAR(100);
ALTER TABLE cash_registers ADD COLUMN is_locked BOOLEAN NOT NULL DEFAULT FALSE;
`

Applied successfully: h4i5j6k7l8m9 → 94fdee7fd6ab

---

## 8. Tests Executed

`
Command: pytest app/tests/ --tb=short -q
Result : 161 passed, 748 warnings in 120.58s (zero regressions)
`

---

## 9. Verification Results

`
✅ Zero ARCH-DEBT markers remaining in src/
✅ Zero raw /api/pos fetch() calls remaining in src/
✅ Migration applied: cash_registers.cashier, warehouse, is_locked created
✅ 6 new FastAPI endpoints in pos.py router (verified by last-8-lines check)
✅ PosProfilesTab.tsx rewritten cleanly with apiFetchV1 for all 4 operations
✅ App.tsx wired to /pos/profiles/ and /pos/shifts/ with graceful fallback
✅ Committed: 4b64d9e
`

---

## 10. Known Limitations

- list_shifts: no pagination, capped at 100
- clone_register: does not deep-copy shift history (new terminal, no history)
- POSProfileCreate does not validate warehouse against warehouse master (v3.23.0)

---

## 11. Future Work

| Version | Item |
|---|---|
| v3.22.0 | Retire Express route stubs (auth.ts, users.ts, assistant.ts, system.ts) |
| v3.23.0 | Add pagination to GET /pos/shifts/ |
| v3.23.0 | Validate cashier against users table in create_profile |
| v3.23.0 | Add PUT /pos/profiles/{id} for profile update |

---

## 12. Related ADRs
None.

## 13. Related RFCs
None.

---

*Commit: 4b64d9e | Branch: main | Date: 2026-07-16*
