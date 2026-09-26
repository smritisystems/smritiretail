/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.28.0
 * Created      : 2026-09-16
 * Modified     : 2026-09-16
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 */
import React, { Suspense, lazy } from "react";
import {
  Product,
  POSProfile,
  Shift,
  FieldInfo,
  Formula,
  PSVParty,
} from "../../types.js";
import { SmritiErrorBoundary } from "../ErrorBoundary.tsx";

// Synchronously imported (lightweight or frequently used)
import { DashboardTab } from "../DashboardTab.tsx";
import { FieldExplorerTab } from "../FieldExplorerTab.tsx";
import { FormulaRegistryTab } from "../FormulaRegistryTab.tsx";
import { PsvTab } from "../PsvTab.tsx";
import { PosProfilesTab } from "../PosProfilesTab.tsx";
import { WikiTab } from "../WikiTab.tsx";
import { CustomerMasterTab } from "../CustomerMasterTab.tsx";
import { VendorMasterWs } from "../vendor/VendorMasterWs.tsx";
import { DocumentSeriesTab } from "../DocumentSeriesTab.tsx";
import { UserProfileTab } from "../UserProfileTab.tsx";
import { AboutSmritiTab } from "../AboutSmritiTab.tsx";
import { TaxInvoicePrintPage } from "../TaxInvoicePrintPag.tsx";
import { DevTrackerTab } from "../../modules/dev_tracker/ui/DevTrackerTab.tsx";
import { FioriLaunchpad } from "../launchpad/FioriLaunchpad.tsx";
import { SecurityAccessShell } from "../security/SecurityAccessShell.tsx";

