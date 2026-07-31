/**
 * Project      : SMRITI Application Platform (SMAP) v1.0
 * Module       : Universal Platform Registry (UPR) — Environment Registry (UCR-004)
 * Standard     : SMAP Constitution v1.0 — Rule SAP-018 (Metadata First) & UCR Standard v1.0
 * Author       : Jawahar Ramkripal Mallah
 * License      : Proprietary Commercial Software
 */

export interface EnvironmentConfig {
  environmentName: "development" | "staging" | "production";
  apiBaseUrl: string;
  isOfflineCapable: boolean;
  enableDebugLogs: boolean;
  version: string;
  buildNumber: string;
}

export class EnvironmentRegistryService {
  private config: Readonly<EnvironmentConfig>;
  private listeners: Set<() => void> = new Set();

  constructor() {
    this.config = Object.freeze({
      environmentName: "production",
      apiBaseUrl: "/api/internal/v1",
      isOfflineCapable: true,
      enableDebugLogs: false,
      version: "3.29.0",
      buildNumber: "2026.07.31-PROD"
    });
  }

  public getConfig(): Readonly<EnvironmentConfig> {
    return this.config;
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emitChange(): void {
    this.listeners.forEach((listener) => listener());
  }
}

export const EnvironmentRegistry = new EnvironmentRegistryService();
