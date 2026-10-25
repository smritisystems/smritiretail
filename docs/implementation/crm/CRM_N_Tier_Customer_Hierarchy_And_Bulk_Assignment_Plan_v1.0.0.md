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
  Classification: Implementation Plan / Architecture
-->

# SMRITI Implementation Plan: CRM N-Tier Recursive Customer Hierarchy & Bulk Subordinate Assignment Wizard (v1.0.0)

## 1. Objective
Architect and deliver an enterprise-grade N-tier recursive customer hierarchy model and interactive bulk assignment wizard in SMRITI Retail OS. This allows enterprise operators to model, visualize, and manage multi-level corporate structures (Holding Company → Zonal Hubs → City Clusters → Store Outlets) and atomically link dozens of accounts to parent entities with full cycle prevention, tenant isolation, and zero-defect UI feedback.

## 2. Business Motivation
Large retail conglomerates (e.g., Reliance Retail Limited, Trent Limited, Shoppers Stop) do not operate in a flat 2-level structure. They manage multi-tier organizational trees where regional distribution hubs act as intermediate parents to individual retail counters while remaining subordinated to the central legal corporate entity. Previously, operators could only view single-level parent-child pairs and were forced to manually link accounts one by one. This caused operational bottlenecks during bulk store onboarding and prevented executive visibility into regional multi-level rollups.

## 3. Scope
- **Backend API & Schema (`backend/app/api/v1/crm.py`, `backend/app/schemas/crm.py`)**:
  - `GET /api/v1/crm/customers/{customer_id}/hierarchy`: Recursive tree endpoint traversing up to the root ancestor and projecting the full recursive descendant tree with `depth`, `path`, and nested `children: [...]`.
  - `POST /api/v1/crm/customers/{parent_id}/bulk-assign-dependants`: Atomic bulk assignment endpoint linking multiple candidate accounts to a designated parent with BFS circular dependency prevention.
  - `GET /api/v1/crm/customers/{parent_id}/assignable-children`: Searchable candidate resolver filtering out existing ancestors, circular paths, and already-linked direct children.
- **Frontend Components & Wizard (`src/components/customer/`)**:
  - `CustomerHierarchyModal.tsx`: Enhanced to display N-tier collapsible tree nodes, root-to-leaf breadcrumbs, and depth level badges.
  - `BulkAssignCustomerModal.tsx`: High-density assignment wizard with real-time candidate search, group filters, multi-select checkboxes, and batch commit.
  - `CustomerHierarchyTree.tsx`: Recursive multi-level node renderer with level indentation, branch lines, and expand/collapse controls.
- **Testing & Verification**:
  - Frontend Vitest suites validating recursive rendering, tree node expand/collapse, and bulk assignment wizard workflows.
  - Database-isolated pytest suite verifying 3+ level hierarchy traversal, root resolution, cycle rejection, and atomic bulk assignment.
  - Headless API verification script validating live multi-tier creation and bulk linking against the running containerized FastAPI backend.

## 4. Current State
- `CustomerHierarchyModal` only fetches direct 1-level dependants of the selected customer. Intermediate parents in a 3-tier structure do not display their parent above them or nested grandchildren below them.
- Creating relationships requires individual single-row POST requests to `/crm/customers/{id}/dependants`, which is prohibitive when onboarding 50+ stores.
- Draft customer records are safely guarded, but bulk operations lack a unified transactional workflow.

## 5. Gap Analysis
1. **Multi-Level Representation**: No recursive data structure existed to represent grandchildren or intermediate parent nodes.
2. **Root Ancestor Discovery**: Querying an outlet directly failed to discover the ultimate holding corporation without manual uphill navigation.
3. **Bulk Onboarding Inefficiency**: No multi-select batch assignment capability existed in the UI or backend.
4. **Candidate Validation Filter**: Operators had to know customer IDs in advance; no endpoint existed to query valid unlinked candidates safe from circular loops.

## 6. Architecture Impact
- Fully compliant with SMRITI Canonical System-of-Record principles: FastAPI + PostgreSQL remains the sole backend.
- Pure relational graph traversal on `customer_relationships` with indexed foreign keys (`parent_customer_id`, `dependant_customer_id`, `company_id`, `is_deleted`).
- Zero database migrations required; fully compatible with existing PostgreSQL table contracts.
- Strictly tenant-isolated: cross-company relationships are prohibited.

