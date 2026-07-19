/**
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Organization : AITDL NETWORKS
 *
 * Founders
 *
 * * Pushpa Devi Jawahar Mallah
 *   * Founder & Chairperson
 *   * Phone: +91 9324117007
 *   * Email: founder@aitdl.com
 *
 * * Jawahar Ramkripal Mallah
 *   * Founder, Chief Executive Officer (CEO) & Chief Software Architect
 *   * Email: founder@aitdl.com
 *
 * * Websites: smritisys.com | aitdl.com | erpnbook.com | smritibooks.com
 *
 * * Version    : 2.1.1
 * * Created    : 2026-07-10
 * * Modified   : 2026-07-11
 * * Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
 * * License    : Proprietary Commercial Software
 */

import React, { createContext, useContext, useState, useEffect, useRef } from "react";
import { ContextData, ContextAction } from "./ContextAction.ts";
import { registry } from "./ContextRegistry.ts";

export interface ContextMenuState {
  isOpen: boolean;
  context: ContextData | null;
  position: { x: number; y: number };
  anchor: "cursor" | "element";
  triggerType: "right-click" | "long-press" | "keyboard" | "programmatic";
  density: "comfortable" | "compact";
  searchQuery: string;
}

interface ContextActionContextProps {
  state: ContextMenuState;
  actions: ContextAction[];
  openMenu: (
    e: React.MouseEvent | React.TouchEvent | MouseEvent | TouchEvent | KeyboardEvent | null,
    context: ContextData,
    anchor?: "cursor" | "element"
  ) => void;
  closeMenu: () => void;
  setSearchQuery: (query: string) => void;
  toggleFavorite: (actionId: string) => void;
  togglePin: (actionId: string) => void;
  setDensity: (density: "comfortable" | "compact") => void;
  executeAction: (action: ContextAction) => void;
}

const ContextActionContext = createContext<ContextActionContextProps | undefined>(undefined);

