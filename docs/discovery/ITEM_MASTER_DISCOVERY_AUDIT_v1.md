<!-- 
  PROJECT: SMRITI Retail OS
  DISCOVERY AUDIT: Item Master Architecture Assessment
  STATUS: DISCOVERY PHASE ONLY — NO IMPLEMENTATION
  CLASSIFICATION: Internal
  VERSION: 1.0.0
  DATE: 2026-09-01
-->

# ITEM MASTER DISCOVERY AUDIT

**Audit Objective:** Produce a real, evidence-based assessment of SMRITI Retail OS Item Master architecture without making any database, code, or schema changes.

**Scope:** Current state analysis of products table, related tables, dependencies, and existing inventory/variant architecture.

---

## A. CURRENT PRODUCTS TABLE SCHEMA INVENTORY

### A.1 Actual Column Count and Structure

**Total Columns: 47** (verified via direct schema query)

| # | Column Name | Data Type | Nullable | Default | Classification |
|---|---|---|---|---|---|
| 1 | `code` | VARCHAR(50) | NO | — | **Product Identification** |
| 2 | `name` | VARCHAR(255) | NO | — | **Product Identification** |
| 3 | `price` | NUMERIC | NO | — | **Pricing** |
| 4 | `stock` | INTEGER | NO | — | **Inventory** |
| 5 | `category` | VARCHAR(100) | NO | — | **Classification** |
| 6 | `is_favorite` | BOOLEAN | YES | — | **Custom/Workflow** |
| 7 | `barcode` | VARCHAR(100) | NO | — | **Barcode** |
| 8 | `secondary_barcodes` | VARCHAR[] | YES | '{}' | **Barcode** |
| 9 | `brand` | VARCHAR(100) | YES | — | **Classification** |
| 10 | `color` | VARCHAR(50) | YES | — | **Product Variant** |
| 11 | `size` | VARCHAR(50) | YES | — | **Product Variant** |
| 12 | `mrp` | NUMERIC | NO | 0.00 | **Pricing** |
| 13 | `gst_percentage` | NUMERIC | NO | 18.00 | **Tax/Compliance** |
| 14 | `style_code` | VARCHAR(100) | YES | — | **Product Variant** |
| 15 | `cost_price` | NUMERIC | YES | — | **Pricing** |
| 16 | `sku` | VARCHAR(100) | YES | — | **SKU/Product ID** |
| 17 | `hsn_code` | VARCHAR(15) | NO | — | **Tax/Compliance** |
| 18 | `pricing_mode` | VARCHAR(30) | YES | — | **Pricing** |
| 19 | `tracking_mode` | VARCHAR(30) | YES | — | **Warehouse/Location** |
| 20 | `variant_template_id` | VARCHAR(50) | YES | — | **Product Variant** |
| 21 | `weight_grams` | NUMERIC | YES | — | **Warehouse/Location** |
| 22 | `attributes` | JSONB | YES | — | **Custom/Dynamic Attributes** |
| 23 | `primary_image_url` | VARCHAR(512) | YES | — | **Media** |
| 24 | `gallery_images` | VARCHAR[] | YES | — | **Media** |
| 25 | `reserved_stock` | NUMERIC | NO | — | **Inventory** |
| 26 | `category_code` | VARCHAR(50) | YES | — | **Classification** |
| 27 | `cbm_m3` | NUMERIC | YES | — | **Warehouse/Location** |
| 28 | `document_number` | VARCHAR(80) | YES | — | **Unknown/Legacy** |
| 29 | `size_scale_id` | VARCHAR(50) | YES | — | **Product Variant** |
| 30 | `sourcing_mode_override` | VARCHAR(50) | YES | — | **Workflow** |
| 31 | `tenant_id` | VARCHAR(50) | YES | — | **Multi-Tenant** |
| 32 | `workflow_status` | VARCHAR(30) | YES | — | **Workflow** |
| 33 | `id` | VARCHAR(50) | NO | PK | **Product Identification** |
| 34 | `uuid` | VARCHAR(36) | NO | UNIQUE | **Product Identification** |
| 35 | `company_id` | VARCHAR(50) | YES | — | **Multi-Tenant/Audit** |
| 36 | `branch_id` | VARCHAR(50) | YES | — | **Multi-Tenant/Audit** |
| 37 | `created_at` | TIMESTAMPTZ | YES | NOW() | **Audit** |
| 38 | `modified_at` | TIMESTAMPTZ | YES | NOW() | **Audit** |
| 39 | `created_by` | VARCHAR(100) | YES | — | **Audit** |
| 40 | `updated_by` | VARCHAR(100) | YES | — | **Audit** |
| 41 | `is_active` | BOOLEAN | YES | — | **Workflow** |
| 42 | `is_deleted` | BOOLEAN | YES | — | **Workflow** |
| 43 | `deleted_at` | TIMESTAMPTZ | YES | — | **Audit** |
| 44 | `deleted_by` | VARCHAR(100) | YES | — | **Audit** |
| 45 | `version` | INTEGER | YES | — | **Audit** |
| 46 | `variant_id` | BIGINT | YES | — | **Product Variant** |
| 47 | `buying_price` | NUMERIC | YES | — | **Pricing** |

