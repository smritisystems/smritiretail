"""v570 enterprise vendor contracts and tiered pricing

Revision ID: v570_vendor_contracts
Revises: v560_product_vendor_catalog
Create Date: 2026-07-21 19:40:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = 'v570_vendor_contracts'
down_revision = 'v560_product_vendor_catalog'
branch_labels = None
depends_on = None


def upgrade():
    # 1. Create vendor_contracts table
    op.create_table(
        'vendor_contracts',
        sa.Column('id', sa.String(length=50), nullable=False),
        sa.Column('uuid', sa.String(length=36), nullable=False),
        sa.Column('tenant_id', sa.String(length=50), nullable=True),
        sa.Column('company_id', sa.String(length=50), nullable=True),
        sa.Column('branch_id', sa.String(length=50), nullable=True),
        sa.Column('supplier_id', sa.String(length=50), nullable=False),
        sa.Column('contract_code', sa.String(length=100), nullable=False),
        sa.Column('contract_title', sa.String(length=255), nullable=False),
        sa.Column('version_number', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('parent_contract_id', sa.String(length=50), nullable=True),
        sa.Column('valid_from', sa.DateTime(timezone=True), nullable=False),
        sa.Column('valid_to', sa.DateTime(timezone=True), nullable=False),
        sa.Column('currency_id', sa.String(length=10), nullable=False, server_default='INR'),
        sa.Column('payment_terms_id', sa.String(length=50), nullable=True),
        sa.Column('delivery_terms', sa.String(length=100), nullable=True),
        sa.Column('min_commitment_value', sa.Numeric(precision=15, scale=2), nullable=False, server_default='0.00'),
        sa.Column('terms_and_conditions', sa.Text(), nullable=True),
        sa.Column('attachment_url', sa.String(length=500), nullable=True),
        sa.Column('digital_signature_hash', sa.String(length=255), nullable=True),
        sa.Column('approval_status', sa.String(length=30), nullable=False, server_default='Draft'),
        sa.Column('lifecycle_stage', sa.String(length=30), nullable=False, server_default='Draft'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('modified_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('created_by', sa.String(length=100), nullable=True),
        sa.Column('updated_by', sa.String(length=100), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('is_deleted', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('deleted_by', sa.String(length=100), nullable=True),
        sa.Column('version', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('workflow_status', sa.String(length=50), nullable=False, server_default='Approved'),
        sa.Column('document_number', sa.String(length=100), nullable=True),
        sa.ForeignKeyConstraint(['supplier_id'], ['suppliers.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['parent_contract_id'], ['vendor_contracts.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('id')
    )
    op.create_index(op.f('ix_vendor_contracts_supplier_id'), 'vendor_contracts', ['supplier_id'], unique=False)
    op.create_index(op.f('ix_vendor_contracts_contract_code'), 'vendor_contracts', ['contract_code'], unique=False)

    # 2. Create vendor_contract_tiers table
    op.create_table(
        'vendor_contract_tiers',
        sa.Column('id', sa.String(length=50), nullable=False),
        sa.Column('uuid', sa.String(length=36), nullable=False),
        sa.Column('tenant_id', sa.String(length=50), nullable=True),
        sa.Column('company_id', sa.String(length=50), nullable=True),
        sa.Column('branch_id', sa.String(length=50), nullable=True),
        sa.Column('contract_id', sa.String(length=50), nullable=False),
        sa.Column('product_id', sa.String(length=50), nullable=False),
        sa.Column('purchase_uom_id', sa.String(length=50), nullable=True),
        sa.Column('currency_id', sa.String(length=10), nullable=False, server_default='INR'),
        sa.Column('min_quantity', sa.Numeric(precision=10, scale=2), nullable=False, server_default='1.00'),
        sa.Column('max_quantity', sa.Numeric(precision=10, scale=2), nullable=True),
        sa.Column('contract_unit_price', sa.Numeric(precision=15, scale=2), nullable=False),
        sa.Column('discount_percentage', sa.Numeric(precision=5, scale=2), nullable=False, server_default='0.00'),
        sa.Column('bonus_quantity', sa.Numeric(precision=10, scale=2), nullable=False, server_default='0.00'),
        sa.Column('effective_from', sa.DateTime(timezone=True), nullable=True),
        sa.Column('effective_to', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('modified_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('created_by', sa.String(length=100), nullable=True),
        sa.Column('updated_by', sa.String(length=100), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('is_deleted', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('deleted_by', sa.String(length=100), nullable=True),
        sa.Column('version', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('workflow_status', sa.String(length=50), nullable=False, server_default='Approved'),
        sa.Column('document_number', sa.String(length=100), nullable=True),
        sa.ForeignKeyConstraint(['contract_id'], ['vendor_contracts.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['product_id'], ['products.id'], ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('id')
    )
    op.create_index(op.f('ix_vendor_contract_tiers_contract_id'), 'vendor_contract_tiers', ['contract_id'], unique=False)
    op.create_index(op.f('ix_vendor_contract_tiers_product_id'), 'vendor_contract_tiers', ['product_id'], unique=False)

    # 3. Add contract snapshot & manual override columns to purchase_order_items
    op.add_column('purchase_order_items', sa.Column('contract_id', sa.String(length=50), nullable=True))
    op.add_column('purchase_order_items', sa.Column('contract_version', sa.Integer(), nullable=True))
    op.add_column('purchase_order_items', sa.Column('applied_tier_id', sa.String(length=50), nullable=True))
    op.add_column('purchase_order_items', sa.Column('applied_unit_price', sa.Numeric(precision=15, scale=2), nullable=True))
    op.add_column('purchase_order_items', sa.Column('applied_discount_percentage', sa.Numeric(precision=5, scale=2), nullable=True))
    op.add_column('purchase_order_items', sa.Column('is_manually_overridden', sa.Boolean(), nullable=False, server_default='false'))
    op.add_column('purchase_order_items', sa.Column('override_reason', sa.String(length=255), nullable=True))
    op.add_column('purchase_order_items', sa.Column('overridden_by', sa.String(length=100), nullable=True))
    op.add_column('purchase_order_items', sa.Column('overridden_at', sa.DateTime(timezone=True), nullable=True))


def downgrade():
    op.drop_column('purchase_order_items', 'overridden_at')
    op.drop_column('purchase_order_items', 'overridden_by')
    op.drop_column('purchase_order_items', 'override_reason')
    op.drop_column('purchase_order_items', 'is_manually_overridden')
    op.drop_column('purchase_order_items', 'applied_discount_percentage')
    op.drop_column('purchase_order_items', 'applied_unit_price')
    op.drop_column('purchase_order_items', 'applied_tier_id')
    op.drop_column('purchase_order_items', 'contract_version')
    op.drop_column('purchase_order_items', 'contract_id')

    op.drop_table('vendor_contract_tiers')
    op.drop_table('vendor_contracts')
