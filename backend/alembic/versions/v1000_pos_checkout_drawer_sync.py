"""
v1000_pos_checkout_drawer_sync.py — Alembic Migration DDL for Phase 15 (v10.0.0)
Unified POS Checkout, Cash Drawer Session & Offline Sync Queue Engine.

Revision ID: v1000_pos_checkout_drawer_sync
Revises: v900_replenishment_reorder
Create Date: 2026-07-21
"""

from alembic import op
import sqlalchemy as sa

revision = 'v1000_pos_checkout_drawer_sync'
down_revision = 'v900_replenishment_reorder'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Create pos_sessions table
    op.execute("""
    CREATE TABLE IF NOT EXISTS pos_sessions (
        id VARCHAR(50) PRIMARY KEY,
        uuid VARCHAR(36) NOT NULL UNIQUE,
        tenant_id VARCHAR(50),
        company_id VARCHAR(50) REFERENCES companies(id) ON DELETE RESTRICT,
        branch_id VARCHAR(50) REFERENCES branches(id) ON DELETE RESTRICT,
        session_no VARCHAR(100) NOT NULL UNIQUE,
        cashier_id VARCHAR(50) NOT NULL,
        terminal_id VARCHAR(50) NOT NULL,
        opened_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
        closed_at TIMESTAMP WITH TIME ZONE,
        opening_balance NUMERIC(15, 2) DEFAULT '0.00' NOT NULL,
        total_cash_sales NUMERIC(15, 2) DEFAULT '0.00' NOT NULL,
        total_card_sales NUMERIC(15, 2) DEFAULT '0.00' NOT NULL,
        total_upi_sales NUMERIC(15, 2) DEFAULT '0.00' NOT NULL,
        total_sales NUMERIC(15, 2) DEFAULT '0.00' NOT NULL,
        expected_cash NUMERIC(15, 2) DEFAULT '0.00' NOT NULL,
        actual_cash_count NUMERIC(15, 2),
        cash_variance NUMERIC(15, 2) DEFAULT '0.00',
        status VARCHAR(30) DEFAULT 'OPEN' NOT NULL, -- OPEN, CLOSED, RECONCILED
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

    # 2. Create pos_transactions table
    op.execute("""
    CREATE TABLE IF NOT EXISTS pos_transactions (
        id VARCHAR(50) PRIMARY KEY,
        uuid VARCHAR(36) NOT NULL UNIQUE,
        tenant_id VARCHAR(50),
        company_id VARCHAR(50) REFERENCES companies(id) ON DELETE RESTRICT,
        branch_id VARCHAR(50) REFERENCES branches(id) ON DELETE RESTRICT,
        session_id VARCHAR(50) REFERENCES pos_sessions(id) ON DELETE RESTRICT NOT NULL,
        receipt_no VARCHAR(100) NOT NULL UNIQUE,
        client_tx_uuid VARCHAR(100) UNIQUE,
        customer_id VARCHAR(50),
        subtotal NUMERIC(15, 2) DEFAULT '0.00' NOT NULL,
        tax_total NUMERIC(15, 2) DEFAULT '0.00' NOT NULL,
        discount_amount NUMERIC(15, 2) DEFAULT '0.00' NOT NULL,
        grand_total NUMERIC(15, 2) DEFAULT '0.00' NOT NULL,
        payment_method VARCHAR(30) DEFAULT 'CASH' NOT NULL, -- CASH, CARD, UPI, MIXED
        tendered_amount NUMERIC(15, 2) DEFAULT '0.00' NOT NULL,
        change_due NUMERIC(15, 2) DEFAULT '0.00' NOT NULL,
        status VARCHAR(30) DEFAULT 'COMPLETED' NOT NULL, -- COMPLETED, VOIDED, REFUNDED
        transaction_time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
        is_offline_synced BOOLEAN DEFAULT false NOT NULL,
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

    # 3. Create pos_transaction_items table
    op.execute("""
    CREATE TABLE IF NOT EXISTS pos_transaction_items (
        id VARCHAR(50) PRIMARY KEY,
        uuid VARCHAR(36) NOT NULL UNIQUE,
        tenant_id VARCHAR(50),
        company_id VARCHAR(50) REFERENCES companies(id) ON DELETE RESTRICT,
        branch_id VARCHAR(50) REFERENCES branches(id) ON DELETE RESTRICT,
        transaction_id VARCHAR(50) REFERENCES pos_transactions(id) ON DELETE CASCADE NOT NULL,
        product_id VARCHAR(50) REFERENCES products(id) ON DELETE RESTRICT NOT NULL,
        product_code VARCHAR(100) NOT NULL,
        product_name VARCHAR(255) NOT NULL,
        quantity NUMERIC(12, 4) NOT NULL,
        unit_price NUMERIC(15, 2) NOT NULL,
        tax_amount NUMERIC(15, 2) DEFAULT '0.00' NOT NULL,
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

    # 4. Create pos_offline_sync_queue table
    op.execute("""
    CREATE TABLE IF NOT EXISTS pos_offline_sync_queue (
        id VARCHAR(50) PRIMARY KEY,
        uuid VARCHAR(36) NOT NULL UNIQUE,
        tenant_id VARCHAR(50),
        company_id VARCHAR(50) REFERENCES companies(id) ON DELETE RESTRICT,
        branch_id VARCHAR(50) REFERENCES branches(id) ON DELETE RESTRICT,
        client_tx_uuid VARCHAR(100) NOT NULL UNIQUE,
        terminal_id VARCHAR(50) NOT NULL,
        payload_json TEXT NOT NULL,
        sync_status VARCHAR(30) DEFAULT 'PENDING' NOT NULL, -- PENDING, SYNCED, FAILED, DUPLICATE
        synced_transaction_id VARCHAR(50),
        error_message TEXT,
        submitted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
        synced_at TIMESTAMP WITH TIME ZONE,
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
    op.execute("DROP TABLE IF EXISTS pos_offline_sync_queue CASCADE;")
    op.execute("DROP TABLE IF EXISTS pos_transaction_items CASCADE;")
    op.execute("DROP TABLE IF EXISTS pos_transactions CASCADE;")
    op.execute("DROP TABLE IF EXISTS pos_sessions CASCADE;")
