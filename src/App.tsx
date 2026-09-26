/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.18.1
 * Created      : 2026-07-10
 * Modified     : 2026-09-12
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 */
import React, { useState, useEffect, useRef, useCallback, Suspense, lazy } from "react";
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

// Core UI Shell & Navigation Components
import { ExplainModal } from "./components/ExplainModal.tsx";
import { DrillDownProvider } from "./components/drilldown/drilldown_store.tsx";
import { DrillDownBreadcrumbs } from "./components/drilldown/DrillDownCrumbs.tsx";
import { DrillDownSidePanel } from "./components/drilldown/DrillDownSidePanel.tsx";
import { GlobalSearch } from "./components/drilldown/GlobalSearch.tsx";
import { QuickActionsMenu } from "./components/QuickActionsMenu.tsx";
import { NotificationProvider, useNotifications } from "./notifications/notification_store.tsx";
import { ActiveFieldProvider } from "./context/ActiveFieldContext.tsx";
import { F2DispatcherProvider } from "./context/F2DispatcherContext.tsx";
import { UniversalBrowseEngine } from "./components/drilldown/UniversalBrowseEngine.tsx";
import { ContextualInspectorHUD } from "./components/drilldown/CtxInspectorHUD.tsx";
import { ContextProvider } from "./context-actions/ContextProvider.tsx";
import { ContextRenderer } from "./context-actions/ContextRenderer.tsx";
import { registerAllDefaultActions } from "./context-actions/providers/SMRITIModuleActions.ts";
import { PrintProvider } from "./print_engine/print_store.tsx";
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
import { SalesOrderFormPremium } from "./components/sales/SalesOrderFormPremium.tsx";
import { VendorReturnModal } from "./components/procurement/VendorReturnModal.tsx";
import { StandaloneWindowView } from "./components/standalone/StandaloneWindowView.tsx";
import { TabRenderer, mapModuleId, TabLoadingFallback } from "./components/shell/TabRenderer.tsx";
import { useInactivityTimeout } from "./hooks/useInactivityTimeout.ts";
import { InactivityWarningModal } from "./components/auth/InactivityWarningModal.tsx";

