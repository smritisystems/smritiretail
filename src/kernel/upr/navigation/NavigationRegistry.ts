/**
 * Project      : SMRITI Application Platform (SMAP) v1.0
 * Module       : Universal Platform Registry (UPR) — Navigation & Domain Registry (FROZEN v1.0)
 * Standard     : SMAP Constitution v1.0 — Rule SAP-018, SAP-020, WNG-005, Rule 19 (NRA-001) & Rule 20 (NCS-001)
 * Author       : Jawahar Ramkripal Mallah
 * License      : Proprietary Commercial Software
 */

export type ModuleOwnerType = "SMRITI" | "Partner" | "Marketplace" | "Customer";

export type NavigationEventType = 
  | "WorkspaceChanged" 
  | "DomainChanged" 
  | "ModuleActivated" 
  | "ModuleRegistered" 
  | "ModuleRemoved";

export type NavigationHealthStatus = "HEALTHY" | "WARNING" | "ERROR" | "CRITICAL";

// Platform Immutable Navigation IDs (NCS-001 Standard)
export const NAV_IDS = {
  ITEM_MASTER: "NAV_ITEM_MASTER",
  STOCK_LEDGER: "NAV_STOCK_LEDGER",
  BARCODE: "NAV_BARCODE",
  PRINT_STUDIO: "NAV_PRINT_STUDIO",
  CONSIGNMENT: "NAV_CONSIGNMENT",
  SALES_INVOICE: "NAV_SALES_INVOICE",
  POS: "NAV_POS",
  PURCHASE_ORDER: "NAV_PURCHASE_ORDER",
  SUPPLIER_MASTER: "NAV_SUPPLIER_MASTER",
  FINANCIAL_LEDGER: "NAV_FINANCIAL_LEDGER",
  CUSTOMERS: "NAV_CUSTOMERS",
  DASHBOARD: "NAV_DASHBOARD",
} as const;

export interface WorkspaceCapabilities {
  search?: boolean;
  create?: boolean;
  edit?: boolean;
  delete?: boolean;
  export?: boolean;
  import?: boolean;
  print?: boolean;
  dashboard?: boolean;
  reports?: boolean;
  mobile?: boolean;
  offline?: boolean;
}

export interface NavigationModuleDefinition {
  id: string;
  title: string;
  description?: string;
  icon: string;               // Lucide / Material Symbol name
  targetTab: string;
  workspaceId?: string;
  route?: string;
  badge?: string;
  permission?: string;
  category?: string;
  order?: number;
  visible?: boolean;
  featureFlag?: string;

  // Declarative Workspace Capabilities
  workspaceCapabilities?: WorkspaceCapabilities;

  // Marketplace & Dependency Metadata
  owner?: ModuleOwnerType;
  packageId?: string;
  version?: string;
  minimumKernelVersion?: string;
  dependsOn?: string[];       // Module / Engine dependencies
  tags?: string[];
  keywords?: string[];
}

export interface DomainDefinition {
  id: string;                 // e.g. "ALL", "sales", "inventory", "purchase", "accounting", "crm", "reports"
  label: string;              // e.g. "Sales & Billing Domain", "Inventory & Stock Domain"
  icon: string;               // Material Symbol name or Lucide icon identifier
  emoji: string;              // Visual emoji symbol
  order: number;              // Administrative / Metadata sort ordering
  moduleIds: string[];        // Module workspace IDs associated with this domain
  modules?: NavigationModuleDefinition[]; // Enriched declarative modules
  defaultWorkspaceId?: string;// Default landing workspace ID when selecting domain
  permission?: string;        // Optional RBAC permission scope requirement
  featureFlag?: string;       // Optional feature flag toggle requirement
}

export interface SidebarDefinition {
  domain: Readonly<DomainDefinition> | null;
  moduleIds: string[];
  allDomains: ReadonlyArray<Readonly<DomainDefinition>>;
}

export interface NavigationHealthReport {
  timestamp: number;
  status: NavigationHealthStatus;
  totalDomains: number;
  totalModules: number;
  marketplaceModules: number;
  hiddenModules: number;
  disabledModules: number;
  brokenRoutes: number;
  duplicateRoutes: number;
  orphanWorkspaces: number;
  versionConflicts: number;
  healthy: boolean;
}

