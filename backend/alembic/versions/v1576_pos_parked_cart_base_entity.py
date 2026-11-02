"""Align POS parked carts with BaseEntity columns.

Revision ID: v1576
Revises: v1575
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "v1576"
down_revision: Union[str, Sequence[str], None] = "v1575"
branch_labels = None
depends_on = None


_TABLE = "pos_parked_carts"


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
        return

    statements = (
        f"ALTER TABLE {_TABLE} ADD COLUMN IF NOT EXISTS uuid VARCHAR(36) "
        "NOT NULL DEFAULT gen_random_uuid()::varchar",
        f"ALTER TABLE {_TABLE} ADD COLUMN IF NOT EXISTS modified_at TIMESTAMP WITH TIME ZONE "
        "DEFAULT CURRENT_TIMESTAMP",
        f"ALTER TABLE {_TABLE} ADD COLUMN IF NOT EXISTS created_by VARCHAR(100)",
        f"ALTER TABLE {_TABLE} ADD COLUMN IF NOT EXISTS updated_by VARCHAR(100)",
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
