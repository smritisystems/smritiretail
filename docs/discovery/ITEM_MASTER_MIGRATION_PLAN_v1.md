# ITEM MASTER MIGRATION PLAN

**Status:** Migration design plan, pre-implementation
**Date:** 2026-09-01
**Scope:** Define the target schema, field transformations, and safe migration sequence from legacy fragmented item architecture to canonical item domain.

---

## 1. Executive Summary

This document specifies the target database schema and the safe migration path from the current fragmented model to the canonical item domain approved in the ownership map.

**Current state:**
- `products` table: 681 rows, 47 columns, acts as catch-all master
- `items` table: 11 rows, disconnected from products
- `item_variants` table: 27 rows, partial variant model
- `item_barcodes` table: 27 rows, duplicate barcode logic
- `price_books`, `stock_movements`, `product_batch_stocks` tables: largely unused
- 6 columns in `products` are 100% NULL

**Target state:**
- Canonical `items` table as item identity authority
- Canonical `item_variants` table as variant authority
- Canonical `item_barcodes` table as barcode authority
- Pricing, inventory, attributes, media, and compliance in separate domains
- `products` table becomes a read-only legacy bridge or is deprecated entirely

---

## 2. Target Schema Design

### 2.1 Core Canonical Tables

#### A. `items` (Canonical Item Identity)

```sql
CREATE TABLE items (
  id BIGSERIAL PRIMARY KEY,
  uuid UUID NOT NULL UNIQUE,
  tenant_id BIGINT NOT NULL,
  company_id BIGINT NOT NULL,
  branch_id BIGINT,
  
  -- Identity
  code VARCHAR(100) NOT NULL UNIQUE,
  name VARCHAR(500) NOT NULL,
  description TEXT,
  
  -- Classification
  category_id BIGINT REFERENCES item_categories(id),
  brand_id BIGINT REFERENCES item_brands(id),
  item_type VARCHAR(50),  -- e.g., product, service, bundle
  
  -- Defaults
  default_uom_id BIGINT REFERENCES units_of_measure(id),
  default_tax_profile_id BIGINT REFERENCES tax_profiles(id),
  
  -- Compliance
  hsn_code VARCHAR(20),
  sac_code VARCHAR(20),
  
  -- Status and lifecycle
  status VARCHAR(50) NOT NULL DEFAULT 'active',
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  deleted_at TIMESTAMP,
  deleted_by BIGINT,
  
  -- Audit
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by BIGINT,
  modified_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  modified_by BIGINT,
  version BIGINT NOT NULL DEFAULT 1,
  
  CONSTRAINT items_tenant_company FOREIGN KEY (tenant_id, company_id)
    REFERENCES companies(tenant_id, company_id)
);

CREATE INDEX idx_items_code ON items(code);
CREATE INDEX idx_items_company_branch ON items(company_id, branch_id);
CREATE INDEX idx_items_category ON items(category_id);
CREATE INDEX idx_items_status ON items(status, is_active);
```

#### B. `item_variants` (Canonical Variant Identity)

```sql
CREATE TABLE item_variants (
  id BIGSERIAL PRIMARY KEY,
  uuid UUID NOT NULL UNIQUE,
  item_id BIGINT NOT NULL REFERENCES items(id),
  tenant_id BIGINT NOT NULL,
  company_id BIGINT NOT NULL,
  branch_id BIGINT,
  
  -- Variant identification
  variant_code VARCHAR(100),  -- e.g., "SHIRT-S-RED"
  variant_name VARCHAR(500),
  variant_sku VARCHAR(100) UNIQUE,
  
  -- Variant attributes (JSON for flexibility)
  -- e.g., {"size": "S", "color": "red", "fit": "slim"}
  attributes_json JSONB,
  
  -- Variant-specific pricing
  mrp NUMERIC(12,2),
  selling_price NUMERIC(12,2),
  cost_price NUMERIC(12,2),
  
  -- Variant-level barcode binding
  primary_barcode_id BIGINT REFERENCES item_barcodes(id),
  
  -- Status
  status VARCHAR(50) NOT NULL DEFAULT 'active',
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  deleted_at TIMESTAMP,
  deleted_by BIGINT,
  
  -- Audit
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by BIGINT,
  modified_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  modified_by BIGINT,
  version BIGINT NOT NULL DEFAULT 1,
  
  CONSTRAINT item_variants_tenant_company FOREIGN KEY (tenant_id, company_id)
    REFERENCES companies(tenant_id, company_id)
);

CREATE INDEX idx_item_variants_item ON item_variants(item_id);
CREATE INDEX idx_item_variants_sku ON item_variants(variant_sku);
CREATE INDEX idx_item_variants_status ON item_variants(status, is_active);
```

