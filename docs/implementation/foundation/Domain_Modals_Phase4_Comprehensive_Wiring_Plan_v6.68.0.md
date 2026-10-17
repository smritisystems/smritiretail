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

# Implementation Plan: Domain Modals Phase 4 Comprehensive Wiring Plan v6.68.0

## 1. Objective
Mount all 18 remaining domain calculation, simulation, logistics, and master data modals across their canonical host studios (`CrmStudioTab`, `ReportDesignerTab`, `BillingWorkspace`, `SmritiSalesPromotionsStudio`, `WmsStudioTab`, `PurchaseStudioTab`, `EWayBillManagementTab`, `StaffMasterWs`, `ItemMasterWs`, `SecurityAccessShell`), and wire the primary unreferenced workspaces (`CommunicatorStudioTab`, `SalesOrderTab`) into `TabRenderer.tsx`, achieving 100% elimination of orphaned dialogs and complete routing of functional enterprise workspaces across SMRITI Retail OS.

## 2. Business Motivation
SMRITI possesses sophisticated client calculation engines, simulation workbenches, and specialized operational dialogs:
- **CRM Intelligence (`CustomerSegmentationModal.tsx`, `LoyaltyTierModal.tsx`)**: RFM (Recency, Frequency, Monetary) quintile scoring and loyalty tier benefit simulation.
- **Financial Intelligence (`PLDashboardModal.tsx`)**: Multi-branch comparative Profit & Loss analysis, EBITDA modeling, and cost breakdown inspection.
- **POS Dynamic Pricing & Omni Orders (`DynamicPricingStudioModal.tsx`, `OmniOrderStudioModal.tsx`)**: Algorithmic surge/markdown pricing simulations and omnichannel click-and-collect / ship-from-store queue management.
- **Promotional Planning (`BundlingModal.tsx`, `MarkdownPlanningModal.tsx`)**: Multi-item bundle margin modeling and aged inventory progressive markdown curves.
- **WMS Logistics & Fitting Room RFID (`StockTransferStudioModal.tsx`, `IPOStudioModal.tsx`, `RFIDFittingRoomStudioModal.tsx`, `LabelPrintModal.tsx`)**: Requisition workflows, inter-store PO tracking, smart fitting room IoT telemetry, and warehouse barcode label printing.
- **Procurement Finance (`ConsignmentStudioModal.tsx`, `SupplierPaymentModal.tsx`)**: Supplier consignment reconciliation and vendor payable aging analysis.
- **Compliance E-Invoicing (`EInvoiceStudioModal.tsx`)**: Real-time government IRP e-invoice JSON generation, digital signing, and payload simulation.
- **Staff 360 HR Governance (`CommissionStudioModal.tsx`, `EmployeeAttendanceModal.tsx`)**: Sales rep commission tiered payouts and employee biometric clock-in attendance auditing.
- **Design & Article Master Tools (`CodeSelectDlg.tsx`, `ReplaceDataDlg.tsx`)**: Barcode/SKU synthesis and batch attribute search-and-replace across live article catalogs.
- **Security Control Plane (`SecManageDlg.tsx`)**: Fallback modal dialog for classic security role configuration and user policy inspection.
- **Workspace Navigation (`CommunicatorStudioTab.tsx`, `SalesOrderTab.tsx`)**: Central omni-channel messaging dispatch (WhatsApp/SMS/Email) and dedicated sales order workflow pipeline.

## 3. Scope
- **CRM Studio (`src/components/CrmStudioTab.tsx`)**:
  - Mount `CustomerSegmentationModal` with `#crm-studio-segmentation-btn` ("RFM Segments").
  - Mount `LoyaltyTierModal` with `#crm-studio-tiers-btn` ("Tier Matrix").
- **Financial Reports (`src/components/ReportDesignerTab.tsx`)**:
  - Mount `PLDashboardModal` with `#reports-pnl-dashboard-btn` ("Branch P&L").
- **POS Billing (`src/components/billing/BillingWorkspace.tsx`)**:
  - Mount `DynamicPricingStudioModal` with `#pos-dynamic-pricing-btn` ("Dynamic Pricing").
  - Mount `OmniOrderStudioModal` with `#pos-omni-order-btn` ("Omni Orders").
