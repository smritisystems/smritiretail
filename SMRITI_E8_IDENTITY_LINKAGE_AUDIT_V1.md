# SMRITI ITEM MASTER E8 IDENTITY LINKAGE AUDIT V1
## Critical Identity-Linkage Review & Architectural Assessment Report

> **Final Decision:** E8 = BLOCKED — NO SAFE PERSISTENT MASTER-VALUE IDENTITY LINKAGE
> **Governance Baseline:** DATABASE: FROZEN (269 physical tables) | PRODUCT SCHEMA: FROZEN | SKU: FROZEN | BARCODE: FROZEN | ATTRIBUTE AUTHORITY: FROZEN

---

## Executive Identity Linkage Findings (Empirical Database Audit)

| Audit Item / Question | Live PostgreSQL Finding | Identity Status |
|---|---|---|
| **A. `Product.master_value_id`** | **Column Does NOT Exist** | 🔴 NO FK Linkage |
| **B. `Product.color_master_value_id`** | **Column Does NOT Exist** | 🔴 NO FK Linkage |
| **C. `Product.size_master_value_id`** | **Column Does NOT Exist** | 🔴 NO FK Linkage |
| **D. `Product.brand_master_value_id`** | **Column Does NOT Exist** | 🔴 NO FK Linkage |
| **E. `Product.category_master_value_id`** | **Column Does NOT Exist** | 🔴 NO FK Linkage |
| **F. `Product.attributes` JSONB** | Stores literal text snapshots (e.g. `{"color": "Black", "size": "XL"}`) | 🔴 Text Snapshot Only |
| **G. Variant Master Identity** | Variants are `Product` rows with `style_code`, storing text snapshots | 🔴 Text Snapshot Only |
| **H. Physical Foreign Keys to `master_values`** | **0 Foreign Keys** exist from `products` to `master_values` or `master_types` | 🔴 NO Database Constraint |

---

## Detailed Schema & Relationship Audit

### 1. `products` Physical Schema (PostgreSQL `smriti_retail_db`)
- **Physical Columns:** `id`, `code`, `name`, `price`, `stock`, `category`, `barcode`, `brand`, `color`, `size`, `mrp`, `gst_percentage`, `style_code`, `cost_price`, `sku`, `hsn_code`, `pricing_mode`, `tracking_mode`, `variant_template_id`, `size_scale_id`, `attributes` (JSONB), `tenant_id`, `category_code`.
- **Foreign Keys:**
  - `fk_products_company_id`: `company_id` -> `companies.id`
  - `fk_products_branch_id`: `branch_id` -> `branches.id`
  - `fk_products_variant_template_id`: `variant_template_id` -> `variant_templates.id`
  - `fk_products_size_scale_id`: `size_scale_id` -> `size_scales.id`
  - **Zero foreign keys to `master_values` or `master_types`.**

### 2. Characterization of Product Attribute Fields
- `Product.color`, `Product.size`, `Product.brand`, `Product.category`, and `Product.attributes` JSONB behave strictly as **denormalized text snapshots** captured at item creation time.
- `Product.attributes` does NOT store structured identity objects containing `master_value_id` or `master_value_code`.

---

## Reason For Blockade

In strict compliance with **HARD GOVERNANCE RULES 2, 3, & 4**:
1. **Absolute Prohibition on Heuristic Cascade:** Executing SQL queries matching on text strings (`WHERE product.color = old_name` or `WHERE attributes->>'color' = old_name`) is **STRICTLY PROHIBITED**. Name-based text matching creates silent catalog corruption by accidentally updating historical snapshots, free-text attributes, or unrelated merchant records.
2. **No Persistent Identity Linkage:** Neither `master_value_id` (UUID) nor immutable `master_value_code` is stored as an authoritative column or JSONB property on `Product` rows.
3. **Database Schema Freeze:** Introducing persistent `master_value_id` columns or structural JSONB schema migrations to `products` requires physical database schema changes and migrations, which are **STRICTLY FROZEN** until Runtime Certification is completed.

---

## Architectural Options For Post-Freeze Evolution

### Option A — Governed Projection Migration (Deferred)
- Retain literal text snapshots in `Product` rows as immutable point-in-time document history.
- Expose MasterValue display changes dynamically via Lookup API views without mutating historical transaction or item records.

### Option B — Persistent Master Value Linkage (Requires Database Unfreeze)
- Introduce typed persistent references on `Product`:
  - `color_master_value_id` -> `ForeignKey('master_values.id')`
  - `size_master_value_id` -> `ForeignKey('master_values.id')`
  - `brand_master_value_id` -> `ForeignKey('master_values.id')`
- Enables 100% safe, transactional cascade without text matching heuristics.
- Deferred to Future Architecture Backlog (v2.x+) due to Architecture Freeze Rule (AFR-002).

---

## Event & Transaction Boundary Audit

- **Event Signals:** `LookupService._emit_lookup_event` emits `lookup.updated` containing `{id, code, name}`.
- **Transaction Scope:** `LookupService.update_value()` executes in a single SQLAlchemy `AsyncSession`. Without direct FKs or persistent linkage, any attempt to run out-of-band updates across `products` creates uncoordinated transaction boundaries.
- **SKU & Barcode Safety:** Confirmed 100% safe. `Product.sku` (`CH-01-A-RED-38`) and `Product.barcode` (`200000000001`) remain completely immutable.

---

## Final Status Declaration

```text
FINAL DECISION:
E8 = BLOCKED — NO SAFE PERSISTENT MASTER-VALUE IDENTITY LINKAGE

E8 IDENTITY LINKAGE:
NOT VERIFIED / BLOCKED

DATABASE:
FROZEN (269 physical tables)

PRODUCT SCHEMA:
FROZEN

SKU ALGORITHM:
FROZEN

BARCODE ALGORITHM:
FROZEN

ATTRIBUTE AUTHORITY:
FROZEN
```