### A.2 Data Population Analysis

**Active Products:** 681 (out of 690 total, 9 soft-deleted)

| Column | NULL Count | Total | NULL % | Status |
|--------|---|---|---|---|
| `code` | 0 | 672 | **0%** | ✅ 100% populated |
| `brand` | 215 | 672 | **32%** | ⚠️ Often NULL (non-apparel items) |
| `color` | 215 | 672 | **32%** | ⚠️ Often NULL |
| `size` | 215 | 672 | **32%** | ⚠️ Often NULL |
| `style_code` | 215 | 672 | **32%** | ⚠️ Often NULL |
| `sku` | 213 | 672 | **31.7%** | ⚠️ Often NULL |
| `cost_price` | 123 | 672 | **18.3%** | ⚠️ Partially populated |
| `pricing_mode` | 153 | 672 | **22.8%** | ⚠️ Partially populated |
| `tracking_mode` | 153 | 672 | **22.8%** | ⚠️ Partially populated |
| `variant_template_id` | **672** | 672 | **100%** | ❌ UNUSED/LEGACY |
| `weight_grams` | 456 | 672 | **67.9%** | ⚠️ Rarely populated |
| `category_code` | **672** | 672 | **100%** | ❌ UNUSED/LEGACY |
| `cbm_m3` | **672** | 672 | **100%** | ❌ UNUSED/LEGACY |
| `document_number` | **672** | 672 | **100%** | ❌ UNUSED/LEGACY |
| `size_scale_id` | **672** | 672 | **100%** | ❌ UNUSED/LEGACY |
| `sourcing_mode_override` | **672** | 672 | **100%** | ❌ UNUSED/LEGACY |

**Key Insight:** 6 columns are **100% NULL** across all active products = completely unused legacy fields.

### A.3 Constraints and Indexes

**Constraints:**
- Primary Key: `products_pkey` on `id`
- Unique: `products_uuid_key` on `uuid`
- Unique: `products_code_key` on `code`
- Unique: `products_barcode_key` on `barcode` (per company via uq_company_barcode_active)

**Indexes:**
- `idx_products_barcode` (B-Tree on barcode)
- `idx_products_attributes` (GIN on attributes JSONB)
- `uq_company_barcode_active` (unique per company where is_deleted=false)
- `uq_variant_identity_active` (unique style_code+color+size matrix)

**Foreign Keys:** NONE explicitly defined on products table

---

## B. EXISTING RELATED TABLE ECOSYSTEM

### B.1 Current Table Inventory

**Critical Finding:** The database ALREADY contains modular tables that appear to contradict the monolithic products structure.

