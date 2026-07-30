"""add_ulr_enhancements

Revision ID: v1320_add_ulr_enhancements
Revises: v1310_scdm_settlements
Create Date: 2026-07-31 01:27:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'v1320_add_ulr_enhancements'
down_revision = 'v1310_scdm_settlements'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('master_values', sa.Column('is_default', sa.Boolean(), nullable=False, server_default='false'))
    op.add_column('master_values', sa.Column('branch_id', sa.String(length=50), nullable=True))


def downgrade():
    op.drop_column('master_values', 'branch_id')
    op.drop_column('master_values', 'is_default')
