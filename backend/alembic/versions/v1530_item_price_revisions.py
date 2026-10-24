"""SMRITI Retail OS MRP & Selling Price Revision Temporal Schema Migration

Revision ID: v1530_item_price_revisions
Revises: v1529_warehouse_location_zone_and_matrix_enhancements
Create Date: 2026-10-13

Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.73.0
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal

Architecture Invariants Enforced:
1. Adds item_price_revisions table to capture immutable price points across MRP, Selling Price, and Cost Price.
2. Supports future-scheduled and end-dated revisions via effective_from and effective_to timestamptz.
3. Enforces statutory ceiling constraint (revised_selling_price <= revised_mrp).
4. Tracks revision actor, justification, approval status, and audit reference.
5. Idempotent DDL using CREATE TABLE IF NOT EXISTS.
"""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "v1530_item_price_revisions"
down_revision: Union[str, Sequence[str], None] = "v1529_warehouse_location_zone_and_matrix_enhancements"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()

    conn.execute(sa.text("""
        CREATE TABLE IF NOT EXISTS item_price_revisions (
            id VARCHAR(50) PRIMARY KEY,
            uuid VARCHAR(36) NOT NULL UNIQUE,
            company_id VARCHAR(50) NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
            branch_id VARCHAR(50) REFERENCES branches(id) ON DELETE SET NULL,
            item_id VARCHAR(50) NOT NULL REFERENCES items(id) ON DELETE CASCADE,
            variant_id VARCHAR(50) NOT NULL REFERENCES item_variants(id) ON DELETE CASCADE,
            price_book_id VARCHAR(50) REFERENCES price_books(id) ON DELETE SET NULL,
            currency VARCHAR(10) NOT NULL DEFAULT 'INR',
            previous_mrp NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
            revised_mrp NUMERIC(15, 2) NOT NULL,
            previous_selling_price NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
            revised_selling_price NUMERIC(15, 2) NOT NULL,
            previous_cost_price NUMERIC(15, 2),
            revised_cost_price NUMERIC(15, 2),
            effective_from TIMESTAMPTZ NOT NULL,
            effective_to TIMESTAMPTZ,
            status VARCHAR(30) NOT NULL DEFAULT 'PENDING_APPROVAL',
            reason_code VARCHAR(50) NOT NULL DEFAULT 'MANUAL_REVISION',
            justification TEXT,
            approval_required BOOLEAN NOT NULL DEFAULT FALSE,
            approval_request_id VARCHAR(50),
            approved_by VARCHAR(100),
            approved_at TIMESTAMPTZ,
            rejection_reason TEXT,
            source VARCHAR(30) NOT NULL DEFAULT 'MANUAL',
            batch_id VARCHAR(50),
            audit_ref VARCHAR(100),
            metadata_json JSONB DEFAULT '{}',
            created_at TIMESTAMPTZ DEFAULT NOW(),
            modified_at TIMESTAMPTZ DEFAULT NOW(),
            created_by VARCHAR(100),
            updated_by VARCHAR(100),
            is_active BOOLEAN DEFAULT TRUE,
            is_deleted BOOLEAN DEFAULT FALSE,
            deleted_at TIMESTAMPTZ,
            deleted_by VARCHAR(100),
            version INTEGER DEFAULT 1,
            CONSTRAINT chk_ipr_revised_sp_non_neg CHECK (revised_selling_price >= 0),
            CONSTRAINT chk_ipr_revised_mrp_non_neg CHECK (revised_mrp >= 0),
            CONSTRAINT chk_ipr_sp_le_mrp CHECK (revised_selling_price <= revised_mrp),
            CONSTRAINT chk_ipr_valid_date_range CHECK (effective_to IS NULL OR effective_to > effective_from)
        );

        CREATE INDEX IF NOT EXISTS ix_ipr_variant_effective ON item_price_revisions(variant_id, status, effective_from, effective_to);
        CREATE INDEX IF NOT EXISTS ix_ipr_company_status ON item_price_revisions(company_id, status);
        CREATE INDEX IF NOT EXISTS ix_ipr_item_effective ON item_price_revisions(item_id, status, effective_from);
        CREATE INDEX IF NOT EXISTS ix_ipr_batch_id ON item_price_revisions(batch_id) WHERE batch_id IS NOT NULL;
        CREATE INDEX IF NOT EXISTS ix_ipr_approval_req ON item_price_revisions(approval_request_id) WHERE approval_request_id IS NOT NULL;
    """))


def downgrade() -> None:
    conn = op.get_bind()
    conn.execute(sa.text("DROP TABLE IF EXISTS item_price_revisions CASCADE;"))
