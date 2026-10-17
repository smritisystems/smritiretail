<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.95.0
  Created      : 2026-10-17
  Modified     : 2026-10-17
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Walkthrough Document (WGP Compliant)
-->

# Procurement Visual Reports Dashboard Walkthrough (Orders, Spend, Approvals & Receipts)

## 1. Purpose
This walkthrough documents the end-to-end design, implementation, and verification of the pixel-perfect **Procurement Visual Reports** dashboard for SMRITI Retail OS. It provides real-time visibility into Purchase Orders, Spend trends, Pending Approvals, Pending Inward Receipts, Received vs Ordered ratios, Supplier Outstandings, Top Suppliers by Spend, Reorder Alerts, Supplier Performance metrics, and an Active Procurement Stream with a functional right-side Dashboard Configuration drawer.

## 2. Scope
- Visual design parity matching approved desktop layout (1440px+): dark navy top navigation bar (`#0d1e3a`), global filter strip with company/store/date-range and preset pills, 6 horizontal KPI cards, 2 primary analytics cards (Purchase Spend Trend & Purchase-to-Receipt Progress), 5 secondary analytics cards (Top Suppliers, PO Status donut, Low Stock Reorder alerts, Supplier Performance combo chart, Open POs table), and a 12-column Active Procurement Stream table with 4 category tabs.
- Right-side sliding Dashboard Configuration drawer with domain scope switcher, KPI card checkboxes, chart type selectors, layout mode toggles (Standard 3-Deck vs Compact 2-Deck), data display preferences, and color theme selectors.
- Authoritative backend calculation service reconciling PostgreSQL records across `PurchaseOrder`, `PurchaseReceipt`, `GoodsReceiptNote`, `PurchaseBill`, `Supplier`, and `Product` without synthetic or hardcoded data.
- Dual-tier configuration persistence: local browser storage for zero-latency paint + PostgreSQL `Dashboard` entity synchronization.
- Automated headless test coverage, architecture gate checks, registry validations, and production Vite bundle verification.

## 3. Files Created
1. `backend/app/schemas/procurement_visual_reports.py`: Pydantic DTO contracts for procurement summary, KPIs, spend trend timeline, workflow stages, and configuration payloads.
2. `backend/app/services/procurement_visual_reports_service.py`: Business logic reconciling PostgreSQL purchase orders, GRNs, supplier bills, and inventory low stock.
3. `src/components/procurement/procurementVisualReportsTypes.ts`: Client-side TypeScript interfaces.
4. `src/components/procurement/ProcurementVisualReportsTab.tsx`: Primary visual dashboard React component with interactive configuration drawer and responsive charts.
5. `src/tests/procurementVisualReports.test.ts`: Automated unit and integration test suite (5/5 passed).
6. `.architecture/certificates/PF-2026-1017-2B7255.json`: Preflight certificate for procurement visual reports service.
7. `.architecture/certificates/PF-2026-1017-E4F73C.json`: Preflight certificate for ProcurementVisualReportsTab component.
8. `.architecture/certificates/PF-2026-1017-30628F.json`: Preflight certificate for procurement visual reports types.
9. `docs/implementation/procurement/Procurement_Visual_Reports_Implementation_Plan_v1.0.0.md`: IPGP implementation plan.
10. `docs/walkthrough/procurement/Procurement_Visual_Reports_Dashboard_v1.0.0.md`: WGP walkthrough document.

## 4. Files Modified
1. `backend/app/api/v1/reports.py`: Added GET summary, GET config, and POST config procurement endpoints.
2. `src/components/shell/TabRenderer.tsx`: Added lazy import, `mapModuleId` routes, and rendering case for `procurement-visual-reports`.
3. `src/components/launchpad/launchpadCatalog.ts`: Registered `procurement-visual-reports` launchpad tile under Retail Operations.
4. `src/components/shell/AppShell.tsx`: Mapped `procurement-visual-reports` to the `purchase` business context.
5. `src/components/PurchaseStudioTab.tsx`: Added direct segmented switcher navigation to Visual Reports.
6. `docs/implementation/README.md`: Appended master implementation index table.
7. `docs/walkthrough/README.md`: Appended master walkthrough index table.
8. `CHANGELOG.md`: Logged release v6.95.0.
9. `RELEASE_NOTES.md`: Documented release notes.

