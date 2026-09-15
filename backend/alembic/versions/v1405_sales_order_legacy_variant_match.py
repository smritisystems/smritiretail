"""Complete Sales Order reconciliation using legacy invoice variant names.

Revision ID: v1405_so_legacy_variant
Revises: v1404_so_line_match_fix
"""

from alembic import op
import sqlalchemy as sa

revision = "v1405_so_legacy_variant"
down_revision = "v1404_so_line_match_fix"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("sales_order_items", sa.Column("overbilled_quantity", sa.Numeric(12, 4), nullable=False, server_default="0"))
    op.execute(sa.text("""
        UPDATE sales_order_items line
        SET billed_quantity = COALESCE((
                SELECT SUM(inv_line.quantity)
                FROM sales_invoices inv
                JOIN sales_invoice_items inv_line ON inv_line.invoice_id = inv.id
                WHERE inv.is_deleted = false
                  AND inv.po_reference = (SELECT po_number FROM sales_orders WHERE id = line.order_id)
                  AND (
                      inv_line.product_id = line.product_id
                      OR inv_line.code = line.code
                      OR upper(regexp_replace(inv_line.name, '[^A-Z0-9]', '', 'g')) = upper(regexp_replace(concat(line.vendor_style, line.color, line.size), '[^A-Z0-9]', '', 'g'))
                  )
            ), 0),
            pending_quantity = GREATEST(line.quantity - COALESCE((
                SELECT SUM(inv_line.quantity)
                FROM sales_invoices inv
                JOIN sales_invoice_items inv_line ON inv_line.invoice_id = inv.id
                WHERE inv.is_deleted = false
                  AND inv.po_reference = (SELECT po_number FROM sales_orders WHERE id = line.order_id)
                  AND (
                      inv_line.product_id = line.product_id
                      OR inv_line.code = line.code
                      OR upper(regexp_replace(inv_line.name, '[^A-Z0-9]', '', 'g')) = upper(regexp_replace(concat(line.vendor_style, line.color, line.size), '[^A-Z0-9]', '', 'g'))
                  )
            ), 0), 0),
            overbilled_quantity = GREATEST(COALESCE((
                SELECT SUM(inv_line.quantity)
                FROM sales_invoices inv
                JOIN sales_invoice_items inv_line ON inv_line.invoice_id = inv.id
                WHERE inv.is_deleted = false
                  AND inv.po_reference = (SELECT po_number FROM sales_orders WHERE id = line.order_id)
                  AND (
                      inv_line.product_id = line.product_id
                      OR inv_line.code = line.code
                      OR upper(regexp_replace(inv_line.name, '[^A-Z0-9]', '', 'g')) = upper(regexp_replace(concat(line.vendor_style, line.color, line.size), '[^A-Z0-9]', '', 'g'))
                  )
            ), 0) - line.quantity, 0)
        WHERE line.line_status NOT IN ('CLOSED', 'CANCELLED')
    """))
    op.execute(sa.text("""
        UPDATE sales_order_items
        SET line_status = CASE
            WHEN billed_quantity >= quantity THEN 'BILLED'
            WHEN billed_quantity > 0 THEN 'PARTIALLY_BILLED'
            ELSE 'OPEN'
        END
        WHERE line_status NOT IN ('CLOSED', 'CANCELLED')
    """))


def downgrade() -> None:
    op.drop_column("sales_order_items", "overbilled_quantity")