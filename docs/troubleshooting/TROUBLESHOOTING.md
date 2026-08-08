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

  * Websites: smritisys.com | aitdl.com | erpnbook.com | smritibooks.com

  * Version    : 2.1.2
  * Created    : 2026-07-11
  * Modified   : 2026-07-11
  * Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
  * License    : Proprietary Commercial Software
-->

Document ID      : TROUBLESHOOTING-001
Category         : Authentication
Severity         : Critical
Applies To       : v2.1.x+
Owner            : Platform Team
Last Reviewed    : 2026-07-18

# SMRITI Retail OS — Troubleshooting & Support Manual

This document details common operational issues and resolutions.

---

## 1. Split-Brain Environment State & Pre-Resolution Dev Credential Exposure
- **Symptom:** Brief flash of Dev Credentials on page load, or split-brain environment state between header badge and login card.
- **Cause:**
  1. `EnvironmentBadge` fetched backend environment profile, but `LoginCard` called `EnvironmentResolver.resolve()` independently without backend environment parameters.
  2. Initial state evaluated client-side hostname heuristic (`DEVELOPMENT`) before backend profile API response returned.
- **Resolution:**
  1. Built `EnvironmentContext.tsx` (`EnvironmentProvider` / `useEnvironmentContext`) to query backend environment ONCE pre-login and propagate single `EnvironmentInfo` state.
  2. Configured initial provider state to `EnvironmentResolver.unresolved()` (`mode: "UNKNOWN"`, `showDevCredentials: false`).
  3. Implemented strict **Fail-Closed Security** in `EnvironmentResolver.shouldShowDevCredentials()`, ensuring dev credentials remain hidden during `UNKNOWN` / pre-resolution loading states.

## 2. Session Expired & Workspace Lock Server-Side Password Verification
- **Symptom:** Entering an incorrect or arbitrary password previously allowed users to unlock the session or workspace overlay.
- **Cause:** `SessionExpiredDialog.tsx` and `LockService.ts` called `authStore.setAuthState("Authenticated")` unconditionally upon form submission or non-empty input without verifying credentials server-side.
- **Resolution:**
  1. Implemented `POST /api/v1/auth/session/resume` to enforce authoritative server-side password verification against trusted user context (`current_user` / `refresh_token`).
  2. Refactored `LockService.unlockWorkspace(password)` and `SessionService.resumeSession(password)` to be asynchronous and fail-closed on 401, 403, 429, 500, or malformed HTTP 200 payloads.
  3. Implemented server-side rate limiting in `AuthService.resume_session()` (returns `HTTP 429 Too Many Requests` after 5 failed password attempts).
  4. Added automated security test suite in `src/tests/sessionExpiryAuth.test.ts` covering 14 security test scenarios.

## 2. Company Code Provisioning, Sequence Exhaustion & Duplicate Code Race
- **Symptom:** User sees duplicate code error (`HTTP 409 Conflict`), or automated Company Code suggestion stops.
- **Cause:**
  1. Company Code sequence `01..99` for a city+pin prefix (e.g. `MUM0067`) was fully occupied.
  2. A race condition occurred where two users attempted to provision the same Company Code simultaneously.
- **Resolution:**
  1. `CompanyCodeSuggestionService.ts` automatically extracts `CITY(3) + PIN_LAST4(4)` and queries `/api/v1/company/code/suggest` for next available 2-digit sequence (`01..99`).
  2. When all 99 sequences are occupied, automatic suggestion stops and prompts the user to enter a custom code.
  3. Backend `/company/setup` handles database `IntegrityError` by rolling back atomically, publishing `Company.Provisioning.Failed.v1`, and returning `HTTP 409 Conflict` with message `Company Code "MUM067001" is already in use. Please choose another Company Code.`
  4. Async race protection in `SetupWizardTab.tsx` ensures user manual overrides take absolute precedence over late-arriving async suggestion fetches.

