<!--
  Project      : SMRITI Retail OS
  Repository   : SMRITIRetailNX
  Organization : AITDL NETWORKS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 1.1.0
  Created      : 2026-10-22
  Modified     : 2026-10-22
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# SMRITI Report Builder: Live Data Binding & Production Query Engine Plan

## 1. Objective
Eliminate all dummy, mock, and hardcoded datasets from the **SMRITI BI & Reporting Center → Report Builder** (`ReportBuilder.tsx`). Establish end-to-end data binding from PostgreSQL transactional tables through the FastAPI backend (`/api/v1/reports/builder/query`) to the interactive UI datatable with real data fetching, server-side pagination, parameterized filtering, loading states, honest empty states, and dynamic totals.

## 2. Business Motivation
Retail decision-makers, inventory managers, and store managers relying on SMRITI BI & Reporting Center must see real, auditable business data. Hardcoded mock records (e.g., "ABC Footwear", "PO-2025-001", "INV-8801") and un-wired buttons erode trust and prevent users from analyzing live purchases, inventory positions, and supplier commitments.

## 3. Scope
- **Backend**:
  - Pydantic schemas for query request and report builder response envelopes in `backend/app/schemas/reports.py`.
  - Production query implementation in `backend/app/services/reports.py` querying PostgreSQL `purchase_orders`, `purchase_order_items`, `suppliers`, `products`, and `purchase_bills`.
  - Exposing endpoint `GET /api/v1/reports/builder/query` in `backend/app/api/v1/reports.py`.
- **Frontend**:
  - Rewiring `src/components/reports/ReportBuilder.tsx` to fetch real data via `apiFetchV1`.
  - Connecting "Run", Date Range, and Branch filters to execute live queries.
  - Adding loading skeleton, error states with retry, and an honest empty state ("No purchase records found...").
  - Dynamically aggregating live quantities and net amounts from actual rows.
- **Verification**:
  - Direct database read verification comparing Postgres rows with UI data.
  - Automated unit test ensuring data binding and non-dummy fallback behavior.

## 4. Current State
- `src/components/reports/ReportBuilder.tsx` defines static constant `DEFAULT_REPORT_BUILDER_ROWS` (6 footwear rows totaling 132 units and ₹66,500).
- State defaults to `initialData = DEFAULT_REPORT_BUILDER_ROWS`.
- Action button "Run" only triggers a visual toast notification without performing any network or database call.
- The PostgreSQL database has 28 real purchase orders, 407 purchase order items, 159 suppliers, and 2,299 products, but none were surfaced to the Report Builder.

## 5. Gap Analysis
| Component | Existing Implementation | Required Production Implementation |
| :--- | :--- | :--- |
| **Backend API** | No report builder query endpoint in `/api/v1/reports` | Implement `GET /api/v1/reports/builder/query` with tenant & branch boundaries |
| **Backend Service** | No dynamic multi-column aggregator for builder | `ReportsService.query_report_builder` querying canonical tables with joins |
| **Frontend Data Fetch** | No `apiFetchV1` call; static state only | `apiFetchV1("/reports/builder/query")` on mount & on Run/Filter trigger |
| **Empty State** | None (always shows 6 mock rows) | Honest empty state with actionable message when no matching records exist |
| **Error Handling** | None | User-friendly error alert with Retry button; zero silent fallback to dummy data |
| **Totals Calculation** | Client reducer over mock array | Dynamic calculation over live result set and server summary envelope |

## 6. Architecture Impact
- **Database**: Zero schema changes required. Reuses existing indexed PostgreSQL tables (`purchase_orders`, `purchase_order_items`, `suppliers`, `products`, `purchase_bills`).
- **FastAPI Core**: Adds `/api/v1/reports/builder/query` respecting `TenantContext`, multi-tenant company isolation, and RBAC permissions.
- **Frontend**: Preserves all existing collapsible panels, focus modes, and layout state persistence while replacing the mock data engine with reactive live querying.

## 7. Proposed Design
```text
React ReportBuilder (src/components/reports/ReportBuilder.tsx)
    │
    ▼ (apiFetchV1 GET /api/v1/reports/builder/query?category=Purchase&branch_id=...&start_date=...)
FastAPI Route (backend/app/api/v1/reports.py)
    │
    ▼ Depends(get_company_db), Depends(get_tenant_context)
ReportsService.query_report_builder (backend/app/services/reports.py)
    │
    ▼ SQLAlchemy Async Query with joins & company/branch isolation
PostgreSQL Database (smriti-db:5432 / smritisys)
    [purchase_orders] ── [purchase_order_items] ── [products]
            │
            ├── [suppliers]
            └── [purchase_bills]
```

## 8. Files Created
- `docs/implementation/reports/Report_Builder_Live_Data_Binding_Plan_v1.1.0.md`
- `src/tests/reportBuilderLiveData.test.ts`
- `docs/walkthrough/reports/Report_Builder_Live_Data_Binding_Walkthrough_v1.1.0.md`

## 9. Files Modified
- `docs/implementation/README.md`
- `docs/walkthrough/README.md`
- `backend/app/schemas/reports.py`
- `backend/app/services/reports.py`
- `backend/app/api/v1/reports.py`
- `src/components/reports/ReportBuilder.tsx`

## 10. Dependencies
- FastAPI `APIRouter`, SQLAlchemy async session, PostgreSQL 15, `apiFetchV1`.

## 11. Risks
- Large purchase datasets could degrade UI performance without pagination.
- *Mitigation*: Implement default query limit (100 rows) with parameterized server pagination and indexed joins.

## 12. Rollback Strategy
- Changes are fully backwards compatible. Reverting `ReportBuilder.tsx` and `reports.py` restores the previous layout state without database schema migration risks.

## 13. Verification Plan
- Execute literal SQL queries in `smriti-db` to verify supplier names, PO numbers, SKU codes, and quantities.
- Execute HTTP requests against FastAPI endpoint `http://localhost:1981/api/v1/reports/builder/query`.
- Verify frontend rendering in browser/unit tests for loading, empty, and data-bound states.

## 14. Test Plan
- Run `npm test src/tests/reportBuilderLiveData.test.ts` using Vitest.
- Run `npm run lint` (`tsc --noEmit`) to verify zero TypeScript errors.

## 15. Documentation Impact
- Update Walkthroughs index and add comprehensive Walkthrough v1.1.0 in `docs/walkthrough/reports/`.

## 16. Deployment Plan
- Push code to repository and rebuild container or hot-reload Vite and FastAPI.

## 17. Status
- In Progress

## 18. Related ADRs
- `ADR-002`: Sole FastAPI + Postgres Backend Architecture
- `ADR-014`: Multi-Tenant Data Isolation and TenantContext

## 19. Related Walkthroughs
- `docs/walkthrough/reports/Report_Builder_Collapsible_Panels_And_Focus_Mode_v1.0.0.md`
