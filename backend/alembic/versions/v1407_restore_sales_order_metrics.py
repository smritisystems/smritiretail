"""Restore Sales Order tracking metrics from immutable invoice lines.

Revision ID: v1407_restore_so_metrics
Revises: v1406_so_color_alias
"""

from alembic import op
import sqlalchemy as sa

revision = "v1407_restore_so_metrics"
down_revision = "v1406_so_color_alias"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(sa.text("""
        UPDATE sales_orders ord
        SET billed_qty = COALESCE((SELECT SUM(line.quantity) FROM sales_invoices inv JOIN sales_invoice_items line ON line.invoice_id = inv.id WHERE inv.is_deleted = false AND inv.po_reference = ord.po_number), 0),
            billed_value = COALESCE((SELECT SUM(line.total_amount) FROM sales_invoices inv JOIN sales_invoice_items line ON line.invoice_id = inv.id WHERE inv.is_deleted = false AND inv.po_reference = ord.po_number), 0),
            pending_qty = GREATEST(ord.total_qty - COALESCE((SELECT SUM(line.quantity) FROM sales_invoices inv JOIN sales_invoice_items line ON line.invoice_id = inv.id WHERE inv.is_deleted = false AND inv.po_reference = ord.po_number), 0), 0),
            pending_value = GREATEST(ord.grand_total - COALESCE((SELECT SUM(line.total_amount) FROM sales_invoices inv JOIN sales_invoice_items line ON line.invoice_id = inv.id WHERE inv.is_deleted = false AND inv.po_reference = ord.po_number), 0), 0),
            fulfillment_status = CASE WHEN COALESCE((SELECT SUM(line.quantity) FROM sales_invoices inv JOIN sales_invoice_items line ON line.invoice_id = inv.id WHERE inv.is_deleted = false AND inv.po_reference = ord.po_number), 0) = 0 THEN 'UNFULFILLED' WHEN COALESCE((SELECT SUM(line.quantity) FROM sales_invoices inv JOIN sales_invoice_items line ON line.invoice_id = inv.id WHERE inv.is_deleted = false AND inv.po_reference = ord.po_number), 0) < ord.total_qty THEN 'PARTIALLY_BILLED' ELSE 'FULLY_BILLED' END,
            status = CASE WHEN COALESCE((SELECT SUM(line.quantity) FROM sales_invoices inv JOIN sales_invoice_items line ON line.invoice_id = inv.id WHERE inv.is_deleted = false AND inv.po_reference = ord.po_number), 0) >= ord.total_qty THEN 'Completed' ELSE 'Confirmed' END
        WHERE ord.is_deleted = false
    """))


def downgrade() -> None:
    pass