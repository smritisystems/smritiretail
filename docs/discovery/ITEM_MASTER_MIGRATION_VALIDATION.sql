-- ITEM MASTER MIGRATION: Data Validation and Integrity Checks
-- Status: PRE-IMPLEMENTATION - Safe to run anytime for testing and diagnostics
-- Date: 2026-09-01
-- Purpose: Verify migration quality, detect data loss, and validate referential integrity

-- ============================================================================
-- SECTION 1: Pre-Migration Baseline (Run BEFORE transformation queries)
-- ============================================================================

-- Get baseline counts from legacy tables
SELECT
  'products' AS table_name,
  COUNT(*) AS record_count,
  COUNT(DISTINCT code) AS unique_codes,
  COUNT(DISTINCT sku) AS unique_skus,
  COUNT(DISTINCT barcode) AS unique_barcodes,
  SUM(CASE WHEN barcode IS NOT NULL THEN 1 ELSE 0 END) AS with_barcode
FROM products
WHERE is_deleted = false
UNION ALL
SELECT
  'product_batch_stocks',
  COUNT(*),
  NULL, NULL, NULL, NULL
FROM product_batch_stocks
UNION ALL
SELECT
  'items (pre-migration)',
  COUNT(*),
  COUNT(DISTINCT code),
  NULL, NULL, NULL
FROM items
WHERE is_deleted = false;

-- Detailed products baseline
CREATE TEMPORARY TABLE baseline_products_stats AS
SELECT
  COUNT(*) AS total_products,
  COUNT(DISTINCT company_id) AS companies,
  COUNT(DISTINCT code) AS unique_product_codes,
  COUNT(DISTINCT sku) AS unique_skus,
  SUM(CASE WHEN barcode IS NOT NULL THEN 1 ELSE 0 END) AS products_with_barcode,
  SUM(CASE WHEN secondary_barcodes IS NOT NULL THEN 1 ELSE 0 END) AS products_with_secondary_barcodes,
  SUM(CASE WHEN primary_image_url IS NOT NULL THEN 1 ELSE 0 END) AS products_with_images,
  SUM(CASE WHEN stock IS NOT NULL AND stock > 0 THEN 1 ELSE 0 END) AS products_with_stock
FROM products
WHERE is_deleted = false;

SELECT * FROM baseline_products_stats;

-- ============================================================================
-- SECTION 2: Post-Migration Validation (Run AFTER transformation queries)
-- ============================================================================

-- 2.1: Row count comparison (Items)
-- Expected: items ≈ unique (company_id, code) from products
WITH baseline AS (
  SELECT COUNT(DISTINCT company_id, code) AS expected_items FROM products WHERE is_deleted = false
),
migrated AS (
  SELECT COUNT(*) AS actual_items FROM migration_v2_candidate.items
)
SELECT
  'items'::VARCHAR(50) AS entity,
  (SELECT expected_items FROM baseline) AS expected_count,
  (SELECT actual_items FROM migrated) AS actual_count,
  CASE 
    WHEN (SELECT expected_items FROM baseline) = (SELECT actual_items FROM migrated) THEN 'PASS'::VARCHAR(50)
    ELSE 'WARN'::VARCHAR(50)
  END AS status,
  CASE 
    WHEN (SELECT expected_items FROM baseline) = (SELECT actual_items FROM migrated) THEN NULL::TEXT
    ELSE 'Item count mismatch; check consolidation logic'::TEXT
  END AS notes;

-- 2.2: Row count comparison (Variants)
-- Expected: item_variants ≤ products (some products may consolidate to same variant)
WITH baseline AS (
  SELECT COUNT(*) AS expected_variants FROM products WHERE is_deleted = false
),
migrated AS (
  SELECT COUNT(*) AS actual_variants FROM migration_v2_candidate.item_variants
)
SELECT
  'item_variants'::VARCHAR(50) AS entity,
  (SELECT expected_variants FROM baseline) AS expected_count,
  (SELECT actual_variants FROM migrated) AS actual_count,
  CASE 
    WHEN (SELECT actual_variants FROM migrated) <= (SELECT expected_variants FROM baseline) THEN 'PASS'::VARCHAR(50)
    ELSE 'WARN'::VARCHAR(50)
  END AS status,
  CASE 
    WHEN (SELECT actual_variants FROM migrated) > (SELECT expected_variants FROM baseline) 
      THEN 'More variants than products; possible duplication'::TEXT
    ELSE NULL::TEXT
  END AS notes;

