# ITEM MASTER CANONICAL CONTRACT v1.0

**Status:** Architecture Frozen (Approved 2026-09-01)
**Effective Date:** 2026-09-01
**Revision:** 1.0
**Authority:** Architecture Owner (Bhai) + Engineering Team
**Scope:** All SMRITI products (Retail, Distributor, Warehouse, Enterprise)

---

## Preamble

This document freezes **16 irreversible architectural decisions** that will guide all Item Master migration, schema design, and implementation work.

These decisions are based on:
- Evidence from actual `smriti001` database inspection (681 products, 47 columns, transactional foreign keys)
- Analysis of existing `items`, `item_variants`, `item_barcodes` as test fragments
- Unified domain model for all 4 SMRITI products (not separate masters per product)
- Global Registry as metadata authority
- NO LOSS principle for all transactional data
- Zero duplicate sources of truth in canonical model

**This contract is binding for all subsequent development.**

Any deviation requires explicit architectural review and amendment via formal RFC.

---

## THE 16 CANONICAL DECISIONS

### Decision 1: ONE CANONICAL ITEM DOMAIN FOR ALL SMRITI PRODUCTS

**Frozen:**
```
SMRITI Retail
SMRITI Distributor
SMRITI Warehouse
SMRITI Enterprise
        │
        │ (all consume)
        ▼
  CANONICAL ITEM DOMAIN
     (single master)
     
Differentiation occurs at:
  • Policy layer (what's visible, allowed, mandatory)
  • UI/Capability layer (screens, workflows, permissions)
  • Pricing layer (different price books, tiers, schemes)
  • Inventory layer (different warehouse structures, movement policies)
  • Compliance layer (tax, regulations, audit policies)
  
NOT at:
  • Item identity
  • Variant identity
  • Barcode registry
  • Core product attributes
```

**Implication:** No separate item master tables per product edition. No `items_retail`, `items_distributor`, etc.

**Sign-off:**
- [ ] Architecture Owner
- [ ] Product Lead (Retail)
- [ ] Product Lead (Distributor)
- [ ] Product Lead (Warehouse)
- [ ] Product Lead (Enterprise)

---

### Decision 2: ITEM = PARENT CATALOG IDENTITY (style_code)

**Frozen:**
```
ITEM (Parent/Family)
  │
  ├── Identity: style_code from products table
  │
  ├── Example: CH-01-A (Chino Color 1 Variant A)
  │
  └── Characteristics:
       • One per product family
       • Represents catalog entry
       • Precedes variants
       • Used for product documentation, marketing
```

**Database Mapping:**
- `items.code` ← `products.style_code`
- `items.name` ← `products.style_name` OR consolidate from products
- `items.category_id` ← `products.category_id`
- `items.brand_id` ← `products.brand_id`
- `items.hsn_code` ← `products.hsn_code`

**Authority:** `products` table (as live system of record until cutover)

**Implication:** All `products` rows with same `style_code` → ONE item record

**Sign-off:**
- [ ] Database Administrator
- [ ] Application Architect

---

### Decision 3: VARIANT = OPERATIONAL SKU (products.code)

**Frozen:**
```
VARIANT (Operational SKU)
  │
  ├── Identity: products.code
  │
  ├── Example: CH-01-A-PEACH-37 (Chino + Color + Size)
  │
  ├── Uniqueness Scope: (tenant_id, company_id, products.code)
  │
  └── Characteristics:
       • One per sellable unit
       • Combines style + size + color + other attributes
       • Directly referenced by transactions
       • Has pricing, barcode, inventory
```

**Database Mapping:**
- `item_variants.variant_sku` ← `products.code`
- `item_variants.variant_code` ← `products.style_code` (for backward compat)
- `item_variants.mrp` ← `products.mrp`
- `item_variants.selling_price` ← `products.price` (see Decision 8)
- `item_variants.attributes_json` ← {color, size, ...} (see Decision 9)

**Authority:** `products` table (as live system of record)

**Uniqueness Constraint:** 
```sql
UNIQUE (tenant_id, company_id, variant_sku)
```

**Implication:** `products.code` is never duplicated within a company; it IS the canonical variant identifier

**Sign-off:**
- [ ] Database Administrator
- [ ] Application Architect

---