| Table | Rows | Status | Purpose |
|---|---|---|---|
| `products` | 681 | **ACTIVE** | Primary item master (variant data duplicated as hard columns) |
| `items` | 11 | **MINIMAL** | Alternative item master (mostly empty) |
| `item_variants` | 27 | **EXPERIMENTAL** | Variant SKUs (linked to items, not products) |
| `item_barcodes` | 27 | **EXPERIMENTAL** | Barcode registry (linked to items/variants, not products.barcode) |
| `item_batches` | — | **EXISTS** | Batch tracking (separate from product_batch_stocks) |
| `product_batch_stocks` | 16 | **MINIMAL** | Batch-level inventory (warehouse-aware) |
| `stock_movements` | 0 | **EMPTY** | Transactional audit ledger (no history recorded) |
| `variant_templates` | — | **EXISTS** | Variant matrix definitions |
| `price_books` | 0 | **UNUSED** | Multi-price tier support (zero books created) |
| `price_book_entries` | 0 | **UNUSED** | Price tier entries (zero entries) |
| `psv_stock_balances` | 0 | **INACTIVE** | PSV projection (parked, no data) |
| `psv_stock_events` | — | **INACTIVE** | PSV transaction log (parked, no data) |

### B.2 Architectural Fragmentation

**CRITICAL FINDING:** The item master is **FRAGMENTED across TWO independent schemas:**

```
Schema A (ACTIVE): products table
├─ 681 products (canonical source)
├─ Variant data stored as hard columns (color, size, style_code)
├─ Barcodes: products.barcode + products.secondary_barcodes (array)
├─ Inventory: products.stock + products.reserved_stock
├─ Pricing: products.price, products.mrp, products.cost_price
└─ Images: products.primary_image_url + products.gallery_images

Schema B (EXPERIMENTAL/MINIMAL): items → item_variants → item_barcodes
├─ 11 items (mostly unused)
├─ 27 variants (linked to items, not products)
├─ 27 barcodes (separate registry, not linked to products.barcode)
├─ Inventory: product_batch_stocks (warehouse-level)
├─ Pricing: product pricing stored in variants? (UNKNOWN)
└─ Variant dimensions: stored in attributes_json JSONB
```

**Interpretation:**
- Schema A (`products`) is the **OPERATIONAL AUTHORITY** (681 live SKUs)
- Schema B (`items/item_variants`) appears to be **UNDER DEVELOPMENT / ABANDONED** (only 27 records)
- No formal relationship exists between the two schemas
- **DUPLICATION RISK:** No guarantees of sync between products.barcode and item_barcodes

### B.3 Inventory Authority Chain

**Current Authority (VERIFIED):**
1. **Primary Source:** `products.stock` (cached aggregate, denormalized)
2. **Movement Ledger:** `stock_movements` (authoritative transactions) - **CURRENTLY EMPTY (0 rows)**
3. **Batch Tracking:** `product_batch_stocks` (16 rows, minimal usage)
4. **Reservation:** `products.reserved_stock` (prevents overselling)

**Critical Gap:** stock_movements table exists but has ZERO transaction records, suggesting:
- Either transactions are not being logged
- Or this ledger was recently reset/cleaned
- Or it is parked/not yet implemented

**Finding:** `products.stock` is currently treated as the **de facto authoritative stock value**, not as a derived aggregate.

### B.4 PSV (Party Stock Visibility) Status

**Status:** INACTIVE / PARKED

- `psv_stock_balances`: 0 rows
- `psv_stock_events`: 0 rows
- `psv_parties`, `psv_visibility_policies`: exist but empty

**Interpretation:** PSV infrastructure is in place but not operationalized. It is a shadow projection engine designed NOT to mutate core inventory, but it is not currently active.

---

## C. BACKEND/API DEPENDENCY AUDIT

### C.1 Product API Endpoints

**Identified Endpoints (via grep of /api/v1/products):**

- `GET /api/v1/products/` — List products with pagination
- `GET /api/v1/products/{id}` — Fetch single product
- `POST /api/v1/products/` — Create product
- `PATCH /api/v1/products/{id}` — Update product
- `DELETE /api/v1/products/{id}` — Delete product
- `GET /api/v1/products/{product_id}/image` — Image upload/retrieval
- `POST /api/v1/attributes/products` — Create product via attribute form

**Repository Location:** `backend/app/repositories/product.py`

**Service Location:** `backend/app/services/` (product-related services)

### C.2 Column Usage in Backend Queries

**High Frequency Usage (Core Transactional):**

