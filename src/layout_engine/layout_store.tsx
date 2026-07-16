/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.16.1
 * Created      : 2026-07-10
 * Modified     : 2026-07-14
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 */

import React, { createContext, useContext, useState, useEffect } from "react";
import { apiFetchV1 } from "../lib/apiFetch.ts";

export type DockPosition = "left" | "right" | "top" | "bottom";

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
}

interface LayoutStoreContextType {
  preferences: LayoutPreferences;
  recentlyUsed: string[];
  registeredWorkspaces: WorkspaceConfig[];

  setLayout: (position: DockPosition) => void;
  getLayout: () => LayoutPreferences;
  toggleSidebar: () => void;
  setCollapsed: (state: boolean) => void;
  setIconOnly: (state: boolean) => void;
  setSidebarWidth: (width: number) => void;
  savePreferences: (customPrefs?: Partial<LayoutPreferences>) => Promise<void>;
  restorePreferences: () => Promise<void>;
  registerWorkspace: (
    id: string,
    label: string,
    icon: string,
    category: string,
  ) => void;
  refreshLayout: () => void;
  toggleFavorite: (workspaceId: string) => void;
  toggleGroupCollapse: (groupId: string) => void;
  addToRecentlyUsed: (workspaceId: string) => void;
}

const DEFAULT_PREFERENCES: LayoutPreferences = {
  position: "left",
  collapsed: false,
  iconOnly: false,
  sidebarWidth: 260,
  lastWorkspace: "dashboard",
  collapsedGroups: [],
  favorites: ["pos", "sales"],
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
}

export const LayoutEngineProvider: React.FC<ProviderProps> = ({
  children,
  initialActiveTab = "dashboard",
  onTabChange,
}) => {
  const [preferences, setPreferences] =
    useState<LayoutPreferences>(DEFAULT_PREFERENCES);
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
      id: "pos",
      label: "Billing Desk",
      icon: "point_of_sale",
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
      id: "supplier-mgmt",
      label: "Supplier Dashboard",
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
      label: "Item Master",
      icon: "inventory_2",
      category: "Inventory & Sourcing",
    },
    {
      id: "barcode",
      label: "Barcode Studio",
      icon: "qr_code_scanner",
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
      label: "Channel Visibility",
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
  ]);

  // Force-render trigger
  const [, setTick] = useState(0);

  // Load preferences on startup
  useEffect(() => {
    restorePreferences();
  }, []);

  const restorePreferences = async () => {
    const local = localStorage.getItem("smriti_layout_preferences");
    const loadedPrefs = local ? JSON.parse(local) : DEFAULT_PREFERENCES;

    setPreferences(loadedPrefs);
    if (loadedPrefs.lastWorkspace && onTabChange) {
      onTabChange(loadedPrefs.lastWorkspace);
    }
  };

  const savePreferences = async (customPrefs?: Partial<LayoutPreferences>) => {
    const updated = { ...preferences, ...customPrefs };
    setPreferences(updated);

    // Save to local storage
    localStorage.setItem("smriti_layout_preferences", JSON.stringify(updated));

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
        setLayout,
        getLayout,
        toggleSidebar,
        setCollapsed,
        setIconOnly,
        setSidebarWidth,
        savePreferences,
        restorePreferences,
        registerWorkspace,
        refreshLayout,
        toggleFavorite,
        toggleGroupCollapse,
        addToRecentlyUsed,
      }}
    >
      {children}
    </LayoutStoreContext.Provider>
  );
};
