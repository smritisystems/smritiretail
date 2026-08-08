"""Restrict invoice GST rates to statutory slabs.

Revision ID: v1332_gst_rate_slabs
Revises: v1331_scdm_policy_snapshot
"""

from typing import Sequence, Union

from alembic import op


revision: str = "v1332_gst_rate_slabs"
down_revision: Union[str, Sequence[str], None] = "v1331_scdm_policy_snapshot"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_check_constraint(
        "ck_sales_invoice_items_gst_rate_slab",
        "sales_invoice_items",
        "gst_rate IN (0, 0.25, 3, 5, 12, 18, 28)",
    )


def downgrade() -> None:
    op.drop_constraint(
        "ck_sales_invoice_items_gst_rate_slab",
        "sales_invoice_items",
        type_="check",
    )