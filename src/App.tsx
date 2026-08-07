/**
 * Project      : SMRITI Retail OS
 * Organization : AITDL NETWORKS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 5.0.0
 * Created      : 2026-07-10
 * Modified     : 2026-07-20
 * Copyright    : Â© SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 */
import React, { useState, useEffect, useRef, useMemo } from "react";
import { apiFetch, apiFetchV1 } from "./lib/apiFetch.ts";
import { FLAGS } from "./config/flags";
import { motion, AnimatePresence } from "motion/react";
import { syncCustomersWithBackend } from "./services/customerStore.ts";
import {
  Product,
  POSProfile,
  Shift,
  FieldInfo,
  Formula,
  PSVParty,
} from "./types.js";
import { WindowManager } from "./sdk/WindowManager";

// Import Layout Engine
import {
  LayoutEngineProvider,
  useLayoutEngine,
} from "./layout_engine/layout_store.tsx";
import { LayoutManager } from "./layout_engine/layout_manager.tsx";
import { LockScreen, LogoutDialog, SessionExpiredDialog, authStore, authEvents } from "./features/auth";

// Import tabs components
import { DashboardTab } from "./components/DashboardTab.tsx";
import { PosTerminalTab } from "./components/PosTerminalTab.tsx";
import { FieldExplorerTab } from "./components/FieldExplorerTab.tsx";
import { FormulaRegistryTab } from "./components/FormulaRegistryTab.tsx";
import { PsvTab } from "./components/PsvTab.tsx";
import { PosProfilesTab } from "./components/PosProfilesTab.tsx";
import { SharedTerminalFramework } from "./components/terminal/SharedTerminalFramework.tsx";
const AdvancedBillingEngine = React.lazy(() => import("./components/AdvancedBillingEngine.tsx").then((module) => ({ default: module.AdvancedBillingEngine })));
const SalesStudioTab = React.lazy(() => import("./components/SalesStudioTab.tsx").then((module) => ({ default: module.SalesStudioTab })));
const SalesBillingStudio = React.lazy(() => import("./components/sales/SalesBillingStudio.tsx").then((module) => ({ default: module.SalesBillingStudio })));
import { ItemMasterTab } from "./components/ItemMasterTab.tsx";
import { WikiTab } from "./components/WikiTab.tsx";
const PurchaseStudioTab = React.lazy(() => import("./components/PurchaseStudioTab.tsx").then((module) => ({ default: module.PurchaseStudioTab })));
import { MasterManagementTab } from "./components/MasterManagementTab.tsx";
import { AIConfigurationTab } from "./components/AIConfigurationTab.tsx";
const LaunchpadConfigTab = React.lazy(() => import("./launchpad/index.ts").then((module) => ({ default: module.LaunchpadConfigTab })));
const CustomerMasterTab = React.lazy(() => import("./components/CustomerMasterTab.tsx").then((module) => ({ default: module.CustomerMasterTab })));
const CustomerDashboardTab = React.lazy(() => import("./components/CustomerDashboardTab.tsx").then((module) => ({ default: module.CustomerDashboardTab })));
const WorkspaceLabTab = React.lazy(() => import("./components/WorkspaceLabTab.tsx").then((module) => ({ default: module.WorkspaceLabTab })));
const OperationalWorkspacesTab = React.lazy(() => import("./components/OperationalWorkspacesTab.tsx").then((module) => ({ default: module.OperationalWorkspacesTab })));
const TransactionWorkspacesTab = React.lazy(() => import("./components/TransactionWorkspacesTab.tsx").then((module) => ({ default: module.TransactionWorkspacesTab })));
const BiReportingAndPrintingTab = React.lazy(() => import("./components/BiReportingAndPrintingTab.tsx").then((module) => ({ default: module.BiReportingAndPrintingTab })));
const PrintLabelsStudio = React.lazy(() => import("./components/printing/PrintLabelsStudio.tsx").then((module) => ({ default: module.PrintLabelsStudio })));
const UniversalLabelPrintingStudio = React.lazy(() => import("./components/label_print/UniversalLabelPrintingStudio.tsx").then((module) => ({ default: module.UniversalLabelPrintingStudio })));
const ConsignmentStudioTab = React.lazy(() => import("./components/ConsignmentStudioTab.tsx").then((module) => ({ default: module.ConsignmentStudioTab })));
const SCDMStudioTab = React.lazy(() => import("./components/SCDMStudioTab.tsx").then((module) => ({ default: module.SCDMStudioTab })));
const EcommerceStudioTab = React.lazy(() => import("./components/ecommerce/EcommerceStudioTab.tsx").then((module) => ({ default: module.EcommerceStudioTab })));

