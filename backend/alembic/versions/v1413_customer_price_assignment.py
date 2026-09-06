"""Add the canonical customer-to-price-tier assignment table."""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "v1413_customer_price_tier_assignment"
down_revision: Union[str, Sequence[str], None] = "v1412_seed_core_lookup_types"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "customer_price_assignments",
        sa.Column("id", sa.String(length=50), primary_key=True),
        sa.Column("uuid", sa.String(length=50), nullable=False),
        sa.Column("company_id", sa.String(length=50), nullable=True),
        sa.Column("branch_id", sa.String(length=50), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("modified_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_by", sa.String(length=50), nullable=True),
        sa.Column("updated_by", sa.String(length=50), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("deleted_by", sa.String(length=50), nullable=True),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("customer_id", sa.String(length=50), nullable=False),
        sa.Column("price_tier_id", sa.String(length=50), nullable=False),
        sa.Column("valid_from", sa.DateTime(timezone=True), nullable=True),
        sa.Column("valid_to", sa.DateTime(timezone=True), nullable=True),
        sa.Column("status", sa.String(length=30), nullable=False, server_default="ACTIVE"),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(["customer_id"], ["customers.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["price_tier_id"], ["customer_price_tiers.id"], ondelete="RESTRICT"),
        sa.UniqueConstraint("customer_id", name="uq_customer_price_assignment_customer"),
    )
    op.create_index("ix_customer_price_assignments_customer_id", "customer_price_assignments", ["customer_id"])
    op.create_index("ix_customer_price_assignments_price_tier_id", "customer_price_assignments", ["price_tier_id"])


def downgrade() -> None:
    op.drop_index("ix_customer_price_assignments_price_tier_id", table_name="customer_price_assignments")
    op.drop_index("ix_customer_price_assignments_customer_id", table_name="customer_price_assignments")
    op.drop_table("customer_price_assignments")