"""Create company-local staff profiles and backfill legacy employee fields.

Revision ID: v1427_company_staff_profiles
Revises: v1426_item_buying_price_compat
"""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "v1427_company_staff_profiles"
down_revision: Union[str, Sequence[str], None] = "v1426_item_buying_price_compat"
branch_labels = None
depends_on = None


def _is_control_plane(bind) -> bool:
    current_db = bind.execute(sa.text("SELECT current_database();")).scalar()
    return not current_db or current_db.lower() in ("smritisys", "postgres", "template0", "template1")


def upgrade() -> None:
    bind = op.get_bind()
    if _is_control_plane(bind):
        return

    if "staff_profiles" in sa.inspect(bind).get_table_names():
        return

    op.create_table(
        "staff_profiles",
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
        sa.Column("user_id", sa.String(50), nullable=False),
        sa.Column("employee_id", sa.String(20), nullable=True),
        sa.Column("employee_code", sa.String(20), nullable=True),
        sa.Column("display_name", sa.String(100), nullable=True),
        sa.Column("full_name", sa.String(200), nullable=True),
        sa.Column("gender", sa.String(10), nullable=True),
        sa.Column("date_of_birth", sa.String(20), nullable=True),
        sa.Column("alternate_mobile", sa.String(20), nullable=True),
        sa.Column("emergency_contact", sa.String(100), nullable=True),
        sa.Column("address", sa.String(500), nullable=True),
        sa.Column("city", sa.String(100), nullable=True),
        sa.Column("state", sa.String(100), nullable=True),
        sa.Column("country", sa.String(50), server_default="'India'", nullable=False),
        sa.Column("pin_code", sa.String(10), nullable=True),
        sa.Column("department", sa.String(100), nullable=True),
        sa.Column("designation", sa.String(100), nullable=True),
        sa.Column("branch", sa.String(200), nullable=True),
        sa.Column("department_id", sa.String(50), nullable=True),
        sa.Column("designation_id", sa.String(50), nullable=True),
        sa.Column("date_of_joining", sa.String(20), nullable=True),
        sa.Column("reporting_manager", sa.String(200), nullable=True),
        sa.Column("employment_type", sa.String(20), server_default="'Permanent'", nullable=False),
        sa.Column("allowed_branches", sa.Text, nullable=True),
        sa.Column("photo", sa.Text, nullable=True),
        sa.Column("salary_json", sa.Text, nullable=True),
        sa.Column("payment_json", sa.Text, nullable=True),
        sa.Column("performance_json", sa.Text, nullable=True),
        sa.Column("preferences_json", sa.Text, nullable=True),
        sa.Column("notification_settings_json", sa.Text, nullable=True),
        sa.Column("status", sa.String(50), server_default="'Active'", nullable=False),
        sa.UniqueConstraint("company_id", "user_id", name="uq_staff_profiles_company_user"),
    )
    op.create_index("ix_staff_profiles_company_user", "staff_profiles", ["company_id", "user_id"])

    # Preserve the existing staff IDs so attendance and placement records remain joinable.
    op.execute(sa.text("""
        INSERT INTO staff_profiles (
            id, uuid, company_id, branch_id, created_at, modified_at,
            is_active, is_deleted, version, user_id,
            employee_id, employee_code, display_name, full_name, gender,
            date_of_birth, alternate_mobile, emergency_contact, address, city,
            state, country, pin_code, department, designation, branch,
            department_id, designation_id, date_of_joining, reporting_manager,
            employment_type, allowed_branches, photo, salary_json, payment_json,
            performance_json, preferences_json, notification_settings_json, status
        )
        SELECT
            'stp-' || left(md5(u.id), 12), md5(u.id || 'staff-profile'),
            u.company_id, u.branch_id, u.created_at, u.modified_at,
            u.is_active, u.is_deleted, 1, u.id,
            u.employee_id, u.employee_code, u.display_name, u.full_name, u.gender,
            u.date_of_birth, u.alternate_mobile, u.emergency_contact, u.address, u.city,
            u.state, u.country, u.pin_code, u.department, u.designation, u.branch,
            u.department_id, u.designation_id, u.date_of_joining, u.reporting_manager,
            u.employment_type, u.allowed_branches, u.photo, u.salary_json, u.payment_json,
            u.performance_json, u.preferences_json, u.notification_settings_json, u.status
        FROM users u
        WHERE u.company_id IS NOT NULL AND u.is_deleted = false
        ON CONFLICT (company_id, user_id) DO NOTHING
    """))


def downgrade() -> None:
    bind = op.get_bind()
    if _is_control_plane(bind):
        return
    if "staff_profiles" in sa.inspect(bind).get_table_names():
        op.drop_table("staff_profiles")
