"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.16.0
Created      : 2026-08-22
Modified     : 2026-08-22
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

"""add grn and sales batch columns for wms phase 2

Revision ID: v1340_add_grn_sales_batch_columns
Revises: v1339_add_wms_phase1_tables
Create Date: 2026-08-22 19:36:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'v1340_add_grn_sales_batches'
down_revision = 'v1339_add_wms_phase1_tables'
branch_labels = None
depends_on = None


def upgrade():
    # 1. Extend purchase_receipts table
    op.add_column('purchase_receipts', sa.Column('warehouse_id', sa.String(length=50), sa.ForeignKey('warehouses.id', ondelete='RESTRICT'), nullable=True))

    # 2. Extend purchase_receipt_items table
    op.add_column('purchase_receipt_items', sa.Column('batch_no', sa.String(length=100), nullable=True))
    op.add_column('purchase_receipt_items', sa.Column('mfg_date', sa.Date(), nullable=True))
    op.add_column('purchase_receipt_items', sa.Column('expiry_date', sa.Date(), nullable=True))
    op.add_column('purchase_receipt_items', sa.Column('mrp', sa.Numeric(precision=15, scale=2), nullable=True))
    op.add_column('purchase_receipt_items', sa.Column('quantity_damaged', sa.Numeric(precision=10, scale=2), server_default='0.00', nullable=True))

    # 3. Extend sales_invoices table
    op.add_column('sales_invoices', sa.Column('warehouse_id', sa.String(length=50), sa.ForeignKey('warehouses.id', ondelete='RESTRICT'), nullable=True))

    # 4. Extend sales_invoice_items table
    op.add_column('sales_invoice_items', sa.Column('batch_no', sa.String(length=100), nullable=True))


def downgrade():
    op.drop_column('sales_invoice_items', 'batch_no')
    op.drop_column('sales_invoices', 'warehouse_id')
    op.drop_column('purchase_receipt_items', 'quantity_damaged')
    op.drop_column('purchase_receipt_items', 'mrp')
    op.drop_column('purchase_receipt_items', 'expiry_date')
    op.drop_column('purchase_receipt_items', 'mfg_date')
    op.drop_column('purchase_receipt_items', 'batch_no')
    op.drop_column('purchase_receipts', 'warehouse_id')
