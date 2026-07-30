"""
Project      : SMRITI Retail OS
Organization : SmritiSys
Author       : Jawahar Ramkripal Mallah
Email        : support@smritibooks.com
Version      : 1.0.0
Created      : 2026-07-30
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software

Alembic Migration: SCDM — SMRITI Channel Distribution Management (Platform Capability v1.0)
Revision     : v1300_scdm_channel_distribution

Design:
  - ADDITIVE ONLY (AOP-004). No existing table is modified destructively.
  - Customer table gets 3 new nullable/defaulted columns.
  - 6 new SCDM tables created in dependency order.
  - 1 PostgreSQL VIEW (v_scdm_stock_projection) computed from ChannelStockMovement.
  - Rollback: drop view → drop 6 tables → drop 3 customer columns (zero impact on existing data).
"""

from typing import Union, Sequence
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from alembic import op

# Revision identifiers
revision: str = "v1300_scdm_channel_distribution"
down_revision: Union[str, Sequence[str], None] = "v900_replenishment_reorder"
branch_labels = None
depends_on = None

# ── BaseEntity columns shared by all SCDM tables ────────────────────────────
BASE_COLS = [
    sa.Column("id",              sa.String(50),              primary_key=True),
    sa.Column("uuid",            sa.String(36),              nullable=False, unique=True),
    sa.Column("tenant_id",       sa.String(50),              nullable=True, index=True),
    sa.Column("company_id",      sa.String(50),              sa.ForeignKey("companies.id",  ondelete="RESTRICT"), nullable=True),
    sa.Column("branch_id",       sa.String(50),              sa.ForeignKey("branches.id",   ondelete="RESTRICT"), nullable=True),
    sa.Column("created_at",      sa.DateTime(timezone=True), nullable=True),
    sa.Column("modified_at",     sa.DateTime(timezone=True), nullable=True),
    sa.Column("created_by",      sa.String(100),             nullable=True),
    sa.Column("updated_by",      sa.String(100),             nullable=True),
    sa.Column("is_active",       sa.Boolean,                 server_default=sa.text("true")),
    sa.Column("is_deleted",      sa.Boolean,                 server_default=sa.text("false")),
    sa.Column("deleted_at",      sa.DateTime(timezone=True), nullable=True),
    sa.Column("deleted_by",      sa.String(100),             nullable=True),
    sa.Column("version",         sa.Integer,                 server_default=sa.text("1")),
    sa.Column("workflow_status", sa.String(30),              nullable=True),
    sa.Column("document_number", sa.String(80),              nullable=True),
]


