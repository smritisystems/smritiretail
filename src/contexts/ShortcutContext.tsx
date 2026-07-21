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
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useLayoutEngine } from "../layout_engine/layout_store.tsx";
import { useWorkspace } from "./WorkspaceContext.tsx";
import { useDrillDown } from "../components/drilldown/drilldown_store.tsx";

export interface ShortcutKeyConfig {
  key: string;
  ctrl: boolean;
  alt: boolean;
  shift: boolean;
  meta: boolean;
}

export interface KeyboardShortcut {
  id: string;
  name: string;
  description: string;
  defaultKey: ShortcutKeyConfig;
  currentKey: ShortcutKeyConfig;
  category: "Global" | "Navigation" | "Quick Access" | "Floating Window";
  roles: string[]; // Allowed roles (e.g. ['Admin', 'Cashier', 'Store Manager'])
  actionType: "tab" | "layout" | "search" | "workspace" | "palette";
  actionValue?: string;
}

interface ShortcutContextType {
  shortcuts: KeyboardShortcut[];
  activeRole: string;
  isAdmin: boolean;
  paletteOpen: boolean;
  setPaletteOpen: (open: boolean) => void;
  setActiveRole: (role: string) => void;
  setIsAdmin: (isAdmin: boolean) => void;
  updateShortcut: (id: string, newKey: ShortcutKeyConfig) => { success: boolean; conflictWith?: string };
  resetToDefaults: () => void;
  resetToOrgDefaults: () => void;
  saveAsOrgDefaults: () => void;
  orgDefaultsExist: boolean;
}

