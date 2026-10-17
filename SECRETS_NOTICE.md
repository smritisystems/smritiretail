<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.30.0
  Created      : 2026-09-09
  Modified     : 2026-09-09
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# SMRITI Retail OS — Secrets Management Notice

> [!CAUTION]
> The `.env` file in this directory contains **LOCAL DEVELOPMENT SECRETS ONLY**.
> These values must be rotated before any deployment to test, staging, or production environments.
> `.env` is listed in `.gitignore` and must **never** be committed to version control.

## Managed Secrets

| Variable | Purpose | Min Length | Algorithm |
|---|---|---|---|
| `JWT_SECRET_KEY` | HMAC-SHA256 signing for JWT access/refresh tokens | 64 hex chars (256-bit) | HS256 |
| `INTERNAL_SERVICE_KEY` | Inter-service authorization (FastAPI ↔ Node.js) | 64 hex chars (256-bit) | HMAC |
| `SGIP_VAULT_MASTER_KEY` | AES-256-GCM + HKDF-SHA256 root encryption key | 64 hex chars (256-bit) | AES-GCM |

## Rotation Procedure

### 1. Generate New Keys (PowerShell)
```powershell
# Run once per environment — never reuse values across environments
$jwt  = -join ((1..32) | ForEach-Object { '{0:X2}' -f (Get-Random -Max 256) })
$svc  = -join ((1..32) | ForEach-Object { '{0:X2}' -f (Get-Random -Max 256) })
$sgip = -join ((1..32) | ForEach-Object { '{0:X2}' -f (Get-Random -Max 256) })
Write-Host "JWT_SECRET_KEY=$jwt"
Write-Host "INTERNAL_SERVICE_KEY=$svc"
Write-Host "SGIP_VAULT_MASTER_KEY=$sgip"
```

### 2. For Local Development
Copy the generated values into `.env` (root). Restart the FastAPI backend after updating.

### 3. For Test / Staging / Production
**Never** write secrets into `.env` files on server machines. Instead:
- Set them as **operating system environment variables** before starting the server process, OR
- Inject them via your **deployment secret manager** (e.g., HashiCorp Vault, AWS Secrets Manager, Azure Key Vault, GCP Secret Manager).
- The `backend/.env` file already uses `${VAR}` substitution placeholders — it will inherit from the OS environment automatically.

## Architecture Rule
`backend/app/core/config.py` enforces a **fail-closed** policy in production mode:
- If `JWT_SECRET_KEY` is absent or shorter than 32 characters in production, the backend **refuses to start** (`ValueError` raised).
- If `INTERNAL_SERVICE_KEY` is absent or shorter than 32 characters in production, the backend **refuses to start**.

This ensures that a missing secret causes an early, visible startup failure rather than a silent runtime security breach.

## Secret Independence Rule
Each of the three managed secrets must be a **distinct value**. Do not copy one to fill another.

## Audit Trail
| Date | Action | Actor |
|---|---|---|
| 2026-09-09 | Initial local dev secrets rotated to 256-bit random values (was: weak UUID/plaintext fallbacks) | Production Readiness Sprint v3.30.0 |
