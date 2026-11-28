"""Scope barcode uniqueness to each company.

Revision ID: v1598_scope_item_barcodes_by_company
Revises: v1597_tenant_scoped_head
# @migration_target('tenant')
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import context, op
from alembic.migration_contract import validate_migration_execution

revision: str = "v1598_scope_item_barcodes_by_company"
down_revision: str | Sequence[str] | None = "v1597_tenant_scoped_head"
branch_labels: str | Sequence[str] | None = None
depends_on = None


def upgrade() -> None:
    if not context.is_offline_mode():
        database = op.get_bind().execute(sa.text("SELECT current_database()")).scalar_one()
        validate_migration_execution("tenant", database)

    op.execute("ALTER TABLE item_barcodes DROP CONSTRAINT IF EXISTS item_barcodes_barcode_key")
    op.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS uq_barcodes_company_barcode "
        "ON item_barcodes (company_id, barcode) WHERE (is_deleted = false)"
    )


def downgrade() -> None:
    op.execute(
        "ALTER TABLE item_barcodes "
        "ADD CONSTRAINT item_barcodes_barcode_key UNIQUE (barcode)"
    )
