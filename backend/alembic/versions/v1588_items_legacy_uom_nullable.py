"""Make the deprecated item UOM alias nullable.

Revision ID: v1588
Revises: v1587
# @migration_target('tenant')
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "v1588"
down_revision: str | Sequence[str] | None = "v1587"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    table_exists = bind.execute(
        sa.text("""
            SELECT 1
            FROM information_schema.tables
            WHERE table_schema = current_schema() AND table_name = 'items'
        """)
    ).scalar()
    if not table_exists:
        raise RuntimeError("Expected tenant table 'items' to exist before v1588.")

    bind.execute(sa.text("ALTER TABLE items ALTER COLUMN uom DROP NOT NULL"))


def downgrade() -> None:
    pass
