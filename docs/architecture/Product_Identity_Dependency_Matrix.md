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

# SMRITI Retail OS — Product Identity Dependency Matrix
**Document ID:** DEP-PROD-ID-20260925-01  
**Status:** Done (Phase A & B Dependency Matrix)  
**Corpus / Database:** `smritisys` (Control Plane) | `smriti001` (Tenant Plane)  
**Author:** Jawahar Ramkripal Mallah (Chief Systems Architect & Creator)  

---

## 1. Executive Summary

This Dependency Matrix maps all tables, backend services, API routes, and frontend components interacting with `product_id`, `item_id`, `variant_id`, `sku`, `barcode`, `company_id`, and `company_code`.

---

## 2. Database Table Dependency Matrix

| Table Name | `company_id` | `company_code` | `product_id` | `item_id` | `variant_id` | `sku` | `barcode` | Role & Data Flow |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|---|
| `items` | **YES** | NO | NO | **PK (`id`)** | Rel | Sovereign | NO | **Parent Product Master**; source of truth for styles. |
| `item_variants` | **YES** | NO | NO | **FK** | **PK (`id`)** | `variant_sku` | Rel | **Variant SKU Master**; physical sellable unit. |
| `item_barcodes` | **YES** | NO | NO | **FK** | **FK** | NO | `barcode` | **Optical Barcode Registry**; scanning identities. |
| `customer_article_mappings`| **YES** | NO | NO | **FK** | **FK** | `vendor_article` | `barcode` | **B2B Buyer Cross-Reference**; buyer item codes. |
| `products` | **YES** | NO | **PK (`id`)** | FK (Opt) | FK (Opt) | `sku` | `barcode` | **Legacy Sellable Entity**; bridge layer. |
| `product_batch_stocks` | **YES** | NO | FK | NO | FK | NO | NO | **Batch Inventory**; physical stock by warehouse. |
| `stock_movements` | **YES** | NO | FK | NO | FK | `sku` | NO | **Stock Ledger**; immutable inventory journal. |
| `sales_invoice_items` | **YES** | NO | FK (Opt) | **FK** | FK (Opt) | `code` | NO | **B2B / POS Sales Lines**; billing transaction items. |
| `purchase_order_items` | **YES** | NO | FK (Opt) | **FK** | FK (Opt) | `code` | NO | **Procurement Order Lines**; vendor order items. |
| `purchase_receipt_items` | **YES** | NO | FK (Opt) | **FK** | FK (Opt) | `code` | NO | **GRN Inward Lines**; warehouse receipt items. |
| `stock_transfer_items` | **YES** | NO | **FK** | NO | NO | NO | NO | **Stock Transfers**; inter-branch transfer items. |
| `psv_stock_balances` | **YES** | **YES** | FK (Opt) | NO | NO | `sku` | NO | **PSV Projection**; shadow stock balance per partner. |
| `psv_stock_events` | **YES** | **YES** | FK (Opt) | NO | NO | `sku` | NO | **PSV Event Ledger**; immutable partner events. |
| `smriti_identity_alias` | **YES** | NO | NO | NO | NO | `alias_code` | NO | **Platform Alias Registry**; cross-system aliases. |
| `ecom_sku_mappings` | **YES** | NO | NO | **FK** | **FK** | `channel_sku`| NO | **eCommerce Cross-Reference**; channel SKU mappings. |

---

## 3. Application Code & Service Dependency Matrix

| Component / Service | File Path | Ingestion / Read Path | Identity Mechanism Used | Impact of Refactor |
|---|---|---|---|---|
| **PSV Projection Engine** | `backend/app/services/psv_projection.py` | Line item event projection | `company_code`, `sku` (writes NULL `company_id`) | **HIGH**: Must write `company_id` directly and resolve external `sku` to `product_id`. |
| **Universal Item Resolver** | `backend/app/services/item_master_svc.py` | 5-Tier Barcode/SKU Scan | `item_barcodes`, `item_variants`, `customer_article_mappings`, `items` | **NONE (Preserved)**: Already canonical. |
| **Legacy Convergence Svc** | `backend/app/services/univ_item_svc.py` | Converges `Product` to `Item` | `products` -> `items`, `item_variants`, `item_barcodes` | **LOW**: Utility used for batch synchronization. |
| **Master Lookup API** | `backend/app/api/v1/master_lookup.py` | `/api/v1/item-barcodes` | Queries legacy `Product` table | **MEDIUM**: Update to query `item_barcodes` with fallback to `Product`. |
| **Platform Identity Resolver**| `backend/app/services/identity/resolver.py` | Cross-domain UUID / Code lookup | UUIDv7, `smriti_identity_alias`, Core tables | **NONE (Preserved)**: System-wide control plane. |
| **Frontend F2 Registry** | `src/services/f2LookupRegistry.ts` | Universal Browse Dialog | `/api/v1/variants`, `/api/v1/items`, `/api/v1/item-barcodes` | **NONE (Preserved)**: API contracts remain 100% stable. |
| **POS Barcode Scanning** | `src/components/sales/components/TaxInvoiceItemGrid.tsx` | Optical scanner typeahead | Calls backend barcode resolver | **NONE (Preserved)**: Input handling unchanged. |