## 2. Console Error `401 (Unauthorized)` on API Requests
- **Symptom:** `GET /api/v1/pos/profiles/`, `/pos/shifts/`, `/inventory/`, `/psv/parties` return `401 (Unauthorized)`.
- **Cause:** `ApiAuthProvider.ts` only looked for `data.token` from login responses. Because FastAPI returned `access_token`, `ApiAuthProvider` fell back to a mock string (`smriti_jwt_*`). Sending mock token headers to FastAPI failed signature verification.
- **Resolution:** Updated `ApiAuthProvider.ts` to map `access_token` and `refresh_token` from FastAPI login responses, storing real signed JWTs in `localStorage`.

## 2. Newly Created Company Not Showing in Organization Studio
- **Symptom:** Creating a company in Organization Studio succeeded in UI, but the company did not show up in the legal entity list.
- **Cause:**
  1. `apiFetchV1.ts` had a mock token guard (`if (isLocalMockToken(token)) return []`) that intercepted API calls during dev quick-fill sessions (`super`) and returned empty arrays instead of calling the live backend.
  2. `/company/setup` rejected subsequent company creation once initial setup was locked (`SETUP_COMPLETED_KEY`).
- **Resolution:**
  1. Removed mock token API interception in `apiFetchV1.ts` to dispatch all calls directly to FastAPI backend.
  2. Updated `/company/setup` in `backend/app/api/v1/system.py` to allow multi-company provisioning when `ignoreWarnings=true` or when called by authenticated admin users.

## 2. Container `smriti-api-prod` NameError `name 'exchange' is not defined`
- **Symptom:** `smriti-api-prod` crashes during boot with `NameError: name 'exchange' is not defined` at line 271 of `app/main.py`.
- **Cause:** `exchange` router module was mounted with `app.include_router(exchange.router, ...)` but was omitted from the top `from .api.v1 import (...)` tuple.
- **Resolution:** Added `exchange` to `from .api.v1 import (...)` in `backend/app/main.py`.

## 2. Container `smriti-api-prod` Failed to Start (Circular Import Error)
- **Symptom:** `smriti-api-prod` container fails health check and exits with `ImportError: cannot import name 'environment_router' from partially initialized module 'app.api.v1'`.
- **Cause:** `environment_router.py` was located under `app/api/v1/endpoints/environment_router.py`, but `app/api/v1/__init__.py` attempted to import `environment_router` directly from `app.api.v1`.
- **Resolution:** Initialized `app/api/v1/endpoints/__init__.py` as a Python package and updated `app/api/v1/__init__.py` to import `from .endpoints import environment_router`.

## 2. Organization Studio Company Provisioning
- **Symptom:** Clicking "Create New Company" in Organization Studio used to set a string banner notice.
- **Cause:** Button was previously a dead-end placeholder setter instead of an interactive action handler.
- **Resolution:** Clicking "Create New Company" opens the modal `SetupWizardTab` Company Provisioning Wizard overlay directly in `OrganizationStudio.tsx`.

## 3. Setup Wizard Fallback Mode & Upstream Python Core Notice
- **Symptom:** Setup Wizard completes with an Amber warning badge (`Status: LOCAL FALLBACK MODE — Pending Backend Confirmation`).
- **Cause:** Upstream Python backend core service was unreachable or returned a notice during `/company/setup` provisioning.
- **Resolution:** Setup details are provisioned locally (`smriti_setup_fallback_mode: true`). Verify backend API connectivity and run database verification via Administrative Modules.

## 4. Item Master Notification Prop Drop & Silent Failures
- **Symptom:** Catalog creation, save, or delete errors do not display toast notifications if the host workspace omitted `onNotification`.
- **Cause:** Direct unguarded calls to `if (onNotification) onNotification(...)` caused errors to vanish silently without logging.
- **Resolution:** `ItemMasterTab` and child components use the safe `notify` dispatcher wrapper. If `onNotification` is missing, notifications fall back automatically to `console.log('[ItemMaster Notification - ERROR/SUCCESS]: ...')`.

