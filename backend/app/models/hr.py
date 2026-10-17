#  Project      : SMRITI Retail OS
#  Author       : Jawahar Ramkripal Mallah
#  Designation  : Chief Systems Architect & Creator
#  Email        : support@smritibooks.com
#  Websites     : smritibooks.com | erpnbook.com | aitdl.com
#  Version      : 3.17.0
#  Created      : 2026-07-06
#  Modified     : 2026-10-14
#  Copyright    : © SMRITIBooks.com. All Rights Reserved.
#  License      : Proprietary Commercial Software
#  Classification: Internal

"""Canonical HR attendance, leave, and wage statement domain models."""

import uuid as uuid_pkg
from sqlalchemy import Column, Date, DateTime, ForeignKey, Integer, Numeric, String, Text, UniqueConstraint
from ..db.base import BaseEntity


class AttendanceRecord(BaseEntity):
    """Daily check-in / check-out attendance and muster roll record.

    ``user_id`` is an application-level reference to ``smritisys.users.id``.
    Cross-database foreign key is intentionally not specified in ORM.
    """

    __tablename__ = "attendance_records"

    id = Column(String(50), primary_key=True, default=lambda: f"att-{uuid_pkg.uuid4().hex[:12]}")
    user_id = Column(String(50), nullable=False, index=True)
    attendance_date = Column(Date, nullable=False, index=True)
    status = Column(String(20), nullable=False, default="PRESENT")
    check_in_at = Column(DateTime(timezone=True), nullable=True)
    check_out_at = Column(DateTime(timezone=True), nullable=True)
    branch_source_id = Column(String(50), nullable=True, index=True)
    register_source = Column(String(100), nullable=True)
    device_source = Column(String(100), nullable=True)
    correction_status = Column(String(20), nullable=False, default="NONE")
    correction_reason = Column(Text, nullable=True)
    approved_by = Column(String(50), nullable=True)
    approved_at = Column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        UniqueConstraint("company_id", "user_id", "attendance_date", name="uq_attendance_company_user_date"),
    )


class LeaveBalance(BaseEntity):
    """Annual leave entitlements and usage counters for an employee."""

    __tablename__ = "leave_balances"

    id = Column(String(50), primary_key=True, default=lambda: f"lb-{uuid_pkg.uuid4().hex[:12]}")
    user_id = Column(String(50), nullable=False, index=True)
    leave_year = Column(Integer, nullable=False)
    leave_type = Column(String(20), nullable=False)
    entitled_days = Column(Integer, nullable=False, default=0)
    used_days = Column(Integer, nullable=False, default=0)
    pending_days = Column(Integer, nullable=False, default=0)

    __table_args__ = (
        UniqueConstraint("company_id", "user_id", "leave_year", "leave_type", name="uq_leave_balance_company_user_year_type"),
    )


class LeaveRequest(BaseEntity):
    """Employee leave application and approval workflow entity."""

    __tablename__ = "leave_requests"

    id = Column(String(50), primary_key=True, default=lambda: f"lr-{uuid_pkg.uuid4().hex[:12]}")
    user_id = Column(String(50), nullable=False, index=True)
    leave_type = Column(String(20), nullable=False)
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    total_days = Column(Integer, nullable=False)
    reason = Column(Text, nullable=True)
    status = Column(String(20), nullable=False, default="PENDING")
    approver_id = Column(String(50), nullable=True)
    decision_reason = Column(Text, nullable=True)
    decided_at = Column(DateTime(timezone=True), nullable=True)


class WageStatement(BaseEntity):
    """Monthly finalized or draft wage and salary statement for an employee."""

    __tablename__ = "wage_statements"

    id = Column(String(50), primary_key=True, default=lambda: f"wgs-{uuid_pkg.uuid4().hex[:12]}")
    user_id = Column(String(50), nullable=False, index=True)
    period = Column(String(7), nullable=False, index=True)  # YYYY-MM
    wage_type = Column(String(20), nullable=False, default="MONTHLY")  # MONTHLY or DAILY
    base_rate = Column(Numeric(12, 2), nullable=False, default=0.00)

    # Attendance summary figures
    working_days = Column(Numeric(5, 2), nullable=False, default=0.00)
    present_days = Column(Numeric(5, 2), nullable=False, default=0.00)
    half_days = Column(Numeric(5, 2), nullable=False, default=0.00)
    absent_days = Column(Numeric(5, 2), nullable=False, default=0.00)
    paid_leave_days = Column(Numeric(5, 2), nullable=False, default=0.00)
    weekly_off_days = Column(Numeric(5, 2), nullable=False, default=0.00)
    lop_days = Column(Numeric(5, 2), nullable=False, default=0.00)
    overtime_hours = Column(Numeric(6, 2), nullable=False, default=0.00)
    overtime_rate = Column(Numeric(10, 2), nullable=False, default=0.00)

    # Financial breakdown
    base_earnings = Column(Numeric(12, 2), nullable=False, default=0.00)
    overtime_earnings = Column(Numeric(12, 2), nullable=False, default=0.00)
    commission_amount = Column(Numeric(12, 2), nullable=False, default=0.00)
    allowances_amount = Column(Numeric(12, 2), nullable=False, default=0.00)
    lop_deduction = Column(Numeric(12, 2), nullable=False, default=0.00)
    gross_wages = Column(Numeric(12, 2), nullable=False, default=0.00)
    net_wages = Column(Numeric(12, 2), nullable=False, default=0.00)

    status = Column(String(20), nullable=False, default="DRAFT")  # DRAFT, FINALIZED, PAID
    finalized_by = Column(String(50), nullable=True)
    finalized_at = Column(DateTime(timezone=True), nullable=True)
    notes = Column(Text, nullable=True)

    __table_args__ = (
        UniqueConstraint("company_id", "user_id", "period", name="uq_wage_statement_company_user_period"),
    )
