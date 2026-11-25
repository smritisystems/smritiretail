"""Align CRM tables with BaseEntity columns.

Revision ID: v1584
Revises: v1583
# @migration_target('tenant')
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "v1584"
down_revision: str | Sequence[str] | None = "v1583"
branch_labels = None
depends_on = None


_TABLES = (
    "crm_leads",
    "crm_opportunities",
    "crm_campaigns",
    "crm_customer_activities",
)


def upgrade() -> None:
    bind = op.get_bind()
    for table in _TABLES:
        table_exists = bind.execute(
            sa.text("""
                SELECT 1
                FROM information_schema.tables
                WHERE table_schema = current_schema() AND table_name = :table
            """),
            {"table": table},
        ).scalar()
        if not table_exists:
            raise RuntimeError(f"Expected tenant table '{table}' to exist before v1584.")

        statements = (
            f"ALTER TABLE {table} ADD COLUMN IF NOT EXISTS uuid VARCHAR(36) "
            "NOT NULL DEFAULT gen_random_uuid()::varchar",
            f"ALTER TABLE {table} ADD COLUMN IF NOT EXISTS company_id VARCHAR(50)",
            f"ALTER TABLE {table} ADD COLUMN IF NOT EXISTS branch_id VARCHAR(50)",
            f"ALTER TABLE {table} ADD COLUMN IF NOT EXISTS modified_at TIMESTAMP WITH TIME ZONE "
            "DEFAULT CURRENT_TIMESTAMP",
            f"ALTER TABLE {table} ADD COLUMN IF NOT EXISTS created_by VARCHAR(100)",
            f"ALTER TABLE {table} ADD COLUMN IF NOT EXISTS updated_by VARCHAR(100)",
            f"ALTER TABLE {table} ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE",
            f"ALTER TABLE {table} ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT FALSE",
            f"ALTER TABLE {table} ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE",
            f"ALTER TABLE {table} ADD COLUMN IF NOT EXISTS deleted_by VARCHAR(100)",
            f"ALTER TABLE {table} ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1",
            f"CREATE UNIQUE INDEX IF NOT EXISTS ix_{table}_uuid ON {table} (uuid)",
        )
        for statement in statements:
            bind.execute(sa.text(statement))


def downgrade() -> None:
    pass
