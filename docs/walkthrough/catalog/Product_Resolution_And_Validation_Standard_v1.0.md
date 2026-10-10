<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 1.0.0
  Created      : 2026-10-03
  Modified     : 2026-10-03
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Walkthrough Governance Document
-->

# Walkthrough: SMRITI Global Product Resolution & Validation Standard v1.0

## 1. Purpose
This document records the architectural unification, implementation, and rigorous verification of the **SMRITI Global Product Resolution & Validation Standard** across SMRITI Retail OS. Prior to this work, product lookup was fragmented across 7 disparate resolvers (universal resolver, barcode search, direct catalog fetch, legacy SKU lookups, etc.), each implementing conflicting fallback behaviors, leaking ad-hoc dummy SKUs (`SKU-GEN`, auto-generated UUID dummy products in purchase orders), and permitting unvalidated items to enter commercial and warehouse transactions.

The objective was to replace all ad-hoc lookup logic with a single, authoritative, centralized Product Resolution Service used across all transaction surfaces, with atomic multi-line validation, strict multi-tenant boundary isolation, zero phantom product provisioning, and full compliance with the SMRITI Human-Readable Error Policy (HREP).

---

## 2. Scope
1. **Authoritative Single Point of Product Identity:**
   - Universal Resolution Gateway with priority: `Product ID` (Canonical `item_id`/`variant_id` or Legacy `product_id`) → `Barcode` (`item_barcodes` primary/secondary) → `SKU` (`item_variants.variant_sku` or `products.code`).
2. **Dual-Catalog Unification & Legacy Bridging:**
   - Canonical Item Master (`items`, `item_variants`, `item_barcodes`) as primary system of record.
   - Legacy Retail Catalog (`products`) as fallback with bidirectional cross-referencing via `legacy_id_mappings`.
3. **Transactional Safeguards & Atomic Rollback:**
   - Atomic multi-line validation (`validate_transaction_lines`, `enforce_transaction_lines`). If 1 line out of N fails resolution or validation, the entire transaction is rejected and rolled back.
   - Elimination of rogue auto-provisioning in `purchase.py` and rogue `"SKU-GEN"` dummy fallbacks in `BillingTerm.tsx`.
4. **Tenant Isolation & Security:**
   - Strict `company_id` enforcement. Tenant B cannot query or transact Tenant A's private items. Master catalog items (`company_id IS NULL`) remain globally readable.
5. **Human-Readable Error Policy (HREP):**
   - Standardized error codes: `PRODUCT_NOT_FOUND`, `PRODUCT_INACTIVE`, `PRODUCT_QUARANTINED`, `TRANSACTION_PRODUCT_RESOLUTION_FAILED`.
   - Clear Title, Explanation, and Suggested Action guidance without technical jargon or stack traces.
6. **Frontend Experience:**
   - `BillingTerm.tsx` integrated with `/api/v1/products/resolve`.
   - `productNotFoundState` modal with RBAC `[ Add Product ]` (authorized for SYSADMIN, ADMIN, MANAGER, STORE_MANAGER) and `[ Scan Again ]`.
   - `productInactiveState` modal for inactive or quarantined items.

---

## 3. Files Created
1. `backend/app/schemas/product_resolution.py`: Pydantic V2 contracts defining `ProductResolutionResult`, `ProductResolutionErrorDetail`, `TransactionLineItemInput`, and `TransactionValidationResult`.
2. `backend/app/services/product_resolution_service.py`: Centralized resolution and validation engine with caching, multi-tenant SQL queries, quarantine detection, and audit logging to `CanonicalTelemetrySink`.
3. `backend/app/api/v1/product_resolution.py`: REST API endpoints `/api/v1/products/resolve` (GET/POST) and `/api/v1/products/validate-lines` (POST).
4. `backend/tests/test_global_product_resolution.py`: Comprehensive test suite testing canonical resolution, legacy fallback, unknown product rejection, inactive/quarantined handling, tenant isolation, atomic transaction validation, and REST API contracts.
5. `docs/walkthrough/catalog/Product_Resolution_And_Validation_Standard_v1.0.md`: This governance walkthrough document.

---

## 4. Files Modified
1. `backend/app/api/v1/__init__.py`: Registered and mounted `product_resolution_router`.
2. `backend/app/main.py`: Mounted product resolution router in root FastAPI application.
3. `backend/app/services/billing_catalog_service.py`: Replaced ad-hoc product query with `ProductResolutionService.resolve()`.
4. `backend/app/api/v1/billing.py`: Updated `/billing/scan/{barcode}` to use `ProductResolutionService`.
5. `backend/app/services/purchase.py`: Completely eradicated rogue product auto-creation; enforced `ProductResolutionService.validate_line()` raising `PRODUCT_NOT_FOUND`.
6. `backend/app/services/headless_billing.py`: Integrated atomic line enforcement via `ProductResolutionService.enforce_transaction_lines()`.
7. `backend/app/api/v1/grn.py`: Integrated atomic line enforcement in Goods Receipt Notes.
8. `backend/app/services/inventory_wms.py`: Integrated atomic line enforcement in WMS stock transfers.
9. `backend/app/services/barcodes_engine.py`: Integrated item validation prior to spooling barcode labels.
10. `src/components/billing/BillingTerm.tsx`: Replaced `"SKU-GEN"` fallback with async `/api/v1/products/resolve` validation, added `productNotFoundState` and `productInactiveState` dialogs with role-gated `[ Add Product ]` and `[ Scan Again ]`.

