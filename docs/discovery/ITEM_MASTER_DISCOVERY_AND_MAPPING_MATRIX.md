# ITEM MASTER MIGRATION: Field-by-Field Discovery and Canonical Mapping Matrix

**Status:** Discovery phase - evidence-based semantic mapping before migration
**Date:** 2026-09-01
**Purpose:** Determine actual meaning of each legacy field, identify competing sources of truth, and produce authoritative mapping that will guide safe, deterministic migration

---

## 1. Critical Discovery Questions to Answer First

Before any migration code runs, we must resolve these open questions by inspecting actual data:

### Question 1.1: What does `products.code` represent?

**Options:**
- Option A: Item identity (one code per catalog entry, multiple products with same code are variants)
- Option B: SKU/variant identity (each row is a unique sellable unit)
- Option C: Inconsistent (sometimes item, sometimes SKU)

**Investigation required:**
```sql
-- If Option A (item identity):
-- Many products should share the same code
SELECT code, COUNT(*) as cnt FROM products WHERE is_deleted = false
GROUP BY code HAVING COUNT(*) > 1 LIMIT 20;

-- If Option B (SKU identity):
-- Codes should be mostly unique
SELECT COUNT(DISTINCT code) as unique_codes FROM products WHERE is_deleted = false;

-- Check actual products with duplicate codes
SELECT code, COUNT(*) as cnt, 
  STRING_AGG(DISTINCT name, ' | ') as names,
  STRING_AGG(DISTINCT sku, ' | ') as skus
FROM products WHERE is_deleted = false
GROUP BY code HAVING COUNT(*) > 1 LIMIT 10;
```

**Decision needed:**
- If many products share same code → `products.code` = item identity
- If almost all codes are unique → `products.code` = SKU identity
- If mixed → need consolidation logic before migration

---

### Question 1.2: Is the existing `items` table authoritative?

**Options:**
- Option A: Authoritative (preserve and use as foundation)
- Option B: Fragmented/unused (treat as legacy and rebuild from products)
- Option C: Partial authority (some records valid, some not)

**Investigation required:**
```sql
-- Count items vs products
SELECT 
  (SELECT COUNT(*) FROM products WHERE is_deleted = false) as products_count,
  (SELECT COUNT(*) FROM items WHERE is_deleted = false) as items_count;

-- Are items linked to products?
SELECT i.id, i.code, i.name, 
  COUNT(p.id) as linked_products
FROM items i
LEFT JOIN products p ON p.company_id = i.company_id AND p.code = i.code
WHERE i.is_deleted = false
GROUP BY i.id, i.code, i.name
ORDER BY linked_products DESC LIMIT 20;

-- Are there products without a corresponding item?
SELECT COUNT(*) as orphan_products
FROM products p
WHERE p.is_deleted = false
  AND NOT EXISTS (SELECT 1 FROM items i WHERE i.code = p.code AND i.company_id = p.company_id);

-- Do items have data that products don't?
SELECT i.id, i.code, i.name, COUNT(DISTINCT p.id) as variants
FROM items i
LEFT JOIN products p ON p.company_id = i.company_id AND (p.code = i.code OR p.sku = i.code)
WHERE i.is_deleted = false
GROUP BY i.id, i.code, i.name
HAVING COUNT(DISTINCT p.id) = 0 LIMIT 20;
```

**Decision needed:**
- If items_count << products_count AND many orphan_products → use products as primary source
- If items_count > 0 AND well-linked → use items as foundation
- If mixed → need reconciliation logic before consolidation

---

### Question 1.3: What does `products.sku` actually represent?

**Options:**
- Option A: SKU (unique sellable unit identifier)
- Option B: Internal variant code
- Option C: Same as `products.code` (redundant)

