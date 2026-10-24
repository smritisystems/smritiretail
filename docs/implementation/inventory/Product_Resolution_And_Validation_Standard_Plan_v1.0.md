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
  Classification: Implementation Plan Governance Document
-->

# Implementation Plan: SMRITI Global Product Resolution & Validation Standard v1.0

## 1. Objective
Establish a centralized, authoritative, and reusable Product Resolution & Validation Service (`ProductResolutionService`) across all transactional domains in SMRITI Retail OS. Guarantee that whenever any commercial or warehouse transaction attempts to identify a product via Barcode, SKU, Product ID, or Item Code, the identifier is validated against the authoritative canonical Item Master (with seamless fallback to legacy catalog) before the transaction is permitted to proceed.

## 2. Business Motivation
In retail operations, inconsistent product resolution leads to inventory leaks, mismatched pricing, tax/HSN discrepancies, and fraudulent transactions. Fragmented lookup logic in billing, purchase orders, goods receipts, and warehouse transfers created multiple points of failure. Furthermore, dangerous fallback patterns (such as generating placeholder `"SKU-GEN"` items or auto-provisioning random dummy products in purchase orders) polluted the master catalog with invalid data and created discrepancies in accounting and inventory ledgers. Centralizing product identity resolution ensures single-point governance, audited telemetric traces, and zero catalog corruption.

## 3. Scope
1. **Central Service Architecture:** Single authoritative service `ProductResolutionService` managing priority cascade resolution (Product ID -> Barcode -> SKU).
2. **Dual-Catalog Parity:** Canonical Item Master (`items`, `item_variants`, `item_barcodes`) as primary, legacy (`products`) as fallback with bidirectional cross-referencing.
3. **Multi-Tenant Isolation:** Enforcing `company_id` matching for tenant-private items while allowing global master catalog items (`company_id IS NULL`).
4. **Transaction Atomicity:** Multi-line validation (`validate_transaction_lines`, `enforce_transaction_lines`) requiring 100% of line items to be valid, active, and unquarantined, or rolling back the entire transaction.
5. **Rogue Provisioning Eradication:** Complete removal of ad-hoc dummy product creation in purchase orders and `"SKU-GEN"` dummy items in POS billing.
6. **HREP Error Handling:** Unified structured error contracts (`PRODUCT_NOT_FOUND`, `PRODUCT_INACTIVE`, `PRODUCT_QUARANTINED`, `TRANSACTION_PRODUCT_RESOLUTION_FAILED`) with actionable business remediation steps.
7. **Frontend Experience:** POS Cashier modal states in `BillingTerm.tsx` for `productNotFoundState` (with RBAC `[ Add Product ]` and `[ Scan Again ]`) and `productInactiveState`.

## 4. Current State
- Prior to this implementation, product lookups were implemented separately in at least 7 locations:
  - `billing_catalog_service.py` (`get_product_by_barcode`) querying legacy `products`.
  - `purchase.py` auto-creating dummy `Product` rows with `uuid.uuid4()` if an unmapped SKU was submitted.
  - `BillingTerm.tsx` creating fake `"SKU-GEN"` line items on unrecognized barcodes.
  - `headless_billing.py` querying `products` directly without canonical table awareness.
  - `grn.py` lacking multi-line pre-validation before creating stock entries.
  - `inventory_wms.py` doing partial item lookups.
  - `barcodes_engine.py` spooling labels without validating whether items are active or quarantined.

## 5. Gap Analysis
| Domain / Module | Previous Defect / Vulnerability | Remediation in v1.0 |
|---|---|---|
| **Lookup Consistency** | Inconsistent priority between barcode vs SKU across modules | Unified priority: Product ID -> Barcode -> SKU in `ProductResolutionService` |
| **Catalog Hierarchy** | Some services only queried `products`, missing canonical `item_variants` | Canonical hierarchy queried first, legacy queried second with translation |
| **Data Integrity** | Purchase orders auto-created dummy products for unmapped items | Rogue auto-creation eradicated; raises `PRODUCT_NOT_FOUND` |
| **POS Fallback** | Unrecognized barcode generated dummy item `"SKU-GEN"` | Eradicated; invokes `/api/v1/products/resolve` and shows governed modal |
| **Multi-line Validation** | Partial failures could save partial documents | Atomic multi-line validation: 1 invalid line aborts entire transaction |
| **Tenant Isolation** | Some lookups omitted `company_id` filter | Strict `company_id` tenancy checks on all queries |
| **Error Handling** | Raw 404s or uncaught server errors exposed to cashiers | HREP-compliant error schemas with Title, Explanation, and Action |

## 6. Architecture Impact
- Replaced fragmented lookup queries with calls to `ProductResolutionService`.
- Mounted new REST router `/api/v1/products` providing `/resolve` and `/validate-lines`.
- Ensured zero schema migration impact by utilizing existing PostgreSQL tables (`items`, `item_variants`, `item_barcodes`, `products`, `legacy_id_mappings`).
- Enforced transaction atomicity before touching accounting or inventory ledgers.

