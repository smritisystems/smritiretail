"""v700_sales_fulfillment_engine

Revision ID: v700_sales_fulfillment
Revises: v630_supplier_scorecard
Create Date: 2026-07-21
"""
from alembic import op
import sqlalchemy as sa

revision = 'v700_sales_fulfillment'
down_revision = 'v630_supplier_scorecard'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Add fulfillment and customer columns to existing sales_orders table
    op.alter_column('sales_orders', 'customer_name', nullable=True)
    op.execute("ALTER TABLE sales_orders ADD COLUMN IF NOT EXISTS customer_id VARCHAR REFERENCES customers(id) ON DELETE RESTRICT")
    op.execute("ALTER TABLE sales_orders ADD COLUMN IF NOT EXISTS subtotal NUMERIC(15, 2) DEFAULT '0.00' NOT NULL")
    op.execute("ALTER TABLE sales_orders ADD COLUMN IF NOT EXISTS fulfillment_status VARCHAR(30) DEFAULT 'Unfulfilled' NOT NULL")
    op.execute("ALTER TABLE sales_orders ADD COLUMN IF NOT EXISTS payment_status VARCHAR(30) DEFAULT 'Unpaid' NOT NULL")
    op.execute("ALTER TABLE sales_orders ADD COLUMN IF NOT EXISTS notes TEXT")

    # 1b. Add reserved_stock column to products table
    op.execute("ALTER TABLE products ADD COLUMN IF NOT EXISTS reserved_stock NUMERIC(12, 4) DEFAULT '0.0000' NOT NULL")

    # 2. Add ordered_quantity, reserved_quantity, unit_price, line_total and make legacy columns nullable in existing sales_order_items table
    op.alter_column('sales_order_items', 'code', nullable=True)
    op.alter_column('sales_order_items', 'name', nullable=True)
    op.alter_column('sales_order_items', 'quantity', nullable=True)
    op.alter_column('sales_order_items', 'price', nullable=True)
    op.alter_column('sales_order_items', 'total_amount', nullable=True)

    op.execute("ALTER TABLE sales_order_items ADD COLUMN IF NOT EXISTS ordered_quantity NUMERIC(10, 2) DEFAULT '0.00' NOT NULL")
    op.execute("ALTER TABLE sales_order_items ADD COLUMN IF NOT EXISTS reserved_quantity NUMERIC(12, 4) DEFAULT '0.0000' NOT NULL")
    op.execute("ALTER TABLE sales_order_items ADD COLUMN IF NOT EXISTS unit_price NUMERIC(15, 2) DEFAULT '0.00' NOT NULL")
    op.execute("ALTER TABLE sales_order_items ADD COLUMN IF NOT EXISTS line_total NUMERIC(15, 2) DEFAULT '0.00' NOT NULL")

    # 3. Create fulfillment_waves table
    op.execute("""
    CREATE TABLE IF NOT EXISTS fulfillment_waves (
        id VARCHAR PRIMARY KEY,
        uuid VARCHAR UNIQUE NOT NULL,
        tenant_id VARCHAR,
        company_id VARCHAR NOT NULL,
        branch_id VARCHAR,
        wave_no VARCHAR UNIQUE NOT NULL,
        status VARCHAR(30) DEFAULT 'Created' NOT NULL,
        total_orders INTEGER DEFAULT 0 NOT NULL,
        total_items INTEGER DEFAULT 0 NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
        modified_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
        created_by VARCHAR,
        updated_by VARCHAR,
        is_active BOOLEAN DEFAULT TRUE NOT NULL,
        is_deleted BOOLEAN DEFAULT FALSE NOT NULL,
        deleted_at TIMESTAMP WITH TIME ZONE,
        deleted_by VARCHAR,
        version INTEGER DEFAULT 1 NOT NULL,
        workflow_status VARCHAR,
        document_number VARCHAR
    )
    """)

    # 4. Create pick_lists table
    op.execute("""
    CREATE TABLE IF NOT EXISTS pick_lists (
        id VARCHAR PRIMARY KEY,
        uuid VARCHAR UNIQUE NOT NULL,
        tenant_id VARCHAR,
        company_id VARCHAR NOT NULL,
        branch_id VARCHAR,
        pick_list_no VARCHAR UNIQUE NOT NULL,
        wave_id VARCHAR REFERENCES fulfillment_waves(id) ON DELETE CASCADE NOT NULL,
        status VARCHAR(30) DEFAULT 'Pending' NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
        modified_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
        created_by VARCHAR,
        updated_by VARCHAR,
        is_active BOOLEAN DEFAULT TRUE NOT NULL,
        is_deleted BOOLEAN DEFAULT FALSE NOT NULL,
        deleted_at TIMESTAMP WITH TIME ZONE,
        deleted_by VARCHAR,
        version INTEGER DEFAULT 1 NOT NULL,
        workflow_status VARCHAR,
        document_number VARCHAR
    )
    """)

    # 5. Create pick_list_items table
    op.execute("""
    CREATE TABLE IF NOT EXISTS pick_list_items (
        id VARCHAR PRIMARY KEY,
        uuid VARCHAR UNIQUE NOT NULL,
        tenant_id VARCHAR,
        company_id VARCHAR,
        branch_id VARCHAR,
        pick_list_id VARCHAR REFERENCES pick_lists(id) ON DELETE CASCADE NOT NULL,
        order_id VARCHAR REFERENCES sales_orders(id) ON DELETE CASCADE NOT NULL,
        product_id VARCHAR REFERENCES products(id) ON DELETE RESTRICT NOT NULL,
        quantity_to_pick NUMERIC(10, 2) NOT NULL,
        quantity_picked NUMERIC(10, 2) DEFAULT '0.00' NOT NULL,
        status VARCHAR(30) DEFAULT 'Pending' NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
        modified_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
        created_by VARCHAR,
        updated_by VARCHAR,
        is_active BOOLEAN DEFAULT TRUE NOT NULL,
        is_deleted BOOLEAN DEFAULT FALSE NOT NULL,
        deleted_at TIMESTAMP WITH TIME ZONE,
        deleted_by VARCHAR,
        version INTEGER DEFAULT 1 NOT NULL,
        workflow_status VARCHAR,
        document_number VARCHAR
    )
    """)

    # 6. Create shipment_packages table
    op.execute("""
    CREATE TABLE IF NOT EXISTS shipment_packages (
        id VARCHAR PRIMARY KEY,
        uuid VARCHAR UNIQUE NOT NULL,
        tenant_id VARCHAR,
        company_id VARCHAR NOT NULL,
        branch_id VARCHAR,
        package_no VARCHAR UNIQUE NOT NULL,
        order_id VARCHAR REFERENCES sales_orders(id) ON DELETE CASCADE NOT NULL,
        wave_id VARCHAR,
        carrier VARCHAR(100),
        tracking_no VARCHAR(100),
        weight_kg NUMERIC(10, 3) DEFAULT '0.000' NOT NULL,
        shipping_cost NUMERIC(15, 2) DEFAULT '0.00' NOT NULL,
        status VARCHAR(30) DEFAULT 'PACKED' NOT NULL,
        dispatch_date TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
        modified_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
        created_by VARCHAR,
        updated_by VARCHAR,
        is_active BOOLEAN DEFAULT TRUE NOT NULL,
        is_deleted BOOLEAN DEFAULT FALSE NOT NULL,
        deleted_at TIMESTAMP WITH TIME ZONE,
        deleted_by VARCHAR,
        version INTEGER DEFAULT 1 NOT NULL,
        workflow_status VARCHAR,
        document_number VARCHAR
    )
    """)


def downgrade() -> None:
    op.drop_table('shipment_packages')
    op.drop_table('pick_list_items')
    op.drop_table('pick_lists')
    op.drop_table('fulfillment_waves')
    op.drop_column('sales_order_items', 'line_total')
    op.drop_column('sales_order_items', 'unit_price')
    op.drop_column('sales_order_items', 'reserved_quantity')
    op.drop_column('sales_order_items', 'ordered_quantity')
    op.drop_column('sales_orders', 'notes')
    op.drop_column('sales_orders', 'payment_status')
    op.drop_column('sales_orders', 'fulfillment_status')
    op.drop_column('sales_orders', 'subtotal')
    op.drop_column('sales_orders', 'customer_id')