// Lazy-loaded components (heavy feature modules)
const SalesStudioTab = lazy(() => import("../SalesStudioTab.tsx").then(m => ({ default: m.SalesStudioTab })));
const EWayBillManagementTab = lazy(() => import("../compliance/EWayBillManagementTab.tsx").then(m => ({ default: m.EWayBillManagementTab })));
const ReportDesignerTab = lazy(() => import("../ReportDesignerTab.tsx").then(m => ({ default: m.ReportDesignerTab })));
const PurchaseStudioTab = lazy(() => import("../PurchaseStudioTab.tsx").then(m => ({ default: m.PurchaseStudioTab })));
const GrnStudioTab = lazy(() => import("../GrnStudioTab.tsx").then(m => ({ default: m.GrnStudioTab })));
const ItemMasterWs = lazy(() => import("../itemMaster/ItemMasterWs.tsx").then(m => ({ default: m.ItemMasterWs })));
const BarcodeStudioTab = lazy(() => import("../BarcodeStudioTab.tsx").then(m => ({ default: m.BarcodeStudioTab })));
const BarcodeManagementTab = lazy(() => import("../BarcodeManagementTab.tsx").then(m => ({ default: m.BarcodeManagementTab })));
const MasterManagementTab = lazy(() => import("../MasterMgmtTab.tsx").then(m => ({ default: m.MasterManagementTab })));
const CrmStudioTab = lazy(() => import("../CrmStudioTab.tsx").then(m => ({ default: m.CrmStudioTab })));
const LoyaltyStudioTab = lazy(() => import("../LoyaltyStudioTab.tsx").then(m => ({ default: m.LoyaltyStudioTab })));
const ApprovalMatrixTab = lazy(() => import("../ApprovalMatrixTab.tsx").then(m => ({ default: m.ApprovalMatrixTab })));
const StaffManagementTab = lazy(() => import("../StaffManagementTab.tsx").then(m => ({ default: m.StaffManagementTab })));
const PrintStudioTab = lazy(() => import("../../print_engine/PrintStudioTab.tsx").then(m => ({ default: m.PrintStudioTab })));
const PrintHistoryTab = lazy(() => import("../../print_engine/PrintHistoryTab.tsx").then(m => ({ default: m.PrintHistoryTab })));
const TrainingAcademyTab = lazy(() => import("../training/TrainingAcademyTab.tsx").then(m => ({ default: m.TrainingAcademyTab })));
const AccountingSyncTab = lazy(() => import("../AccountingSyncTab.tsx").then(m => ({ default: m.AccountingSyncTab })));
const BusinessLedgerTab = lazy(() => import("../BusinessLedgerTab.tsx").then(m => ({ default: m.BusinessLedgerTab })));
const StockLedgerTab = lazy(() => import("../StockLedgerTab.tsx").then(m => ({ default: m.StockLedgerTab })));
const AuditLogsTab = lazy(() => import("../AuditLogsTab.tsx").then(m => ({ default: m.AuditLogsTab })));
const TermsEngineTab = lazy(() => import("../TermsEngineTab.tsx").then(m => ({ default: m.TermsEngineTab })));
const DataExchangeTab = lazy(() => import("../DataExchangeTab.tsx").then(m => ({ default: m.DataExchangeTab })));
const DatabaseManagerTab = lazy(() => import("../DatabaseManagerTab.tsx").then(m => ({ default: m.DatabaseManagerTab })));
const LegacyMigDashTab = lazy(() => import("../LegacyMigDashTab.tsx").then(m => ({ default: m.LegacyMigDashTab })));
const PhysicalStockTab = lazy(() => import("../PhysicalStockTab.tsx").then(m => ({ default: m.PhysicalStockTab })));
const StorePolicyStudio = lazy(() => import("../StorePolicyStudio.tsx").then(m => ({ default: m.StorePolicyStudio })));
const SmritiSystemParametersStudio = lazy(() => import("../setup/SmritiSystemParametersStudio.tsx").then(m => ({ default: m.SmritiSystemParametersStudio })));
const SmritiSalesPromotionsStudio = lazy(() => import("../promotions/SmritiSalesPromotionsStudio.tsx").then(m => ({ default: m.SmritiSalesPromotionsStudio })));
const WmsStudioTab = lazy(() => import("../wms/WmsStudioTab.tsx").then(m => ({ default: m.WmsStudioTab })));
const SetupWizardTab = lazy(() => import("../SetupWizard/SetupWizardTab.tsx").then(m => ({ default: m.SetupWizardTab })));
const MenuManagerStudioTab = lazy(() => import("../MenuManagerStudioTab.tsx").then(m => ({ default: m.MenuManagerStudioTab })));
const BillingWorkspace = lazy(() => import("../billing/BillingWorkspace.tsx").then(m => ({ default: m.BillingWorkspace })));
const DispatchInvoicingStudioTab = lazy(() => import("../sales/DispatchInvoicingStudioTab.tsx").then(m => ({ default: m.DispatchInvoicingStudioTab })));

export const TabLoadingFallback: React.FC = () => (
  <div className="w-full h-full flex flex-col items-center justify-center bg-theme-base text-theme-primary">
    <div className="animate-spin rounded-full h-12 w-12 border-4 border-theme-divider border-t-[#2563EB]" />
    <p className="mt-4 text-sm font-mono text-theme-muted">Loading module...</p>
  </div>
);

