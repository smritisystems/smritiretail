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

# Implementation Plan: Staff Directory Profile Robustness & Resilience v6.70.54

## 1. Objective
Eliminate all HTTP 400 failure modes and silent user experience degradation encountered when editing and saving staff member profiles (`PATCH /api/v1/staff/directory/{user_id}/profile`) across the multi-tenant architecture, ensuring resilient schema deserialization, dynamic foreign-key branch resolution, soft-delete reactivation, automatic string-length clamping, and in-form human-readable error reporting.

## 2. Business Motivation
In retail store operations, personnel managers and store administrators regularly update staff records—particularly during statutory compliance verification, banking remittances, and Statutory KYC onboarding (PAN, Aadhaar, ESIC, EPFO). When an operator updates an employee's Statutory KYC in Staff 360, missing or null remuneration/bank details or branch assignment discrepancies previously triggered backend HTTP 400 errors without any in-form feedback. The operator was left clicking "Save Changes" repeatedly while the edit dialog remained stuck. Delivering bulletproof backend validation, resilient tenant database mapping, and high-visibility in-form error alerts ensures smooth retail administration and zero user frustration.

## 3. Scope
- **Backend Schema (`backend/app/schemas/user.py`):**
  - Make all string fields in `PaymentDetails` `Optional[str] = ""` with a `@field_validator("*", mode="before")` converting `None` to `""`.
  - Add default fallback validators for `frequency` ("Monthly"), `paymentMode` ("Bank Transfer"), and `accountType` ("Savings").
  - Add null/empty string sanitizer for `SalaryStructure.fixedMonthly` to safely cast to `float` (default `25000.0`).
- **Backend Route Handler (`backend/app/api/v1/staff.py`):**
  - Allow `User.company_id.is_(None)` lookup in `control_db` across `_staff_directory_record`, `list_staff_directory`, and `update_staff_directory_profile`.
  - Dynamically resolve `target_branch_id` against `company_db.branches` across `tenant.branch_id`, `payload.branch`, `"MAIN"`, `"BR-MAIN-001"`, and company branch fallbacks to strictly prevent `staff_profiles_branch_id_fkey` and `staff_profile_history_branch_id_fkey` violations.
  - Dynamically verify `target_company_id` against `company_db.companies`.
  - Query `StaffProfile` without `is_deleted == False` filter and reactivate soft-deleted profiles rather than attempting duplicate inserts that crash on `uq_staff_profiles_company_user`.
  - Enforce strict database column string length limits via `STRING_LIMITS` dictionary, clamping `user.full_name` (200), `profile.gender` (10), `profile.pin_code` (10), `profile.date_of_birth` (20), `profile.alternate_mobile` (20), `profile.employment_type` (20), and `StaffProfileHistory.changed_by` (50).
  - Wrap database commits in explicit `try...except SQLAlchemyError` with `await company_db.rollback()`.
- **Frontend Workspace (`src/components/staff/StaffMasterWs.tsx`):**
  - Sanitize payload in `handleSave` so all fields fallback to empty strings rather than `undefined`/`null`.
  - Introduce `editError` state variable and render a high-visibility, dismissible error alert banner inside the edit panel above the sub-tabs.
  - Clear `editError` on modal close, cancel, and tab transitions.
- **Automated Verification:**
  - Create dedicated regression test suite `backend/app/tests/test_staff_profile_robustness.py` covering all failure modes.

## 4. Current State
- When saving Statutory KYC in Staff 360, `selected.payment` fields that are null (or not yet configured) passed `null` to the PATCH endpoint.
- `PaymentDetails` schema required non-null strings for `bankDetails`, `upi`, `salaryEffectiveFrom`, `commissionEffectiveFrom`.
- `update_staff_directory_profile` directly bound `tenant.branch_id` to `StaffProfile.branch_id` and `StaffProfileHistory.branch_id`. If `tenant.branch_id` was unmapped in the company database, PostgreSQL threw `ForeignKeyViolationError`, which `db_exception_handler` translated into HTTP 400 (`SMRITI-DATA-001`).
- Soft-deleted profiles triggered unique constraint violations (`uq_staff_profiles_company_user`) upon profile save attempts.
- Omiting in-form error state in `StaffMasterWs.tsx` resulted in silent UI failures when saving.

## 5. Gap Analysis
| Component | Previous Behavior | Robust Target Behavior |
|---|---|---|
| `PaymentDetails` schema | Strict non-null `str` fields | Resilient `Optional[str]` with `@field_validator("*", mode="before")` mapping `None -> ""` |
| `SalaryStructure` schema | Unhandled `None` / empty string on `fixedMonthly` | Safe float conversion falling back to `25000.0` |
| `update_staff_directory_profile` | Direct `tenant.branch_id` assignment | Verifies against `company_db.branches`; falls back to active company branch or `None` |
| Soft-deleted profiles | `where(StaffProfile.is_deleted == False)` causing duplicate insert crash | Queries without `is_deleted` filter and reactivates profile cleanly |
| Column length overflows | Unclamped strings causing `StringDataRightTruncation` | Enforces `STRING_LIMITS` clamping on `profile`, `user.full_name`, and history audit fields |
| `StaffMasterWs.tsx` Save | No in-form error alert banner | Displays dismissible inline error banner with human-readable error explanation |

