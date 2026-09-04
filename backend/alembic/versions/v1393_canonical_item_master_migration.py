"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 1.0.0
Created      : 2026-09-01
Modified     : 2026-09-01
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Canonical Schema Migration
"""

from alembic import op
import sqlalchemy as sa

revision = "v1393_canonical_item_master_migration"
down_revision = "v1392_users_column_widths"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Create legacy_id_mappings table
    op.execute("""
        CREATE TABLE IF NOT EXISTS legacy_id_mappings (
            id VARCHAR(50) PRIMARY KEY,
            uuid VARCHAR(36) NOT NULL,
            company_id VARCHAR(50),
            branch_id VARCHAR(50),
            created_at TIMESTAMPTZ DEFAULT NOW(),
            modified_at TIMESTAMPTZ DEFAULT NOW(),
            created_by VARCHAR(100),
            updated_by VARCHAR(100),
            is_active BOOLEAN DEFAULT TRUE,
            is_deleted BOOLEAN DEFAULT FALSE,
            deleted_at TIMESTAMPTZ,
            deleted_by VARCHAR(100),
            version INTEGER DEFAULT 1,
            migration_run_id VARCHAR(50) NOT NULL,
            legacy_table VARCHAR(50) NOT NULL,
            legacy_id VARCHAR(50) NOT NULL,
            legacy_uuid VARCHAR(36),
            canonical_table VARCHAR(50) NOT NULL,
            canonical_id VARCHAR(50) NOT NULL,
            canonical_uuid VARCHAR(36),
            disposition VARCHAR(50) NOT NULL DEFAULT 'MIGRATED',
            conflict_reason TEXT,
            audit_checksum VARCHAR(64),
            CONSTRAINT uq_legacy_mapping_source UNIQUE (legacy_table, legacy_id)
        );
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_legacy_mappings_run ON legacy_id_mappings (migration_run_id);")
    op.execute("CREATE INDEX IF NOT EXISTS ix_legacy_mappings_legacy ON legacy_id_mappings (legacy_table, legacy_id);")
    op.execute("CREATE INDEX IF NOT EXISTS ix_legacy_mappings_canonical ON legacy_id_mappings (canonical_table, canonical_id);")

    # 2. Scope item uniqueness constraints by company_id per Rule 16 & make optional attributes nullable
    # Older installations may have the canonical items table without this optional column.
    op.execute("ALTER TABLE IF EXISTS items ADD COLUMN IF NOT EXISTS primary_uom VARCHAR(20);")
    op.execute("ALTER TABLE IF EXISTS items ALTER COLUMN primary_uom DROP NOT NULL;")
    op.execute("ALTER TABLE IF EXISTS items ALTER COLUMN category DROP NOT NULL;")
    op.execute("ALTER TABLE IF EXISTS item_variants ADD COLUMN IF NOT EXISTS hsn_code VARCHAR(15);")
    op.execute("ALTER TABLE IF EXISTS item_variants ADD COLUMN IF NOT EXISTS tax_rate NUMERIC(5, 2);")
    op.execute("ALTER TABLE IF EXISTS items DROP CONSTRAINT IF EXISTS items_item_code_key;")
    op.execute("ALTER TABLE IF EXISTS item_variants DROP CONSTRAINT IF EXISTS item_variants_variant_sku_key;")
    op.execute("ALTER TABLE IF EXISTS item_barcodes DROP CONSTRAINT IF EXISTS uq_item_barcode_value;")

    op.execute("CREATE UNIQUE INDEX IF NOT EXISTS uq_items_company_item_code ON items (company_id, item_code) WHERE (is_deleted = false);")
    op.execute("CREATE UNIQUE INDEX IF NOT EXISTS uq_variants_company_sku ON item_variants (company_id, variant_sku) WHERE (is_deleted = false);")
    op.execute("CREATE UNIQUE INDEX IF NOT EXISTS uq_barcodes_company_barcode ON item_barcodes (company_id, barcode) WHERE (is_deleted = false);")


def downgrade() -> None:
    # 1. Drop tenant-scoped unique indexes
    op.execute("DROP INDEX IF EXISTS uq_items_company_item_code;")
    op.execute("DROP INDEX IF EXISTS uq_variants_company_sku;")
    op.execute("DROP INDEX IF EXISTS uq_barcodes_company_barcode;")

    # 2. Drop variant-level statutory columns
    op.execute("ALTER TABLE IF EXISTS item_variants DROP COLUMN IF EXISTS hsn_code;")
    op.execute("ALTER TABLE IF EXISTS item_variants DROP COLUMN IF EXISTS tax_rate;")

    # 3. Restore global uniqueness constraints
    op.execute("ALTER TABLE IF EXISTS items ADD CONSTRAINT items_item_code_key UNIQUE (item_code);")
    op.execute("ALTER TABLE IF EXISTS item_variants ADD CONSTRAINT item_variants_variant_sku_key UNIQUE (variant_sku);")
    op.execute("ALTER TABLE IF EXISTS item_barcodes ADD CONSTRAINT uq_item_barcode_value UNIQUE (barcode);")

    # 4. Drop legacy_id_mappings table
    op.execute("DROP TABLE IF EXISTS legacy_id_mappings CASCADE;")
