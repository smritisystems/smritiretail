"""v620_quality_inspection_engine

Revision ID: v620_quality_inspection
Revises: v610_purchase_requisitions
Create Date: 2026-07-21
"""
from alembic import op
import sqlalchemy as sa

revision = 'v620_quality_inspection'
down_revision = 'v610_purchase_requisitions'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Add qc_status column to purchase_receipts
    op.add_column('purchase_receipts', sa.Column('qc_status', sa.String(30), nullable=False, server_default='PendingInspection'))

    # 2. Create quality_inspections table
    op.create_table(
        'quality_inspections',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('uuid', sa.String(), nullable=False),
        sa.Column('tenant_id', sa.String(), nullable=True),
        sa.Column('company_id', sa.String(), nullable=False),
        sa.Column('branch_id', sa.String(), nullable=True),
        sa.Column('inspection_no', sa.String(), nullable=False),
        sa.Column('receipt_id', sa.String(), sa.ForeignKey('purchase_receipts.id', ondelete='CASCADE'), nullable=False),
        sa.Column('supplier_id', sa.String(), sa.ForeignKey('suppliers.id', ondelete='RESTRICT'), nullable=False),
        sa.Column('inspector_id', sa.String(), nullable=True),
        sa.Column('inspected_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('overall_status', sa.String(30), nullable=False, server_default='PendingInspection'),
        # PendingInspection, UnderInspection, Passed, PassedWithExceptions, Failed
        sa.Column('total_received_qty', sa.Numeric(10, 2), nullable=False, server_default='0.00'),
        sa.Column('total_accepted_qty', sa.Numeric(10, 2), nullable=False, server_default='0.00'),
        sa.Column('total_rejected_qty', sa.Numeric(10, 2), nullable=False, server_default='0.00'),
        sa.Column('total_quarantine_qty', sa.Numeric(10, 2), nullable=False, server_default='0.00'),
        sa.Column('debit_note_id', sa.String(), nullable=True),
        sa.Column('remarks', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('modified_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('created_by', sa.String(), nullable=True),
        sa.Column('updated_by', sa.String(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('is_deleted', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('deleted_by', sa.String(), nullable=True),
        sa.Column('version', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('workflow_status', sa.String(), nullable=True),
        sa.Column('document_number', sa.String(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('uuid'),
        sa.UniqueConstraint('inspection_no')
    )
    op.create_index('ix_quality_inspections_receipt_id', 'quality_inspections', ['receipt_id'])
    op.create_index('ix_quality_inspections_overall_status', 'quality_inspections', ['overall_status'])

    # 3. Create quality_inspection_items table
    op.create_table(
        'quality_inspection_items',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('uuid', sa.String(), nullable=False),
        sa.Column('tenant_id', sa.String(), nullable=True),
        sa.Column('company_id', sa.String(), nullable=True),
        sa.Column('branch_id', sa.String(), nullable=True),
        sa.Column('inspection_id', sa.String(), sa.ForeignKey('quality_inspections.id', ondelete='CASCADE'), nullable=False),
        sa.Column('product_id', sa.String(), sa.ForeignKey('products.id', ondelete='RESTRICT'), nullable=False),
        sa.Column('received_quantity', sa.Numeric(10, 2), nullable=False),
        sa.Column('inspected_quantity', sa.Numeric(10, 2), nullable=False, server_default='0.00'),
        sa.Column('accepted_quantity', sa.Numeric(10, 2), nullable=False, server_default='0.00'),
        sa.Column('rejected_quantity', sa.Numeric(10, 2), nullable=False, server_default='0.00'),
        sa.Column('quarantine_quantity', sa.Numeric(10, 2), nullable=False, server_default='0.00'),
        sa.Column('defect_category', sa.String(50), nullable=True),  # NONE, CRITICAL, MAJOR, MINOR
        sa.Column('defect_reason', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('modified_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('created_by', sa.String(), nullable=True),
        sa.Column('updated_by', sa.String(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('is_deleted', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('deleted_by', sa.String(), nullable=True),
        sa.Column('version', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('workflow_status', sa.String(), nullable=True),
        sa.Column('document_number', sa.String(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('uuid')
    )

    # 4. Create supplier_debit_notes table
    op.create_table(
        'supplier_debit_notes',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('uuid', sa.String(), nullable=False),
        sa.Column('tenant_id', sa.String(), nullable=True),
        sa.Column('company_id', sa.String(), nullable=False),
        sa.Column('branch_id', sa.String(), nullable=True),
        sa.Column('debit_note_no', sa.String(), nullable=False),
        sa.Column('supplier_id', sa.String(), sa.ForeignKey('suppliers.id', ondelete='RESTRICT'), nullable=False),
        sa.Column('receipt_id', sa.String(), sa.ForeignKey('purchase_receipts.id', ondelete='CASCADE'), nullable=False),
        sa.Column('inspection_id', sa.String(), nullable=True),
        sa.Column('claim_amount', sa.Numeric(15, 2), nullable=False, server_default='0.00'),
        sa.Column('tax_amount', sa.Numeric(15, 2), nullable=False, server_default='0.00'),
        sa.Column('total_debit_amount', sa.Numeric(15, 2), nullable=False, server_default='0.00'),
        sa.Column('status', sa.String(30), nullable=False, server_default='DRAFT'),  # DRAFT, ISSUED, SETTLED, CANCELLED
        sa.Column('reason', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('modified_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('created_by', sa.String(), nullable=True),
        sa.Column('updated_by', sa.String(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('is_deleted', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('deleted_by', sa.String(), nullable=True),
        sa.Column('version', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('workflow_status', sa.String(), nullable=True),
        sa.Column('document_number', sa.String(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('uuid'),
        sa.UniqueConstraint('debit_note_no')
    )


def downgrade() -> None:
    op.drop_table('supplier_debit_notes')
    op.drop_table('quality_inspection_items')
    op.drop_table('quality_inspections')
    op.drop_column('purchase_receipts', 'qc_status')
