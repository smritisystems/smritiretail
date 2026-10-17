<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.70.35
  Created      : 2026-10-08
  Modified     : 2026-10-08
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Implementation Plan: Real-Time Sales Commission & Attendance Summary Engine (v1.0.0)

**Document Identifier:** IP-HR-005  
**Version:** 1.0.0  
**Target Release:** 6.70.35  
**Status:** Approved  
**Author:** Jawahar Ramkripal Mallah  

---

## 1. Objective
Establish authoritative backend aggregation endpoints (`GET /api/v1/staff/commissions/summary` and `GET /api/v1/staff/attendance/summary`) backed directly by PostgreSQL `commission_ledgers` and `attendance_records`, and wire them into the frontend Attendance Studio (`EmployeeAttendanceModal.tsx`), eliminating synthetic/mock estimates and providing real-time store operator and manager visibility into shift sales commissions, returns clawbacks, and period attendance KPIs.

## 2. Business Motivation
In retail environments, store staff and cashiers frequently check their daily incentive earnings and shift hours. Previously, the Attendance Studio relied on client-side hardcoded approximations (`net_sales: 150000`, `commission_amt: 3750`) because transactional commission ledgers were not queried. Following the delivery of real-time POS checkout accruals and sales return clawbacks into PostgreSQL `commission_ledgers`, exposing a high-performance aggregation API completes the end-to-end operational loop for store managers and sales staff.

## 3. Scope
- **Backend API (`backend/app/api/v1/staff.py`)**:
  - Implement `GET /api/v1/staff/commissions/summary`:
    - Filters: `user_id` / `participant_id`, `period` (`YYYY-MM`), `from_date`, `to_date`.
    - Returns aggregated gross sales, returns, earned commissions, reversals, net commission payout, and recent ledger entries.
  - Implement `GET /api/v1/staff/attendance/summary`:
    - Filters: `user_id`, `period`, `from_date`, `to_date`.
    - Returns counts of present, late, half-day, absent, leave, total hours worked, and overtime.
- **Frontend Studio (`src/components/hr/EmployeeAttendanceModal.tsx`)**:
  - Integrate live commission summary and attendance metrics into the data loading lifecycle.
  - Replace synthetic mock fallbacks with live PostgreSQL-backed statistics.
  - Render an interactive Ledger Audit drawer/table showing invoice-by-invoice commission credits and return reversals.
- **Automated Verification**:
  - Pytest suite `backend/app/tests/t_staff_summary_verify.py`.
  - Vitest suite `src/tests/employeeAttendanceStudio.test.ts`.

## 4. Current State
- `commission_ledgers` is populated live during invoice checkout and credit note creation.
- `GET /staff/incentives` currently serves static/catalog `commission_rules` definitions, not per-staff transactional earnings.
- `EmployeeAttendanceModal.tsx` contains a fallback calculating synthetic payouts with hardcoded numbers if no personal incentive lines exist.

## 5. Gap Analysis
| Requirement | Current State | Target State |
|---|---|---|
| Employee Commission Aggregation API | Missing | Dedicated `GET /api/v1/staff/commissions/summary` |
| Period Attendance Aggregation API | Missing (requires client row-by-row iteration) | Dedicated `GET /api/v1/staff/attendance/summary` |
| Frontend Incentive Tab Data Source | Synthetic ₹1,50,000 / ₹3,750 mockup | Live transactional metrics from PostgreSQL `commission_ledgers` |
| Commission Audit Trail | Not visible in Studio UI | Live ledger history table (Invoice ID, type, gross, commission, narration) |

## 6. Architecture Impact
- **Database**: Zero schema changes. Queries utilize existing PostgreSQL indexes on `commission_ledgers` (`company_id`, `participant_id`, `reference_invoice_id`, `timestamp`) and `attendance_records` (`company_id`, `user_id`, `attendance_date`).
- **Domain Boundaries**: Clean separation between transactional ledger recording (`sales_hook.py`) and administrative presentation/reporting (`staff.py`).
- **Security & Multi-Tenancy**: All queries scoped by `tenant.company_id`. Regular staff users can only view their own summary; managers/sysadmins can view any staff member.

## 7. Proposed Design
- Schema `CommissionSummaryOut`:
  - `participant_id: str`
  - `user_id: Optional[str]`
  - `period: str`
  - `gross_sales: float`
  - `returned_sales: float`
  - `net_sales: float`
  - `earned_commission: float`
  - `reversed_commission: float`
  - `net_commission: float`
  - `transaction_count: int`
  - `entries: List[CommissionEntryOut]`
- Schema `AttendanceSummaryOut`:
  - `user_id: str`
  - `period: str`
  - `total_days: int`
  - `present_days: int`
  - `late_days: int`
  - `half_days: int`
  - `absent_days: int`
  - `leave_days: int`
  - `total_hours_worked: float`
  - `avg_daily_hours: float`

## 8. Files Created
- `docs/implementation/hr/Realtime_Commission_And_Attendance_Summary_Plan_v1.0.0.md`
- `backend/app/tests/t_staff_summary_verify.py`
- `docs/walkthrough/hr/Realtime_Commission_And_Attendance_Summary_v1.0.0.md`

## 9. Files Modified
- `backend/app/api/v1/staff.py`
- `src/components/hr/EmployeeAttendanceModal.tsx`
- `src/tests/employeeAttendanceStudio.test.ts`
- `docs/implementation/README.md`
- `docs/walkthrough/README.md`
- `CHANGELOG.md`

## 10. Dependencies
- FastAPI `APIRouter`
- SQLAlchemy `AsyncSession` & SQL aggregation expressions (`func.coalesce`, `func.sum`)
- PostgreSQL `commission_ledgers`, `commission_participants`, `attendance_records`

## 11. Risks
- Heavy ledger volume: Mitigated by mandatory `company_id` filter, date bounding (`from_date` / `to_date`), and limiting entries to recent 50 transactions.

## 12. Rollback Strategy
- Standard Git revert on feature branch `smritiNX`. Non-destructive (no schema mutations).

## 13. Verification Plan
1. Unit and API tests verifying calculation accuracy of earned vs reversed commissions.
2. Idempotent date range handling across calendar months.
3. Multi-role tenant authorization tests.

## 14. Test Plan
- Run `pytest backend/app/tests/t_staff_summary_verify.py -v`.
- Run `npx vitest run src/tests/employeeAttendanceStudio.test.ts`.
- Run `npx tsc --noEmit`.

## 15. Documentation Impact
- Update `docs/implementation/README.md`.
- Update `docs/walkthrough/README.md`.
- Release notes in `CHANGELOG.md`.

## 16. Deployment Plan
- Push to GitHub `origin/smritiNX`. Hot-reload FastAPI core container `smriti-api`.

## 17. Status
Approved & In Progress.

## 18. Related ADRs
- `ADR-001`: FastAPI + PostgreSQL Sole Backend System of Record.
- `ADR-HR-001`: HR Domain Registration and Directory Consolidation.

## 19. Related Walkthroughs
- `docs/walkthrough/hr/POS_Realtime_Commission_Accrual_And_Reversal_v1.0.0.md`
- `docs/walkthrough/hr/Attendance_Punch_Clocking_And_Biometric_Webhook_v1.0.0.md`
