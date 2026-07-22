"""SMRITI Retail OS v5.3.0 Enterprise Customer Master DDL Migration

Revision ID: v530_enterprise_customer
Revises: v522_remediation_schema
Create Date: 2026-07-21 18:00:00.000000

Design Rationale:
-----------------
Upgrades customers table and creates 5 domain child tables to support v5.3.0 Architecture Specification:
1. Adds code, customer_type_id, territory_id, route_id, preferred_language_id, lifecycle_stage, account_status, version, loyalty_tier, loyalty_points_balance, lifetime_points, custom_attributes to customers.
2. Creates customer_addresses table.
3. Creates customer_contacts table.
4. Creates customer_credit_profiles table.
5. Creates customer_tax_profiles table.
6. Creates customer_channel_preferences table.
7. Creates multi-tenant performance and uniqueness indexes.
"""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = 'v530_enterprise_customer'
down_revision: Union[str, Sequence[str], None] = 'v522_remediation_schema'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Upgrade customers table (idempotent column addition)
    op.execute("ALTER TABLE customers ADD COLUMN IF NOT EXISTS code VARCHAR(50)")
    op.execute("ALTER TABLE customers ADD COLUMN IF NOT EXISTS customer_type_id VARCHAR(50)")
    op.execute("ALTER TABLE customers ADD COLUMN IF NOT EXISTS territory_id VARCHAR(50)")
    op.execute("ALTER TABLE customers ADD COLUMN IF NOT EXISTS route_id VARCHAR(50)")
    op.execute("ALTER TABLE customers ADD COLUMN IF NOT EXISTS preferred_language_id VARCHAR(50)")
    op.execute("ALTER TABLE customers ADD COLUMN IF NOT EXISTS lifecycle_stage VARCHAR(30) DEFAULT 'Customer'")
    op.execute("ALTER TABLE customers ADD COLUMN IF NOT EXISTS account_status VARCHAR(20) DEFAULT 'Active'")
    op.execute("ALTER TABLE customers ADD COLUMN IF NOT EXISTS loyalty_tier VARCHAR(30) DEFAULT 'Bronze'")
    op.execute("ALTER TABLE customers ADD COLUMN IF NOT EXISTS loyalty_points_balance NUMERIC(15, 2) DEFAULT '0.00'")
    op.execute("ALTER TABLE customers ADD COLUMN IF NOT EXISTS lifetime_points NUMERIC(15, 2) DEFAULT '0.00'")
    op.execute("ALTER TABLE customers ADD COLUMN IF NOT EXISTS custom_attributes JSONB DEFAULT '{}'::jsonb")
    op.execute("ALTER TABLE customers ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1")

    # Populate default codes for existing customers
    op.execute("UPDATE customers SET code = 'CUS-' || LEFT(id, 8) WHERE code IS NULL")
    op.alter_column('customers', 'code', nullable=False)

    # Indexes on customers
    op.create_index('uq_customers_company_code', 'customers', ['company_id', 'code'], unique=True, postgresql_where=sa.text('is_deleted = false'))
    op.create_index('ix_customers_company_mobile', 'customers', ['company_id', 'mobile'])
    op.create_index('ix_customers_company_name', 'customers', ['company_id', 'name'])
    op.create_index('ix_customers_company_type', 'customers', ['company_id', 'customer_type_id'])
    op.create_index('ix_customers_company_lifecycle', 'customers', ['company_id', 'lifecycle_stage'])
    op.create_index('ix_customers_company_status', 'customers', ['company_id', 'account_status'])

    # 2. Create customer_addresses table
    op.create_table(
        'customer_addresses',
        sa.Column('id', sa.String(length=50), nullable=False),
        sa.Column('uuid', sa.String(length=36), nullable=False),
        sa.Column('tenant_id', sa.String(length=50), nullable=True),
        sa.Column('company_id', sa.String(length=50), nullable=True),
        sa.Column('branch_id', sa.String(length=50), nullable=True),
        sa.Column('customer_id', sa.String(length=50), nullable=False),
        sa.Column('address_type_id', sa.String(length=50), nullable=False),
        sa.Column('house_no', sa.String(length=100), nullable=True),
        sa.Column('building_name', sa.String(length=150), nullable=True),
        sa.Column('street', sa.String(length=255), nullable=True),
        sa.Column('area', sa.String(length=150), nullable=True),
        sa.Column('landmark', sa.String(length=150), nullable=True),
        sa.Column('city', sa.String(length=100), nullable=False),
        sa.Column('district', sa.String(length=100), nullable=True),
        sa.Column('state', sa.String(length=100), nullable=False),
        sa.Column('country', sa.String(length=100), server_default='India', nullable=False),
        sa.Column('pincode', sa.String(length=10), nullable=False),
        sa.Column('is_primary', sa.Boolean(), server_default=sa.text('false'), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('modified_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('created_by', sa.String(length=100), nullable=True),
        sa.Column('updated_by', sa.String(length=100), nullable=True),
        sa.Column('is_active', sa.Boolean(), server_default=sa.text('true'), nullable=False),
        sa.Column('is_deleted', sa.Boolean(), server_default=sa.text('false'), nullable=False),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('deleted_by', sa.String(length=100), nullable=True),
        sa.Column('version', sa.Integer(), server_default='1', nullable=False),
        sa.Column('workflow_status', sa.String(length=30), nullable=True),
        sa.Column('document_number', sa.String(length=80), nullable=True),
        sa.ForeignKeyConstraint(['customer_id'], ['customers.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_customer_addresses_cust_primary', 'customer_addresses', ['company_id', 'customer_id', 'is_primary'])

    # 3. Create customer_contacts table
    op.create_table(
        'customer_contacts',
        sa.Column('id', sa.String(length=50), nullable=False),
        sa.Column('uuid', sa.String(length=36), nullable=False),
        sa.Column('tenant_id', sa.String(length=50), nullable=True),
        sa.Column('company_id', sa.String(length=50), nullable=True),
        sa.Column('branch_id', sa.String(length=50), nullable=True),
        sa.Column('customer_id', sa.String(length=50), nullable=False),
        sa.Column('contact_type_id', sa.String(length=50), nullable=False),
        sa.Column('name', sa.String(length=150), nullable=False),
        sa.Column('designation', sa.String(length=100), nullable=True),
        sa.Column('mobile', sa.String(length=20), nullable=False),
        sa.Column('email', sa.String(length=255), nullable=True),
        sa.Column('is_primary', sa.Boolean(), server_default=sa.text('false'), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('modified_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('created_by', sa.String(length=100), nullable=True),
        sa.Column('updated_by', sa.String(length=100), nullable=True),
        sa.Column('is_active', sa.Boolean(), server_default=sa.text('true'), nullable=False),
        sa.Column('is_deleted', sa.Boolean(), server_default=sa.text('false'), nullable=False),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('deleted_by', sa.String(length=100), nullable=True),
        sa.Column('version', sa.Integer(), server_default='1', nullable=False),
        sa.Column('workflow_status', sa.String(length=30), nullable=True),
        sa.Column('document_number', sa.String(length=80), nullable=True),
        sa.ForeignKeyConstraint(['customer_id'], ['customers.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_customer_contacts_cust_primary', 'customer_contacts', ['company_id', 'customer_id', 'is_primary'])

    # 4. Create customer_credit_profiles table
    op.create_table(
        'customer_credit_profiles',
        sa.Column('id', sa.String(length=50), nullable=False),
        sa.Column('uuid', sa.String(length=36), nullable=False),
        sa.Column('tenant_id', sa.String(length=50), nullable=True),
        sa.Column('company_id', sa.String(length=50), nullable=True),
        sa.Column('branch_id', sa.String(length=50), nullable=True),
        sa.Column('customer_id', sa.String(length=50), nullable=False),
        sa.Column('credit_limit', sa.Numeric(precision=15, scale=2), server_default='0.00', nullable=False),
        sa.Column('credit_days', sa.Integer(), server_default='0', nullable=False),
        sa.Column('block_sales_on_limit', sa.Boolean(), server_default=sa.text('true'), nullable=False),
        sa.Column('allow_override', sa.Boolean(), server_default=sa.text('false'), nullable=False),
        sa.Column('opening_balance', sa.Numeric(precision=15, scale=2), server_default='0.00', nullable=False),
        sa.Column('opening_balance_type', sa.String(length=10), server_default='Dr', nullable=False),
        sa.Column('credit_hold_reason_id', sa.String(length=50), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('modified_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('created_by', sa.String(length=100), nullable=True),
        sa.Column('updated_by', sa.String(length=100), nullable=True),
        sa.Column('is_active', sa.Boolean(), server_default=sa.text('true'), nullable=False),
        sa.Column('is_deleted', sa.Boolean(), server_default=sa.text('false'), nullable=False),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('deleted_by', sa.String(length=100), nullable=True),
        sa.Column('version', sa.Integer(), server_default='1', nullable=False),
        sa.Column('workflow_status', sa.String(length=30), nullable=True),
        sa.Column('document_number', sa.String(length=80), nullable=True),
        sa.ForeignKeyConstraint(['customer_id'], ['customers.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('customer_id')
    )

    # 5. Create customer_tax_profiles table
    op.create_table(
        'customer_tax_profiles',
        sa.Column('id', sa.String(length=50), nullable=False),
        sa.Column('uuid', sa.String(length=36), nullable=False),
        sa.Column('tenant_id', sa.String(length=50), nullable=True),
        sa.Column('company_id', sa.String(length=50), nullable=True),
        sa.Column('branch_id', sa.String(length=50), nullable=True),
        sa.Column('customer_id', sa.String(length=50), nullable=False),
        sa.Column('gstin', sa.String(length=15), nullable=True),
        sa.Column('gst_registration_type_id', sa.String(length=50), nullable=True),
        sa.Column('pan_number', sa.String(length=10), nullable=True),
        sa.Column('aadhaar_number', sa.String(length=12), nullable=True),
        sa.Column('msme_number', sa.String(length=30), nullable=True),
        sa.Column('fssai_license_no', sa.String(length=30), nullable=True),
        sa.Column('drug_license_no', sa.String(length=30), nullable=True),
        sa.Column('is_gst_exempt', sa.Boolean(), server_default=sa.text('false'), nullable=False),
        sa.Column('is_tds_applicable', sa.Boolean(), server_default=sa.text('false'), nullable=False),
        sa.Column('is_tcs_applicable', sa.Boolean(), server_default=sa.text('false'), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('modified_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('created_by', sa.String(length=100), nullable=True),
        sa.Column('updated_by', sa.String(length=100), nullable=True),
        sa.Column('is_active', sa.Boolean(), server_default=sa.text('true'), nullable=False),
        sa.Column('is_deleted', sa.Boolean(), server_default=sa.text('false'), nullable=False),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('deleted_by', sa.String(length=100), nullable=True),
        sa.Column('version', sa.Integer(), server_default='1', nullable=False),
        sa.Column('workflow_status', sa.String(length=30), nullable=True),
        sa.Column('document_number', sa.String(length=80), nullable=True),
        sa.ForeignKeyConstraint(['customer_id'], ['customers.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('customer_id')
    )
    op.create_index('ix_customer_tax_company_gstin', 'customer_tax_profiles', ['company_id', 'gstin'])
    op.create_index('ix_customer_tax_company_pan', 'customer_tax_profiles', ['company_id', 'pan_number'])

    # 6. Create customer_channel_preferences table
    op.create_table(
        'customer_channel_preferences',
        sa.Column('id', sa.String(length=50), nullable=False),
        sa.Column('uuid', sa.String(length=36), nullable=False),
        sa.Column('tenant_id', sa.String(length=50), nullable=True),
        sa.Column('company_id', sa.String(length=50), nullable=True),
        sa.Column('branch_id', sa.String(length=50), nullable=True),
        sa.Column('customer_id', sa.String(length=50), nullable=False),
        sa.Column('channel_type_id', sa.String(length=50), nullable=False),
        sa.Column('is_enabled', sa.Boolean(), server_default=sa.text('true'), nullable=False),
        sa.Column('priority', sa.Integer(), server_default='1', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('modified_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('created_by', sa.String(length=100), nullable=True),
        sa.Column('updated_by', sa.String(length=100), nullable=True),
        sa.Column('is_active', sa.Boolean(), server_default=sa.text('true'), nullable=False),
        sa.Column('is_deleted', sa.Boolean(), server_default=sa.text('false'), nullable=False),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('deleted_by', sa.String(length=100), nullable=True),
        sa.Column('version', sa.Integer(), server_default='1', nullable=False),
        sa.Column('workflow_status', sa.String(length=30), nullable=True),
        sa.Column('document_number', sa.String(length=80), nullable=True),
        sa.ForeignKeyConstraint(['customer_id'], ['customers.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )


def downgrade() -> None:
    op.drop_table('customer_channel_preferences')
    op.drop_index('ix_customer_tax_company_pan', table_name='customer_tax_profiles')
    op.drop_index('ix_customer_tax_company_gstin', table_name='customer_tax_profiles')
    op.drop_table('customer_tax_profiles')
    op.drop_table('customer_credit_profiles')
    op.drop_index('ix_customer_contacts_cust_primary', table_name='customer_contacts')
    op.drop_table('customer_contacts')
    op.drop_index('ix_customer_addresses_cust_primary', table_name='customer_addresses')
    op.drop_table('customer_addresses')

    op.drop_index('ix_customers_company_status', table_name='customers')
    op.drop_index('ix_customers_company_lifecycle', table_name='customers')
    op.drop_index('ix_customers_company_type', table_name='customers')
    op.drop_index('ix_customers_company_name', table_name='customers')
    op.drop_index('ix_customers_company_mobile', table_name='customers')
    op.drop_index('uq_customers_company_code', table_name='customers')

    op.drop_column('customers', 'custom_attributes')
    op.drop_column('customers', 'lifetime_points')
    op.drop_column('customers', 'loyalty_points_balance')
    op.drop_column('customers', 'loyalty_tier')
    op.drop_column('customers', 'version')
    op.drop_column('customers', 'account_status')
    op.drop_column('customers', 'lifecycle_stage')
    op.drop_column('customers', 'preferred_language_id')
    op.drop_column('customers', 'route_id')
    op.drop_column('customers', 'territory_id')
    op.drop_column('customers', 'customer_type_id')
    op.drop_column('customers', 'code')