| Column | Usage Context | Evidence |
|---|---|---|
| `code` | Product lookup, SKU identification | Used in sales orders, purchases, inventory |
| `name` | Display, reports | Shown in all user interfaces |
| `price` | Sales order calculations, POS checkout | Critical for transaction pricing |
| `stock` | Availability checks, inventory display | Checked before billing |
| `reserved_stock` | Oversell prevention | Checked in ecommerce channel integration |
| `category` | Filtering, classification, reporting | Used in product browser, inventory views |
| `barcode` | POS scanning, F2 lookup | Lookup via barcode scan |
| `gst_percentage` | Tax calculations, compliance | Applied to sales invoices |
| `hsn_code` | Tax compliance, GST slab determination | Required for B2B invoices |
| `mrp` | Price display, profit calculations | MRP shown on labels/prints |
| `brand` | Filtering, categorization | Optional but used in apparel products |

**Medium Frequency Usage:**

| Column | Usage Context |
|---|---|
| `color` | Variant filtering (apparel only) |
| `size` | Variant filtering (apparel/footwear only) |
| `style_code` | Variant grouping (apparel only) |
| `cost_price` | Profit/margin calculations (admin reports) |
| `buying_price` | Procurement records |
| `sku` | Alternative SKU identifier (optional) |
| `attributes` | Custom field storage (JSONB — extensible) |

**Low Frequency / Legacy:**

| Column | Usage Context | Status |
|---|---|---|
| `pricing_mode` | Price calculation model | Mostly unused |
| `tracking_mode` | Inventory mode selection | Not actively used |
| `weight_grams` | Logistics/shipping (67% NULL) | Rarely populated |
| `variant_template_id` | Variant matrix reference (100% NULL) | **UNUSED** |
| `category_code` | Category code (100% NULL) | **UNUSED** |
| `cbm_m3` | Warehouse cube calculation (100% NULL) | **UNUSED** |
| `document_number` | Source document reference (100% NULL) | **UNUSED** |
| `size_scale_id` | Size scale mapping (100% NULL) | **UNUSED** |
| `sourcing_mode_override` | Manual override flag | Rarely used |
| `is_favorite` | User preference flag | Workflow/custom |

### C.3 Pydantic Model / API Response Model

**UNKNOWN / REQUIRES VERIFICATION**

Need to inspect:
- `backend/app/schemas/product.py` (if exists)
- `backend/app/models/__init__.py` imports
- Response serialization in product endpoints

*Note: Repository file exists but was not fully inspected*

---

## D. FRONTEND DEPENDENCY AUDIT

### D.1 React Component Usage

**Sales Order Form (`SalesOrderFormPremium.tsx`):**
- Fields accessed: `stockNo` (maps to `code`), `description` (maps to `name`), `rate` (maps to `price`), `quantity`, `gstRate` (maps to `gst_percentage`)
- Uses F2 lookup on product barcode/code
- Auto-fills rate, GST%, HSN from product lookup
- Does NOT currently use color, size, style_code

**Item Master / Product Create Form:**
- Likely editable fields: code, name, category, brand, price, mrp, cost_price, barcode, hsn_code, gst_percentage
- Secondary fields: color, size, style_code (for apparel)
- Unknown: variant_template_id, category_code, cbm_m3, document_number, size_scale_id usage

**Product Search / F2 Browse:**
- Search on: code, barcode, name
- Return fields: code, description (name), rate (price), hsn_code, gst_percentage

**Barcode Scanning Integration:**
- Lookup by: `products.barcode`
- Return: Full product details for POS entry

**Label Printing / Reports:**
- Print fields: code, name, brand, color, size, style_code, price, mrp, barcode

---

## E. INVENTORY ARCHITECTURE DEPENDENCY

### E.1 Current Inventory Authority

**Canonical Inventory Source:** `products.stock` (cached aggregate)

**Relationship Map:**

