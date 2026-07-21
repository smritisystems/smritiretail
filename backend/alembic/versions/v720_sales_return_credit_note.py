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
    # 1. Create sales_returns table
    op.execute("""
    CREATE TABLE IF NOT EXISTS sales_returns (
        id VARCHAR(50) PRIMARY KEY,
        uuid VARCHAR(36) NOT NULL UNIQUE,
        tenant_id VARCHAR(50),
        company_id VARCHAR(50) REFERENCES companies(id) ON DELETE RESTRICT,
        branch_id VARCHAR(50) REFERENCES branches(id) ON DELETE RESTRICT,
        return_no VARCHAR(100) NOT NULL UNIQUE,
        invoice_id VARCHAR(50) REFERENCES sales_invoices(id) ON DELETE RESTRICT NOT NULL,
        customer_id VARCHAR(50) REFERENCES customers(id) ON DELETE RESTRICT NOT NULL,
        return_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
        reason TEXT,
        status VARCHAR(30) DEFAULT 'Draft' NOT NULL,
        refund_amount NUMERIC(15, 2) DEFAULT '0.00' NOT NULL,
        credit_note_id VARCHAR(50),
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

    # 2. Create sales_return_items table
    op.execute("""
    CREATE TABLE IF NOT EXISTS sales_return_items (
        id VARCHAR(50) PRIMARY KEY,
        uuid VARCHAR(36) NOT NULL UNIQUE,
        tenant_id VARCHAR(50),
        company_id VARCHAR(50) REFERENCES companies(id) ON DELETE RESTRICT,
        branch_id VARCHAR(50) REFERENCES branches(id) ON DELETE RESTRICT,
        return_id VARCHAR(50) REFERENCES sales_returns(id) ON DELETE CASCADE NOT NULL,
        product_id VARCHAR(50) REFERENCES products(id) ON DELETE RESTRICT NOT NULL,
        quantity NUMERIC(12, 4) NOT NULL,
        unit_price NUMERIC(15, 2) NOT NULL,
        condition VARCHAR(30) DEFAULT 'Restockable' NOT NULL, -- Restockable, Damaged
        gst_percentage NUMERIC(5, 2) DEFAULT '0.00' NOT NULL,
        cgst_amount NUMERIC(15, 2) DEFAULT '0.00' NOT NULL,
        sgst_amount NUMERIC(15, 2) DEFAULT '0.00' NOT NULL,
        igst_amount NUMERIC(15, 2) DEFAULT '0.00' NOT NULL,
        line_total NUMERIC(15, 2) NOT NULL,
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
