"""add_enterprise_api_key_tables

Revision ID: 7a89b0123456
Revises: 25c605b77209
Create Date: 2026-07-20 02:25:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '7a89b0123456'
down_revision = '25c605b77209'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'smriti_service_accounts',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('uuid', sa.String(length=36), nullable=False),
        sa.Column('tenant_id', sa.String(length=36), nullable=True),
        sa.Column('company_id', sa.String(length=36), nullable=True),
        sa.Column('branch_id', sa.String(length=36), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('modified_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('created_by', sa.String(length=36), nullable=True),
        sa.Column('updated_by', sa.String(length=36), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('is_deleted', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('deleted_by', sa.String(length=36), nullable=True),
        sa.Column('version', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('workflow_status', sa.String(length=50), nullable=True),
        sa.Column('document_number', sa.String(length=100), nullable=True),
        sa.Column('code', sa.String(length=50), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('uuid'),
        sa.UniqueConstraint('code')
    )
    op.create_index(op.f('ix_smriti_service_accounts_code'), 'smriti_service_accounts', ['code'], unique=True)

    op.create_table(
        'smriti_api_keys',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('uuid', sa.String(length=36), nullable=False),
        sa.Column('tenant_id', sa.String(length=36), nullable=True),
        sa.Column('company_id', sa.String(length=36), nullable=True),
        sa.Column('branch_id', sa.String(length=36), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('modified_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('created_by', sa.String(length=36), nullable=True),
        sa.Column('updated_by', sa.String(length=36), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('is_deleted', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('deleted_by', sa.String(length=36), nullable=True),
        sa.Column('version', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('workflow_status', sa.String(length=50), nullable=True),
        sa.Column('document_number', sa.String(length=100), nullable=True),
        sa.Column('service_account_id', sa.String(length=36), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('key_prefix', sa.String(length=24), nullable=False),
        sa.Column('hashed_secret', sa.String(length=128), nullable=False),
        sa.Column('rate_limit_per_minute', sa.Integer(), nullable=False, server_default='600'),
        sa.Column('allowed_ip_cidrs', sa.JSON(), nullable=True),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('last_used_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['service_account_id'], ['smriti_service_accounts.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('uuid')
    )
    op.create_index(op.f('ix_smriti_api_keys_service_account_id'), 'smriti_api_keys', ['service_account_id'], unique=False)
    op.create_index(op.f('ix_smriti_api_keys_key_prefix'), 'smriti_api_keys', ['key_prefix'], unique=False)

    op.create_table(
        'smriti_api_key_permission_sets',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('uuid', sa.String(length=36), nullable=False),
        sa.Column('tenant_id', sa.String(length=36), nullable=True),
        sa.Column('company_id', sa.String(length=36), nullable=True),
        sa.Column('branch_id', sa.String(length=36), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('modified_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('created_by', sa.String(length=36), nullable=True),
        sa.Column('updated_by', sa.String(length=36), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('is_deleted', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('deleted_by', sa.String(length=36), nullable=True),
        sa.Column('version', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('workflow_status', sa.String(length=50), nullable=True),
        sa.Column('document_number', sa.String(length=100), nullable=True),
        sa.Column('api_key_id', sa.String(length=36), nullable=False),
        sa.Column('permission_set_id', sa.String(length=36), nullable=False),
        sa.ForeignKeyConstraint(['api_key_id'], ['smriti_api_keys.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['permission_set_id'], ['smriti_permission_sets.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('uuid')
    )
    op.create_index(op.f('ix_smriti_api_key_permission_sets_api_key_id'), 'smriti_api_key_permission_sets', ['api_key_id'], unique=False)
    op.create_index(op.f('ix_smriti_api_key_permission_sets_permission_set_id'), 'smriti_api_key_permission_sets', ['permission_set_id'], unique=False)

    op.create_table(
        'smriti_api_key_logs',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('uuid', sa.String(length=36), nullable=False),
        sa.Column('tenant_id', sa.String(length=36), nullable=True),
        sa.Column('company_id', sa.String(length=36), nullable=True),
        sa.Column('branch_id', sa.String(length=36), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('modified_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('created_by', sa.String(length=36), nullable=True),
        sa.Column('updated_by', sa.String(length=36), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('is_deleted', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('deleted_by', sa.String(length=36), nullable=True),
        sa.Column('version', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('workflow_status', sa.String(length=50), nullable=True),
        sa.Column('document_number', sa.String(length=100), nullable=True),
        sa.Column('api_key_id', sa.String(length=36), nullable=False),
        sa.Column('ip_address', sa.String(length=45), nullable=True),
        sa.Column('endpoint', sa.String(length=255), nullable=False),
        sa.Column('http_method', sa.String(length=10), nullable=False),
        sa.Column('status_code', sa.Integer(), nullable=False),
        sa.Column('response_time_ms', sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(['api_key_id'], ['smriti_api_keys.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('uuid')
    )
    op.create_index(op.f('ix_smriti_api_key_logs_api_key_id'), 'smriti_api_key_logs', ['api_key_id'], unique=False)


def downgrade():
    op.drop_table('smriti_api_key_logs')
    op.drop_table('smriti_api_key_permission_sets')
    op.drop_table('smriti_api_keys')
    op.drop_table('smriti_service_accounts')
