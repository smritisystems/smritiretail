"""Link every sales and procurement line to ItemMaster.

Revision ID: v1400_tx_item_links
Revises: v1399_link_product_items
"""

from alembic import op
import sqlalchemy as sa


revision = "v1400_tx_item_links"
down_revision = "v1399_link_product_items"
branch_labels = None
depends_on = None

LINE_TABLES = (
    "sales_invoice_items",
    "sales_quotation_items",
    "sales_order_items",
    "sales_return_items",
    "purchase_order_items",
    "purchase_receipt_items",
)


def upgrade() -> None:
    for table in LINE_TABLES:
        op.add_column(table, sa.Column("item_id", sa.String(length=50), nullable=True))
        op.create_index(f"ix_{table}_item_id", table, ["item_id"], unique=False)
        op.create_foreign_key(
            f"fk_{table}_item_id_items",
            table,
            "items",
            ["item_id"],
            ["id"],
            ondelete="SET NULL",
        )

    # One database rule covers every service and every future sales/procurement writer.
    op.execute(
        sa.text(
            """
            CREATE OR REPLACE FUNCTION set_transaction_item_master_link()
            RETURNS trigger AS $$
            BEGIN
                IF NEW.product_id IS NOT NULL THEN
                    SELECT p.item_id INTO NEW.item_id
                    FROM products AS p
                    WHERE p.id = NEW.product_id;
                END IF;
                RETURN NEW;
            END;
            $$ LANGUAGE plpgsql;
            """
        )
    )
    for table in LINE_TABLES:
        op.execute(
            sa.text(
                f"CREATE TRIGGER trg_{table}_item_master_link "
                f"BEFORE INSERT OR UPDATE OF product_id ON {table} "
                "FOR EACH ROW EXECUTE FUNCTION set_transaction_item_master_link()"
            )
        )
        op.execute(
            sa.text(
                f"UPDATE {table} AS line SET item_id = p.item_id "
                f"FROM products AS p WHERE line.product_id = p.id AND line.item_id IS NULL"
            )
        )


def downgrade() -> None:
    for table in LINE_TABLES:
        op.execute(sa.text(f"DROP TRIGGER IF EXISTS trg_{table}_item_master_link ON {table}"))
    op.execute(sa.text("DROP FUNCTION IF EXISTS set_transaction_item_master_link()"))
    for table in reversed(LINE_TABLES):
        op.drop_constraint(f"fk_{table}_item_id_items", table, type_="foreignkey")
        op.drop_index(f"ix_{table}_item_id", table_name=table)
        op.drop_column(table, "item_id")