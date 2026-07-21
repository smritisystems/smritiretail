"""v580_three_way_matching_and_landed_cost

Revision ID: v580_three_way_matching
Revises: v570_vendor_contracts
Create Date: 2026-07-21
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'v580_three_way_matching'
down_revision = 'v570_vendor_contracts'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Create three_way_matches table
    op.create_table(
        'three_way_matches',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('uuid', sa.String(), nullable=False),
        sa.Column('tenant_id', sa.String(), nullable=True),
        sa.Column('company_id', sa.String(), nullable=False),
        sa.Column('branch_id', sa.String(), nullable=True),
        sa.Column('po_id', sa.String(), sa.ForeignKey('purchase_orders.id', ondelete='CASCADE'), nullable=False),
        sa.Column('grn_id', sa.String(), sa.ForeignKey('purchase_receipts.id', ondelete='CASCADE'), nullable=False),
        sa.Column('vendor_bill_no', sa.String(), nullable=False),
        sa.Column('vendor_bill_date', sa.DateTime(timezone=True), nullable=True),
        sa.Column('match_status', sa.String(), nullable=False, server_default='Pending'),
        sa.Column('overall_price_variance', sa.Numeric(15, 2), nullable=False, server_default='0.00'),
        sa.Column('overall_qty_variance', sa.Numeric(10, 2), nullable=False, server_default='0.00'),
        sa.Column('approved_by', sa.String(), nullable=True),
        sa.Column('approved_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('approval_notes', sa.String(), nullable=True),
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
    op.create_index('ix_three_way_matches_po_id', 'three_way_matches', ['po_id'])
    op.create_index('ix_three_way_matches_grn_id', 'three_way_matches', ['grn_id'])

    # 2. Create three_way_match_lines table
    op.create_table(
        'three_way_match_lines',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('uuid', sa.String(), nullable=False),
        sa.Column('tenant_id', sa.String(), nullable=True),
        sa.Column('company_id', sa.String(), nullable=False),
        sa.Column('branch_id', sa.String(), nullable=True),
        sa.Column('match_id', sa.String(), sa.ForeignKey('three_way_matches.id', ondelete='CASCADE'), nullable=False),
        sa.Column('product_id', sa.String(), sa.ForeignKey('products.id', ondelete='CASCADE'), nullable=False),
        sa.Column('ordered_qty', sa.Numeric(10, 2), nullable=False, server_default='0.00'),
        sa.Column('received_qty', sa.Numeric(10, 2), nullable=False, server_default='0.00'),
        sa.Column('billed_qty', sa.Numeric(10, 2), nullable=False, server_default='0.00'),
        sa.Column('po_unit_price', sa.Numeric(15, 2), nullable=False, server_default='0.00'),
        sa.Column('billed_unit_price', sa.Numeric(15, 2), nullable=False, server_default='0.00'),
        sa.Column('price_variance_pct', sa.Numeric(5, 2), nullable=False, server_default='0.00'),
        sa.Column('qty_variance_pct', sa.Numeric(5, 2), nullable=False, server_default='0.00'),
        sa.Column('line_status', sa.String(), nullable=False, server_default='Matched'),
        sa.Column('resolution_trace', postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default='[]'),
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
    op.create_index('ix_three_way_match_lines_match_id', 'three_way_match_lines', ['match_id'])

    # 3. Create landed_cost_vouchers table
    op.create_table(
        'landed_cost_vouchers',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('uuid', sa.String(), nullable=False),
        sa.Column('tenant_id', sa.String(), nullable=True),
        sa.Column('company_id', sa.String(), nullable=False),
        sa.Column('branch_id', sa.String(), nullable=True),
        sa.Column('grn_id', sa.String(), sa.ForeignKey('purchase_receipts.id', ondelete='CASCADE'), nullable=False),
        sa.Column('charge_type', sa.String(), nullable=False),  # Freight, Customs, Insurance, Handling
        sa.Column('charge_amount', sa.Numeric(15, 2), nullable=False),
        sa.Column('currency_id', sa.String(), nullable=False, server_default='INR'),
        sa.Column('vendor_name', sa.String(), nullable=True),
        sa.Column('allocation_method', sa.String(), nullable=False, server_default='VALUE'),  # VALUE, WEIGHT, VOLUME, QUANTITY, MANUAL
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
    op.create_index('ix_landed_cost_vouchers_grn_id', 'landed_cost_vouchers', ['grn_id'])

    # 4. Create procurement_tolerance_policies table
    op.create_table(
        'procurement_tolerance_policies',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('uuid', sa.String(), nullable=False),
        sa.Column('tenant_id', sa.String(), nullable=True),
        sa.Column('company_id', sa.String(), nullable=False),
        sa.Column('branch_id', sa.String(), nullable=True),
        sa.Column('level', sa.String(), nullable=False),  # SYSTEM, COMPANY, VENDOR, PRODUCT
        sa.Column('target_id', sa.String(), nullable=True),  # supplier_id or product_id if VENDOR/PRODUCT level
        sa.Column('allowed_price_variance_pct', sa.Numeric(5, 2), nullable=False, server_default='2.00'),
        sa.Column('allowed_qty_variance_pct', sa.Numeric(5, 2), nullable=False, server_default='0.00'),
        sa.Column('auto_approve_under_threshold', sa.Boolean(), nullable=False, server_default='true'),
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

    # 5. Add columns to purchase_receipt_items
    op.add_column('purchase_receipt_items', sa.Column('allocated_landed_cost', sa.Numeric(15, 2), nullable=False, server_default='0.00'))
    op.add_column('purchase_receipt_items', sa.Column('true_landed_unit_cost', sa.Numeric(15, 2), nullable=True))
    op.add_column('purchase_receipt_items', sa.Column('match_status', sa.String(), nullable=False, server_default='Pending'))


def downgrade() -> None:
    op.drop_column('purchase_receipt_items', 'match_status')
    op.drop_column('purchase_receipt_items', 'true_landed_unit_cost')
    op.drop_column('purchase_receipt_items', 'allocated_landed_cost')
    op.drop_table('procurement_tolerance_policies')
    op.drop_table('landed_cost_vouchers')
    op.drop_table('three_way_match_lines')
    op.drop_table('three_way_matches')
