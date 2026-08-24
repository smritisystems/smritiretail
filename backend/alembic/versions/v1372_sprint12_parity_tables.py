"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 1.0.0
Created      : 2026-08-24
Modified     : 2026-08-24
Copyright    : (c) SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software

Sprint 12 migration -- three missing tables required for parity:

  1. stock_takes          -- physical stock count sessions (SR323400/SR211000)
  2. stock_count_lines    -- per-item lines within a stock take session
  3. sales_invoice_lines  -- invoice line items (SR202000/SR236300/SR214100)
  4. loyalty_transactions -- points earn/redeem ledger detail

Shoper9 EXE references:
  SR323400 -- Physical Stock Management (MnuNo 350/351)
  SR211000 -- Physical vs Computed Stock Report (MnuNo 350/352)
  SR202000 -- Bill-wise Items (MnuNo 410/415)
  SR236300 -- Attribute+Size wise Sales (MnuNo 410/422)
  SR214100 -- Item-wise Sales Returns (MnuNo 410/425)
"""

# revision identifiers -- must stay <= 32 chars
revision      = "v1372_sprint12_parity_tables"
down_revision = "v1371_legacy_menu_map"
branch_labels = None
depends_on    = None

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB, UUID


def upgrade() -> None:
    # -----------------------------------------------------------------------
    # 1. stock_takes -- Physical Stock Count Sessions
    # -----------------------------------------------------------------------
    op.create_table(
        "stock_takes",
        sa.Column("id",            sa.String(50),    primary_key=True),
        sa.Column("uuid",          UUID(as_uuid=False), nullable=True, unique=True),
        sa.Column("company_id",    sa.String(50),    nullable=True, index=True),
        sa.Column("branch_id",     sa.String(50),    nullable=True, index=True),

        # Business fields
        sa.Column("stock_take_no", sa.String(100),   nullable=False),
        sa.Column("description",   sa.Text,          nullable=True),
        sa.Column("count_date",    sa.Date,          nullable=False,
                  server_default=sa.text("CURRENT_DATE")),
        sa.Column("warehouse_id",  sa.String(50),
                  sa.ForeignKey("warehouses.id", ondelete="SET NULL"),
                  nullable=True, index=True),
        sa.Column("status",        sa.String(30),    nullable=False,
                  server_default="DRAFT"),  # DRAFT | IN_PROGRESS | COMPLETED | APPROVED | CANCELLED
        sa.Column("counted_by",    sa.String(255),   nullable=True),
        sa.Column("approved_by",   sa.String(255),   nullable=True),
        sa.Column("approved_at",   sa.DateTime(timezone=True), nullable=True),
        sa.Column("notes",         sa.Text,          nullable=True),
        sa.Column("total_lines",   sa.Integer,       nullable=False, server_default="0"),
        sa.Column("total_variance_qty",   sa.Numeric(12, 4), nullable=False, server_default="0"),
        sa.Column("total_variance_value", sa.Numeric(15, 2), nullable=False, server_default="0"),

        # Audit columns (BaseEntity pattern)
        sa.Column("created_at",    sa.DateTime(timezone=True), nullable=True,
                  server_default=sa.text("NOW()")),
        sa.Column("modified_at",   sa.DateTime(timezone=True), nullable=True,
                  server_default=sa.text("NOW()")),
        sa.Column("created_by",    sa.String(100),   nullable=True),
        sa.Column("updated_by",    sa.String(100),   nullable=True),
        sa.Column("is_active",     sa.Boolean,       server_default="true"),
        sa.Column("is_deleted",    sa.Boolean,       server_default="false", index=True),
        sa.Column("deleted_at",    sa.DateTime(timezone=True), nullable=True),
        sa.Column("deleted_by",    sa.String(100),   nullable=True),
        sa.Column("version",       sa.Integer,       server_default="1"),
    )
    op.create_index("ix_stock_takes_company_branch",
                    "stock_takes", ["company_id", "branch_id"])
    op.create_index("ix_stock_takes_status",
                    "stock_takes", ["status"])
    op.create_index("ix_stock_takes_count_date",
                    "stock_takes", ["count_date"])
    op.create_unique_constraint(
        "uq_company_stock_take_no",
        "stock_takes", ["company_id", "stock_take_no"]
    )

    # -----------------------------------------------------------------------
    # 2. stock_count_lines -- Per-item lines within a stock take
    # -----------------------------------------------------------------------
    op.create_table(
        "stock_count_lines",
        sa.Column("id",               sa.String(50),  primary_key=True),
        sa.Column("uuid",             UUID(as_uuid=False), nullable=True, unique=True),
        sa.Column("company_id",       sa.String(50),  nullable=True, index=True),
        sa.Column("branch_id",        sa.String(50),  nullable=True),

        # Business fields
        sa.Column("stock_take_id",    sa.String(50),
                  sa.ForeignKey("stock_takes.id", ondelete="CASCADE"),
                  nullable=False, index=True),
        sa.Column("product_id",       sa.String(50),
                  sa.ForeignKey("products.id", ondelete="RESTRICT"),
                  nullable=False, index=True),
        sa.Column("product_name",     sa.String(255), nullable=True),
        sa.Column("sku",              sa.String(100), nullable=True),
        sa.Column("barcode",          sa.String(100), nullable=True),
        sa.Column("warehouse_id",     sa.String(50),
                  sa.ForeignKey("warehouses.id", ondelete="SET NULL"),
                  nullable=True),
        sa.Column("bin_location",     sa.String(100), nullable=True),
        sa.Column("batch_no",         sa.String(100), nullable=True),

        # Quantities
        sa.Column("computed_qty",     sa.Numeric(12, 4), nullable=False, server_default="0"),
        sa.Column("counted_qty",      sa.Numeric(12, 4), nullable=True),
        sa.Column("variance_qty",     sa.Numeric(12, 4), nullable=True),
        sa.Column("unit_cost",        sa.Numeric(15, 2), nullable=True),
        sa.Column("variance_value",   sa.Numeric(15, 2), nullable=True),

        # Status
        sa.Column("status",           sa.String(30),  nullable=False, server_default="PENDING"),
        sa.Column("notes",            sa.Text,        nullable=True),

        # Audit
        sa.Column("created_at",       sa.DateTime(timezone=True), nullable=True,
                  server_default=sa.text("NOW()")),
        sa.Column("modified_at",      sa.DateTime(timezone=True), nullable=True,
                  server_default=sa.text("NOW()")),
        sa.Column("created_by",       sa.String(100), nullable=True),
        sa.Column("updated_by",       sa.String(100), nullable=True),
        sa.Column("is_active",        sa.Boolean,     server_default="true"),
        sa.Column("is_deleted",       sa.Boolean,     server_default="false", index=True),
        sa.Column("deleted_at",       sa.DateTime(timezone=True), nullable=True),
        sa.Column("deleted_by",       sa.String(100), nullable=True),
        sa.Column("version",          sa.Integer,     server_default="1"),
    )
    op.create_index("ix_stock_count_lines_take_product",
                    "stock_count_lines", ["stock_take_id", "product_id"])

    # -----------------------------------------------------------------------
    # 3. sales_invoice_lines -- Invoice line items
    # -----------------------------------------------------------------------
    op.create_table(
        "sales_invoice_lines",
        sa.Column("id",             sa.String(50),  primary_key=True),
        sa.Column("uuid",           UUID(as_uuid=False), nullable=True, unique=True),
        sa.Column("company_id",     sa.String(50),  nullable=True, index=True),
        sa.Column("branch_id",      sa.String(50),  nullable=True),

        # Business fields
        sa.Column("invoice_id",     sa.String(50),
                  sa.ForeignKey("sales_invoices.id", ondelete="CASCADE"),
                  nullable=False, index=True),
        sa.Column("line_no",        sa.Integer,     nullable=False, server_default="1"),
        sa.Column("product_id",     sa.String(50),
                  sa.ForeignKey("products.id", ondelete="RESTRICT"),
                  nullable=True, index=True),
        sa.Column("product_name",   sa.String(255), nullable=True),
        sa.Column("sku",            sa.String(100), nullable=True),
        sa.Column("barcode",        sa.String(100), nullable=True),
        sa.Column("hsn_code",       sa.String(20),  nullable=True),

        # Sizes and attributes (Shoper9 size-wise parity)
        sa.Column("size_label",     sa.String(50),  nullable=True),
        sa.Column("color",          sa.String(50),  nullable=True),
        sa.Column("attribute_json", JSONB,          server_default=sa.text("'{}'::jsonb")),

        # Quantities and pricing
        sa.Column("quantity",       sa.Numeric(12, 4), nullable=False),
        sa.Column("unit_price",     sa.Numeric(15, 4), nullable=False, server_default="0"),
        sa.Column("mrp",            sa.Numeric(15, 4), nullable=True),
        sa.Column("discount_pct",   sa.Numeric(5, 2),  nullable=False, server_default="0"),
        sa.Column("discount_amount",sa.Numeric(15, 2),  nullable=False, server_default="0"),
        sa.Column("taxable_value",  sa.Numeric(15, 2),  nullable=False, server_default="0"),
        sa.Column("tax_rate",       sa.Numeric(5, 2),   nullable=False, server_default="0"),
        sa.Column("tax_amount",     sa.Numeric(15, 2),  nullable=False, server_default="0"),
        sa.Column("net_amount",     sa.Numeric(15, 2),  nullable=False, server_default="0"),

        # Warehouse
        sa.Column("warehouse_id",   sa.String(50),
                  sa.ForeignKey("warehouses.id", ondelete="SET NULL"),
                  nullable=True),
        sa.Column("batch_no",       sa.String(100), nullable=True),

        # Audit
        sa.Column("created_at",     sa.DateTime(timezone=True), nullable=True,
                  server_default=sa.text("NOW()")),
        sa.Column("modified_at",    sa.DateTime(timezone=True), nullable=True,
                  server_default=sa.text("NOW()")),
        sa.Column("created_by",     sa.String(100), nullable=True),
        sa.Column("updated_by",     sa.String(100), nullable=True),
        sa.Column("is_active",      sa.Boolean,     server_default="true"),
        sa.Column("is_deleted",     sa.Boolean,     server_default="false", index=True),
        sa.Column("deleted_at",     sa.DateTime(timezone=True), nullable=True),
        sa.Column("deleted_by",     sa.String(100), nullable=True),
        sa.Column("version",        sa.Integer,     server_default="1"),
    )
    op.create_index("ix_sil_invoice_line",
                    "sales_invoice_lines", ["invoice_id", "line_no"])
    op.create_index("ix_sil_product",
                    "sales_invoice_lines", ["product_id"])
    op.create_index("ix_sil_company_date",
                    "sales_invoice_lines", ["company_id"])

    # -----------------------------------------------------------------------
    # 4. loyalty_transactions -- Points earn/redeem ledger
    # -----------------------------------------------------------------------
    op.create_table(
        "loyalty_transactions",
        sa.Column("id",              sa.String(50),  primary_key=True),
        sa.Column("uuid",            UUID(as_uuid=False), nullable=True, unique=True),
        sa.Column("company_id",      sa.String(50),  nullable=True, index=True),
        sa.Column("branch_id",       sa.String(50),  nullable=True),

        # Business fields
        sa.Column("member_id",       sa.String(50),
                  sa.ForeignKey("loyalty_members.id", ondelete="CASCADE"),
                  nullable=False, index=True),
        sa.Column("customer_id",     sa.String(50),
                  sa.ForeignKey("customers.id", ondelete="CASCADE"),
                  nullable=True, index=True),
        sa.Column("transaction_type", sa.String(30), nullable=False),
        # EARN | REDEEM | REVERSAL | EXPIRY | ADJUSTMENT | BONUS
        sa.Column("points",          sa.Numeric(15, 2), nullable=False),
        sa.Column("balance_after",   sa.Numeric(15, 2), nullable=True),
        sa.Column("reference_type",  sa.String(50),  nullable=True),
        # SALES_INVOICE | SALES_RETURN | MANUAL | SYSTEM
        sa.Column("reference_id",    sa.String(50),  nullable=True, index=True),
        sa.Column("invoice_amount",  sa.Numeric(15, 2), nullable=True),
        sa.Column("narration",       sa.Text,        nullable=True),
        sa.Column("expiry_date",     sa.Date,        nullable=True),

        # Audit
        sa.Column("created_at",      sa.DateTime(timezone=True), nullable=True,
                  server_default=sa.text("NOW()")),
        sa.Column("modified_at",     sa.DateTime(timezone=True), nullable=True,
                  server_default=sa.text("NOW()")),
        sa.Column("created_by",      sa.String(100), nullable=True),
        sa.Column("updated_by",      sa.String(100), nullable=True),
        sa.Column("is_active",       sa.Boolean,     server_default="true"),
        sa.Column("is_deleted",      sa.Boolean,     server_default="false", index=True),
        sa.Column("deleted_at",      sa.DateTime(timezone=True), nullable=True),
        sa.Column("deleted_by",      sa.String(100), nullable=True),
        sa.Column("version",         sa.Integer,     server_default="1"),
    )
    op.create_index("ix_loyalty_tx_member",
                    "loyalty_transactions", ["member_id", "created_at"])
    op.create_index("ix_loyalty_tx_type",
                    "loyalty_transactions", ["transaction_type"])
    op.create_index("ix_loyalty_tx_reference",
                    "loyalty_transactions", ["reference_type", "reference_id"])


def downgrade() -> None:
    op.drop_table("loyalty_transactions")
    op.drop_table("sales_invoice_lines")
    op.drop_table("stock_count_lines")
    op.drop_table("stock_takes")
