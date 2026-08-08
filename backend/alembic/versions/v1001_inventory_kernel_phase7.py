"""add_inventory_kernel_phase7_tables

Revision ID: v1001_inventory_kernel_phase7
Revises: merge_inv_kernel_v1_main
Create Date: 2026-08-03 03:35:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'v1001_inventory_kernel_phase7'
down_revision = 'merge_inv_kernel_v1_main'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'inventory_lock_records',
        sa.Column('id', sa.String(50), primary_key=True),
        sa.Column('uuid', sa.String(36), nullable=False, unique=True),
        sa.Column('tenant_id', sa.String(50), nullable=True, index=True),
        sa.Column('company_id', sa.String(50), sa.ForeignKey('companies.id', ondelete='RESTRICT'), nullable=True, index=True),
        sa.Column('branch_id', sa.String(50), sa.ForeignKey('branches.id', ondelete='RESTRICT'), nullable=True, index=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('modified_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('created_by', sa.String(50), nullable=True),
        sa.Column('updated_by', sa.String(50), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, default=True),
        sa.Column('is_deleted', sa.Boolean(), nullable=False, default=False),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('deleted_by', sa.String(50), nullable=True),
        sa.Column('version', sa.Integer(), nullable=False, default=1),
        sa.Column('workflow_status', sa.String(50), nullable=True),
        sa.Column('document_number', sa.String(100), nullable=True),

        sa.Column('lock_code', sa.String(100), nullable=False, unique=True),
        sa.Column('lock_type', sa.String(50), nullable=False),
        sa.Column('lock_scope', sa.String(50), nullable=False),
        sa.Column('target_id', sa.String(100), nullable=False),
        sa.Column('location_id', sa.String(50), sa.ForeignKey('inventory_location_nodes.id', ondelete='RESTRICT'), nullable=True),
        sa.Column('product_id', sa.String(50), sa.ForeignKey('products.id', ondelete='RESTRICT'), nullable=True),
        sa.Column('locked_qty', sa.Numeric(12, 4), nullable=False, server_default='0.0000'),
        sa.Column('reason', sa.Text(), nullable=False),
        sa.Column('status', sa.String(30), nullable=False, server_default='ACTIVE'),
        sa.Column('effective_from', sa.DateTime(timezone=True), nullable=False),
        sa.Column('effective_until', sa.DateTime(timezone=True), nullable=True),
        sa.Column('released_by', sa.String(50), nullable=True),
        sa.Column('released_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('release_reason', sa.Text(), nullable=True),
    )
    op.create_index('idx_inv_lock_type_scope', 'inventory_lock_records', ['lock_type', 'lock_scope'])
    op.create_index('idx_inv_lock_status', 'inventory_lock_records', ['status'])

    op.create_table(
        'platform_idempotency_records',
        sa.Column('id', sa.String(50), primary_key=True),
        sa.Column('uuid', sa.String(36), nullable=False, unique=True),
        sa.Column('tenant_id', sa.String(50), nullable=True, index=True),
        sa.Column('company_id', sa.String(50), sa.ForeignKey('companies.id', ondelete='RESTRICT'), nullable=True, index=True),
        sa.Column('branch_id', sa.String(50), sa.ForeignKey('branches.id', ondelete='RESTRICT'), nullable=True, index=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('modified_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('created_by', sa.String(50), nullable=True),
        sa.Column('updated_by', sa.String(50), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, default=True),
        sa.Column('is_deleted', sa.Boolean(), nullable=False, default=False),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('deleted_by', sa.String(50), nullable=True),
        sa.Column('version', sa.Integer(), nullable=False, default=1),
        sa.Column('workflow_status', sa.String(50), nullable=True),
        sa.Column('document_number', sa.String(100), nullable=True),

        sa.Column('idempotency_key', sa.String(128), nullable=False, unique=True),
        sa.Column('request_hash', sa.String(64), nullable=False),
        sa.Column('source_system', sa.String(50), nullable=False),
        sa.Column('correlation_id', sa.String(100), nullable=True),
        sa.Column('external_reference', sa.String(100), nullable=True),
        sa.Column('response_payload', postgresql.JSONB(), nullable=True),
        sa.Column('status', sa.String(30), nullable=False, server_default='COMPLETED'),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=True),
    )

    op.create_table(
        'inventory_checkpoint_records',
        sa.Column('id', sa.String(50), primary_key=True),
        sa.Column('uuid', sa.String(36), nullable=False, unique=True),
        sa.Column('tenant_id', sa.String(50), nullable=True, index=True),
        sa.Column('company_id', sa.String(50), sa.ForeignKey('companies.id', ondelete='RESTRICT'), nullable=True, index=True),
        sa.Column('branch_id', sa.String(50), sa.ForeignKey('branches.id', ondelete='RESTRICT'), nullable=True, index=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('modified_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('created_by', sa.String(50), nullable=True),
        sa.Column('updated_by', sa.String(50), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, default=True),
        sa.Column('is_deleted', sa.Boolean(), nullable=False, default=False),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('deleted_by', sa.String(50), nullable=True),
        sa.Column('version', sa.Integer(), nullable=False, default=1),
        sa.Column('workflow_status', sa.String(50), nullable=True),
        sa.Column('document_number', sa.String(100), nullable=True),

        sa.Column('checkpoint_code', sa.String(100), nullable=False, unique=True),
        sa.Column('checkpoint_timestamp', sa.DateTime(timezone=True), nullable=False),
        sa.Column('last_entry_id', sa.String(50), sa.ForeignKey('inventory_ledger_entries.id', ondelete='RESTRICT'), nullable=False),
        sa.Column('location_id', sa.String(50), sa.ForeignKey('inventory_location_nodes.id', ondelete='RESTRICT'), nullable=False),
        sa.Column('product_id', sa.String(50), sa.ForeignKey('products.id', ondelete='RESTRICT'), nullable=False),
        sa.Column('sku', sa.String(100), nullable=False),
        sa.Column('certified_on_hand', sa.Numeric(12, 4), nullable=False),
        sa.Column('certified_unit_cost', sa.Numeric(15, 2), nullable=False, server_default='0.00'),
        sa.Column('checksum', sa.String(64), nullable=False),
        sa.Column('is_certified', sa.Boolean(), nullable=False, default=True),
    )


def downgrade():
    op.drop_table('inventory_checkpoint_records')
    op.drop_table('platform_idempotency_records')
    op.drop_table('inventory_lock_records')
