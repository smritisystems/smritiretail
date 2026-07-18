"""add_user_assignment_tables

Revision ID: i1j2k3l4m5n
Revises: h4i5j6k7l8m9
Create Date: 2026-07-17 00:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'i1j2k3l4m5n'
down_revision: Union[str, Sequence[str], None] = 'h4i5j6k7l8m9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'user_company_assignments',
        sa.Column('id', sa.String(length=50), nullable=False),
        sa.Column('uuid', sa.String(length=36), nullable=False),
        sa.Column('company_id', sa.String(length=50), nullable=False),
        sa.Column('user_id', sa.String(length=50), nullable=False),
        sa.Column('branch_id', sa.String(length=50), nullable=True),
        sa.Column('is_default', sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('modified_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_by', sa.String(length=100), nullable=True),
        sa.Column('updated_by', sa.String(length=100), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column('is_deleted', sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('deleted_by', sa.String(length=100), nullable=True),
        sa.Column('version', sa.Integer(), nullable=False, server_default='1'),
        sa.ForeignKeyConstraint(['company_id'], ['companies.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('uuid'),
    )
    op.create_index(op.f('ix_user_company_assignments_company_id'), 'user_company_assignments', ['company_id'], unique=False)
    op.create_index(op.f('ix_user_company_assignments_user_id'), 'user_company_assignments', ['user_id'], unique=False)
    op.create_index(
        'ix_user_company_assignments_user_id_company_id_active',
        'user_company_assignments',
        ['user_id', 'company_id'],
        unique=True,
        postgresql_where=sa.text('is_deleted = false'),
    )
    op.create_index(
        'ix_user_company_assignments_user_id_default',
        'user_company_assignments',
        ['user_id'],
        unique=True,
        postgresql_where=sa.text('is_default = true'),
    )

    op.create_table(
        'user_branch_assignments',
        sa.Column('id', sa.String(length=50), nullable=False),
        sa.Column('uuid', sa.String(length=36), nullable=False),
        sa.Column('company_id', sa.String(length=50), nullable=False),
        sa.Column('branch_id', sa.String(length=50), nullable=False),
        sa.Column('user_id', sa.String(length=50), nullable=False),
        sa.Column('is_default', sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('modified_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_by', sa.String(length=100), nullable=True),
        sa.Column('updated_by', sa.String(length=100), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column('is_deleted', sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('deleted_by', sa.String(length=100), nullable=True),
        sa.Column('version', sa.Integer(), nullable=False, server_default='1'),
        sa.ForeignKeyConstraint(['company_id'], ['companies.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['branch_id'], ['branches.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('uuid'),
    )
    op.create_index(op.f('ix_user_branch_assignments_company_id'), 'user_branch_assignments', ['company_id'], unique=False)
    op.create_index(op.f('ix_user_branch_assignments_branch_id'), 'user_branch_assignments', ['branch_id'], unique=False)
    op.create_index(op.f('ix_user_branch_assignments_user_id'), 'user_branch_assignments', ['user_id'], unique=False)
    op.create_index(
        'ix_user_branch_assignments_user_id_branch_id_active',
        'user_branch_assignments',
        ['user_id', 'branch_id'],
        unique=True,
        postgresql_where=sa.text('is_deleted = false'),
    )
    op.create_index(
        'ix_user_branch_assignments_user_id_company_id_default',
        'user_branch_assignments',
        ['user_id', 'company_id'],
        unique=True,
        postgresql_where=sa.text('is_default = true'),
    )

    op.create_table(
        'user_store_assignments',
        sa.Column('id', sa.String(length=50), nullable=False),
        sa.Column('uuid', sa.String(length=36), nullable=False),
        sa.Column('company_id', sa.String(length=50), nullable=False),
        sa.Column('branch_id', sa.String(length=50), nullable=False),
        sa.Column('user_id', sa.String(length=50), nullable=False),
        sa.Column('store_id', sa.String(length=50), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('modified_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_by', sa.String(length=100), nullable=True),
        sa.Column('updated_by', sa.String(length=100), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column('is_deleted', sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('deleted_by', sa.String(length=100), nullable=True),
        sa.Column('version', sa.Integer(), nullable=False, server_default='1'),
        sa.ForeignKeyConstraint(['company_id'], ['companies.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['branch_id'], ['branches.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['store_id'], ['stores.id'], ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('uuid'),
    )
    op.create_index(op.f('ix_user_store_assignments_company_id'), 'user_store_assignments', ['company_id'], unique=False)
    op.create_index(op.f('ix_user_store_assignments_branch_id'), 'user_store_assignments', ['branch_id'], unique=False)
    op.create_index(op.f('ix_user_store_assignments_user_id'), 'user_store_assignments', ['user_id'], unique=False)
    op.create_index(op.f('ix_user_store_assignments_store_id'), 'user_store_assignments', ['store_id'], unique=False)
    op.create_index(
        'ix_user_store_assignments_user_id_store_id_active',
        'user_store_assignments',
        ['user_id', 'store_id'],
        unique=True,
        postgresql_where=sa.text('is_deleted = false'),
    )


def downgrade() -> None:
    op.drop_index('ix_user_store_assignments_user_id_store_id_active', table_name='user_store_assignments')
    op.drop_index(op.f('ix_user_store_assignments_store_id'), table_name='user_store_assignments')
    op.drop_index(op.f('ix_user_store_assignments_user_id'), table_name='user_store_assignments')
    op.drop_index(op.f('ix_user_store_assignments_branch_id'), table_name='user_store_assignments')
    op.drop_index(op.f('ix_user_store_assignments_company_id'), table_name='user_store_assignments')
    op.drop_table('user_store_assignments')
    op.drop_index('ix_user_branch_assignments_user_id_company_id_default', table_name='user_branch_assignments')
    op.drop_index('ix_user_branch_assignments_user_id_branch_id_active', table_name='user_branch_assignments')
    op.drop_index(op.f('ix_user_branch_assignments_user_id'), table_name='user_branch_assignments')
    op.drop_index(op.f('ix_user_branch_assignments_branch_id'), table_name='user_branch_assignments')
    op.drop_index(op.f('ix_user_branch_assignments_company_id'), table_name='user_branch_assignments')
    op.drop_table('user_branch_assignments')
    op.drop_index('ix_user_company_assignments_user_id_default', table_name='user_company_assignments')
    op.drop_index('ix_user_company_assignments_user_id_company_id_active', table_name='user_company_assignments')
    op.drop_index(op.f('ix_user_company_assignments_user_id'), table_name='user_company_assignments')
    op.drop_index(op.f('ix_user_company_assignments_company_id'), table_name='user_company_assignments')
    op.drop_table('user_company_assignments')
