<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 1.4.0
  Created      : 2026-10-15
  Modified     : 2026-10-15
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough: SMRITI Retail OS — Bulk Attendance Phase 2 Implementation

**Area:** HR & Workforce<br>
**Topic:** Bulk Attendance Phase 2 Implementation<br>
**Version:** v1.4.0<br>
**Date:** 2026-10-15<br>
**Author:** Jawahar Ramkripal Mallah<br>
**Classification:** Internal


---

## 1. Purpose
The purpose of this implementation is to elevate the manual bulk attendance marking capability into a secure, operator-friendly, multi-step workflow within the existing Muster Roll & Wages workspace (`AttendanceWorkspaceTab.tsx`). It delivers rigorous server-side tenant and branch authorization, protects finalized payroll and biometric punches against inadvertent mutation, enforces mandatory reasons for manual absence/leave, and provides pre-submission change preview alongside post-submission Created/Skipped/Error reporting.

---

## 2. Scope
- **Backend Authorization & Isolation:**
  - Explicit role permissions for `SYSADMIN`, `ADMIN`, `MANAGER`, `STORE_MANAGER`, `BRANCH_ADMIN`, and `HR_EXECUTIVE`.
  - Rejection with HTTP 403 Forbidden for unauthorized roles (`CASHIER`, `VIEWER`, ordinary staff).
  - Server-side tenant company isolation rejecting cross-company entries.
  - Branch manager scoping preventing cross-branch marking for store managers while granting `SYSADMIN` and `HR_EXECUTIVE` multi-branch authority.
  - Client-supplied `branch_source_id` neutralized by enforcing authenticated branch rules.
- **Integrity, Payroll Lock & Biometric Protection:**
  - Automated check against finalized monthly wage statements (`WageStatement.status == 'FINALIZED'`), skipping locked records with clear messaging.
  - Non-destructive preservation of pre-existing biometric hardware clock-in/out records (`device_source='BIOMETRIC'` or `check_in_at`/`check_out_at` populated).
  - Mandatory reason validation for `ABSENT` and `LEAVE` statuses.
  - Atomic database transactions with explicit rollback on error.
  - Integration with `ComplianceAuditService` logging SHA-256 payload hashed events into `compliance_immutable_audit_logs`.
- **Frontend Workspace (`AttendanceWorkspaceTab.tsx`):**
  - Interactive multi-step wizard: Step 1 (Configure & Select) -> Step 2 (Preview Breakdown) -> Step 3 (Results Summary).
  - Attendance date and authorized branch filters.
  - Multi-field employee search (name, code, department) and department filter dropdown.
  - Per-employee interactive status selection supporting all 7 canonical statuses (`PRESENT`, `ABSENT`, `HALF_DAY`, `LEAVE`, `WEEKLY_OFF`, `HOLIDAY`, `LATE`).
  - Quick action toolbar: `Mark All Present`, `Mark Selected Present`, `Mark Selected Absent`, and `Reset`.
  - Mandatory reason inputs for absence and leave records.
  - Pre-save status distribution cards and preview table.
  - Post-submission results breakdown reporting Created, Skipped (biometric preserved / payroll locked), and Error counts and itemized tables.

---

## 3. Files Created
1. `backend/app/tests/test_bulk_attendance_security.py`: Dedicated backend security, tenant isolation, branch scoping, payroll lock, biometric preservation, mixed status, and immutable audit logging test suite (7 comprehensive test cases).
2. `docs/walkthrough/hr/HR_Bulk_Manual_Attendance_Phase_2_v1.4.0.md`: This canonical WGP walkthrough.

---

## 4. Files Modified
1. `backend/app/api/v1/staff.py`:
   - Added `_require_bulk_attendance_permission(current_user)` permitting `SYSADMIN`, `ADMIN`, `MANAGER`, `STORE_MANAGER`, `BRANCH_ADMIN`, and `HR_EXECUTIVE`.
   - Hardened `POST /api/v1/staff/attendance/bulk` with server-side company check, branch scoping, biometric protection, wage statement finalization lock check, transaction rollback handling, compliance audit service integration, and dual `created_records` / `records` backward-compatible response.
