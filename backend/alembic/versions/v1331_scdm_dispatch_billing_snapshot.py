"""Snapshot billing policy on SCDM channel dispatches.

Revision ID: v1331_scdm_policy_snapshot
Revises: v1330_scdm_billing_policy
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "v1331_scdm_policy_snapshot"
down_revision: Union[str, Sequence[str], None] = "v1330_scdm_billing_policy"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "scdm_channel_dispatches",
        sa.Column(
            "billing_policy",
            sa.String(length=30),
            nullable=False,
            server_default="InvoiceOnDispatch",
        ),
    )


def downgrade() -> None:
    op.drop_column("scdm_channel_dispatches", "billing_policy")