"""
Project      : SMRITI Retail OS
Organization : SmritiSys
Module       : DB Migration — WMS Multi-Bin & Loyalty Engine Expansion
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Copyright    : © SMRITIBooks.com. All Rights Reserved.
Version      : 12.15.0
Created      : 2026-07-28

Revision ID: v1215_wms_loyalty_expansion
Revises: v1214_crm_expansion
Create Date: 2026-07-28 14:30:00

DBP Reference: SMRITI_DATABASE_BLUEPRINT_v1.0.md §2.5 (Inventory/WMS) & §2.3 (CRM/Loyalty)
Milestone 5 Tasks G-1..G-5 & H-1..H-5
- warehouse_zones
- warehouse_bins
- stock_bin_assignments
- loyalty_point_transactions
"""

from alembic import op
import sqlalchemy as sa

revision = 'v1215_wms_loyalty_expansion'
down_revision = 'v1214_crm_expansion'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. warehouse_zones
    op.create_table(
        'warehouse_zones',
        sa.Column('id', sa.String(length=50), nullable=False),
        sa.Column('company_id', sa.String(length=50), nullable=True),
        sa.Column('branch_id', sa.String(length=50), nullable=True),
        sa.Column('tenant_id', sa.String(length=50), nullable=True),
        sa.Column('is_deleted', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('created_by', sa.String(length=50), nullable=True),
        sa.Column('updated_by', sa.String(length=50), nullable=True),
        sa.Column('version', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('warehouse_id', sa.String(length=50), nullable=False),
        sa.Column('zone_code', sa.String(length=50), nullable=False),
        sa.Column('zone_name', sa.String(length=200), nullable=False),
        sa.Column('zone_type', sa.String(length=50), nullable=False, server_default='STORAGE'),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.ForeignKeyConstraint(['warehouse_id'], ['warehouses.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('zone_code')
    )
    op.create_index('ix_warehouse_zones_warehouse_id', 'warehouse_zones', ['warehouse_id'], unique=False)

    # 2. warehouse_bins
    op.create_table(
        'warehouse_bins',
        sa.Column('id', sa.String(length=50), nullable=False),
        sa.Column('company_id', sa.String(length=50), nullable=True),
        sa.Column('branch_id', sa.String(length=50), nullable=True),
        sa.Column('tenant_id', sa.String(length=50), nullable=True),
        sa.Column('is_deleted', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('created_by', sa.String(length=50), nullable=True),
        sa.Column('updated_by', sa.String(length=50), nullable=True),
        sa.Column('version', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('warehouse_id', sa.String(length=50), nullable=False),
        sa.Column('zone_id', sa.String(length=50), nullable=True),
        sa.Column('bin_code', sa.String(length=50), nullable=False),
        sa.Column('aisle', sa.String(length=20), nullable=True),
        sa.Column('rack', sa.String(length=20), nullable=True),
        sa.Column('shelf', sa.String(length=20), nullable=True),
        sa.Column('bin_type', sa.String(length=50), nullable=False, server_default='STANDARD'),
        sa.Column('max_weight_kg', sa.Numeric(precision=10, scale=2), nullable=False, server_default='500.00'),
        sa.Column('current_weight_kg', sa.Numeric(precision=10, scale=2), nullable=False, server_default='0.00'),
        sa.Column('is_occupied', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.ForeignKeyConstraint(['warehouse_id'], ['warehouses.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['zone_id'], ['warehouse_zones.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('bin_code')
    )
    op.create_index('ix_warehouse_bins_warehouse_id', 'warehouse_bins', ['warehouse_id'], unique=False)
    op.create_index('ix_warehouse_bins_zone_id', 'warehouse_bins', ['zone_id'], unique=False)

    # 3. stock_bin_assignments
    op.create_table(
        'stock_bin_assignments',
        sa.Column('id', sa.String(length=50), nullable=False),
        sa.Column('is_deleted', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('created_by', sa.String(length=50), nullable=True),
        sa.Column('updated_by', sa.String(length=50), nullable=True),
        sa.Column('version', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('product_id', sa.String(length=50), nullable=False),
        sa.Column('bin_id', sa.String(length=50), nullable=False),
        sa.Column('quantity', sa.Numeric(precision=15, scale=2), nullable=False, server_default='0.00'),
        sa.ForeignKeyConstraint(['bin_id'], ['warehouse_bins.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['product_id'], ['products.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_stock_bin_assignments_bin_id', 'stock_bin_assignments', ['bin_id'], unique=False)
    op.create_index('ix_stock_bin_assignments_product_id', 'stock_bin_assignments', ['product_id'], unique=False)

    # 4. loyalty_point_transactions
    op.create_table(
        'loyalty_point_transactions',
        sa.Column('id', sa.String(length=50), nullable=False),
        sa.Column('company_id', sa.String(length=50), nullable=True),
        sa.Column('branch_id', sa.String(length=50), nullable=True),
        sa.Column('tenant_id', sa.String(length=50), nullable=True),
        sa.Column('is_deleted', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('created_by', sa.String(length=50), nullable=True),
        sa.Column('updated_by', sa.String(length=50), nullable=True),
        sa.Column('version', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('customer_id', sa.String(length=50), nullable=False),
        sa.Column('tx_type', sa.String(length=30), nullable=False),
        sa.Column('points', sa.Integer(), nullable=False),
        sa.Column('reference_doc_no', sa.String(length=100), nullable=True),
        sa.Column('narration', sa.String(length=255), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_loyalty_point_transactions_customer_id', 'loyalty_point_transactions', ['customer_id'], unique=False)


def downgrade() -> None:
    op.drop_table('loyalty_point_transactions')
    op.drop_table('stock_bin_assignments')
    op.drop_table('warehouse_bins')
    op.drop_table('warehouse_zones')
