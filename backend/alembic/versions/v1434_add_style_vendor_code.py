"""Add governed Vendor Code ownership to Article/Style templates."""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "v1434_add_style_vendor_code"
down_revision: Union[str, Sequence[str], None] = "v1433_add_warehouse_locations"
branch_labels = None
depends_on = None


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    columns = {column["name"] for column in inspector.get_columns("variant_templates")}
    if "vendor_code" not in columns:
        op.add_column("variant_templates", sa.Column("vendor_code", sa.String(length=100), nullable=True))
        op.create_index("ix_variant_templates_vendor_code", "variant_templates", ["vendor_code"])


def downgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    columns = {column["name"] for column in inspector.get_columns("variant_templates")}
    if "vendor_code" in columns:
        op.drop_index("ix_variant_templates_vendor_code", table_name="variant_templates")
        op.drop_column("variant_templates", "vendor_code")