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
  Classification: Internal
-->

# SMRITI Product Identity & Identifier Architecture Refactor Walkthrough

**Walkthrough ID:** WGP-INV-ID-REFACTOR-v1.0.0  
**Area:** Inventory & Master Data Architecture  
**Status:** Completed & Verified  

---

## 1. Purpose

Document the comprehensive audit, architectural design, database migration, and verification of the **Product Identity & Identifier Architecture Refactor** across SMRITI Retail OS.

This refactor enforces strict separation among five distinct identifier dimensions:
1. **Internal Canonical Identity:** (`products.id`, `items.id`, `item_variants.id`) — permanent system surrogate keys that remain immutable and are never replaced globally.
2. **Business SKU Identity:** (`items.item_code`, `item_variants.variant_sku`, `products.sku`) — company-scoped human-readable article codes and variant SKUs.
3. **Barcode / Scanning Identity:** (`item_barcodes`, `products.barcode`, `secondary_barcodes`) — optical GTIN/EAN/UPC barcodes mapping 1:N to physical variants.
4. **Tenant / Company Identity:** (`company_id -> companies.id`) — strict tenant boundaries guaranteeing complete multi-tenant partition safety.
5. **Partner / External Identifiers:** (`customer_article_mappings`, `ecom_sku_mappings`, third-party partner SKUs in PSV) — decoupled cross-reference registries allowing external B2B and marketplace ingestion without polluting the core master catalog.

---

## 2. Scope

1. **Forensic Database & Schema Audit:**
   - Evaluated 244 catalog, inventory, and transactional tables in PostgreSQL tenant database `smriti001`.
   - Identified and audited 1,124 optical barcode records in `item_barcodes` and 451 buyer cross-reference records in `customer_article_mappings`.
   - Discovered that 100/100 partner SKUs in `psv_stock_balances` (`SKU-PSV-173F`, `SKU-A-0047E4`, etc.) are third-party external codes that must not enforce `product_id NOT NULL`.
   - Detected exactly 1 unreferenced test duplicate code (`IMMUTABLE-86A1E8`) where `company_id IS NULL`, safely soft-deleting `itm_8e5e3af6d51a` to achieve 0 duplicate codes across all tables.

2. **Alembic Database Migration `v1494_product_identity_psv_tenant_hardening.py`:**
   - Deployed compound unique constraint `uq_psv_stock_balances_company_party_sku` on `psv_stock_balances(company_id, psv_party_id, sku)` to guarantee balance projection uniqueness per tenant and partner party.
   - Deployed high-speed index on `item_barcodes(company_id, barcode_normalized)`.
   - Deployed partial unique index on `item_barcodes(company_id, variant_id)` WHERE `is_primary = true`.
   - Deployed foreign key index on `purchase_order_items(company_id, variant_id)`.
   - Deployed variant lookup index on `sales_invoice_items(variant_id)` adhering to the ADR-DB-006 parent-join tenant isolation architecture.

3. **Decoupled Partner Identifier Resolver (`backend/app/services/partner_resolver.py`):**
   - Engineered the canonical 5-tier resolution engine `PartnerIdentifierResolver`:
     - **Tier 1:** `CustomerArticleMapping` (Buyer-specific article code cross-reference).
     - **Tier 2:** `EcomSkuMapping` (E-commerce / marketplace channel SKU cross-reference).
     - **Tier 3:** `SmritiIdentityAlias` (General external alias mapping).
     - **Tier 4:** `ItemBarcode` (Direct optical barcode scan resolution).
     - **Tier 4B:** `ItemVariant` & `Item` (Direct internal SKU lookup).
     - **Tier 5:** `Product` (Legacy master catalog fallback).

4. **PSV Projection Engine Hardening (`backend/app/services/psv_projection.py`):**
   - Injected authoritative `company_id` onto all projected `PSVStockEvent` and `PSVStockBalance` records.
   - Integrated `PartnerIdentifierResolver` during event ingestion: if a partner SKU resolves to an internal product, `reconciliation_status` is marked `'AUTO_MATCHED'`; if unmapped, ingestion succeeds cleanly with status `'PENDING_CATALOG_MAPPING'` without throwing exceptions.
   - Supported `RECEIVED_AT_STORE` movement type.

