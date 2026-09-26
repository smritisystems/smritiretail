"""
Add line-level PO tracking to purchase receipt items so a single GRN can allocate
multiple lines to multiple purchase orders without losing provenance.
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "v1479_receipt_po_line_tracking"
down_revision: Union[str, Sequence[str], None] = "v1478_inward_cost_components_and_allocation_ledger"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    cols = {c["name"] for c in inspector.get_columns("purchase_receipt_items")}

    if "purchase_order_id" not in cols:
        op.add_column("purchase_receipt_items", sa.Column("purchase_order_id", sa.String(50), nullable=True))
    if "purchase_order_no" not in cols:
        op.add_column("purchase_receipt_items", sa.Column("purchase_order_no", sa.String(100), nullable=True))
    if "purchase_order_line_id" not in cols:
        op.add_column("purchase_receipt_items", sa.Column("purchase_order_line_id", sa.String(50), nullable=True))

    op.create_index("ix_purchase_receipt_items_purchase_order_id", "purchase_receipt_items", ["purchase_order_id"], unique=False)
    op.create_index("ix_purchase_receipt_items_purchase_order_no", "purchase_receipt_items", ["purchase_order_no"], unique=False)
    op.create_index("ix_purchase_receipt_items_purchase_order_line_id", "purchase_receipt_items", ["purchase_order_line_id"], unique=False)


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    cols = {c["name"] for c in inspector.get_columns("purchase_receipt_items")}

    for col in ["purchase_order_id", "purchase_order_no", "purchase_order_line_id"]:
        if col in cols:
            op.drop_column("purchase_receipt_items", col)

    for idx in [
        "ix_purchase_receipt_items_purchase_order_id",
        "ix_purchase_receipt_items_purchase_order_no",
        "ix_purchase_receipt_items_purchase_order_line_id",
    ]:
        try:
            op.drop_index(idx, table_name="purchase_receipt_items")
        except Exception:
            pass
