"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.31.0
Created      : 2026-09-17
Modified     : 2026-09-17
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Schema Lifecycle & Compliance — Line-Level Sales Staff Attribution & Commission Tracking
"""

"""Add line-level salesperson attribution columns to sales_invoice_items.

Revision ID: v1459_line_level_salesperson_attribution
Revises: v1458_pos_parked_carts_lsq_and_customer_switch_audit
Create Date: 2026-09-17
"""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "v1459_line_level_salesperson_attribution"
down_revision: Union[str, Sequence[str], None] = "v1458_pos_parked_carts_lsq_and_customer_switch_audit"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()

    bind.execute(sa.text("""
        DO $$ BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'sales_invoice_items' AND column_name = 'salesperson_id'
            ) THEN
                ALTER TABLE sales_invoice_items ADD COLUMN salesperson_id VARCHAR(50) NULL;
                CREATE INDEX IF NOT EXISTS idx_sales_invoice_items_salesperson ON sales_invoice_items (salesperson_id);
            END IF;

            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'sales_invoice_items' AND column_name = 'salesperson_name'
            ) THEN
                ALTER TABLE sales_invoice_items ADD COLUMN salesperson_name VARCHAR(255) NULL;
            END IF;
        END $$;
    """))


def downgrade() -> None:
    bind = op.get_bind()
    bind.execute(sa.text("""
        DROP INDEX IF EXISTS idx_sales_invoice_items_salesperson;
        ALTER TABLE sales_invoice_items DROP COLUMN IF EXISTS salesperson_name;
        ALTER TABLE sales_invoice_items DROP COLUMN IF EXISTS salesperson_id;
    """))
