/**
 * Project      : SMRITI Application Platform (SMAP) v1.0
 * Module       : Universal Platform Registry (UPR) — Navigation & Domain Registry
 * Standard     : SMAP Constitution v1.0 — Rule SAP-018 (Metadata First), SAP-020 (Zero Hardcoding) & WNG-005 (Declarative Navigation)
 * Author       : Jawahar Ramkripal Mallah
 * License      : Proprietary Commercial Software
 */

export interface DomainDefinition {
  id: string;                 // e.g. "ALL", "sales", "inventory", "purchase", "accounting", "crm", "reports"
  label: string;              // e.g. "Sales & Billing Domain", "Inventory & Stock Domain"
  icon: string;               // Material Symbol name or Lucide icon identifier
  emoji: string;              // Visual emoji symbol
  order: number;              // Administrative / Metadata sort ordering
  moduleIds: string[];        // Module workspace IDs associated with this domain
  defaultWorkspaceId?: string;// Default landing workspace ID when selecting domain
  permission?: string;        // Optional RBAC permission scope requirement
  featureFlag?: string;       // Optional feature flag toggle requirement
}

export interface SidebarDefinition {
  domain: Readonly<DomainDefinition> | null;
  moduleIds: string[];
  allDomains: ReadonlyArray<Readonly<DomainDefinition>>;
}

export class NavigationRegistryService {
  private domains: Map<string, Readonly<DomainDefinition>> = new Map();
  private listeners: Set<() => void> = new Set();

  constructor() {
    this.seedDefaultDomains();
  }

  private seedDefaultDomains() {
    const defaults: DomainDefinition[] = [
      {
        id: "ALL",
        label: "All Business Domains",
        icon: "grid_view",
        emoji: "🌐",
        order: 0,
        moduleIds: []
      },
      {
        id: "sales",
        label: "Sales & POS Domain",
        icon: "point_of_sale",
        emoji: "🛍️",
        order: 1,
        defaultWorkspaceId: "pos",
        moduleIds: ["pos", "sales", "customer-master", "crm", "loyalty", "profiles", "advanced-billing"]
      },
      {
        id: "inventory",
        label: "Inventory & Stock Domain",
        icon: "inventory_2",
        emoji: "📦",
        order: 2,
        defaultWorkspaceId: "item-master",
        moduleIds: ["item-master", "barcode", "stock-ledger", "warehouse", "consignment", "scdm", "operational-workspaces"]
      },
      {
        id: "purchase",
        label: "Purchase & Sourcing Domain",
        icon: "shopping_cart",
        emoji: "🛒",
        order: 3,
        defaultWorkspaceId: "purchase",
        moduleIds: ["purchase", "supplier-mgmt", "transaction-workspaces"]
      },
      {
        id: "accounting",
        label: "Accounting & Finance Domain",
        icon: "account_balance",
        emoji: "💼",
        order: 4,
        defaultWorkspaceId: "business-ledger",
        moduleIds: ["business-ledger", "accounting-sync", "terms-engine"]
      },
      {
        id: "crm",
        label: "Customer CRM & Loyalty Domain",
        icon: "groups",
        emoji: "👥",
        order: 5,
        defaultWorkspaceId: "crm",
        moduleIds: ["crm", "loyalty", "customer-dashboard", "customer-master"]
      },
      {
        id: "reports",
        label: "Analytics & Reports Domain",
        icon: "analytics",
        emoji: "📊",
        order: 6,
        defaultWorkspaceId: "bi-reports",
        moduleIds: ["bi-reports", "report-designer", "audit-logs", "dev-tracker", "wiki"]
      }
    ];

    defaults.forEach((d) => this.registerDomain(d));
  }

  public registerDomain(domain: DomainDefinition): void {
    const payload = Object.freeze({ ...domain, id: domain.id.toLowerCase() });
    this.domains.set(payload.id, payload);
    this.emitChange();
  }

  public getDomains(): ReadonlyArray<Readonly<DomainDefinition>> {
    return Array.from(this.domains.values()).sort((a, b) => a.order - b.order);
  }

  public getDomain(id: string): Readonly<DomainDefinition> | undefined {
    if (!id) return undefined;
    return this.domains.get(id.toLowerCase());
  }

  public getModuleIdsForDomain(domainId: string): string[] {
    if (!domainId || domainId.toUpperCase() === "ALL") {
      return [];
    }
    const def = this.domains.get(domainId.toLowerCase());
    return def ? [...def.moduleIds] : [];
  }

  public getSidebar(activeDomainId: string): SidebarDefinition {
    const dom = this.getDomain(activeDomainId) || null;
    const moduleIds = this.getModuleIdsForDomain(activeDomainId);
    const allDomains = this.getDomains();

    return {
      domain: dom,
      moduleIds,
      allDomains
    };
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public clear(): void {
    this.domains.clear();
    this.seedDefaultDomains();
    this.emitChange();
  }

  private emitChange(): void {
    this.listeners.forEach((listener) => listener());
  }
}

export const NavigationRegistry = new NavigationRegistryService();
