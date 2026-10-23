/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.99.10
 * Created      : 2026-07-10
 * Modified     : 2026-10-24
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Layout Engine Store Layer (Dynamic Mode Initialization)
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { apiFetchV1 } from "../lib/apiFetch.ts";

export type DockPosition = "left" | "right" | "top" | "bottom";
export type UXMode = "regular" | "classic";

export interface WorkspaceConfig {
  id: string;
  label: string;
  icon: string;
  category: string;
}

export interface LayoutPreferences {
  position: DockPosition;
  collapsed: boolean;
  iconOnly: boolean;
  sidebarWidth: number;
  lastWorkspace: string;
  collapsedGroups: string[];
  favorites: string[];
  uxMode: UXMode;
}

interface LayoutStoreContextType {
  preferences: LayoutPreferences;
  recentlyUsed: string[];
  registeredWorkspaces: WorkspaceConfig[];
  resolvedNavigationIds: string[] | null;
  uxMode: UXMode;

  setLayout: (position: DockPosition) => void;
  getLayout: () => LayoutPreferences;
  toggleSidebar: () => void;
  setCollapsed: (state: boolean) => void;
  setIconOnly: (state: boolean) => void;
  setSidebarWidth: (width: number) => void;
  setUxMode: (mode: UXMode) => void;
  toggleUxMode: () => void;
  savePreferences: (customPrefs?: Partial<LayoutPreferences>) => Promise<void>;
  restorePreferences: () => Promise<void>;
  registerWorkspace: (
    id: string,
    label: string,
    icon: string,
    category: string,
  ) => void;
  refreshLayout: () => void;
  reloadResolvedMenus: () => Promise<void>;
  toggleFavorite: (workspaceId: string) => void;
  toggleGroupCollapse: (groupId: string) => void;
  addToRecentlyUsed: (workspaceId: string) => void;
}

const getInitialUxMode = (): UXMode => {
  if (typeof window !== "undefined") {
    const saved = localStorage.getItem("smriti_ux_mode");
    if (saved === "classic" || saved === "regular") return saved;
  }
  return "regular";
};

const DEFAULT_PREFERENCES: LayoutPreferences = {
  position: "left",
  collapsed: false,
  iconOnly: false,
  sidebarWidth: 260,
  lastWorkspace: "dashboard",
  collapsedGroups: [],
  favorites: ["pos", "sales"],
  uxMode: getInitialUxMode(),
};

const LayoutStoreContext = createContext<LayoutStoreContextType | undefined>(
  undefined,
);

export const useLayoutEngine = () => {
  const context = useContext(LayoutStoreContext);
  if (!context) {
    throw new Error(
      "useLayoutEngine must be used within a LayoutEngineProvider",
    );
  }
  return context;
};

interface ProviderProps {
  children: React.ReactNode;
  initialActiveTab?: string;
  onTabChange?: (tab: string) => void;
  initialUxMode?: UXMode;
}

