"""v1541: Triage catalog review items and activate legitimate footwear styles

Revision ID: v1541
Revises: v1540
Create Date: 2026-10-20

Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.99.1
Copyright    : (c) SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Database Migration
"""
from alembic import op
import sqlalchemy as sa

revision = "v1541"
down_revision = "v1540"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Unquarantine footwear styles currently in REQUIRES_REVIEW status
    op.execute(sa.text("""
        UPDATE items
        SET status = 'ACTIVE',
            is_active = true,
            tax_rate = CASE 
                WHEN tax_rate IS NULL OR tax_rate = 0.0 THEN 5.00 
                ELSE tax_rate 
            END,
            primary_uom = CASE 
                WHEN primary_uom IS NULL OR primary_uom = '' THEN 'PRS' 
                ELSE primary_uom 
            END,
            uom = CASE 
                WHEN uom IS NULL OR uom = '' THEN 'PRS' 
                ELSE uom 
            END
        WHERE status = 'REQUIRES_REVIEW'
          AND item_code NOT LIKE 'QUAR-%';
    """))

    # 2. Ensure all child variants for active items are active (skipping duplicate SKUs)
    op.execute(sa.text("""
        UPDATE item_variants iv
        SET is_active = true,
            is_deleted = false,
            status = 'ACTIVE',
            tax_rate = CASE 
                WHEN iv.tax_rate IS NULL OR iv.tax_rate = 0.0 THEN 5.00 
                ELSE iv.tax_rate 
            END
        FROM items i
        WHERE iv.item_id = i.id
          AND i.status = 'ACTIVE'
          AND NOT EXISTS (
              SELECT 1 FROM item_variants dup
              WHERE dup.company_id = iv.company_id
                AND dup.variant_sku = iv.variant_sku
                AND dup.is_deleted = false
                AND dup.id != iv.id
          );
    """))

    # 3. Synchronize company_id across child tables if null
    op.execute(sa.text("""
        UPDATE item_variants iv
        SET company_id = i.company_id
        FROM items i
        WHERE iv.item_id = i.id AND iv.company_id IS NULL AND i.company_id IS NOT NULL;

        UPDATE item_barcodes ib
        SET company_id = i.company_id
        FROM items i
        WHERE ib.item_id = i.id AND ib.company_id IS NULL AND i.company_id IS NOT NULL;
    """))


def downgrade() -> None:
    pass