### Decision 4: GLOBAL REGISTRY OWNS METADATA AND UI DEFINITIONS

**Frozen:**
```
GLOBAL REGISTRY
  │
  ├── Field definitions
  ├── Attribute catalog
  ├── UI component mappings
  ├── Validation rules
  ├── Business logic metadata
  └── Dynamic schema ownership
  
ITEM DOMAIN
  │
  └── Consumes registry definitions
      (does not override)
```

**Implication:** 
- Item Master schema is "hollow" (structure only)
- Registry provides "meaning" (semantics, UI, behavior)
- Item Master is registry-driven (not self-sovereign)
- Changes to field definitions come via registry, not schema migrations

**Sign-off:**
- [ ] Architecture Owner
- [ ] Platform Lead

---

### Decision 5: BARCODE HAS INDEPENDENT IDENTITY

**Frozen:**
```
ITEM_BARCODES (Scan Registry)
  │
  ├── Primary barcode (is_primary = true)
  ├── Alternate barcodes (is_primary = false)
  ├── Barcode type (inferred, not assumed)
  │   • EAN-13 (13 digits)
  │   • UPC-A (12 digits)
  │   • EAN-8 (8 digits)
  │   • Internal/Store barcode
  │   • GS1 identifier
  │   • Unknown (default if type cannot be determined)
  │
  └── Does NOT appear hardcoded in:
       • products table
       • item_variants
```

**Database Mapping:**
- Primary: `products.barcode` → `item_barcodes(barcode, is_primary=true)`
- Secondary: `products.secondary_barcodes` → split and normalize → `item_barcodes(is_primary=false)`
- Existing: `item_barcodes` table → merge and deduplicate

**Barcode Type Determination Logic:**
```
IF barcode matches known format:
  → Use determined type (EAN13, UPC_A, etc.)
ELSE:
  → Use 'UNKNOWN' and flag for review
  → Never assume EAN13
```

**Deduplication Rule:**
- Same barcode across variants → conflict, requires review
- Same barcode across companies → allowed (different namespace)

**Sign-off:**
- [ ] Retail Product Lead
- [ ] Inventory Manager

---

### Decision 6: PRICING HAS INDEPENDENT IDENTITY

**Frozen:**
```
ITEM_PRICES (Pricing Policy Domain)
  │
  ├── Links to: (item_id, variant_id, price_book_id, customer_tier_id, ...)
  │
  ├── Contains:
  │   • MRP (Maximum Retail Price)
  │   • Selling Price
  │   • Cost Price
  │   • Buying Price
  │   • Discount %
  │   • Discount Amount
  │   • Scheme ID
  │   • Validity (from, to)
  │
  └── Authority:
      • products.mrp, products.price, products.cost_price → migration source
      • price_books table → merge with products (reconcile authority)
```

**Decision on Item-Level vs Variant-Level Pricing:**

From database evidence: **Variants have different prices within same item (style_code)**

Therefore:
```
Pricing is VARIANT-LEVEL
  → item_prices links to (item_id, variant_id, price_book_id)
```

NOT item-level (across all variants of same item).

**Duplicate Truth Prevention:**
- NO pricing in `item_variants` (except temporary migration artifact)
- NO pricing in `products` after cutover
- Authority: `item_prices` table ONLY

**Sign-off:**
- [ ] Pricing Manager
- [ ] Distributor Product Lead

---

### Decision 7: INVENTORY HAS INDEPENDENT IDENTITY

**Frozen:**
```
ITEM_STOCK (Inventory State)
  │
  ├── Links to: (item_id, variant_id, warehouse_id, batch_no)
  │
  ├── Contains:
  │   • quantity_on_hand
  │   • quantity_reserved
  │   • quantity_damaged
  │   • batch_no
  │   • expiry_date
  │   • manufacturing_date
  │   • last_movement_at
  │
  └── Authority:
      • products.stock → migration source (aggregate view)
      • product_batch_stocks → primary source (lot-based)
```

**Balance Reconciliation:**
```
products.stock
        ↓
    (should equal)
        ↓
SUM(product_batch_stocks.quantity) per warehouse
        ↓
    (if not equal)
        ↓
    REQUIRES REVIEW
```

**Stock Movement Ledger (stock_movements):**
- Currently empty in database
- Reserved for future movement tracking
- Do NOT populate from products aggregate