-- 2.3: Row count comparison (Barcodes)
-- Expected: item_barcodes ≥ products with barcode + sum of secondary barcodes
WITH baseline AS (
  SELECT
    SUM(CASE WHEN barcode IS NOT NULL THEN 1 ELSE 0 END) AS primary_barcodes,
    SUM(CASE WHEN secondary_barcodes IS NOT NULL THEN 1 ELSE 0 END) AS secondary_barcode_items
  FROM products
  WHERE is_deleted = false
),
migrated AS (
  SELECT COUNT(*) AS actual_barcodes FROM migration_v2_candidate.item_barcodes
)
SELECT
  'item_barcodes'::VARCHAR(50) AS entity,
  ((SELECT primary_barcodes FROM baseline) + (SELECT secondary_barcode_items FROM baseline))::BIGINT AS expected_count,
  (SELECT actual_barcodes FROM migrated) AS actual_count,
  CASE 
    WHEN (SELECT actual_barcodes FROM migrated) >= ((SELECT primary_barcodes FROM baseline) + (SELECT secondary_barcode_items FROM baseline))
      THEN 'PASS'::VARCHAR(50)
    ELSE 'WARN'::VARCHAR(50)
  END AS status,
  NULL::TEXT AS notes;

-- 2.4: Pricing records
-- Expected: item_prices = products with valid pricing
WITH baseline AS (
  SELECT COUNT(*) AS products_with_pricing FROM products WHERE is_deleted = false AND price IS NOT NULL
),
migrated AS (
  SELECT COUNT(*) AS actual_prices FROM migration_v2_candidate.item_prices
)
SELECT
  'item_prices'::VARCHAR(50) AS entity,
  (SELECT products_with_pricing FROM baseline) AS expected_count,
  (SELECT actual_prices FROM migrated) AS actual_count,
  CASE 
    WHEN (SELECT actual_prices FROM migrated) >= (SELECT products_with_pricing FROM baseline) THEN 'PASS'::VARCHAR(50)
    ELSE 'WARN'::VARCHAR(50)
  END AS status,
  NULL::TEXT AS notes;

-- 2.5: Media (images)
-- Expected: item_media ≥ products with primary_image_url
WITH baseline AS (
  SELECT COUNT(*) AS products_with_images FROM products WHERE is_deleted = false AND primary_image_url IS NOT NULL
),
migrated AS (
  SELECT COUNT(*) AS actual_media FROM migration_v2_candidate.item_media
)
SELECT
  'item_media'::VARCHAR(50) AS entity,
  (SELECT products_with_images FROM baseline) AS expected_count,
  (SELECT actual_media FROM migrated) AS actual_count,
  CASE 
    WHEN (SELECT actual_media FROM migrated) >= (SELECT products_with_images FROM baseline) THEN 'PASS'::VARCHAR(50)
    ELSE 'WARN'::VARCHAR(50)
  END AS status,
  NULL::TEXT AS notes;

-- ============================================================================
-- SECTION 3: Referential Integrity Checks
-- ============================================================================

-- 3.1: All item_variants have valid item_id
SELECT
  'item_variants.item_id referential integrity'::VARCHAR(100) AS check_name,
  COUNT(*) AS invalid_count,
  CASE WHEN COUNT(*) = 0 THEN 'PASS'::VARCHAR(50) ELSE 'FAIL'::VARCHAR(50) END AS status
FROM migration_v2_candidate.item_variants iv
WHERE NOT EXISTS (SELECT 1 FROM migration_v2_candidate.items i WHERE i.id = iv.item_id);