#### C. `item_barcodes` (Canonical Barcode Registry)

```sql
CREATE TABLE item_barcodes (
  id BIGSERIAL PRIMARY KEY,
  uuid UUID NOT NULL UNIQUE,
  item_id BIGINT NOT NULL REFERENCES items(id),
  variant_id BIGINT REFERENCES item_variants(id),
  tenant_id BIGINT NOT NULL,
  company_id BIGINT NOT NULL,
  branch_id BIGINT,
  
  -- Barcode data
  barcode VARCHAR(500) NOT NULL,
  barcode_type VARCHAR(50),  -- e.g., 'EAN13', 'UPC', 'SKU', 'INTERNAL'
  barcode_format VARCHAR(50),  -- e.g., 'EAN13', 'CODE128'
  
  -- Authority
  is_primary BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  
  -- Source
  source VARCHAR(100),  -- e.g., 'legacy_products', 'user_added', 'supplier'
  
  -- Uniqueness constraint
  CONSTRAINT barcode_unique_per_company 
    UNIQUE (tenant_id, company_id, barcode),
  
  -- Audit
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by BIGINT,
  modified_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  modified_by BIGINT,
  
  CONSTRAINT barcode_tenant_company FOREIGN KEY (tenant_id, company_id)
    REFERENCES companies(tenant_id, company_id)
);

CREATE INDEX idx_item_barcodes_barcode ON item_barcodes(barcode);
CREATE INDEX idx_item_barcodes_item_variant ON item_barcodes(item_id, variant_id);
CREATE INDEX idx_item_barcodes_primary ON item_barcodes(is_primary, is_active);
```

### 2.2 Cross-Domain Tables (Separate Authority)

#### D. `item_prices` (Pricing Domain Authority)

```sql
CREATE TABLE item_prices (
  id BIGSERIAL PRIMARY KEY,
  uuid UUID NOT NULL UNIQUE,
  item_id BIGINT NOT NULL REFERENCES items(id),
  variant_id BIGINT REFERENCES item_variants(id),
  tenant_id BIGINT NOT NULL,
  company_id BIGINT NOT NULL,
  branch_id BIGINT,
  
  -- Price book context
  price_book_id BIGINT REFERENCES price_books(id),
  customer_tier_id BIGINT,
  
  -- Pricing
  mrp NUMERIC(12,2),
  selling_price NUMERIC(12,2),
  cost_price NUMERIC(12,2),
  buying_price NUMERIC(12,2),
  
  -- Discount/scheme
  discount_percent NUMERIC(5,2),
  discount_amount NUMERIC(12,2),
  scheme_id BIGINT,
  
  -- Validity
  valid_from TIMESTAMP,
  valid_to TIMESTAMP,
  is_active BOOLEAN NOT NULL DEFAULT true,
  
  -- Audit
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by BIGINT,
  modified_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  modified_by BIGINT,
  
  CONSTRAINT item_prices_tenant_company FOREIGN KEY (tenant_id, company_id)
    REFERENCES companies(tenant_id, company_id)
);

CREATE INDEX idx_item_prices_item_variant ON item_prices(item_id, variant_id);
CREATE INDEX idx_item_prices_validity ON item_prices(valid_from, valid_to, is_active);
```

#### E. `item_stock` (Inventory Domain Authority)

