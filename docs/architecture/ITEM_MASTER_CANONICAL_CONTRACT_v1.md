<!--
  Project      : SMRITI Retail OS & Unified Business Suite
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 1.0.0
  Created      : 2026-09-01
  Modified     : 2026-09-01
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Architecture Specification / Canonical Contract
-->

# SMRITI Canonical Item Master Architecture Contract (v1.0)

**Contract Status:** FROZEN & RATIFIED  
**Applies To:** SMRITI Retail, SMRITI Distributor, SMRITI Warehouse, SMRITI Enterprise  
**Governance Scope:** All Agents, All Sessions, All Database Schemas, All API Gateways  

---

## 1. Executive Purpose & Core Thesis

This contract defines the **Single Canonical Item Domain** for the entire SMRITI ecosystem. It replaces the legacy, overloaded 47-column `products` flat table with a domain-driven, normalized architecture where:

* **Item** represents the parent catalog/family identity (e.g. Style `CH-01-A`).
* **Variant** represents the physical operational SKU (e.g. `CH-01-A-PEACH-37`).
* **Barcode** represents the physical scanning identity (EAN-13, UPC, Code128, or internal token).
* **Pricing, Inventory, Attributes, and Media** operate as decoupled, high-cohesion sub-domains with independent lifecycle management.

```text
                                CANONICAL ITEM DOMAIN
                                         │
                        ┌────────────────┴────────────────┐
                        │       Item (Family/Style)       │
                        │        e.g., 'CH-01-A'          │
                        └────────────────┬────────────────┘
                                         │ 1:N
                        ┌────────────────┴────────────────┐
                        │      Variant (Operational SKU)  │
                        │    e.g., 'CH-01-A-PEACH-37'     │
                        └────────────────┬────────────────┘
                                         │
        ┌───────────────┬────────────────┼───────────────┬───────────────┐
        ▼               ▼                ▼               ▼               ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌───────────┐ ┌──────────────┐
│  Barcodes    │ │   Pricing    │ │  Attributes  │ │ Inventory │ │    Media     │
│(EAN/UPC/Code)│ │(Price Books) │ │ (Normalized) │ │ (Ledger)  │ │ (Thumb/Gal)  │
└──────────────┘ └──────────────┘ └──────────────┘ └───────────┘ └──────────────┘
```

---

## 2. Standardized SMRITI Terminology Standard

To eliminate ambiguity across UI, API, database models, and documentation, the word `"Product"` is strictly deprecated as an entity name in favor of precise domain terms:

| Standard Term | Exact Semantic Definition | Database Entity | Example |
| :--- | :--- | :--- | :--- |
| **Item** | The abstract catalog / design / style family identity. | `items` | `CH-01-A` (Basic Chappal) |
| **Variant** | The specific physical, sellable, inventory-bearing unit. | `item_variants` | `CH-01-A-PEACH-37` |
| **SKU** | The alphanumeric code identifying a specific Variant. | `variant_sku` | `CH-01-A-PEACH-37` |
| **Barcode** | Machine-readable optical identifier attached to a Variant. | `item_barcodes` | `8904551000088` |
| **Price Policy** | Contextual selling/cost rules attached to Price Books. | `item_prices` | Base ₹1,899 / Wholesale ₹1,200 |
| **Inventory State** | Real-time physical/reserved balance at warehouse/bin. | `item_inventory` | Main Store: 69 pcs |

---

## 3. The 16 Immutable Canonical Contract Rules

