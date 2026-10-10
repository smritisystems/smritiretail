"""SMRITI Retail OS Industrial Barcode Print Job Architecture Migration

Revision ID: v1526_add_barcode_print_jobs_table
Revises: v1525_seed_footwear_master_values
Create Date: 2026-10-10

Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.70.50
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal

Architecture Invariants Enforced:
1. Adds barcode_print_jobs table to track multi-protocol print job lifecycles (QUEUED, COMPILING, READY, PRINTING, COMPLETED, FAILED, CANCELLED).
2. Enforces idempotency_key uniqueness and tenant scoping.
3. Safe idempotent DDL using CREATE TABLE IF NOT EXISTS.
"""

from alembic import op
import sqlalchemy as sa

revision = "v1526_add_barcode_print_jobs_table"
down_revision = "v1525_seed_footwear_master_values"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()

    conn.execute(sa.text("""
        CREATE TABLE IF NOT EXISTS barcode_print_jobs (
            id VARCHAR(50) PRIMARY KEY,
            uuid VARCHAR(36) NOT NULL UNIQUE,
            company_id VARCHAR(50) REFERENCES companies(id) ON DELETE RESTRICT,
            branch_id VARCHAR(50) REFERENCES branches(id) ON DELETE RESTRICT,
            idempotency_key VARCHAR(128) UNIQUE,
            requested_by VARCHAR(100) NOT NULL,
            printer_id VARCHAR(128) NOT NULL,
            template_id VARCHAR(64) NOT NULL,
            target_dpi INTEGER NOT NULL DEFAULT 203,
            target_protocol VARCHAR(16) NOT NULL DEFAULT 'ZPL',
            total_labels INTEGER NOT NULL DEFAULT 1,
            total_items INTEGER NOT NULL DEFAULT 1,
            status VARCHAR(32) NOT NULL DEFAULT 'QUEUED',
            error_message TEXT,
            payload_hash VARCHAR(64),
            payload_stream TEXT,
            labels_metadata TEXT,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            modified_at TIMESTAMPTZ DEFAULT NOW(),
            created_by VARCHAR(100),
            updated_by VARCHAR(100),
            is_active BOOLEAN DEFAULT TRUE,
            is_deleted BOOLEAN DEFAULT FALSE,
            deleted_at TIMESTAMPTZ,
            deleted_by VARCHAR(100),
            version INTEGER DEFAULT 1
        );

        CREATE INDEX IF NOT EXISTS idx_barcode_print_jobs_company_created 
        ON barcode_print_jobs (company_id, created_at DESC);

        CREATE INDEX IF NOT EXISTS idx_barcode_print_jobs_status 
        ON barcode_print_jobs (status);
    """))


def downgrade() -> None:
    conn = op.get_bind()
    conn.execute(sa.text("DROP TABLE IF EXISTS barcode_print_jobs CASCADE;"))