2. `backend/app/tests/conftest.py`:
   - Added `ALTER TYPE userrole ADD VALUE IF NOT EXISTS` for canonical roles (`ADMIN`, `STORE_MANAGER`, `BRANCH_ADMIN`, `HR_EXECUTIVE`, etc.) to ephemeral test template setup statements.
3. `src/components/hr/AttendanceWorkspaceTab.tsx`:
   - Upgraded to v1.4.0.
   - Expanded `PersonnelProfile` interface with `employeeCode`, `department`, and `branchId`.
   - Added `BulkAttendanceStatus` and `BulkSubmitResult` types.
   - Replaced basic 2-status modal with full-featured 3-step Bulk Attendance Entry Workspace.
   - Extended `isManager` check to include `HR_EXECUTIVE`.
4. `docs/walkthrough/README.md`:
   - Appended chronological entry for Bulk Attendance Phase 2.
5. `CHANGELOG.md`:
   - Appended entry for Bulk Attendance Phase 2.

---

## 5. Architecture Decisions
- **ADR-HR-002: Server-Side Tenant & Branch Isolation for Bulk Attendance**
  - *Decision:* The backend must never trust client-provided branch IDs or rely on client-side role filtering. When an operator posts a bulk attendance batch, each employee in the payload is resolved against the authenticated tenant's company database. Branch managers cannot mark attendance for employees outside their assigned branch.
  - *Rationale:* Protects multi-store enterprises against unauthorized cross-branch staff manipulation while empowering headquarters HR Executives and Sysadmins with company-wide visibility.
- **ADR-HR-003: Finalized Wage Statement Lock & Biometric Preservation Invariant**
  - *Decision:* If a wage statement for a user and period (`YYYY-MM`) is finalized, all new attendance entries or modifications for that period are unconditionally blocked and added to `skipped_records`. Similarly, if a punch or biometric device source already exists for the day, manual bulk entry preserves the punch and skips modification.
  - *Rationale:* Prevents payroll fraud, retroactive wage tampering, and loss of genuine biometric clock-in timestamp evidence.

---

## 6. Design Rationale
- **3-Step Guided Workflow:** Prevents human error by splitting large batch operations into Configure -> Preview -> Results. Operators review status distribution counters and individual warnings before committing.
- **Per-Employee Status Pills:** Instead of forcing all employees into a single status, operators can mark a whole department present with 1-click and then surgically toggle specific staff to `HALF_DAY`, `LATE`, or `LEAVE` in the same batch.
- **Mandatory Absence Reasons:** Requires operational accountability for unpaid absences or statutory leave, ensuring clean audit records for labor compliance inspections.

---

## 7. Implementation Summary
1. **Backend Authorization & Branch Scoping (`staff.py`):**
   - Implemented role whitelist: `UserRole.SYSADMIN`, `UserRole.ADMIN`, `UserRole.MANAGER`, `UserRole.STORE_MANAGER`, `UserRole.BRANCH_ADMIN`, `UserRole.HR_EXECUTIVE`.
   - Cross-company check: `if target_user.company_id and target_user.company_id != tenant.company_id: raise HTTPException(404)`.
   - Branch isolation: `if not is_global_operator and operator_branch and target_branch and operator_branch != target_branch: errors.append(...)`.
2. **Payroll Lock & Biometric Defense:**
   - Pre-queries `WageStatement.period.in_(periods)` where `status == 'FINALIZED'`.
   - Detects `rec.check_in_at or rec.check_out_at or 'BIOMETRIC' in (rec.device_source or '')`, appending to `skipped` with explicit explanation.
