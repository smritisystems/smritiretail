<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.38.0
  Created      : 2026-09-26
  Modified     : 2026-09-26
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Architectural Decision Document — Resolver Fragmentation (For Ganita Review)
-->

# ARCHITECTURAL DECISION DOCUMENT: Resolver Fragmentation & Resolution Strateg**Document ID:** ARCH-DEC-20260926-RESOLVER-01  
**Status:** RATIFIED ARCHITECTURAL BOUNDARY MANDATE (v6.39.0)  
**Target Architecture:** SMRITI Retail OS Core Resolution Layer  
**Author:** Jawahar Ramkripal Mallah (Chief Systems Architect & Creator)  

---

## 1. Executive Summary

During the architectural audit of SMRITI Retail OS (`smritiNX`), two separate item resolver engines were identified in `backend/app/services/`:
1. `CanonicalItemResolver` (`backend/app/services/canonical_resolver.py`)
2. `PartnerIdentifierResolver` (`backend/app/services/partner_resolver.py`)

This document presents the definitive, ratified architectural boundary decision resolving the duplication flag permanently. Both engines serve fundamentally distinct architectural tiers and have been proven to have incompatible latency, error-handling, and data-dependency profiles.

---

## 2. Feature-by-Feature Comparison Matrix

| Capability / Feature | `CanonicalItemResolver` (`canonical_resolver.py`) | `PartnerIdentifierResolver` (`partner_resolver.py`) | Architectural Significance |
| :--- | :--- | :--- | :--- |
| **Primary Domain Purpose** | Operational retail checkout, POS, Sales, Purchase, Inventory, F2 Browse | Partner Stock Visibility (PSV), external EDI, B2B Buyer Feeds, E-commerce Marketplaces | Internal transactional execution vs External feed ingestion |
| **Data Access Method** | Raw SQL via `session.execute(text(...))` for microsecond POS performance | SQLAlchemy ORM `select(...)` statements | POS hot-path optimization vs Domain entity mapping |
| **Multi-Tenant Scoping** | Mandatory `company_id` check; raises `ValueError` if missing | Mandatory `company_id` filter across all query tiers | Both enforce tenant isolation |
| **Cohort Rollout Engine** | Integrated with `CohortEvaluator.is_canonical_read_enabled()` (tenant/branch/user/role canary) | None (static query pipeline) | Enables zero-downtime canary rollout from legacy to canonical catalog |
| **Dual-Read & Shadow Mode** | Dual execution: queries canonical and legacy simultaneously; logs shadow divergence | None | Enables divergence monitoring before switching primary read authority |
| **Fallback Mechanism** | Automated fallback to `products` on `CANONICAL_TIMEOUT`, `CANONICAL_EXCEPTION`, or `NOT_IN_CANONICAL` | None (returns `found=False` if no tier matches) | Operational fault tolerance for cash registers |
| **Observability Telemetry** | Durable event logging via `CanonicalTelemetrySink` with latency, matched tier, fallback reason | None | Complete auditability for operational checkout queries |
| **Pricing & Tax Resolution** | Resolves `selling_price`, `mrp`, `cost_price` from `price_book_entries`, plus `hsn_code`, `tax_rate` | Does NOT fetch pricing or tax rates | Required for POS billing; irrelevant for EDI stock quantity projection |
| **EDI / Buyer Article Codes** | **Unsupported** (no knowledge of `customer_article_mappings`) | **Supported (Tier 1)**: Resolves buyer article codes and buyer barcodes | Critical for B2B/LFR buyer order processing |
| **Marketplace SKU Mappings** | **Unsupported** (no knowledge of `ecom_sku_mappings`) | **Supported (Tier 2)**: Resolves Amazon ASIN, Flipkart FSN, Myntra Style IDs | Critical for multi-channel eCommerce synchronization |
| **Identity Registry Aliases** | **Unsupported** (no knowledge of `smriti_identity_alias`) | **Supported (Tier 3)**: Resolves cross-system legacy/external UUIDs | Critical for external ERP/WMS cross-referencing |
| **Canonical Barcode Lookup** | **Supported (Tier 1)**: `item_barcodes` join `item_variants` join `items` | **Supported (Tier 4)**: `item_barcodes` select | Both resolve optical barcodes |
| **Variant SKU Lookup** | **Supported (Tier 2)**: `item_variants.variant_sku` (exact, UPPER, ILIKE) | **Supported (Tier 4B)**: `item_variants.variant_sku` | Both resolve variant SKUs |
| **Parent Item Code Lookup** | **Supported (Tier 3)**: `items.item_code` (exact, UPPER, ILIKE) | **Partial**: Returns `item_id` if resolved through variant/barcode | Parent style level fallback |
| **Legacy Catalog Fallback** | **Supported**: `products` (barcode, secondary_barcodes, code, style_code) | **Supported (Tier 5)**: `Product` ORM fallback | Backward compatibility with legacy schema |
| **Output Data Contract** | Flat dictionary with operational pricing, tax, variant, item attributes | Structured dataclass `PartnerResolutionResult` (`found`, `product_id`, `item_id`, `variant_id`, `tier`, `metadata`) | Transaction-ready payload vs Identifier pointer |

