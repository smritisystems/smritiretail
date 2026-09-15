"""Link legacy products to the canonical ItemMaster.

Revision ID: v1399_link_product_items
Revises: v1398_report_schedule_compat
"""

from alembic import op
import sqlalchemy as sa


revision = "v1399_link_product_items"
down_revision = "v1398_report_schedule_compat"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("products", sa.Column("item_id", sa.String(length=50), nullable=True))
    op.add_column("products", sa.Column("item_variant_id", sa.String(length=50), nullable=True))
    op.create_index("ix_products_item_id", "products", ["item_id"], unique=False)
    op.create_index("ix_products_item_variant_id", "products", ["item_variant_id"], unique=False)
    op.create_foreign_key(
        "fk_products_item_id_items",
        "products",
        "items",
        ["item_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_foreign_key(
        "fk_products_item_variant_id_item_variants",
        "products",
        "item_variants",
        ["item_variant_id"],
        ["id"],
        ondelete="SET NULL",
    )

    # Link existing legacy rows first by company-scoped item code, then by barcode.
    op.execute(
        sa.text(
            """
            UPDATE products AS p
            SET item_id = i.id
            FROM items AS i
            WHERE p.item_id IS NULL
              AND p.company_id = i.company_id
              AND lower(p.code) = lower(i.item_code)
            """
        )
    )
    op.execute(
        sa.text(
            """
            UPDATE products AS p
            SET item_id = b.item_id,
                item_variant_id = b.variant_id
            FROM item_barcodes AS b
            WHERE p.item_id IS NULL
              AND p.company_id = b.company_id
              AND p.barcode = b.barcode
            """
        )
    )


def downgrade() -> None:
    op.drop_constraint("fk_products_item_variant_id_item_variants", "products", type_="foreignkey")
    op.drop_constraint("fk_products_item_id_items", "products", type_="foreignkey")
    op.drop_index("ix_products_item_variant_id", table_name="products")
    op.drop_index("ix_products_item_id", table_name="products")
    op.drop_column("products", "item_variant_id")
    op.drop_column("products", "item_id")