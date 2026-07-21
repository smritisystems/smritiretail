"""v590_rfq_and_quotation_comparison

Revision ID: v590_rfq_and_quotation
Revises: v580_three_way_matching
Create Date: 2026-07-21
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'v590_rfq_and_quotation'
down_revision = 'v580_three_way_matching'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Create procurement_rfqs table
    op.create_table(
        'procurement_rfqs',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('uuid', sa.String(), nullable=False),
        sa.Column('tenant_id', sa.String(), nullable=True),
        sa.Column('company_id', sa.String(), nullable=False),
        sa.Column('branch_id', sa.String(), nullable=True),
        sa.Column('rfq_code', sa.String(), nullable=False),
        sa.Column('title', sa.String(), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('submission_deadline', sa.DateTime(timezone=True), nullable=False),
        sa.Column('evaluation_profile', sa.String(), nullable=False, server_default='RETAIL_DEFAULT'),
        sa.Column('status', sa.String(), nullable=False, server_default='Draft'),  # Draft, Published, Bidding Open, Under Evaluation, Awarded, Closed, Cancelled
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('modified_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('created_by', sa.String(), nullable=True),
        sa.Column('updated_by', sa.String(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('is_deleted', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('deleted_by', sa.String(), nullable=True),
        sa.Column('version', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('workflow_status', sa.String(), nullable=True, server_default='Approved'),
        sa.Column('document_number', sa.String(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('uuid')
    )
    op.create_index('ix_procurement_rfqs_rfq_code', 'procurement_rfqs', ['rfq_code'])

    # 2. Create procurement_rfq_items table
    op.create_table(
        'procurement_rfq_items',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('uuid', sa.String(), nullable=False),
        sa.Column('tenant_id', sa.String(), nullable=True),
        sa.Column('company_id', sa.String(), nullable=False),
        sa.Column('branch_id', sa.String(), nullable=True),
        sa.Column('rfq_id', sa.String(), sa.ForeignKey('procurement_rfqs.id', ondelete='CASCADE'), nullable=False),
        sa.Column('product_id', sa.String(), sa.ForeignKey('products.id', ondelete='CASCADE'), nullable=False),
        sa.Column('required_quantity', sa.Numeric(10, 2), nullable=False),
        sa.Column('target_unit_price', sa.Numeric(15, 2), nullable=True),
        sa.Column('target_delivery_date', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('modified_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('created_by', sa.String(), nullable=True),
        sa.Column('updated_by', sa.String(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('is_deleted', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('deleted_by', sa.String(), nullable=True),
        sa.Column('version', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('workflow_status', sa.String(), nullable=True, server_default='Approved'),
        sa.Column('document_number', sa.String(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('uuid')
    )

    # 3. Create procurement_rfq_vendors table
    op.create_table(
        'procurement_rfq_vendors',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('rfq_id', sa.String(), sa.ForeignKey('procurement_rfqs.id', ondelete='CASCADE'), nullable=False),
        sa.Column('supplier_id', sa.String(), sa.ForeignKey('suppliers.id', ondelete='CASCADE'), nullable=False),
        sa.Column('invitation_status', sa.String(), nullable=False, server_default='Invited'),
        sa.Column('invited_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id')
    )

    # 4. Create vendor_quotations table
    op.create_table(
        'vendor_quotations',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('uuid', sa.String(), nullable=False),
        sa.Column('tenant_id', sa.String(), nullable=True),
        sa.Column('company_id', sa.String(), nullable=False),
        sa.Column('branch_id', sa.String(), nullable=True),
        sa.Column('rfq_id', sa.String(), sa.ForeignKey('procurement_rfqs.id', ondelete='CASCADE'), nullable=False),
        sa.Column('supplier_id', sa.String(), sa.ForeignKey('suppliers.id', ondelete='CASCADE'), nullable=False),
        sa.Column('quotation_code', sa.String(), nullable=False),
        sa.Column('version_number', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('parent_quotation_id', sa.String(), sa.ForeignKey('vendor_quotations.id'), nullable=True),
        sa.Column('currency_id', sa.String(), nullable=False, server_default='INR'),
        sa.Column('offered_lead_time_days', sa.Integer(), nullable=False, server_default='7'),
        sa.Column('payment_terms', sa.String(), nullable=True),
        sa.Column('quote_validity_date', sa.DateTime(timezone=True), nullable=False),
        sa.Column('total_quote_value', sa.Numeric(15, 2), nullable=False, server_default='0.00'),
        sa.Column('score', sa.Numeric(5, 2), nullable=True),
        sa.Column('rank', sa.Integer(), nullable=True),
        sa.Column('status', sa.String(), nullable=False, server_default='Submitted'),  # Submitted, Revised, Evaluated, Awarded, Rejected
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('modified_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('created_by', sa.String(), nullable=True),
        sa.Column('updated_by', sa.String(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('is_deleted', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('deleted_by', sa.String(), nullable=True),
        sa.Column('version', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('workflow_status', sa.String(), nullable=True, server_default='Approved'),
        sa.Column('document_number', sa.String(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('uuid')
    )

    # 5. Create vendor_quotation_items table
    op.create_table(
        'vendor_quotation_items',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('quotation_id', sa.String(), sa.ForeignKey('vendor_quotations.id', ondelete='CASCADE'), nullable=False),
        sa.Column('product_id', sa.String(), sa.ForeignKey('products.id', ondelete='CASCADE'), nullable=False),
        sa.Column('offered_quantity', sa.Numeric(10, 2), nullable=False),
        sa.Column('offered_unit_price', sa.Numeric(15, 2), nullable=False),
        sa.Column('discount_percentage', sa.Numeric(5, 2), nullable=False, server_default='0.00'),
        sa.Column('net_unit_price', sa.Numeric(15, 2), nullable=False),
        sa.Column('line_total', sa.Numeric(15, 2), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )

    # 6. Create quotation_evaluations table
    op.create_table(
        'quotation_evaluations',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('uuid', sa.String(), nullable=False),
        sa.Column('tenant_id', sa.String(), nullable=True),
        sa.Column('company_id', sa.String(), nullable=False),
        sa.Column('branch_id', sa.String(), nullable=True),
        sa.Column('rfq_id', sa.String(), sa.ForeignKey('procurement_rfqs.id', ondelete='CASCADE'), nullable=False),
        sa.Column('winning_quotation_id', sa.String(), sa.ForeignKey('vendor_quotations.id'), nullable=False),
        sa.Column('winning_supplier_id', sa.String(), sa.ForeignKey('suppliers.id'), nullable=False),
        sa.Column('evaluation_profile', sa.String(), nullable=False),
        sa.Column('winning_score', sa.Numeric(5, 2), nullable=False),
        sa.Column('comparison_matrix_snapshot', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column('awarded_by', sa.String(), nullable=False),
        sa.Column('awarded_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('award_notes', sa.Text(), nullable=True),
        sa.Column('converted_doc_type', sa.String(), nullable=True),  # PURCHASE_ORDER, VENDOR_CONTRACT
        sa.Column('converted_doc_id', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('modified_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('created_by', sa.String(), nullable=True),
        sa.Column('updated_by', sa.String(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('is_deleted', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('deleted_by', sa.String(), nullable=True),
        sa.Column('version', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('workflow_status', sa.String(), nullable=True, server_default='Approved'),
        sa.Column('document_number', sa.String(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('uuid')
    )


def downgrade() -> None:
    op.drop_table('quotation_evaluations')
    op.drop_table('vendor_quotation_items')
    op.drop_table('vendor_quotations')
    op.drop_table('procurement_rfq_vendors')
    op.drop_table('procurement_rfq_items')
    op.drop_table('procurement_rfqs')
