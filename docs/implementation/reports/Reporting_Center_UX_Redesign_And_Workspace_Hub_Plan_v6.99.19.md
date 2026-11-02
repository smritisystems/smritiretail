<!--
  Project      : SMRITI Retail OS
  Repository   : SMRITIRetailNX
  Organization : AITDL NETWORKS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.99.19
  Created      : 2026-11-02
  Modified     : 2026-11-02
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Implementation Plan: SMRITI Retail OS — Reporting Center UX Redesign & Workspace Hub v6.99.19

## 1. Objective
Redesign the SMRITI Retail OS Reporting Center into a high-fidelity, ERP-native BI workspace hub matching the reference architecture and visual standard, providing instantaneous executive visibility into revenue, stock valuation, payables/receivables, and margins, with 1-click drill-downs to authoritative operational registers.

## 2. Business Motivation
Store managers, retail directors, and accountants require a unified operational hub that presents critical financial and inventory indicators at a glance without navigating complex technical menus. The redesigned Reporting Center consolidates 66+ reports across 8 core business functions into an intuitive executive dashboard.

## 3. Scope
- Deliver the new `ReportingCenterHub.tsx` workspace component.
- Integrate Store/Branch and Period selectors with quick fiscal presets (`Today`, `Yesterday`, `Last 7 Days`, `This Month`, `FY 2026-27`, `Custom Range`).
- Render 4 primary KPI cards: Net Sales, Stock Value (At Cost), Receivables (Outstanding), and Gross Margin.
- Implement the Multi-Metric Area Trend Chart (`Sales`, `Purchase`, `Stock`, `Margin`) with Key Insights panel.
- Implement the Quick Reports sidebar (6 operational shortcuts) and Recently Run Reports history.
- Implement the 4x2 grid of 8 Business Functions with exact report counts and descriptions.
- Provide bidirectional back-button navigation between the Hub, Report Viewer, and Catalog table.

## 4. Current State
The existing `ReportDesignerTab.tsx` provided a functional but fragmented view with legacy role-switching controls, unorganized studio tables, and lack of high-level multi-metric visual summaries.

## 5. Gap Analysis
- Missing executive KPI cards for real-time sales, inventory at cost, receivables, and gross margin.
- Missing responsive Area trend chart with INR-denominated axes and metric toggles.
- Missing quick shortcuts to the most frequently executed daily retail registers.
- Missing persistent recently executed reports history.
- Missing clear high-level categorical grouping across all 8 business functions.

## 6. Architecture Impact
- Introduces `ReportingCenterHub.tsx` as a modular presentation component mounted within `ReportDesignerTab.tsx`.
- Connects to existing FastAPI backend endpoints (`/reports/daily-sales`, `/reports/stock-valuation`, `/reports/supplier-outstanding`).
- Implements client-side persistent history caching in `localStorage` under `smriti_recently_run_reports`.

## 7. Proposed Design
- Clean Fiori Horizon Light Theme with modern Tailwind CSS styling.
- Left-aligned header with Blue BarChart badge and subtitle.
- Right-aligned Store and Period controls with solid Blue Apply button.
- Recharts `ResponsiveContainer` Area Chart with linear blue gradient and formatted Indian currency labels (`₹3.00 Cr`, `₹50.00 L`, `₹0`).
- Card-based categorical grouping with colored icons and count badges.

## 8. Files Created
1. `src/components/reports/ReportingCenterHub.tsx`
2. `src/tests/reportingCenterHub.test.tsx`
3. `docs/walkthrough/reports/Reporting_Center_UX_Redesign_And_Workspace_Hub_v6.99.19.md`
4. `docs/implementation/reports/Reporting_Center_UX_Redesign_And_Workspace_Hub_Plan_v6.99.19.md`

## 9. Files Modified
1. `src/components/ReportDesignerTab.tsx`
2. `docs/walkthrough/README.md`
3. `docs/implementation/README.md`

## 10. Dependencies
- `recharts` for SVG chart rendering.
- `lucide-react` for clean ERP iconography.
- `apiFetchV1` for authenticated communication with FastAPI backend.

## 11. Risks
- *Risk:* Sparse or empty test database returning 0 or null for certain summary queries.
- *Mitigation:* Graceful fallback to verified base period actuals and defensive finite number parsing via `safeNumber`.

## 12. Rollback Strategy
If issues arise, reverting `ReportDesignerTab.tsx` immediately restores the legacy catalog view while preserving all backend data and routes.

## 13. Verification Plan
1. Unit testing with Vitest verifying formatting helpers, KPI calculations, and navigation props.
2. Production build verification (`npm run build`) ensuring zero bundle errors.
3. Interactive UI verification of filter presets, chart metric toggles, and report execution.

## 14. Test Plan
- Test `formatInrCompact` and `formatInrFull` on edge cases (0, lakhs, crores, negatives).
- Test execution of each of the 6 Quick Reports shortcuts.
- Test category selection and catalog table transition.
- Test "← Back to Reporting Center" button navigation.

## 15. Documentation Impact
- Added Walkthrough in `docs/walkthrough/reports/`.
- Updated Master Indexes in `docs/walkthrough/README.md` and `docs/implementation/README.md`.

## 16. Deployment Plan
1. Commit and push changes in DEV (`F:\SMRITRretailNX`).
2. Pull into TEST (`F:\Smriti9`) via `git pull` per permanent Environment Rule.
3. Run container build / restart via standard automated deployment pipeline.

## 17. Status
**Completed** — Code implemented, 8/8 tests passed, build clean.

## 18. Related ADRs
- `ADR-0042`: FastAPI Backend System-of-Record.
- `ADR-0089`: SMRITI Design Tokens & Light Theme Standards.

## 19. Related Walkthroughs
- `docs/walkthrough/reports/Reporting_Center_UX_Redesign_And_Workspace_Hub_v6.99.19.md`
