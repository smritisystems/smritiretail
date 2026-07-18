"""add product identity engine tables

Revision ID: j6k7l8m9n0o
Revises: i1j2k3l4m5n
Create Date: 2026-07-18 01:58:04.000000
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'j6k7l8m9n0o'
down_revision = 'i1j2k3l4m5n'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'barcode_providers',
        sa.Column('id', sa.String(50), primary_key=True),
        sa.Column('uuid', sa.String(36), nullable=False, unique=True),
        sa.Column('company_id', sa.String(50), nullable=True),
        sa.Column('branch_id', sa.String(50), nullable=True),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('provider_type', sa.String(50), nullable=False),
        sa.Column('pool_code', sa.String(100), nullable=True),
        sa.Column('priority', sa.Integer(), nullable=False, server_default='100'),
        sa.Column('config', sa.dialects.postgresql.JSONB(), nullable=False, server_default=sa.text("'{}'")),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('modified_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_by', sa.String(100), nullable=True),
        sa.Column('updated_by', sa.String(100), nullable=True),
        sa.Column('is_deleted', sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('deleted_by', sa.String(100), nullable=True),
        sa.Column('version', sa.Integer(), nullable=False, server_default='1'),
    )
    op.create_index('ix_barcode_providers_pool_code', 'barcode_providers', ['pool_code'])
    op.create_index('ix_barcode_providers_company_branch', 'barcode_providers', ['company_id', 'branch_id'])

    op.create_table(
        'identity_rules',
        sa.Column('id', sa.String(50), primary_key=True),
        sa.Column('uuid', sa.String(36), nullable=False, unique=True),
        sa.Column('company_id', sa.String(50), nullable=True),
        sa.Column('branch_id', sa.String(50), nullable=True),
        sa.Column('name', sa.String(150), nullable=False),
        sa.Column('code', sa.String(100), nullable=False, unique=True),
        sa.Column('scope', sa.dialects.postgresql.JSONB(), nullable=False, server_default=sa.text("'{}'")),
        sa.Column('expression', sa.Text(), nullable=False),
        sa.Column('priority', sa.Integer(), nullable=False, server_default='100'),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('modified_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_by', sa.String(100), nullable=True),
        sa.Column('updated_by', sa.String(100), nullable=True),
        sa.Column('is_deleted', sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('deleted_by', sa.String(100), nullable=True),
        sa.Column('version', sa.Integer(), nullable=False, server_default='1'),
    )
    op.create_index('ix_identity_rules_code', 'identity_rules', ['code'])
    op.create_index('ix_identity_rules_company_branch', 'identity_rules', ['company_id', 'branch_id'])

    op.create_table(
        'product_identities',
        sa.Column('id', sa.String(50), primary_key=True),
        sa.Column('uuid', sa.String(36), nullable=False, unique=True),
        sa.Column('company_id', sa.String(50), nullable=True),
        sa.Column('branch_id', sa.String(50), nullable=True),
        sa.Column('product_id', sa.String(50), sa.ForeignKey('products.id', ondelete='RESTRICT'), nullable=False),
        sa.Column('business_key', sa.String(255), nullable=False),
        sa.Column('fingerprint', sa.String(255), nullable=False, unique=True),
        sa.Column('barcode', sa.String(100), nullable=False),
        sa.Column('barcode_provider_id', sa.String(50), sa.ForeignKey('barcode_providers.id', ondelete='SET NULL'), nullable=True),
        sa.Column('state', sa.String(50), nullable=False, server_default='Available'),
        sa.Column('identity_metadata', sa.dialects.postgresql.JSONB(), nullable=False, server_default=sa.text("'{}'")),
        sa.Column('rule_id', sa.String(50), sa.ForeignKey('identity_rules.id', ondelete='SET NULL'), nullable=True),
        sa.Column('assigned_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('modified_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_by', sa.String(100), nullable=True),
        sa.Column('updated_by', sa.String(100), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column('is_deleted', sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('deleted_by', sa.String(100), nullable=True),
        sa.Column('version', sa.Integer(), nullable=False, server_default='1'),
        sa.UniqueConstraint('company_id', 'branch_id', 'product_id', 'business_key', name='uq_product_identity_business_key'),
        sa.UniqueConstraint('company_id', 'branch_id', 'barcode', name='uq_product_identity_barcode'),
    )
    op.create_index('ix_product_identities_barcode', 'product_identities', ['barcode'])
    op.create_index('ix_product_identities_business_key', 'product_identities', ['business_key'])


def downgrade() -> None:
    op.drop_index('ix_product_identities_business_key', table_name='product_identities')
    op.drop_index('ix_product_identities_barcode', table_name='product_identities')
    op.drop_table('product_identities')
    op.drop_index('ix_identity_rules_company_branch', table_name='identity_rules')
    op.drop_index('ix_identity_rules_code', table_name='identity_rules')
    op.drop_table('identity_rules')
    op.drop_index('ix_barcode_providers_company_branch', table_name='barcode_providers')
    op.drop_index('ix_barcode_providers_pool_code', table_name='barcode_providers')
    op.drop_table('barcode_providers')