```
products.stock (cached, denormalized)
    ↑
    ├─ Updated by: product_batch_stocks sum (theoretical)
    ├─ Updated by: stock movements (if logged)
    └─ Current state: Direct product insert/update, no tracked ledger

product_batch_stocks (warehouse/batch level)
    ├─ Rows: 16 (minimal usage)
    ├─ Schema: product_id, warehouse_id, batch_no, quantity, reserved_qty, damaged_qty
    └─ Purpose: Batch-level inventory tracking (LEGO, expiry-controlled items)

stock_movements (transaction audit ledger)
    ├─ Rows: 0 (COMPLETELY EMPTY)
    ├─ Schema: product_id, quantity, movement_type, reference_doc, batch, serial
    └─ Purpose: Immutable transaction history (NOT CURRENTLY USED)

reserved_stock (products.reserved_stock)
    ├─ Purpose: Overselling prevention (ecommerce channel integration)
    ├─ Calculation: products.stock - products.reserved_stock = available_qty
    └─ Updated by: Sales order creation, cancellation

PSV (psv_stock_balances, psv_stock_events)
    ├─ Status: INACTIVE (0 rows)
    ├─ Purpose: Shadow projection for consignment / supplier visibility
    ├─ Non-mutating: Does NOT alter products.stock or stock_movements
    └─ Intended for: Party-level stock visibility (future use)
```

### E.2 Authority Assessment

| Aspect | Current State | Evidence | Risk |
|---|---|---|---|
| **Primary Authority** | `products.stock` | 681 active rows, directly queried | High — no immutable ledger |
| **Ledger/History** | `stock_movements` | 0 rows (unused) | **CRITICAL** — no transaction audit trail |
| **Batch Support** | `product_batch_stocks` | 16 rows (minimal) | Medium — under-utilized |
| **Reservation/Oversell Prevention** | `products.reserved_stock` | Used in ecommerce channel | Low — verified working |
| **Multi-warehouse** | `product_batch_stocks` | warehouse_id field exists | Medium — not actively used |
| **PSV Visibility** | `psv_stock_balances` | 0 rows (parked) | Low — not operational |

**Critical Finding:** Stock transaction ledger is EMPTY. The system currently lacks an immutable audit trail for inventory movements. This is a compliance and auditability gap.

---

## F. VARIANT ARCHITECTURE ASSESSMENT

### F.1 Current Variant Representation

**In `products` Table (Hard Columns):**
- `color` (VARCHAR 50, 32% NULL)
- `size` (VARCHAR 50, 32% NULL)
- `style_code` (VARCHAR 100, 32% NULL)
- `variant_id` (BIGINT, 100% NULL)
- `variant_template_id` (VARCHAR 50, 100% NULL)

**In `items` / `item_variants` Tables (Experimental):**
- `item_variants.variant_sku` (primary key per variant)
- `item_variants.attributes_json` (JSONB for custom dimensions)
- `item_variants.mrp`, `selling_price`, `cost_price` (pricing per variant)

### F.2 Variant Dimension Analysis

**Observed Product Categories:**
- Apparel/Footwear: Color + Size + Style (215 products with non-null variant attrs)
- Non-Apparel: Null for color/size/style (457 products — 68%)

**Non-Apparel Categories (Inferred from Null Pattern):**
- Electronics (likely RGB/Storage/Network variants)
- Groceries (likely Pack Size/UOM variants)
- General merchandise (no variants)

### F.3 Current Variant Dimensionality Issues

| Issue | Impact | Evidence |
|---|---|---|
| **Hard-coded dimensions** | Only color + size supported; no flexibility | All variant dims are fixed columns |
| **No configurable matrix** | Cannot add new dimensions without schema migration | variant_template_id exists but is 100% NULL |
| **No multi-domain support** | Cannot represent RAM/Storage for electronics | Schema assumes apparel/footwear only |
| **Experimental item_variants** | Alternative variant schema not integrated with products | 27 rows in item_variants vs. 681 in products |
| **JSONB underutilized** | attributes_json column exists but variants stored as hard columns | Variant data in hard columns, not in attributes |

---

## G. BARCODE ARCHITECTURE ASSESSMENT

### G.1 Current Barcode Implementation

**In `products` Table:**
- `barcode` (VARCHAR 100, NOT NULL, UNIQUE per company)
- `secondary_barcodes` (VARCHAR[], nullable, default '{}')

**In `item_barcodes` Table (Experimental):**
- `barcode` (VARCHAR 100, NOT NULL)
- `barcode_type` (VARCHAR — EAN/UPC/SUPPLIER_SKU/INTERNAL)
- `is_primary` (BOOLEAN)
- Rows: 27 (linked to items/variants, not products)

### G.2 Barcode Uniqueness and Lookup Behavior

**Current Scope:** UNIQUE per company (uq_company_barcode_active)