## 7. Proposed Design
1. **Recursive Hierarchy Engine**:
   - Resolve requested customer by UUID or code.
   - Uphill root search: follow `parent_customer_id` ancestors up to the topmost root node (with safety cap `depth <= 10`).
   - Downhill recursive tree assembly: breadth-first recursive projection of all children, grandchildren, and subsequent tiers.
2. **Bulk Assignment Engine**:
   - Atomic transaction with rollback on validation failure.
   - Iterative cycle check verifying candidate `C` is not in ancestor set of parent `P`.
   - Update `Customer.is_dependant = True` and insert `CustomerRelationship` rows.
3. **Wizard UI Design**:
   - Dual-column or search-and-select checklist with badge indicators (`Standalone`, `Independent`).
   - Single-click "Select All" with counter.
   - Instant optimistic feedback and tree refresh.

## 8. Files Created
1. `src/components/customer/BulkAssignCustomerModal.tsx`
2. `src/components/customer/CustomerHierarchyTree.tsx`
3. `backend/tests/test_customer_ntier_hierarchy_and_bulk_assign.py`
4. `src/tests/customerNTierHierarchyAndBulkAssign.test.tsx`
5. `scripts/verify_ntier_customer_hierarchy_headless.py`
6. `docs/implementation/crm/CRM_N_Tier_Customer_Hierarchy_And_Bulk_Assignment_Plan_v1.0.0.md`
7. `docs/walkthrough/crm/CRM_N_Tier_Customer_Hierarchy_And_Bulk_Assignment_Walkthrough_v1.0.0.md`

## 9. Files Modified
1. `backend/app/api/v1/crm.py`
2. `backend/app/schemas/crm.py`
3. `src/components/customer/CustomerHierarchyModal.tsx`
4. `src/components/customer/types.ts`
5. `CHANGELOG.md`
6. `docs/implementation/README.md`
7. `docs/walkthrough/README.md`

## 10. Dependencies
- React 18, Lucide React icons, Tailwind CSS tokens.
- FastAPI, SQLAlchemy 2.0 async engine, Pydantic v2.
- PostgreSQL 15 `customer_relationships` and `customers` tables.

## 11. Risks
- Deeply nested graphs (>10 levels) causing recursion stack issues or memory spikes:
  - *Mitigation*: Hard recursion depth limit of 10 enforced in both backend traversal and frontend tree renderer.
- Concurrent modification of relationships during bulk assignment:
  - *Mitigation*: Row-level locking on parent and candidate rows in bulk assignment handler.

## 12. Rollback Strategy
- Soft-deletion support: relationships can be individually unlinked or bulk soft-deleted by setting `is_deleted = True`.
- Zero database DDL changes; code rollback requires only Git revert of application files.

## 13. Verification Plan
- Headless API test script `scripts/verify_ntier_customer_hierarchy_headless.py` exercising 3-tier creation (Holding → Zonal Hub → Store Outlets) and bulk assignment.
- Pytest suite in `smriti_test_phase2c` testing recursive tree building, cycle rejection, and bulk assignment endpoints.
- Vitest suites validating recursive tree rendering, expand/collapse toggles, candidate filtering, and wizard interactions.
- Production bundle build (`npm run build`) ensuring zero TypeScript compilation errors.

## 14. Test Plan
- Unit test: recursive tree projection with 3 levels.
- Unit test: bulk assignment wizard candidate search and selection.
- Unit test: circular dependency rejection in bulk assignment.
- Unit test: breadcrumbs and depth badge display.

## 15. Documentation Impact
- Walkthrough document created in `docs/walkthrough/crm/`.
- Master indexes updated in `docs/walkthrough/README.md` and `docs/implementation/README.md`.
- `CHANGELOG.md` updated under `[Unreleased]`.

## 16. Deployment Plan
- Build frontend with `npm run build`.
- Copy built `dist` to `smriti-web` container.
- Validate HTTP response on port 8101 and API on port 8000.

## 17. Status
Completed

## 18. Related ADRs
- `ADR-008`: FastAPI Sole Backend Architecture & System-of-Record Governance.
- `ADR-019`: Corporate Customer Model C Tenant Architecture.

## 19. Related Walkthroughs
- `CRM_Customer_Hierarchy_Directory_And_Modal_Walkthrough_v1.0.0.md`
- `CRM_Reliance_Retail_Parent_Child_Customer_Hierarchy_v1.0.0.md`
- `CRM_N_Tier_Customer_Hierarchy_And_Bulk_Assignment_Walkthrough_v1.0.0.md`