**Investigation required:**
```sql
-- How unique is SKU?
SELECT COUNT(*) as total_products,
  COUNT(DISTINCT sku) as unique_skus,
  ROUND(100.0 * COUNT(DISTINCT sku) / COUNT(*), 2) as uniqueness_percent
FROM products WHERE is_deleted = false AND sku IS NOT NULL;

-- Do products share SKUs?
SELECT sku, COUNT(*) as cnt FROM products 
WHERE is_deleted = false AND sku IS NOT NULL
GROUP BY sku HAVING COUNT(*) > 1 LIMIT 20;

-- SKU vs code correlation
SELECT COUNT(*) as total,
  SUM(CASE WHEN code = sku THEN 1 ELSE 0 END) as code_equals_sku,
  SUM(CASE WHEN code != sku THEN 1 ELSE 0 END) as code_differs_sku
FROM products WHERE is_deleted = false AND code IS NOT NULL AND sku IS NOT NULL;
```

**Decision needed:**
- If SKU is highly unique → use as canonical variant_sku
- If SKU ≈ code → consolidate
- If NULL for many products → derive from code or style_code

---

### Question 1.4: What is the relationship between `products.sku`, `products.style_code`, `products.color`, `products.size`?

**Options:**
- Option A: sku = canonical variant identifier; color/size = attributes only
- Option B: color/size are part of SKU (e.g., "SHIRT-S-RED")
- Option C: inconsistent (no clear pattern)

**Investigation required:**
```sql
-- Sample actual data
SELECT code, sku, style_code, color, size 
FROM products WHERE is_deleted = false AND (color IS NOT NULL OR size IS NOT NULL)
LIMIT 20;

-- Do products with same code have different color/size?
SELECT code, 
  COUNT(DISTINCT color) as color_variants,
  COUNT(DISTINCT size) as size_variants,
  COUNT(*) as total
FROM products WHERE is_deleted = false AND (color IS NOT NULL OR size IS NOT NULL)
GROUP BY code HAVING COUNT(*) > 1 LIMIT 20;

-- Are color/size combinations unique within code?
SELECT code, color, size, COUNT(*) as cnt
FROM products WHERE is_deleted = false AND color IS NOT NULL AND size IS NOT NULL
GROUP BY code, color, size HAVING COUNT(*) > 1 LIMIT 20;
```

**Decision needed:**
- If color/size consistently differ within same code → they define variants
- If each color/size combo is unique → they're part of SKU definition
- If inconsistent → need data cleanup before migration

---

### Question 1.5: Barcode authority and types

**Options:**
- Option A: `products.barcode` is primary; secondary_barcodes are alternates
- Option B: `item_barcodes` table is authoritative; products.barcode is legacy cache
- Option C: Multiple competing sources (no single authority)

**Investigation required:**
```sql
-- Do item_barcodes exist?
SELECT COUNT(*) as existing_barcodes FROM item_barcodes;

-- Are they linked to products?
SELECT ib.id, ib.barcode, ib.barcode_type, 
  COUNT(p.id) as linked_products
FROM item_barcodes ib
LEFT JOIN products p ON p.barcode = ib.barcode OR p.sku = ib.barcode
WHERE ib.is_deleted = false
GROUP BY ib.id, ib.barcode, ib.barcode_type LIMIT 20;

-- Check products barcode data
SELECT COUNT(*) as total,
  SUM(CASE WHEN barcode IS NOT NULL THEN 1 ELSE 0 END) as with_barcode,
  SUM(CASE WHEN barcode IS NOT NULL AND barcode ~ '^\d+$' THEN 1 ELSE 0 END) as numeric_only,
  SUM(CASE WHEN secondary_barcodes IS NOT NULL THEN 1 ELSE 0 END) as with_secondary
FROM products WHERE is_deleted = false;

-- Sample actual barcodes to determine type
SELECT DISTINCT barcode, LENGTH(barcode) as len, barcode ~ '^\d+$' as numeric
FROM products WHERE is_deleted = false AND barcode IS NOT NULL
ORDER BY len, barcode LIMIT 30;
```

**Decision needed:**
- If item_barcodes table is populated → use as merge source
- If empty → migrate from products.barcode + secondary_barcodes
- Determine barcode format from actual data (EAN-13 is 13 digits, UPC-A is 12, etc.)

---

