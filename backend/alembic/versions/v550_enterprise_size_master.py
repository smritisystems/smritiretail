"""SMRITI Retail OS v5.5.0 Enterprise Size Scale Management DDL Migration

Revision ID: v550_enterprise_size_master
Revises: v540_enterprise_supplier
Create Date: 2026-07-21 18:56:00.000000

Design Rationale:
-----------------
Creates 3 domain tables to support Enterprise Size Scale Management (v5.5.0):
1. Creates size_scales table (Aggregate Root).
2. Creates size_values table (1:N Child Entity).
3. Creates size_conversions table (1:N Normalized Child Entity for regional standards UK/US/EU/JP/AU/CM).
4. Adds size_scale_id column to products table.
5. Creates multi-tenant performance and uniqueness indexes.
"""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = 'v550_enterprise_size_master'
down_revision: Union[str, Sequence[str], None] = 'v540_enterprise_supplier'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Create size_scales table
    op.create_table(
        'size_scales',
        sa.Column('id', sa.String(length=50), nullable=False),
        sa.Column('uuid', sa.String(length=36), nullable=False),
        sa.Column('tenant_id', sa.String(length=50), nullable=True),
        sa.Column('company_id', sa.String(length=50), nullable=True),
        sa.Column('branch_id', sa.String(length=50), nullable=True),
        sa.Column('code', sa.String(length=50), nullable=False),
        sa.Column('name', sa.String(length=200), nullable=False),
        sa.Column('scale_type_id', sa.String(length=50), nullable=True),
        sa.Column('category_id', sa.String(length=50), nullable=True),
        sa.Column('gender_id', sa.String(length=50), nullable=True),
        sa.Column('base_region_id', sa.String(length=50), server_default='UK', nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
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
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('uuid')
    )
    op.create_index('uq_size_scales_company_code', 'size_scales', ['company_id', 'code'], unique=True, postgresql_where=sa.text('is_deleted = false'))
    op.create_index('ix_size_scales_company_name', 'size_scales', ['company_id', 'name'])
    op.create_index('ix_size_scales_company_type', 'size_scales', ['company_id', 'scale_type_id'])

    # 2. Create size_values table
    op.create_table(
        'size_values',
        sa.Column('id', sa.String(length=50), nullable=False),
        sa.Column('uuid', sa.String(length=36), nullable=False),
        sa.Column('tenant_id', sa.String(length=50), nullable=True),
        sa.Column('company_id', sa.String(length=50), nullable=True),
        sa.Column('branch_id', sa.String(length=50), nullable=True),
        sa.Column('size_scale_id', sa.String(length=50), nullable=False),
        sa.Column('display_size', sa.String(length=50), nullable=False),
        sa.Column('sort_order', sa.Integer(), server_default='0', nullable=False),
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
        sa.ForeignKeyConstraint(['size_scale_id'], ['size_scales.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('uuid')
    )
    op.create_index('uq_size_values_scale_display', 'size_values', ['size_scale_id', 'display_size'], unique=True, postgresql_where=sa.text('is_deleted = false'))
    op.create_index('ix_size_values_scale_sort', 'size_values', ['size_scale_id', 'sort_order'])

    # 3. Create size_conversions table
    op.create_table(
        'size_conversions',
        sa.Column('id', sa.String(length=50), nullable=False),
        sa.Column('uuid', sa.String(length=36), nullable=False),
        sa.Column('tenant_id', sa.String(length=50), nullable=True),
        sa.Column('company_id', sa.String(length=50), nullable=True),
        sa.Column('branch_id', sa.String(length=50), nullable=True),
        sa.Column('size_value_id', sa.String(length=50), nullable=False),
        sa.Column('region_code', sa.String(length=20), nullable=False),
        sa.Column('converted_size_label', sa.String(length=50), nullable=False),
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
        sa.ForeignKeyConstraint(['size_value_id'], ['size_values.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('uuid')
    )
    op.create_index('uq_size_conversions_value_region', 'size_conversions', ['size_value_id', 'region_code'], unique=True, postgresql_where=sa.text('is_deleted = false'))

    # 4. Add size_scale_id column to products
    op.add_column('products', sa.Column('size_scale_id', sa.String(length=50), nullable=True))
    op.create_index('ix_products_size_scale_id', 'products', ['size_scale_id'])


def downgrade() -> None:
    op.drop_index('ix_products_size_scale_id', table_name='products')
    op.drop_column('products', 'size_scale_id')

    op.drop_table('size_conversions')
    op.drop_table('size_values')
    op.drop_table('size_scales')
