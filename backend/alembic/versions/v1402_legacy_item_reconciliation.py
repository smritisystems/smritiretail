"""Reconcile legacy products and stock movements with ItemMaster.

Revision ID: v1402_legacy_reconcile
Revises: v1401_stock_move_link
"""

from alembic import op
import sqlalchemy as sa


revision = "v1402_legacy_reconcile"
down_revision = "v1401_stock_move_link"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # First recover exact existing links by legacy code or barcode.
    op.execute(sa.text("""
        UPDATE products p
        SET item_id = COALESCE(p.item_id, i.id),
                        item_variant_id = COALESCE(
                                p.item_variant_id,
                                (SELECT b.variant_id
                                 FROM item_barcodes b
                                 WHERE b.company_id = p.company_id
                                     AND b.barcode = p.barcode
                                     AND b.is_deleted = false
                                 LIMIT 1)
                        )
        FROM items i
        WHERE p.is_deleted = false
          AND p.item_id IS NULL
          AND i.company_id = p.company_id
          AND (lower(i.item_code) = lower(p.code) OR lower(i.item_code) = lower(COALESCE(p.style_code, '')))
          AND i.is_deleted = false
    """))
    op.execute(sa.text("""
        UPDATE products p
        SET item_id = b.item_id,
            item_variant_id = b.variant_id
        FROM item_barcodes b
        WHERE p.item_id IS NULL
          AND p.is_deleted = false
          AND b.company_id = p.company_id
          AND b.barcode = p.barcode
          AND b.is_deleted = false
    """))

    # Any remaining legacy product gets a review-only canonical record.
    op.execute(sa.text("""
        INSERT INTO items (
            id, uuid, company_id, branch_id, item_code, item_name, item_type,
            category, brand, hsn_code, tax_rate, mrp, selling_price, cost_price,
            status, is_active, is_deleted, attributes_json, tags
        )
        SELECT
            'itm_' || substr(md5(p.id), 1, 12), md5(concat(p.id, '-item')),
            p.company_id, p.branch_id, left(p.code, 50), p.name, 'FINISHED_GOOD',
            COALESCE(p.category, 'Legacy Review'), p.brand, COALESCE(p.hsn_code, '0000'),
            COALESCE(p.gst_percentage, 0), COALESCE(p.mrp, 0), COALESCE(p.price, 0),
            COALESCE(p.cost_price, 0), 'REQUIRES_REVIEW', true, false,
            jsonb_build_object('legacy_product_id', p.id, 'reconciliation', 'legacy_unlinked'),
            ARRAY['LEGACY_REVIEW']::varchar[]
        FROM products p
        WHERE p.item_id IS NULL
          AND p.is_deleted = false
          AND NOT EXISTS (
              SELECT 1 FROM items i
              WHERE i.company_id = p.company_id
                AND i.item_code = left(p.code, 50)
                AND i.is_deleted = false
          )
    """))
    op.execute(sa.text("""
        INSERT INTO item_variants (
            id, uuid, company_id, branch_id, item_id, variant_sku, variant_name,
            attributes_json, hsn_code, tax_rate, mrp, selling_price, cost_price,
            is_active, is_deleted
        )
        SELECT
            'var_' || substr(md5(p.id), 1, 12), md5(concat(p.id, '-variant')),
            p.company_id, p.branch_id, i.id, left(p.code, 100), p.name,
            jsonb_build_object('legacy_product_id', p.id, 'reconciliation', 'legacy_unlinked'),
            COALESCE(p.hsn_code, '0000'), COALESCE(p.gst_percentage, 0),
            COALESCE(p.mrp, 0), COALESCE(p.price, 0), COALESCE(p.cost_price, 0), true, false
        FROM products p
        JOIN items i ON i.company_id = p.company_id AND i.item_code = left(p.code, 50) AND i.is_deleted = false
        WHERE p.item_id IS NULL
          AND p.is_deleted = false
          AND NOT EXISTS (SELECT 1 FROM item_variants v WHERE v.company_id = p.company_id AND v.variant_sku = left(p.code, 100) AND v.is_deleted = false)
    """))
    op.execute(sa.text("""
        UPDATE products p
        SET item_id = i.id,
            item_variant_id = v.id
        FROM items i
        JOIN item_variants v ON v.item_id = i.id
        WHERE p.item_id IS NULL
          AND i.company_id = p.company_id
          AND i.item_code = left(p.code, 50)
          AND v.variant_sku = left(p.code, 100)
          AND i.is_deleted = false AND v.is_deleted = false
    """))
    op.execute(sa.text("""
        UPDATE stock_movements m
        SET item_id = p.item_id
        FROM products p
        WHERE m.item_id IS NULL AND m.product_id = p.id AND p.item_id IS NOT NULL
    """))
    for table in (
        "sales_invoice_items",
        "sales_quotation_items",
        "sales_order_items",
        "sales_return_items",
        "purchase_order_items",
        "purchase_receipt_items",
    ):
        op.execute(sa.text(
            f"UPDATE {table} AS line SET item_id = product.item_id "
            "FROM products AS product "
            "WHERE line.item_id IS NULL AND line.product_id = product.id "
            "AND product.item_id IS NOT NULL"
        ))


def downgrade() -> None:
    # Reconciliation is intentionally not destructive; linked historical data stays intact.
    pass