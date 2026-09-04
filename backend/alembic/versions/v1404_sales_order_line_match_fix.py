"""Fix Sales Order line reconciliation for legacy invoice lines without variant_id.

Revision ID: v1404_so_line_match_fix
Revises: v1403_so_line_reconcile
"""

from alembic import op
import sqlalchemy as sa

revision = "v1404_so_line_match_fix"
down_revision = "v1403_so_line_reconcile"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(sa.text("""
        UPDATE sales_order_items line
        SET billed_quantity = COALESCE((
                SELECT SUM(inv_line.quantity)
                FROM sales_invoices inv
                JOIN sales_invoice_items inv_line ON inv_line.invoice_id = inv.id
                WHERE inv.is_deleted = false
                  AND inv.po_reference = (SELECT po_number FROM sales_orders WHERE id = line.order_id)
                  AND (inv_line.product_id = line.product_id OR inv_line.code = line.code)
            ), 0),
            pending_quantity = GREATEST(line.quantity - COALESCE((
                SELECT SUM(inv_line.quantity)
                FROM sales_invoices inv
                JOIN sales_invoice_items inv_line ON inv_line.invoice_id = inv.id
                WHERE inv.is_deleted = false
                  AND inv.po_reference = (SELECT po_number FROM sales_orders WHERE id = line.order_id)
                  AND (inv_line.product_id = line.product_id OR inv_line.code = line.code)
            ), 0), 0)
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
    pass