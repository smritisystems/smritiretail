/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 4.0.0
 * Created      : 2026-07-20
 * Modified     : 2026-07-20
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 */

import { useState, useEffect } from "react";

export type WorkspaceMode = "SIMPLE" | "HYBRID" | "ADVANCED";

export interface WorkspaceModeConfig {
  mode: WorkspaceMode;
  name: string;
  description: string;
  maxPrimaryButtons: number;
  allowedTabIds: string[];
}

export const WORKSPACE_MODE_CONFIGS: Record<WorkspaceMode, WorkspaceModeConfig> = {
  SIMPLE: {
    mode: "SIMPLE",
    name: "Simple (Cashier)",
    description: "Ultra-fast billing terminal & shift summary with zero visual clutter.",
    maxPrimaryButtons: 4,
    allowedTabIds: ["pos", "dashboard", "about", "wiki"],
  },
  HYBRID: {
    mode: "HYBRID",
    name: "Hybrid (Store Owner)",
    description: "Daily retail operations, item management, rebalancing, and CRM.",
    maxPrimaryButtons: 7,
    allowedTabIds: [
      "pos",
      "dashboard",
      "items",
      "sales",
      "purchase",
      "customers",
      "stock_ledger",
      "quick_reports",
      "barcode",
      "about",
      "wiki",
    ],
  },
  ADVANCED: {
    mode: "ADVANCED",
    name: "Advanced (Enterprise)",
    description: "Full accounting, SGIP GST reconciliation, SIP identity, approvals, and audit logs.",
    maxPrimaryButtons: 12,
    allowedTabIds: ["*"], // All tabs allowed
  },
};

const STORAGE_KEY = "smriti_workspace_mode";

class AdaptiveWorkspaceStore {
  private currentMode: WorkspaceMode = "HYBRID";
  private listeners: Set<() => void> = new Set();

  constructor() {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(STORAGE_KEY) as WorkspaceMode;
      if (saved && WORKSPACE_MODE_CONFIGS[saved]) {
        this.currentMode = saved;
      }
    }
  }

  public getMode(): WorkspaceMode {
    return this.currentMode;
  }

  public getConfig(): WorkspaceModeConfig {
    return WORKSPACE_MODE_CONFIGS[this.currentMode];
  }

  public setMode(mode: WorkspaceMode) {
    if (WORKSPACE_MODE_CONFIGS[mode]) {
      this.currentMode = mode;
      if (typeof window !== "undefined") {
        localStorage.setItem(STORAGE_KEY, mode);
      }
      this.notify();
    }
  }

  public isTabAllowed(tabId: string): boolean {
    if (this.currentMode === "ADVANCED") return true;
    const allowed = WORKSPACE_MODE_CONFIGS[this.currentMode].allowedTabIds;
    return allowed.includes("*") || allowed.includes(tabId);
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach((fn) => fn());
  }
}

export const adaptiveWorkspaceStore = new AdaptiveWorkspaceStore();

export function useAdaptiveWorkspace() {
  const [mode, setModeState] = useState<WorkspaceMode>(adaptiveWorkspaceStore.getMode());

  useEffect(() => {
    const unsubscribe = adaptiveWorkspaceStore.subscribe(() => {
      setModeState(adaptiveWorkspaceStore.getMode());
    });
    return unsubscribe;
  }, []);

  return {
    mode,
    config: WORKSPACE_MODE_CONFIGS[mode],
    setMode: (newMode: WorkspaceMode) => adaptiveWorkspaceStore.setMode(newMode),
    isTabAllowed: (tabId: string) => adaptiveWorkspaceStore.isTabAllowed(tabId),
  };
}