- **Sales Promotions Studio (`src/components/promotions/SmritiSalesPromotionsStudio.tsx`)**:
  - Mount `BundlingModal` with `#promotions-bundling-btn` ("Bundles").
  - Mount `MarkdownPlanningModal` with `#promotions-markdown-btn` ("Markdown").
- **WMS Studio (`src/components/wms/WmsStudioTab.tsx`)**:
  - Mount `StockTransferStudioModal` with `#wms-stock-transfer-modal-btn` ("STO Requisition").
  - Mount `IPOStudioModal` with `#wms-ipo-modal-btn` ("Inter-Store PO").
  - Mount `RFIDFittingRoomStudioModal` with `#wms-rfid-fitting-btn` ("Fitting Room").
  - Mount `LabelPrintModal` with `#wms-label-print-btn` ("Print Labels").
- **Purchase Studio (`src/components/PurchaseStudioTab.tsx`)**:
  - Mount `ConsignmentStudioModal` with `#purchase-studio-consignment-btn` ("Consignment").
  - Mount `SupplierPaymentModal` with `#purchase-studio-supplier-pay-btn` ("Payment Aging").
- **Compliance E-Way Bill (`src/components/compliance/EWayBillManagementTab.tsx`)**:
  - Mount `EInvoiceStudioModal` with `#compliance-einvoice-studio-btn` ("E-Invoice Studio").
- **Staff 360 Workspace (`src/components/staff/StaffMasterWs.tsx`)**:
  - Mount `CommissionStudioModal` with `#staff-commissions-btn` ("Commissions").
  - Mount `EmployeeAttendanceModal` with `#staff-attendance-modal-btn` ("Attendance Studio").
- **Item Master Workspace (`src/components/itemMaster/ItemMasterWs.tsx`)**:
  - Mount `CodeSelectDlg` with `#item-code-select-btn` ("SKU Generator").
  - Mount `ReplaceDataDlg` with `#item-replace-data-btn` ("Replace Data").
- **Security Access Shell (`src/components/security/SecurityAccessShell.tsx`)**:
  - Mount `SecManageDlg` with `#security-classic-dlg-btn` ("Classic Dialog").
- **Tab Router (`src/components/shell/TabRenderer.tsx`)**:
  - Route `CommunicatorStudioTab` under `"communicator"`, `"communicator-studio"`, `"messaging"`, `"whatsapp"`.
  - Route `SalesOrderTab` under `"sales-orders"`, `"sales-order"`.

## 4. Current State
- Prior to Phase 4, 18 dialogs were unmounted or import-only in `scripts/audit_pending_ux.py`.
- Two functional workspaces (`CommunicatorStudioTab` and `SalesOrderTab`) existed as standalone tab components with backend routes but lacked top-level routing in `TabRenderer.tsx`.

## 5. Gap Analysis
| Component | Prior Audit Status | Phase 4 Integration Point | Action Trigger ID |
|---|---|---|---|
| `CustomerSegmentationModal.tsx` | Unreferenced | `CrmStudioTab.tsx` | `#crm-studio-segmentation-btn` |
| `LoyaltyTierModal.tsx` | Unreferenced | `CrmStudioTab.tsx` | `#crm-studio-tiers-btn` |
| `PLDashboardModal.tsx` | Unreferenced | `ReportDesignerTab.tsx` | `#reports-pnl-dashboard-btn` |
| `DynamicPricingStudioModal.tsx` | Unreferenced | `BillingWorkspace.tsx` | `#pos-dynamic-pricing-btn` |
| `OmniOrderStudioModal.tsx` | Unreferenced | `BillingWorkspace.tsx` | `#pos-omni-order-btn` |
| `BundlingModal.tsx` | Unreferenced | `SmritiSalesPromotionsStudio.tsx` | `#promotions-bundling-btn` |
| `MarkdownPlanningModal.tsx` | Unreferenced | `SmritiSalesPromotionsStudio.tsx` | `#promotions-markdown-btn` |
| `StockTransferStudioModal.tsx` | Unreferenced | `WmsStudioTab.tsx` | `#wms-stock-transfer-modal-btn` |
| `IPOStudioModal.tsx` | Unreferenced | `WmsStudioTab.tsx` | `#wms-ipo-modal-btn` |
| `RFIDFittingRoomStudioModal.tsx` | Unreferenced | `WmsStudioTab.tsx` | `#wms-rfid-fitting-btn` |
| `LabelPrintModal.tsx` | Unreferenced | `WmsStudioTab.tsx` | `#wms-label-print-btn` |
| `ConsignmentStudioModal.tsx` | Unreferenced | `PurchaseStudioTab.tsx` | `#purchase-studio-consignment-btn` |
| `SupplierPaymentModal.tsx` | Unreferenced | `PurchaseStudioTab.tsx` | `#purchase-studio-supplier-pay-btn` |
| `EInvoiceStudioModal.tsx` | Unreferenced | `EWayBillManagementTab.tsx` | `#compliance-einvoice-studio-btn` |
| `CommissionStudioModal.tsx` | Unreferenced | `StaffMasterWs.tsx` | `#staff-commissions-btn` |
| `EmployeeAttendanceModal.tsx` | Unreferenced | `StaffMasterWs.tsx` | `#staff-attendance-modal-btn` |
| `CodeSelectDlg.tsx` | Unreferenced | `ItemMasterWs.tsx` | `#item-code-select-btn` |
| `ReplaceDataDlg.tsx` | Unreferenced | `ItemMasterWs.tsx` | `#item-replace-data-btn` |
| `SecManageDlg.tsx` | Import-Only | `SecurityAccessShell.tsx` | `#security-classic-dlg-btn` |
| `CommunicatorStudioTab.tsx` | Unreferenced Tab | `TabRenderer.tsx` | Routed as `"communicator"` |
| `SalesOrderTab.tsx` | Unreferenced Tab | `TabRenderer.tsx` | Routed as `"sales-orders"` |

