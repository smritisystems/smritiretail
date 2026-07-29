"""add_18_section_supplier_fields

Revision ID: 79c2e9571506
Revises: v1217_foundation_platform_v3
Create Date: 2026-07-29 20:06:53.964697

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '79c2e9571506'
down_revision: Union[str, Sequence[str], None] = 'v1217_foundation_platform_v3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema - Additive Supplier Columns & Tables."""
    # Add columns to suppliers table safely
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_columns = [c['name'] for c in inspector.get_columns('suppliers')]
    existing_tables = inspector.get_table_names()

    new_columns = [
        ('legal_name', sa.String(length=255)),
        ('display_name', sa.String(length=255)),
        ('tan_number', sa.String(length=20)),
        ('cin_number', sa.String(length=30)),
        ('place_of_supply', sa.String(length=100)),
        ('gst_type', sa.String(length=50)),
        ('lead_time_days', sa.Integer()),
        ('min_order_qty', sa.Numeric(precision=15, scale=3)),
        ('max_order_qty', sa.Numeric(precision=15, scale=3)),
        ('order_multiple', sa.Numeric(precision=15, scale=3)),
        ('preferred_language', sa.String(length=30)),
        ('transport_name', sa.String(length=150)),
        ('transporter_gstin', sa.String(length=20)),
        ('freight_terms', sa.String(length=100)),
        ('default_label_template', sa.String(length=100)),
        ('default_barcode_type', sa.String(length=50)),
    ]

    for col_name, col_type in new_columns:
        if col_name not in existing_columns:
            op.add_column('suppliers', sa.Column(col_name, col_type, nullable=True))

    if 'supplier_gst_registrations' not in existing_tables:
        op.execute("""
        CREATE TABLE IF NOT EXISTS supplier_gst_registrations (
            id VARCHAR(50) PRIMARY KEY,
            uuid VARCHAR(36) NOT NULL,
            tenant_id VARCHAR(50),
            company_id VARCHAR(50),
            branch_id VARCHAR(50),
            supplier_id VARCHAR(50) NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
            state_code VARCHAR(10) NOT NULL,
            state_name VARCHAR(100) NOT NULL,
            gstin VARCHAR(15) NOT NULL,
            gst_type VARCHAR(50) NOT NULL DEFAULT 'Regular',
            is_primary BOOLEAN NOT NULL DEFAULT FALSE,
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
            modified_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
            created_by VARCHAR(50),
            updated_by VARCHAR(50),
            is_active BOOLEAN NOT NULL DEFAULT TRUE,
            is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
            deleted_at TIMESTAMP WITH TIME ZONE,
            deleted_by VARCHAR(50),
            version INTEGER NOT NULL DEFAULT 1,
            workflow_status VARCHAR(30) DEFAULT 'Approved',
            document_number VARCHAR(100)
        );
        """)

    if 'supplier_documents' not in existing_tables:
        op.execute("""
        CREATE TABLE IF NOT EXISTS supplier_documents (
            id VARCHAR(50) PRIMARY KEY,
            uuid VARCHAR(36) NOT NULL,
            tenant_id VARCHAR(50),
            company_id VARCHAR(50),
            branch_id VARCHAR(50),
            supplier_id VARCHAR(50) NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
            document_type VARCHAR(50) NOT NULL,
            document_name VARCHAR(255) NOT NULL,
            file_url TEXT NOT NULL,
            file_size_kb INTEGER,
            expiry_date TIMESTAMP WITH TIME ZONE,
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
            modified_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
            created_by VARCHAR(50),
            updated_by VARCHAR(50),
            is_active BOOLEAN NOT NULL DEFAULT TRUE,
            is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
            deleted_at TIMESTAMP WITH TIME ZONE,
            deleted_by VARCHAR(50),
            version INTEGER NOT NULL DEFAULT 1,
            workflow_status VARCHAR(30) DEFAULT 'Approved',
            document_number VARCHAR(100)
        );
        """)

    if 'supplier_logistics' not in existing_tables:
        op.execute("""
        CREATE TABLE IF NOT EXISTS supplier_logistics (
            id VARCHAR(50) PRIMARY KEY,
            uuid VARCHAR(36) NOT NULL,
            tenant_id VARCHAR(50),
            company_id VARCHAR(50),
            branch_id VARCHAR(50),
            supplier_id VARCHAR(50) NOT NULL UNIQUE REFERENCES suppliers(id) ON DELETE CASCADE,
            preferred_transporter VARCHAR(150),
            transporter_gstin VARCHAR(20),
            freight_terms VARCHAR(100) DEFAULT 'Prepaid',
            loading_charges_rule VARCHAR(100) DEFAULT 'Supplier Scope',
            unloading_charges_rule VARCHAR(100) DEFAULT 'Buyer Scope',
            dispatch_location VARCHAR(255),
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
            modified_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
            created_by VARCHAR(50),
            updated_by VARCHAR(50),
            is_active BOOLEAN NOT NULL DEFAULT TRUE,
            is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
            deleted_at TIMESTAMP WITH TIME ZONE,
            deleted_by VARCHAR(50),
            version INTEGER NOT NULL DEFAULT 1,
            workflow_status VARCHAR(30) DEFAULT 'Approved',
            document_number VARCHAR(100)
        );
        """)


def downgrade() -> None:
    """Downgrade schema."""
    pass
