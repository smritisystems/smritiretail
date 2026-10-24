<!--
  Project      : SMRITI Retail OS
  Repository   : SMRITIRetailNX
  Organization : AITDL NETWORKS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 1.0.0
  Created      : 2026-10-18
  Modified     : 2026-10-18
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
  Policy ID    : WGP-v1.0
-->

# Walkthrough: Corporate Customer Store Network & Typed Address Mapping v1.0.0

## 1. Purpose
This walkthrough documents the end-to-end design, implementation, and test verification of the Corporate Customer Store Network and Typed Multi-Address architecture for SMRITI Retail OS. It implements the enterprise Reliance Retail-style UX and enforces strict tenant-wide exclusive store code mappings and historical address auditing.

## 2. Scope
- **Domain:** CRM / Corporate Customer Master & Cockpit
- **Components:**
  - Corporate Customer 360 overview, tabs, KPI cards, and store network tables.
  - Searchable Store Code Master Lookup modal with owner tooltips and disabled state for claimed codes.
  - Typed Multi-Address Management modal supporting Delivery, Billing, Warehouse, Registered, Shipping, and Other addresses with primary constraints.
  - FastAPI SoR backend endpoints (`/store-codes/lookup`, `/addresses`, `/corporate-360`).
  - Pessimistic row locking on `CustomerDeliveryLocation` during assignment.
  - Full automated regression test suites in `pytest` and `vitest`.

## 3. Files Created
1. `src/components/customer/corporate360/StoreAddressModal.tsx`
2. `src/components/customer/corporate360/StoreCodeLookupModal.tsx`
3. `src/components/customer/corporate360/CorporateAccountHeader.tsx`
4. `src/components/customer/corporate360/CorporateCustomer360.tsx`
5. `src/components/customer/corporate360/CorporateCustomerTabs.tsx`
6. `src/components/customer/corporate360/CorporateKpiCards.tsx`
7. `src/components/customer/corporate360/CorporatePsvWidget.tsx`
8. `src/components/customer/corporate360/CorporatePurchaseTrendWidget.tsx`
9. `src/components/customer/corporate360/CorporateRecentOrdersWidget.tsx`
10. `src/components/customer/corporate360/CorporateStoreNetwork.tsx`
11. `src/components/customer/corporate360/CorporateStoreTypeWidget.tsx`
12. `src/components/customer/corporate360/CorporateTopCategoriesWidget.tsx`
13. `src/components/customer/corporate360/types.ts`
14. `backend/app/tests/test_corporate_customer_360.py`
15. `src/tests/corporateCustomer360.test.tsx`
16. `docs/implementation/crm/Corporate_Customer_360_Store_Network_And_Address_Mapping_Plan_v1.0.0.md`

## 4. Files Modified
1. `backend/app/schemas/crm.py`
2. `backend/app/services/customer_identity.py`
3. `backend/app/repositories/customer.py`
4. `backend/app/services/crm.py`
5. `backend/app/api/v1/crm.py`
6. `src/components/customer/CustFormTab.tsx`
7. `src/components/customer/CustMasterWs.tsx`
8. `src/components/launchpad/launchpadCatalog.ts`
9. `src/components/shell/TabRenderer.tsx`
10. `src/components/shell/navigationResolver.ts`
11. `src/layout_engine/layout_store.tsx`
12. `src/navigation/breadcrumb/BreadcrumbRegistry.ts`
13. `src/tests/fioriLaunchpad.test.ts`
14. `docs/implementation/README.md`
15. `docs/walkthrough/README.md`

## 5. Architecture Decisions
1. **Zero Unapproved Migrations via PostgreSQL JSONB:** Rather than altering relational schemas, typed addresses are stored inside `CustomerDeliveryLocation.metadata_json["addresses"]`. This provides JSON queryability and allows dynamic types without altering core tables.
2. **Pessimistic Concurrency (`with_for_update`):** During store code assignment or creation, a row-level lock is acquired on matching store codes to prevent concurrent assignments from competing operator sessions.
3. **Soft-Deactivation History:** Deleting an address sets `is_active = false` and updates `updated_at`, ensuring historical invoices and shipping bills retain their exact original address snapshot.
4. **Tenant-Wide Exclusive Mapping:** One store code belongs to at most one customer. In lookups, claimed store codes remain visible to maintain master directory transparency, but are strictly non-selectable (`is_selectable = false`) with clear ownership reasons.

