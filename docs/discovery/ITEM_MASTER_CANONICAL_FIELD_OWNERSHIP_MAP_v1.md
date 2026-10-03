# ITEM MASTER CANONICAL FIELD OWNERSHIP MAP

**Status:** Discovery gate, pre-migration approval checkpoint
**Date:** 2026-09-01
**Scope:** Freeze the target ownership of item, variant, barcode, pricing, inventory, metadata, media, and compliance fields before any implementation or migration begins.

---

## 1. Architecture Decision to Freeze

The approved platform direction is:

```text
SMRITI Item Domain
  ├── Item
  ├── Item Variant
  ├── Item Barcode
  ├── Item Pricing
  ├── Item Inventory
  ├── Item Attribute Definition
  ├── Item Media
  └── Item Compliance
```

The following must be treated as context, capability, and policy, not as a separate item universe:

- Retail
- Distributor
- Warehouse
- Enterprise

`products` is not a canonical item master. It is a legacy compatibility surface only.

---

## 2. Canonical Ownership Model

### 2.1 Item
Represents the master catalog identity.

**Owner:** `items` (or canonical item table)

**Purpose:**
- item identity
- business classification
- catalog metadata
- default parent metadata
- base compliance settings

**Fields:**
- `id`
- `uuid`
- `company_id`
- `branch_id`
- `code`
- `name`
- `category_id`
- `brand_id`
- `status`
- `hsn_code`
- `tax_profile_id`
- `default_uom_id`
- `created_at`, `modified_at`, `created_by`, `updated_by`
- `is_active`, `is_deleted`, `deleted_at`, `deleted_by`, `version`

### 2.2 Item Variant
Represents the operationally identifiable SKU/variant.

**Owner:** `item_variants`

**Purpose:**
- variant code/name
- configurable dimensions
- variant-level pricing
- variant-level barcode binding
- item family membership

**Fields:**
- `id`
- `uuid`
- `item_id`
- `variant_sku`
- `variant_name`
- `attributes_json`
- `mrp`
- `selling_price`
- `cost_price`
- `is_active`, `is_deleted`
- `created_at`, `modified_at`
- `company_id`, `branch_id`

### 2.3 Item Barcode
Represents unique scan identity.

**Owner:** `item_barcodes`

**Purpose:**
- primary and alternate barcodes
- barcode type
- uniqueness validation
- scanning lookup

**Fields:**
- `id`
- `uuid`
- `item_id`
- `variant_id`
- `barcode`
- `barcode_type`
- `is_primary`
- `company_id`, `branch_id`

### 2.4 Item Price
Represents pricing policy and pricing context.

**Owner:** pricing domain (`price_books`, `price_book_entries`, customer pricing layer, pricing rules)

**Purpose:**
- selling price policy
- customer/branch tier logic
- campaign or scheme pricing
- MRP vs selling price separation

### 2.5 Item Inventory
Represents stock state and stock movement authority.

**Owner:** inventory domain (`stock_movements`, `product_batch_stocks`, warehouse tables, reservation layer)

**Purpose:**
- on-hand quantity
- reserved quantity
- batch and warehouse movement
- stock ledger

### 2.6 Item Metadata / Attributes
Represents configurable item descriptors and category-driven dimensions.

**Owner:** `attribute_definitions` + attribute value tables

**Purpose:**
- color/size/fit/storage/pack_size etc.
- category-specific dimensions
- no hard-coded columns in master identity

### 2.7 Item Media
Represents images and attachments.

**Owner:** media domain (`item_media` or equivalent)

**Purpose:**
- primary image
- gallery images
- attachments

### 2.8 Item Compliance
Represents tax and regulatory fields.

**Owner:** compliance domain

**Purpose:**
- GST %
- HSN/SAC
- tax profile mapping
- regulatory flags

---

## 3. Current Field Ownership Map

### 3.1 `products` table → Target ownership