const DEFAULT_SHORTCUTS: KeyboardShortcut[] = [
  {
    id: "open_palette",
    name: "Open Command Palette / Help",
    description: "Open the searchable command palette and keyboard shortcuts manager",
    defaultKey: { key: " ", ctrl: false, alt: true, shift: false, meta: false }, // Alt + Space
    currentKey: { key: " ", ctrl: false, alt: true, shift: false, meta: false },
    category: "Global",
    roles: ["Shop Owner", "Cashier", "Warehouse Staff", "Purchase Executive", "Sales Executive", "Store Manager", "Branch Manager", "Distributor", "Franchise Owner", "Accountant (Operational)", "Admin"],
    actionType: "palette"
  },
  {
    id: "global_search",
    name: "Global Search",
    description: "Search across items, customers, invoices, and operations",
    defaultKey: { key: "/", ctrl: false, alt: true, shift: false, meta: false }, // Alt + /
    currentKey: { key: "/", ctrl: false, alt: true, shift: false, meta: false },
    category: "Global",
    roles: ["Shop Owner", "Cashier", "Warehouse Staff", "Purchase Executive", "Sales Executive", "Store Manager", "Branch Manager", "Distributor", "Franchise Owner", "Accountant (Operational)", "Admin"],
    actionType: "search"
  },
  {
    id: "new_document",
    name: "New Sales Document",
    description: "Create a new sales order or document",
    defaultKey: { key: "n", ctrl: false, alt: true, shift: false, meta: false }, // Alt + N
    currentKey: { key: "n", ctrl: false, alt: true, shift: false, meta: false },
    category: "Quick Access",
    roles: ["Shop Owner", "Sales Executive", "Store Manager", "Franchise Owner", "Admin"],
    actionType: "tab",
    actionValue: "sales"
  },
  {
    id: "quick_customer",
    name: "Quick CRM / Customer",
    description: "Open CRM loyalty and customer registry",
    defaultKey: { key: "c", ctrl: false, alt: true, shift: false, meta: false }, // Alt + C
    currentKey: { key: "c", ctrl: false, alt: true, shift: false, meta: false },
    category: "Quick Access",
    roles: ["Shop Owner", "Cashier", "Sales Executive", "Store Manager", "Admin"],
    actionType: "tab",
    actionValue: "crm"
  },
  {
    id: "quick_product",
    name: "Quick Item Master / Product",
    description: "Open product list and variant manager",
    defaultKey: { key: "i", ctrl: false, alt: true, shift: false, meta: false }, // Alt + I
    currentKey: { key: "i", ctrl: false, alt: true, shift: false, meta: false },
    category: "Quick Access",
    roles: ["Shop Owner", "Warehouse Staff", "Purchase Executive", "Store Manager", "Admin"],
    actionType: "tab",
    actionValue: "item-master"
  },
  {
    id: "quick_sales_invoice",
    name: "Quick Sales Invoice",
    description: "Go straight to retail sales invoicing (POS)",
    defaultKey: { key: "s", ctrl: false, alt: true, shift: false, meta: false }, // Alt + S
    currentKey: { key: "s", ctrl: false, alt: true, shift: false, meta: false },
    category: "Quick Access",
    roles: ["Shop Owner", "Cashier", "Sales Executive", "Store Manager", "Franchise Owner", "Admin"],
    actionType: "tab",
    actionValue: "pos"
  },
  {
    id: "open_pos",
    name: "Open POS Terminal",
    description: "Launch the cashier point of sale terminal",
    defaultKey: { key: "p", ctrl: false, alt: true, shift: false, meta: false }, // Alt + P
    currentKey: { key: "p", ctrl: false, alt: true, shift: false, meta: false },
    category: "Navigation",
    roles: ["Shop Owner", "Cashier", "Store Manager", "Franchise Owner", "Admin"],
    actionType: "tab",
    actionValue: "pos"
  },
  {
    id: "open_dashboard",
    name: "Open Executive Dashboard",
    description: "Open SMRITI operational and inventory dashboard",
    defaultKey: { key: "d", ctrl: false, alt: true, shift: false, meta: false }, // Alt + D
    currentKey: { key: "d", ctrl: false, alt: true, shift: false, meta: false },
    category: "Navigation",
    roles: ["Shop Owner", "Store Manager", "Branch Manager", "Distributor", "Franchise Owner", "Accountant (Operational)", "Admin"],
    actionType: "tab",
    actionValue: "dashboard"
  },
  {
    id: "open_reports",
    name: "Open Reports",
    description: "Access operational reports and document designers",
    defaultKey: { key: "r", ctrl: false, alt: true, shift: false, meta: false }, // Alt + R
    currentKey: { key: "r", ctrl: false, alt: true, shift: false, meta: false },
    category: "Navigation",
    roles: ["Shop Owner", "Store Manager", "Branch Manager", "Distributor", "Franchise Owner", "Accountant (Operational)", "Admin"],
    actionType: "tab",
    actionValue: "report-designer"
  },
  {
    id: "open_settings",
    name: "Open Settings / POS Profiles",
    description: "Open user profile, terminal, and terminal configurations",
    defaultKey: { key: ",", ctrl: false, alt: true, shift: false, meta: false }, // Alt + ,
    currentKey: { key: ",", ctrl: false, alt: true, shift: false, meta: false },
    category: "Navigation",
    roles: ["Shop Owner", "Store Manager", "Admin"],
    actionType: "tab",
    actionValue: "profiles"
  },
  {
    id: "open_notifications",
    name: "Open Notification Logs",
    description: "Inspect operational and audit notifications",
    defaultKey: { key: "b", ctrl: false, alt: true, shift: false, meta: false }, // Alt + B
    currentKey: { key: "b", ctrl: false, alt: true, shift: false, meta: false },
    category: "Navigation",
    roles: ["Shop Owner", "Store Manager", "Branch Manager", "Admin"],
    actionType: "tab",
    actionValue: "audit-logs"
  },
  {
    id: "ai_assistant",
    name: "Open SMRITI Gyan Kendra",
    description: "Access smart interactive help and documentation center (Gyan Kendra)",
    defaultKey: { key: "a", ctrl: false, alt: true, shift: false, meta: false }, // Alt + A
    currentKey: { key: "a", ctrl: false, alt: true, shift: false, meta: false },
    category: "Global",
    roles: ["Shop Owner", "Cashier", "Warehouse Staff", "Purchase Executive", "Sales Executive", "Store Manager", "Branch Manager", "Distributor", "Franchise Owner", "Accountant (Operational)", "Admin"],
    actionType: "tab",
    actionValue: "about-smriti"
  },
  {
    id: "toggle_sidebar",
    name: "Toggle Navigation Sidebar",
    description: "Expand or collapse the primary SMRITI operations rail",
    defaultKey: { key: "m", ctrl: false, alt: true, shift: false, meta: false }, // Alt + M
    currentKey: { key: "m", ctrl: false, alt: true, shift: false, meta: false },
    category: "Global",
    roles: ["Shop Owner", "Cashier", "Warehouse Staff", "Purchase Executive", "Sales Executive", "Store Manager", "Branch Manager", "Distributor", "Franchise Owner", "Accountant (Operational)", "Admin"],
    actionType: "layout",
    actionValue: "sidebar"
  },
  {
    id: "toggle_focus",
    name: "Toggle Focus Mode",
    description: "Collapse all system framing elements for a full-screen focus workflow",
    defaultKey: { key: "f", ctrl: false, alt: true, shift: false, meta: false }, // Alt + F
    currentKey: { key: "f", ctrl: false, alt: true, shift: false, meta: false },
    category: "Global",
    roles: ["Shop Owner", "Cashier", "Warehouse Staff", "Purchase Executive", "Sales Executive", "Store Manager", "Branch Manager", "Distributor", "Franchise Owner", "Accountant (Operational)", "Admin"],
    actionType: "layout",
    actionValue: "focus"
  },
  {
    id: "workspace_manager",
    name: "Open Workspace Manager",
    description: "Centralized workspace and master data manager",
    defaultKey: { key: "w", ctrl: false, alt: true, shift: false, meta: false }, // Alt + W
    currentKey: { key: "w", ctrl: false, alt: true, shift: false, meta: false },
    category: "Navigation",
    roles: ["Shop Owner", "Store Manager", "Admin"],
    actionType: "tab",
    actionValue: "masters"
  },
  {
    id: "win_maximize",
    name: "Maximize/Restore Active Window",
    description: "Toggle maximize or restore state for currently active floating workspace window",
    defaultKey: { key: "x", ctrl: false, alt: true, shift: false, meta: false }, // Alt + X
    currentKey: { key: "x", ctrl: false, alt: true, shift: false, meta: false },
    category: "Floating Window",
    roles: ["Shop Owner", "Cashier", "Warehouse Staff", "Purchase Executive", "Sales Executive", "Store Manager", "Branch Manager", "Distributor", "Franchise Owner", "Accountant (Operational)", "Admin"],
    actionType: "workspace",
    actionValue: "maximize"
  },
  {
    id: "win_close",
    name: "Close Active Window",
    description: "Close the currently active floating workspace window",
    defaultKey: { key: "q", ctrl: false, alt: true, shift: false, meta: false }, // Alt + Q
    currentKey: { key: "q", ctrl: false, alt: true, shift: false, meta: false },
    category: "Floating Window",
    roles: ["Shop Owner", "Cashier", "Warehouse Staff", "Purchase Executive", "Sales Executive", "Store Manager", "Branch Manager", "Distributor", "Franchise Owner", "Accountant (Operational)", "Admin"],
    actionType: "workspace",
    actionValue: "close"
  },
  {
    id: "win_minimize",
    name: "Minimize Active Window",
    description: "Minimize the currently active floating workspace window",
    defaultKey: { key: "h", ctrl: false, alt: true, shift: false, meta: false }, // Alt + H
    currentKey: { key: "h", ctrl: false, alt: true, shift: false, meta: false },
    category: "Floating Window",
    roles: ["Shop Owner", "Cashier", "Warehouse Staff", "Purchase Executive", "Sales Executive", "Store Manager", "Branch Manager", "Distributor", "Franchise Owner", "Accountant (Operational)", "Admin"],
    actionType: "workspace",
    actionValue: "minimize"
  },
  {
    id: "toggle_navbar",
    name: "Toggle Application Navbar",
    description: "Hide or show the top application header navbar",
    defaultKey: { key: "n", ctrl: false, alt: true, shift: true, meta: false }, // Alt + Shift + N
    currentKey: { key: "n", ctrl: false, alt: true, shift: true, meta: false },
    category: "Global",
    roles: ["Shop Owner", "Cashier", "Warehouse Staff", "Purchase Executive", "Sales Executive", "Store Manager", "Branch Manager", "Distributor", "Franchise Owner", "Accountant (Operational)", "Admin"],
    actionType: "layout",
    actionValue: "navbar"
  },
  {
    id: "toggle_sidebar",
    name: "Toggle Navigation Sidebar",
    description: "Hide or show the side navigation menu panel",
    defaultKey: { key: "s", ctrl: false, alt: true, shift: true, meta: false }, // Alt + Shift + S
    currentKey: { key: "s", ctrl: false, alt: true, shift: true, meta: false },
    category: "Global",
    roles: ["Shop Owner", "Cashier", "Warehouse Staff", "Purchase Executive", "Sales Executive", "Store Manager", "Branch Manager", "Distributor", "Franchise Owner", "Accountant (Operational)", "Admin"],
    actionType: "layout",
    actionValue: "sidebar_vis"
  },
  {
    id: "toggle_bottombar",
    name: "Toggle Workspace Bottombar",
    description: "Hide or show the bottom taskbar",
    defaultKey: { key: "b", ctrl: false, alt: true, shift: true, meta: false }, // Alt + Shift + B
    currentKey: { key: "b", ctrl: false, alt: true, shift: true, meta: false },
    category: "Global",
    roles: ["Shop Owner", "Cashier", "Warehouse Staff", "Purchase Executive", "Sales Executive", "Store Manager", "Branch Manager", "Distributor", "Franchise Owner", "Accountant (Operational)", "Admin"],
    actionType: "layout",
    actionValue: "bottombar"
  }
];

