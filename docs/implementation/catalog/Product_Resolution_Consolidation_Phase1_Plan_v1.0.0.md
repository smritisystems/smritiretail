<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 1.0.0
  Created      : 2026-10-07
  Modified     : 2026-10-07
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal Architecture
-->

# SMRITI Product Resolution Consolidation Phase 1 — Implementation Plan

## 1. Objective
Establish `ProductResolutionService` as the single authoritative item and barcode/SKU resolution engine across all transactional and inquiry entry points in SMRITI Retail OS under **Option B (Dual-Key Transitional Architecture)** without modifying database schemas, altering historical transactions, or breaking legacy API response contracts.

## 2. Business Motivation
SMRITI previously had three parallel resolvers (`ProductResolutionService`, `UniversalSearchEngine.quick_barcode_scan`, and `UniversalItemMasterService.resolve_item_by_barcode_or_sku`), alongside raw SQL lookups in `StockAuditService`. This duplication risked inconsistent pricing, stock lookup failures, and transaction rollbacks during inventory scans. Consolidating all resolution pathways into `ProductResolutionService` establishes uniform barcode and SKU resolution while preserving backward compatibility for live sales workflows (`DistTaxInvoice.tsx`, POS, WMS).

## 3. Scope
1. **Pre-Implementation Gate**: Fix test fixture in `backend/tests/test_global_product_resolution.py` (`test_06_tenant_isolation`) without weakening the production `NOT NULL` constraint on `item_warehouse_locations.company_id`. Achieve 13/13 green tests across resolution suites.
2. **Scanner API (`/api/v1/search/barcode-scan`)**: Internally delegate to `ProductResolutionService.resolve()`, preserving `BarcodeQuickScanResponse` schema contract.
3. **Universal Master API (`/api/v1/universal/items/resolve`)**: Internally delegate to `ProductResolutionService.resolve()` with fallback to `UniversalItemMasterService`.
4. **Stock Audit Service (`StockAuditService.scan_barcode_increment`)**: Remove raw `products` SQL query and resolve via `ProductResolutionService.resolve()`.
5. **No Schema Alterations**: Zero database migrations, zero column alterations, zero historical backfills.

## 4. Current State
- Primary tenant `COMP-001` has 799 of 800 products (99.88%) linked to canonical `items` and `item_variants`.
- Disconnected resolvers allowed subtle SQL transaction aborts (`InFailedSQLTransactionError`) in legacy search tiers.
- `StockAuditService` queried `products` directly, bypassing the canonical item master hierarchy.

## 5. Gap Analysis
- `UniversalSearchEngine.quick_barcode_scan` previously iterated over non-product tables via `IdentityResolver`, failing when unmapped tables caused transaction aborts.
- `universal_master.py` resolved items using `UniversalItemMasterService`, leaving `ProductResolutionService` disconnected from canonical master lookups.
- `StockAuditService` used raw SQL on `products` table, missing newly registered canonical variants lacking legacy product rows.

## 6. Architecture Impact
- **Transitional Alignment**: Option B (Dual-Key Transitional Architecture) is activated:
  ```text
                  USER INPUT
               Barcode / SKU / Code
                      │
                      ▼
         ProductResolutionService
                      │
            ┌─────────┼─────────┐
            ▼         ▼         ▼
         item_id   variant_id  product_id
            │         │         │
            └─────────┼─────────┘
                      ▼
                TRANSACTION
  ```
- **Interface Stability**: External API URLs, HTTP methods, parameters, and response schemas remain 100% stable.

## 7. Proposed Design
- Internal delegation pattern: Legacy resolver functions are maintained as facades calling `ProductResolutionService.resolve()`.
- Adapters map `ProductResolutionResult` to target response models (`BarcodeQuickScanResponse`, `ItemResolutionResponse`, `StockAuditItem` increment payload).

## 8. Files Created
- `docs/implementation/catalog/Product_Resolution_Consolidation_Phase1_Plan_v1.0.0.md` (This document)
- `docs/walkthrough/catalog/Product_Resolution_Consolidation_Phase1_v1.0.0.md`

## 9. Files Modified
- `backend/tests/test_global_product_resolution.py`
- `backend/app/api/v1/search.py`
- `backend/app/services/search_engine.py`
- `backend/app/api/v1/universal_master.py`
- `backend/app/services/stock_audit_service.py`
- `docs/implementation/README.md`
- `docs/walkthrough/README.md`
- `CHANGELOG.md`

## 10. Dependencies
- FastAPI 0.111+
- SQLAlchemy 2.0+ (asyncpg)
- PostgreSQL 16+
- SMRITI Core Cohort & Telemetry modules

## 11. Risks
- Risk: Breaking `DistTaxInvoice.tsx` if response schema changes.  
  Mitigation: `BarcodeQuickScanResponse` preserved with exact field parity.
- Risk: Secondary barcode misses in stock audit counting.  
  Mitigation: `ProductResolutionService._query_legacy` natively supports `secondary_barcodes` array.

## 12. Rollback Strategy
Git revert of the 5 modified Python files returns the system to individual resolver implementations with zero database rollback needed.

## 13. Verification Plan
- Run automated test suite across resolution, WMS, item master, and search endpoints.
- Verify 100% test pass rate with literal console output.
- Verify Version SSOT validator output.

## 14. Test Plan
- `backend/tests/test_global_product_resolution.py` (8 tests)
- `backend/tests/test_batch_product_resolution.py` (5 tests)
- `backend/tests/t_wms_phase4.py` (6 tests)
- `backend/tests/t_item_master.py` (12 tests)
- `backend/tests/t_search.py` (2 targeted tests)
Total: 33 tests.

## 15. Documentation Impact
- Update `docs/implementation/README.md`
- Update `docs/walkthrough/README.md`
- Update `CHANGELOG.md`

## 16. Deployment Plan
- Pure code deployment; no database migrations or schema adjustments required.

## 17. Status
**Completed**

## 18. Related ADRs
- `ADR-0042: SMRITI Global Product Identity & Resolution Architecture Standard`
- `Option B: Dual-Key Transitional Architecture Specification`

## 19. Related Walkthroughs
- `docs/walkthrough/catalog/Product_Resolution_Consolidation_Phase1_v1.0.0.md`
- `docs/walkthrough/catalog/Product_Resolution_And_Validation_Standard_v1.0.md`