| Current field | Current owner | Target owner | Status | Decision |
|---|---|---|---|---|
| `code` | `products` | `items.code` or `item_variants.variant_sku` | Active | Canonical item identity |
| `name` | `products` | `items.name` | Active | Item identity |
| `price` | `products` | pricing domain | Active | Move to price policy |
| `stock` | `products` | inventory domain | Active | Derived cache only |
| `category` | `products` | `items.category_id` or `category` domain | Active | Move to category taxonomy |
| `is_favorite` | `products` | user/personalization layer | Active | Not item master core |
| `barcode` | `products` | `item_barcodes` | Active | Canonical barcode registry |
| `secondary_barcodes` | `products` | `item_barcodes` | Active | Move to barcode domain |
| `brand` | `products` | `items.brand_id` or brand master | Active | Move to branding taxonomy |
| `color` | `products` | `item_variants.attributes_json` or attribute store | Mixed | Not a canonical hard column |
| `size` | `products` | `item_variants.attributes_json` or attribute store | Mixed | Not a canonical hard column |
| `mrp` | `products` | pricing domain + variant pricing | Active | Move to pricing |
| `gst_percentage` | `products` | compliance domain | Active | Move to tax policy |
| `style_code` | `products` | `item_variants.variant_sku` or attribute store | Mixed | Move to variant metadata |
| `cost_price` | `products` | pricing domain / variant cost | Partial | Move to pricing/cost policy |
| `sku` | `products` | `item_variants.variant_sku` or item code | Partial | Canonical variant identifier |
| `hsn_code` | `products` | compliance domain | Active | Tax regulation |
| `pricing_mode` | `products` | pricing domain | Partial | Policy not identity |
| `tracking_mode` | `products` | inventory domain | Partial | Inventory policy |
| `variant_template_id` | `products` | attribute definition / variant config | Legacy | Retire if unused |
| `weight_grams` | `products` | item metadata / logistics domain | Partial | Move to logistics metadata |
| `attributes` | `products` | `attribute_definitions` + attribute values | Active | Dynamic metadata domain |
| `primary_image_url` | `products` | media domain | Active | Move to media |
| `gallery_images` | `products` | media domain | Active | Move to media |
| `reserved_stock` | `products` | inventory domain | Active | Inventory reservation state |
| `category_code` | `products` | category taxonomy | Legacy | Retire if unused |
| `cbm_m3` | `products` | logistics domain | Legacy | Retire if unused |
| `document_number` | `products` | document workflow domain | Legacy | Retire if unused |
| `size_scale_id` | `products` | variant attribute config | Legacy | Retire if unused |
| `sourcing_mode_override` | `products` | procurement policy domain | Legacy | Retire if unused |
| `tenant_id` | `products` | platform tenant authority | Active | Platform metadata |
| `workflow_status` | `products` | workflow domain | Active | Workflow, not master identity |
| `id` | `products` | `items.id` / `item_variants.id` | Active | Identity key |
| `uuid` | `products` | canonical id layer | Active | System identity |
| `company_id` | `products` | platform tenant ownership | Active | Multi-tenant metadata |
| `branch_id` | `products` | branch/context layer | Active | Context |
| `created_at` | `products` | shared audit layer | Active | Audit metadata |
| `modified_at` | `products` | shared audit layer | Active | Audit metadata |
| `created_by` | `products` | shared audit layer | Active | Audit metadata |
| `updated_by` | `products` | shared audit layer | Active | Audit metadata |
| `is_active` | `products` | item lifecycle domain | Active | Lifecycle |
| `is_deleted` | `products` | item lifecycle domain | Active | Lifecycle |
| `deleted_at` | `products` | audit lifecycle | Active | Audit |
| `deleted_by` | `products` | audit lifecycle | Active | Audit |
| `version` | `products` | shared audit/version layer | Active | Audit versioning |
| `variant_id` | `products` | `item_variants.id` | Mixed | Move to variant linking |
| `buying_price` | `products` | pricing domain | Partial | Procurement pricing |

---

## 4. Cross-Table Ownership Map

### 4.1 `items` table

| Field | Target owner | Notes |
|---|---|---|
| `item_code` | item identity | canonical item code |
| `item_name` | item identity | canonical item name |
| `item_type` | category / taxonomy | product class |
| `category` | category domain | classification |
| `category_code` | category domain | may be legacy |
| `brand` | brand domain | cross-reference |
| `hsn_code` | compliance domain | tax code |
| `tax_rate` | compliance domain | tax policy |
| `primary_uom` | item master / UOM domain | unit measure |
| `mrp` | pricing domain | not item identity |
| `selling_price` | pricing domain | price policy |
| `cost_price` | pricing domain | cost policy |
| `is_batch_tracked` | inventory domain | inventory policy |
| `is_serial_tracked` | inventory domain | inventory policy |
| `is_favorite` | personalization layer | not core identity |
| `status` | lifecycle domain | active/inactive status |
| `attributes_json` | attribute domain | dynamic metadata |
| `primary_image_url` | media domain | image asset |
| `tags` | taxonomy / indexing | not base identity |
| `buying_price` | pricing domain | procurement price |

