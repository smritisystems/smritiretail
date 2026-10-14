#  Project      : SMRITI Retail OS
#  Author       : Jawahar Ramkripal Mallah
#  Designation  : Chief Systems Architect & Creator
#  Email        : support@smritibooks.com
#  Websites     : smritibooks.com | erpnbook.com | aitdl.com
#  Version      : 3.17.0
#  Created      : 2026-10-14
#  Modified     : 2026-10-14
#  Copyright    : © SMRITIBooks.com. All Rights Reserved.
#  License      : Proprietary Commercial Software
#  Classification: Internal

"""
WageCalculationService: Engine for Daily Wage and Monthly Salary Calculations,
Muster Roll Aggregation, Loss of Pay (LOP) Deductions, and Payroll Finalization.
"""

import calendar
import json
from datetime import date, datetime
from typing import Any, Dict, List, Optional

from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.commission import CommissionLedger, CommissionParticipant
from ..models.hr import AttendanceRecord, WageStatement
from ..models.staff_profile import StaffProfile
from ..schemas.user import SalaryStructure


def compute_employee_wages(
    salary_data: Dict[str, Any],
    attendance_summary: Dict[str, Any],
    working_days: float,
    commission_earned: float = 0.0,
) -> Dict[str, Any]:
    """
    Deterministic wage computation given salary structure parameters and period attendance.
    Supports both DAILY casual workers and MONTHLY salaried staff.
    """
    wage_type = str(salary_data.get("wageType", "MONTHLY")).strip().upper()
    fixed_monthly = float(salary_data.get("fixedMonthly", 25000.0) or 0.0)
    daily_rate = float(salary_data.get("dailyRate", 0.0) or 0.0)
    ot_rate = float(salary_data.get("overtimeRatePerHour", 0.0) or 0.0)

    # Allowances
    other_allow = salary_data.get("otherAllowances", {})
    if isinstance(other_allow, dict):
        da = float(other_allow.get("da", 0.0) or 0.0)
        mobile = float(other_allow.get("mobile", 0.0) or 0.0)
        internet = float(other_allow.get("internet", 0.0) or 0.0)
        fuel = float(other_allow.get("fuel", 0.0) or 0.0)
    else:
        da = mobile = internet = fuel = 0.0

    travel_struct = salary_data.get("travelAllowance", {})
    travel_val = float(travel_struct.get("value", 0.0) or 0.0) if isinstance(travel_struct, dict) else 0.0
    total_allowances = round(da + mobile + internet + fuel + travel_val, 2)

    # Attendance counts
    present_days = float(attendance_summary.get("present_days", 0.0))
    half_days = float(attendance_summary.get("half_days", 0.0))
    absent_days = float(attendance_summary.get("absent_days", 0.0))
    paid_leave_days = float(attendance_summary.get("paid_leave_days", 0.0))
    weekly_off_days = float(attendance_summary.get("weekly_off_days", 0.0))
    holiday_days = float(attendance_summary.get("holiday_days", 0.0))
    overtime_hours = float(attendance_summary.get("overtime_hours", 0.0))

    overtime_earnings = round(overtime_hours * ot_rate, 2)
    effective_working_days = max(1.0, float(working_days))

    if wage_type == "DAILY":
        # Casual/Daily worker: Paid strictly by days worked + half days + overtime
        effective_days = present_days + (0.5 * half_days)
        base_rate = daily_rate
        base_earnings = round(effective_days * daily_rate, 2)
        lop_days = 0.0
        lop_deduction = 0.0
        gross_wages = round(base_earnings + overtime_earnings + total_allowances + commission_earned, 2)
        net_wages = gross_wages
    else:
        # Monthly salaried worker: Full base minus LOP deduction for unexcused/absent days
        base_rate = fixed_monthly
        effective_present = present_days + (0.5 * half_days) + paid_leave_days
        lop_days = max(0.0, effective_working_days - effective_present)
        per_day_rate = base_rate / effective_working_days
        lop_deduction = round(lop_days * per_day_rate, 2)
        base_earnings = base_rate
        gross_wages = round(base_earnings + overtime_earnings + total_allowances + commission_earned, 2)
        net_wages = max(0.0, round(gross_wages - lop_deduction, 2))

    return {
        "wage_type": wage_type,
        "base_rate": base_rate,
        "working_days": effective_working_days,
        "present_days": present_days,
        "half_days": half_days,
        "absent_days": absent_days,
        "paid_leave_days": paid_leave_days,
        "weekly_off_days": weekly_off_days,
        "holiday_days": holiday_days,
        "lop_days": lop_days,
        "overtime_hours": overtime_hours,
        "overtime_rate": ot_rate,
        "base_earnings": base_earnings,
        "overtime_earnings": overtime_earnings,
        "commission_amount": commission_earned,
        "allowances_amount": total_allowances,
        "lop_deduction": lop_deduction,
        "gross_wages": gross_wages,
        "net_wages": net_wages,
    }


