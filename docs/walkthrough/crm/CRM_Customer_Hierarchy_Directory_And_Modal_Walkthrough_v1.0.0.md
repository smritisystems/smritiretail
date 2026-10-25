<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.99.1
  Created      : 2026-10-25
  Modified     : 2026-10-25
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Walkthrough / CRM
-->

# SMRITI Walkthrough: CRM Customer Hierarchy Directory & Interactive Tree Modal (v1.0.0)

## 1. Purpose
This implementation delivers end-to-end customer hierarchy discovery, relationship indicators, directory filtering, and interactive visual tree inspection in the SMRITI Retail OS Customer Master Workspace (`CustMasterWs.tsx`). It provides immediate visibility into corporate parent entities, subsidiary store branch footprints, and independent standalone accounts without requiring operators to leave the primary master table.

## 2. Scope
- **CRM Directory API Enrichment**:
  - `GET /api/v1/crm/customers/directory` returns computed `child_count`, `relationship_type` (`"parent"`, `"child"`, `"standalone"`), `parent_customer_code`, `parent_customer_name`, `primary_account_status`, and `primary_account_is_active`.
  - Added query filters: `relationship` (`all`, `parent`, `child`, `standalone`), `parent_id` (subordinate filter), and `sort_by=child_count`.
- **Dependants API Dual Resolution & Cyclic Prevention**:
  - `GET /api/v1/crm/customers/{customer_id}/dependants` and `POST` accept both UUID and business Code (e.g., `CUST-68351893`).
  - Breadth-first graph cycle check preventing circular relationships (A → B → A or multi-hop A → B → C → A).
- **Frontend Components & Modal**:
  - `CustomerDirectoryRelationshipCell.tsx`: Visual badge cell with one-click hierarchy modal and filter actions.
  - `CustomerHierarchyModal.tsx`: Full-screen modal with corporate parent summary card, interactive tree view, subordinate outlet table, instant search, and navigation to Edit or Corporate 360.
  - `CorporateCustomer360.tsx`: Safe draft record handling preventing live API calls for unsaved `cust-draft-*` records.
- **Headless & Automated Verification**:
  - 16 frontend Vitest tests in `customerHierarchyDirectory.test.tsx`.
  - 4 backend isolation-safe tests in `test_customer_directory_hierarchy.py`.
  - 7 live headless API scenario checks in `verify_customer_hierarchy_headless.py`.

## 3. Files Created
1. `src/components/customer/CustomerDirectoryRelationshipCell.tsx` — Hierarchy cell component for directory table.
2. `src/components/customer/CustomerHierarchyModal.tsx` — Full-featured interactive customer hierarchy inspection modal.
3. `backend/tests/test_customer_directory_hierarchy.py` — Database-isolated pytest suite for directory hierarchy.
4. `src/tests/customerHierarchyDirectory.test.tsx` — Vitest unit and integration test suite.
5. `scripts/verify_customer_hierarchy_headless.py` — Headless live API verification script.
6. `docs/implementation/crm/CRM_Customer_Hierarchy_Directory_And_Modal_Plan_v1.0.0.md` — Implementation plan.
7. `docs/walkthrough/crm/CRM_Customer_Hierarchy_Directory_And_Modal_Walkthrough_v1.0.0.md` — Walkthrough document.

## 4. Files Modified
1. `backend/app/api/v1/crm.py` — Enriched customer directory query with hierarchy projections and filter handlers.
2. `backend/app/schemas/crm.py` — Added hierarchy attributes and camelCase aliases to DTOs.
3. `backend/app/tests/conftest.py` — Updated test schema definitions.
4. `backend/tests/conftest.py` — Updated test schema definitions.
5. `src/components/customer/CustMasterWs.tsx` — Integrated relationship column, quick actions, and modal binding.
6. `src/components/customer/corporateWorkspace/CustomerHierarchyTree.tsx` — Added child node status pill and active styling.
7. `src/components/customer/corporate360/CorporateCustomer360.tsx` — Added draft record guard.
8. `src/components/customer/types.ts` — Updated TypeScript types for directory items.
9. `src/tests/customer360DashboardView.test.tsx` — Added unit test for draft customer handling.

## 5. Architecture Decisions
1. **Correlated Scalar Projections over Heavy Joins**:
   - `child_count` and parent identity metadata are computed using correlated scalar subqueries filtered by `company_id` and `is_deleted = false`. This avoids expensive full Cartesian joins and keeps directory response latency within SLA limits.
2. **Dual-Key DTO Aliasing**:
   - Supported both snake_case model fields and camelCase API aliases (`dependantCustomerId`, `dependantCustomerCode`) ensuring zero contract breakage across web clients and third-party callers.
3. **Transparent Code vs UUID Parameter Resolution**:
   - Customer endpoints accept both internal UUIDv7 identifiers and business codes (`CUST-*`, `PAR-*`), resolving parentage seamlessly.
