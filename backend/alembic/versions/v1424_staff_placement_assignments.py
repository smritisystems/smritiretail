"""Canonical staff placement assignments.

Revision ID: v1424_staff_placement_assignments
Revises: v1423_hr_attendance_leave
"""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "v1424_staff_placement_assignments"
down_revision: Union[str, Sequence[str], None] = "v1423_hr_attendance_leave"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    current_db = bind.execute(sa.text("SELECT current_database();")).scalar()
    if not current_db or current_db.lower() in ("smritisys", "postgres", "template0", "template1"):
        return
    if "staff_placement_assignments" in sa.inspect(bind).get_table_names():
        return

    op.create_table(
        "staff_placement_assignments",
        sa.Column("id", sa.String(50), primary_key=True),
        sa.Column("uuid", sa.String(36), nullable=False, unique=True),
        sa.Column("company_id", sa.String(50), sa.ForeignKey("companies.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("branch_id", sa.String(50), sa.ForeignKey("branches.id", ondelete="RESTRICT"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()"), nullable=False),
        sa.Column("modified_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()"), nullable=False),
        sa.Column("created_by", sa.String(100), nullable=True),
        sa.Column("updated_by", sa.String(100), nullable=True),
        sa.Column("is_active", sa.Boolean, server_default=sa.text("true"), nullable=False),
        sa.Column("is_deleted", sa.Boolean, server_default=sa.text("false"), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("deleted_by", sa.String(100), nullable=True),
        sa.Column("version", sa.Integer, server_default="1", nullable=False),
        sa.Column("staff_user_id", sa.String(50), sa.ForeignKey("users.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("placement_type", sa.String(30), nullable=False),
        sa.Column("internal_branch_id", sa.String(50), sa.ForeignKey("branches.id", ondelete="RESTRICT"), nullable=True),
        sa.Column("internal_store_id", sa.String(50), sa.ForeignKey("stores.id", ondelete="RESTRICT"), nullable=True),
        sa.Column("host_customer_id", sa.String(50), sa.ForeignKey("customers.id", ondelete="RESTRICT"), nullable=True),
        sa.Column("host_delivery_location_id", sa.String(50), sa.ForeignKey("customer_delivery_locations.id", ondelete="RESTRICT"), nullable=True),
        sa.Column("host_store_code_snapshot", sa.String(50), nullable=True),
        sa.Column("host_store_name_snapshot", sa.String(255), nullable=True),
        sa.Column("role_at_location", sa.String(100), nullable=True),
        sa.Column("stock_model", sa.String(30), server_default="'OUTRIGHT_SALE'", nullable=False),
        sa.Column("commission_program_id", sa.String(50), sa.ForeignKey("commission_programs.id", ondelete="SET NULL"), nullable=True),
        sa.Column("effective_from", sa.Date, nullable=False),
        sa.Column("effective_to", sa.Date, nullable=True),
        sa.Column("status", sa.String(30), server_default="'PENDING'", nullable=False),
        sa.Column("approval_reason", sa.Text, nullable=True),
        sa.Column("approved_by", sa.String(50), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("approved_at", sa.Date, nullable=True),
        sa.UniqueConstraint("company_id", "staff_user_id", "host_delivery_location_id", "effective_from", name="uq_staff_placement_location_start"),
    )
    op.create_index("ix_staff_placement_company_user", "staff_placement_assignments", ["company_id", "staff_user_id"])
    op.create_index("ix_staff_placement_host_location", "staff_placement_assignments", ["company_id", "host_delivery_location_id"])
    op.create_index(
        "uq_staff_placement_active_user",
        "staff_placement_assignments",
        ["company_id", "staff_user_id"],
        unique=True,
        postgresql_where=sa.text("is_deleted = false AND status = 'ACTIVE'"),
    )


def downgrade() -> None:
    bind = op.get_bind()
    if "staff_placement_assignments" in sa.inspect(bind).get_table_names():
        op.drop_table("staff_placement_assignments")