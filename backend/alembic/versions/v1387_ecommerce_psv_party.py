"""v1387 -- eCommerce integration and PSV visibility tables.

Revision ID: v1387_ecommerce_psv_party
Revises: v1386_distribution_warehousing
Create Date: 2026-08-30 00:00:02.000000

Project      : SMRITI Retail OS
Author       : Migration Integrity Protocol
Description  : Add eCommerce channels, order imports, SKU mappings, stock sync logs, reconciliations, and PSV visibility/party management for v3.25.0 canonical schema.
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'v1387_ecom'
down_revision = 'v1386_dist'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. ecom_channels - Marketplace connectors
    op.create_table(
        'ecom_channels',
        sa.Column('id', sa.String(50), nullable=False),
        sa.Column('uuid', sa.String(36), nullable=False),
        sa.Column('company_id', sa.String(50), nullable=True),
        sa.Column('branch_id', sa.String(50), nullable=True),
        sa.Column('channel_code', sa.String(50), nullable=False),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('channel_type', sa.String(50), nullable=False),
        sa.Column('store_url', sa.String(255), nullable=True),
        sa.Column('api_version', sa.String(20), nullable=False, server_default='2026-01'),
        sa.Column('credential_ref', sa.String(100), nullable=True),
        sa.Column('is_active', sa.Boolean(), server_default='true', nullable=True),
        sa.Column('sync_inventory', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('sync_pricing', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('auto_converge_orders', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('webhook_secret', sa.String(255), nullable=True),
        sa.Column('settings', postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default='{}'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('modified_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('created_by', sa.String(100), nullable=True),
        sa.Column('updated_by', sa.String(100), nullable=True),
        sa.Column('is_deleted', sa.Boolean(), server_default='false', nullable=True),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('deleted_by', sa.String(100), nullable=True),
        sa.Column('version', sa.Integer(), server_default='1', nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('uuid', name='uq_ecom_channels_uuid'),
        sa.UniqueConstraint('channel_code', name='uq_ecom_channel_code'),
        sa.ForeignKeyConstraint(['company_id'], ['companies.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['branch_id'], ['branches.id'], ondelete='RESTRICT'),
        schema='public'
    )
    op.create_index(op.f('ix_ecom_channels_channel_code'), 'ecom_channels', ['channel_code'], unique=False, schema='public')

    # 2. ecom_sku_mappings - External to SMRITI SKU mapping
    op.create_table(
        'ecom_sku_mappings',
        sa.Column('id', sa.String(50), nullable=False),
        sa.Column('uuid', sa.String(36), nullable=False),
        sa.Column('company_id', sa.String(50), nullable=True),
        sa.Column('branch_id', sa.String(50), nullable=True),
        sa.Column('channel_code', sa.String(50), nullable=False),
        sa.Column('external_sku', sa.String(100), nullable=False),
        sa.Column('external_product_id', sa.String(100), nullable=True),
        sa.Column('smriti_sku', sa.String(100), nullable=False),
        sa.Column('item_id', sa.String(50), nullable=False),
        sa.Column('variant_id', sa.String(50), nullable=True),
        sa.Column('is_active', sa.Boolean(), server_default='true', nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('modified_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('created_by', sa.String(100), nullable=True),
        sa.Column('updated_by', sa.String(100), nullable=True),
        sa.Column('is_deleted', sa.Boolean(), server_default='false', nullable=True),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('deleted_by', sa.String(100), nullable=True),
        sa.Column('version', sa.Integer(), server_default='1', nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('uuid', name='uq_ecom_sku_mappings_uuid'),
        sa.UniqueConstraint('channel_code', 'external_sku', name='uq_ecom_channel_sku'),
        sa.ForeignKeyConstraint(['item_id'], ['items.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['variant_id'], ['item_variants.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['company_id'], ['companies.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['branch_id'], ['branches.id'], ondelete='RESTRICT'),
        schema='public'
    )
    op.create_index(op.f('ix_ecom_sku_mappings_channel'), 'ecom_sku_mappings', ['channel_code'], unique=False, schema='public')
    op.create_index(op.f('ix_ecom_sku_mappings_external_sku'), 'ecom_sku_mappings', ['external_sku'], unique=False, schema='public')
    op.create_index(op.f('ix_ecom_sku_mappings_smriti_sku'), 'ecom_sku_mappings', ['smriti_sku'], unique=False, schema='public')

    # 3. ecom_order_imports - Order deduplication and convergence
    op.create_table(
        'ecom_order_imports',
        sa.Column('id', sa.String(50), nullable=False),
        sa.Column('uuid', sa.String(36), nullable=False),
        sa.Column('company_id', sa.String(50), nullable=True),
        sa.Column('branch_id', sa.String(50), nullable=True),
        sa.Column('channel_code', sa.String(50), nullable=False),
        sa.Column('external_order_id', sa.String(100), nullable=False),
        sa.Column('external_order_number', sa.String(100), nullable=True),
        sa.Column('order_status', sa.String(50), nullable=False, server_default='PENDING'),
        sa.Column('idempotency_key', sa.String(100), nullable=True),
        sa.Column('customer_email', sa.String(255), nullable=True),
        sa.Column('customer_mobile', sa.String(30), nullable=True),
        sa.Column('customer_name', sa.String(255), nullable=True),
        sa.Column('currency', sa.String(10), nullable=False, server_default='INR'),
        sa.Column('gross_amount', sa.Numeric(15, 2), nullable=False, server_default='0.00'),
        sa.Column('tax_amount', sa.Numeric(15, 2), nullable=False, server_default='0.00'),
        sa.Column('shipping_amount', sa.Numeric(15, 2), nullable=False, server_default='0.00'),
        sa.Column('discount_amount', sa.Numeric(15, 2), nullable=False, server_default='0.00'),
        sa.Column('net_amount', sa.Numeric(15, 2), nullable=False, server_default='0.00'),
        sa.Column('payload', postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default='{}'),
        sa.Column('converged_invoice_id', sa.String(50), nullable=True),
        sa.Column('converged_order_id', sa.String(50), nullable=True),
        sa.Column('retry_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('max_retries', sa.Integer(), nullable=False, server_default='3'),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('last_retry_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('imported_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('modified_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('created_by', sa.String(100), nullable=True),
        sa.Column('updated_by', sa.String(100), nullable=True),
        sa.Column('is_active', sa.Boolean(), server_default='true', nullable=True),
        sa.Column('is_deleted', sa.Boolean(), server_default='false', nullable=True),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('deleted_by', sa.String(100), nullable=True),
        sa.Column('version', sa.Integer(), server_default='1', nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('uuid', name='uq_ecom_order_imports_uuid'),
        sa.UniqueConstraint('channel_code', 'external_order_id', name='uq_ecom_channel_order'),
        sa.UniqueConstraint('idempotency_key', name='uq_ecom_idempotency_key'),
        sa.ForeignKeyConstraint(['company_id'], ['companies.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['branch_id'], ['branches.id'], ondelete='RESTRICT'),
        schema='public'
    )
    op.create_index(op.f('ix_ecom_order_imports_channel'), 'ecom_order_imports', ['channel_code'], unique=False, schema='public')
    op.create_index(op.f('ix_ecom_order_imports_converged_invoice'), 'ecom_order_imports', ['converged_invoice_id'], unique=False, schema='public')

    # 4. ecom_stock_sync_logs - Inventory broadcast audit
    op.create_table(
        'ecom_stock_sync_logs',
        sa.Column('id', sa.String(50), nullable=False),
        sa.Column('uuid', sa.String(36), nullable=False),
        sa.Column('company_id', sa.String(50), nullable=True),
        sa.Column('branch_id', sa.String(50), nullable=True),
        sa.Column('channel_code', sa.String(50), nullable=False),
        sa.Column('external_sku', sa.String(100), nullable=False),
        sa.Column('smriti_sku', sa.String(100), nullable=False),
        sa.Column('quantity_synced', sa.Numeric(12, 4), nullable=False, server_default='0.0000'),
        sa.Column('status', sa.String(30), nullable=False, server_default='SUCCESS'),
        sa.Column('response_payload', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('synced_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('modified_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('created_by', sa.String(100), nullable=True),
        sa.Column('updated_by', sa.String(100), nullable=True),
        sa.Column('is_active', sa.Boolean(), server_default='true', nullable=True),
        sa.Column('is_deleted', sa.Boolean(), server_default='false', nullable=True),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('deleted_by', sa.String(100), nullable=True),
        sa.Column('version', sa.Integer(), server_default='1', nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('uuid', name='uq_ecom_stock_sync_logs_uuid'),
        sa.ForeignKeyConstraint(['company_id'], ['companies.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['branch_id'], ['branches.id'], ondelete='RESTRICT'),
        schema='public'
    )

    # 5. ecom_reconciliations - Channel settlement reconciliation
    op.create_table(
        'ecom_reconciliations',
        sa.Column('id', sa.String(50), nullable=False),
        sa.Column('uuid', sa.String(36), nullable=False),
        sa.Column('company_id', sa.String(50), nullable=True),
        sa.Column('branch_id', sa.String(50), nullable=True),
        sa.Column('reconciliation_no', sa.String(50), nullable=False),
        sa.Column('channel_code', sa.String(50), nullable=False),
        sa.Column('period_start', sa.Date(), nullable=False),
        sa.Column('period_end', sa.Date(), nullable=False),
        sa.Column('channel_order_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('channel_gross_revenue', sa.Numeric(15, 2), nullable=False, server_default='0.00'),
        sa.Column('smriti_order_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('smriti_gross_revenue', sa.Numeric(15, 2), nullable=False, server_default='0.00'),
        sa.Column('variance_amount', sa.Numeric(15, 2), nullable=False, server_default='0.00'),
        sa.Column('status', sa.String(30), nullable=False, server_default='RECONCILED'),
        sa.Column('discrepancy_details', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('reconciled_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('modified_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('created_by', sa.String(100), nullable=True),
        sa.Column('updated_by', sa.String(100), nullable=True),
        sa.Column('is_active', sa.Boolean(), server_default='true', nullable=True),
        sa.Column('is_deleted', sa.Boolean(), server_default='false', nullable=True),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('deleted_by', sa.String(100), nullable=True),
        sa.Column('version', sa.Integer(), server_default='1', nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('uuid', name='uq_ecom_reconciliations_uuid'),
        sa.UniqueConstraint('reconciliation_no', name='uq_ecom_reconciliation_no'),
        sa.ForeignKeyConstraint(['company_id'], ['companies.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['branch_id'], ['branches.id'], ondelete='RESTRICT'),
        schema='public'
    )
    op.create_index(op.f('ix_ecom_reconciliations_channel'), 'ecom_reconciliations', ['channel_code'], unique=False, schema='public')

    # 6. party_addresses - Multi-address support for parties
    op.create_table(
        'party_addresses',
        sa.Column('id', sa.String(50), nullable=False),
        sa.Column('uuid', sa.String(36), nullable=False),
        sa.Column('company_id', sa.String(50), nullable=True),
        sa.Column('branch_id', sa.String(50), nullable=True),
        sa.Column('party_id', sa.String(50), nullable=False),
        sa.Column('address_type', sa.String(30), nullable=False, server_default='BILLING'),
        sa.Column('address_title', sa.String(100), nullable=True),
        sa.Column('address_line1', sa.Text(), nullable=False),
        sa.Column('address_line2', sa.Text(), nullable=True),
        sa.Column('city', sa.String(100), nullable=False),
        sa.Column('state', sa.String(100), nullable=False),
        sa.Column('state_code', sa.String(5), nullable=True),
        sa.Column('pincode', sa.String(10), nullable=False),
        sa.Column('country', sa.String(100), nullable=False, server_default='India'),
        sa.Column('gstin', sa.String(15), nullable=True),
        sa.Column('is_primary', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('modified_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('created_by', sa.String(100), nullable=True),
        sa.Column('updated_by', sa.String(100), nullable=True),
        sa.Column('is_active', sa.Boolean(), server_default='true', nullable=True),
        sa.Column('is_deleted', sa.Boolean(), server_default='false', nullable=True),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('deleted_by', sa.String(100), nullable=True),
        sa.Column('version', sa.Integer(), server_default='1', nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('uuid', name='uq_party_addresses_uuid'),
        sa.ForeignKeyConstraint(['party_id'], ['parties.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['company_id'], ['companies.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['branch_id'], ['branches.id'], ondelete='RESTRICT'),
        schema='public'
    )
    op.create_index(op.f('ix_party_addresses_party_id'), 'party_addresses', ['party_id'], unique=False, schema='public')

    # 7. party_contacts - Contact persons for parties
    op.create_table(
        'party_contacts',
        sa.Column('id', sa.String(50), nullable=False),
        sa.Column('uuid', sa.String(36), nullable=False),
        sa.Column('company_id', sa.String(50), nullable=True),
        sa.Column('branch_id', sa.String(50), nullable=True),
        sa.Column('party_id', sa.String(50), nullable=False),
        sa.Column('contact_name', sa.String(150), nullable=False),
        sa.Column('designation', sa.String(100), nullable=True),
        sa.Column('department', sa.String(100), nullable=True),
        sa.Column('phone', sa.String(20), nullable=True),
        sa.Column('mobile', sa.String(20), nullable=True),
        sa.Column('email', sa.String(255), nullable=True),
        sa.Column('is_primary', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('modified_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('created_by', sa.String(100), nullable=True),
        sa.Column('updated_by', sa.String(100), nullable=True),
        sa.Column('is_active', sa.Boolean(), server_default='true', nullable=True),
        sa.Column('is_deleted', sa.Boolean(), server_default='false', nullable=True),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('deleted_by', sa.String(100), nullable=True),
        sa.Column('version', sa.Integer(), server_default='1', nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('uuid', name='uq_party_contacts_uuid'),
        sa.ForeignKeyConstraint(['party_id'], ['parties.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['company_id'], ['companies.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['branch_id'], ['branches.id'], ondelete='RESTRICT'),
        schema='public'
    )
    op.create_index(op.f('ix_party_contacts_party_id'), 'party_contacts', ['party_id'], unique=False, schema='public')

    # 8. party_relationships - Inter-party hierarchies
    op.create_table(
        'party_relationships',
        sa.Column('id', sa.String(50), nullable=False),
        sa.Column('uuid', sa.String(36), nullable=False),
        sa.Column('company_id', sa.String(50), nullable=True),
        sa.Column('branch_id', sa.String(50), nullable=True),
        sa.Column('source_party_id', sa.String(50), nullable=False),
        sa.Column('target_party_id', sa.String(50), nullable=False),
        sa.Column('relationship_type', sa.String(50), nullable=False),
        sa.Column('metadata_json', postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default='{}'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('modified_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('created_by', sa.String(100), nullable=True),
        sa.Column('updated_by', sa.String(100), nullable=True),
        sa.Column('is_active', sa.Boolean(), server_default='true', nullable=True),
        sa.Column('is_deleted', sa.Boolean(), server_default='false', nullable=True),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('deleted_by', sa.String(100), nullable=True),
        sa.Column('version', sa.Integer(), server_default='1', nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('uuid', name='uq_party_relationships_uuid'),
        sa.ForeignKeyConstraint(['source_party_id'], ['parties.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['target_party_id'], ['parties.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['company_id'], ['companies.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['branch_id'], ['branches.id'], ondelete='RESTRICT'),
        schema='public'
    )
    op.create_index(op.f('ix_party_relationships_source'), 'party_relationships', ['source_party_id'], unique=False, schema='public')
    op.create_index(op.f('ix_party_relationships_target'), 'party_relationships', ['target_party_id'], unique=False, schema='public')

    # 9. psv_party_scopes - Visibility scope bindings
    op.create_table(
        'psv_party_scopes',
        sa.Column('id', sa.String(50), nullable=False),
        sa.Column('uuid', sa.String(36), nullable=False),
        sa.Column('company_id', sa.String(50), nullable=True),
        sa.Column('branch_id', sa.String(50), nullable=True),
        sa.Column('party_id', sa.String(50), nullable=False),
        sa.Column('policy_code', sa.String(50), nullable=False),
        sa.Column('allowed_branch_ids', postgresql.ARRAY(sa.String()), server_default='{}', nullable=False),
        sa.Column('allowed_categories', postgresql.ARRAY(sa.String()), server_default='{}', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('modified_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('created_by', sa.String(100), nullable=True),
        sa.Column('updated_by', sa.String(100), nullable=True),
        sa.Column('is_active', sa.Boolean(), server_default='true', nullable=True),
        sa.Column('is_deleted', sa.Boolean(), server_default='false', nullable=True),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('deleted_by', sa.String(100), nullable=True),
        sa.Column('version', sa.Integer(), server_default='1', nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('uuid', name='uq_psv_party_scopes_uuid'),
        sa.ForeignKeyConstraint(['party_id'], ['parties.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['company_id'], ['companies.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['branch_id'], ['branches.id'], ondelete='RESTRICT'),
        schema='public'
    )
    op.create_index(op.f('ix_psv_party_scopes_party'), 'psv_party_scopes', ['party_id'], unique=False, schema='public')
    op.create_index(op.f('ix_psv_party_scopes_policy'), 'psv_party_scopes', ['policy_code'], unique=False, schema='public')

    # 10. psv_visibility_policies - Visibility policy definitions
    op.create_table(
        'psv_visibility_policies',
        sa.Column('id', sa.String(50), nullable=False),
        sa.Column('uuid', sa.String(36), nullable=False),
        sa.Column('company_id', sa.String(50), nullable=True),
        sa.Column('branch_id', sa.String(50), nullable=True),
        sa.Column('policy_code', sa.String(50), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('allowed_sku_patterns', postgresql.ARRAY(sa.String()), server_default='{}', nullable=False),
        sa.Column('max_lookback_days', sa.Integer(), nullable=False, server_default='90'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('modified_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('created_by', sa.String(100), nullable=True),
        sa.Column('updated_by', sa.String(100), nullable=True),
        sa.Column('is_active', sa.Boolean(), server_default='true', nullable=True),
        sa.Column('is_deleted', sa.Boolean(), server_default='false', nullable=True),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('deleted_by', sa.String(100), nullable=True),
        sa.Column('version', sa.Integer(), server_default='1', nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('uuid', name='uq_psv_visibility_policies_uuid'),
        sa.UniqueConstraint('policy_code', name='uq_psv_policy_code'),
        sa.ForeignKeyConstraint(['company_id'], ['companies.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['branch_id'], ['branches.id'], ondelete='RESTRICT'),
        schema='public'
    )


def downgrade() -> None:
    op.drop_table('psv_visibility_policies', schema='public')
    op.drop_table('psv_party_scopes', schema='public')
    op.drop_table('party_relationships', schema='public')
    op.drop_table('party_contacts', schema='public')
    op.drop_table('party_addresses', schema='public')
    op.drop_table('ecom_reconciliations', schema='public')
    op.drop_table('ecom_stock_sync_logs', schema='public')
    op.drop_table('ecom_order_imports', schema='public')
    op.drop_table('ecom_sku_mappings', schema='public')
    op.drop_table('ecom_channels', schema='public')
