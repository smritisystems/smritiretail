# Proposed New Item Master Architecture with Global Present and Registry

**Status:** Proposal only. No schema or code changes made.
**Date:** 2026-09-01
**Scope:** Replace the fragmented and over-loaded item master model with a modular canonical design driven by a global field registry and registry-based forms.

---

## 1. Executive Summary

The current item master is not a single coherent model. It is a combination of:

- product-level denormalized fields in `products`
- legacy/optional columns in the same table
- partial modular tables like `item_variants`, `item_barcodes`, `price_books`, `product_batch_stocks`
- a separate `items` table that is not clearly connected to `products`
- hard-coded UI field definitions in the Item Master workspace
- registry-based field definitions that exist but are not yet the canonical source for item master behavior

This means the system has both a data problem and a design problem:

1. The authoritative master is unclear.
2. Variant support is not truly configurable.
3. Barcodes are duplicated across multiple structures.
4. Pricing is partial and inconsistent.
5. UI fields are spread across forms, screens, and custom metadata.

The proposed design is to unify the item master around a single canonical item architecture and treat the registry as the shared definition layer for all screens.

---

## 2. What Should Be Dismantled

### 2.1 Dismantle the Monolithic Product Mental Model

The current `products` table acts as a catch-all object with both master and variant data, pricing data, stock cache, and optional retail metadata. This is the root of the complexity.

The following concepts should no longer be treated as one table doing everything:

- Product identity
- Variant identity
- Barcode identity
- Pricing policy
- Inventory aggregation
- Category metadata
- Media metadata
- Audit metadata
- Custom dimension attributes

### 2.2 Dismantle Hard-Coded Item UI Fields

The app already has a registry model in:

- [src/services/unifiedFieldCatalog.ts](src/services/unifiedFieldCatalog.ts)
- [src/components/itemMaster/types.ts](src/components/itemMaster/types.ts)
- [GLOBAL_FIELD_REGISTRY_GUIDE.md](GLOBAL_FIELD_REGISTRY_GUIDE.md)

These files reveal the right direction: item fields should be defined once and reused across form screens, lookup flows, and validation logic.

The current issue is that the item master itself still behaves like a detached screen-specific model rather than a registry-driven domain object.

### 2.3 Dismantle Duplicate Source-of-Truth Concepts

These should not remain as independent parallel masters:

- `products` vs `items`
- `products.barcode` vs `item_barcodes`
- `products.color/size/style` vs `item_variants.attributes_json`
- `products.price` vs `price_books` vs customer price rules
- `products.stock` vs `stock_movements` vs `product_batch_stocks` vs PSV projections

The replacement must establish one canonical source for each concern.

---

## 3. Design Principles for the Replacement

1. One domain owns one concern.
2. The registry owns field metadata, not database logic.
3. The item master is not a single flat form; it is a structured domain model.
4. Variant dimensions are configurable per category, never hard-coded globally.
5. All item screens consume the same field catalog.
6. Lookup, validation, and form rendering are driven by registry metadata.
7. Inventory, pricing, and barcode records are separate entities with explicit authority boundaries.

---

## 4. Proposed Canonical Item Master Model

### 4.1 Core Domain Objects

The replacement model should be split into these canonical domains:

#### A. Item
Represents the master product identity.

Properties:
- id
- tenant_id / company_id
- code
- name
- category_id
- brand_id
- status
- created_at / modified_at
- is_active / is_deleted
- default_uom_id
- default_tax_profile_id
- base_hsn_code

Responsibilities:
- identity and catalog definition
- shared non-variant master data
- business status and classification

#### B. Item Variant
Represents a specific sellable variant of an item.

Properties:
- id
- item_id
- variant_code
- variant_name
- attributes_json
- mrp
- selling_price
- cost_price
- status
- barcode_primary_id

Responsibilities:
- configurable product combinations
- variant-specific pricing and barcodes
- data for apparel, footwear, electronics, and grocery domains

#### C. Item Barcode
Represents one barcode mapped to a product or variant.

Properties:
- id
- item_id
- variant_id
- barcode
- barcode_type
- is_primary
- source
- status

Responsibilities:
- barcode registry
- uniqueness validation
- lookup by scan
- EAN/UPC/SKU mapping

#### D. Item Price
Represents pricing policy, not product state.