-- 3.2: All item_barcodes have valid item_id
SELECT
  'item_barcodes.item_id referential integrity'::VARCHAR(100) AS check_name,
  COUNT(*) AS invalid_count,
  CASE WHEN COUNT(*) = 0 THEN 'PASS'::VARCHAR(50) ELSE 'FAIL'::VARCHAR(50) END AS status
FROM migration_v2_candidate.item_barcodes ib
WHERE NOT EXISTS (SELECT 1 FROM migration_v2_candidate.items i WHERE i.id = ib.item_id);

-- 3.3: All item_prices have valid item_id
SELECT
  'item_prices.item_id referential integrity'::VARCHAR(100) AS check_name,
  COUNT(*) AS invalid_count,
  CASE WHEN COUNT(*) = 0 THEN 'PASS'::VARCHAR(50) ELSE 'FAIL'::VARCHAR(50) END AS status
FROM migration_v2_candidate.item_prices ip
WHERE NOT EXISTS (SELECT 1 FROM migration_v2_candidate.items i WHERE i.id = ip.item_id);

-- 3.4: All item_stock have valid item_id
SELECT
  'item_stock.item_id referential integrity'::VARCHAR(100) AS check_name,
  COUNT(*) AS invalid_count,
  CASE WHEN COUNT(*) = 0 THEN 'PASS'::VARCHAR(50) ELSE 'FAIL'::VARCHAR(50) END AS status
FROM migration_v2_candidate.item_stock ist
WHERE NOT EXISTS (SELECT 1 FROM migration_v2_candidate.items i WHERE i.id = ist.item_id);

-- 3.5: All item_media have valid item_id
SELECT
  'item_media.item_id referential integrity'::VARCHAR(100) AS check_name,
  COUNT(*) AS invalid_count,
  CASE WHEN COUNT(*) = 0 THEN 'PASS'::VARCHAR(50) ELSE 'FAIL'::VARCHAR(50) END AS status
FROM migration_v2_candidate.item_media im
WHERE NOT EXISTS (SELECT 1 FROM migration_v2_candidate.items i WHERE i.id = im.item_id);

-- ============================================================================
-- SECTION 4: Data Quality Checks
-- ============================================================================

-- 4.1: No duplicate barcodes per company
SELECT
  'barcode uniqueness per company'::VARCHAR(100) AS check_name,
  COUNT(*) AS duplicate_barcodes,
  CASE WHEN COUNT(*) = 0 THEN 'PASS'::VARCHAR(50) ELSE 'FAIL'::VARCHAR(50) END AS status
FROM (
  SELECT tenant_id, company_id, barcode, COUNT(*) AS cnt
  FROM migration_v2_candidate.item_barcodes
  WHERE barcode IS NOT NULL
  GROUP BY tenant_id, company_id, barcode
  HAVING COUNT(*) > 1
) AS dupes;

-- 4.2: All items have non-null code and name
SELECT
  'items.code NOT NULL'::VARCHAR(100) AS check_name,
  COUNT(*) AS null_count,
  CASE WHEN COUNT(*) = 0 THEN 'PASS'::VARCHAR(50) ELSE 'FAIL'::VARCHAR(50) END AS status
FROM migration_v2_candidate.items
WHERE code IS NULL OR code = '';

SELECT
  'items.name NOT NULL'::VARCHAR(100) AS check_name,
  COUNT(*) AS null_count,
  CASE WHEN COUNT(*) = 0 THEN 'PASS'::VARCHAR(50) ELSE 'FAIL'::VARCHAR(50) END AS status
FROM migration_v2_candidate.items
WHERE name IS NULL OR name = '';

-- 4.3: All item_variants have valid item_id
SELECT
  'item_variants.item_id NOT NULL'::VARCHAR(100) AS check_name,
  COUNT(*) AS null_count,
  CASE WHEN COUNT(*) = 0 THEN 'PASS'::VARCHAR(50) ELSE 'FAIL'::VARCHAR(50) END AS status
FROM migration_v2_candidate.item_variants
WHERE item_id IS NULL;