4. **Draft-Aware 360° View Guarding**:
   - Prevents network 404/422 spam by identifying `cust-draft-*` records and rendering an instructional banner to save the customer first.

## 6. Design Rationale
- Operators managing large retail accounts need instant visual distinction between parent enterprises (which hold credit lines and central billing agreements) and subsidiary outlets (which execute daily POS sales).
- Providing one-click "Filter directory to children" directly in the relationship cell eliminates typing repetitive search queries, drastically speeding up store network audits.
- The `CustomerHierarchyModal` provides both an intuitive tree graph and a searchable tabular breakdown, catering to both visual orientation and exact data auditing.

## 7. Implementation Summary
- **Backend API**:
  - `customer_directory`: Extended query logic with `parent_code_expr`, `parent_name_expr`, `parent_status_expr`, `parent_active_expr`, and `child_count`. Added conditional SQL filtering for `relationship in ("parent", "child", "standalone")` and `parent_id`.
  - `list_customer_dependants` & `create_customer_dependant`: Resolved customer identifiers by UUID or code, added status metadata to returned dependant rows, and incorporated BFS cycle detection.
- **Frontend Master Workspace**:
  - Added "Relationship & Hierarchy" column to the directory table in `CustMasterWs.tsx`.
  - Rendered `CustomerDirectoryRelationshipCell` with `Parent Account`, `Child Account`, and `Standalone` badges.
  - Linked child count triggers and table row hierarchy buttons to `setHierarchyModalCustomer`.
  - Added filter reset chips and parent scope indicators when directory is filtered by parent.
- **Frontend Hierarchy Modal**:
  - Displays parent enterprise details (Code, Status, Group, Phone, Email, Child Count).
  - Renders visual hierarchy tree with branch connections.
  - Tabular subordinate list with real-time text filter and status badges.
  - Action buttons to open subordinate in Customer Master ("Edit") or Corporate 360 ("360").

## 8. Tests Executed
1. **Vitest Unit & Integration Suites**:
   - `src/tests/customerHierarchyDirectory.test.tsx` (16 tests passed).
   - `src/tests/customer360DashboardView.test.tsx` (9 tests passed).
   - `src/tests/childCustomerBillingVisibility.test.tsx` (5 tests passed).
   - `src/tests/enterpriseCustomerMasterView.test.tsx` (9 tests passed).
   - `src/tests/corporateCustomer360.test.tsx` (12 tests passed).
   - *Total Frontend Tests*: 51 tests passed (100% green).
2. **Backend Pytest Database-Isolated Suite**:
   - `backend/tests/test_customer_directory_hierarchy.py` (4 tests passed in `smriti_test_phase2c`).
3. **Headless Live API Verification**:
   - `scripts/verify_customer_hierarchy_headless.py` (7 live scenarios executed against running FastAPI SoR container).

## 9. Verification Results
- **Headless API Test 1 (Directory Search `q=ShopperStop`)**: Status 200, 2 matches found. Correctly identified parent `CUST-68351893` (1 child) and child `CUST-68351894` (dependant=True).
- **Headless API Test 2 (Filter `relationship=parent`)**: Status 200, exactly 1 parent record returned.
- **Headless API Test 3 (Filter `relationship=child`)**: Status 200, exactly 1 child record returned.
- **Headless API Test 4 (Filter `parent_id=01a17307-6fb6-7000-a97d-da721ae573f5`)**: Status 200, returned exact subordinate child.
- **Headless API Test 5 (Get Dependants by UUID)**: Status 200, returned child subordinate with code `CUST-68351894` and status `Active`.
- **Headless API Test 6 (Get Dependants by Code `CUST-68351893`)**: Status 200, successfully resolved parent code and returned subordinate.
- **Headless API Test 7 (Single Customer Retrieval)**: Status 200, retrieved details cleanly.
- **Production Build**: `npm run build` compiled 3,743 modules cleanly in 59.95s with zero errors. Web preview verified live on port 8101 (`HTTP 200 OK`).

## 10. Known Limitations
- The hierarchy modal currently displays 2 tiers of hierarchy (Parent Enterprise and Direct Children). Multi-tier hierarchies (Holding Company → Division / Zonal Entity → Store Outlet) are flattened into direct parent linkages in this phase.

## 11. Future Work
- N-tier nested hierarchy graph rendering supporting unlimited recursive parent-child depth.
- Bulk hierarchy assignment wizard allowing operators to select multiple existing customers and assign them to a parent enterprise in one atomic transaction.

## 12. Related ADRs
- `ADR-008`: FastAPI Sole Backend Architecture & PostgreSQL System of Record.
- `ADR-019`: Corporate Customer Model C Multi-Tenant Structure.

## 13. Related RFCs
- `RFC-2026-CRM-01`: Enterprise B2B Customer Hierarchy & Directory Filtering Standard.