### Question 1.6: Pricing authority and duplication

**Options:**
- Option A: products.price/mrp/cost_price are authoritative
- Option B: price_books table is authoritative
- Option C: Competing sources (both exist, may contradict)

**Investigation required:**
```sql
-- Do price_books exist and have data?
SELECT 
  (SELECT COUNT(*) FROM price_books) as price_books_count,
  (SELECT COUNT(*) FROM price_book_entries) as price_book_entries_count;

-- Are products prices populated?
SELECT COUNT(*) as total,
  SUM(CASE WHEN price IS NOT NULL THEN 1 ELSE 0 END) as with_price,
  SUM(CASE WHEN mrp IS NOT NULL THEN 1 ELSE 0 END) as with_mrp,
  SUM(CASE WHEN cost_price IS NOT NULL THEN 1 ELSE 0 END) as with_cost
FROM products WHERE is_deleted = false;

-- If both exist, are they consistent?
SELECT p.id, p.code, p.price, p.mrp, p.cost_price,
  pbe.selling_price, pbe.mrp as pbe_mrp
FROM products p
LEFT JOIN price_books pb ON pb.is_default = true AND pb.company_id = p.company_id
LEFT JOIN price_book_entries pbe ON pbe.price_book_id = pb.id AND pbe.product_id = p.id
WHERE p.is_deleted = false AND pbe.id IS NOT NULL
LIMIT 20;
```

**Decision needed:**
- If price_books is empty → use products pricing as source of truth
- If price_books has data → determine which is authoritative
- Check for price_variants → "Variant pricing" vs "Item pricing" question

---

### Question 1.7: Variant pricing - is it in products or item_variants?

**Options:**
- Option A: Each product row has its own price (variant-level pricing)
- Option B: All variants of same item share a price (item-level pricing)
- Option C: Mixed (some shared, some variant-specific)

**Investigation required:**
```sql
-- Do products with same code have different prices?
SELECT code, 
  COUNT(*) as total,
  COUNT(DISTINCT price) as price_variants,
  COUNT(DISTINCT mrp) as mrp_variants,
  COUNT(DISTINCT cost_price) as cost_variants,
  STRING_AGG(DISTINCT price::text, ' | ') as price_values
FROM products WHERE is_deleted = false AND code IS NOT NULL
GROUP BY code HAVING COUNT(*) > 1
ORDER BY price_variants DESC, mrp_variants DESC LIMIT 20;

-- Check if item_variants table has pricing
SELECT COUNT(*) as variants_with_price
FROM item_variants WHERE mrp IS NOT NULL OR selling_price IS NOT NULL;
```

**Decision needed:**
- If variants have different prices → migrate to variant-level pricing
- If all same code share price → migrate to item-level pricing
- This determines whether `item_prices` links to item_id only or item_id + variant_id

---

### Question 1.8: Attributes - where is the canonical source?

**Options:**
- Option A: item_variants.attributes_json (JSON object)
- Option B: item_attributes table (normalized key-value)
- Option C: products table columns (color, size, etc. as hard columns)
- Option D: Multiple competing sources

**Investigation required:**
```sql
-- Does item_variants table have attributes_json?
SELECT COUNT(*) as total_variants,
  SUM(CASE WHEN attributes_json IS NOT NULL THEN 1 ELSE 0 END) as with_json
FROM item_variants;

-- Sample attributes_json content
SELECT DISTINCT attributes_json FROM item_variants 
WHERE attributes_json IS NOT NULL LIMIT 10;

-- Does item_attributes table exist and have data?
SELECT COUNT(*) as attribute_records FROM item_attributes;

-- Products hard columns for attributes
SELECT COUNT(*) as total,
  SUM(CASE WHEN color IS NOT NULL THEN 1 ELSE 0 END) as with_color,
  SUM(CASE WHEN size IS NOT NULL THEN 1 ELSE 0 END) as with_size
FROM products WHERE is_deleted = false;
```

**Decision needed:**
- If item_attributes populated → use as canonical
- If attributes_json populated → use as migration source, normalize to item_attributes
- If only products columns → migrate from products to both attributes_json (temp) and item_attributes (canonical)

