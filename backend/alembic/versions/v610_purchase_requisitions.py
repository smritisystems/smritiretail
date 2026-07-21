"""v610_purchase_requisitions

Revision ID: v610_purchase_requisitions
Revises: v600_blanket_agreements
Create Date: 2026-07-21
"""
from alembic import op
import sqlalchemy as sa

revision = 'v610_purchase_requisitions'
down_revision = 'v600_blanket_agreements'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Approval policy table — data-driven thresholds (company-wide)
    op.create_table(
        'requisition_approval_policies',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('uuid', sa.String(), nullable=False),
        sa.Column('tenant_id', sa.String(), nullable=True),
        sa.Column('company_id', sa.String(), nullable=False),
        sa.Column('branch_id', sa.String(), nullable=True),
        sa.Column('policy_name', sa.String(), nullable=False),
        sa.Column('min_value', sa.Numeric(15, 2), nullable=False, server_default='0.00'),
        sa.Column('max_value', sa.Numeric(15, 2), nullable=True),           # NULL = no upper cap
        sa.Column('required_approver_role', sa.String(), nullable=True),    # e.g. DEPT_HEAD, FINANCE, MANAGEMENT
        sa.Column('stage_order', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('auto_approve', sa.Boolean(), nullable=False, server_default='false'),
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

    # 2. Purchase requisitions — aggregate root
    op.create_table(
        'purchase_requisitions',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('uuid', sa.String(), nullable=False),
        sa.Column('tenant_id', sa.String(), nullable=True),
        sa.Column('company_id', sa.String(), nullable=False),
        sa.Column('branch_id', sa.String(), nullable=True),
        sa.Column('requisition_no', sa.String(), nullable=False),
        sa.Column('title', sa.String(), nullable=False),
        sa.Column('requestor_id', sa.String(), nullable=True),              # user/employee id
        sa.Column('department', sa.String(), nullable=True),
        sa.Column('cost_center', sa.String(), nullable=True),
        sa.Column('required_by_date', sa.DateTime(timezone=True), nullable=True),
        sa.Column('estimated_total', sa.Numeric(15, 2), nullable=False, server_default='0.00'),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('status', sa.String(), nullable=False, server_default='Draft'),
        # Draft, Submitted, UnderApproval, Approved, Converted, Rejected, Cancelled
        sa.Column('current_approval_stage', sa.Integer(), nullable=True),
        sa.Column('converted_doc_type', sa.String(), nullable=True),        # PURCHASE_ORDER, RFQ, BPA_RELEASE
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
        sa.Column('workflow_status', sa.String(), nullable=True),
        sa.Column('document_number', sa.String(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('uuid'),
        sa.UniqueConstraint('requisition_no')
    )
    op.create_index('ix_purchase_requisitions_status', 'purchase_requisitions', ['status'])
    op.create_index('ix_purchase_requisitions_company_id', 'purchase_requisitions', ['company_id'])

    # 3. Requisition line items
    op.create_table(
        'purchase_requisition_lines',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('uuid', sa.String(), nullable=False),
        sa.Column('tenant_id', sa.String(), nullable=True),
        sa.Column('company_id', sa.String(), nullable=True),
        sa.Column('branch_id', sa.String(), nullable=True),
        sa.Column('requisition_id', sa.String(),
                  sa.ForeignKey('purchase_requisitions.id', ondelete='CASCADE'), nullable=False),
        sa.Column('product_id', sa.String(),
                  sa.ForeignKey('products.id', ondelete='RESTRICT'), nullable=False),
        sa.Column('requested_quantity', sa.Numeric(10, 2), nullable=False),
        sa.Column('estimated_unit_price', sa.Numeric(15, 2), nullable=False, server_default='0.00'),
        sa.Column('line_total', sa.Numeric(15, 2), nullable=False, server_default='0.00'),
        sa.Column('preferred_supplier_id', sa.String(),
                  sa.ForeignKey('suppliers.id', ondelete='SET NULL'), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
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

    # 4. Immutable approval audit records
    op.create_table(
        'requisition_approvals',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('uuid', sa.String(), nullable=False),
        sa.Column('tenant_id', sa.String(), nullable=True),
        sa.Column('company_id', sa.String(), nullable=True),
        sa.Column('branch_id', sa.String(), nullable=True),
        sa.Column('requisition_id', sa.String(),
                  sa.ForeignKey('purchase_requisitions.id', ondelete='CASCADE'), nullable=False),
        sa.Column('stage_order', sa.Integer(), nullable=False),
        sa.Column('stage_name', sa.String(), nullable=False),               # e.g. "Department Head"
        sa.Column('required_approver_role', sa.String(), nullable=True),
        sa.Column('approver_id', sa.String(), nullable=True),               # filled on decision
        sa.Column('decision', sa.String(), nullable=True),                  # PENDING, APPROVED, REJECTED
        sa.Column('decided_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
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


def downgrade() -> None:
    op.drop_table('requisition_approvals')
    op.drop_table('purchase_requisition_lines')
    op.drop_table('purchase_requisitions')
    op.drop_table('requisition_approval_policies')
