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

## 1. CRM Server Sync Discrepancies
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
