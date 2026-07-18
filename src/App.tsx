/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.27.0
 * Created      : 2026-07-10
 * Modified     : 2026-07-19
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
import { ItemMasterTab } from "./components/ItemMasterTab.tsx";
import { WikiTab } from "./components/WikiTab.tsx";
import { PurchaseStudioTab } from "./components/PurchaseStudioTab.tsx";
import { BarcodeStudioTab } from "./components/BarcodeStudioTab.tsx";
import { MasterManagementTab } from "./components/MasterManagementTab.tsx";
import { CustomerMasterTab } from "./components/CustomerMasterTab.tsx";
import { CustomerDashboardTab } from "./components/CustomerDashboardTab.tsx";
import { ConsignmentStudioTab } from "./components/ConsignmentStudioTab.tsx";
import { CrmStudioTab } from "./components/CrmStudioTab.tsx";
import { LoyaltyStudioTab } from "./components/LoyaltyStudioTab.tsx";
import { SupplierDashboardTab } from "./components/SupplierDashboardTab.tsx";
import { ReportDesignerTab } from "./components/ReportDesignerTab.tsx";
import { ExplainModal } from "./components/ExplainModal.tsx";
import { DrillDownProvider } from "./components/drilldown/drilldown_store.tsx";
import { DrillDownBreadcrumbs } from "./components/drilldown/DrillDownBreadcrumbs.tsx";
import { DrillDownSidePanel } from "./components/drilldown/DrillDownSidePanel.tsx";
import { GlobalSearch } from "./components/drilldown/GlobalSearch.tsx";
import { ApprovalMatrixTab } from "./components/ApprovalMatrixTab.tsx";
import { QuickActionsMenu } from "./components/QuickActionsMenu.tsx";
import { DocumentSeriesTab } from "./components/DocumentSeriesTab.tsx";
import { StaffManagementTab } from "./components/StaffManagementTab.tsx";
import { UserProfileTab } from "./components/UserProfileTab.tsx";
import { NotificationProvider, useNotifications } from "./notifications/notification_store.tsx";
import { ContextProvider } from "./context-actions/ContextProvider.tsx";
import { ContextRenderer } from "./context-actions/ContextRenderer.tsx";
import { registerAllDefaultActions } from "./context-actions/providers/SMRITIModuleActions.ts";
import { PrintProvider } from "./print_engine/print_store.tsx";
import { PrintStudioTab } from "./print_engine/PrintStudioTab.tsx";
import { PrintHistoryTab } from "./print_engine/PrintHistoryTab.tsx";
import { AboutSmritiTab } from "./components/AboutSmritiTab.tsx";
import { DevTrackerTab } from "./modules/dev_tracker/ui/DevTrackerTab.tsx";
import { AccountingSyncTab } from "./components/AccountingSyncTab.tsx";
import { BusinessLedgerTab } from "./components/BusinessLedgerTab.tsx";
import { StockLedgerTab } from "./components/StockLedgerTab.tsx";
import { AuditLogsTab } from "./components/AuditLogsTab.tsx";
import { TermsEngineTab } from "./components/TermsEngineTab.tsx";
import { DataExchangeTab } from "./components/DataExchangeTab.tsx";
import { useLayoutModuleRegistration } from "./components/SmritiBaseModule.tsx";
import { WorkspaceProvider, useWorkspace } from "./contexts/WorkspaceContext.tsx";
import { FloatingWindowHost } from "./components/FloatingWindowHost.tsx";
import { ShortcutProvider } from "./contexts/ShortcutContext.tsx";
import { ShortcutPalette } from "./components/ShortcutPalette.tsx";
import { WorkspaceTaskbar } from "./components/WorkspaceTaskbar.tsx";
import { SetupWizardTab } from "./components/SetupWizard/SetupWizardTab.tsx";
import { PasswordResetScreen } from "./components/PasswordResetScreen.tsx";
import { PrintPreviewModal } from "./components/PrintPreviewModal.tsx";
import { LoginScreen } from "./components/LoginScreen.tsx";
import { SmritiErrorBoundary } from "./components/SmritiErrorBoundary.tsx";

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
  const [checkingAuth, setCheckingAuth] = useState(true);

  const checkAuth = async () => {
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
      } else {
        setCurrentUser(null);
      }
    } catch {
      // apiFetchV1 throws on non-2xx — treat as unauthenticated
      setCurrentUser(null);
    } finally {
      setCheckingAuth(false);
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  const handleLoginSuccess = (user: { role: string; name: string; passwordResetRequired?: boolean; companyId?: string; branchId?: string }) => {
    setCurrentUser(user);
  };

  const handleLogout = () => {
    localStorage.removeItem("smriti_session_token");
    localStorage.removeItem("smriti_jwt_token");
    setCurrentUser(null);
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
      setIsSetupCompleted(false);
    }
  };

  const safeLastWorkspace =
    isSetupCompleted && preferences.lastWorkspace === "company-setup"
      ? "dashboard"
      : preferences.lastWorkspace;

  const activeTab = isSetupCompleted ? (safeLastWorkspace || "dashboard") : "company-setup";
  const setActiveTab = (tab: string) => {
    if (!isSetupCompleted && tab !== "company-setup") {
      return;
    }
    const resolvedTab = isSetupCompleted && tab === "company-setup" ? "dashboard" : tab;
    addToRecentlyUsed(resolvedTab);
  };

  useEffect(() => {
    if (isSetupCompleted && preferences.lastWorkspace === "company-setup") {
      addToRecentlyUsed("dashboard");
    }
  }, [isSetupCompleted, preferences.lastWorkspace, addToRecentlyUsed]);

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
        const prodData = await apiFetchV1("/inventory");
        const mappedProducts = prodData.map((p: any) => ({
          id: p.id,
          code: p.code,
          name: p.name,
          price: parseFloat(p.price),
          stock: p.stock,
          category: p.category,
          isFavorite: p.is_favorite,
          barcode: p.barcode,
          secondaryBarcodes: p.secondary_barcodes || [],
          barcodes: [
            { type: "Code128", value: p.barcode, isPrimary: true },
            ...(p.secondary_barcodes || []).map((val: string) => ({ type: "Code128", value: val, isPrimary: false }))
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
        }));
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

  const renderTab = (tabId: string) => {
    switch (tabId) {
      case "dashboard":
        return (
          <DashboardTab
            products={products}
            formulas={formulas}
            psvParties={psvParties}
            onSelectFormula={(f) => setSelectedFormula(f)}
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
      case "customer-dashboard":
        return <CustomerDashboardTab />;
      case "consignment-studio":
        return <ConsignmentStudioTab products={products} currentUser={currentUser} />;
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
        return <BarcodeStudioTab currentUser={currentUser} />;
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

  if (isSetupCompleted === false) {
    return (
      <SetupWizardTab
        onComplete={() => {
          markSetupCompleted();
          addNotification("Setup Complete", "Welcome to SMRITI Retail OS dashboard!", "success");
          setActiveTab("dashboard");
        }}
      />
    );
  }

  return (
    <div className="relative w-full h-full pb-13">
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

      {/* SMRITI Layout Manager Shell */}
      <LayoutManager 
        activeTab={activeTab} 
        onTabSelect={setActiveTab}
        currentUser={currentUser}
        onLogout={handleLogout}
      >
        <DrillDownBreadcrumbs />
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.15 }}
            className="h-full"
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
      </LayoutManager>
      <QuickActionsMenu />

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
  );
};

const App: React.FC = () => {
  return (
    <PrintProvider>
      <NotificationProvider>
        <DrillDownProvider>
          <LayoutEngineProvider>
            <WorkspaceProvider>
              <ShortcutProvider>
                <ContextProvider>
                  <AppContent />
                  <ContextRenderer />
                  <GlobalSearch />
                  <DrillDownSidePanel />
                  <ShortcutPalette />
                  <WorkspaceTaskbar />
                </ContextProvider>
              </ShortcutProvider>
            </WorkspaceProvider>
          </LayoutEngineProvider>
        </DrillDownProvider>
      </NotificationProvider>
    </PrintProvider>
  );
};

export default App;