5. **Master Lookup F2 Dual-Read Adapter (`backend/app/api/v1/master_lookup.py`):**
   - Upgraded `/api/v1/item-barcodes` endpoint to query canonical `item_barcodes` table with fallback to `Product` table, delivering seamless backward compatibility for POS and warehouse scanners.

6. **Automated Verification Test Suite:**
   - Authored `backend/tests/test_product_identity_refactor.py` covering canonical product hierarchy resolution, customer article mapping, cross-company isolation, PSV projection, compound uniqueness, and F2 barcode dual-read.

---

## 3. Files Created

1. `backend/alembic/versions/v1494_product_identity_psv_tenant_hardening.py` — Database migration adding compound uniqueness, optical barcode indexing, and transactional FK indexes.
2. `backend/app/services/partner_resolver.py` — Decoupled 5-tier partner and scanner resolution engine.
3. `backend/tests/test_product_identity_refactor.py` — Automated verification test suite (7/7 tests green).
4. `docs/architecture/Product_Identity_Audit.md` — Complete forensic baseline audit report.
5. `docs/architecture/Product_Identity_Refactor_Plan.md` — Target architecture and zero-downtime execution plan.
6. `docs/architecture/Product_Identity_Dependency_Matrix.md` — Cross-table dependency and query surface matrix.
7. `docs/architecture/Product_Identity_Data_Mapping_Report.md` — In-depth mapping analysis of partner feeds, barcodes, and mappings.
8. `docs/architecture/preflight_identity_checks.sql` — Pre-flight SQL assertions validating zero data anomalies.
9. `docs/walkthrough/inventory/Product_Identity_Refactor_v1.0.0.md` — This walkthrough document.

---

## 4. Files Modified

1. `backend/app/models/psv.py` — Aligned ORM models with `company_id` and unique constraint `uq_psv_stock_balances_company_party_sku`.
2. `backend/app/services/psv_projection.py` — Injected authoritative tenant scoping, partner resolution, and graceful unmapped status handling.
3. `backend/app/api/v1/master_lookup.py` — Upgraded item-barcodes lookup to dual-read canonical `item_barcodes`.
4. `docs/walkthrough/README.md` — Chronologically appended walkthrough entry to the master index.
5. `CHANGELOG.md` — Added changelog release entry documenting architecture refactor.

---

## 5. Architecture Decisions

- **ADR-ID-001: Five-Tier Identifier Separation**  
  Internal database surrogate keys (`products.id`, `items.id`, `item_variants.id`) must never be overloaded as business SKUs or barcodes. Barcodes represent optical scanning symbols that map 1:N to physical variants. Partner/buyer identifiers belong in dedicated cross-reference tables (`customer_article_mappings`), keeping internal catalogs clean.

- **ADR-ID-002: Decoupled Partner SKU Ingestion in PSV**  
  External EDI and partner feeds ingest third-party identifiers that do not initially exist in the internal product catalog. `psv_stock_balances.product_id` must remain nullable to permit raw partner ingestion. Unmapped SKUs are assigned `reconciliation_status = 'PENDING_CATALOG_MAPPING'` rather than aborting ingestion.

- **ADR-ID-003: High-Selectivity Multi-Tenant Optical Barcode Indexing**  
  To support sub-5ms POS and GRN barcode scanning across millions of items, `item_barcodes` is indexed on `(company_id, barcode_normalized)`. Unique primary barcodes are enforced via partial index on `(company_id, variant_id)` WHERE `is_primary = true`.

- **ADR-DB-006: Child Table Tenant Isolation via Parent-Join Inheritance**  
  Transactional line items (e.g. `sales_invoice_items`, `purchase_order_items`) inherit multi-tenant security from their parent documents via foreign keys. Indexes on child lines are placed on target foreign keys (`variant_id`), avoiding redundant tenant column duplication.

---

## 6. Design Rationale