Properties:
- id
- item_id
- variant_id
- price_book_id
- customer_tier_id
- branch_id
- valid_from
- valid_to
- selling_price
- mrp
- discount_policy

Responsibilities:
- price rules
- price books
- customer-specific pricing
- branch/region variation

#### E. Item Inventory
Represents stock-related state and ledger boundaries.

Properties:
- item_id
- variant_id
- warehouse_id
- batch_id
- quantity_on_hand
- reserved_quantity
- available_quantity
- last_movement_at

Responsibilities:
- stock state
- warehouse/batch tracking
- inventory availability calculation

#### F. Item Attribute Definition
Represents metadata schema, not item values.

Properties:
- id
- entity_type = item
- attribute_key
- label
- datatype
- valid_values
- required_flag
- is_active
- display_order

Responsibilities:
- dynamic item attributes
- configurable variant dimensions
- per-category attribute definitions

#### G. Item Media
Represents catalog images and attachments.

Properties:
- id
- item_id
- variant_id
- media_type
- url
- is_primary
- sort_order

Responsibilities:
- image library
- product catalog display
- attachments and marketing assets

---

## 5. Platform-Level Item Domain (Pre-Approval Decision)

### 5.1 Root Rule

The canonical master should be a platform-level domain, not a retail-only feature.

The same item can therefore be used across:

- Retail sales
- Distributor sales
- Warehouse operations
- Enterprise procurement
- Purchase orders
- Sales orders
- Stock transfers
- POS
- Inventory
- Pricing
- Barcode scanning
- GST/HSN/compliance

This means:

- There is one `SMRITI Item Domain`
- There are multiple business contexts around it
- There are not multiple item masters for Retail, Distributor, Warehouse, and Enterprise

### 5.2 Item and Variant Ownership

The proposed structure remains:

- Item = generic catalog identity
- Variant = operationally identifiable item/SKU

But we should go one level further than a retail-only interpretation.

A variant should not be treated as inherently "retail sellable." It should represent the operationally identifiable item/SKU regardless of whether it is:

- purchased
- sold
- stored
- transferred
- manufactured
- bundled
- consumed
- returned

The business behavior should be controlled by policy, capability, and context, not by creating separate item masters.

This yields the following pattern:

```text
ITEM
 ├── Variant A
 │    ├── Barcode(s)
 │    ├── UOM
 │    ├── Packaging
 │    ├── Pricing
 │    ├── Inventory
 │    └── Compliance
 │
 └── Variant B
      ├── Barcode(s)
      ├── UOM
      ├── Packaging
      ├── Pricing
      ├── Inventory
      └── Compliance
```

### 5.3 Business Behavior by Context, Not Identity Separation

The same underlying item participates in different business behavior depending on context:

#### SMRITI Retail
- Barcode
- Selling price
- MRP
- POS
- Stock
- Customer
- Returns

#### SMRITI Distributor
- Purchase
- Distributor price
- Dealer/customer tier
- Scheme
- Credit
- Batch
- Dispatch

#### SMRITI Warehouse
- Warehouse
- Bin
- Batch
- Lot
- UOM
- Quantity
- Reserved
- Picking
- Movement

#### SMRITI Enterprise
- Company
- Branch
- Warehouse
- Price policies
- Tax policies
- Procurement policies
- Security / authorization

There is no duplicate item universe in any of these domains.

### 5.4 Why This Is Better

It solves the current issues while honoring the four-product direction:

- supports cross-domain item reuse
- avoids duplicated item records across product lines
- keeps business context separate from identity
- preserves a single canonical item identity across enterprise workflows
- allows Warehouse and Enterprise to act as operational contexts rather than separate item universes

---

## 6. Proposed Global Present and Registry Model

The global present layer should be a central registry that defines every field once and serves all screens.

### 6.1 Registry Source of Truth

The primary registry should be a metadata catalog that includes:

```ts
interface GlobalFieldDef {
  id: string;
  entity: "item" | "variant" | "barcode" | "price" | "inventory" | "party" | "document";
  fieldKey: string;
  label: string;
  dataType: "text" | "number" | "currency" | "date" | "select" | "boolean";
  required: boolean;
  aliases: string[];
  lookupGroup?: string;
  sourceTable?: string;
  displayGroup: "core" | "variant" | "pricing" | "inventory" | "taxonomy" | "media" | "dynamic";
  active: boolean;
  displayOrder: number;
}
```

