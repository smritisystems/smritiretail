/**
 * SMRITI Adaptive Workspace Framework (SAWF v1.1)
 * Workspace Preferences Service
 */

import { SAWFExperienceMode } from "../types/sawf.ts";

export interface SAWFPreferences {
  experienceMode: SAWFExperienceMode;
  sidebarOpen: boolean;
  expandedPanels: Record<string, boolean>;
  gridDensity: "compact" | "comfortable" | "relaxed";
  theme: "dark" | "light" | "fiori";
  keyboardShortcutsEnabled: boolean;
  defaultWarehouse?: string;
  defaultPaymentMode?: string;
}

export class WorkspacePreferences {
  private static getKey(module: string): string {
    return `smriti_sawf_prefs_${module}`;
  }

  static get(module: string, defaultMode: SAWFExperienceMode = "simple"): SAWFPreferences {
    const key = this.getKey(module);
    try {
      const stored = localStorage.getItem(key);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.warn(`[SAWFWorkspacePreferences] Failed to load prefs for ${module}`, e);
    }

    return {
      experienceMode: defaultMode,
      sidebarOpen: true,
      expandedPanels: {},
      gridDensity: "comfortable",
      theme: "dark",
      keyboardShortcutsEnabled: true,
    };
  }

  static save(module: string, prefs: Partial<SAWFPreferences>): void {
    const key = this.getKey(module);
    try {
      const existing = this.get(module);
      const updated = { ...existing, ...prefs };
      localStorage.setItem(key, JSON.stringify(updated));
    } catch (e) {
      console.warn(`[SAWFWorkspacePreferences] Failed to save prefs for ${module}`, e);
    }
  }
}
