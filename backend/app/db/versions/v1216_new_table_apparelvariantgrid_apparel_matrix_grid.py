"""
Project      : SMRITI Retail OS
Organization : SmritiSys
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Copyright    : © SMRITIBooks.com. All Rights Reserved.

Change Request CR-2026-1632: new_table apparel_matrix_grid on ApparelVariantGrid
Revision ID: v1216_new_table_apparelvariantgrid_apparel_matrix_grid
Revises: v1215_wms_loyalty_expansion
Create Date: 2026-07-28T16:32:11.041082
"""

from alembic import op
import sqlalchemy as sa

revision = 'v1216_new_table_apparelvariantgrid_apparel_matrix_grid'
down_revision = 'v1215_wms_loyalty_expansion'
branch_labels = None
depends_on = None

def upgrade() -> None:
    op.execute("""
        CREATE TABLE IF NOT EXISTS apparel_matrix_variants (
            id VARCHAR(36) PRIMARY KEY,
            style_code VARCHAR(50) NOT NULL,
            color VARCHAR(30) NOT NULL,
            size VARCHAR(20) NOT NULL,
            fit VARCHAR(30) NOT NULL DEFAULT 'REGULAR',
            mrp NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
            stock_qty INTEGER NOT NULL DEFAULT 0,
            barcode VARCHAR(50) NOT NULL UNIQUE,
            created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_apparel_matrix_grid ON apparel_matrix_variants (style_code, color, size);")

def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS apparel_matrix_variants;")

