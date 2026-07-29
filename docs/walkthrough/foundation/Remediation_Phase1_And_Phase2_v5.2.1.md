<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
  Version      : 5.2.1
  Created      : 2026-07-21
  Modified     : 2026-07-21
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
-->

# Remediation Plan Phase 1 & Phase 2 Implementation Walkthrough (v5.2.1)

## 1. Purpose
This document provides a comprehensive verification and implementation walkthrough for **Phase 1 (Critical Data Integrity Fixes)** and **Phase 2 (Tax & Transaction Validation)** of the SMRITI Architecture Verification Remediation Plan (v5.2.1).

## 2. Scope
- **Phase 1 (Data Integrity)**:
  - Canonical GST recalculation in Sales Billing using `InventoryService.resolve_effective_gst_percentage(product)`.
  - Cross-table barcode collision validation across primary (`Product.barcode`) and secondary (`ProductBarcode.barcode`) tables.
  - Eager loading (`selectinload(SalesInvoice.payments)`) to eliminate async ORM `MissingGreenlet` errors.
- **Phase 2 (Tax & Transaction Validation)**:
  - Nullable `gst_percentage` in Product Master to support default rate resolution.
  - GST resolution alignment in Purchase Service using `resolve_effective_gst_percentage(product)`.
  - SQLAlchemy 2.0 query compilation cache isolation (`track_closure_variables=True`) for RLS dynamic context evaluation across PyTest test suites.

## 3. Files Created
- `docs/walkthrough/foundation/Remediation_Phase1_And_Phase2_v5.2.1.md` (This document)

## 4. Files Modified
- `backend/app/services/sales.py` — Canonical GST calculation, `selectinload` options, and item update tenant context population.
- `backend/app/services/inventory.py` — Cross-table primary & secondary barcode uniqueness validation.
- `backend/app/models/inventory.py` — Nullable `gst_percentage` schema definition.
- `backend/app/schemas/inventory.py` — `Optional[Decimal]` GST percentage schema update.
- `backend/app/services/purchase.py` — Canonical GST resolution in purchase orders.
- `backend/app/db/session.py` — RLS context interceptor query cache isolation (`track_closure_variables=True`).
- `backend/app/api/deps.py` — Request-scoped ContextVar propagation from JWT identity.
- `backend/app/tests/test_sales.py` — Unit & integration test cases for GST override recalculation and tenant fixture isolation.
- `backend/app/tests/test_inventory.py` — Cross-table barcode collision test suite.
- `docs/walkthrough/README.md` — WGP master index entry.
- `CHANGELOG.md` — Version 5.2.1 release notes entry.

## 5. Architecture Decisions
- **Canonical GST Source of Truth**: Frontend payload GST values are advisory; the backend resolves effective GST rates dynamically from the Product Master (`Product.gst_percentage`) via `InventoryService.resolve_effective_gst_percentage(product)`.
- **Row-Level Security Query Cache Isolation**: SQLAlchemy query compilation cache is isolated per security context scope by enabling `track_closure_variables=True` on `with_loader_criteria` options, ensuring multi-tenant tests and requests execute with strictly isolated tenant contexts.

## 6. Design Rationale
- Embedding canonical rate resolution directly inside `SalesService.create_sales_invoice` ensures compliance with tax laws, preventing unauthorized price tampering from front-end payloads while preserving backend auditability.

## 7. Implementation Summary
1. Updated `create_sales_invoice()` in `sales.py` to calculate line item tax rates using `InventoryService.resolve_effective_gst_percentage(product)`.
2. Updated `create_product()` in `inventory.py` to check both `Product.barcode` and `ProductBarcode.barcode` simultaneously before insert.
3. Configured `gst_percentage` on `Product` model to be nullable (`Numeric(5, 2), nullable=True`).
4. Updated `session.py` RLS event listener with `track_closure_variables=True` to guarantee dynamic tenant filtering in async task execution.

## 8. Tests Executed
```bash
python -m pytest app/tests/test_sales.py app/tests/test_inventory.py app/tests/test_platform_validation_engine.py app/tests/test_master_hybrid.py -v
```

## 9. Verification Results
```text
================ 54 passed, 335 warnings in 146.12s (0:02:26) =================
- test_sales.py: 33/33 PASSED
- test_inventory.py: 5/5 PASSED
- test_platform_validation_engine.py: 6/6 PASSED
- test_master_hybrid.py: 10/10 PASSED
```

## 10. Known Limitations
- Background queue retry logic for government GSTN/E-Way Bill gateway integration remains in Phase 3/4 roadmap scope.

## 11. Future Work
- Proceed to Phase 3 (Schema Consistency & Master Type Governance) and Phase 4 (Performance & Refactoring).

## 12. Related ADRs
- `ADR-005`: Platform Validation Engine (PVE) Metadata Rules & Modes
- `ADR-012`: System of Record Backend Architecture (FastAPI + Postgres)

## 13. Related RFCs
- `RFC-024`: Universal Master Hybrid Value Model