---

### Question 1.9: Inventory - what is the actual source?

**Options:**
- Option A: products.stock is authoritative
- Option B: product_batch_stocks is authoritative
- Option C: stock_movements ledger exists (to reconstruct current balance)
- Option D: Multiple competing sources

**Investigation required:**
```sql
-- Check all inventory tables
SELECT 
  (SELECT COUNT(*) FROM products WHERE is_deleted = false AND stock IS NOT NULL) as products_with_stock,
  (SELECT COUNT(*) FROM product_batch_stocks) as batch_stocks_records,
  (SELECT COUNT(*) FROM stock_movements) as stock_movements_records;

-- Do batch_stocks match products stock?
SELECT p.code, p.stock, 
  SUM(pbs.quantity) as total_batch_qty,
  SUM(pbs.reserved_quantity) as total_reserved
FROM products p
LEFT JOIN product_batch_stocks pbs ON pbs.product_id = p.id
WHERE p.is_deleted = false AND (p.stock IS NOT NULL OR pbs.quantity IS NOT NULL)
GROUP BY p.code, p.stock
LIMIT 20;

-- Stock movements - are they present?
SELECT * FROM stock_movements LIMIT 5;
```

**Decision needed:**
- If products.stock ≠ sum(batch_stocks) → need reconciliation before migration
- If stock_movements is empty → use batch_stocks + products.stock as source
- If stock_movements populated → reconstruct current balance and validate

---

## 2. Semantic Meaning Matrix (To Be Populated After Discovery)

| Legacy Source | Field | Semantic Meaning | Current Authority? | Target Owner | Transformation Rule | Risk/Notes |
|---|---|---|---|---|---|---|
| products | code | ? (item code OR SKU) | TBD | items OR item_variants | Determine by inspection | **Q1.1** |
| products | sku | ? | TBD | item_variants.variant_sku | Determine by inspection | **Q1.3** |
| products | style_code | Variant designation | TBD | item_variants.variant_code | Copy or consolidate | **Q1.4** |
| products | name | Item/variant name | TBD | items.name OR item_variants.variant_name | Consolidate or split | Mixed usage |
| products | barcode | Primary barcode | TBD | item_barcodes | Determine type from data | **Q1.5** |
| products | secondary_barcodes | Alternate barcodes | TBD | item_barcodes (is_primary=false) | Split by delimiter | Need actual format |
| products | price | Selling price | TBD | item_prices OR item_variants.selling_price | Determine authority | **Q1.6, Q1.7** |
| products | mrp | Maximum retail price | TBD | item_prices OR item_variants.mrp | Determine authority | **Q1.6, Q1.7** |
| products | cost_price | Cost/procurement price | TBD | item_prices OR item_variants.cost_price | Determine authority | **Q1.6, Q1.7** |
| products | color | Color attribute | TBD | item_attributes OR item_variants.attributes_json | Normalize | **Q1.4, Q1.8** |
| products | size | Size attribute | TBD | item_attributes OR item_variants.attributes_json | Normalize | **Q1.4, Q1.8** |
| products | stock | On-hand inventory | TBD | item_stock.quantity_on_hand | Reconcile with batch_stocks | **Q1.9** |
| products | reserved_stock | Reserved inventory | TBD | item_stock.quantity_reserved | Reconcile with batch_stocks | **Q1.9** |
| item_variants | attributes_json | Variant dimensions | TBD | item_attributes (canonical) | Extract or normalize | **Q1.8** |
| item_barcodes | barcode | Barcode data | TBD | item_barcodes (keep) | Merge/validate | **Q1.5** |
| price_books | * | Pricing policy | TBD | item_prices (canonical) | Merge/validate | **Q1.6** |
| product_batch_stocks | * | Lot tracking | TBD | item_stock (canonical) | Merge/validate | **Q1.9** |
| items | * | Item identity | TBD | items (keep or rebuild) | Reconcile with products | **Q1.2** |

---