```sql
CREATE TABLE item_stock (
  id BIGSERIAL PRIMARY KEY,
  uuid UUID NOT NULL UNIQUE,
  item_id BIGINT NOT NULL REFERENCES items(id),
  variant_id BIGINT REFERENCES item_variants(id),
  tenant_id BIGINT NOT NULL,
  company_id BIGINT NOT NULL,
  warehouse_id BIGINT,
  
  -- Stock state
  quantity_on_hand NUMERIC(12,2) NOT NULL DEFAULT 0,
  quantity_reserved NUMERIC(12,2) NOT NULL DEFAULT 0,
  quantity_available NUMERIC(12,2) GENERATED ALWAYS AS 
    (quantity_on_hand - quantity_reserved) STORED,
  
  -- Batch/expiry tracking
  batch_no VARCHAR(100),
  expiry_date DATE,
  manufacturing_date DATE,
  
  -- Damaged/adjustment
  quantity_damaged NUMERIC(12,2) DEFAULT 0,
  quantity_returned NUMERIC(12,2) DEFAULT 0,
  
  -- Audit
  last_movement_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  modified_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT item_stock_tenant_company FOREIGN KEY (tenant_id, company_id)
    REFERENCES companies(tenant_id, company_id),
  CONSTRAINT item_stock_unique 
    UNIQUE (tenant_id, company_id, item_id, variant_id, warehouse_id, batch_no)
);

CREATE INDEX idx_item_stock_item_variant ON item_stock(item_id, variant_id, warehouse_id);
CREATE INDEX idx_item_stock_available ON item_stock(quantity_available);
```

#### F. `item_attributes` (Metadata Domain Authority)

```sql
CREATE TABLE item_attributes (
  id BIGSERIAL PRIMARY KEY,
  uuid UUID NOT NULL UNIQUE,
  item_id BIGINT NOT NULL REFERENCES items(id),
  variant_id BIGINT REFERENCES item_variants(id),
  tenant_id BIGINT NOT NULL,
  company_id BIGINT NOT NULL,
  
  -- Attribute key-value
  attribute_key VARCHAR(100) NOT NULL,
  attribute_value TEXT,
  value_type VARCHAR(50),  -- string, number, boolean, json
  
  -- Classification
  category_id BIGINT,  -- which category defines this attribute
  
  CONSTRAINT item_attributes_tenant_company FOREIGN KEY (tenant_id, company_id)
    REFERENCES companies(tenant_id, company_id),
  CONSTRAINT item_attributes_unique 
    UNIQUE (item_id, variant_id, attribute_key)
);

CREATE INDEX idx_item_attributes_item_variant ON item_attributes(item_id, variant_id);
```

#### G. `item_media` (Media Domain Authority)

```sql
CREATE TABLE item_media (
  id BIGSERIAL PRIMARY KEY,
  uuid UUID NOT NULL UNIQUE,
  item_id BIGINT NOT NULL REFERENCES items(id),
  variant_id BIGINT REFERENCES item_variants(id),
  tenant_id BIGINT NOT NULL,
  company_id BIGINT NOT NULL,
  
  -- Media reference
  media_url VARCHAR(1000),
  media_type VARCHAR(50),  -- 'image', 'video', 'document'
  is_primary BOOLEAN NOT NULL DEFAULT false,
  display_order SMALLINT,
  
  -- Audit
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT item_media_tenant_company FOREIGN KEY (tenant_id, company_id)
    REFERENCES companies(tenant_id, company_id)
);

CREATE INDEX idx_item_media_item_variant ON item_media(item_id, variant_id);
CREATE INDEX idx_item_media_primary ON item_media(is_primary, display_order);
```

#### H. `products_legacy_bridge` (Compatibility Layer, Optional)

```sql
-- If full deprecation is not immediate, create a read-only view that maps
-- canonical tables back to legacy products structure for compatibility

CREATE VIEW products_legacy_bridge AS
SELECT
  i.id,
  i.code AS code,
  i.name AS name,
  iv.variant_sku AS sku,
  iv.variant_code AS style_code,
  (iv.attributes_json->>'color') AS color,
  (iv.attributes_json->>'size') AS size,
  iv.selling_price AS price,
  iv.mrp AS mrp,
  iv.cost_price AS cost_price,
  (SELECT barcode FROM item_barcodes WHERE item_id = i.id AND is_primary = true LIMIT 1) AS barcode,
  i.hsn_code,
  i.category_id,
  i.brand_id,
  i.status,
  i.is_active,
  i.created_at,
  i.modified_at,
  i.company_id,
  i.branch_id,
  i.tenant_id,
  iv.id AS variant_id
FROM items i
LEFT JOIN item_variants iv ON i.id = iv.item_id
WHERE i.is_deleted = false AND iv.is_deleted = false;
```

