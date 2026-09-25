<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.38.0
  Created      : 2026-09-25
  Modified     : 2026-09-25
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Architecture & Schema Governance (Internal Core)
-->

# SMRITI Retail OS — Product Identity & Identifier Architecture Refactor Plan
**Document ID:** PLAN-PROD-ID-20260925-01  
**Status:** In Progress (Phase B Design Complete — Phased Implementation Plan)  
**Corpus / Database:** `smritisys` (Control Plane) | `smriti001` (Tenant Plane)  
**Author:** Jawahar Ramkripal Mallah (Chief Systems Architect & Creator)  

---

## 1. Executive Summary & Design Tenets

This Refactor Plan defines the controlled, zero-downtime evolution of the SMRITI Retail OS Product Identity Architecture based on the empirical evidence gathered during Phase A (`AUDIT-PROD-ID-20260925-01`).

### Core Tenets:
1. **Never Replace Canonical Identity Globally**: `products.id`, `items.id`, and `item_variants.id` remain the internal primary keys.
2. **Re-use Existing Normalized Tables**: SMRITI already has `item_barcodes` (1,124 rows) and `customer_article_mappings` (451 rows). No duplicate barcode or SKU tables will be introduced.
3. **Decouple Partner Identifiers in PSV**: PSV partner feeds ingest third-party SKUs (`SKU-A-0047E4`) that do not equal internal catalog SKUs. PSV must ingest external SKUs into `psv_stock_balances` and resolve them to internal `product_id` via a dedicated **Partner Identifier Resolver**.
4. **Enforce Tenant Authoritative Keys**: The tenant boundary is strictly `company_id -> companies.id`. In `psv_stock_balances` and `psv_stock_events`, uniqueness must transition from `company_code` to `company_id`.
5. **Zero-Downtime Expand/Contract**: All database changes follow additive expansion, verified backfill, dual read/write, read switch, and eventual contract.

---

## 2. Target Architecture Specification

```text
                               ┌────────────────────────────────────────────────────────┐
                               │                    COMPANY / TENANT                    │
                               │                      companies.id                      │
                               └───────────────────────────┬────────────────────────────┘
                                                           │
                                                           ▼
                               ┌────────────────────────────────────────────────────────┐
                               │                  PARENT PRODUCT MASTER                 │
                               │                        items.id                        │
                               │  - item_code (Sovereign Style Key)                     │
                               │  - brand, category, department, hsn_code               │
                               └───────────────────────────┬────────────────────────────┘
                                                           │
                                                           ▼
                               ┌────────────────────────────────────────────────────────┐
                               │                 SELLABLE VARIANT MASTER                │
                               │                    item_variants.id                    │
                               │  - variant_sku (Physical SKU: Size x Color)            │
                               │  - attributes_json ({"size": "38", "color": "Navy"})   │
                               └─────────────┬───────────────────────────┬──────────────┘
                                             │                           │
                   ┌─────────────────────────┴──────────┐   ┌────────────┴──────────────────────┐
                   │                                    │   │                                   │
                   ▼                                    ▼   ▼                                   ▼
┌──────────────────────────────────────┐   ┌──────────────────────────────────┐   ┌───────────────────────────┐
│        INTERNAL OPTICAL CODES        │   │       B2B BUYER ARTICLE CODES    │   │  LEGACY DUAL-WRITE BRIDGE │
│            item_barcodes             │   │     customer_article_mappings    │   │         products          │
│ - barcode (EAN-13, GS1-128, UPC, QR) │   │ - customer_article (Buyer Code)  │   │ - products.id (PK)        │
│ - barcode_type (EAN13, CODE128)      │   │ - vendor_article (Factory Style) │   │ - barcode, sku, price     │
│ - barcode_purpose (RETAIL, CASE)     │   │ - barcode (GS1 EAN)              │   │ - item_id, variant_id     │
│ - is_primary (true/false)            │   │ - customer_id, contract_rate     │   │                           │
└──────────────────────────────────────┘   └──────────────────────────────────┘   └───────────────────────────┘
                   ▲                                    ▲                                   ▲
                   │                                    │                                   │
                   └────────────────────────────────────┴───────────────────────────────────┘
                                                        │
                                                        ▼
                                       ┌──────────────────────────────────┐
                                       │   UNIVERSAL IDENTIFIER RESOLVER  │
                                       │     (Multi-Tier Scanner/API)     │
                                       └────────────────┬─────────────────┘
                                                        │
                      ┌─────────────────────────────────┴─────────────────────────────────┐
                      │                                                                   │
                      ▼                                                                   ▼
       ┌───────────────────────────────┐                                   ┌───────────────────────────────┐
       │     POINT OF SALE (POS)       │                                   │ PARTNER STOCK VISIBILITY (PSV)│
       │ - Optical scan -> Barcode     │                                   │ - Partner SKU / Barcode Feed  │
       │ - F2 dialog -> item / variant │                                   │ - Resolve to internal product │
       │ - Resolves to internal SKU    │                                   │ - Uniqueness on (company_id)  │
       └───────────────────────────────┘                                   └───────────────────────────────┘
```