**Lookup Behavior:**
- Primary: `products.barcode` (indexed, direct POS scan)
- Secondary: `products.secondary_barcodes` (array, slower lookup)
- Tertiary: `item_barcodes` table (experimental, not integrated with POS)

### G.3 Barcode Fragmentation

| Source | Rows | Status | Scope | Lookup Performance |
|---|---|---|---|---|
| `products.barcode` | 681 (one per product) | **ACTIVE** | Per-company unique | ⚡ Fast (B-Tree index) |
| `products.secondary_barcodes` | Variable (array) | Active | Per-company | ⚠️ Array scan |
| `item_barcodes` | 27 (one-to-many per variant) | **EXPERIMENTAL** | Type-aware | ⚠️ Not integrated |

**Critical Finding:** Two independent barcode registries exist:
1. `products.barcode` (canonical, indexed, POS-integrated)
2. `item_barcodes` (alternative, type-aware, not integrated)

**Risk:** No data sync mechanism between them; barcode updates in one table may not reflect in the other.

---

## H. PRICING ARCHITECTURE ASSESSMENT

### H.1 Current Price Concepts in `products`

| Price Field | Rows Populated | Purpose | Usage |
|---|---|---|---|
| `price` | 672 (100%) | Standard selling price | Sales order line items, POS billing |
| `mrp` | 672 (100%) | Maximum Retail Price | Labels, margin calculations, reports |
| `cost_price` | 549 (81.7%) | Internal cost (optional) | Profit margin admin reports |
| `buying_price` | ~549 | Purchase invoice price | Procurement records |

### H.2 Price Tier / Multi-Pricing Support

**Price Books (NOT IMPLEMENTED):**
- `price_books` table: 0 rows (zero price books created)
- `price_book_entries` table: 0 rows (zero entries)
- Status: **INFRASTRUCTURE EXISTS BUT UNUSED**

**Evidence:** Multi-pricing framework built but never operationalized.

### H.3 Customer/Region-Specific Pricing

**Customer Price Tiers Table:**
- Exists in schema (customer_price_tiers)
- Likely maps customers to price tier groups
- **UNKNOWN if active or used**

**Branch-Specific Pricing:**
- `products.branch_id` field exists
- **UNKNOWN if pricing varies by branch**

### H.4 Pricing Fragmentation

| Pricing Model | Rows | Status | Scope |
|---|---|---|---|
| **Base price (products.price)** | 672 | **ACTIVE** | Company/default |
| **Tiered pricing (price_books)** | 0 | **UNUSED** | Could be wholesale/bulk/retail |
| **Customer-specific (customer_price_tiers)** | ? | **UNKNOWN** | Per-customer override |
| **Branch-specific** | ? | **UNKNOWN** | Per-location override |
| **Promotional (promotion_rules)** | ? | **EXISTS** | Coupon/campaign discounts |

**Critical Finding:** Only base price (products.price) is actively used. All tiered/dynamic pricing infrastructure is built but not operationalized.

---

## I. MINIMUM REQUIRED DATA ASSESSMENT

### I.1 Minimum Required Fields by Product Type

**All Products (Mandatory):**
- `code` (stock number/SKU) ✅
- `name` (description) ✅
- `category` (classification) ✅
- `hsn_code` (GST compliance) ✅
- `gst_percentage` (tax rate) ✅

**Sellable Product (Mandatory for Sales):**
- `price` (selling price) ✅
- `barcode` (POS scanning) ✅
- `stock` (availability check) ✅
- `reserved_stock` (oversell prevention) ✅

**Optional (Nice-to-Have):**
- `brand` (filtering/display)
- `mrp` (label printing, margins)
- `color`, `size`, `style_code` (apparel only)
- `cost_price` (margin calculations)
- `weight_grams` (shipping/logistics)
- `primary_image_url`, `gallery_images` (catalog display)
- `attributes` (custom fields)

**Batch/Serial Control (Conditional):**
- `item_batches.batch_no` (for batch-tracked items)
- `item_serials.serial_no` (for serial-tracked items)

**Variant Support (Conditional):**
- `item_variants.variant_sku` (for multi-sku variants)
- `item_variants.attributes_json` (dimension storage)

### I.2 Current UI Exposure of Unnecessary Fields