**Implication:** Inventory state is reconstructed from batch stocks, not copied from products.

**Sign-off:**
- [ ] Warehouse Manager
- [ ] Inventory Lead

---

### Decision 8: ATTRIBUTES HAVE INDEPENDENT IDENTITY AND DEFINITIONS

**Frozen:**
```
ATTRIBUTE_DEFINITIONS (Metadata Authority)
  │
  ├── attribute_key (e.g., "color", "size", "material")
  ├── applicable_categories
  ├── value_type (string, enum, numeric, date, ...)
  ├── allowed_values (if enum)
  ├── validation_rules
  └── ui_control_type

ITEM_ATTRIBUTE_VALUES (Normalized Values)
  │
  ├── item_id
  ├── variant_id
  ├── attribute_definition_id
  ├── typed_value
  └── source (from products, from variant template, from user)
```

**Canonical Source for Attributes:**
- `item_attribute_values` (normalized, queryable)
- NOT `item_variants.attributes_json` (legacy transport format)

**Migration:**
```
products.color, products.size
        ↓
    Extract → item_attribute_values
    (with attribute_definition lookup)
    ↓
    attributes_json (temporary, for transition only)
    ↓
    Eventually remove JSON, use typed values only
```

**Hard-Coded Attribute Prevention:**
- NO hard-coded `color` / `size` columns in canonical schema
- NO assumption about which attributes exist
- Categories define allowed attributes (via Global Registry)
- Extensions via `item_attribute_values` (not schema changes)

**Duplicate Truth Prevention:**
- NO attributes in `item_variants.attributes_json` AND `item_attribute_values`
- Choose ONE canonical representation
- Recommendation: Normalize immediately to `item_attribute_values`

**Sign-off:**
- [ ] Product Data Manager
- [ ] Architecture Owner

---

### Decision 9: MEDIA HAS INDEPENDENT IDENTITY

**Frozen:**
```
ITEM_MEDIA (Image Registry)
  │
  ├── Links to: (item_id, variant_id)
  │
  ├── Contains:
  │   • media_url
  │   • media_type (image, video, document)
  │   • is_primary
  │   • display_order
  │   • alt_text, metadata
  │
  └── Authority:
      • products.primary_image_url → primary image
      • products.gallery_images → secondary images
      (format to be inspected: JSON array vs comma-delimited vs other)
```

**No Media in Item Variants:**
- Media is linked separately, not embedded in variant record

**Sign-off:**
- [ ] Marketing/Content Lead

---

### Decision 10: PRODUCTS REMAINS LIVE UNTIL TRANSACTIONAL CUTOVER

**Frozen:**
```
PHASE 1: Dual-Read Period
┌────────────────────────────────────────────┐
│                                            │
│  products (Legacy)                         │
│    ↓                                       │
│  READ → Return from legacy                 │
│    ↓                                       │
│  Writes → Mirror to canonical             │
│                                            │
│  ├── Direct products writes blocked        │
│  ├── Writes redirect to canonical         │
│  └── Canonical state synced back to       │
│      products (read-only cache)            │
│                                            │
│  Transactions still reference products.id  │
│  (via legacy_id_mapping lookup)            │
│                                            │
└────────────────────────────────────────────┘
        ↓
PHASE 2: Transactional Cutover
┌────────────────────────────────────────────┐
│                                            │
│  Update all transaction FKs:               │
│  sales_invoice_items.product_id            │
│  sales_order_items.product_id              │
│  procurement_items.product_id              │
│     → item_variant_id                      │
│                                            │
│  (via legacy_id_mapping lineage)           │
│                                            │
└────────────────────────────────────────────┘
        ↓
PHASE 3: Retire
┌────────────────────────────────────────────┐
│                                            │
│  products → archive (keep for audit)       │
│  (never delete, only archive)              │
│                                            │
└────────────────────────────────────────────┘
```

**Implication:** `products` is NOT the canonical model; it IS the legacy system of record until cutover is complete.

**Sign-off:**
- [ ] Database Administrator
- [ ] Application Architect

---

### Decision 11: EVERY PRODUCTS.ID GETS PERMANENT LINEAGE MAPPING

