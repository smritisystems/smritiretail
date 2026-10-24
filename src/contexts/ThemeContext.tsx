/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 2.0.0
 * Created      : 2026-07-10
 * Modified     : 2026-10-11
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

// ---------------------------------------------------------------------------
// SMRITI ThemeContext v2.0 — Preset-Aware Theme Engine
// ---------------------------------------------------------------------------
// Replaces the binary light/dark toggle with a full preset system.
// Each preset bundles: mode, accent colour, density, and font scale.
// State is persisted to localStorage and propagated to the DOM via:
//   • data-theme attribute  → picks base CSS palette
//   • data-density attribute → activates spacing tokens
//   • --c-theme-primary CSS var override → accent colour
// ---------------------------------------------------------------------------

import React, { createContext, useContext, useEffect, useState } from "react";
import {
  ThemePreset,
  ThemeMode,
  THEME_PRESETS,
  DEFAULT_PRESET_ID,
  getPresetById,
  FONT_SCALE_MAP,
} from "../config/theme_presets.ts";

// ── Local-storage keys ──────────────────────────────────────────────────────
const LS_THEME  = "smriti-theme";
const LS_PRESET = "smriti-preset";

// ── Context type ────────────────────────────────────────────────────────────
interface ThemeContextType {
  /** Current base mode derived from active preset */
  theme: ThemeMode;
  /** The full active preset object */
  activePreset: ThemePreset;
  /** All available presets */
  presets: ThemePreset[];
  /** Apply a preset by ID — updates DOM, localStorage */
  setPreset: (id: string) => void;
  /** Quick toggle light ↔ dark keeping other preset properties */
  toggleTheme: () => void;
  /** Directly set mode (without full preset switch) */
  setTheme: (theme: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// ── DOM application helpers ─────────────────────────────────────────────────
function applyPresetToDOM(preset: ThemePreset): void {
  const root = window.document.documentElement;

  // 1. Base palette
  root.setAttribute("data-theme", preset.mode);
  if (preset.mode === "dark") {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }

  // 2. Density
  root.setAttribute("data-density", preset.density);

  // 3. Accent colour override
  root.style.setProperty("--c-theme-primary", preset.accent);
  // Derive hover/active from accent with opacity tricks via CSS fallback
  // (Full derivation is handled by the density token layer in index.css)

  // 4. Font base size
  root.style.setProperty("--font-base", FONT_SCALE_MAP[preset.fontScale]);
}

// ── Provider ────────────────────────────────────────────────────────────────
export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [activePreset, setActivePresetState] = useState<ThemePreset>(() => {
    // Prefer a saved preset; fall back to legacy smriti-theme value
    const savedPresetId = localStorage.getItem(LS_PRESET);
    if (savedPresetId) return getPresetById(savedPresetId);

    // Legacy: honour existing light/dark preference
    const savedMode = localStorage.getItem(LS_THEME) as ThemeMode | null;
    if (savedMode === "dark") return getPresetById("enterprise-dark");
    return getPresetById(DEFAULT_PRESET_ID);
  });

  // Apply preset to DOM whenever it changes
  useEffect(() => {
    applyPresetToDOM(activePreset);
    localStorage.setItem(LS_PRESET, activePreset.id);
    localStorage.setItem(LS_THEME, activePreset.mode); // keep legacy key in sync
  }, [activePreset]);

  const setPreset = (id: string) => {
    setActivePresetState(getPresetById(id));
  };

  const toggleTheme = () => {
    // Toggle between the two enterprise presets when no other is active,
    // or flip the mode of the current preset if it has a counterpart.
    const modeCounterpart: Record<string, string> = {
      "enterprise-light": "enterprise-dark",
      "enterprise-dark":  "enterprise-light",
      "pos-dark":         "enterprise-light",
      "retail-day":       "enterprise-dark",
      "high-contrast":    "enterprise-light",
    };
    const nextId = modeCounterpart[activePreset.id] ?? "enterprise-light";
    setActivePresetState(getPresetById(nextId));
  };

  const setTheme = (mode: ThemeMode) => {
    // Map plain mode to the appropriate enterprise preset
    setActivePresetState(
      getPresetById(mode === "dark" ? "enterprise-dark" : "enterprise-light")
    );
  };

  return (
    <ThemeContext.Provider
      value={{
        theme: activePreset.mode,
        activePreset,
        presets: THEME_PRESETS,
        setPreset,
        toggleTheme,
        setTheme,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

// ── Hook ────────────────────────────────────────────────────────────────────
export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
};
