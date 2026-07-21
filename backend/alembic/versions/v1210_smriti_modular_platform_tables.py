"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 12.1.0
Created      : 2026-07-21
Modified     : 2026-07-21
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Alembic Migration DDL

v1210_smriti_modular_platform_tables — Migration for SMP-001 module_states and module_audit_logs.
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "v1210_smriti_modular_platform"
down_revision = "v1200_general_ledger"
branch_labels = None
depends_on = None


def upgrade():
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    tables = inspector.get_table_names()

    if "module_states" not in tables:
        op.create_table(
            "module_states",
            sa.Column("id", sa.String(length=100), primary_key=True),
            sa.Column("module_uuid", sa.String(length=36), nullable=False, unique=True),
            sa.Column("tenant_id", sa.String(length=100), nullable=False, index=True, default="default"),
            sa.Column("state", sa.String(length=50), nullable=False, default="DISABLED"),
            sa.Column("version", sa.String(length=20), nullable=False, default="1.0.0"),
            sa.Column("is_critical", sa.Boolean(), nullable=False, default=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP")),
        )

    if "module_audit_logs" not in tables:
        op.create_table(
            "module_audit_logs",
            sa.Column("id", sa.String(length=100), primary_key=True),
            sa.Column("tenant_id", sa.String(length=100), nullable=False, index=True, default="default"),
            sa.Column("module_id", sa.String(length=100), nullable=False, index=True),
            sa.Column("action", sa.String(length=50), nullable=False),
            sa.Column("previous_state", sa.String(length=50), nullable=True),
            sa.Column("new_state", sa.String(length=50), nullable=False),
            sa.Column("actor_id", sa.String(length=100), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP")),
        )


def downgrade():
    op.drop_table("module_audit_logs")
    op.drop_table("module_states")