---

## 3. Field Migration Matrix

### 3.1 Mapping from `products` to Target Tables

| Source: `products.field` | Destination | Destination Table | Transformation | Notes |
|---|---|---|---|---|
| `id` | Keep as legacy reference | items/variants | Create mapping table | Preserve for rollback |
| `uuid` | Keep | items / item_variants | Direct copy | Identity |
| `code` | `items.code` | items | Direct copy | Canonical item code |
| `name` | `items.name` | items | Direct copy | Item name |
| `sku` | `item_variants.variant_sku` | item_variants | Direct copy | Variant SKU |
| `style_code` | `item_variants.variant_code` | item_variants | Direct copy | Variant identifier |
| `barcode` | `item_barcodes.barcode` | item_barcodes | Direct copy + `is_primary=true` | Primary barcode |
| `secondary_barcodes` | `item_barcodes.barcode` | item_barcodes | Split into rows + `is_primary=false` | Additional barcodes |
| `price` | `item_prices.selling_price` | item_prices | Direct copy | Selling price |
| `mrp` | `item_prices.mrp` | item_prices | Direct copy | MRP |
| `cost_price` | `item_prices.cost_price` | item_prices | Direct copy | Cost price |
| `buying_price` | `item_prices.buying_price` | item_prices | Direct copy | Procurement price |
| `gst_percentage` | `tax_profiles.tax_rate` | tax_profiles domain | Reference via item.tax_profile_id | Tax mapping |
| `hsn_code` | `items.hsn_code` | items | Direct copy | Compliance |
| `category` | `items.category_id` | items | Foreign key lookup/create | Category taxonomy |
| `category_code` | (retire) | — | NULL (100% null in current) | Redundant |
| `brand` | `items.brand_id` | items | Foreign key lookup/create | Brand taxonomy |
| `color` | `item_variants.attributes_json['color']` | item_variants | JSON field | Variant dimension |
| `size` | `item_variants.attributes_json['size']` | item_variants | JSON field | Variant dimension |
| `stock` | `item_stock.quantity_on_hand` | item_stock | Direct copy | Current on-hand |
| `reserved_stock` | `item_stock.quantity_reserved` | item_stock | Direct copy | Reserved qty |
| `primary_image_url` | `item_media.media_url` | item_media | Direct copy + `is_primary=true` | Primary image |
| `gallery_images` | `item_media.media_url` | item_media | Split into rows | Gallery images |
| `is_favorite` | (retire) | personalization schema | Store separately if needed | User preference |
| `attributes` | `item_attributes` / `item_variants.attributes_json` | item_attributes or variants | JSON/split logic | Dynamic attributes |
| `variant_template_id` | (retire) | — | NULL (100% null) | Unused |
| `cbm_m3` | item_logistics metadata | (future table) | Conditional | Logistics metadata |
| `document_number` | (retire) | — | NULL (100% null) | Unused |
| `size_scale_id` | (retire) | — | NULL (100% null) | Unused |
| `sourcing_mode_override` | procurement domain | (future table) | Conditional | Procurement policy |
| `pricing_mode` | item_prices logic | item_prices | Policy, not data | Calculated |
| `tracking_mode` | item_stock logic | item_stock | Policy, not data | Calculated |
| `is_active` | `items.is_active` | items | Direct copy | Lifecycle |
| `is_deleted` | `items.is_deleted` | items | Direct copy | Lifecycle |
| `deleted_at` | `items.deleted_at` | items | Direct copy | Audit |
| `deleted_by` | `items.deleted_by` | items | Direct copy | Audit |
| `version` | `items.version` | items | Start at 1 | Version tracking |
| `created_at` | `items.created_at` | items | Direct copy | Audit |
| `created_by` | `items.created_by` | items | Direct copy | Audit |
| `modified_at` | `items.modified_at` | items | Direct copy | Audit |
| `modified_by` | `items.modified_by` | items | Direct copy | Audit |
| `company_id` | Preserve in all tables | All | Direct copy | Multi-tenant key |
| `branch_id` | Preserve in all tables | All | Direct copy | Branch context |
| `tenant_id` | Add to all tables | All | Direct copy | Platform tenant |

