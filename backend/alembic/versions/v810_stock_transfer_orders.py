"""
v810_stock_transfer_orders.py — Alembic Migration DDL for Phase 13 (v8.1.0)
Stock Movement & Inter-Branch Transfer Order Engine.

Revision ID: v810_stock_transfer_orders
Revises: v800_stock_count_cycle_audit
Create Date: 2026-07-21
"""

from alembic import op
import sqlalchemy as sa

revision = 'v810_stock_transfer_orders'
down_revision = 'v800_stock_count_cycle_audit'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Create stock_transfers table
    op.execute("""
    CREATE TABLE IF NOT EXISTS stock_transfers (
        id VARCHAR(50) PRIMARY KEY,
        uuid VARCHAR(36) NOT NULL UNIQUE,
        tenant_id VARCHAR(50),
        company_id VARCHAR(50) REFERENCES companies(id) ON DELETE RESTRICT,
        branch_id VARCHAR(50) REFERENCES branches(id) ON DELETE RESTRICT,
        transfer_no VARCHAR(100) NOT NULL UNIQUE,
        source_branch_id VARCHAR(50) REFERENCES branches(id) ON DELETE RESTRICT NOT NULL,
        destination_branch_id VARCHAR(50) REFERENCES branches(id) ON DELETE RESTRICT NOT NULL,
        transfer_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
        status VARCHAR(30) DEFAULT 'Draft' NOT NULL, -- Draft, Approved, InTransit, Received, Cancelled
        carrier VARCHAR(100),
        tracking_no VARCHAR(100),
        notes TEXT,
        total_transfer_qty NUMERIC(12, 4) DEFAULT '0.0000' NOT NULL,
        total_transfer_value NUMERIC(15, 2) DEFAULT '0.00' NOT NULL,
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

    # 2. Create stock_transfer_items table
    op.execute("""
    CREATE TABLE IF NOT EXISTS stock_transfer_items (
        id VARCHAR(50) PRIMARY KEY,
        uuid VARCHAR(36) NOT NULL UNIQUE,
        tenant_id VARCHAR(50),
        company_id VARCHAR(50) REFERENCES companies(id) ON DELETE RESTRICT,
        branch_id VARCHAR(50) REFERENCES branches(id) ON DELETE RESTRICT,
        transfer_id VARCHAR(50) REFERENCES stock_transfers(id) ON DELETE CASCADE NOT NULL,
        product_id VARCHAR(50) REFERENCES products(id) ON DELETE RESTRICT NOT NULL,
        requested_qty NUMERIC(12, 4) NOT NULL,
        shipped_qty NUMERIC(12, 4) DEFAULT '0.0000' NOT NULL,
        received_qty NUMERIC(12, 4) DEFAULT '0.0000' NOT NULL,
        unit_cost NUMERIC(15, 2) DEFAULT '0.00' NOT NULL,
        line_total NUMERIC(15, 2) DEFAULT '0.00' NOT NULL,
        status VARCHAR(30) DEFAULT 'Pending' NOT NULL, -- Pending, Shipped, Received
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

    # 3. Create stock_transfer_shipments table
    op.execute("""
    CREATE TABLE IF NOT EXISTS stock_transfer_shipments (
        id VARCHAR(50) PRIMARY KEY,
        uuid VARCHAR(36) NOT NULL UNIQUE,
        tenant_id VARCHAR(50),
        company_id VARCHAR(50) REFERENCES companies(id) ON DELETE RESTRICT,
        branch_id VARCHAR(50) REFERENCES branches(id) ON DELETE RESTRICT,
        shipment_no VARCHAR(100) NOT NULL UNIQUE,
        transfer_id VARCHAR(50) REFERENCES stock_transfers(id) ON DELETE RESTRICT NOT NULL,
        dispatch_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
        receipt_date TIMESTAMP WITH TIME ZONE,
        carrier VARCHAR(100),
        tracking_no VARCHAR(100),
        status VARCHAR(30) DEFAULT 'DISPATCHED' NOT NULL, -- DISPATCHED, DELIVERED
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
    op.execute("DROP TABLE IF EXISTS stock_transfer_shipments CASCADE;")
    op.execute("DROP TABLE IF EXISTS stock_transfer_items CASCADE;")
    op.execute("DROP TABLE IF EXISTS stock_transfers CASCADE;")
