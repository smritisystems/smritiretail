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

# Walkthrough: CRM Customer Hierarchy Viewer Metadata Resolution & Placeholder Elimination

## 1. Purpose
This document details the resolution of placeholder and missing child details within the SMRITI Customer Hierarchy Viewer (`CustomerHierarchyModal.tsx`, `CustomerHierarchyTree.tsx`, and `EnterpriseCustomerMasterView.tsx`) when exploring corporate parent accounts and subordinate branch outlets (e.g. `ShopperStop` -> `ShopperStop Demo Branch`).

## 2. Scope
- Backend CRM API endpoint `/crm/customers/{customer_id}` code resolution fallback.
- Backend CustomerRepository `get` and `get_by_code` methods supporting queries by UUID or business code.
- Backend eager loading of customer locations (`delivery_locations`, `billing_locations`) and `gst_registrations` in `/crm/customers/{customer_id}/dependants` and `/crm/customers/{customer_id}/hierarchy`.
- Schema enrichment of `CustomerRelationshipResponse` and `CustomerHierarchyNodeResponse` with child metadata (`mobile`, `email`, `store_code`, `city`, `state`, `gstin`, `credit_limit`, `credit_days`).
- Elimination of legacy `dep.notes` regex parsing and fallback values (`"Mumbai"`, `"India"`) in frontend hierarchy viewers.
- Dynamic tagging of depth-1 leaf accounts as "Child Branch" instead of "Zonal / Hub" in `CustomerHierarchyTree.tsx`.

## 3. Files Created
None. (Existing architectural components were augmented in place).

## 4. Files Modified
- `backend/app/api/v1/crm.py`: Added `_extract_customer_hierarchy_meta`, eager loaded location relations in `/dependants` and `/hierarchy`, added code resolution in `get_customer`.
- `backend/app/repositories/customer.py`: Updated `get` to match `(Customer.id == id) | (Customer.code == id)` and added `get_by_code`.
- `backend/app/schemas/crm.py`: Added metadata fields to `CustomerRelationshipResponse` and `CustomerHierarchyNodeResponse`.
- `src/components/customer/types.ts`: Extended `CustomerHierarchyNode` with metadata fields.
- `src/components/customer/CustomerHierarchyModal.tsx`: Updated `mapDependantsToNodes` and Account Roster table child rows.
- `src/components/customer/CustomerHierarchyTree.tsx`: Updated depth badge heuristic and rendered store code, city, phone badges.
- `src/components/customer/corporateWorkspace/CustomerHierarchyTree.tsx`: Added metadata fields to `HierarchyChildNode` and rendered store/location badges.
- `src/components/customer/corporateWorkspace/EnterpriseCustomerMasterView.tsx`: Eliminated `"Mumbai"` and `"India"` hardcoded fallbacks in favour of real customer metadata or clean `—`.
- `src/components/customer/lifecycle/EnterpriseCustomerSearchModal.tsx`: Eliminated `"Mumbai"` and `"Maharashtra"` hardcoded fallbacks.
- `CHANGELOG.md`: Logged bugfix under `[Unreleased] - 2026-10-26`.
- `docs/walkthrough/README.md`: Appended entry to master walkthrough index.

## 5. Architecture Decisions
1. **SSOT Customer Metadata Extraction**: Implemented `_extract_customer_hierarchy_meta` in `crm.py` to inspect `delivery_locations`, `billing_locations`, and `gst_registrations`, stripping invalid `DUMMY-` prefixes while retrieving canonical city, state, mobile, and GSTIN.
2. **Dual-Key Lookup in CustomerRepository**: Configured `CustomerRepository.get` to evaluate `or_(Customer.id == id, Customer.code == id)`, enabling seamless lookup whether consumers supply an internal UUID or human-readable business code (`CUST-68351894`).
3. **Dynamic Leaf Node Classification**: Evaluated child counts in `getDepthBadge` so depth-1 accounts with 0 children are styled with `<Store />` icon and labeled "Child Branch", while depth-1 nodes with children retain "Zonal / Hub".

## 6. Design Rationale
Previously, `CustomerRelationship` rows in the database did not duplicate customer attributes like mobile or email, and `notes` was nullable. When relationships were created without formatted notes, client-side regexes failed to extract store codes and locations, leading to blank placeholders or arbitrary city fallbacks. By joining and eager-loading canonical customer relations in FastAPI, the hierarchy payload directly provides verified metadata without client-side guessing.

## 7. Implementation Summary
- Eager loaded `selectinload(CustomerRelationship.dependant_customer).selectinload(Customer.delivery_locations)` in `list_customer_dependants`.
- Eager loaded locations and GST records in `get_customer_hierarchy_tree` and populated `CustomerHierarchyNodeResponse`.
- Refactored `CustomerHierarchyModal.tsx` roster table to display `node.mobile`, `node.email`, and `node.gstin` below the customer name, and `Store ${node.storeCode}` or location badges in the store column.
- Replaced fallback literals in `EnterpriseCustomerMasterView.tsx`.
- Updated TypeScript types in `types.ts` and `CustomerHierarchyTree.tsx`.

## 8. Tests Executed
1. **Vitest Unit & Integration Suites**:
   - `src/tests/customerHierarchyDirectory.test.tsx` (16 tests passed).
   - `src/tests/customerNTierHierarchyAndBulkAssign.test.tsx` (7 tests passed).
   - Total: 23/23 tests green.
2. **Production Bundle Compilation**:
   - `npm run build` completed with zero TypeScript errors in 49.49s.
3. **Headless Live Backend API Verification**:
   - `GET /api/v1/crm/customers/CUST-68351893/dependants`: 200 OK (returned `ShopperStop Demo Branch` with phone `9000000002` and email `demo-branch@shopperstop.example`).
   - `GET /api/v1/crm/customers/CUST-68351893/hierarchy`: 200 OK (returned complete root and child branch hierarchy graph).
   - `GET /api/v1/crm/customers/CUST-68351894`: 200 OK (returned full customer record queried by code).

## 9. Verification Results
- All unit, integration, and live API verifications passed with 100% success rate.
- Container images updated: `smriti-api` restarted with updated python repository and endpoints; `smriti-web` updated via `docker cp dist/. smriti-web:/usr/src/app/dist/`.

## 10. Known Limitations
- When a child customer has neither delivery locations nor billing locations recorded, location displays clean `—` fallback rather than an assumed city.

## 11. Future Work
- Support bulk editing of child branch delivery locations directly from the hierarchy viewer modal.

## 12. Related ADRs
- `ADR-0027`: Domain-Driven CRM Multi-Company Hierarchy and Subordinate Routing.

## 13. Related RFCs
- `RFC-CRM-0042`: N-Tier Corporate Account Structure and Subordinate Identity Federation.
