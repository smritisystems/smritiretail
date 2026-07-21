"""
v1100_gst_tax_settlement_eway.py — Alembic Migration DDL for Phase 16 (v11.0.0)
GST Tax Settlement, Outward/Inward Return Filing DTO & E-Way Bill Integration Engine.

Revision ID: v1100_gst_tax_settlement_eway
Revises: v1000_pos_checkout_drawer_sync
Create Date: 2026-07-21
"""

from alembic import op
import sqlalchemy as sa

revision = 'v1100_gst_tax_settlement_eway'
down_revision = 'v1000_pos_checkout_drawer_sync'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Create gst_tax_settlements table
    op.execute("""
    CREATE TABLE IF NOT EXISTS gst_tax_settlements (
        id VARCHAR(50) PRIMARY KEY,
        uuid VARCHAR(36) NOT NULL UNIQUE,
        tenant_id VARCHAR(50),
        company_id VARCHAR(50) REFERENCES companies(id) ON DELETE RESTRICT,
        branch_id VARCHAR(50) REFERENCES branches(id) ON DELETE RESTRICT,
        settlement_no VARCHAR(100) NOT NULL UNIQUE,
        tax_period VARCHAR(20) NOT NULL, -- YYYY-MM
        outward_cgst NUMERIC(15, 2) DEFAULT '0.00' NOT NULL,
        outward_sgst NUMERIC(15, 2) DEFAULT '0.00' NOT NULL,
        outward_igst NUMERIC(15, 2) DEFAULT '0.00' NOT NULL,
        total_outward_tax NUMERIC(15, 2) DEFAULT '0.00' NOT NULL,
        inward_itc_cgst NUMERIC(15, 2) DEFAULT '0.00' NOT NULL,
        inward_itc_sgst NUMERIC(15, 2) DEFAULT '0.00' NOT NULL,
        inward_itc_igst NUMERIC(15, 2) DEFAULT '0.00' NOT NULL,
        total_inward_itc NUMERIC(15, 2) DEFAULT '0.00' NOT NULL,
        net_cgst_payable NUMERIC(15, 2) DEFAULT '0.00' NOT NULL,
        net_sgst_payable NUMERIC(15, 2) DEFAULT '0.00' NOT NULL,
        net_igst_payable NUMERIC(15, 2) DEFAULT '0.00' NOT NULL,
        total_net_tax_payable NUMERIC(15, 2) DEFAULT '0.00' NOT NULL,
        carry_forward_itc NUMERIC(15, 2) DEFAULT '0.00' NOT NULL,
        status VARCHAR(30) DEFAULT 'CALCULATED' NOT NULL, -- CALCULATED, SETTLED, FILED
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

    # 2. Create gst_return_filings table
    op.execute("""
    CREATE TABLE IF NOT EXISTS gst_return_filings (
        id VARCHAR(50) PRIMARY KEY,
        uuid VARCHAR(36) NOT NULL UNIQUE,
        tenant_id VARCHAR(50),
        company_id VARCHAR(50) REFERENCES companies(id) ON DELETE RESTRICT,
        branch_id VARCHAR(50) REFERENCES branches(id) ON DELETE RESTRICT,
        filing_no VARCHAR(100) NOT NULL UNIQUE,
        return_type VARCHAR(20) NOT NULL, -- GSTR1, GSTR3B, GSTR2B
        tax_period VARCHAR(20) NOT NULL, -- YYYY-MM
        gstr1_payload_json TEXT NOT NULL,
        b2b_invoices_count INTEGER DEFAULT 0 NOT NULL,
        b2c_invoices_count INTEGER DEFAULT 0 NOT NULL,
        credit_notes_count INTEGER DEFAULT 0 NOT NULL,
        total_taxable_value NUMERIC(15, 2) DEFAULT '0.00' NOT NULL,
        total_tax_amount NUMERIC(15, 2) DEFAULT '0.00' NOT NULL,
        status VARCHAR(30) DEFAULT 'GENERATED' NOT NULL, -- GENERATED, FILED, ACKNOWLEDGED
        arn_number VARCHAR(100),
        filed_at TIMESTAMP WITH TIME ZONE,
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

    # 3. Create eway_bills table
    op.execute("""
    CREATE TABLE IF NOT EXISTS eway_bills (
        id VARCHAR(50) PRIMARY KEY,
        uuid VARCHAR(36) NOT NULL UNIQUE,
        tenant_id VARCHAR(50),
        company_id VARCHAR(50) REFERENCES companies(id) ON DELETE RESTRICT,
        branch_id VARCHAR(50) REFERENCES branches(id) ON DELETE RESTRICT,
        eway_bill_no VARCHAR(100) NOT NULL UNIQUE,
        invoice_id VARCHAR(50) REFERENCES sales_invoices(id) ON DELETE RESTRICT NOT NULL,
        consignment_value NUMERIC(15, 2) NOT NULL,
        transporter_id VARCHAR(50),
        transporter_name VARCHAR(255),
        transport_mode VARCHAR(30) DEFAULT 'ROAD' NOT NULL, -- ROAD, RAIL, AIR, SHIP
        vehicle_no VARCHAR(50),
        distance_km NUMERIC(10, 2) NOT NULL,
        valid_from TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
        valid_until TIMESTAMP WITH TIME ZONE NOT NULL,
        status VARCHAR(30) DEFAULT 'GENERATED' NOT NULL, -- GENERATED, IN_TRANSIT, CANCELLED, EXPIRED
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
    op.execute("DROP TABLE IF EXISTS eway_bills CASCADE;")
    op.execute("DROP TABLE IF EXISTS gst_return_filings CASCADE;")
    op.execute("DROP TABLE IF EXISTS gst_tax_settlements CASCADE;")
