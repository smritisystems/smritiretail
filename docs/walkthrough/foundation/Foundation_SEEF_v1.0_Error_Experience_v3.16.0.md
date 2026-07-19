<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.16.0
  Created      : 2026-07-12
  Modified     : 2026-07-12
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# SMRITI Error Experience Framework (SEEF) v1.0 — Walkthrough

## 1. Purpose
This document provides a walkthrough of the implementation of the **SMRITI Error Experience Framework (SEEF) v1.0**. It replaces default FastAPI/Starlette plain JSON error responses with a branded user interface.

## 2. Scope
* Centralized handling of HTTP status codes: 400, 401, 403, 404, 405, 409, 422, 429, 500, and 503.
* Branded API Landing Page at `GET /`.
* Development mode stack trace display (collapsible).
* Content negotiation supporting browser HTML requests (`Accept: text/html`) and API client JSON requests.

## 3. Files Created
* [`backend/app/templates/errors/base.html`](file:///d:/IMP/GitHub/SMRITRretailNX/backend/app/templates/errors/base.html)
* [`backend/app/templates/errors/error.html`](file:///d:/IMP/GitHub/SMRITRretailNX/backend/app/templates/errors/error.html)
* [`backend/app/templates/errors/landing.html`](file:///d:/IMP/GitHub/SMRITRretailNX/backend/app/templates/errors/landing.html)
* [`backend/app/tests/test_seef.py`](file:///d:/IMP/GitHub/SMRITRretailNX/backend/app/tests/test_seef.py)

## 4. Files Modified
* [`backend/production.txt`](file:///d:/IMP/GitHub/SMRITRretailNX/backend/production.txt)
* [`backend/app/core/errors.py`](file:///d:/IMP/GitHub/SMRITRretailNX/backend/app/core/errors.py)
* [`backend/app/core/error_handlers.py`](file:///d:/IMP/GitHub/SMRITRretailNX/backend/app/core/error_handlers.py)
* [`backend/app/main.py`](file:///d:/IMP/GitHub/SMRITRretailNX/backend/app/main.py)
* [`CHANGELOG.md`](file:///d:/IMP/GitHub/SMRITRretailNX/CHANGELOG.md)
* [`docs/walkthrough/README.md`](file:///d:/IMP/GitHub/SMRITRretailNX/docs/walkthrough/README.md)

## 5. Architecture Decisions
* **Jinja2 Templating Integration:** We chose `Jinja2` to enable backend rendering of HTML pages for browser clients.
* **Middle-Tier Content Negotiation:** By checking the request `Accept` header in central exception handlers, we decouple the presentation format from core business logic.

## 6. Design Rationale
* **Retro-Compatibility Gate:** The enhanced API JSON payloads include both the old `detail`/`error` structures and the new flat metadata fields to avoid breaking the React/TypeScript frontend and legacy clients.
* **Environment-Gated Diagnostics:** Technical stack traces are only rendered when `ENVIRONMENT == "development"` to prevent exposing sensitive internal structures in production.

## 7. Implementation Summary
* Added `jinja2` dependency.
* Updated standard dictionary codes to match error families (SMRITI-VAL, SMRITI-AUTH, etc.).
* Implemented content negotiation in `validation_exception_handler`, `http_exception_handler`, `db_exception_handler`, and `generic_exception_handler`.
* Registered new `GET /` router endpoint with diagnostic metrics (uptime, database connection, loaded routes).

## 8. Tests Executed
* Executed 4 integration tests validating HTML/JSON formatting, status codes, and landing pages:
  ```bash
  $env:JWT_SECRET_KEY="test"; $env:SGIP_VAULT_MASTER_KEY="testkey"; python -m pytest app/tests/test_seef.py -v
  ```

## 9. Verification Results
```text
app/tests/test_seef.py::test_landing_page_html PASSED                    [ 25%]
app/tests/test_seef.py::test_landing_page_json PASSED                    [ 50%]
app/tests/test_seef.py::test_404_error_html PASSED                       [ 75%]
app/tests/test_seef.py::test_404_error_json PASSED                       [100%]
```

## 10. Known Limitations
* Basic uptime logging does not persist across application restarts.

## 11. Future Work
* **SEEF v2.0:** Implement an AI error recovery assistant providing suggestions based on historical traces.

## 12. Related ADRs
* None

## 13. Related RFCs
* None
