"""add iam enterprise architecture tables

Revision ID: v1220_iam_enterprise
Revises: v1219_merge_multitenant_heads
Create Date: 2026-08-05 11:42:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'v1220_iam_enterprise'
down_revision: Union[str, None] = 'v1219_merge_multitenant_heads'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. smriti_user_assignments
    op.create_table(
        'smriti_user_assignments',
        sa.Column('id', sa.String(length=50), nullable=False),
        sa.Column('tenant_id', sa.String(length=50), nullable=True),
        sa.Column('user_id', sa.String(length=50), nullable=False),
        sa.Column('company_id', sa.String(length=50), nullable=True),
        sa.Column('branch_id', sa.String(length=50), nullable=True),
        sa.Column('store_id', sa.String(length=50), nullable=True),
        sa.Column('warehouse_id', sa.String(length=50), nullable=True),
        sa.Column('role_id', sa.String(length=50), nullable=True),
        sa.Column('permission_set_id', sa.String(length=50), nullable=True),
        sa.Column('workspace_profile_id', sa.String(length=50), nullable=True),
        sa.Column('persona', sa.String(length=100), nullable=True),
        sa.Column('effective_scope', sa.String(length=50), nullable=False, server_default='STORE'),
        sa.Column('valid_from', sa.DateTime(timezone=True), nullable=True),
        sa.Column('valid_to', sa.DateTime(timezone=True), nullable=True),
        sa.Column('is_delegated', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('delegated_by_user_id', sa.String(length=50), nullable=True),
        sa.Column('status', sa.String(length=50), nullable=False, server_default='ACTIVE'),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('is_deleted', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('NOW()')),
        sa.Column('modified_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('NOW()')),
        sa.Column('created_by', sa.String(length=50), nullable=True),
        sa.Column('updated_by', sa.String(length=50), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['company_id'], ['companies.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['branch_id'], ['branches.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['role_id'], ['smriti_roles.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['permission_set_id'], ['smriti_permission_sets.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_usr_assign_user', 'smriti_user_assignments', ['user_id'])
    op.create_index('idx_usr_assign_comp', 'smriti_user_assignments', ['company_id'])
    op.create_index('idx_usr_assign_branch', 'smriti_user_assignments', ['branch_id'])
    op.create_index('idx_usr_assign_role', 'smriti_user_assignments', ['role_id'])

    # 2. smriti_workspace_profiles
    op.create_table(
        'smriti_workspace_profiles',
        sa.Column('id', sa.String(length=50), nullable=False),
        sa.Column('tenant_id', sa.String(length=50), nullable=True),
        sa.Column('code', sa.String(length=50), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('persona', sa.String(length=100), nullable=False),
        sa.Column('default_workspace_id', sa.String(length=100), nullable=False, server_default='launchpad'),
        sa.Column('layout_json', sa.Text(), nullable=True),
        sa.Column('theme', sa.String(length=50), nullable=False, server_default='light'),
        sa.Column('shortcuts_json', sa.Text(), nullable=True),
        sa.Column('is_default', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('is_deleted', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('NOW()')),
        sa.Column('modified_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('NOW()')),
        sa.Column('created_by', sa.String(length=50), nullable=True),
        sa.Column('updated_by', sa.String(length=50), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('code', name='uq_workspace_prof_code')
    )
    op.create_index('idx_wspace_prof_persona', 'smriti_workspace_profiles', ['persona'])

    # 3. smriti_security_policies
    op.create_table(
        'smriti_security_policies',
        sa.Column('id', sa.String(length=50), nullable=False),
        sa.Column('tenant_id', sa.String(length=50), nullable=True),
        sa.Column('code', sa.String(length=100), nullable=False),
        sa.Column('name', sa.String(length=150), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('category', sa.String(length=50), nullable=False, server_default='AUTHORIZATION'),
        sa.Column('rule_expression', sa.Text(), nullable=False),
        sa.Column('enforcement_level', sa.String(length=50), nullable=False, server_default='BLOCK'),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('is_deleted', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('NOW()')),
        sa.Column('modified_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('NOW()')),
        sa.Column('created_by', sa.String(length=50), nullable=True),
        sa.Column('updated_by', sa.String(length=50), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('code', name='uq_security_policy_code')
    )

    # 4. smriti_field_security_masks
    op.create_table(
        'smriti_field_security_masks',
        sa.Column('id', sa.String(length=50), nullable=False),
        sa.Column('tenant_id', sa.String(length=50), nullable=True),
        sa.Column('resource', sa.String(length=100), nullable=False),
        sa.Column('field_name', sa.String(length=100), nullable=False),
        sa.Column('role_id', sa.String(length=50), nullable=True),
        sa.Column('field_state', sa.String(length=50), nullable=False, server_default='VISIBLE'),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('is_deleted', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('NOW()')),
        sa.Column('modified_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('NOW()')),
        sa.Column('created_by', sa.String(length=50), nullable=True),
        sa.Column('updated_by', sa.String(length=50), nullable=True),
        sa.ForeignKeyConstraint(['role_id'], ['smriti_roles.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_fls_res_field', 'smriti_field_security_masks', ['resource', 'field_name'])


def downgrade() -> None:
    op.drop_table('smriti_field_security_masks')
    op.drop_table('smriti_security_policies')
    op.drop_table('smriti_workspace_profiles')
    op.drop_table('smriti_user_assignments')