## 7. Proposed Design
```
┌────────────────────────────────────────────────────────┐
│ Transaction Surfaces (POS, Billing, PO, GRN, WMS, Barcodes) │
└──────────────────────────┬─────────────────────────────┘
                           │ Identifiers: Barcode, SKU, ID
                           ▼
┌────────────────────────────────────────────────────────┐
│             ProductResolutionService                   │
│                                                        │
│  1. Check Canonical Master (items, variants, barcodes) │
│  2. If not found -> Fallback to Legacy (products)      │
│  3. Verify Multi-Tenant Boundary (company_id)          │
│  4. Verify Operational Status (Active, Quarantined)    │
│  5. Return ProductResolutionResult or HREP Error       │
└──────────────────────────┬─────────────────────────────┘
                           │
             ┌─────────────┴─────────────┐
             ▼                           ▼
     [ All Lines Valid ]          [ Any Line Invalid ]
             │                           │
             ▼                           ▼
      Allow Transaction           Reject & Rollback
```

## 8. Files Created
1. `backend/app/schemas/product_resolution.py`
2. `backend/app/services/product_resolution_service.py`
3. `backend/app/api/v1/product_resolution.py`
4. `backend/tests/test_global_product_resolution.py`
5. `docs/walkthrough/catalog/Product_Resolution_And_Validation_Standard_v1.0.md`
6. `docs/implementation/inventory/Product_Resolution_And_Validation_Standard_Plan_v1.0.md`

## 9. Files Modified
1. `backend/app/api/v1/__init__.py`
2. `backend/app/main.py`
3. `backend/app/services/billing_catalog_service.py`
4. `backend/app/api/v1/billing.py`
5. `backend/app/services/purchase.py`
6. `backend/app/services/headless_billing.py`
7. `backend/app/api/v1/grn.py`
8. `backend/app/services/inventory_wms.py`
9. `backend/app/services/barcodes_engine.py`
10. `src/components/billing/BillingTerm.tsx`
11. `docs/walkthrough/README.md`
12. `docs/implementation/README.md`

## 10. Dependencies
- FastAPI Core & Pydantic V2 schemas.
- PostgreSQL Item Master & Legacy Catalog tables.
- SMRITI Telemetry Sink (`canonical_resolution_telemetry.jsonl`).
- React 18 / Lucide React / Tailwind UI components.

## 11. Risks
- **Legacy Barcode Collision:** If an item exists in both legacy `products` and canonical `items` under different SKUs, canonical takes precedence.
- **Operator Interruption on Unregistered Item:** Cashiers can no longer enter arbitrary dummy items. This is an intentional security/data-governance control, mitigated by the `[ Add Product ]` role-gated quick-action button in the modal.

## 12. Rollback Strategy
- The implementation does not alter database table DDL. If rollback is necessary, git revert restoring previous service files will return system to prior behavior without database migration conflicts.

## 13. Verification Plan
- Automated pytest suite verifying all 8 core resolution, fallback, quarantine, tenant isolation, and atomicity requirements.
- Existing regression test suites (`test_product_identity_refactor.py`) passing green.
- TypeScript compiler verification (`npx tsc --noEmit`) with 0 errors.

## 14. Test Plan
- `test_01_resolve_valid_canonical_hierarchy`: Verify Item + Variant + Barcode retrieval.
- `test_02_resolve_legacy_fallback`: Verify fallback to legacy `products`.
- `test_03_unknown_product_rejection`: Verify unknown identifiers return `PRODUCT_NOT_FOUND`.
- `test_04_inactive_product_rejection`: Verify inactive items return `PRODUCT_INACTIVE`.
- `test_05_quarantined_product_rejection`: Verify items marked for review return `PRODUCT_QUARANTINED`.
- `test_06_tenant_isolation`: Verify Tenant B cannot access Tenant A's private items.
- `test_07_transaction_lines_atomicity`: Verify 1 bad line out of 3 rolls back the entire batch.
- `test_08_api_product_resolution_endpoints`: Verify REST API `/resolve` and `/validate-lines`.

## 15. Documentation Impact
- Updated Walkthrough Master Index (`docs/walkthrough/README.md`).
- Updated Implementation Plan Master Index (`docs/implementation/README.md`).
- Authored full Walkthrough (`docs/walkthrough/catalog/Product_Resolution_And_Validation_Standard_v1.0.md`).

## 16. Deployment Plan
- Deploy backend service and API router.
- Deploy frontend client build with updated `BillingTerm.tsx`.
- Zero database migrations required.

## 17. Status
Completed

## 18. Related ADRs
- `ADR-004`: Multi-Tenant Separation and Partitioning
- `ADR-CAT-001`: Canonical Product Hierarchy & Identity Standard
- `ADR-CAT-002`: Deprecation of Rogue SKU Generation in Transactions

## 19. Related Walkthroughs
- `docs/walkthrough/catalog/Product_Resolution_And_Validation_Standard_v1.0.md`
