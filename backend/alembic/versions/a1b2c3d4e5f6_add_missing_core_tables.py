"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.14.4
Created      : 2026-07-11
Modified     : 2026-07-11
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software

add_missing_core_tables

Revision ID: a1b2c3d4e5f6
Revises: 12b68ccebec7
Create Date: 2026-07-11 21:56:00.000000

This migration creates all core tables that were previously managed
by the Node.js schema.sql DDL file, allowing safe removal of that
file and full unification of schema management under Alembic.

Tables created (idempotently via CREATE TABLE IF NOT EXISTS):
  - customer_groups
  - customers
  - products
  - pos_profiles
  - shifts (legacy Node schema - profile-based)
  - sales_invoices
  - sales_invoice_items
  - psv_parties
  - psv_sku_tracking
  - audit_logs
  - sync_queue
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create all core tables idempotently (tables that were previously
    managed by schema.sql in the Node.js Express server)."""

    op.execute("CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";")

    # ── 1. customer_groups ─────────────────────────────────────────────────────
    op.execute("""
        CREATE TABLE IF NOT EXISTS customer_groups (
            id                         VARCHAR(50)   PRIMARY KEY,
            name                       VARCHAR(100)  NOT NULL UNIQUE,
            credit_limit               NUMERIC(15,2) DEFAULT 0.00,
            unlimited_credit           BOOLEAN       DEFAULT FALSE,
            credit_days                INT           DEFAULT 0,
            grace_days                 INT           DEFAULT 0,
            credit_hold                BOOLEAN       DEFAULT FALSE,
            auto_block_sales           BOOLEAN       DEFAULT TRUE,
            warning_threshold_percent  NUMERIC(5,2)  DEFAULT 80.00,
            allow_override             BOOLEAN       DEFAULT FALSE,
            tax_inclusive              BOOLEAN       DEFAULT TRUE,
            max_discount_percent       NUMERIC(5,2)  DEFAULT 0.00,
            min_margin_percent         NUMERIC(5,2)  DEFAULT 0.00,
            rounding_rule              VARCHAR(30)   DEFAULT 'Nearest1',
            allowed_payment_methods    TEXT[]        DEFAULT '{}',
            preferred_payment_method   VARCHAR(50),
            allow_back_orders          BOOLEAN       DEFAULT FALSE,
            allow_negative_stock_sales BOOLEAN       DEFAULT FALSE,
            require_po_number          BOOLEAN       DEFAULT FALSE,
            invoice_language           VARCHAR(10)   DEFAULT 'en',
            can_view_price             BOOLEAN       DEFAULT TRUE,
            can_view_margin            BOOLEAN       DEFAULT FALSE,
            can_purchase_on_credit     BOOLEAN       DEFAULT FALSE,
            can_receive_discount       BOOLEAN       DEFAULT TRUE,
            created_at                 TIMESTAMPTZ   DEFAULT CURRENT_TIMESTAMP,
            modified_at                TIMESTAMPTZ   DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # ── 2. customers ───────────────────────────────────────────────────────────
    op.execute("""
        CREATE TABLE IF NOT EXISTS customers (
            id                VARCHAR(50)   PRIMARY KEY,
            customer_group_id VARCHAR(50)   REFERENCES customer_groups(id) ON DELETE RESTRICT,
            name              VARCHAR(255)  NOT NULL,
            mobile            VARCHAR(20),
            email             VARCHAR(255),
            gst_number        VARCHAR(15),
            outstanding       NUMERIC(15,2) DEFAULT 0.00,
            status            VARCHAR(20)   DEFAULT 'Active',
            created_date      DATE          DEFAULT CURRENT_DATE,
            tags              TEXT[]        DEFAULT '{}',
            created_at        TIMESTAMPTZ   DEFAULT CURRENT_TIMESTAMP,
            modified_at       TIMESTAMPTZ   DEFAULT CURRENT_TIMESTAMP
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS idx_customers_group  ON customers(customer_group_id)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_customers_mobile ON customers(mobile)")

    # ── 3. products ────────────────────────────────────────────────────────────
    op.execute("""
        CREATE TABLE IF NOT EXISTS products (
            id                  VARCHAR(50)   PRIMARY KEY,
            code                VARCHAR(50)   NOT NULL UNIQUE,
            name                VARCHAR(255)  NOT NULL,
            price               NUMERIC(15,2) NOT NULL DEFAULT 0.00,
            stock               INT           NOT NULL DEFAULT 0,
            category            VARCHAR(100)  NOT NULL,
            is_favorite         BOOLEAN       DEFAULT FALSE,
            barcode             VARCHAR(100)  NOT NULL UNIQUE,
            secondary_barcodes  TEXT[]        DEFAULT '{}',
            brand               VARCHAR(100),
            color               VARCHAR(50),
            size                VARCHAR(50),
            mrp                 NUMERIC(15,2),
            gst_percentage      NUMERIC(5,2)  DEFAULT 18.00,
            style_code          VARCHAR(100),
            cost_price          NUMERIC(15,2),
            sku                 VARCHAR(100)  UNIQUE,
            hsn_code            VARCHAR(15),
            pricing_mode        VARCHAR(30)   DEFAULT 'Fixed',
            tracking_mode       VARCHAR(30)   DEFAULT 'Standard',
            variant_template_id VARCHAR(50),
            weight_grams        NUMERIC(10,2) DEFAULT 0.00,
            attributes          JSONB         DEFAULT '{}'::jsonb,
            created_at          TIMESTAMPTZ   DEFAULT CURRENT_TIMESTAMP,
            modified_at         TIMESTAMPTZ   DEFAULT CURRENT_TIMESTAMP
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS idx_products_attributes ON products USING GIN (attributes)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_products_category   ON products(category)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_products_barcode    ON products(barcode)")

    # ── 4. pos_profiles ────────────────────────────────────────────────────────
    op.execute("""
        CREATE TABLE IF NOT EXISTS pos_profiles (
            id          VARCHAR(50)  PRIMARY KEY,
            name        VARCHAR(100) NOT NULL UNIQUE,
            cashier     VARCHAR(255) NOT NULL,
            warehouse   VARCHAR(255) NOT NULL,
            is_locked   BOOLEAN      DEFAULT FALSE,
            is_archived BOOLEAN      DEFAULT FALSE,
            created_at  TIMESTAMPTZ  DEFAULT CURRENT_TIMESTAMP,
            modified_at TIMESTAMPTZ  DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # ── 5. legacy shifts (profile-based, used by Node API) ─────────────────────
    # Note: the Alembic POS migration (cc8a527deb42) creates a newer
    # cash_registers-based shifts table. This creates the legacy one only
    # if no shifts table exists yet.
    op.execute("""
        CREATE TABLE IF NOT EXISTS legacy_pos_shifts (
            id               VARCHAR(50)   PRIMARY KEY,
            profile_id       VARCHAR(50)   REFERENCES pos_profiles(id) ON DELETE RESTRICT,
            opened_at        TIMESTAMPTZ   NOT NULL DEFAULT CURRENT_TIMESTAMP,
            closed_at        TIMESTAMPTZ,
            opening_balance  NUMERIC(15,2) NOT NULL DEFAULT 0.00,
            closing_balance  NUMERIC(15,2),
            sales_count      INT           DEFAULT 0,
            sales_value      NUMERIC(15,2) DEFAULT 0.00,
            status           VARCHAR(20)   DEFAULT 'Open',
            created_at       TIMESTAMPTZ   DEFAULT CURRENT_TIMESTAMP,
            modified_at      TIMESTAMPTZ   DEFAULT CURRENT_TIMESTAMP
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS idx_legacy_shifts_profile ON legacy_pos_shifts(profile_id)")

    # ── 6. sales_invoices ──────────────────────────────────────────────────────
    op.execute("""
        CREATE TABLE IF NOT EXISTS sales_invoices (
            id           VARCHAR(50)   PRIMARY KEY,
            invoice_no   VARCHAR(100)  NOT NULL UNIQUE,
            date         DATE          NOT NULL DEFAULT CURRENT_DATE,
            customer_id  VARCHAR(50)   REFERENCES customers(id) ON DELETE RESTRICT,
            tax_total    NUMERIC(15,2) DEFAULT 0.00,
            grand_total  NUMERIC(15,2) NOT NULL DEFAULT 0.00,
            is_interstate BOOLEAN      DEFAULT FALSE,
            eway_bill_no VARCHAR(50),
            status       VARCHAR(20)   DEFAULT 'Draft',
            created_at   TIMESTAMPTZ   DEFAULT CURRENT_TIMESTAMP,
            modified_at  TIMESTAMPTZ   DEFAULT CURRENT_TIMESTAMP
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS idx_sales_invoice_customer ON sales_invoices(customer_id)")

    # ── 7. sales_invoice_items ─────────────────────────────────────────────────
    op.execute("""
        CREATE TABLE IF NOT EXISTS sales_invoice_items (
            id          SERIAL        PRIMARY KEY,
            invoice_id  VARCHAR(50)   REFERENCES sales_invoices(id) ON DELETE CASCADE,
            product_id  VARCHAR(50)   REFERENCES products(id) ON DELETE RESTRICT,
            code        VARCHAR(50)   NOT NULL,
            name        VARCHAR(255)  NOT NULL,
            quantity    NUMERIC(12,4) NOT NULL DEFAULT 1.00,
            price       NUMERIC(15,2) NOT NULL,
            hsn_code    VARCHAR(15),
            gst_rate    NUMERIC(5,2)  DEFAULT 18.00,
            tax_amount  NUMERIC(15,2) DEFAULT 0.00,
            total_amount NUMERIC(15,2) NOT NULL
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS idx_sales_invoice_item_invoice ON sales_invoice_items(invoice_id)")

    # ── 8. psv_parties ─────────────────────────────────────────────────────────
    op.execute("""
        CREATE TABLE IF NOT EXISTS psv_parties (
            id              VARCHAR(50)   PRIMARY KEY,
            name            VARCHAR(255)  NOT NULL,
            location        VARCHAR(255)  NOT NULL,
            stock_count     INT           DEFAULT 0,
            sell_through    NUMERIC(5,2)  DEFAULT 0.00,
            weeks_of_cover  NUMERIC(5,2)  DEFAULT 0.00,
            capital_locked  NUMERIC(15,2) DEFAULT 0.00,
            status          VARCHAR(20)   DEFAULT 'Healthy',
            created_at      TIMESTAMPTZ   DEFAULT CURRENT_TIMESTAMP,
            modified_at     TIMESTAMPTZ   DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # ── 9. psv_sku_tracking ────────────────────────────────────────────────────
    op.execute("""
        CREATE TABLE IF NOT EXISTS psv_sku_tracking (
            id                  SERIAL      PRIMARY KEY,
            party_id            VARCHAR(50) REFERENCES psv_parties(id) ON DELETE CASCADE,
            product_id          VARCHAR(50) REFERENCES products(id) ON DELETE RESTRICT,
            sku                 VARCHAR(100) NOT NULL,
            invoiced_qty        INT         DEFAULT 0,
            confirmed_sold_qty  INT         DEFAULT 0,
            returned_qty        INT         DEFAULT 0,
            lying_stock         INT         GENERATED ALWAYS AS (
                GREATEST(0, invoiced_qty - confirmed_sold_qty - returned_qty)
            ) STORED,
            sell_through_pct    NUMERIC(5,2) GENERATED ALWAYS AS (
                CASE WHEN invoiced_qty <= 0 THEN 0.00
                ELSE LEAST(100.00, (confirmed_sold_qty::numeric / invoiced_qty::numeric) * 100.00)
                END
            ) STORED
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS idx_psv_sku_lookup   ON psv_sku_tracking (party_id, sku)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_psv_lying_stock  ON psv_sku_tracking (lying_stock)")

    # ── 10. audit_logs ─────────────────────────────────────────────────────────
    op.execute("""
        CREATE TABLE IF NOT EXISTS audit_logs (
            id           SERIAL      PRIMARY KEY,
            operator     VARCHAR(255) NOT NULL,
            action_type  VARCHAR(20)  NOT NULL,
            table_name   VARCHAR(100) NOT NULL,
            record_id    VARCHAR(100) NOT NULL,
            old_value    JSONB,
            new_value    JSONB,
            client_ip    VARCHAR(50),
            machine_info TEXT,
            reason       TEXT,
            created_at   TIMESTAMPTZ  DEFAULT CURRENT_TIMESTAMP
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS idx_audit_operator ON audit_logs(operator)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_audit_table    ON audit_logs(table_name, record_id)")

    # ── 11. sync_queue ─────────────────────────────────────────────────────────
    op.execute("""
        CREATE TABLE IF NOT EXISTS sync_queue (
            id           SERIAL       PRIMARY KEY,
            uuid         VARCHAR(100) NOT NULL UNIQUE,
            module       VARCHAR(100) NOT NULL,
            operation    VARCHAR(100) NOT NULL,
            entity       VARCHAR(100) NOT NULL,
            payload      JSONB        NOT NULL,
            status       VARCHAR(20)  DEFAULT 'pending',
            retry_count  INT          DEFAULT 0,
            created_at   TIMESTAMPTZ  DEFAULT CURRENT_TIMESTAMP,
            updated_at   TIMESTAMPTZ  DEFAULT CURRENT_TIMESTAMP,
            last_attempt TIMESTAMPTZ,
            device_id    VARCHAR(100),
            company_id   VARCHAR(100),
            branch_id    VARCHAR(100)
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS idx_sync_status ON sync_queue (status)")


def downgrade() -> None:
    """Drop tables added by this migration in reverse dependency order."""
    op.execute("DROP TABLE IF EXISTS sync_queue")
    op.execute("DROP TABLE IF EXISTS audit_logs")
    op.execute("DROP TABLE IF EXISTS psv_sku_tracking")
    op.execute("DROP TABLE IF EXISTS psv_parties")
    op.execute("DROP TABLE IF EXISTS sales_invoice_items")
    op.execute("DROP TABLE IF EXISTS sales_invoices")
    op.execute("DROP TABLE IF EXISTS legacy_pos_shifts")
    op.execute("DROP TABLE IF EXISTS pos_profiles")
    op.execute("DROP TABLE IF EXISTS products")
    op.execute("DROP TABLE IF EXISTS customers")
    op.execute("DROP TABLE IF EXISTS customer_groups")
