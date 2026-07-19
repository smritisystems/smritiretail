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

# SMRITI Error Experience Framework (SEEF) v1.0 — Implementation Plan

## 1. Objective
Establish a unified error handling system in the FastAPI backend called the **SMRITI Error Experience Framework (SEEF) v1.0**. It replaces default raw JSON error responses with branded HTML pages for browsers and enhanced JSON objects for API clients, preserving backward compatibility.

## 2. Business Motivation
Raw machine-readable errors confuse users and expose technical system internal states, violating SMRITI HREP rules. Implementing SEEF v1.0 guarantees a premium, branded error recovery flow for store managers and clear troubleshooting parameters for developers.

## 3. Scope
* Centralized handling of HTTP codes: 400, 401, 403, 404, 405, 409, 422, 429, 500, 503.
* Dynamic response dispatching based on request headers (`Accept`).
* Branded landing page for `GET /`.
* Development mode stack traces (collapsible) and secure production mode errors.
* Integration testing covering dispatch paths.

## 4. Current State
* Errors return standardized JSON (`SmritiErrorResponse`) containing `detail` and `error` dictionary fields.
* No root `GET /` handler exists.
* No HTML-formatted error responses are supported.

## 5. Gap Analysis
* **Browser experience:** Browser requests receive raw JSON payloads.
* **Diagnostics visibility:** Lack of centralized landing statistics (uptime, loaded routers) for administrators.

## 6. Architecture Impact
* Integrates `Jinja2` templating engine within the backend service core.
* Enhances the API middleware exception pipeline.

## 7. Proposed Design

### A. Backward Compatible JSON Error Format
```json
{
    "detail": "Explanation of the error...",
    "error": {
        "title": "Error Title",
        "explanation": "Explanation...",
        "suggested_action": "Action...",
        "reference_id": "RefID",
        "error_code": "SMRITI-VAL-001"
    },
    "success": false,
    "status": 404,
    "title": "Error Title",
    "message": "Explanation...",
    "suggested_action": "Action...",
    "error_code": "SMRITI-VAL-001",
    "reference_id": "RefID",
    "timestamp": "ISO-Timestamp",
    "documentation": "/docs"
}
```

### B. Exception Dispatch Logic
```python
def dispatch_error(request: Request, status_code: int, response_model: SmritiErrorResponse):
    accept = request.headers.get("accept", "")
    if "text/html" in accept:
        return templates.TemplateResponse(
            "errors/error.html",
            {
                "request": request,
                "status_code": status_code,
                "title": response_model.error.title,
                "explanation": response_model.error.explanation,
                "suggested_action": response_model.error.suggested_action,
                "reference_id": response_model.error.reference_id,
                "error_code": response_model.error.error_code,
                "env": settings.ENVIRONMENT,
                # Additional dev diagnostics...
            }
        )
    return JSONResponse(status_code=status_code, content=response_model.model_dump_enhanced())
```

---

## 8. Files Created
* `backend/app/templates/errors/base.html`
* `backend/app/templates/errors/error.html`
* `backend/app/templates/errors/landing.html`
* `backend/app/tests/test_seef.py`

## 9. Files Modified
* `backend/production.txt`
* `backend/app/core/error_handlers.py`
* `backend/app/main.py`
* `CHANGELOG.md`
* `docs/walkthrough/README.md`
* `docs/implementation/README.md`

## 10. Dependencies
* `jinja2==3.1.4`

## 11. Risks
* **Jinja2 Installation Blockers:** Missing access during Docker builds.
  * *Mitigation:* Ensure dependency is added to `production.txt`.

## 12. Rollback Strategy
* Revert files via `git checkout`.

## 13. Verification Plan
* Validate landing page rendering and API error formats.

## 14. Test Plan
* Execute regression tests in `test_seef.py`.

## 15. Documentation Impact
* Generate walkthrough `docs/walkthrough/foundation/Foundation_SEEF_v1.0_Error_Experience_v3.16.0.md`.

## 16. Deployment Plan
* Merge from `development` to `main`, run CI checks, and push.

## 17. Status
Draft (Pending User Approval)

## 18. Related ADRs
* None

## 19. Related Walkthroughs
* None