export const mapModuleId = (id: string): string => {
  const map: Record<string, string> = {
    launchpad: "launchpad",
    item_master: "item-master",
    inventory: "stock-ledger",
    suppliers: "vendor-360",
    "supplier-mgmt": "vendor-360",
    "vendor-360": "vendor-360",
    "vendor-master": "vendor-360",
    vendor: "vendor-360",
    vendors: "vendor-360",
    supplier: "vendor-360",
    "supplier-directory": "vendor-360",
    "supplier_directory": "vendor-360",
    "vendor_directory": "vendor-360",
    reports: "report-designer",
    dev_tracker: "dev-tracker",
    system: "masters",
    settings: "profiles",
    about: "about-smriti",
    grn: "grn-studio",
    "grn-studio": "grn-studio",
    grn_studio: "grn-studio",
    "goods-receipt": "grn-studio",
    goods_receipt: "grn-studio",
    "material-inward": "grn-studio",
    material_inward: "grn-studio",
    "menu-manager": "menu-manager",
    menu_manager: "menu-manager",
    menu_studio: "menu-manager",
    "menu-studio": "menu-manager",
    "day-close": "day-close",
    day_close: "day-close",
    "day-end": "day-close",
    day_end: "day-close",
    "eod-report": "day-close",
    security: "security-management",
    security_management: "security-management",
    "sales-promotions": "sales-promotions",
    "promotions-studio": "sales-promotions",
    promotions: "sales-promotions",
    sales_promotions: "sales-promotions",
    "menu-sales-promotions": "sales-promotions",
    menu_access: "security-management",
    "menu-dashboard": "dashboard",
    "menu-user-profile": "user-profile",
    billing: "billing-workspace",
    "billing-workspace": "billing-workspace",
    billing_workspace: "billing-workspace",
    pos: "billing-workspace",
    "menu-pos": "billing-workspace",
    "menu-billing": "billing-workspace",
    "menu-desktop-billing": "billing-workspace",
    "create-tax-invoice": "billing-workspace",
    "dist-invoice": "billing-workspace",
    "tax-invoice": "billing-workspace",
    "ewaybill-management": "ewaybill-management",
    ewaybill_management: "ewaybill-management",
    "eway-bill-management": "ewaybill-management",
    "menu-sales": "sales",
    "menu-customer-master": "customer-master",
    "menu-crm": "crm",
    "menu-loyalty": "loyalty",
    "menu-inventory": "inventory",
    "menu-item-master": "item-master",
    "menu-barcode": "barcode",
    "menu-barcode-management": "barcode-management",
    "barcode-management": "barcode-management",
    "menu-stock-ledger": "stock-ledger",
    "menu-purchase": "purchase",
    "menu-supplier-mgmt": "vendor-360",
    "menu-vendor-360": "vendor-360",
    "menu-business-ledger": "business-ledger",
    "menu-accounting-sync": "accounting-sync",
    "menu-reports": "report-designer",
    "menu-report-designer": "report-designer",
    "menu-masters": "masters",
    "menu-ufe": "ufe",
    "menu-formulas": "formulas",
    "menu-psv": "psv",
    "menu-document-series": "document-series",
    "menu-print-studio": "print-studio",
    "menu-print-history": "print-history",
    "menu-terms-engine": "terms-engine",
    "menu-data-exchange": "data-exchange",
    "menu-staff-management": "staff-management",
    "menu-approval-matrix": "approval-matrix",
    "menu-company-setup": "company-setup",
    "menu-audit-logs": "audit-logs",
    "b2b-dispatch-studio": "dispatch-studio",
    "dispatch-studio": "dispatch-studio",
    "dispatch": "dispatch-studio",
    "menu-dispatch-studio": "dispatch-studio",
  };
  return map[id] || id;
};

export interface TabRendererContextProps {
  currentUser: {
    role: string;
    name: string;
    passwordResetRequired?: boolean;
    companyId?: string;
    branchId?: string;
  } | null;
  products: Product[];
  profiles: POSProfile[];
  shifts: Shift[];
  fields: FieldInfo[];
  formulas: Formula[];
  psvParties: PSVParty[];
  fetchSystemState: () => Promise<void>;
  addNotification: (title: string, message: string, type?: any) => void;
  setActiveTab: (tab: string) => void;
  setSelectedFormula: (f: Formula | null) => void;
  markSetupCompleted: () => void;
}

