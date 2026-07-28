"""
Project      : SMRITI Retail OS
Organization : SmritiSys
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Copyright    : © SMRITIBooks.com. All Rights Reserved.

Change Request CR-2026-1615: new_field sales_person_id on SalesInvoice
Revision ID: v1216_new_field_salesinvoice_sales_person_id
Revises: v1215_wms_loyalty_expansion
Create Date: 2026-07-28T16:15:37.236133
"""
from alembic import op
import sqlalchemy as sa

revision = 'v1216_new_field_salesinvoice_sales_person_id'
down_revision = 'v1215_wms_loyalty_expansion'
branch_labels = None
depends_on = None

def upgrade() -> None:
    op.execute("ALTER TABLE sales_invoices ADD COLUMN IF NOT EXISTS sales_person_id VARCHAR(50) NULL;")
    op.execute("CREATE INDEX IF NOT EXISTS ix_sales_invoices_sales_person_id ON sales_invoices (sales_person_id);")

def downgrade() -> None:
    op.drop_column('sales_invoices', 'sales_person_id')
