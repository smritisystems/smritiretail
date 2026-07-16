"""
/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.21.0
 * Created      : 2026-07-16
 * Modified     : 2026-07-16
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 */
"""

"""h4i5j6k7l8m9 — add report_schedules table

Revision ID: h4i5j6k7l8m9
Revises    : g3h4i5j6k7l8
Create Date: 2026-07-16
"""

from alembic import op
import sqlalchemy as sa

revision = "h4i5j6k7l8m9"
down_revision = "g3h4i5j6k7l8"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "report_schedules",
        sa.Column("id",               sa.String(50),  primary_key=True),
        sa.Column("uuid",             sa.String(36),  nullable=False, unique=True),
        sa.Column("company_id",       sa.String(50),  sa.ForeignKey("companies.id",  ondelete="RESTRICT"), nullable=True),
        sa.Column("branch_id",        sa.String(50),  sa.ForeignKey("branches.id",   ondelete="RESTRICT"), nullable=True),
        sa.Column("report_id",        sa.String(50),  nullable=False),
        sa.Column("report_name",      sa.String(200), nullable=False),
        sa.Column("frequency",        sa.String(20),  nullable=False),
        sa.Column("execution_time",   sa.String(10),  nullable=True),
        sa.Column("cron_expression",  sa.String(50),  nullable=True),
        sa.Column("delivery_channel", sa.String(20),  nullable=False),
        sa.Column("delivery_target",  sa.String(200), nullable=False),
        sa.Column("delivery_format",  sa.String(10),  nullable=False, server_default="PDF"),
        sa.Column("created_by_id",    sa.String(100), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at",       sa.DateTime(timezone=True), nullable=True),
        sa.Column("modified_at",      sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_by",       sa.String(100), nullable=True),
        sa.Column("updated_by",       sa.String(100), nullable=True),
        sa.Column("is_active",        sa.Boolean,     nullable=False, server_default=sa.true()),
        sa.Column("is_deleted",       sa.Boolean,     nullable=False, server_default=sa.false()),
        sa.Column("deleted_at",       sa.DateTime(timezone=True), nullable=True),
        sa.Column("deleted_by",       sa.String(100), nullable=True),
        sa.Column("version",          sa.Integer,     nullable=False, server_default="1"),
    )
    op.create_index("ix_report_schedules_company_id", "report_schedules", ["company_id"])
    op.create_index("ix_report_schedules_report_id",  "report_schedules", ["report_id"])


def downgrade() -> None:
    op.drop_index("ix_report_schedules_report_id",  table_name="report_schedules")
    op.drop_index("ix_report_schedules_company_id", table_name="report_schedules")
    op.drop_table("report_schedules")
