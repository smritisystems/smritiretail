<!--
  Project      : SMRITI Retail OS
  Repository   : SMRITIRetailNX
  Organization : AITDL NETWORKS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.67.0
  Created      : 2026-10-03
  Modified     : 2026-10-03
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Implementation Plan: Domain Modals Phase 3 API-Backed Wiring Plan v6.67.0

## 1. Objective
Connect the remaining 7 unreferenced, API-backed enterprise modals (`WarehouseWavePickingModal`, `ConsolidatedBalanceSheetModal`, `ScheduleReportModal`, `ProPosReconciliationDlg`, `ProPosSupervisorAuthModal`, `ComplianceDispatchModal`, `AdminMenuManagementModal`) into their canonical host workspaces (`WmsStudioTab`, `ReportDesignerTab`, `BillingWorkspace`, `DispatchInvoicingStudioTab`, `SecurityAccessShell`), achieving 100% elimination of orphaned API-backed dialogs in SMRITI Retail OS.

## 2. Business Motivation
SMRITI possesses specialized, production-ready dialogs backed by live backend FastAPI endpoints (`/wms/`, `/reports/`, `/sync/`, `/compliance/`, `/menus/`):
- **Warehouse Wave Picking (`WarehouseWavePickingModal.tsx`)**: RFID-assisted bin allocation, batch pick lists, shortage logging, and wave fulfillment.
- **Multi-Branch Consolidated Balance Sheet (`ConsolidatedBalanceSheetModal.tsx`)**: Asset, liability, and equity cross-branch elimination and consolidated financial statements.
- **Automated Report Distribution Engine (`ScheduleReportModal.tsx`)**: Granular cron scheduling for daily/weekly/monthly automated dispatch via Email, WhatsApp, and Statutory Compliance Vault.
- **POS Offline Sync & Reconciliation (`ProPosReconciliationDlg.tsx`)**: Inspection and manual retry/override of offline queue transactions, sync conflicts, and idempotency errors.
- **POS Supervisor Authorization (`ProPosSupervisorAuthModal.tsx`)**: Manager credential and PIN override verification for high-risk POS operations (negative cash drawer, shift reset, price overrides).
- **Statutory Dispatch Compliance (`ComplianceDispatchModal.tsx`)**: Automated government NIC E-Way Bill and E-Invoice IRN/QR code generation for B2B dispatch batches.
- **Control Plane Menu Management (`AdminMenuMgmtDlg.tsx`)**: Interactive tree configuration, node activation/deactivation, and security audit log streams for SMRITI's dynamic menu registry.

Prior to Phase 3, these interfaces existed as isolated or orphaned components. Connecting them directly into native studio toolbars gives operations, finance, sales, and security administrators immediate access to these critical capabilities.

## 3. Scope
- **WMS Studio (`WmsStudioTab.tsx`):**
  - Mount `WarehouseWavePickingModal` with `#wms-wave-picking-btn` in the WMS header toolbar.
- **BI & Reporting Center (`ReportDesignerTab.tsx`):**
  - Mount `ConsolidatedBalanceSheetModal` with `#reports-balance-sheet-btn` in the report catalogue actions.
  - Mount `ScheduleReportModal` with `#reports-schedule-distribution-btn` in the report catalogue actions, replacing the legacy inline scheduling form.
- **Billing Workspace (`BillingWorkspace.tsx`):**
  - Mount `ProPosReconciliationDlg` with `#pos-recon-btn` in the billing suite action toolbar.
  - Mount `ProPosSupervisorAuthModal` with `#pos-supervisor-pin-btn` in the billing suite action toolbar.
- **B2B Dispatch & Tax Invoicing Studio (`DispatchInvoicingStudioTab.tsx`):**
  - Mount `ComplianceDispatchModal` with `#dispatch-compliance-btn` in the dispatch header and per-invoice action buttons on generated invoice cards.
- **Security & Access Control Shell (`SecurityAccessShell.tsx`):**
  - Mount `AdminMenuManagementModal` with `#security-admin-menu-mgmt-btn` in the security navigation header.

## 4. Current State
- All 7 dialog components are fully functional and integrate with `/api/v1` backend endpoints.
- Previously, these dialogs were flagged as `Unreferenced Modals` by `scripts/audit_pending_ux.py` despite having complete backend API integrations.

