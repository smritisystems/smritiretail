"""v1383 -- Add missing invoice and communicator schemas.

Revision ID: v1383_invoice_communicator
Revises: v1382_menu_registry
Create Date: 2026-08-30 00:00:00.000000

Project      : SMRITI Retail OS
Author       : Migration Integrity Recovery
Description  : Alembic migration to add missing invoice document artifacts,
               tax invoice templates, sales order allocations, and communicator
               templates/logs. These tables are defined in ORM models but were
               missing from the migration chain.

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'v1383_invoice_communicator'
down_revision = 'v1382_menu_registry'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create communicator_templates table
    op.create_table(
        'communicator_templates',
        sa.Column('id', sa.String(50), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.Column('created_by', sa.String(50), nullable=True),
        sa.Column('updated_by', sa.String(50), nullable=True),
        sa.Column('name', sa.String(200), nullable=False),
        sa.Column('code', sa.String(50), nullable=False),
        sa.Column('channel', sa.String(30), nullable=False, server_default='WHATSAPP'),
        sa.Column('subject_template', sa.String(255), nullable=True),
        sa.Column('body_template', sa.Text(), nullable=False),
        sa.Column('status', sa.String(30), nullable=False, server_default='ACTIVE'),
        sa.Column('description', sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('code', name='uq_communicator_templates_code')
    )
    op.create_index('ix_communicator_templates_code', 'communicator_templates', ['code'], unique=True)

    # Create communicator_logs table
    op.create_table(
        'communicator_logs',
        sa.Column('id', sa.String(50), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.Column('created_by', sa.String(50), nullable=True),
        sa.Column('updated_by', sa.String(50), nullable=True),
        sa.Column('template_id', sa.String(50), nullable=True),
        sa.Column('channel', sa.String(30), nullable=False),
        sa.Column('recipient', sa.String(200), nullable=False),
        sa.Column('reference_doc_type', sa.String(50), nullable=True),
        sa.Column('reference_doc_id', sa.String(50), nullable=True),
        sa.Column('rendered_subject', sa.String(255), nullable=True),
        sa.Column('rendered_body', sa.Text(), nullable=False),
        sa.Column('status', sa.String(30), nullable=False, server_default='SENT'),
        sa.Column('gateway_response', sa.Text(), nullable=True),
        sa.Column('dispatched_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=True),
        sa.ForeignKeyConstraint(['template_id'], ['communicator_templates.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_communicator_logs_recipient', 'communicator_logs', ['recipient'])
    op.create_index('ix_communicator_logs_reference_doc_type', 'communicator_logs', ['reference_doc_type'])
    op.create_index('ix_communicator_logs_reference_doc_id', 'communicator_logs', ['reference_doc_id'])

    # Create tax_invoice_templates table
    op.create_table(
        'tax_invoice_templates',
        sa.Column('id', sa.String(50), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.Column('created_by', sa.String(50), nullable=True),
        sa.Column('updated_by', sa.String(50), nullable=True),
        sa.Column('template_code', sa.String(100), nullable=False),
        sa.Column('template_name', sa.String(255), nullable=False),
        sa.Column('template_type', sa.String(50), nullable=False, server_default='TAX_INVOICE'),
        sa.Column('status', sa.String(50), nullable=False, server_default='FROZEN'),
        sa.Column('current_version', sa.String(50), nullable=False, server_default='V1'),
        sa.Column('effective_from', sa.Date(), nullable=False),
        sa.Column('layout_configuration', postgresql.JSON(astext_type=sa.Text()), nullable=False),
        sa.Column('configuration_hash', sa.String(64), nullable=False),
        sa.Column('is_default', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('template_code', name='uq_tax_invoice_templates_code')
    )
    op.create_index('ix_tax_invoice_templates_code', 'tax_invoice_templates', ['template_code'], unique=True)

    # Create tax_invoice_template_versions table
    op.create_table(
        'tax_invoice_template_versions',
        sa.Column('id', sa.String(50), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.Column('created_by', sa.String(50), nullable=True),
        sa.Column('updated_by', sa.String(50), nullable=True),
        sa.Column('template_id', sa.String(50), nullable=False),
        sa.Column('version', sa.String(50), nullable=False),
        sa.Column('status', sa.String(50), nullable=False, server_default='FROZEN'),
        sa.Column('layout_configuration', postgresql.JSON(astext_type=sa.Text()), nullable=False),
        sa.Column('configuration_hash', sa.String(64), nullable=False),
        sa.Column('effective_from', sa.Date(), nullable=False),
        sa.ForeignKeyConstraint(['template_id'], ['tax_invoice_templates.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_tax_invoice_template_versions_template_id', 'tax_invoice_template_versions', ['template_id'])

    # Create invoice_document_artifacts table
    op.create_table(
        'invoice_document_artifacts',
        sa.Column('id', sa.String(50), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.Column('created_by', sa.String(50), nullable=True),
        sa.Column('updated_by', sa.String(50), nullable=True),
        sa.Column('invoice_id', sa.String(50), nullable=False),
        sa.Column('invoice_no', sa.String(100), nullable=False),
        sa.Column('document_type', sa.String(50), nullable=False, server_default='TAX_INVOICE'),
        sa.Column('template_code', sa.String(100), nullable=False, server_default='TAX_INVOICE_TATTLY_THREADS'),
        sa.Column('template_version', sa.String(50), nullable=False, server_default='V1'),
        sa.Column('template_status', sa.String(50), nullable=False, server_default='FROZEN'),
        sa.Column('storage_path', sa.String(500), nullable=False),
        sa.Column('sha256_hash', sa.String(64), nullable=False),
        sa.Column('file_size', sa.Integer(), nullable=False),
        sa.Column('page_count', sa.Integer(), nullable=False, server_default=sa.text('1')),
        sa.Column('generated_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.Column('is_valid', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('reprint_count', sa.Integer(), nullable=False, server_default=sa.text('0')),
        sa.Column('last_reprinted_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['invoice_id'], ['sales_invoices.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_invoice_document_artifacts_invoice_id', 'invoice_document_artifacts', ['invoice_id'])
    op.create_index('ix_invoice_document_artifacts_invoice_no', 'invoice_document_artifacts', ['invoice_no'])

    # Create sales_order_invoice_allocations table
    op.create_table(
        'sales_order_invoice_allocations',
        sa.Column('id', sa.String(50), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.Column('created_by', sa.String(50), nullable=True),
        sa.Column('updated_by', sa.String(50), nullable=True),
        sa.Column('order_id', sa.String(50), nullable=False),
        sa.Column('order_no', sa.String(100), nullable=False),
        sa.Column('po_number', sa.String(100), nullable=False),
        sa.Column('invoice_id', sa.String(50), nullable=False),
        sa.Column('invoice_no', sa.String(100), nullable=False),
        sa.Column('invoice_date', sa.Date(), nullable=False),
        sa.Column('po_quantity', sa.Numeric(precision=15, scale=4), nullable=False, server_default=sa.text('0.0000')),
        sa.Column('po_value', sa.Numeric(precision=15, scale=2), nullable=False, server_default=sa.text('0.00')),
        sa.Column('billed_quantity', sa.Numeric(precision=15, scale=4), nullable=False, server_default=sa.text('0.0000')),
        sa.Column('billed_value', sa.Numeric(precision=15, scale=2), nullable=False, server_default=sa.text('0.00')),
        sa.Column('pending_quantity', sa.Numeric(precision=15, scale=4), nullable=False, server_default=sa.text('0.0000')),
        sa.Column('pending_value', sa.Numeric(precision=15, scale=2), nullable=False, server_default=sa.text('0.00')),
        sa.Column('status', sa.String(50), nullable=False, server_default='ALLOCATED'),
        sa.Column('allocation_metadata', postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.ForeignKeyConstraint(['order_id'], ['sales_orders.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['invoice_id'], ['sales_invoices.id'], ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_sales_order_invoice_allocations_order_id', 'sales_order_invoice_allocations', ['order_id'])
    op.create_index('ix_sales_order_invoice_allocations_order_no', 'sales_order_invoice_allocations', ['order_no'])
    op.create_index('ix_sales_order_invoice_allocations_po_number', 'sales_order_invoice_allocations', ['po_number'])
    op.create_index('ix_sales_order_invoice_allocations_invoice_id', 'sales_order_invoice_allocations', ['invoice_id'])
    op.create_index('ix_sales_order_invoice_allocations_invoice_no', 'sales_order_invoice_allocations', ['invoice_no'])


def downgrade() -> None:
    # Drop tables in reverse order (due to ForeignKey constraints)
    op.drop_table('sales_order_invoice_allocations')
    op.drop_table('invoice_document_artifacts')
    op.drop_table('tax_invoice_template_versions')
    op.drop_table('tax_invoice_templates')
    op.drop_table('communicator_logs')
    op.drop_table('communicator_templates')