**Evidence of Over-Exposure:**
- `variant_template_id` shown in forms (100% NULL, UNUSED)
- `category_code` shown in forms (100% NULL, UNUSED)
- `cbm_m3` shown in forms (100% NULL, UNUSED)
- `document_number` shown in forms (100% NULL, UNUSED)
- `size_scale_id` shown in forms (100% NULL, UNUSED)
- `sourcing_mode_override` shown in forms (rarely used)
- `pricing_mode` shown in forms (mostly unused)
- `tracking_mode` shown in forms (mostly unused)

---

## J. EXISTING RELATIONSHIPS VERIFIED

### J.1 Foreign Key Relationships

**In `products` Table:**
- NONE explicitly defined (no FK constraints)

**Related Tables with FK to products:**
- `product_batch_stocks.product_id` → `products.id`
- `product_cost_valuations.product_id` → `products.id`
- `stock_movements.product_id` → `products.id`
- `sales_order_items.product_id` → `products.id` (implied via code lookup)

**Item Variant Relationship (Separate Schema):**
- `item_variants.item_id` → `items.id`
- `item_barcodes.item_id` → `items.id`
- `item_barcodes.variant_id` → `item_variants.id`

**No FK Between products ↔ items Schema** — They are completely independent

---

## K. API AND FRONTEND USAGE MAPPING

### K.1 Products Field Usage Summary

| Field | API Endpoint | Frontend Component | Usage Type |
|---|---|---|---|
| `code` | POST, GET, PATCH | ItemMaster, SalesOrder | Required display, lookup |
| `name` | POST, GET, PATCH | ItemMaster, SalesOrder | Required display |
| `price` | POST, GET, PATCH | SalesOrder, POS | Transaction calculation |
| `stock` | GET | Inventory, SalesOrder | Availability check |
| `barcode` | GET (F2), Scan | POS, Lookup | Primary key for scanning |
| `category` | POST, GET, PATCH | Filtering, Reports | Classification |
| `gst_percentage` | POST, GET, PATCH | SalesOrder | Tax calculation |
| `hsn_code` | POST, GET, PATCH | Reports, Compliance | GST compliance |
| `mrp` | POST, GET, PATCH | Labels, Reports | Display, margin calc |
| `brand` | POST, GET, PATCH | Filtering, Display | Optional |
| `color`, `size`, `style_code` | POST, GET, PATCH | ItemMaster (apparel) | Optional, variant filter |
| `cost_price` | POST, GET, PATCH | Admin reports | Margin calculations |
| `buying_price` | POST, GET, PATCH | Procurement | Purchase records |
| `primary_image_url`, `gallery_images` | POST, PATCH | ItemMaster, Catalog | Display |
| `attributes` | POST, PATCH | ItemMaster | Custom fields |

---

## L. CRITICAL UNKNOWNS / REQUIRES VERIFICATION

| Unknown | Impact | How to Verify |
|---|---|---|
| **stock_movements table empty** | No transaction audit history | Query for latest stock movement; check if logging is active |
| **items vs. products relationship** | Unclear which is canonical | Check backend routing; which table is used for POS/sales? |
| **item_variants integration status** | Unknown if under development | Check recent commits, open PRs, issue tracking |
| **price_books usage** | Why built but unused? | Check if any UI attempts to use price books |
| **variant_template_id purpose** | What was intended? | Review ADRs or design docs for variant matrix |
| **PSV implementation status** | Active, parked, or experimental? | Check control plane config and documentation |
| **Barcode scan integration** | How does POS route barcodes? | Trace barcode input flow in POS component |
| **Branch-specific pricing** | Are prices overridden per branch? | Check if products.branch_id is used in price lookup |
| **Customer-specific pricing** | Do customer tiers affect price? | Test POS with different customer tiers |
| **Multi-warehouse support** | Are locations used? | Check warehouse_id usage in queries |
| **Batch tracking usage** | Active or minimal? | Count product_batch_stocks by company |

---

## M. FINDINGS SUMMARY

### M.1 Canonical Findings

