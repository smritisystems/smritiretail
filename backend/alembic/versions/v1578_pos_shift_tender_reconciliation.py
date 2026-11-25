"""Persist actual card and UPI settlement totals on POS shifts.

Revision ID: v1578
Revises: v1577

# @migration_target('tenant') -- shifts are tenant-scoped
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "v1578"
down_revision: Union[str, Sequence[str], None] = "v1577"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    table_exists = bind.execute(sa.text("""
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = current_schema() AND table_name = 'shifts'
    """)).scalar()
    if not table_exists:
        return

    for column in (
        "actual_card_counted",
        "card_variance",
        "actual_upi_counted",
        "upi_variance",
    ):
        bind.execute(sa.text(
            f"ALTER TABLE shifts ADD COLUMN IF NOT EXISTS {column} NUMERIC(15, 2)"
        ))


def downgrade() -> None:
    # Keep persisted closeout audit values if an application rollback is needed.
    pass
