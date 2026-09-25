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

# SMRITI Retail OS — Product Identity & Identifier Architecture Audit
**Document ID:** AUDIT-PROD-ID-20260925-01  
**Status:** Done (Phase A Audit Complete — Read-Only Forensic Baseline)  
**Corpus / Database:** `smritisys` (Control Plane) | `smriti001` (Tenant Plane)  
**Author:** Jawahar Ramkripal Mallah (Chief Systems Architect & Creator)  

---

## 1. Executive Summary & Core Identity Philosophy

In an enterprise-grade ERP system (such as SAP S/4HANA, Oracle Retail, or SMRITI Retail OS), **internal database identity**, **business SKU identity**, **scanning/barcode identity**, **tenant ownership**, and **external partner identifiers** must never be conflated into a single monolithic string column.

Conflating external scanning barcodes or vendor SKUs with primary keys leads to fragile foreign keys, inability to support multi-pack/secondary barcodes, inability to handle partner cross-references (such as Reliance Trends buyer article codes vs internal factory styles), and corrupted multi-tenant boundaries.

### The Five-Layer Identity Model of SMRITI Retail OS:

```text
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ 1. INTERNAL CANONICAL IDENTITY                                                         │
│    items.id / item_variants.id / products.id                                           │
│    - Immutable, system-generated primary keys (UUIDv7 / synthetic VARCHAR(50))         │
│    - Never exposed to external partners or displayed on shelf labels                   │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ 2. BUSINESS SKU IDENTITY                                                               │
│    items.item_code / item_variants.variant_sku / products.sku                          │
│    - Human-readable sovereign style and variant codes (e.g. 'CH-01-A', 'CH-01-A-38')   │
│    - Scoped strictly to company_id (Tenant isolation)                                  │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ 3. BARCODE / EAN / GTIN SCANNING IDENTITY                                              │
│    item_barcodes.barcode / products.barcode / secondary_barcodes                       │
│    - Optical scan payloads (EAN-13, GS1-128, Code128, QR, UPC)                         │
│    - Normalized, multi-barcode support per variant (Retail, Pack, Outer Case)          │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ 4. TENANT / COMPANY IDENTITY                                                           │
│    company_id -> companies.id                                                          │
│    - Unambiguous authoritative tenant boundary                                         │
│    - Legacy company_code retained only as non-authoritative snapshot                   │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ 5. PARTNER / EXTERNAL IDENTIFIERS                                                      │
│    customer_article_mappings (Buyer Articles) / PSV Partner Feeds                      │
│    - External buyer codes (e.g. '450180905001' for Reliance Trends)                    │
│    - Decoupled from internal catalog via Identifier Resolver Services                  │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Canonical Product Identity Architecture

### 2.1 The Two Parallel Product Models in SMRITI:
The forensic catalog audit of `smriti001` reveals that SMRITI currently operates with **two parallel catalog layers** resulting from an ongoing Strangler-Fig architectural migration:

1. **The Modern Canonical Hierarchy (`items` + `item_variants` + `item_barcodes`)**:
   - `items`: Parent Style / Item Master (524 rows, 44 columns). Represents the style, brand, department, category, and HSN code.
   - `item_variants`: Physical Sellable Variant (1,077 rows, 28 columns). Represents color, size, dimensions, and specific `variant_sku`.
   - `item_barcodes`: Barcode Registry (1,124 rows, 30 columns). Represents optical barcodes mapped to `item_id` and `variant_id`.

2. **The Legacy Sellable Catalog Entity (`products`)**:
   - `products`: Monolithic product catalog (1,667 rows, 50 columns).
   - Contains direct columns: `code`, `name`, `sku`, `barcode`, `secondary_barcodes` (ARRAY), `price`, `stock`, `item_id`, `item_variant_id`, `variant_id`.
   - **Convergence Metric**:
     - Total `products`: **1,667**
     - Linked to `item_id`: **534** (32.0%)
     - Linked to `item_variant_id`: **533** (31.9%)
     - Unlinked legacy products: **1,133** (68.0%)
   - **Conclusion**: `products.id` is still referenced by 22 database tables (such as `stock_transfer_items`, `product_batch_stocks`, `psv_stock_balances`, and older sales/purchase line items). **`products.id` CANNOT be deleted or replaced globally.** It serves as the legacy bridge while `items.id` and `item_variants.id` serve as the modern canonical foundation.

---

## 3. Inventory of Existing Product Identifier Structures

The audit confirmed that SMRITI **already possesses dedicated identifier structures**. No redundant or duplicate barcode tables should be created.

| Structure Name | Physical Table | Active Rows | Key Columns | Business Role |
|---|---|---|---|---|
| **Primary Barcode Registry** | `item_barcodes` | **1,124** | `id`, `company_id`, `branch_id`, `item_id`, `variant_id`, `barcode`, `barcode_type`, `barcode_purpose`, `is_primary`, `status` | Universal barcode mapping for POS scanning and WMS scanners. Supports EAN13, CODE128, UPC, QR, CUSTOM. |
| **Buyer / Customer Cross-Reference** | `customer_article_mappings` | **451** | `id`, `company_id`, `customer_id`, `item_id`, `variant_id`, `barcode_id`, `customer_article`, `vendor_article`, `barcode` | B2B buyer article mapping (e.g. Reliance Trends buyer catalog codes mapped to factory style and variant). |
| **Historical & External Alias Registry** | `smriti_identity_alias` | **4,298** | `id`, `company_id`, `alias_code`, `alias_type`, `canonical_identity_code`, `entity_type`, `entity_id`, `source_system` | Cross-system integration aliases and legacy ID translation for data migration. |
| **eCommerce Channel Mappings** | `ecom_sku_mappings` | **18** | `id`, `company_id`, `channel_name`, `channel_sku`, `item_id`, `variant_id` | Mappings for external channels (Amazon, Flipkart, Shopify, Myntra). |
| **Product Identity Engine** | `product_identities` | **0** | `id`, `company_id`, `branch_id`, `product_id`, `business_key`, `fingerprint`, `barcode`, `barcode_provider_id`, `state` | Barcode pool allocation and lifecycle state management. |
| **Secondary Barcode Array** | `products.secondary_barcodes` | **1,667** | `VARCHAR[]` column on `products` | Denormalized array of secondary barcodes on legacy product records. |

---

## 4. Product & Variant Representation

In SMRITI Retail OS, the variant architecture is structured as follows:

```text
Style / Parent Product (items)
  │  id: 'itm_01H...'
  │  item_code: 'STYLE-CH-01' (Parent Style)
  │  brand: 'Chetak'
  │  category: 'Footwear'
  │  hsn_code: '64041990'
  │
  ├── Variant Child (item_variants)
  │     id: 'var_01H...'
  │     item_id: 'itm_01H...'
  │     variant_sku: 'STYLE-CH-01-NAVY-38' (Sellable SKU)
  │     variant_name: 'Chetak Slipon Navy 38'
  │     attributes_json: {"color": "NAVY", "size": "38"}
  │     │
  │     ├── Primary Barcode (item_barcodes)
  │     │     barcode: '8904551000019' (EAN-13 Retail Scan)
  │     │     barcode_type: 'EAN13'
  │     │     is_primary: true
  │     │
  │     └── Outer Pack Barcode (item_barcodes)
  │           barcode: '18904551000016' (ITF-14 Shipper Case)
  │           barcode_type: 'ITF14'
  │           barcode_purpose: 'PACKAGING'
  │           least_saleable_qty: 12.0000
  │
  └── Customer B2B Mapping (customer_article_mappings)
        customer_id: 'cust_reliance_trends'
        customer_article: '450180905001' (Buyer Article Code)
        vendor_article: 'CH-01-A' (Factory Style)
        barcode: '8904551000019'
