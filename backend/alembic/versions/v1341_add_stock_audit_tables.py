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

"""add stock audit and stock audit items tables for wms phase 4

Revision ID: v1341_add_stock_audit_tables
Revises: v1340_add_grn_sales_batch_columns
Create Date: 2026-08-22 20:45:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'v1341_add_stock_audit_tables'
down_revision = 'v1340_add_grn_sales_batches'
branch_labels = None
depends_on = None


def upgrade():
    # 1. Create stock_audits table
    op.create_table(
        'stock_audits',
        sa.Column('id', sa.String(length=50), primary_key=True),
        sa.Column('uuid', sa.String(length=36), nullable=False, unique=True),
        sa.Column('company_id', sa.String(length=50), sa.ForeignKey('companies.id', ondelete='RESTRICT'), nullable=False),
        sa.Column('branch_id', sa.String(length=50), sa.ForeignKey('branches.id', ondelete='RESTRICT'), nullable=False),
        sa.Column('audit_no', sa.String(length=100), nullable=False),
        sa.Column('warehouse_id', sa.String(length=50), sa.ForeignKey('warehouses.id', ondelete='RESTRICT'), nullable=False),
        sa.Column('audit_date', sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.Column('status', sa.String(length=30), server_default='DRAFT', nullable=False),
        sa.Column('audit_type', sa.String(length=30), server_default='CYCLE_COUNT', nullable=False),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('reconciled_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('reconciled_by', sa.String(length=100), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.Column('modified_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.Column('created_by', sa.String(length=100), nullable=True),
        sa.Column('updated_by', sa.String(length=100), nullable=True),
        sa.Column('is_active', sa.Boolean(), server_default='true', nullable=False),
        sa.Column('is_deleted', sa.Boolean(), server_default='false', nullable=False),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('deleted_by', sa.String(length=100), nullable=True),
        sa.Column('version', sa.Integer(), server_default='1', nullable=False),
        sa.CheckConstraint("status IN ('DRAFT', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED')", name='ck_stock_audit_status'),
        sa.CheckConstraint("audit_type IN ('FULL', 'CYCLE_COUNT', 'SPOT_CHECK')", name='ck_stock_audit_type')
    )
    op.create_index(
        'uq_company_audit_no_active',
        'stock_audits',
        ['company_id', 'audit_no'],
        unique=True,
        postgresql_where=sa.text('is_deleted = false')
    )

    # 2. Create stock_audit_items table
    op.create_table(
        'stock_audit_items',
        sa.Column('id', sa.String(length=50), primary_key=True),
        sa.Column('uuid', sa.String(length=36), nullable=False, unique=True),
        sa.Column('company_id', sa.String(length=50), sa.ForeignKey('companies.id', ondelete='RESTRICT'), nullable=False),
        sa.Column('branch_id', sa.String(length=50), sa.ForeignKey('branches.id', ondelete='RESTRICT'), nullable=False),
        sa.Column('audit_id', sa.String(length=50), sa.ForeignKey('stock_audits.id', ondelete='CASCADE'), nullable=False),
        sa.Column('product_id', sa.String(length=50), sa.ForeignKey('products.id', ondelete='RESTRICT'), nullable=False),
        sa.Column('batch_no', sa.String(length=100), nullable=False),
        sa.Column('system_qty', sa.Numeric(precision=12, scale=4), server_default='0.0000', nullable=False),
        sa.Column('counted_qty', sa.Numeric(precision=12, scale=4), server_default='0.0000', nullable=False),
        sa.Column('variance_qty', sa.Numeric(precision=12, scale=4), server_default='0.0000', nullable=False),
        sa.Column('unit_cost', sa.Numeric(precision=15, scale=2), server_default='0.00', nullable=False),
        sa.Column('variance_value', sa.Numeric(precision=15, scale=2), server_default='0.00', nullable=False),
        sa.Column('discrepancy_reason', sa.String(length=50), nullable=True),
        sa.Column('is_reconciled', sa.Boolean(), server_default='false', nullable=False),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.Column('modified_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.Column('created_by', sa.String(length=100), nullable=True),
        sa.Column('updated_by', sa.String(length=100), nullable=True),
        sa.Column('is_active', sa.Boolean(), server_default='true', nullable=False),
        sa.Column('is_deleted', sa.Boolean(), server_default='false', nullable=False),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('deleted_by', sa.String(length=100), nullable=True),
        sa.Column('version', sa.Integer(), server_default='1', nullable=False),
        sa.CheckConstraint("system_qty >= 0", name='ck_audit_item_system_qty_non_negative'),
        sa.CheckConstraint("counted_qty >= 0", name='ck_audit_item_counted_qty_non_negative'),
        sa.CheckConstraint(
            "discrepancy_reason IN ('PENDING_COUNT', 'MATCHED', 'DEFICIT_UNSPECIFIED', 'DAMAGED', 'EXPIRED', 'THEFT_LOSS', 'SURPLUS_FOUND', 'COUNTING_ERROR') OR discrepancy_reason IS NULL",
            name='ck_audit_item_discrepancy_reason'
        )
    )
    op.create_index('idx_stock_audit_items_audit', 'stock_audit_items', ['audit_id'])
    op.create_index(
        'uq_audit_item_product_batch_active',
        'stock_audit_items',
        ['audit_id', 'product_id', 'batch_no'],
        unique=True,
        postgresql_where=sa.text('is_deleted = false')
    )


def downgrade():
    op.drop_index('uq_audit_item_product_batch_active', table_name='stock_audit_items')
    op.drop_index('idx_stock_audit_items_audit', table_name='stock_audit_items')
    op.drop_table('stock_audit_items')
    op.drop_index('uq_company_audit_no_active', table_name='stock_audits')
    op.drop_table('stock_audits')