## 3. Authority Resolution Matrix (To Be Completed)

For each concern, decide ONE authoritative source:

| Concern | Competing Sources | Evidence of Authority | Decision | Rationale |
|---|---|---|---|---|
| **Item Identity** | products vs items | TBD (inspect data structure) | TBD | Need to answer Q1.1, Q1.2 |
| **Variant Identity** | products.sku vs style_code vs attributes | TBD (inspect consistency) | TBD | Need to answer Q1.3, Q1.4 |
| **Barcode Registry** | products.barcode vs item_barcodes vs product_variants | TBD (population check) | TBD | Need to answer Q1.5 |
| **Pricing** | products.price vs price_books vs item_variants | TBD (consistency check) | TBD | Need to answer Q1.6, Q1.7 |
| **Attributes** | products cols vs item_variants.json vs item_attributes | TBD (coverage check) | TBD | Need to answer Q1.8 |
| **Inventory** | products.stock vs product_batch_stocks vs stock_movements | TBD (balance check) | TBD | Need to answer Q1.9 |

---

## 4. Conflict Resolution Rules (To Be Defined)

**Once authoritative sources are established, define:**

| Conflict Type | Resolution Strategy | Handling |
|---|---|---|
| **Duplicate code** | If many products share same code: consolidate to one item | Need reconciliation logic |
| **Duplicate SKU** | If SKU matches multiple items: flag as data quality issue | Require review/correction |
| **Price mismatch** | If products.price ≠ price_books entry: which wins? | Define authority |
| **Stock mismatch** | If products.stock ≠ sum(batch_stocks): which wins? | Define authority |
| **Barcode conflict** | If same barcode maps to multiple items: flag and review | Never silently discard |
| **Attribute mismatch** | If attributes_json ≠ item_attributes: which wins? | Define authority |

---

## 5. "NO LOSS" Tracking Matrix (To Be Built)

Every legacy record must be tracked:

| Legacy Table | Legacy ID | Status | Canonical Table | Canonical ID | Reason | Notes |
|---|---|---|---|---|---|---|
| products | 1 | MIGRATED | item_variants | 451 | Normal transformation | Linked via code+name |
| products | 2 | MERGED | item_variants | 451 | Same item_id inferred | Consolidated duplicate |
| products | 3 | REJECTED | — | — | Invalid data (e.g., null code) | Requires review |
| products | 4 | REQUIRES_REVIEW | — | — | Ambiguous source-of-truth | Manual approval needed |
| item_variants | 12 | KEPT | item_variants | 12 | Already canonical | No migration needed |
| item_barcodes | 99 | MERGED | item_barcodes | 87 | Duplicate barcode | Existing record preferred |

---

## 6. Recommended Next Action

**Do NOT run migration SQL yet.**

**INSTEAD, run this discovery SQL in staging environment:**

(See attached ITEM_MASTER_DISCOVERY_QUERIES.sql for full inspection scripts)

After discovery queries complete:

1. Answer each of the 9 critical questions with actual data evidence
2. Populate Section 2 (Semantic Meaning Matrix) with findings
3. Complete Section 3 (Authority Resolution Matrix) with decisions
4. Define Section 4 (Conflict Resolution Rules)
5. Draft Section 5 (NO LOSS Tracking Matrix) structure
6. **Then and only then** regenerate migration SQL from this authoritative matrix

---

## 7. Sign-Off Gate

Before any migration code is approved, stakeholders must sign off on:

- [ ] Semantic meaning of legacy fields is documented
- [ ] Authority for each concern is explicitly decided
- [ ] Conflict resolution rules are defined
- [ ] NO LOSS principle is baked into tracking
- [ ] Barcode type determination is specified (not hard-coded EAN13)
- [ ] Pricing authority is resolved (item-level vs variant-level)
- [ ] Attribute canonical source is decided (json vs normalized table)
- [ ] Inventory reconciliation logic is documented

---

**This discovery matrix becomes the source of truth for the migration.**

**Migration SQL will be generated FROM this matrix, not independently designed.**

