"""add tenant multitenant tables

Revision ID: v1218_tenant_multitenant
Revises: v1217_foundation_platform_v3
Create Date: 2026-08-05 11:05:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = 'v1218_tenant_multitenant'
down_revision = 'v1217_foundation_platform_v3'
branch_labels = None
depends_on = None

def upgrade() -> None:
    # 1. tenants
    op.create_table(
        'tenants',
        sa.Column('id', sa.String(length=50), nullable=False),
        sa.Column('uuid', sa.String(length=36), nullable=False),
        sa.Column('tenant_code', sa.String(length=20), nullable=False),
        sa.Column('tenant_slug', sa.String(length=100), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('lifecycle_state', sa.String(length=30), nullable=False, server_default='CREATED'),
        sa.Column('is_active', sa.Boolean(), nullable=True, server_default=sa.text('true')),
        sa.Column('is_deleted', sa.Boolean(), nullable=True, server_default=sa.text('false')),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('modified_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('uuid')
    )
    op.create_index(op.f('ix_tenants_tenant_code'), 'tenants', ['tenant_code'], unique=True)
    op.create_index(op.f('ix_tenants_tenant_slug'), 'tenants', ['tenant_slug'], unique=True)

    # 2. tenant_settings
    op.create_table(
        'tenant_settings',
        sa.Column('id', sa.String(length=50), nullable=False),
        sa.Column('tenant_id', sa.String(length=50), nullable=False),
        sa.Column('language_code', sa.String(length=10), nullable=False, server_default='en-IN'),
        sa.Column('locale', sa.String(length=10), nullable=False, server_default='en-IN'),
        sa.Column('currency_code', sa.String(length=3), nullable=False, server_default='INR'),
        sa.Column('timezone', sa.String(length=50), nullable=False, server_default='Asia/Kolkata'),
        sa.Column('date_format', sa.String(length=20), nullable=False, server_default='DD/MM/YYYY'),
        sa.Column('number_format', sa.String(length=20), nullable=False, server_default='Indian'),
        sa.Column('decimal_precision', sa.SmallInteger(), nullable=False, server_default='2'),
        sa.Column('ai_enabled', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('sms_enabled', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('email_enabled', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('modified_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_tenant_settings_tenant_id'), 'tenant_settings', ['tenant_id'], unique=True)

    # 3. tenant_provision_profiles
    op.create_table(
        'tenant_provision_profiles',
        sa.Column('id', sa.String(length=50), nullable=False),
        sa.Column('tenant_id', sa.String(length=50), nullable=False),
        sa.Column('setup_version', sa.String(length=20), nullable=False, server_default='1.0.0'),
        sa.Column('schema_version', sa.String(length=20), nullable=False, server_default='3.1.0'),
        sa.Column('platform_version', sa.String(length=20), nullable=False, server_default='1.0.0'),
        sa.Column('industry_pack', sa.String(length=50), nullable=True),
        sa.Column('industry_pack_version', sa.String(length=20), nullable=False, server_default='1.0.0'),
        sa.Column('installed_modules', sa.String(length=1000), nullable=True),
        sa.Column('enabled_features', sa.String(length=1000), nullable=True),
        sa.Column('license_tier', sa.String(length=50), nullable=False, server_default='Enterprise'),
        sa.Column('created_by', sa.String(length=100), nullable=False, server_default='system'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_tenant_provision_profiles_tenant_id'), 'tenant_provision_profiles', ['tenant_id'], unique=False)

    # 4. tenant_provision_journals
    op.create_table(
        'tenant_provision_journals',
        sa.Column('id', sa.String(length=50), nullable=False),
        sa.Column('tenant_id', sa.String(length=50), nullable=False),
        sa.Column('stage_id', sa.String(length=50), nullable=False),
        sa.Column('started_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('finished_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('status', sa.String(length=20), nullable=False, server_default='PASS'),
        sa.Column('duration_ms', sa.SmallInteger(), nullable=True, server_default='0'),
        sa.Column('error_text', sa.String(length=1000), nullable=True),
        sa.Column('attempt', sa.SmallInteger(), nullable=False, server_default='1'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_tenant_provision_journals_tenant_id'), 'tenant_provision_journals', ['tenant_id'], unique=False)
    op.create_index(op.f('ix_tenant_provision_journals_stage_id'), 'tenant_provision_journals', ['stage_id'], unique=False)

def downgrade() -> None:
    op.drop_index(op.f('ix_tenant_provision_journals_stage_id'), table_name='tenant_provision_journals')
    op.drop_index(op.f('ix_tenant_provision_journals_tenant_id'), table_name='tenant_provision_journals')
    op.drop_table('tenant_provision_journals')
    op.drop_index(op.f('ix_tenant_provision_profiles_tenant_id'), table_name='tenant_provision_profiles')
    op.drop_table('tenant_provision_profiles')
    op.drop_index(op.f('ix_tenant_settings_tenant_id'), table_name='tenant_settings')
    op.drop_table('tenant_settings')
    op.drop_index(op.f('ix_tenants_tenant_slug'), table_name='tenants')
    op.drop_index(op.f('ix_tenants_tenant_code'), table_name='tenants')
    op.drop_table('tenants')
