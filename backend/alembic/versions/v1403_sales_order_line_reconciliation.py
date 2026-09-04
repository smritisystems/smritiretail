"""Reconcile Sales Order allocations and line-level pending states.

Revision ID: v1403_so_line_reconcile
Revises: v1402_legacy_reconcile
"""

from alembic import op
import sqlalchemy as sa

revision = "v1403_so_line_reconcile"
down_revision = "v1402_legacy_reconcile"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("sales_order_items", sa.Column("billed_quantity", sa.Numeric(12, 4), nullable=False, server_default="0"))
    op.add_column("sales_order_items", sa.Column("pending_quantity", sa.Numeric(12, 4), nullable=False, server_default="0"))
    op.add_column("sales_order_items", sa.Column("line_status", sa.String(30), nullable=False, server_default="OPEN"))
    op.add_column("sales_order_items", sa.Column("closure_reason", sa.Text(), nullable=True))
    op.add_column("sales_order_items", sa.Column("closed_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("sales_order_items", sa.Column("closed_by", sa.String(100), nullable=True))

    # Preserve invoices; derive line billing strictly from existing invoice lines.
    op.execute(sa.text("""
        UPDATE sales_order_items line
        SET billed_quantity = COALESCE((
                SELECT SUM(inv_line.quantity)
                FROM sales_invoices inv
                JOIN sales_invoice_items inv_line ON inv_line.invoice_id = inv.id
                JOIN sales_orders ord ON ord.po_number = inv.po_reference AND ord.id = line.order_id
                WHERE inv.is_deleted = false
                  AND inv_line.variant_id = line.variant_id
            ), 0),
            pending_quantity = GREATEST(line.quantity - COALESCE((
                SELECT SUM(inv_line.quantity)
                FROM sales_invoices inv
                JOIN sales_invoice_items inv_line ON inv_line.invoice_id = inv.id
                WHERE inv.is_deleted = false
                  AND inv.po_reference = (SELECT po_number FROM sales_orders WHERE id = line.order_id)
                  AND inv_line.variant_id = line.variant_id
            ), 0), 0)
    """))
    op.execute(sa.text("""
        UPDATE sales_order_items
        SET line_status = CASE
            WHEN billed_quantity >= quantity THEN 'BILLED'
            WHEN billed_quantity > 0 THEN 'PARTIALLY_BILLED'
            ELSE 'OPEN'
        END
    """))

    op.execute(sa.text("DELETE FROM sales_order_invoice_allocations"))
    op.execute(sa.text("""
        INSERT INTO sales_order_invoice_allocations (
            id, uuid, company_id, branch_id, order_id, order_no, po_number,
            invoice_id, invoice_no, invoice_date, po_quantity, po_value,
            billed_quantity, billed_value, pending_quantity, pending_value,
            status, allocation_metadata
        )
        SELECT
            'alloc_' || substr(md5(inv.id), 1, 20), md5(inv.id || '-allocation'),
            ord.company_id, ord.branch_id, ord.id, ord.order_no, ord.po_number,
            inv.id, inv.invoice_no, inv.date, ord.total_qty, ord.grand_total,
            SUM(line.quantity), SUM(line.total_amount),
            GREATEST(ord.total_qty - SUM(line.quantity), 0),
            GREATEST(ord.grand_total - SUM(line.total_amount), 0),
            CASE WHEN SUM(line.quantity) >= ord.total_qty THEN 'FULLY_BILLED' ELSE 'PARTIAL' END,
            jsonb_build_object('reconciled_from_existing_invoice', true)
        FROM sales_invoices inv
        JOIN sales_invoice_items line ON line.invoice_id = inv.id
        JOIN sales_orders ord ON ord.po_number = inv.po_reference AND ord.is_deleted = false
        WHERE inv.is_deleted = false AND inv.po_reference IS NOT NULL
        GROUP BY inv.id, inv.invoice_no, inv.date, ord.id, ord.order_no, ord.po_number,
                 ord.company_id, ord.branch_id, ord.total_qty, ord.grand_total
    """))

    # Correct tracking metrics only; invoice rows remain unchanged.
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
    op.drop_column("sales_order_items", "closed_by")
    op.drop_column("sales_order_items", "closed_at")
    op.drop_column("sales_order_items", "closure_reason")
    op.drop_column("sales_order_items", "line_status")
    op.drop_column("sales_order_items", "pending_quantity")
    op.drop_column("sales_order_items", "billed_quantity")