### 4.2 `item_variants`

| Field | Target owner | Notes |
|---|---|---|
| `item_id` | item identity | parent item |
| `variant_sku` | variant identity | canonical SKU |
| `variant_name` | variant identity | variant label |
| `attributes_json` | attribute domain | configurable dimensions |
| `mrp` | pricing domain | price policy |
| `selling_price` | pricing domain | price policy |
| `cost_price` | pricing domain | cost policy |

### 4.3 `item_barcodes`

| Field | Target owner | Notes |
|---|---|---|
| `item_id` | item identity | parent item |
| `variant_id` | variant identity | linked variant |
| `barcode` | barcode domain | canonical scan code |
| `barcode_type` | barcode domain | EAN/UPC etc |
| `is_primary` | barcode domain | uniqueness authority |

### 4.4 `product_batch_stocks`

| Field | Target owner | Notes |
|---|---|---|
| `product_id` | item identity | item/variant relationship |
| `warehouse_id` | inventory domain | warehouse context |
| `batch_no` | inventory domain | batch tracking |
| `quantity` | inventory domain | stock quantity |
| `reserved_quantity` | inventory domain | reservation |
| `damaged_quantity` | inventory domain | stock adjustment |
| `expiry_date` | inventory/compliance | lot control |

### 4.5 `price_books` / `price_book_entries`

| Field | Target owner | Notes |
|---|---|---|
| `name` | pricing domain | price book name |
| `code` | pricing domain | book code |
| `currency` | pricing domain | price book currency |
| `is_default` | pricing domain | policy flag |
| `valid_from` / `valid_to` | pricing domain | effective dates |
| `status` | pricing domain | active/inactive |

---

## 5. Fields That Should Be Retired or Reclassified

These are the strongest candidates for retirement or transition away from item identity:

| Field | Reason | Recommendation |
|---|---|---|
| `variant_template_id` | 100% NULL + unused | retire |
| `category_code` | 100% NULL + unused | retire |
| `cbm_m3` | 100% NULL + unused | retire |
| `document_number` | 100% NULL + unused | retire |
| `size_scale_id` | 100% NULL + unused | retire |
| `sourcing_mode_override` | 100% NULL + unused | retire |
| `pricing_mode` | mostly unused | reclassify as pricing policy |
| `tracking_mode` | mostly unused | reclassify as inventory policy |
| `color`, `size`, `style_code` | hard-coded variant assumptions | move to attribute domain |
| `secondary_barcodes` | duplicated with barcode table | move to barcode registry |
| `products.stock` | denormalized cache | move to inventory state |
| `reserved_stock` | inventory state | move to inventory reservation |

---

## 6. Recommended Approval Statement

The following statement should be approved before any migration work begins:

> The SMRITI Item Domain is a platform-level canonical domain. There is one item identity model, one variant identity model, and one barcode registry. Retail, Distributor, Warehouse, and Enterprise are policy/context layers applied over the same canonical item graph, not separate item universes. `products` is legacy compatibility only and must not remain the authoritative item master after target architecture approval.

---

## 7. Migration Authority Rule

Before migration, the authority for each domain must be explicitly frozen:

| Domain | Authority |
|---|---|
| Item identity | `items` / canonical item table |
| Variant identity | `item_variants` |
| Barcode identity | `item_barcodes` |
| Pricing | pricing domain |
| Inventory | inventory domain |
| Metadata | attribute domain |
| Media | media domain |
| Compliance | compliance domain |
| Workflow / status | workflow domain |
| Legacy product compatibility | `products` only as read/bridge layer |

---

## 8. Final Gate Before Implementation

Do not begin migration until the following are approved and documented:

1. canonical item ownership
2. canonical variant ownership
3. canonical barcode ownership
4. pricing authority boundary
5. inventory authority boundary
6. metadata authority boundary
7. field retirement list
8. compatibility layer for legacy `products`

**This document is a decision gate, not an implementation plan.**
