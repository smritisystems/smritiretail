<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.31.1
  Created      : 2026-07-19
  Modified     : 2026-07-19
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough: SMRITI SaaS Tenant Isolation Hotfix — v3.31.1

## 1. Purpose
Document the resolution of an `InvalidRequestError` raised by SQLAlchemy's `with_loader_criteria` hook due to an uncacheable closure variable.

## 2. Scope
- Fix closure variable issue inside `apply_tenant_filter` within `backend/app/db/session.py`.
- Run and verify the full test suite.
- Re-run the tenant isolation and migration tests to guarantee complete security compliance.

## 3. Files Created
None.

## 4. Files Modified
- [session.py](file:///f:/SMRITRretailNXmgrt/backend/app/db/session.py)

## 5. Architecture Decisions
Evaluate query filtering values outside SQL-generating lambda expressions to support SQLAlchemy query compilation caching.

## 6. Design Rationale
SQLAlchemy 2.0 compiles and caches execution statements. When using `with_loader_criteria`, passing complex request-scoped context objects (`ctx`) inside the lambda causes cache-key generation to fail with `InvalidRequestError` since the object is not a SQL literal or cacheable element. Evaluating the string representation (`tenant_id`) outside the lambda allows it to be correctly tracked as a SQL literal bound value.

## 7. Implementation Summary
Updated `apply_tenant_filter` in `backend/app/db/session.py` to extract `tenant_id` context into a local variable before passing it into `with_loader_criteria`.

## 8. Tests Executed
```bash
python -m pytest app/tests/test_api_v1_migration.py -k test_setup_creates_tenant_assigned_user_and_resolves_tenant_context
python -m pytest
```

## 9. Verification Results
- `test_setup_creates_tenant_assigned_user_and_resolves_tenant_context` successfully passed.
- All 206 backend tests completed successfully (206 passed, 845 warnings in 343s).

## 10. Known Limitations
None.

## 11. Future Work
None.

## 12. Related ADRs
None.

## 13. Related RFCs
None.
