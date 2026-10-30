"""Brownfield compatibility migration for sales_orders.po_number.

Revision ID: v1417_so_po_compat
Revises: v1416_customer_po_billing
Create Date: 2026-09-08
"""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "v1417_so_po_compat"
down_revision: Union[str, Sequence[str], None] = "v1416_customer_po_billing"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()

    # 1. Company DB routing guard — NEVER execute on smritisys Control Plane or system DBs
    current_db = bind.execute(sa.text("SELECT current_database();")).scalar()
    if not current_db or current_db.lower() in ("smritisys", "postgres", "template0", "template1"):
        # Guard: In smritisys or system database, safe NO-OP
        return

    # 2. Check if table 'sales_orders' exists
    inspector = sa.inspect(bind)
    table_names = inspector.get_table_names()
    if "sales_orders" not in table_names:
        return

    # 3. Additive: detect missing sales_orders.po_number and add only when missing
    existing_columns = {c["name"] for c in inspector.get_columns("sales_orders")}
    if "po_number" not in existing_columns:
        op.add_column("sales_orders", sa.Column("po_number", sa.String(100), nullable=True))

    # 4. Ensure index exists
    existing_indexes = {idx["name"] for idx in inspector.get_indexes("sales_orders")}
    if "ix_sales_orders_po_number" not in existing_indexes and "idx_sales_orders_po_number" not in existing_indexes:
        op.create_index("ix_sales_orders_po_number", "sales_orders", ["po_number"])


def downgrade() -> None:
    # SMRITI Architectural Governance Rule:
    # Dropping sales_orders.po_number in production would destroy historical customer PO tracking data
    # and invalidate downstream invoice allocation linkages.
    # Downgrade is intentionally non-destructive to preserve historical commercial data.
    pass
