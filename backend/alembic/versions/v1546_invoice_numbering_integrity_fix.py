"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.17.0
Created      : 2026-10-27
Modified     : 2026-10-27
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Description  : v1546 - Invoice Numbering Integrity Fix
               1. Soft-deduplicates NULL-company_id duplicate active series
               2. Adds partial unique index on (company_id, document_type, terminal_id)
                  for non-NULL company tenants
               3. Creates v_number_allocation_audit monitoring view
"""

from alembic import op
import sqlalchemy as sa

revision = "v1546"
down_revision = "v1545"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Step 1: Soft-deduplicate NULL-company_id duplicate active series.
    # Keep the most recently created per (document_type, terminal_id).
    op.execute(sa.text("""
        WITH ranked AS (
            SELECT id,
                ROW_NUMBER() OVER (
                    PARTITION BY document_type, COALESCE(terminal_id, 'COMMON')
                    ORDER BY created_at DESC NULLS LAST, id ASC
                ) AS rn
            FROM document_series
            WHERE is_deleted = false AND is_active = true AND company_id IS NULL
        )
        UPDATE document_series
        SET is_active = false, is_deleted = true,
            deleted_at = NOW(), deleted_by = 'v1546_dedup_migration',
            updated_by = 'v1546_dedup_migration'
        WHERE id IN (SELECT id FROM ranked WHERE rn > 1);
    """))

    # Step 2: Partial unique index for real company tenants.
    op.execute(sa.text("""
        CREATE UNIQUE INDEX IF NOT EXISTS
            uq_document_series_company_type_terminal_active
        ON document_series (company_id, document_type, COALESCE(terminal_id, 'COMMON'))
        WHERE is_deleted = false AND is_active = true AND company_id IS NOT NULL;
    """))

    # Step 3: Monitoring view for number allocation audit.
    op.execute(sa.text("""
        CREATE OR REPLACE VIEW v_number_allocation_audit AS
        SELECT
            ds.id              AS series_id,
            ds.document_type,
            ds.terminal_id,
            ds.company_id,
            ds.prefix,
            ds.suffix,
            ds.current_number,
            ds.financial_year,
            ds.is_active,
            ds.number_format,
            nal.document_no    AS last_allocated_no,
            nal.operator       AS last_operator,
            nal.created_at     AS last_allocation_at
        FROM document_series ds
        LEFT JOIN LATERAL (
            SELECT document_no, operator, created_at
            FROM   numbering_audit_logs
            WHERE  series_id = ds.id AND action = 'ALLOCATE'
            ORDER  BY created_at DESC
            LIMIT  1
        ) nal ON true
        WHERE ds.is_deleted = false;
    """))


def downgrade() -> None:
    op.execute(sa.text("DROP VIEW IF EXISTS v_number_allocation_audit;"))
    op.execute(sa.text(
        "DROP INDEX IF EXISTS uq_document_series_company_type_terminal_active;"
    ))
