"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.32.0
Created      : 2026-09-13
Modified     : 2026-09-13
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

"""Add governed item-dimension columns to the items table.

Revision ID: v1451_add_item_governed_dimension_columns
Revises: v1450_seed_standard_brands
Create Date: 2026-09-13
"""

from alembic import op
import sqlalchemy as sa


revision = "v1451_add_item_governed_dimension_columns"
down_revision = "v1450_seed_standard_brands"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_columns = {col["name"] for col in inspector.get_columns("items")}

    # Normalize the schema to the Item model contract that already carries
    # catalog governed fields in ItemCreateRequest / ItemResponse.
    with op.batch_alter_table("items", schema=None) as batch_op:
        if "department" not in existing_columns:
            batch_op.add_column(sa.Column("department", sa.String(length=100), nullable=True))
        if "brand" not in existing_columns:
            batch_op.add_column(sa.Column("brand", sa.String(length=100), nullable=True))
        if "style_code" not in existing_columns:
            batch_op.add_column(sa.Column("style_code", sa.String(length=100), nullable=True))
        if "color" not in existing_columns:
            batch_op.add_column(sa.Column("color", sa.String(length=50), nullable=True))
        if "size" not in existing_columns:
            batch_op.add_column(sa.Column("size", sa.String(length=50), nullable=True))
        if "vendor_code" not in existing_columns:
            batch_op.add_column(sa.Column("vendor_code", sa.String(length=100), nullable=True))

    # Create indexes if missing.
    existing_indexes = {idx["name"] for idx in inspector.get_indexes("items")}
    if "ix_items_department" not in existing_indexes:
        op.create_index(op.f("ix_items_department"), "items", ["department"], unique=False)
    if "ix_items_style_code" not in existing_indexes:
        op.create_index(op.f("ix_items_style_code"), "items", ["style_code"], unique=False)
    if "ix_items_color" not in existing_indexes:
        op.create_index(op.f("ix_items_color"), "items", ["color"], unique=False)
    if "ix_items_size" not in existing_indexes:
        op.create_index(op.f("ix_items_size"), "items", ["size"], unique=False)
    if "ix_items_vendor_code" not in existing_indexes:
        op.create_index(op.f("ix_items_vendor_code"), "items", ["vendor_code"], unique=False)


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_columns = {col["name"] for col in inspector.get_columns("items")}

    with op.batch_alter_table("items", schema=None) as batch_op:
        for col in ["department", "brand", "style_code", "color", "size", "vendor_code"]:
            if col in existing_columns:
                batch_op.drop_column(col)

    for idx in [
        "ix_items_department",
        "ix_items_style_code",
        "ix_items_color",
        "ix_items_size",
        "ix_items_vendor_code",
    ]:
        try:
            op.drop_index(idx, table_name="items")
        except Exception:
            pass
