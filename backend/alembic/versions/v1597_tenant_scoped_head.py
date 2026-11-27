"""Declare the tenant-specific Alembic head.

Revision ID: v1597_tenant_scoped_head
Revises: v1595
# @migration_target('tenant')
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import context, op
from alembic.migration_contract import validate_migration_execution

revision: str = "v1597_tenant_scoped_head"
down_revision: str | Sequence[str] | None = "v1595"
branch_labels: str | Sequence[str] | None = ("tenant",)
depends_on = None


def upgrade() -> None:
    if not context.is_offline_mode():
        database = op.get_bind().execute(sa.text("SELECT current_database()")).scalar_one()
        validate_migration_execution("tenant", database)


def downgrade() -> None:
    raise RuntimeError(
        "Revision v1597 is a forward-only tenant-head marker. "
        "Restore a verified database backup instead of reverting it."
    )
