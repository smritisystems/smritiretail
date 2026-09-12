"""Add the governed warehouse location master."""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "v1433_add_warehouse_locations"
down_revision: Union[str, Sequence[str], None] = "v1432_add_product_vendor_code"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "warehouse_locations",
        sa.Column("id", sa.String(50), primary_key=True),
        sa.Column("uuid", sa.String(36), nullable=True, unique=True),
        sa.Column("company_id", sa.String(50), nullable=False, index=True),
        sa.Column("branch_id", sa.String(50), nullable=True, index=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("modified_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("warehouse_id", sa.String(50), sa.ForeignKey("warehouses.id", ondelete="CASCADE"), nullable=False),
        sa.Column("code", sa.String(50), nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("aisle", sa.String(50), nullable=True),
        sa.Column("rack", sa.String(50), nullable=True),
        sa.Column("shelf", sa.String(50), nullable=True),
        sa.Column("bin_code", sa.String(50), nullable=True),
        sa.UniqueConstraint("warehouse_id", "code", name="uq_warehouse_location_code"),
    )


def downgrade() -> None:
    op.drop_table("warehouse_locations")