"""Expand document series prefix length limit to 15 and allow zero running_length (no padding).

Revision ID: v1545
Revises: v1544
Create Date: 2026-10-25
"""
from alembic import op
import sqlalchemy as sa

revision = "v1545"
down_revision = "v1544"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # -------------------------------------------------------------------------
    # 1. Update chk_document_series_prefix_format:
    #    Allow prefix length between 1 and 15 characters while preserving
    #    character set [A-Z0-9\-/] and statutory GST Rule 46(b) <= 16 total limit.
    # -------------------------------------------------------------------------
    op.execute("""
        ALTER TABLE document_series DROP CONSTRAINT IF EXISTS chk_document_series_prefix_format;
        ALTER TABLE document_series
            ADD CONSTRAINT chk_document_series_prefix_format
            CHECK (
                prefix = ''
                OR (char_length(prefix) BETWEEN 1 AND 15
                    AND prefix ~ '^[A-Z0-9\\-\\/]+$')
            );
    """)

    # -------------------------------------------------------------------------
    # 2. Update chk_document_series_running_length:
    #    Allow running_length between 0 and 10 (0 indicates no zero-padding).
    # -------------------------------------------------------------------------
    op.execute("""
        ALTER TABLE document_series DROP CONSTRAINT IF EXISTS chk_document_series_running_length;
        ALTER TABLE document_series
            ADD CONSTRAINT chk_document_series_running_length
            CHECK (running_length BETWEEN 0 AND 10);
    """)


def downgrade() -> None:
    op.execute("""
        ALTER TABLE document_series DROP CONSTRAINT IF EXISTS chk_document_series_running_length;
        ALTER TABLE document_series
            ADD CONSTRAINT chk_document_series_running_length
            CHECK (running_length BETWEEN 1 AND 10);

        ALTER TABLE document_series DROP CONSTRAINT IF EXISTS chk_document_series_prefix_format;
        ALTER TABLE document_series
            ADD CONSTRAINT chk_document_series_prefix_format
            CHECK (
                prefix = ''
                OR (char_length(prefix) BETWEEN 1 AND 10
                    AND prefix ~ '^[A-Z0-9\\-\\/]+$')
            );
    """)
