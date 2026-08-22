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
import React, { useState, useEffect, useRef } from "react";
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

// Import tabs components
import { DashboardTab } from "./components/DashboardTab.tsx";
import { PosTerminalTab } from "./components/PosTerminalTab.tsx";
import { FieldExplorerTab } from "./components/FieldExplorerTab.tsx";
import { FormulaRegistryTab } from "./components/FormulaRegistryTab.tsx";
import { PsvTab } from "./components/PsvTab.tsx";
import { PosProfilesTab } from "./components/PosProfilesTab.tsx";
import { SalesStudioTab } from "./components/SalesStudioTab.tsx";
import { AdvancedBillingEngine } from "./components/AdvancedBillingEngine.tsx";
import { ItemMasterTab } from "./components/ItemMasterTab.tsx";
import { WikiTab } from "./components/WikiTab.tsx";
import { PurchaseStudioTab } from "./components/PurchaseStudioTab.tsx";
import { BarcodeStudioTab } from "./components/BarcodeStudioTab.tsx";
import { MasterManagementTab } from "./components/MasterManagementTab.tsx";
import { CustomerMasterTab } from "./components/CustomerMasterTab.tsx";
import { CrmStudioTab } from "./components/CrmStudioTab.tsx";
import { LoyaltyStudioTab } from "./components/LoyaltyStudioTab.tsx";
import { SupplierDashboardTab } from "./components/SupplierDashboardTab.tsx";
import { ReportDesignerTab } from "./components/ReportDesignerTab.tsx";
import { ExplainModal } from "./components/ExplainModal.tsx";
import { DrillDownProvider } from "./components/drilldown/drilldown_store.tsx";
import { DrillDownBreadcrumbs } from "./components/drilldown/DrillDownBreadcrumbs.tsx";
import { DrillDownSidePanel } from "./components/drilldown/DrillDownSidePanel.tsx";
import { GlobalSearch } from "./components/drilldown/GlobalSearch.tsx";
import { GlobalF2BrowseModal } from "./components/drilldown/GlobalF2BrowseModal.tsx";
import { ApprovalMatrixTab } from "./components/ApprovalMatrixTab.tsx";
import { QuickActionsMenu } from "./components/QuickActionsMenu.tsx";
import { DocumentSeriesTab } from "./components/DocumentSeriesTab.tsx";
import { StaffManagementTab } from "./components/StaffManagementTab.tsx";
import { UserProfileTab } from "./components/UserProfileTab.tsx";
import { NotificationProvider, useNotifications } from "./notifications/notification_store.tsx";
import { ActiveFieldProvider } from "./context/ActiveFieldContext.tsx";
import { ContextualInspectorHUD } from "./components/drilldown/ContextualInspectorHUD.tsx";
import { ContextProvider } from "./context-actions/ContextProvider.tsx";
import { ContextRenderer } from "./context-actions/ContextRenderer.tsx";
import { registerAllDefaultActions } from "./context-actions/providers/SMRITIModuleActions.ts";
import { PrintProvider } from "./print_engine/print_store.tsx";
import { PrintStudioTab } from "./print_engine/PrintStudioTab.tsx";
import { PrintHistoryTab } from "./print_engine/PrintHistoryTab.tsx";
import { AboutSmritiTab } from "./components/AboutSmritiTab.tsx";
import { TaxInvoicePrintPage } from "./components/TaxInvoicePrintPage.tsx";
import { TrainingAcademyTab } from "./components/training/TrainingAcademyTab.tsx";
import { DevTrackerTab } from "./modules/dev_tracker/ui/DevTrackerTab.tsx";
import { AccountingSyncTab } from "./components/AccountingSyncTab.tsx";
import { BusinessLedgerTab } from "./components/BusinessLedgerTab.tsx";
import { StockLedgerTab } from "./components/StockLedgerTab.tsx";
import { AuditLogsTab } from "./components/AuditLogsTab.tsx";
import { TermsEngineTab } from "./components/TermsEngineTab.tsx";
import { DataExchangeTab } from "./components/DataExchangeTab.tsx";
import { DatabaseManagerTab } from "./components/DatabaseManagerTab.tsx";
import { useLayoutModuleRegistration } from "./components/SmritiBaseModule.tsx";
import { WorkspaceProvider, useWorkspace } from "./contexts/WorkspaceContext.tsx";
import { FloatingWindowHost } from "./components/FloatingWindowHost.tsx";
import { ShortcutProvider } from "./contexts/ShortcutContext.tsx";
import { ShortcutPalette } from "./components/ShortcutPalette.tsx";
import { SetupWizardTab } from "./components/SetupWizard/SetupWizardTab.tsx";
import { PasswordResetScreen } from "./components/PasswordResetScreen.tsx";
import { PrintPreviewModal } from "./components/PrintPreviewModal.tsx";
import { LoginScreen } from "./components/LoginScreen.tsx";
import { CompanySelectionScreen } from "./components/CompanySelectionScreen.tsx";
import { SmritiErrorBoundary } from "./components/SmritiErrorBoundary.tsx";
import { AppShell } from "./components/shell/AppShell.tsx";
import { FioriLaunchpad } from "./components/launchpad/FioriLaunchpad.tsx";
import { X } from "lucide-react";

