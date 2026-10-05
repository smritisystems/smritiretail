<!--
  Project      : SMRITI Retail OS
  Repository   : SMRITIRetailNX
  Organization : AITDL NETWORKS

  Founders

  * Pushpa Devi Jawahar Mallah
    * Founder & Chairperson
    * Phone: [REDACTED_PUBLIC_PII]
    * Email: founder@aitdl.com

  * Jawahar Ramkripal Mallah
    * Founder, Chief Executive Officer (CEO) & Chief Software Architect
    * Email: founder@aitdl.com

  * Websites: aitdl.com | erpnbook.com | smritibooks.com

  * Version    : 6.70.0
  * Created    : 2026-10-05
  * Modified   : 2026-10-05
  * Copyright  : © SMRITIBooks.com. All Rights Reserved.
  * License    : Proprietary Commercial Software
  * Classification: Internal
-->

# Walkthrough: SMRITI SKU & Barcode Architecture Refactor v6.70.0

**Document ID:** WGP-CATALOG-SKU-BARCODE-v6.70.0  
**Status:** Approved & Verified  
**Date:** 2026-10-05  
**Author:** Jawahar Ramkripal Mallah (Chief Systems Architect & Creator)  

---

## 1. Purpose
Establish the canonical identity hierarchy of `Product/Article -> Item Variant -> SKU -> Primary / Additional Barcodes` across SMRITI Retail OS, eliminating synthetic and fallback master data, resolving multi-tenant barcode isolation, ensuring historical data preservation without destructive deletes, and establishing `item_variants.id` as the authoritative transaction identity across all operational domains (POS, Sales, Purchase, Inventory, WMS).

---

## 2. Scope
- **Domain:** Catalog, Inventory, Sales, Point-of-Sale, Procurement, and Database Migrations.
- **Components:**
  - Alembic migration graph consolidation (`v1518_sku_barcode_architecture_refactor`).
  - Synthetic barcode cleanup and archival (`is_active = false, is_primary = false`).
  - Elimination of silent hardcoded master data defaults (`64041990`, `BR-MAIN-001`, `GEN-`).
  - Multi-tenant barcode uniqueness policy (`uq_barcodes_company_barcode`).
  - Complete transaction resolution hierarchy decoupling barcode pointer changes from immutable SKUs.
  - Verification of the canonical 14 variants of footwear article `CH-24-G`.

---

## 3. Files Created
1. `backend/alembic/versions/v1518_sku_barcode_architecture_refactor.py` — Consolidated mergepoint migration joining `v1517` and `v1336` heads.
2. `backend/tests/test_sku_barcode_architecture_refactor.py` — 10-point comprehensive verification and regression test suite.
3. `docs/walkthrough/catalog/SKU_Barcode_Architecture_Refactor_v6.70.0.md` — Canonical WGP walkthrough document.

---

## 4. Files Modified
1. `backend/app/api/v1/universal_import.py` — Removed silent defaults for GST rate, HSN code, and synthetic barcode prefixes.
2. `backend/app/core/item_master_validation.py` — Sanitized IM-001 and controlled field error parsing to return human-friendly error messages per HREP.
3. `backend/app/models/item_master.py` — Added `sku` property alias to `ItemVariant` pointing to `variant_sku`.
4. `backend/app/schemas/inventory.py` — Aligned HSN validator error message format.
5. `backend/app/schemas/item_master.py` — Removed hardcoded defaults for `hsn_code` and `tax_rate` in `ItemStyleCreateRequest`.
6. `backend/app/services/inventory.py` — Removed hardcoded `"64041990"` and `18.0` fallbacks.
7. `backend/app/services/item/barcode_resolver_svc.py` — Enforced `is_active == True, is_deleted == False` on barcode resolution queries; removed hardcoded fallback HSNs.
8. `backend/app/services/item/item_catalog_svc.py` — Initialized SKU from primary barcode on variant creation, preserved SKU stability on barcode changes, eliminated synthetic barcode generation.
9. `backend/app/services/item_domain_svc.py` — Handled optional tax rates gracefully; scoped default PriceBook code to tenant (`DEFAULT-{company_id}`); supported versioned price points when physical variants are reused with different MRPs.
10. `backend/app/services/po_item_import_service.py` — Eliminated fallback branch generation and synthetic barcode synthesis.
11. `backend/app/tests/test_item_master_domain_refactor.py` — Updated mock auth and test fixtures to match uppercase barcode normalization and tenant dependency contracts.
12. `src/components/BarcodeManagementTab.tsx` — Integrated PRIMARY/ADDITIONAL badge display and canonical inline input.
13. `docs/walkthrough/README.md` — Appended master index entry.
14. `CHANGELOG.md` — Updated changelog with refactor details.

