"""add gs1_company_prefix, barcode_source, and barcode_counter to companies

Revision ID: v1501_barcode_sourcing_multi_mode
Revises: v1500_phase_f_sizescale_adoption
Create Date: 2026-08-08 22:15:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'v1501_barcode_sourcing_multi_mode'
down_revision = 'v1500_phase_f_sizescale_adoption'
branch_labels = None
depends_on = None


def upgrade():
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    columns = [c['name'] for c in inspector.get_columns('companies')]
    
    if 'gs1_company_prefix' not in columns:
        op.add_column('companies', sa.Column('gs1_company_prefix', sa.String(length=20), nullable=True))
    if 'barcode_source' not in columns:
        op.add_column('companies', sa.Column('barcode_source', sa.String(length=30), nullable=False, server_default='AUTO'))
    if 'barcode_counter' not in columns:
        op.add_column('companies', sa.Column('barcode_counter', sa.Integer(), nullable=False, server_default='0'))


def downgrade():
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    columns = [c['name'] for c in inspector.get_columns('companies')]
    
    if 'barcode_counter' in columns:
        op.drop_column('companies', 'barcode_counter')
    if 'barcode_source' in columns:
        op.drop_column('companies', 'barcode_source')
    if 'gs1_company_prefix' in columns:
        op.drop_column('companies', 'gs1_company_prefix')
