"""
v710_sales_invoicing_engine.py — Alembic Migration DDL for Phase 10 (v7.1.0)
Outbound Customer Sales Invoicing & Multi-Channel Payment Settlement Engine.

Revision ID: v710_sales_invoicing_engine
Revises: v700_sales_fulfillment
Create Date: 2026-07-21
"""

from alembic import op
import sqlalchemy as sa

revision = 'v710_sales_invoicing_engine'
down_revision = 'v700_sales_fulfillment'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Ensure sales_invoices table and all BaseEntity columns exist
    op.execute("""
    CREATE TABLE IF NOT EXISTS sales_invoices (
        id VARCHAR(50) PRIMARY KEY,
        uuid VARCHAR(36) NOT NULL UNIQUE
    );
    """)
    op.execute("ALTER TABLE sales_invoices ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(50)")
    op.execute("ALTER TABLE sales_invoices ADD COLUMN IF NOT EXISTS company_id VARCHAR(50) REFERENCES companies(id) ON DELETE RESTRICT")
    op.execute("ALTER TABLE sales_invoices ADD COLUMN IF NOT EXISTS branch_id VARCHAR(50) REFERENCES branches(id) ON DELETE RESTRICT")
    op.execute("ALTER TABLE sales_invoices ADD COLUMN IF NOT EXISTS invoice_no VARCHAR(100)")
    op.execute("ALTER TABLE sales_invoices ADD COLUMN IF NOT EXISTS order_id VARCHAR(50) REFERENCES sales_orders(id) ON DELETE RESTRICT")
    op.execute("ALTER TABLE sales_invoices ADD COLUMN IF NOT EXISTS customer_id VARCHAR(50) REFERENCES customers(id) ON DELETE RESTRICT")
    op.execute("ALTER TABLE sales_invoices ADD COLUMN IF NOT EXISTS invoice_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP")
    op.execute("ALTER TABLE sales_invoices ADD COLUMN IF NOT EXISTS due_date TIMESTAMP WITH TIME ZONE")
    op.execute("ALTER TABLE sales_invoices ADD COLUMN IF NOT EXISTS subtotal NUMERIC(15, 2) DEFAULT '0.00' NOT NULL")
    op.execute("ALTER TABLE sales_invoices ADD COLUMN IF NOT EXISTS tax_total NUMERIC(15, 2) DEFAULT '0.00' NOT NULL")
    op.execute("ALTER TABLE sales_invoices ADD COLUMN IF NOT EXISTS cgst_amount NUMERIC(15, 2) DEFAULT '0.00' NOT NULL")
    op.execute("ALTER TABLE sales_invoices ADD COLUMN IF NOT EXISTS sgst_amount NUMERIC(15, 2) DEFAULT '0.00' NOT NULL")
    op.execute("ALTER TABLE sales_invoices ADD COLUMN IF NOT EXISTS igst_amount NUMERIC(15, 2) DEFAULT '0.00' NOT NULL")
    op.execute("ALTER TABLE sales_invoices ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(15, 2) DEFAULT '0.00' NOT NULL")
    op.execute("ALTER TABLE sales_invoices ADD COLUMN IF NOT EXISTS grand_total NUMERIC(15, 2) DEFAULT '0.00' NOT NULL")
    op.execute("ALTER TABLE sales_invoices ADD COLUMN IF NOT EXISTS paid_amount NUMERIC(15, 2) DEFAULT '0.00' NOT NULL")
    op.execute("ALTER TABLE sales_invoices ADD COLUMN IF NOT EXISTS balance_due NUMERIC(15, 2) DEFAULT '0.00' NOT NULL")
    op.execute("ALTER TABLE sales_invoices ADD COLUMN IF NOT EXISTS status VARCHAR(30) DEFAULT 'Unpaid' NOT NULL")
    op.execute("ALTER TABLE sales_invoices ADD COLUMN IF NOT EXISTS notes TEXT")
    op.execute("ALTER TABLE sales_invoices ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL")
    op.execute("ALTER TABLE sales_invoices ADD COLUMN IF NOT EXISTS modified_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL")
    op.execute("ALTER TABLE sales_invoices ADD COLUMN IF NOT EXISTS created_by VARCHAR(50)")
    op.execute("ALTER TABLE sales_invoices ADD COLUMN IF NOT EXISTS updated_by VARCHAR(50)")
    op.execute("ALTER TABLE sales_invoices ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true NOT NULL")
    op.execute("ALTER TABLE sales_invoices ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false NOT NULL")
    op.execute("ALTER TABLE sales_invoices ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE")
    op.execute("ALTER TABLE sales_invoices ADD COLUMN IF NOT EXISTS deleted_by VARCHAR(50)")
    op.execute("ALTER TABLE sales_invoices ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1 NOT NULL")
    op.execute("ALTER TABLE sales_invoices ADD COLUMN IF NOT EXISTS workflow_status VARCHAR(50)")
    op.execute("ALTER TABLE sales_invoices ADD COLUMN IF NOT EXISTS document_number VARCHAR(100)")

    # 2. Ensure sales_invoice_items table and all BaseEntity columns exist
    op.execute("""
    CREATE TABLE IF NOT EXISTS sales_invoice_items (
        id VARCHAR(50) PRIMARY KEY,
        uuid VARCHAR(36) NOT NULL UNIQUE
    );
    """)
    op.execute("ALTER TABLE sales_invoice_items ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(50)")
    op.execute("ALTER TABLE sales_invoice_items ADD COLUMN IF NOT EXISTS company_id VARCHAR(50) REFERENCES companies(id) ON DELETE RESTRICT")
    op.execute("ALTER TABLE sales_invoice_items ADD COLUMN IF NOT EXISTS branch_id VARCHAR(50) REFERENCES branches(id) ON DELETE RESTRICT")
    op.execute("ALTER TABLE sales_invoice_items ADD COLUMN IF NOT EXISTS invoice_id VARCHAR(50) REFERENCES sales_invoices(id) ON DELETE CASCADE")
    op.execute("ALTER TABLE sales_invoice_items ADD COLUMN IF NOT EXISTS product_id VARCHAR(50) REFERENCES products(id) ON DELETE RESTRICT")
    op.execute("ALTER TABLE sales_invoice_items ADD COLUMN IF NOT EXISTS quantity NUMERIC(12, 4) DEFAULT '1.0000' NOT NULL")
    op.execute("ALTER TABLE sales_invoice_items ADD COLUMN IF NOT EXISTS unit_price NUMERIC(15, 2) DEFAULT '0.00' NOT NULL")
    op.execute("ALTER TABLE sales_invoice_items ADD COLUMN IF NOT EXISTS gst_percentage NUMERIC(5, 2) DEFAULT '0.00' NOT NULL")
    op.execute("ALTER TABLE sales_invoice_items ADD COLUMN IF NOT EXISTS cgst_amount NUMERIC(15, 2) DEFAULT '0.00' NOT NULL")
    op.execute("ALTER TABLE sales_invoice_items ADD COLUMN IF NOT EXISTS sgst_amount NUMERIC(15, 2) DEFAULT '0.00' NOT NULL")
    op.execute("ALTER TABLE sales_invoice_items ADD COLUMN IF NOT EXISTS igst_amount NUMERIC(15, 2) DEFAULT '0.00' NOT NULL")
    op.execute("ALTER TABLE sales_invoice_items ADD COLUMN IF NOT EXISTS line_total NUMERIC(15, 2) DEFAULT '0.00' NOT NULL")
    op.execute("ALTER TABLE sales_invoice_items ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL")
    op.execute("ALTER TABLE sales_invoice_items ADD COLUMN IF NOT EXISTS modified_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL")
    op.execute("ALTER TABLE sales_invoice_items ADD COLUMN IF NOT EXISTS created_by VARCHAR(50)")
    op.execute("ALTER TABLE sales_invoice_items ADD COLUMN IF NOT EXISTS updated_by VARCHAR(50)")
    op.execute("ALTER TABLE sales_invoice_items ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true NOT NULL")
    op.execute("ALTER TABLE sales_invoice_items ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false NOT NULL")
    op.execute("ALTER TABLE sales_invoice_items ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE")
    op.execute("ALTER TABLE sales_invoice_items ADD COLUMN IF NOT EXISTS deleted_by VARCHAR(50)")
    op.execute("ALTER TABLE sales_invoice_items ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1 NOT NULL")
    op.execute("ALTER TABLE sales_invoice_items ADD COLUMN IF NOT EXISTS workflow_status VARCHAR(50)")
    op.execute("ALTER TABLE sales_invoice_items ADD COLUMN IF NOT EXISTS document_number VARCHAR(100)")

    # 3. Create sales_payments table
    op.execute("""
    CREATE TABLE IF NOT EXISTS sales_payments (
        id VARCHAR(50) PRIMARY KEY,
        uuid VARCHAR(36) NOT NULL UNIQUE,
        tenant_id VARCHAR(50),
        company_id VARCHAR(50) REFERENCES companies(id) ON DELETE RESTRICT,
        branch_id VARCHAR(50) REFERENCES branches(id) ON DELETE RESTRICT,
        payment_no VARCHAR(100) NOT NULL UNIQUE,
        invoice_id VARCHAR(50) REFERENCES sales_invoices(id) ON DELETE RESTRICT NOT NULL,
        customer_id VARCHAR(50) REFERENCES customers(id) ON DELETE RESTRICT NOT NULL,
        payment_date TIMESTAMP WITH TIME ZONE NOT NULL,
        payment_mode VARCHAR(30) NOT NULL,
        amount NUMERIC(15, 2) NOT NULL,
        reference_no VARCHAR(100),
        notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
        modified_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
        created_by VARCHAR(50),
        updated_by VARCHAR(50),
        is_active BOOLEAN DEFAULT true NOT NULL,
        is_deleted BOOLEAN DEFAULT false NOT NULL,
        deleted_at TIMESTAMP WITH TIME ZONE,
        deleted_by VARCHAR(50),
        version INTEGER DEFAULT 1 NOT NULL,
        workflow_status VARCHAR(50),
        document_number VARCHAR(100)
    );
    """)


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS sales_payments CASCADE;")
    op.execute("DROP TABLE IF EXISTS sales_invoice_items CASCADE;")
    op.execute("DROP TABLE IF EXISTS sales_invoices CASCADE;")
