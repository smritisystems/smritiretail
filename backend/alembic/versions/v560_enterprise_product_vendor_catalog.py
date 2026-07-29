"""SMRITI Retail OS v5.6.0 Enterprise ProductVendor Catalog & Policies DDL Migration

Revision ID: v560_enterprise_product_vendor_catalog
Revises: v550_enterprise_size_master
Create Date: 2026-07-21 19:15:00.000000

Design Rationale:
-----------------
Creates 3 domain tables to support Enterprise ProductVendor Catalog & Sourcing Engine (v5.6.0):
1. Creates product_vendors table (1:N Bridge Entity).
2. Creates product_tax_profiles table (1:1 Date-Effective Tax Policy).
3. Creates product_inventory_policies table (1:1 Governance Policy).
4. Adds sourcing_mode_override column to products table.
5. Creates multi-tenant performance and uniqueness indexes.
"""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = 'v560_product_vendor_catalog'
down_revision: Union[str, Sequence[str], None] = 'v550_enterprise_size_master'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Create product_vendors table
    op.create_table(
        'product_vendors',
        sa.Column('id', sa.String(length=50), nullable=False),
        sa.Column('uuid', sa.String(length=36), nullable=False),
        sa.Column('tenant_id', sa.String(length=50), nullable=True),
        sa.Column('company_id', sa.String(length=50), nullable=True),
        sa.Column('branch_id', sa.String(length=50), nullable=True),
        sa.Column('product_id', sa.String(length=50), nullable=False),
        sa.Column('supplier_id', sa.String(length=50), nullable=False),
        sa.Column('supplier_product_code', sa.String(length=100), nullable=True),
        sa.Column('supplier_barcode', sa.String(length=100), nullable=True),
        sa.Column('purchase_uom_id', sa.String(length=50), nullable=True),
        sa.Column('currency_id', sa.String(length=10), server_default='INR', nullable=False),
        sa.Column('cost_price', sa.Numeric(precision=15, scale=2), server_default='0.00', nullable=False),
        sa.Column('last_purchase_price', sa.Numeric(precision=15, scale=2), server_default='0.00', nullable=False),
        sa.Column('last_purchase_date', sa.DateTime(timezone=True), nullable=True),
        sa.Column('discount_percentage', sa.Numeric(precision=5, scale=2), server_default='0.00', nullable=False),
        sa.Column('tax_inclusive', sa.Boolean(), server_default='false', nullable=False),
        sa.Column('minimum_order_qty', sa.Numeric(precision=10, scale=2), server_default='1.00', nullable=False),
        sa.Column('maximum_order_qty', sa.Numeric(precision=10, scale=2), nullable=True),
        sa.Column('lead_time_days', sa.Integer(), server_default='1', nullable=False),
        sa.Column('supplier_warranty_days', sa.Integer(), server_default='0', nullable=False),
        sa.Column('priority', sa.Integer(), server_default='1', nullable=False),
        sa.Column('is_preferred', sa.Boolean(), server_default='false', nullable=False),
        sa.Column('approval_status', sa.String(length=30), server_default='Approved', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('modified_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('created_by', sa.String(length=100), nullable=True),
        sa.Column('updated_by', sa.String(length=100), nullable=True),
        sa.Column('is_active', sa.Boolean(), server_default='true', nullable=False),
        sa.Column('is_deleted', sa.Boolean(), server_default='false', nullable=False),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('deleted_by', sa.String(length=100), nullable=True),
        sa.Column('version', sa.Integer(), server_default='1', nullable=False),
        sa.Column('workflow_status', sa.String(length=30), server_default='Approved', nullable=False),
        sa.Column('document_number', sa.String(length=80), nullable=True),
        sa.ForeignKeyConstraint(['product_id'], ['products.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['supplier_id'], ['suppliers.id'], ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('uuid')
    )
    op.create_index('uq_product_vendors_prod_supp', 'product_vendors', ['company_id', 'product_id', 'supplier_id'], unique=True, postgresql_where=sa.text('is_deleted = false'))
    op.create_index('ix_product_vendors_product_id', 'product_vendors', ['product_id'])
    op.create_index('ix_product_vendors_supplier_id', 'product_vendors', ['supplier_id'])

    # 2. Create product_tax_profiles table
    op.create_table(
        'product_tax_profiles',
        sa.Column('id', sa.String(length=50), nullable=False),
        sa.Column('uuid', sa.String(length=36), nullable=False),
        sa.Column('tenant_id', sa.String(length=50), nullable=True),
        sa.Column('company_id', sa.String(length=50), nullable=True),
        sa.Column('branch_id', sa.String(length=50), nullable=True),
        sa.Column('product_id', sa.String(length=50), nullable=False),
        sa.Column('hsn_code', sa.String(length=20), nullable=True),
        sa.Column('gst_rate', sa.Numeric(precision=5, scale=2), server_default='18.00', nullable=False),
        sa.Column('cess_rate', sa.Numeric(precision=5, scale=2), server_default='0.00', nullable=False),
        sa.Column('is_inclusive_tax', sa.Boolean(), server_default='false', nullable=False),
        sa.Column('tax_group_id', sa.String(length=50), nullable=True),
        sa.Column('effective_from', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('effective_to', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('modified_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('created_by', sa.String(length=100), nullable=True),
        sa.Column('updated_by', sa.String(length=100), nullable=True),
        sa.Column('is_active', sa.Boolean(), server_default='true', nullable=False),
        sa.Column('is_deleted', sa.Boolean(), server_default='false', nullable=False),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('deleted_by', sa.String(length=100), nullable=True),
        sa.Column('version', sa.Integer(), server_default='1', nullable=False),
        sa.Column('workflow_status', sa.String(length=30), server_default='Approved', nullable=False),
        sa.Column('document_number', sa.String(length=80), nullable=True),
        sa.ForeignKeyConstraint(['product_id'], ['products.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('uuid')
    )
    op.create_index('ix_product_tax_profiles_product_id', 'product_tax_profiles', ['product_id'])

    # 3. Create product_inventory_policies table
    op.create_table(
        'product_inventory_policies',
        sa.Column('id', sa.String(length=50), nullable=False),
        sa.Column('uuid', sa.String(length=36), nullable=False),
        sa.Column('tenant_id', sa.String(length=50), nullable=True),
        sa.Column('company_id', sa.String(length=50), nullable=True),
        sa.Column('branch_id', sa.String(length=50), nullable=True),
        sa.Column('product_id', sa.String(length=50), nullable=False),
        sa.Column('is_batch_tracked', sa.Boolean(), server_default='false', nullable=False),
        sa.Column('is_serial_tracked', sa.Boolean(), server_default='false', nullable=False),
        sa.Column('is_expiry_required', sa.Boolean(), server_default='false', nullable=False),
        sa.Column('is_qc_required', sa.Boolean(), server_default='false', nullable=False),
        sa.Column('allow_negative_stock', sa.Boolean(), server_default='false', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('modified_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('created_by', sa.String(length=100), nullable=True),
        sa.Column('updated_by', sa.String(length=100), nullable=True),
        sa.Column('is_active', sa.Boolean(), server_default='true', nullable=False),
        sa.Column('is_deleted', sa.Boolean(), server_default='false', nullable=False),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('deleted_by', sa.String(length=100), nullable=True),
        sa.Column('version', sa.Integer(), server_default='1', nullable=False),
        sa.Column('workflow_status', sa.String(length=30), server_default='Approved', nullable=False),
        sa.Column('document_number', sa.String(length=80), nullable=True),
        sa.ForeignKeyConstraint(['product_id'], ['products.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('uuid')
    )
    op.create_index('ix_product_inventory_policies_product_id', 'product_inventory_policies', ['product_id'], unique=True)

    # 4. Add sourcing_mode_override column to products
    op.add_column('products', sa.Column('sourcing_mode_override', sa.String(length=30), nullable=True))


def downgrade() -> None:
    op.drop_column('products', 'sourcing_mode_override')
    op.drop_table('product_inventory_policies')
    op.drop_table('product_tax_profiles')
    op.drop_table('product_vendors')
