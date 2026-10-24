"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.28.0
Created      : 2026-09-16
Modified     : 2026-09-16
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Schema Lifecycle & Compliance — 3-Tier Tax Inclusivity & Invoice Line Snapshot
"""

"""Refactor is_tax_inclusive to item_barcodes, customer_groups, customers, and sales_invoice_items.

Revision ID: v1456_tax_inclusive_barcode_group_customer_snapshot
Revises: v1455_add_is_tax_inclusive_to_items_products
Create Date: 2026-09-16
"""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = "v1456_tax_inclusive_barcode_group_customer_snapshot"
down_revision: Union[str, Sequence[str], None] = "v1455_add_is_tax_inclusive_to_items_products"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()

    # 1. Drop is_tax_inclusive from catalog masters (products, items, item_variants)
    for table_name in ["item_variants", "items", "products"]:
        col_exists = bind.execute(sa.text(f"""
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' 
              AND table_name = '{table_name}' 
              AND column_name = 'is_tax_inclusive';
        """)).scalar()
        if col_exists:
            op.drop_column(table_name, "is_tax_inclusive")

    # 2. Add is_tax_inclusive to item_barcodes (sellable SKU unit)
    has_barcode_col = bind.execute(sa.text("""
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'item_barcodes' 
          AND column_name = 'is_tax_inclusive';
    """)).scalar()
    if not has_barcode_col:
        op.add_column(
            "item_barcodes",
            sa.Column("is_tax_inclusive", sa.Boolean(), nullable=True)
        )

    # 3. Add is_tax_inclusive to customer_groups (price group commercial policy)
    has_cg_col = bind.execute(sa.text("""
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'customer_groups' 
          AND column_name = 'is_tax_inclusive';
    """)).scalar()
    if not has_cg_col:
        op.add_column(
            "customer_groups",
            sa.Column("is_tax_inclusive", sa.Boolean(), nullable=False, server_default=sa.text("true"))
        )
        # Sync from existing tax_inclusive if present
        bind.execute(sa.text("""
            UPDATE customer_groups 
            SET is_tax_inclusive = COALESCE(tax_inclusive, true);
        """))

    # 4. Add is_tax_inclusive to customer_price_tiers
    has_cpt_table = bind.execute(sa.text("""
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'customer_price_tiers';
    """)).scalar()
    if has_cpt_table:
        has_cpt_col = bind.execute(sa.text("""
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' 
              AND table_name = 'customer_price_tiers' 
              AND column_name = 'is_tax_inclusive';
        """)).scalar()
        if not has_cpt_col:
            op.add_column(
                "customer_price_tiers",
                sa.Column("is_tax_inclusive", sa.Boolean(), nullable=True)
            )

    # 5. Add is_tax_inclusive to customers (customer-specific policy)
    has_cust_col = bind.execute(sa.text("""
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'customers' 
          AND column_name = 'is_tax_inclusive';
    """)).scalar()
    if not has_cust_col:
        op.add_column(
            "customers",
            sa.Column("is_tax_inclusive", sa.Boolean(), nullable=True)
        )

    # 6. Add is_tax_inclusive to sales_invoice_items (transaction snapshot)
    has_sii_col = bind.execute(sa.text("""
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'sales_invoice_items' 
          AND column_name = 'is_tax_inclusive';
    """)).scalar()
    if not has_sii_col:
        op.add_column(
            "sales_invoice_items",
            sa.Column("is_tax_inclusive", sa.Boolean(), nullable=False, server_default=sa.text("true"))
        )


def downgrade() -> None:
    bind = op.get_bind()

    # 1. Drop from sales_invoice_items
    has_sii_col = bind.execute(sa.text("""
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'sales_invoice_items' 
          AND column_name = 'is_tax_inclusive';
    """)).scalar()
    if has_sii_col:
        op.drop_column("sales_invoice_items", "is_tax_inclusive")

    # 2. Drop from customers
    has_cust_col = bind.execute(sa.text("""
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'customers' 
          AND column_name = 'is_tax_inclusive';
    """)).scalar()
    if has_cust_col:
        op.drop_column("customers", "is_tax_inclusive")

    # 3. Drop from customer_price_tiers
    has_cpt_col = bind.execute(sa.text("""
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'customer_price_tiers' 
          AND column_name = 'is_tax_inclusive';
    """)).scalar()
    if has_cpt_col:
        op.drop_column("customer_price_tiers", "is_tax_inclusive")

    # 4. Drop from customer_groups
    has_cg_col = bind.execute(sa.text("""
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'customer_groups' 
          AND column_name = 'is_tax_inclusive';
    """)).scalar()
    if has_cg_col:
        op.drop_column("customer_groups", "is_tax_inclusive")

    # 5. Drop from item_barcodes
    has_barcode_col = bind.execute(sa.text("""
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'item_barcodes' 
          AND column_name = 'is_tax_inclusive';
    """)).scalar()
    if has_barcode_col:
        op.drop_column("item_barcodes", "is_tax_inclusive")

    # 6. Re-add to catalog masters
    for table_name in ["products", "items", "item_variants"]:
        col_exists = bind.execute(sa.text(f"""
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' 
              AND table_name = '{table_name}' 
              AND column_name = 'is_tax_inclusive';
        """)).scalar()
        if not col_exists:
            op.add_column(
                table_name,
                sa.Column("is_tax_inclusive", sa.Boolean(), nullable=False, server_default=sa.text("true"))
            )
