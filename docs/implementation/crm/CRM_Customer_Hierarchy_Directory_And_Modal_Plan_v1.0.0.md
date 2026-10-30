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
  Classification: Implementation Plan / Architecture
-->

# SMRITI Implementation Plan: CRM Customer Hierarchy Directory & Interactive Tree Modal (v1.0.0)

## 1. Objective
Enable retail and enterprise corporate operators to discover, inspect, filter, and navigate full multi-tier customer hierarchies (Parent Holding Companies, Subsidiary Store Networks, Operating Outlets, and Independent Standalone Merchants) directly from the primary Customer Master Workspace directory (`CustMasterWs.tsx`) with zero latency, full tenant isolation, and live bidirectional modal drilldown (`CustomerHierarchyModal.tsx`).

## 2. Business Motivation
B2B corporate clients (e.g., Reliance Retail Limited, Shoppers Stop, Aditya Birla Fashion) operate dozens of store outlets across different commercial regions and GSTIN registrations subordinated to central parent entities. In standard retail ERP directories, child store accounts were displayed as disjointed individual rows without immediate visibility into their parent corporate entity, total child store footprint, or sibling networks. Operators required a frictionless, single-click mechanism to identify hierarchical relationships, filter directory views to specific parent groups, and visually explore the full hierarchy tree without leaving their current workflow.

## 3. Scope
- **Backend (`backend/app/api/v1/crm.py`, `backend/app/schemas/crm.py`)**:
  - Enrich `GET /api/v1/crm/customers/directory` with canonical hierarchy indicators: `child_count`, `relationship_type` (`"parent"` | `"child"` | `"standalone"`), `parent_customer_code`, `parent_customer_name`, `primary_account_status`, and `primary_account_is_active`.
  - Add query parameter filters: `relationship` (`all`, `parent`, `child`, `standalone`), `parent_id` (UUID or code filter), and `sort_by=child_count`.
  - Support transparent resolution of both UUID and business Code in `GET /api/v1/crm/customers/{customer_id}/dependants` and `POST /api/v1/crm/customers/{customer_id}/dependants`.
  - Enforce cyclic ancestor relationship prevention with breadth-first graph traversal.
  - Gracefully handle inactive, unlinked, and soft-deleted parents with non-blocking outer joins.
- **Frontend (`src/components/customer/`)**:
  - Introduce dedicated `CustomerDirectoryRelationshipCell.tsx` displaying distinct badges (`Parent Account`, `Child Account`, `Standalone`) and clickable child count / parent links.
  - Implement full-featured `CustomerHierarchyModal.tsx` displaying dual-pane and tree visual representations, parent status warnings, search/filter, and direct navigation affordances (`Edit`, `Corporate 360`, `Filter Directory`).
  - Integrate hierarchy controls and filters into `CustMasterWs.tsx`.
- **Automated Testing & Headless Verification**:
  - Vitest component and modal unit tests (`src/tests/customerHierarchyDirectory.test.tsx`).
  - Backend isolation-safe pytest suite (`backend/tests/test_customer_directory_hierarchy.py`).
  - Headless API test script (`scripts/verify_customer_hierarchy_headless.py`).

## 4. Current State
Previously, `/crm/customers/directory` only returned basic customer records without joining relationship child counts or resolving parent active status. In the directory table, child records only showed a subtle subtitle `Child of ...`, while parent accounts showed no child counts or hierarchy modal triggers. Furthermore, draft customer records opened in `CorporateCustomer360.tsx` attempted to query live `/360` endpoints before being saved, triggering unnecessary 404/422 errors.

## 5. Gap Analysis
1. **Lack of Relationship Aggregate in Directory**: Directory queries did not aggregate children per parent, requiring separate N+1 queries.
2. **Missing Hierarchy Filter Controls**: Operators could not filter directory listings to only parent accounts or isolated children of a specific enterprise.
3. **Absence of Central Tree Inspection Modal**: Operators had to navigate into Corporate 360 to see hierarchy trees, disrupting high-volume directory operations.
4. **Draft Customer 360 API Errors**: Unsaved new customers (`cust-draft-*`) triggered live API fetches in `CorporateCustomer360.tsx`.

## 6. Architecture Impact
- Enforces SMRITI Canonical System-of-Record principles: FastAPI + PostgreSQL remains the sole backend.
- Pure database subquery projection without altering underlying table schemas or creating ad-hoc tables.
- Leverages existing `customer_relationships` table (`parent_customer_id`, `dependant_customer_id`, `is_deleted`).
- Zero migration requirement; fully backward-compatible DTO aliasing (`camelCase` and `snake_case`).

