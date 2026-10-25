<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.99.1
  Created      : 2026-10-26
  Modified     : 2026-10-26
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Walkthrough Document
-->

# SMRITI Walkthrough: CRM N-Tier Recursive Customer Hierarchy & Bulk Subordinate Assignment Wizard (v1.0.0)

## 1. Purpose
This walkthrough documents the design, implementation, and multi-gate headless verification of the enterprise N-tier recursive customer hierarchy model and the interactive bulk child assignment wizard in SMRITI Retail OS. It enables enterprise operators to visualize, navigate, and manage multi-level corporate structures (Holding Company → Zonal/Regional Hubs → Store Outlets) with automated cycle prevention, candidate filtering, and breadcrumb ancestry tracking.

## 2. Scope
- **Backend Graph Traversal & Bulk Endpoints (`backend/app/api/v1/crm.py`)**:
  - `GET /api/v1/crm/customers/{customer_id}/hierarchy`: Recursive tree projection traversing uphill to root holding corporation and recursively querying descendant branches.
  - `POST /api/v1/crm/customers/{customer_id}/bulk-assign-dependants`: Transactional bulk assignment linking multiple candidate accounts under a target parent.
  - `GET /api/v1/crm/customers/{customer_id}/assignable-children`: Candidate customer search excluding self, ancestors, and direct children.
- **Frontend Components & Interactive Modals (`src/components/customer/`)**:
  - `CustomerHierarchyTree.tsx`: Recursive multi-level branch renderer with depth badges, ancestry breadcrumbs, and bulk assignment triggers.
  - `BulkAssignCustomerModal.tsx`: Searchable candidate selection wizard with select-all, relationship dropdowns, and batch assignment commit.
  - `CustomerHierarchyModal.tsx`: Integrated N-tier tree display, bulk assignment triggers for parent and standalone accounts, and live tree reload.
- **Automated Test Suites**:
  - Pytest isolated database suite: `backend/tests/test_customer_ntier_hierarchy_and_bulk_assign.py` (4/4 passed).
  - Vitest frontend unit test suite: `src/tests/customerNTierHierarchyAndBulkAssign.test.tsx` (7/7 passed).
  - Live container headless verification: `scripts/verify_ntier_customer_hierarchy_headless.py` (6/6 gates passed).

## 3. Files Created
1. `src/components/customer/BulkAssignCustomerModal.tsx`
2. `src/components/customer/CustomerHierarchyTree.tsx`
3. `backend/tests/test_customer_ntier_hierarchy_and_bulk_assign.py`
4. `src/tests/customerNTierHierarchyAndBulkAssign.test.tsx`
5. `scripts/verify_ntier_customer_hierarchy_headless.py`
6. `docs/implementation/crm/CRM_N_Tier_Customer_Hierarchy_And_Bulk_Assignment_Plan_v1.0.0.md`
7. `docs/walkthrough/crm/CRM_N_Tier_Customer_Hierarchy_And_Bulk_Assignment_Walkthrough_v1.0.0.md`

## 4. Files Modified
1. `backend/app/api/v1/crm.py`: Added `get_customer_hierarchy_tree`, `bulk_assign_customer_dependants`, and `list_assignable_children`.
2. `backend/app/schemas/crm.py`: Added `CustomerHierarchyNodeResponse`, `CustomerHierarchyTreeResponse`, `BulkAssignDependantsRequest`, `BulkAssignDependantsResponse`, `AssignableChildCandidate`.
3. `src/components/customer/CustomerHierarchyModal.tsx`: Integrated recursive N-tier tree, bulk assign triggers, and `BulkAssignCustomerModal` mounting.
4. `src/components/customer/types.ts`: Added TypeScript interfaces for hierarchy tree nodes, bulk assign DTOs, and candidate accounts.
5. `CHANGELOG.md`: Logged additions under `[Unreleased]`.
6. `docs/implementation/README.md`: Appended master index.
7. `docs/walkthrough/README.md`: Appended master index.

