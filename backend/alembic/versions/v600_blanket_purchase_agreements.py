"""v600_blanket_purchase_agreements

Revision ID: v600_blanket_agreements
Revises: v590_rfq_and_quotation
Create Date: 2026-07-21
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'v600_blanket_agreements'
down_revision = 'v590_rfq_and_quotation'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Create blanket_purchase_agreements table
    op.create_table(
        'blanket_purchase_agreements',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('uuid', sa.String(), nullable=False),
        sa.Column('tenant_id', sa.String(), nullable=True),
        sa.Column('company_id', sa.String(), nullable=False),
        sa.Column('branch_id', sa.String(), nullable=True),
        sa.Column('bpa_code', sa.String(), nullable=False),
        sa.Column('title', sa.String(), nullable=False),
        sa.Column('supplier_id', sa.String(), sa.ForeignKey('suppliers.id', ondelete='RESTRICT'), nullable=False),
        sa.Column('valid_from', sa.DateTime(timezone=True), nullable=False),
        sa.Column('valid_to', sa.DateTime(timezone=True), nullable=False),
        sa.Column('max_commitment_value', sa.Numeric(15, 2), nullable=False, server_default='0.00'),
        sa.Column('released_value', sa.Numeric(15, 2), nullable=False, server_default='0.00'),
        sa.Column('remaining_value', sa.Numeric(15, 2), nullable=False, server_default='0.00'),
        sa.Column('terms_and_conditions', sa.Text(), nullable=True),
        sa.Column('status', sa.String(), nullable=False, server_default='Draft'),  # Draft, Active, Exhausted, Expired, Cancelled
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
    op.create_index('ix_blanket_purchase_agreements_bpa_code', 'blanket_purchase_agreements', ['bpa_code'])

    # 2. Create blanket_purchase_agreement_lines table
    op.create_table(
        'blanket_purchase_agreement_lines',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('uuid', sa.String(), nullable=False),
        sa.Column('tenant_id', sa.String(), nullable=True),
        sa.Column('company_id', sa.String(), nullable=True),
        sa.Column('branch_id', sa.String(), nullable=True),
        sa.Column('bpa_id', sa.String(), sa.ForeignKey('blanket_purchase_agreements.id', ondelete='CASCADE'), nullable=False),
        sa.Column('product_id', sa.String(), sa.ForeignKey('products.id', ondelete='CASCADE'), nullable=False),
        sa.Column('agreed_unit_price', sa.Numeric(15, 2), nullable=False),
        sa.Column('committed_quantity', sa.Numeric(10, 2), nullable=False),
        sa.Column('released_quantity', sa.Numeric(10, 2), nullable=False, server_default='0.00'),
        sa.Column('remaining_quantity', sa.Numeric(10, 2), nullable=False),
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

    # 3. Add bpa_id and bpa_release_no columns to purchase_orders
    op.add_column('purchase_orders', sa.Column('bpa_id', sa.String(), sa.ForeignKey('blanket_purchase_agreements.id', ondelete='SET NULL'), nullable=True))
    op.add_column('purchase_orders', sa.Column('bpa_release_no', sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column('purchase_orders', 'bpa_release_no')
    op.drop_column('purchase_orders', 'bpa_id')
    op.drop_table('blanket_purchase_agreement_lines')
    op.drop_table('blanket_purchase_agreements')
