"""
Project      : SMRITI Retail OS
Repository   : SMRITIRetailNX
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.49.0
Created      : 2026-09-30
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Schema Evolution & Document Numbering Governance

v1507: Category-Based Article Numbering Schema Extension.
Extends document_series with category (VARCHAR(100)) and end_number (INTEGER).
Adds check constraint: end_number IS NULL OR end_number >= start_number.
Adds partial index: (company_id, document_type, category) WHERE is_deleted = false AND is_active = true.
"""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "v1507"
down_revision: Union[str, Sequence[str], None] = "v1506"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()

    # 1. Add category and end_number columns to document_series if table exists
    bind.execute(sa.text("""
        DO $$
        BEGIN
            IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'document_series') THEN
                ALTER TABLE document_series ADD COLUMN IF NOT EXISTS category VARCHAR(100);
                ALTER TABLE document_series ADD COLUMN IF NOT EXISTS end_number INTEGER;

                -- 2. Add validation constraint: end_number IS NULL OR end_number >= start_number
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint WHERE conname = 'chk_document_series_end_number'
                ) THEN
                    ALTER TABLE document_series
                    ADD CONSTRAINT chk_document_series_end_number
                    CHECK (end_number IS NULL OR end_number >= start_number);
                END IF;

                -- 3. Create partial index for category-based series resolution
                IF NOT EXISTS (
                    SELECT 1 FROM pg_indexes WHERE indexname = 'idx_document_series_category_lookup'
                ) THEN
                    CREATE INDEX idx_document_series_category_lookup
                    ON document_series (company_id, document_type, category)
                    WHERE is_deleted = false AND is_active = true;
                END IF;
            END IF;
        END $$;
    """))


def downgrade() -> None:
    bind = op.get_bind()

    bind.execute(sa.text("""
        DO $$
        BEGIN
            IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'document_series') THEN
                DROP INDEX IF EXISTS idx_document_series_category_lookup;

                IF EXISTS (
                    SELECT 1 FROM pg_constraint WHERE conname = 'chk_document_series_end_number'
                ) THEN
                    ALTER TABLE document_series DROP CONSTRAINT chk_document_series_end_number;
                END IF;

                ALTER TABLE document_series DROP COLUMN IF EXISTS end_number;
                ALTER TABLE document_series DROP COLUMN IF EXISTS category;
            END IF;
        END $$;
    """))