## 7. Proposed Design
1. **Directory Aggregation**: Use correlated scalar subqueries and `count(customer_relationships.id)` joined with `is_deleted = false` and company boundary checks.
2. **Relationship Classification**:
   - `child_count > 0` => `"parent"`
   - `is_dependant == true` or `parent_customer_id != null` => `"child"`
   - otherwise => `"standalone"`
3. **Frontend Component Architecture**:
   - `CustomerDirectoryRelationshipCell`: High-density badge with drilldown triggers.
   - `CustomerHierarchyModal`: Modal containing parent card, hierarchy tree, subordinate data table, search input, status filters, and action buttons.

## 8. Files Created
1. `src/components/customer/CustomerDirectoryRelationshipCell.tsx`
2. `src/components/customer/CustomerHierarchyModal.tsx`
3. `backend/tests/test_customer_directory_hierarchy.py`
4. `src/tests/customerHierarchyDirectory.test.tsx`
5. `scripts/verify_customer_hierarchy_headless.py`

## 9. Files Modified
1. `backend/app/api/v1/crm.py`
2. `backend/app/schemas/crm.py`
3. `backend/app/tests/conftest.py`
4. `backend/tests/conftest.py`
5. `src/components/customer/CustMasterWs.tsx`
6. `src/components/customer/corporateWorkspace/CustomerHierarchyTree.tsx`
7. `src/components/customer/corporate360/CorporateCustomer360.tsx`
8. `src/components/customer/types.ts`
9. `src/tests/customer360DashboardView.test.tsx`

## 10. Dependencies
- React 18, Lucide React icons, Tailwind CSS design system.
- FastAPI, SQLAlchemy 2.0 async engine, Pydantic v2.
- PostgreSQL 15 (`customer_relationships`, `customers`).

## 11. Risks
- Potential query slowdown on directories with hundreds of thousands of customer records:
  - *Mitigation*: Scalar subqueries are constrained by tenant filters and indexed foreign keys (`ix_customer_relationships_parent_customer_id`, `ix_customer_relationships_dependant_customer_id`).
- Circular relationship creation:
  - *Mitigation*: Cyclic ancestor prevention BFS traversal implemented in `create_customer_dependant`.

## 12. Rollback Strategy
- All API schema additions are optional non-breaking fields with default fallbacks.
- Reverting the Git commit instantly restores legacy directory behavior without database schema rollback or data loss.

## 13. Verification Plan
- Headless live verification script `scripts/verify_customer_hierarchy_headless.py` exercising 7 real API scenarios.
- Backend pytest test suite targeting isolated test database `smriti_test_phase2c`.
- Frontend Vitest suites validating DOM rendering, badge presentation, child counts, inactive parent warnings, and modal interactions.
- Production bundle build (`npm run build`) ensuring zero TypeScript compilation errors.

## 14. Test Plan
- Unit tests: Badge and cell rendering under parent, child (active parent), child (inactive parent), child (unlinked parent), and standalone.
- Modal tests: Open/close, filter triggers, navigation callbacks, empty states.
- Backend tests: Directory sorting, filtering by relationship type, parent ID filtering, cross-branch alias compatibility, code/UUID duality.

## 15. Documentation Impact
- Update `docs/walkthrough/crm/CRM_Customer_Hierarchy_Directory_And_Modal_Walkthrough_v1.0.0.md`.
- Append master index in `docs/walkthrough/README.md` and `docs/implementation/README.md`.

## 16. Deployment Plan
- Build frontend via `npm run build`.
- Deploy updated assets to web preview container `smriti-web`.
- Verify live HTTP responses on port 8101 (web) and port 8000/1981 (api).

## 17. Status
Completed

## 18. Related ADRs
- `ADR-008`: FastAPI Sole Backend Architecture & System-of-Record Governance.
- `ADR-019`: Corporate Customer Model C Tenant Architecture.

## 19. Related Walkthroughs
- `CRM_Corporate_Customer_Master_Workspace_Transformation_v6.99.0.md`
- `CRM_Reliance_Retail_Parent_Child_Customer_Hierarchy_v1.0.0.md`
- `CRM_Customer_Hierarchy_Directory_And_Modal_Walkthrough_v1.0.0.md`
