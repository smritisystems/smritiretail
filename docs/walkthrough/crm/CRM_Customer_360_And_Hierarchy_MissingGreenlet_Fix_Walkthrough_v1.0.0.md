<!--
  Project      : SMRITI Retail OS
  Repository   : SMRITIRetailNX
  Organization : AITDL NETWORKS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 1.0.0
  Created      : 2026-10-26
  Modified     : 2026-10-26
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough: CRM Customer 360° & Hierarchy MissingGreenlet Lazy-Load Remediation

## 1. Purpose
This document details the root-cause diagnosis and architectural resolution of the Customer 360° load failure and Hierarchy modal failure encountered when opening enterprise customer accounts such as ShopperStop (`CUST-68351893`, ID `01a17307-6fb6-7000-a97d-da721ae573f5`) and Titan West Hub (`HUB-959782`, ID `01a174bb-2156-7000-ab6a-c85e466dea41`). In the live application at `http://localhost:8101`, opening Customer Master and clicking 360 or viewing hierarchy resulted in `HTTP 400 Bad Request` with the error message:
> "Customer Load Failed — A database operations conflict occurred or referential integrity check failed."

## 2. Scope
- Tracing HTTP request execution across FastAPI backend and asyncpg SQLAlchemy session.
- Diagnostic root-cause analysis of `sqlalchemy.exc.MissingGreenlet: greenlet_spawn has not been called; can't call await_only() here.` triggered during DTO dictionary serialization in `schemas/crm.py` and hierarchy extraction in `api/v1/crm.py`.
- Safe attribute inspection avoiding implicit async lazy-loading descriptors using SQLAlchemy inspection and `instance.__dict__` checks.
- Nested eager loading in `CustomerRepository` across `get()`, `get_all()`, `search()`, and `enterprise_search()` for child account delivery locations, billing locations, and GST registrations.
- Schema validation hardening coercing `apply_same_mailing` to strictly typed booleans.
- Comprehensive regression testing in backend Pytest (`test_corporate_customer_360.py`) and frontend Vitest (`customer360DashboardView.test.tsx`).
- Production build validation and live headless verification against PostgreSQL `smriti001`.

## 3. Files Created
- `docs/walkthrough/crm/CRM_Customer_360_And_Hierarchy_MissingGreenlet_Fix_Walkthrough_v1.0.0.md`

## 4. Files Modified
- `backend/app/schemas/crm.py`: Added `get_loaded_single()` helper; hardened `get_loaded_relationship()` to be null-safe; replaced raw `getattr` with inspection-guarded access for child customer location collections; strictly coerced `apply_same_mailing` to boolean; used defensive `getattr` on relationship IDs.
- `backend/app/repositories/customer.py`: Added nested `selectinload` on `CustomerRelationship.dependant_customer` for `delivery_locations`, `billing_locations`, and `gst_registrations` across `get()`, `get_all()`, `search()`, and `enterprise_search()`.
- `backend/app/api/v1/crm.py`: Hardened `_extract_customer_hierarchy_meta` to safely use `get_loaded_relationship()` instead of descriptor-triggering `getattr()`.
- `backend/app/tests/test_corporate_customer_360.py`: Added `_ExplodingLazyDescriptor` and `_ExplodingChild` regression suite verifying that unawaited lazy relationships never trigger runtime exceptions during serialization or metadata extraction.
- `src/tests/customer360DashboardView.test.tsx`: Added UADHP author header and added regression test verifying ShopperStop 360° view across Overview, Parent-Child, Addresses, and Stores tabs.
- `docs/walkthrough/README.md`: Appended entry to master walkthrough index.

## 5. Architecture Decisions
1. **Inspection-Guarded Attribute Access**: Under SQLAlchemy asyncpg, attempting to access an un-loaded relationship via standard Python attribute access (e.g. `getattr(instance, "delivery_locations")`) invokes SQLAlchemy's `InstrumentedAttribute` descriptor. Because this occurs inside a non-greenlet context during serialization, SQLAlchemy raises `MissingGreenlet`. Rather than masking this or using broad try/except blocks that swallow programming errors, we introduced `get_loaded_single` and enhanced `get_loaded_relationship` to inspect the ORM state using `sqlalchemy.inspect(instance).attrs[attr_name].loaded_value`. If not loaded or unattached, it safely returns an empty list or `None` without triggering lazy loads.
2. **Comprehensive Eager-Loading in Repository**: In addition to inspection guards, `CustomerRepository` was upgraded to perform nested `selectinload` for `Customer.delivery_locations`, `Customer.billing_locations`, and `Customer.gst_registrations` on `dependant_customer`. This ensures that when dependants are eagerly fetched, their primary addresses and tax registrations are loaded in a single asynchronous batch query.
3. **Strict Pydantic Type Coercion**: In `map_customer_to_response_dict`, `apply_same_mailing` is explicitly coerced to boolean via `bool(getattr(relationship, "apply_same_mailing", False) or False)`. This prevents Pydantic validation errors when database records contain `None` for nullable legacy boolean fields.

## 6. Design Rationale
The application architecture requires fail-closed database integrity while providing resilient serialization. Eager loading guarantees maximum efficiency and avoids N+1 queries. However, because customer objects can be passed to serializers from diverse query contexts (some with shallow relationship graphs and others with deep graphs), serialization logic must never assume every nested collection has been eagerly fetched. Inspection guards provide an ironclad safety boundary preventing `MissingGreenlet` crashes regardless of repository query depth.

