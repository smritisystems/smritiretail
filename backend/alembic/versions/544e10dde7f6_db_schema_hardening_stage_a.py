"""
Project      : SMRITI Retail OS
Organization : AITDL NETWORKS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 5.1.3
Created      : 2026-07-21
Modified     : 2026-07-21
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal

Revision ID: 544e10dde7f6
Revises: 7a89b0123456
Create Date: 2026-07-21 00:44:25.830789
"""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '544e10dde7f6'
down_revision: Union[str, Sequence[str], None] = '7a89b0123456'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Create table sales_invoice_payments
    op.create_table(
        'sales_invoice_payments',
        sa.Column('id', sa.String(length=50), nullable=False),
        sa.Column('uuid', sa.String(length=36), nullable=False),
        sa.Column('tenant_id', sa.String(length=50), nullable=True),
        sa.Column('company_id', sa.String(length=50), nullable=True),
        sa.Column('branch_id', sa.String(length=50), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('modified_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_by', sa.String(length=100), nullable=True),
        sa.Column('updated_by', sa.String(length=100), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=True),
        sa.Column('is_deleted', sa.Boolean(), nullable=True),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('deleted_by', sa.String(length=100), nullable=True),
        sa.Column('version', sa.Integer(), nullable=True),
        sa.Column('workflow_status', sa.String(length=30), nullable=True),
        sa.Column('document_number', sa.String(length=80), nullable=True),
        sa.Column('invoice_id', sa.String(length=50), nullable=False),
        sa.Column('payment_mode', sa.String(length=20), nullable=False),
        sa.Column('amount', sa.Numeric(precision=15, scale=2), nullable=False),
        sa.Column('transaction_no', sa.String(length=100), nullable=True),
        sa.ForeignKeyConstraint(['branch_id'], ['branches.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['company_id'], ['companies.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['invoice_id'], ['sales_invoices.id'], ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('uuid'),
        sa.CheckConstraint("payment_mode IN ('CASH', 'CARD', 'UPI', 'CREDIT')", name='chk_sales_invoice_payments_mode')
    )
    op.create_index(op.f('ix_sales_invoice_payments_invoice_id'), 'sales_invoice_payments', ['invoice_id'], unique=False)
    op.create_index(op.f('ix_sales_invoice_payments_tenant_id'), 'sales_invoice_payments', ['tenant_id'], unique=False)

    # 2. Create table product_barcodes
    op.create_table(
        'product_barcodes',
        sa.Column('id', sa.String(length=50), nullable=False),
        sa.Column('uuid', sa.String(length=36), nullable=False),
        sa.Column('tenant_id', sa.String(length=50), nullable=True),
        sa.Column('company_id', sa.String(length=50), nullable=True),
        sa.Column('branch_id', sa.String(length=50), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('modified_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_by', sa.String(length=100), nullable=True),
        sa.Column('updated_by', sa.String(length=100), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=True),
        sa.Column('is_deleted', sa.Boolean(), nullable=True),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('deleted_by', sa.String(length=100), nullable=True),
        sa.Column('version', sa.Integer(), nullable=True),
        sa.Column('workflow_status', sa.String(length=30), nullable=True),
        sa.Column('document_number', sa.String(length=80), nullable=True),
        sa.Column('product_id', sa.String(length=50), nullable=False),
        sa.Column('barcode', sa.String(length=100), nullable=False),
        sa.Column('is_primary', sa.Boolean(), nullable=False),
        sa.ForeignKeyConstraint(['branch_id'], ['branches.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['company_id'], ['companies.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['product_id'], ['products.id'], ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('uuid')
    )
    op.create_index(op.f('ix_product_barcodes_product_id'), 'product_barcodes', ['product_id'], unique=False)
    op.create_index(op.f('ix_product_barcodes_tenant_id'), 'product_barcodes', ['tenant_id'], unique=False)

    # 3. Add Tenancy and GST Split columns to lines across all 4 document classes
    for table_name in ['sales_invoice_items', 'sales_quotation_items', 'sales_order_items', 'sales_return_items']:
        op.add_column(table_name, sa.Column('tenant_id', sa.String(length=50), nullable=True))
        op.add_column(table_name, sa.Column('company_id', sa.String(length=50), nullable=True))
        op.add_column(table_name, sa.Column('branch_id', sa.String(length=50), nullable=True))
        op.add_column(table_name, sa.Column('cgst_amount', sa.Numeric(precision=15, scale=2), nullable=False, server_default='0.00'))
        op.add_column(table_name, sa.Column('sgst_amount', sa.Numeric(precision=15, scale=2), nullable=False, server_default='0.00'))
        op.add_column(table_name, sa.Column('igst_amount', sa.Numeric(precision=15, scale=2), nullable=False, server_default='0.00'))
        
        op.create_foreign_key(f'fk_{table_name}_company_id', table_name, 'companies', ['company_id'], ['id'], ondelete='RESTRICT')
        op.create_foreign_key(f'fk_{table_name}_branch_id', table_name, 'branches', ['branch_id'], ['id'], ondelete='RESTRICT')
        op.create_index(op.f(f'ix_{table_name}_tenant_id'), table_name, ['tenant_id'], unique=False)

    # 4. Add GST Split and POS columns to headers across all 4 document classes
    for table_name in ['sales_invoices', 'sales_quotations', 'sales_orders', 'sales_returns']:
        op.add_column(table_name, sa.Column('cgst_total', sa.Numeric(precision=15, scale=2), nullable=False, server_default='0.00'))
        op.add_column(table_name, sa.Column('sgst_total', sa.Numeric(precision=15, scale=2), nullable=False, server_default='0.00'))
        op.add_column(table_name, sa.Column('igst_total', sa.Numeric(precision=15, scale=2), nullable=False, server_default='0.00'))

    # Specifically for sales_invoices and sales_returns, add place_of_supply column (Starts as Nullable)
    op.add_column('sales_invoices', sa.Column('place_of_supply', sa.String(length=2), nullable=True))


def downgrade() -> None:
    # 4. Remove columns from headers
    op.drop_column('sales_invoices', 'place_of_supply')
    for table_name in ['sales_invoices', 'sales_quotations', 'sales_orders', 'sales_returns']:
        op.drop_column(table_name, 'cgst_total')
        op.drop_column(table_name, 'sgst_total')
        op.drop_column(table_name, 'igst_total')

    # 3. Remove columns and foreign keys from lines
    for table_name in ['sales_invoice_items', 'sales_quotation_items', 'sales_order_items', 'sales_return_items']:
        op.drop_index(op.f(f'ix_{table_name}_tenant_id'), table_name)
        op.drop_constraint(f'fk_{table_name}_company_id', table_name, type_='foreignkey')
        op.drop_constraint(f'fk_{table_name}_branch_id', table_name, type_='foreignkey')
        op.drop_column(table_name, 'tenant_id')
        op.drop_column(table_name, 'company_id')
        op.drop_column(table_name, 'branch_id')
        op.drop_column(table_name, 'cgst_amount')
        op.drop_column(table_name, 'sgst_amount')
        op.drop_column(table_name, 'igst_amount')

    # 2. Drop product_barcodes table
    op.drop_index(op.f('ix_product_barcodes_tenant_id'), table_name='product_barcodes')
    op.drop_index(op.f('ix_product_barcodes_product_id'), table_name='product_barcodes')
    op.drop_table('product_barcodes')

    # 1. Drop sales_invoice_payments table
    op.drop_index(op.f('ix_sales_invoice_payments_tenant_id'), table_name='sales_invoice_payments')
    op.drop_index(op.f('ix_sales_invoice_payments_invoice_id'), table_name='sales_invoice_payments')
    op.drop_table('sales_invoice_payments')