---

## 5. Architecture Decisions
1. **Decision ADR-CAT-001 (Priority-Based Resolution Cascade):**
   Product resolution resolves with priority: Product ID → Barcode → SKU. This prevents collisions where a barcode could match an unintended SKU.
2. **Decision ADR-CAT-002 (Canonical First, Legacy Second):**
   Canonical Item Master tables (`items`, `item_variants`, `item_barcodes`) are always evaluated first. If no match is found, legacy `products` is queried. Results from legacy are mapped to canonical structures using `legacy_id_mappings`.
3. **Decision ADR-CAT-003 (Strict Transaction Rollback):**
   No commercial document (Sales Invoice, Credit Bill, Purchase Order, GRN, Stock Transfer) may be saved or committed if any single item identifier cannot be authoritatively resolved.
4. **Decision ADR-CAT-004 (Eradication of Phantom Auto-Provisioning):**
   Modules must never insert dummy items on the fly to satisfy foreign key constraints. If a supplier sends an unmapped barcode or an unknown SKU, the transaction must fail with explicit business remediation steps.

---

## 6. Design Rationale
- **Single Source of Truth:** Centralizing all resolution in `ProductResolutionService` prevents subtle pricing, tax, or HSN mismatches across billing, purchase, and warehouse operations.
- **Tenant Security:** Multi-tenant boundaries must be enforced at the SQL query level, not in client memory. Passing `company_id` into every resolution prevents cross-tenant data leakage.
- **HREP Compliance:** End users (cashiers, store managers, warehouse staff) must never see database error codes or stack traces. The `ProductResolutionErrorDetail` schema returns actionable instructions.

---

## 7. Implementation Summary
- Implemented `ProductResolutionService` featuring:
  - `resolve_by_product_id()`, `resolve_by_barcode()`, `resolve_by_sku()`, and universal `resolve()`.
  - `validate_line()` and `validate_transaction_lines()` returning atomic boolean status and granular errors.
  - `enforce_transaction_lines()` raising standard FastAPI `HTTPException(400)` with full HREP payload.
- Registered endpoints under `/api/v1/products/`:
  - `POST /api/v1/products/resolve`
  - `GET /api/v1/products/resolve`
  - `POST /api/v1/products/validate-lines`
- Refactored 6 transactional modules to consume the new service.
- Refactored frontend `BillingTerm.tsx` to eliminate `"SKU-GEN"` and present unified error modals.

---

## 8. Tests Executed
1. `test_01_resolve_valid_canonical_hierarchy`: Canonical Product ID, SKU, and Barcode resolution with MRP, Selling Price, and UoM integrity.
2. `test_02_resolve_legacy_fallback`: Fallback to legacy `products` table when not in canonical tables.
3. `test_03_unknown_product_rejection`: Unregistered Barcode, SKU, or Product ID returns `PRODUCT_NOT_FOUND`.
4. `test_04_inactive_product_rejection`: Inactive item returns `PRODUCT_INACTIVE`.
5. `test_05_quarantined_product_rejection`: Quarantined item (`status="REQUIRES_REVIEW"`) returns `PRODUCT_QUARANTINED`.
6. `test_06_tenant_isolation`: Tenant B cannot resolve Tenant A's private product; shared catalog accessible by both.
7. `test_07_transaction_lines_atomicity`: Multi-line transaction atomicity (all valid passes; 1 invalid line rejects 100%).
8. `test_08_api_product_resolution_endpoints`: Live FastAPI endpoint tests for `/resolve`, `/validate-lines`, and `/billing/scan/{barcode}`.

---

## 9. Verification Results
- **Pytest Execution Output:** 8/8 tests passed green.
- **Frontend Typecheck (`npx tsc --noEmit`):** 0 errors.
- **Evidence Level:** Level A (Direct terminal verification and literal git diffs).

---

## 10. Known Limitations
- Master catalog shared items (`company_id IS NULL`) are readable across all companies by design. If a company overrides a shared item with a custom price book, the company-specific price takes precedence.

---

## 11. Future Work
- Cache hot barcodes in Redis / in-memory LRU for sub-millisecond barcode scan responses in high-throughput POS terminals.
- Integrate OCR scan resolution into `ProductResolutionService` for physical barcode label verification.

---

## 12. Related ADRs
- `ADR-004`: Database Schema Unification & Multi-Tenant Separation
- `ADR-CAT-001`: Canonical Product Hierarchy & Identity Standard
- `ADR-CAT-002`: Deprecation of Rogue SKU Generation in Transactions

---

## 13. Related RFCs
- `RFC-2026-09`: Universal Item Master & Partner Resolution Specification
- `RFC-2026-10`: Global Product Resolution & Validation Standard
