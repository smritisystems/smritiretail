"""SMRITI Retail OS Item Master Phase 5: Batch, Serial & Warehouse Location Transaction Wiring

Revision ID: v1520_item_master_phase5_batch_serial_location_wiring
Revises: v1519_item_master_phase2_uom_pricing_tax_policies
Create Date: 2026-10-05

Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.70.0
Copyright    : (C) SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal

Architecture Invariants Enforced:
1. item_batches, item_serials, item_warehouse_locations wired directly to transactional tables.
2. Foreign keys are nullable with ON DELETE SET NULL to preserve transactional history.
3. Indexed for high-speed POS scanning and WMS warehouse movements.
4. Symmetrical, reversible upgrade and downgrade paths.
"""

from alembic import op
import sqlalchemy as sa

revision = "v1520_item_master_phase5_batch_serial_location_wiring"
down_revision = "v1519_item_master_phase2_uom_pricing_tax_policies"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()

    # ─────────────────────────────────────────────────────────────
    # Step 1: stock_movements (batch_id, serial_id, location_id)
    # ─────────────────────────────────────────────────────────────
    op.add_column("stock_movements", sa.Column("batch_id", sa.String(50), nullable=True))
    op.add_column("stock_movements", sa.Column("serial_id", sa.String(50), nullable=True))
    op.add_column("stock_movements", sa.Column("location_id", sa.String(50), nullable=True))

    op.create_foreign_key(
        "fk_stock_movements_batch_id",
        "stock_movements",
        "item_batches",
        ["batch_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_foreign_key(
        "fk_stock_movements_serial_id",
        "stock_movements",
        "item_serials",
        ["serial_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_foreign_key(
        "fk_stock_movements_location_id",
        "stock_movements",
        "item_warehouse_locations",
        ["location_id"],
        ["id"],
        ondelete="SET NULL",
    )

    op.create_index("idx_stock_movements_batch_id", "stock_movements", ["batch_id"])
    op.create_index("idx_stock_movements_serial_id", "stock_movements", ["serial_id"])
    op.create_index("idx_stock_movements_location_id", "stock_movements", ["location_id"])

    # ─────────────────────────────────────────────────────────────
    # Step 2: purchase_receipt_items (batch_id, warehouse_location_id)
    # ─────────────────────────────────────────────────────────────
    op.add_column("purchase_receipt_items", sa.Column("batch_id", sa.String(50), nullable=True))
    op.add_column("purchase_receipt_items", sa.Column("warehouse_location_id", sa.String(50), nullable=True))

    op.create_foreign_key(
        "fk_purchase_receipt_items_batch_id",
        "purchase_receipt_items",
        "item_batches",
        ["batch_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_foreign_key(
        "fk_purchase_receipt_items_wh_loc_id",
        "purchase_receipt_items",
        "item_warehouse_locations",
        ["warehouse_location_id"],
        ["id"],
        ondelete="SET NULL",
    )

    op.create_index("idx_purchase_receipt_items_batch_id", "purchase_receipt_items", ["batch_id"])
    op.create_index("idx_purchase_receipt_items_wh_loc_id", "purchase_receipt_items", ["warehouse_location_id"])

    # ─────────────────────────────────────────────────────────────
    # Step 3: sales_invoice_items (batch_id, serial_id, warehouse_location_id)
    # ─────────────────────────────────────────────────────────────
    op.add_column("sales_invoice_items", sa.Column("batch_id", sa.String(50), nullable=True))
    op.add_column("sales_invoice_items", sa.Column("serial_id", sa.String(50), nullable=True))
    op.add_column("sales_invoice_items", sa.Column("warehouse_location_id", sa.String(50), nullable=True))

    op.create_foreign_key(
        "fk_sales_invoice_items_batch_id",
        "sales_invoice_items",
        "item_batches",
        ["batch_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_foreign_key(
        "fk_sales_invoice_items_serial_id",
        "sales_invoice_items",
        "item_serials",
        ["serial_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_foreign_key(
        "fk_sales_invoice_items_wh_loc_id",
        "sales_invoice_items",
        "item_warehouse_locations",
        ["warehouse_location_id"],
        ["id"],
        ondelete="SET NULL",
    )

    op.create_index("idx_sales_invoice_items_batch_id", "sales_invoice_items", ["batch_id"])
    op.create_index("idx_sales_invoice_items_serial_id", "sales_invoice_items", ["serial_id"])
    op.create_index("idx_sales_invoice_items_wh_loc_id", "sales_invoice_items", ["warehouse_location_id"])

    # ─────────────────────────────────────────────────────────────
    # Step 4: sales_return_items (batch_id, serial_id)
    # ─────────────────────────────────────────────────────────────
    op.add_column("sales_return_items", sa.Column("batch_id", sa.String(50), nullable=True))
    op.add_column("sales_return_items", sa.Column("serial_id", sa.String(50), nullable=True))

    op.create_foreign_key(
        "fk_sales_return_items_batch_id",
        "sales_return_items",
        "item_batches",
        ["batch_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_foreign_key(
        "fk_sales_return_items_serial_id",
        "sales_return_items",
        "item_serials",
        ["serial_id"],
        ["id"],
        ondelete="SET NULL",
    )

    op.create_index("idx_sales_return_items_batch_id", "sales_return_items", ["batch_id"])
    op.create_index("idx_sales_return_items_serial_id", "sales_return_items", ["serial_id"])


def downgrade() -> None:
    # Step 4 rollback: sales_return_items
    op.drop_index("idx_sales_return_items_serial_id", table_name="sales_return_items")
    op.drop_index("idx_sales_return_items_batch_id", table_name="sales_return_items")
    op.drop_constraint("fk_sales_return_items_serial_id", "sales_return_items", type_="foreignkey")
    op.drop_constraint("fk_sales_return_items_batch_id", "sales_return_items", type_="foreignkey")
    op.drop_column("sales_return_items", "serial_id")
    op.drop_column("sales_return_items", "batch_id")

    # Step 3 rollback: sales_invoice_items
    op.drop_index("idx_sales_invoice_items_wh_loc_id", table_name="sales_invoice_items")
    op.drop_index("idx_sales_invoice_items_serial_id", table_name="sales_invoice_items")
    op.drop_index("idx_sales_invoice_items_batch_id", table_name="sales_invoice_items")
    op.drop_constraint("fk_sales_invoice_items_wh_loc_id", "sales_invoice_items", type_="foreignkey")
    op.drop_constraint("fk_sales_invoice_items_serial_id", "sales_invoice_items", type_="foreignkey")
    op.drop_constraint("fk_sales_invoice_items_batch_id", "sales_invoice_items", type_="foreignkey")
    op.drop_column("sales_invoice_items", "warehouse_location_id")
    op.drop_column("sales_invoice_items", "serial_id")
    op.drop_column("sales_invoice_items", "batch_id")

    # Step 2 rollback: purchase_receipt_items
    op.drop_index("idx_purchase_receipt_items_wh_loc_id", table_name="purchase_receipt_items")
    op.drop_index("idx_purchase_receipt_items_batch_id", table_name="purchase_receipt_items")
    op.drop_constraint("fk_purchase_receipt_items_wh_loc_id", "purchase_receipt_items", type_="foreignkey")
    op.drop_constraint("fk_purchase_receipt_items_batch_id", "purchase_receipt_items", type_="foreignkey")
    op.drop_column("purchase_receipt_items", "warehouse_location_id")
    op.drop_column("purchase_receipt_items", "batch_id")

    # Step 1 rollback: stock_movements
    op.drop_index("idx_stock_movements_location_id", table_name="stock_movements")
    op.drop_index("idx_stock_movements_serial_id", table_name="stock_movements")
    op.drop_index("idx_stock_movements_batch_id", table_name="stock_movements")
    op.drop_constraint("fk_stock_movements_location_id", "stock_movements", type_="foreignkey")
    op.drop_constraint("fk_stock_movements_serial_id", "stock_movements", type_="foreignkey")
    op.drop_constraint("fk_stock_movements_batch_id", "stock_movements", type_="foreignkey")
    op.drop_column("stock_movements", "location_id")
    op.drop_column("stock_movements", "serial_id")
    op.drop_column("stock_movements", "batch_id")
