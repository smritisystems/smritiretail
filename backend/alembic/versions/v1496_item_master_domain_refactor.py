"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.46.1
Created      : 2026-09-28
Modified     : 2026-09-28
Copyright    : (c) SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Database Migration
"""

"""v1496_item_master_domain_refactor

Revision ID: v1496
Revises: v1495
Create Date: 2026-09-28

SMRITI Item Master Domain Refactor:
1. Promotes physical variant dimensions (color, size) to first-class indexed columns
   on item_variants with composite style-color-size index.
2. Decouples ItemVariant physical identity from commercial pricing.
3. Links item_barcodes to versioned PriceBookEntry via price_book_entry_id for
   multi-MRP optical scanning resolution (e.g. Style 2006 Cream Rs. 1,299 vs Rs. 1,499).
4. Backfills color and size on existing item_variants from attributes_json.
"""

from alembic import op
import sqlalchemy as sa

revision = "v1496"
down_revision = "v1495"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    tables = inspector.get_table_names()

    # 1. First-class variant dimensions on item_variants
    if "item_variants" in tables:
        variant_cols = [c["name"] for c in inspector.get_columns("item_variants")]
        if "color" not in variant_cols:
            op.add_column("item_variants", sa.Column("color", sa.String(50), nullable=True))
        if "size" not in variant_cols:
            op.add_column("item_variants", sa.Column("size", sa.String(50), nullable=True))

        variant_indexes = [idx["name"] for idx in inspector.get_indexes("item_variants")]
        if "ix_item_variants_color" not in variant_indexes:
            op.create_index("ix_item_variants_color", "item_variants", ["color"], unique=False)
        if "ix_item_variants_size" not in variant_indexes:
            op.create_index("ix_item_variants_size", "item_variants", ["size"], unique=False)
        if "ix_item_variants_style_color_size" not in variant_indexes:
            op.create_index(
                "ix_item_variants_style_color_size",
                "item_variants",
                ["company_id", "item_id", "color", "size"],
                unique=False,
            )

        if "attributes_json" in variant_cols:
            op.execute(sa.text(
                "UPDATE item_variants SET color = attributes_json ->> 'color' "
                "WHERE (color IS NULL OR color = '') AND attributes_json IS NOT NULL "
                "AND attributes_json ->> 'color' IS NOT NULL AND attributes_json ->> 'color' != ''"
            ))
            op.execute(sa.text(
                "UPDATE item_variants SET size = attributes_json ->> 'size' "
                "WHERE (size IS NULL OR size = '') AND attributes_json IS NOT NULL "
                "AND attributes_json ->> 'size' IS NOT NULL AND attributes_json ->> 'size' != ''"
            ))

    # 2. Add price_book_entry_id to item_barcodes to link optical scanning to commercial pricing
    if "item_barcodes" in tables:
        barcode_cols = [c["name"] for c in inspector.get_columns("item_barcodes")]
        if "price_book_entry_id" not in barcode_cols:
            op.add_column(
                "item_barcodes",
                sa.Column("price_book_entry_id", sa.String(50), nullable=True),
            )

        barcode_indexes = [idx["name"] for idx in inspector.get_indexes("item_barcodes")]
        if "ix_item_barcodes_price_book_entry_id" not in barcode_indexes:
            op.create_index(
                "ix_item_barcodes_price_book_entry_id",
                "item_barcodes",
                ["price_book_entry_id"],
                unique=False,
            )

        # Foreign key constraint to price_book_entries if not already present
        if "price_book_entries" in tables:
            existing_fks = [fk["name"] for fk in inspector.get_foreign_keys("item_barcodes")]
            if "fk_item_barcodes_price_book_entry" not in existing_fks:
                op.create_foreign_key(
                    "fk_item_barcodes_price_book_entry",
                    "item_barcodes",
                    "price_book_entries",
                    ["price_book_entry_id"],
                    ["id"],
                    ondelete="SET NULL",
                )


def downgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    tables = inspector.get_table_names()

    if "item_barcodes" in tables:
        existing_fks = [fk["name"] for fk in inspector.get_foreign_keys("item_barcodes")]
        if "fk_item_barcodes_price_book_entry" in existing_fks:
            op.drop_constraint("fk_item_barcodes_price_book_entry", "item_barcodes", type_="foreignkey")

        barcode_indexes = [idx["name"] for idx in inspector.get_indexes("item_barcodes")]
        if "ix_item_barcodes_price_book_entry_id" in barcode_indexes:
            op.drop_index("ix_item_barcodes_price_book_entry_id", table_name="item_barcodes")

        barcode_cols = [c["name"] for c in inspector.get_columns("item_barcodes")]
        if "price_book_entry_id" in barcode_cols:
            op.drop_column("item_barcodes", "price_book_entry_id")

    if "item_variants" in tables:
        variant_indexes = [idx["name"] for idx in inspector.get_indexes("item_variants")]
        if "ix_item_variants_style_color_size" in variant_indexes:
            op.drop_index("ix_item_variants_style_color_size", table_name="item_variants")
        if "ix_item_variants_size" in variant_indexes:
            op.drop_index("ix_item_variants_size", table_name="item_variants")
        if "ix_item_variants_color" in variant_indexes:
            op.drop_index("ix_item_variants_color", table_name="item_variants")