### 6.2 Item Registry Example

```ts
[
  { id: "item.code", entity: "item", fieldKey: "code", label: "Stock No / SKU", dataType: "text", required: true, aliases: ["sku", "item_code"], displayGroup: "core", displayOrder: 1 },
  { id: "item.name", entity: "item", fieldKey: "name", label: "Item Name", dataType: "text", required: true, aliases: ["product_name", "description"], displayGroup: "core", displayOrder: 2 },
  { id: "item.category", entity: "item", fieldKey: "category", label: "Category", dataType: "text", required: true, aliases: ["department"], displayGroup: "taxonomy", displayOrder: 3 },
  { id: "item.brand", entity: "item", fieldKey: "brand", label: "Brand", dataType: "text", required: false, aliases: ["manufacturer"], displayGroup: "taxonomy", displayOrder: 4 },
  { id: "item.barcode", entity: "barcode", fieldKey: "barcode", label: "Barcode", dataType: "text", required: true, aliases: ["ean", "upc"], lookupGroup: "product", displayGroup: "core", displayOrder: 5 },
  { id: "item.gst", entity: "item", fieldKey: "gst_percentage", label: "GST %", dataType: "select", required: true, aliases: ["tax_rate", "gst"], displayGroup: "core", displayOrder: 6 },
  { id: "item.hsn", entity: "item", fieldKey: "hsn_code", label: "HSN Code", dataType: "text", required: true, aliases: ["hsn"], displayGroup: "core", displayOrder: 7 }
]
```

### 6.3 Screen Registry Rules

The global registry should handle:

- which fields appear on which screen
- width/column order
- required vs optional on screen
- lookup group mapping
- default labels and aliases
- dynamic attribute rules

This matches the existing architecture already present in:

- [src/services/unifiedFieldCatalog.ts](src/services/unifiedFieldCatalog.ts)
- [src/components/itemMaster/types.ts](src/components/itemMaster/types.ts)
- [GLOBAL_FIELD_REGISTRY_GUIDE.md](GLOBAL_FIELD_REGISTRY_GUIDE.md)

This should be the default framework for all new item screens.

---

## 7. Proposed New Item Master Screen Architecture

### 7.1 Replace Old ItemMaster Workspace with Registry-Driven Views

The new item master should have these screens:

#### Screen 1: Item Catalog Search
- Search by code, barcode, name, brand, category
- Fast filters by status and category
- Global lookup integration
- Uses registry metadata for display columns

#### Screen 2: Item Details
- Core item information
- category and classification
- primary barcode and alternate barcodes
- media and attachments
- dynamic attributes

#### Screen 3: Variant Matrix Editor
- configurable dimensions per category
- color/size/fit/storage/model as dynamic attributes
- variant SKU generation
- pricing for each variant

#### Screen 4: Pricing Studio
- price books
- branch tier pricing
- customer-specific pricing
- promotional prices

#### Screen 5: Inventory & Batch View
- stock overview
- batch data
- warehouse view
- reserved stock logic
- stock ledger link

#### Screen 6: Compliance / Tax / Taxonomy
- HSN/GST mapping
- logical flags
- category compliance fields

---

## 8. Proposed Global Present Pattern

### 8.1 What “Global Present” Means Here

A field is not “known” because it sits in one form. It becomes known because it is centrally defined and globally available to all relevant screens.

Example:

- `item_code` is registered once
- It may appear on Purchase Order, Sales Order, Item Master, Barcode Scan UI, and Inventory Transfer
- All screens reference the same registry definition
- All F2 lookup and keyboard entry logic use the same routing

### 8.2 How This Cures Current Problems

The item master becomes:

- consistent across screens
- easier to extend
- not duplicated in many local forms
- easier to validate and audit
- easier to support new categories without schema churn

---

## 9. Proposed Registry Rules for Item Master

### 9.1 Category-Driven Variant Dimensions

Instead of hard-coded `color`, `size`, `style_code` in `products`, the system should define variant dimensions by category.

Examples:

#### Apparel
- color
- size
- fit
- fabric

#### Footwear
- color
- size
- width
- heel_type

#### Electronics
- storage
- ram
- color
- network

#### Grocery
- pack_size
- unit
- flavor
- brand_pack

#### Batch-Controlled Goods
- batch_no
- expiry_date
- warehouse