---

## 3. Identifier Ownership & Scope Matrix

| Identifier Type | Target Storage Table | Column Name | Uniqueness Constraint / Scope | Ownership & Business Rules |
|---|---|---|---|---|
| **Canonical Product ID** | `items` / `item_variants` / `products` | `id` | Global Primary Key (`VARCHAR(50)`) | Authoritative immutable system key. Not exposed on retail labels. |
| **Parent Style Code** | `items` | `item_code` | `uq_items_company_item_code` (`company_id`, `item_code`) | Tenant-scoped sovereign style master key. |
| **Physical Variant SKU** | `item_variants` | `variant_sku` | `uq_variants_company_sku` (`company_id`, `variant_sku`) | Tenant-scoped sellable SKU key (Color x Size). |
| **Scanning Barcode** | `item_barcodes` | `barcode` | `uq_barcodes_company_barcode` (`company_id`, `barcode`) | Tenant-scoped optical barcode. Multiple barcodes allowed per variant (e.g. Retail vs Pack). Exactly one `is_primary = true` per variant. |
| **Customer Buyer Article** | `customer_article_mappings` | `customer_article` | `uq_cam_customer_article_active` (`company_id`, `customer_id`, `customer_article`) WHERE active | Customer-scoped buyer code. E.g. Reliance Trends code `450180905001`. |
| **External Partner SKU** | `psv_stock_balances` | `sku` | `uq_psv_stock_balances_company_party_sku` (`company_id`, `psv_party_id`, `sku`) | Partner-scoped stock projection identifier. Decoupled from internal SKU. |
| **eCommerce Channel SKU**| `ecom_sku_mappings` | `channel_sku` | `(company_id, channel_name, channel_sku)` | Channel-scoped marketplace identifier (Amazon, Flipkart). |

---

## 4. PSV Refactor Architecture & Preflight Validation

### 4.1 Ingestion & Projection Refactor
In `backend/app/services/psv_projection.py`:
1. **Explicit `company_id` Passage**:
   Every call to `project_psv_stock_event` must extract `company_id` from the context or parent invoice and write `company_id = company_id` directly to `PSVStockEvent` and `PSVStockBalance`.
2. **Identifier Resolution During Projection**:
   When a partner event is ingested with an external `sku` or `barcode`:
   ```python
   # Asynchronous / Inline Resolution
   resolved = await PartnerIdentifierResolver.resolve(
       session=session,
       company_id=company_id,
       party_id=psv_party_id,
       external_sku=event_sku
   )
   product_id = resolved.product_id if resolved else None
   ```
   If unmapped, `product_id` is stored as `NULL` and the balance record is marked `reconciliation_status = 'PENDING_CATALOG_MAPPING'`, allowing ingestion without data loss while flagging the item in the Partner Catalog Mapping UI.

