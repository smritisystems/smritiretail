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
Classification: Schema Lifecycle & Compliance — Catalog Tax Inclusive Parameter
"""

"""Add is_tax_inclusive column to products, items, and item_variants tables.

Revision ID: v1455_add_is_tax_inclusive_to_items_products
Revises: v1454_retire_stores_table
Create Date: 2026-09-16
"""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = "v1455_add_is_tax_inclusive_to_items_products"
down_revision: Union[str, Sequence[str], None] = "v1454_retire_stores_table"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()

    # 1. products table
    has_prod_col = bind.execute(sa.text("""
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'products' 
          AND column_name = 'is_tax_inclusive';
    """)).scalar()
    if not has_prod_col:
        op.add_column(
            "products",
            sa.Column("is_tax_inclusive", sa.Boolean(), nullable=False, server_default=sa.text("true"))
        )

    # 2. items table
    has_item_col = bind.execute(sa.text("""
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'items' 
          AND column_name = 'is_tax_inclusive';
    """)).scalar()
    if not has_item_col:
        op.add_column(
            "items",
            sa.Column("is_tax_inclusive", sa.Boolean(), nullable=False, server_default=sa.text("true"))
        )

    # 3. item_variants table
    has_var_col = bind.execute(sa.text("""
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'item_variants' 
          AND column_name = 'is_tax_inclusive';
    """)).scalar()
    if not has_var_col:
        op.add_column(
            "item_variants",
            sa.Column("is_tax_inclusive", sa.Boolean(), nullable=False, server_default=sa.text("true"))
        )


def downgrade() -> None:
    bind = op.get_bind()

    has_var_col = bind.execute(sa.text("""
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'item_variants' 
          AND column_name = 'is_tax_inclusive';
    """)).scalar()
    if has_var_col:
        op.drop_column("item_variants", "is_tax_inclusive")

    has_item_col = bind.execute(sa.text("""
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'items' 
          AND column_name = 'is_tax_inclusive';
    """)).scalar()
    if has_item_col:
        op.drop_column("items", "is_tax_inclusive")

    has_prod_col = bind.execute(sa.text("""
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'products' 
          AND column_name = 'is_tax_inclusive';
    """)).scalar()
    if has_prod_col:
        op.drop_column("products", "is_tax_inclusive")