class WageCalculationService:
    @staticmethod
    def _parse_period_dates(period: str):
        parts = [int(p) for p in period.split("-")]
        yr, mo = parts[0], parts[1]
        _, max_days = calendar.monthrange(yr, mo)
        return date(yr, mo, 1), date(yr, mo, max_days), max_days

    @classmethod
    async def get_period_attendance_summary(
        cls,
        db: AsyncSession,
        company_id: str,
        user_id: str,
        start_date: date,
        end_date: date,
    ) -> Dict[str, Any]:
        stmt = (
            select(AttendanceRecord)
            .where(
                and_(
                    AttendanceRecord.company_id == company_id,
                    AttendanceRecord.user_id == user_id,
                    AttendanceRecord.attendance_date >= start_date,
                    AttendanceRecord.attendance_date <= end_date,
                    AttendanceRecord.is_deleted == False,
                )
            )
            .order_by(AttendanceRecord.attendance_date.asc())
        )
        records = (await db.execute(stmt)).scalars().all()

        present_days = 0.0
        half_days = 0.0
        absent_days = 0.0
        paid_leave_days = 0.0
        weekly_off_days = 0.0
        holiday_days = 0.0
        overtime_hours = 0.0
        total_hours_worked = 0.0

        for r in records:
            st = (r.status or "").upper()
            if st in ("PRESENT", "LATE"):
                present_days += 1.0
            elif st == "HALF_DAY":
                half_days += 1.0
            elif st == "ABSENT":
                absent_days += 1.0
            elif st == "LEAVE":
                paid_leave_days += 1.0
            elif st == "WEEKLY_OFF":
                weekly_off_days += 1.0
            elif st == "HOLIDAY":
                holiday_days += 1.0

            if r.check_in_at and r.check_out_at:
                hrs = (r.check_out_at - r.check_in_at).total_seconds() / 3600.0
                if hrs > 0:
                    total_hours_worked += hrs
                    if hrs > 8.0:
                        overtime_hours += hrs - 8.0

        return {
            "records": records,
            "present_days": present_days,
            "half_days": half_days,
            "absent_days": absent_days,
            "paid_leave_days": paid_leave_days,
            "weekly_off_days": weekly_off_days,
            "holiday_days": holiday_days,
            "overtime_hours": round(overtime_hours, 2),
            "total_hours_worked": round(total_hours_worked, 2),
        }

    @classmethod
    async def get_earned_commission(
        cls,
        db: AsyncSession,
        company_id: str,
        user_id: str,
        start_date: date,
        end_date: date,
    ) -> float:
        try:
            participant = (
                await db.execute(
                    select(CommissionParticipant).where(
                        and_(
                            CommissionParticipant.company_id == company_id,
                            CommissionParticipant.user_id == user_id,
                            CommissionParticipant.is_deleted == False,
                        )
                    )
                )
            ).scalars().first()

            if not participant:
                return 0.0

            stmt = select(CommissionLedger).where(
                and_(
                    CommissionLedger.company_id == company_id,
                    CommissionLedger.participant_id == participant.id,
                    CommissionLedger.timestamp >= datetime.combine(start_date, datetime.min.time()),
                    CommissionLedger.timestamp <= datetime.combine(end_date, datetime.max.time()),
                    CommissionLedger.transaction_type.in_(["EARNED", "APPROVED", "SETTLED"]),
                    CommissionLedger.is_deleted == False,
                )
            )
            ledgers = (await db.execute(stmt)).scalars().all()
            return round(sum(float(l.commission_amount or 0.0) for l in ledgers), 2)
        except Exception:
            return 0.0

    @classmethod
    async def calculate_period_wages(
        cls,
        db: AsyncSession,
        company_id: str,
        period: str,
        user_id: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        start_date, end_date, total_days = cls._parse_period_dates(period)

        # 1. Fetch target staff profiles
        stmt = select(StaffProfile).where(
            and_(
                StaffProfile.company_id == company_id,
                StaffProfile.is_deleted == False,
            )
        )
        if user_id:
            stmt = stmt.where(StaffProfile.user_id == user_id)
        stmt = stmt.order_by(StaffProfile.full_name)
        profiles = (await db.execute(stmt)).scalars().all()

        # 2. Check existing finalized statements to prevent recalculation tampering
        stmt_wgs = select(WageStatement).where(
            and_(
                WageStatement.company_id == company_id,
                WageStatement.period == period,
                WageStatement.is_deleted == False,
            )
        )
        if user_id:
            stmt_wgs = stmt_wgs.where(WageStatement.user_id == user_id)
        existing_wgs = {w.user_id: w for w in (await db.execute(stmt_wgs)).scalars().all()}

        results = []
        for p in profiles:
            # If already finalized, return frozen ledger
            if p.user_id in existing_wgs and existing_wgs[p.user_id].status == "FINALIZED":
                w = existing_wgs[p.user_id]
                results.append(
                    {
                        "id": w.id,
                        "user_id": w.user_id,
                        "employee_code": p.employee_code,
                        "employee_name": p.full_name or p.display_name or p.user_id,
                        "department": p.department,
                        "designation": p.designation,
                        "period": w.period,
                        "wage_type": w.wage_type,
                        "base_rate": float(w.base_rate),
                        "working_days": float(w.working_days),
                        "present_days": float(w.present_days),
                        "half_days": float(w.half_days),
                        "absent_days": float(w.absent_days),
                        "paid_leave_days": float(w.paid_leave_days),
                        "weekly_off_days": float(w.weekly_off_days),
                        "holiday_days": float(w.holiday_days if hasattr(w, 'holiday_days') else 0.0),
                        "lop_days": float(w.lop_days),
                        "overtime_hours": float(w.overtime_hours),
                        "overtime_rate": float(w.overtime_rate),
                        "base_earnings": float(w.base_earnings),
                        "overtime_earnings": float(w.overtime_earnings),
                        "commission_amount": float(w.commission_amount),
                        "allowances_amount": float(w.allowances_amount),
                        "lop_deduction": float(w.lop_deduction),
                        "gross_wages": float(w.gross_wages),
                        "net_wages": float(w.net_wages),
                        "status": w.status,
                        "finalized_by": w.finalized_by,
                        "finalized_at": w.finalized_at.isoformat() if w.finalized_at else None,
                        "notes": w.notes,
                        "is_finalized": True,
                    }
                )
                continue

            # Parse salary structure
            salary_dict = {}
            if p.salary_json:
                try:
                    salary_dict = json.loads(p.salary_json)
                except Exception:
                    pass

            att_summary = await cls.get_period_attendance_summary(db, company_id, p.user_id, start_date, end_date)
            commission_val = await cls.get_earned_commission(db, company_id, p.user_id, start_date, end_date)

            # Standard retail working days = total calendar days minus weekly offs and holidays (or 26 fallback)
            weekly_offs = att_summary["weekly_off_days"]
            holidays = att_summary["holiday_days"]
            computed_working_days = (
                total_days - weekly_offs - holidays if (weekly_offs + holidays) > 0 else 26.0
            )

            w_calc = compute_employee_wages(
                salary_data=salary_dict,
                attendance_summary=att_summary,
                working_days=computed_working_days,
                commission_earned=commission_val,
            )

            existing_stmt = existing_wgs.get(p.user_id)
            results.append(
                {
                    "id": existing_stmt.id if existing_stmt else None,
                    "user_id": p.user_id,
                    "employee_code": p.employee_code,
                    "employee_name": p.full_name or p.display_name or p.user_id,
                    "department": p.department,
                    "designation": p.designation,
                    "period": period,
                    "wage_type": w_calc["wage_type"],
                    "base_rate": w_calc["base_rate"],
                    "working_days": w_calc["working_days"],
                    "present_days": w_calc["present_days"],
                    "half_days": w_calc["half_days"],
                    "absent_days": w_calc["absent_days"],
                    "paid_leave_days": w_calc["paid_leave_days"],
                    "weekly_off_days": w_calc["weekly_off_days"],
                    "holiday_days": w_calc["holiday_days"],
                    "lop_days": w_calc["lop_days"],
                    "overtime_hours": w_calc["overtime_hours"],
                    "overtime_rate": w_calc["overtime_rate"],
                    "base_earnings": w_calc["base_earnings"],
                    "overtime_earnings": w_calc["overtime_earnings"],
                    "commission_amount": w_calc["commission_amount"],
                    "allowances_amount": w_calc["allowances_amount"],
                    "lop_deduction": w_calc["lop_deduction"],
                    "gross_wages": w_calc["gross_wages"],
                    "net_wages": w_calc["net_wages"],
                    "status": "DRAFT",
                    "finalized_by": None,
                    "finalized_at": None,
                    "notes": existing_stmt.notes if existing_stmt else None,
                    "is_finalized": False,
                }
            )

        return results

    @classmethod
    async def finalize_wage_statement(
        cls,
        db: AsyncSession,
        company_id: str,
        period: str,
        user_id: str,
        finalized_by: str,
        notes: Optional[str] = None,
    ) -> WageStatement:
        # 1. Compute wage figures
        wages = await cls.calculate_period_wages(db, company_id, period, user_id=user_id)
        if not wages:
            raise ValueError(f"No staff profile found for user {user_id}")
        w = wages[0]

        # 2. Check if statement already exists
        stmt = select(WageStatement).where(
            and_(
                WageStatement.company_id == company_id,
                WageStatement.user_id == user_id,
                WageStatement.period == period,
                WageStatement.is_deleted == False,
            )
        )
        existing = (await db.execute(stmt)).scalars().first()

        now = datetime.utcnow()
        if existing:
            existing.wage_type = w["wage_type"]
            existing.base_rate = w["base_rate"]
            existing.working_days = w["working_days"]
            existing.present_days = w["present_days"]
            existing.half_days = w["half_days"]
            existing.absent_days = w["absent_days"]
            existing.paid_leave_days = w["paid_leave_days"]
            existing.weekly_off_days = w["weekly_off_days"]
            existing.lop_days = w["lop_days"]
            existing.overtime_hours = w["overtime_hours"]
            existing.overtime_rate = w["overtime_rate"]
            existing.base_earnings = w["base_earnings"]
            existing.overtime_earnings = w["overtime_earnings"]
            existing.commission_amount = w["commission_amount"]
            existing.allowances_amount = w["allowances_amount"]
            existing.lop_deduction = w["lop_deduction"]
            existing.gross_wages = w["gross_wages"]
            existing.net_wages = w["net_wages"]
            existing.status = "FINALIZED"
            existing.finalized_by = finalized_by
            existing.finalized_at = now
            if notes is not None:
                existing.notes = notes
            statement = existing
        else:
            statement = WageStatement(
                company_id=company_id,
                user_id=user_id,
                period=period,
                wage_type=w["wage_type"],
                base_rate=w["base_rate"],
                working_days=w["working_days"],
                present_days=w["present_days"],
                half_days=w["half_days"],
                absent_days=w["absent_days"],
                paid_leave_days=w["paid_leave_days"],
                weekly_off_days=w["weekly_off_days"],
                lop_days=w["lop_days"],
                overtime_hours=w["overtime_hours"],
                overtime_rate=w["overtime_rate"],
                base_earnings=w["base_earnings"],
                overtime_earnings=w["overtime_earnings"],
                commission_amount=w["commission_amount"],
                allowances_amount=w["allowances_amount"],
                lop_deduction=w["lop_deduction"],
                gross_wages=w["gross_wages"],
                net_wages=w["net_wages"],
                status="FINALIZED",
                finalized_by=finalized_by,
                finalized_at=now,
                notes=notes,
            )
            db.add(statement)

        await db.commit()
        await db.refresh(statement)
        return statement

    @classmethod
    async def get_muster_roll_matrix(
        cls,
        db: AsyncSession,
        company_id: str,
        period: str,
        branch_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        start_date, end_date, total_days = cls._parse_period_dates(period)

        # Query staff
        stmt_staff = select(StaffProfile).where(
            and_(
                StaffProfile.company_id == company_id,
                StaffProfile.is_deleted == False,
            )
        )
        if branch_id:
            stmt_staff = stmt_staff.where(StaffProfile.branch_id == branch_id)
        stmt_staff = stmt_staff.order_by(StaffProfile.employee_code, StaffProfile.full_name)
        profiles = (await db.execute(stmt_staff)).scalars().all()

        # Query all attendance records for company in month
        stmt_att = select(AttendanceRecord).where(
            and_(
                AttendanceRecord.company_id == company_id,
                AttendanceRecord.attendance_date >= start_date,
                AttendanceRecord.attendance_date <= end_date,
                AttendanceRecord.is_deleted == False,
            )
        )
        if branch_id:
            stmt_att = stmt_att.where(AttendanceRecord.branch_source_id == branch_id)
        records = (await db.execute(stmt_att)).scalars().all()

        # Map: (user_id, day_int) -> AttendanceRecord
        att_map: Dict[tuple, AttendanceRecord] = {}
        for r in records:
            day_num = r.attendance_date.day
            att_map[(r.user_id, day_num)] = r

        status_code_map = {
            "PRESENT": "P",
            "LATE": "L",
            "HALF_DAY": "HD",
            "ABSENT": "A",
            "LEAVE": "LV",
            "HOLIDAY": "H",
            "WEEKLY_OFF": "WO",
        }

        matrix_rows = []
        for p in profiles:
            days_data = {}
            present_c = 0.0
            half_c = 0.0
            absent_c = 0.0
            leave_c = 0.0
            wo_c = 0.0
            holiday_c = 0.0
            total_worked_hrs = 0.0
            total_ot_hrs = 0.0

            for d in range(1, total_days + 1):
                rec = att_map.get((p.user_id, d))
                if rec:
                    st = (rec.status or "PRESENT").upper()
                    code = status_code_map.get(st, st[:2])
                    if st in ("PRESENT", "LATE"):
                        present_c += 1.0
                    elif st == "HALF_DAY":
                        half_c += 1.0
                    elif st == "ABSENT":
                        absent_c += 1.0
                    elif st == "LEAVE":
                        leave_c += 1.0
                    elif st == "WEEKLY_OFF":
                        wo_c += 1.0
                    elif st == "HOLIDAY":
                        holiday_c += 1.0

                    hrs = 0.0
                    if rec.check_in_at and rec.check_out_at:
                        hrs = (rec.check_out_at - rec.check_in_at).total_seconds() / 3600.0
                        if hrs > 0:
                            total_worked_hrs += hrs
                            if hrs > 8.0:
                                total_ot_hrs += hrs - 8.0

                    days_data[str(d)] = {
                        "code": code,
                        "status": st,
                        "clock_in": rec.check_in_at.strftime("%H:%M") if rec.check_in_at else None,
                        "clock_out": rec.check_out_at.strftime("%H:%M") if rec.check_out_at else None,
                        "hours": round(hrs, 1) if hrs > 0 else None,
                    }
                else:
                    days_data[str(d)] = {
                        "code": "-",
                        "status": "UNRECORDED",
                        "clock_in": None,
                        "clock_out": None,
                        "hours": None,
                    }

            payable_days = present_c + (0.5 * half_c) + leave_c + wo_c + holiday_c

            matrix_rows.append(
                {
                    "user_id": p.user_id,
                    "employee_code": p.employee_code or "EMP",
                    "full_name": p.full_name or p.display_name or p.user_id,
                    "department": p.department or "General",
                    "designation": p.designation or "Staff",
                    "days": days_data,
                    "summary": {
                        "present_days": present_c,
                        "half_days": half_c,
                        "absent_days": absent_c,
                        "paid_leave_days": leave_c,
                        "weekly_off_days": wo_c,
                        "holiday_days": holiday_c,
                        "total_worked_hours": round(total_worked_hrs, 1),
                        "total_overtime_hours": round(total_ot_hrs, 1),
                        "effective_payable_days": payable_days,
                    },
                }
            )

        return {
            "period": period,
            "days_in_month": total_days,
            "total_employees": len(matrix_rows),
            "rows": matrix_rows,
        }
