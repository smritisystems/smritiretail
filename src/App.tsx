/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.17.0
 * Created      : 2026-07-10
 * Modified     : 2026-08-17
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 */
import React, { useState, useEffect, useRef, Suspense, lazy } from "react";
import { apiFetch, apiFetchV1 } from "./lib/apiFetch.ts";
import { motion, AnimatePresence } from "motion/react";
import {
  Product,
  POSProfile,
  Shift,
  FieldInfo,
  Formula,
  PSVParty,
} from "./types.js";

// Import Layout Engine
import {
  LayoutEngineProvider,
  useLayoutEngine,
} from "./layout_engine/layout_store.tsx";
import { LayoutManager } from "./layout_engine/layout_manager.tsx";

// Synchronously imported (lightweight or frequently used)
import { DashboardTab } from "./components/DashboardTab.tsx";
import { PosTerminalTab } from "./components/PosTerminalTab.tsx";
import { FieldExplorerTab } from "./components/FieldExplorerTab.tsx";
import { FormulaRegistryTab } from "./components/FormulaRegistryTab.tsx";
import { PsvTab } from "./components/PsvTab.tsx";
import { PosProfilesTab } from "./components/PosProfilesTab.tsx";
import { AdvancedBillingEngine } from "./components/AdvancedBillingEng.tsx";
import { WikiTab } from "./components/WikiTab.tsx";
import { CustomerMasterTab } from "./components/CustomerMasterTab.tsx";
import { SupplierDashboardTab } from "./components/SupplierDashTab.tsx";
import { ExplainModal } from "./components/ExplainModal.tsx";
import { DrillDownProvider } from "./components/drilldown/drilldown_store.tsx";
import { DrillDownBreadcrumbs } from "./components/drilldown/DrillDownCrumbs.tsx";
import { DrillDownSidePanel } from "./components/drilldown/DrillDownSidePanel.tsx";
import { GlobalSearch } from "./components/drilldown/GlobalSearch.tsx";
import { GlobalF2BrowseModal } from "./components/drilldown/GlobalF2BrowseDlg.tsx";
import { QuickActionsMenu } from "./components/QuickActionsMenu.tsx";
import { DocumentSeriesTab } from "./components/DocumentSeriesTab.tsx";
import { UserProfileTab } from "./components/UserProfileTab.tsx";
import { NotificationProvider, useNotifications } from "./notifications/notification_store.tsx";
import { ActiveFieldProvider } from "./context/ActiveFieldContext.tsx";
import { ContextualInspectorHUD } from "./components/drilldown/CtxInspectorHUD.tsx";
import { ContextProvider } from "./context-actions/ContextProvider.tsx";
import { ContextRenderer } from "./context-actions/ContextRenderer.tsx";
import { registerAllDefaultActions } from "./context-actions/providers/SMRITIModuleActions.ts";
import { PrintProvider } from "./print_engine/print_store.tsx";
import { AboutSmritiTab } from "./components/AboutSmritiTab.tsx";
import { TaxInvoicePrintPage } from "./components/TaxInvoicePrintPag.tsx";
import { DevTrackerTab } from "./modules/dev_tracker/ui/DevTrackerTab.tsx";
import { useLayoutModuleRegistration } from "./components/SmritiBaseModule.tsx";
import { WorkspaceProvider, useWorkspace } from "./contexts/WorkspaceContext.tsx";
import { FloatingWindowHost } from "./components/FloatingWindowHost.tsx";
import { ShortcutProvider } from "./contexts/ShortcutContext.tsx";
import { ShortcutPalette } from "./components/ShortcutPalette.tsx";
import { PasswordReset } from "./components/PasswordReset.tsx";
import { LoginScreen } from "./components/LoginScreen.tsx";
import { CompanySelectionScreen } from "./components/CompanySelectScree.tsx";
import { SmritiErrorBoundary } from "./components/ErrorBoundary.tsx";
import { clearAuthSession, normalizeBranchId, normalizeCompanyId, persistTenantContext } from "./lib/apiFetchV1.ts";
import { AppShell } from "./components/shell/AppShell.tsx";
import { FioriLaunchpad } from "./components/launchpad/FioriLaunchpad.tsx";
import { SecManageDlg } from "./components/security/SecManageDlg.tsx";
import { SalesOrderFormPremium } from "./components/sales/SalesOrderFormPremium.tsx";
import { VendorReturnModal } from "./components/procurement/VendorReturnModal.tsx";
import { X } from "lucide-react";

