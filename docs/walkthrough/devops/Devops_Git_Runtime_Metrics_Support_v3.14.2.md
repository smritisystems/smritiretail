<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.14.2
  Created      : 2026-07-11
  Modified     : 2026-07-11
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
-->

# DevOps — Git Runtime Metrics Support — Walkthrough v3.14.2

**Date:** 2026-07-11  
**Status:** Done  

---

## 1. Purpose
Ensure the built-in SMRITI Development Intelligence Center (SDIC) code health scanner is capable of executing Git tree analysis inside the container environments.

---

## 2. Scope
- Install the `git` client on the alpine-based Node.js runtime and slim-based Python backend Docker images.
- Mount the host `.git` repository folder to the Node API container at `/usr/src/app/.git`.
- Rebuild containers and verify metrics scanning executes successfully.

---

## 3. Files Created
None.

---

## 4. Files Modified
- [Dockerfile](file:///d:/IMP/GitHub/SMRITRretailNX/Dockerfile) — Installed `git` via apk in Node production runtime.
- [backend/Dockerfile](file:///d:/IMP/GitHub/SMRITRretailNX/backend/Dockerfile) — Installed `git` via apt-get in Python production runtime.
- [docker-compose.yml](file:///d:/IMP/GitHub/SMRITRretailNX/docker-compose.yml) — Volume-mounted `.git` to the API gateway container.

---

## 5. Architecture Decisions
- **Selective Git Mounting:** Volume map the `.git` metadata folder read-only (or standard mount) to the exact directory path `/usr/src/app/.git` to avoid copying `.git` into intermediate builder stages, preserving small image sizes.

---

## 6. Design Rationale
Enabling direct Git CLI client calls within the container removes scan errors and logs correct branch metadata at boot.

---

## 7. Implementation Summary
1. Updated Dockerfiles to include `git` package.
2. Mounted the host `.git` path under `app` service in `docker-compose.yml`.
3. Rebuilt all docker images.

---

## 8. Tests Executed
```bash
docker logs smriti-api
```

---

## 9. Verification Results
- **SDIC Scanner:** Runs and logs `Beginning SMRITI Development Intelligence Center scan...` and completes successfully.
- **Docker Compose:** All containers are active and healthy.

---

## 10. Known Limitations
None.

---

## 11. Future Work
Standardize SDIC scanning metrics trigger.

---

## 12. Related ADRs
None.

---

## 13. Related RFCs
None.