## 6. Architecture Impact
- **Zero Database Drift:** No schema alterations or DB migrations.
- **Orphan Elimination:** Drops unreferenced modals from 18 to 0 (100% resolution).
- **Import-Only Elimination:** Drops import-only modals from 1 to 0 (100% resolution).
- **Zero Unreferenced Functional Workspaces:** Mainline workspaces fully integrated into the central navigation hub.

## 7. Proposed Design
- Design tokens and badge styling adhering strictly to SAP Fiori Horizon and SMRITI guidelines.
- Clean declarative React lifecycle (`isOpen`, `onClose`, `onNotification`) ensuring zero overhead when modals are closed.

## 8. Files Created
- `docs/implementation/foundation/Domain_Modals_Phase4_Comprehensive_Wiring_Plan_v6.68.0.md`
- `docs/walkthrough/foundation/Domain_Modals_Phase4_Comprehensive_Wiring_v6.68.0.md`

## 9. Files Modified
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

## 10. Dependencies
- Internal calculation engines (`commissionEngine.ts`, `employeeAttendanceEngine.ts`, `labelPrintEngine.ts`, `skuGenerationEngine.ts`, etc.).
- Central router `TabRenderer.tsx` with dynamic lazy suspense.

## 11. Risks
- Minor UI button overcrowding on narrow viewport screens: Resolved via responsive hiding classes (`hidden lg:inline`, `hidden sm:inline`).

## 12. Rollback Strategy
- Atomic Git rollback via `git revert HEAD` if any regression is detected.

## 13. Verification Plan
- Automated audit execution via `python scripts/audit_pending_ux.py` confirming 0 unreferenced modals and 0 import-only modals.
- Version SSOT validation via `python scripts/validate_version_ssot.py`.
- TypeScript type-checking via `npx tsc --noEmit`.
- Vitest unit tests execution.

## 14. Test Plan
- Verify all action buttons open their designated modals.
- Verify modal escape / close handlers cleanly reset state.
- Verify tab routing for `"communicator"` and `"sales-orders"`.

## 15. Documentation Impact
- Implementation plan registered in `docs/implementation/README.md`.
- Walkthrough registered in `docs/walkthrough/README.md`.
- `CHANGELOG.md` updated with v6.68.0 release details.

## 16. Deployment Plan
- Immediate availability across retail POS, back-office ERP, and fulfillment terminals.

## 17. Status
Completed

## 18. Related ADRs
- `ADR-001`: FastAPI Sole System of Record Architecture
- `ADR-045`: Shell Tab Router Dynamic Suspense
- `ADR-HR-001`: Staff 360 Workspace Governance

## 19. Related Walkthroughs
- `docs/walkthrough/foundation/Domain_Modals_Phase4_Comprehensive_Wiring_v6.68.0.md`
- `docs/walkthrough/foundation/Domain_Modals_Phase3_API_Backed_Wiring_v6.67.0.md`
