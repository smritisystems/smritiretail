-- SMRITI Retail OS — Preflight Identity & PSV Constraint Validation SQL
-- Document ID: SQL-PROD-ID-PREFLIGHT-01
-- Author: Jawahar Ramkripal Mallah (Chief Systems Architect & Creator)
-- Classification: Internal Database Governance

-- 1. Verify PSV Stock Balances Tenant Scoping (Must return 0)
SELECT COUNT(*) AS psv_null_company_id_count
FROM psv_stock_balances 
WHERE company_id IS NULL;

-- 2. Verify PSV Stock Balances Compound Uniqueness (Must return 0 rows)
SELECT company_id, psv_party_id, sku, COUNT(*) AS dup_count
FROM psv_stock_balances
GROUP BY company_id, psv_party_id, sku
HAVING COUNT(*) > 1;

-- 3. Verify Item Barcodes Uniqueness per Company (Must return 0 rows for active tenants)
SELECT company_id, barcode, COUNT(*) AS dup_count
FROM item_barcodes
WHERE company_id IS NOT NULL
GROUP BY company_id, barcode
HAVING COUNT(*) > 1;

-- 4. Verify Item Variants SKU Uniqueness per Company (Must return 0 rows for active tenants)
SELECT company_id, variant_sku, COUNT(*) AS dup_count
FROM item_variants
WHERE company_id IS NOT NULL
GROUP BY company_id, variant_sku
HAVING COUNT(*) > 1;

-- 5. Verify Parent Item Code Uniqueness per Company (Must return 0 rows for active tenants)
SELECT company_id, item_code, COUNT(*) AS dup_count
FROM items
WHERE company_id IS NOT NULL
GROUP BY company_id, item_code
HAVING COUNT(*) > 1;

-- 6. Verify Customer Article Mappings Active Uniqueness (Must return 0 rows)
SELECT company_id, customer_id, customer_article, COUNT(*) AS dup_count
FROM customer_article_mappings
WHERE is_active = true AND is_deleted = false
GROUP BY company_id, customer_id, customer_article
HAVING COUNT(*) > 1;

-- 7. Audit PSV Unmatched External Partner SKUs
SELECT 
    b.sku AS partner_sku,
    b.company_id,
    b.company_code,
    b.psv_party_id,
    COUNT(p.id) AS internal_product_match_count
FROM psv_stock_balances b
LEFT JOIN products p 
    ON (p.company_id = b.company_id AND (p.sku = b.sku OR p.code = b.sku))
GROUP BY b.sku, b.company_id, b.company_code, b.psv_party_id
HAVING COUNT(p.id) = 0;
