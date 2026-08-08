/**
 * Project      : SMRITI Application Platform (SMAP) v1.0
 * Module       : Universal Platform Registry (UPR) — License Registry (USR-004)
 * Standard     : SMAP Constitution v1.0 — Rule SAP-018 (Metadata First) & USR Standard v1.0
 * Author       : Jawahar Ramkripal Mallah
 * License      : Proprietary Commercial Software
 */

export type LicenseEdition = "community" | "standard" | "professional" | "enterprise";

export interface FeatureFlagDefinition {
  id: string;               // Feature flag key (e.g. "feature.pos", "feature.ai", "feature.jewellery")
  name: string;
  isEnabled: boolean;
  minEdition: LicenseEdition;
  description?: string;
}

export interface LicenseMetadata {
  licenseKey: string;
  customerName: string;
  edition: LicenseEdition;
  issuedAt: string;
  expiresAt: string;
  maxUsers: number;
  maxStores: number;
  enabledFeatures: string[];
  isActive: boolean;
}

export class LicenseRegistryService {
  private license: Readonly<LicenseMetadata>;
  private features: Map<string, Readonly<FeatureFlagDefinition>> = new Map();
  private listeners: Set<() => void> = new Set();

  constructor() {
    this.license = Object.freeze({
      licenseKey: "SMRITI-ENT-2026-PERPETUAL",
      customerName: "SMRITI Enterprise Core",
      edition: "enterprise",
      issuedAt: "2026-01-01T00:00:00Z",
      expiresAt: "2099-12-31T23:59:59Z",
      maxUsers: 500,
      maxStores: 50,
      enabledFeatures: ["pos", "inventory", "purchase", "accounting", "crm", "ai", "reports"],
      isActive: true
    });

    this.seedDefaultFeatures();
  }

  private seedDefaultFeatures() {
    const defaults: FeatureFlagDefinition[] = [
      { id: "pos", name: "Point of Sale Billing", isEnabled: true, minEdition: "community" },
      { id: "inventory", name: "Inventory Item Master & Barcode", isEnabled: true, minEdition: "community" },
      { id: "purchase", name: "Purchase Orders & Sourcing", isEnabled: true, minEdition: "standard" },
      { id: "accounting", name: "General Ledger & Tax Sync", isEnabled: true, minEdition: "standard" },
      { id: "crm", name: "Customer CRM & Loyalty Engine", isEnabled: true, minEdition: "professional" },
      { id: "ai", name: "AI Advisory Skills Engine", isEnabled: true, minEdition: "enterprise" }
    ];

    defaults.forEach((f) => this.registerFeature(f));
  }

  public registerFeature(feature: FeatureFlagDefinition): void {
    const payload = Object.freeze({ ...feature, id: feature.id.toLowerCase() });
    this.features.set(payload.id, payload);
    this.emitChange();
  }

  public getLicense(): Readonly<LicenseMetadata> {
    return this.license;
  }

  public setLicense(metadata: LicenseMetadata): void {
    this.license = Object.freeze({ ...metadata });
    this.emitChange();
  }

  public isFeatureEnabled(featureId: string): boolean {
    const feat = this.features.get(featureId.toLowerCase());
    if (!feat) return false;
    return feat.isEnabled && this.license.enabledFeatures.includes(featureId.toLowerCase());
  }

  public getFeatures(): ReadonlyArray<Readonly<FeatureFlagDefinition>> {
    return Array.from(this.features.values());
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emitChange(): void {
    this.listeners.forEach((listener) => listener());
  }
}

export const LicenseRegistry = new LicenseRegistryService();
