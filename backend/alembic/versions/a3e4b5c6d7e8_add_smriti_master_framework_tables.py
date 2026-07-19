"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.16.0
Created      : 2026-07-13
Modified     : 2026-07-13
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

"""create smriti master framework tables

Revision ID: a3e4b5c6d7e8
Revises: f2d3e4a5b6c7
Create Date: 2026-07-13 16:48:21.123456

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'a3e4b5c6d7e8'
down_revision: Union[str, Sequence[str], None] = 'f2d3e4a5b6c7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        'master_types',
        sa.Column('id', sa.UUID(), server_default=sa.text('gen_random_uuid()'), nullable=False),
        sa.Column('code', sa.String(length=50), nullable=False),
        sa.Column('label', sa.String(length=100), nullable=False),
        sa.Column('field_schema', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column('ui_schema', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('used_in_modules', postgresql.ARRAY(sa.String()), nullable=True),
        sa.Column('depends_on', sa.String(length=50), nullable=True),
        sa.Column('version', sa.Integer(), server_default=sa.text('1'), nullable=False),
        sa.Column('evidence_level', sa.CHAR(length=1), server_default=sa.text("'D'"), nullable=False),
        sa.Column('created_by', sa.String(length=100), nullable=True),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('code'),
        sa.ForeignKeyConstraint(['depends_on'], ['master_types.code'])
    )

    op.create_table(
        'master_values',
        sa.Column('id', sa.UUID(), server_default=sa.text('gen_random_uuid()'), nullable=False),
        sa.Column('master_type_id', sa.UUID(), nullable=False),
        sa.Column('code', sa.String(length=50), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('parent_value_id', sa.UUID(), nullable=True),
        sa.Column('data', postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'{}'"), nullable=False),
        sa.Column('active', sa.Boolean(), server_default=sa.text('true'), nullable=False),
        sa.Column('sort_order', sa.Integer(), server_default=sa.text('0'), nullable=True),
        sa.Column('updated_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['master_type_id'], ['master_types.id']),
        sa.ForeignKeyConstraint(['parent_value_id'], ['master_values.id']),
        sa.UniqueConstraint('master_type_id', 'code')
    )

    op.create_index(
        'ix_master_values_master_type_id_active',
        'master_values',
        ['master_type_id'],
        postgresql_where=sa.text('active = true')
    )

    op.create_index(
        'ix_master_values_data_gin',
        'master_values',
        ['data'],
        postgresql_using='gin',
        postgresql_ops={'data': 'jsonb_path_ops'}
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index('ix_master_values_data_gin', table_name='master_values')
    op.drop_index('ix_master_values_master_type_id_active', table_name='master_values')
    op.drop_table('master_values')
    op.drop_table('master_types')
