"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.22.0
Created      : 2026-08-23
Modified     : 2026-08-23
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal

FORWARD-ONLY MIGRATION -- Platform Capabilities Dependencies & Entitlements (P1.2)
"""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision: str = "v1362_platform_capabilities"
down_revision: Union[str, None] = "v1361_global_reference_data"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade():
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    tables = inspector.get_table_names()

    if "platform_capabilities" in tables:
        cols = {c["name"] for c in inspector.get_columns("platform_capabilities")}
        if "dependencies" not in cols:
            op.add_column(
                "platform_capabilities",
                sa.Column("dependencies", JSONB, server_default=sa.text("'[]'::jsonb"), nullable=False)
            )
        if "min_version" not in cols:
            op.add_column(
                "platform_capabilities",
                sa.Column("min_version", sa.String(20), server_default="1.0.0", nullable=False)
            )
        if "is_core" not in cols:
            op.add_column(
                "platform_capabilities",
                sa.Column("is_core", sa.Boolean(), server_default="false", nullable=False)
            )

    if "tenant_capability_bindings" in tables:
        cols = {c["name"] for c in inspector.get_columns("tenant_capability_bindings")}
        if "plan_tier" not in cols:
            op.add_column(
                "tenant_capability_bindings",
                sa.Column("plan_tier", sa.String(30), server_default="ENTERPRISE", nullable=False)
            )

    if "feature_flags" not in tables:
        op.create_table(
            "feature_flags",
            sa.Column("id", sa.String(50), primary_key=True),
            sa.Column("uuid", sa.String(36), nullable=False, unique=True),
            sa.Column("company_id", sa.String(50), nullable=True),
            sa.Column("branch_id", sa.String(50), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()"), nullable=False),
            sa.Column("modified_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()"), nullable=False),
            sa.Column("created_by", sa.String(100), nullable=True),
            sa.Column("updated_by", sa.String(100), nullable=True),
            sa.Column("is_active", sa.Boolean(), server_default="true", nullable=False),
            sa.Column("is_deleted", sa.Boolean(), server_default="false", nullable=False),
            sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("deleted_by", sa.String(100), nullable=True),
            sa.Column("version", sa.Integer(), server_default="1", nullable=False),
            sa.Column("key", sa.String(100), nullable=False, unique=True),
            sa.Column("name", sa.String(200), nullable=False),
            sa.Column("category", sa.String(50), server_default="GENERAL", nullable=False),
            sa.Column("description", sa.Text(), nullable=True),
            sa.Column("is_global_enabled", sa.Boolean(), server_default="false", nullable=False),
            sa.Column("company_overrides", JSONB, server_default=sa.text("'{}'::jsonb"), nullable=False),
        )


def downgrade():
    raise NotImplementedError(
        "v1362_platform_capabilities is a FORWARD-ONLY migration. "
        "Downgrade is blocked by SMRITI Data Governance Policy."
    )
