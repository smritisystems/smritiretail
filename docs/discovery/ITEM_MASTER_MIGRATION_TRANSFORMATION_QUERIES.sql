-- ITEM MASTER MIGRATION: Data Transformation Queries
-- Status: PRE-IMPLEMENTATION - Safe to test in staging, NOT to be run on production until approved
-- Date: 2026-09-01
-- Purpose: Transform legacy products/items/variants/barcodes into canonical item master schema

-- ============================================================================
-- PHASE 0: Setup Mapping and Staging Infrastructure
-- ============================================================================

-- Create migration staging schema
CREATE SCHEMA IF NOT EXISTS migration_v2_candidate;

-- Legacy → Canonical ID mapping table (for rollback traceability)
CREATE TABLE IF NOT EXISTS migration_v2_candidate.legacy_id_mapping (
  id BIGSERIAL PRIMARY KEY,
  legacy_table VARCHAR(100),
  legacy_id BIGINT,
  legacy_uuid UUID,
  canonical_table VARCHAR(100),
  canonical_id BIGINT,
  canonical_uuid UUID,
  migration_status VARCHAR(50) DEFAULT 'pending',  -- pending, migrated, validated
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_legacy_id_mapping_legacy ON migration_v2_candidate.legacy_id_mapping(
  legacy_table, legacy_id
);
CREATE INDEX idx_legacy_id_mapping_canonical ON migration_v2_candidate.legacy_id_mapping(
  canonical_table, canonical_id
);

-- ============================================================================
-- PHASE 1: Create Canonical Tables
-- ============================================================================

-- Note: Full DDL is in ITEM_MASTER_MIGRATION_PLAN_v1.md
-- This file focuses on data transformation logic

-- ============================================================================
-- PHASE 2: Data Migration Queries
-- ============================================================================

-- ============================================================================
-- Step 2.1: Consolidate and migrate products → items
-- ============================================================================
-- Logic: For each unique (company_id, code) in products, create one item record
-- If item already exists in items table, link but don't duplicate

-- Migration query: Create items from products
-- (Use DISTINCT to handle multiple products with same code)
INSERT INTO migration_v2_candidate.items (
  uuid,
  tenant_id,
  company_id,
  branch_id,
  code,
  name,
  description,
  category_id,
  brand_id,
  item_type,
  default_uom_id,
  default_tax_profile_id,
  hsn_code,
  sac_code,
  status,
  is_active,
  is_deleted,
  deleted_at,
  deleted_by,
  created_at,
  created_by,
  modified_at,
  modified_by,
  version
)
SELECT DISTINCT ON (p.company_id, p.code)
  COALESCE(i.uuid, gen_random_uuid()),
  p.tenant_id,
  p.company_id,
  p.branch_id,
  p.code,
  COALESCE(p.name, 'Unnamed Item'),
  p.description,
  p.category_id,
  p.brand_id,
  'product'::VARCHAR(50),
  NULL::BIGINT,  -- default_uom_id will be populated separately
  NULL::BIGINT,  -- default_tax_profile_id will be populated separately
  p.hsn_code,
  NULL::VARCHAR(20),  -- sac_code
  COALESCE(p.status, 'active'),
  COALESCE(p.is_active, true),
  COALESCE(p.is_deleted, false),
  CASE WHEN p.is_deleted THEN p.deleted_at ELSE NULL END,
  CASE WHEN p.is_deleted THEN p.deleted_by ELSE NULL END,
  COALESCE(p.created_at, CURRENT_TIMESTAMP),
  p.created_by,
  COALESCE(p.modified_at, CURRENT_TIMESTAMP),
  p.modified_by,
  1::BIGINT
FROM products p
LEFT JOIN items i ON i.company_id = p.company_id AND i.code = p.code
WHERE p.is_deleted = false
  AND i.id IS NULL  -- Only insert if item doesn't already exist
ORDER BY p.company_id, p.code, p.created_at DESC
ON CONFLICT DO NOTHING;

-- ============================================================================
-- Step 2.2: Migrate product variants → item_variants
-- ============================================================================
-- Logic: For each product, create or link an item_variant
-- Handle deduplication: if (item_id, variant_sku) already exists, log warning

INSERT INTO migration_v2_candidate.item_variants (
  uuid,
  item_id,
  tenant_id,
  company_id,
  branch_id,
  variant_code,
  variant_name,
  variant_sku,
  attributes_json,
  mrp,
  selling_price,
  cost_price,
  primary_barcode_id,
  status,
  is_active,
  is_deleted,
  deleted_at,
  deleted_by,
  created_at,
  created_by,
  modified_at,
  modified_by,
  version
)
SELECT
  p.uuid,
  i.id,
  p.tenant_id,
  p.company_id,
  p.branch_id,
  p.style_code,
  COALESCE(p.name, 'Variant'),
  p.sku,
  jsonb_build_object(
    'color', p.color,
    'size', p.size,
    'original_variant_id', p.variant_id
  ),
  p.mrp,
  p.price,
  p.cost_price,
  NULL::BIGINT,  -- primary_barcode_id will be populated after barcodes are created
  COALESCE(p.status, 'active'),
  COALESCE(p.is_active, true),
  COALESCE(p.is_deleted, false),
  CASE WHEN p.is_deleted THEN p.deleted_at ELSE NULL END,
  CASE WHEN p.is_deleted THEN p.deleted_by ELSE NULL END,
  COALESCE(p.created_at, CURRENT_TIMESTAMP),
  p.created_by,
  COALESCE(p.modified_at, CURRENT_TIMESTAMP),
  p.modified_by,
  1::BIGINT
FROM products p
INNER JOIN migration_v2_candidate.items i 
  ON i.company_id = p.company_id AND i.code = p.code
WHERE p.is_deleted = false
ON CONFLICT (uuid) DO NOTHING;

-- Track legacy → canonical mapping
INSERT INTO migration_v2_candidate.legacy_id_mapping (
  legacy_table, legacy_id, legacy_uuid,
  canonical_table, canonical_id, canonical_uuid,
  migration_status
)
SELECT
  'products'::VARCHAR(100),
  p.id,
  p.uuid,
  'item_variants'::VARCHAR(100),
  iv.id,
  iv.uuid,
  'migrated'::VARCHAR(50)
FROM products p
INNER JOIN migration_v2_candidate.items i 
  ON i.company_id = p.company_id AND i.code = p.code
INNER JOIN migration_v2_candidate.item_variants iv 
  ON iv.item_id = i.id AND iv.uuid = p.uuid
WHERE p.is_deleted = false
ON CONFLICT DO NOTHING;

-- ============================================================================
-- Step 2.3: Migrate barcodes → item_barcodes
-- ============================================================================
-- Logic:
-- 1. Primary barcode from products.barcode → item_barcodes with is_primary=true
-- 2. Secondary barcodes → item_barcodes with is_primary=false
-- 3. Barcodes from existing item_barcodes table → keep as-is, mark source='existing'

INSERT INTO migration_v2_candidate.item_barcodes (
  uuid,
  item_id,
  variant_id,
  tenant_id,
  company_id,
  branch_id,
  barcode,
  barcode_type,
  barcode_format,
  is_primary,
  is_active,
  source,
  created_at,
  created_by,
  modified_at,
  modified_by
)
SELECT
  gen_random_uuid(),
  i.id,
  iv.id,
  p.tenant_id,
  p.company_id,
  p.branch_id,
  p.barcode,
  'EAN13'::VARCHAR(50),
  'EAN13'::VARCHAR(50),
  true,  -- is_primary
  true,
  'legacy_products'::VARCHAR(100),
  COALESCE(p.created_at, CURRENT_TIMESTAMP),
  p.created_by,
  COALESCE(p.modified_at, CURRENT_TIMESTAMP),
  p.modified_by
FROM products p
INNER JOIN migration_v2_candidate.items i 
  ON i.company_id = p.company_id AND i.code = p.code
INNER JOIN migration_v2_candidate.item_variants iv 
  ON iv.item_id = i.id AND iv.uuid = p.uuid
WHERE p.is_deleted = false
  AND p.barcode IS NOT NULL
  AND p.barcode != ''
ON CONFLICT (tenant_id, company_id, barcode) DO NOTHING;

-- Secondary barcodes (if stored as delimited string or JSON array)
-- Adjust this logic based on actual storage format of secondary_barcodes in products
INSERT INTO migration_v2_candidate.item_barcodes (
  uuid,
  item_id,
  variant_id,
  tenant_id,
  company_id,
  branch_id,
  barcode,
  barcode_type,
  barcode_format,
  is_primary,
  is_active,
  source,
  created_at,
  created_by,
  modified_at,
  modified_by
)
SELECT
  gen_random_uuid(),
  i.id,
  iv.id,
  p.tenant_id,
  p.company_id,
  p.branch_id,
  trim(barcode_item),
  'EAN13'::VARCHAR(50),
  'EAN13'::VARCHAR(50),
  false,  -- is_primary
  true,
  'legacy_products'::VARCHAR(100),
  COALESCE(p.created_at, CURRENT_TIMESTAMP),
  p.created_by,
  COALESCE(p.modified_at, CURRENT_TIMESTAMP),
  p.modified_by
FROM products p
INNER JOIN migration_v2_candidate.items i 
  ON i.company_id = p.company_id AND i.code = p.code
INNER JOIN migration_v2_candidate.item_variants iv 
  ON iv.item_id = i.id AND iv.uuid = p.uuid
CROSS JOIN LATERAL (
  -- Split secondary_barcodes by comma (adjust delimiter as needed)
  SELECT unnest(string_to_array(p.secondary_barcodes, ',')) AS barcode_item
) AS sec_barcodes
WHERE p.is_deleted = false
  AND p.secondary_barcodes IS NOT NULL
  AND p.secondary_barcodes != ''
  AND trim(barcode_item) != ''
ON CONFLICT (tenant_id, company_id, barcode) DO NOTHING;

-- ============================================================================
-- Step 2.4: Migrate pricing → item_prices
-- ============================================================================
-- Logic: Create default price_book, then populate item_prices from products

-- Create default price book (one per company)
INSERT INTO migration_v2_candidate.price_books (
  uuid,
  tenant_id,
  company_id,
  name,
  code,
  currency,
  is_default,
  valid_from,
  valid_to,
  status,
  is_active,
  created_at,
  created_by,
  modified_at,
  modified_by
)
SELECT DISTINCT
  gen_random_uuid(),
  p.tenant_id,
  p.company_id,
  'Default Price Book'::VARCHAR(500),
  'DEFAULT'::VARCHAR(100),
  'INR'::VARCHAR(10),
  true,
  CURRENT_DATE,
  NULL::DATE,
  'active'::VARCHAR(50),
  true,
  CURRENT_TIMESTAMP,
  NULL::BIGINT,
  CURRENT_TIMESTAMP,
  NULL::BIGINT
FROM products p
WHERE p.is_deleted = false
ON CONFLICT DO NOTHING;

-- Insert pricing records
INSERT INTO migration_v2_candidate.item_prices (
  uuid,
  item_id,
  variant_id,
  tenant_id,
  company_id,
  branch_id,
  price_book_id,
  customer_tier_id,
  mrp,
  selling_price,
  cost_price,
  buying_price,
  discount_percent,
  discount_amount,
  scheme_id,
  valid_from,
  valid_to,
  is_active,
  created_at,
  created_by,
  modified_at,
  modified_by
)
SELECT
  gen_random_uuid(),
  i.id,
  iv.id,
  p.tenant_id,
  p.company_id,
  p.branch_id,
  pb.id,
  NULL::BIGINT,
  p.mrp,
  p.price,
  p.cost_price,
  p.buying_price,
  NULL::NUMERIC,
  NULL::NUMERIC,
  NULL::BIGINT,
  CURRENT_DATE,
  NULL::DATE,
  true,
  COALESCE(p.created_at, CURRENT_TIMESTAMP),
  p.created_by,
  COALESCE(p.modified_at, CURRENT_TIMESTAMP),
  p.modified_by
FROM products p
INNER JOIN migration_v2_candidate.items i 
  ON i.company_id = p.company_id AND i.code = p.code
INNER JOIN migration_v2_candidate.item_variants iv 
  ON iv.item_id = i.id AND iv.uuid = p.uuid
INNER JOIN migration_v2_candidate.price_books pb
  ON pb.company_id = p.company_id AND pb.is_default = true
WHERE p.is_deleted = false
ON CONFLICT DO NOTHING;

-- ============================================================================
-- Step 2.5: Migrate stock → item_stock
-- ============================================================================
-- Logic: Aggregate stock from products and product_batch_stocks

INSERT INTO migration_v2_candidate.item_stock (
  uuid,
  item_id,
  variant_id,
  tenant_id,
  company_id,
  warehouse_id,
  quantity_on_hand,
  quantity_reserved,
  batch_no,
  expiry_date,
  manufacturing_date,
  quantity_damaged,
  quantity_returned,
  last_movement_at,
  created_at,
  modified_at
)
SELECT
  gen_random_uuid(),
  i.id,
  iv.id,
  pbs.tenant_id,
  pbs.company_id,
  pbs.warehouse_id,
  pbs.quantity,
  pbs.reserved_quantity,
  pbs.batch_no,
  pbs.expiry_date,
  pbs.manufacturing_date,
  pbs.damaged_quantity,
  NULL::NUMERIC,
  COALESCE(pbs.modified_at, CURRENT_TIMESTAMP),
  pbs.created_at,
  pbs.modified_at
FROM product_batch_stocks pbs
INNER JOIN products p ON pbs.product_id = p.id
INNER JOIN migration_v2_candidate.items i 
  ON i.company_id = p.company_id AND i.code = p.code
INNER JOIN migration_v2_candidate.item_variants iv 
  ON iv.item_id = i.id AND iv.uuid = p.uuid
WHERE p.is_deleted = false
ON CONFLICT (tenant_id, company_id, item_id, variant_id, warehouse_id, batch_no) 
DO NOTHING;

-- ============================================================================
-- Step 2.6: Migrate media (images) → item_media
-- ============================================================================

INSERT INTO migration_v2_candidate.item_media (
  uuid,
  item_id,
  variant_id,
  tenant_id,
  company_id,
  media_url,
  media_type,
  is_primary,
  display_order,
  created_at
)
SELECT
  gen_random_uuid(),
  i.id,
  iv.id,
  p.tenant_id,
  p.company_id,
  p.primary_image_url,
  'image'::VARCHAR(50),
  true,
  0::SMALLINT,
  COALESCE(p.created_at, CURRENT_TIMESTAMP)
FROM products p
INNER JOIN migration_v2_candidate.items i 
  ON i.company_id = p.company_id AND i.code = p.code
INNER JOIN migration_v2_candidate.item_variants iv 
  ON iv.item_id = i.id AND iv.uuid = p.uuid
WHERE p.is_deleted = false
  AND p.primary_image_url IS NOT NULL
  AND p.primary_image_url != ''
ON CONFLICT DO NOTHING;

-- Gallery images (if stored as JSON array or delimited string)
INSERT INTO migration_v2_candidate.item_media (
  uuid,
  item_id,
  variant_id,
  tenant_id,
  company_id,
  media_url,
  media_type,
  is_primary,
  display_order,
  created_at
)
SELECT
  gen_random_uuid(),
  i.id,
  iv.id,
  p.tenant_id,
  p.company_id,
  trim(image_url),
  'image'::VARCHAR(50),
  false,
  row_number() OVER (PARTITION BY p.id ORDER BY gallery_pos)::SMALLINT,
  COALESCE(p.created_at, CURRENT_TIMESTAMP)
FROM products p
INNER JOIN migration_v2_candidate.items i 
  ON i.company_id = p.company_id AND i.code = p.code
INNER JOIN migration_v2_candidate.item_variants iv 
  ON iv.item_id = i.id AND iv.uuid = p.uuid
CROSS JOIN LATERAL (
  SELECT 
    row_number() OVER (ORDER BY pos) as gallery_pos,
    trim(gallery_item) AS image_url
  FROM (
    SELECT 
      generate_subscripts(string_to_array(p.gallery_images, ','), 1) as pos,
      string_to_array(p.gallery_images, ',')[generate_subscripts(string_to_array(p.gallery_images, ','), 1)] as gallery_item
  ) AS t
) AS gallery
WHERE p.is_deleted = false
  AND p.gallery_images IS NOT NULL
  AND p.gallery_images != ''
  AND trim(image_url) != ''
ON CONFLICT DO NOTHING;

-- ============================================================================
-- Step 2.7: Migrate attributes → item_attributes
-- ============================================================================

INSERT INTO migration_v2_candidate.item_attributes (
  uuid,
  item_id,
  variant_id,
  tenant_id,
  company_id,
  attribute_key,
  attribute_value,
  value_type,
  category_id
)
SELECT
  gen_random_uuid(),
  i.id,
  iv.id,
  p.tenant_id,
  p.company_id,
  'color'::VARCHAR(100),
  p.color,
  'string'::VARCHAR(50),
  p.category_id
FROM products p
INNER JOIN migration_v2_candidate.items i 
  ON i.company_id = p.company_id AND i.code = p.code
INNER JOIN migration_v2_candidate.item_variants iv 
  ON iv.item_id = i.id AND iv.uuid = p.uuid
WHERE p.is_deleted = false AND p.color IS NOT NULL
ON CONFLICT (item_id, variant_id, attribute_key) DO NOTHING;

INSERT INTO migration_v2_candidate.item_attributes (
  uuid,
  item_id,
  variant_id,
  tenant_id,
  company_id,
  attribute_key,
  attribute_value,
  value_type,
  category_id
)
SELECT
  gen_random_uuid(),
  i.id,
  iv.id,
  p.tenant_id,
  p.company_id,
  'size'::VARCHAR(100),
  p.size,
  'string'::VARCHAR(50),
  p.category_id
FROM products p
INNER JOIN migration_v2_candidate.items i 
  ON i.company_id = p.company_id AND i.code = p.code
INNER JOIN migration_v2_candidate.item_variants iv 
  ON iv.item_id = i.id AND iv.uuid = p.uuid
WHERE p.is_deleted = false AND p.size IS NOT NULL
ON CONFLICT (item_id, variant_id, attribute_key) DO NOTHING;

-- ============================================================================
-- PHASE 3: Validation Queries (see ITEM_MASTER_MIGRATION_VALIDATION.sql)
-- ============================================================================

-- Final verification: count records in canonical tables
SELECT
  'items' AS table_name,
  COUNT(*) AS record_count
FROM migration_v2_candidate.items
UNION ALL
SELECT 'item_variants', COUNT(*) FROM migration_v2_candidate.item_variants
UNION ALL
SELECT 'item_barcodes', COUNT(*) FROM migration_v2_candidate.item_barcodes
UNION ALL
SELECT 'item_prices', COUNT(*) FROM migration_v2_candidate.item_prices
UNION ALL
SELECT 'item_stock', COUNT(*) FROM migration_v2_candidate.item_stock
UNION ALL
SELECT 'item_attributes', COUNT(*) FROM migration_v2_candidate.item_attributes
UNION ALL
SELECT 'item_media', COUNT(*) FROM migration_v2_candidate.item_media
ORDER BY table_name;