// Lazy-loaded components (heavy feature modules)
const SalesStudioTab = lazy(() => import("./components/SalesStudioTab.tsx").then(m => ({ default: m.SalesStudioTab })));
const ReportDesignerTab = lazy(() => import("./components/ReportDesignerTab.tsx").then(m => ({ default: m.ReportDesignerTab })));
const PurchaseStudioTab = lazy(() => import("./components/PurchaseStudioTab.tsx").then(m => ({ default: m.PurchaseStudioTab })));
const ItemMasterTab = lazy(() => import("./components/ItemMasterTab.tsx").then(m => ({ default: m.ItemMasterTab })));
const BarcodeStudioTab = lazy(() => import("./components/BarcodeStudioTab.tsx").then(m => ({ default: m.BarcodeStudioTab })));
const MasterManagementTab = lazy(() => import("./components/MasterMgmtTab.tsx").then(m => ({ default: m.MasterManagementTab })));
const CrmStudioTab = lazy(() => import("./components/CrmStudioTab.tsx").then(m => ({ default: m.CrmStudioTab })));
const LoyaltyStudioTab = lazy(() => import("./components/LoyaltyStudioTab.tsx").then(m => ({ default: m.LoyaltyStudioTab })));
const ApprovalMatrixTab = lazy(() => import("./components/ApprovalMatrixTab.tsx").then(m => ({ default: m.ApprovalMatrixTab })));
const StaffManagementTab = lazy(() => import("./components/StaffManagementTab.tsx").then(m => ({ default: m.StaffManagementTab })));
const PrintStudioTab = lazy(() => import("./print_engine/PrintStudioTab.tsx").then(m => ({ default: m.PrintStudioTab })));
const PrintHistoryTab = lazy(() => import("./print_engine/PrintHistoryTab.tsx").then(m => ({ default: m.PrintHistoryTab })));
const DistTaxInvoice = lazy(() => import("./components/sales/DistTaxInvoice.tsx").then(m => ({ default: m.DistTaxInvoice })));
const TrainingAcademyTab = lazy(() => import("./components/training/TrainingAcademyTab.tsx").then(m => ({ default: m.TrainingAcademyTab })));
const AccountingSyncTab = lazy(() => import("./components/AccountingSyncTab.tsx").then(m => ({ default: m.AccountingSyncTab })));
const BusinessLedgerTab = lazy(() => import("./components/BusinessLedgerTab.tsx").then(m => ({ default: m.BusinessLedgerTab })));
const StockLedgerTab = lazy(() => import("./components/StockLedgerTab.tsx").then(m => ({ default: m.StockLedgerTab })));
const AuditLogsTab = lazy(() => import("./components/AuditLogsTab.tsx").then(m => ({ default: m.AuditLogsTab })));
const TermsEngineTab = lazy(() => import("./components/TermsEngineTab.tsx").then(m => ({ default: m.TermsEngineTab })));
const DataExchangeTab = lazy(() => import("./components/DataExchangeTab.tsx").then(m => ({ default: m.DataExchangeTab })));
const DatabaseManagerTab = lazy(() => import("./components/DatabaseManagerTab.tsx").then(m => ({ default: m.DatabaseManagerTab })));
const LegacyMigDashTab = lazy(() => import("./components/LegacyMigDashTab.tsx").then(m => ({ default: m.LegacyMigDashTab })));
const PhysicalStockTab = lazy(() => import("./components/PhysicalStockTab.tsx").then(m => ({ default: m.PhysicalStockTab })));
const StorePolicyStudio = lazy(() => import("./components/StorePolicyStudio.tsx").then(m => ({ default: m.StorePolicyStudio })));
const WmsStudioTab = lazy(() => import("./components/wms/WmsStudioTab.tsx").then(m => ({ default: m.WmsStudioTab })));
const SetupWizardTab = lazy(() => import("./components/SetupWizard/SetupWizardTab.tsx").then(m => ({ default: m.SetupWizardTab })));
const PrintPreviewModal = lazy(() => import("./components/PrintPreviewModal.tsx").then(m => ({ default: m.PrintPreviewModal })));
const MenuManagerStudioTab = lazy(() => import("./components/MenuManagerStudioTab.tsx").then(m => ({ default: m.MenuManagerStudioTab })));

// Tab loading fallback component
const TabLoadingFallback = () => (
  <div className="w-full h-full flex flex-col items-center justify-center bg-theme-base text-theme-primary">
    <div className="animate-spin rounded-full h-12 w-12 border-4 border-theme-divider border-t-[#2563EB]" />
    <p className="mt-4 text-sm font-mono text-theme-muted">Loading module...</p>
  </div>
);

