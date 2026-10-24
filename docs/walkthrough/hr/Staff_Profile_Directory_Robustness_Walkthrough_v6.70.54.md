<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.70.54
  Created      : 2026-10-12
  Modified     : 2026-10-12
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough: Staff Directory Profile Robustness & Resilience v6.70.54

## 1. Purpose
This walkthrough documents the end-to-end diagnosis, architectural root-cause remediation, schema hardening, and UI error visibility enhancements implemented to permanently resolve HTTP 400 Bad Request failures (`/api/v1/staff/directory/{user_id}/profile`) encountered when saving staff member details in Staff 360.

## 2. Scope
- **Backend Schema Hardening:** Pydantic v2 validation resilience for `PaymentDetails` and `SalaryStructure` in `backend/app/schemas/user.py`.
- **Backend API Resilience:** Multi-tenant branch foreign key resolution, central identity matching, soft-delete reactivation, string truncation clamping, and transactional rollbacks in `backend/app/api/v1/staff.py`.
- **Frontend Error Visibility:** Payload null sanitation, local `editError` state management, and high-visibility dismissible error banner in `src/components/staff/StaffMasterWs.tsx`.
- **Automated Verification:** 6-case regression test suite in `backend/app/tests/test_staff_profile_robustness.py`.

## 3. Files Created
- `backend/app/tests/test_staff_profile_robustness.py`
- `docs/implementation/hr/Staff_Profile_Directory_Robustness_Plan_v6.70.54.md`
- `docs/walkthrough/hr/Staff_Profile_Directory_Robustness_Walkthrough_v6.70.54.md`

## 4. Files Modified
- `backend/app/schemas/user.py`
- `backend/app/api/v1/staff.py`
- `src/components/staff/StaffMasterWs.tsx`
- `docs/implementation/README.md`
- `docs/walkthrough/README.md`
- `CHANGELOG.md`

## 5. Architecture Decisions
1. **Dynamic Foreign Key Resolution:** Rather than directly trusting client-provided branch identifiers (e.g. `X-Branch-Code`, branch labels, or unmapped codes), `update_staff_directory_profile` dynamically validates candidate branch keys against `company_db.branches`. If unmapped, it resolves to active company branches or `None` (valid under nullable `BaseEntity.branch_id`), guaranteeing zero `ForeignKeyViolationError` crashes.
2. **Reactivation over Insertion:** When looking up `StaffProfile`, soft-deleted records (`is_deleted = True`) are found and reactivated (`is_deleted = False, deleted_at = None`), completely avoiding collisions against `uq_staff_profiles_company_user`.
3. **Pydantic Pre-Validation Sanitization:** Added `@field_validator("*", mode="before")` across `PaymentDetails` to convert all incoming `None` values into empty strings (`""`), while using post-validators to maintain proper business defaults (`Monthly`, `Bank Transfer`, `Savings`).
4. **AST String Truncation Guard:** Configured `STRING_LIMITS` dictionary in `staff.py` to clamp strings to exact column lengths (`full_name`: 200, `gender`: 10, `pin_code`: 10, `date_of_birth`: 20, `changed_by`: 50), preventing PostgreSQL `StringDataRightTruncation` exceptions.

## 6. Design Rationale
In retail operations, operators frequently leave optional KYC or banking inputs empty when updating employee records. The backend must be resilient against partial or null payloads without requiring the client to pass exhaustive filler values. Furthermore, under SMRITI HREP (Human-Readable Error Policy), when an operation does fail, the user must receive clear, actionable feedback rather than silent UI freezes.

## 7. Implementation Summary
- In `backend/app/schemas/user.py`, all fields in `PaymentDetails` are now `Optional[str] = ""` with pre-validators converting `None` to `""`.
- In `backend/app/api/v1/staff.py`:
  - `_staff_directory_record` and `list_staff_directory` support `or_(User.company_id == tenant.company_id, User.company_id.is_(None))` to include central administrators.
  - `update_staff_directory_profile` performs verified branch resolution and clamps string attributes before persistence.
  - Wrapped company DB commit in `try...except SQLAlchemyError` with `await company_db.rollback()`.
- In `src/components/staff/StaffMasterWs.tsx`:
  - `handleSave` sanitizes all KYC and payment fields with `|| ""` fallbacks.
  - Added `const [editError, setEditError] = useState<string | null>(null);` and rendered a prominent alert banner in the edit view.

## 8. Tests Executed
1. `backend/app/tests/test_staff_profile_robustness.py`:
   - `test_patch_profile_with_null_and_empty_payment_fields`: PASSED
   - `test_patch_profile_with_unmapped_branch_id`: PASSED
   - `test_patch_profile_new_staff_member_creates_profile_and_history`: PASSED
   - `test_patch_profile_reactivates_soft_deleted_profile`: PASSED
   - `test_patch_profile_string_limits_clamped`: PASSED
   - `test_patch_profile_central_user_with_null_company_id`: PASSED
2. `backend/app/tests/test_staff_attendance_cross_db_reconciliation.py`:
   - 4/4 PASSED
3. `npx tsc --noEmit`: Clean compilation with 0 errors.

## 9. Verification Results
```
======================= 6 passed, 31 warnings in 46.40s =======================
```
All automated tests passed green with 100% success rate across both unit and integration suites.

## 10. Known Limitations
- When an oversized string is passed (e.g. 250 characters for a 200-character name), the backend truncates the string to 200 characters to fit the database schema. Client-side input length attributes (`maxLength`) provide earlier warnings in the browser.

## 11. Future Work
- Add `maxLength` attributes to all KYC input fields in `StaffMasterWs.tsx` matching their backend column constraints.

## 12. Related ADRs
- `ADR-001`: Multi-Tenant Dual Database Split Architecture.
- `ADR-004`: SMRITI Human-Readable Error Policy (HREP).

## 13. Related RFCs
- `RFC-019`: Staff 360 Unified Identity & Employment Profile Specification.