---

## 4. Migration Sequence (Safe, Non-Destructive)

### Phase 0: Preparation
- [x] Freeze architecture and ownership (completed)
- [ ] Backup `smriti001` database
- [ ] Create migration staging schema: `public_v2_candidate`
- [ ] Create mapping tables to track legacy → canonical IDs

### Phase 1: Create Target Tables
- [ ] Create all new tables in `public_v2_candidate` schema
- [ ] Create `legacy_id_mapping` table to track old → new IDs
- [ ] Verify schema structure with validation queries

### Phase 2: Migrate Data
- [ ] Migrate `products` → `items` + `item_variants` + `item_barcodes`
- [ ] Backfill `item_prices` from `product`.price fields
- [ ] Backfill `item_stock` from `product_batch_stocks` and current `stock` fields
- [ ] Backfill `item_attributes` from dynamic attribute fields
- [ ] Backfill `item_media` from image URL fields
- [ ] Create `products_legacy_bridge` view for compatibility

### Phase 3: Validation
- [ ] Row count validation: verify no data loss
- [ ] Data integrity checks: foreign keys, uniqueness, nullability
- [ ] Lookup tests: can we find item by code, variant by SKU, barcode by scan?
- [ ] Pricing tests: confirm price queries work correctly
- [ ] Stock tests: confirm stock queries work correctly
- [ ] Audit trail verification

### Phase 4: Switchover (Rehearse first)
- [ ] Plan cutover window
- [ ] Rehearse full switchover in staging
- [ ] Create rollback procedure
- [ ] Execute switchover: rename `public` to `public_v1_backup`, rename `public_v2_candidate` to `public`
- [ ] Verify application can connect and queries work
- [ ] Monitor for errors

### Phase 5: Cleanup
- [ ] Keep `public_v1_backup` for 30 days as fallback
- [ ] Retire legacy `products` table (or keep as read-only archive)
- [ ] Deprecate legacy views and procedures
- [ ] Update application schema documentation

---

## 5. Data Transformation Rules

### 5.1 Item Consolidation Rule

**Problem:** Many products may share the same code or name. The migration must not create duplicate items.

**Rule:**
```
For each unique (company_id, code) in products:
  IF item exists with same code in items table:
    Link product → existing item
  ELSE:
    Create new item with code, name, category_id, brand_id, hsn_code
    Link product → new item
```

### 5.2 Variant Deduplication Rule

**Problem:** Multiple products may have the same item + sku combination.

**Rule:**
```
For each product:
  IF item_variant exists with (item_id, variant_sku):
    Link product → existing variant
    WARN if pricing differs
  ELSE:
    Create new item_variant with variant_sku, color, size, mrp, price, cost_price
    Link product → new variant
```

### 5.3 Barcode Uniqueness Rule

**Problem:** Barcodes must be globally unique per company within a warehouse system.

**Rule:**
```
For each barcode in products:
  IF item_barcode exists with same barcode AND company_id:
    SKIP (already exists)
  ELSE:
    Create item_barcode(item_id, variant_id, barcode, is_primary=true)
    
For each secondary_barcode in products:
  Split by delimiter (or JSON array)
  Create item_barcode(item_id, variant_id, barcode, is_primary=false)
```

### 5.4 Image URL Consolidation Rule

**Problem:** Multiple image fields in products (primary + gallery).

**Rule:**
```
For each product:
  IF primary_image_url:
    Create item_media(item_id, variant_id, media_url, is_primary=true, display_order=0)
  
  IF gallery_images (array/JSON):
    For each url in gallery:
      Create item_media(item_id, variant_id, media_url, is_primary=false, display_order++)
```

### 5.5 Attributes JSON Rule

**Problem:** Variant dimensions (color, size, etc.) must be migrated to JSON.

**Rule:**
```
For each product:
  attributes_json = {
    "color": products.color,
    "size": products.size,
    ...other variant dimensions
  }
  Store in item_variants.attributes_json
```

### 5.6 Pricing Strategy Rule

**Problem:** Multiple pricing columns in products, but no price_books currently used.

**Rule:**
```
Create default price_book (name='default', is_default=true)

For each product:
  Create item_prices(
    item_id, variant_id,
    price_book_id=default,
    mrp, selling_price, cost_price, buying_price,
    valid_from=current,
    valid_to=NULL,
    is_active=true
  )
```