```

### Forensic Analysis of Variant Schema:
1. `items` represents the **Parent Product / Style Master**.
2. `item_variants` represents the **Physical Sellable SKU**.
3. Transactions at the retail POS, WMS stock movements, and B2B invoices occur at the **Variant** level.
4. `products` is a denormalized legacy table that holds both style and variant attributes on a single row.

---

## 5. Forensic PSV (Partner Stock Visibility) Audit

PSV provides shadow stock visibility into partner retail outlets and distribution centers.

### 5.1 The Critical Finding: 100% External Partner SKU Disconnection
A forensic preflight audit of `psv_stock_balances` in `smriti001` revealed the following data state:
- **Total Balance Rows:** 100 rows
  - `company_code = '001'`: 90 rows
  - `company_code = 'COMP-001'`: 10 rows
- **Matching against `products.sku` or `products.code`:**
  - Matched: **0 rows (0.0%)**
  - **Unmatched: 100 rows (100.0%)**
  - Ambiguous matches: **0 rows**
  - Cross-company matches: **0 rows**

### 5.2 Why Did Wave 5 (`v1493`) Leave `product_id` NULL?
In Wave 5 migration (`v1493_psv_tenant_and_fk_hardening_wave5`), `company_id` was successfully added and backfilled to `COMP-001` for 100% of rows. However, `product_id` remained `NULL` for all 100 rows because:
1. The partner stock balance feeds ingest external partner SKUs (e.g., `SKU-PSV-173F`, `SKU-A-0047E4`, `SKU-PENDING-0C9B4A`).
2. These SKUs originate from third-party vendor systems or partner retail feeds that **do not match internal SMRITI catalog SKUs**.
3. **Architecture Principle Proven**: External partner data must **never** be expected to carry internal database primary keys (`product_id`). PSV must resolve partner identifiers to internal products asynchronously via a dedicated **Identifier Resolver**.

### 5.3 Audit of Wave 5 Code Path (`backend/app/services/psv_projection.py`):
Inspection of `PSVProjectionService.project_psv_stock_event` (lines 240-308) revealed:
1. `PSVStockEvent` is created with `company_code`, but `company_id` is **omitted** from the instantiation payload (defaulting to NULL).
2. `PSVStockBalance` is looked up and created using `company_code`:
   ```python
   bal_stmt = select(PSVStockBalance).where(
       PSVStockBalance.company_code == psv_event.company_code,
       PSVStockBalance.psv_party_id == psv_event.psv_party_id,
       PSVStockBalance.sku == psv_event.sku
   )
   ```
3. Neither `PSVStockEvent` nor `PSVStockBalance` assigns `product_id`.
4. The database constraint remains:
   `UniqueConstraint("company_code", "psv_party_id", "sku", name="uq_psv_stock_balances_party_sku")`
   rather than tenant-authoritative `(company_id, psv_party_id, sku)`.

---

## 6. PSV Legacy Fields Analysis

| Field Name | Type | Classification | Source of Truth | Current Dependency & Recommended Strategy |
|---|---|---|---|---|
| `company_id` | `VARCHAR(50)` | **Authoritative Tenant Key** | `companies.id` | Currently nullable. Must become `NOT NULL` after application writes are updated to pass `company_id`. |
| `company_code` | `VARCHAR(50)` | **Legacy Compatibility Snapshot** | Legacy client feeds | Kept as an immutable audit snapshot for external partner feeds. Uniqueness constraint must transition to `company_id`. |
| `sku` | `VARCHAR(100)` | **Partner Business Key** | External partner feed | The external SKU reported by the partner (e.g. 'SKU-A-0047E4'). Authoritative for partner reconciliation. |
| `product_id` | `VARCHAR(50)` | **Resolved Canonical Link** | `products.id` / `items.id` | Nullable FK. Populated via asynchronous or inline Identifier Resolver when an external SKU is mapped. Must remain `nullable=True` to allow ingestion of unknown/unmapped partner SKUs into quarantine/reconciliation. |
| `psv_party_id` | `VARCHAR(50)` | **Authoritative Partner Dimension** | `psv_parties.id` | Foreign key to partner master. Authoritative. |
| `store_code_snapshot` | `VARCHAR(50)` | **Snapshot Dimension** | Partner store code | Non-authoritative reporting snapshot. |

---

## 7. Critical Tenant Rules & Authoritative Ownership Paths

1. **Authoritative Boundary**: `company_id -> companies.id` is the sole tenant security boundary.
2. **Prohibition of Uncontrolled Fallback**: Application services must never fall back to matching `company_code -> company_id` at runtime. The tenant context (`tenant_ctx.company_id`) must be explicitly passed down from authentication.
3. **Preflight Rule**:
   - Every existing record with a matched `company_code` has been backfilled to `company_id` (100% verified in `smriti001`).
   - If an ingestion event contains an unknown `company_id` or unmatched `company_code`, it must **FAIL PREFLIGHT** and be rejected or routed to a quarantined dead-letter queue.
4. **Transition to NOT NULL**:
   Once `psv_projection.py` is updated to write `company_id` during event creation, `company_id` on `psv_stock_events` and `psv_stock_balances` can be made `NOT NULL`.

---

## 8. Product Mapping & Ambiguity Analysis

Before any migration or automated backfill links `psv_stock_balances.product_id` or line items:
- **Zero Unmatched Identifiers**: Only records with an exact, unambiguous match in `products`, `item_variants`, or `customer_article_mappings` may be linked.
- **Zero Ambiguous Matches**: If an external barcode or SKU matches more than one internal variant (e.g. across different categories or inactive duplicates), resolution must return `AMBIGUOUS_MATCH` and remain unlinked.
- **Zero Cross-Company Matches**: Resolution must strictly filter by `company_id`. An identifier belonging to Company A must never resolve to an item in Company B.

---

## 9. Comprehensive Database Catalog Audit

Across all 244 tables in `smriti001`, the target identity columns are distributed as follows:

### 9.1 Summary Distribution:
- **Tables with `company_id`:** **236 tables** (Complete tenant isolation)
- **Tables with `product_id`:** **22 tables**
- **Tables with `item_id`:** **22 tables**
- **Tables with `variant_id`:** **21 tables**
- **Tables with `barcode`:** **12 tables**
- **Tables with `sku`:** **10 tables**
- **Tables with `company_code`:** **8 tables**

### 9.2 Enumerated Inventory of Identity-Bearing Tables:

| Table Name | Target Columns | Row Count | Business Role | Source of Truth / Derived |
|---|---|---|---|---|
| `items` | `item_code`, `company_id`, `style_code`, `vendor_code` | 524 | Parent Style / Product Master | **Source of Truth** |
| `item_variants` | `variant_sku`, `item_id`, `company_id` | 1,077 | Variant / Sellable Child Master | **Source of Truth** |
| `products` | `id`, `code`, `sku`, `barcode`, `secondary_barcodes`, `item_id`, `item_variant_id`, `variant_id`, `company_id` | 1,667 | Legacy Sellable Product Catalog | Dual / Transitioning Bridge |
| `item_barcodes` | `barcode`, `item_id`, `variant_id`, `company_id` | 1,124 | Optical Barcode Registry | **Source of Truth (Scanning)** |
| `customer_article_mappings` | `customer_article`, `vendor_article`, `barcode`, `item_id`, `variant_id`, `company_id` | 451 | Buyer Article Cross-Reference | **Source of Truth (B2B Partner)** |
| `product_batch_stocks` | `product_id`, `variant_id`, `company_id` | 350 | Warehouse Batch Stock Ledger | **Source of Truth (Physical Stock)** |
| `smriti_identity_alias` | `alias_code`, `company_id` | 4,298 | Historical & System Aliases | **Source of Truth (Aliases)** |
| `ecom_sku_mappings` | `channel_sku`, `item_id`, `variant_id`, `company_id` | 18 | eCommerce Channel SKU Cross-Ref | **Source of Truth (eCom)** |
| `psv_stock_balances` | `sku`, `company_code`, `company_id`, `product_id` | 100 | Partner Stock Projection | Derived / Visibility Projection |
| `psv_stock_events` | `sku`, `company_code`, `company_id`, `product_id` | 169 | Partner Stock Event Ledger | Immutable Shadow Ledger |
| `sales_invoice_items` | `code`, `product_id`, `item_id`, `variant_id`, `company_id` | 15,764 | B2B / Retail Sales Invoice Lines | Transactional Snapshot |
| `purchase_order_items` | `code`, `product_id`, `item_id`, `variant_id`, `company_id` | 52 | Purchase Order Lines | Transactional Line Items |
| `purchase_receipt_items` | `code`, `product_id`, `item_id`, `variant_id`, `company_id` | 70 | Goods Receipt Lines (GRN) | Transactional Line Items |
| `stock_transfer_items` | `product_id`, `company_id` | 48 | Inter-Branch Stock Transfers | Transactional Movements |
| `customer_purchase_order_lines` | `product_id`, `item_id`, `variant_id`, `company_id` | 32 | Buyer PO Line Demands | Demand Document Lines |
| `distribution_order_items` | `item_id`, `variant_id`, `company_id` | 0 | Hub & Spoke Distribution Lines | Transactional Line Items |
| `packing_slip_items` | `product_id`, `sku`, `company_id` | 0 | Logistics Outward Packing Slips | Logistics Line Items |
| `dispatch_items` | `product_id`, `company_id` | 0 | B2B Dispatch Note Lines | Logistics Line Items |
| `goods_receipt_lines` | `product_id`, `variant_id`, `barcode`, `company_id` | 0 | Inward Warehouse Receipts | Physical Warehouse Lines |
| `sales_return_items` | `variant_id`, `company_id` | 0 | Customer Sales Returns | Reverse Logistics Lines |
| `sales_quotation_items` | `variant_id`, `company_id` | 0 | Commercial Sales Quotations | Commercial Quotation Lines |
| `product_identities` | `product_id`, `barcode`, `company_id` | 0 | Barcode Pool Allocation | Pool Management |
| `barcode_layouts` | `company_id` | 10 | Thermal Barcode Label Layouts | Label Design Templates |

---

## 10. Application Code Audit & Dependency Matrix

The code audit across backend and frontend repositories revealed key usage patterns:

### 10.1 Backend Core Findings:
1. **`ItemBarcode` Model (118 occurrences)**: Authoritative model in `backend/app/models/item_master.py`. Integrated into `UniversalItemMasterService` and `customer_article_mapping.py`.
2. **`CustomerArticleMapping` Model (28 occurrences)**: High-speed B2B lookup model in `backend/app/models/customer_article_mapping.py`. Supports buyer-specific article lookups.
3. **`UniversalItemMasterService.resolve_item_by_barcode_or_sku` (`backend/app/services/item_master_svc.py`)**:
   Existing enterprise 5-tier resolution engine:
   - Tier 1: Exact Barcode (`ItemBarcode`)
   - Tier 2: Variant SKU (`ItemVariant`)
   - Tier 3: Customer / Buyer Article Code (`CustomerArticleMapping`)
   - Tier 4: Item Code (`Item`)
   - Tier 5: Serial Number (`ItemSerial`)
4. **`IdentityResolver` (`backend/app/services/identity/resolver.py`)**:
   Cross-domain platform identity resolver covering UUIDv7 technical IDs, SMRITI identity codes, and `smriti_identity_alias`.
5. **`master_lookup.py` Adapter**:
   - `/api/v1/item-barcodes` currently executes a query on legacy `Product` rather than `ItemBarcode`.
   - `/api/v1/variants` is routed via legacy alias to `inventory.py`.

### 10.2 Frontend Core Findings:
1. **`f2LookupRegistry.ts` (`src/services/f2LookupRegistry.ts`)**:
   Authoritative registry defining canonical lookup routing:
   - `variant` -> `/api/v1/variants`
   - `item` -> `/api/v1/items`
   - `item_barcode` -> `/api/v1/item-barcodes`
2. **`UniversalBrowseEngine.tsx`**: Universal F2 dialog used across billing, purchase, and inventory screens.
3. **Barcode Scanning (`TaxInvoiceItemGrid.tsx`, `BillingTerm.tsx`, `ProPosBillingTerm.tsx`)**:
   Uses `scanBarcode` input with fallback between direct barcode scan and `item_barcode` lookup.

---

## 11. Universal Lookup Compatibility Analysis

The audit proves that universal lookup compatibility is **already preserved and architecturally specified** in SMRITI:
1. **F2 Universal Browse Dialog**:
   - Powered by `f2LookupRegistry.ts` and `UniversalBrowseEngine.tsx`.
   - Explicitly designed to route to `/api/v1/variants`, `/api/v1/items`, and `/api/v1/item-barcodes`.
2. **Resolution Pipeline**:
   - Scanning an optical barcode, entering a SKU, or inputting a buyer article code resolves through `UniversalItemMasterService.resolve_item_by_barcode_or_sku`.
   - Returns a unified `ItemResolutionResponse` containing `item_id`, `variant_id`, `item_code`, `variant_sku`, `barcode`, `tax_rate`, contract pricing, and inventory buckets.
3. **Zero Interruption**:
   - Any refactoring of product identity does not alter the F2 dialog contract or POS input contracts.

---

## 12. Verification Status Registry (Rule 7)

Every finding and architectural component audited in Phase A is assigned an explicit four-state status:

| Component / Subsystem | Status | Verification Evidence & Named Mechanisms |
|---|---|---|
| **Canonical Product Identity (`products.id`)** | **Done** | Verified 1,667 rows in `products`, referenced by 22 tables. Preserved as canonical internal identity. |
| **Parent/Variant Hierarchy (`items` & `item_variants`)** | **Done** | Verified 524 `items` (Parent Style) and 1,077 `item_variants` (Physical SKU). |
| **Barcode Structure Audit (`item_barcodes`)** | **Done** | Verified 1,124 rows in `item_barcodes` with `UniqueConstraint("company_id", "barcode")`. No duplicate table needed. |
| **Customer Cross-Reference (`customer_article_mappings`)** | **Done** | Verified 451 rows in `customer_article_mappings` with active buyer article unique indexes. |
| **PSV 100% Unmatched Partner SKU Discovery** | **Done** | Forensic query confirmed 100/100 partner SKUs in `psv_stock_balances` do not equal internal SKUs. |
| **PSV Wave 5 Tenant Hardening Review** | **Done** | Confirmed `company_id` populated in `psv_stock_balances`, but omitted in `psv_projection.py` creation flow. |
| **Universal Resolver Analysis** | **Done** | 5-Tier resolver in `item_master_svc.py` and 4-tier in `identity/resolver.py` audited. |
| **Database Catalog Inventory (244 Tables)** | **Done** | Cataloged all 244 tables; enumerated 22 product_id, 22 item_id, 21 variant_id tables. |

---

## 13. Summary Recommendation for Phase B Refactor Plan

Based on the evidence gathered in this audit:

1. **Retain `products.id` as Internal Database Identity**:
   Do NOT replace `products.id` globally. Maintain it in dual-read/dual-write sync with `items.id` and `item_variants.id`.
2. **Extend and Standardize `item_barcodes`**:
   `item_barcodes` is the sole scanning identity table. Extend `/api/v1/item-barcodes` to read directly from `item_barcodes` with fallback to `products`.
3. **Decouple PSV Ingestion via Partner Identifier Resolver**:
   - Update `psv_projection.py` to write `company_id` explicitly.
   - Introduce an asynchronous/inline **Partner Identifier Resolver** in PSV that uses `customer_article_mappings`, `smriti_identity_alias`, and `ecom_sku_mappings` to resolve partner SKUs to internal `product_id`.
   - Update `psv_stock_balances` uniqueness constraint to `(company_id, psv_party_id, sku)`.
4. **Follow Expand / Contract Workflow**:
   Execute Phase B (Design Plan) next, followed by strictly additive migrations in Phase C.