interface AppNotification {
  id: string;
  title: string;
  message: string;
  type: "success" | "error";
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
        setCurrentUser({
          role: data.role ?? "",
          name: data.display_name || data.full_name || data.username || "",
          companyId: data.company_id ?? undefined,
          branchId: data.branch_id ?? undefined,
          passwordResetRequired: data.password_reset_required ?? false,
        });
        if (data.company_id && localStorage.getItem("smriti_company_id")) {
          setCompanyContextResolved(true);
        } else {
          setCompanyContextResolved(false);
        }
      } else {
        setCurrentUser(null);
        setCompanyContextResolved(false);
      }
    } catch {
      // apiFetchV1 throws on non-2xx (e.g. 401 expired) — clear token and treat as unauthenticated
      localStorage.removeItem("smriti_jwt_token");
      localStorage.removeItem("smriti_session_token");
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
    localStorage.removeItem("smriti_session_token");
    localStorage.removeItem("smriti_jwt_token");
    localStorage.removeItem("smriti_company_id");
    localStorage.removeItem("smriti_company_code");
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

  const activeTab = safeLastWorkspace || "dashboard";
  const setActiveTab = (tab: string) => {
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
    type: "success" | "error" = "success",
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
      launchpad: "dashboard",
      item_master: "item-master",
      inventory: "stock-ledger",
      suppliers: "supplier-mgmt",
      reports: "report-designer",
      dev_tracker: "dev-tracker",
      system: "masters",
      settings: "profiles",
      about: "about-smriti",
      grn: "purchase",
    };
    return map[id] || id;
  };

  const renderTab = (tabId: string) => {
    switch (tabId) {
      case "dashboard":
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
      default:
        return <div className="p-4 text-theme-muted font-mono text-xs">Tab {tabId} not found.</div>;
    }
  };

  // Wrap tab render in SmritiErrorBoundary to isolate module crashes
  const renderTabSafe = (tabId: string) => (
    <SmritiErrorBoundary key={tabId} tabId={tabId} onNotification={addNotification}>
      {renderTab(tabId)}
    </SmritiErrorBoundary>
  );

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
      <PasswordResetScreen
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
      onNavigateHome={() => setActiveTab("dashboard")}
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

      {/* Standalone External Popout Window View (No Shell Header, No Dock Bar) */}
      {(() => {
        const standaloneTab = new URLSearchParams(window.location.search).get("standalone_tab");
        if (!standaloneTab) return null;

        const tabMeta = registeredWorkspaces.find((w) => w.id === standaloneTab);
        const title = tabMeta ? tabMeta.label : standaloneTab;
        const icon = tabMeta ? tabMeta.icon : "description";

        return (
          <div className="fixed inset-0 z-[10000] flex flex-col overflow-hidden bg-theme-base text-theme-body font-sans select-none">
            {/* Minimal Standalone Titlebar */}
            <div className="h-10 px-4 bg-theme-surface-1 border-b border-theme-divider flex items-center justify-between shrink-0 shadow-xs">
              <div className="flex items-center space-x-2.5 min-w-0">
                <span className="material-symbols-outlined text-indigo-500 text-lg shrink-0">{icon}</span>
                <span className="text-xs font-bold text-theme-text-primary tracking-wide truncate">{title}</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 font-mono border border-indigo-500/20 shrink-0">
                  Standalone Window
                </span>
              </div>
              <div className="flex items-center space-x-2 shrink-0">
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

            {/* Full-screen Standalone Module Content without Header or Browser Bar */}
            <div className="flex-1 overflow-auto p-2 relative">
              {renderTabSafe(standaloneTab)}
            </div>
          </div>
        );
      })()}

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