export const ContextProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<ContextMenuState>({
    isOpen: false,
    context: null,
    position: { x: 0, y: 0 },
    anchor: "cursor",
    triggerType: "programmatic",
    density: "comfortable",
    searchQuery: ""
  });

  const [actions, setActions] = useState<ContextAction[]>([]);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);

  // Synchronize available actions when context changes or search query updates
  useEffect(() => {
    if (state.context) {
      const available = registry.getActions(state.context);
      setActions(available);
    } else {
      setActions([]);
    }
  }, [state.context, state.searchQuery]);

  const openMenu = (
    e: React.MouseEvent | React.TouchEvent | MouseEvent | TouchEvent | KeyboardEvent | null,
    context: ContextData,
    anchor: "cursor" | "element" = "cursor"
  ) => {
    let x = 0;
    let y = 0;
    let triggerType: ContextMenuState["triggerType"] = "programmatic";

    if (e) {
      if ("preventDefault" in e) e.preventDefault();
      if ("stopPropagation" in e) e.stopPropagation();

      if ("clientX" in e && e.clientX !== undefined) {
        x = e.clientX;
        y = e.clientY;
        triggerType = e.type === "contextmenu" ? "right-click" : "programmatic";
      } else if ("touches" in e && e.touches.length > 0) {
        x = e.touches[0].clientX;
        y = e.touches[0].clientY;
        triggerType = "long-press";
      } else if (e.type === "keydown") {
        triggerType = "keyboard";
        // Position relative to active element or center screen
        const activeEl = document.activeElement as HTMLElement;
        if (activeEl) {
          const rect = activeEl.getBoundingClientRect();
          x = rect.left + rect.width / 2;
          y = rect.bottom;
        } else {
          x = window.innerWidth / 2;
          y = window.innerHeight / 2;
        }
      }
    } else {
      x = window.innerWidth / 2;
      y = window.innerHeight / 2;
    }

    // Adjust position for screen bounds
    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;
    const menuWidth = 260; // Estimated menu width
    const menuHeight = 350; // Estimated max menu height

    if (x + menuWidth > screenWidth) {
      x = Math.max(10, screenWidth - menuWidth - 10);
    }
    if (y + menuHeight > screenHeight) {
      y = Math.max(10, screenHeight - menuHeight - 10);
    }

    setState(prev => ({
      ...prev,
      isOpen: true,
      context,
      position: { x, y },
      anchor,
      triggerType,
      searchQuery: ""
    }));

    // Record system audit trail log
    try {
      const auditLog = {
        timestamp: new Date().toISOString(),
        event: "ACAS_MENU_OPEN",
        module: context.module,
        type: context.type,
        role: context.role || "Unknown",
        trigger: triggerType
      };
      // Keep in local logs
      const logs = JSON.parse(localStorage.getItem("smriti_acas_audit_logs") || "[]");
      logs.push(auditLog);
      localStorage.setItem("smriti_acas_audit_logs", JSON.stringify(logs.slice(-100)));
    } catch (err) {}
  };

  const closeMenu = () => {
    setState(prev => ({ ...prev, isOpen: false, searchQuery: "" }));
  };

  const setSearchQuery = (query: string) => {
    setState(prev => ({ ...prev, searchQuery: query }));
  };

  const toggleFavorite = (actionId: string) => {
    registry.toggleFavorite(actionId);
    if (state.context) {
      setActions(registry.getActions(state.context));
    }
  };

  const togglePin = (actionId: string) => {
    registry.togglePin(actionId);
    if (state.context) {
      setActions(registry.getActions(state.context));
    }
  };

  const setDensity = (density: "comfortable" | "compact") => {
    setState(prev => ({ ...prev, density }));
  };

  const executeAction = (action: ContextAction) => {
    if (state.context) {
      // Record Execution
      registry.recordExecution(action.id);
      
      // Invoke callback
      action.onClick(state.context);

      // Audit Execution
      try {
        const auditLog = {
          timestamp: new Date().toISOString(),
          event: "ACAS_ACTION_EXECUTE",
          actionId: action.id,
          label: action.label,
          module: state.context.module,
          type: state.context.type,
          role: state.context.role || "Unknown"
        };
        const logs = JSON.parse(localStorage.getItem("smriti_acas_audit_logs") || "[]");
        logs.push(auditLog);
        localStorage.setItem("smriti_acas_audit_logs", JSON.stringify(logs.slice(-100)));
      } catch (err) {}
    }
    closeMenu();
  };

  // Keyboard shortcut listener for active keyboard actions
  useEffect(() => {
    const handleGlobalShortcuts = (e: KeyboardEvent) => {
      // 1. Shift + F10 or Menu Key to open context menu on active element
      if ((e.shiftKey && e.key === "F10") || e.key === "ContextMenu") {
        e.preventDefault();
        const activeEl = document.activeElement as HTMLElement;
        if (activeEl) {
          // Check if data-context-module and data-context-type are present
          const module = activeEl.getAttribute("data-context-module");
          const type = activeEl.getAttribute("data-context-type");
          if (module && type) {
            let parsedObject = null;
            try {
              const rawObj = activeEl.getAttribute("data-context-object");
              if (rawObj) parsedObject = JSON.parse(rawObj);
            } catch (_) {}

            openMenu(e, {
              module,
              type,
              object: parsedObject,
              role: "Store Manager" // Default fallback or fetch from state
            });
          }
        }
      }
    };

    window.addEventListener("keydown", handleGlobalShortcuts);
    return () => window.removeEventListener("keydown", handleGlobalShortcuts);
  }, []);

  return (
    <ContextActionContext.Provider
      value={{
        state,
        actions,
        openMenu,
        closeMenu,
        setSearchQuery,
        toggleFavorite,
        togglePin,
        setDensity,
        executeAction
      }}
    >
      {children}
    </ContextActionContext.Provider>
  );
};

export const useACAS = () => {
  const context = useContext(ContextActionContext);
  if (!context) {
    throw new Error("useACAS must be used within a ContextProvider");
  }
  return context;
};