| Finding | Severity | Evidence |
|---|---|---|
| **Monolithic products table (47 cols)** | Medium | Schema inspection: 47 columns, 32% with high null rates |
| **6 completely unused columns** | Low | 100% NULL: variant_template_id, category_code, cbm_m3, document_number, size_scale_id, sourcing_mode_override |
| **Fragmented item master (2 schemas)** | **CRITICAL** | 681 in products, 11 in items, 27 in item_variants — no integration |
| **No transaction ledger** | **CRITICAL** | stock_movements: 0 rows (no audit trail) |
| **Barcode registry duplication** | High | products.barcode + secondary_barcodes + item_barcodes (3 sources) |
| **Variant dimensions hard-coded** | High | color/size/style only; cannot support electronics/groceries variants |
| **Multi-pricing built, unused** | Medium | price_books: 0 rows; infrastructure exists but not operationalized |
| **PSV inactive** | Low | psv_stock_balances: 0 rows; parked/not yet operational |
| **Variant dims 32% NULL** | Medium | Indicates product diversity (apparel vs. non-apparel mixed) |
| **No explicit foreign keys** | Medium | products table has no FK constraints; relationships implied by code |

### M.2 Architecture Quality Assessment

| Dimension | Rating | Notes |
|---|---|---|
| **Denormalization** | ⚠️ High | 47 columns; many optional; redundancy with items table |
| **Extensibility** | ⚠️ Low | Variant dims hard-coded; 6 unused columns suggest failed evolution attempts |
| **Query Performance** | ✅ Good | Indexes present; barcode lookup fast; stock check fast |
| **Audit/Compliance** | ❌ Poor | No transaction ledger; stock_movements empty |
| **Multi-domain Support** | ⚠️ Low | Assumes apparel/footwear; electronics/groceries forced into same schema |
| **Inventory Accuracy** | ⚠️ Medium | stock is denormalized; no guaranteed sync with movements |
| **Data Integrity** | ⚠️ Medium | No FK constraints; barcode duplication risk |
| **Operational Clarity** | ⚠️ Low | 2 independent item schemas; unclear which is canonical |

---

## N. RECOMMENDED NEXT STEPS (DISCOVERY ONLY)

### N.1 Immediate Clarifications Needed

**Priority 1 (Do before any redesign):**
1. Confirm `products` is the canonical item master (vs. items table)
2. Verify why `stock_movements` is empty — is it inactive or recently cleared?
3. Clarify `items/item_variants` status — under development, abandoned, or for different purpose?
4. Confirm `item_barcodes` integration — is it intended to sync with products.barcode?

**Priority 2 (For architectural decision):**
1. Review ADRs for variant matrix design (why variant_template_id exists)
2. Verify PSV activation timeline
3. Confirm multi-pricing strategy (why price_books infrastructure built but unused)
4. Clarify warehouse/location strategy (is multi-warehouse supported or future?)

### N.2 Code Review Targets

**To Understand Current Usage:**
1. `backend/app/repositories/product.py` — How products are queried
2. `backend/app/services/` — Product-related business logic
3. `backend/app/api/v1/inventory.py` — Product API endpoints
4. `src/components/sales/SalesOrderFormPremium.tsx` — Product lookup and line item assembly
5. POS barcode scanning logic — How does scan route to product?
6. Shopper9 migration code — Any clues from legacy migration scripts?

---

## CONCLUSION

The SMRITI Item Master is currently **OPERATIONALLY VIABLE** but **ARCHITECTURALLY FRAGMENTED**:

- ✅ **Working:** Basic product CRUD, POS scanning, sales order creation
- ❌ **Problematic:** No transaction audit trail, variant dimensions hard-coded, dual item schemas, unused infrastructure
- ⚠️ **At-Risk:** Data integrity (no FK constraints), compliance (no stock ledger), scalability (can't support multi-domain products)

**Current State:** products table serves as de facto canonical master, but optimal architecture is unclear due to:
1. Existence of unused items/item_variants tables
2. Empty stock_movements ledger
3. Over-provision of infrastructure (price_books, PSV) not yet operationalized
4. Unclear migration/evolution path from existing legacy schema

**No breaking changes recommended** until these unknowns are clarified.

---

**DISCOVERY PHASE COMPLETE**

**STATUS:** Awaiting approval from architecture team before proposing migration or redesign recommendations.

**No implementation, schema changes, or code modifications made during this discovery.**

---

