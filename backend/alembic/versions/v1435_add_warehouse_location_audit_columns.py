"""Add BaseEntity audit columns to warehouse_locations."""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "v1435_add_warehouse_location_audit_columns"
down_revision: Union[str, Sequence[str], None] = "v1434_add_style_vendor_code"
branch_labels = None
depends_on = None


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    columns = {column["name"] for column in inspector.get_columns("warehouse_locations")}

    if "created_by" not in columns:
        op.add_column("warehouse_locations", sa.Column("created_by", sa.String(length=100), nullable=True))
    if "updated_by" not in columns:
        op.add_column("warehouse_locations", sa.Column("updated_by", sa.String(length=100), nullable=True))
    if "deleted_by" not in columns:
        op.add_column("warehouse_locations", sa.Column("deleted_by", sa.String(length=100), nullable=True))
    if "version" not in columns:
        op.add_column("warehouse_locations", sa.Column("version", sa.Integer(), nullable=False, server_default="1"))


def downgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    columns = {column["name"] for column in inspector.get_columns("warehouse_locations")}

    for col in ["created_by", "updated_by", "deleted_by", "version"]:
        if col in columns:
            op.drop_column("warehouse_locations", col)