---

## 3. What Each Does That the Other Doesn't

### What `CanonicalItemResolver` Does that `PartnerIdentifierResolver` Cannot:
1. **Dynamic Cohort Evaluation:** Checks dynamic rule configurations to determine whether a given branch or user should read from the canonical schema or legacy schema.
2. **Shadow Divergence Auditing:** Runs both engines in parallel and flags mismatches in SKU, MRP, or selling price.
3. **Structured Observability:** Sends latency, matched tier, and fallback details to a persistent telemetry sink for SLA and drift tracking.
4. **Commercial Pricing & Tax Hydration:** Pulls price book entries and tax rates needed to calculate invoice line totals.
5. **Fail-Safe Fallback:** If canonical tables time out or encounter an exception, cash registers automatically drop back to legacy tables without aborting a transaction.

### What `PartnerIdentifierResolver` Does that `CanonicalItemResolver` Cannot:
1. **Third-Party Article Mapping:** Translates buyer-specific article numbers (e.g. Shoppers Stop, Reliance Trends, Lifestyle internal codes) via `customer_article_mappings`.
2. **eCommerce Channel SKU Resolution:** Translates external marketplace SKUs (Amazon, Flipkart, Shopify, WooCommerce) via `ecom_sku_mappings`.
3. **Enterprise Identity Alias Resolution:** Queries `smriti_identity_alias` to resolve disparate system identifiers across external ERPs.
4. **Decoupled Identifier Output:** Returns entity IDs (`product_id`, `item_id`, `variant_id`) without locking into POS pricing assumptions, enabling usage in asynchronous background ingestion feeds (such as PSV projection).

---

## 4. Architectural Analysis: Why Fragmentation Occurred

The two resolvers were built to solve two fundamentally different engineering problems at different stages of the platform lifecycle:
1. `CanonicalItemResolver` was created for **Gate 8 (Operational Rollout & Canary Migration)**: Its primary objective is ensuring that cashiers at POS terminals do not experience transaction failures while the underlying database migrates from the monolithic `products` table to the normalized `items`/`item_variants`/`item_barcodes` architecture.
2. `PartnerIdentifierResolver` was created for **Gate 11 / PSV (Partner Stock Visibility & EDI Ingestion)**: Its primary objective is translating untrusted external buyer/marketplace SKUs into internal catalog entities without polluting internal checkout code with marketplace-specific mapping logic.

---

## 5. Ratified Decision: Option A (Permanent Domain Decoupling)

**Option A is ratified as the permanent architecture.** The two resolvers are genuinely irreconcilable due to opposing performance, data contract, and transactional requirements.

### Boundary Statement (MANDATORY & ENFORCED):

1. **`CanonicalItemResolver` handles INTERNAL OPERATIONAL TRANSACTIONS exclusively:**
   - **Scope:** POS scanning, cashier checkout, sales invoicing, purchase orders, physical inventory stocktakes, F2 item browsing.
   - **Contract:** Returns a fully hydrated pricing and tax dictionary (`selling_price`, `mrp`, `tax_rate`, `hsn_code`).
   - **Invariable Boundary:** `CanonicalItemResolver` **NEVER** queries `customer_article_mappings`, `ecom_sku_mappings`, or `smriti_identity_alias`. It shall never be called from asynchronous partner feed ingestion workers.

2. **`PartnerIdentifierResolver` handles EXTERNAL INGESTION IDENTIFIERS exclusively:**
   - **Scope:** Partner Stock Visibility (PSV) feed ingestion, EDI 850/855 buyer order translation, Amazon/Flipkart/Myntra external catalog synchronization, ERP cross-system alias mapping.
   - **Contract:** Returns a lightweight `PartnerResolutionResult` (`found`, `product_id`, `item_id`, `variant_id`, `resolution_tier`).
   - **Invariable Boundary:** `PartnerIdentifierResolver` **NEVER** operates in the cashier checkout, POS scanning, or billing hot-paths. It shall never hydrate retail selling prices, discounts, or tax rates.

3. **Anti-Duplication Rule:**
   - Neither resolver may import, cross-call, or absorb the other.
   - Any future operational retail features must be added to `CanonicalItemResolver`.
   - Any future external partner, channel, or marketplace mappings must be added to `PartnerIdentifierResolver`.

This architectural mandate permanently closes the resolver duplication question.es.
