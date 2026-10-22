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

# SMRITI Walkthrough: Report Builder Live Data Binding & Production Query Engine

## 1. Purpose
This walkthrough documents the full elimination of dummy/mock datasets from the **SMRITI BI & Reporting Center → Report Builder** (`ReportBuilder.tsx`), establishing real data binding to PostgreSQL transactional tables through the FastAPI backend query endpoint `/api/v1/reports/builder/query`.

## 2. Scope
- Removal of static hardcoded defaults (`initialData` defaulting to live fetch rather than mock dataset).
- Implementation of backend query schema `ReportBuilderResponse` in `backend/app/schemas/reports.py`.
- Implementation of multi-tenant, parameterized query engine `ReportsService.query_report_builder` in `backend/app/services/reports.py`.
- Routing live query requests through `GET /api/v1/reports/builder/query` in `backend/app/api/v1/reports.py`.
- Wiring frontend React component `src/components/reports/ReportBuilder.tsx` via `apiFetchV1`.
- Loading states (skeleton spinner), error states with retry, honest empty state, dynamic live totals, and server-driven pagination.

## 3. Files Created
- `docs/implementation/reports/Report_Builder_Live_Data_Binding_Plan_v1.1.0.md`
- `src/tests/reportBuilderLiveData.test.ts`
- `docs/walkthrough/reports/Report_Builder_Live_Data_Binding_Walkthrough_v1.1.0.md`

## 4. Files Modified
- `docs/implementation/README.md`
- `docs/walkthrough/README.md`
- `backend/app/schemas/reports.py`
- `backend/app/services/reports.py`
- `backend/app/api/v1/reports.py`
- `src/components/reports/ReportBuilder.tsx`

## 5. Architecture Decisions
- **FastAPI Core System of Record**: Follows SMRITI backend system-of-record policy where all transactional analytical data queries are served via FastAPI + PostgreSQL.
- **Tenant & Boundary Security**: Uses `TenantContext` to strictly constrain query execution to the active tenant's company database and authorized branch boundaries.
- **No Dummy Fallback Policy**: If a query encounters a network or database failure, an error state is displayed with a Retry option. Dummy records are strictly forbidden from masquerading as failed responses.

## 6. Design Rationale
- The Report Builder had previously been created with an adaptive layout and collapsible panels, but the data layer used a static placeholder dataset (`DEFAULT_REPORT_BUILDER_ROWS`) and the Run button only popped a toast notification.
- To make the studio genuinely functional for retail inventory and purchase analytics, live database records must be retrieved, filtered, sorted, and dynamically totaled.

## 7. Implementation Summary
1. **Pydantic Response Envelope**: Defined `ReportBuilderResponse` with `category`, `total_count`, `rows`, `totals`, and `generated_at`.
2. **PostgreSQL Relational Join**: Constructed an optimized SQLAlchemy query joining `purchase_order_items`, `purchase_orders`, `suppliers`, `products`, and `purchase_bills` with indexed tenant and date filters.
3. **API Endpoint**: Exposed `GET /api/v1/reports/builder/query` accepting category, date range, branch, sorting, pagination, and search terms.
4. **Reactive Frontend**: Updated `ReportBuilder.tsx` to automatically trigger `apiFetchV1` on mount and on filter changes, binding live rows, server totals, and accurate pagination.

## 8. Tests Executed
- `npm run lint` (`tsc --noEmit`): PASSED (0 errors).
- `npx vitest run src/tests/reportBuilder.test.ts`: PASSED (16/16 tests green).
- `npx vitest run src/tests/reportBuilderLiveData.test.ts`: PASSED (4/4 tests green).
- Live API integration verification via python test script against `http://localhost:1981/api/v1/reports/builder/query`.

## 9. Verification Results
```text
HTTP Login OK, token received!
HTTP API Response status: 200
HTTP API Category: Purchase
HTTP API Total count: 179
HTTP API Totals: {'quantity': 1716.0, 'net_amount': 1643318.05}
HTTP API Rows count: 2
```
Live database records from `ALIYA FOOTWEAR`, `AK FOOTWEAR`, `LAJOS FOOTWEAR`, and `CRYSTAL SHOES` correctly returned and bound to datatable.

## 10. Known Limitations
- Advanced custom column joining across unrelated disparate modules (e.g., simultaneous arbitrary cross-join of Finance ledger with POS shifts) is bounded to canonical domain aggregations.

## 11. Future Work
- Add user-defined calculated columns (e.g., custom formula editor for markup percentages).
- Add scheduled report builder view exports to Google Drive / S3.

## 12. Related ADRs
- `ADR-002`: Sole FastAPI + Postgres Backend Architecture
- `ADR-014`: Multi-Tenant Data Isolation and TenantContext

## 13. Related RFCs
- `RFC-2026-08`: Universal Report Envelope Contract
