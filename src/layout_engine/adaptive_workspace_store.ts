/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 5.0.0
 * Created      : 2026-07-20
 * Modified     : 2026-08-03
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 */

import { useState, useEffect } from "react";

export type WorkspaceMode = "SIMPLE" | "HYBRID" | "ADVANCED";

/**
 * SXP v1.0 — AdaptiveVisibilityRegistry (SWEF — FROZEN)
 *
 * All feature visibility is governed exclusively through canRender().
 * Components MUST NOT contain `mode === 'ADVANCED'` conditionals.
 * Adding a new FeatureKey requires an approved ADR in docs/adr/.
 */
export type FeatureKey =
  | "timeline"       // Always visible — all modes
  | "reservations"   // HYBRID+
  | "batch_serial"   // HYBRID+
  | "cost_layers"    // ADVANCED only
  | "raw_ledger"     // ADVANCED only
  | "api_inspector" // ADVANCED only
  | "diagnostics"    // ADVANCED only
  | "lock_inspector"; // ADVANCED only

/** FROZEN — matches SWEF v1.0 visibility matrix in SXP Constitution */
export const ADAPTIVE_VISIBILITY_MATRIX: Record<FeatureKey, WorkspaceMode[]> = Object.freeze({
  timeline:       ["SIMPLE", "HYBRID", "ADVANCED"],
  reservations:   ["HYBRID", "ADVANCED"],
  batch_serial:   ["HYBRID", "ADVANCED"],
  cost_layers:    ["ADVANCED"],
  raw_ledger:     ["ADVANCED"],
  api_inspector:  ["ADVANCED"],
  diagnostics:    ["ADVANCED"],
  lock_inspector: ["ADVANCED"],
});

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
    maxPrimaryButtons: 6,
    allowedTabIds: ["pos", "dashboard", "print-studio", "universal-label-printer", "about", "wiki"],
  },
  HYBRID: {
    mode: "HYBRID",
    name: "Hybrid (Store Owner)",
    description: "Daily retail operations, item management, rebalancing, and CRM.",
    maxPrimaryButtons: 10,
    allowedTabIds: [
      "pos",
      "dashboard",
      "item-master",
      "items",
      "sales",
      "purchase",
      "customers",
      "customer-master",
      "stock_ledger",
      "quick_reports",
      "barcode",
      "print-studio",
      "universal-label-printer",
      "about",
      "wiki",
    ],
  },
  ADVANCED: {
    mode: "ADVANCED",
    name: "Advanced (Enterprise)",
    description: "Full accounting, SGIP GST reconciliation, SIP identity, approvals, and audit logs.",
    maxPrimaryButtons: 16,
    allowedTabIds: ["*"], // All tabs allowed
  },
};

const STORAGE_KEY = "smriti_workspace_mode";

class AdaptiveWorkspaceStore {
  private currentMode: WorkspaceMode = "ADVANCED";
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

  /**
   * AdaptiveVisibilityRegistry — FROZEN SWEF v1.0
   *
   * The ONLY mechanism for feature visibility decisions in the platform.
   * Usable from: React components, Action Framework, Widget Engine, WNE, unit tests.
   *
   * @param featureKey  - one of the frozen FeatureKey values
   * @param mode        - the current WorkspaceMode (optional — defaults to this.currentMode)
   */
  public canRender(featureKey: FeatureKey, mode?: WorkspaceMode): boolean {
    const effectiveMode = mode ?? this.currentMode;
    const allowedModes = ADAPTIVE_VISIBILITY_MATRIX[featureKey];
    return allowedModes.includes(effectiveMode);
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
    /** Delegates to AdaptiveVisibilityRegistry singleton — uses current mode from context */
    canRender: (featureKey: FeatureKey) => adaptiveWorkspaceStore.canRender(featureKey, mode),
  };
}
