"""
v720_sales_return_credit_note.py — Alembic Migration DDL for Phase 11 (v7.2.0)
Outbound Customer Sales Returns & Credit Note Engine.

Revision ID: v720_sales_return_credit_note
Revises: v710_sales_invoicing_engine
Create Date: 2026-07-21
"""

from alembic import op
import sqlalchemy as sa

revision = 'v720_sales_return_credit_note'
down_revision = 'v710_sales_invoicing_engine'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Ensure sales_returns table and all columns exist
    op.execute("""
    CREATE TABLE IF NOT EXISTS sales_returns (
        id VARCHAR(50) PRIMARY KEY,
        uuid VARCHAR(36) NOT NULL UNIQUE
    );
    """)
    op.execute("ALTER TABLE sales_returns ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(50)")
    op.execute("ALTER TABLE sales_returns ADD COLUMN IF NOT EXISTS company_id VARCHAR(50) REFERENCES companies(id) ON DELETE RESTRICT")
    op.execute("ALTER TABLE sales_returns ADD COLUMN IF NOT EXISTS branch_id VARCHAR(50) REFERENCES branches(id) ON DELETE RESTRICT")
    op.execute("ALTER TABLE sales_returns ADD COLUMN IF NOT EXISTS return_no VARCHAR(100)")
    op.execute("ALTER TABLE sales_returns ADD COLUMN IF NOT EXISTS invoice_id VARCHAR(50) REFERENCES sales_invoices(id) ON DELETE RESTRICT")
    op.execute("ALTER TABLE sales_returns ADD COLUMN IF NOT EXISTS customer_id VARCHAR(50) REFERENCES customers(id) ON DELETE RESTRICT")
    op.execute("ALTER TABLE sales_returns ADD COLUMN IF NOT EXISTS return_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP")
    op.execute("ALTER TABLE sales_returns ADD COLUMN IF NOT EXISTS reason TEXT")
    op.execute("ALTER TABLE sales_returns ADD COLUMN IF NOT EXISTS status VARCHAR(30) DEFAULT 'Draft' NOT NULL")
    op.execute("ALTER TABLE sales_returns ADD COLUMN IF NOT EXISTS refund_amount NUMERIC(15, 2) DEFAULT '0.00' NOT NULL")
    op.execute("ALTER TABLE sales_returns ADD COLUMN IF NOT EXISTS credit_note_id VARCHAR(50)")
    op.execute("ALTER TABLE sales_returns ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL")
    op.execute("ALTER TABLE sales_returns ADD COLUMN IF NOT EXISTS modified_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL")
    op.execute("ALTER TABLE sales_returns ADD COLUMN IF NOT EXISTS created_by VARCHAR(50)")
    op.execute("ALTER TABLE sales_returns ADD COLUMN IF NOT EXISTS updated_by VARCHAR(50)")
    op.execute("ALTER TABLE sales_returns ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true NOT NULL")
    op.execute("ALTER TABLE sales_returns ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false NOT NULL")
    op.execute("ALTER TABLE sales_returns ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE")
    op.execute("ALTER TABLE sales_returns ADD COLUMN IF NOT EXISTS deleted_by VARCHAR(50)")
    op.execute("ALTER TABLE sales_returns ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1 NOT NULL")
    op.execute("ALTER TABLE sales_returns ADD COLUMN IF NOT EXISTS workflow_status VARCHAR(50)")
    op.execute("ALTER TABLE sales_returns ADD COLUMN IF NOT EXISTS document_number VARCHAR(100)")

    # 2. Ensure sales_return_items table and all columns exist
    op.execute("""
    CREATE TABLE IF NOT EXISTS sales_return_items (
        id VARCHAR(50) PRIMARY KEY,
        uuid VARCHAR(36) NOT NULL UNIQUE
    );
    """)
    op.execute("ALTER TABLE sales_return_items ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(50)")
    op.execute("ALTER TABLE sales_return_items ADD COLUMN IF NOT EXISTS company_id VARCHAR(50) REFERENCES companies(id) ON DELETE RESTRICT")
    op.execute("ALTER TABLE sales_return_items ADD COLUMN IF NOT EXISTS branch_id VARCHAR(50) REFERENCES branches(id) ON DELETE RESTRICT")
    op.execute("ALTER TABLE sales_return_items ADD COLUMN IF NOT EXISTS return_id VARCHAR(50) REFERENCES sales_returns(id) ON DELETE CASCADE")
    op.execute("ALTER TABLE sales_return_items ADD COLUMN IF NOT EXISTS product_id VARCHAR(50) REFERENCES products(id) ON DELETE RESTRICT")
    op.execute("ALTER TABLE sales_return_items ADD COLUMN IF NOT EXISTS quantity NUMERIC(12, 4) DEFAULT '1.0000' NOT NULL")
    op.execute("ALTER TABLE sales_return_items ADD COLUMN IF NOT EXISTS unit_price NUMERIC(15, 2) DEFAULT '0.00' NOT NULL")
    op.execute("ALTER TABLE sales_return_items ADD COLUMN IF NOT EXISTS condition VARCHAR(30) DEFAULT 'Restockable' NOT NULL")
    op.execute("ALTER TABLE sales_return_items ADD COLUMN IF NOT EXISTS gst_percentage NUMERIC(5, 2) DEFAULT '0.00' NOT NULL")
    op.execute("ALTER TABLE sales_return_items ADD COLUMN IF NOT EXISTS cgst_amount NUMERIC(15, 2) DEFAULT '0.00' NOT NULL")
    op.execute("ALTER TABLE sales_return_items ADD COLUMN IF NOT EXISTS sgst_amount NUMERIC(15, 2) DEFAULT '0.00' NOT NULL")
    op.execute("ALTER TABLE sales_return_items ADD COLUMN IF NOT EXISTS igst_amount NUMERIC(15, 2) DEFAULT '0.00' NOT NULL")
    op.execute("ALTER TABLE sales_return_items ADD COLUMN IF NOT EXISTS line_total NUMERIC(15, 2) DEFAULT '0.00' NOT NULL")
    op.execute("ALTER TABLE sales_return_items ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL")
    op.execute("ALTER TABLE sales_return_items ADD COLUMN IF NOT EXISTS modified_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL")
    op.execute("ALTER TABLE sales_return_items ADD COLUMN IF NOT EXISTS created_by VARCHAR(50)")
    op.execute("ALTER TABLE sales_return_items ADD COLUMN IF NOT EXISTS updated_by VARCHAR(50)")
    op.execute("ALTER TABLE sales_return_items ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true NOT NULL")
    op.execute("ALTER TABLE sales_return_items ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false NOT NULL")
    op.execute("ALTER TABLE sales_return_items ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE")
    op.execute("ALTER TABLE sales_return_items ADD COLUMN IF NOT EXISTS deleted_by VARCHAR(50)")
    op.execute("ALTER TABLE sales_return_items ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1 NOT NULL")
    op.execute("ALTER TABLE sales_return_items ADD COLUMN IF NOT EXISTS workflow_status VARCHAR(50)")
    op.execute("ALTER TABLE sales_return_items ADD COLUMN IF NOT EXISTS document_number VARCHAR(100)")

    # 3. Create credit_notes table
    op.execute("""
    CREATE TABLE IF NOT EXISTS credit_notes (
        id VARCHAR(50) PRIMARY KEY,
        uuid VARCHAR(36) NOT NULL UNIQUE,
        tenant_id VARCHAR(50),
        company_id VARCHAR(50) REFERENCES companies(id) ON DELETE RESTRICT,
        branch_id VARCHAR(50) REFERENCES branches(id) ON DELETE RESTRICT,
        credit_note_no VARCHAR(100) NOT NULL UNIQUE,
        return_id VARCHAR(50) REFERENCES sales_returns(id) ON DELETE RESTRICT NOT NULL,
        invoice_id VARCHAR(50) REFERENCES sales_invoices(id) ON DELETE RESTRICT NOT NULL,
        customer_id VARCHAR(50) REFERENCES customers(id) ON DELETE RESTRICT NOT NULL,
        issue_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
        subtotal NUMERIC(15, 2) DEFAULT '0.00' NOT NULL,
        tax_amount NUMERIC(15, 2) DEFAULT '0.00' NOT NULL,
        cgst_amount NUMERIC(15, 2) DEFAULT '0.00' NOT NULL,
        sgst_amount NUMERIC(15, 2) DEFAULT '0.00' NOT NULL,
        igst_amount NUMERIC(15, 2) DEFAULT '0.00' NOT NULL,
        grand_total NUMERIC(15, 2) DEFAULT '0.00' NOT NULL,
        status VARCHAR(30) DEFAULT 'Issued' NOT NULL,
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
    op.execute("DROP TABLE IF EXISTS credit_notes CASCADE;")
    op.execute("DROP TABLE IF EXISTS sales_return_items CASCADE;")
    op.execute("DROP TABLE IF EXISTS sales_returns CASCADE;")
