<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 1.0.0
  Created      : 2026-09-25
  Modified     : 2026-09-25
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Architecture Verification & Status Addendum
-->

# Product Identity Architecture — Verified Status

**Document Type:** Forensic Architecture Verification & Status Addendum  
**Branch:** `smritiNX`  
**Evaluation Date:** 2026-09-25  
**Evaluation Scope:** Verification of Product Identity Refactor, Resolver Architecture, Stock Synchronization Claims, Migration Lineage, and Referential Integrity.

---

## Executive Summary

An architectural audit was performed to independently verify the claims made in the recent Product Identity Refactor and Schema Remediation reports prior to any architectural freeze decision. This document provides an objective, evidence-based correction and reconciliation of the component names, migration heads, table foreign key counts, and test execution results.

---

## (a) Confirmed-Real Components with File Paths

The following architectural components are verified to exist, operate, and have concrete implementations in the active repository:

1. **`CanonicalItemResolver`**  
   - **Path:** [`backend/app/services/canonical_resolver.py`](file:///F:/SMRITRretailNX/backend/app/services/canonical_resolver.py)  
   - **Role:** The canonical operational item and barcode resolver for POS, Sales, Purchase, and Inventory workflows.  
   - **Architecture:** Implements configuration-driven dynamic cohort evaluation (`CohortEvaluator.is_canonical_read_enabled`), canonical-primary resolution with structured legacy fallback, and shadow read telemetry persistence (`CanonicalTelemetrySink`). Created on 2026-09-01 (Gate 8).

2. **`IdentityResolver` & Unified Identity Control Plane**  
   - **Path:** [`backend/app/services/identity/resolver.py`](file:///F:/SMRITRretailNX/backend/app/services/identity/resolver.py)  
   - **Models:** [`backend/app/models/identity_registry.py`](file:///F:/SMRITRretailNX/backend/app/models/identity_registry.py)  
   - **Role:** Enterprise-wide cross-domain entity and identifier governance (Phases 1.1–1.4, migrations `v1464`–`v1469`).  
   - **Architecture:** Allocates and validates monotonic RFC 9562 UUIDv7 technical identities, sequential governed business codes (`MST-ITM-*`, `CRM-CUS-*`, `SAL-INV-*`), and polymorphic external business aliases across 16+ core domain entities (`ITEM`, `PARTY`, `CUSTOMER`, `SUPPLIER`, `COMPANY`, `BRANCH`, `SALES_INVOICE`, `PURCHASE_ORDER`).

3. **`StockSynchronizer`**  
   - **Path:** [`backend/app/services/stock_synchronizer.py`](file:///F:/SMRITRretailNX/backend/app/services/stock_synchronizer.py)  
   - **Role:** Centralized stock cache synchronizer and drift repair service.  
   - **Architecture:** Implements `sync_product_stock_cache(session, product_id, company_id)` using PostgreSQL row-level locks (`SELECT FOR UPDATE`), multi-tenant drift detection (`detect_stock_drift`), and automated cache repair (`reconcile_and_repair_drift`). Computes the cached `products.stock` aggregate from authoritative underlying ledgers (`product_batch_stocks` for batch items, `stock_movements` for non-batch items).

4. **Alembic Migration `v1494_product_identity_psv_tenant_hardening`**  
   - **Path:** [`backend/alembic/versions/v1494_product_identity_psv_tenant_hardening.py`](file:///F:/SMRITRretailNX/backend/alembic/versions/v1494_product_identity_psv_tenant_hardening.py)  
   - **Status:** Verified present as the latest migration file in `backend/alembic/versions/`.  
   - **Lineage:** `v1493_psv_tenant_and_fk_hardening_wave5` -> `v1494_product_identity_psv_tenant_hardening`.  
   - **Database Head Status:** Current head on tenant database `smriti001` (`v1494_product_identity_psv_tenant_hardening (head)`).

5. **Canonical Optical Barcode and Buyer Mapping Registries**  
   - **`item_barcodes` Table:** Authoritative multi-tenant barcode registry (1,124 records in `smriti001`). Indexed on `(company_id, barcode_normalized)` and unique partial index on `(company_id, variant_id)` WHERE `is_primary = true`.  
   - **`customer_article_mappings` Table:** Authoritative buyer/customer article cross-reference registry (451 records in `smriti001`).

---

## (b) Corrected and Renamed References

### 1. Resolver Class Name Correction (`PartnerIdentifierResolver` -> `CanonicalItemResolver`)
- **Prior Claim:** The prior architecture report cited `PartnerIdentifierResolver` as the canonical resolution class for product and partner identification.
- **Actual Reality:** SMRITI's true pre-existing architectural class for item, variant, and barcode resolution is **`CanonicalItemResolver`** located in [`backend/app/services/canonical_resolver.py`](file:///F:/SMRITRretailNX/backend/app/services/canonical_resolver.py).
- **Recent Introduction:** In commit `baa98b94`, an agent created a standalone class named `PartnerIdentifierResolver` in [`backend/app/services/partner_resolver.py`](file:///F:/SMRITRretailNX/backend/app/services/partner_resolver.py). This introduced duplicate naming and fragmented resolver abstractions rather than expanding `CanonicalItemResolver`.
- **Target Documentation Correction Mapping:**
  Future sessions and documentation must reference **`CanonicalItemResolver`** as the canonical resolution engine. The following documents and code comments that reference `PartnerIdentifierResolver` must be understood as pointing to `CanonicalItemResolver` (or consolidated into it):
  - `docs/walkthrough/inventory/Product_Identity_Refactor_v1.0.0.md` (lines 52, 62, 115, 129, 209)
  - `docs/architecture/Product_Identity_Refactor_Plan.md` (lines 118, 160)
  - `docs/architecture/Product_Identity_Data_Mapping_Report.md` (line 50)
  - `docs/walkthrough/README.md` (line 31)
  - `CHANGELOG.md` (line 39)

### 2. Relationship between `IdentityResolver` and `CanonicalItemResolver`
`backend/app/services/identity/resolver.py` (governed by the Phase 1.1–1.4 Unified Identity Control Plane and `smriti_identity_registry`) is a **completely separate and decoupled architectural subsystem** from `CanonicalItemResolver` (`backend/app/services/canonical_resolver.py`). `IdentityResolver` operates at the global enterprise tier, assigning and resolving immutable UUIDv7 technical identities, sequential governed identity codes (`MST-ITM-*`, `CRM-CUS-*`, `PUR-SUP-*`, `SAL-INV-*`), and external sovereign business aliases (`GSTIN`, `PAN`, `HISTORICAL_DOC`) across 16+ core business tables. In contrast, `CanonicalItemResolver` operates at the operational retail checkout and inventory tier, resolving user-scanned strings across optical barcodes, variant SKUs, and parent style codes within tenant context, complete with rollout cohort gating (`CohortEvaluator`) and structured legacy `products` table fallbacks. Neither system calls the other directly, and they must remain separate to preserve strict boundary isolation between enterprise identity governance and operational catalog queries.

---

## (c) Unverified or False Claims from the Prior Report

| Prior Report Claim | Independent Verification Result | Factual Status | Architectural Impact |
|---|---|---|---|
| **"22 legacy tables referencing products.id"** | `grep -rn 'ForeignKey("products.id"' backend/app/models/*.py` shows exactly **18 occurrences across 18 unique tables**. Physical database inspection on `smriti001` shows only **6 tables** have active PostgreSQL FK constraints. | **FALSE** | The prior report stated an inaccurate approximation. The exact ORM reference count is 18, and the exact physical database constraint count is 6. |
| **"StockSynchronizer is a centralized multi-writer stock consolidation layer"** | `StockSynchronizer` exists in `backend/app/services/stock_synchronizer.py`, but it is **not** an overarching multi-writer transaction consolidation gateway. Stock transaction writes (sales, purchase, GRN, transfers, PSV) remain decentralized and handled per-module. `StockSynchronizer` only recalculates the cached `products.stock` aggregate post-transaction. | **MISCHARACTERIZED** | SMRITI does not have a single unified transaction write pipeline for all stock mutations. PSV projections, sales decrements, and GRN receipts write to module-specific ledgers independently. |
| **"PartnerIdentifierResolver is the sole resolution authority"** | The established system of record for item/barcode resolution is `CanonicalItemResolver` (`canonical_resolver.py`). `PartnerIdentifierResolver` was introduced as a parallel module in `partner_resolver.py`. | **DUPLICATIVE** | Fragmented resolution paths risk divergence between POS/checkout barcode scanning and partner feed EDI ingestion. |
| **"Backend test suite collection is 100% green with 0 errors"** | `pytest -q --tb=line` aborts collection immediately with `1 error` due to a syntax error in `backend/app/tests/t_api_v1_migr.py:231` (`unterminated string literal`). Collection only proceeds when passed `--continue-on-collection-errors`. | **FALSE** | Full backend test automation is gated by pre-existing collection errors in unmaintained migration test scripts. |

---

## (d) Actual Test Numbers

### 1. Product Identity Refactor Dedicated Suite
- **File:** [`backend/tests/test_product_identity_refactor.py`](file:///F:/SMRITRretailNX/backend/tests/test_product_identity_refactor.py)  
- **Command:** `$env:PYTHONUTF8="1"; pytest backend/tests/test_product_identity_refactor.py -v`  
- **Result:** **7 passed, 9 warnings in 11.11s** (Exit code 0).  
  - `test_01_canonical_product_hierarchy_resolution` PASSED  
  - `test_02_customer_article_mapping_resolution` PASSED  
  - `test_03_tenant_isolation_cross_company_prevention` PASSED  
  - `test_04_psv_projection_with_authoritative_company_id` PASSED  
  - `test_05_psv_compound_uniqueness_enforcement` PASSED  
  - `test_06_f2_item_barcodes_lookup_dual_read` PASSED  
  - `test_07_mapped_partner_sku_projection_resolves_product` PASSED  

### 2. Universal Item Master Regression Suite
- **File:** [`backend/tests/t_univ_item.py`](file:///F:/SMRITRretailNX/backend/tests/t_univ_item.py)  
- **Command:** `$env:PYTHONUTF8="1"; pytest backend/tests/t_univ_item.py -v`  
- **Result:** **10 passed, 1 warning in 13.60s** (Exit code 0).  
  - `test_create_and_fetch_universal_item_with_variants` PASSED  
  - `test_lookup_by_barcode_canonical_item` PASSED  
  - `test_item_tenant_isolation` PASSED  
  - `test_five_bucket_inventory_resolution` PASSED  
  - `test_temporal_and_contract_governed_pricing` PASSED  
  - `test_pricing_negative_unauthorized_and_inactive_customer` PASSED  
  - `test_pricing_negative_invalid_dates_and_currency_mismatch` PASSED  
  - `test_pricing_statutory_gst_split_and_slabs` PASSED  
  - `test_five_bucket_inventory_atp_formula_enterprise_calculation` PASSED  
  - `test_committed_vs_reserved_semantic_separation_and_anti_doubling` PASSED  

### 3. Full Backend Suite Execution
- **Command:** `$env:PYTHONUTF8="1"; pytest -q --tb=line --continue-on-collection-errors`  
- **Total Test Items Collected:** **1,658 tests** across backend test suites.  
- **Collection Errors:** **1 error** (`backend/app/tests/t_api_v1_migr.py:231` syntax error in test string literal, now fixed; **0 new collection errors** appeared across the entire run).  
- **Final Execution Summary Line:** `213 failed, 913 passed, 9 skipped, 19 warnings, 525 errors in 2115.51s (0:35:15)`  
- **Total Elapsed Wall-Clock Time:** 2,115.51 seconds (35 minutes, 15 seconds).  
- **Collection Error Parity:** No new collection errors appeared beyond the single syntax error in `t_api_v1_migr.py` (which has been verified and resolved with 0 collection errors remaining).

---

## (e) Exact products.id Reference Count

### 1. SQLAlchemy ORM Model Declarations
Command executed:
```bash
grep -rn 'ForeignKey("products.id"' backend/app/models/*.py
```

**Total Occurrences:** Exactly **18 occurrences across 18 unique tables** in 8 model files:

1. [`backend/app/models/customer_po.py:58`](file:///F:/SMRITRretailNX/backend/app/models/customer_po.py#L58)  
   - Table: `customer_purchase_order_lines`  
   - Field: `product_id = Column(String(50), ForeignKey("products.id", ondelete="RESTRICT"), nullable=True, index=True)`
2. [`backend/app/models/inventory.py:110`](file:///F:/SMRITRretailNX/backend/app/models/inventory.py#L110)  
   - Table: `stock_movements`  
   - Field: `product_id = Column(String(50), ForeignKey("products.id", ondelete="RESTRICT"), nullable=False, index=True)`
3. [`backend/app/models/inventory.py:188`](file:///F:/SMRITRretailNX/backend/app/models/inventory.py#L188)  
   - Table: `product_batch_stocks`  
   - Field: `product_id = Column(String(50), ForeignKey("products.id", ondelete="RESTRICT"), nullable=False, index=True)`
4. [`backend/app/models/inventory.py:261`](file:///F:/SMRITRretailNX/backend/app/models/inventory.py#L261)  
   - Table: `stock_transfer_items`  
   - Field: `product_id = Column(String(50), ForeignKey("products.id", ondelete="RESTRICT"), nullable=False)`
5. [`backend/app/models/inventory.py:304`](file:///F:/SMRITRretailNX/backend/app/models/inventory.py#L304)  
   - Table: `stock_audit_items`  
   - Field: `product_id = Column(String(50), ForeignKey("products.id", ondelete="RESTRICT"), nullable=False)`
6. [`backend/app/models/product_identity.py:52`](file:///F:/SMRITRretailNX/backend/app/models/product_identity.py#L52)  
   - Table: `product_identities`  
   - Field: `product_id = Column(String(50), ForeignKey("products.id", ondelete="RESTRICT"), nullable=False)`
7. [`backend/app/models/profitability.py:24`](file:///F:/SMRITRretailNX/backend/app/models/profitability.py#L24)  
   - Table: `product_cost_valuations`  
   - Field: `product_id = Column(String(50), ForeignKey("products.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)`
8. [`backend/app/models/psv.py:72`](file:///F:/SMRITRretailNX/backend/app/models/psv.py#L72)  
   - Table: `psv_sku_tracking`  
   - Field: `product_id = Column(String(50), ForeignKey("products.id", ondelete="RESTRICT"), nullable=True)`
9. [`backend/app/models/psv.py:102`](file:///F:/SMRITRretailNX/backend/app/models/psv.py#L102)  
   - Table: `psv_stock_events`  
   - Field: `product_id = Column(String(50), ForeignKey("products.id", ondelete="RESTRICT"), nullable=True)`
10. [`backend/app/models/psv.py:156`](file:///F:/SMRITRretailNX/backend/app/models/psv.py#L156)  
    - Table: `psv_stock_balances`  
    - Field: `product_id = Column(String(50), ForeignKey("products.id", ondelete="RESTRICT"), nullable=True)`
11. [`backend/app/models/purchase.py:90`](file:///F:/SMRITRretailNX/backend/app/models/purchase.py#L90)  
    - Table: `purchase_order_items`  
    - Field: `product_id = Column(String(50), ForeignKey("products.id", ondelete="RESTRICT"), nullable=False)`
12. [`backend/app/models/purchase.py:135`](file:///F:/SMRITRretailNX/backend/app/models/purchase.py#L135)  
    - Table: `purchase_receipt_items`  
    - Field: `product_id = Column(String(50), ForeignKey("products.id", ondelete="RESTRICT"), nullable=False)`
13. [`backend/app/models/purchase.py:163`](file:///F:/SMRITRretailNX/backend/app/models/purchase.py#L163)  
    - Table: `purchase_reorder_configs`  
    - Field: `product_id = Column(String(50), ForeignKey("products.id", ondelete="CASCADE"), unique=True, nullable=False)`
14. [`backend/app/models/sales.py:124`](file:///F:/SMRITRretailNX/backend/app/models/sales.py#L124)  
    - Table: `sales_invoice_items`  
    - Field: `product_id = Column(String(50), ForeignKey("products.id", ondelete="RESTRICT"))`
15. [`backend/app/models/sales.py:176`](file:///F:/SMRITRretailNX/backend/app/models/sales.py#L176)  
    - Table: `sales_quotation_items`  
    - Field: `product_id = Column(String(50), ForeignKey("products.id", ondelete="RESTRICT"))`
16. [`backend/app/models/sales.py:234`](file:///F:/SMRITRretailNX/backend/app/models/sales.py#L234)  
    - Table: `sales_order_items`  
    - Field: `product_id = Column(String(50), ForeignKey("products.id", ondelete="RESTRICT"))`
17. [`backend/app/models/sales.py:318`](file:///F:/SMRITRretailNX/backend/app/models/sales.py#L318)  
    - Table: `sales_order_reservations`  
    - Field: `product_id = Column(String(50), ForeignKey("products.id", ondelete="RESTRICT"), nullable=False, index=True)`
18. [`backend/app/models/sales.py:362`](file:///F:/SMRITRretailNX/backend/app/models/sales.py#L362)  
    - Table: `sales_return_items`  
    - Field: `product_id = Column(String(50), ForeignKey("products.id", ondelete="RESTRICT"))`

### 2. Live PostgreSQL Physical Foreign Keys (`smriti001`) vs ORM Declarations
Querying `information_schema.table_constraints` joined with `information_schema.constraint_column_usage` on PostgreSQL `smriti001`:
```sql
SELECT tc.table_name, kcu.column_name, tc.constraint_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY' AND ccu.table_name = 'products' AND ccu.column_name = 'id';
```

**Total Active Physical Foreign Keys in Database:** Exactly **6 constraints across 6 tables**.

#### Open Data-Integrity Risk: 12 Missing Physical Database Constraints
There is an exact discrepancy of **18 declared vs 6 enforced** foreign keys referencing `products.id`. Exactly **12 of 18 ORM-declared `ForeignKey("products.id")` relationships have no matching physical constraint** in the PostgreSQL `smriti001` database. This represents an open data-integrity risk where application-level deletion or ID corruption cannot be prevented by the database engine for the 12 ORM-only tables.

| # | Table Name | Column Name | ORM Model File & Line | Status in DB (`smriti001`) | Constraint Name (if Enforced) |
|---|---|---|---|---|---|
| 1 | `customer_purchase_order_lines` | `product_id` | `customer_po.py:58` | **ENFORCED** | `customer_purchase_order_lines_product_id_fkey` |
| 2 | `psv_stock_balances` | `product_id` | `psv.py:156` | **ENFORCED** | `fk_psv_balances_product_id_restrict` |
| 3 | `psv_stock_events` | `product_id` | `psv.py:102` | **ENFORCED** | `fk_psv_events_product_id_restrict` |
| 4 | `sales_order_reservations` | `product_id` | `sales.py:318` | **ENFORCED** | `sales_order_reservations_product_id_fkey` |
| 5 | `stock_audit_items` | `product_id` | `inventory.py:304` | **ENFORCED** | `stock_audit_items_product_id_fkey` |
| 6 | `stock_transfer_items` | `product_id` | `inventory.py:261` | **ENFORCED** | `stock_transfer_items_product_id_fkey` |
| 7 | `stock_movements` | `product_id` | `inventory.py:110` | **ORM-ONLY** | *(Missing physical DB constraint)* |
| 8 | `product_batch_stocks` | `product_id` | `inventory.py:188` | **ORM-ONLY** | *(Missing physical DB constraint)* |
| 9 | `product_identities` | `product_id` | `product_identity.py:52` | **ORM-ONLY** | *(Missing physical DB constraint)* |
| 10 | `product_cost_valuations` | `product_id` | `profitability.py:24` | **ORM-ONLY** | *(Missing physical DB constraint)* |
| 11 | `psv_sku_tracking` | `product_id` | `psv.py:72` | **ORM-ONLY** | *(Missing physical DB constraint)* |
| 12 | `purchase_order_items` | `product_id` | `purchase.py:90` | **ORM-ONLY** | *(Missing physical DB constraint)* |
| 13 | `purchase_receipt_items` | `product_id` | `purchase.py:135` | **ORM-ONLY** | *(Missing physical DB constraint)* |
| 14 | `purchase_reorder_configs` | `product_id` | `purchase.py:163` | **ORM-ONLY** | *(Missing physical DB constraint)* |
| 15 | `sales_invoice_items` | `product_id` | `sales.py:124` | **ORM-ONLY** | *(Missing physical DB constraint)* |
| 16 | `sales_quotation_items` | `product_id` | `sales.py:176` | **ORM-ONLY** | *(Missing physical DB constraint)* |
| 17 | `sales_order_items` | `product_id` | `sales.py:234` | **ORM-ONLY** | *(Missing physical DB constraint)* |
| 18 | `sales_return_items` | `product_id` | `sales.py:362` | **ORM-ONLY** | *(Missing physical DB constraint)* |

---

## (f) Open Architecture Issues & Governance Decisions

### Open Issue: Duplicate Resolver (`partner_resolver.py` vs `canonical_resolver.py`)
`backend/app/services/partner_resolver.py` exists as a duplicate/competing resolver to `CanonicalItemResolver` (`backend/app/services/canonical_resolver.py`), created in commit `baa98b94`. 
- **Flag for Ganita:** Needs an authoritative architectural decision on which resolver is canonical before either is extended further. 
- **Constraint Policy:** Do not merge, delete, or modify either file automatically until this decision is handed down.

---

## (g) Architectural Recommendations & Freeze Decision

1. **Do NOT Freeze Architecture Based on the Prior Report:**
   The prior report contained ungrounded metrics ("22 legacy tables", full suite stability claims) and conflated `PartnerIdentifierResolver` with SMRITI's canonical resolution architecture.
2. **Resolve Open Issues Before Freeze:**
   - Resolve the duplicate resolver conflict (`partner_resolver.py` vs `canonical_resolver.py`).
   - Address the 12 missing physical foreign key constraints on `products.id`.
3. **Preserve Identity Separation:**
   Keep the Unified Identity Control Plane (`IdentityResolver` in `backend/app/services/identity/resolver.py`) completely decoupled from operational catalog/item queries (`CanonicalItemResolver`).
4. **Remediate Collection Blocker:**
   The syntax error in `backend/app/tests/t_api_v1_migr.py:231` has been cleanly fixed (quote collision in f-string on Python 3.11). Pytest collection now succeeds with 0 errors.
