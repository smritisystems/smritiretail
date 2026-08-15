"""add_reserved_stock_and_extended_product_columns

Revision ID: v1333_add_reserved_stock
Revises: 012304fb5829
Create Date: 2026-08-15 16:10:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'v1333_add_reserved_stock'
down_revision: Union[str, Sequence[str], None] = '012304fb5829'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    columns = [c['name'] for c in inspector.get_columns('products')]
    
    if 'reserved_stock' not in columns:
        op.add_column('products', sa.Column('reserved_stock', sa.Numeric(12, 4), nullable=False, server_default='0.0000'))
    if 'category_code' not in columns:
        op.add_column('products', sa.Column('category_code', sa.String(50), nullable=True))
    if 'cbm_m3' not in columns:
        op.add_column('products', sa.Column('cbm_m3', sa.Numeric(10, 4), nullable=True))
    if 'document_number' not in columns:
        op.add_column('products', sa.Column('document_number', sa.String(80), nullable=True))
    if 'size_scale_id' not in columns:
        op.add_column('products', sa.Column('size_scale_id', sa.String(50), nullable=True))
    if 'sourcing_mode_override' not in columns:
        op.add_column('products', sa.Column('sourcing_mode_override', sa.String(30), nullable=True))
    if 'tenant_id' not in columns:
        op.add_column('products', sa.Column('tenant_id', sa.String(50), nullable=True))
    if 'workflow_status' not in columns:
        op.add_column('products', sa.Column('workflow_status', sa.String(30), nullable=True, server_default='Approved'))

def downgrade() -> None:
    op.drop_column('products', 'workflow_status')
    op.drop_column('products', 'tenant_id')
    op.drop_column('products', 'sourcing_mode_override')
    op.drop_column('products', 'size_scale_id')
    op.drop_column('products', 'document_number')
    op.drop_column('products', 'cbm_m3')
    op.drop_column('products', 'category_code')
    op.drop_column('products', 'reserved_stock')