const StandaloneWindowView: React.FC<{ registeredWorkspaces: Array<{ id: string; label: string; icon: string; }>; renderTabSafe: (id: string) => React.ReactNode; }> = ({ registeredWorkspaces, renderTabSafe }) => {
  const standaloneTab = new URLSearchParams(window.location.search).get("standalone_tab");
  const standaloneSalesOrder = new URLSearchParams(window.location.search).get("standalone_sales_order") === "1";

  if (standaloneSalesOrder) {
    return (
      <div className="fixed inset-0 z-[10000] flex flex-col overflow-hidden bg-[#eceff3] text-slate-800 font-sans select-none border border-slate-300 shadow-2xl">
        {/* Optimized Header - 2 lines, compact spacing */}
        <div className="px-1.5 bg-[#dfe5ee] border-b border-slate-300 flex flex-col shrink-0 shadow-inner">
          {/* Line 1: Action buttons + Title + Window controls */}
          <div className="h-[24px] flex items-center justify-between gap-1 overflow-hidden">
            <div className="flex items-center gap-0.5 shrink-0 min-w-0">
              <button type="button" className="px-1.5 py-0.5 text-[9px] font-semibold border border-slate-300 bg-white rounded-sm hover:bg-slate-100 active:bg-slate-200 transition-colors whitespace-nowrap">View</button>
              <button type="button" className="px-1.5 py-0.5 text-[9px] font-semibold border border-slate-300 bg-white rounded-sm hover:bg-slate-100 active:bg-slate-200 transition-colors whitespace-nowrap">Edit</button>
              <button type="button" className="px-1.5 py-0.5 text-[9px] font-semibold border border-slate-300 bg-white rounded-sm hover:bg-slate-100 active:bg-slate-200 transition-colors whitespace-nowrap">Print</button>
              <button type="button" className="px-1.5 py-0.5 text-[9px] font-semibold border border-slate-300 bg-white rounded-sm hover:bg-slate-100 active:bg-slate-200 transition-colors whitespace-nowrap">Exit</button>
            </div>
            <span className="text-[10px] font-bold tracking-[0.15em] uppercase text-slate-700 text-center whitespace-nowrap flex-shrink-0 px-1">SALES ORDER</span>
            <div className="flex items-center gap-0.5 shrink-0 min-w-0">
              <button
                onClick={() => {
                  const params = new URLSearchParams(window.location.search);
                  const hasFullscreen = params.get("fullscreen") === "1";
                  if (hasFullscreen) {
                    params.delete("fullscreen");
                  } else {
                    params.set("fullscreen", "1");
                  }
                  const nextUrl = `${window.location.pathname}?${params.toString()}`;
                  window.location.href = nextUrl;
                }}
                className="px-1.5 py-0.5 text-[9px] font-semibold border border-slate-300 bg-white rounded-sm hover:bg-slate-100 active:bg-slate-200 transition-colors whitespace-nowrap"
                title="Toggle Full Screen"
              >
                ⛶
              </button>
              <button
                onClick={() => window.close()}
                className="px-1.5 py-0.5 text-[9px] font-semibold border border-slate-300 bg-white rounded-sm hover:bg-rose-100 hover:text-rose-600 active:bg-rose-200 transition-colors whitespace-nowrap"
                title="Close Window"
              >
                ✕
              </button>
            </div>
          </div>
          {/* Line 2: Document info (minimal, appears on tab/desktop) */}
          <div className="h-[20px] px-1 flex items-center gap-2 bg-slate-100/50 border-t border-slate-200 text-[9px] text-slate-600 leading-none overflow-hidden">
            <span className="font-mono whitespace-nowrap">Doc No: SO-000001</span>
            <span className="font-mono whitespace-nowrap">|</span>
            <span className="font-mono whitespace-nowrap">Date: --/--/----</span>
            <span className="flex-1 min-w-0"></span>
            <span className="text-slate-500 whitespace-nowrap">Ready for entry</span>
          </div>
        </div>

        <div className="flex-1 overflow-auto bg-slate-50">
          <SalesOrderFormPremium
            compact
            onSubmit={async () => {}}
            onCancel={() => window.close()}
          />
        </div>
      </div>
    );
  }

  if (!standaloneTab) return null;

  const tabMeta = registeredWorkspaces.find((w) => w.id === standaloneTab);
  const title = tabMeta ? tabMeta.label : standaloneTab;
  const icon = tabMeta ? tabMeta.icon : "description";
  const isStandaloneFullscreen = new URLSearchParams(window.location.search).get("fullscreen") === "1";

  useEffect(() => {
    if (!isStandaloneFullscreen) return;
    const request = () => {
      try {
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen?.().catch(() => {});
        }
      } catch {
        // Ignore if fullscreen request is blocked.
      }
    };
    const timer = window.setTimeout(request, 200);
    return () => window.clearTimeout(timer);
  }, [isStandaloneFullscreen]);

  return (
    <div className="fixed inset-0 z-[10000] flex flex-col overflow-hidden bg-theme-base text-theme-body font-sans select-none">
      <div className="h-10 px-4 bg-theme-surface-1 border-b border-theme-divider flex items-center justify-between shrink-0 shadow-xs">
        <div className="flex items-center space-x-2.5 min-w-0">
          <span className="material-symbols-outlined text-indigo-500 text-lg shrink-0">{icon}</span>
          <span className="text-xs font-bold text-theme-text-primary tracking-wide truncate">{title}</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 font-mono border border-indigo-500/20 shrink-0">
            Isolated Window
          </span>
        </div>
        <div className="flex items-center space-x-2 shrink-0">
          <button
            onClick={() => {
              const params = new URLSearchParams(window.location.search);
              const hasFullscreen = params.get("fullscreen") === "1";
              if (hasFullscreen) {
                params.delete("fullscreen");
              } else {
                params.set("fullscreen", "1");
              }
              const nextUrl = `${window.location.pathname}?${params.toString()}`;
              window.location.href = nextUrl;
            }}
            className="px-2.5 py-1 rounded text-[11px] font-bold bg-theme-surface-2 hover:bg-theme-surface-hover text-theme-body border border-theme-divider transition-all cursor-pointer"
            title={isStandaloneFullscreen ? "Exit Fullscreen" : "Open in Fullscreen"}
          >
            {isStandaloneFullscreen ? "Exit Fullscreen" : "Full Screen"}
          </button>
          <button
            onClick={() => {
              window.location.href = window.location.origin + window.location.pathname;
            }}
            className="px-2.5 py-1 rounded text-[11px] font-bold bg-theme-surface-2 hover:bg-theme-surface-hover text-theme-body border border-theme-divider transition-all cursor-pointer"
            title="Return to Main Application Workspace Shell"
          >
            Dock Back
          </button>
          <button
            onClick={() => window.close()}
            className="p-1.5 rounded hover:bg-rose-500/10 text-theme-muted hover:text-rose-400 transition-colors cursor-pointer"
            title="Close Standalone Window"
          >
            <X size={14} />
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-auto p-2 relative">
        {renderTabSafe(standaloneTab)}
      </div>
    </div>
  );
};