### 9.2 Dynamic Attribute Model

The item master should support configurable fields like:

- `material`
- `fit`
- `storage_capacity`
- `pack_size`
- `variant_group`

These should be stored in `attribute_definitions` and item-level values in `item_attributes`, not by hard-coding columns into a monolithic table.

---

## 10. Proposed Target Architecture Summary

### Keep these domain boundaries clean

| Domain | Responsibility | Canonical Table / Model |
|---|---|---|
| Item Identity | item master catalog | `items` or canonical item table |
| Variant Identity | SKU combinations | `item_variants` |
| Barcode | scan identity | `item_barcodes` |
| Pricing | sell price policies | `price_books`, `price_book_entries`, pricing rules |
| Inventory | quantity state | `product_batch_stocks`, `stock_movements` |
| Metadata | dynamic fields | `attribute_definitions`, `item_attributes` |
| Media | product images | `item_media` |
| Compliance | GST/HSN | item compliance table |
| Audit | creation + change trails | system audit tables |

### Remove or transform these current patterns

| Current Pattern | Proposed Pattern |
|---|---|
| `products` as impossible catch-all | `items` + `item_variants` + related domain tables |
| hard-coded `color`, `size`, etc. | configurable attributes per category |
| product pricing in flat columns | price books + price rules |
| barcode duplication | single barcode registry |
| item UI fields hard-coded | global registry metadata |
| no universal field registry for item screens | registry-driven UI and lookup |

---

## 11. Implementation Path (Proposal Only)

This is not a live code change, but the logical sequence is:

1. Establish canonical item domain ownership
2. Define registry field catalog for item entities
3. Keep `products` read-compatible while creating clear boundaries
4. Migrate variant fields into configurable attribute definitions
5. Move barcode lookup to one canonical registry
6. Move pricing rules to pricing domain
7. Replace form code with registry-driven rendering
8. Validate with a field mapping and data comparison pass

---

## 12. Final Recommendation

The best replacement is not a smaller flat `products` table.

It is a platform-level, registry-driven, domain-separated item architecture:

- Item = canonical identity
- Variant = operationally identifiable SKU
- Barcode = unique scan identity
- Price = policy layer
- Inventory = stock and movement layer
- Metadata = dynamic attributes layer
- Global Registry = platform metadata authority for all fields and behaviors
- Retail / Distributor / Warehouse / Enterprise = business contexts and policies, not separate item masters

This aligns with the app’s existing direction in:

- [src/services/unifiedFieldCatalog.ts](src/services/unifiedFieldCatalog.ts)
- [src/components/itemMaster/types.ts](src/components/itemMaster/types.ts)
- [GLOBAL_FIELD_REGISTRY_GUIDE.md](GLOBAL_FIELD_REGISTRY_GUIDE.md)

and resolves the problems revealed by the discovery audit.

### Important distinction

**Global Registry ≠ Item Master Registry**

The registry is the platform-wide metadata authority, while the item master is one domain model consuming that registry.

This distinction is important because it prevents the system from creating multiple item universes while still allowing each business module to render the right fields and behavior.

---

## 13. Architecture Decision Gate Before Implementation

This proposal is ready for architecture approval only if the following decision is frozen before any migration begins:

```text
ITEM MASTER ARCHITECTURE — DECISION GATE

1. Canonical identity       -> items
2. Variant                  -> item_variants
3. Barcode                  -> item_barcodes
4. Pricing                  -> pricing domain
5. Inventory                -> inventory domain
6. Attributes               -> attribute domain
7. Media                    -> media domain
8. Compliance               -> compliance domain
9. Global fields            -> Global Field Registry
10. Retail / Distributor / Warehouse / Enterprise -> business contexts/capabilities
11. products                -> legacy compatibility only
```

### Pre-approval requirement

Before implementation starts, the agent should produce a canonical field-by-field mapping of:

- `products`
- `items`
- `item_variants`
- `item_barcodes`
- pricing tables
- inventory tables

This mapping must include:

- ownership
- duplicate fields
- migration authority
- fields that should be retired
- fields that are legacy only
- fields that belong to business policy rather than item identity

### Explicit recommendation

**Approve the architecture direction, but do not let the agent start migration yet.**

The next step should be a discovery gate that exposes risk before any PostgreSQL work begins.

**No implementation or database change is proposed in this document.**
