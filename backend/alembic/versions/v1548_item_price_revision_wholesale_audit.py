"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Version      : 1.0.0
Created      : 2026-10-27
Copyright    : (c) SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal

Description  : G1 Remediation — Historical Transaction Immutability Sprint.
               Adds previous_wholesale_price and revised_wholesale_price columns
               to item_price_revisions table.

               Before this migration, wholesale price changes were applied to
               item_prices.wholesale_price (via _activate_revision_internal) but
               the revision record itself did not capture old/new wholesale values.
               This closes the audit-trail gap for wholesale price revisions.

               Zero-destructive: both columns are nullable.
               Existing revision rows correctly have NULL (unknown at creation time).
"""

import sqlalchemy as sa
from alembic import op

revision = "v1548"
down_revision = "v1547"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "item_price_revisions",
        sa.Column("previous_wholesale_price", sa.Numeric(15, 2), nullable=True),
    )
    op.add_column(
        "item_price_revisions",
        sa.Column("revised_wholesale_price", sa.Numeric(15, 2), nullable=True),
    )
    print("  v1548: added previous_wholesale_price, revised_wholesale_price to item_price_revisions")


def downgrade() -> None:
    op.drop_column("item_price_revisions", "revised_wholesale_price")
    op.drop_column("item_price_revisions", "previous_wholesale_price")