export const renderTabNode = (tabId: string, ctx: TabRendererContextProps): React.ReactNode => {
  const {
    currentUser,
    products,
    profiles,
    shifts,
    fields,
    formulas,
    psvParties,
    fetchSystemState,
    addNotification,
    setActiveTab,
    setSelectedFormula,
    markSetupCompleted,
  } = ctx;

  switch (tabId) {
    case "dashboard":
      return (
        <DashboardTab
          products={products}
          formulas={formulas}
          psvParties={psvParties}
          onSelectFormula={(formula) => setSelectedFormula(formula)}
        />
      );
    case "launchpad":
      return (
        <FioriLaunchpad
          currentUser={currentUser}
          onSelectModule={(modId) => {
            setActiveTab(mapModuleId(modId));
          }}
        />
      );
    case "day-close":
    case "day-end":
    case "eod-report":
      return (
        <BillingWorkspace
          products={products}
          profiles={profiles}
          shifts={shifts}
          currentUser={currentUser}
          onRefreshData={fetchSystemState}
          onNotification={addNotification}
          initialMode="RETAIL_POS"
          initialView="EOD_Z_REPORT"
        />
      );
    case "crm":
      return <CrmStudioTab currentUser={currentUser} />;
    case "customer-master":
      return <CustomerMasterTab currentUser={currentUser} onNotification={addNotification} />;
    case "loyalty":
      return <LoyaltyStudioTab currentUser={currentUser} />;
    case "staff-management":
      return <StaffManagementTab currentUser={currentUser} />;
    case "user-profile":
      return <UserProfileTab />;
    case "ufe":
      return <FieldExplorerTab fields={fields} />;
    case "formulas":
      return (
        <FormulaRegistryTab
          formulas={formulas}
          onSelectFormula={(f) => setSelectedFormula(f)}
        />
      );
    case "psv":
      return <PsvTab psvParties={psvParties} currentUser={currentUser} />;
    case "billing-workspace":
    case "billing":
    case "pos":
      return (
        <BillingWorkspace
          products={products}
          profiles={profiles}
          shifts={shifts}
          currentUser={currentUser}
          onRefreshData={fetchSystemState}
          onNotification={addNotification}
          initialMode="RETAIL_POS"
        />
      );
    case "credit-billing":
    case "credit-sale":
      return (
        <BillingWorkspace
          products={products}
          profiles={profiles}
          shifts={shifts}
          currentUser={currentUser}
          onRefreshData={fetchSystemState}
          onNotification={addNotification}
          initialMode="RETAIL_POS"
          initialView="CREDIT_BILLING"
        />
      );
    case "tax-invoice":
    case "dist-invoice":
    case "create-tax-invoice":
      return (
        <BillingWorkspace
          products={products}
          profiles={profiles}
          shifts={shifts}
          currentUser={currentUser}
          onRefreshData={fetchSystemState}
          onNotification={addNotification}
          initialMode="RETAIL_POS"
        />
      );
    case "sales":
      return (
        <SalesStudioTab
          products={products}
          onNotification={addNotification}
          currentUser={currentUser}
        />
      );
    case "ewaybill-management":
      return <EWayBillManagementTab onNotification={addNotification} />;
    case "purchase":
      return (
        <PurchaseStudioTab
          products={products}
          onRefreshProducts={fetchSystemState}
          onNotification={addNotification}
          currentUser={currentUser}
          onNavigateTab={(tab) => setActiveTab(tab)}
        />
      );
    case "grn-studio":
    case "grn":
    case "goods-receipt":
    case "material-inward":
      return (
        <GrnStudioTab
          currentUser={currentUser}
          onNotification={addNotification}
          onClose={() => setActiveTab("purchase")}
          onNavigateTab={(tab) => setActiveTab(tab)}
        />
      );
    case "supplier-mgmt":
    case "vendor-360":
    case "vendor-master":
    case "vendors":
    case "supplier":
      return <VendorMasterWs currentUser={currentUser} onNotification={addNotification} />;
    case "reports":
    case "report-designer":
      return <ReportDesignerTab currentUser={currentUser} />;
    case "item-master":
      return (
        <ItemMasterWs
          products={products}
          onRefreshProducts={fetchSystemState}
          onNotification={addNotification}
          currentUser={currentUser}
          initialSubTab="registry"
        />
      );
    case "item-create-grid":
      return (
        <ItemMasterWs
          products={products}
          onRefreshProducts={fetchSystemState}
          onNotification={addNotification}
          currentUser={currentUser}
          initialSubTab="excel-grid"
        />
      );
    case "profiles":
      return (
        <PosProfilesTab
          profiles={profiles}
          onRefreshData={fetchSystemState}
          onNotification={addNotification}
        />
      );
    case "wiki":
      return <WikiTab onNotification={addNotification} />;
    case "barcode":
      return (
        <BarcodeStudioTab
          currentUser={currentUser}
          products={products}
          onNotification={addNotification}
        />
      );
    case "barcode-management":
      return <BarcodeManagementTab />;
    case "masters":
      return <MasterManagementTab onNotification={addNotification} />;
    case "document-series":
      return <DocumentSeriesTab />;
    case "approval-matrix":
      return <ApprovalMatrixTab />;
    case "print-studio":
      return <PrintStudioTab />;
    case "print-history":
      return <PrintHistoryTab />;
    case "about-smriti":
      return <AboutSmritiTab />;
    case "tax-invoice-print":
    case "statutory-a4":
      return <TaxInvoicePrintPage />;
    case "training-academy":
      return <TrainingAcademyTab />;
    case "dev-tracker":
      return <DevTrackerTab />;
    case "accounting-sync":
      return <AccountingSyncTab />;
    case "business-ledger":
      return <BusinessLedgerTab currentUser={currentUser} />;
    case "inventory":
    case "stock-ledger":
      return <StockLedgerTab currentUser={currentUser} />;
    case "audit-logs":
      return <AuditLogsTab />;
    case "terms-engine":
      return <TermsEngineTab />;
    case "data-exchange":
      return <DataExchangeTab onNotification={addNotification} />;
    case "database-manager":
      return <DatabaseManagerTab onNotification={addNotification} />;
    case "legacy-migration":
      return <LegacyMigDashTab />;
    case "physical-stock":
    case "stock-count":
    case "physical-inventory":
      return <PhysicalStockTab />;
    case "store-policies":
    case "governed-policies":
    case "policy-studio":
      return <StorePolicyStudio />;
    case "system-parameters":
    case "parameters-studio":
    case "sys-params":
      return <SmritiSystemParametersStudio onClose={() => setActiveTab("dashboard")} />;
    case "sales-promotions":
    case "promotions-studio":
    case "promotions":
      return <SmritiSalesPromotionsStudio onClose={() => setActiveTab("dashboard")} onNotification={addNotification} />;
    case "wms":
    case "wms-dashboard":
    case "stock-transfers":
    case "warehouse-management":
      return <WmsStudioTab currentUser={currentUser} onNotification={addNotification} />;
    case "company-setup":
      return (
        <SetupWizardTab 
          onComplete={() => {
            markSetupCompleted();
            addNotification("Setup Complete", "Welcome to SMRITI Retail OS dashboard!", "success");
            setActiveTab("dashboard");
          }} 
        />
      );
    case "menu-manager":
    case "menu-studio":
      return <MenuManagerStudioTab currentUser={currentUser} onNavigateTab={(t) => setActiveTab(t)} />;
    case "security-management":
      return (
        <SecurityAccessShell
          initialSection="users"
          onNavigateAway={() => setActiveTab("dashboard")}
        />
      );
    case "menu-access-control":
      return (
        <SecurityAccessShell
          initialSection="menu-access"
          onNavigateAway={() => setActiveTab("dashboard")}
        />
      );
    case "security-configuration":
      return (
        <SecurityAccessShell
          initialSection="security-config"
          onNavigateAway={() => setActiveTab("dashboard")}
        />
      );
    case "dispatch-studio":
    case "b2b-dispatch-studio":
    case "dispatch":
      return <DispatchInvoicingStudioTab currentUser={currentUser} onNotification={addNotification} />;
    default:
      return <div className="p-4 text-theme-muted font-mono text-xs">Tab {tabId} not found.</div>;
  }
};

export interface TabRendererProps extends TabRendererContextProps {
  tabId: string;
}

export const TabRenderer: React.FC<TabRendererProps> = (props) => {
  return (
    <SmritiErrorBoundary key={props.tabId} tabId={props.tabId} onNotification={props.addNotification}>
      <Suspense fallback={<TabLoadingFallback />}>
        {renderTabNode(props.tabId, props)}
      </Suspense>
    </SmritiErrorBoundary>
  );
};