---

## 6. Rollback Strategy

### Immediate Rollback (< 1 hour)
- Database rename only: `public` → `public_v2`, `public_v1_backup` → `public`
- Application reconnects to v1
- No data loss

### Extended Rollback (1-7 days)
- Keep `public_v1_backup` schema live and queryable
- Replicate any new data from v2 back to v1 if needed
- Gradually migrate users back

### Permanent Rollback (> 7 days)
- Not recommended; assume migration is successful
- Archive `public_v1_backup` for audit only

---

## 7. Migration Validation Checklist

- [ ] Item count: `SELECT COUNT(*) FROM items` ≈ unique (company_id, code) from products
- [ ] Variant count: `SELECT COUNT(*) FROM item_variants` ≤ rows in products
- [ ] Barcode count: `SELECT COUNT(*) FROM item_barcodes` ≥ products with barcode
- [ ] Price count: `SELECT COUNT(*) FROM item_prices` = items with pricing
- [ ] Stock count: `SELECT COUNT(*) FROM item_stock` ≥ products with stock
- [ ] Media count: `SELECT COUNT(*) FROM item_media` ≥ products with images
- [ ] No NULL in `items.code`, `items.name`, `item_variants.item_id`
- [ ] No duplicate barcodes per company in `item_barcodes`
- [ ] All foreign keys are valid
- [ ] Legacy mapping table completeness: every product has an entry
- [ ] Audit trail complete: all created_by, modified_by, timestamps populated

---

## 8. Post-Migration Application Changes (Separate from DB)

After the database migration is complete and validated, the application layer will need to update:

1. **API Endpoints:**
   - Items API: query canonical `items` table
   - Variants API: query canonical `item_variants` table
   - Barcode lookup: query canonical `item_barcodes` table
   - Pricing: query `item_prices` table (not products.price)
   - Stock: query `item_stock` table (not products.stock)

2. **ORM Models:**
   - Update SQLAlchemy models to match new schema
   - Add relationships: `Item.variants`, `Item.barcodes`, `Item.prices`, `Item.stock`
   - Remove denormalized fields from ORM

3. **UI Forms:**
   - Update Item Master form to use new schema
   - Update variant management to write to `item_variants` + attributes
   - Update pricing form to write to `item_prices`
   - Update barcode management to write to `item_barcodes`

4. **Search/Lookup:**
   - Update item search to use canonical `items.code`, `items.name`
   - Update barcode scan lookup to use `item_barcodes`
   - Update inventory queries to join `item_stock`

5. **Reports:**
   - Update all item-related reports to use new schema
   - Create new views for common report patterns

---

## 9. Final Pre-Implementation Checklist

- [ ] Architecture approved (one item domain, no separate Retail/Distributor/etc item universes)
- [ ] Ownership map approved (items, variants, barcodes, pricing, inventory, attributes, media, compliance)
- [ ] Field migration matrix approved
- [ ] Transformation rules reviewed
- [ ] Rollback strategy tested in staging
- [ ] Validation queries prepared
- [ ] Database backup created
- [ ] Migration window scheduled
- [ ] Application deployment plan ready (tied to DB switchover)
- [ ] Monitoring and alerting configured for new schema

---

## 10. Success Criteria

✅ Migration is successful when:

1. All legacy data is migrated without loss
2. Canonical tables pass integrity checks
3. Application connects and queries execute correctly
4. Item lookup (by code, SKU, barcode) works end-to-end
5. Pricing queries return correct data
6. Stock queries return correct data
7. Audit trails are complete and traceable
8. No data type errors or constraint violations
9. Performance is acceptable on production volume
10. Rollback plan is documented and tested

---

## Approval Gate

**Do not proceed with implementation until this section is signed off.**

| Role | Approval | Date | Notes |
|---|---|---|---|
| Architecture Owner | ☐ | — | Freeze schema design |
| Database Admin | ☐ | — | Approve migration sequence |
| Application Lead | ☐ | — | Confirm app changes timeline |
| Product | ☐ | — | Confirm business impact |

---

**This document is the final pre-implementation boundary. After sign-off, schema work can begin.**