## 5. Architecture Decisions
1. **Canonical System of Record Integrity**: FastAPI + PostgreSQL remains the sole backend. All customer hierarchies are persisted exclusively in PostgreSQL `customer_relationships` with strict tenant isolation (`company_id`).
2. **Uphill-Then-Downhill Traversal**: When an outlet at tier 2 or 3 is queried, the algorithm traces uphill via `parent_customer_id` until finding the node with no active parent (root holding company), then recursively descends to construct the complete multi-tier tree.
3. **Circular Reference Prevention**: In both candidate filtering and bulk assignment commit, a Breadth-First Search (BFS) collects all ancestors of the target parent. Any attempt to link an ancestor or self as a child is rejected with explicit diagnostic warnings.
4. **Zero Database Migrations Required**: Built entirely on existing PostgreSQL schema contracts (`customers`, `customer_relationships`), avoiding schema locks or downtime.

## 6. Design Rationale
- **Breadcrumb Ancestry Navigation**: Allows retail operators to immediately see the full managerial lineage (`Holding Corp > North Region Hub > Bandra Store`) regardless of which node was initially opened.
- **Dedicated Candidate Query**: Instead of loading all customers into the frontend and filtering client-side, candidate evaluation (cycle checks and ancestor exclusions) is performed in PostgreSQL with SQL index acceleration.
- **Dual Modal Integration**: Bulk assignment is accessible both directly from `CustomerHierarchyModal` (for parents and standalone accounts) and from individual nodes inside `CustomerHierarchyTree`.

## 7. Implementation Summary
- **Backend Schemas**: Created typed Pydantic models with camelCase population aliases for JSON API parity.
- **Backend Endpoints**: Implemented BFS recursive traversal with max depth safeguard (10 levels). Handled both customer ID (UUID) and business customer code (`code`) transparently.
- **Frontend Component Tree**: Developed `CustomerHierarchyTree` supporting arbitrary depth nesting with depth badges (`Root Holding`, `Zonal / Hub`, `Tier N Outlet`).
- **Bulk Assignment Wizard**: Developed `BulkAssignCustomerModal` with live search, standalone filtering, select-all checkboxes, relationship designation dropdown, and error handling.

## 8. Tests Executed

### 1. Pytest Backend Isolated Database Suite
Command: `cmd /c "set PYTHONPATH=f:\SMRITRretailNX\backend && f:\SMRITRretailNX\.venv\Scripts\pytest.exe backend/tests/test_customer_ntier_hierarchy_and_bulk_assign.py -v"`
Output:
```
============================= test session starts =============================
platform win32 -- Python 3.11.9, pytest-8.2.1, pluggy-1.6.0 -- F:\SMRITRretailNX\.venv\Scripts\python.exe
rootdir: F:\SMRITRretailNX\backend
configfile: pyproject.toml
plugins: anyio-4.15.1, asyncio-0.23.7, cov-5.0.0
asyncio: mode=Mode.AUTO
collected 4 items

backend\tests\test_customer_ntier_hierarchy_and_bulk_assign.py::test_ntier_recursive_hierarchy_expansion PASSED [ 25%]
backend\tests\test_customer_ntier_hierarchy_and_bulk_assign.py::test_bulk_assign_dependants_atomic PASSED [ 50%]
backend\tests\test_customer_ntier_hierarchy_and_bulk_assign.py::test_bulk_assign_cycle_prevention PASSED [ 75%]
backend\tests\test_customer_ntier_hierarchy_and_bulk_assign.py::test_assignable_children_candidates_exclusion PASSED [100%]

================== 4 passed, 16 warnings in 86.63s (0:01:26) ==================
```