## 2. CRM Server Sync Discrepancies
- **Symptom:** Customers modified in the CRM tab do not show up immediately in other registers.
- **Cause:** Network offline state or pending sync queue failure.
- **Resolution:**
  1. Verify the network status in the browser console.
  2. If the browser shows offline, verify that mutations are saved in the `smriti_pending_customers` local storage array.
  3. Re-establish network connectivity to trigger automated online queue synchronization.

## 2. Keyboard Shortcut Collisions
- **Symptom:** Pressing F12 launches browser DevTools instead of executing standard checkout.
- **Cause:** Browser default hotkeys taking precedence.
- **Resolution:** The POS terminal calls `e.preventDefault()` to intercept keys. Ensure the focus resides inside the active viewport window of the POS application tab.

## 3. Split Payment Ledger Discrepancies
- **Symptom:** Total debits in General Ledger do not balance with sales invoice.
- **Cause:** Incomplete split payment breakdown payload.
- **Resolution:** Check `/api/pos/checkout` request logs. The payment mode must be set to `"Split"` with a valid `breakup` mapping.
## 4. Auth Bootstrap Fails with Data Conflict
- **Symptom:** `POST /api/v1/auth/bootstrap` returns `400` with error code `SMRITI-DATA-001` and no SYSADMIN user is created.
- **Cause:** The first-run bootstrap process inserts a `status` value of `PendingPasswordChange`, but the database `users.status` column may be defined too short (e.g. `varchar(20)`). This is a schema mismatch, not invalid credentials.

### Executive Summary
- **Status:** FAILED
- **Severity:** Critical
- **Root Cause:** Bootstrap administrator was never created.
- **Impact:**
  - Login fails with `401`
  - Setup Wizard cannot complete
  - System remains partially initialized
- **Recommendation:** Execute bootstrap recovery or perform a clean installation.

### Severity Matrix
- **Critical** — System unavailable
- **High** — Major functionality unavailable
- **Medium** — Feature affected
- **Low** — Minor issue
- **Info** — Operational guidance

### Prerequisites
- ✓ Database Backup
- ✓ Docker Running
- ✓ Backend Healthy
- ✓ PostgreSQL Reachable
- ✓ Admin Console Access

### Expected Results
- ✓ Admin user created
- ✓ JWT generated
- ✓ Setup Wizard complete
- ✓ Dashboard accessible

### Root Cause Tree
```
Cannot Login / Bootstrap Fails
        │
        ├── Admin Exists?
        │      ├── No -> Run Bootstrap
        │      │      ├── Bootstrap Failed?
        │      │      │      ├── Yes -> Run Doctor
        │      │      │      │      ├── Schema OK?
        │      │      │      │      │      ├── Yes -> Repair
        │      │      │      │      │      └── No -> Repair Schema
        │      │      │      │      └── Verify
        │      │      │      └── No -> Verify Login
        │      │      └── Yes -> Verify Login
        │      └── Yes -> Check setup_completed
        │             ├── Missing -> Set flag and complete setup
        │             └── Present -> Verify authentication
        └── Database partially initialized
```

### Troubleshooting Decision Tree
```
Cannot Login
↓
Admin Exists?
↓
No
↓
Run Bootstrap
↓
Bootstrap Failed?
↓
Yes
↓
Run Doctor
↓
Schema OK?
↓
Repair
↓
Verify
```

### Recovery Options
#### Option A – Development
- Reset the database completely.
- Run `POST /api/v1/auth/bootstrap` with the default SYSADMIN credentials.
- Complete the setup wizard through the UI.

#### Option B – Existing Customer
- Preserve existing data and take a full backup first.
- Create the missing SYSADMIN account using a controlled recovery script or API call.
- Insert any missing `system_configs` flags such as `setup_completed` if the company setup is already provisioned.
- Validate integrity for users, companies, branches, and stores.

#### Option C – Production
- Backup the database before making any repair.
- Validate current system consistency.
- Apply a recovery migration or repair script.
- Verify health checks and authentication flows.
- Enable the system only after validation passes.

### Recovery Commands
- Verify bootstrap status:
  ```bash
  curl -i -X GET http://localhost:8000/api/v1/system/setup-status
  ```
