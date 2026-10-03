"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.18.0
Created      : 2026-09-17
Modified     : 2026-09-17
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

"""v1461 – document_series: add number_format column

Revision ID: v1461_document_series_number_format
Revises:     v1460_numbering_unique_constraints
Create Date: 2026-09-17

Adds a configurable bill-number segment arrangement field to document_series.
Four named formats are permitted:
  PREFIX_NUM_SUFFIX  – {prefix}{num}{suffix}  (default / backward-compatible)
  PREFIX_YEAR_SEP_NUM – {prefix}{year}/{num}
  NUM_ONLY            – {num}
  PREFIX_SEP_NUM      – {prefix}/{num}

The column is NOT NULL with a CHECK constraint and DEFAULT so that all
existing rows automatically receive PREFIX_NUM_SUFFIX without a data migration.
"""

from alembic import op
import sqlalchemy as sa

revision = "v1461_document_series_number_format"
down_revision = "v1460_numbering_unique_constraints"
branch_labels = None
depends_on = None

_VALID_FORMATS = "('PREFIX_NUM_SUFFIX','PREFIX_YEAR_SEP_NUM','NUM_ONLY','PREFIX_SEP_NUM')"


def upgrade() -> None:
    # ── 1. Add column with server-side default (all existing rows → PREFIX_NUM_SUFFIX)
    op.execute("""
        ALTER TABLE document_series
        ADD COLUMN IF NOT EXISTS number_format VARCHAR(30)
            NOT NULL
            DEFAULT 'PREFIX_NUM_SUFFIX';
    """)

    # ── 2. CHECK constraint — idempotent guard
    op.execute(f"""
        DO $$ BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.table_constraints
                WHERE table_name = 'document_series'
                  AND constraint_name = 'chk_document_series_number_format'
            ) THEN
                ALTER TABLE document_series
                ADD CONSTRAINT chk_document_series_number_format
                CHECK (number_format IN {_VALID_FORMATS});
            END IF;
        END $$;
    """)


def downgrade() -> None:
    op.execute("""
        ALTER TABLE document_series
        DROP CONSTRAINT IF EXISTS chk_document_series_number_format;
    """)
    op.execute("""
        ALTER TABLE document_series
        DROP COLUMN IF EXISTS number_format;
    """)
