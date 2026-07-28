"""
CR-2026-1630: Add sales_person_id to sales_invoices
Revision ID: v1216_sales_person_id
Revises: v1215_wms_loyalty_expansion
"""

from alembic import op
import sqlalchemy as sa

revision = 'v1216_sales_person_id'
down_revision = 'v1215_wms_loyalty_expansion'
branch_labels = None
depends_on = None

def upgrade() -> None:
    op.execute("ALTER TABLE sales_invoices ADD COLUMN IF NOT EXISTS sales_person_id VARCHAR(50) NULL;")
    op.execute("CREATE INDEX IF NOT EXISTS ix_sales_invoices_sales_person_id ON sales_invoices (sales_person_id);")

def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_sales_invoices_sales_person_id;")
    op.execute("ALTER TABLE sales_invoices DROP COLUMN IF EXISTS sales_person_id;")
