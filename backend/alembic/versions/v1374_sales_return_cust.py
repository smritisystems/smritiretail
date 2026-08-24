"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 1.0.0
Created      : 2026-08-25
Modified     : 2026-08-25
Copyright    : (c) SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software

Alembic v1374 -- Sprint 18.
Adds customer_id column to sales_returns for denormalized REVERSAL hook queries.
This eliminates the need to join back to sales_invoices to determine customer
when processing loyalty reversals, improving REDEEM hook latency.
"""

from alembic import op
import sqlalchemy as sa

revision = "v1374_sales_return_cust"
down_revision = "v1373_sales_invoice_ext"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("sales_returns", schema=None) as batch_op:
        batch_op.add_column(
            sa.Column(
                "customer_id",
                sa.String(50),
                nullable=True,
                comment="Denormalized from original invoice -- used by REDEEM loyalty hook",
            )
        )
        batch_op.create_index(
            "ix_sales_returns_customer_id",
            ["customer_id"],
        )


def downgrade() -> None:
    with op.batch_alter_table("sales_returns", schema=None) as batch_op:
        batch_op.drop_index("ix_sales_returns_customer_id")
        batch_op.drop_column("customer_id")
