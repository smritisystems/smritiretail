/**
 * Project      : SMRITI Retail OS
 * Module       : SXP v1.0 — Theme Engine (upgraded from binary toggle)
 * Standard     : SXP Constitution v1.0 / UCR-001 (BrandingRegistry)
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Version      : 3.0.0
 * Created      : 2026-07-10
 * Modified     : 2026-08-03
 * Copyright    : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 *
 * SXP Theme Engine — 5 themes, runtime switching, no recompile.
 *
 * Mechanism:
 *   Sets data-theme="<theme>" on <html>.
 *   CSS files in src/styles/ scope all vars to [data-theme="<theme>"].
 *   custom-brand reads from SPK.configuration.branding (UCR-001) at init.
 *
 * Themes:
 *   dark          → smriti-theme-dark.css
 *   light         → smriti-theme-light.css
 *   high-contrast → smriti-theme-high-contrast.css
 *   retail-blue   → smriti-theme-fiori-lite.css
 *   custom-brand  → injected CSS vars from BrandingRegistry
 */

import React, { createContext, useContext, useEffect, useState } from "react";
import { WorkspaceEventBus } from "../layout_engine/WorkspaceEventBus.js";

// ── Theme Types ───────────────────────────────────────────────────────────────

export type SXPTheme =
  | "dark"
  | "light"
  | "high-contrast"
  | "retail-blue"
  | "custom-brand";

export interface ThemeOption {
  id: SXPTheme;
  label: string;
  description: string;
}

export const SXP_THEMES: ThemeOption[] = [
  { id: "dark",          label: "Dark",          description: "Default SMRITI dark theme" },
  { id: "light",         label: "Light",          description: "Light professional theme" },
  { id: "high-contrast", label: "High Contrast", description: "WCAG AAA accessibility theme" },
  { id: "retail-blue",   label: "Retail Blue",   description: "Fiori-inspired retail theme" },
  { id: "custom-brand",  label: "Brand Theme",   description: "Custom brand colours from BrandingRegistry" },
];

// ── Context ───────────────────────────────────────────────────────────────────

interface ThemeContextType {
  theme: SXPTheme;
  setTheme(theme: SXPTheme): void;
  /** Legacy toggle — switches between dark and light only */
  toggleTheme(): void;
  themeOptions: ThemeOption[];
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// ── CSS Var injection for custom-brand ────────────────────────────────────────

function injectBrandTheme(brandColors: Record<string, string>): void {
  let styleEl = document.getElementById("sxp-custom-brand-vars");
  if (!styleEl) {
    styleEl = document.createElement("style");
    styleEl.id = "sxp-custom-brand-vars";
    document.head.appendChild(styleEl);
  }
  const vars = Object.entries(brandColors)
    .map(([k, v]) => `  ${k}: ${v};`)
    .join("\n");
  styleEl.textContent = `[data-theme="custom-brand"] {\n${vars}\n}`;
}

// ── Provider ──────────────────────────────────────────────────────────────────

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<SXPTheme>(() => {
    const saved = localStorage.getItem("smriti-sxp-theme") as SXPTheme | null;
    if (saved && SXP_THEMES.some((t) => t.id === saved)) return saved;
    // Legacy: migrate old "dark"/"light" key
    const legacy = localStorage.getItem("smriti-theme");
    if (legacy === "light") return "light";
    return "dark"; // SMRITI default
  });

  const applyTheme = (t: SXPTheme) => {
    const root = document.documentElement;
    root.setAttribute("data-theme", t);
    // Legacy dark class — kept for backward compat with existing Tailwind dark: selectors
    if (t === "dark" || t === "custom-brand") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  };

  useEffect(() => {
    applyTheme(theme);
    localStorage.setItem("smriti-sxp-theme", theme);
    WorkspaceEventBus.publish("ThemeChanged", { theme }, "platform");
  }, [theme]);

  const setTheme = (newTheme: SXPTheme) => {
    setThemeState(newTheme);
    // If custom-brand, attempt to load brand vars from BrandingRegistry
    if (newTheme === "custom-brand" && typeof window !== "undefined") {
      // Forward-compat: SPK.configuration.branding will inject vars when available
      const brandColors = (window as unknown as { __SMRITI_BRAND_VARS__?: Record<string, string> }).__SMRITI_BRAND_VARS__ ?? {};
      if (Object.keys(brandColors).length > 0) {
        injectBrandTheme(brandColors);
      }
    }
  };

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme, themeOptions: SXP_THEMES }}>
      {children}
    </ThemeContext.Provider>
  );
};

// ── Hook ──────────────────────────────────────────────────────────────────────

export const useTheme = (): ThemeContextType => {
  const ctx = useContext(ThemeContext);
  if (ctx === undefined) {
    throw new Error("useTheme must be used inside <ThemeProvider>");
  }
  return ctx;
};