**Frozen:**
```
LEGACY_ID_MAPPING (Immutable Audit Trail)
  │
  ├── legacy_table = 'products'
  ├── legacy_id = products.id
  ├── canonical_table = 'item_variants'
  ├── canonical_id = item_variants.id
  │
  ├── migration_status IN (
  │     'MIGRATED',           -- Successfully moved
  │     'MERGED',             -- Consolidated with another record
  │     'REJECTED',           -- Invalid data, not migrated
  │     'REQUIRES_REVIEW',    -- Ambiguous, manual approval needed
  │     'CONFLICT'            -- Multiple mappings possible
  │   )
  │
  ├── migration_run_id (which execution created this mapping)
  ├── source_snapshot (timestamp of legacy data state)
  ├── conflict_code (if CONFLICT status)
  ├── validation_status (PRE_VALIDATED, POST_VALIDATED, FAILED)
  ├── validated_at
  ├── validated_by
  └── notes (human-readable reason)
```

**Lineage Examples:**
```
products.id=1452
  → item_id=431 (via style_code)
  → item_variants.id=9832 (via products.code)
  → item_barcodes.id=[22190, 22191, 22192] (all variants' barcodes)
  → item_prices.id=[5011, 5012, ...] (price records)
  → item_stock.id=[...]

sales_invoice_items.product_id = 1452
  → lookup via legacy_id_mapping
  → find item_variants.id = 9832
  → transaction now links to canonical variant
```

**No Record is Lost:**
- Every products row has a disposition
- Every variant has its complete lineage
- Every transaction reference is traceable

**Sign-off:**
- [ ] Database Administrator
- [ ] Audit/Compliance Lead

---

### Decision 12: NO SILENT DATA LOSS

**Frozen:**
```
PROHIBITED:
  ON CONFLICT (unique_constraint) DO NOTHING;
  
  This hides conflicts and makes migration failures invisible.

REQUIRED:
  ON CONFLICT (unique_constraint) 
  DO UPDATE SET
    migration_status = 'CONFLICT',
    conflict_code = 'DUPLICATE_FOUND',
    notes = 'Existing record: ' || COALESCE(EXCLUDED.id::text, 'unknown')
    
  OR log conflict in separate conflict resolution table
  
  OR reject entire migration until conflict is resolved
```

**Conflict Categories:**
```
Barcode Conflict:
  Same barcode maps to different variants/items
  → Flag, review, decide which is primary

Price Conflict:
  Multiple prices for same variant/company/book
  → Flag, review, establish single authority

Inventory Conflict:
  products.stock ≠ sum(batch_stocks)
  → Flag, reconcile, document decision

Attribute Conflict:
  Multiple values for same attribute/variant
  → Flag, review, establish single source
```

**Every Conflict Must:**
1. Be logged in conflict resolution table
2. Be reviewed by authorized personnel
3. Have documented decision (approve one, reject others, merge, split)
4. Have audit trail (who, when, why)

**Sign-off:**
- [ ] Architecture Owner
- [ ] Data Integrity Lead

---

### Decision 13: NO DUPLICATE SOURCE OF TRUTH

**Frozen:**
```
PROHIBITED PATTERNS:

1. Variant Pricing
   ❌ item_variants.mrp + item_variants.selling_price + item_prices.mrp
   ✅ item_prices ONLY (single authority)

2. Variant Attributes
   ❌ item_variants.attributes_json + item_attribute_values.value
   ✅ item_attribute_values ONLY (single canonical)
   (attributes_json is migration artifact only, eventually removed)

3. Stock
   ❌ item_stock.quantity + products.stock (after cutover)
   ✅ item_stock ONLY (single authority)

4. Barcode
   ❌ item_variants.barcode + item_barcodes.barcode
   ✅ item_barcodes ONLY (single authority)

5. Item Identity
   ❌ items.code + products.style_code
   ✅ items.code ONLY (with products.style_code as source during migration)
```

**Design Rule:**
- Each fact lives in ONE table
- All other references are FKs to that table
- Updates happen once; reads happen everywhere
- If you query two places for same fact, you've broken the contract

**Sign-off:**
- [ ] Database Architect
- [ ] Architecture Owner

---

### Decision 14: EXISTING ITEMS TABLE IS NOT AUTHORITATIVE

