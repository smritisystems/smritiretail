<!--
  Project         : SMRITI Retail OS
  Organization    : SmritiSys

  Founders
  • Pushpa Devi Jawahar Mallah
    Founder & Chairperson

  • Jawahar Ramkripal Mallah
    Founder, Chief Executive Officer (CEO) &
    Chief Systems Architect

  Email           : support@smritisys.com
  Website         : https://smritisys.com
  Other Domains   : smritibooks.com | erpnbook.com | aitdl.com

  Version         : 3.32.0
  Created         : 2026-07-19
  Modified         : 2026-07-19

  Copyright       : © SmritiSys. All Rights Reserved.
  License         : Proprietary Commercial Software
  Classification  : Internal
-->

# SMRITI Retail OS Security Architecture

This document describes the security protocols, cryptography standards, authentication layers, and threat mitigation models in SMRITI Retail OS.

---

## 1. Authentication Lifecycle

SMRITI utilizes token-based authentication via JSON Web Tokens (JWT):
* **Access Tokens:** Signed via HS256 HMAC utilizing a secure backend environment secret key. Lifetime is 60 minutes.
* **Refresh Tokens:** Lifetime is 7 days. Exchanged via `/api/v1/auth/refresh` to rotate access credentials.
* **Revocation Blacklist:** Revoked refresh tokens (upon `/logout` calls) are immediately logged into the `refresh_token_blacklist` table by their unique JWT `jti` identifier. Any future presentation of a blacklisted `jti` is rejected.

---

## 2. Password Cryptography

* **Hashing Algorithm:** Uses Argon2id (`passlib.context`) for password hashing.
* **Fallback Strategy:** If local runtime dependencies for Argon2 are missing, the system falls back to bcrypt.
* **Legacy Compatibility:** Supports Django-style `pbkdf2_sha512` hashes to allow migration of legacy users.
* **Password Policy:** Enforces complexity: min 8 characters, 1 uppercase, 1 lowercase, 1 number, 1 special character.

---

## 3. Role-Based Access Control (RBAC) & Scoping

SMRITI implements a hierarchical, policy-based RBAC model:
* **Precedence Order:** Explicit Deny > Explicit Allow > Inherited Allow > Default Deny.
* **Tenant Isolation:** Enforced via secure JWT context injection. The database query engine extracts the `company_id` and `branch_id` from the secure token payload, preventing horizontal tenant spoofing attacks.
* **Bypass:** The global `SYSADMIN` role bypasses business permission verification but is blocked from accessing customer transactional POS ledgers unless explicitly assigned.
* **Audit Trail:** Security policy configurations and permission changes are recorded to `smriti_security_audits` tracking the user, action, IP address, and old vs new configuration payloads.
