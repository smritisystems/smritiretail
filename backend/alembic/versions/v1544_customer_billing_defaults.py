"""Add customer-level billing channel and PO policy overrides.

Revision ID: v1544
Revises: v1543
Create Date: 2026-10-25
"""
from alembic import op
import sqlalchemy as sa

revision = "v1544"
down_revision = "v1543"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "customer_policies",
        sa.Column("default_sales_channel", sa.String(length=50), nullable=True),
    )
    op.add_column(
        "customer_policies",
        sa.Column("require_po_number", sa.Boolean(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("customer_policies", "require_po_number")
    op.drop_column("customer_policies", "default_sales_channel")
