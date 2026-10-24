"""SMRITI Retail OS Item Master Phase 2: UOM, Pricing, Tax, Purchasing, Sales, Inventory Policies

Revision ID: v1519_item_master_phase2_uom_pricing_tax_policies
Revises: v1518_sku_barcode_architecture_refactor
Create Date: 2026-10-05

Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.70.0
Copyright    : (C) SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal

Architecture Invariants Enforced:
1. item_variants.id remains technical PK and 1-to-1 anchor for all extension settings.
2. item_variants.variant_sku remains canonical business identity.
3. item_barcodes remains lookup registry.
4. ZERO physical stock is stored in any of these policy tables.
5. Footwear statutory UOM 'PRS' (and legacy alias 'PAIR') seeded in uoms_ref.
6. All migrations are fully tenant-isolated and reversible.
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB
from decimal import Decimal


revision = "v1519_item_master_phase2_uom_pricing_tax_policies"
down_revision = "v1518_sku_barcode_architecture_refactor"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()

    # ─────────────────────────────────────────────────────────────
    # Step 1: Seed Statutory Footwear UOM 'PRS' & Alias 'PAIR' in uoms_ref
    # ─────────────────────────────────────────────────────────────
    conn.execute(sa.text("""
        INSERT INTO uoms_ref (id, code, name, category, uqc_code, decimal_allowed, is_active, created_at)
        VALUES 
            ('uom_prs', 'PRS', 'Pairs', 'COUNT', 'PRS', false, true, NOW()),
            ('uom_pair', 'PAIR', 'Pair (Legacy Alias)', 'COUNT', 'PRS', false, true, NOW())
        ON CONFLICT (code) DO NOTHING;
    """))

    # ─────────────────────────────────────────────────────────────
    # Step 2: Create item_uom_settings Table
    # ─────────────────────────────────────────────────────────────
    conn.execute(sa.text("""
        CREATE TABLE IF NOT EXISTS item_uom_settings (
            item_variant_id VARCHAR(50) PRIMARY KEY REFERENCES item_variants(id) ON DELETE CASCADE,
            company_id VARCHAR(50) NOT NULL,
            branch_id VARCHAR(50),
            stock_uom_id VARCHAR(50) NOT NULL REFERENCES uoms_ref(id) ON DELETE RESTRICT,
            sales_uom_id VARCHAR(50) REFERENCES uoms_ref(id) ON DELETE RESTRICT,
            purchase_uom_id VARCHAR(50) REFERENCES uoms_ref(id) ON DELETE RESTRICT,
            conversion_factor NUMERIC(18, 6) NOT NULL DEFAULT 1.000000,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            modified_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            CONSTRAINT chk_ius_conversion_factor_positive CHECK (conversion_factor > 0)
        );
        CREATE INDEX IF NOT EXISTS idx_ius_company_id ON item_uom_settings (company_id);
    """))

    # ─────────────────────────────────────────────────────────────
    # Step 3: Create item_prices Table
    # ─────────────────────────────────────────────────────────────
    conn.execute(sa.text("""
        CREATE TABLE IF NOT EXISTS item_prices (
            item_variant_id VARCHAR(50) PRIMARY KEY REFERENCES item_variants(id) ON DELETE CASCADE,
            company_id VARCHAR(50) NOT NULL,
            branch_id VARCHAR(50),
            cost_price NUMERIC(15, 2) DEFAULT 0.00,
            selling_price NUMERIC(15, 2) DEFAULT 0.00,
            mrp NUMERIC(15, 2) DEFAULT 0.00,
            dealer_price NUMERIC(15, 2),
            wholesale_price NUMERIC(15, 2),
            minimum_selling_price NUMERIC(15, 2),
            maximum_discount_percent NUMERIC(5, 2) DEFAULT 0.00,
            currency VARCHAR(10) NOT NULL DEFAULT 'INR',
            effective_from TIMESTAMPTZ,
            effective_to TIMESTAMPTZ,
            is_active BOOLEAN NOT NULL DEFAULT true,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            modified_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            CONSTRAINT chk_ip_selling_price_non_neg CHECK (selling_price >= 0),
            CONSTRAINT chk_ip_mrp_non_neg CHECK (mrp >= 0),
            CONSTRAINT chk_ip_discount_pct_range CHECK (
                maximum_discount_percent IS NULL OR (maximum_discount_percent >= 0 AND maximum_discount_percent <= 100)
            )
        );
        CREATE INDEX IF NOT EXISTS idx_ip_company_id ON item_prices (company_id);
    """))

    # ─────────────────────────────────────────────────────────────
    # Step 4: Create item_tax_profiles Table
    # ─────────────────────────────────────────────────────────────
    conn.execute(sa.text("""
        CREATE TABLE IF NOT EXISTS item_tax_profiles (
            item_variant_id VARCHAR(50) PRIMARY KEY REFERENCES item_variants(id) ON DELETE CASCADE,
            company_id VARCHAR(50) NOT NULL,
            branch_id VARCHAR(50),
            hsn_sac_code VARCHAR(20),
            tax_category VARCHAR(50),
            gst_rate NUMERIC(6, 2),
            tax_inclusive BOOLEAN NOT NULL DEFAULT true,
            sales_tax_rate NUMERIC(6, 2),
            purchase_tax_rate NUMERIC(6, 2),
            tax_exempt BOOLEAN NOT NULL DEFAULT false,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            modified_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_itp_company_id ON item_tax_profiles (company_id);
        CREATE INDEX IF NOT EXISTS idx_itp_hsn ON item_tax_profiles (hsn_sac_code);
    """))

    # ─────────────────────────────────────────────────────────────
    # Step 5: Create item_supplier_settings Table
    # ─────────────────────────────────────────────────────────────
    conn.execute(sa.text("""
        CREATE TABLE IF NOT EXISTS item_supplier_settings (
            item_variant_id VARCHAR(50) PRIMARY KEY REFERENCES item_variants(id) ON DELETE CASCADE,
            company_id VARCHAR(50) NOT NULL,
            branch_id VARCHAR(50),
            preferred_supplier_id VARCHAR(50) REFERENCES suppliers(id) ON DELETE SET NULL,
            supplier_item_code VARCHAR(100),
            purchase_uom_id VARCHAR(50) REFERENCES uoms_ref(id) ON DELETE RESTRICT,
            minimum_purchase_qty NUMERIC(12, 4) DEFAULT 1.0000,
            purchase_cost NUMERIC(15, 2),
            last_purchase_price NUMERIC(15, 2),
            purchase_lead_time INTEGER DEFAULT 0,
            is_active BOOLEAN NOT NULL DEFAULT true,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            modified_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            CONSTRAINT chk_iss_min_purchase_qty CHECK (
                minimum_purchase_qty IS NULL OR minimum_purchase_qty > 0
            ),
            CONSTRAINT chk_iss_lead_time_non_neg CHECK (
                purchase_lead_time IS NULL OR purchase_lead_time >= 0
            )
        );
        CREATE INDEX IF NOT EXISTS idx_iss_company_id ON item_supplier_settings (company_id);
        CREATE INDEX IF NOT EXISTS idx_iss_supplier ON item_supplier_settings (preferred_supplier_id);
    """))

    # ─────────────────────────────────────────────────────────────
    # Step 6: Create item_sales_settings Table
    # ─────────────────────────────────────────────────────────────
    conn.execute(sa.text("""
        CREATE TABLE IF NOT EXISTS item_sales_settings (
            item_variant_id VARCHAR(50) PRIMARY KEY REFERENCES item_variants(id) ON DELETE CASCADE,
            company_id VARCHAR(50) NOT NULL,
            branch_id VARCHAR(50),
            sales_uom_id VARCHAR(50) REFERENCES uoms_ref(id) ON DELETE RESTRICT,
            selling_price NUMERIC(15, 2) DEFAULT 0.00,
            mrp NUMERIC(15, 2) DEFAULT 0.00,
            wholesale_price NUMERIC(15, 2),
            minimum_selling_price NUMERIC(15, 2),
            maximum_discount_percent NUMERIC(5, 2) DEFAULT 0.00,
            allow_discount BOOLEAN NOT NULL DEFAULT true,
            billable BOOLEAN NOT NULL DEFAULT true,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            modified_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            CONSTRAINT chk_isales_selling_price_non_neg CHECK (selling_price >= 0),
            CONSTRAINT chk_isales_discount_pct_range CHECK (
                maximum_discount_percent IS NULL OR (maximum_discount_percent >= 0 AND maximum_discount_percent <= 100)
            )
        );
        CREATE INDEX IF NOT EXISTS idx_isales_company_id ON item_sales_settings (company_id);
    """))

    # ─────────────────────────────────────────────────────────────
    # Step 7: Create item_inventory_policies Table (Strict Policy Only)
    # ─────────────────────────────────────────────────────────────
    conn.execute(sa.text("""
        CREATE TABLE IF NOT EXISTS item_inventory_policies (
            item_variant_id VARCHAR(50) PRIMARY KEY REFERENCES item_variants(id) ON DELETE CASCADE,
            company_id VARCHAR(50) NOT NULL,
            branch_id VARCHAR(50),
            minimum_stock NUMERIC(12, 4) NOT NULL DEFAULT 0.0000,
            reorder_level NUMERIC(12, 4) NOT NULL DEFAULT 0.0000,
            reorder_quantity NUMERIC(12, 4) NOT NULL DEFAULT 0.0000,
            maximum_stock NUMERIC(12, 4) NOT NULL DEFAULT 0.0000,
            safety_stock NUMERIC(12, 4) NOT NULL DEFAULT 0.0000,
            lead_time INTEGER NOT NULL DEFAULT 0,
            preferred_supplier_id VARCHAR(50) REFERENCES suppliers(id) ON DELETE SET NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            modified_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            CONSTRAINT chk_iip_min_stock CHECK (minimum_stock >= 0),
            CONSTRAINT chk_iip_reorder_level CHECK (reorder_level >= 0),
            CONSTRAINT chk_iip_reorder_qty CHECK (reorder_quantity >= 0),
            CONSTRAINT chk_iip_max_stock CHECK (maximum_stock >= 0),
            CONSTRAINT chk_iip_safety_stock CHECK (safety_stock >= 0),
            CONSTRAINT chk_iip_lead_time CHECK (lead_time >= 0),
            CONSTRAINT chk_iip_reorder_lte_max CHECK (maximum_stock = 0 OR reorder_level <= maximum_stock)
        );
        CREATE INDEX IF NOT EXISTS idx_iip_company_id ON item_inventory_policies (company_id);
        CREATE INDEX IF NOT EXISTS idx_iip_supplier ON item_inventory_policies (preferred_supplier_id);
    """))


def downgrade() -> None:
    conn = op.get_bind()

    # Drop tables in reverse dependency order
    conn.execute(sa.text("DROP TABLE IF EXISTS item_inventory_policies CASCADE;"))
    conn.execute(sa.text("DROP TABLE IF EXISTS item_sales_settings CASCADE;"))
    conn.execute(sa.text("DROP TABLE IF EXISTS item_supplier_settings CASCADE;"))
    conn.execute(sa.text("DROP TABLE IF EXISTS item_tax_profiles CASCADE;"))
    conn.execute(sa.text("DROP TABLE IF EXISTS item_prices CASCADE;"))
    conn.execute(sa.text("DROP TABLE IF EXISTS item_uom_settings CASCADE;"))