def upgrade() -> None:
    conn = op.get_bind()

    # ──────────────────────────────────────────────────────────────────────────
    # STEP 1 — Extend customers table (additive, AOP-004)
    # ──────────────────────────────────────────────────────────────────────────
    conn.execute(sa.text("""
        ALTER TABLE customers
            ADD COLUMN IF NOT EXISTS channel_tracking_enabled BOOLEAN NOT NULL DEFAULT FALSE,
            ADD COLUMN IF NOT EXISTS supply_model             VARCHAR(30) NULL,
            ADD COLUMN IF NOT EXISTS sellout_source           VARCHAR(30) NULL;
    """))
    conn.execute(sa.text(
        "CREATE INDEX IF NOT EXISTS ix_customers_channel_tracking "
        "ON customers (channel_tracking_enabled) WHERE channel_tracking_enabled = TRUE;"
    ))

    # ──────────────────────────────────────────────────────────────────────────
    # STEP 2 — scdm_channel_locations (Customer hierarchy: DC / Store / Dept)
    # ──────────────────────────────────────────────────────────────────────────
    op.create_table(
        "scdm_channel_locations",
        *BASE_COLS,
        sa.Column("customer_id",   sa.String(50), sa.ForeignKey("customers.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("parent_id",     sa.String(50), sa.ForeignKey("scdm_channel_locations.id", ondelete="SET NULL"), nullable=True),
        sa.Column("code",          sa.String(50),  nullable=False),
        sa.Column("name",          sa.String(255), nullable=False),
        sa.Column("location_type", sa.String(30),  nullable=False, server_default=sa.text("'Store'")),
        sa.Column("address_line1", sa.String(255), nullable=True),
        sa.Column("address_city",  sa.String(100), nullable=True),
        sa.Column("address_state", sa.String(100), nullable=True),
        sa.Column("address_pin",   sa.String(10),  nullable=True),
        sa.Column("gst_number",    sa.String(15),  nullable=True),
        sa.Column("notes",         sa.Text,        nullable=True),
        comment="SCDM: Customer distribution location hierarchy (DC/Store/Dept)"
    )
    op.create_index("ix_scdm_location_customer_id",   "scdm_channel_locations", ["customer_id"])
    op.create_index("ix_scdm_location_customer_code", "scdm_channel_locations", ["customer_id", "code"])

    # ──────────────────────────────────────────────────────────────────────────
    # STEP 3 — scdm_channel_dispatches (auto-created on invoice post)
    # ──────────────────────────────────────────────────────────────────────────
    op.create_table(
        "scdm_channel_dispatches",
        *BASE_COLS,
        sa.Column("dispatch_no",         sa.String(80),   nullable=False, unique=True),
        sa.Column("invoice_id",          sa.String(50),   sa.ForeignKey("sales_invoices.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("customer_id",         sa.String(50),   sa.ForeignKey("customers.id",      ondelete="RESTRICT"), nullable=False),
        sa.Column("channel_location_id", sa.String(50),   sa.ForeignKey("scdm_channel_locations.id", ondelete="SET NULL"), nullable=True),
        sa.Column("dispatch_date",       sa.Date,         nullable=False),
        sa.Column("status",              sa.String(30),   nullable=False, server_default=sa.text("'Draft'")),
        # Draft | Posted | PartiallySettled | FullySettled | Cancelled | Archived
        sa.Column("total_dispatch_qty",  sa.Numeric(15,4), nullable=False, server_default=sa.text("0")),
        sa.Column("total_mrp_value",     sa.Numeric(15,2), nullable=False, server_default=sa.text("0")),
        sa.Column("total_cost_value",    sa.Numeric(15,2), nullable=False, server_default=sa.text("0")),
        sa.Column("total_invoice_value", sa.Numeric(15,2), nullable=False, server_default=sa.text("0")),
        sa.Column("total_sellout_qty",   sa.Numeric(15,4), nullable=False, server_default=sa.text("0")),
        sa.Column("total_return_qty",    sa.Numeric(15,4), nullable=False, server_default=sa.text("0")),
        sa.Column("total_damage_qty",    sa.Numeric(15,4), nullable=False, server_default=sa.text("0")),
        sa.Column("settlement_value",    sa.Numeric(15,2), nullable=False, server_default=sa.text("0")),
        sa.Column("notes",               sa.Text,          nullable=True),
        sa.Column("metadata_json",       postgresql.JSONB, server_default=sa.text("'{}'::jsonb")),
        comment="SCDM: Channel dispatch auto-created from posted SalesInvoice"
    )
    op.create_index("ix_scdm_dispatch_customer_date", "scdm_channel_dispatches", ["customer_id", "dispatch_date"])
    op.create_index("ix_scdm_dispatch_invoice",       "scdm_channel_dispatches", ["invoice_id"])
    op.create_index("ix_scdm_dispatch_status",        "scdm_channel_dispatches", ["status"])

    # ──────────────────────────────────────────────────────────────────────────
    # STEP 4 — scdm_channel_dispatch_lines (per-item detail)
    # ──────────────────────────────────────────────────────────────────────────
    op.create_table(
        "scdm_channel_dispatch_lines",
        sa.Column("id",                  sa.String(50),   primary_key=True),
        sa.Column("uuid",                sa.String(36),   nullable=False, unique=True),
        sa.Column("tenant_id",           sa.String(50),   nullable=True),
        sa.Column("company_id",          sa.String(50),   sa.ForeignKey("companies.id", ondelete="RESTRICT"), nullable=True),
        sa.Column("branch_id",           sa.String(50),   sa.ForeignKey("branches.id",  ondelete="RESTRICT"), nullable=True),
        sa.Column("created_at",          sa.DateTime(timezone=True), nullable=True),
        sa.Column("modified_at",         sa.DateTime(timezone=True), nullable=True),
        sa.Column("dispatch_id",         sa.String(50),   sa.ForeignKey("scdm_channel_dispatches.id", ondelete="CASCADE"), nullable=False),
        sa.Column("product_id",          sa.String(50),   sa.ForeignKey("products.id",  ondelete="RESTRICT"), nullable=False),
        sa.Column("invoice_item_id",     sa.Integer,      nullable=True),
        sa.Column("code",                sa.String(50),   nullable=False, server_default=sa.text("''")),
        sa.Column("name",                sa.String(255),  nullable=False, server_default=sa.text("''")),
        sa.Column("hsn_code",            sa.String(15),   nullable=True),
        sa.Column("batch_no",            sa.String(50),   nullable=True),
        sa.Column("serial_no",           sa.String(100),  nullable=True),
        sa.Column("dispatch_qty",        sa.Numeric(12,4), nullable=False, server_default=sa.text("0")),
        sa.Column("unit",                sa.String(30),   nullable=True,  server_default=sa.text("'Pcs'")),
        sa.Column("mrp",                 sa.Numeric(15,2), nullable=True),
        sa.Column("cost_price",          sa.Numeric(15,2), nullable=True),
        sa.Column("invoice_rate",        sa.Numeric(15,2), nullable=True),
        sa.Column("line_invoice_value",  sa.Numeric(15,2), nullable=False, server_default=sa.text("0")),
        sa.Column("line_mrp_value",      sa.Numeric(15,2), nullable=False, server_default=sa.text("0")),
        sa.Column("sellout_qty",         sa.Numeric(12,4), nullable=False, server_default=sa.text("0")),
        sa.Column("return_qty",          sa.Numeric(12,4), nullable=False, server_default=sa.text("0")),
        sa.Column("damage_qty",          sa.Numeric(12,4), nullable=False, server_default=sa.text("0")),
        comment="SCDM: Channel dispatch line items"
    )
    op.create_index("ix_scdm_dispatch_line_dispatch",        "scdm_channel_dispatch_lines", ["dispatch_id"])
    op.create_index("ix_scdm_dispatch_line_product",         "scdm_channel_dispatch_lines", ["dispatch_id", "product_id"])

    # ──────────────────────────────────────────────────────────────────────────
    # STEP 5 — scdm_channel_stock_movements (IMMUTABLE source of truth)
    # ──────────────────────────────────────────────────────────────────────────
    op.create_table(
        "scdm_channel_stock_movements",
        *BASE_COLS,
        sa.Column("customer_id",         sa.String(50), sa.ForeignKey("customers.id",              ondelete="RESTRICT"), nullable=False),
        sa.Column("channel_location_id", sa.String(50), sa.ForeignKey("scdm_channel_locations.id", ondelete="SET NULL"), nullable=True),
        sa.Column("product_id",          sa.String(50), sa.ForeignKey("products.id",               ondelete="RESTRICT"), nullable=False),
        sa.Column("dispatch_id",         sa.String(50), sa.ForeignKey("scdm_channel_dispatches.id",ondelete="SET NULL"), nullable=True),
        sa.Column("sellout_import_id",   sa.String(50), nullable=True),  # soft FK — set after sellout_imports table exists
        sa.Column("reference_type",      sa.String(50), nullable=True),
        sa.Column("reference_id",        sa.String(50), nullable=True),
        sa.Column("movement_type",       sa.String(30), nullable=False),
        # Dispatch | SellOut | Return | Damage | Adjustment | Reversal | Cancellation
        sa.Column("movement_date",       sa.Date,       nullable=False),
        sa.Column("batch_no",            sa.String(50), nullable=True),
        sa.Column("serial_no",           sa.String(100),nullable=True),
        sa.Column("qty",                 sa.Numeric(12,4), nullable=False),
        # +qty = stock IN (Dispatch, Return) | -qty = stock OUT (SellOut, Damage)
        sa.Column("mrp_value",           sa.Numeric(15,2), nullable=False, server_default=sa.text("0")),
        sa.Column("cost_value",          sa.Numeric(15,2), nullable=False, server_default=sa.text("0")),
        sa.Column("sales_value",         sa.Numeric(15,2), nullable=False, server_default=sa.text("0")),
        sa.Column("settlement_value",    sa.Numeric(15,2), nullable=False, server_default=sa.text("0")),
        sa.Column("narration",           sa.String(500),   nullable=True),
        sa.Column("created_by_user_id",  sa.String(50),    nullable=True),
        comment="SCDM: Immutable channel stock movement ledger — source of truth"
    )
    op.create_index("ix_scdm_movement_customer_product",  "scdm_channel_stock_movements", ["customer_id", "product_id", "movement_date"])
    op.create_index("ix_scdm_movement_dispatch",          "scdm_channel_stock_movements", ["dispatch_id"])
    op.create_index("ix_scdm_movement_type_date",         "scdm_channel_stock_movements", ["movement_type", "movement_date"])
    op.create_index("ix_scdm_movement_location",          "scdm_channel_stock_movements", ["channel_location_id"])

    # ──────────────────────────────────────────────────────────────────────────
    # STEP 6 — scdm_sellout_imports (import job header)
    # ──────────────────────────────────────────────────────────────────────────
    op.create_table(
        "scdm_sellout_imports",
        *BASE_COLS,
        sa.Column("import_no",            sa.String(80),   nullable=False, unique=True),
        sa.Column("customer_id",          sa.String(50),   sa.ForeignKey("customers.id",              ondelete="RESTRICT"), nullable=False),
        sa.Column("channel_location_id",  sa.String(50),   sa.ForeignKey("scdm_channel_locations.id", ondelete="SET NULL"), nullable=True),
        sa.Column("import_source",        sa.String(30),   nullable=False, server_default=sa.text("'Manual'")),
        sa.Column("import_date",          sa.Date,         nullable=False),
        sa.Column("period_from",          sa.Date,         nullable=True),
        sa.Column("period_to",            sa.Date,         nullable=True),
        sa.Column("status",               sa.String(20),   nullable=False, server_default=sa.text("'Pending'")),
        sa.Column("file_name",            sa.String(512),  nullable=True),
        sa.Column("file_path",            sa.String(512),  nullable=True),
        sa.Column("total_lines",          sa.Integer,      nullable=False, server_default=sa.text("0")),
        sa.Column("accepted_lines",       sa.Integer,      nullable=False, server_default=sa.text("0")),
        sa.Column("rejected_lines",       sa.Integer,      nullable=False, server_default=sa.text("0")),
        sa.Column("duplicate_lines",      sa.Integer,      nullable=False, server_default=sa.text("0")),
        sa.Column("error_summary",        postgresql.JSONB,server_default=sa.text("'[]'::jsonb")),
        sa.Column("imported_by_user_id",  sa.String(50),   nullable=True),
        sa.Column("processed_at",         sa.DateTime(timezone=True), nullable=True),
        sa.Column("notes",                sa.Text,         nullable=True),
        comment="SCDM: Sell-out import job (Excel/CSV/API/EDI/POS/FTP/Webhook)"
    )
    op.create_index("ix_scdm_import_customer_date", "scdm_sellout_imports", ["customer_id", "import_date"])
    op.create_index("ix_scdm_import_status",        "scdm_sellout_imports", ["status"])

    # ──────────────────────────────────────────────────────────────────────────
    # STEP 7 — scdm_sellout_import_lines (barcode → product mapping lines)
    # ──────────────────────────────────────────────────────────────────────────
    op.create_table(
        "scdm_sellout_import_lines",
        sa.Column("id",               sa.String(50),   primary_key=True),
        sa.Column("uuid",             sa.String(36),   nullable=False, unique=True),
        sa.Column("tenant_id",        sa.String(50),   nullable=True),
        sa.Column("created_at",       sa.DateTime(timezone=True), nullable=True),
        sa.Column("import_id",        sa.String(50),   sa.ForeignKey("scdm_sellout_imports.id", ondelete="CASCADE"), nullable=False),
        sa.Column("product_id",       sa.String(50),   sa.ForeignKey("products.id",             ondelete="SET NULL"), nullable=True),
        sa.Column("source_barcode",   sa.String(100),  nullable=True),
        sa.Column("source_sku",       sa.String(100),  nullable=True),
        sa.Column("source_item_name", sa.String(255),  nullable=True),
        sa.Column("batch_no",         sa.String(50),   nullable=True),
        sa.Column("qty_sold",         sa.Numeric(12,4),nullable=False, server_default=sa.text("0")),
        sa.Column("mrp",              sa.Numeric(15,2),nullable=True),
        sa.Column("selling_price",    sa.Numeric(15,2),nullable=True),
        sa.Column("sales_value",      sa.Numeric(15,2),nullable=True),
        sa.Column("transaction_date", sa.Date,         nullable=True),
        sa.Column("line_status",      sa.String(20),   nullable=False, server_default=sa.text("'Pending'")),
        sa.Column("error_message",    sa.String(500),  nullable=True),
        sa.Column("movement_id",      sa.String(50),   nullable=True),
        comment="SCDM: Individual sell-out import line with barcode/SKU mapping"
    )
    op.create_index("ix_scdm_import_line_import",  "scdm_sellout_import_lines", ["import_id"])
    op.create_index("ix_scdm_import_line_status",  "scdm_sellout_import_lines", ["import_id", "line_status"])
    op.create_index("ix_scdm_import_line_product", "scdm_sellout_import_lines", ["product_id"])

    # ──────────────────────────────────────────────────────────────────────────
    # STEP 8 — soft FK backfill: movements → sellout_imports
    # ──────────────────────────────────────────────────────────────────────────
    conn.execute(sa.text("""
        ALTER TABLE scdm_channel_stock_movements
            ADD CONSTRAINT fk_scdm_movement_sellout_import
            FOREIGN KEY (sellout_import_id)
            REFERENCES scdm_sellout_imports (id)
            ON DELETE SET NULL;
    """))

    # ──────────────────────────────────────────────────────────────────────────
    # STEP 9 — Projection VIEW (not a table — computed from movements)
    #
    # v_scdm_stock_projection returns current channel stock per
    # customer + channel_location + product derived purely from the
    # immutable ChannelStockMovement ledger.
    # ──────────────────────────────────────────────────────────────────────────
    conn.execute(sa.text("""
        CREATE OR REPLACE VIEW v_scdm_stock_projection AS
        SELECT
            customer_id,
            channel_location_id,
            product_id,
            tenant_id,
            company_id,
            branch_id,
            SUM(qty)              AS current_qty,
            SUM(mrp_value)        AS current_mrp_value,
            SUM(cost_value)       AS current_cost_value,
            SUM(sales_value)      AS current_sales_value,
            SUM(settlement_value) AS current_settlement_value,
            -- Dispatch total (positive movements of type Dispatch)
            SUM(CASE WHEN movement_type = 'Dispatch'
                     THEN qty ELSE 0 END)       AS total_dispatched,
            -- Sell-out total (negative movements of type SellOut, stored as negative qty)
            SUM(CASE WHEN movement_type = 'SellOut'
                     THEN ABS(qty) ELSE 0 END)  AS total_sellout,
            -- Return total
            SUM(CASE WHEN movement_type = 'Return'
                     THEN qty ELSE 0 END)        AS total_returned,
            -- Damage total
            SUM(CASE WHEN movement_type = 'Damage'
                     THEN ABS(qty) ELSE 0 END)  AS total_damaged,
            MAX(movement_date)    AS last_movement_date,
            MIN(CASE WHEN movement_type = 'Dispatch'
                     THEN movement_date END)     AS first_dispatch_date,
            -- Ageing in days from first dispatch
            CURRENT_DATE - MIN(CASE WHEN movement_type = 'Dispatch'
                                    THEN movement_date END) AS ageing_days
        FROM scdm_channel_stock_movements
        WHERE is_deleted = FALSE
        GROUP BY customer_id, channel_location_id, product_id,
                 tenant_id, company_id, branch_id;
    """))


def downgrade() -> None:
    conn = op.get_bind()

    # Reverse in dependency order
    conn.execute(sa.text("DROP VIEW IF EXISTS v_scdm_stock_projection;"))

    conn.execute(sa.text("""
        ALTER TABLE scdm_channel_stock_movements
            DROP CONSTRAINT IF EXISTS fk_scdm_movement_sellout_import;
    """))

    op.drop_table("scdm_sellout_import_lines")
    op.drop_table("scdm_sellout_imports")
    op.drop_table("scdm_channel_stock_movements")
    op.drop_table("scdm_channel_dispatch_lines")
    op.drop_table("scdm_channel_dispatches")
    op.drop_table("scdm_channel_locations")

    conn.execute(sa.text("""
        ALTER TABLE customers
            DROP COLUMN IF EXISTS channel_tracking_enabled,
            DROP COLUMN IF EXISTS supply_model,
            DROP COLUMN IF EXISTS sellout_source;
    """))
