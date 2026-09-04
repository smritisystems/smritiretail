"""Reconcile Sales Order lines with known legacy color aliases.

Revision ID: v1406_so_color_alias
Revises: v1405_so_legacy_variant
"""

from alembic import op
import sqlalchemy as sa

revision = "v1406_so_color_alias"
down_revision = "v1405_so_legacy_variant"
branch_labels = None
depends_on = None


def _normalized_variant(expression: str) -> str:
    return (
        "upper(regexp_replace(regexp_replace(regexp_replace(regexp_replace("
        f"{expression}, '[^A-Z0-9]', '', 'g'), 'CHIKKU', 'CHIKOO'), "
        "'GUNMETAL', 'GUNMTL'), 'RGOLD', 'ROSEGOLD'))"
    )


def upgrade() -> None:
    invoice_variant = _normalized_variant("inv_line.name")
    order_variant = _normalized_variant("concat(line.vendor_style, line.color, line.size)")
    match = (
        "(inv_line.product_id = line.product_id OR inv_line.code = line.code OR "
        f"{invoice_variant} = {order_variant})"
    )
    op.execute(sa.text(f"""
        UPDATE sales_order_items line
        SET billed_quantity = COALESCE((
                SELECT SUM(inv_line.quantity)
                FROM sales_invoices inv
                JOIN sales_invoice_items inv_line ON inv_line.invoice_id = inv.id
                WHERE inv.is_deleted = false
                  AND inv.po_reference = (SELECT po_number FROM sales_orders WHERE id = line.order_id)
                  AND {match}
            ), 0),
            pending_quantity = GREATEST(line.quantity - COALESCE((
                SELECT SUM(inv_line.quantity)
                FROM sales_invoices inv
                JOIN sales_invoice_items inv_line ON inv_line.invoice_id = inv.id
                WHERE inv.is_deleted = false
                  AND inv.po_reference = (SELECT po_number FROM sales_orders WHERE id = line.order_id)
                  AND {match}
            ), 0), 0),
            overbilled_quantity = GREATEST(COALESCE((
                SELECT SUM(inv_line.quantity)
                FROM sales_invoices inv
                JOIN sales_invoice_items inv_line ON inv_line.invoice_id = inv.id
                WHERE inv.is_deleted = false
                  AND inv.po_reference = (SELECT po_number FROM sales_orders WHERE id = line.order_id)
                  AND {match}
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
    pass