3. **Audit Logging Integration:**
   - Calls `ComplianceAuditService.record_audit_event` with SHA-256 payload hash, recording actor, date, branch, and item counts in `compliance_immutable_audit_logs`.
4. **Interactive UI Shell (`AttendanceWorkspaceTab.tsx`):**
   - Added responsive search input, department filter, authorized branch dropdown, quick action buttons (`Mark All Present`, `Mark Selected Present`, `Mark Selected Absent`, `Reset`), per-employee status pills, dynamic reasons input, status distribution preview grid, and post-save results modal.

---

## 8. Tests Executed
1. **Backend Pytest Security Test Suite (`backend/app/tests/test_bulk_attendance_security.py`):**
   - `test_unauthorized_roles_blocked_403`: CASHIER role receives HTTP 403 Forbidden.
   - `test_cross_company_isolation`: Attempt to mark attendance for foreign company employee returns error item.
   - `test_cross_branch_isolation_for_branch_manager`: Branch manager of Main Branch rejected when attempting to mark North Branch employee.
   - `test_sysadmin_can_mark_across_branches`: SYSADMIN marks employees across multiple branches in single batch.
   - `test_payroll_finalization_locks_attendance`: Blocked with skip message when period wage statement is finalized.
   - `test_biometric_punch_preservation`: Pre-existing clock-in punch preserved untouched.
   - `test_mixed_status_batch_and_compliance_audit`: All 7 canonical statuses recorded with SHA-256 compliance audit log entry.
2. **Frontend Vitest Integration Tests (`src/tests/staffAttendance.integration.test.ts`):**
   - 40/40 integration tests green.
3. **TypeScript Strict Typecheck:**
   - `npx tsc --noEmit`: 0 errors.
4. **UX Field Governance & Zero-Drift Guard:**
   - `python scripts/ci_ux_field_governance_guard.py`: 0 critical violations.

---

## 9. Verification Results
```text
Backend Security Pytest:
======================= 7 passed, 25 warnings in 51.28s =======================
- test_unauthorized_roles_blocked_403: PASSED
- test_cross_company_isolation: PASSED
- test_cross_branch_isolation_for_branch_manager: PASSED
- test_sysadmin_can_mark_across_branches: PASSED
- test_payroll_finalization_locks_attendance: PASSED
- test_biometric_punch_preservation: PASSED
- test_mixed_status_batch_and_compliance_audit: PASSED

Frontend Vitest Suite:
✓ src/tests/staffAttendance.integration.test.ts (40 tests)
Test Files  1 passed (1)
Tests       40 passed (40)

TypeScript Validation:
npx tsc --noEmit -> Exit 0, 0 errors.

UX Governance Guard:
scripts/ci_ux_field_governance_guard.py -> PASS WITH EXPLICIT EXCEPTIONS, 0 violations.
```

---

## 10. Known Limitations
- Shift timing overrides (custom shift hours per employee in bulk) are defaulted to standard branch work hours. Shift schedule integration is scheduled for Phase 3.
- Offline browser bulk queueing uses local memory; offline IndexedDB sync queue for bulk attendance will be incorporated in future offline resilience work.

---

## 11. Future Work
- Shift roster assignment integration into the bulk marking grid.
- CSV/Excel batch upload with pre-validation parser.
- Multi-branch selection for regional retail area managers.

---

## 12. Related ADRs
- `ADR-HR-001`: Statutory Form II Muster Roll & Wage Statement Foundation
- `ADR-HR-002`: Server-Side Tenant & Branch Isolation for Bulk Attendance
- `ADR-HR-003`: Finalized Wage Statement Lock & Biometric Preservation Invariant
- `ADR-042`: Canonical Field & System Parameter Dual-Key Architecture

---

## 13. Related RFCs
- `RFC-HR-2026-04`: Bulk Attendance Manual Entry Workflow
- `RFC-HR-2026-05`: Payroll Finalization Lock & Compliance Audit Trail