- Bootstrap admin:
  ```bash
  curl -i -X POST http://localhost:8000/api/v1/auth/bootstrap \
    -H "Content-Type: application/json" \
    -d '{"username":"admin","password":"Admin@123","email":"admin@smriti.local"}'
  ```
- Verify login:
  ```bash
  curl -i -X POST http://localhost:8000/api/v1/auth/login \
    -H "Content-Type: application/json" \
    -d '{"username":"admin","password":"Admin@123"}'
  ```
- Run System Doctor:
  ```bash
  curl -i -X GET http://localhost:8000/api/v1/system/doctor \
    -H "Authorization: Bearer <SYSADMIN_ACCESS_TOKEN>"
  ```

### Rollback
- Restore database backup
- Restart services
- Verify health

### Recommended Repair Validation
After repair, verify all of the following:
- `Admin` login works with the expected password.
- `setup_completed` is present and set to `true` in `system_configs`.
- JWT access token is issued successfully.
- Company and branch data can be accessed.
- Dashboard or initial tenant APIs return healthy responses.

### Known Causes Quick Reference
| Cause | Detection | Fix | Notes |
|---|---|---|---|
| Missing Admin | `SELECT * FROM users WHERE role='SYSADMIN'` | Run bootstrap | Most common root cause |
| Login 401 | `POST /api/v1/auth/login` fails | Verify admin state | Often due to missing bootstrap |
| Missing setup flag | `SELECT * FROM system_configs WHERE key='setup_completed'` | Insert flag | Setup Wizard may loop |
| Schema mismatch | Bootstrap endpoint returns `SMRITI-DATA-001` | Increase `users.status` length | `PendingPasswordChange` is too long |
| Migration gap | Database version out of sync | Apply migrations | May block bootstrap or auth |
| Seed roles missing | Role lookup fails | Seed required roles | Required for tenant creation |

### Never
- ❌ Edit password hashes manually
- ❌ Modify production records directly
- ❌ Skip database backup
- ❌ Change `setup_completed` without validation
- ❌ Delete bootstrap users

### Suggested Bootstrap State Model
A more robust bootstrap workflow should use explicit states:
- `NOT_INITIALIZED`
- `BOOTSTRAPPING`
- `BOOTSTRAPPED`
- `COMPANY_SETUP`
- `READY`
- `MAINTENANCE`

This prevents partial initialization from leaving the system in an inconsistent state.

### Expanded System Doctor Concept
A dedicated recovery tool should perform layered checks and generate a consolidated health report.
- Database connectivity
- Migration version
- Bootstrap status
- Roles & permissions
- Companies
- Branches
- Stores
- Users
- JWT secrets
- API health
- Cache or storage health
- Background workers
- Pending queues
- License status
- Version compatibility

Report should include PASS / WARN / FAIL for each area.

### System Doctor Example
```
smriti doctor

Detect
Repair
Verify
Report
```

### Incident Report Template
- Incident ID:
- Environment:
- Detected At:
- Symptoms:
- Root Cause:
- Resolution:
- Validation:
- Downtime:
- Owner:
- Preventive Action:

### Resolution Steps
1. Verify the database has no existing users: `SELECT count(*) FROM users;`
2. Confirm the expected bootstrap credentials:
   - `username`: `admin`
   - `password`: `Admin@123`
   - `email`: `admin@smriti.local`
3. If bootstrap still fails, ensure `users.status` supports at least 50 characters.
4. If bootstrap succeeded but login still fails, verify the `admin` account exists and that the `setup_completed` flag is not missing.
5. If the system is partially initialized, consider running a recovery script rather than manually editing production data.

### Notes
- Frontend seeded demo users like `super` / `whynothing` are separate from backend bootstrap users and may not exist in the backend DB until the system is initialized.
- A dedicated bootstrap health check and recovery report would significantly reduce support effort and prevent this issue from recurring.
- Long-term recommendation: implement `System Doctor` as a first-class administration module with automated diagnostics, repair workflows, and downloadable support bundles.