## 5. Gap Analysis
| Component | Prior Status | Gap | Target State (v6.67.0) |
|---|---|---|---|
| `WarehouseWavePickingModal.tsx` | Unreferenced (has_api=True) | Not triggerable from WMS | Mounted in `WmsStudioTab`, trigger `#wms-wave-picking-btn` |
| `ConsolidatedBalanceSheetModal.tsx` | Unreferenced (has_api=True) | Not triggerable from Reports | Mounted in `ReportDesignerTab`, trigger `#reports-balance-sheet-btn` |
| `ScheduleReportModal.tsx` | Unreferenced (has_api=True) | Inline form used instead | Mounted in `ReportDesignerTab`, trigger `#reports-schedule-distribution-btn` |
| `ProPosReconciliationDlg.tsx` | Unreferenced (has_api=True) | Not triggerable from POS | Mounted in `BillingWorkspace`, trigger `#pos-recon-btn` |
| `ProPosSupervisorAuthModal.tsx` | Unreferenced (has_api=True) | Test-only import | Mounted in `BillingWorkspace`, trigger `#pos-supervisor-pin-btn` |
| `ComplianceDispatchModal.tsx` | Unreferenced (has_api=True) | Not triggerable from Dispatch | Mounted in `DispatchInvoicingStudioTab`, trigger `#dispatch-compliance-btn` |
| `AdminMenuMgmtDlg.tsx` | Unreferenced (has_api=True) | Not triggerable from Shell | Mounted in `SecurityAccessShell`, trigger `#security-admin-menu-mgmt-btn` |

## 6. Architecture Impact
- **Zero Database Drift:** No changes required to PostgreSQL models or Alembic revisions.
- **Clean Modal Lifecycle:** All dialogs are controlled through declarative React state flags (`isOpen`, `onClose`, `onNotification`) and lazily mounted.
- **Audit Parity:** Reduces unreferenced modals from 25 to 18, leaving 0 unreferenced modals with backend APIs.

## 7. Proposed Design
- Consistent SAP Fiori Horizon / SMRITI Design Tokens applied to all action buttons.
- Distinct color-coded badge iconography:
  - Wave Picking: Purple (`ScanLine`)
  - Balance Sheet: Blue (`FileSpreadsheet`)
  - Report Schedule: Violet (`Calendar`)
  - Sync & Recon: Cyan (`RotateCcw`)
  - Supervisor PIN: Rose (`ShieldCheck`)
  - Statutory Compliance: Indigo (`ShieldCheck`)
  - Menu Registry: Slate Blue (`Settings`)

## 8. Files Created
- `docs/implementation/foundation/Domain_Modals_Phase3_API_Backed_Wiring_Plan_v6.67.0.md`
- `docs/walkthrough/foundation/Domain_Modals_Phase3_API_Backed_Wiring_v6.67.0.md`

## 9. Files Modified
- `src/components/wms/WmsStudioTab.tsx`
- `src/components/ReportDesignerTab.tsx`
- `src/components/billing/BillingWorkspace.tsx`
- `src/components/sales/DispatchInvoicingStudioTab.tsx`
- `src/components/security/SecurityAccessShell.tsx`
- `package.json`
- `src/config/version.ts`
- `backend/app/core/config.py`
- `CHANGELOG.md`
- `docs/implementation/README.md`
- `docs/walkthrough/README.md`

## 10. Dependencies
- React 18
- Lucide React
- FastAPI backend routers: `/wms/`, `/reports/`, `/sync/`, `/compliance/`, `/menus/`

## 11. Risks
- Risk: Inactive modals throwing unhandled network exceptions if backend services are offline. Mitigation: All modals contain robust try/catch blocks with user-friendly notification callbacks.

## 12. Rollback Strategy
All changes are non-destructive and isolated to JSX mounting and state toggles. Rollback can be performed via git revert.

## 13. Verification Plan
1. Run `npx tsc --noEmit` and verify exit code 0 (0 errors).
2. Run Vitest suites for POS auth, CRM, and dynamic pricing.
3. Run `scripts/audit_pending_ux.py` and confirm 0 unreferenced modals with `has_api=True`.
4. Run `scripts/validate_version_ssot.py` and confirm all 4 boundaries match `6.67.0`.

## 14. Test Plan
- Verify TypeScript compiler output.
- Verify Vitest regression suites.
- Verify audit script counts.

## 15. Documentation Impact
- Update `CHANGELOG.md` for `[6.67.0]`.
- Update master index tables in `docs/implementation/README.md` and `docs/walkthrough/README.md`.
- Generate comprehensive walkthrough.

## 16. Deployment Plan
Commit and push from `D:\Smriti_Retail_OS\apps\smriti_retail_os` or branch `smritiNX`, pull into test environments, and build.

## 17. Status
Completed

## 18. Related ADRs
- `ADR-WMS-01`: WMS Multi-Godown Batch & FEFO Allocation Architecture
- `ADR-RPT-01`: Universal Report Designer & Automated Cron Distribution Architecture
- `ADR-POS-02`: Sovereign POS Offline Sync & Reconciliation Engine
- `ADR-TAX-01`: Statutory Invoicing & Government Compliance Gateway Standard

## 19. Related Walkthroughs
- `docs/walkthrough/foundation/Domain_Modals_Phase3_API_Backed_Wiring_v6.67.0.md`
- `docs/walkthrough/foundation/Domain_Modals_Phase2_Wiring_And_SecManage_Retirement_v6.66.0.md`
