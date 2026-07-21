"""SMRITI Retail OS v5.4.0 Enterprise Supplier Master DDL Migration

Revision ID: v540_enterprise_supplier
Revises: v530_enterprise_customer
Create Date: 2026-07-21 18:45:00.000000

Design Rationale:
-----------------
Upgrades suppliers table and creates 6 domain child tables to support v5.4.0 Architecture Specification:
1. Adds trade_name, supplier_type_id, supplier_group_id, lifecycle_stage, account_status, version, custom_attributes to suppliers.
2. Creates supplier_tax_profiles table (1:1).
3. Creates supplier_compliance_profiles table (1:1).
4. Creates supplier_payment_profiles table (1:1).
5. Creates supplier_credit_profiles table (1:1).
6. Creates supplier_bank_details table (1:N).
7. Creates supplier_addresses table (1:N).
8. Creates supplier_contacts table (1:N).
9. Creates multi-tenant performance and uniqueness indexes.
"""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = 'v540_enterprise_supplier'
down_revision: Union[str, Sequence[str], None] = 'v530_enterprise_customer'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Upgrade suppliers table
    op.add_column('suppliers', sa.Column('trade_name', sa.String(length=255), nullable=True))
    op.add_column('suppliers', sa.Column('supplier_type_id', sa.String(length=50), nullable=True))
    op.add_column('suppliers', sa.Column('supplier_group_id', sa.String(length=50), nullable=True))
    op.add_column('suppliers', sa.Column('lifecycle_stage', sa.String(length=30), server_default='Active', nullable=False))
    op.add_column('suppliers', sa.Column('account_status', sa.String(length=20), server_default='Active', nullable=False))
    op.add_column('suppliers', sa.Column('custom_attributes', postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'{}'::jsonb"), nullable=True))

    # Populate default codes for existing suppliers if any null
    op.execute("UPDATE suppliers SET code = 'SUP-' || LEFT(id, 8) WHERE code IS NULL")

    # Indexes on suppliers
    op.create_index('uq_suppliers_company_code', 'suppliers', ['company_id', 'code'], unique=True, postgresql_where=sa.text('is_deleted = false'))
    op.create_index('ix_suppliers_company_mobile', 'suppliers', ['company_id', 'mobile'])
    op.create_index('ix_suppliers_company_name', 'suppliers', ['company_id', 'name'])
    op.create_index('ix_suppliers_company_group', 'suppliers', ['company_id', 'supplier_group_id'])

    # 2. Create supplier_tax_profiles table
    op.create_table(
        'supplier_tax_profiles',
        sa.Column('id', sa.String(length=50), nullable=False),
        sa.Column('uuid', sa.String(length=36), nullable=False),
        sa.Column('tenant_id', sa.String(length=50), nullable=True),
        sa.Column('company_id', sa.String(length=50), nullable=True),
        sa.Column('branch_id', sa.String(length=50), nullable=True),
        sa.Column('supplier_id', sa.String(length=50), nullable=False),
        sa.Column('pan_number', sa.String(length=10), nullable=True),
        sa.Column('gstin', sa.String(length=15), nullable=True),
        sa.Column('gst_registration_type_id', sa.String(length=50), nullable=True),
        sa.Column('is_tds_applicable', sa.Boolean(), server_default='false', nullable=False),
        sa.Column('tds_section_id', sa.String(length=50), nullable=True),
        sa.Column('tds_rate', sa.Numeric(precision=5, scale=2), server_default='0.00', nullable=False),
        sa.Column('is_tcs_applicable', sa.Boolean(), server_default='false', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('modified_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('created_by', sa.String(length=100), nullable=True),
        sa.Column('updated_by', sa.String(length=100), nullable=True),
        sa.Column('is_active', sa.Boolean(), server_default='true', nullable=False),
        sa.Column('is_deleted', sa.Boolean(), server_default='false', nullable=False),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('deleted_by', sa.String(length=100), nullable=True),
        sa.Column('version', sa.Integer(), server_default='1', nullable=False),
        sa.Column('workflow_status', sa.String(length=30), server_default='Approved', nullable=False),
        sa.Column('document_number', sa.String(length=80), nullable=True),
        sa.ForeignKeyConstraint(['supplier_id'], ['suppliers.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('uuid')
    )
    op.create_index('ix_supplier_tax_profiles_supplier_id', 'supplier_tax_profiles', ['supplier_id'], unique=True)
    op.create_index('ix_supplier_tax_profiles_pan', 'supplier_tax_profiles', ['company_id', 'pan_number'])
    op.create_index('ix_supplier_tax_profiles_gstin', 'supplier_tax_profiles', ['company_id', 'gstin'])

    # 3. Create supplier_compliance_profiles table
    op.create_table(
        'supplier_compliance_profiles',
        sa.Column('id', sa.String(length=50), nullable=False),
        sa.Column('uuid', sa.String(length=36), nullable=False),
        sa.Column('tenant_id', sa.String(length=50), nullable=True),
        sa.Column('company_id', sa.String(length=50), nullable=True),
        sa.Column('branch_id', sa.String(length=50), nullable=True),
        sa.Column('supplier_id', sa.String(length=50), nullable=False),
        sa.Column('msme_category', sa.String(length=30), nullable=True),
        sa.Column('msme_number', sa.String(length=50), nullable=True),
        sa.Column('fssai_license_no', sa.String(length=50), nullable=True),
        sa.Column('drug_license_no', sa.String(length=50), nullable=True),
        sa.Column('iec_code', sa.String(length=50), nullable=True),
        sa.Column('valid_from', sa.DateTime(timezone=True), nullable=True),
        sa.Column('expiry_date', sa.DateTime(timezone=True), nullable=True),
        sa.Column('verification_status', sa.String(length=30), server_default='Unverified', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('modified_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('created_by', sa.String(length=100), nullable=True),
        sa.Column('updated_by', sa.String(length=100), nullable=True),
        sa.Column('is_active', sa.Boolean(), server_default='true', nullable=False),
        sa.Column('is_deleted', sa.Boolean(), server_default='false', nullable=False),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('deleted_by', sa.String(length=100), nullable=True),
        sa.Column('version', sa.Integer(), server_default='1', nullable=False),
        sa.Column('workflow_status', sa.String(length=30), server_default='Approved', nullable=False),
        sa.Column('document_number', sa.String(length=80), nullable=True),
        sa.ForeignKeyConstraint(['supplier_id'], ['suppliers.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('uuid')
    )
    op.create_index('ix_supplier_compliance_profiles_supplier_id', 'supplier_compliance_profiles', ['supplier_id'], unique=True)

    # 4. Create supplier_payment_profiles table
    op.create_table(
        'supplier_payment_profiles',
        sa.Column('id', sa.String(length=50), nullable=False),
        sa.Column('uuid', sa.String(length=36), nullable=False),
        sa.Column('tenant_id', sa.String(length=50), nullable=True),
        sa.Column('company_id', sa.String(length=50), nullable=True),
        sa.Column('branch_id', sa.String(length=50), nullable=True),
        sa.Column('supplier_id', sa.String(length=50), nullable=False),
        sa.Column('payment_terms_id', sa.String(length=50), nullable=True),
        sa.Column('payment_mode_id', sa.String(length=50), nullable=True),
        sa.Column('currency_id', sa.String(length=10), server_default='INR', nullable=False),
        sa.Column('payment_cycle', sa.String(length=50), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('modified_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('created_by', sa.String(length=100), nullable=True),
        sa.Column('updated_by', sa.String(length=100), nullable=True),
        sa.Column('is_active', sa.Boolean(), server_default='true', nullable=False),
        sa.Column('is_deleted', sa.Boolean(), server_default='false', nullable=False),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('deleted_by', sa.String(length=100), nullable=True),
        sa.Column('version', sa.Integer(), server_default='1', nullable=False),
        sa.Column('workflow_status', sa.String(length=30), server_default='Approved', nullable=False),
        sa.Column('document_number', sa.String(length=80), nullable=True),
        sa.ForeignKeyConstraint(['supplier_id'], ['suppliers.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('uuid')
    )
    op.create_index('ix_supplier_payment_profiles_supplier_id', 'supplier_payment_profiles', ['supplier_id'], unique=True)

    # 5. Create supplier_credit_profiles table
    op.create_table(
        'supplier_credit_profiles',
        sa.Column('id', sa.String(length=50), nullable=False),
        sa.Column('uuid', sa.String(length=36), nullable=False),
        sa.Column('tenant_id', sa.String(length=50), nullable=True),
        sa.Column('company_id', sa.String(length=50), nullable=True),
        sa.Column('branch_id', sa.String(length=50), nullable=True),
        sa.Column('supplier_id', sa.String(length=50), nullable=False),
        sa.Column('credit_limit', sa.Numeric(precision=15, scale=2), server_default='0.00', nullable=False),
        sa.Column('credit_days', sa.Integer(), server_default='0', nullable=False),
        sa.Column('opening_balance', sa.Numeric(precision=15, scale=2), server_default='0.00', nullable=False),
        sa.Column('opening_balance_type', sa.String(length=10), server_default='Cr', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('modified_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('created_by', sa.String(length=100), nullable=True),
        sa.Column('updated_by', sa.String(length=100), nullable=True),
        sa.Column('is_active', sa.Boolean(), server_default='true', nullable=False),
        sa.Column('is_deleted', sa.Boolean(), server_default='false', nullable=False),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('deleted_by', sa.String(length=100), nullable=True),
        sa.Column('version', sa.Integer(), server_default='1', nullable=False),
        sa.Column('workflow_status', sa.String(length=30), server_default='Approved', nullable=False),
        sa.Column('document_number', sa.String(length=80), nullable=True),
        sa.ForeignKeyConstraint(['supplier_id'], ['suppliers.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('uuid')
    )
    op.create_index('ix_supplier_credit_profiles_supplier_id', 'supplier_credit_profiles', ['supplier_id'], unique=True)

    # 6. Create supplier_bank_details table
    op.create_table(
        'supplier_bank_details',
        sa.Column('id', sa.String(length=50), nullable=False),
        sa.Column('uuid', sa.String(length=36), nullable=False),
        sa.Column('tenant_id', sa.String(length=50), nullable=True),
        sa.Column('company_id', sa.String(length=50), nullable=True),
        sa.Column('branch_id', sa.String(length=50), nullable=True),
        sa.Column('supplier_id', sa.String(length=50), nullable=False),
        sa.Column('bank_name', sa.String(length=150), nullable=False),
        sa.Column('branch_name', sa.String(length=150), nullable=True),
        sa.Column('account_name', sa.String(length=150), nullable=False),
        sa.Column('account_number', sa.String(length=50), nullable=False),
        sa.Column('ifsc_code', sa.String(length=20), nullable=False),
        sa.Column('upi_id', sa.String(length=100), nullable=True),
        sa.Column('is_primary', sa.Boolean(), server_default='false', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('modified_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('created_by', sa.String(length=100), nullable=True),
        sa.Column('updated_by', sa.String(length=100), nullable=True),
        sa.Column('is_active', sa.Boolean(), server_default='true', nullable=False),
        sa.Column('is_deleted', sa.Boolean(), server_default='false', nullable=False),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('deleted_by', sa.String(length=100), nullable=True),
        sa.Column('version', sa.Integer(), server_default='1', nullable=False),
        sa.Column('workflow_status', sa.String(length=30), server_default='Approved', nullable=False),
        sa.Column('document_number', sa.String(length=80), nullable=True),
        sa.ForeignKeyConstraint(['supplier_id'], ['suppliers.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('uuid')
    )
    op.create_index('ix_supplier_bank_details_supplier_id', 'supplier_bank_details', ['supplier_id'])

    # 7. Create supplier_addresses table
    op.create_table(
        'supplier_addresses',
        sa.Column('id', sa.String(length=50), nullable=False),
        sa.Column('uuid', sa.String(length=36), nullable=False),
        sa.Column('tenant_id', sa.String(length=50), nullable=True),
        sa.Column('company_id', sa.String(length=50), nullable=True),
        sa.Column('branch_id', sa.String(length=50), nullable=True),
        sa.Column('supplier_id', sa.String(length=50), nullable=False),
        sa.Column('address_type_id', sa.String(length=50), server_default='Billing', nullable=False),
        sa.Column('house_no', sa.String(length=100), nullable=True),
        sa.Column('building_name', sa.String(length=150), nullable=True),
        sa.Column('street', sa.String(length=255), nullable=True),
        sa.Column('area', sa.String(length=150), nullable=True),
        sa.Column('landmark', sa.String(length=150), nullable=True),
        sa.Column('city', sa.String(length=100), nullable=True),
        sa.Column('district', sa.String(length=100), nullable=True),
        sa.Column('state', sa.String(length=100), nullable=True),
        sa.Column('country', sa.String(length=100), server_default='India', nullable=False),
        sa.Column('pincode', sa.String(length=10), nullable=True),
        sa.Column('is_primary', sa.Boolean(), server_default='false', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('modified_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('created_by', sa.String(length=100), nullable=True),
        sa.Column('updated_by', sa.String(length=100), nullable=True),
        sa.Column('is_active', sa.Boolean(), server_default='true', nullable=False),
        sa.Column('is_deleted', sa.Boolean(), server_default='false', nullable=False),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('deleted_by', sa.String(length=100), nullable=True),
        sa.Column('version', sa.Integer(), server_default='1', nullable=False),
        sa.Column('workflow_status', sa.String(length=30), server_default='Approved', nullable=False),
        sa.Column('document_number', sa.String(length=80), nullable=True),
        sa.ForeignKeyConstraint(['supplier_id'], ['suppliers.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('uuid')
    )
    op.create_index('ix_supplier_addresses_supplier_id', 'supplier_addresses', ['supplier_id'])

    # 8. Create supplier_contacts table
    op.create_table(
        'supplier_contacts',
        sa.Column('id', sa.String(length=50), nullable=False),
        sa.Column('uuid', sa.String(length=36), nullable=False),
        sa.Column('tenant_id', sa.String(length=50), nullable=True),
        sa.Column('company_id', sa.String(length=50), nullable=True),
        sa.Column('branch_id', sa.String(length=50), nullable=True),
        sa.Column('supplier_id', sa.String(length=50), nullable=False),
        sa.Column('contact_type_id', sa.String(length=50), server_default='Primary', nullable=False),
        sa.Column('name', sa.String(length=150), nullable=False),
        sa.Column('designation', sa.String(length=100), nullable=True),
        sa.Column('mobile', sa.String(length=20), nullable=True),
        sa.Column('email', sa.String(length=255), nullable=True),
        sa.Column('is_primary', sa.Boolean(), server_default='false', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('modified_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('created_by', sa.String(length=100), nullable=True),
        sa.Column('updated_by', sa.String(length=100), nullable=True),
        sa.Column('is_active', sa.Boolean(), server_default='true', nullable=False),
        sa.Column('is_deleted', sa.Boolean(), server_default='false', nullable=False),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('deleted_by', sa.String(length=100), nullable=True),
        sa.Column('version', sa.Integer(), server_default='1', nullable=False),
        sa.Column('workflow_status', sa.String(length=30), server_default='Approved', nullable=False),
        sa.Column('document_number', sa.String(length=80), nullable=True),
        sa.ForeignKeyConstraint(['supplier_id'], ['suppliers.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('uuid')
    )
    op.create_index('ix_supplier_contacts_supplier_id', 'supplier_contacts', ['supplier_id'])


def downgrade() -> None:
    op.drop_table('supplier_contacts')
    op.drop_table('supplier_addresses')
    op.drop_table('supplier_bank_details')
    op.drop_table('supplier_credit_profiles')
    op.drop_table('supplier_payment_profiles')
    op.drop_table('supplier_compliance_profiles')
    op.drop_table('supplier_tax_profiles')

    op.drop_index('ix_suppliers_company_group', table_name='suppliers')
    op.drop_index('ix_suppliers_company_name', table_name='suppliers')
    op.drop_index('ix_suppliers_company_mobile', table_name='suppliers')
    op.drop_index('uq_suppliers_company_code', table_name='suppliers')

    op.drop_column('suppliers', 'custom_attributes')
    op.drop_column('suppliers', 'account_status')
    op.drop_column('suppliers', 'lifecycle_stage')
    op.drop_column('suppliers', 'supplier_group_id')
    op.drop_column('suppliers', 'supplier_type_id')
    op.drop_column('suppliers', 'trade_name')
