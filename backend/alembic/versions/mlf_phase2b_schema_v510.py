"""Master Lookup Framework Phase 2B Schema Upgrade

Revision ID: mlf_phase2b_v510
Revises: 89221f5f1969
Create Date: 2026-07-21 07:38:00.000000

Design Rationale:
-----------------
Upgrades master_types and master_values tables to support v5.1.0 Architecture Specification:
1. Adds category_type ('SYSTEM' | 'REFERENCE' | 'BUSINESS') and is_system to master_types.
2. Adds supersedes_id, effective_from, effective_to, and is_deleted to master_values for replacement versioning.
3. Adds indexes for fast lookup searches and version chain traversal.
"""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = 'mlf_phase2b_v510'
down_revision: Union[str, Sequence[str], None] = '89221f5f1969'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Upgrade master_types table
    op.add_column(
        'master_types',
        sa.Column('category_type', sa.String(length=20), server_default='SYSTEM', nullable=False)
    )
    op.add_column(
        'master_types',
        sa.Column('is_system', sa.Boolean(), server_default=sa.text('true'), nullable=False)
    )
    op.create_index('ix_master_types_category_type', 'master_types', ['category_type'])

    # 2. Upgrade master_values table
    op.add_column(
        'master_values',
        sa.Column('supersedes_id', sa.UUID(), nullable=True)
    )
    op.add_column(
        'master_values',
        sa.Column('effective_from', sa.TIMESTAMP(timezone=True), server_default=sa.text('now()'), nullable=False)
    )
    op.add_column(
        'master_values',
        sa.Column('effective_to', sa.TIMESTAMP(timezone=True), nullable=True)
    )

    # 3. Add FK constraint and indexes for master_values
    op.create_foreign_key(
        'fk_master_values_supersedes_id',
        'master_values', 'master_values',
        ['supersedes_id'], ['id'],
        ondelete='SET NULL'
    )
    op.create_index('ix_master_values_supersedes_id', 'master_values', ['supersedes_id'])
    op.create_index('ix_master_values_type_code', 'master_values', ['master_type_id', 'code'])


def downgrade() -> None:
    # Drop master_values indexes and columns
    op.drop_index('ix_master_values_type_code', table_name='master_values')
    op.drop_index('ix_master_values_supersedes_id', table_name='master_values')
    op.drop_constraint('fk_master_values_supersedes_id', 'master_values', type_='foreignkey')

    op.drop_column('master_values', 'effective_to')
    op.drop_column('master_values', 'effective_from')
    op.drop_column('master_values', 'supersedes_id')

    # Drop master_types index and columns
    op.drop_index('ix_master_types_category_type', table_name='master_types')
    op.drop_column('master_types', 'is_system')
    op.drop_column('master_types', 'category_type')