const CrmStudioTab = React.lazy(() => import("./components/CrmStudioTab.tsx").then((module) => ({ default: module.CrmStudioTab })));
const LoyaltyStudioTab = React.lazy(() => import("./components/LoyaltyStudioTab.tsx").then((module) => ({ default: module.LoyaltyStudioTab })));
const SupplierDashboardTab = React.lazy(() => import("./components/SupplierDashboardTab.tsx").then((module) => ({ default: module.SupplierDashboardTab })));
import { ScreenStudioTab } from "./components/ScreenStudioTab.tsx";
const ReportDesignerTab = React.lazy(() => import("./components/ReportDesignerTab.tsx").then((module) => ({ default: module.ReportDesignerTab })));
import { ExplainModal } from "./components/ExplainModal.tsx";
import { DrillDownProvider } from "./components/drilldown/drilldown_store.tsx";
import { DrillDownBreadcrumbs } from "./components/drilldown/DrillDownBreadcrumbs.tsx";
import { DrillDownSidePanel } from "./components/drilldown/DrillDownSidePanel.tsx";
import { SUNEFKernel } from "./navigation/SUNEFKernel.ts";
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
import { Suspense } from "react";
import { ShortcutProvider } from "./contexts/ShortcutContext.tsx";
import { ShortcutPalette } from "./components/ShortcutPalette.tsx";
import { WorkspaceTaskbar } from "./components/WorkspaceTaskbar.tsx";
import { SetupWizardTab } from "./components/SetupWizard/SetupWizardTab.tsx";
import { PasswordResetScreen } from "./components/PasswordResetScreen.tsx";
import { resolveSetupCompletionStatus } from "./utils/setupBootstrap";
import { PrintPreviewModal } from "./components/PrintPreviewModal.tsx";
import { SmritiOfficialWebsite } from "./components/website/SmritiOfficialWebsite.tsx";
import { SmritiLiveDocsPortal } from "./components/documentation/SmritiLiveDocsPortal.tsx";
import { CustomerWorkspacePortal } from "./components/customer/CustomerWorkspacePortal.tsx";
import { SmritiEcosystemHub } from "./components/SmritiEcosystemHub.tsx";
import { LoginScreen } from "./components/LoginScreen.tsx";
import { SmritiErrorBoundary } from "./components/SmritiErrorBoundary.tsx";
import { Launchpad } from "./components/Launchpad.tsx";
import { WorkspaceTabsBar } from "./components/common/WorkspaceTabsBar.tsx";
import { CommandPaletteModal } from "./components/common/CommandPaletteModal.tsx";
import { StatutoryComplianceWorkspace } from "./components/compliance/StatutoryComplianceWorkspace.tsx";


interface AppNotification {
  id: string;
  title: string;
  message: string;
  type: "success" | "error";
}

interface StandaloneWorkspaceProps {
  popoutTab: string;
  popoutTitle: string;
  renderTabSafe: (tabId: string) => React.ReactNode;
}