**Frozen:**
```
Existing items table:
  • Partially populated (few hundred records)
  • Test fragments (not production data)
  • Some records not linked to products
  • Will be REBUILT from products (not merged)

Migration strategy:
  ❌ items + products → merged canonical items
  ✅ products ONLY → canonical items
  ✅ Validate against existing items (warn if orphan/mismatch)
  ✅ Preserve existing items.id IF linked to products
  ✅ Rebuild orphan items as new records

Result:
  Canonical items = superset of existing items
  Existing items records that match → preserved
  Orphan items (not in products) → reviewed separately
```

**Implication:** Existing `items` table is a reference for validation, not a source of truth.

**Sign-off:**
- [ ] Database Administrator
- [ ] Application Architect

---

### Decision 15: PRODUCTS IS NOT PERMANENT CANONICAL MODEL

**Frozen:**
```
❌ DO NOT:
  • Assume products.* structure is the "true" canonical model
  • Keep all 47 columns in production indefinitely
  • Make products the single source of truth for all item data
  • Reference products directly from new code (use canonical tables)

✅ DO:
  • Treat products as legacy system of record (live until cutover)
  • Map products → canonical tables (items, variants, prices, etc.)
  • Make each canonical table the authoritative source for its domain
  • Plan retirement of products table (3-6 months after cutover)
  • Archive products to audit/historical schema (never delete)
```

**Implication:** The migration is not "products as the source, everything else is derived." It's "products is the current system of record, we're building a proper canonical model from it."

**Sign-off:**
- [ ] Architecture Owner
- [ ] Database Administrator

---

### Decision 16: RETAIL / DISTRIBUTOR / WAREHOUSE / ENTERPRISE CONSUME CANONICAL ITEM DOMAIN

**Frozen:**
```
Product Edition Behavior:
┌─────────────────────────────────────────────────┐
│  CANONICAL ITEM DOMAIN (Shared)                 │
│  ├── items (parent catalog)                     │
│  ├── item_variants (operational SKU)            │
│  ├── item_barcodes (scan identities)            │
│  ├── item_prices (pricing policies)             │
│  ├── item_stock (inventory state)               │
│  ├── item_attribute_values (properties)         │
│  └── item_media (images, documents)             │
└─────────────────────────────────────────────────┘
   ↑              ↑              ↑              ↑
   │              │              │              │
RETAIL      DISTRIBUTOR     WAREHOUSE      ENTERPRISE
   │              │              │              │
   ├── Visibility └──────────────┴──────────────┤
   │   • Show/hide fields per edition            │
   │   • Show/hide attributes per category       │
   │   • Role-based access control               │
   │                                             │
   ├── Policy Layer                             │
   │   • Retail = POS, simple price book        │
   │   • Distributor = multi-tier pricing       │
   │   • Warehouse = batch, lot, movement       │
   │   • Enterprise = all policies              │
   │                                             │
   ├── Pricing Layer                            │
   │   • Retail = retail_price_book             │
   │   • Distributor = distributor_price_book   │
   │   • Warehouse = cost_price_book            │
   │   • Enterprise = all price books            │
   │                                             │
   ├── Inventory Layer                          │
   │   • Retail = store inventory               │
   │   • Distributor = branch, customer         │
   │   • Warehouse = warehouse, bin, lot        │
   │   • Enterprise = all warehouses            │
   │                                             │
   └── Workflow Layer
       • Retail = POS, quick order
       • Distributor = sales order, allocation
       • Warehouse = receiving, putaway, picking
       • Enterprise = all workflows
```

**Key Principle:**
- ONE Item Domain
- FOUR Product Editions
- Differentiation via Policy, Visibility, Capability
- NOT via separate item masters

**Implication:** Do not create `items_retail`, `items_distributor`, etc. Use `items` + policy layer.

**Sign-off:**
- [ ] Product Lead (Retail)
- [ ] Product Lead (Distributor)
- [ ] Product Lead (Warehouse)
- [ ] Product Lead (Enterprise)

---

## CONSEQUENCES OF THIS CONTRACT

### What This Contract ENABLES

✅ **Unified Item Master**
- All 4 SMRITI products use same item domain
- No redundant data silos
- Single source of truth per domain (prices, barcodes, inventory, attributes)

✅ **Transactional Integrity**
- Every sales/procurement record is traceable to canonical variant
- Foreign keys can be updated deterministically
- Audit trail is complete and immutable

