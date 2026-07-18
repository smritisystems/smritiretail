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
- **Resolution:**
  1. Verify the database has no existing users: `SELECT count(*) FROM users;`.
  2. Confirm default bootstrap credentials:
     - `username`: `admin`
     - `password`: `Admin@123`
     - `email`: `admin@smriti.local`
  3. If the bootstrap endpoint still fails, update the schema so `users.status` supports at least 50 characters and retry bootstrap.
  4. After successful bootstrap, log in with the same credentials and change the password if prompted.
  5. Note: frontend seeded demo users like `super` / `whynothing` are separate from backend bootstrap users and may not exist in the backend DB until the system is initialized.