const StandaloneWorkspaceWindow: React.FC<StandaloneWorkspaceProps> = ({ popoutTab, popoutTitle, renderTabSafe }) => {
  const [zoom, setZoom] = useState<number>(100);
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== "undefined" ? navigator.onLine : true
  );
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [isLocked, setIsLocked] = useState<boolean>(false);
  const [pinInput, setPinInput] = useState<string>("");
  const [pinError, setPinError] = useState<string>("");

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Keyboard shortcut listener for Fullscreen (F11 or Ctrl+Shift+F)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "F11" || (e.ctrlKey && e.shiftKey && (e.key === "F" || e.key === "f"))) {
        e.preventDefault();
        toggleFullscreen();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  const handleUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    if (pinInput === "1234" || pinInput === "0000" || pinInput.trim().length >= 4) {
      setIsLocked(false);
      setPinInput("");
      setPinError("");
    } else {
      setPinError("Invalid Security PIN. Enter 1234 or your staff PIN.");
    }
  };

  return (
    <div className="relative w-screen h-screen bg-[var(--sds-color-background)] overflow-hidden flex flex-col m-0 p-0 font-[var(--sds-font-family)] border border-[var(--sds-color-border)] text-[var(--sds-color-text-main)]">
      {/* SMRITI Desktop Workspace v1.0 Header Bar */}
      <div className="h-10 bg-[var(--sds-color-surface)] border-b border-[var(--sds-color-border)] px-4 flex items-center justify-between shrink-0 select-none text-[var(--sds-color-text-main)]">
        {/* Left Section: Document Title & Badges */}
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-1.5">
            <span className="material-symbols-outlined text-indigo-400 text-base">desktop_windows</span>
            <span className="text-xs font-bold tracking-wide uppercase text-theme-primary">{popoutTitle}</span>
          </div>

          <span className="text-[10px] px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-mono font-medium">
            STANDALONE WORKSPACE
          </span>

          {/* Real-time Document Status */}
          <div className="flex items-center space-x-1 text-[11px] text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/40 font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>Saved</span>
          </div>

          {/* Network Connection Status */}
          <div className={`flex items-center space-x-1 text-[11px] px-2 py-0.5 rounded border font-mono ${
            isOnline
              ? "text-emerald-300 bg-emerald-950/40 border-emerald-800/30"
              : "text-rose-300 bg-rose-950/60 border-rose-800/50"
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? "bg-emerald-400" : "bg-rose-500 animate-ping"}`}></span>
            <span>{isOnline ? "Online" : "Offline"}</span>
          </div>
        </div>

        {/* Right Section: Toolbar Controls */}
        <div className="flex items-center space-x-2">
          {/* Zoom Controls */}
          <div className="flex items-center bg-[var(--sds-color-surface)] rounded border border-[var(--sds-color-border)] px-1 py-0.5 text-xs text-[var(--sds-color-text-secondary)] space-x-1">
            <button
              onClick={() => setZoom((z) => Math.max(70, z - 10))}
              className="px-1 hover:text-[var(--sds-color-text-main)] transition font-bold"
              title="Zoom Out"
            >
              -
            </button>
            <span className="font-mono text-[11px] w-8 text-center text-[var(--sds-color-primary)]">{zoom}%</span>
            <button
              onClick={() => setZoom((z) => Math.min(150, z + 10))}
              className="px-1 hover:text-[var(--sds-color-text-main)] transition font-bold"
              title="Zoom In"
            >
              +
            </button>
          </div>

          {/* Fullscreen Button */}
          <button
            onClick={toggleFullscreen}
            className="p-1 hover:bg-[var(--sds-color-surface-hover)] rounded text-[var(--sds-color-text-secondary)] hover:text-[var(--sds-color-text-main)] transition flex items-center text-xs space-x-1"
            title="Toggle Fullscreen (Ctrl+Shift+F or F11)"
          >
            <span className="material-symbols-outlined text-sm">
              {isFullscreen ? "fullscreen_exit" : "fullscreen"}
            </span>
          </button>

          {/* Lock Workspace Button */}
          <button
            onClick={() => setIsLocked(true)}
            className="px-2 py-1 hover:bg-[var(--sds-color-surface-hover)] text-[var(--sds-color-text-secondary)] hover:text-[var(--sds-color-text-main)] rounded border border-[var(--sds-color-border)] transition flex items-center text-xs space-x-1"
            title="Lock Workspace Session"
          >
            <span className="material-symbols-outlined text-sm">lock</span>
            <span>Lock</span>
          </button>

          {/* Refresh Data Button */}
          <button
            onClick={() => WindowManager.broadcast("REFRESH_SYSTEM_STATE", popoutTab, {})}
            className="px-2 py-1 hover:bg-[var(--sds-color-surface-hover)] rounded text-[var(--sds-color-text-secondary)] hover:text-[var(--sds-color-text-main)] transition flex items-center text-xs space-x-1"
            title="Refresh Studio Data"
          >
            <span className="material-symbols-outlined text-sm">refresh</span>
            <span>Refresh</span>
          </button>

          {/* Print Button */}
          <button
            onClick={() => window.print()}
            className="px-2 py-1 hover:bg-[var(--sds-color-surface-hover)] rounded text-[var(--sds-color-text-secondary)] hover:text-[var(--sds-color-text-main)] transition flex items-center text-xs space-x-1"
            title="Print Document"
          >
            <span className="material-symbols-outlined text-sm">print</span>
            <span>Print</span>
          </button>

          {/* Close Window Button */}
          <button
            onClick={() => window.close()}
            className="px-2 py-1 hover:bg-[var(--sds-color-surface-hover)] hover:text-[var(--sds-color-text-main)] rounded text-[var(--sds-color-text-secondary)] transition flex items-center text-xs space-x-1"
            title="Close Workspace Window"
          >
            <span className="material-symbols-outlined text-sm">close</span>
            <span>Close</span>
          </button>
        </div>
      </div>

      {/* Studio Content Canvas with Dynamic Zoom Scaling */}
      <div
        className="flex-1 overflow-auto p-2 bg-[var(--sds-color-background)] transition-all duration-150"
        style={{ zoom: `${zoom}%` }}
      >
        {renderTabSafe(popoutTab)}
      </div>

      {/* SAWF Workspace Security Lock Overlay */}
      {isLocked && (
        <div className="absolute inset-0 z-50 bg-[rgba(15,23,42,0.92)] backdrop-blur-md flex flex-col items-center justify-center text-[var(--sds-color-text-main)]">
          <div className="w-full max-w-sm p-6 bg-[var(--sds-color-surface)] border border-[var(--sds-color-border)] rounded-2xl shadow-2xl flex flex-col items-center text-center space-y-4">
            <div className="w-14 h-14 rounded-full bg-[var(--sds-color-primary-light)] border border-[var(--sds-color-primary)] flex items-center justify-center text-[var(--sds-color-primary)]">
              <span className="material-symbols-outlined text-3xl">lock</span>
            </div>
            <div>
              <h3 className="text-base font-bold text-[var(--sds-color-text-main)] uppercase tracking-wide">Workspace Locked</h3>
              <p className="text-xs text-[var(--sds-color-text-secondary)] mt-1">Transaction context preserved. Enter PIN to unlock.</p>
            </div>
            <form onSubmit={handleUnlock} className="w-full space-y-3">
              <input
                type="password"
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value)}
                placeholder="Enter Staff PIN (e.g. 1234)"
                className="w-full px-4 py-2.5 bg-[var(--sds-color-surface)] border border-[var(--sds-color-border)] rounded-xl text-center text-lg tracking-widest font-mono text-[var(--sds-color-text-main)] focus:outline-none focus:border-[var(--sds-color-primary)] transition"
                autoFocus
              />
              {pinError && <p className="text-xs text-[var(--c-seef-error)]">{pinError}</p>}
              <button
                type="submit"
                className="w-full py-2.5 bg-[var(--sds-color-primary)] hover:bg-[var(--sds-color-primary-hover)] font-semibold text-xs uppercase tracking-wider rounded-xl transition shadow-lg shadow-[rgba(0,86,179,0.18)]"
              >
                Unlock Session
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

const AppContent: React.FC = () => {
  const toastIdRef = useRef(0);
  const { preferences, addToRecentlyUsed, registeredWorkspaces } = useLayoutEngine();
  useLayoutModuleRegistration();
  const { globalZoom, popOutTab } = useWorkspace();
  const { addNotification: addSystemNotification } = useNotifications();

  // User Session & Auth Context
  const [currentUser, setCurrentUser] = useState<{ role: string; name: string; passwordResetRequired?: boolean; companyId?: string; branchId?: string } | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [terminalParam, setTerminalParam] = useState<string | null>(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      return params.get("terminal");
    } catch {
      return null;
    }
  });

  const checkAuth = async () => {
    try {
      const token = typeof localStorage !== 'undefined'
        ? (localStorage.getItem("smriti_jwt_token") || localStorage.getItem("smriti_session_token"))
        : null;

      if (!token || token === "dev-bypass-token") {
        if (typeof localStorage !== 'undefined') {
          localStorage.removeItem("smriti_jwt_token");
          localStorage.removeItem("smriti_session_token");
        }
        setCurrentUser(null);
        setCheckingAuth(false);
        return;
      }

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
        const savedName = typeof localStorage !== 'undefined' ? localStorage.getItem("smriti_user_name") : null;
        const savedRole = typeof localStorage !== 'undefined' ? localStorage.getItem("smriti_user_role") : null;
        if (savedName && savedRole) {
          setCurrentUser({ role: savedRole, name: savedName });
        } else {
          setCurrentUser(null);
        }
      }
    } catch {
      const savedName = typeof localStorage !== 'undefined' ? localStorage.getItem("smriti_user_name") : null;
      const savedRole = typeof localStorage !== 'undefined' ? localStorage.getItem("smriti_user_role") : null;
      if (savedName && savedRole) {
        setCurrentUser({ role: savedRole, name: savedName });
      } else {
        if (typeof localStorage !== 'undefined') {
          localStorage.removeItem("smriti_jwt_token");
          localStorage.removeItem("smriti_session_token");
        }
        setCurrentUser(null);
      }
    } finally {
      setCheckingAuth(false);
    }
  };

  useEffect(() => {
    checkAuth();
    const unsub = authEvents.subscribe((event) => {
      if (event.eventType === "UserLoggedOut") {
        setCurrentUser(null);
      }
    });

    // Work Protection: Warn operator on accidental tab closure or navigation
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      const heldBills = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem("smriti_held_bills") : null;
      if (heldBills && heldBills !== "[]") {
        e.preventDefault();
        e.returnValue = "You have active transaction bills in your workspace. Are you sure you want to leave?";
        return e.returnValue;
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      unsub();
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, []);

  const handleLoginSuccess = (user: { role: string; name: string; passwordResetRequired?: boolean; companyId?: string; branchId?: string }) => {
    setCurrentUser(user);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem("smriti_user_name", user.name);
      localStorage.setItem("smriti_user_role", user.role);
    }
  };

  const handleLogout = () => {
    authStore.setLogoutModalOpen(true);
  };

  useEffect(() => {
    if (!currentUser) return;
    syncCustomersWithBackend();
  }, [currentUser]);

  useEffect(() => {
    if (currentUser && !currentUser.passwordResetRequired) {
      refreshSetupStatus();
    }
  }, [currentUser]);

  const [isSetupCompleted, setIsSetupCompleted] = useState<boolean | null>(() => {
    const localCompleted = typeof localStorage !== 'undefined'
      ? localStorage.getItem("smriti_setup_completed") === "true"
      : false;
    return localCompleted;
  });

  const markSetupCompleted = () => {
    setIsSetupCompleted(true);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem("smriti_setup_completed", "true");
    }

    if (preferences.lastWorkspace === "company-setup") {
      addToRecentlyUsed("dashboard");
    }
  };

  const refreshSetupStatus = async () => {
    const localCompleted = typeof localStorage !== 'undefined'
      ? localStorage.getItem("smriti_setup_completed") === "true"
      : false;

    try {
      const data = await apiFetchV1("/setup-status");
      if (data && typeof data.setupCompleted === "boolean") {
        setIsSetupCompleted(resolveSetupCompletionStatus(localCompleted, data.setupCompleted));
      } else {
        setIsSetupCompleted(resolveSetupCompletionStatus(localCompleted, null));
      }
    } catch {
      setIsSetupCompleted(resolveSetupCompletionStatus(localCompleted, null));
    }
  };

  const initialTabFromUrl = useMemo(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      return params.get("tab") || params.get("workspace") || null;
    } catch {
      return null;
    }
  }, []);

  const isPopoutMode = useMemo(() => {
    try {
      return new URLSearchParams(window.location.search).get("popout") === "true";
    } catch {
      return false;
    }
  }, []);


  const safeLastWorkspace =
    initialTabFromUrl ||
    (isSetupCompleted && preferences.lastWorkspace === "company-setup"
      ? "launchpad"
      : preferences.lastWorkspace);

  const normalizeTab = (tab: string | null) => {
    if (!tab) return tab;
    return tab === "suppliers" ? "supplier-mgmt" : tab;
  };

  const [activeTab, setActiveTab] = useState<string>("launchpad");

  useEffect(() => {
    if (!isSetupCompleted) {
      setActiveTab("company-setup");
      return;
    }
    const resolvedTab = normalizeTab(safeLastWorkspace || "launchpad") || "launchpad";
    setActiveTab(resolvedTab);
  }, [isSetupCompleted, safeLastWorkspace]);

  const setActiveWorkspace = (tab: string) => {
    if (!isSetupCompleted && tab !== "company-setup") {
      return;
    }
    const resolvedTab = normalizeTab(
      isSetupCompleted && tab === "company-setup" ? "launchpad" : tab,
    ) || "dashboard";

    if (SUNEFKernel.isReady()) {
      SUNEFKernel.navigateWorkspace(resolvedTab, resolvedTab);
    } else {
      setActiveTab(resolvedTab);
    }

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

  const initialHistorySynced = useRef(false);

  useEffect(() => {
    SUNEFKernel.initialize(setActiveTab, addNotification);
    registerAllDefaultActions((n: any) => {
      addNotification(n.title, n.message, n.type === "alert" || n.type === "error" ? "error" : "success");
    });
  }, []);

  useEffect(() => {
    if (initialHistorySynced.current) return;
    if (!isSetupCompleted) return;
    if (!SUNEFKernel.isReady()) return;
    if (activeTab && activeTab !== "dashboard") {
      SUNEFKernel.navigateWorkspace(activeTab, activeTab);
    }
    initialHistorySynced.current = true;
  }, [activeTab, isSetupCompleted]);

  // Fetch initial system state
  const fetchSystemState = async () => {
    try {
      // Migrated: /pos/registers/ â†’ /pos/profiles/ (returns camelCase POSProfileResponse)
      // Migrated: /pos/shifts/ (FastAPI list endpoint â€” v3.22.0, replaces broken Express stub)
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
        const prodData = await apiFetchV1("/inventory/");
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

  // SAWF v1.0 Cross-Window Broadcast Listener
  useEffect(() => {
    const unsubscribe = WindowManager.subscribeBroadcast((msg) => {
      if (msg.type === "REFRESH_SYSTEM_STATE") {
        fetchSystemState();
      } else if (msg.type === "TOAST_NOTIFICATION" && msg.payload) {
        const p = msg.payload as { title: string; message: string; type?: "success" | "error" };
        addNotification(p.title, p.message, p.type || "success");
      }
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    const handlePopoutEvent = () => {
      const tabConfig = registeredWorkspaces.find((w) => w.id === activeTab);
      const title = tabConfig ? tabConfig.label : "Workspace Document";
      const icon = tabConfig ? tabConfig.icon : "description";
      popOutTab(activeTab, title, icon);
    };
    const handleNavigateEvent = (e: CustomEvent<string> | any) => {
      const targetTab = e?.detail ?? e;
      if (typeof targetTab === "string" && targetTab) {
        setActiveWorkspace(targetTab);
      }
    };
    window.addEventListener("smriti_popout_current_tab", handlePopoutEvent);
    window.addEventListener("smriti_navigate_tab", handleNavigateEvent as EventListener);
    return () => {
      window.removeEventListener("smriti_popout_current_tab", handlePopoutEvent);
      window.removeEventListener("smriti_navigate_tab", handleNavigateEvent as EventListener);
    };
  }, [activeTab, registeredWorkspaces, popOutTab, setActiveWorkspace]);

  const renderTab = (tabId: string) => {
    switch (tabId) {
      case "launchpad":
        return (
          <Launchpad
            currentUser={currentUser}
            onSelectTab={(t) => setActiveWorkspace(t)}
          />
        );
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
      case "billing":
      case "quick-billing":
        return <SalesBillingStudio products={products} onRefreshProducts={fetchSystemState} currentUser={currentUser} onNotification={addNotification} />;
      case "crm":
      case "crm-studio":
        return <CrmStudioTab currentUser={currentUser} onNotification={addNotification} />;
      case "customers":
      case "customer":
      case "customer-master":
      case "customer-crm":
      case "customer_master":
        return <CustomerMasterTab currentUser={currentUser} onNotification={addNotification} />;
      case "customer-dashboard":
        return <CustomerDashboardTab />;
      case "consignment-studio":
        return <ConsignmentStudioTab products={products} currentUser={currentUser} />;
      case "scdm":
      case "scdm-studio":
      case "channel-distribution":
      case "scdm_channel_distribution":
        return <SCDMStudioTab />;
      case "ecommerce":
      case "ecommerce-studio":
      case "commerce":
      case "commerce-studio":
        return <EcommerceStudioTab />;

      case "loyalty":
        return <LoyaltyStudioTab currentUser={currentUser} />;
      case "compliance":
      case "statutory":
      case "statutory-compliance":
      case "gst":
      case "tax-gst":
        return <StatutoryComplianceWorkspace />;
      case "staff":
      case "staff-management":
      case "users":
      case "user-rbac":
      case "rbac":
      case "staff_management":
      case "person":
      case "identity":
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
      case "sales-billing":
      case "sales-billing-studio":
      case "sales":
        return <SalesBillingStudio products={products} onRefreshProducts={fetchSystemState} />;
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
      case "suppliers":
        return <SupplierDashboardTab currentUser={currentUser} onNotification={addNotification} />;
      case "report-designer":
        return <ReportDesignerTab currentUser={currentUser} />;
      case "screen-studio":
        return <ScreenStudioTab />;
      case "items":
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
      case "masters":
        return <MasterManagementTab onNotification={addNotification} />;
      case "ai-config":
      case "ai-configuration":
        return <AIConfigurationTab onNotification={addNotification} />;
      case "workspace-lab":
        return <WorkspaceLabTab />;
      case "operational-workspaces":
        return <OperationalWorkspacesTab />;
      case "transaction-workspaces":
        return <TransactionWorkspacesTab />;
      case "bi-reporting":
        return <BiReportingAndPrintingTab />;
      case "launchpad-config":
        return <LaunchpadConfigTab onNotification={addNotification} />;
      case "document-series":
        return <DocumentSeriesTab />;
      case "approval-matrix":
        return <ApprovalMatrixTab />;
      case "document-studio":
      case "print-labels":
      case "print-studio":
      case "label-printing":
      case "universal-label":
      case "universal-label-printer":
      case "barcode":
      case "barcode-studio":
      case "tag-printing":
      case "barcode-printing":
      case "print-history":
        return <PrintStudioTab />;
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
      case "website":
        return <SmritiOfficialWebsite />;
      case "live-docs":
        return <SmritiLiveDocsPortal />;
      case "customer-workspace":
        return <CustomerWorkspacePortal />;
      case "ecosystem-hub":
        return <SmritiEcosystemHub />;
      case "company-setup":

        return (
          <SetupWizardTab 
            onComplete={() => {
              markSetupCompleted();
              addNotification("Setup Complete", "Welcome to SMRITI Retail OS dashboard!", "success");
              setActiveWorkspace("dashboard");
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
        <div className="w-10 h-10 rounded-xl bg-[var(--c-seef-accent)] flex items-center justify-center font-bold text-lg text-white border border-theme-divider shadow-lg animate-pulse">
          S
        </div>
        <p className="mt-4 text-[10px] font-mono text-theme-muted tracking-widest uppercase">
          Verifying Operator Authorization...
        </p>
      </div>
    );
  }

  if (terminalParam === "pos" || terminalParam === "tax") {
    const defaultUser = currentUser || { username: "manager", name: "Manager Clerk", role: "admin" };
    return (
      <SharedTerminalFramework
        terminalMode={terminalParam as "pos" | "tax"}
        currentUser={defaultUser}
        profiles={profiles}
        shifts={shifts}
        onRefreshData={fetchSystemState}
        onNotification={addNotification}
        onClose={() => {
          try {
            const url = new URL(window.location.href);
            url.searchParams.delete("terminal");
            window.history.replaceState({}, "", url.toString());
          } catch (e) {
            console.error(e);
          }
          setTerminalParam(null);
        }}
      >
        {terminalParam === "pos" ? (
          <div className="w-full h-full overflow-hidden">
            <PosTerminalTab
              products={products}
              profiles={profiles}
              shifts={shifts}
              onRefreshData={fetchSystemState}
              onNotification={addNotification}
            />
          </div>
        ) : (
          <div className="w-full h-full overflow-hidden">
            <AdvancedBillingEngine
              cart={[]}
              onClearCart={() => {}}
              activeShift={shifts.find(s => s.status === "Open") || null}
              activeProfile={profiles.find(p => p.id === profiles[0]?.id) || null}
              onCheckoutSuccess={() => fetchSystemState()}
              onNotification={addNotification}
              onClose={() => {
                try {
                  const url = new URL(window.location.href);
                  url.searchParams.delete("terminal");
                  window.history.replaceState({}, "", url.toString());
                } catch (e) {
                  console.error(e);
                }
                setTerminalParam(null);
              }}
            />
          </div>
        )}
      </SharedTerminalFramework>
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

  if (isPopoutMode) {
    const popoutTab = new URLSearchParams(window.location.search).get("tab") || "sales";
    const popoutTitle = new URLSearchParams(window.location.search).get("title") || `${popoutTab.toUpperCase()} STUDIO`;
    if (typeof document !== "undefined") {
      document.title = `${popoutTitle} - SMRITI Retail OS`;
    }

    return (
      <StandaloneWorkspaceWindow
        popoutTab={popoutTab}
        popoutTitle={popoutTitle}
        renderTabSafe={renderTabSafe}
      />
    );
  }

  return (
    <div className={`relative w-full h-full ${preferences.hideBottombar ? "pb-0" : "pb-13"}`}>
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

      {/* SMRITI Layout Manager Shell (ADR-UX-003 SWS Compliant) */}
      <LayoutManager 
        activeTab={activeTab} 
        onTabSelect={setActiveWorkspace}
        currentUser={currentUser}
        onLogout={handleLogout}
      >
        {/* SUNEF v3.5 Workspace Tabs Bar */}
        <WorkspaceTabsBar />
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

      {/* Auth System Modals & Workflows (ADR-AUTH-001) */}
      <LogoutDialog />
      <SessionExpiredDialog />

      {/* Formula Explanation drawer portal overlay */}
      <ExplainModal
        formula={selectedFormula}
        onClose={() => setSelectedFormula(null)}
      />

      {/* SMRITI Global Interactive Print Preview Engine Modal â€” conditional mount only when active */}
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
    <Suspense
      fallback={
        <div className="fixed inset-0 flex items-center justify-center bg-theme-surface text-theme-primary">
          <div className="text-sm font-semibold">Loading SMRITI workspace...</div>
        </div>
      }
    >
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
    </Suspense>
  );
};

export default App;
