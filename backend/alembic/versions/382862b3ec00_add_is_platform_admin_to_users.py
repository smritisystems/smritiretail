"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.33.0
Created      : 2026-07-19
Modified     : 2026-07-19
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

"""add_is_platform_admin_to_users

Revision ID: 382862b3ec00
Revises: 6a5a1f89c59e
Create Date: 2026-07-19 18:08:44.062668

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '382862b3ec00'
down_revision: Union[str, Sequence[str], None] = '6a5a1f89c59e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # 1. Drop constraints if they exist to prevent schema mismatch
    try:
        op.drop_constraint('uq_smriti_policies_code', 'smriti_permission_sets', type_='unique')
    except Exception:
        pass
    
    try:
        op.drop_index('ix_smriti_role_policies_tenant_id', table_name='smriti_role_permission_sets')
    except Exception:
        pass

    op.create_index(op.f('ix_smriti_role_permission_sets_tenant_id'), 'smriti_role_permission_sets', ['tenant_id'], unique=False)
    op.add_column('users', sa.Column('is_platform_admin', sa.Boolean(), nullable=False, server_default=sa.text('false')))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('users', 'is_platform_admin')
    op.drop_index(op.f('ix_smriti_role_permission_sets_tenant_id'), table_name='smriti_role_permission_sets')
    op.create_index('ix_smriti_role_policies_tenant_id', 'smriti_role_permission_sets', ['tenant_id'], unique=False)
    op.create_unique_constraint('uq_smriti_policies_code', 'smriti_permission_sets', ['code'])
