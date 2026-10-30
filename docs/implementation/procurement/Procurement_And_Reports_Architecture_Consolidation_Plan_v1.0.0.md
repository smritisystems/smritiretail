<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 1.0.0
  Created      : 2026-10-16
  Modified     : 2026-10-16
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Procurement & Reports Architecture Audit and Consolidation Plan v1.0.0

## 1. Objective
Conduct an authoritative codebase audit of the existing Procurement and Reports systems in SMRITI Retail OS to verify existing capabilities, prevent duplicate implementations, align navigation within the canonical `purchase` and `reports` contexts, resolve operational gaps, and establish the target architectural roadmap for missing capabilities.

## 2. Business Motivation
SMRITI Retail OS operates as an enterprise ERP and retail operating system. Unnecessary duplication of Purchase vs Procurement modules creates route collisions, breaks tenant data isolation, and confuses operators. By auditing what already exists (such as PurchaseStudio, GrnStudio, Vendor 360, Landed Cost Engine, and BI Reports Designer) and systematically enhancing existing components rather than building redundant subsystems, system stability and architecture integrity are preserved.

## 3. Scope
- **Procurement Audit & Alignment:**
  - Audit Purchase Requisitions, Supplier Quotation Management, Quotation Comparison, Purchase Approval Workflow, Purchase Order Creation and Tracking, Goods Receipt (GRN) Integration, Supplier and Purchase History, and Procurement Reports.
  - Establish the architectural decision: retain `purchase` as the single canonical context ("Purchase & Procurement") and enhance existing modules.
  - Wire live Purchase Order approval and rejection endpoints in `ApprovalMatrixTab.tsx`.
- **Reports Workspace Audit & Alignment:**
  - Audit Central Reports navigation (`report-designer`), catalog filtering, reusable query architecture, multi-tenant isolation, export utilities (`GlobalExportService`), and operational module linkages.
  - Expose `RPT-PUR-003` (Pending Delivery) and `RPT-PUR-004` (Supplier Outstanding) in the central BI Reports Center catalog (`SMRITI_STUDIOS["purchase_studio"]`) and wire into `ReportDesignerTab.tsx` with `SmritiReportEngine`.
  - Fix catalog and test registry alignment in `launchpadCatalog.ts` and `fioriLaunchpad.test.ts`.
  - Fix duplicate attribute key in `unifiedFieldCatalog.ts`.

## 4. Current State
- **Purchase & Inward Receiving:** Fully mature, transaction-backed in PostgreSQL.
  - Purchase Orders: `PurchaseStudioTab.tsx` supports sizewise matrix generation (`PoSizewiseTab.tsx`), standard barcode item line entry (`PoGenerateTab.tsx`), lifecycle status workspace (`POWorkspaceTab.tsx`), amendment chains (`POAmendDialog.tsx`), cancellation with policy codes (`POCancelReasonDialog.tsx`), and A4 print engine (`PurchaseOrderPrintA4.tsx`).
  - Goods Receipt Note (GRN): `GrnStudioTab.tsx` / `GrnReceiptTab.tsx` / `GrnDesktopTerminal.tsx` provides multi-PO inward receiving, 3-way matching commit (`/3way-matching/commit`), and penny-balanced landed cost allocation (`LandedCostAllocationEngine`).
  - Vendor 360: `VendorMasterWs.tsx` provides full supplier ledger, aging, and advance knockoffs.
  - Auto-PO: `AutoPOModal.tsx` converts low-stock triggers into POs via `/purchase/reorder-suggestions/convert`.
- **Reports Workspace:** Fully mature BI center in `ReportDesignerTab.tsx` with 11 studios.
  - Reusable engine: `SmritiReportEngine.tsx` handles date presets, multi-sort, column filtering, summary metrics, and exports.
- **Identified Gaps:**
  1. Manual multi-step Purchase Requisition (PR / Indent) is absent; only automated reorder triggers exist.
  2. Supplier Quotation / RFQ and Quotation Comparison are absent.
  3. `ApprovalMatrixTab.tsx` had optimistic UI without live backend API calls on Approve/Reject.
  4. Pending Delivery and Supplier Outstanding were isolated in `ProcurementReportsModal` and omitted from the central BI Reports Catalog (`purchase_studio`).

## 5. Gap Analysis
| Functional Area | Desired State | Audited Current State | Gap & Remediation |
| :--- | :--- | :--- | :--- |
| **Purchase Requisition** | Formal PR / Indent creation & approval | Automated reorder suggestions exist (`AutoPOModal`) | Manual PR model & lifecycle defined in roadmap; automated reorder retained |
| **Supplier Quotations (RFQ)** | Inward vendor quotes & comparison | Only Sales Quotations exist (`sales.py`) | Formal RFQ specification defined for future phase; no duplicate models created |
| **PO Approval Workflow** | Approval Matrix acts on live PO lifecycle | Backend endpoints exist; UI was optimistic | Wired `POST /purchase/orders/{id}/confirm` and `/cancel` into `ApprovalMatrixTab` |
| **Procurement Reports in BI** | Central BI Studio displays all purchase reports | Only `RPT-PUR-001` and `002` registered | Added `RPT-PUR-003` and `RPT-PUR-004` to `SMRITI_STUDIOS` and `ReportDesignerTab` |
| **Fiori Launchpad Parity** | All launchpad tiles resolve and test clean | Missing tile test registration & duplicate attr key | Added `muster-roll` & `price-revision` to tests; deduplicated `department` |