interface AppNotification {
  id: string;
  title: string;
  message: string;
  type: "success" | "error" | "info" | "warning";
}

const AppContent: React.FC = () => {
  const toastIdRef = useRef(0);
  const { preferences, addToRecentlyUsed, registeredWorkspaces } = useLayoutEngine();
  useLayoutModuleRegistration();
  const { globalZoom, popOutTab } = useWorkspace();
  const { addNotification: addSystemNotification } = useNotifications();
  
  const [currentUser, setCurrentUser] = useState<{ role: string; name: string; passwordResetRequired?: boolean; companyId?: string; branchId?: string } | null>(null);
  const [companyContextResolved, setCompanyContextResolved] = useState<boolean>(() => {
    return Boolean(localStorage.getItem("smriti_company_id") && localStorage.getItem("smriti_jwt_token"));
  });
  const [checkingAuth, setCheckingAuth] = useState(true);
  const standaloneVendorReturn = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("standalone_vendor_return") === "1";

  const checkAuth = async () => {
    const token = localStorage.getItem("smriti_jwt_token") || localStorage.getItem("smriti_session_token");
    if (!token) {
      setCurrentUser(null);
      setCompanyContextResolved(false);
      setCheckingAuth(false);
      return;
    }
    try {
      // Migrated: GET /api/auth/me (Express session) → GET /api/v1/auth/me (FastAPI JWT)
      const data = await apiFetchV1("/auth/me");
      if (data) {
        const normalizedCompanyId = normalizeCompanyId(data.company_id ?? localStorage.getItem("smriti_company_id"));
        const normalizedBranchId = normalizeBranchId(data.branch_id ?? localStorage.getItem("smriti_branch_id"));

        if (data.company_id) {
          persistTenantContext({
            companyId: data.company_id,
            companyCode: data.company_code ?? localStorage.getItem("smriti_company_code"),
            branchId: data.branch_id ?? localStorage.getItem("smriti_branch_id"),
            branchCode: data.branch_code ?? localStorage.getItem("smriti_branch_code"),
            companyName: data.company_name ?? localStorage.getItem("smriti_company_name"),
            branchName: data.branch_name ?? localStorage.getItem("smriti_branch_name"),
          });
        }

        setCurrentUser({
          role: data.role ?? "",
          name: data.display_name || data.full_name || data.username || "",
          companyId: normalizedCompanyId,
          branchId: normalizedBranchId,
          passwordResetRequired: data.password_reset_required ?? false,
        });
        setCompanyContextResolved(Boolean(normalizedCompanyId && normalizedBranchId && localStorage.getItem("smriti_company_id") && localStorage.getItem("smriti_branch_id")));
      } else {
        setCurrentUser(null);
        setCompanyContextResolved(false);
      }
    } catch {
      // apiFetchV1 throws on non-2xx (e.g. 401 expired) — clear token and treat as unauthenticated
      clearAuthSession("auth_check_failed");
      setCurrentUser(null);
      setCompanyContextResolved(false);
    } finally {
      setCheckingAuth(false);
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  const handleLoginSuccess = (user: { role: string; name: string; passwordResetRequired?: boolean; companyId?: string; branchId?: string }) => {
    setCurrentUser(user);
    setCompanyContextResolved(false);
  };

  const handleLogout = () => {
    clearAuthSession("manual_logout");
    setCurrentUser(null);
    setCompanyContextResolved(false);
  };



  useEffect(() => {
    if (!currentUser) return;
    import("./services/customerStore.js").then((m) => {
      m.syncCustomersWithBackend();
    });
  }, [currentUser]);

  useEffect(() => {
    if (currentUser && !currentUser.passwordResetRequired) {
      refreshSetupStatus();
    }
  }, [currentUser]);

  // isSetupCompleted: null = checking, true = done, false = no company yet.
  // IMPORTANT: This flag NEVER auto-routes to the Setup Wizard.
  // The wizard is ONLY accessible via an explicit "Create New Company" action
  // (navigating to the company-setup tab intentionally).
  const [isSetupCompleted, setIsSetupCompleted] = useState<boolean | null>(null);

  const markSetupCompleted = () => {
    setIsSetupCompleted(true);
    if (preferences.lastWorkspace === "company-setup") {
      addToRecentlyUsed("dashboard");
    }
  };

  const refreshSetupStatus = async () => {
    try {
      const data = await apiFetchV1("/setup-status");
      setIsSetupCompleted(Boolean(data?.setupCompleted));
    } catch (error) {
      console.warn("Unable to refresh setup completion status:", error);
      // On error default to true — do NOT show wizard on connectivity failure.
      setIsSetupCompleted(true);
    }
  };

  // Active tab resolution — company-setup is only valid when navigated to explicitly.
  // Never resolve company-setup as the default landing tab from startup.
  const safeLastWorkspace =
    preferences.lastWorkspace === "company-setup"
      ? "dashboard"
      : preferences.lastWorkspace;

  const [activeTab, setActiveTabState] = useState(safeLastWorkspace || "dashboard");

  useEffect(() => {
    setActiveTabState(safeLastWorkspace || "dashboard");
  }, [safeLastWorkspace]);

  const setActiveTab = (tab: string) => {
    setActiveTabState(tab);
    addToRecentlyUsed(tab);
  };

  useEffect(() => {
    if (preferences.lastWorkspace === "company-setup") {
      addToRecentlyUsed("dashboard");
    }
  }, [preferences.lastWorkspace, addToRecentlyUsed]);

  const [products, setProducts] = useState<Product[]>([]);
  const [profiles, setProfiles] = useState<POSProfile[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [fields, setFields] = useState<FieldInfo[]>([]);
  const [formulas, setFormulas] = useState<Formula[]>([]);
  const [psvParties, setPsvParties] = useState<PSVParty[]>([]);
  const [selectedFormula, setSelectedFormula] = useState<Formula | null>(null);

  // Print Preview Dialog State
  const [isPrintPreviewOpen, setIsPrintPreviewOpen] = useState(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      return params.get("print") === "true";
    } catch {
      return false;
    }
  });

  // Custom global event and keyboard shortcuts listeners for print preview
  useEffect(() => {
    const handleOpenPrintPreview = () => {
      setIsPrintPreviewOpen(true);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      // Directs Ctrl+P or Alt+P to custom preview modal
      if ((e.ctrlKey && e.key === "p") || (e.altKey && e.key === "p")) {
        e.preventDefault();
        setIsPrintPreviewOpen(true);
      }
    };

    window.addEventListener("smriti_open_print_preview", handleOpenPrintPreview);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("smriti_open_print_preview", handleOpenPrintPreview);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  // Notifications State
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  const addNotification = (
    title: string,
    message: string,
    type: "success" | "error" | "info" | "warning" = "success",
  ) => {
    toastIdRef.current += 1;
    const cleanTitle = title.toLowerCase().replace(/[^a-z0-9]/g, "").substring(0, 10);
    const cleanMsg = message.toLowerCase().replace(/[^a-z0-9]/g, "").substring(0, 10);
    const id = `toast-${toastIdRef.current}-${cleanTitle}-${cleanMsg}`;
    setNotifications((prev) => [...prev, { id, title, message, type }]);
    setTimeout(() => {
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    }, 4000);

    // Also add to the global notification system so it appears in real-time feeds
    addSystemNotification({
      title,
      message,
      type: "activity",
      priority: "low",
    });
  };

  useEffect(() => {
    registerAllDefaultActions((n: any) => {
      addNotification(n.title, n.message, n.type === "alert" || n.type === "error" ? "error" : "success");
    });
  }, []);

  // Fetch initial system state
  const fetchSystemState = async () => {
    try {
      // Migrated: /pos/registers/ → /pos/profiles/ (returns camelCase POSProfileResponse)
      // Migrated: /pos/shifts/ (FastAPI list endpoint — v3.22.0, replaces broken Express stub)
      const [profData, shiftsData] = await Promise.all([
        apiFetchV1("/pos/profiles/"),
        apiFetchV1("/pos/shifts/").catch(() => []),  // graceful fallback if no shifts yet
      ]);

      if (Array.isArray(profData)) setProfiles(profData);
      if (Array.isArray(shiftsData)) setShifts(shiftsData);

      // Legacy Express placeholder routes are currently not implemented on the backend.
      // Avoid calling them here so the page does not produce auth/501 errors during startup.
      setFields([]);
      setFormulas([]);
      setPsvParties([]);

      // Fetch products from FastAPI backend
      try {
        const prodData = await apiFetchV1("/inventory/?page=1&page_size=100");
        const rawList = Array.isArray(prodData) ? prodData : (Array.isArray(prodData?.items) ? prodData.items : []);
        const mappedProducts = rawList.map((p: any) => {
          const secBarcodes = Array.isArray(p.secondary_barcodes) ? p.secondary_barcodes : [];
          return {
            id: p.id,
            code: p.code,
            name: p.name,
            price: parseFloat(p.price || 0),
            stock: Number(p.stock || 0),
            category: p.category,
            isFavorite: Boolean(p.is_favorite),
            barcode: p.barcode,
            secondaryBarcodes: secBarcodes,
            barcodes: [
              { type: "Code128", value: p.barcode, isPrimary: true },
              ...secBarcodes.map((val: string) => ({ type: "Code128", value: val, isPrimary: false }))
            ],
            brand: p.brand,
            color: p.color,
            size: p.size,
            mrp: p.mrp ? parseFloat(p.mrp) : undefined,
            gstPercentage: p.gst_percentage ? parseFloat(p.gst_percentage) : 18,
            styleCode: p.style_code,
            costPrice: p.cost_price ? parseFloat(p.cost_price) : 0,
            sku: p.sku,
            hsnCode: p.hsn_code,
            attributes: p.attributes || {},
            pricingMode: p.pricing_mode,
            trackingMode: p.tracking_mode,
            variantTemplateId: p.variant_template_id,
            weightGrams: p.weight_grams ? parseFloat(p.weight_grams) : 0
          };
        });
        setProducts(mappedProducts);
      } catch (err) {
        console.error("Failed to load products from FastAPI:", err);
      }

      try {
        const psvData = await apiFetchV1("/psv/parties");
        if (Array.isArray(psvData)) {
          setPsvParties(psvData);
        }
      } catch (err) {
        console.error("Failed to load PSV parties from FastAPI:", err);
      }
    } catch (error) {
      console.error("Critical error syncing system data:", error);
    }
  };

  useEffect(() => {
    if (currentUser) {
      fetchSystemState();
    }
  }, [currentUser]);

  useEffect(() => {
    const handlePopoutEvent = () => {
      const tabConfig = registeredWorkspaces.find((w) => w.id === activeTab);
      const title = tabConfig ? tabConfig.label : "Workspace Document";
      const icon = tabConfig ? tabConfig.icon : "description";
      popOutTab(activeTab, title, icon);
    };
    window.addEventListener("smriti_popout_current_tab", handlePopoutEvent);
    return () => {
      window.removeEventListener("smriti_popout_current_tab", handlePopoutEvent);
    };
  }, [activeTab, registeredWorkspaces, popOutTab]);

  const mapModuleId = (id: string): string => {
    const map: Record<string, string> = {
      launchpad: "launchpad",
      item_master: "item-master",
      inventory: "stock-ledger",
      suppliers: "supplier-mgmt",
      reports: "report-designer",
      dev_tracker: "dev-tracker",
      system: "masters",
      settings: "profiles",
      about: "about-smriti",
      grn: "purchase",
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
      menu_access: "security-management",
      "menu-dashboard": "dashboard",
      "menu-user-profile": "user-profile",
      "menu-pos": "pos",
      "menu-sales": "sales",
      "menu-customer-master": "customer-master",
      "menu-crm": "crm",
      "menu-loyalty": "loyalty",
      "menu-inventory": "inventory",
      "menu-item-master": "item-master",
      "menu-barcode": "barcode",
      "menu-stock-ledger": "stock-ledger",
      "menu-purchase": "purchase",
      "menu-supplier-mgmt": "supplier-mgmt",
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
    };
    return map[id] || id;
  };

  useEffect(() => {
    const handleMenuSearchNavigation = (event: Event) => {
      const detail = (event as CustomEvent<{ moduleId?: string; searchQuery?: string }>).detail;
      const moduleId = detail?.moduleId;
      if (moduleId === "stock-ledger" && detail?.searchQuery) {
        sessionStorage.setItem("smriti_stock_ledger_search", detail.searchQuery);
      }
      if (moduleId) setActiveTab(mapModuleId(moduleId));
    };
    window.addEventListener("smriti_navigate_module", handleMenuSearchNavigation);
    return () => window.removeEventListener("smriti_navigate_module", handleMenuSearchNavigation);
  }, []);

  const renderTab = (tabId: string) => {
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
      case "pos":
        return (
          <PosTerminalTab
            products={products}
            profiles={profiles}
            shifts={shifts}
            onRefreshData={fetchSystemState}
            onNotification={addNotification}
          />
        );
      case "day-close":
      case "day-end":
      case "eod-report":
        return (
          <PosTerminalTab
            products={products}
            profiles={profiles}
            shifts={shifts}
            onRefreshData={fetchSystemState}
            onNotification={addNotification}
            initialTab="EOD_Z_REPORT"
          />
        );
      case "crm":
        return <CrmStudioTab currentUser={currentUser} />;
      case "customer-master":
        return <CustomerMasterTab currentUser={currentUser} />;
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
      case "sales":
        return (
          <SalesStudioTab
            products={products}
            onNotification={addNotification}
            currentUser={currentUser}
          />
        );
      case "create-tax-invoice":
        return (
          <PosTerminalTab
            products={products}
            profiles={profiles}
            shifts={shifts}
            onRefreshData={fetchSystemState}
            onNotification={addNotification}
          />
        );
      case "purchase":
        return (
          <PurchaseStudioTab
            products={products}
            onRefreshProducts={fetchSystemState}
            onNotification={addNotification}
            currentUser={currentUser}
          />
        );
      case "supplier-mgmt":
        return <SupplierDashboardTab currentUser={currentUser} />;
      case "report-designer":
        return <ReportDesignerTab currentUser={currentUser} />;
      case "item-master":
        return (
          <ItemMasterTab
            products={products}
            onRefreshProducts={fetchSystemState}
            onNotification={addNotification}
            currentUser={currentUser}
            initialSubTab="registry"
          />
        );
      case "item-create-grid":
        return (
          <ItemMasterTab
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
      case "tax-invoice":
      case "distributor-tax-invoice":
      case "tax-invoice-workspace":
        return (
          <DistTaxInvoice
            onNotification={addNotification}
            currentUser={currentUser}
          />
        );
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
      case "menu-access-control":
        return (
          <div className="w-full h-full flex items-center justify-center p-2">
            <SecManageDlg
              isOpen={true}
              onClose={() => setActiveTab("dashboard")}
              initialTab="Manage Menu Access"
            />
          </div>
        );
      case "security-configuration":
        return (
          <div className="w-full h-full flex items-center justify-center p-2">
            <SecManageDlg
              isOpen={true}
              onClose={() => setActiveTab("dashboard")}
              initialTab="Configuration"
            />
          </div>
        );
      default:
        return <div className="p-4 text-theme-muted font-mono text-xs">Tab {tabId} not found.</div>;
    }
  };

  // Wrap tab render in SmritiErrorBoundary to isolate module crashes, and Suspense for lazy-loaded modules
  const renderTabSafe = (tabId: string) => (
    <SmritiErrorBoundary key={tabId} tabId={tabId} onNotification={addNotification}>
      <Suspense fallback={<TabLoadingFallback />}>
        {renderTab(tabId)}
      </Suspense>
    </SmritiErrorBoundary>
  );

  if (standaloneVendorReturn) {
    return (
      <VendorReturnModal
        isOpen={true}
        onClose={() => {
          const params = new URLSearchParams(window.location.search);
          params.delete("standalone_vendor_return");
          const nextUrl = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ""}`;
          window.location.href = nextUrl;
        }}
        onNotification={(title, message, type) => {
          addNotification(title, message, type);
        }}
      />
    );
  }

  if (checkingAuth) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center bg-theme-base text-theme-primary">
        <div className="w-10 h-10 rounded-xl bg-[#2563EB] flex items-center justify-center font-bold text-lg text-white border border-theme-divider shadow-lg animate-pulse">
          S
        </div>
        <p className="mt-4 text-[10px] font-mono text-theme-muted tracking-widest uppercase">
          Verifying Operator Authorization...
        </p>
      </div>
    );
  }

  if (!currentUser) {
    return <LoginScreen onLoginSuccess={handleLoginSuccess} />;
  }

  if (currentUser.passwordResetRequired) {
    return (
      <PasswordReset
        onResetSuccess={() => {
          setCurrentUser((prev) => prev ? { ...prev, passwordResetRequired: false } : prev);
        }}
      />
    );
  }

  if (currentUser && !companyContextResolved) {
    return (
      <CompanySelectionScreen
        currentUser={currentUser}
        onCompanySelected={(ctx) => {
          setCurrentUser((prev) => prev ? { ...prev, companyId: ctx.companyId, branchId: ctx.branchId } : prev);
          setCompanyContextResolved(true);
          fetchSystemState();
        }}
        onLogout={handleLogout}
      />
    );
  }

  if (currentUser && isSetupCompleted === null) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center bg-theme-base text-theme-primary">
        <div className="w-10 h-10 rounded-xl bg-[#2563EB] flex items-center justify-center font-bold text-lg text-white border border-theme-divider shadow-lg animate-pulse">
          S
        </div>
        <p className="mt-4 text-[10px] font-mono text-theme-muted tracking-widest uppercase">
          Verifying initialization state...
        </p>
      </div>
    );
  }


  // ROUTING BOUNDARY: If isSetupCompleted is false, the workspace has no configured company.
  // Do NOT auto-open the Setup Wizard — show a controlled empty state instead.
  // The wizard is only entered via an explicit "Create New Company" action (setActiveTab("company-setup")).
  // This block is intentionally removed: the full-screen wizard override is PROHIBITED on startup.

  const getTabLabel = (id: string): string => {
    const tabMeta = registeredWorkspaces.find((w) => w.id === id);
    if (tabMeta) return tabMeta.label;
    if (id === "dashboard" || id === "launchpad") return "Fiori Launchpad";
    return id.replace(/-/g, " ").toUpperCase();
  };

  return (
    <AppShell
      activeModuleId={activeTab}
      activeModuleTitle={getTabLabel(activeTab)}
      onSelectModule={(id) => setActiveTab(mapModuleId(id))}
      onNavigateHome={() => {
        addToRecentlyUsed("dashboard");
        setActiveTab("dashboard");
      }}
      onLogout={handleLogout}
      userName={currentUser?.name || "Operator"}
      userRole={currentUser?.role || "Operator"}
    >
      <div className="relative w-full h-full">
      {/* Toast Notification Stack */}
      <div className="fixed top-4 right-4 z-50 space-y-2 pointer-events-none">
        <AnimatePresence>
          {notifications.map((n) => (
            <motion.div
              key={n.id}
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className={`pointer-events-auto p-4 rounded-xl shadow-2xl border flex items-start space-x-3 max-w-sm backdrop-blur ${
                n.type === "success"
                  ? "bg-emerald-950 bg-opacity-95 border-emerald-500 text-emerald-200"
                  : "bg-rose-950 bg-opacity-95 border-rose-500 text-rose-200"
              }`}
            >
              <span className="material-symbols-outlined mt-0.5">
                {n.type === "success" ? "check_circle" : "error"}
              </span>
              <div>
                <h5 className="font-bold text-xs uppercase tracking-wide font-display">
                  {n.title}
                </h5>
                <p className="text-[11px] mt-0.5 leading-relaxed opacity-90">
                  {n.message}
                </p>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <StandaloneWindowView registeredWorkspaces={registeredWorkspaces} renderTabSafe={renderTabSafe} />

      {/* Authoritative Single Application Workspace Canvas */}
      <div className="flex-1 flex flex-col h-full w-full min-w-0 max-w-full overflow-hidden relative">
        <DrillDownBreadcrumbs />
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-3 min-w-0 max-w-full relative">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.15 }}
              className="w-full h-full min-w-0 max-w-full"
              style={{
                transform: `scale(${globalZoom})`,
                transformOrigin: "top left",
                width: `${100 / globalZoom}%`,
                height: `${100 / globalZoom}%`,
              }}
            >
              {renderTabSafe(activeTab)}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Floating Workspace Windows Host */}
      <FloatingWindowHost renderTab={(id) => renderTabSafe(id)} />

      {/* Formula Explanation drawer portal overlay */}
      <ExplainModal
        formula={selectedFormula}
        onClose={() => setSelectedFormula(null)}
      />

      {/* SMRITI Global Interactive Print Preview Engine Modal — conditional mount only when active */}
      {isPrintPreviewOpen && (
        <PrintPreviewModal
          isOpen={isPrintPreviewOpen}
          onClose={() => setIsPrintPreviewOpen(false)}
          activeTabId={activeTab}
        />
      )}
    </div>
    </AppShell>
  );
};

const App: React.FC = () => {
  return (
    <PrintProvider>
      <NotificationProvider>
        <DrillDownProvider>
          <ActiveFieldProvider>
            <LayoutEngineProvider>
              <WorkspaceProvider>
                <ShortcutProvider>
                  <ContextProvider>
                    <AppContent />
                    <ContextRenderer />
                    <GlobalSearch />
                    <GlobalF2BrowseModal />
                    <ContextualInspectorHUD />
                    <DrillDownSidePanel />
                    <ShortcutPalette />
                  </ContextProvider>
                </ShortcutProvider>
              </WorkspaceProvider>
            </LayoutEngineProvider>
          </ActiveFieldProvider>
        </DrillDownProvider>
      </NotificationProvider>
    </PrintProvider>
  );
};

export default App;
