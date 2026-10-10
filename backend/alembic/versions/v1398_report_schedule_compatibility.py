"""v1398_report_schedule_compatibility

Revision ID: v1398_report_schedule_compat
Revises: v1397_cust_identity_protection
Create Date: 2026-09-04

Adds newer report schedule metadata columns to legacy control-plane databases.
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "v1398_report_schedule_compat"
down_revision = "v1397_cust_identity_protection"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    existing = {c["name"] for c in sa.inspect(bind).get_columns("report_schedules")}
    columns = [
        ("schedule_name", sa.String(150), True, None),
        ("report_code", sa.String(50), True, None),
        ("export_format", sa.String(20), False, "XLSX"),
        ("channels", postgresql.JSONB, False, "'[]'::jsonb"),
        ("recipients", postgresql.JSONB, False, "'{}'::jsonb"),
        ("filter_overrides", postgresql.JSONB, False, "'{}'::jsonb"),
        ("status", sa.String(30), False, "IDLE"),
        ("last_run_at", sa.DateTime(timezone=True), True, None),
        ("next_run_at", sa.DateTime(timezone=True), True, None),
        ("last_execution_latency_ms", sa.Integer, True, None),
        ("last_status_message", sa.Text, True, None),
    ]
    for name, type_, nullable, default in columns:
        if name not in existing:
            kwargs = {"nullable": nullable}
            if default is not None:
                kwargs["server_default"] = sa.text(default) if "{" in default or "[" in default else default
            op.add_column("report_schedules", sa.Column(name, type_, **kwargs))
    indexes = {idx["name"] for idx in sa.inspect(bind).get_indexes("report_schedules")}
    if "ix_report_schedules_schedule_name" not in indexes:
        op.create_index("ix_report_schedules_schedule_name", "report_schedules", ["schedule_name"])
    if "ix_report_schedules_report_code" not in indexes:
        op.create_index("ix_report_schedules_report_code", "report_schedules", ["report_code"])


def downgrade() -> None:
    op.drop_index("ix_report_schedules_report_code", table_name="report_schedules")
    op.drop_index("ix_report_schedules_schedule_name", table_name="report_schedules")
    for column in (
        "last_status_message", "last_execution_latency_ms", "next_run_at", "last_run_at",
        "status", "filter_overrides", "recipients", "channels", "export_format",
        "report_code", "schedule_name",
    ):
        op.drop_column("report_schedules", column)
