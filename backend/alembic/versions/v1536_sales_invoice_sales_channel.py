"""
Project      : SMRITI Retail OS
Repository   : SMRITIRetailNX
Organization : AITDL NETWORKS

Founders
* Pushpa Devi Jawahar Mallah
  * Founder & Chairperson
* Jawahar Ramkripal Mallah
  * Founder, Chief Executive Officer (CEO) & Chief Software Architect

Websites: aitdl.com | erpnbook.com | smritibooks.com

Revision ID: v1536_sales_invoice_sales_channel
Revises: v1535_psv_parties_store_uniqueness
Create Date: 2026-10-17
Classification: Sales & Modern Trade — Sales Invoice Sales Channel Persistence
"""

from collections.abc import Sequence
import sqlalchemy as sa
from alembic import op

revision: str = "v1536_sales_invoice_sales_channel"
down_revision: str | Sequence[str] | None = "v1535_psv_parties_store_uniqueness"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Add sales_channel column with server default 'B2B_WHOLESALE'
    op.execute(
        """
        ALTER TABLE sales_invoices 
        ADD COLUMN IF NOT EXISTS sales_channel VARCHAR(50) NOT NULL DEFAULT 'B2B_WHOLESALE';
        """
    )

    # 2. Backfill any existing records that might have NULL
    op.execute(
        """
        UPDATE sales_invoices 
        SET sales_channel = 'B2B_WHOLESALE' 
        WHERE sales_channel IS NULL;
        """
    )

    # 3. Performance Index on sales_channel
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS ix_sales_invoices_sales_channel 
        ON sales_invoices (sales_channel);
        """
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_sales_invoices_sales_channel;")
    op.execute("ALTER TABLE sales_invoices DROP COLUMN IF EXISTS sales_channel;")
