"""
v800_stock_count_cycle_audit.py — Alembic Migration DDL for Phase 12 (v8.0.0)
Inventory Physical Stock Audit & Cycle Counting Engine.

Revision ID: v800_stock_count_cycle_audit
Revises: v720_sales_return_credit_note
Create Date: 2026-07-21
"""

from alembic import op
import sqlalchemy as sa

revision = 'v800_stock_count_cycle_audit'
down_revision = 'v720_sales_return_credit_note'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Create stock_counts table
    op.execute("""
    CREATE TABLE IF NOT EXISTS stock_counts (
        id VARCHAR(50) PRIMARY KEY,
        uuid VARCHAR(36) NOT NULL UNIQUE,
        tenant_id VARCHAR(50),
        company_id VARCHAR(50) REFERENCES companies(id) ON DELETE RESTRICT,
        branch_id VARCHAR(50) REFERENCES branches(id) ON DELETE RESTRICT,
        count_no VARCHAR(100) NOT NULL UNIQUE,
        name VARCHAR(255) NOT NULL,
        count_type VARCHAR(30) DEFAULT 'Full' NOT NULL, -- Full, Selective, ABC
        status VARCHAR(30) DEFAULT 'Draft' NOT NULL, -- Draft, Counting, Reconciled, Completed, Cancelled
        scheduled_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
        completed_date TIMESTAMP WITH TIME ZONE,
        notes TEXT,
        total_items INTEGER DEFAULT 0 NOT NULL,
        total_variance_qty NUMERIC(12, 4) DEFAULT '0.0000' NOT NULL,
        total_variance_value NUMERIC(15, 2) DEFAULT '0.00' NOT NULL,
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

    # 2. Create stock_count_items table
    op.execute("""
    CREATE TABLE IF NOT EXISTS stock_count_items (
        id VARCHAR(50) PRIMARY KEY,
        uuid VARCHAR(36) NOT NULL UNIQUE,
        tenant_id VARCHAR(50),
        company_id VARCHAR(50) REFERENCES companies(id) ON DELETE RESTRICT,
        branch_id VARCHAR(50) REFERENCES branches(id) ON DELETE RESTRICT,
        count_id VARCHAR(50) REFERENCES stock_counts(id) ON DELETE CASCADE NOT NULL,
        product_id VARCHAR(50) REFERENCES products(id) ON DELETE RESTRICT NOT NULL,
        system_stock NUMERIC(12, 4) DEFAULT '0.0000' NOT NULL,
        physical_count NUMERIC(12, 4),
        variance_qty NUMERIC(12, 4) DEFAULT '0.0000' NOT NULL,
        unit_cost NUMERIC(15, 2) DEFAULT '0.00' NOT NULL,
        variance_value NUMERIC(15, 2) DEFAULT '0.00' NOT NULL,
        status VARCHAR(30) DEFAULT 'Pending' NOT NULL, -- Pending, Counted, Reconciled
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

    # 3. Create stock_adjustments table
    op.execute("""
    CREATE TABLE IF NOT EXISTS stock_adjustments (
        id VARCHAR(50) PRIMARY KEY,
        uuid VARCHAR(36) NOT NULL UNIQUE,
        tenant_id VARCHAR(50),
        company_id VARCHAR(50) REFERENCES companies(id) ON DELETE RESTRICT,
        branch_id VARCHAR(50) REFERENCES branches(id) ON DELETE RESTRICT,
        adjustment_no VARCHAR(100) NOT NULL UNIQUE,
        count_id VARCHAR(50) REFERENCES stock_counts(id) ON DELETE RESTRICT NOT NULL,
        adjustment_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
        reason VARCHAR(255) DEFAULT 'Cycle Count Variance Reconciliation' NOT NULL,
        total_adjustment_qty NUMERIC(12, 4) DEFAULT '0.0000' NOT NULL,
        total_adjustment_value NUMERIC(15, 2) DEFAULT '0.00' NOT NULL,
        status VARCHAR(30) DEFAULT 'Posted' NOT NULL,
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
    op.execute("DROP TABLE IF EXISTS stock_adjustments CASCADE;")
    op.execute("DROP TABLE IF EXISTS stock_count_items CASCADE;")
    op.execute("DROP TABLE IF EXISTS stock_counts CASCADE;")
