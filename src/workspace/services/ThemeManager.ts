/**
 * Project      : SMRITI Retail OS
 * Module       : SMRITI Hierarchical Theme Manager (ADR-UX-001 Compliant)
 * Standard     : ADR-UX-001 — SMRITI Design Language & Token Foundation
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 */

import { SEEFTheme } from "../../layout_engine/SEEFTypes";
import { IThemeManager } from "../interfaces/ISWSContracts";
import { workspaceEventBus } from "../events/workspaceEvents";

class ThemeManagerImpl implements IThemeManager {
  private currentTheme: SEEFTheme = "enterprise";

  constructor() {
    this.init();
  }

  private init(): void {
    const saved = localStorage.getItem("smriti_seef_theme") as SEEFTheme;
    if (saved) {
      this.currentTheme = saved;
      this.applyThemeTokens(saved);
    }
  }

  public resolveTheme(userPreference?: SEEFTheme, tenantOverride?: SEEFTheme): SEEFTheme {
    if (tenantOverride) return tenantOverride;
    if (userPreference) return userPreference;
    return this.currentTheme;
  }

  public applyThemeTokens(theme: SEEFTheme): void {
    this.currentTheme = theme;
    localStorage.setItem("smriti_seef_theme", theme);
    document.documentElement.setAttribute("data-seef-theme", theme);
    workspaceEventBus.publish("ThemeChanged", { theme });
  }

  public getCurrentTheme(): SEEFTheme {
    return this.currentTheme;
  }
}

export const themeManager = new ThemeManagerImpl();