1. **Item = Parent Catalog Identity**: `items` holds high-level design, category, brand, HSN code, and base tax slab.
2. **Variant = Operational SKU**: `item_variants` represents the sellable physical unit with matrix dimensions (color, size, material).
3. **Legacy `products.code` Mapping**: Legacy `products.code` maps strictly to `item_variants.variant_sku` (Variant level).
4. **Legacy `products.style_code` Mapping**: Legacy `products.style_code` (or sanitized product name root if style is absent) maps to `items.item_code` (Item parent level).
5. **Independent Barcode Identity**: Barcodes have their own relational table (`item_barcodes`) supporting multiple barcodes per SKU, primary flags, and verified barcode symbology classification (never assuming universal EAN-13).
6. **Independent Pricing Domain**: Variant pricing is decoupled into `item_prices` / `price_books`. Base selling price, MRP, dealer price, customer tier pricing, and branch pricing operate under policy domains rather than static variant columns.
7. **Independent Inventory Domain**: Inventory balances are decoupled into `item_inventory` / `stock_ledger`. Historical movements are not collapsed into aggregate columns without audit lineage.
8. **Independent Attribute Domain**: Dynamic attributes reside in `attribute_definitions` and `item_attribute_values`. Hardcoding attributes into loose unstructured JSON or ad-hoc table columns is prohibited.
9. **Independent Media Domain**: Images, thumbnails, and technical data sheets reside in `item_media` with explicit order sequence and cover image flags.
10. **Global Registry Authority**: Global Field Registry (`ui_field_registry`) owns all metadata, UI validation rules, and schema definitions across all frontend screens.
11. **Live Transactional Safety**: Legacy `products` remains live and functional until transactional cutover is complete. No disruption to existing POS or sales engines.
12. **Permanent Lineage Tracking**: Every `products.id` receives an immutable entry in `legacy_id_mapping` linking to `item_variants.id` to preserve foreign key integrity for `sales_invoice_items` (6,664 rows) and `sales_order_items` (18,036 rows).
13. **Strict Zero Data Loss**: Silent discarding via `ON CONFLICT DO NOTHING` is prohibited. Unresolved conflicts must be recorded in `migration_conflict_log` with status `REQUIRES_REVIEW`.
14. **Single Source of Truth**: Competing representations (e.g. `variant.attributes_json` vs `item_attribute_values`, or Variant columns vs `item_prices`) are strictly forbidden.
15. **Cross-Product Item Unification**: SMRITI Retail, SMRITI Distributor, SMRITI Warehouse, and SMRITI Enterprise share the **exact same canonical Item Domain**. Product editions only govern UI visibility, workflows, and permissions.
16. **Tenant Uniqueness Boundary**: All uniqueness constraints (SKU, barcode, item code) are scoped by `company_id` (`company_id + variant_sku`, `company_id + barcode`).

---

## 4. Multi-Product Edition Matrix

```text
                     CANONICAL ITEM DOMAIN (One Database Schema)
                                         │
        ┌────────────────────────────────┼────────────────────────────────┐
        │                                │                                │
        ▼                                ▼                                ▼
┌───────────────────────┐  ┌───────────────────────────┐  ┌───────────────────────────┐
│     SMRITI Retail     │  │    SMRITI Distributor     │  │     SMRITI Warehouse      │
│ ───────────────────── │  │ ───────────────────────── │  │ ───────────────────────── │
│ • Quick POS Scanning  │  │ • Tier/Contract Pricing   │  │ • Multi-UOM / Packaging   │
│ • Retail Price & MRP  │  │ • Bulk Pack Aggregation   │  │ • Bin / Rack / Zone Mgmt  │
│ • Matrix (Color/Size) │  │ • Sales Order Allocations │  │ • Lot/Batch Expiry Tracking│
│ • Store On-Hand Stock │  │ • Credit & Tax Compliance │  │ • Putaway & Dispatch      │
└───────────────────────┘  └───────────────────────────┘  └───────────────────────────┘
                                         │
                                         ▼
                           ┌───────────────────────────┐
                           │     SMRITI Enterprise     │
                           │ ───────────────────────── │
                           │ • Inter-Company Transfers │
                           │ • Consolidated Auditing   │
                           │ • Master Data Governance  │
                           └───────────────────────────┘
```

---

## 5. Migration Execution Sequence & Gates

To guarantee zero operational downtime and 100% data integrity, migration proceeds strictly through these gates:

```text
[ Gate 1: Contract Ratification ] (COMPLETED: ITEM_MASTER_CANONICAL_CONTRACT_v1.md)
              │
              ▼
[ Gate 2: Dry-Run Reconciliation ] (Execute dry_run_item_master_migration.py with ROLLBACK)
              │
              ▼
[ Gate 3: Zero-Loss Audit Approval ] (Verify 100% legacy_id_mapping coverage, 0 silent drops)
              │
              ▼
[ Gate 4: Canonical Schema Staging ] (Deploy normalized tables into PostgreSQL)
              │
              ▼
[ Gate 5: Dual-Read Compatibility Layer ] (FastAPI compatibility views serving legacy routes)
              │
              ▼
[ Gate 6: Transaction FK Lineage Linking ] (Link sales_invoice_items to canonical variant_id)
              │
              ▼
[ Gate 7: Final Cutover & Legacy Retirement ] (Switch API routes, deprecate products table)
```
