"""
v900_replenishment_reorder.py — Alembic Migration DDL for Phase 14 (v9.0.0)
Automated Warehouse Replenishment & Reorder Suggestions Engine.

Revision ID: v900_replenishment_reorder
Revises: v810_stock_transfer_orders
Create Date: 2026-07-21
"""

from alembic import op
import sqlalchemy as sa

revision = 'v900_replenishment_reorder'
down_revision = 'v810_stock_transfer_orders'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Create replenishment_plans table
    op.execute("""
    CREATE TABLE IF NOT EXISTS replenishment_plans (
        id VARCHAR(50) PRIMARY KEY,
        uuid VARCHAR(36) NOT NULL UNIQUE,
        tenant_id VARCHAR(50),
        company_id VARCHAR(50) REFERENCES companies(id) ON DELETE RESTRICT,
        branch_id VARCHAR(50) REFERENCES branches(id) ON DELETE RESTRICT,
        plan_no VARCHAR(100) NOT NULL UNIQUE,
        name VARCHAR(255) NOT NULL,
        plan_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
        status VARCHAR(30) DEFAULT 'Draft' NOT NULL, -- Draft, Converted, Cancelled
        total_items INTEGER DEFAULT 0 NOT NULL,
        total_estimated_cost NUMERIC(15, 2) DEFAULT '0.00' NOT NULL,
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

    # 2. Create replenishment_items table
    op.execute("""
    CREATE TABLE IF NOT EXISTS replenishment_items (
        id VARCHAR(50) PRIMARY KEY,
        uuid VARCHAR(36) NOT NULL UNIQUE,
        tenant_id VARCHAR(50),
        company_id VARCHAR(50) REFERENCES companies(id) ON DELETE RESTRICT,
        branch_id VARCHAR(50) REFERENCES branches(id) ON DELETE RESTRICT,
        plan_id VARCHAR(50) REFERENCES replenishment_plans(id) ON DELETE CASCADE NOT NULL,
        product_id VARCHAR(50) REFERENCES products(id) ON DELETE RESTRICT NOT NULL,
        preferred_vendor_id VARCHAR(50),
        current_stock NUMERIC(12, 4) DEFAULT '0.0000' NOT NULL,
        reorder_level NUMERIC(12, 4) DEFAULT '0.0000' NOT NULL,
        suggested_qty NUMERIC(12, 4) NOT NULL,
        unit_price NUMERIC(15, 2) DEFAULT '0.00' NOT NULL,
        line_total NUMERIC(15, 2) DEFAULT '0.00' NOT NULL,
        purchase_order_id VARCHAR(50),
        status VARCHAR(30) DEFAULT 'Pending' NOT NULL, -- Pending, Converted
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
    op.execute("DROP TABLE IF EXISTS replenishment_items CASCADE;")
    op.execute("DROP TABLE IF EXISTS replenishment_plans CASCADE;")
