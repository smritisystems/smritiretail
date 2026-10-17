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
  Classification: Implementation Plan (IPGP Compliant)
-->

# SMRITI Retail OS — Procurement Visual Reports Dashboard Implementation Plan

## 1. Objective
Implement the pixel-perfect, real-time **Procurement Visual Reports** dashboard in SMRITI Retail OS, strictly matching the approved desktop visual specification. The dashboard provides end-to-end visibility into Purchase Orders, Purchase Spend, Pending Approvals, Goods Receipts, Supplier Outstandings, Supplier Performance, Reorder Alerts, and an Active Procurement Stream with a functional right-side Dashboard Configuration drawer.

## 2. Business Motivation
Procurement managers, store buyers, and financial controllers require instantaneous, visual telemetry across the inbound supply chain. Rather than querying disparate tabular screens across Purchase Orders, GRNs, Invoices, and Ledgers, this dashboard consolidates operational velocity, supplier performance, low-stock reorder triggers, and invoice reconciliation into a unified, interactive console.

## 3. Scope
- Visual design parity matching approved desktop layout (1440px+): dark navy top navigation bar (`#0d1e3a`), global filter strip with company/store/date-range and preset pills, 6 horizontal KPI cards, 2 primary analytics cards (Purchase Spend Trend & Purchase-to-Receipt Progress), 5 secondary analytics cards (Top Suppliers, PO Status donut, Low Stock Reorder alerts, Supplier Performance combo chart, Open POs table), and a 12-column Active Procurement Stream table with 4 category tabs.
- Right-side sliding Dashboard Configuration drawer with domain scope switcher, KPI card checkboxes, chart type selectors, layout mode toggles (Standard 3-Deck vs Compact 2-Deck), data display preferences, and color theme selectors.
- Authoritative backend calculation service reconciling PostgreSQL records across `PurchaseOrder`, `PurchaseReceipt`, `GoodsReceiptNote`, `PurchaseBill`, `Supplier`, and `Product` without synthetic or hardcoded data.
- Dual-tier configuration persistence: local browser storage for zero-latency paint + PostgreSQL `Dashboard` entity synchronization.
- Automated headless test coverage, architecture gate checks, registry validations, and production Vite bundle verification.

## 4. Current State
- `PurchaseStudioTab.tsx` provides manual purchase order creation, sizing matrix grids, and basic listing.
- `GrnStudioTab.tsx` provides goods receipt inward verification.
- Tabular reports exist for supplier outstanding and pending delivery, but lack visual aggregation, trend analysis, pipeline tracking, and interactive configurable dashboard layouts.

## 5. Gap Analysis
1. **Missing Visual Console**: No unified dashboard offering visual charts for spend trends, purchase-to-receipt conversion, supplier performance, and low-stock reorder triggers.
2. **Missing Configuration Engine Integration**: No sliding drawer allowing users to customize visible KPIs, chart types, table columns, or layout densities for procurement.
3. **Missing Consolidated Procurement Stream**: Inward goods receipts, purchase orders, and supplier bills are fragmented across multiple discrete screens.

## 6. Architecture Impact
- **Backend**: Mount `/api/v1/reports/procurement-dashboard/summary` and `/api/v1/reports/procurement-dashboard/config` under FastAPI `reports.py`, reusing existing database connection pooling and tenant boundaries.
- **Frontend**: Encapsulate in `src/components/procurement/ProcurementVisualReportsTab.tsx` and register in `TabRenderer.tsx`, `AppShell.tsx`, and `launchpadCatalog.ts`.
- **Database**: Zero schema migrations required. Configuration is persisted in the canonical PostgreSQL `reporting_dashboards` table.

## 7. Proposed Design
- **Top Navigation Bar**: Navy `#0d1e3a` background with breadcrumbs (`Procurement > Visual Reports`), global search bar with keyboard shortcut `/`, notification badge, help circle, and user menu.
- **Global Filter Strip**: Selectors for Company (`SMRITI FOOTWEAR PVT LTD`), Store/Location (`All Locations`), Date Range, quick preset pills (`Today`, `Last 7 Days`, `MTD`, `Custom`), active filters counter (`Filters: 3 applied`), and `Customize Dashboard` action button.
- **6 KPI Cards**:
  1. `Purchase Orders`: Total count, Open vs Closed split, trend % vs prior period.
  2. `Purchase Spend`: Formatted INR spend (e.g. `₹ 42,80,000`), MTD subtext, trend % vs prior period.
  3. `Pending Approvals`: Pending PO count, total value, trend % vs prior period.
  4. `Pending Receipts`: Count of POs with pending quantities, total pending pairs, trend % vs prior period.
  5. `Received vs Ordered`: Percentage ratio (e.g. `78%`) with visual progress bar and `3,120 / 4,000 pairs` subtext.
  6. `Supplier Outstanding`: Total accounts payable outstanding balance, count of suppliers, trend % vs prior period.
- **Primary Analytics Row**:
  - `Purchase Spend Trend`: Multi-series chart (Ordered Value line, Received Value line, Invoiced Value line, PO Count bars) with Value vs Qty and Monthly/Weekly period selectors.
  - `Purchase-to-Receipt Progress`: 4-stage connected workflow (`Purchase Orders 36 (100%)` → `Approved 30 (83%)` → `Goods Receipts 28 (78%)` → `Supplier Invoices 24 (67%)`) with progress bars and detail links.
