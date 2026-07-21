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

Revision ID: 6ad7d84a62b2
Revises: 80c0b6c55127
Create Date: 2026-07-21 00:45:47.027153
"""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = '6ad7d84a62b2'
down_revision: Union[str, Sequence[str], None] = '80c0b6c55127'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    connection = op.get_bind()

    # 1. Verification of Stage C Success Gates
    # (a) Tenant Backfill Gate (Check mismatches)
    for table_name, parent_table in [
        ('sales_invoice_items', 'sales_invoices'),
        ('sales_quotation_items', 'sales_quotations'),
        ('sales_order_items', 'sales_orders'),
        ('sales_return_items', 'sales_returns')
    ]:
        parent_id_col = 'invoice_id' if 'invoice' in table_name else ('quotation_id' if 'quotation' in table_name else ('order_id' if 'order' in table_name else 'return_id'))
        mismatch_count = connection.execute(sa.text(f"""
            SELECT COUNT(*) FROM {table_name} item
            JOIN {parent_table} parent ON item.{parent_id_col} = parent.id
            WHERE item.tenant_id <> parent.tenant_id OR item.tenant_id IS NULL
        """)).scalar()
        if mismatch_count > 0:
            raise Exception(f"Stage C Success Gate Violation: {mismatch_count} tenant mismatches found in {table_name}.")

    # (b) GST NULL Gate (Check totals & amounts)
    for table_name in ['sales_invoices', 'sales_quotations', 'sales_orders', 'sales_returns']:
        null_total = connection.execute(sa.text(f"SELECT COUNT(*) FROM {table_name} WHERE cgst_total IS NULL OR sgst_total IS NULL OR igst_total IS NULL")).scalar()
        if null_total > 0:
            raise Exception(f"Stage C Success Gate Violation: NULL GST totals found in {table_name}.")

    # (c) Duplicate Barcodes Gate (Double check uniqueness in product_barcodes table before applying constraint)
    dup_barcodes = connection.execute(sa.text("SELECT COUNT(*) FROM (SELECT barcode FROM product_barcodes GROUP BY barcode HAVING COUNT(*) > 1) AS dups")).scalar()
    if dup_barcodes > 0:
        raise Exception(f"Stage C Success Gate Violation: Duplicate barcodes found in product_barcodes table.")

    # 2. Applies NOT NULL constraints
    # (a) parent invoices place_of_supply NOT NULL
    op.alter_column('sales_invoices', 'place_of_supply', nullable=False)

    # (b) child line items tenancy NOT NULL
    for table_name in ['sales_invoice_items', 'sales_quotation_items', 'sales_order_items', 'sales_return_items']:
        op.alter_column(table_name, 'tenant_id', nullable=False, existing_type=sa.String(length=50))
        op.alter_column(table_name, 'company_id', nullable=False, existing_type=sa.String(length=50))
        op.alter_column(table_name, 'branch_id', nullable=False, existing_type=sa.String(length=50))

    # 3. Applies Unique index constraint on barcodes table
    op.create_unique_constraint('uq_product_barcodes_barcode', 'product_barcodes', ['barcode'])

    # 4. Secondary Barcodes Drop Safeguard (Only drop after 100% verification passes)
    op.drop_column('products', 'secondary_barcodes')


def downgrade() -> None:
    # 4. Re-add secondary_barcodes column
    op.add_column('products', sa.Column('secondary_barcodes', postgresql.ARRAY(sa.VARCHAR()), server_default=sa.text("'{}'::character varying[]"), nullable=True))

    # 3. Drop unique constraint
    op.drop_constraint('uq_product_barcodes_barcode', 'product_barcodes', type_='unique')

    # 2. Remove NOT NULL constraints from child line items
    for table_name in ['sales_invoice_items', 'sales_quotation_items', 'sales_order_items', 'sales_return_items']:
        op.alter_column(table_name, 'tenant_id', nullable=True, existing_type=sa.String(length=50))
        op.alter_column(table_name, 'company_id', nullable=True, existing_type=sa.String(length=50))
        op.alter_column(table_name, 'branch_id', nullable=True, existing_type=sa.String(length=50))

    # 1. Remove NOT NULL constraint from parent invoices place_of_supply
    op.alter_column('sales_invoices', 'place_of_supply', nullable=True)