Prior to this refactor, partner ingestion and barcode lookups risked tight coupling to internal surrogate IDs, creating failures when third-party B2B partners submitted external article numbers or when legacy scanner lookups queried deprecated tables. By introducing `PartnerIdentifierResolver` and hardening `psv_projection.py` with multi-tenant company scoping and dual-read master lookup adapters, the system achieves zero-downtime compatibility while guaranteeing strict multi-tenant data boundaries.

---

## 7. Implementation Summary

1. Executed read-only forensic audit across 244 catalog tables in `smriti001`.
2. Developed and executed preflight verification script (`docs/architecture/preflight_identity_checks.sql` and `scratch/preflight_identity_check.py`), confirming 0 active duplicate codes.
3. Formulated and reviewed the Architecture Refactor Plan and Dependency Matrix.
4. Created Alembic migration `v1494_product_identity_psv_tenant_hardening.py` adding compound unique constraints, barcode lookup indexes, and transaction variant indexes.
5. Executed migration against tenant database `smriti001`:
   ```powershell
   F:\SMRITRretailNX\.venv\Scripts\python.exe -m alembic -x target=tenant -x db=smriti001 upgrade head
   ```
6. Engineered `PartnerIdentifierResolver` in `backend/app/services/partner_resolver.py`.
7. Hardened `PSVProjectionService` in `backend/app/services/psv_projection.py` to write `company_id` and resolve partner SKUs.
8. Enhanced `/api/v1/item-barcodes` in `backend/app/api/v1/master_lookup.py` to support canonical `item_barcodes` with fallback.
9. Validated test suite `backend/tests/test_product_identity_refactor.py` and regression suite `backend/tests/t_univ_item.py`.

---

## 8. Tests Executed

### Test 1: Automated Verification Test Suite
```powershell
F:\SMRITRretailNX\.venv\Scripts\python.exe -m pytest backend/tests/test_product_identity_refactor.py -v
```

**Literal Test Output:**
```text
============================= test session starts =============================
platform win32 -- Python 3.11.9, pytest-8.2.1, pluggy-1.6.0 -- F:\SMRITRretailNX\.venv\Scripts\python.exe
cachedir: .pytest_cache
rootdir: F:\SMRITRretailNX\backend
configfile: pyproject.toml
plugins: anyio-4.15.1, asyncio-0.23.7, cov-5.0.0
asyncio: mode=Mode.AUTO
collecting ... collected 7 items

backend\tests\test_product_identity_refactor.py::test_01_canonical_product_hierarchy_resolution PASSED [ 14%]
backend\tests\test_product_identity_refactor.py::test_02_customer_article_mapping_resolution PASSED [ 28%]
backend\tests\test_product_identity_refactor.py::test_03_tenant_isolation_cross_company_prevention PASSED [ 42%]
backend\tests\test_product_identity_refactor.py::test_04_psv_projection_with_authoritative_company_id PASSED [ 57%]
backend\tests\test_product_identity_refactor.py::test_05_psv_compound_uniqueness_enforcement PASSED [ 71%]
backend\tests\test_product_identity_refactor.py::test_06_f2_item_barcodes_lookup_dual_read PASSED [ 85%]
backend\tests\test_product_identity_refactor.py::test_07_mapped_partner_sku_projection_resolves_product PASSED [100%]

======================= 7 passed, 9 warnings in 12.15s ========================
```

### Test 2: Universal Item Master Regression Test Suite
```powershell
F:\SMRITRretailNX\.venv\Scripts\python.exe -m pytest backend/tests/t_univ_item.py -v
```

