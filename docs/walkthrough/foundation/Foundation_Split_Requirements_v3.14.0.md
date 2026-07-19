<!--
  Project      : SMRITI Retail OS
  Repository   : SMRITIRetailNX
  Organization : AITDL NETWORKS

  Founders

  * Pushpa Devi Jawahar Mallah — Founder & Chairperson
  * Jawahar Ramkripal Mallah  — Founder, CEO & Chief Software Architect
  * Websites: smritisys.com | aitdl.com | erpnbook.com | smritibooks.com

  * Version    : 3.14.0
  * Created    : 2026-07-11
  * Modified   : 2026-07-11
  * Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
  * License    : Proprietary Commercial Software
-->

# Foundation — Split Requirements — Walkthrough v3.14.0

**Date:** 2026-07-11  
**Status:** Done

---

## 1. Purpose

Refactor the single monolithic python `requirements.txt` file into separate environment-specific files (`production.txt` and `dev.txt`) to isolate production application dependencies from development, testing, and linting tools.

---

## 2. Scope

| Included | Excluded |
|---|---|
| Creation of `production.txt` containing only runtime dependencies | Upgrading or changing dependency versions |
| Creation of `dev.txt` containing dev/test tools and inheriting `production.txt` | Switching to poetry/pipenv dependency management |
| Redirecting the root `requirements.txt` to `production.txt` | - |

---

## 3. Files Created

| File | Purpose |
|---|---|
| `backend/production.txt` | Core runtime dependencies (FastAPI, SQLAlchemy, uvicorn, etc.) |
| `backend/dev.txt` | Development-only dependencies (pytest, black/ruff, mypy, bandit) |

---

## 4. Files Modified

| File | Change |
|---|---|
| `backend/requirements.txt` | Redirected to `production.txt` using `-r production.txt` |

---

## 5. Architecture Decisions

### A. Non-breaking legacy fallback
Instead of deleting `requirements.txt`, it has been redirected to `production.txt` using `-r production.txt`. This maintains full compatibility with legacy docker builds, automated deployment scripts, and host pipelines that run `pip install -r requirements.txt`.

---

## 6. Design Rationale

- Referencing production dependencies in `dev.txt` using `-r production.txt` avoids duplication and guarantees that development runs on the identical set of base packages.

---

## 7. Implementation Summary

- Separated 11 runtime packages into `production.txt`.
- Separated 7 development/testing packages into `dev.txt`.
- Maintained exact package pins to prevent version drift.

---

## 8. Tests Executed

**Command:**
```
pip install --no-deps -r requirements.txt
```
(Parses and resolves references successfully).

**Command:**
```
python -m pytest app/tests/ -v --tb=short
```
Output:
```
====================== 89 passed, 524 warnings in 39.15s ======================
```

---

## 9. Verification Results

| Check | Status |
|---|---|
| File split successfully | Done |
| Backward compatibility maintained | Done |
| All 89 test cases pass | Done |

---

## 10. Known Limitations

None.

---

## 11. Future Work

- Dockerfile refactoring to utilize `production.txt` to reduce runtime image size.

---

## 12. Related ADRs

None.

---

## 13. Related RFCs

None.
