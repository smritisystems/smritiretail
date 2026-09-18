"""Phase 2: Identity Alias Concurrency Hardening & Master Schema Parity

Revision ID: v1469_phase2_alias_atomic_upsert_and_hardening
Revises: v1468_phase1_4_master_identity_index_and_resolver
Create Date: 2026-09-18 12:45:00.000000

Governance Standard: AGENTS.md Rules 1-12, UADHP-v1.0
Author: Jawahar Ramkripal Mallah, Chief Systems Architect & Creator
Copyright: © SMRITIBooks.com. All Rights Reserved.
License: Proprietary Commercial Software
Classification: Internal Core Architecture

Scope of Migration:
1. Create unique functional index uq_smriti_identity_alias_lower on smriti_identity_alias
   (entity_type, LOWER(alias_code), COALESCE(company_id, '')) to enforce case-insensitive uniqueness
   and support PostgreSQL native ON CONFLICT atomic upserts.
2. Ensure full column and AST parity for items and item_variants across Control Plane (smritisys)
   and Tenant Data Planes (smriti001, smriti002), satisfying AGENTS.md Rule 12.
"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'v1469_phase2_alias_atomic_upsert_and_hardening'
down_revision = 'v1468_phase1_4_master_identity_index_and_resolver'
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()

    # =========================================================================
    # Step 1: Unique Index for Case-Insensitive Alias Concurrency & Atomic Upsert
    # =========================================================================
    alias_lower_uq_exists = conn.execute(
        sa.text(
            "SELECT 1 FROM pg_indexes "
            "WHERE tablename = 'smriti_identity_alias' AND indexname = 'uq_smriti_identity_alias_lower'"
        )
    ).scalar()

    if not alias_lower_uq_exists:
        op.execute(
            "CREATE UNIQUE INDEX uq_smriti_identity_alias_lower "
            "ON smriti_identity_alias (entity_type, LOWER(alias_code), COALESCE(company_id, ''));"
        )

    # =========================================================================
    # Step 2: Ensure 100% Column Parity for items across all databases (Rule 12)
    # =========================================================================
    op.execute("ALTER TABLE IF EXISTS items ADD COLUMN IF NOT EXISTS category_code VARCHAR(50);")
    op.execute("ALTER TABLE IF EXISTS items ADD COLUMN IF NOT EXISTS is_batch_tracked BOOLEAN NOT NULL DEFAULT FALSE;")
    op.execute("ALTER TABLE IF EXISTS items ADD COLUMN IF NOT EXISTS is_serial_tracked BOOLEAN NOT NULL DEFAULT FALSE;")
    op.execute("ALTER TABLE IF EXISTS items ADD COLUMN IF NOT EXISTS is_favorite BOOLEAN NOT NULL DEFAULT FALSE;")
    op.execute("ALTER TABLE IF EXISTS items ADD COLUMN IF NOT EXISTS primary_image_url VARCHAR(512);")
    op.execute("ALTER TABLE IF EXISTS items ADD COLUMN IF NOT EXISTS tracking_type VARCHAR(50);")
    op.execute("ALTER TABLE IF EXISTS items ADD COLUMN IF NOT EXISTS hsn_sac_code VARCHAR(50);")
    op.execute("ALTER TABLE IF EXISTS items ADD COLUMN IF NOT EXISTS uom VARCHAR(50);")
    op.execute("ALTER TABLE IF EXISTS items ADD COLUMN IF NOT EXISTS metadata_json JSONB DEFAULT '{}'::jsonb;")

    # =========================================================================
    # Step 3: Ensure 100% Column Parity for item_variants across all databases
    # =========================================================================
    op.execute("ALTER TABLE IF EXISTS item_variants ADD COLUMN IF NOT EXISTS size VARCHAR(50);")
    op.execute("ALTER TABLE IF EXISTS item_variants ADD COLUMN IF NOT EXISTS color VARCHAR(50);")
    op.execute("ALTER TABLE IF EXISTS item_variants ADD COLUMN IF NOT EXISTS material VARCHAR(50);")
    op.execute("ALTER TABLE IF EXISTS item_variants ADD COLUMN IF NOT EXISTS is_default BOOLEAN DEFAULT FALSE;")
    op.execute("ALTER TABLE IF EXISTS item_variants ADD COLUMN IF NOT EXISTS status VARCHAR(30) DEFAULT 'ACTIVE';")
    op.execute("ALTER TABLE IF EXISTS item_variants ADD COLUMN IF NOT EXISTS metadata_json JSONB DEFAULT '{}'::jsonb;")

    # =========================================================================
    # Step 4: Ensure 100% Column Parity for sales_invoices across all databases
    # =========================================================================
    op.execute("ALTER TABLE IF EXISTS sales_invoices ADD COLUMN IF NOT EXISTS dispatch_from_location_id VARCHAR(50);")
    op.execute("ALTER TABLE IF EXISTS sales_invoices ADD COLUMN IF NOT EXISTS dispatch_from_snapshot JSONB DEFAULT '{}'::jsonb;")

    # =========================================================================
    # Step 5: Align transactional identity code scope to TENANT for global uniqueness
    # =========================================================================
    op.execute("UPDATE smriti_identity_registry SET identity_code_scope = 'TENANT' WHERE entity_type IN ('SALES_INVOICE', 'SALES_ORDER');")


def downgrade() -> None:
    # Drop unique index
    op.execute("DROP INDEX IF EXISTS uq_smriti_identity_alias_lower;")
