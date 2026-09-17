"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.32.0
Created      : 2026-09-17
Modified     : 2026-09-17
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Schema Lifecycle & Compliance — Numbering Series Uniqueness & Validation Constraints
"""

"""Add unique constraints and check constraints to document_series table.

Revision ID: v1460_numbering_unique_constraints
Revises: v1459_line_level_salesperson_attribution
Create Date: 2026-09-17
"""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "v1460_numbering_unique_constraints"
down_revision: Union[str, Sequence[str], None] = "v1459_line_level_salesperson_attribution"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # -------------------------------------------------------------------------
    # 0. Ensure prerequisite columns exist on document_series before index creation
    # -------------------------------------------------------------------------
    op.execute("""
        ALTER TABLE IF EXISTS document_series ADD COLUMN IF NOT EXISTS terminal_id VARCHAR(50) DEFAULT 'COMMON';
        ALTER TABLE IF EXISTS document_series ADD COLUMN IF NOT EXISTS is_common_across_terminals BOOLEAN DEFAULT true;
        ALTER TABLE IF EXISTS document_series ADD COLUMN IF NOT EXISTS transaction_group VARCHAR(50) DEFAULT 'SALES';
        ALTER TABLE IF EXISTS document_series ADD COLUMN IF NOT EXISTS start_number INTEGER DEFAULT 1;
        ALTER TABLE IF EXISTS document_series ADD COLUMN IF NOT EXISTS is_void_unified BOOLEAN DEFAULT false;
    """)

    # -------------------------------------------------------------------------
    # 1. UNIQUE PARTIAL INDEX on (company_id, branch_id, prefix, suffix,
    #    document_type, transaction_group, terminal_id) WHERE active & not deleted
    #    This is the primary dedup guard — only live active records are blocked.
    #    Soft-deleted historical rows are NOT blocked.
    # -------------------------------------------------------------------------
    op.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_indexes
                WHERE schemaname = 'public'
                  AND tablename  = 'document_series'
                  AND indexname  = 'idx_document_series_active_prefix_unique'
            ) THEN
                CREATE UNIQUE INDEX idx_document_series_active_prefix_unique
                ON document_series (
                    company_id, branch_id, prefix, suffix,
                    document_type, transaction_group, terminal_id
                )
                WHERE is_deleted = FALSE AND is_active = TRUE;
            END IF;
        END $$;
    """)

    # -------------------------------------------------------------------------
    # 2. UNIQUE constraint on (company_id, branch_id, name) — prevents two
    #    active series sharing the same display name within a company/branch.
    #    Using a partial index (same pattern) so deleted entries don't block reuse.
    # -------------------------------------------------------------------------
    op.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_indexes
                WHERE schemaname = 'public'
                  AND tablename  = 'document_series'
                  AND indexname  = 'idx_document_series_active_name_unique'
            ) THEN
                CREATE UNIQUE INDEX idx_document_series_active_name_unique
                ON document_series (company_id, branch_id, name)
                WHERE is_deleted = FALSE;
            END IF;
        END $$;
    """)

    # -------------------------------------------------------------------------
    # 3. CHECK constraint: prefix format — uppercase alphanumeric + hyphen + slash,
    #    1–10 characters.  GST Rule 46(b) compliance.
    #    Empty string allowed (series may have no prefix); regex only fires on
    #    non-empty values.
    # -------------------------------------------------------------------------
    op.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.check_constraints
                WHERE constraint_schema = 'public'
                  AND constraint_name   = 'chk_document_series_prefix_format'
            ) THEN
                ALTER TABLE document_series
                    ADD CONSTRAINT chk_document_series_prefix_format
                    CHECK (
                        prefix = ''
                        OR (char_length(prefix) BETWEEN 1 AND 10
                            AND prefix ~ '^[A-Z0-9\\-\\/]+$')
                    );
            END IF;
        END $$;
    """)

    # -------------------------------------------------------------------------
    # 4. CHECK constraint: running_length must be between 1 and 10
    # -------------------------------------------------------------------------
    op.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.check_constraints
                WHERE constraint_schema = 'public'
                  AND constraint_name   = 'chk_document_series_running_length'
            ) THEN
                ALTER TABLE document_series
                    ADD CONSTRAINT chk_document_series_running_length
                    CHECK (running_length BETWEEN 1 AND 10);
            END IF;
        END $$;
    """)

    # -------------------------------------------------------------------------
    # 5. CHECK constraint: start_number must be >= 1
    # -------------------------------------------------------------------------
    op.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.check_constraints
                WHERE constraint_schema = 'public'
                  AND constraint_name   = 'chk_document_series_start_number'
            ) THEN
                ALTER TABLE document_series
                    ADD CONSTRAINT chk_document_series_start_number
                    CHECK (start_number >= 1);
            END IF;
        END $$;
    """)


def downgrade() -> None:
    # Drop in reverse order
    op.execute("""
        ALTER TABLE document_series
            DROP CONSTRAINT IF EXISTS chk_document_series_start_number;
    """)
    op.execute("""
        ALTER TABLE document_series
            DROP CONSTRAINT IF EXISTS chk_document_series_running_length;
    """)
    op.execute("""
        ALTER TABLE document_series
            DROP CONSTRAINT IF EXISTS chk_document_series_prefix_format;
    """)
    op.execute("DROP INDEX IF EXISTS idx_document_series_active_name_unique;")
    op.execute("DROP INDEX IF EXISTS idx_document_series_active_prefix_unique;")