✅ **Scalability**
- Adding new product editions does NOT require new item master
- Just add policy/capability layer
- Item domain grows only with actual product diversity

✅ **Data Quality**
- NO silent conflicts (ON CONFLICT DO NOTHING forbidden)
- NO duplicate sources of truth (architecture enforced)
- Every record has explicit disposition (MIGRATED, MERGED, REJECTED, REVIEW)

✅ **Global Registry Alignment**
- Item master consumes registry definitions
- UI and validation follow registry, not hard-coded in schema
- Extensions via registry, not via schema changes

### What This Contract REQUIRES

⚠️ **Precise Lineage Tracking**
- Every products.id must map to canonical variant
- Every transaction FK must be updated
- Every conflict must be resolved explicitly

⚠️ **Dry-Run Reconciliation**
- Before production cutover, MUST test complete mapping
- MUST validate zero data loss
- MUST audit all conflicts and resolutions

⚠️ **Transactional Cutover Planning**
- Requires downtime or dual-read mode
- Requires FK updates to all transaction tables
- Requires validation after cutover

⚠️ **Retirement of Legacy Data**
- products table cannot be used indefinitely
- Must archive within 6 months
- Must maintain legacy_id_mapping for audit (permanent)

### What This Contract FORBIDS

❌ **Separate Item Masters per Product Edition**
- No items_retail, items_distributor, items_warehouse, items_enterprise

❌ **Silent Data Loss**
- No ON CONFLICT DO NOTHING without review
- Every conflict must have documented resolution

❌ **Duplicate Sources of Truth**
- No pricing in both item_variants and item_prices
- No attributes in both JSON and normalized table
- No inventory in both products and item_stock

❌ **Hard-Coded Product-Specific Logic**
- No products table as permanent model
- No assumption that products.code is "item code"
- No hard-coded EAN13 barcodes

❌ **Immediate Production Migration**
- Must complete dry-run first
- Must validate all conflicts
- Must update all transaction FKs
- Must have cutover plan and rollback strategy

---

## AMENDMENT PROCESS

**This contract is binding but not immutable.**

To amend Decision N:

1. Document the amendment request (RFC)
2. Provide evidence for why current decision is wrong/insufficient
3. Propose alternative decision with implications
4. Route to original sign-off stakeholders for re-approval
5. Log amendment with timestamp and reason

**Example Amendment:**
```
RFC: Should pricing be item-level OR variant-level?

Current Decision: Variant-level (Decision 6)

Reason to Amend: New analysis shows Retail only ever prices at item-level, 
                 while Distributor + Enterprise price at variant-level

Proposed Change: Pricing is variant-level by default, with item-level 
                 pricing as a policy mode for Retail

Impact: Slightly more complex, better serves all products

Stakeholders to re-approve:
  • Pricing Manager
  • Retail Product Lead
  • Distributor Product Lead
```

---

## CURRENT SIGN-OFF STATUS

| Role | Name | Decision | Date | Signature |
|------|------|----------|------|-----------|
| Architecture Owner | Bhai | All 16 frozen | 2026-09-01 | — |
| Database Architect | — | TBD | — | — |
| Engineering Lead | — | TBD | — | — |
| Retail Lead | — | TBD | — | — |
| Distributor Lead | — | TBD | — | — |
| Warehouse Lead | — | TBD | — | — |
| Enterprise Lead | — | TBD | — | — |
| Database Admin | — | TBD | — | — |
| Compliance/Audit | — | TBD | — | — |

---

## NEXT PHASE: DRY-RUN RECONCILIATION

Once this contract is signed, the next step is:

**[ITEM_MASTER_DRY_RUN_RECONCILIATION.py](../scripts/ITEM_MASTER_DRY_RUN_RECONCILIATION.py)**

This script will:
1. Connect to smriti001 database
2. Inspect all products, items, item_variants, item_barcodes, pricing, inventory
3. Apply mapping logic from this contract
4. Simulate canonical schema
5. Validate ZERO LOSS principle
6. Report all conflicts for review
7. Generate lineage mapping audit trail
8. Recommend approval/rejection before production

**Status:** Ready to build once contract is signed.

---

**END OF CONTRACT**

*Last Updated: 2026-09-01*
*Version: 1.0*
*Status: AWAITING STAKEHOLDER SIGN-OFF*

