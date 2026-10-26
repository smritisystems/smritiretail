<!--
  Project      : SMRITI Retail OS
  Repository   : SMRITIRetailNX
  Organization : AITDL NETWORKS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.99.1
  Created      : 2026-10-26
  Modified     : 2026-10-26
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough: CRM Corporate 360° Dashboard Reconciliation & Customer Master Parity

## 1. Purpose
This document details the resolution of data inconsistencies between the Customer Master and the Corporate 360° Dashboard (`CorporateCustomer360.tsx`, `Customer360DashboardView.tsx`, and backend `/crm/customers/{customer_id}/corporate-360`). Specifically, for enterprise parent accounts such as ShopperStop (`CUST-68351893`), the 360° dashboard previously reported 0 child accounts and 0 active stores—contradicting Customer Master records which maintain linked subordinate branch accounts and outlets. Additionally, property mapping discrepancies causing blank billing locations and missing registered addresses are resolved.

## 2. Scope
- Backend CRM API endpoint `/crm/customers/{customer_id}/corporate-360` eager loading of relationships (`dependant_relationships.dependant_customer`, `parent_relationships.parent_customer`, `external_identities`, and `loyalty_members`).
- Subordinate branch outlet derivation in `get_corporate_customer_360` and `Customer360DashboardView.tsx` when direct delivery locations are unpopulated, aligning with Customer Master behavior.
- Response serialization and DTO property parity in `Customer360DashboardView.tsx` supporting both camelCase (`locationName`, `addressLine1`, `isDefault`, `dependantCustomerCode`, `dependantCustomerName`) and snake_case aliases.
- Fallback resolution for corporate registered address in tab `corporate_tax` defaulting to active billing address.
- Packaging, testing, container deployment, and headless verification.

## 3. Files Created
- `docs/walkthrough/crm/CRM_Corporate_360_Master_Reconciliation_And_Store_Sync_v1.0.0.md`

## 4. Files Modified
- `backend/app/api/v1/crm.py`: Added eager loading of `CustomerRelationship.dependant_customer` and `CustomerRelationship.parent_customer`, and implemented child branch store network fallback in `get_corporate_customer_360`.
- `backend/app/schemas/crm.py`: Enriched `map_customer_to_response_dict` to populate all child account metadata on `dependant_rows` (`mobile`, `email`, `store_code`, `city`, `state`, `gstin`, `credit_limit`, `credit_days`).
- `src/components/customer/corporate360/Customer360DashboardView.tsx`: Supported subordinate child branch outlet fallback in `stores` hook; unified camelCase and snake_case property resolution across `billingLocations`, `deliveryLocations`, `corporate_tax`, `parent_child`, and `stores` tabs; added UADHP author header.
- `CHANGELOG.md`: Appended reconciliation details under `[Unreleased] - 2026-10-26`.
- `docs/walkthrough/README.md`: Appended entry to master walkthrough index.

## 5. Architecture Decisions
1. **Authoritative Backend Eager-Loading**: Enhanced `get_corporate_customer_360` to explicitly eager-load `Customer.dependant_relationships` and nested `CustomerRelationship.dependant_customer`. This guarantees that Pydantic serialization through `map_customer_to_response_dict` accurately populates `customer.dependants` without lazy-load `DetachedInstanceError` or empty lists.
2. **Subordinate Branch Outlets as Store Network**: When an enterprise corporate customer record does not have direct delivery locations attached, the system derives store network outlets from subordinate child branch accounts. This establishes architectural parity between Customer Master hierarchy rosters and the Corporate 360° overview counters.
3. **Dual DTO Key Access Pattern**: Provided resilient property lookups (`location_name || locationName`, `address_line1 || addressLine1`, `dependant_customer_code || dependantCustomerCode`) across frontend views to handle responses serialized via Pydantic camelCase aliases without silent display degradation.

## 6. Design Rationale
In corporate retail operations, holding companies frequently operate retail locations through subordinate corporate entities or branch accounts rather than directly attached shipping points. When the Corporate 360° dashboard reported 0 stores and 0 children despite Customer Master displaying child accounts, operators could not assess group-level store network presence. By unifying the store derivation logic and eager-loading relationship graphs, the 360° dashboard accurately reflects enterprise network topology.

## 7. Implementation Summary
- Eagerly loaded `selectinload(Customer.dependant_relationships).selectinload(CustomerRelationship.dependant_customer)` in `get_corporate_customer_360`.
- Derived `store_network` items and calibrated `total_stores` and `active_stores` KPIs to reflect subordinate branch accounts when direct delivery locations are absent.
- Enriched `dependant_rows` mapping in `schemas/crm.py` with full child customer metadata.
- Updated `Customer360DashboardView.tsx` with fallback logic and camelCase/snake_case property lookups.
- Verified build and deployed updated assets to containerized services (`smriti-api` and `smriti-web`).

## 8. Tests Executed
1. **Frontend Vitest Suites**:
   - `src/tests/corporateCustomer360.test.tsx`: 12/12 passed (100%).
   - `src/tests/customer360DashboardView.test.tsx`: 9/9 passed (100%).
   - `src/tests/customerHierarchyDirectory.test.tsx`: 16/16 passed (100%).
   - `src/tests/customerDataIntegrityAndDummyElimination.test.tsx`: 6/6 passed (100%).
   - Total: 43/43 tests green.
2. **Frontend Production Build**:
   - `npm run build`: Exit code 0 (`built in 49.97s`), 0 TypeScript errors.
3. **Headless Live Backend API Verification**:
   - `GET /api/v1/crm/customers/01a17307-6fb6-7000-a97d-da721ae573f5/corporate-360`:
     - HTTP Status: 200 OK
     - Customer Name: ShopperStop
     - Dependants Count: 2 (`CUST-68351894` ShopperStop Demo Branch, `CUST-68351895` abcd)
     - Store Network Count: 2
     - KPIs: `total_stores: 2`, `active_stores: 2`, `active_stores_pct: 100.0`
     - Billing Locations Count: 1 (`ShopperStop` | `123 Demo Corporate Plaza, MG Road, Demo District, Bank Road SO Gorakhpur`)

## 9. Verification Results
- All 43 frontend unit and integration tests passed.
- Live API returns exact parity with Customer Master: 2 child accounts, 2 store network entries, and non-empty billing location address.
- Production bundle deployed to `smriti-web` container and container verified healthy (HTTP 200).

## 10. Known Limitations
- When child branch accounts do not have specific store codes assigned, store code displays the customer code or `—`.

## 11. Future Work
- Add direct navigation shortcut from 360° Store Network row to open the child customer's dedicated 360° dashboard.

## 12. Related ADRs
- `ADR-0027`: Domain-Driven CRM Multi-Company Hierarchy and Subordinate Routing.
- `ADR-0031`: Corporate Customer 360° Data Aggregation and PSV Ledger Reconciliation.

## 13. Related RFCs
- `RFC-CRM-0042`: N-Tier Corporate Account Structure and Subordinate Identity Federation.