## 6. Architecture Impact
- **Database Boundary Parity:** Adheres strictly to the multi-tenant architecture dividing control-plane identities (`smritisys.users`) from company-local employment (`company_db.staff_profiles`).
- **Referential Integrity Defense:** Ensures foreign keys between `staff_profiles` and `branches` are always valid or null.
- **Zero Schema Migrations Required:** Utilizes existing PostgreSQL constraints, tables, and columns cleanly.

## 7. Proposed Design
1. **Schema Defense:** Auto-sanitize all payment/KYC inputs in Pydantic before route execution.
2. **Branch Foreign Key Resolver:** Validate branch ID against `company_db.branches` with fallback to `None` or active company branch.
3. **Reactivation Handler:** Check `profile.is_deleted` and un-delete if previously soft-deleted.
4. **Length Clamping:** Truncate all string attributes to their column capacities.
5. **Frontend Error Visibility:** Add `editError` state hook and JSX alert banner in `StaffMasterWs.tsx`.

## 8. Files Created
- `backend/app/tests/test_staff_profile_robustness.py`: Dedicated automated regression test suite covering all 6 resilience criteria.
- `docs/implementation/hr/Staff_Profile_Directory_Robustness_Plan_v6.70.54.md`: This implementation plan.
- `docs/walkthrough/hr/Staff_Profile_Directory_Robustness_Walkthrough_v6.70.54.md`: Walkthrough documentation.

## 9. Files Modified
- `backend/app/schemas/user.py`: Enhanced `PaymentDetails` and `SalaryStructure` validation.
- `backend/app/api/v1/staff.py`: Resilient branch resolution, soft-delete reactivation, string clamping, and rollback handling.
- `src/components/staff/StaffMasterWs.tsx`: Payload sanitization, `editError` state hook, and in-form error alert banner.
- `docs/implementation/README.md`: Master index update.
- `docs/walkthrough/README.md`: Master walkthrough index update.
- `CHANGELOG.md`: Engineering release notes update.

## 10. Dependencies
- FastAPI 0.111+
- Pydantic v2
- SQLAlchemy 2.0 Async
- React 18 + Lucide Icons

## 11. Risks
- *Risk:* Truncating oversized fields could lose text if operators paste novel-length notes into short inputs.
  *Mitigation:* Applied limits match actual database column sizes (e.g. 500 chars for address, 200 for full_name, 100 for designation).

## 12. Rollback Strategy
- Changes are fully backwards-compatible code adjustments. Rollback is a standard `git revert`.

## 13. Verification Plan
- Run automated unit and integration tests via pytest.
- Verify TypeScript compilation via `tsc --noEmit`.
- Verify database constraint handling across edge cases.

## 14. Test Plan
- `test_patch_profile_with_null_and_empty_payment_fields`: Assert 200 OK with sanitized defaults.
- `test_patch_profile_with_unmapped_branch_id`: Assert 200 OK without FK violation.
- `test_patch_profile_new_staff_member_creates_profile_and_history`: Assert 200 OK and DB creation.
- `test_patch_profile_reactivates_soft_deleted_profile`: Assert 200 OK without unique constraint error.
- `test_patch_profile_string_limits_clamped`: Assert 200 OK with clamped column strings.
- `test_patch_profile_central_user_with_null_company_id`: Assert 200 OK for central identities.

## 15. Documentation Impact
- Update `docs/implementation/README.md`.
- Create `docs/walkthrough/hr/Staff_Profile_Directory_Robustness_Walkthrough_v6.70.54.md`.
- Update `docs/walkthrough/README.md`.
- Update `CHANGELOG.md`.

## 16. Deployment Plan
- Code committed to `smritiNX` branch and pulled to staging/production. No database migrations required.

## 17. Status
Completed

## 18. Related ADRs
- `ADR-001`: Multi-Tenant Dual Database Split Architecture (`smritisys` control plane vs `smritiXXX` tenant store).
- `ADR-004`: SMRITI Human-Readable Error Policy (HREP) and Error Dictionary Catalog.

## 19. Related Walkthroughs
- `docs/walkthrough/hr/Staff_Profile_Directory_Robustness_Walkthrough_v6.70.54.md`
- `docs/walkthrough/hr/Cross_Database_Staff_Identity_And_Attendance_Reconciliation_Walkthrough_v6.70.45.md`
