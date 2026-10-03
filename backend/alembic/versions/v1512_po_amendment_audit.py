"""
v1512 — PO Amendment audit columns: amended_by, amended_at, amend_revision.

Phase D: Amendment/Revision Chain
───────────────────────────────────
Adds three columns to purchase_orders:
  • amended_by     — user_id or name who initiated the amendment
  • amended_at     — UTC timestamp of amendment
  • amend_revision — integer revision counter (0 = original, 1 = first amendment, …)

The parent_order_id FK (added in v1508) already links the chain back.
These three columns complete the amendment audit trail.

Author  : Jawahar Ramkripal Mallah <support@smritibooks.com>
Created : 2026-10-01
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "v1512_po_amendment_audit"
down_revision: Union[str, Sequence[str], None] = "v1511_po_cancel_reason_master"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)

    existing = {c["name"] for c in inspector.get_columns("purchase_orders")}

    if "amended_by" not in existing:
        op.add_column(
            "purchase_orders",
            sa.Column("amended_by", sa.String(100), nullable=True),
        )

    if "amended_at" not in existing:
        op.add_column(
            "purchase_orders",
            sa.Column("amended_at", sa.DateTime(timezone=True), nullable=True),
        )

    if "amend_revision" not in existing:
        op.add_column(
            "purchase_orders",
            sa.Column(
                "amend_revision",
                sa.Integer,
                nullable=False,
                server_default="0",
            ),
        )

    # Index amend_revision for efficient chain traversal
    existing_indexes = {idx["name"] for idx in inspector.get_indexes("purchase_orders")}
    if "ix_purchase_orders_amend_revision" not in existing_indexes:
        op.create_index(
            "ix_purchase_orders_amend_revision",
            "purchase_orders",
            ["amend_revision"],
        )


def downgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    existing = {c["name"] for c in inspector.get_columns("purchase_orders")}
    existing_indexes = {idx["name"] for idx in inspector.get_indexes("purchase_orders")}

    if "ix_purchase_orders_amend_revision" in existing_indexes:
        op.drop_index("ix_purchase_orders_amend_revision", table_name="purchase_orders")

    for col in ("amend_revision", "amended_at", "amended_by"):
        if col in existing:
            op.drop_column("purchase_orders", col)
