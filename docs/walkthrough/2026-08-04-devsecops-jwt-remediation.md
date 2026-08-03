<!--
  Project      : SMRITI Retail OS
  Organization : SmritiSys

  Founders
  • Pushpa Devi Jawahar Mallah (Founder & Chairperson)
  • Jawahar Ramkripal Mallah (Founder, CEO & Chief Systems Architect)

  Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.32.0
  Created      : 2026-08-04
  Modified     : 2026-08-04
  Copyright    : © SmritiSys. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough: DevSecOps JWT Migration & 0-Vulnerability Certification

## Summary
Migrated backend JWT engine from deprecated `python-jose` to security-hardened `PyJWT` (`pyjwt[crypto]>=2.13.0`) and updated FastAPI/Starlette dependencies. Confirmed **0 known vulnerabilities** via `pip-audit`.

## Changes Made
- Updated [backend/app/core/security.py](file:///f:/SMRITRretailNXmgrt/backend/app/core/security.py) to use `PyJWT` (`jwt.encode`, `jwt.decode`, `PyJWTError`).
- Updated [backend/production.txt](file:///f:/SMRITRretailNXmgrt/backend/production.txt) with `pyjwt[crypto]>=2.13.0`, `fastapi>=0.115.11`, `starlette>=0.47.2`, and `python-multipart>=0.0.20`.
- Eliminated legacy sub-dependencies `pyasn1` and `ecdsa`.
