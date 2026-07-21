"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 5.1.0
Created      : 2026-07-21
Modified     : 2026-07-21
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal Architecture Standard
"""

"""add_hybrid_columns_to_master_values

Revision ID: add_hybrid_master_values
Revises: mlf_phase2b_v510
Create Date: 2026-07-21
"""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'add_hybrid_master_values'
down_revision: Union[str, Sequence[str], None] = 'mlf_phase2b_v510'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade():
    # Add is_system column — marks SMRITI-seeded values, cannot be deleted
    op.add_column('master_values',
        sa.Column('is_system', sa.Boolean(),
                  server_default=sa.text('false'), nullable=False))

    # Add tenant_id column — NULL = all tenants, SET = that tenant only
    op.add_column('master_values',
        sa.Column('tenant_id', sa.String(50), nullable=True))

    # Index for fast tenant-scoped queries
    op.create_index('ix_master_values_tenant_id',
                    'master_values', ['tenant_id'])
    op.create_index('ix_master_values_is_system',
                    'master_values', ['is_system'])


def downgrade():
    op.drop_index('ix_master_values_is_system', table_name='master_values')
    op.drop_index('ix_master_values_tenant_id', table_name='master_values')
    op.drop_column('master_values', 'tenant_id')
    op.drop_column('master_values', 'is_system')
