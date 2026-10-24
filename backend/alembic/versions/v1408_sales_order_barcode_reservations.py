"""Add barcode-keyed Sales Order inventory reservations.

Revision ID: v1408_so_reservation
Revises: v1401_stock_move_link
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "v1408_so_reservation"
down_revision = "v1401_stock_move_link"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "sales_order_reservations",
        sa.Column("id", sa.String(50), primary_key=True, nullable=False),
        sa.Column("uuid", sa.String(36), nullable=False, unique=True),
        sa.Column("company_id", sa.String(50), sa.ForeignKey("companies.id", ondelete="RESTRICT"), nullable=True),
        sa.Column("branch_id", sa.String(50), sa.ForeignKey("branches.id", ondelete="RESTRICT"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("modified_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("created_by", sa.String(100), nullable=True),
        sa.Column("updated_by", sa.String(100), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("deleted_by", sa.String(100), nullable=True),
        sa.Column("version", sa.Integer(), nullable=False, server_default=sa.text("1")),
        sa.Column("order_id", sa.String(50), sa.ForeignKey("sales_orders.id", ondelete="CASCADE"), nullable=False),
        sa.Column("order_item_id", sa.Integer(), sa.ForeignKey("sales_order_items.id", ondelete="CASCADE"), nullable=False),
        sa.Column("product_id", sa.String(50), sa.ForeignKey("products.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("barcode", sa.String(100), nullable=False),
        sa.Column("requested_quantity", sa.Numeric(12, 4), nullable=False),
        sa.Column("reserved_quantity", sa.Numeric(12, 4), nullable=False, server_default=sa.text("0")),
        sa.Column("released_quantity", sa.Numeric(12, 4), nullable=False, server_default=sa.text("0")),
        sa.Column("consumed_quantity", sa.Numeric(12, 4), nullable=False, server_default=sa.text("0")),
        sa.Column("status", sa.String(20), nullable=False, server_default=sa.text("'ACTIVE'")),
        sa.Column("idempotency_key", sa.String(100), nullable=False),
        sa.Column("warehouse_id", sa.String(50), nullable=True),
        sa.Column("release_reason", sa.Text(), nullable=True),
        sa.Column("metadata_json", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
    )
    op.create_index("ix_so_reservation_order_id", "sales_order_reservations", ["order_id"])
    op.create_index("ix_so_reservation_order_item_id", "sales_order_reservations", ["order_item_id"])
    op.create_index("ix_so_reservation_product_id", "sales_order_reservations", ["product_id"])
    op.create_index("ix_so_reservation_barcode", "sales_order_reservations", ["barcode"])
    op.create_index("ix_so_reservation_company_barcode_status", "sales_order_reservations", ["company_id", "barcode", "status"])
    op.create_index(
        "uq_so_reservation_active_line",
        "sales_order_reservations",
        ["order_item_id"],
        unique=True,
        postgresql_where=sa.text("status IN ('ACTIVE', 'PARTIAL') AND is_deleted = false"),
    )


def downgrade() -> None:
    op.drop_table("sales_order_reservations")
