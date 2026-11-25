"""Add the route identifier to distribution orders.

Revision ID: v1585
Revises: v1584
# @migration_target('tenant')
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "v1585"
down_revision: str | Sequence[str] | None = "v1584"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    table_exists = bind.execute(
        sa.text("""
            SELECT 1
            FROM information_schema.tables
            WHERE table_schema = current_schema() AND table_name = 'distribution_orders'
        """)
    ).scalar()
    if not table_exists:
        raise RuntimeError("Expected tenant table 'distribution_orders' to exist before v1585.")

    bind.execute(
        sa.text(
            "ALTER TABLE distribution_orders "
            "ADD COLUMN IF NOT EXISTS route_id VARCHAR(50)"
        )
    )
    bind.execute(
        sa.text(
            "CREATE INDEX IF NOT EXISTS ix_distribution_orders_route_id "
            "ON distribution_orders (route_id)"
        )
    )


def downgrade() -> None:
    bind = op.get_bind()
    bind.execute(sa.text("DROP INDEX IF EXISTS ix_distribution_orders_route_id"))
    bind.execute(
        sa.text("ALTER TABLE distribution_orders DROP COLUMN IF EXISTS route_id")
    )
