/**
 * Project      : SMRITI Retail OS
 * Module       : SXP v1.0 — SmritiExperienceContext
 * Standard     : SXP Constitution v1.0 / SWEF v1.0
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Version      : 1.0.0
 * Created      : 2026-08-03
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 *
 * Platform-wide React context. Wraps adaptive_workspace_store + saef_experience_store
 * and adds forward-compatible experience dimensions (compact, touch, a11y, etc.).
 *
 * USAGE:
 *   const { mode, canRender, industryPack, touchMode } = useSmritiExperience();
 *   if (canRender('reservations')) { ... }  // ← correct
 *   if (mode === 'ADVANCED') { ... }        // ← PROHIBITED — use canRender() instead
 */

import React, { createContext, useContext, useState, useEffect } from "react";
import {
  WorkspaceMode,
  FeatureKey,
  adaptiveWorkspaceStore,
  WORKSPACE_MODE_CONFIGS,
  WorkspaceModeConfig,
} from "../layout_engine/adaptive_workspace_store.js";
import {
  IndustryPackType,
  IndustryPackConfig,
  saefExperienceStore,
} from "../layout_engine/saef_experience_store.js";
import { WorkspaceEventBus } from "../layout_engine/WorkspaceEventBus.js";

// ── Experience State ──────────────────────────────────────────────────────────

export interface SmritiExperienceState {
  /** Core adaptive mode from adaptive_workspace_store */
  mode: WorkspaceMode;
  /** Active mode config (maxPrimaryButtons, allowedTabIds) */
  config: WorkspaceModeConfig;

  /** Active industry pack from saef_experience_store */
  industryPack: IndustryPackConfig;
  /** Shorthand pack ID */
  industryPackId: IndustryPackType;

  // Forward-compatible experience dimensions (SXP v1.0)
  /** Tighter spacing — sidebar collapses to icon-only density */
  compactMode: boolean;
  /** 44px min targets, no hover-only controls */
  touchMode: boolean;
  /** 1.2× type scale for readability */
  largeFontMode: boolean;
  /** Visible keybinding overlays on interactive elements */
  keyboardMode: boolean;
  /** WCAG AA focus rings + high-contrast badge */
  accessibilityMode: boolean;
}

// ── Context Interface ─────────────────────────────────────────────────────────

interface SmritiExperienceContextType extends SmritiExperienceState {
  setMode(mode: WorkspaceMode): void;
  setCompactMode(value: boolean): void;
  setTouchMode(value: boolean): void;
  setLargeFontMode(value: boolean): void;
  setKeyboardMode(value: boolean): void;
  setAccessibilityMode(value: boolean): void;

  /**
   * AdaptiveVisibilityRegistry — the ONLY way to check feature visibility.
   * Delegates to adaptiveWorkspaceStore.canRender() with the current mode.
   */
  canRender(featureKey: FeatureKey): boolean;

  isTabAllowed(tabId: string): boolean;
}

// ── Context + Provider ────────────────────────────────────────────────────────

const SmritiExperienceContext = createContext<SmritiExperienceContextType | undefined>(undefined);

const PREFS_KEY = "smriti_sxp_experience";

function loadPrefs(): Pick<
  SmritiExperienceState,
  "compactMode" | "touchMode" | "largeFontMode" | "keyboardMode" | "accessibilityMode"
> {
  const defaults = {
    compactMode: false,
    touchMode: false,
    largeFontMode: false,
    keyboardMode: false,
    accessibilityMode: false,
  };
  if (typeof window === "undefined") return defaults;
  try {
    const saved = localStorage.getItem(PREFS_KEY);
    if (saved) return { ...defaults, ...JSON.parse(saved) };
  } catch {
    // ignore
  }
  return defaults;
}

export const SmritiExperienceProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [mode, setModeState] = useState<WorkspaceMode>(adaptiveWorkspaceStore.getMode());
  const [pack, setPackState] = useState<IndustryPackConfig>(saefExperienceStore.getActivePack());
  const [prefs, setPrefs] = useState(loadPrefs);

  // Sync with underlying stores
  useEffect(() => {
    const unA = adaptiveWorkspaceStore.subscribe(() =>
      setModeState(adaptiveWorkspaceStore.getMode())
    );
    const unS = saefExperienceStore.subscribe(() =>
      setPackState(saefExperienceStore.getActivePack())
    );
    return () => { unA(); unS(); };
  }, []);

  // Persist prefs
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
    }
  }, [prefs]);

  const setMode = (newMode: WorkspaceMode) => {
    adaptiveWorkspaceStore.setMode(newMode);
    WorkspaceEventBus.publish("ModeChanged", { mode: newMode });
  };

  const updatePref = <K extends keyof typeof prefs>(key: K, value: boolean) => {
    setPrefs((p) => ({ ...p, [key]: value }));
  };

  const value: SmritiExperienceContextType = {
    mode,
    config: WORKSPACE_MODE_CONFIGS[mode],
    industryPack: pack,
    industryPackId: pack.id,
    ...prefs,

    setMode,
    setCompactMode: (v) => updatePref("compactMode", v),
    setTouchMode: (v) => updatePref("touchMode", v),
    setLargeFontMode: (v) => updatePref("largeFontMode", v),
    setKeyboardMode: (v) => updatePref("keyboardMode", v),
    setAccessibilityMode: (v) => updatePref("accessibilityMode", v),

    canRender: (featureKey) => adaptiveWorkspaceStore.canRender(featureKey, mode),
    isTabAllowed: (tabId) => adaptiveWorkspaceStore.isTabAllowed(tabId),
  };

  return (
    <SmritiExperienceContext.Provider value={value}>
      {children}
    </SmritiExperienceContext.Provider>
  );
};

// ── Hook ──────────────────────────────────────────────────────────────────────

/**
 * useSmritiExperience — the single hook for all UX state.
 *
 * Replaces:
 *   useAdaptiveWorkspace()  → use mode, canRender, isTabAllowed
 *   useSAEFExperience()     → use industryPack, industryPackId
 *
 * The underlying stores remain available for non-React code (action framework, tests).
 */
export function useSmritiExperience(): SmritiExperienceContextType {
  const ctx = useContext(SmritiExperienceContext);
  if (ctx === undefined) {
    throw new Error(
      "useSmritiExperience must be called inside <SmritiExperienceProvider>. " +
        "Wrap your root with <SmritiExperienceProvider>."
    );
  }
  return ctx;
}
