"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 1.0.0
Created      : 2026-10-01
Modified     : 2026-10-01
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""
"""v1508 — PO Lifecycle Phase A: add submitted/confirmed/cancelled audit columns + parent_order_id

Revision ID : v1508
Revises     : v1507
Create Date : 2026-10-01

All columns are nullable and backward-compatible.
No existing Purchase Order rows are modified.
"""
from typing import Sequence, Union
import sqlalchemy as sa
from alembic import op

revision: str = "v1508"
down_revision: Union[str, Sequence[str], None] = "v1507"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # -- submitted audit --
    op.add_column("purchase_orders", sa.Column("submitted_by", sa.String(100), nullable=True))
    op.add_column("purchase_orders", sa.Column("submitted_at", sa.DateTime(timezone=True), nullable=True))
    # -- confirmed audit --
    op.add_column("purchase_orders", sa.Column("confirmed_by", sa.String(100), nullable=True))
    op.add_column("purchase_orders", sa.Column("confirmed_at", sa.DateTime(timezone=True), nullable=True))
    # -- cancelled audit --
    op.add_column("purchase_orders", sa.Column("cancelled_by", sa.String(100), nullable=True))
    op.add_column("purchase_orders", sa.Column("cancelled_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("purchase_orders", sa.Column("cancellation_reason", sa.Text(), nullable=True))
    # -- amendment/revision linkage --
    op.add_column("purchase_orders", sa.Column(
        "parent_order_id",
        sa.String(50),
        sa.ForeignKey("purchase_orders.id", ondelete="SET NULL"),
        nullable=True,
    ))
    op.create_index("ix_purchase_orders_parent_order_id", "purchase_orders", ["parent_order_id"])


def downgrade() -> None:
    op.drop_index("ix_purchase_orders_parent_order_id", table_name="purchase_orders")
    op.drop_column("purchase_orders", "parent_order_id")
    op.drop_column("purchase_orders", "cancellation_reason")
    op.drop_column("purchase_orders", "cancelled_at")
    op.drop_column("purchase_orders", "cancelled_by")
    op.drop_column("purchase_orders", "confirmed_at")
    op.drop_column("purchase_orders", "confirmed_by")
    op.drop_column("purchase_orders", "submitted_at")
    op.drop_column("purchase_orders", "submitted_by")
