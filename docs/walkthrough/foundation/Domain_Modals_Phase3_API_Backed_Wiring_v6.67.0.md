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

# Walkthrough: Domain Modals Phase 3 API-Backed Wiring v6.67.0

## 1. Purpose
This walkthrough details the systematic mounting of all 7 unreferenced, API-backed enterprise modals (`WarehouseWavePickingModal`, `ConsolidatedBalanceSheetModal`, `ScheduleReportModal`, `ProPosReconciliationDlg`, `ProPosSupervisorAuthModal`, `ComplianceDispatchModal`, `AdminMenuManagementModal`) into their authoritative parent workspaces, achieving 100% elimination of orphaned API-backed dialogs across the SMRITI Retail OS repository.

## 2. Scope
- **Warehouse Management & Logistics (`WmsStudioTab.tsx`):**
  - Integrated `WarehouseWavePickingModal.tsx` for RFID-driven wave picking and bin allocations with header button `#wms-wave-picking-btn`.
- **BI & Financial Reporting Center (`ReportDesignerTab.tsx`):**
  - Integrated `ConsolidatedBalanceSheetModal.tsx` for multi-branch balance sheet consolidation and inter-branch elimination with button `#reports-balance-sheet-btn`.
  - Integrated `ScheduleReportModal.tsx` for multi-channel automated report dispatch with button `#reports-schedule-distribution-btn`, replacing the legacy inline scheduling form.
- **Retail Billing Suite (`BillingWorkspace.tsx`):**
  - Integrated `ProPosReconciliationDlg.tsx` for offline sync transaction audits with button `#pos-recon-btn`.
  - Integrated `ProPosSupervisorAuthModal.tsx` for manager PIN authorization with button `#pos-supervisor-pin-btn`.
- **B2B Dispatch & Tax Invoicing Studio (`DispatchInvoicingStudioTab.tsx`):**
  - Integrated `ComplianceDispatchModal.tsx` for NIC E-Way Bill and E-Invoice IRN generation with button `#dispatch-compliance-btn` in header and per-invoice action triggers on generated invoice cards.
- **Security & Access Control Shell (`SecurityAccessShell.tsx`):**
  - Integrated `AdminMenuManagementModal.tsx` for control plane menu hierarchy configuration with button `#security-admin-menu-mgmt-btn`.
- **Version SSOT Parity:**
  - Synchronized `package.json`, `src/config/version.ts`, `backend/app/core/config.py`, and `CHANGELOG.md` to authoritative release version `6.67.0`.

## 3. Files Created
- `docs/implementation/foundation/Domain_Modals_Phase3_API_Backed_Wiring_Plan_v6.67.0.md`
- `docs/walkthrough/foundation/Domain_Modals_Phase3_API_Backed_Wiring_v6.67.0.md`

## 4. Files Modified
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

## 5. Architecture Decisions
1. **Replacement of Legacy Inline Mockups:** In `ReportDesignerTab.tsx`, a legacy inline schedule dialog was superseded by the canonical, multi-channel `ScheduleReportModal.tsx` which provides direct integration with the automated report distribution daemon.
2. **Context-Aware Compliance Integration:** In `DispatchInvoicingStudioTab.tsx`, `ComplianceDispatchModal` is accessible from both the global header toolbar (using the active dispatch batch context) and from individual generated invoice cards, allowing operators to verify individual E-Way Bills or inspect batch IRNs.
3. **Dedicated POS Security & Reconciliation Triggers:** Cashiers and store supervisors have instant access to offline sync status and manager override PIN requests right on the POS billing header.

## 6. Design Rationale
- Operations and warehouse managers executing stock fulfillment need real-time wave picking with RFID verification alongside the existing batch stock matrix.
- Financial accountants and auditors require multi-branch consolidated balance sheet reporting with automatic inter-branch elimination from the main BI reporting center.
- Retail store managers need visibility into offline sync queues and the ability to authorize supervisory overrides without leaving the checkout screen.

