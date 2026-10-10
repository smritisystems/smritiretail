"""Canonical HR attendance and leave domain models."""

import uuid as uuid_pkg
from sqlalchemy import Column, Date, DateTime, ForeignKey, Integer, String, Text, Time, UniqueConstraint
from ..db.base import BaseEntity


class AttendanceRecord(BaseEntity):
    __tablename__ = "attendance_records"

    id = Column(String(50), primary_key=True, default=lambda: f"att-{uuid_pkg.uuid4().hex[:12]}")
    user_id = Column(String(50), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False, index=True)
    attendance_date = Column(Date, nullable=False, index=True)
    status = Column(String(20), nullable=False, default="PRESENT")
    check_in_at = Column(DateTime(timezone=True), nullable=True)
    check_out_at = Column(DateTime(timezone=True), nullable=True)
    branch_source_id = Column(String(50), ForeignKey("branches.id", ondelete="RESTRICT"), nullable=True, index=True)
    register_source = Column(String(100), nullable=True)
    device_source = Column(String(100), nullable=True)
    correction_status = Column(String(20), nullable=False, default="NONE")
    correction_reason = Column(Text, nullable=True)
    approved_by = Column(String(50), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    approved_at = Column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        UniqueConstraint("company_id", "user_id", "attendance_date", name="uq_attendance_company_user_date"),
    )


class LeaveBalance(BaseEntity):
    __tablename__ = "leave_balances"

    id = Column(String(50), primary_key=True, default=lambda: f"lb-{uuid_pkg.uuid4().hex[:12]}")
    user_id = Column(String(50), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False, index=True)
    leave_year = Column(Integer, nullable=False)
    leave_type = Column(String(20), nullable=False)
    entitled_days = Column(Integer, nullable=False, default=0)
    used_days = Column(Integer, nullable=False, default=0)
    pending_days = Column(Integer, nullable=False, default=0)

    __table_args__ = (
        UniqueConstraint("company_id", "user_id", "leave_year", "leave_type", name="uq_leave_balance_company_user_year_type"),
    )


class LeaveRequest(BaseEntity):
    __tablename__ = "leave_requests"

    id = Column(String(50), primary_key=True, default=lambda: f"lr-{uuid_pkg.uuid4().hex[:12]}")
    user_id = Column(String(50), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False, index=True)
    leave_type = Column(String(20), nullable=False)
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    total_days = Column(Integer, nullable=False)
    reason = Column(Text, nullable=True)
    status = Column(String(20), nullable=False, default="PENDING")
    approver_id = Column(String(50), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    decision_reason = Column(Text, nullable=True)
    decided_at = Column(DateTime(timezone=True), nullable=True)
