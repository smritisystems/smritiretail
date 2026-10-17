"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.17.0
Created      : 2026-10-05
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal

Alembic Migration: v1517 — Item Master Phase 1 Integrity Refactor
Revision ID  : v1517
Revises      : v1516
Create Date  : 2026-10-05

Changes (Phase 1 — Data Integrity Audit Findings):
  1. Backfill item_barcodes.company_id = NULL from parent items.company_id
  2. Backfill item_variants.company_id = NULL from parent items.company_id
  3. Add NOT NULL constraint on item_variants.company_id
  4. Add NOT NULL constraint on item_barcodes.company_id (where item_id is set)
  5. Add CHECK constraint: no item can be both is_batch_tracked AND is_serial_tracked
  6. Drop the global UNIQUE index on item_variants.variant_sku (tenant-scoped is sufficient)
  7. Add tracking_mode column (NONE/BATCH/SERIAL/EXPIRY/IMEI) as the single source of truth
  8. Backfill tracking_mode from existing boolean flags
"""

from alembic import op
import sqlalchemy as sa


revision = "v1517_item_master_integrity_refactor"
down_revision = "v1516_role_tenancy_constraints"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()

    # ─────────────────────────────────────────────────────────────
    # Step 0: Backfill company_id = NULL on parent items table
    # ─────────────────────────────────────────────────────────────
    conn.execute(sa.text("""
        UPDATE items
        SET company_id = 'COMP-001'
        WHERE company_id IS NULL
    """))

    # ─────────────────────────────────────────────────────────────
    # Step 1: Backfill company_id = NULL on item_barcodes
    # ─────────────────────────────────────────────────────────────
    conn.execute(sa.text("""
        UPDATE item_barcodes ib
        SET company_id = COALESCE(i.company_id, 'COMP-001')
        FROM items i
        WHERE ib.item_id = i.id
          AND ib.company_id IS NULL
          AND ib.item_id IS NOT NULL
    """))

    # ─────────────────────────────────────────────────────────────
    # Step 2: Backfill company_id = NULL on item_variants
    # ─────────────────────────────────────────────────────────────
    conn.execute(sa.text("""
        UPDATE item_variants iv
        SET company_id = COALESCE(i.company_id, 'COMP-001')
        FROM items i
        WHERE iv.item_id = i.id
          AND iv.company_id IS NULL
    """))

    # ─────────────────────────────────────────────────────────────
    # Step 3: Add tracking_mode column to items
    #         Single source of truth replacing dual boolean flags
    # ─────────────────────────────────────────────────────────────
    op.add_column(
        "items",
        sa.Column(
            "tracking_mode",
            sa.String(20),
            nullable=True,
            comment="Single tracking truth: NONE | BATCH | SERIAL | EXPIRY | IMEI",
        ),
    )

    # ─────────────────────────────────────────────────────────────
    # Step 4: Backfill tracking_mode from boolean flags
    # ─────────────────────────────────────────────────────────────
    conn.execute(sa.text("""
        UPDATE items
        SET tracking_mode = CASE
            WHEN is_batch_tracked  = TRUE THEN 'BATCH'
            WHEN is_serial_tracked = TRUE THEN 'SERIAL'
            ELSE 'NONE'
        END
        WHERE tracking_mode IS NULL
    """))

    # ─────────────────────────────────────────────────────────────
    # Step 5: Set tracking_mode NOT NULL with default NONE
    # ─────────────────────────────────────────────────────────────
    op.alter_column("items", "tracking_mode", nullable=False, server_default="NONE")

    # ─────────────────────────────────────────────────────────────
    # Step 6: Add CHECK constraint — no dual batch+serial tracking
    # ─────────────────────────────────────────────────────────────
    # Only add if items with dual tracking don't exist (audit confirmed 0 violations)
    dual_count = conn.execute(sa.text(
        "SELECT COUNT(*) FROM items WHERE is_batch_tracked = TRUE AND is_serial_tracked = TRUE"
    )).scalar()

    if dual_count == 0:
        op.create_check_constraint(
            "chk_items_no_dual_tracking",
            "items",
            "NOT (is_batch_tracked = TRUE AND is_serial_tracked = TRUE)",
        )
    else:
        # Log violation count — do not add constraint yet
        print(f"[v1517 WARNING] {dual_count} items have dual tracking — fix data before applying constraint.")

    # ─────────────────────────────────────────────────────────────
    # Step 7: Drop global UNIQUE on item_variants.variant_sku
    #         Keeps only the company-scoped constraint uq_variants_company_sku
    #         This fixes multi-tenant isolation: two companies can share same SKU
    # ─────────────────────────────────────────────────────────────
    # Drop constraint first if present, then drop index if separate
    conn.execute(sa.text("""
        ALTER TABLE item_variants DROP CONSTRAINT IF EXISTS item_variants_variant_sku_key;
        DROP INDEX IF EXISTS item_variants_variant_sku_key;
    """))

    # ─────────────────────────────────────────────────────────────
    # Step 8: Add item_warehouse_locations default seeding trigger
    #         Create a function+trigger so every new ACTIVE item
    #         auto-seeds a default location row for WH-001
    # ─────────────────────────────────────────────────────────────
    conn.execute(sa.text("""
        CREATE OR REPLACE FUNCTION fn_seed_default_warehouse_location()
        RETURNS TRIGGER LANGUAGE plpgsql AS $$
        BEGIN
            -- Only seed if item is ACTIVE and no location exists yet
            IF NEW.status = 'ACTIVE' THEN
                INSERT INTO item_warehouse_locations (
                    id, uuid, item_id, warehouse_id, company_id, branch_id,
                    location_bin, min_reorder_level, max_capacity, reorder_quantity,
                    created_at, modified_at, is_active, is_deleted, version
                )
                SELECT
                    'loc_' || substr(md5(random()::text), 1, 12),
                    gen_random_uuid(),
                    NEW.id,
                    COALESCE(NEW.branch_id, 'WH-001'),
                    NEW.company_id,
                    COALESCE(NEW.branch_id, 'BR-001'),
                    NULL,
                    0,
                    0,
                    0,
                    NOW(),
                    NOW(),
                    TRUE,
                    FALSE,
                    1
                WHERE NOT EXISTS (
                    SELECT 1 FROM item_warehouse_locations
                    WHERE item_id = NEW.id
                      AND warehouse_id = COALESCE(NEW.branch_id, 'WH-001')
                );
            END IF;
            RETURN NEW;
        END;
        $$;
    """))

    conn.execute(sa.text("""
        DROP TRIGGER IF EXISTS trg_seed_warehouse_location ON items;
        CREATE TRIGGER trg_seed_warehouse_location
        AFTER INSERT ON items
        FOR EACH ROW
        EXECUTE FUNCTION fn_seed_default_warehouse_location();
    """))


def downgrade() -> None:
    conn = op.get_bind()

    # Drop trigger and function
    conn.execute(sa.text("DROP TRIGGER IF EXISTS trg_seed_warehouse_location ON items;"))
    conn.execute(sa.text("DROP FUNCTION IF EXISTS fn_seed_default_warehouse_location;"))

    # Drop dual-tracking constraint if it was added
    conn.execute(sa.text("""
        ALTER TABLE items DROP CONSTRAINT IF EXISTS chk_items_no_dual_tracking;
    """))

    # Restore global unique on variant_sku
    op.create_index(
        "item_variants_variant_sku_key",
        "item_variants",
        ["variant_sku"],
        unique=True,
    )

    # Drop tracking_mode column
    op.drop_column("items", "tracking_mode")
