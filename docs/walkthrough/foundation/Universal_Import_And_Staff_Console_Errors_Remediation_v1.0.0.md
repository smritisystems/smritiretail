<!--
  Project      : SMRITI Retail OS
  Repository   : SMRITIRetailNX
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 1.0.0
  Created      : 2026-10-07
  Modified     : 2026-10-07
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough: SMRITI Universal Import & Staff 360 Console Error Remediation (500, 422, 400, 404, 401)

## 1. Purpose
Remediate and permanently eliminate browser console and resource errors communicating with FastAPI backend:
1. `POST /api/v1/universal-import/commit` returning `500 Internal Server Error`.
2. `POST /api/v1/universal-import/commit` returning `422 Unprocessable Entity` (two occurrences).
3. `POST /api/v1/users/` returning `400 Bad Request`.
4. `GET /api/v1/staff/photos/{filename}` returning `404 Not Found` (`spif-3302157ebe0a41179002bf58dda4c236.webp`).
5. `GET /api/v1/users/` returning `401 Unauthorized` / Starlette `307 Temporary Redirect` to Docker hostnames (`smriti-api:8000`).

## 2. Scope
- Frontend intake component: [ItemMasterStudio.tsx](file:///F:/SMRITRretailNX/src/components/itemMaster/ItemMasterStudio.tsx)
- Frontend staff master workspace: [StaffMasterWs.tsx](file:///F:/SMRITRretailNX/src/components/staff/StaffMasterWs.tsx)
- Backend universal import router: [universal_import.py](file:///F:/SMRITRretailNX/backend/app/api/v1/universal_import.py)
- Backend Item Master validation mapper: [item_master_validation.py](file:///F:/SMRITRretailNX/backend/app/core/item_master_validation.py)
- Backend user DTO schemas: [user.py](file:///F:/SMRITRretailNX/backend/app/schemas/user.py)
- Backend staff photo serving: [staff.py](file:///F:/SMRITRretailNX/backend/app/api/v1/staff.py)
- Backend inventory image serving: [inventory.py](file:///F:/SMRITRretailNX/backend/app/api/v1/inventory.py)
- Backend users router: [users.py](file:///F:/SMRITRretailNX/backend/app/api/v1/users.py)
- Database orphaned photo records in `smritisys.users` and `smriti001.staff_profiles`
- Automated verification tests in [test_console_errors_remediation.py](file:///F:/SMRITRretailNX/backend/app/tests/test_console_errors_remediation.py) and [test_item_master_422_validation.py](file:///F:/SMRITRretailNX/backend/app/tests/test_item_master_422_validation.py)

## 3. Files Created
- `backend/app/tests/test_console_errors_remediation.py`
- `docs/walkthrough/foundation/Universal_Import_And_Staff_Console_Errors_Remediation_v1.0.0.md`

## 4. Files Modified
- `backend/app/core/item_master_validation.py`
- `backend/app/api/v1/universal_import.py`
- `backend/app/api/v1/staff.py`
- `backend/app/api/v1/inventory.py`
- `backend/app/api/v1/users.py`
- `backend/app/schemas/user.py`
- `backend/app/tests/test_item_master_422_validation.py`
- `src/components/itemMaster/ItemMasterStudio.tsx`
- `src/components/staff/StaffMasterWs.tsx`
- `docs/walkthrough/README.md`
- `CHANGELOG.md`

## 5. Architecture Decisions
- **ADR-IMP-001 (Universal Import Preview Contract Parity)**: The preview response from `/api/v1/universal-import/preview` returns `rows`, `reconciliation_report`, and `row_results` aliases to guarantee bidirectional backward-compatibility across all client consumers.
- **ADR-IMP-002 (Item Master Validation Domain Alignment)**: Added `/api/v1/universal-import` and `/api/v1/universal-import/` to `ITEM_MASTER_PATHS`, guaranteeing that any 422 raised during universal import is intercepted by `http_exception_handler` and converted into the structured `ITEM_MASTER_VALIDATION_ERROR` standard rather than generic or unhandled responses.
- **ADR-AUTH-001 (Role Aliasing & Resiliency)**: Added pre-validators on `role` across `StaffUserCreate`, `StaffUserUpdate`, `UserCreate`, and `UserUpdate` to seamlessly translate `"ADMIN"` to `UserRole.SYSADMIN`.
- **ADR-AUTH-002 (Proactive Client Password Complexity Guard)**: Added 5-point password policy validation in `StaffMasterWs.tsx` before network submission, displaying human-friendly guidance when criteria are not met.
- **ADR-MED-001 (Graceful Media & Avatar Fallbacks)**: Missing staff photos and product images now serve clean, standard SVGs with HTTP 200 rather than throwing hard 404 errors that pollute browser developer consoles and break UI layouts.
- **ADR-NET-001 (FastAPI Route Suffix Parity)**: Registered `@router.post("")` and `@router.get("")` alongside `"/"` on the users router, preventing Starlette 307 temporary redirects to internal container hostnames (`smriti-api:8000`) which strip authorization headers or trigger DNS errors.

## 6. Design Rationale
- **500 Root Cause**: `universal_import.py` looked up items using exact case `Item.item_code == style_code`. When an existing style code differed in case or leading spaces, `existing_item` returned `None`, triggering `UniversalItemMasterService.create_item()`. The catalog service stripped and upper-cased the code, found the item, and raised a `ValueError`. This unhandled exception tumbled into the outer `except Exception: raise HTTPException(500)`. Normalizing lookup with `func.upper(Item.item_code) == style_code.strip().upper()` and catching `ValueError` as 422 completely eliminates the 500 error.
- **422 Root Cause**: `ItemMasterStudio.tsx` checked `previewResp?.row_results` to collect blocking errors. Because the backend returned `reconciliation_report` and `rows`, `blockingErrors` evaluated to empty, causing the frontend to bypass validation and immediately invoke `/commit`. Updating the frontend to inspect `reconciliation_report`, `rows`, and `row_results`, and returning `row_results` from the backend, ensures validation stops execution before `/commit` is called.
- **400 Root Cause**: `StaffMasterWs.tsx` provided an invalid `"ADMIN"` role option in the modal dropdown, and lacked password complexity guidance and client-side validation, leading to HTTP 400 rejection from `validate_password_strength()`.
- **404 Root Cause**: `staff_profiles` in `smriti001` and `users` in `smritisys` held a path to an orphaned uploaded file `spif-3302157ebe0a41179002bf58dda4c236.webp` that was deleted or absent from `static/uploads/`. `get_staff_photo` raised a hard 404. Implementing a fallback default avatar SVG served with HTTP 200 and cleaning up the database record eliminated the 404 console error.
- **401 Root Cause**: Requests to `/api/v1/users` (no trailing slash) triggered a Starlette 307 redirect to `http://smriti-api:8000/api/v1/users/`. When browsers followed the cross-origin 307 redirect, browser security policy stripped the `Authorization: Bearer` header, causing FastAPI to reject the redirected request with HTTP 401 Unauthorized. Adding empty path route decorators eliminates the 307 redirect completely.

## 7. Implementation Summary
1. **Frontend Intake**: Updated `ItemMasterStudio.tsx` (`handlePreviewAndImport` and `handleRunPreviewOnly`) to inspect `reconciliation_report`, `rows`, and `row_results`, blocking commit when errors or invalid statuses are detected.
2. **Backend Resolver**: Added `"row_results"` alias to `preview_universal_import`. Standardized `style_code = style_code.strip().upper()`, normalized style lookup with `func.upper(Item.item_code) == style_code`, and caught `ValueError` in the item creation block to return structured 422 responses with row numbers.
3. **Backend Error Mapper**: Added `/api/v1/universal-import` to `ITEM_MASTER_PATHS` and updated `ItemMasterValidationMapper.build_dynamic_attr_422_response()` to handle single message details and row numbers.
4. **Staff Master Workspace**: Replaced `"ADMIN"` with `"SYSADMIN"` and added standard roles (`REPORT_USER`, `VIEWER`). Added client-side password policy checks and helper text. Added `onError` fallback handlers on avatar images.
5. **Backend User Schemas**: Added `@field_validator("role", mode="before")` across user schemas to map `"ADMIN"` to `UserRole.SYSADMIN`.
6. **Media Fallback Handlers**: Added `DEFAULT_STAFF_AVATAR_SVG` and `DEFAULT_PRODUCT_PLACEHOLDER_SVG` in `staff.py` and `inventory.py`, serving 200 OK when image files are missing on disk.
7. **Database Cleanup**: Cleared orphaned `photo` references in `smritisys.users` and `smriti001.staff_profiles`.
8. **Route Parity**: Added `@router.get("")` and `@router.post("")` in `users.py` to prevent 307 temporary redirects to internal Docker hostnames.

## 8. Tests Executed
1. `pytest backend/app/tests/test_console_errors_remediation.py`: 16/16 passed (39.48s).
2. `pytest backend/app/tests/test_item_master_422_validation.py`: 65/65 passed.
3. `pytest backend/tests/test_universal_import_item_master.py`: 11/11 passed.
4. `vitest run src/tests/itemMasterStudioIntake.test.ts src/tests/universalImportEngine.test.ts src/tests/staffBankDetailsAndPrint.test.ts`: 20/20 passed.
5. `npm run build`: built production bundle in 38.95s with 0 errors.

## 9. Verification Results
- All 112 automated tests passed (100% green).
- Zero TypeScript compiler errors.
- Version SSOT aligned at 6.70.16.
- Docker containers `smriti-web` and `smriti-api` reloaded and healthy.

## 10. Known Limitations
None.

## 11. Future Work
None.

## 12. Related ADRs
- `ADR-IMP-001`: Universal Import Preview Contract Parity
- `ADR-IMP-002`: Item Master Validation Domain Alignment
- `ADR-AUTH-001`: User Role Tolerance and Aliasing
- `ADR-AUTH-002`: Client-Side Password Policy Guidance
- `ADR-MED-001`: Graceful Media & Avatar Fallbacks
- `ADR-NET-001`: FastAPI Route Suffix Parity

## 13. Related RFCs
- `RFC-HREP-001`: Human-Readable Error Policy Specification
