"""Restore the canonical Item buying_price column when absent.

Revision ID: v1426_item_buying_price_compat
Revises: v1425_psv_partner_identity
"""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "v1426_item_buying_price_compat"
down_revision: Union[str, Sequence[str], None] = "v1425_psv_partner_identity"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "items" not in inspector.get_table_names():
        return
    columns = {column["name"] for column in inspector.get_columns("items")}
    if "buying_price" not in columns:
        op.add_column("items", sa.Column("buying_price", sa.Numeric(15, 2), nullable=True))


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "items" not in inspector.get_table_names():
        return
    columns = {column["name"] for column in inspector.get_columns("items")}
    if "buying_price" in columns:
        op.drop_column("items", "buying_price")