const ShortcutContext = createContext<ShortcutContextType | undefined>(undefined);

export const ShortcutProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { addToRecentlyUsed, toggleSidebar, toggleNavbar, toggleSidebarVisibility, toggleBottombar } = useLayoutEngine();
  const { toggleFocusMode, activeWindowId, floatingWindows, closeWindow, maximizeWindow, restoreWindow, minimizeWindow } = useWorkspace();
  const { setSearchOpen } = useDrillDown();

  const [paletteOpen, setPaletteOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(() => {
    return localStorage.getItem("smriti_shortcuts_is_admin") === "true";
  });

  const [activeRole, setActiveRole] = useState(() => {
    return localStorage.getItem("smriti_shortcuts_active_role") || "Admin";
  });

  const [shortcuts, setShortcuts] = useState<KeyboardShortcut[]>(() => {
    const saved = localStorage.getItem("smriti_custom_shortcuts");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Failed to parse custom shortcuts", e);
      }
    }
    // Try Org Defaults if present
    const orgSaved = localStorage.getItem("smriti_org_shortcuts");
    if (orgSaved) {
      try {
        return JSON.parse(orgSaved);
      } catch (e) {
        console.error("Failed to parse org shortcuts", e);
      }
    }
    return JSON.parse(JSON.stringify(DEFAULT_SHORTCUTS));
  });

  const [orgDefaultsExist, setOrgDefaultsExist] = useState(() => {
    return !!localStorage.getItem("smriti_org_shortcuts");
  });

  useEffect(() => {
    localStorage.setItem("smriti_shortcuts_is_admin", String(isAdmin));
  }, [isAdmin]);

  useEffect(() => {
    localStorage.setItem("smriti_shortcuts_active_role", activeRole);
  }, [activeRole]);

  // Save changes
  const persistShortcuts = (updated: KeyboardShortcut[]) => {
    setShortcuts(updated);
    localStorage.setItem("smriti_custom_shortcuts", JSON.stringify(updated));
  };

  // Helper to format key combo to match
  const matchesKeyConfig = (e: KeyboardEvent, config: ShortcutKeyConfig): boolean => {
    const keyMatch = e.key.toLowerCase() === config.key.toLowerCase();
    const ctrlMatch = e.ctrlKey === config.ctrl || e.metaKey === config.ctrl; // map meta key to ctrl as standard fallback
    const altMatch = e.altKey === config.alt;
    const shiftMatch = e.shiftKey === config.shift;
    return keyMatch && ctrlMatch && altMatch && shiftMatch;
  };

  const executeAction = useCallback((shortcut: KeyboardShortcut) => {
    // Check role restriction
    if (!shortcut.roles.includes(activeRole)) {
      console.warn(`Action restricted. Current Role: ${activeRole}, Required Roles:`, shortcut.roles);
      return;
    }

    switch (shortcut.actionType) {
      case "palette":
        setPaletteOpen((prev) => !prev);
        break;
      case "search":
        setSearchOpen(true);
        break;
      case "tab":
        if (shortcut.actionValue) {
          addToRecentlyUsed(shortcut.actionValue);
        }
        break;
      case "layout":
        if (shortcut.actionValue === "sidebar") {
          toggleSidebar();
        } else if (shortcut.actionValue === "sidebar_vis") {
          toggleSidebarVisibility();
        } else if (shortcut.actionValue === "navbar") {
          toggleNavbar();
        } else if (shortcut.actionValue === "bottombar") {
          toggleBottombar();
        } else if (shortcut.actionValue === "focus") {
          toggleFocusMode();
        }
        break;
      case "workspace":
        if (!activeWindowId) break;
        const targetWindow = floatingWindows.find((w) => w.id === activeWindowId);
        if (!targetWindow) break;
        
        if (shortcut.actionValue === "close") {
          closeWindow(activeWindowId);
        } else if (shortcut.actionValue === "maximize") {
          if (targetWindow.isMaximized) {
            restoreWindow(activeWindowId);
          } else {
            maximizeWindow(activeWindowId);
          }
        } else if (shortcut.actionValue === "minimize") {
          minimizeWindow(activeWindowId);
        }
        break;
      default:
        break;
    }
  }, [activeRole, activeWindowId, floatingWindows, closeWindow, maximizeWindow, restoreWindow, minimizeWindow, toggleSidebar, toggleNavbar, toggleSidebarVisibility, toggleBottombar, toggleFocusMode, addToRecentlyUsed, setSearchOpen]);

  // Central Event Listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Never intercept when user is typing in form inputs, textareas, or content-editable areas
      const target = e.target as HTMLElement;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target?.isContentEditable
      ) {
        return;
      }

      // Find the matched shortcut
      const matched = shortcuts.find((shortcut) => matchesKeyConfig(e, shortcut.currentKey));
      if (matched) {
        e.preventDefault();
        e.stopPropagation();
        executeAction(matched);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [shortcuts, executeAction]);

  // Check for conflicts
  const checkConflict = (config: ShortcutKeyConfig, excludeId: string): string | null => {
    const targetKey = config.key.toLowerCase();
    const matched = shortcuts.find(
      (s) =>
        s.id !== excludeId &&
        s.currentKey.key.toLowerCase() === targetKey &&
        s.currentKey.ctrl === config.ctrl &&
        s.currentKey.alt === config.alt &&
        s.currentKey.shift === config.shift &&
        s.currentKey.meta === config.meta
    );
    return matched ? matched.name : null;
  };

  // Update a single shortcut configuration
  const updateShortcut = (id: string, newKey: ShortcutKeyConfig) => {
    const conflict = checkConflict(newKey, id);
    if (conflict) {
      return { success: false, conflictWith: conflict };
    }

    const updated = shortcuts.map((s) => {
      if (s.id === id) {
        return { ...s, currentKey: newKey };
      }
      return s;
    });

    persistShortcuts(updated);
    return { success: true };
  };

  const resetToDefaults = () => {
    const reset = DEFAULT_SHORTCUTS.map((ds) => {
      // Retain custom assignments from DB / Org if needed, but here we reset fully
      return { ...ds };
    });
    persistShortcuts(reset);
  };

  const saveAsOrgDefaults = () => {
    if (!isAdmin) return;
    localStorage.setItem("smriti_org_shortcuts", JSON.stringify(shortcuts));
    setOrgDefaultsExist(true);
  };

  const resetToOrgDefaults = () => {
    const orgSaved = localStorage.getItem("smriti_org_shortcuts");
    if (orgSaved) {
      try {
        const parsed = JSON.parse(orgSaved);
        persistShortcuts(parsed);
      } catch (e) {
        console.error("Org defaults corrupt", e);
      }
    }
  };

  return (
    <ShortcutContext.Provider
      value={{
        shortcuts,
        activeRole,
        isAdmin,
        paletteOpen,
        setPaletteOpen,
        setActiveRole,
        setIsAdmin,
        updateShortcut,
        resetToDefaults,
        resetToOrgDefaults,
        saveAsOrgDefaults,
        orgDefaultsExist
      }}
    >
      {children}
    </ShortcutContext.Provider>
  );
};

export const useShortcuts = () => {
  const context = useContext(ShortcutContext);
  if (!context) {
    throw new Error("useShortcuts must be used within a ShortcutProvider");
  }
  return context;
};
