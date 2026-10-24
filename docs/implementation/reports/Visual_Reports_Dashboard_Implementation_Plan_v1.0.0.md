<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.94.0
  Created      : 2026-10-17
  Modified     : 2026-10-17
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Implementation Plan (IPGP Compliant)
-->

# Visual Reports Dashboard Implementation Plan (Orders, Packing & Stock Flow)

## 1. Objective
Implement the approved, pixel-perfect SMRITI Retail OS Visual Reports Dashboard replicating the design specifications across top navigation, global filters, horizontal KPI card strip, stock flow timeline analytics, order-to-invoice workflow progress, category reservation analysis, top SKU ranking, packing slip donut distribution, dispatch/invoice summary, and an active fulfillment stream table with a fully persistent configuration drawer.

## 2. Business Motivation
Enterprise omnichannel retail operations demand high-density visual telemetry over multi-echelon stock and fulfillment pipelines. Cashiers, floor managers, and executives require instant visibility into on-hand vs reserved vs available inventory, bottlenecked packing slips, and order-to-invoice cycle times without executing batch SQL queries or switching between decoupled sales and warehouse tools.

## 3. Scope
- Exact visual replication of the approved layout: 2-deck focused layout, navy header (`#0d1e3a`), card borders, responsive charts, and drawer controls.
- Real transactional data backend endpoints (`/api/v1/reports/visual-dashboard/*`).
- Recharts stock flow timeline supporting Line, Area, and Bar chart configurations.
- Real PostgreSQL ledger reconciliation for stock reservations, packing slips, dispatches, and sales invoices.
- Fully interactive right-side Dashboard Configuration drawer with layout toggles, widget checkboxes, chart type selection, data display presets, and theme selector.
- Full local and server-side configuration persistence.

## 4. Current State
Previously, SMRITI Retail OS featured tabular report builders and basic BI catalog lists within `ReportDesignerTab.tsx`. There was no unified, real-time visual telemetry dashboard correlating order intake, packing slip verification, dispatch transit, and statutory invoice generation in a single visual canvas.

## 5. Gap Analysis
- Missing visual KPI cards for On-Hand, Reserved, Available, Sales Orders, Packing Slips, and Dispatches.
- Missing Stock Flow 14-day timeline visualization with interactive view mode toggle (Quantity vs Value).
- Missing Order-to-Invoice 4-stage pipeline tracker.
- Missing Category-wise and SKU-level reservation matrices.
- Missing interactive sliding configuration drawer with immediate DOM response and persistence.

## 6. Architecture Impact
- Reuses existing PostgreSQL models (`Dashboard`, `StockMovement`, `Product`, `PackingSlip`, `Dispatch`, `SalesOrderReservation`, `SalesInvoice`).
- Does NOT introduce secondary backends; strictly complies with FastAPI + Postgres sole backend architecture.
- Full preflight architecture governance certification via `.architecture/certificates/`.

## 7. Proposed Design
- Frontend: `VisualReportsDashboardTab.tsx` loaded lazily via `TabRenderer.tsx` and cataloged in `launchpadCatalog.ts`.
- Backend: `visual_reports.py` (Pydantic DTO contracts) and `visual_reports_service.py` (business reconciliation engine).
- UI Configuration Engine: Dual-tier caching combining immediate `localStorage` hydration with transactional DB persistence via `Dashboard` entity.

## 8. Files Created
- `backend/app/schemas/visual_reports.py`
- `backend/app/services/visual_reports_service.py`
- `src/components/reports/visualReportsTypes.ts`
- `src/components/reports/VisualReportsDashboardTab.tsx`
- `src/tests/visualReportsDashboard.test.ts`
- `.architecture/certificates/PF-2026-1017-088833.json`
- `.architecture/certificates/PF-2026-1017-C06D7F.json`
- `.architecture/certificates/PF-2026-1017-32429E.json`

## 9. Files Modified
- `backend/app/api/v1/reports.py`
- `src/components/shell/TabRenderer.tsx`
- `src/components/launchpad/launchpadCatalog.ts`
- `src/components/shell/AppShell.tsx`
- `src/components/ReportDesignerTab.tsx`

## 10. Dependencies
- `recharts` (^2.12.7)
- `lucide-react` (^0.395.0)
- `fastapi` & `sqlalchemy` (asyncpg)

## 11. Risks
- Large catalog aggregations could introduce latency: mitigated via indexed database queries and bounded date ranges.
- Layout shift when hiding widgets: mitigated via CSS grid with conditional column spanning.

## 12. Rollback Strategy
All changes are modular and encapsulated under the `visual-reports` route identifier. Reverting git commits restores the previous `ReportDesignerTab` state without touching sales, billing, or ledger code.

## 13. Verification Plan
- TypeScript compile validation (`tsc --noEmit`).
- Vitest automated suite (`src/tests/visualReportsDashboard.test.ts`).
- Form registry validation (`npm run validate-registry`).
- Launchpad catalog validation (`npm run validate-launchpad`).
- Architecture duplication gate (`npm run architecture:check`).
- Production build validation (`npm run build`).

## 14. Test Plan
- Unit tests validating KPI card mathematical reconciliation (available = on-hand - reserved).
- Filtering tests for Active Fulfillment Stream tabs and search strings.
- Serialization and deserialization tests for Dashboard Configuration drawer.

## 15. Documentation Impact
- Update `docs/walkthrough/reports/Reports_Visual_Reports_Dashboard_v1.0.0.md`.
- Append master indexes in `docs/walkthrough/README.md` and `docs/implementation/README.md`.
- Update `CHANGELOG.md` and `RELEASE_NOTES.md`.

## 16. Deployment Plan
Standard CI/CD pipeline via `git pull` into test environment. No database schema migration required because existing `Dashboard` JSON store is utilized.

## 17. Status
Completed

## 18. Related ADRs
- `ADR-0042`: Sole Backend System of Record (FastAPI + PostgreSQL).
- `ADR-0089`: Preflight Architecture Certificate Governance.

## 19. Related Walkthroughs
- `docs/walkthrough/reports/Reports_Visual_Reports_Dashboard_v1.0.0.md`
