"""Link stock movements to canonical ItemMaster items.

Revision ID: v1401_stock_move_link
Revises: v1400_tx_item_links
"""

from alembic import op
import sqlalchemy as sa


revision = "v1401_stock_move_link"
down_revision = "v1400_tx_item_links"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("stock_movements", sa.Column("item_id", sa.String(length=50), nullable=True))
    op.create_index("ix_stock_movements_item_id", "stock_movements", ["item_id"], unique=False)
    op.create_foreign_key(
        "fk_stock_movements_item_id_items",
        "stock_movements",
        "items",
        ["item_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.execute(
        sa.text(
            """
            UPDATE stock_movements AS movement
            SET item_id = product.item_id
            FROM products AS product
            WHERE movement.product_id = product.id
              AND movement.item_id IS NULL
            """
        )
    )
    op.execute(
        sa.text(
            """
            CREATE OR REPLACE FUNCTION set_stock_movement_item_master_link()
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
    op.execute(
        sa.text(
            """
            CREATE TRIGGER trg_stock_movements_item_master_link
            BEFORE INSERT OR UPDATE OF product_id ON stock_movements
            FOR EACH ROW EXECUTE FUNCTION set_stock_movement_item_master_link()
            """
        )
    )


def downgrade() -> None:
    op.execute(sa.text("DROP TRIGGER IF EXISTS trg_stock_movements_item_master_link ON stock_movements"))
    op.execute(sa.text("DROP FUNCTION IF EXISTS set_stock_movement_item_master_link()"))
    op.drop_constraint("fk_stock_movements_item_id_items", "stock_movements", type_="foreignkey")
    op.drop_index("ix_stock_movements_item_id", table_name="stock_movements")
    op.drop_column("stock_movements", "item_id")