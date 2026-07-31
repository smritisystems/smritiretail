"""Add configurable SCDM billing policy to customers.

Revision ID: v1330_scdm_billing_policy
Revises: v1320_add_ulr_enhancements
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "v1330_scdm_billing_policy"
down_revision: Union[str, Sequence[str], None] = "v1320_add_ulr_enhancements"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "customers",
        sa.Column(
            "billing_policy",
            sa.String(length=30),
            nullable=False,
            server_default="InvoiceOnDispatch",
        ),
    )


def downgrade() -> None:
    op.drop_column("customers", "billing_policy")