export interface NavigationAnalytics {
  totalNavigations: number;
  moduleUsage: Record<string, number>;
  lastAccessed: Record<string, number>;
}

export class NavigationRegistryService {
  private domains: Map<string, Readonly<DomainDefinition>> = new Map();
  
  // O(1) Reverse Index Maps (NRA-001 Enterprise Performance SLA)
  private workspaceToDomainIndex: Map<string, string> = new Map();
  private routeToWorkspaceIndex: Map<string, string> = new Map();
  private moduleToWorkspaceIndex: Map<string, string> = new Map();
  
  // Navigation Analytics
  private analyticsData: NavigationAnalytics = {
    totalNavigations: 0,
    moduleUsage: {},
    lastAccessed: {}
  };

  private listeners: Set<(event?: { type: NavigationEventType; payload?: any }) => void> = new Set();

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
        moduleIds: ["pos", "sales", "sales-returns", "customers", "crm", "loyalty"],
        modules: [
          { id: NAV_IDS.POS, title: "Point of Sale", icon: "ShoppingCart", targetTab: "pos", workspaceId: "pos", route: "/sales/pos", badge: "Live", order: 1, visible: true, owner: "SMRITI", packageId: "smriti.sales.pos", version: "6.0.0", dependsOn: ["sales", "customers"], workspaceCapabilities: { search: true, create: true, print: true, mobile: true, offline: true } },
          { id: NAV_IDS.SALES_INVOICE, title: "Sales Invoices", icon: "Receipt", targetTab: "sales", workspaceId: "sales", route: "/sales/invoices", order: 2, visible: true, owner: "SMRITI", packageId: "smriti.sales.invoices", version: "6.0.0", dependsOn: ["customers"], workspaceCapabilities: { search: true, create: true, edit: true, export: true, print: true } },
          { id: "sales-returns", title: "Sales Returns", icon: "RotateCcw", targetTab: "sales-returns", workspaceId: "sales-returns", route: "/sales/returns", order: 3, visible: true, owner: "SMRITI", packageId: "smriti.sales.returns", version: "6.0.0", dependsOn: ["sales"] },
          { id: NAV_IDS.CUSTOMERS, title: "Customer CRM", icon: "Users", targetTab: "customers", workspaceId: "customers", route: "/sales/customers", order: 4, visible: true, owner: "SMRITI", packageId: "smriti.crm.customers", version: "6.0.0" },
        ]
      },
      {
        id: "inventory",
        label: "Inventory & Stock Domain",
        icon: "inventory_2",
        emoji: "📦",
        order: 2,
        defaultWorkspaceId: "item-master",
        moduleIds: ["item-master", "stock-ledger", "consignment", "barcode", "print-studio", "universal-label-printer"],
        modules: [
          { id: NAV_IDS.ITEM_MASTER, title: "Product Master", icon: "Package", targetTab: "item-master", workspaceId: "item-master", route: "/inventory/items", order: 1, visible: true, owner: "SMRITI", packageId: "smriti.inventory.items", version: "6.0.0", workspaceCapabilities: { search: true, create: true, edit: true, delete: true, export: true, import: true } },
          { id: NAV_IDS.STOCK_LEDGER, title: "Stock Ledger", icon: "Layers", targetTab: "stock-ledger", workspaceId: "stock-ledger", route: "/inventory/ledger", order: 2, visible: true, owner: "SMRITI", packageId: "smriti.inventory.ledger", version: "6.0.0", dependsOn: ["item-master"], workspaceCapabilities: { search: true, export: true, reports: true } },
          { id: NAV_IDS.CONSIGNMENT, title: "Consignment Studio", icon: "Truck", targetTab: "consignment", workspaceId: "consignment", route: "/inventory/consignment", order: 3, visible: true, owner: "SMRITI", packageId: "smriti.inventory.consignment", version: "6.0.0", dependsOn: ["item-master"] },
          { id: NAV_IDS.PRINT_STUDIO, title: "Document Studio", icon: "Printer", targetTab: "document-studio", workspaceId: "document-studio", route: "/platform/document-studio", order: 5, visible: true, owner: "SMRITI", packageId: "smriti.platform.documentstudio", version: "6.0.0" },
          { id: "universal-label-printer", title: "Universal Label Printer", icon: "Printer", targetTab: "document-studio", workspaceId: "document-studio", route: "/platform/label-printer", order: 6, visible: true, owner: "SMRITI", packageId: "smriti.inventory.labelprinter", version: "6.0.0", dependsOn: ["document-studio"] },
        ]
      },
      {
        id: "purchase",
        label: "Purchase & Sourcing Domain",
        icon: "shopping_cart",
        emoji: "🛒",
        order: 3,
        defaultWorkspaceId: "purchase",
        moduleIds: ["purchase", "supplier-mgmt"],
        modules: [
          { id: NAV_IDS.PURCHASE_ORDER, title: "Procurement POs", icon: "Briefcase", targetTab: "purchase", workspaceId: "purchase", route: "/purchase/orders", order: 1, visible: true, owner: "SMRITI", packageId: "smriti.purchase.orders", version: "6.0.0", dependsOn: ["supplier-mgmt"], workspaceCapabilities: { search: true, create: true, edit: true, print: true } },
          { id: NAV_IDS.SUPPLIER_MASTER, title: "Supplier Registry", icon: "Building", targetTab: "supplier-mgmt", workspaceId: "supplier-mgmt", route: "/purchase/suppliers", order: 2, visible: true, owner: "SMRITI", packageId: "smriti.purchase.suppliers", version: "6.0.0" },
        ]
      },
      {
        id: "accounting",
        label: "Accounting & Finance Domain",
        icon: "account_balance",
        emoji: "💼",
        order: 4,
        defaultWorkspaceId: "ledger",
        moduleIds: ["ledger", "accounting-sync", "audit-logs"],
        modules: [
          { id: NAV_IDS.FINANCIAL_LEDGER, title: "Financial Ledger", icon: "DollarSign", targetTab: "ledger", workspaceId: "ledger", route: "/finance/ledger", order: 1, visible: true, owner: "SMRITI", packageId: "smriti.finance.ledger", version: "6.0.0", workspaceCapabilities: { search: true, export: true, print: true } },
          { id: "accounting-sync", title: "Tally Sync", icon: "RefreshCw", targetTab: "accounting-sync", workspaceId: "accounting-sync", route: "/finance/sync", order: 2, visible: true, owner: "SMRITI", packageId: "smriti.finance.tally", version: "6.0.0", dependsOn: ["ledger"] },
          { id: "audit-logs", title: "Audit Trail", icon: "ShieldCheck", targetTab: "audit-logs", workspaceId: "audit-logs", route: "/finance/audit", order: 3, visible: true, owner: "SMRITI", packageId: "smriti.finance.audit", version: "6.0.0" },
        ]
      },
      {
        id: "crm",
        label: "Customer CRM & Loyalty Domain",
        icon: "groups",
        emoji: "👥",
        order: 5,
        defaultWorkspaceId: "customers",
        moduleIds: ["customers", "loyalty"],
        modules: [
          { id: NAV_IDS.CUSTOMERS, title: "Customer CRM", icon: "Users", targetTab: "customers", workspaceId: "customers", route: "/crm/accounts", order: 1, visible: true, owner: "SMRITI", packageId: "smriti.crm.accounts", version: "6.0.0" },
          { id: "loyalty", title: "Loyalty Programs", icon: "Sparkles", targetTab: "loyalty", workspaceId: "loyalty", route: "/crm/loyalty", order: 2, visible: true, owner: "SMRITI", packageId: "smriti.crm.loyalty", version: "6.0.0", dependsOn: ["customers"] },
        ]
      },
      {
        id: "reports",
        label: "Analytics & Reports Domain",
        icon: "analytics",
        emoji: "📊",
        order: 6,
        defaultWorkspaceId: "dashboard",
        moduleIds: ["dashboard", "reports"],
        modules: [
          { id: NAV_IDS.DASHBOARD, title: "Executive Dashboard", icon: "TrendingUp", targetTab: "dashboard", workspaceId: "dashboard", route: "/analytics/dashboard", order: 1, visible: true, owner: "SMRITI", packageId: "smriti.analytics.dashboard", version: "6.0.0", workspaceCapabilities: { search: true, dashboard: true, reports: true } },
          { id: "reports", title: "Daily Summaries", icon: "FileText", targetTab: "reports", workspaceId: "reports", route: "/analytics/summaries", order: 2, visible: true, owner: "SMRITI", packageId: "smriti.analytics.summaries", version: "6.0.0" },
        ]
      }
    ];

    defaults.forEach((d) => this.registerDomain(d));
  }

  public registerDomain(domain: DomainDefinition): void {
    const payload = Object.freeze({ ...domain, id: domain.id.toLowerCase() });
    this.domains.set(payload.id, payload);

    // Populate O(1) Index Maps for instant lookup
    (payload.moduleIds || []).forEach((mId) => {
      this.workspaceToDomainIndex.set(mId.toLowerCase(), payload.id);
      this.moduleToWorkspaceIndex.set(mId.toLowerCase(), mId);
    });

    (payload.modules || []).forEach((m) => {
      this.workspaceToDomainIndex.set(m.id.toLowerCase(), payload.id);
      this.moduleToWorkspaceIndex.set(m.id.toLowerCase(), m.workspaceId || m.targetTab || m.id);
      if (m.targetTab) this.workspaceToDomainIndex.set(m.targetTab.toLowerCase(), payload.id);
      if (m.workspaceId) this.workspaceToDomainIndex.set(m.workspaceId.toLowerCase(), payload.id);
      if (m.route) {
        this.routeToWorkspaceIndex.set(m.route.toLowerCase(), m.workspaceId || m.targetTab || m.id);
      }
    });

    this.emitChange("ModuleRegistered", { domainId: payload.id });
  }

  public getDomains(evaluator?: (permissionCode?: string) => boolean): ReadonlyArray<Readonly<DomainDefinition>> {
    const list = Array.from(this.domains.values()).sort((a, b) => a.order - b.order);
    if (!evaluator) return list;

    return list
      .filter((d) => !d.permission || evaluator(d.permission))
      .map((d) => ({
        ...d,
        modules: d.modules ? d.modules.filter((m) => !m.permission || evaluator(m.permission)) : d.modules,
        moduleIds: d.modules
          ? d.modules.filter((m) => !m.permission || evaluator(m.permission)).map((m) => m.id)
          : d.moduleIds,
      }));
  }

  public getDomain(id: string): Readonly<DomainDefinition> | undefined {
    if (!id) return undefined;
    return this.domains.get(id.toLowerCase());
  }

  /**
   * Fast O(1) Workspace-to-Domain Index Lookup
   */
  public getDomainForWorkspace(workspaceId: string): Readonly<DomainDefinition> | undefined {
    if (!workspaceId) return undefined;
    const domainId = this.workspaceToDomainIndex.get(workspaceId.toLowerCase());
    return domainId ? this.domains.get(domainId) : undefined;
  }

  /**
   * Fast O(1) Route-to-Workspace Lookup
   */
  public getWorkspaceForRoute(route: string): string | undefined {
    if (!route) return undefined;
    return this.routeToWorkspaceIndex.get(route.toLowerCase());
  }

  /**
   * Registry-Driven Breadcrumb Generator (NRA-001)
   */
  public getBreadcrumbForWorkspace(workspaceId: string, itemRecordId?: string): string[] {
    const domain = this.getDomainForWorkspace(workspaceId);
    const domainLabel = domain?.label.split(" ")[0] || "Home";
    const workspaceLabel = workspaceId.replace(/-/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());

    const crumbs = ["Home", domainLabel, workspaceLabel];
    if (itemRecordId) {
      crumbs.push(itemRecordId);
    }
    return crumbs;
  }

  public recordNavigation(workspaceId: string): void {
    if (!workspaceId) return;
    const key = workspaceId.toLowerCase();
    this.analyticsData.totalNavigations++;
    this.analyticsData.moduleUsage[key] = (this.analyticsData.moduleUsage[key] || 0) + 1;
    this.analyticsData.lastAccessed[key] = Date.now();
    this.emitChange("WorkspaceChanged", { workspaceId });
  }

  public getAnalytics(): Readonly<NavigationAnalytics> {
    return Object.freeze({
      totalNavigations: this.analyticsData.totalNavigations,
      moduleUsage: { ...this.analyticsData.moduleUsage },
      lastAccessed: { ...this.analyticsData.lastAccessed }
    });
  }

  public getModuleIdsForDomain(domainId: string, evaluator?: (permissionCode?: string) => boolean): string[] {
    if (!domainId || domainId.toUpperCase() === "ALL") {
      return [];
    }
    const def = this.domains.get(domainId.toLowerCase());
    if (!def) return [];
    const validModules = def.modules
      ? def.modules.filter((m) => !evaluator || !m.permission || evaluator(m.permission))
      : [];
    return validModules.length > 0 ? validModules.map((m) => m.id) : [...def.moduleIds];
  }

  public getSidebar(activeDomainId: string, evaluator?: (permissionCode?: string) => boolean): SidebarDefinition {
    const dom = this.getDomain(activeDomainId) || null;
    const moduleIds = this.getModuleIdsForDomain(activeDomainId, evaluator);
    const allDomains = this.getDomains(evaluator);

    const filteredDomain = dom && evaluator && dom.permission && !evaluator(dom.permission) ? null : dom;
    if (filteredDomain && filteredDomain.modules && evaluator) {
      const filteredModules = filteredDomain.modules.filter((m) => !m.permission || evaluator(m.permission));
      return {
        domain: { ...filteredDomain, modules: filteredModules, moduleIds: filteredModules.map((m) => m.id) },
        moduleIds: filteredModules.map((m) => m.id),
        allDomains,
      };
    }

    return {
      domain: filteredDomain,
      moduleIds,
      allDomains,
    };
  }

  /**
   * Universal Platform Navigation Health & Diagnostic Scanner (NCS-001 SLA)
   */
  public health(): NavigationHealthReport {
    let totalModules = 0;
    let marketplaceModules = 0;
    let hiddenModules = 0;
    let disabledModules = 0;
    const routesSeen = new Set<string>();
    let duplicateRoutes = 0;

    for (const dom of this.domains.values()) {
      const mods = dom.modules || [];
      totalModules += mods.length;

      mods.forEach((m) => {
        if (m.owner === "Marketplace" || m.owner === "Partner") marketplaceModules++;
        if (m.visible === false) hiddenModules++;
        if (m.featureFlag === "disabled") disabledModules++;
        if (m.route) {
          if (routesSeen.has(m.route)) duplicateRoutes++;
          else routesSeen.add(m.route);
        }
      });
    }

    const status: NavigationHealthStatus = duplicateRoutes > 0 ? "ERROR" : "HEALTHY";

    return {
      timestamp: Date.now(),
      status,
      totalDomains: this.domains.size,
      totalModules,
      marketplaceModules,
      hiddenModules,
      disabledModules,
      brokenRoutes: 0,
      duplicateRoutes,
      orphanWorkspaces: 0,
      versionConflicts: 0,
      healthy: status === "HEALTHY"
    };
  }

  public subscribe(listener: (event?: { type: NavigationEventType; payload?: any }) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public clear(): void {
    this.domains.clear();
    this.workspaceToDomainIndex.clear();
    this.routeToWorkspaceIndex.clear();
    this.moduleToWorkspaceIndex.clear();
    this.seedDefaultDomains();
    this.emitChange("DomainChanged");
  }

  private emitChange(type: NavigationEventType = "DomainChanged", payload?: any): void {
    this.listeners.forEach((listener) => {
      try { listener({ type, payload }); } catch { /* ignore individual listener errors */ }
    });
  }
}

export const NavigationRegistry = new NavigationRegistryService();
