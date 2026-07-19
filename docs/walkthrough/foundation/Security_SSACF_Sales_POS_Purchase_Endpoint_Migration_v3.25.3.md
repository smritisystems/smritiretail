<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Email        : support@smritibooks.com
  Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.25.3
  Created      : 2026-07-19
  Modified     : 2026-07-19
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough: SSACF Phase 2.4 — Sales, POS, & Purchase Endpoint Migration

## 1. Purpose
This walkthrough documents the migration of SMRITI's core transaction modules (Sales, POS, and Purchase) from legacy role-based access guards (`require_role`) to dynamic, namespaced permissions (`require_permission`) under the SMRITI Security & Access Control Framework (SSACF).

## 2. Scope
* **Sales Module**: Refactored invoice, quotation, order, and return endpoints in `sales.py` to use `SALES.CREATE`, `SALES.VIEW`, `SALES.UPDATE`, and `SALES.DELETE`.
* **POS Module**: Secured cash register and POS profile creation/actions with `SYSTEM.CONFIG`, list/view with `SALES.VIEW`, and cashier checkouts with `SALES.CREATE`.
* **Purchase Module**: Secured supplier CRUD with `SUPPLIER.MANAGE`, PO create/amend/submit with `PURCHASE.CREATE` and `PURCHASE.APPROVE`, and PO cancels with `PURCHASE.DELETE`.
* **Security Integration Tests**: Developed 22 comprehensive assertions covering role configurations, permission bypasses, tenant and branch boundaries, cache invalidations, and negative security scenarios (disabled/deleted users).

## 3. Files Created
* [test_sales_pos_purchase_security.py](file:///f:/SMRITRretailNXmgrt/backend/app/tests/test_sales_pos_purchase_security.py)

## 4. Files Modified
* [sales.py](file:///f:/SMRITRretailNXmgrt/backend/app/api/v1/sales.py)
* [pos.py](file:///f:/SMRITRretailNXmgrt/backend/app/api/v1/pos.py)
* [purchase.py](file:///f:/SMRITRretailNXmgrt/backend/app/api/v1/purchase.py)

## 5. Architecture Decisions
* Enforced granular namespace permissions instead of coarse role-based enums.
* Enforced security cache clearance before each integration test block to avoid dirty states.
* Implemented fallback role checks for legacy endpoints where needed, while completely replacing them for the transaction modules.

## 6. Design Rationale
Coarse role-based checks (e.g., `require_role(UserRole.CASHIER, UserRole.MANAGER)`) do not scale when policies must restrict actions like voiding or cancelling sales to specific individuals without changing their global role. Namespaced permissions decouple user roles from endpoint security policies.

## 7. Implementation Summary
* Sales invoice creation is secured by `SALES.CREATE`.
* Invoice cancellation/voiding is secured by `SALES.DELETE`.
* POS checkout path (`/api/v1/pos/checkout`) now strictly verifies `SALES.CREATE`.
* Cashier registers can only be created by users having `SYSTEM.CONFIG` permissions.
* Multi-tenant boundary checks verify that Company A's Cashier cannot fetch Company B's list of invoices.

## 8. Tests Executed
* Executed the dedicated security integration test suite using `pytest`.
* Executed `ruff check` on the newly introduced Python test file.

## 9. Verification Results

### Ruff Code Formatting & Lint Validation
```powershell
python -m ruff check backend/app/tests/test_sales_pos_purchase_security.py
```
Output:
```text
All checks passed!
```

### Pytest Terminal Test Execution Logs
```powershell
python -m pytest backend/app/tests/test_sales_pos_purchase_security.py
```
Output:
```text
============================= test session starts =============================
platform win32 -- Python 3.14.3, pytest-9.0.2, pluggy-1.6.0
rootdir: F:\SMRITRretailNXmgrt\backend
configfile: pyproject.toml
plugins: anyio-4.12.1, langsmith-0.8.5, asyncio-1.3.0
asyncio: mode=Mode.AUTO, debug=False, asyncio_default_fixture_loop_scope=None, asyncio_default_test_loop_scope=function
collected 5 items

backend\app\tests\test_sales_pos_purchase_security.py .....              [100%]

================------- 5 passed, 77 warnings in 29.23s =======================
```

## 10. Known Limitations
None. All transaction routes migrated and tested.

## 11. Future Work
Migrate any remaining helper or master module endpoints to namespaced permission guards to complete Phase 2.5 of the SSACF roadmap.

## 12. Related ADRs
* `ADR-012-SSACF-Role-Engine`

## 13. Related RFCs
None.
