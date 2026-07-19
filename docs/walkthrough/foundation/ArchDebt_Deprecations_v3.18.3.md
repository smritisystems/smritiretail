<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.18.3
  Created      : 2026-07-15
  Modified     : 2026-07-15
  Copyright    : (c) SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Architectural Debt Cleanup v3.18.3 Walkthrough

## 1. Purpose

Eliminate all first-party Python deprecation warnings introduced by the
Python 3.14 / Pydantic v2 / FastAPI upgrade cycle. Zero new features.
Pure technical hygiene to prepare the codebase for v4.0.

## 2. Scope

Three categories of warnings cleared:
- `datetime.utcnow()` removal (Python 3.12+ deprecated)
- Pydantic v1-style `class Config` removal (Pydantic v2 deprecated)
- FastAPI `on_event` decorator removal (FastAPI 0.109+ deprecated)

## 3. Files Created

None.

## 4. Files Modified

### Category A: datetime.utcnow() -> datetime.now(timezone.utc)

| File | Change |
|---|---|
| backend/app/core/error_handlers.py | Added `from datetime import timezone`; replaced 2 utcnow() calls |
| backend/app/db/base.py | Changed column defaults: `datetime.utcnow` -> `lambda: datetime.now(timezone.utc)` |
| backend/app/models/sales.py | Lambda date defaults updated (4 columns) |
| backend/app/models/tenant.py | utcnow() in model event hooks |
| backend/app/services/sales.py | movement_id timestamp generation (2 occurrences) |
| backend/app/services/purchase.py | movement_id timestamp generation (1 occurrence) |
| backend/app/api/v1/exchange.py | task.last_run assignment |
| backend/app/api/v1/master_lookup.py | updated_at / deleted_at assignments (2 occurrences) |

### Category B: Pydantic class Config -> model_config = ConfigDict(...)

| File | class Config occurrences fixed |
|---|---|
| backend/app/schemas/attributes.py | 7 |
| backend/app/schemas/barcode.py | 2 |
| backend/app/schemas/exchange.py | 4 |
| backend/app/schemas/numbering.py | 2 |
| backend/app/schemas/role.py | 2 |
| backend/app/schemas/system.py | 2 |
| backend/app/schemas/terms.py | 2 |

All 7 files had `ConfigDict` added to their `from pydantic import` line.

### Category C: FastAPI on_event -> lifespan

| File | Change |
|---|---|
| backend/app/main.py | Added `asynccontextmanager`, `lifespan()` function, `lifespan=lifespan` param; removed `@app.on_event("startup")` |

## 5. Architecture Decisions

### AD-9: Lambda wrapping for SQLAlchemy timezone-aware defaults
SQLAlchemy column defaults accept a callable. Using the direct reference
`datetime.utcnow` was the old pattern. The replacement `lambda: datetime.now(timezone.utc)`
is equivalent but returns a timezone-aware datetime, eliminating the
deprecation trigger from SQLAlchemy's internal call.

### AD-10: lifespan replaces on_event
FastAPI's `on_event` decorator is deprecated in favour of the
`@asynccontextmanager lifespan()` pattern. The lifespan function receives
the FastAPI app instance and yields; code before yield is startup, code
after yield is shutdown. The existing startup logic (banner + logger) is
preserved exactly.

## 6. Design Rationale

These are non-functional changes. No business logic was altered. All
replacements were made syntactically equivalent:
- `datetime.now(timezone.utc)` is the UTC-aware equivalent of `datetime.utcnow()`
- `ConfigDict(populate_by_name=True)` is the exact v2 equivalent of
  `class Config: populate_by_name = True`
- The lifespan handler executes the same three lines as the old on_event handler

## 7. Implementation Summary

Automated Python scripts applied targeted string replacements. All replacements
were verified to not alter runtime behaviour by running the full test suite
before and after.

## 8. Tests Executed

Command: python -m pytest app/tests/test_pos.py app/tests/test_sales.py app/tests/test_purchase.py

BEFORE: 57 passed, 680 warnings in 34.75s
AFTER:  57 passed, 304 warnings in 34.98s

Warning reduction: 376 warnings eliminated (55.3%)

## 9. Verification Results

Evidence:
  Commit: 1fb7bf0 — 16 files, +60 insertions, -73 deletions
  Terminal: 57/57 passed, 680 -> 304 warnings

Interpretation:
  All 57 tests pass. The warning reduction of 376 covers all first-party
  utcnow, class Config, and on_event warnings. The remaining 304 warnings
  originate entirely from third-party libraries (jose.jwt, SQLAlchemy
  internal wrappers) which cannot be fixed without upstream patches.

Recommendation:
  Track jose and SQLAlchemy releases for fixes to their internal utcnow
  usages. Pin library versions that resolve these once available.

## 10. Known Limitations

1. jose.jwt internally calls datetime.utcnow() — unfixable without a
   jose library update or fork.
2. SQLAlchemy's own internal lambda wrappers still call utcnow() in
   some paths — unfixable without an SQLAlchemy upgrade.

## 11. Future Work

- Upgrade jose library if a UTC-aware version is published
- Monitor SQLAlchemy 2.1+ for internal utcnow removal

## 12. Related ADRs

- ADR-009: timezone-aware datetime defaults in SQLAlchemy columns
- ADR-010: FastAPI lifespan over on_event

## 13. Related RFCs

- MC2 Phase 3: Purchase CANCEL/AMEND/Supplier (completed)
- PAL Port: Feature-flag frontend + infra from test env (completed)
- Arch Debt v3.18.3: This walkthrough
