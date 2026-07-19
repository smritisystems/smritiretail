<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Email        : support@smritibooks.com
  Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.32.2
  Created      : 2026-07-19
  Modified     : 2026-07-19
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough: SDIC Deprecation Phase 1 — v3.32.2

This walkthrough documents Phase 1 of the formal deprecation of the SMRITI Development Intelligence Center (SDIC).

---

## 1. Purpose
Introduce soft deprecation of the SMRITI Development Intelligence Center (SDIC) to align the repository with SMRITI Governance Rules 4 & 7 and the AI Agent Output Verification Framework (AOVF v1.0).

---

## 2. Scope
- Injection of `Warning: 299` deprecation warning headers into all `/api/v1/dev-tracker` REST endpoints.
- Integration of validation assertions in the backend test suite verifying the warning header presence.
- Creation of the formal deprecation review record `docs/governance/SDIC_DEPRECATION_REVIEW_v1.0.md`.

---

## 3. Files Created
- [docs/governance/SDIC_DEPRECATION_REVIEW_v1.0.md](file:///f:/SMRITRretailNXmgrt/docs/governance/SDIC_DEPRECATION_REVIEW_v1.0.md)

---

## 4. Files Modified
- [backend/app/api/v1/dev_tracker.py](file:///f:/SMRITRretailNXmgrt/backend/app/api/v1/dev_tracker.py) — Injected `Response` parameters and warning headers.
- [backend/app/tests/test_main.py](file:///f:/SMRITRretailNXmgrt/backend/app/tests/test_main.py) — Added test assertions for the warning header.

---

## 5. Architecture Decisions
- **AD-11 (HTTP Warning 299):** Injected RFC-compliant HTTP `Warning: 299` header to programmatically notify callers of deprecation, preserving API response structure to prevent breaking downstream UI consumers.

---

## 6. Design Rationale
Implementing soft deprecation rather than hard removal preserves system stability for current environments while formally signalling to engineers and clients that the tracker's metrics are deprecated.

---

## 7. Implementation Summary
- Replaced signature of endpoints `get_dev_tracker_status` and `trigger_dev_tracker_scan` to accept FastAPI `Response`.
- Added response header injection: `response.headers["Warning"] = '299 - "SMRITI SDIC is deprecated and will be removed in v4.0"'`.
- Updated test assertions in `test_main.py` verifying headers.

---

## 8. Tests Executed
Ran `python -m pytest app/tests/test_main.py` on the host to verify the test suite.

---

## 9. Verification Results
```text
============================= test session starts =============================
platform win32 -- Python 3.14.3, pytest-9.0.2, pluggy-1.6.0
rootdir: F:\SMRITRretailNXmgrt\backend
configfile: pyproject.toml
plugins: anyio-4.12.1, langsmith-0.8.5, asyncio-1.3.0
collected 6 items

app\tests\test_main.py ......                                            [100%]
======================= 6 passed, 10 warnings in 24.53s =======================
```

---

## 10. Known Limitations
None. Frontend calls still succeed as structural changes were kept fully backward-compatible.

---

## 11. Future Work
- **Phase 2:** Decommissioning by removing UI tab links in `src/layout_engine/layout_store.tsx`.
- **Phase 3:** Complete code purge targeting the `dev_tracker/` python package.

---

## 12. Related ADRs
- **ADR-002:** Metadata Architecture.

---

## 13. Related RFCs
None.