## 6. Architecture Impact
- **Zero Architecture Duplication:** Complies with SMRITI Architecture Duplication Gate. No redundant "procurement" router or tables created.
- **Unified Context:** `navigationResolver.ts` retains `purchase` with title `"Purchase & Procurement"` and `reports` with title `"BI Reports & Analytics"`.
- **Multi-Tenant Boundary:** All reporting and approval actions execute with strict tenant isolation (`TenantContext`, `get_company_db`).

## 7. Proposed Design
1. **Purchase Report Studio Enhancement:**
   - Register `RPT-PUR-003` (Pending Delivery) and `RPT-PUR-004` (Supplier Outstanding) in `backend/app/api/v1/reports.py`.
   - Expose backend endpoints `/reports/pending-delivery` and `/reports/supplier-outstanding`.
   - Wire both reports into `ReportDesignerTab.tsx` to render through `SmritiReportEngine` with export and sorting.
2. **Approval Matrix Live PO Workflow:**
   - In `src/components/ApprovalMatrixTab.tsx`, call live `/purchase/orders/{doc.id}/confirm` on Approve, and `/purchase/orders/{doc.id}/cancel` on Reject with structured notes and reason codes.
3. **Core Registry Deduplication:**
   - Fix `merchandiseDepartment` in `src/services/unifiedFieldCatalog.ts` to eliminate duplicate key collision with `department`.
   - Align test tab arrays in `src/tests/fioriLaunchpad.test.ts`.

## 8. Files Created
- `src/tests/procurementAndReportsAudit.test.ts`: Frontend navigation and catalog audit test suite.
- `backend/tests/test_procurement_reports_audit.py`: Backend report studio catalog completeness test suite.
- `docs/implementation/procurement/Procurement_And_Reports_Architecture_Consolidation_Plan_v1.0.0.md`: This implementation plan.
- `docs/walkthrough/procurement/Procurement_And_Reports_Audit_And_Enhancement_v1.0.0.md`: Corresponding walkthrough document.

## 9. Files Modified
- `backend/app/api/v1/reports.py`: Added `RPT-PUR-003` and `RPT-PUR-004` to `SMRITI_STUDIOS["purchase_studio"]` and added `/pending-delivery` and `/supplier-outstanding` routes.
- `src/components/ReportDesignerTab.tsx`: Added data fetching handlers for `RPT-PUR-003` and `RPT-PUR-004` for rendering via `SmritiReportEngine`.
- `src/components/ApprovalMatrixTab.tsx`: Wired live backend API calls for Purchase Order confirmation and cancellation.
- `src/services/unifiedFieldCatalog.ts`: Deduplicated `department` field definition by assigning `id: "merchandiseDepartment"` and `key: "MERCHANDISE_DEPARTMENT"`.
- `src/tests/fioriLaunchpad.test.ts`: Added missing `price-revision` and `muster-roll` IDs to `REGISTERED_APP_TABS`.
- `docs/implementation/README.md`: Registered this implementation plan.
- `docs/walkthrough/README.md`: Registered the walkthrough document.

## 10. Dependencies
- React 18 / TypeScript / Vite frontend.
- FastAPI / SQLAlchemy AsyncSession / PostgreSQL backend.
- `SmritiReportEngine` and `GlobalExportService` for grid rendering and export.

## 11. Risks
- **Risk:** Existing PO lifecycle state transition violations (e.g. attempting to confirm an order not in `SUBMITTED` status).
  - **Mitigation:** Backend strictly validates `order.status == 'SUBMITTED'` before confirmation and raises descriptive HTTP 400 errors.
- **Risk:** Large supplier datasets causing latency in reports.
  - **Mitigation:** Queries are indexed on `company_id`, `branch_id`, and `supplier_id`.

## 12. Rollback Strategy
- All modifications are additive and backward-compatible.
- In the event of rollback, revert the modified files via `git checkout` without any database schema migrations or data loss.

## 13. Verification Plan
1. Run backend unit test: `.venv\Scripts\python -m pytest backend/tests/test_procurement_reports_audit.py`.
2. Run frontend integration tests: `npx vitest run src/tests/procurementAndReportsAudit.test.ts`, `src/tests/itemAttrs.test.ts`, `src/tests/fioriLaunchpad.test.ts`.
3. Run full Vitest suite: `npm test`.
4. Run full TypeScript check: `npm run lint` (`tsc --noEmit`).
5. Run architecture duplication check: `python scripts/architecture_duplication_gate.py`.

## 14. Test Plan
- Verify `purchase_studio` in `GET /api/v1/reports/studios` includes all 4 reports.
- Verify `GET /api/v1/reports/pending-delivery` returns confirmed orders.
- Verify `GET /api/v1/reports/supplier-outstanding` returns supplier balances.
- Verify `ApprovalMatrixTab` dispatches `POST /purchase/orders/{id}/confirm` on approval.
- Verify `ReportDesignerTab` loads and renders `RPT-PUR-003` and `RPT-PUR-004`.

## 15. Documentation Impact
- Updated Implementation Plan Master Index (`docs/implementation/README.md`).
- Created Walkthrough document (`docs/walkthrough/procurement/Procurement_And_Reports_Audit_And_Enhancement_v1.0.0.md`).
- Updated Walkthrough Master Index (`docs/walkthrough/README.md`).

## 16. Deployment Plan
- Deploy as part of standard SMRITI Retail OS minor release. No database migrations required.

## 17. Status
**Completed** — Fully audited, implemented, and verified with 100% passing tests.

## 18. Related ADRs
- `ADR-0042`: FastAPI + PostgreSQL Sole Backend System of Record.
- `ADR-0056`: Unified Layout Engine and Launchpad Routing Architecture.
- `ADR-0078`: Multi-Tenant Isolation and TenantContext Enforcement.

## 19. Related Walkthroughs
- `Procurement_And_Reports_Audit_And_Enhancement_v1.0.0.md`