## 6. Design Rationale
- **Reliance Retail Style UX:** Enterprise operators manage thousands of stores. Replacing complex nested menus with an intuitive single-page 360 overview delivers "Power of an Enterprise ERP, Simplicity of WhatsApp".
- **SSR/Vitest Static Markup Safety:** Modal components initialize local state from props using functional initializers (`useState(() => store?.addresses || [])`), ensuring clean static test rendering without needing hydration cycles.

## 7. Implementation Summary
- **Backend Schema & Services:**
  - Extended Pydantic schemas in `crm.py` with `StoreAddressItem`, `StoreAddressCreate`, `StoreAddressUpdate`, and `StoreCodeLookupItem`.
  - Added duplicate detection logic in `customer_identity.py` (`Check 1b`).
  - Added repository methods in `customer.py` (`get_by_store_code` with locking, `search_store_code_lookup`).
  - Implemented address collection helpers and lookup resolver in `crm.py`.
- **Frontend Components:**
  - Engineered `StoreCodeLookupModal.tsx` with search, type/region filters, disabled indicators, and assignment triggers.
  - Engineered `StoreAddressModal.tsx` for multi-address creation, edit, primary toggle, and soft-deactivation.
  - Connected `CustFormTab.tsx` and `CorporateStoreNetwork.tsx` to provide seamless access across Customer Master and Corporate 360 workspaces.

## 8. Tests Executed
1. **Backend Integration Suite (`pytest`):**
   ```bash
   pytest backend/app/tests/test_corporate_customer_360.py
   ```
   Verified 16/16 test cases:
   - `test_corporate_kpis_serialization`
   - `test_corporate_360_endpoint_mock_integration`
   - `test_corporate_psv_breakdown_consistency`
   - `test_corporate_recent_orders_structure`
   - `test_corporate_tab_keys_completeness`
   - `test_corporate_customer_multi_store_code_assignment`
   - `test_store_code_exclusive_customer_mapping_duplicate_decision`
   - `test_store_code_master_lookup_selectable_contract`
   - `test_store_code_typed_addresses_single_primary_constraint`
   - `test_store_address_soft_deactivation_preserves_history`
   - `test_store_address_type_validation_rejects_invalid_types`
   - `test_psv_missing_or_stale_data_not_zero_or_fabricated`
   - `test_concurrent_store_code_assignment_prevents_duplicate_claims`
   - `test_legitimate_store_code_reassignment_after_deactivation`
   - `test_tenant_isolation_store_code_lookup_and_assignment`
   - `test_address_update_concurrency_conflict_protection`

2. **Frontend Test Suite (`vitest`):**
   ```bash
   npx vitest run src/tests/corporateCustomer360.test.tsx
   ```
   Verified 11/11 tests passing:
   - Header rendering & enterprise metrics
   - KPI card grid & positive/negative trends
   - Store network table & pagination
   - PSV party stock visibility donut & metrics
   - 12-month purchase trend line chart
   - Store type breakdown distribution
   - Top purchasing categories progress bars
   - Recent corporate orders table
   - 13 enterprise tabs switching
   - Searchable Store Code Lookup modal & disabled states
   - Store Address Management modal & multi-type addresses

3. **Launchpad Regression Test Suite (`vitest`):**
   ```bash
   npx vitest run src/tests/fioriLaunchpad.test.ts
   ```
   Verified 11/11 tests passing.

4. **TypeScript Typecheck:**
   ```bash
   npx tsc --noEmit
   ```
   Exited with code 0 (zero errors).

5. **Git Diff Whitespace Check:**
   ```bash
   git diff --check
   ```
   Exited with code 0 (zero whitespace errors).

## 9. Verification Results
- **Pytest:** 16 passed in 46.31s (100% green).
- **Vitest:** 11 passed in 1.20s (100% green).
- **Launchpad Vitest:** 11 passed in 401ms (100% green).
- **TypeScript:** Exited with code 0 (0 errors).
- **Git Diff:** Exited with code 0 (clean).
- **Parity Check:** Zero database migrations applied; full compatibility with existing `CustomerDeliveryLocation` rows.

## 10. Known Limitations
- Master Lookup currently retrieves up to 100 store codes in a single query; server-side cursor pagination can be added when store codes exceed 10,000 per tenant.

## 11. Future Work
- Integration with GIS mapping for real-time geospatial clustering of store networks on an interactive map.

## 12. Related ADRs
- `ADR-0042`: Canonical Identity Resolution & Concurrency Safeguards
- `ADR-0089`: Decommissioning of Legacy Stores Table in favor of CustomerDeliveryLocation

## 13. Related RFCs
- `RFC-2026-CRM-01`: Enterprise Multi-Store Account Aggregation & Address Standardization
