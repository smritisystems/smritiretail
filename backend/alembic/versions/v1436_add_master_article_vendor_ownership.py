"""Add single-vendor ownership to Master Registry Article / Style values."""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "v1436_add_master_article_vendor_ownership"
down_revision: Union[str, Sequence[str], None] = "v1435_add_warehouse_location_audit_columns"
branch_labels = None
depends_on = None


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    columns = {column["name"] for column in inspector.get_columns("master_values")}
    indexes = {index["name"] for index in inspector.get_indexes("master_values")}
    if "vendor_code" not in columns:
        op.add_column("master_values", sa.Column("vendor_code", sa.String(length=100), nullable=True))
    if "ix_master_values_vendor_code" not in indexes:
        op.create_index("ix_master_values_vendor_code", "master_values", ["vendor_code"])


def downgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    indexes = {index["name"] for index in inspector.get_indexes("master_values")}
    columns = {column["name"] for column in inspector.get_columns("master_values")}
    if "ix_master_values_vendor_code" in indexes:
        op.drop_index("ix_master_values_vendor_code", table_name="master_values")
    if "vendor_code" in columns:
        op.drop_column("master_values", "vendor_code")