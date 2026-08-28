"""
Add tenant-scoped idempotency keys for Sales Return creation.

The key is optional for backward compatibility with existing callers. When
provided, the partial unique index prevents duplicate active returns for the
same company and branch while allowing legacy rows without a key.
"""

from alembic import op
import sqlalchemy as sa

revision = "v1376_sales_return_idempotency"
down_revision = "v1375_backfill_sales_return_cust"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "sales_returns",
        sa.Column("idempotency_key", sa.String(length=100), nullable=True),
    )
    op.create_index(
        "uq_sales_return_idempotency_active",
        "sales_returns",
        ["company_id", "branch_id", "idempotency_key"],
        unique=True,
        postgresql_where=sa.text("is_deleted = false AND idempotency_key IS NOT NULL"),
    )


def downgrade() -> None:
    op.drop_index("uq_sales_return_idempotency_active", table_name="sales_returns")
    op.drop_column("sales_returns", "idempotency_key")