const PrintPreviewModal = lazy(() => import("./components/PrintPreviewModal.tsx").then(m => ({ default: m.PrintPreviewModal })));

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
    setCompanyContextResolved(Boolean(user.companyId && user.branchId));
  };

  const [sessionTimeoutNotice, setSessionTimeoutNotice] = useState<string | null>(null);

  const handleLogout = useCallback((reason = "manual_logout") => {
    clearAuthSession(reason);
    setCurrentUser(null);
    setCompanyContextResolved(false);
  }, []);

  const handleAutoLogout = useCallback((notice = "Your session expired due to 15 minutes of inactivity. Please log in again.") => {
    const refreshToken = typeof window !== "undefined" ? localStorage.getItem("smriti_refresh_token") : null;
    if (refreshToken) {
      try {
        fetch("/api/v1/auth/logout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refresh_token: refreshToken }),
        }).catch(() => {});
      } catch {}
    }

    clearAuthSession("inactivity_timeout");
    setCurrentUser(null);
    setCompanyContextResolved(false);
    setSessionTimeoutNotice(notice);
  }, []);

  useEffect(() => {
    const handleSessionCleared = (e: Event) => {
      const customEvent = e as CustomEvent<{ reason?: string }>;
      const reason = customEvent.detail?.reason;
      if (reason === "inactivity_timeout") {
        setSessionTimeoutNotice("Your session expired due to 15 minutes of inactivity. Please log in again.");
      } else if (reason === "token_expired") {
        setSessionTimeoutNotice("Your session has expired. Please log in again.");
      }
      setCurrentUser(null);
      setCompanyContextResolved(false);
    };

    window.addEventListener("smriti_auth_session_cleared", handleSessionCleared);
    return () => {
      window.removeEventListener("smriti_auth_session_cleared", handleSessionCleared);
    };
  }, []);

  const {
    isWarningOpen,
    remainingSeconds,
    resetTimer,
  } = useInactivityTimeout({
    isEnabled: Boolean(currentUser),
    timeoutMs: 15 * 60 * 1000,
    warningDurationMs: 60 * 1000,
    onTimeout: () => {
      handleAutoLogout("Your session expired due to 15 minutes of inactivity. Please log in again.");
    },
  });



  useEffect(() => {
    if (!currentUser) return;
    // Boot-time hydration: populate localStorage["smriti_customers"] from PostgreSQL.
    // This ensures all getCustomers() callers see live DB data, not stale seed data.
    import("./services/customerStore.js").then((m) => {
      m.refreshCustomerCache();
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
  const urlTab = typeof window !== "undefined"
    ? (new URLSearchParams(window.location.search).get("tab") || new URLSearchParams(window.location.search).get("workspace"))
    : null;
  const safeLastWorkspace =
    urlTab
      ? mapModuleId(urlTab)
      : preferences.lastWorkspace === "company-setup"
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

  const addNotification = useCallback((
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
  }, []);

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
        const prodData = await apiFetchV1("/inventory/?page=1&page_size=200&sort=created_at&order=desc");
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

        if (mappedProducts.length === 0) {
          mappedProducts.push({
            id: "dummy-master-0001",
            code: "DUMMY-001",
            name: "Dummy Master Sample",
            price: 299,
            stock: 10,
            category: "Footwear",
            isFavorite: false,
            barcode: "8900000000001",
            secondaryBarcodes: [],
            barcodes: [{ type: "Code128", value: "8900000000001", isPrimary: true }],
            brand: "SMRITI",
            color: "Navy",
            size: "M",
            mrp: 399,
            gstPercentage: 18,
            styleCode: "STY-DUMMY-01",
            costPrice: 180,
            sku: "DUMMY-001",
            hsnCode: "6404",
            attributes: { a1: "Demo", a2: "Dummy", a3: "Sample", a4: "Retail", a5: "Item" },
            pricingMode: "Fixed",
            trackingMode: "Standard",
            variantTemplateId: "",
            weightGrams: 0
          } as Product);
        }

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

  const renderTabSafe = (tabId: string) => (
    <TabRenderer
      tabId={tabId}
      currentUser={currentUser}
      products={products}
      profiles={profiles}
      shifts={shifts}
      fields={fields}
      formulas={formulas}
      psvParties={psvParties}
      fetchSystemState={fetchSystemState}
      addNotification={addNotification}
      setActiveTab={setActiveTab}
      setSelectedFormula={setSelectedFormula}
      markSetupCompleted={markSetupCompleted}
    />
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
    return (
      <LoginScreen
        onLoginSuccess={(user) => {
          setSessionTimeoutNotice(null);
          handleLoginSuccess(user);
        }}
        sessionNotice={sessionTimeoutNotice}
        onClearSessionNotice={() => setSessionTimeoutNotice(null)}
      />
    );
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
      <>
        <CompanySelectionScreen
          currentUser={currentUser}
          onCompanySelected={(ctx) => {
            setCurrentUser((prev) => prev ? { ...prev, companyId: ctx.companyId, branchId: ctx.branchId } : prev);
            setCompanyContextResolved(true);
            fetchSystemState();
          }}
          onLogout={handleLogout}
        />
        {isWarningOpen && (
          <InactivityWarningModal
            remainingSeconds={remainingSeconds}
            onStayLoggedIn={resetTimer}
            onLogoutNow={handleLogout}
          />
        )}
      </>
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
    if (id === "dashboard") return "Executive Hub";
    if (id === "launchpad") return "Fiori Launchpad";
    return id.replace(/-/g, " ").toUpperCase();
  };

  return (
    <>
      <AppShell
      activeModuleId={activeTab}
      activeModuleTitle={getTabLabel(activeTab)}
      onSelectModule={(id) => setActiveTab(mapModuleId(id))}
      onNavigateHome={() => {
        addToRecentlyUsed("launchpad");
        setActiveTab("launchpad");
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

      {/* UniversalBrowseEngine v2 — canonical F2 lookup dialog */}
      <UniversalBrowseEngine userRole={currentUser?.role} />

      {/* Authoritative Single Application Workspace Canvas */}
      <div className="flex-1 flex flex-col h-full w-full min-w-0 max-w-full overflow-hidden relative">
        <DrillDownBreadcrumbs />
        <div className={`flex-1 min-w-0 max-w-full relative ${
          activeTab === "grn-studio" || activeTab === "billing-workspace" || activeTab === "pos" || activeTab === "grn"
            ? "p-0 overflow-hidden"
            : "overflow-y-auto overflow-x-hidden p-3"
        }`}>
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
                transition: "transform 0.15s ease-out, width 0.15s ease-out, height 0.15s ease-out",
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
    {isWarningOpen && (
      <InactivityWarningModal
        remainingSeconds={remainingSeconds}
        onStayLoggedIn={resetTimer}
        onLogoutNow={handleLogout}
      />
    )}
    </>
  );
};

const App: React.FC = () => {
  return (
    <PrintProvider>
      <NotificationProvider>
        <DrillDownProvider>
          {/* ActiveFieldProvider must be inside F2DispatcherProvider so that
              inferFieldCategory (tier-4 heuristic fallback) remains accessible
              to the dispatcher without circular dependency. */}
          <ActiveFieldProvider>
            {/* F2DispatcherProvider — single authoritative F2 keyboard listener.
                Must wrap all screens so useF2Screen() registrations reach the dispatcher. */}
            <F2DispatcherProvider>
              <LayoutEngineProvider>
                <WorkspaceProvider>
                  <ShortcutProvider>
                    <ContextProvider>
                      <AppContent />
                      <ContextRenderer />
                      <GlobalSearch />
                      <ContextualInspectorHUD />
                      <DrillDownSidePanel />
                      <ShortcutPalette />
                    </ContextProvider>
                  </ShortcutProvider>
                </WorkspaceProvider>
              </LayoutEngineProvider>
            </F2DispatcherProvider>
          </ActiveFieldProvider>
        </DrillDownProvider>
      </NotificationProvider>
    </PrintProvider>
  );
};

export default App;
