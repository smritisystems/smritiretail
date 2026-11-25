"""Align approval policies with BaseEntity columns.

Revision ID: v1579
Revises: v1578
# @migration_target('tenant')
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "v1579"
down_revision: Union[str, Sequence[str], None] = "v1578"
branch_labels = None
depends_on = None


_TABLE = "approval_policies"


def upgrade() -> None:
    bind = op.get_bind()
    table_exists = bind.execute(
        sa.text("""
            SELECT 1
            FROM information_schema.tables
            WHERE table_schema = current_schema() AND table_name = :table
        """),
        {"table": _TABLE},
    ).scalar()
    if not table_exists:
        raise RuntimeError(f"Expected tenant table '{_TABLE}' to exist before v1579.")

    statements = (
        f"ALTER TABLE {_TABLE} ADD COLUMN IF NOT EXISTS uuid VARCHAR(36) "
        "NOT NULL DEFAULT gen_random_uuid()::varchar",
        f"ALTER TABLE {_TABLE} ADD COLUMN IF NOT EXISTS company_id VARCHAR(50)",
        f"ALTER TABLE {_TABLE} ADD COLUMN IF NOT EXISTS branch_id VARCHAR(50)",
        f"ALTER TABLE {_TABLE} ADD COLUMN IF NOT EXISTS modified_at TIMESTAMP WITH TIME ZONE "
        "DEFAULT CURRENT_TIMESTAMP",
        f"ALTER TABLE {_TABLE} ADD COLUMN IF NOT EXISTS created_by VARCHAR(100)",
        f"ALTER TABLE {_TABLE} ADD COLUMN IF NOT EXISTS updated_by VARCHAR(100)",
        f"ALTER TABLE {_TABLE} ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE",
        f"ALTER TABLE {_TABLE} ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT FALSE",
        f"ALTER TABLE {_TABLE} ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE",
        f"ALTER TABLE {_TABLE} ADD COLUMN IF NOT EXISTS deleted_by VARCHAR(100)",
        f"ALTER TABLE {_TABLE} ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1",
        f"CREATE UNIQUE INDEX IF NOT EXISTS ix_{_TABLE}_uuid ON {_TABLE} (uuid)",
    )
    for statement in statements:
        bind.execute(sa.text(statement))


def downgrade() -> None:
    # Keep additive identity and audit metadata to avoid discarding persisted data.
    pass