### 2. Vitest Frontend Unit Test Suite
Command: `npx vitest run src/tests/customerNTierHierarchyAndBulkAssign.test.tsx`
Output:
```
 RUN  v4.1.11 F:/SMRITRretailNX

 ✓ src/tests/customerNTierHierarchyAndBulkAssign.test.tsx (7 tests) 32ms

 Test Files  1 passed (1)
      Tests  7 passed (7)
   Start at  01:44:57
   Duration  1.55s (transform 977ms, setup 0ms, import 1.25s, tests 32ms, environment 0ms)
```

### 3. Headless Container Live Verification Script
Command: `docker exec -i smriti-api python /workspace/scripts/verify_ntier_customer_hierarchy_headless.py`
Output:
```
======================================================================
 SMRITI RETAIL OS: HEADLESS N-TIER HIERARCHY & BULK ASSIGN SUITE
======================================================================

[Step 1] Creating 3-tier customer accounts and candidate accounts...
  ✓ Root Holding Created: Titan Holding Group 959874 (TITAN-959874) [ID: 01a174bc-b086-7000-a1ef-3ceb1f5041c6]
  ✓ Regional Hub Created: Titan West Hub 959874 (HUB-959874) [Parent: 01a174bc-b086-7000-a1ef-3ceb1f5041c6]
  ✓ Store Outlets Created: STR1-959874 & STR2-959874 under Hub [01a174bc-b126-7000-966f-faad4694df82]
  ✓ Standalone Candidates Created: CND1-959874 & CND2-959874

[Step 2] Testing N-tier recursive hierarchy discovery from leaf node (Store 1)...
  ✓ Verified 3-tier hierarchy tree: Root [TITAN-959874] -> Hub [HUB-959874] -> 2 Outlets

[Step 3] Testing assignable children candidate query for Regional Hub...
  ✓ Candidate filtering passed: 100 eligible accounts found; self, ancestors, and direct children correctly excluded

[Step 4] Testing bulk assignment of 2 candidates to Regional Hub...
  ✓ Bulk assign successful: 2 accounts linked under Hub [HUB-959874]

[Step 5] Testing cycle rejection: attempting to assign Root Holding under Store 1...
  ✓ Cycle prevention passed: 2 invalid assignments rejected with errors: ["Cycle rejected: 'Titan Holding Group 959874' (TITAN-959874) is already an ancestor of 'Titan Store Bandra 959874'", "Cannot assign parent 'Titan Store Bandra 959874' (STR1-959874) to itself"]

[Step 6] Verifying expanded hierarchy tree now contains 6 total nodes...
  ✓ Hierarchy verified: Hub [HUB-959874] now controls 4 subordinate stores across 2 tiers

======================================================================
 ALL 6 HEADLESS VERIFICATION GATES PASSED (100% SUCCESS)
======================================================================
```

### 4. Production Bundle Build Verification
Command: `npm run build`
Output: `✓ built in 55.95s` (Exit code 0, zero TypeScript errors).

## 9. Verification Results
All tests and live headless assertions passed with 100% green status:
- Recursive multi-level hierarchy expansion: **Done**
- Breadcrumb ancestry path computation: **Done**
- BFS cycle detection & rejection: **Done**
- Candidate filtering & exclusion: **Done**
- Bulk subordinate assignment wizard: **Done**
- Zero-browser headless verification: **Done**

## 10. Known Limitations
- Hierarchies deeper than 10 levels are capped to prevent unbounded recursion or deep rendering performance degradation.
- Cross-company linking is deliberately blocked by multi-tenant security rules.

## 11. Future Work
- Drag-and-drop hierarchy reorganization in visual tree.
- Consolidated multi-tier financial credit exposure roll-up across all subordinate levels.

## 12. Related ADRs
- `ADR-008`: FastAPI Sole Backend Architecture & System-of-Record Governance.
- `ADR-019`: Corporate Customer Model C Tenant Architecture.

## 13. Related RFCs
- `RFC-CRM-004`: Recursive Enterprise Customer Hierarchy Specification.
- `RFC-CRM-005`: Bulk Subordinate Onboarding Protocol.
