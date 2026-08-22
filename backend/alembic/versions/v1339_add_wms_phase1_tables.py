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

"""add wms phase 1 tables and scoped constraints

Revision ID: v1339_add_wms_phase1_tables
Revises: v1338_company_isolated_barcodes
Create Date: 2026-08-22 19:30:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'v1339_add_wms_phase1_tables'
down_revision = 'v1338_company_isolated_barcodes'
branch_labels = None
depends_on = None


def upgrade():
    # 1. Extend warehouses table if not existing
    conn = op.get_bind()
    
    # 2. Add columns to warehouses
    op.add_column('warehouses', sa.Column('is_central_godown', sa.Boolean(), server_default='false', nullable=True))
    op.add_column('warehouses', sa.Column('city', sa.String(length=100), nullable=True))
    op.add_column('warehouses', sa.Column('state', sa.String(length=100), nullable=True))
    op.add_column('warehouses', sa.Column('pincode', sa.String(length=10), nullable=True))
    op.add_column('warehouses', sa.Column('contact_person', sa.String(length=100), nullable=True))
    op.add_column('warehouses', sa.Column('phone', sa.String(length=20), nullable=True))

    # 3. Add warehouse_id to stock_movements
    op.add_column('stock_movements', sa.Column('warehouse_id', sa.String(length=50), sa.ForeignKey('warehouses.id', ondelete='SET NULL'), nullable=True))

    # 4. Create product_batch_stocks
    op.create_table(
        'product_batch_stocks',
        sa.Column('id', sa.String(length=50), primary_key=True),
        sa.Column('uuid', sa.String(length=50), nullable=False),
        sa.Column('company_id', sa.String(length=50), nullable=True),
        sa.Column('branch_id', sa.String(length=50), nullable=True),
        sa.Column('product_id', sa.String(length=50), sa.ForeignKey('products.id', ondelete='RESTRICT'), nullable=False),
        sa.Column('warehouse_id', sa.String(length=50), sa.ForeignKey('warehouses.id', ondelete='RESTRICT'), nullable=False),
        sa.Column('batch_no', sa.String(length=100), nullable=False),
        sa.Column('mfg_date', sa.Date(), nullable=True),
        sa.Column('expiry_date', sa.Date(), nullable=True),
        sa.Column('mrp', sa.Numeric(precision=15, scale=2), nullable=True),
        sa.Column('purchase_rate', sa.Numeric(precision=15, scale=2), nullable=True),
        sa.Column('sale_rate', sa.Numeric(precision=15, scale=2), nullable=True),
        sa.Column('quantity', sa.Numeric(precision=12, scale=4), server_default='0.0000', nullable=False),
        sa.Column('reserved_quantity', sa.Numeric(precision=12, scale=4), server_default='0.0000', nullable=False),
        sa.Column('damaged_quantity', sa.Numeric(precision=12, scale=4), server_default='0.0000', nullable=False),
        sa.Column('last_counted_date', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.Column('modified_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.Column('created_by', sa.String(length=50), nullable=True),
        sa.Column('updated_by', sa.String(length=50), nullable=True),
        sa.Column('is_active', sa.Boolean(), server_default='true', nullable=True),
        sa.Column('is_deleted', sa.Boolean(), server_default='false', nullable=True),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('deleted_by', sa.String(length=50), nullable=True),
        sa.Column('version', sa.Integer(), server_default='1', nullable=True),
        sa.CheckConstraint('quantity >= 0 AND reserved_quantity >= 0 AND damaged_quantity >= 0', name='chk_batch_stock_positive'),
    )
    op.create_index('uq_company_wh_prod_batch_active', 'product_batch_stocks', ['company_id', 'warehouse_id', 'product_id', 'batch_no'], unique=True, postgresql_where=sa.text('is_deleted = false'))
    op.create_index('idx_batch_stock_expiry', 'product_batch_stocks', ['expiry_date'])

    # 5. Cleanly create stock_transfers and stock_transfer_items
    conn.execute(sa.text("DROP TABLE IF EXISTS stock_transfer_items CASCADE;"))
    conn.execute(sa.text("DROP TABLE IF EXISTS stock_transfers CASCADE;"))

    op.create_table(
        'stock_transfers',
        sa.Column('id', sa.String(length=50), primary_key=True),
        sa.Column('uuid', sa.String(length=50), nullable=False),
        sa.Column('company_id', sa.String(length=50), nullable=True),
        sa.Column('branch_id', sa.String(length=50), nullable=True),
        sa.Column('transfer_no', sa.String(length=100), nullable=False),
        sa.Column('source_warehouse_id', sa.String(length=50), sa.ForeignKey('warehouses.id', ondelete='RESTRICT'), nullable=False),
        sa.Column('dest_warehouse_id', sa.String(length=50), sa.ForeignKey('warehouses.id', ondelete='RESTRICT'), nullable=False),
        sa.Column('status', sa.String(length=30), server_default='DRAFT', nullable=False),
        sa.Column('dispatch_date', sa.DateTime(timezone=True), nullable=True),
        sa.Column('received_date', sa.DateTime(timezone=True), nullable=True),
        sa.Column('transporter_name', sa.String(length=100), nullable=True),
        sa.Column('lr_number', sa.String(length=100), nullable=True),
        sa.Column('vehicle_number', sa.String(length=50), nullable=True),
        sa.Column('e_way_bill_no', sa.String(length=50), nullable=True),
        sa.Column('idempotency_key', sa.String(length=100), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.Column('modified_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.Column('created_by', sa.String(length=50), nullable=True),
        sa.Column('updated_by', sa.String(length=50), nullable=True),
        sa.Column('is_active', sa.Boolean(), server_default='true', nullable=True),
        sa.Column('is_deleted', sa.Boolean(), server_default='false', nullable=True),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('deleted_by', sa.String(length=50), nullable=True),
        sa.Column('version', sa.Integer(), server_default='1', nullable=True),
        sa.CheckConstraint('source_warehouse_id != dest_warehouse_id', name='chk_transfers_diff_warehouses'),
    )
    op.create_index('uq_company_transfer_no_active', 'stock_transfers', ['company_id', 'transfer_no'], unique=True, postgresql_where=sa.text('is_deleted = false'))
    op.create_index('uq_company_transfer_idempotency_active', 'stock_transfers', ['company_id', 'idempotency_key'], unique=True, postgresql_where=sa.text('is_deleted = false AND idempotency_key IS NOT NULL'))

    # 6. Create stock_transfer_items
    op.create_table(
        'stock_transfer_items',
        sa.Column('id', sa.String(length=50), primary_key=True),
        sa.Column('uuid', sa.String(length=50), nullable=False),
        sa.Column('company_id', sa.String(length=50), nullable=True),
        sa.Column('branch_id', sa.String(length=50), nullable=True),
        sa.Column('transfer_id', sa.String(length=50), sa.ForeignKey('stock_transfers.id', ondelete='CASCADE'), nullable=False),
        sa.Column('product_id', sa.String(length=50), sa.ForeignKey('products.id', ondelete='RESTRICT'), nullable=False),
        sa.Column('batch_no', sa.String(length=100), nullable=False),
        sa.Column('quantity_dispatched', sa.Numeric(precision=12, scale=4), nullable=False),
        sa.Column('quantity_received', sa.Numeric(precision=12, scale=4), server_default='0.0000', nullable=False),
        sa.Column('quantity_shortage', sa.Numeric(precision=12, scale=4), server_default='0.0000', nullable=False),
        sa.Column('quantity_damaged', sa.Numeric(precision=12, scale=4), server_default='0.0000', nullable=False),
        sa.Column('unit_cost', sa.Numeric(precision=15, scale=2), nullable=False),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.Column('modified_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.Column('created_by', sa.String(length=50), nullable=True),
        sa.Column('updated_by', sa.String(length=50), nullable=True),
        sa.Column('is_active', sa.Boolean(), server_default='true', nullable=True),
        sa.Column('is_deleted', sa.Boolean(), server_default='false', nullable=True),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('deleted_by', sa.String(length=50), nullable=True),
        sa.Column('version', sa.Integer(), server_default='1', nullable=True),
        sa.CheckConstraint('quantity_dispatched > 0 AND quantity_received >= 0 AND quantity_shortage >= 0 AND quantity_damaged >= 0', name='chk_transfer_item_quantities'),
    )


def downgrade():
    op.drop_table('stock_transfer_items')
    op.drop_table('stock_transfers')
    op.drop_table('product_batch_stocks')
    op.drop_column('stock_movements', 'warehouse_id')
    op.drop_column('warehouses', 'phone')
    op.drop_column('warehouses', 'contact_person')
    op.drop_column('warehouses', 'pincode')
    op.drop_column('warehouses', 'state')
    op.drop_column('warehouses', 'city')
    op.drop_column('warehouses', 'is_central_godown')
