"""Add Vendor Code to the canonical product/item-master record."""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "v1432_add_product_vendor_code"
down_revision: Union[str, Sequence[str], None] = "v1431_seed_item_catalog_lookup_types"
branch_labels = None
depends_on = None


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    columns = {column["name"] for column in inspector.get_columns("products")}
    if "vendor_code" not in columns:
        op.add_column("products", sa.Column("vendor_code", sa.String(length=100), nullable=True))


def downgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    columns = {column["name"] for column in inspector.get_columns("products")}
    if "vendor_code" in columns:
        op.drop_column("products", "vendor_code")