<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.14.1
  Created      : 2026-07-11
  Modified     : 2026-07-11
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
-->

# Foundation — Database & Container Fixes — Walkthrough v3.14.1

**Date:** 2026-07-11  
**Status:** Done  

---

## 1. Purpose
Resolve startup container crashes and pipeline test failures by ensuring requirements are loaded, search paths (`PYTHONPATH`) are set, duplicate SQL schema runs are skipped, and workspace files are accessible.

---

## 2. Scope
- Fix Python Core backend startup crash by copying requirements dependencies in the Docker image.
- Set PYTHONPATH environment variable to allow module resolution on boot.
- Prevent Node.js Express server from crashing on restart when PostgreSQL tables already exist.
- Mount and locate CHANGELOG.md cleanly inside Docker for the changelog endpoint.

---

## 3. Files Created
None.

---

## 4. Files Modified
- [backend/Dockerfile](file:///d:/IMP/GitHub/SMRITRretailNX/backend/Dockerfile) — Copied requirements text files before running pip install.
- [backend/entrypoint.sh](file:///d:/IMP/GitHub/SMRITRretailNX/backend/entrypoint.sh) — Exported `PYTHONPATH=/app`.
- [src/db/init.ts](file:///d:/IMP/GitHub/SMRITRretailNX/src/db/init.ts) — Added `pg_tables` check to skip duplicate schema executions.
- [backend/app/api/v1/changelog.py](file:///d:/IMP/GitHub/SMRITRretailNX/backend/app/api/v1/changelog.py) — Added robust folder lookup fallbacks.
- [docker-compose.yml](file:///d:/IMP/GitHub/SMRITRretailNX/docker-compose.yml) — Volume-mounted CHANGELOG.md and changed healthcheck target.

---

## 5. Architecture Decisions
- **Existing Schema Bypassing:** Skip duplicate SQL schema runs dynamically based on the presence of the `customer_groups` table, keeping startup fast and non-destructive.
- **Volume Isolation Mapping:** Mount local resources like CHANGELOG.md into containers to ensure testing consistency without bloating build sizes.

---

## 6. Design Rationale
Checking table existence directly in PostgreSQL (`pg_tables`) prevents startup crash loops while maintaining offline parity.

---

## 7. Implementation Summary
1. Copied dependencies correctly in `backend/Dockerfile`.
2. Updated `backend/entrypoint.sh` with `PYTHONPATH`.
3. Added table checking in `src/db/init.ts`.
4. Mounted and verified CHANGELOG.md in the test container.

---

## 8. Tests Executed
```bash
docker exec -e PYTHONPATH=/app smriti-python-core pytest
```

---

## 9. Verification Results
- **Pytest Suite:** 89 passed, 0 failed.
- **Node.js Express Server:** Healthy and active.
- **FastAPI Core Backend:** Healthy and active.

---

## 10. Known Limitations
None.

---

## 11. Future Work
Standardize all DDL migrations under Alembic.

---

## 12. Related ADRs
None.

---

## 13. Related RFCs
None.