### 4.2 Uniqueness Migration in PSV
- Existing constraint:
  `uq_psv_stock_balances_party_sku` on `(company_code, psv_party_id, sku)`.
- Target constraint:
  `uq_psv_stock_balances_company_party_sku` on `(company_id, psv_party_id, sku)`.
- Preflight validation rule:
  `SELECT company_id, psv_party_id, sku, COUNT(*) FROM psv_stock_balances GROUP BY 1, 2, 3 HAVING COUNT(*) > 1;` -> Must return 0 violations.

---

## 5. Backward Compatibility & Universal Lookup Strategy

1. **F2 Universal Browse Dialog (`UniversalBrowseEngine.tsx` + `f2LookupRegistry.ts`)**:
   - Contract remains completely unchanged.
   - `variant` routes to `/api/v1/variants`.
   - `item` routes to `/api/v1/items`.
   - `item_barcode` routes to `/api/v1/item-barcodes`.
2. **FastAPI Adapter Update in `backend/app/api/v1/master_lookup.py`**:
   - Update `/api/v1/item-barcodes` to query `item_barcodes` directly (joined with `item_variants` and `items`), with a union fallback to legacy `products` if untracked.
3. **Dual-Write Synchronization**:
   - When a new product or variant is created, the system writes to `items`, `item_variants`, and `item_barcodes`, and mirrors into `products` to ensure 100% backward compatibility with legacy modules.

---

## 6. Detailed Migration Sequence (Expand / Contract)

### Phase C — Expand (Additive Migration)
1. **Alembic Migration `v1494_product_identity_psv_tenant_hardening`**:
   - Add compound unique index on `psv_stock_balances(company_id, psv_party_id, sku)` alongside existing constraint.
   - Add index on `item_barcodes(company_id, barcode_normalized)`.
   - Add helper lookup indexes on `sales_invoice_items(company_id, variant_id)` and `purchase_order_items(company_id, variant_id)`.
2. **Resolver Service Creation**:
   - Implement `PartnerIdentifierResolver` in `backend/app/services/partner_resolver.py`.
   - Integrates with `customer_article_mappings`, `smriti_identity_alias`, and `item_barcodes`.

### Phase D — Backfill
1. Run preflight verification script (`scratch/verify_preflight_identity.py`).
2. Run data backfill for any unresolved legacy products into `items` and `item_variants` using `UniversalItemService.sync_all_legacy_products`.
3. Verify:
   - 0 unmatched tenant companies.
   - 0 ambiguous variant SKUs.
   - 0 cross-company barcode collisions.

### Phase E — Dual Read / Dual Write
1. Update `PSVProjectionService` to write both `company_id` and `company_code`.
2. Update `master_lookup.py` `/item-barcodes` to read from `item_barcodes` with fallback to `products`.

### Phase F — Read Switch
1. Verify POS barcode scanning, F2 lookups, and sales invoice generation against updated endpoints.
2. Verify PSV projection and reporting dashboards.

### Phase G — Contract (Follow-up Release)
1. Drop legacy constraint `uq_psv_stock_balances_party_sku` (based on `company_code`).
2. Make `psv_stock_balances.company_id` `NOT NULL`.
3. Make `psv_stock_events.company_id` `NOT NULL`.

---

## 7. Rollback Strategy

1. **Schema Rollback**:
   Every Alembic migration contains a fully verified `downgrade()` function that drops newly created indexes and restores previous constraint states.
2. **Application Rollback**:
   Resolver services and API adapters are designed with backward-compatible fallbacks. If the canonical lookup encounters an unindexed variant, it transparently falls back to `Product`.
3. **Data Loss Prevention**:
   No columns or tables are dropped during Phases C, D, E, and F. All migrations are purely additive.