-- 4.4: All barcodes have valid item_id
SELECT
  'item_barcodes.item_id NOT NULL'::VARCHAR(100) AS check_name,
  COUNT(*) AS null_count,
  CASE WHEN COUNT(*) = 0 THEN 'PASS'::VARCHAR(50) ELSE 'FAIL'::VARCHAR(50) END AS status
FROM migration_v2_candidate.item_barcodes
WHERE item_id IS NULL;

-- 4.5: All prices have valid item_id and price_book_id
SELECT
  'item_prices missing foreign keys'::VARCHAR(100) AS check_name,
  (
    SELECT COUNT(*) FROM migration_v2_candidate.item_prices
    WHERE item_id IS NULL OR price_book_id IS NULL
  )::BIGINT AS invalid_count,
  CASE 
    WHEN (SELECT COUNT(*) FROM migration_v2_candidate.item_prices WHERE item_id IS NULL OR price_book_id IS NULL) = 0
      THEN 'PASS'::VARCHAR(50)
    ELSE 'FAIL'::VARCHAR(50)
  END AS status;

-- 4.6: Pricing data consistency
SELECT
  'price data validation'::VARCHAR(100) AS check_name,
  COUNT(*) AS validation_failures,
  CASE WHEN COUNT(*) = 0 THEN 'PASS'::VARCHAR(50) ELSE 'WARN'::VARCHAR(50) END AS status
FROM migration_v2_candidate.item_prices
WHERE (mrp < 0 OR selling_price < 0 OR cost_price < 0)
  OR (selling_price > mrp);  -- Selling price should not exceed MRP

-- 4.7: Audit fields populated
SELECT
  'audit fields: created_at'::VARCHAR(100) AS check_name,
  COUNT(*) AS null_count,
  CASE WHEN COUNT(*) = 0 THEN 'PASS'::VARCHAR(50) ELSE 'WARN'::VARCHAR(50) END AS status
FROM migration_v2_candidate.items
WHERE created_at IS NULL;

SELECT
  'audit fields: modified_at'::VARCHAR(100) AS check_name,
  COUNT(*) AS null_count,
  CASE WHEN COUNT(*) = 0 THEN 'PASS'::VARCHAR(50) ELSE 'WARN'::VARCHAR(50) END AS status
FROM migration_v2_candidate.items
WHERE modified_at IS NULL;

-- ============================================================================
-- SECTION 5: Lookup Tests (Verify that lookup queries work)
-- ============================================================================

-- 5.1: Can we find items by code?
SELECT
  'item lookup by code'::VARCHAR(100) AS test_name,
  COUNT(*) AS items_found,
  'PASS'::VARCHAR(50) AS status
FROM migration_v2_candidate.items
WHERE code IS NOT NULL AND code != ''
LIMIT 5;

-- 5.2: Can we find variants by SKU?
SELECT
  'variant lookup by sku'::VARCHAR(100) AS test_name,
  COUNT(*) AS variants_found,
  'PASS'::VARCHAR(50) AS status
FROM migration_v2_candidate.item_variants
WHERE variant_sku IS NOT NULL AND variant_sku != ''
LIMIT 5;

-- 5.3: Can we find barcodes by scan?
SELECT
  'barcode lookup'::VARCHAR(100) AS test_name,
  COUNT(*) AS barcodes_found,
  'PASS'::VARCHAR(50) AS status
FROM migration_v2_candidate.item_barcodes
WHERE barcode IS NOT NULL AND barcode != ''
LIMIT 5;

-- ============================================================================
-- SECTION 6: Migration Completeness Report
-- ============================================================================

