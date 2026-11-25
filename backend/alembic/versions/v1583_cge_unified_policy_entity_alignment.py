"""Align CGE unified policies with the application model.

Revision ID: v1583
Revises: v1582
# @migration_target('tenant')
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "v1583"
down_revision: str | Sequence[str] | None = "v1582"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "cge_unified_policies" not in inspector.get_table_names():
        raise RuntimeError("Expected tenant table 'cge_unified_policies' to exist before v1583.")

    columns = {column["name"] for column in inspector.get_columns("cge_unified_policies")}
    if "policy_name" in columns and "name" not in columns:
        op.alter_column(
            "cge_unified_policies",
            "policy_name",
            new_column_name="name",
            existing_type=sa.String(255),
        )
        columns.remove("policy_name")
        columns.add("name")

    statements = (
        "ALTER TABLE cge_unified_policies ADD COLUMN IF NOT EXISTS uuid VARCHAR(36) "
        "NOT NULL DEFAULT gen_random_uuid()::varchar",
        "ALTER TABLE cge_unified_policies ADD COLUMN IF NOT EXISTS company_id VARCHAR(50)",
        "ALTER TABLE cge_unified_policies ADD COLUMN IF NOT EXISTS branch_id VARCHAR(50)",
        "ALTER TABLE cge_unified_policies ADD COLUMN IF NOT EXISTS modified_at TIMESTAMP WITH TIME ZONE "
        "DEFAULT CURRENT_TIMESTAMP",
        "ALTER TABLE cge_unified_policies ADD COLUMN IF NOT EXISTS created_by VARCHAR(100)",
        "ALTER TABLE cge_unified_policies ADD COLUMN IF NOT EXISTS updated_by VARCHAR(100)",
        "ALTER TABLE cge_unified_policies ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT FALSE",
        "ALTER TABLE cge_unified_policies ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE",
        "ALTER TABLE cge_unified_policies ADD COLUMN IF NOT EXISTS deleted_by VARCHAR(100)",
        "ALTER TABLE cge_unified_policies ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1",
        "ALTER TABLE cge_unified_policies ADD COLUMN IF NOT EXISTS name VARCHAR(255)",
        "ALTER TABLE cge_unified_policies ADD COLUMN IF NOT EXISTS max_daily_points_accrual NUMERIC(12, 2) "
        "DEFAULT 10000.00",
        "ALTER TABLE cge_unified_policies ADD COLUMN IF NOT EXISTS min_order_value_for_referral NUMERIC(15, 2) "
        "DEFAULT 500.00",
        "ALTER TABLE cge_unified_policies ADD COLUMN IF NOT EXISTS allow_self_referral BOOLEAN DEFAULT FALSE",
        "ALTER TABLE cge_unified_policies ADD COLUMN IF NOT EXISTS commission_reversal_on_refund "
        "BOOLEAN DEFAULT TRUE",
    )
    for statement in statements:
        bind.execute(sa.text(statement))

    if "policy_name" in columns:
        bind.execute(
            sa.text(
                "UPDATE cge_unified_policies "
                "SET name = COALESCE(name, policy_name, policy_code) WHERE name IS NULL"
            )
        )
    else:
        bind.execute(
            sa.text(
                "UPDATE cge_unified_policies SET name = policy_code WHERE name IS NULL"
            )
        )
    bind.execute(sa.text("ALTER TABLE cge_unified_policies ALTER COLUMN name SET NOT NULL"))

    for column in ("policy_type", "policy_scope"):
        if column in columns:
            bind.execute(
                sa.text(f"ALTER TABLE cge_unified_policies ALTER COLUMN {column} DROP NOT NULL")
            )

    bind.execute(
        sa.text(
            "CREATE UNIQUE INDEX IF NOT EXISTS ix_cge_unified_policies_uuid "
            "ON cge_unified_policies (uuid)"
        )
    )


def downgrade() -> None:
    pass