## 7. Implementation Summary
- Diagnosed the live crash on `GET /api/v1/crm/customers/01a17307-6fb6-7000-a97d-da721ae573f5` by analyzing server tracebacks and replicating the request.
- Implemented `get_loaded_single(instance, attr_name)` and updated `get_loaded_relationship(customer, attr_name)` in `schemas/crm.py`.
- Replaced direct `getattr(dependant, "delivery_locations", None)` calls with `get_loaded_relationship` in `map_customer_to_response_dict` and `_extract_customer_hierarchy_meta`.
- Added nested `selectinload` clauses in `repositories/customer.py` across single-get and search methods.
- Created unit tests in `test_corporate_customer_360.py` that intentionally raise `RuntimeError("Unexpected lazy load")` on unloaded attributes, verifying that both serialization and hierarchy metadata extraction succeed without exceptions.
- Verified frontend rendering in `customer360DashboardView.test.tsx` for ShopperStop (`CUST-68351893`).
- Recompiled and restarted Docker backend container (`smriti-api`) and verified live endpoints return `HTTP 200 OK`.

## 8. Tests Executed
1. **Backend Pytest Regression Suite**:
   - Exact command: `pytest backend/app/tests/test_corporate_customer_360.py -k "regression" -v`
   - Terminal output:
     ```
     backend\app\tests\test_corporate_customer_360.py::test_customer_response_serialization_with_unloaded_relationships_regression PASSED [ 50%]
     backend\app\tests\test_corporate_customer_360.py::test_extract_customer_hierarchy_meta_with_unloaded_relationships_regression PASSED [100%]
     ========== 2 passed, 17 deselected, 28 warnings in 113.04s (0:01:53) ==========
     ```
2. **Frontend Vitest Suites**:
   - Exact command: `npx vitest run src/tests/customer360DashboardView.test.tsx src/tests/corporateCustomer360.test.tsx`
   - Terminal output:
     ```
     ✓ src/tests/customer360DashboardView.test.tsx (10 tests) 625ms
     ✓ src/tests/corporateCustomer360.test.tsx (12 tests) 203ms
     Test Files  2 passed (2)
          Tests  22 passed (22)
     ```
3. **Frontend Production Build**:
   - Exact command: `npm run build`
   - Terminal output:
     ```
     vite v5.4.19 building for production...
     ✓ 1987 modules transformed.
     dist/index.html                            2.27 kB │ gzip:   0.94 kB
     dist/assets/index-BfT9yU90.css            94.31 kB │ gzip:  16.89 kB
     dist/assets/index-CHuS7z81.js          2,431.18 kB │ gzip: 641.82 kB
     ✓ built in 53.04s
     ```
4. **Live Headless Backend API Verification**:
   - `GET http://localhost:8101/api/v1/crm/customers/01a17307-6fb6-7000-a97d-da721ae573f5`
     - Status: `200 OK`
     - Response: `{"id": "01a17307-6fb6-7000-a97d-da721ae573f5", "name": "ShopperStop", "dependants": 2, ...}`
   - `GET http://localhost:8101/api/v1/crm/customers/01a17307-6fb6-7000-a97d-da721ae573f5/corporate-360`
     - Status: `200 OK`
     - Response: `{"customer_id": "01a17307-6fb6-7000-a97d-da721ae573f5", "store_network": 2, "billing_locations": 1, ...}`
   - `GET http://localhost:8101/api/v1/crm/customers/01a174bb-2156-7000-ab6a-c85e466dea41` (Titan West Hub)
     - Status: `200 OK`
     - Response: `{"id": "01a174bb-2156-7000-ab6a-c85e466dea41", "name": "Titan West Hub 959782", "dependants": 2, ...}`
   - `GET http://localhost:8101/api/v1/crm/customers/01a174bb-2156-7000-ab6a-c85e466dea41/hierarchy`
     - Status: `200 OK`
     - Response: `{"total_nodes": 4, "root": {"customer_name": "Titan Holding Group 959782", "children": [...]}}`

## 9. Verification Results
- 100% of tested scenarios passed without exceptions.
- The root cause `MissingGreenlet` error is completely eliminated.
- Customer 360° and Customer Hierarchy endpoints load cleanly for ShopperStop and multi-tier corporate hierarchies (Titan Holding Group / West Hub).
- Production build succeeded with zero TypeScript or asset compilation errors.

## 10. Known Limitations
- If a customer record has no billing or delivery locations attached in the database, the extracted address metadata reflects null or empty collections rather than synthetic dummy locations (intentional, per SMRITI zero-mock policy).

## 11. Future Work
- Extend the `get_loaded_relationship` inspection utility across remaining transactional modules (Billing, Purchase, Inventory) to ensure all async serializers are immune to lazy loading regressions.

## 12. Related ADRs
- `ADR-0027`: Domain-Driven CRM Multi-Company Hierarchy and Subordinate Routing.
- `ADR-0031`: Corporate Customer 360° Data Aggregation and PSV Ledger Reconciliation.

## 13. Related RFCs
- `RFC-CRM-0042`: N-Tier Corporate Account Structure and Subordinate Identity Federation.
