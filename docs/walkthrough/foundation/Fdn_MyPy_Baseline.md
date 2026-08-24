<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.16.0
  Created      : 2026-07-12
  Modified     : 2026-07-12
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Foundation Walkthrough — MyPy Baseline & Soft-Delete Bug Fix v3.16.0

## 1. Purpose
To resolve a critical runtime bug where product soft-deletion crashed the system due to a missing attribute check on `TenantContext`, type-safely bound generic repositories to `BaseEntity`, and establish an automated type safety check via `mypy-baseline` to ignore legacy type issues in CI/CD pipeline runs.

## 2. Scope
* Corrected the `/api/v1/products/{product_id}` DELETE endpoint to correctly source current user identity via `Depends(require_role(...))`.
* Added integration/regression tests verifying successful soft-deletion and role access validation.
* Bound generic repository TypeVar parameter to `BaseEntity` to resolve typing errors on common fields.
* Initialized `mypy-baseline.txt` capturing 98 pre-existing warnings.
* Upgraded `.github/workflows/ci.yml` and `backend/pyproject.toml` to enforce baseline checks.

## 3. Files Created
* `backend/app/tests/test_inventory.py` — Product soft-delete regression tests.
* `backend/mypy-baseline.txt` — Snapshot of legacy typing warnings.

## 4. Files Modified
* `backend/app/api/v1/inventory.py` — Soft-delete endpoint dependency update.
* `backend/app/repositories/base.py` — Bound generic parameter.
* `backend/app/dev_tracker/scanner.py` — Suppressed type check warning.
* `backend/app/tests/conftest.py` — Suppressed `sessionmaker` async warning.
* `backend/dev.txt` — Added `mypy-baseline`.
* `backend/pyproject.toml` — Added mypy config and baseline path.
* `.github/workflows/ci.yml` — Added type check step.

## 5. Architecture Decisions
* Sourced active user identity using standard FastAPI dependency injection (`Depends(require_role(...))`) instead of extending `TenantContext` dataclass with user fields (since users are not scoped to a single tenant/branch in the multi-tenant architecture).

## 6. Design Rationale
* Bounding `ModelType` to `BaseEntity` guarantees that common properties (`id`, `is_deleted`, `deleted_at`, `deleted_by`, etc.) are checked and safe at compile time.
* `mypy-baseline` enables strict typing checks on all newly added/modified code paths while preventing legacy code from breaking CI builds.

## 7. Implementation Summary
* Updated delete product API logic.
* Added type annotations and code suppressions for false positive cases.
* Synced baseline for 98 errors using `mypy-baseline sync`.

## 8. Tests Executed
* Tested `delete_product` soft delete via `pytest`.
* Checked full backend test suite containing 91 items.
* Executed MyPy check utilizing the filter option.

## 9. Verification Results
* **Test Results:** 91/91 tests passed successfully.
* **Linter Results:** Ruff check completed with 0 errors on modified files.
* **MyPy baseline verification:** Checked 118 source files, 0 new errors reported.

## 10. Known Limitations
* Legacy models still use `Column()` declarative styling instead of `Mapped[]`, causing 98 baselined typing errors.

## 11. Future Work
* Transition backend database models to SQLAlchemy 2.0 type-safe `Mapped[]` declarative mapping.

## 12. Related ADRs
* None

## 13. Related RFCs
* None
