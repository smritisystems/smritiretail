"""Enforce active warehouse code uniqueness per company.

Revision ID: v1589
Revises: v1588
# @migration_target('tenant')
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa

revision: str = "v1589"
down_revision: str | Sequence[str] | None = "v1588"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_index(
        "uq_company_warehouse_code_active",
        "warehouses",
        ["company_id", "code"],
        unique=True,
        postgresql_where=sa.text("is_deleted = false"),
    )


def downgrade() -> None:
    op.drop_index("uq_company_warehouse_code_active", table_name="warehouses")
