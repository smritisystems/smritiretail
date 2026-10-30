"""v1543: Add show_child_customers_in_billing to customers for parent-controlled child customer visibility

Revision ID: v1543
Revises: v1542
Create Date: 2026-10-22

Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.99.13
Copyright    : (c) SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Database Migration
"""
from alembic import op
import sqlalchemy as sa

revision = "v1543"
down_revision = "v1542"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Add show_child_customers_in_billing column with default false to customers
    op.execute(sa.text("""
        ALTER TABLE customers
        ADD COLUMN IF NOT EXISTS show_child_customers_in_billing BOOLEAN NOT NULL DEFAULT FALSE;
    """))

    # 2. Add index to optimize billing customer queries
    op.execute(sa.text("""
        CREATE INDEX IF NOT EXISTS ix_customers_show_child_billing
        ON customers (company_id, show_child_customers_in_billing)
        WHERE is_deleted = false;
    """))


def downgrade() -> None:
    op.execute(sa.text("""
        DROP INDEX IF EXISTS ix_customers_show_child_billing;
    """))
    op.execute(sa.text("""
        ALTER TABLE customers
        DROP COLUMN IF EXISTS show_child_customers_in_billing;
    """))
