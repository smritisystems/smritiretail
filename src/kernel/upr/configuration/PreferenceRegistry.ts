/**
 * Project      : SMRITI Application Platform (SMAP) v1.0
 * Module       : Universal Platform Registry (UPR) — Preference Registry (UCR-003)
 * Standard     : SMAP Constitution v1.0 — Rule SAP-018 (Metadata First) & UCR Standard v1.0
 * Author       : Jawahar Ramkripal Mallah
 * License      : Proprietary Commercial Software
 */

export type PreferenceScope = "user" | "tenant" | "workspace";

export interface PreferenceEntry {
  key: string;            // Preference key (e.g. "pos.autoPrintReceipt", "grid.density")
  scope: PreferenceScope;
  value: any;
  userId?: string;
  tenantId?: string;
}

export class PreferenceRegistryService {
  private preferences: Map<string, any> = new Map();
  private listeners: Set<() => void> = new Set();

  constructor() {
    this.seedDefaultPreferences();
  }

  private seedDefaultPreferences() {
    this.setPreference("pos.autoPrintReceipt", true, "tenant");
    this.setPreference("pos.quickPayBarcode", true, "tenant");
    this.setPreference("grid.density", "comfortable", "user");
    this.setPreference("reports.defaultExportFormat", "excel", "user");
  }

  public setPreference(key: string, value: any, scope: PreferenceScope = "user"): void {
    this.preferences.set(key.toLowerCase(), Object.freeze({ key, value, scope }));
    this.emitChange();
  }

  public getPreference<T = any>(key: string, defaultValue?: T): T {
    const entry = this.preferences.get(key.toLowerCase());
    return entry ? entry.value : (defaultValue as T);
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  public clear(): void {
    this.preferences.clear();
    this.seedDefaultPreferences();
    this.emitChange();
  }

  private emitChange(): void {
    this.listeners.forEach((listener) => listener());
  }
}

export const PreferenceRegistry = new PreferenceRegistryService();