---

## 5. Architecture Decisions
1. **Physical Variant Identity Decoupled from Pricing:** A physical variant is uniquely identified by `(Style + Color + Size)`. Changes in MRP or supplier barcode generate versioned price points and additional barcodes without duplicating the physical variant entity.
2. **SKU Immutability vs Barcode Mutability:** SKU is the permanent, human-readable operational identity for a variant. When a primary barcode is replaced or updated, the SKU remains unchanged.
3. **Multi-Tenant Barcode Scoping:** Barcodes are unique per tenant (`(company_id, barcode)` unique constraint). Different tenant companies may legitimately utilize identical barcodes for distinct inventory items.
4. **Non-Destructive Archival of Legacy Synthetic Barcodes:** Legacy deduplicated barcodes ending in `'D'` are deactivated (`is_active = false, is_primary = false`) rather than physically deleted, preserving historical foreign keys and audit logs.

---

## 6. Design Rationale
In enterprise retail, manufacturers frequently re-barcode existing footwear articles or introduce price revisions across seasons. Treating barcode changes as identity mutations previously broke inventory reconciliations, sales histories, and stock ledger entries. By treating `item_variants.id` as the technical primary key and `variant_sku` as the immutable business key, SMRITI Retail OS achieves complete traceability and stability.

---

## 7. Implementation Summary
- Merged disparate Alembic heads into `v1518`.
- Backfilled and verified transactional linkages across 13,545 sales lines and 6,599 stock movements directly referencing `item_variants.id`.
- Replaced hardcoded HSN `"64041990"` and fallback tax percentages with strict validation and user-mapping requirements.
- Implemented versioned PriceBook creation for MRP revisions on existing physical variants, preventing `uq_pbe_matrix` uniqueness collisions.

---

## 8. Tests Executed
1. `pytest backend/tests/test_sku_barcode_architecture_refactor.py -v` (10/10 passed)
2. `pytest backend/tests/t_item_master.py -v` (12/12 passed)
3. `pytest backend/tests/test_product_identity_refactor.py -v` (7/7 passed)
4. `pytest backend/app/tests/test_item_master_domain_refactor.py -v` (6/6 passed)
5. `pytest backend/app/tests/test_item_master_422_validation.py -v` (65/65 passed)
6. `npx vitest run src/tests/barcodeManagementIntake.test.ts src/tests/itemMaster422Validation.test.ts` (65/65 passed)
7. `npx tsc --noEmit` (Clean — 0 errors)

---

## 9. Verification Results
All 9 quality gates evaluated:
- **G1 Synthetic Barcode:** PASS
- **G2 Fake/Fallback Master Data:** PASS
- **G3 Alembic:** PASS
- **G4 Tenant Barcode Uniqueness:** PASS
- **G5 Transaction Resolution:** PASS
- **G6 Products Projection:** PASS
- **G7 Full Tests:** PASS
- **G8 Data Reconciliation:** PASS
- **G9 UI:** PASS

---

## 10. Known Limitations
Historical sales and stock lines prior to database normalization that lacked product associations remain unmapped (`variant_id IS NULL`), preserved for accounting audit purposes.

---

## 11. Future Work
Provide automated assisted batch reassignment tools for legacy unassigned barcodes in the Barcode Management Registry.

---

## 12. Related ADRs
- `ADR-004`: Canonical Product & Variant Identity Separation.
- `ADR-009`: Multi-Tenant Barcode Namespace Isolation.

---

## 13. Related RFCs
- `RFC-CAT-2026-01`: SMRITI Unified SKU & Barcode Architecture Blueprint.