export const LayoutEngineProvider: React.FC<ProviderProps> = ({
  children,
  initialActiveTab = "dashboard",
  onTabChange,
  initialUxMode,
}) => {
  const [preferences, setPreferences] = useState<LayoutPreferences>(() => {
    const mode = initialUxMode || getInitialUxMode();
    return { ...DEFAULT_PREFERENCES, uxMode: mode };
  });
  const [recentlyUsed, setRecentlyUsed] = useState<string[]>([
    "dashboard",
    "pos",
  ]);
  const [registeredWorkspaces, setRegisteredWorkspaces] = useState<
    WorkspaceConfig[]
  >([
    {
      id: "dashboard",
      label: "Executive Hub",
      icon: "dashboard",
      category: "Operations",
    },
    {
      id: "wiki",
      label: "SMRITI Gyan Kendra",
      icon: "menu_book",
      category: "Operations",
    },
    {
      id: "billing-workspace",
      label: "Billing Workspace",
      icon: "receipt_long",
      category: "Sales & POS",
    },
    {
      id: "sales",
      label: "Sales Studio",
      icon: "receipt_long",
      category: "Sales & POS",
    },
    {
      id: "customer-master",
      label: "Customer Master",
      icon: "contacts",
      category: "Sales & POS",
    },
    {
      id: "customer-profile",
      label: "Customer Profile",
      icon: "account_circle",
      category: "Sales & POS",
    },
    {
      id: "crm",
      label: "CRM Studio",
      icon: "groups",
      category: "Sales & POS",
    },
    {
      id: "loyalty",
      label: "Loyalty Studio",
      icon: "stars",
      category: "Sales & POS",
    },
    {
      id: "sales-promotions",
      label: "Promotions Studio",
      icon: "percent",
      category: "Sales & POS",
    },
    {
      id: "dispatch-studio",
      label: "B2B Dispatch Studio",
      icon: "local_shipping",
      category: "Sales & POS",
    },

    {
      id: "profiles",
      label: "POS Terminals",
      icon: "manage_accounts",
      category: "Sales & POS",
    },
    {
      id: "purchase",
      label: "Purchase Studio",
      icon: "shopping_cart",
      category: "Inventory & Sourcing",
    },
    {
      id: "grn-studio",
      label: "Goods Receipt (GRN)",
      icon: "fact_check",
      category: "Inventory & Sourcing",
    },
    {
      id: "vendor-360",
      label: "Vendor 360 Workspace",
      icon: "local_shipping",
      category: "Inventory & Sourcing",
    },
    {
      id: "business-ledger",
      label: "Business Ledger",
      icon: "account_balance_wallet",
      category: "Accounts Sync",
    },
    {
      id: "accounting-sync",
      label: "Accounting Sync",
      icon: "sync_alt",
      category: "Accounts Sync",
    },
    {
      id: "report-designer",
      label: "Report Designer",
      icon: "draw",
      category: "Data & Config",
    },
    {
      id: "item-master",
      label: "Article / Design Master",
      icon: "inventory_2",
      category: "Inventory & Sourcing",
    },
    {
      id: "price-revision",
      label: "Price Revision Studio",
      icon: "trending_up",
      category: "Inventory & Sourcing",
    },
    {
      id: "barcode",
      label: "Barcode Studio",
      icon: "qr_code_scanner",
      category: "Inventory & Sourcing",
    },
    {
      id: "wms-dashboard",
      label: "Warehouse & Batch Hub",
      icon: "warehouse",
      category: "Inventory & Sourcing",
    },
    {
      id: "stock-transfers",
      label: "Inter-Godown Transfers",
      icon: "move_up",
      category: "Inventory & Sourcing",
    },
    {
      id: "stock-ledger",
      label: "Stock Ledger",
      icon: "inventory",
      category: "Inventory & Sourcing",
    },
    {
      id: "masters",
      label: "Master Framework",
      icon: "database",
      category: "Data & Config",
    },
    {
      id: "ufe",
      label: "Field Explorer (UFE)",
      icon: "search",
      category: "Data & Config",
    },
    {
      id: "formulas",
      label: "KPI Registry",
      icon: "calculate",
      category: "Data & Config",
    },
    {
      id: "psv",
      label: "Distributor Stock",
      icon: "hub",
      category: "Data & Config",
    },
    {
      id: "document-series",
      label: "Numbering Engine",
      icon: "tag",
      category: "Data & Config",
    },
    {
      id: "approval-matrix",
      label: "Approval Matrix",
      icon: "fact_check",
      category: "Data & Config",
    },
    {
      id: "staff-management",
      label: "Staff Management",
      icon: "badge",
      category: "Operations",
    },
    {
      id: "store-directory",
      label: "Store & Branch Directory",
      icon: "storefront",
      category: "Operations",
    },
    {
      id: "attendance-workspace",
      label: "Attendance Workspace",
      icon: "calendar_month",
      category: "Operations",
    },
    {
      id: "muster-roll",
      label: "Muster Roll & Wages",
      icon: "view_timeline",
      category: "Operations",
    },
    {
      id: "leave-management",
      label: "Leave Management",
      icon: "beach_access",
      category: "Operations",
    },
    {
      id: "commission-workspace",
      label: "Commission Workspace",
      icon: "payments",
      category: "Operations",
    },
    {
      id: "user-profile",
      label: "My Profile Dashboard",
      icon: "account_circle",
      category: "Operations",
    },
    {
      id: "print-studio",
      label: "Print Studio",
      icon: "print",
      category: "Data & Config",
    },
    {
      id: "print-history",
      label: "Print History Logs",
      icon: "history",
      category: "Data & Config",
    },
    {
      id: "terms-engine",
      label: "Terms & Conditions",
      icon: "gavel",
      category: "Data & Config",
    },
    {
      id: "data-exchange",
      label: "Data Exchange Hub",
      icon: "sync_alt",
      category: "Data & Config",
    },
    {
      id: "company-profile",
      label: "Company Profile & Settings",
      icon: "apartment",
      category: "Data & Config",
    },
    {
      id: "company-setup",
      label: "Company Setup Wizard",
      icon: "magic_button",
      category: "Data & Config",
    },
    {
      id: "about-smriti",
      label: "About SMRITI",
      icon: "info",
      category: "System",
    },
    {
      id: "dev-tracker",
      label: "Dev Intelligence Center",
      icon: "monitoring",
      category: "System",
    },
    {
      id: "audit-logs",
      label: "Audit Logs",
      icon: "policy",
      category: "System",
    },
    {
      id: "system-parameters",
      label: "System Parameters Studio",
      icon: "tune",
      category: "System",
    },
    {
      id: "backup-restore",
      label: "Backup & Restore",
      icon: "cloud_upload",
      category: "System",
    },
    {
      id: "database-manager",
      label: "Database Manager (DB Studio)",
      icon: "storage",
      category: "System",
    },
  ]);

  // Force-render trigger
  const [, setTick] = useState(0);
  const [resolvedNavigationIds, setResolvedNavigationIds] = useState<string[] | null>(null);
  const menuResolutionPromiseRef = useRef<Promise<void> | null>(null);
  const menuResolutionGenerationRef = useRef(0);

  const reloadResolvedMenus = useCallback(async () => {
    if (menuResolutionPromiseRef.current) return menuResolutionPromiseRef.current;

    const token = localStorage.getItem("smriti_jwt_token") || localStorage.getItem("smriti_session_token");
    if (!token) {
      menuResolutionGenerationRef.current += 1;
      menuResolutionPromiseRef.current = null;
      setResolvedNavigationIds(null);
      return;
    }

    const requestGeneration = ++menuResolutionGenerationRef.current;
    setResolvedNavigationIds(null);
    const loadMenus = (async () => {
      try {
        const response = await apiFetchV1<any>("/menus/resolved");
        const resolvedMenus = Array.isArray(response)
          ? response
          : Array.isArray(response?.data)
            ? response.data
            : Array.isArray(response?.items)
              ? response.items
              : null;

        if (!resolvedMenus) return;
        if (requestGeneration !== menuResolutionGenerationRef.current) return;

        const allowedIds = new Set<string>();
        const dynamicWorkspaces: WorkspaceConfig[] = resolvedMenus.flatMap((menu: any) => {
          const route = String(menu?.route || "").replace(/^\/+/, "").trim();
          const menuId = String(menu?.id || "").replace(/^menu-/i, "").trim();
          const id = route || menuId;
          if (!id) return [];

          allowedIds.add(id);
          if (menuId) allowedIds.add(menuId);
          return [{
            id,
            label: String(menu?.title || menu?.label || id),
            icon: String(menu?.icon || "grid_view"),
            category: String(menu?.module || "Operations"),
          }];
        });

        setRegisteredWorkspaces(dynamicWorkspaces);
        setResolvedNavigationIds(Array.from(allowedIds));
        setTick((tick) => tick + 1);
        if (typeof window !== "undefined") window.dispatchEvent(new Event("resize"));
      } catch (err) {
        if (requestGeneration === menuResolutionGenerationRef.current) {
          console.warn("[MenuResolver] Failed to reload resolved menus", err);
        }
      }
    })();

    menuResolutionPromiseRef.current = loadMenus;
    try {
      await loadMenus;
    } finally {
      if (requestGeneration === menuResolutionGenerationRef.current) {
        menuResolutionPromiseRef.current = null;
      }
    }
  }, []);

  // Load preferences on startup & subscribe to live security / menu events
  useEffect(() => {
    restorePreferences();

    const handlePermissionsUpdated = () => {
      reloadResolvedMenus();
    };

    window.addEventListener("smriti_menu_permissions_updated", handlePermissionsUpdated);
    window.addEventListener("smriti_security_config_updated", handlePermissionsUpdated);
    const clearResolvedMenus = () => {
      menuResolutionGenerationRef.current += 1;
      menuResolutionPromiseRef.current = null;
      setResolvedNavigationIds(null);
    };
    window.addEventListener("smriti_auth_session_cleared", clearResolvedMenus);

    return () => {
      window.removeEventListener("smriti_menu_permissions_updated", handlePermissionsUpdated);
      window.removeEventListener("smriti_security_config_updated", handlePermissionsUpdated);
      window.removeEventListener("smriti_auth_session_cleared", clearResolvedMenus);
    };
  }, []);

  const restorePreferences = async () => {
    const local = localStorage.getItem("smriti_layout_preferences");
    const localUxMode = (localStorage.getItem("smriti_ux_mode") as UXMode) || "regular";
    const loadedPrefs = local
      ? { ...DEFAULT_PREFERENCES, ...JSON.parse(local), uxMode: localUxMode }
      : { ...DEFAULT_PREFERENCES, uxMode: localUxMode };

    setPreferences(loadedPrefs);
    if (loadedPrefs.lastWorkspace && onTabChange) {
      onTabChange(loadedPrefs.lastWorkspace);
    }

    // Attempt to hydrate layout preferences from backend
    try {
      const serverPrefs = await apiFetchV1<any>("/layout/preferences");
      if (serverPrefs && typeof serverPrefs === "object") {
        const serverUxMode = (serverPrefs.uxMode || serverPrefs.ux_mode) as UXMode;
        const merged: LayoutPreferences = {
          ...loadedPrefs,
          ...serverPrefs,
          ...(serverUxMode ? { uxMode: serverUxMode } : {}),
        };
        setPreferences(merged);
        localStorage.setItem("smriti_layout_preferences", JSON.stringify(merged));
        if (merged.uxMode) {
          localStorage.setItem("smriti_ux_mode", merged.uxMode);
        }
      }
    } catch {
      // Offline fallback: retain local preferences
    }

    // Centralized Menu Resolver: Fetch resolved navigation tree from backend (only if authenticated)
    await reloadResolvedMenus();
  };

  const savePreferences = async (customPrefs?: Partial<LayoutPreferences>) => {
    const updated = { ...preferences, ...customPrefs };
    setPreferences(updated);

    // Save to local storage
    localStorage.setItem("smriti_layout_preferences", JSON.stringify(updated));
    if (updated.uxMode) {
      localStorage.setItem("smriti_ux_mode", updated.uxMode);
    }

    // Map to backend structure (both camelCase and snake_case for maximum compatibility)
    const payload = {
      position: updated.position,
      collapsed: updated.collapsed,
      icon_only: updated.iconOnly,
      iconOnly: updated.iconOnly,
      sidebar_width: updated.sidebarWidth,
      sidebarWidth: updated.sidebarWidth,
      last_workspace: updated.lastWorkspace,
      lastWorkspace: updated.lastWorkspace,
      collapsed_groups: updated.collapsedGroups,
      collapsedGroups: updated.collapsedGroups,
      favorites: updated.favorites,
      uxMode: updated.uxMode,
      ux_mode: updated.uxMode,
    };

    try {
      await apiFetchV1("/layout/preferences", {
        method: "POST",
        body: JSON.stringify(payload),
      });
    } catch (e) {
      console.warn("Failed to sync preferences to server:", e);
    }
  };

  const setUxMode = (mode: UXMode) => {
    localStorage.setItem("smriti_ux_mode", mode);
    savePreferences({ uxMode: mode });
  };

  const toggleUxMode = () => {
    const nextMode: UXMode = preferences.uxMode === "classic" ? "regular" : "classic";
    setUxMode(nextMode);
  };

  const setLayout = (position: DockPosition) => {
    savePreferences({ position });
  };

  const getLayout = () => {
    return preferences;
  };

  const toggleSidebar = () => {
    savePreferences({ collapsed: !preferences.collapsed });
  };

  const setCollapsed = (state: boolean) => {
    savePreferences({ collapsed: state });
  };

  const setIconOnly = (state: boolean) => {
    savePreferences({ iconOnly: state });
  };

  const setSidebarWidth = (width: number) => {
    savePreferences({ sidebarWidth: width });
  };

  const registerWorkspace = (
    id: string,
    label: string,
    icon: string,
    category: string,
  ) => {
    setRegisteredWorkspaces((prev) => {
      if (prev.some((w) => w.id === id)) return prev;
      return [...prev, { id, label, icon, category }];
    });
  };

  const refreshLayout = () => {
    setTick((t) => t + 1);
    // Dispatch resize event to trigger layout redraws for canvas / chart components
    window.dispatchEvent(new Event("resize"));
  };

  const toggleFavorite = (workspaceId: string) => {
    const favorites = preferences.favorites.includes(workspaceId)
      ? preferences.favorites.filter((id) => id !== workspaceId)
      : [...preferences.favorites, workspaceId];
    savePreferences({ favorites });
  };

  const toggleGroupCollapse = (groupId: string) => {
    const collapsedGroups = preferences.collapsedGroups.includes(groupId)
      ? preferences.collapsedGroups.filter((g) => g !== groupId)
      : [...preferences.collapsedGroups, groupId];
    savePreferences({ collapsedGroups });
  };

  const addToRecentlyUsed = (workspaceId: string) => {
    setRecentlyUsed((prev) => {
      const filtered = prev.filter((id) => id !== workspaceId);
      return [workspaceId, ...filtered].slice(0, 5); // Max 5 items
    });
    // Save lastWorkspace
    if (preferences.lastWorkspace !== workspaceId) {
      savePreferences({ lastWorkspace: workspaceId });
    }
  };

  return (
    <LayoutStoreContext.Provider
      value={{
        preferences,
        recentlyUsed,
        registeredWorkspaces,
        resolvedNavigationIds,
        uxMode: preferences.uxMode || "regular",
        setLayout,
        getLayout,
        toggleSidebar,
        setCollapsed,
        setIconOnly,
        setSidebarWidth,
        setUxMode,
        toggleUxMode,
        savePreferences,
        restorePreferences,
        registerWorkspace,
        refreshLayout,
        reloadResolvedMenus,
        toggleFavorite,
        toggleGroupCollapse,
        addToRecentlyUsed,
      }}
    >
      {children}
    </LayoutStoreContext.Provider>
  );
};