## 7. Implementation Summary
- **WMS Wave Picking:** `<WarehouseWavePickingModal isOpen={showWavePickingModal} onClose={() => setShowWavePickingModal(false)} assignedWarehouse={...} />` mounted in `WmsStudioTab.tsx`.
- **Consolidated Balance Sheet:** `<ConsolidatedBalanceSheetModal isOpen={showBalanceSheetModal} onClose={() => setShowBalanceSheetModal(false)} />` mounted in `ReportDesignerTab.tsx`.
- **Scheduled Report Dispatch:** `<ScheduleReportModal isOpen={showScheduleModal} onClose={() => setShowScheduleModal(false)} reportCode={...} reportTitle={...} />` mounted in `ReportDesignerTab.tsx`.
- **POS Sync & Recon:** `<ProPosReconciliationDlg isOpen={showReconModal} onClose={() => setShowReconModal(false)} />` mounted in `BillingWorkspace.tsx`.
- **POS Supervisor Auth:** `<ProPosSupervisorAuthModal isOpen={showSupervisorPinModal} onClose={() => setShowSupervisorPinModal(false)} ... />` mounted in `BillingWorkspace.tsx`.
- **Statutory Compliance Dispatch:** `<ComplianceDispatchModal isOpen={showComplianceModal} onClose={() => setShowComplianceModal(false)} invoice={...} />` mounted in `DispatchInvoicingStudioTab.tsx`.
- **Admin Menu Management:** `<AdminMenuManagementModal isOpen={showAdminMenuModal} onClose={() => setShowAdminMenuModal(false)} />` mounted in `SecurityAccessShell.tsx`.

## 8. Tests Executed
1. **TypeScript Typecheck:**
   - Command: `npx tsc --noEmit`
   - Output: Exited with code 0 (0 errors).
2. **Vitest Test Runner:**
   - Command: `npx vitest run src/tests/proposSupervisorAuth.test.ts src/tests/complaintCRMEngine.test.ts src/tests/dynamicPricingEngine.test.ts`
   - Output: 3 test files passed, 12/12 tests green (613ms).
3. **Pending UX Audit Script:**
   - Command: `.venv\Scripts\python.exe scripts/audit_pending_ux.py`
   - Output: Unreferenced modals decreased from 25 to 18; **0 unreferenced modals with active APIs remain**.
4. **Version SSOT Verification:**
   - Command: `.venv\Scripts\python.exe scripts/validate_version_ssot.py`
   - Output: Exited with code 0 (`[PASS] Version SSOT consistent across all boundaries: 6.67.0`).

## 9. Verification Results
| Verification Item | Command | Status | Result |
|---|---|---|---|
| TypeScript Compilation | `npx tsc --noEmit` | Done | 0 errors |
| POS & Supervisor Suite | `npx vitest run src/tests/proposSupervisorAuth.test.ts` | Done | 4/4 passed |
| CRM Engine Suite | `npx vitest run src/tests/complaintCRMEngine.test.ts` | Done | 4/4 passed |
| Dynamic Pricing Suite | `npx vitest run src/tests/dynamicPricingEngine.test.ts` | Done | 4/4 passed |
| Pending UX Audit | `.venv\Scripts\python.exe scripts/audit_pending_ux.py` | Done | 0 unreferenced API modals |
| Version SSOT Parity | `.venv\Scripts\python.exe scripts/validate_version_ssot.py` | Done | 100% matched at 6.67.0 |

## 10. Known Limitations
- The remaining 18 unreferenced dialogs have `has_api=False` and represent future phase specifications (such as RFID fitting room simulation, HR employee attendance, and consignment studio).

## 11. Future Work
- Phase 4: Audit and wire the remaining 18 pure-client modals as their domain requirements are prioritized.
- Connect backend PostgreSQL models for `crm_complaints` and `pos_gift_cards` to replace mock data stores.

## 12. Related ADRs
- `ADR-WMS-01`: WMS Multi-Godown Batch & FEFO Allocation Architecture
- `ADR-RPT-01`: Universal Report Designer & Automated Cron Distribution Architecture
- `ADR-POS-02`: Sovereign POS Offline Sync & Reconciliation Engine
- `ADR-TAX-01`: Statutory Invoicing & Government Compliance Gateway Standard

## 13. Related RFCs
- `RFC-2026-UX-01`: Systematic Frontend Pending Interfaces Audit & Remediation
