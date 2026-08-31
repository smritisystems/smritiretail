<!--
  Project      : SMRITI Retail OS
  Repository   : SMRITIRetailNX
  Organization : AITDL NETWORKS

  Founders

  * Pushpa Devi Jawahar Mallah — Founder & Chairperson
  * Jawahar Ramkripal Mallah  — Founder, CEO & Chief Software Architect
  * Websites: aitdl.com | erpnbook.com | smritibooks.com

  * Version    : 3.14.0
  * Created    : 2026-07-11
  * Modified   : 2026-07-11
  * Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
  * License    : Proprietary Commercial Software
-->

# Foundation — HREP Compliance — Walkthrough v3.14.0

**Date:** 2026-07-11  
**Status:** Done

---

## 1. Purpose

Implement the SMRITI Human-Readable Error Policy (HREP) to prevent raw platform, database, or network-generated exception messages from leaking to end users, formatting all error responses into business-friendly language with actionable suggested steps and traceable reference IDs.

---

## 2. Scope

| Included | Excluded |
|---|---|
| Interception of `RequestValidationError` (Pydantic validation errors) | Client-side localization |
| Interception of `HTTPException` (FastAPI standard exceptions) | Dynamic custom suggestions dictionary |
| Interception of database `SQLAlchemyError` exceptions | - |
| Dynamic removal of technical words (e.g. SQL, API, exception) | - |
| SMRITI standard JSON structure with `detail` backwards-compatibility | - |

---

## 3. Files Created

| File | Purpose |
|---|---|
| `backend/app/core/errors.py` | SMRITI error response schemas, dictionary mapping, reference generator |
| `backend/app/core/error_handlers.py` | Custom exception handlers registered on FastAPI app |

---

## 4. Files Modified

| File | Change |
|---|---|
| `backend/app/main.py` | Imported and registered error handlers via `register_error_handlers` |

---

## 5. Architecture Decisions

### A. Backward compatibility for testing
To avoid breaking the test suite's validation of error messages (which look for string content in the `detail` JSON field), the HREP response has a dual structure containing both a root-level `detail` string and a structured `error` object.

### B. dynamic tech-word sanitize
To guarantee that no technical words (like JSON, traceback, API, database, repository, SQL) leak through messages from dependencies or custom endpoints, the `build_error_response` sanitizes and replaces these with non-technical equivalents like "system".

---

## 6. Design Rationale

- Kept handlers separated from `main.py` to preserve core configuration cleanliness.
- Leveraged md5 hashes of errors combined with today's date for unique support ticket Reference IDs: `SMRITI-ERR-YYYYMMDD-XXXXXX`.

---

## 7. Implementation Summary

### Error Response Schema

```json
{
  "detail": "Detailed business-friendly explanation.",
  "error": {
    "title": "Validation Failed",
    "explanation": "Detailed business-friendly explanation.",
    "suggested_action": "Please check the highlighted fields and correct the inputs.",
    "reference_id": "SMRITI-ERR-20260711-A5B2C3",
    "error_code": "SMRITI-VAL-001"
  }
}
```

---

## 8. Tests Executed

**Command:**
```
python -m pytest app/tests/ -v --tb=short
```

**Output:**
```
====================== 89 passed, 524 warnings in 39.15s ======================
```
All existing endpoints, validation, permission, and duplicate constraints tests passed and are fully compatible with HREP.

---

## 9. Verification Results

| Check | Status |
|---|---|
| SMRITI HREP schemas registered | Done |
| Technical terms dynamically filtered | Done |
| All 89 test cases pass | Done |

---

## 10. Known Limitations

- Substring matching for technical words is simple case-insensitive search and replace; more sophisticated natural language translations can be added in the future.

---

## 11. Future Work

- Integration of HREP into client SDK response interceptors.

---

## 12. Related ADRs

None.

---

## 13. Related RFCs

None.