- **Secondary Analytics Rows**:
  - `Top Suppliers by Spend (MTD)`: Ranked list with horizontal progress bars and currency totals.
  - `Purchase Order Status`: Donut chart with centered total count and color-coded status breakdown.
  - `Reorder Alert (Low Stock)`: 5-column low-stock inventory table with suggested PO quantities.
  - `Supplier Performance`: Combo chart with On-Time Delivery % bars and Lead Time (Days) line.
  - `Open POs & Pending Receipts`: 8-column open order tracker with status pills.
- **Active Procurement Stream**:
  - 4 Category Tabs (`All (86)`, `Purchase Orders (36)`, `Goods Receipts (28)`, `Supplier Invoices (24)`).
  - Search debounce, Filters, Columns, and Export actions.
  - 12 columns with status badges, interactive Next Action buttons (`Create GRN`, `Create Supplier Invoice`, `Verify Invoice`), and document preview modal.
- **Configuration Drawer**:
  - Domain pills (`Inventory`, `Procurement`, `Fulfillment`, `Billing`).
  - Section checkboxes with Select All.
  - Layout switch (`Standard 3-Deck` vs `Compact 2-Deck`).
  - Chart type dropdowns.
  - Color theme picker with palette dots.
  - Reset and Apply buttons.

## 8. Files Created
1. `backend/app/schemas/procurement_visual_reports.py`
2. `backend/app/services/procurement_visual_reports_service.py`
3. `src/components/procurement/procurementVisualReportsTypes.ts`
4. `src/components/procurement/ProcurementVisualReportsTab.tsx`
5. `src/tests/procurementVisualReports.test.ts`
6. `.architecture/certificates/PF-2026-1017-PR001.json`
7. `.architecture/certificates/PF-2026-1017-PR002.json`
8. `docs/implementation/procurement/Procurement_Visual_Reports_Implementation_Plan_v1.0.0.md`
9. `docs/walkthrough/procurement/Procurement_Visual_Reports_Dashboard_v1.0.0.md`

## 9. Files Modified
1. `backend/app/api/v1/reports.py`: Added procurement visual dashboard REST endpoints.
2. `src/components/shell/TabRenderer.tsx`: Registered `procurement-visual-reports` tab and lazy import.
3. `src/components/launchpad/launchpadCatalog.ts`: Added launchpad tile under Retail Operations.
4. `src/components/shell/AppShell.tsx`: Mapped tab to `purchase` business context.
5. `src/components/PurchaseStudioTab.tsx`: Added direct switcher button to Visual Reports.
6. `docs/implementation/README.md`: Appended master plan index.
7. `docs/walkthrough/README.md`: Appended master walkthrough index.
8. `CHANGELOG.md`: Logged release v6.95.0.
9. `RELEASE_NOTES.md`: Documented release notes.

## 10. Dependencies
- FastAPI + SQLAlchemy AsyncSession + PostgreSQL.
- React 18 + Lucide Icons + Recharts + TailwindCSS tokens.

## 11. Risks
- Large transaction ledgers could increase query latency on initial dashboard load: mitigated with indexed queries and 90-day default bounds.
- Dual-tier configuration sync could suffer race conditions: mitigated with local-first optimistic application and server-side atomic upsert.

## 12. Rollback Strategy
All changes are modular and additive. Disabling the `procurement-visual-reports` route in `TabRenderer.tsx` and removing the tile from `launchpadCatalog.ts` cleanly decommissions the UI without impacting core purchase order or GRN operations.

## 13. Verification Plan
- Headless execution of Python compilation (`py_compile`).
- Vitest unit test suite covering DTO contracts, KPI calculations, and component rendering.
- Quality gates: Form Registry, Launchpad Registry, Architecture Duplication Gate, UX Field Governance Guard, API DTO Reconciliation, and Vite production bundle build.

## 14. Test Plan
- Unit tests: verify all 6 KPI calculations and percentage derivations.
- Integration tests: verify active procurement stream filtering across PO, GR, and PI tabs.
- Configuration tests: verify drawer state mutation, chart type switching, and Reset/Apply callbacks.

## 15. Documentation Impact
- WGP Walkthrough created in `docs/walkthrough/procurement/`.
- Master indexes updated in `docs/implementation/README.md` and `docs/walkthrough/README.md`.
- Release notes and changelog updated.

## 16. Deployment Plan
Headless verification, git commit, and synchronization to remote repository branch `smritiNX`.

## 17. Status
Completed (Verified with Actual PostgreSQL Database Telemetry)

- Total POs in COMP-001: 28 statutory purchase orders (100% database sourced)
- Total Spend in COMP-001: ₹ 9,888,228 (ordered and invoiced across 28 bills)
- Received vs Ordered: 100% (23,064 / 23,064 pairs inward received)
- Top Vendors: 9 real vendors (`AS FOOTWEAR`, `AK FOOTWEAR`, `LAJOS FOOTWEAR`, `MK FOOTWEAR`, `SA FOOTWEAR`, `SB FOOTWEAR`, `LUCKY FOOTWEAR`, `ALIYA FOOTWEAR`, `CRYSTAL SHOES`)
- Zero Mock Data: Removed all placeholder names (Metro Footwear, Bharat Traders, SHOE-41, fake monthly bars)
- Strict Error & Empty States: Truthful empty state for zero-record companies, error card with retry for backend faults
- Test Verification: Pytest 2/2 passed, Vitest 6/6 passed, `tsc --noEmit` 0 errors, Vite production build clean.

## 18. Related ADRs
- `ADR-0042`: FastAPI + PostgreSQL Sole System of Record.
- `ADR-0089`: Preflight Architecture Certificate Governance.

## 19. Related Walkthroughs
- `docs/walkthrough/procurement/Procurement_Visual_Reports_Dashboard_v1.0.0.md`
- `docs/walkthrough/reports/Reports_Visual_Reports_Dashboard_v1.0.0.md`
