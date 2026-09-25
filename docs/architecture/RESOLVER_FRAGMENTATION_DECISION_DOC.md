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

# ARCHITECTURAL DECISION DOCUMENT: Resolver Fragmentation & Resolution Strategy

**Document ID:** ARCH-DEC-20260926-RESOLVER-01  
**Status:** PROPOSED / PENDING GANITA DECISION  
**Target Architecture:** SMRITI Retail OS Core Resolution Layer  
**Author:** Jawahar Ramkripal Mallah (Chief Systems Architect & Creator)  

---

## 1. Executive Summary

During the architectural audit of SMRITI Retail OS (`smritiNX`), two separate item resolver engines were identified in `backend/app/services/`:
1. `CanonicalItemResolver` (`backend/app/services/canonical_resolver.py`)
2. `PartnerIdentifierResolver` (`backend/app/services/partner_resolver.py`)

This document presents a granular, feature-by-feature diagnosis of both engines, articulates why each was created, details the functional gaps of each relative to the other, and outlines three distinct architectural options for Ganita's review and sign-off.

Per governance guidelines, **no automatic merger or deletion has been performed**.

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

## 5. Architectural Options for Ganita Review

### Option A: Formalize Domain Decoupling (Recommended)
- **Concept:** Maintain both resolvers, but formally declare their separation of concerns in the architecture documentation:
  * `CanonicalItemResolver` = **Internal Operational Item Resolver** (POS, Sales Invoicing, Purchase Orders, Physical Inventory).
  * `PartnerIdentifierResolver` = **External Ingestion Identifier Resolver** (PSV Feeds, EDI Inbound, Marketplace Order Ingestion).
- **Pros:** Zero risk of regressions in POS hot-path; preserves low-latency raw SQL execution for checkout; keeps marketplace mapping complexity out of point-of-sale.
- **Cons:** Two resolver files exist in `services/`.

### Option B: Unified Multi-Tier Facade (`ItemResolutionEngine`)
- **Concept:** Create a unified facade that wraps both resolvers:
  * Tier 0: Check Partner / Channel Context (if `customer_id` or `channel_code` provided, delegate to Partner resolution).
  * Tier 1: Canonical Barcode / Variant / Item (delegate to Canonical raw SQL).
  * Tier 2: Legacy Product Fallback.
  * Optionally hydrate pricing/tax if `with_pricing=True`.
- **Pros:** Single entry point for all resolution requests across the entire application.
- **Cons:** Introduces unnecessary abstraction overhead; risk of regressions in high-speed POS scanning; requires refactoring callers across both POS and PSV.

### Option C: Deprecate `CanonicalItemResolver` Shadow Logic Once Migration Reaches 100%
- **Concept:** When all branches have completed 100% cutover to canonical `items`/`item_variants` and the legacy `products` table is retired, strip the shadow read, divergence telemetry, and legacy fallback from `CanonicalItemResolver`, leaving a clean, high-performance canonical reader.
- **Pros:** Eliminates dual-read overhead once legacy debt is fully retired.
- **Cons:** Cannot be executed today while canary rollout and legacy data coexist.

---

## 6. Recommendation for Ganita

**Adopt Option A immediately**, with a planned transition to **Option C** once the operational database migration achieves 100% tenant cutover. Do not merge them into a single monolithic resolver today, as external EDI mapping logic and point-of-sale checkout have radically different performance, error-handling, and data-dependency profiles.
