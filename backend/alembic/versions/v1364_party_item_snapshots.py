"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.22.0
Created      : 2026-08-23
Modified     : 2026-08-23
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal

FORWARD-ONLY MIGRATION -- Party/Item Convergence & Transaction Governance Snapshots (P1 Section 6)
"""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision: str = "v1364_party_item_snapshots"
down_revision: Union[str, None] = "v1363_governed_logic"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade():
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    tables = inspector.get_table_names()

    # 1. Update sales_invoices with party_id, governance_snapshot_id, and rule_snapshots
    if "sales_invoices" in tables:
        cols = {c["name"] for c in inspector.get_columns("sales_invoices")}
        if "party_id" not in cols:
            op.add_column("sales_invoices", sa.Column("party_id", sa.String(50), nullable=True))
            op.create_index("ix_sales_invoices_party_id", "sales_invoices", ["party_id"])
        if "governance_snapshot_id" not in cols:
            op.add_column("sales_invoices", sa.Column("governance_snapshot_id", sa.String(50), nullable=True))
        if "rule_snapshots" not in cols:
            op.add_column("sales_invoices", sa.Column("rule_snapshots", JSONB, server_default=sa.text("'{}'::jsonb"), nullable=False))

    # 2. Update purchase_orders with party_id, governance_snapshot_id, and rule_snapshots
    if "purchase_orders" in tables:
        cols = {c["name"] for c in inspector.get_columns("purchase_orders")}
        if "party_id" not in cols:
            op.add_column("purchase_orders", sa.Column("party_id", sa.String(50), nullable=True))
            op.create_index("ix_purchase_orders_party_id", "purchase_orders", ["party_id"])
        if "governance_snapshot_id" not in cols:
            op.add_column("purchase_orders", sa.Column("governance_snapshot_id", sa.String(50), nullable=True))
        if "rule_snapshots" not in cols:
            op.add_column("purchase_orders", sa.Column("rule_snapshots", JSONB, server_default=sa.text("'{}'::jsonb"), nullable=False))


def downgrade():
    raise NotImplementedError(
        "v1364_party_item_snapshots is a FORWARD-ONLY migration. "
        "Downgrade is blocked by SMRITI Data Governance Policy."
    )
