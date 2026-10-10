<!--
  Project      : SMRITI Retail OS
  Repository   : SMRITIRetailNX
  Organization : AITDL NETWORKS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.68.0
  Created      : 2026-10-03
  Modified     : 2026-10-03
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough: Domain Modals Phase 4 Comprehensive Wiring v6.68.0

## 1. Purpose
Achieve 100% elimination of orphaned dialogs and unreferenced functional workspaces across SMRITI Retail OS by mounting all remaining calculation, simulation, logistics, and master data modals into their canonical host workspaces, and routing top-level workspaces through `TabRenderer.tsx`.

## 2. Scope
- Mount 18 remaining dialogs across CRM, Reports, POS, Promotions, WMS, Purchasing, Compliance, Staff, Item Master, and Security.
- Route `CommunicatorStudioTab` and `SalesOrderTab` in `TabRenderer.tsx`.
- Synchronize Version SSOT to `6.68.0` across `package.json`, `version.ts`, `config.py`, and `CHANGELOG.md`.

## 3. Files Created
- `docs/implementation/foundation/Domain_Modals_Phase4_Comprehensive_Wiring_Plan_v6.68.0.md`
- `docs/walkthrough/foundation/Domain_Modals_Phase4_Comprehensive_Wiring_v6.68.0.md`

## 4. Files Modified
- `src/components/CrmStudioTab.tsx`
- `src/components/ReportDesignerTab.tsx`
- `src/components/billing/BillingWorkspace.tsx`
- `src/components/promotions/SmritiSalesPromotionsStudio.tsx`
- `src/components/wms/WmsStudioTab.tsx`
- `src/components/PurchaseStudioTab.tsx`
- `src/components/compliance/EWayBillManagementTab.tsx`
- `src/components/staff/StaffMasterWs.tsx`
- `src/components/itemMaster/ItemMasterWs.tsx`
- `src/components/security/SecurityAccessShell.tsx`
- `src/components/shell/TabRenderer.tsx`
- `package.json`
- `src/config/version.ts`
- `backend/app/core/config.py`
- `CHANGELOG.md`
- `docs/implementation/README.md`
- `docs/walkthrough/README.md`

## 5. Architecture Decisions
- **Zero Orphan Guarantee**: No domain modal or calculation engine remains disconnected from user interaction.
- **Lazy Loading & Code Splitting**: All mounted dialogs are conditionally rendered when open (`isOpen && <Modal ... />`), preventing unnecessary DOM allocations or performance regressions.
- **Unified Event Contract**: Modals conform to standard callbacks (`isOpen`, `onClose`, `onNotification`), ensuring seamless notifications across store registers and managerial terminals.

## 6. Design Rationale
- Action buttons are embedded natively into existing toolbars and header sections with clean icons from `lucide-react`.
- Distinct color-coded badge iconography and responsive tooltips preserve UI clarity across desktop and POS screens.

## 7. Implementation Summary
- **CRM (`CrmStudioTab.tsx`)**: `#crm-studio-segmentation-btn` ("RFM Segments") & `#crm-studio-tiers-btn` ("Tier Matrix").
- **Financial Reports (`ReportDesignerTab.tsx`)**: `#reports-pnl-dashboard-btn` ("Branch P&L").
- **POS Billing (`BillingWorkspace.tsx`)**: `#pos-dynamic-pricing-btn` ("Dynamic Pricing") & `#pos-omni-order-btn` ("Omni Orders").
- **Promotions (`SmritiSalesPromotionsStudio.tsx`)**: `#promotions-bundling-btn` ("Bundles") & `#promotions-markdown-btn` ("Markdown").
- **WMS (`WmsStudioTab.tsx`)**: `#wms-stock-transfer-modal-btn` ("STO Requisition"), `#wms-ipo-modal-btn` ("Inter-Store PO"), `#wms-rfid-fitting-btn` ("Fitting Room"), `#wms-label-print-btn` ("Print Labels").
- **Procurement (`PurchaseStudioTab.tsx`)**: `#purchase-studio-consignment-btn` ("Consignment") & `#purchase-studio-supplier-pay-btn` ("Payment Aging").
- **Compliance (`EWayBillManagementTab.tsx`)**: `#compliance-einvoice-studio-btn` ("E-Invoice Studio").
- **Staff 360 (`StaffMasterWs.tsx`)**: `#staff-commissions-btn` ("Commissions") & `#staff-attendance-modal-btn` ("Attendance Studio").
- **Item Master (`ItemMasterWs.tsx`)**: `#item-code-select-btn` ("SKU Generator") & `#item-replace-data-btn` ("Replace Data").
- **Security (`SecurityAccessShell.tsx`)**: `#security-classic-dlg-btn` ("Classic Dialog").
- **Shell (`TabRenderer.tsx`)**: Central routing for `"communicator"` and `"sales-orders"`.

## 8. Tests Executed
- `python scripts/validate_version_ssot.py` (Exit 0)
- `python scripts/audit_pending_ux.py` (Exit 0: 0 unreferenced modals, 0 import-only modals)
- `npx tsc --noEmit` (Exit 0)

## 9. Verification Results
- **Unreferenced Modals (Orphaned):** Reduced from 18 to **0**.
- **Import-Only Modals:** Reduced from 1 to **0**.
- **Total Modals/Dialogs:** 89 / 89 verified and accessible.
- **Version SSOT:** Authoritative parity at `6.68.0`.

## 10. Known Limitations
- Pure client mock calculation engines operate on in-memory simulated datasets until corresponding backend microservices are fully persisted in PostgreSQL.

## 11. Future Work
- Back client-side calculation engines (RFM quintiles, dynamic markdown schedules) with PostgreSQL materialization views as retail volume scales.

## 12. Related ADRs
- `ADR-001`: FastAPI Sole System of Record Architecture
- `ADR-045`: Shell Tab Router Dynamic Suspense
- `ADR-HR-001`: Staff 360 Workspace Governance

## 13. Related RFCs
- `RFC-089`: Unified UX Modal and Dialog Architecture
- `RFC-104`: Full-Page Workspace Navigation Alignment
