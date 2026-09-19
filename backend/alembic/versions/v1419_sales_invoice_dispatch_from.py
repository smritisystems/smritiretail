"""
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.31.0
 * Created      : 2026-09-09
 * Modified     : 2026-09-09
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
"""

"""Add dispatch_from_location_id and dispatch_from_snapshot to sales_invoices.

Revision ID: v1419_dispatch_from
Revises: v1418_cust_art_map
Create Date: 2026-09-09
"""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "v1419_dispatch_from"
down_revision: Union[str, Sequence[str], None] = "v1418_cust_art_map"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()

    current_db = bind.execute(sa.text("SELECT current_database();")).scalar()
    if not current_db or current_db.lower() in ("smritisys", "postgres", "template0", "template1"):
        return

    inspector = sa.inspect(bind)
    table_names = inspector.get_table_names()
    if "sales_invoices" not in table_names:
        return

    existing_cols = {col["name"] for col in inspector.get_columns("sales_invoices")}

    if "dispatch_from_location_id" not in existing_cols:
        op.add_column(
            "sales_invoices",
            sa.Column(
                "dispatch_from_location_id",
                sa.String(50),
                sa.ForeignKey("warehouses.id", ondelete="SET NULL"),
                nullable=True,
            ),
        )

    if "dispatch_from_snapshot" not in existing_cols:
        op.add_column(
            "sales_invoices",
            sa.Column(
                "dispatch_from_snapshot",
                postgresql.JSONB(astext_type=sa.Text()),
                nullable=True,
            ),
        )

    existing_indexes = {idx["name"] for idx in inspector.get_indexes("sales_invoices")}
    if "ix_sales_invoices_dispatch_from_location_id" not in existing_indexes:
        op.create_index(
            "ix_sales_invoices_dispatch_from_location_id",
            "sales_invoices",
            ["dispatch_from_location_id"],
        )


def downgrade() -> None:
    bind = op.get_bind()
    current_db = bind.execute(sa.text("SELECT current_database();")).scalar()
    if not current_db or current_db.lower() in ("smritisys", "postgres", "template0", "template1"):
        return

    inspector = sa.inspect(bind)
    if "sales_invoices" not in inspector.get_table_names():
        return

    existing_indexes = {idx["name"] for idx in inspector.get_indexes("sales_invoices")}
    if "ix_sales_invoices_dispatch_from_location_id" in existing_indexes:
        op.drop_index("ix_sales_invoices_dispatch_from_location_id", table_name="sales_invoices")

    existing_cols = {col["name"] for col in inspector.get_columns("sales_invoices")}
    if "dispatch_from_snapshot" in existing_cols:
        op.drop_column("sales_invoices", "dispatch_from_snapshot")
    if "dispatch_from_location_id" in existing_cols:
        op.drop_column("sales_invoices", "dispatch_from_location_id")