**Literal Test Output:**
```text
============================= test session starts =============================
platform win32 -- Python 3.11.9, pytest-8.2.1, pluggy-1.6.0 -- F:\SMRITRretailNX\.venv\Scripts\python.exe
cachedir: .pytest_cache
rootdir: F:\SMRITRretailNX\backend
configfile: pyproject.toml
plugins: anyio-4.15.1, asyncio-0.23.7, cov-5.0.0
asyncio: mode=Mode.AUTO
collecting ... collected 10 items

backend\tests\t_univ_item.py::test_create_and_fetch_universal_item_with_variants PASSED [ 10%]
backend\tests\t_univ_item.py::test_lookup_by_barcode_canonical_item PASSED [ 20%]
backend\tests\t_univ_item.py::test_item_tenant_isolation PASSED          [ 30%]
backend\tests\t_univ_item.py::test_five_bucket_inventory_resolution PASSED [ 40%]
backend\tests\t_univ_item.py::test_temporal_and_contract_governed_pricing PASSED [ 50%]
backend\tests\t_univ_item.py::test_pricing_negative_unauthorized_and_inactive_customer PASSED [ 60%]
backend\tests\t_univ_item.py::test_pricing_negative_invalid_dates_and_currency_mismatch PASSED [ 70%]
backend\tests\t_univ_item.py::test_pricing_statutory_gst_split_and_slabs PASSED [ 80%]
backend\tests\t_univ_item.py::test_five_bucket_inventory_atp_formula_enterprise_calculation PASSED [ 90%]
backend\tests\t_univ_item.py::test_committed_vs_reserved_semantic_separation_and_anti_doubling PASSED [100%]

======================= 10 passed, 1 warning in 13.39s ========================
```

---

## 9. Verification Results

### Evidence
- 7/7 automated verification tests in `backend/tests/test_product_identity_refactor.py` passed with exit code 0.
- 10/10 regression tests in `backend/tests/t_univ_item.py` passed with exit code 0.
- Migration `v1494_product_identity_psv_tenant_hardening` successfully applied to tenant database `smriti001`.
- Compound unique constraint `uq_psv_stock_balances_company_party_sku` active in PostgreSQL catalog.
- Preflight script verified 0 active duplicate item codes across the tenant database.

### Interpretation
The empirical evidence proves that:
1. Canonical identity (`products.id`, `item_variants.id`) remains strictly separated from business SKUs, optical barcodes, and external partner identifiers.
2. The 5-tier `PartnerIdentifierResolver` accurately resolves customer article mappings, e-com SKUs, optical barcodes, and internal variants while preserving tenant isolation.
3. Third-party partner SKUs can be ingested into PSV balances without requiring unmapped records to reference internal product keys, eliminating ingestion blockage.
4. Duplicate projections for the same tenant, partner party, and SKU are strictly prevented at the PostgreSQL storage layer via compound uniqueness.

### Recommendation
Proceed with phased monitoring of PSV ingest feeds in production. In the subsequent Contract phase, legacy dual-write bridges to `Product` can be systematically retired once all upstream clients query `/api/v1/items` and `/api/v1/item-barcodes` exclusively.

---

## 10. Known Limitations

- `products.id` is retained as a legacy dual-write bridge because 22 older database tables reference it. It will be fully retired in subsequent phases as all foreign keys point to `item_variants.id`.
- Unmapped partner SKUs in `psv_stock_balances` remain in `reconciliation_status = 'PENDING_CATALOG_MAPPING'` until a matching entry is registered in `customer_article_mappings` or `ecom_sku_mappings`.

---

## 11. Future Work

- Contract Phase: Transition legacy `products` references in batch tables and transfer headers to `item_variants.id`.
- Partner Feed UI: Implement an operator dashboard in SMRITI Retail OS to review and approve `PENDING_CATALOG_MAPPING` records into `customer_article_mappings`.

---

## 12. Related ADRs

- ADR-ID-001: Five-Tier Product Identifier Separation
- ADR-ID-002: Decoupled Partner SKU Ingestion in PSV
- ADR-ID-003: High-Selectivity Multi-Tenant Optical Barcode Indexing
- ADR-DB-003: Multi-Tenant Column Standardization (`company_id`)
- ADR-DB-006: Child Table Tenant Isolation via Parent-Join Inheritance

---

## 13. Related RFCs

- RFC-ID-001: SMRITI Retail OS Canonical Product and Partner Identifier Architecture
- RFC-DB-001: SMRITI Multi-Tenant Schema Consolidation & Immutability Standard
