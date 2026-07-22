"""
v1200_general_ledger_double_entry_accounting.py — Alembic Migration DDL for Phase 17 (v12.0.0)
General Ledger & Double-Entry Accounting Engine.

Revision ID: v1200_general_ledger_double_entry_accounting
Revises: v1100_gst_tax_settlement_eway
Create Date: 2026-07-21
"""

from alembic import op
import sqlalchemy as sa

revision = 'v1200_general_ledger'
down_revision = 'v1100_gst_tax_settlement_eway'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Create chart_of_accounts table
    op.execute("""
    CREATE TABLE IF NOT EXISTS chart_of_accounts (
        id VARCHAR(50) PRIMARY KEY,
        uuid VARCHAR(36) NOT NULL UNIQUE,
        tenant_id VARCHAR(50),
        company_id VARCHAR(50) REFERENCES companies(id) ON DELETE RESTRICT,
        branch_id VARCHAR(50) REFERENCES branches(id) ON DELETE RESTRICT,
        account_code VARCHAR(50) NOT NULL UNIQUE,
        account_name VARCHAR(255) NOT NULL,
        account_type VARCHAR(50) NOT NULL, -- ASSET, LIABILITY, EQUITY, REVENUE, COGS, EXPENSE
        balance_type VARCHAR(20) DEFAULT 'DEBIT' NOT NULL, -- DEBIT, CREDIT
        parent_id VARCHAR(50) REFERENCES chart_of_accounts(id) ON DELETE SET NULL,
        current_balance NUMERIC(15, 2) DEFAULT '0.00' NOT NULL,
        is_system BOOLEAN DEFAULT false NOT NULL,
        currency VARCHAR(10) DEFAULT 'INR' NOT NULL,
        description TEXT,
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

    # 2. Create journal_vouchers table
    op.execute("""
    CREATE TABLE IF NOT EXISTS journal_vouchers (
        id VARCHAR(50) PRIMARY KEY,
        uuid VARCHAR(36) NOT NULL UNIQUE,
        tenant_id VARCHAR(50),
        company_id VARCHAR(50) REFERENCES companies(id) ON DELETE RESTRICT,
        branch_id VARCHAR(50) REFERENCES branches(id) ON DELETE RESTRICT,
        voucher_no VARCHAR(100) NOT NULL UNIQUE,
        voucher_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
        ref_document_type VARCHAR(60) NOT NULL,
        ref_document_id VARCHAR(50) NOT NULL,
        ref_document_no VARCHAR(80) NOT NULL,
        total_debit NUMERIC(15, 2) DEFAULT '0.00' NOT NULL,
        total_credit NUMERIC(15, 2) DEFAULT '0.00' NOT NULL,
        narration TEXT,
        status VARCHAR(30) DEFAULT 'POSTED' NOT NULL, -- DRAFT, POSTED, REVERSED
        posted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
        posted_by VARCHAR(50),
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

    # 3. Create journal_ledger_entries table
    op.execute("""
    CREATE TABLE IF NOT EXISTS journal_ledger_entries (
        id VARCHAR(50) PRIMARY KEY,
        uuid VARCHAR(36) NOT NULL UNIQUE,
        tenant_id VARCHAR(50),
        company_id VARCHAR(50) REFERENCES companies(id) ON DELETE RESTRICT,
        branch_id VARCHAR(50) REFERENCES branches(id) ON DELETE RESTRICT,
        voucher_id VARCHAR(50) REFERENCES journal_vouchers(id) ON DELETE CASCADE NOT NULL,
        account_code VARCHAR(50) NOT NULL,
        account_name VARCHAR(255) NOT NULL,
        debit NUMERIC(15, 2) DEFAULT '0.00' NOT NULL,
        credit NUMERIC(15, 2) DEFAULT '0.00' NOT NULL,
        narration TEXT,
        cost_center VARCHAR(100),
        project VARCHAR(100),
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

    # 4. Create fiscal_periods table
    op.execute("""
    CREATE TABLE IF NOT EXISTS fiscal_periods (
        id VARCHAR(50) PRIMARY KEY,
        uuid VARCHAR(36) NOT NULL UNIQUE,
        tenant_id VARCHAR(50),
        company_id VARCHAR(50) REFERENCES companies(id) ON DELETE RESTRICT,
        branch_id VARCHAR(50) REFERENCES branches(id) ON DELETE RESTRICT,
        fiscal_year VARCHAR(20) NOT NULL,
        period_name VARCHAR(50) NOT NULL,
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        is_closed BOOLEAN DEFAULT false NOT NULL,
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
    op.execute("DROP TABLE IF EXISTS fiscal_periods CASCADE;")
    op.execute("DROP TABLE IF EXISTS journal_ledger_entries CASCADE;")
    op.execute("DROP TABLE IF EXISTS journal_vouchers CASCADE;")
    op.execute("DROP TABLE IF EXISTS chart_of_accounts CASCADE;")
