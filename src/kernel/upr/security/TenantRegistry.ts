/**
 * Project      : SMRITI Application Platform (SMAP) v1.0
 * Module       : Universal Platform Registry (UPR) — Tenant Registry (USR-005)
 * Standard     : SMAP Constitution v1.0 — Rule SAP-018 (Metadata First) & USR Standard v1.0
 * Author       : Jawahar Ramkripal Mallah
 * License      : Proprietary Commercial Software
 */

export interface OrganizationStore {
  storeId: string;
  storeName: string;
  city: string;
  gstin?: string;
  isMainBranch?: boolean;
}

export interface TenantDefinition {
  tenantId: string;           // Tenant identifier (e.g. "smriti-default", "t-1002")
  name: string;               // Organization display title
  legalEntityName: string;    // Registered business entity name
  currency: string;           // Default currency code (e.g. "INR")
  timezone: string;           // Timezone identifier (e.g. "Asia/Kolkata")
  stores: OrganizationStore[];
  isActive: boolean;
}

export class TenantRegistryService {
  private activeTenantId: string = "smriti-default";
  private tenants: Map<string, Readonly<TenantDefinition>> = new Map();
  private listeners: Set<() => void> = new Set();

  constructor() {
    this.seedDefaultTenants();
  }

  private seedDefaultTenants() {
    const defaultTenant: TenantDefinition = {
      tenantId: "smriti-default",
      name: "SMRITI Retail Enterprise HQ",
      legalEntityName: "SMRITI Systems Private Limited",
      currency: "INR",
      timezone: "Asia/Kolkata",
      isActive: true,
      stores: [
        { storeId: "store-01", storeName: "Mumbai Flagship Retail Store", city: "Mumbai", gstin: "27AAAAA0000A1Z5", isMainBranch: true },
        { storeId: "store-02", storeName: "Bengaluru Technology Hub Store", city: "Bengaluru", gstin: "29AAAAA0000A1Z5" }
      ]
    };

    this.registerTenant(defaultTenant);
  }

  public registerTenant(tenant: TenantDefinition): void {
    const payload = Object.freeze({ ...tenant, tenantId: tenant.tenantId.toLowerCase() });
    this.tenants.set(payload.tenantId, payload);
    this.emitChange();
  }

  public getTenant(tenantId: string): Readonly<TenantDefinition> | undefined {
    if (!tenantId) return undefined;
    return this.tenants.get(tenantId.toLowerCase());
  }

  public getActiveTenant(): Readonly<TenantDefinition> {
    return this.getTenant(this.activeTenantId) || Array.from(this.tenants.values())[0];
  }

  public setActiveTenant(tenantId: string): void {
    if (this.tenants.has(tenantId.toLowerCase())) {
      this.activeTenantId = tenantId.toLowerCase();
      this.emitChange();
    }
  }

  public getTenants(): ReadonlyArray<Readonly<TenantDefinition>> {
    return Array.from(this.tenants.values());
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  public clear(): void {
    this.tenants.clear();
    this.seedDefaultTenants();
    this.emitChange();
  }

  private emitChange(): void {
    this.listeners.forEach((listener) => listener());
  }
}

export const TenantRegistry = new TenantRegistryService();
