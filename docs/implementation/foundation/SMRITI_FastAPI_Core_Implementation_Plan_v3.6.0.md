<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.6.0
  Created      : 2026-07-11
  Modified     : 2026-07-11
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Implementation Plan: SMRITI FastAPI Core Backend Framework — v3.6.0

This document defines the plan to implement a parallel SMRITI core backend framework in **FastAPI (Python)** under a top-level `backend/` folder.

---

## 1. Objective
Design and implement a top-level **FastAPI core backend** for SMRITI Retail OS, featuring SQLAlchemy 2.x, Alembic, Pydantic settings, security middleware, Ruff linting, and pytest suites.

---

## 2. Business Motivation
Establish the long-term, production-grade Python environment mapping SMRITI services, enabling advanced GenAI/Gemini orchestration, database migrations, and clean architecture isolation.

---

## 3. Scope

### In Scope
- **Directory Isolation:** Setup root `backend/` folder separate from frontend/Node components.
- **Dependency Management:** Setup `pyproject.toml` and `requirements.txt`.
- **Database ORM & Migrations:** Configure SQLAlchemy 2.x with asyncpg, and Alembic database migrations.
- **REST Endpoints & Versioning:** Expose `/health` routes and `/api/v1/` routes for metadata, changelog, and dev-tracker.
- **Developer Tooling:** Configure Ruff formatting and Pytest test suites.

---

## 4. Current State
- Backend runs exclusively on Node.js/Express (`server.ts`).
- No Python/FastAPI service components exist.

---

## 5. Gap Analysis
- Lacks a native Python environment for data science, async database migrations, or AI library orchestration.

---

## 6. Proposed Design

### Folder Layout
```text
backend/
├── pyproject.toml
├── requirements.txt
├── alembic.ini
├── app/
│   ├── main.py
│   ├── core/
│   │   ├── config.py
│   │   ├── logging.py
│   │   ├── security.py
│   │   └── constants.py
│   ├── api/
│   │   └── v1/
│   │       ├── changelog.py
│   │       ├── dev_tracker.py
│   │       └── metadata.py
│   ├── db/
│   │   ├── session.py
│   │   └── base.py
│   ├── middleware/
│   │   └── request_logger.py
│   ├── models/
│   ├── schemas/
│   ├── services/
│   ├── repositories/
│   ├── ai/
│   ├── dev_tracker/
│   │   ├── scanner.py
│   │   └── reports.py
│   └── tests/
│       ├── test_main.py
│       └── test_security.py
```

---

## 7. Files Created
- `backend/requirements.txt`
- `backend/pyproject.toml`
- `backend/alembic.ini`
- `backend/app/main.py`
- `backend/app/core/config.py`
- `backend/app/core/logging.py`
- `backend/app/core/security.py`
- `backend/app/core/constants.py`
- `backend/app/api/v1/metadata.py`
- `backend/app/api/v1/changelog.py`
- `backend/app/api/v1/dev_tracker.py`
- `backend/app/db/session.py`
- `backend/app/db/base.py`
- `backend/app/middleware/request_logger.py`
- `backend/app/dev_tracker/scanner.py`
- `backend/app/dev_tracker/reports.py`
- `backend/app/tests/test_main.py`

---

## 8. Files Modified
- [MODIFY] [package.json](file:///d:/IMP/GitHub/SMRITRretailNX/package.json) — Add FastAPI dev runtime script.

---

## 9. Verification Plan
- Execute `pytest backend/app/tests/` verifying all routing assertions succeed.

---

## 10. Status
Approved.

---

## 11. Related ADRs
- None.

---

## 12. Related Walkthroughs
- None.
