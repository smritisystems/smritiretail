<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.25.2
  Created      : 2026-07-19
  Modified     : 2026-07-19
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough: SSACF Phase 2.3 — CRM & Inventory Endpoint Migration

Migrate all endpoint authorization guards inside CRM, Inventory, Barcode Studio, and Product Attributes modules to granular namespaced permissions, resolve HTTP exception formatting conflicts in the core error handler, and verify execution with integration tests.

## 1. Purpose
Migrate the remaining first-party core business modules (CRM and Inventory) from legacy role-based constraints (`require_role`) to granular, dynamic permission guards (`require_permission`). Additionally, standardise error payload handling for HTTPExceptions carrying dictionary detail definitions to satisfy the SMRITI Human-Readable Error Policy (HREP) and prevent crash regressions.

## 2. Scope
* Migrate [crm.py](file:///f:/SMRITRretailNXmgrt/backend/app/api/v1/crm.py) endpoints to `require_permission("CRM.MANAGE_CUSTOMERS")`.
* Migrate [inventory.py](file:///f:/SMRITRretailNXmgrt/backend/app/api/v1/inventory.py) endpoints to namespaced permission codes `ITEM.CREATE`, `ITEM.UPDATE`, and `ITEM.DELETE`.
* Migrate [barcode.py](file:///f:/SMRITRretailNXmgrt/backend/app/api/v1/barcode.py) endpoints to `ITEM.UPDATE` (for layout management) and `SYSTEM.CONFIG` (for printer configurations).
* Migrate [attributes.py](file:///f:/SMRITRretailNXmgrt/backend/app/api/v1/attributes.py) endpoints to `ITEM.CREATE` and `ITEM.UPDATE`.
* Refactor `http_exception_handler` in [error_handlers.py](file:///f:/SMRITRretailNXmgrt/backend/app/core/error_handlers.py) to resolve `AttributeError: 'dict' object has no attribute 'lower'` when processing dictionary payload details.
* Deliver comprehensive integration test suite coverage verifying permission checks, authorization exclusions, and `SYSADMIN` (SUPER) bypass execution.

## 3. Files Created
* [test_crm_inventory_security.py](file:///f:/SMRITRretailNXmgrt/backend/app/tests/test_crm_inventory_security.py) - Dynamic permission-based authorization tests covering crm, inventory, and variant attributes endpoints under cashiers, clerks, and system admins.

## 4. Files Modified
* [crm.py](file:///f:/SMRITRretailNXmgrt/backend/app/api/v1/crm.py) - Migrated 5 endpoints from `require_role` to `require_permission("CRM.MANAGE_CUSTOMERS")`.
* [inventory.py](file:///f:/SMRITRretailNXmgrt/backend/app/api/v1/inventory.py) - Migrated creation, update, deletion, secondary barcodes, images, and gallery management endpoints to `ITEM.CREATE`, `ITEM.UPDATE`, and `ITEM.DELETE`.
* [barcode.py](file:///f:/SMRITRretailNXmgrt/backend/app/api/v1/barcode.py) - Migrated layout endpoints to `ITEM.UPDATE` and printer settings to `SYSTEM.CONFIG`.
* [attributes.py](file:///f:/SMRITRretailNXmgrt/backend/app/api/v1/attributes.py) - Migrated definitions, templates, groups, and template loading endpoints to namespaced item permissions.
* [error_handlers.py](file:///f:/SMRITRretailNXmgrt/backend/app/core/error_handlers.py) - Added dictionary extraction support to `http_exception_handler` to properly format structured exception responses.

## 5. Architecture Decisions
* **Polymorphic Exception Handlers:** Standardize parsing of Starlette's `HTTPException` detail payloads in the global HTTP handler. When an exception detail is passed as a dictionary containing structured fields (`title`, `explanation`, `suggested_action`, `reference_id`), extract and translate these fields before invoking HREP text filtering.
* **Separation of Duties:** Centrally enforce authorization inside the SSACF engine dependencies, ensuring business services are agnostic to specific security mechanisms.

## 6. Design Rationale
* **Resiliency of Custom Dict Details:** Business-friendly permission warnings require granular fields for titles, actions, and codes. Resolving the dictionary type check directly within `error_handlers.py` preserves maximum compatibility with standard FastAPI payloads and avoids schema validation bottlenecks.
* **Database Isolation in Tests:** Generate unique IDs, barcodes, and values during test execution to prevent primary key and unique constraint conflicts.

## 7. Implementation Summary
* Migrated authorization logic across all CRM and Inventory endpoints to use the dynamic `require_permission` dependency.
* Updated standard response serialization for permission warnings, ensuring compliant JSON payloads.
* Refactored global exception handlers to clean, process, and return structured error objects.

## 8. Tests Executed
Executed the CRM and Inventory security integration suite:
```powershell
python -m pytest backend/app/tests/test_crm_inventory_security.py
```

## 9. Verification Results
```text
============================= test session starts =============================
platform win32 -- Python 3.14.3, pytest-9.0.2, pluggy-1.6.0
rootdir: F:\SMRITRretailNXmgrt\backend
configfile: pyproject.toml
plugins: anyio-4.12.1, langsmith-0.8.5, asyncio-1.3.0
asyncio: mode=Mode.AUTO, debug=False, asyncio_default_fixture_loop_scope=None, asyncio_default_test_loop_scope=function
collected 2 items

backend\app\tests\test_crm_inventory_security.py ..                      [100%]

======================= 2 passed, 39 warnings in 15.59s =======================
```

## 10. Known Limitations
* Remaining POS Sales and Checkout endpoints will be migrated in Phase 2.4.

## 11. Future Work
* Phase 2.4: Integrate user interface navigation filtering and frontend components using security context hooks.

## 12. Related ADRs
* `ADR-012-SSACF-Role-Engine`

## 13. Related RFCs
* `RFC-024-Granular-Permission-Catalog`
