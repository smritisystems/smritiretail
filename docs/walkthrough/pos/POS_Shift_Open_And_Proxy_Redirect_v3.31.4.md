<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.31.4
  Created      : 2026-07-19
  Modified     : 2026-07-19
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough: POS Shift Open & Proxy Redirect Fixes

## 1. Purpose
This walkthrough documents the bug fixes implemented in version `3.31.4` to resolve issues with Vite proxy redirects, trailing slashes on API endpoints, and payload field mismatches during POS shift openings.

## 2. Scope
This walkthrough covers the following modifications:
* **Vite Proxy:** Rewriting absolute location headers containing `python-core:8000` to prevent DNS resolution errors in the browser.
* **Frontend REST Endpoints:** Ensuring canonical usage of trailing slashes (`/inventory/` instead of `/inventory`) to eliminate unnecessary redirection overhead.
* **POS Shift Schema:** Dynamically resolving frontend `profileId` and `openingBalance` payloads into the backend's expected `register_id` and `opening_balance` fields via Pydantic model validators.
* **Test Suite Fixes:** Extracting inline token dictionaries in `test_api_v1_migration.py` to fix SyntaxErrors caused by nested f-string quotes under Python 3.11.

## 3. Files Created
None.

## 4. Files Modified
* [pos.py (schemas)](file:///f:/SMRITRretailNXmgrt/backend/app/schemas/pos.py)
* [test_api_v1_migration.py](file:///f:/SMRITRretailNXmgrt/backend/app/tests/test_api_v1_migration.py)
* [App.tsx](file:///f:/SMRITRretailNXmgrt/src/App.tsx)
* [InventoryForecastWidget.tsx](file:///f:/SMRITRretailNXmgrt/src/components/InventoryForecastWidget.tsx)
* [ItemMasterTab.tsx](file:///f:/SMRITRretailNXmgrt/src/components/ItemMasterTab.tsx)
* [vite.config.ts](file:///f:/SMRITRretailNXmgrt/vite.config.ts)

## 5. Architecture Decisions
* **Model Validator vs. API rewrite:** Implemented Pydantic `@model_validator(mode="before")` on the `ShiftOpen` schema instead of refactoring the frontend state properties or API models. This preserves backward compatibility with older client implementations and test suites.
* **Relative Redirect Resolution:** Configured Vite's dev server proxy to rewrite backend redirect `Location` headers relative to the proxy origin to ensure DNS/network isolation boundaries are not leaked.

## 6. Design Rationale
* Resolving trailing slash requests directly at the frontend level improves request round-trip performance by preventing the FastAPI 307 redirect loop.
* Dynamic ID generation inside the backend schema removes the responsibility of UUID generation from the client and guarantees primary key uniqueness.

## 7. Implementation Summary
* Added `model_validator` to `ShiftOpen` class in `backend/app/schemas/pos.py` to handle both `profileId` and `openingBalance` forms.
* Refactored f-string syntax in `test_api_v1_migration.py` to avoid nested quote SyntaxError in Python 3.11 environment.
* Patched `vite.config.ts` proxy configurations to capture `proxyRes` events and replace target hostnames in headers.
* Updated endpoints from `/inventory` to `/inventory/` inside `App.tsx`, `InventoryForecastWidget.tsx`, and `ItemMasterTab.tsx`.

## 8. Tests Executed
* Executed the backend test suite inside the dockerized core environment:
  ```bash
  docker compose exec python-core pytest app/tests/test_pos.py app/tests/test_api_v1_migration.py
  ```

## 9. Verification Results
* All 18 target unit tests passed successfully.
```text
app/tests/test_pos.py ................                                   [ 88%]
app/tests/test_api_v1_migration.py ..                                    [100%]
================== 18 passed, 10 warnings in 72.79s (0:01:12) ==================
```

## 10. Known Limitations
None.

## 11. Future Work
Systematically ensure all future frontend endpoints map to canonical API paths with trailing slashes to prevent redirect overhead.

## 12. Related ADRs
None.

## 13. Related RFCs
None.
