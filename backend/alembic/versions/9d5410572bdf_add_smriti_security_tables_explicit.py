"""add_smriti_security_framework_tables_v2

Revision ID: 9d5410572bdf
Revises: 8c4309461afc
Create Date: 2026-07-18

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '9d5410572bdf'
down_revision: Union[str, Sequence[str], None] = '8c4309461afc'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create SMRITI Security & Access Control Framework tables."""

    # smriti_roles
    op.create_table(
        'smriti_roles',
        sa.Column('id', sa.String(50), primary_key=True),
        sa.Column('uuid', sa.String(36), nullable=False, unique=True),
        sa.Column('company_id', sa.String(50), sa.ForeignKey('companies.id', ondelete='RESTRICT'), nullable=True),
        sa.Column('branch_id', sa.String(50), sa.ForeignKey('branches.id', ondelete='RESTRICT'), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('modified_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_by', sa.String(100), nullable=True),
        sa.Column('updated_by', sa.String(100), nullable=True),
        sa.Column('is_active', sa.Boolean(), default=True),
        sa.Column('is_deleted', sa.Boolean(), default=False),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('deleted_by', sa.String(100), nullable=True),
        sa.Column('version', sa.Integer(), default=1),
        sa.Column('code', sa.String(50), nullable=False),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('parent_role_id', sa.String(50), sa.ForeignKey('smriti_roles.id', ondelete='SET NULL'), nullable=True),
        sa.Column('is_system_role', sa.Boolean(), default=False, nullable=False),
        sa.UniqueConstraint('code', name='uq_smriti_roles_code'),
    )
    op.create_index('ix_smriti_roles_code', 'smriti_roles', ['code'])

    # smriti_permissions
    op.create_table(
        'smriti_permissions',
        sa.Column('id', sa.String(50), primary_key=True),
        sa.Column('uuid', sa.String(36), nullable=False, unique=True),
        sa.Column('company_id', sa.String(50), sa.ForeignKey('companies.id', ondelete='RESTRICT'), nullable=True),
        sa.Column('branch_id', sa.String(50), sa.ForeignKey('branches.id', ondelete='RESTRICT'), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('modified_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_by', sa.String(100), nullable=True),
        sa.Column('updated_by', sa.String(100), nullable=True),
        sa.Column('is_active', sa.Boolean(), default=True),
        sa.Column('is_deleted', sa.Boolean(), default=False),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('deleted_by', sa.String(100), nullable=True),
        sa.Column('version', sa.Integer(), default=1),
        sa.Column('code', sa.String(100), nullable=False),
        sa.Column('resource', sa.String(100), nullable=False),
        sa.Column('action', sa.String(50), nullable=False),
        sa.Column('scope', sa.String(50), nullable=False, server_default='OWN_BRANCH'),
        sa.Column('module', sa.String(100), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.UniqueConstraint('code', name='uq_smriti_permissions_code'),
    )
    op.create_index('ix_smriti_permissions_code', 'smriti_permissions', ['code'])
    op.create_index('ix_smriti_permissions_resource', 'smriti_permissions', ['resource'])
    op.create_index('ix_smriti_permissions_module', 'smriti_permissions', ['module'])

    # smriti_policies
    op.create_table(
        'smriti_policies',
        sa.Column('id', sa.String(50), primary_key=True),
        sa.Column('uuid', sa.String(36), nullable=False, unique=True),
        sa.Column('company_id', sa.String(50), sa.ForeignKey('companies.id', ondelete='RESTRICT'), nullable=True),
        sa.Column('branch_id', sa.String(50), sa.ForeignKey('branches.id', ondelete='RESTRICT'), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('modified_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_by', sa.String(100), nullable=True),
        sa.Column('updated_by', sa.String(100), nullable=True),
        sa.Column('is_active', sa.Boolean(), default=True),
        sa.Column('is_deleted', sa.Boolean(), default=False),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('deleted_by', sa.String(100), nullable=True),
        sa.Column('version', sa.Integer(), default=1),
        sa.Column('code', sa.String(50), nullable=False),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.UniqueConstraint('code', name='uq_smriti_policies_code'),
    )
    op.create_index('ix_smriti_policies_code', 'smriti_policies', ['code'])

    # smriti_role_policies
    op.create_table(
        'smriti_role_policies',
        sa.Column('id', sa.String(50), primary_key=True),
        sa.Column('uuid', sa.String(36), nullable=False, unique=True),
        sa.Column('company_id', sa.String(50), sa.ForeignKey('companies.id', ondelete='RESTRICT'), nullable=True),
        sa.Column('branch_id', sa.String(50), sa.ForeignKey('branches.id', ondelete='RESTRICT'), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('modified_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_by', sa.String(100), nullable=True),
        sa.Column('updated_by', sa.String(100), nullable=True),
        sa.Column('is_active', sa.Boolean(), default=True),
        sa.Column('is_deleted', sa.Boolean(), default=False),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('deleted_by', sa.String(100), nullable=True),
        sa.Column('version', sa.Integer(), default=1),
        sa.Column('role_id', sa.String(50), sa.ForeignKey('smriti_roles.id', ondelete='CASCADE'), nullable=False),
        sa.Column('policy_id', sa.String(50), sa.ForeignKey('smriti_policies.id', ondelete='CASCADE'), nullable=False),
    )
    op.create_index('ix_smriti_role_policies_role_id', 'smriti_role_policies', ['role_id'])
    op.create_index('ix_smriti_role_policies_policy_id', 'smriti_role_policies', ['policy_id'])

    # smriti_policy_permissions
    op.create_table(
        'smriti_policy_permissions',
        sa.Column('id', sa.String(50), primary_key=True),
        sa.Column('uuid', sa.String(36), nullable=False, unique=True),
        sa.Column('company_id', sa.String(50), sa.ForeignKey('companies.id', ondelete='RESTRICT'), nullable=True),
        sa.Column('branch_id', sa.String(50), sa.ForeignKey('branches.id', ondelete='RESTRICT'), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('modified_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_by', sa.String(100), nullable=True),
        sa.Column('updated_by', sa.String(100), nullable=True),
        sa.Column('is_active', sa.Boolean(), default=True),
        sa.Column('is_deleted', sa.Boolean(), default=False),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('deleted_by', sa.String(100), nullable=True),
        sa.Column('version', sa.Integer(), default=1),
        sa.Column('policy_id', sa.String(50), sa.ForeignKey('smriti_policies.id', ondelete='CASCADE'), nullable=False),
        sa.Column('permission_id', sa.String(50), sa.ForeignKey('smriti_permissions.id', ondelete='CASCADE'), nullable=False),
        sa.Column('permission_type', sa.Enum('ALLOW', 'DENY', name='permissiontype'), nullable=False, server_default='ALLOW'),
    )
    op.create_index('ix_smriti_policy_permissions_policy_id', 'smriti_policy_permissions', ['policy_id'])
    op.create_index('ix_smriti_policy_permissions_permission_id', 'smriti_policy_permissions', ['permission_id'])

    # smriti_user_roles
    op.create_table(
        'smriti_user_roles',
        sa.Column('id', sa.String(50), primary_key=True),
        sa.Column('uuid', sa.String(36), nullable=False, unique=True),
        sa.Column('company_id', sa.String(50), sa.ForeignKey('companies.id', ondelete='RESTRICT'), nullable=True),
        sa.Column('branch_id', sa.String(50), sa.ForeignKey('branches.id', ondelete='RESTRICT'), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('modified_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_by', sa.String(100), nullable=True),
        sa.Column('updated_by', sa.String(100), nullable=True),
        sa.Column('is_active', sa.Boolean(), default=True),
        sa.Column('is_deleted', sa.Boolean(), default=False),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('deleted_by', sa.String(100), nullable=True),
        sa.Column('version', sa.Integer(), default=1),
        sa.Column('user_id', sa.String(50), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('role_id', sa.String(50), sa.ForeignKey('smriti_roles.id', ondelete='CASCADE'), nullable=False),
    )
    op.create_index('ix_smriti_user_roles_user_id', 'smriti_user_roles', ['user_id'])
    op.create_index('ix_smriti_user_roles_role_id', 'smriti_user_roles', ['role_id'])

    # smriti_menus
    op.create_table(
        'smriti_menus',
        sa.Column('id', sa.String(50), primary_key=True),
        sa.Column('uuid', sa.String(36), nullable=False, unique=True),
        sa.Column('company_id', sa.String(50), sa.ForeignKey('companies.id', ondelete='RESTRICT'), nullable=True),
        sa.Column('branch_id', sa.String(50), sa.ForeignKey('branches.id', ondelete='RESTRICT'), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('modified_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_by', sa.String(100), nullable=True),
        sa.Column('updated_by', sa.String(100), nullable=True),
        sa.Column('is_active', sa.Boolean(), default=True),
        sa.Column('is_deleted', sa.Boolean(), default=False),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('deleted_by', sa.String(100), nullable=True),
        sa.Column('version', sa.Integer(), default=1),
        sa.Column('parent_id', sa.String(50), sa.ForeignKey('smriti_menus.id', ondelete='SET NULL'), nullable=True),
        sa.Column('title', sa.String(100), nullable=False),
        sa.Column('route', sa.String(200), nullable=True),
        sa.Column('icon', sa.String(100), nullable=True),
        sa.Column('module', sa.String(100), nullable=False),
        sa.Column('permission', sa.String(100), nullable=True),
        sa.Column('sequence', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('feature_flag', sa.String(100), nullable=True),
        sa.Column('badge', sa.String(50), nullable=True),
    )
    op.create_index('ix_smriti_menus_module', 'smriti_menus', ['module'])

    # smriti_security_audits
    op.create_table(
        'smriti_security_audits',
        sa.Column('id', sa.String(50), primary_key=True),
        sa.Column('uuid', sa.String(36), nullable=False, unique=True),
        sa.Column('company_id', sa.String(50), sa.ForeignKey('companies.id', ondelete='RESTRICT'), nullable=True),
        sa.Column('branch_id', sa.String(50), sa.ForeignKey('branches.id', ondelete='RESTRICT'), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('modified_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_by', sa.String(100), nullable=True),
        sa.Column('updated_by', sa.String(100), nullable=True),
        sa.Column('is_active', sa.Boolean(), default=True),
        sa.Column('is_deleted', sa.Boolean(), default=False),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('deleted_by', sa.String(100), nullable=True),
        sa.Column('version', sa.Integer(), default=1),
        sa.Column('user_id', sa.String(50), nullable=False),
        sa.Column('username', sa.String(80), nullable=False),
        sa.Column('action', sa.String(100), nullable=False),
        sa.Column('old_value', sa.Text(), nullable=True),
        sa.Column('new_value', sa.Text(), nullable=True),
        sa.Column('reason', sa.Text(), nullable=True),
        sa.Column('ip_address', sa.String(50), nullable=True),
        sa.Column('device_info', sa.Text(), nullable=True),
    )
    op.create_index('ix_smriti_security_audits_user_id', 'smriti_security_audits', ['user_id'])


def downgrade() -> None:
    """Drop SMRITI Security & Access Control Framework tables."""
    op.drop_table('smriti_security_audits')
    op.drop_table('smriti_menus')
    op.drop_table('smriti_user_roles')
    op.drop_table('smriti_policy_permissions')
    op.drop_table('smriti_role_policies')
    op.drop_table('smriti_policies')
    op.drop_table('smriti_permissions')
    op.drop_table('smriti_roles')
    op.execute("DROP TYPE IF EXISTS permissiontype")
