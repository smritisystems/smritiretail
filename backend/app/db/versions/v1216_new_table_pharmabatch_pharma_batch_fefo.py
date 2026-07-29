"""
Project      : SMRITI Retail OS
Organization : SmritiSys
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Copyright    : © SMRITIBooks.com. All Rights Reserved.

Change Request CR-2026-1629: new_table pharma_batch_fefo on PharmaBatch
Revision ID: v1216_new_table_pharmabatch_pharma_batch_fefo
Revises: v1215_wms_loyalty_expansion
Create Date: 2026-07-28T16:29:39.606197
"""

from alembic import op
import sqlalchemy as sa

revision = 'v1216_new_table_pharmabatch_pharma_batch_fefo'
down_revision = 'v1215_wms_loyalty_expansion'
branch_labels = None
depends_on = None

def upgrade() -> None:
    op.execute("""
        CREATE TABLE IF NOT EXISTS pharma_batches (
            id VARCHAR(36) PRIMARY KEY,
            product_id VARCHAR(50) NOT NULL,
            batch_number VARCHAR(50) NOT NULL,
            expiry_date DATE NOT NULL,
            mfg_date DATE NULL,
            quantity_available NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
            mrp NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
            ptr NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
            drug_license_no VARCHAR(50) NULL,
            is_active BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_pharma_batches_fefo ON pharma_batches (product_id, expiry_date ASC);")

def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS pharma_batches;")

