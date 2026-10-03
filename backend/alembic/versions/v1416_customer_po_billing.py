"""Add first-class customer PO billing and invoice source traceability."""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "v1416_customer_po_billing"
down_revision: Union[str, Sequence[str], None] = "v1415_scope_master_values"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "customer_purchase_orders",
        sa.Column("id", sa.String(50), primary_key=True),
        sa.Column("uuid", sa.String(36), nullable=False, unique=True),
        sa.Column("company_id", sa.String(50), sa.ForeignKey("companies.id", ondelete="RESTRICT"), nullable=True),
        sa.Column("branch_id", sa.String(50), sa.ForeignKey("branches.id", ondelete="RESTRICT"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True)),
        sa.Column("modified_at", sa.DateTime(timezone=True)),
        sa.Column("created_by", sa.String(100)),
        sa.Column("updated_by", sa.String(100)),
        sa.Column("is_active", sa.Boolean(), server_default=sa.true()),
        sa.Column("is_deleted", sa.Boolean(), server_default=sa.false()),
        sa.Column("deleted_at", sa.DateTime(timezone=True)),
        sa.Column("deleted_by", sa.String(100)),
        sa.Column("version", sa.Integer(), server_default="1"),
        sa.Column("customer_id", sa.String(50), sa.ForeignKey("customers.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("po_number", sa.String(100), nullable=False),
        sa.Column("po_date", sa.Date(), nullable=False),
        sa.Column("valid_until", sa.Date()),
        sa.Column("currency", sa.String(3), nullable=False, server_default="INR"),
        sa.Column("status", sa.String(30), nullable=False, server_default="OPEN"),
        sa.Column("ordered_value", sa.Numeric(15, 2), nullable=False, server_default="0"),
        sa.Column("cancelled_value", sa.Numeric(15, 2), nullable=False, server_default="0"),
        sa.Column("billed_value", sa.Numeric(15, 2), nullable=False, server_default="0"),
        sa.Column("remaining_value", sa.Numeric(15, 2), nullable=False, server_default="0"),
        sa.Column("ordered_quantity", sa.Numeric(15, 4), nullable=False, server_default="0"),
        sa.Column("cancelled_quantity", sa.Numeric(15, 4), nullable=False, server_default="0"),
        sa.Column("billed_quantity", sa.Numeric(15, 4), nullable=False, server_default="0"),
        sa.Column("remaining_quantity", sa.Numeric(15, 4), nullable=False, server_default="0"),
        sa.Column("billing_policy_snapshot", postgresql.JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("notes", sa.Text()),
        sa.Column("closed_at", sa.Date()),
        sa.Column("closed_by", sa.String(100)),
    )
    op.create_index("ix_customer_po_company_branch_customer", "customer_purchase_orders", ["company_id", "branch_id", "customer_id"])
    op.create_index("ix_customer_po_company_branch_number", "customer_purchase_orders", ["company_id", "branch_id", "po_number"])
    op.create_index("ix_customer_purchase_orders_customer_id", "customer_purchase_orders", ["customer_id"])
    op.create_index("ix_customer_purchase_orders_status", "customer_purchase_orders", ["status"])
    op.create_unique_constraint("uq_customer_po_company_branch_customer_number", "customer_purchase_orders", ["company_id", "branch_id", "customer_id", "po_number"])
    op.create_check_constraint("ck_customer_po_ordered_qty_nonnegative", "customer_purchase_orders", "ordered_quantity >= 0")
    op.create_check_constraint("ck_customer_po_billed_qty_bounded", "customer_purchase_orders", "billed_quantity >= 0 AND billed_quantity <= ordered_quantity + cancelled_quantity")
    op.create_check_constraint("ck_customer_po_remaining_qty_nonnegative", "customer_purchase_orders", "remaining_quantity >= 0")

    op.create_table(
        "customer_purchase_order_lines",
        sa.Column("id", sa.String(50), primary_key=True),
        sa.Column("uuid", sa.String(36), nullable=False, unique=True),
        sa.Column("company_id", sa.String(50), sa.ForeignKey("companies.id", ondelete="RESTRICT"), nullable=True),
        sa.Column("branch_id", sa.String(50), sa.ForeignKey("branches.id", ondelete="RESTRICT"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True)),
        sa.Column("modified_at", sa.DateTime(timezone=True)),
        sa.Column("created_by", sa.String(100)),
        sa.Column("updated_by", sa.String(100)),
        sa.Column("is_active", sa.Boolean(), server_default=sa.true()),
        sa.Column("is_deleted", sa.Boolean(), server_default=sa.false()),
        sa.Column("deleted_at", sa.DateTime(timezone=True)),
        sa.Column("deleted_by", sa.String(100)),
        sa.Column("version", sa.Integer(), server_default="1"),
        sa.Column("customer_po_id", sa.String(50), sa.ForeignKey("customer_purchase_orders.id", ondelete="CASCADE"), nullable=False),
        sa.Column("line_number", sa.String(20), nullable=False),
        sa.Column("product_id", sa.String(50), sa.ForeignKey("products.id", ondelete="RESTRICT")),
        sa.Column("item_id", sa.String(50), sa.ForeignKey("items.id", ondelete="SET NULL")),
        sa.Column("variant_id", sa.String(50)),
        sa.Column("code", sa.String(50), nullable=False),
        sa.Column("description", sa.String(255), nullable=False),
        sa.Column("quantity_ordered", sa.Numeric(15, 4), nullable=False, server_default="0"),
        sa.Column("quantity_cancelled", sa.Numeric(15, 4), nullable=False, server_default="0"),
        sa.Column("quantity_billed", sa.Numeric(15, 4), nullable=False, server_default="0"),
        sa.Column("quantity_remaining", sa.Numeric(15, 4), nullable=False, server_default="0"),
        sa.Column("unit_price", sa.Numeric(15, 2), nullable=False, server_default="0"),
        sa.Column("ordered_value", sa.Numeric(15, 2), nullable=False, server_default="0"),
        sa.Column("billed_value", sa.Numeric(15, 2), nullable=False, server_default="0"),
        sa.Column("remaining_value", sa.Numeric(15, 2), nullable=False, server_default="0"),
        sa.Column("gst_rate", sa.Numeric(5, 2), nullable=False, server_default="18"),
        sa.Column("hsn_code", sa.String(15)),
        sa.Column("uom", sa.String(20), nullable=False, server_default="EA"),
        sa.Column("delivery_location_id", sa.String(50), sa.ForeignKey("customer_delivery_locations.id", ondelete="SET NULL")),
        sa.Column("line_status", sa.String(30), nullable=False, server_default="OPEN"),
    )
    op.create_index("ix_customer_po_line_po", "customer_purchase_order_lines", ["customer_po_id", "line_number"])
    op.create_index("ix_customer_purchase_order_lines_product_id", "customer_purchase_order_lines", ["product_id"])
    op.create_index("ix_customer_purchase_order_lines_item_id", "customer_purchase_order_lines", ["item_id"])
    op.create_index("ix_customer_purchase_order_lines_delivery_location_id", "customer_purchase_order_lines", ["delivery_location_id"])
    op.create_index("ix_customer_purchase_order_lines_line_status", "customer_purchase_order_lines", ["line_status"])
    op.create_check_constraint("ck_customer_po_line_qty_nonnegative", "customer_purchase_order_lines", "quantity_ordered >= 0")
    op.create_check_constraint("ck_customer_po_line_billed_qty_bounded", "customer_purchase_order_lines", "quantity_billed >= 0 AND quantity_billed <= quantity_ordered + quantity_cancelled")
    op.create_check_constraint("ck_customer_po_line_remaining_qty_nonnegative", "customer_purchase_order_lines", "quantity_remaining >= 0")

    op.create_table(
        "customer_po_invoice_allocations",
        sa.Column("id", sa.String(50), primary_key=True),
        sa.Column("uuid", sa.String(36), nullable=False, unique=True),
        sa.Column("company_id", sa.String(50), sa.ForeignKey("companies.id", ondelete="RESTRICT"), nullable=True),
        sa.Column("branch_id", sa.String(50), sa.ForeignKey("branches.id", ondelete="RESTRICT"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True)),
        sa.Column("modified_at", sa.DateTime(timezone=True)),
        sa.Column("created_by", sa.String(100)),
        sa.Column("updated_by", sa.String(100)),
        sa.Column("is_active", sa.Boolean(), server_default=sa.true()),
        sa.Column("is_deleted", sa.Boolean(), server_default=sa.false()),
        sa.Column("deleted_at", sa.DateTime(timezone=True)),
        sa.Column("deleted_by", sa.String(100)),
        sa.Column("version", sa.Integer(), server_default="1"),
        sa.Column("customer_po_id", sa.String(50), sa.ForeignKey("customer_purchase_orders.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("customer_po_line_id", sa.String(50), sa.ForeignKey("customer_purchase_order_lines.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("invoice_id", sa.String(50), sa.ForeignKey("sales_invoices.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("invoice_item_id", sa.Integer(), sa.ForeignKey("sales_invoice_items.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("customer_po_number", sa.String(100), nullable=False),
        sa.Column("invoice_number", sa.String(100), nullable=False),
        sa.Column("allocated_quantity", sa.Numeric(15, 4), nullable=False),
        sa.Column("allocated_value", sa.Numeric(15, 2), nullable=False),
        sa.Column("status", sa.String(30), nullable=False, server_default="ALLOCATED"),
        sa.Column("allocation_metadata", postgresql.JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
    )
    op.create_index("ix_customer_po_alloc_po_line", "customer_po_invoice_allocations", ["customer_po_id", "customer_po_line_id"])
    op.create_index("ix_customer_po_alloc_invoice", "customer_po_invoice_allocations", ["invoice_id", "invoice_item_id"])

    op.add_column("sales_invoices", sa.Column("customer_po_id", sa.String(50), nullable=True))
    op.add_column("sales_invoices", sa.Column("customer_po_number_snapshot", sa.String(100), nullable=True))
    op.add_column("sales_invoices", sa.Column("customer_po_date_snapshot", sa.Date(), nullable=True))
    op.add_column("sales_invoices", sa.Column("source_document_type", sa.String(30), nullable=True, server_default="DIRECT"))
    op.add_column("sales_invoices", sa.Column("source_document_id", sa.String(50), nullable=True))
    op.add_column("sales_invoices", sa.Column("source_document_line_id", sa.String(50), nullable=True))
    op.create_foreign_key("fk_sales_invoices_customer_po", "sales_invoices", "customer_purchase_orders", ["customer_po_id"], ["id"], ondelete="SET NULL")
    op.create_index("ix_sales_invoices_customer_po_id", "sales_invoices", ["customer_po_id"])

    op.add_column("sales_invoice_items", sa.Column("customer_po_line_id", sa.String(50), nullable=True))
    op.add_column("sales_invoice_items", sa.Column("source_line_type", sa.String(30), nullable=True))
    op.add_column("sales_invoice_items", sa.Column("source_line_id", sa.String(50), nullable=True))
    op.create_foreign_key("fk_sales_invoice_items_customer_po_line", "sales_invoice_items", "customer_purchase_order_lines", ["customer_po_line_id"], ["id"], ondelete="SET NULL")
    op.create_index("ix_sales_invoice_items_customer_po_line_id", "sales_invoice_items", ["customer_po_line_id"])


def downgrade() -> None:
    op.drop_index("ix_sales_invoice_items_customer_po_line_id", table_name="sales_invoice_items")
    op.drop_constraint("fk_sales_invoice_items_customer_po_line", "sales_invoice_items", type_="foreignkey")
    op.drop_column("sales_invoice_items", "source_line_id")
    op.drop_column("sales_invoice_items", "source_line_type")
    op.drop_column("sales_invoice_items", "customer_po_line_id")
    op.drop_index("ix_sales_invoices_customer_po_id", table_name="sales_invoices")
    op.drop_constraint("fk_sales_invoices_customer_po", "sales_invoices", type_="foreignkey")
    for column in ("source_document_line_id", "source_document_id", "source_document_type", "customer_po_date_snapshot", "customer_po_number_snapshot", "customer_po_id"):
        op.drop_column("sales_invoices", column)
    op.drop_index("ix_customer_po_alloc_invoice", table_name="customer_po_invoice_allocations")
    op.drop_index("ix_customer_po_alloc_po_line", table_name="customer_po_invoice_allocations")
    op.drop_table("customer_po_invoice_allocations")
    op.drop_index("ix_customer_purchase_order_lines_line_status", table_name="customer_purchase_order_lines")
    op.drop_index("ix_customer_purchase_order_lines_delivery_location_id", table_name="customer_purchase_order_lines")
    op.drop_index("ix_customer_purchase_order_lines_item_id", table_name="customer_purchase_order_lines")
    op.drop_index("ix_customer_purchase_order_lines_product_id", table_name="customer_purchase_order_lines")
    op.drop_index("ix_customer_po_line_po", table_name="customer_purchase_order_lines")
    op.drop_table("customer_purchase_order_lines")
    op.drop_index("ix_customer_purchase_orders_status", table_name="customer_purchase_orders")
    op.drop_index("ix_customer_purchase_orders_customer_id", table_name="customer_purchase_orders")
    op.drop_constraint("uq_customer_po_company_branch_customer_number", "customer_purchase_orders", type_="unique")
    op.drop_index("ix_customer_po_company_branch_number", table_name="customer_purchase_orders")
    op.drop_index("ix_customer_po_company_branch_customer", table_name="customer_purchase_orders")
    op.drop_table("customer_purchase_orders")
