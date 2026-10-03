"""Add immutable staff profile history and placement address snapshots.

Revision ID: v1428_staff_history_and_placement_address
Revises: v1427_company_staff_profiles
"""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "v1428_staff_history_and_placement_address"
down_revision: Union[str, Sequence[str], None] = "v1427_company_staff_profiles"
branch_labels = None
depends_on = None


def _is_control_plane(bind) -> bool:
    current_db = bind.execute(sa.text("SELECT current_database();")).scalar()
    return not current_db or current_db.lower() in ("smritisys", "postgres", "template0", "template1")


def upgrade() -> None:
    bind = op.get_bind()
    if _is_control_plane(bind):
        return
    tables = set(sa.inspect(bind).get_table_names())
    if "staff_placement_assignments" in tables:
        placement_columns = {column["name"] for column in sa.inspect(bind).get_columns("staff_placement_assignments")}
        for name, column_type in (
            ("host_address_line1_snapshot", sa.Text()),
            ("host_address_line2_snapshot", sa.Text()),
            ("host_city_snapshot", sa.String(100)),
            ("host_state_snapshot", sa.String(100)),
            ("host_pincode_snapshot", sa.String(10)),
        ):
            if name not in placement_columns:
                op.add_column("staff_placement_assignments", sa.Column(name, column_type, nullable=True))

    if "staff_profile_history" not in tables:
        op.create_table(
            "staff_profile_history",
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
            sa.Column("staff_profile_id", sa.String(50), nullable=False),
            sa.Column("user_id", sa.String(50), nullable=False),
            sa.Column("change_type", sa.String(30), nullable=False),
            sa.Column("before_state_json", sa.Text, nullable=True),
            sa.Column("after_state_json", sa.Text, nullable=False),
            sa.Column("changed_by", sa.String(50), nullable=False),
            sa.Column("changed_at", sa.DateTime(timezone=True), nullable=False),
        )
        op.create_index("ix_staff_profile_history_company_user", "staff_profile_history", ["company_id", "user_id", "changed_at"])


def downgrade() -> None:
    bind = op.get_bind()
    if _is_control_plane(bind):
        return
    if "staff_profile_history" in sa.inspect(bind).get_table_names():
        op.drop_table("staff_profile_history")
    columns = {column["name"] for column in sa.inspect(bind).get_columns("staff_placement_assignments")}
    for name in ("host_pincode_snapshot", "host_state_snapshot", "host_city_snapshot", "host_address_line2_snapshot", "host_address_line1_snapshot"):
        if name in columns:
            op.drop_column("staff_placement_assignments", name)