## 5. Architecture Decisions
- **FastAPI + PostgreSQL Sole Backend**: Reconciles authoritative records across `PurchaseOrder`, `PurchaseReceipt`, `GoodsReceiptNote`, `PurchaseBill`, `Supplier`, and `Product` without synthetic data or intermediate mock servers.
- **Dual-Tier Configuration Persistence**: Persists user dashboard preferences to `localStorage` for zero-latency initial paint, and synchronizes to the server-side `Dashboard` entity in PostgreSQL.
- **Component Isolation**: Encapsulated in `ProcurementVisualReportsTab.tsx` without mutating existing purchase order creation or GRN terminal transaction engines.

## 6. Design Rationale
- **Color Coding**: Semantic accents highlight procurement states (Sky/Blue = Purchase Orders & Pending Receipts, Purple = Purchase Spend, Amber = Pending Approvals, Emerald = Received vs Ordered, Rose = Supplier Outstanding).
- **Multi-Deck Proportions**: Standard 3-deck layout allows simultaneously monitoring macro metrics (Deck 1), trend/pipeline conversions (Deck 2), deep supplier and low-stock indicators (Deck 3), and immediate transactional streams (Deck 4) without horizontal scrollbar on 1440px+ displays.
- **Drawer Controls**: Instant client-side DOM updates on toggle with atomic Apply / Reset actions.

## 7. Implementation Summary
- Integrated Recharts `<ResponsiveContainer>`, `<ComposedChart>`, `<LineChart>`, `<BarChart>`, and `<PieChart>`.
- Added interactive document detail modal for quick inspection of document lines and direct action dispatching (`Create GRN`, `Create Supplier Invoice`, `Verify Invoice`).
- Implemented client-side filtering by tab (`All`, `Purchase Orders`, `Goods Receipts`, `Supplier Invoices`) and instant search debounce.

## 8. Tests Executed
- `python -m py_compile backend/app/schemas/procurement_visual_reports.py backend/app/services/procurement_visual_reports_service.py backend/app/api/v1/reports.py` (Clean, 0 errors).
- `npx vitest run src/tests/procurementVisualReports.test.ts` (5/5 passed).
- `npx vitest run src/tests/visualReportsDashboard.test.ts` (5/5 passed).
- `npm run validate-registry` (PASSED, 98/98 form components verified).
- `npm run validate-launchpad` (PASSED, 55/55 tiles verified).
- `npm run architecture:check` (PASSED, 0 violations across 11 gates).
- `python scripts/ci_ux_field_governance_guard.py` (PASSED, 0 violations).
- `python scripts/ci_api_dto_reconciliation.py` (PASSED, 0 violations).
- `npm run build` (built cleanly).

## 9. Verification Results
All automated quality gates passed with zero warnings or errors.

## 10. Known Limitations
- Spend Trend chart timeline is optimized for up to 12 months of monthly aggregations.
- Export to CSV in the Active Procurement Stream triggers client-side data export.

## 11. Future Work
- Integration with live WebSocket updates for goods receipt weighbridge / barcode scanning.
- Automated vendor rating recalculation engine based on historical lead times.

## 12. Related ADRs
- `ADR-0042`: FastAPI + PostgreSQL Sole System of Record.
- `ADR-0089`: Preflight Architecture Certificate Governance.

## 13. Related RFCs
- `RFC-2026-PVR-01`: Procurement Visual Telemetry & Configurable Dashboard Architecture.