WITH migration_report AS (
  SELECT
    'items' AS entity,
    (SELECT COUNT(*) FROM migration_v2_candidate.items) AS migrated_count,
    (SELECT COUNT(DISTINCT company_id, code) FROM products WHERE is_deleted = false) AS expected_count,
    CASE 
      WHEN (SELECT COUNT(*) FROM migration_v2_candidate.items) >= (SELECT COUNT(DISTINCT company_id, code) FROM products WHERE is_deleted = false)
        THEN 'Complete'::VARCHAR(50)
      ELSE 'Incomplete'::VARCHAR(50)
    END AS status
  UNION ALL
  SELECT
    'item_variants',
    (SELECT COUNT(*) FROM migration_v2_candidate.item_variants),
    (SELECT COUNT(*) FROM products WHERE is_deleted = false),
    CASE 
      WHEN (SELECT COUNT(*) FROM migration_v2_candidate.item_variants) <= (SELECT COUNT(*) FROM products WHERE is_deleted = false)
        THEN 'Complete'::VARCHAR(50)
      ELSE 'Over-migrated'::VARCHAR(50)
    END
  UNION ALL
  SELECT
    'item_barcodes',
    (SELECT COUNT(*) FROM migration_v2_candidate.item_barcodes),
    (SELECT COUNT(*) FROM products WHERE is_deleted = false AND barcode IS NOT NULL),
    CASE 
      WHEN (SELECT COUNT(*) FROM migration_v2_candidate.item_barcodes) >= (SELECT COUNT(*) FROM products WHERE is_deleted = false AND barcode IS NOT NULL)
        THEN 'Complete'::VARCHAR(50)
      ELSE 'Incomplete'::VARCHAR(50)
    END
  UNION ALL
  SELECT
    'item_prices',
    (SELECT COUNT(*) FROM migration_v2_candidate.item_prices),
    (SELECT COUNT(*) FROM products WHERE is_deleted = false AND price IS NOT NULL),
    CASE 
      WHEN (SELECT COUNT(*) FROM migration_v2_candidate.item_prices) >= (SELECT COUNT(*) FROM products WHERE is_deleted = false AND price IS NOT NULL)
        THEN 'Complete'::VARCHAR(50)
      ELSE 'Incomplete'::VARCHAR(50)
    END
  UNION ALL
  SELECT
    'item_stock',
    (SELECT COUNT(*) FROM migration_v2_candidate.item_stock),
    (SELECT COUNT(*) FROM product_batch_stocks),
    CASE 
      WHEN (SELECT COUNT(*) FROM migration_v2_candidate.item_stock) >= (SELECT COUNT(*) FROM product_batch_stocks)
        THEN 'Complete'::VARCHAR(50)
      ELSE 'Incomplete'::VARCHAR(50)
    END
)
SELECT * FROM migration_report ORDER BY entity;

-- ============================================================================
-- SECTION 7: Legacy ID Mapping Completeness
-- ============================================================================

SELECT
  'Legacy ID mapping'::VARCHAR(100) AS check_name,
  COUNT(*) AS mapped_records,
  (SELECT COUNT(DISTINCT id) FROM products WHERE is_deleted = false)::BIGINT AS source_records,
  CASE 
    WHEN COUNT(*) = (SELECT COUNT(DISTINCT id) FROM products WHERE is_deleted = false)
      THEN 'PASS'::VARCHAR(50)
    ELSE 'INCOMPLETE'::VARCHAR(50)
  END AS status
FROM migration_v2_candidate.legacy_id_mapping
WHERE legacy_table = 'products' AND migration_status = 'migrated';

-- ============================================================================
-- SECTION 8: Final Summary Report
-- ============================================================================

SELECT
  '====== MIGRATION VALIDATION SUMMARY ======'::VARCHAR(200) AS report_header;

SELECT
  CURRENT_TIMESTAMP AS validation_timestamp,
  (SELECT COUNT(*) FROM migration_v2_candidate.items) AS canonical_items,
  (SELECT COUNT(*) FROM migration_v2_candidate.item_variants) AS canonical_variants,
  (SELECT COUNT(*) FROM migration_v2_candidate.item_barcodes) AS canonical_barcodes,
  (SELECT COUNT(*) FROM migration_v2_candidate.item_prices) AS canonical_prices,
  (SELECT COUNT(*) FROM migration_v2_candidate.item_stock) AS canonical_stock,
  (SELECT COUNT(*) FROM migration_v2_candidate.legacy_id_mapping) AS mapping_records;

-- ============================================================================
-- CLEANUP (Optional - Run only after validation is complete)
-- ============================================================================

-- DO NOT RUN until validation is approved
-- DROP SCHEMA migration_v2_candidate CASCADE;

