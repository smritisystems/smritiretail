"""Canonical HR attendance and leave foundations.

Revision ID: v1423_hr_attendance_leave
Revises: v1422_quotation_return_variant_parity
"""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "v1423_hr_attendance_leave"
down_revision: Union[str, Sequence[str], None] = "v1422_quotation_return_variant_parity"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    current_db = bind.execute(sa.text("SELECT current_database();")).scalar()
    if not current_db or current_db.lower() in ("smritisys", "postgres", "template0", "template1"):
        return

    inspector = sa.inspect(bind)
    tables = set(inspector.get_table_names())
    def common_columns():
        return [
            sa.Column("id", sa.String(50), primary_key=True),
            sa.Column("uuid", sa.String(36), nullable=False, unique=True),
            sa.Column("company_id", sa.String(50), sa.ForeignKey("companies.id", ondelete="RESTRICT"), nullable=False, index=True),
            sa.Column("branch_id", sa.String(50), sa.ForeignKey("branches.id", ondelete="RESTRICT"), nullable=True, index=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()"), nullable=False),
            sa.Column("modified_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()"), nullable=False),
            sa.Column("created_by", sa.String(100), nullable=True),
            sa.Column("updated_by", sa.String(100), nullable=True),
            sa.Column("is_active", sa.Boolean, server_default=sa.text("true"), nullable=False),
            sa.Column("is_deleted", sa.Boolean, server_default=sa.text("false"), nullable=False),
            sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("deleted_by", sa.String(100), nullable=True),
            sa.Column("version", sa.Integer, server_default="1", nullable=False),
        ]

    if "attendance_records" not in tables:
        op.create_table(
            "attendance_records", *common_columns(),
            sa.Column("user_id", sa.String(50), sa.ForeignKey("users.id", ondelete="RESTRICT"), nullable=False),
            sa.Column("attendance_date", sa.Date, nullable=False),
            sa.Column("status", sa.String(20), server_default="'PRESENT'", nullable=False),
            sa.Column("check_in_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("check_out_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("branch_source_id", sa.String(50), sa.ForeignKey("branches.id", ondelete="RESTRICT"), nullable=True),
            sa.Column("register_source", sa.String(100), nullable=True),
            sa.Column("device_source", sa.String(100), nullable=True),
            sa.Column("correction_status", sa.String(20), server_default="'NONE'", nullable=False),
            sa.Column("correction_reason", sa.Text, nullable=True),
            sa.Column("approved_by", sa.String(50), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
            sa.Column("approved_at", sa.DateTime(timezone=True), nullable=True),
            sa.UniqueConstraint("company_id", "user_id", "attendance_date", name="uq_attendance_company_user_date"),
        )
        op.create_index("ix_attendance_records_company_date", "attendance_records", ["company_id", "attendance_date"])

    if "leave_balances" not in tables:
        op.create_table(
            "leave_balances", *common_columns(),
            sa.Column("user_id", sa.String(50), sa.ForeignKey("users.id", ondelete="RESTRICT"), nullable=False),
            sa.Column("leave_year", sa.Integer, nullable=False),
            sa.Column("leave_type", sa.String(20), nullable=False),
            sa.Column("entitled_days", sa.Integer, server_default="0", nullable=False),
            sa.Column("used_days", sa.Integer, server_default="0", nullable=False),
            sa.Column("pending_days", sa.Integer, server_default="0", nullable=False),
            sa.UniqueConstraint("company_id", "user_id", "leave_year", "leave_type", name="uq_leave_balance_company_user_year_type"),
        )

    if "leave_requests" not in tables:
        op.create_table(
            "leave_requests", *common_columns(),
            sa.Column("user_id", sa.String(50), sa.ForeignKey("users.id", ondelete="RESTRICT"), nullable=False),
            sa.Column("leave_type", sa.String(20), nullable=False),
            sa.Column("start_date", sa.Date, nullable=False),
            sa.Column("end_date", sa.Date, nullable=False),
            sa.Column("total_days", sa.Integer, nullable=False),
            sa.Column("reason", sa.Text, nullable=True),
            sa.Column("status", sa.String(20), server_default="'PENDING'", nullable=False),
            sa.Column("approver_id", sa.String(50), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
            sa.Column("decision_reason", sa.Text, nullable=True),
            sa.Column("decided_at", sa.DateTime(timezone=True), nullable=True),
        )
        op.create_index("ix_leave_requests_company_dates", "leave_requests", ["company_id", "start_date", "end_date"])


def downgrade() -> None:
    bind = op.get_bind()
    current_db = bind.execute(sa.text("SELECT current_database();")).scalar()
    if not current_db or current_db.lower() in ("smritisys", "postgres", "template0", "template1"):
        return
    for table in ("leave_requests", "leave_balances", "attendance_records"):
        if table in sa.inspect(bind).get_table_names():
            op.drop_table(table)