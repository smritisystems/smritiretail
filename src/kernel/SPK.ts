/**
 * Project      : SMRITI Application Platform (SMAP) v1.0
 * Component    : SMRITI Platform Kernel (SPK) Master Singleton
 * Standard     : SMAP Constitution v1.0 (FROZEN) — Level 1 Core Execution Kernel
 * Author       : Jawahar Ramkripal Mallah
 * License      : Proprietary Commercial Software
 */

import logger from "../core/logging/logger.js";
import { WindowManager } from "../sdk/WindowManager.js";
import { NavigationRegistry, DomainDefinition, NAV_IDS } from "./upr/navigation/NavigationRegistry.js";
import { EntityRegistry, EntityMetadata } from "./upr/forms/EntityRegistry.js";
import { FormRegistry, FormDefinition } from "./upr/forms/FormRegistry.js";
import { FieldRegistry, FieldControlComponent } from "./upr/forms/FieldRegistry.js";
import { ValidationRegistry, ValidatorDefinition, ValidationContext } from "./upr/forms/ValidationRegistry.js";
import { LayoutRegistry, LayoutDefinition } from "./upr/forms/LayoutRegistry.js";
import { PermissionRegistry, PermissionDefinition } from "./upr/security/PermissionRegistry.js";
import { RoleRegistry, RoleDefinition } from "./upr/security/RoleRegistry.js";
import { LicenseRegistry, LicenseMetadata } from "./upr/security/LicenseRegistry.js";
import { PolicyRegistry, PolicyDefinition, SecurityEvaluationContext } from "./upr/security/PolicyRegistry.js";
import { TenantRegistry, TenantDefinition } from "./upr/security/TenantRegistry.js";
import { AuditRegistry, SecurityAuditEvent } from "./upr/security/AuditRegistry.js";
import { PlatformContext, createPlatformContext } from "./context/PlatformContext.js";
import { BrandingRegistry, BrandingDefinition } from "./upr/configuration/BrandingRegistry.js";
import { RegionalRegistry, RegionalConfig } from "./upr/configuration/RegionalRegistry.js";
import { PreferenceRegistry, PreferenceScope } from "./upr/configuration/PreferenceRegistry.js";
import { EnvironmentRegistry, EnvironmentConfig } from "./upr/configuration/EnvironmentRegistry.js";
import { WorkflowRegistry, WorkflowDefinition, WorkflowState } from "./upr/workflow/WorkflowRegistry.js";
import { ReportRegistry, ReportDefinition, ReportCategory } from "./upr/reports/ReportRegistry.js";
import { PrintRegistry, PrintTemplateDefinition } from "./upr/printing/PrintRegistry.js";
import { DashboardRegistry, DashboardDefinition } from "./upr/dashboard/DashboardRegistry.js";
import { AIRegistry, AISkillDefinition } from "./upr/ai/AIRegistry.js";
import { SearchRegistry } from "./upr/search/SearchRegistry.js";
import { ISearchProvider, ISearchQuery, ISearchResult, SearchManifest, SavedViewDefinition } from "./public/ISearchService.js";
import { posDomainService } from "../domains/pos/POSDomainService.js";
import { salesDomainService } from "../domains/sales/SalesDomainService.js";
import { inventoryDomainService } from "../domains/inventory/InventoryDomainService.js";
import { UCIFKernel } from "./upr/context/UCIFKernel.js";
import { UDCPKernel } from "./upr/discovery/UDCPKernel.js";
import { UDCPEventBus } from "./upr/discovery/UDCPEventBus.js";
import type {
  DiscoveryResult, DiscoveryContext, IDiscoveryProvider,
  VocabularyProvider, UDCPEventType, UDCPEventSubscriber,
} from "./upr/discovery/UDCPSchema.js";
import type {
  InspectorConfig, InspectorSectionDef, InspectorVariant,
  InspectorLifecycleEvent, LifecycleSubscriber,
  FieldContext, ResolvedContext,
  IInspectorDataProvider, IContextResolver, IEntityResolver,
} from "./upr/context/InspectorSchema.js";

/* ── Kernel Interfaces ── */

export interface ITenantContext {
  tenantId: string;
  companyId: string;
  branchId: string;
  storeId: string;
  userId: string;
  userName: string;
  userRole: string;
  currency: string;
  timezone: string;
}

export interface SecurityDecision {
  allowed: boolean;
  permissionId: string;
  roleId: string;
  userId: string;
  tenantId: string;
  featureId?: string;
  policyId?: string;
  reason: string;
}

export interface ICommand<TResult = any> {
  type: string;
  payload: any;
}

export interface ICommandHandler<TCommand extends ICommand = any, TResult = any> {
  execute(command: TCommand, context: ITenantContext): Promise<TResult>;
}

export interface IDomainEvent<T = any> {
  eventType: string;
  entityId: string;
  payload: T;
  timestamp: string;
}

export interface IModuleMetadata {
  id: string;
  name: string;
  version: string;
  routes: string[];
  services: string[];
}

export type ProviderLifecycleState = "REGISTERED" | "VALIDATED" | "ACTIVE" | "DISABLED" | "DEPRECATED" | "REMOVED";

export interface LookupBadge {
  label: string;
  type?: "info" | "success" | "warning" | "error";
}

export interface NormalizedLookupItem {
  id: string;
  title?: string;
  subtitle?: string;
  badge?: string | LookupBadge;
  icon?: string;
  tags?: string[];
  columns?: Record<string, any>;
  actions?: Array<{ id: string; label: string; icon?: string; permission?: string }>;
  metadata: Record<string, any>;
}

export interface ILookupItem extends NormalizedLookupItem {
  code: string;
  name: string;
  type: string;
}

export interface LookupCategoryDefinition {
  id: string;
  label: string;
  icon?: string;
}

export interface LookupFilterFieldSchema {
  key: string;
  label: string;
  type: "text" | "select" | "number_range" | "date_range" | "boolean";
  options?: Array<{ label: string; value: any }>;
  defaultValue?: any;
}

export interface PlatformSavedView {
  id: string;
  name: string;
  description?: string;
  createdBy: string;
  createdOn: string;
  updatedOn?: string;
  owner: string;            // User ID or "SYSTEM"
  shared: boolean;          // Organization-wide shared view
  organizationId?: string;
  filters: Record<string, any>;
  columns?: string[];
  layout?: string;
  permissions?: string[];
}

export interface LookupCapabilities {
  barcode: boolean;
  qr: boolean;
  voice: boolean;
  ai: boolean;
  bulkSelection: boolean;
  quickCreate: boolean;
}

export interface LookupManifest {
  manifestVersion: string;
  schemaVersion: string;
  minimumKernelVersion: string;
  domain: string;
  title: string;
  icon: string;
  defaultColumns: Array<{ key: string; label: string; type: string; width?: string }>;
  searchFields: string[];
  filterGroups: Array<{ id: string; label: string; fields: LookupFilterFieldSchema[] }>;
  sortOptions: Array<{ label: string; key: string; order: "asc" | "desc" }>;
  savedViews: PlatformSavedView[];
  permissions: {
    readScope: string;
    createScope?: string;
    editScope?: string;
    costScope?: string; // Scope required to unmask cost price & margins
  };
  quickActions: Array<{ id: string; label: string; icon: string; permission?: string; shortcut?: string }>;
  keyboardShortcuts: Record<string, string>;
  defaultLayout: "table" | "gallery" | "card" | "tree" | "kanban";
  supportedModes: Array<"field" | "grid" | "workspace" | "global">;
  
  // Business Capability Flags
  capabilities: LookupCapabilities;
}

export interface ILookupAdvancedQuery {
  domain: string;
  query: string;
  category?: string;
  filters?: Record<string, any>;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  limit?: number;
  offset?: number;
  cursor?: string;
}

export interface ILookupSearchResult<T = NormalizedLookupItem> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
  nextCursor?: string;
  hasMore: boolean;
  executionTimeMs: number;
}

export interface ILookupProvider {
  domain: string;
  manifest?: LookupManifest;
  state?: ProviderLifecycleState;
  search(query: string): Promise<ILookupItem[]>;
  getById(id: string): Promise<ILookupItem | null>;
  searchAdvanced?(query: ILookupAdvancedQuery): Promise<ILookupSearchResult>;
}

export type EventCallback = (event: IDomainEvent) => void;

/* ── SMRITI Platform Kernel (SPK) Singleton Class ── */

export class SMRITIPlatformKernel {
  private static instance: SMRITIPlatformKernel | null = null;
  private isStarted = false;

  /* Universal Platform Registry (UPR) Caches */
  private servicesRegistry = new Map<string, any>();
  private modulesRegistry = new Map<string, IModuleMetadata>();
  private commandHandlers = new Map<string, ICommandHandler>();
  private eventSubscribers = new Map<string, Set<EventCallback>>();
  private lookupProviders = new Map<string, ILookupProvider>();

  /* Default Execution Context */
  public context: ITenantContext = {
    tenantId: "TENANT-001",
    companyId: "COMP-001",
    branchId: "BRANCH-001",
    storeId: "STORE-001",
    userId: "USER-101",
    userName: "System Operator",
    userRole: "SYSADMIN",
    currency: "INR",
    timezone: "Asia/Kolkata"
  };

  /* Configuration Framework */
  public config = {
    apiBaseUrl: "/api/v1",
    databaseProvider: "postgres",
    cacheEnabled: true,
    offlineMode: true,
    features: {
      inventory: true,
      pos: true,
      barcode: true,
      purchase: true,
      sales: true,
      ai: true,
      crm: true
    }
  };

  /* Platform Kernel Versioning (Recommendation #1) */
  public version = (): Record<string, string> => ({
    platform: "6.0.0",
    upr: "3.1.0",
    ucif: "1.1.0",
    udcp: "1.0.0",
    security: "1.0.0",
    workflow: "1.0.0",
    reports: "1.0.0",
    printing: "1.0.0",
    dashboard: "1.0.0",
    ai: "1.0.0",
    sdk: "2.0.0",
    api: "1.8.0",
  });

  /* Kernel Health Dashboard (Recommendation #2) */
  public health = (): Record<string, "Healthy" | "Degraded" | "Offline"> => ({
    UPR: "Healthy",
    UCIF: "Healthy",
    UDCP: "Healthy",
    Security: "Healthy",
    Workflow: "Healthy",
    Reports: "Healthy",
    Printing: "Healthy",
    Dashboard: "Healthy",
    AI: "Healthy",
    Domains: "Healthy",
    Search: "Healthy",
  });

  /* Plugin Diagnostics (Recommendation #3) */
  public plugins = (): Array<{ id: string; name: string; status: string; sdkVersion: string }> => [
    { id: "pack.footwear", name: "Footwear & Apparel Pack", status: "Loaded", sdkVersion: "2.0.0" },
    { id: "pack.pharmacy", name: "Pharmacy & Medical Pack", status: "Loaded", sdkVersion: "2.0.0" },
    { id: "pack.jewellery", name: "Jewellery & Bullion Pack", status: "Loaded", sdkVersion: "2.0.0" },
    { id: "pack.restaurant", name: "Restaurant & F&B Pack", status: "Loaded", sdkVersion: "2.0.0" },
  ];

  private constructor() {}

  public static getInstance(): SMRITIPlatformKernel {
    if (!SMRITIPlatformKernel.instance) {
      SMRITIPlatformKernel.instance = new SMRITIPlatformKernel();
    }
    return SMRITIPlatformKernel.instance;
  }

  /* ── Kernel Lifecycle Methods ── */
  public async start(): Promise<void> {
    if (this.isStarted) return;
    logger.info("[SPK Kernel v1.0] Starting SMRITI Platform Kernel (SPK)...");
    this.isStarted = true;
    logger.info("[SPK Kernel v1.0] Ready & Running under SMAP Constitution v1.0.");
  }

  public shutdown(): void {
    this.servicesRegistry.clear();
    this.modulesRegistry.clear();
    this.commandHandlers.clear();
    this.eventSubscribers.clear();
    this.lookupProviders.clear();
    this.isStarted = false;
    logger.info("[SPK Kernel v1.0] Kernel session cleanly shut down.");
  }

  /* ── Service Registry (SPK.services) ── */
  public services = {
    register: <T>(serviceId: string, instance: T): void => {
      this.servicesRegistry.set(serviceId.toUpperCase(), instance);
      logger.debug(`[SPK Service Registry] Service registered: ${serviceId.toUpperCase()}`);
    },
    resolve: <T>(serviceId: string): T => {
      const found = this.servicesRegistry.get(serviceId.toUpperCase());
      if (!found) {
        throw new Error(`[SPK Error] Unregistered Kernel Service requested: '${serviceId}'`);
      }
      return found as T;
    },
    has: (serviceId: string): boolean => {
      return this.servicesRegistry.has(serviceId.toUpperCase());
    }
  };

  /* ── Module Registry (SPK.modules) ── */
  public modules = {
    register: (manifest: IModuleMetadata): void => {
      this.modulesRegistry.set(manifest.id, manifest);
      logger.debug(`[SPK Module Registry] Module registered: ${manifest.name} (v${manifest.version})`);
    },
    get: (id: string): IModuleMetadata | undefined => {
      return this.modulesRegistry.get(id);
    },
    getAll: (): IModuleMetadata[] => {
      return Array.from(this.modulesRegistry.values());
    }
  };

  /* ── Command Bus (SPK.commands) ── */
  public commands = {
    registerHandler: (commandType: string, handler: ICommandHandler): void => {
      this.commandHandlers.set(commandType, handler);
    },
    execute: async <TResult = any>(command: ICommand): Promise<TResult> => {
      const handler = this.commandHandlers.get(command.type);
      if (!handler) {
        throw new Error(`[SPK Command Error] No handler registered for command: '${command.type}'`);
      }
      logger.debug(`[SPK CommandBus] Executing command: ${command.type}`);
      return await handler.execute(command, this.context);
    }
  };

  /* ── Event Bus (SPK.events) ── */
  public events = {
    subscribe: (eventType: string, callback: EventCallback): () => void => {
      if (!this.eventSubscribers.has(eventType)) {
        this.eventSubscribers.set(eventType, new Set());
      }
      this.eventSubscribers.get(eventType)!.add(callback);
      return () => {
        this.eventSubscribers.get(eventType)?.delete(callback);
      };
    },
    on: (eventType: string, callback: EventCallback): () => void => {
      return this.events.subscribe(eventType, callback);
    },
    emit: (eventType: string, entityId: string, payload: any): void => {
      const event: IDomainEvent = {
        eventType,
        entityId,
        payload,
        timestamp: new Date().toISOString()
      };
      logger.debug(`[SPK EventBus] Emitting event: ${eventType} (${entityId})`);

      const subscribers = this.eventSubscribers.get(eventType);
      if (subscribers) {
        subscribers.forEach((cb) => {
          try { cb(event); } catch (e) { logger.error(`[SPK Event Error] ${e}`); }
        });
      }

      // Broadcast SAWF cross-window notification
      try {
        WindowManager.broadcast("REFRESH_SYSTEM_STATE", "SPK_KERNEL", { eventType, entityId, payload });
      } catch {
        /* window manager non-browser fallback */
      }
    }
  };

  /* Universal Lookup Engine Caches */
  private ulePlatformSavedViews = new Map<string, PlatformSavedView[]>();
  private uleHistory: Array<{ query: string; domain: string; timestamp: number }> = [];

  /* ── Universal Lookup Engine (SPK.ule — Level 1 Data Discovery Platform) ── */
  public ule = {
    registerProvider: (provider: ILookupProvider): void => {
      const key = provider.domain.toUpperCase();
      const instance = { ...provider, state: provider.state || "ACTIVE" };
      this.lookupProviders.set(key, instance);
      if (provider.manifest?.savedViews) {
        this.ulePlatformSavedViews.set(key, [...provider.manifest.savedViews]);
      }
      logger.debug(`[SPK ULE] Lookup Provider registered for domain: ${key} (state: ${instance.state})`);
    },
    getProvider: (domain: string): ILookupProvider | undefined => {
      return this.lookupProviders.get(domain.toUpperCase());
    },
    setProviderState: (domain: string, state: ProviderLifecycleState): boolean => {
      const provider = this.lookupProviders.get(domain.toUpperCase());
      if (!provider) return false;
      provider.state = state;
      logger.info(`[SPK ULE] Provider state updated: ${domain.toUpperCase()} -> ${state}`);
      return true;
    },
    getManifest: (domain: string): LookupManifest | undefined => {
      const provider = this.lookupProviders.get(domain.toUpperCase());
      if (provider?.state === "DISABLED" || provider?.state === "REMOVED") return undefined;
      return provider?.manifest;
    },
    search: async (domain: string, query: string): Promise<ILookupItem[]> => {
      const provider = this.lookupProviders.get(domain.toUpperCase());
      if (!provider || provider.state === "DISABLED" || provider.state === "REMOVED") return [];

      // RBAC Scope Check
      if (provider.manifest?.permissions?.readScope) {
        const decision = this.security.evaluateAccess(
          this.context.userId,
          this.context.userRole,
          provider.manifest.permissions.readScope
        );
        if (!decision.allowed) {
          logger.warn(`[SPK ULE Security] Access denied for domain '${domain}' to user '${this.context.userId}'`);
          return [];
        }
      }

      if (query) {
        this.recordUleHistory(query, domain);
      }

      const rawItems = await provider.search(query);
      return this.applyFieldMasking(domain, rawItems);
    },
    searchAdvanced: async (queryObj: ILookupAdvancedQuery): Promise<ILookupSearchResult> => {
      const startTime = performance.now();
      const domainKey = queryObj.domain.toUpperCase();
      const provider = this.lookupProviders.get(domainKey);

      if (!provider || provider.state === "DISABLED" || provider.state === "REMOVED") {
        return { items: [], totalCount: 0, page: 1, pageSize: 20, hasMore: false, executionTimeMs: 0 };
      }

      // RBAC Scope Check
      if (provider.manifest?.permissions?.readScope) {
        const decision = this.security.evaluateAccess(
          this.context.userId,
          this.context.userRole,
          provider.manifest.permissions.readScope
        );
        if (!decision.allowed) {
          logger.warn(`[SPK ULE Security] Access denied for domain '${queryObj.domain}' to user '${this.context.userId}'`);
          return { items: [], totalCount: 0, page: 1, pageSize: 20, hasMore: false, executionTimeMs: Math.round(performance.now() - startTime) };
        }
      }

      if (queryObj.query) {
        this.recordUleHistory(queryObj.query, queryObj.domain);
      }

      const limit = queryObj.limit || 20;
      const offset = queryObj.offset || 0;
      const page = Math.floor(offset / limit) + 1;

      if (provider.searchAdvanced) {
        const res = await provider.searchAdvanced(queryObj);
        const maskedItems = this.applyFieldMasking(queryObj.domain, res.items);
        return {
          ...res,
          items: maskedItems,
          page: res.page || page,
          pageSize: res.pageSize || limit,
          hasMore: res.hasMore ?? (offset + maskedItems.length < res.totalCount),
          executionTimeMs: Math.round(performance.now() - startTime),
        };
      }

      const rawItems = await provider.search(queryObj.query);
      const maskedItems = this.applyFieldMasking(queryObj.domain, rawItems);
      const paginatedItems = maskedItems.slice(offset, offset + limit);
      const hasMore = offset + paginatedItems.length < maskedItems.length;

      return {
        items: paginatedItems,
        totalCount: maskedItems.length,
        page,
        pageSize: limit,
        hasMore,
        executionTimeMs: Math.round(performance.now() - startTime),
      };
    },
    getSavedViews: (domain: string): PlatformSavedView[] => {
      return this.ulePlatformSavedViews.get(domain.toUpperCase()) || [];
    },
    saveView: (domain: string, view: PlatformSavedView): void => {
      const key = domain.toUpperCase();
      const existing = this.ulePlatformSavedViews.get(key) || [];
      const updated = [...existing.filter((v) => v.id !== view.id), view];
      this.ulePlatformSavedViews.set(key, updated);
    },
    getHistory: (domain?: string): Array<{ query: string; domain: string; timestamp: number }> => {
      if (!domain) return this.uleHistory;
      return this.uleHistory.filter((h) => h.domain.toUpperCase() === domain.toUpperCase());
    }
  };

  /** RBAC Field Masking — strips financial cost fields if role lacks costScope */
  private applyFieldMasking<T extends NormalizedLookupItem | ILookupItem>(domain: string, items: T[]): T[] {
    const provider = this.lookupProviders.get(domain.toUpperCase());
    const costScope = provider?.manifest?.permissions?.costScope;

    if (!costScope) return items;

    const decision = this.security.evaluateAccess(
      this.context.userId,
      this.context.userRole,
      costScope
    );

    if (decision.allowed) return items;

    // Mask financial cost fields
    return items.map((item) => {
      const clone = { ...item, metadata: { ...item.metadata }, columns: { ...item.columns } };
      delete clone.metadata.purchase_price;
      delete clone.metadata.costPrice;
      delete clone.metadata.buyingRate;
      delete clone.metadata.margin;
      if (clone.columns) {
        delete clone.columns.purchasePrice;
        delete clone.columns.costPrice;
        delete clone.columns.margin;
      }
      return clone;
    });
  }

  private recordUleHistory(query: string, domain: string): void {
    this.uleHistory = [
      { query, domain: domain.toUpperCase(), timestamp: Date.now() },
      ...this.uleHistory.filter((h) => h.query !== query).slice(0, 24),
    ];
  }

  /* ── Universal Navigation Registry Facade (SPK.navigation) ── */
  public navigation = {
    NAV_IDS,
    getDomains: () => NavigationRegistry.getDomains(),
    getDomain: (id: string) => NavigationRegistry.getDomain(id),
    getDomainForWorkspace: (workspaceId: string) => NavigationRegistry.getDomainForWorkspace(workspaceId),
    getWorkspaceForRoute: (route: string) => NavigationRegistry.getWorkspaceForRoute(route),
    getBreadcrumbForWorkspace: (workspaceId: string, itemRecordId?: string) => NavigationRegistry.getBreadcrumbForWorkspace(workspaceId, itemRecordId),
    getModuleIdsForDomain: (domainId: string) => NavigationRegistry.getModuleIdsForDomain(domainId),
    getSidebar: (activeDomainId: string) => NavigationRegistry.getSidebar(activeDomainId),
    registerDomain: (domain: DomainDefinition) => NavigationRegistry.registerDomain(domain),
    recordNavigation: (workspaceId: string) => NavigationRegistry.recordNavigation(workspaceId),
    getAnalytics: () => NavigationRegistry.getAnalytics(),
    health: () => NavigationRegistry.health(),
    subscribe: (listener: (event?: any) => void) => NavigationRegistry.subscribe(listener)
  };

  /* ── Universal Form Registry Facade (SPK.forms / UFR-001) ── */
  public forms = {
    getForm: (id: string) => FormRegistry.getForm(id),
    getForms: () => FormRegistry.getForms(),
    registerForm: (form: FormDefinition) => FormRegistry.registerForm(form),
    validateForm: (formId: string, values: Record<string, any>) => FormRegistry.validateForm(formId, values),
    subscribe: (listener: () => void) => FormRegistry.subscribe(listener)
  };

  /* ── Universal Entity Definition Framework Facade (SPK.entities / UEDF) ── */
  public entities = {
    getEntity: (id: string) => EntityRegistry.getEntity(id),
    getEntities: () => EntityRegistry.getEntities(),
    registerEntity: (entity: EntityMetadata) => EntityRegistry.registerEntity(entity),
    subscribe: (listener: () => void) => EntityRegistry.subscribe(listener)
  };

  /* ── Universal Field Registry Facade (SPK.fields / UFR-003) ── */
  public fields = {
    getFieldControl: (type: string) => FieldRegistry.getFieldControl(type),
    getRegisteredTypes: () => FieldRegistry.getRegisteredTypes(),
    registerFieldControl: (type: string, component: FieldControlComponent) => FieldRegistry.registerFieldControl(type, component),
    subscribe: (listener: () => void) => FieldRegistry.subscribe(listener)
  };

  /* ── Universal Validation Registry Facade (SPK.validation / UFR-004) ── */
  public validation = {
    getValidator: (id: string) => ValidationRegistry.getValidator(id),
    getValidators: () => ValidationRegistry.getValidators(),
    validateField: (validatorId: string, context: ValidationContext) => ValidationRegistry.validateField(validatorId, context),
    registerValidator: (validator: ValidatorDefinition) => ValidationRegistry.registerValidator(validator),
    subscribe: (listener: () => void) => ValidationRegistry.subscribe(listener)
  };

  /* ── Universal Layout Registry Facade (SPK.layouts / UFR-005) ── */
  public layouts = {
    getLayout: (id: string) => LayoutRegistry.getLayout(id),
    getLayouts: () => LayoutRegistry.getLayouts(),
    resolveGridClass: (span?: number, layoutId?: string) => LayoutRegistry.resolveGridClass(span, layoutId),
    registerLayout: (layout: LayoutDefinition) => LayoutRegistry.registerLayout(layout),
    subscribe: (listener: () => void) => LayoutRegistry.subscribe(listener)
  };

  /* ── Universal Security Registry Facade (SPK.security / USR) ── */
  public security = {
    permissions: {
      getPermission: (id: string) => PermissionRegistry.getPermission(id),
      getPermissions: () => PermissionRegistry.getPermissions(),
      getPermissionsByDomain: (domainId: string) => PermissionRegistry.getPermissionsByDomain(domainId),
      registerPermission: (permission: PermissionDefinition) => PermissionRegistry.registerPermission(permission),
      subscribe: (listener: () => void) => PermissionRegistry.subscribe(listener)
    },
    roles: {
      getRole: (id: string) => RoleRegistry.getRole(id),
      getRoles: () => RoleRegistry.getRoles(),
      getEffectivePermissions: (roleId: string) => RoleRegistry.getEffectivePermissions(roleId),
      hasPermission: (roleId: string, permissionId: string) => RoleRegistry.hasPermission(roleId, permissionId),
      registerRole: (role: RoleDefinition) => RoleRegistry.registerRole(role),
      subscribe: (listener: () => void) => RoleRegistry.subscribe(listener)
    },
    policies: {
      getPolicy: (id: string) => PolicyRegistry.getPolicy(id),
      getPolicies: () => PolicyRegistry.getPolicies(),
      evaluatePolicy: (policyId: string, context: SecurityEvaluationContext, attrValues?: Record<string, any>) =>
        PolicyRegistry.evaluatePolicy(policyId, context, attrValues),
      registerPolicy: (policy: PolicyDefinition) => PolicyRegistry.registerPolicy(policy),
      subscribe: (listener: () => void) => PolicyRegistry.subscribe(listener)
    },
    licenses: {
      getLicense: () => LicenseRegistry.getLicense(),
      isFeatureEnabled: (featureId: string) => LicenseRegistry.isFeatureEnabled(featureId),
      getFeatures: () => LicenseRegistry.getFeatures(),
      subscribe: (listener: () => void) => LicenseRegistry.subscribe(listener)
    },
    tenants: {
      getTenant: (id: string) => TenantRegistry.getTenant(id),
      getActiveTenant: () => TenantRegistry.getActiveTenant(),
      setActiveTenant: (id: string) => TenantRegistry.setActiveTenant(id),
      getTenants: () => TenantRegistry.getTenants(),
      registerTenant: (tenant: TenantDefinition) => TenantRegistry.registerTenant(tenant),
      subscribe: (listener: () => void) => TenantRegistry.subscribe(listener)
    },
    audit: {
      logEvent: (event: Omit<SecurityAuditEvent, "id" | "timestamp">) => AuditRegistry.logEvent(event),
      getAuditLogs: () => AuditRegistry.getAuditLogs(),
      getAuditLogsByUser: (userId: string) => AuditRegistry.getAuditLogsByUser(userId),
      subscribe: (listener: () => void) => AuditRegistry.subscribe(listener)
    },
    evaluateAccess: (
      userId: string,
      roleId: string,
      permissionId: string,
      featureId?: string,
      attributes?: Record<string, any>
    ): SecurityDecision => {
      const activeTenant = TenantRegistry.getActiveTenant();
      const tenantId = activeTenant ? activeTenant.tenantId : "smriti-default";

      // 1. License Check
      if (featureId && !LicenseRegistry.isFeatureEnabled(featureId)) {
        const reason = `Feature '${featureId}' is disabled under current enterprise license edition.`;
        AuditRegistry.logEvent({ userId, roleId, action: "evaluateAccess", permissionId, isAllowed: false, reason });
        return { allowed: false, permissionId, roleId, userId, tenantId, featureId, reason };
      }

      // 2. Role / Permission Check
      const hasPerm = RoleRegistry.hasPermission(roleId, permissionId);
      if (!hasPerm) {
        const reason = `Role '${roleId}' lacks granted permission '${permissionId}'.`;
        AuditRegistry.logEvent({ userId, roleId, action: "evaluateAccess", permissionId, isAllowed: false, reason });
        return { allowed: false, permissionId, roleId, userId, tenantId, featureId, reason };
      }

      const reason = `Access granted for permission '${permissionId}'.`;
      AuditRegistry.logEvent({ userId, roleId, action: "evaluateAccess", permissionId, isAllowed: true, reason });
      return { allowed: true, permissionId, roleId, userId, tenantId, featureId, reason };
    }
  };

  /* ── Universal Configuration Registry Facade (SPK.configuration / UCR) ── */
  public configuration = {
    branding: {
      getBranding: () => BrandingRegistry.getBranding(),
      updateBranding: (overrides: Partial<BrandingDefinition>) => BrandingRegistry.updateBranding(overrides),
      subscribe: (listener: () => void) => BrandingRegistry.subscribe(listener)
    },
    regional: {
      getConfig: () => RegionalRegistry.getConfig(),
      updateConfig: (overrides: Partial<RegionalConfig>) => RegionalRegistry.updateConfig(overrides),
      formatCurrency: (amount: number) => RegionalRegistry.formatCurrency(amount),
      subscribe: (listener: () => void) => RegionalRegistry.subscribe(listener)
    },
    preferences: {
      getPreference: <T = any>(key: string, defaultValue?: T) => PreferenceRegistry.getPreference<T>(key, defaultValue),
      setPreference: (key: string, value: any, scope?: PreferenceScope) => PreferenceRegistry.setPreference(key, value, scope),
      subscribe: (listener: () => void) => PreferenceRegistry.subscribe(listener)
    },
    environment: {
      getConfig: () => EnvironmentRegistry.getConfig(),
      subscribe: (listener: () => void) => EnvironmentRegistry.subscribe(listener)
    }
  };

  /* ── Universal Workflow Registry Facade (SPK.workflow / UWR) ── */
  public workflow = {
    getWorkflow: (id: string) => WorkflowRegistry.getWorkflow(id),
    getWorkflows: () => WorkflowRegistry.getWorkflows(),
    executeTransition: (
      workflowId: string,
      currentState: WorkflowState,
      transitionId: string,
      context: Readonly<PlatformContext>,
      entityValues?: Record<string, any>
    ) => WorkflowRegistry.executeTransition(workflowId, currentState, transitionId, context, entityValues),
    registerWorkflow: (workflow: WorkflowDefinition) => WorkflowRegistry.registerWorkflow(workflow),
    subscribe: (listener: () => void) => WorkflowRegistry.subscribe(listener)
  };

  /* ── Universal Report Registry Facade (SPK.reports / URR) ── */
  public reports = {
    getReport: (id: string) => ReportRegistry.getReport(id),
    getReports: () => ReportRegistry.getReports(),
    getReportsByCategory: (category: ReportCategory) => ReportRegistry.getReportsByCategory(category),
    executeReport: (reportId: string, params: Record<string, any>, context: Readonly<PlatformContext>) =>
      ReportRegistry.executeReport(reportId, params, context),
    registerReport: (report: ReportDefinition) => ReportRegistry.registerReport(report),
    subscribe: (listener: () => void) => ReportRegistry.subscribe(listener)
  };

  /* ── Universal Print Registry Facade (SPK.printing / UPRT) ── */
  public printing = {
    getTemplate: (id: string) => PrintRegistry.getTemplate(id),
    getTemplates: () => PrintRegistry.getTemplates(),
    renderDocument: (templateId: string, data: Record<string, any>, context: Readonly<PlatformContext>) =>
      PrintRegistry.renderDocument(templateId, data, context),
    registerTemplate: (template: PrintTemplateDefinition) => PrintRegistry.registerTemplate(template),
    subscribe: (listener: () => void) => PrintRegistry.subscribe(listener)
  };

  /* ── Universal Dashboard Registry Facade (SPK.dashboard / UDR) ── */
  public dashboard = {
    getDashboard: (id: string) => DashboardRegistry.getDashboard(id),
    getDashboards: () => DashboardRegistry.getDashboards(),
    renderWidget: (widgetId: string, dashboardId: string, context: Readonly<PlatformContext>) =>
      DashboardRegistry.renderWidget(widgetId, dashboardId, context),
    registerDashboard: (dashboard: DashboardDefinition) => DashboardRegistry.registerDashboard(dashboard),
    subscribe: (listener: () => void) => DashboardRegistry.subscribe(listener)
  };

  /* ── Universal AI Skill Registry Facade (SPK.ai / UAR) ── */
  public ai = {
    getSkill: (id: string) => AIRegistry.getSkill(id),
    getSkills: () => AIRegistry.getSkills(),
    executeSkill: (skillId: string, params: Record<string, any>, context: Readonly<PlatformContext>) =>
      AIRegistry.executeSkill(skillId, params, context),
    registerSkill: (skill: AISkillDefinition) => AIRegistry.registerSkill(skill),
    subscribe: (listener: () => void) => AIRegistry.subscribe(listener)
  };

  /* ── Universal Discovery & Command Platform Facade (SPK.udcp / UDCP v1.0) ── */
  public udcp = {
    /** Multi-provider parallel discovery search across all registered providers */
    search: (query: string, context?: DiscoveryContext) => UDCPKernel.search(query, context),
    /** Execute a discovery result */
    executeResult: (result: DiscoveryResult) => UDCPKernel.executeResult(result),
    /** Inspect a discovery result via UCIF */
    inspectResult: (result: DiscoveryResult) => UDCPKernel.inspectResult(result),
    /** Register a custom discovery provider (online / offline / hybrid) */
    registerProvider: (provider: IDiscoveryProvider) => UDCPKernel.registerProvider(provider),
    /** Register an Industry Vocabulary Pack (Synonyms e.g., Paracetamol = PCM) */
    registerVocabulary: (pack: VocabularyProvider) => UDCPKernel.registerVocabulary(pack),
    /** Current discovery session */
    getSession: () => UDCPKernel.getCurrentSession(),
    /** UDCP Pub/Sub Event Bus (Refinement #1) */
    events: {
      on: (event: UDCPEventType | "*", subscriber: UDCPEventSubscriber) =>
        UDCPEventBus.on(event, subscriber),
    },
  };

  /* ── Universal Search & Filter Framework Facade (SPK.search — Backward-Compatible Facade) ── */
  public search = {
    /** Delegates 100% to SPK.udcp search under the hood */
    search: (query: string, context?: DiscoveryContext) => UDCPKernel.search(query, context),
    registerProvider: (provider: ISearchProvider) => SearchRegistry.registerProvider(provider),
    getProvider: (moduleId: string) => SearchRegistry.getProvider(moduleId),
    getManifest: (moduleId: string) => SearchRegistry.getManifest(moduleId),
    executeSearch: <T = any>(query: ISearchQuery) => SearchRegistry.executeSearch<T>(query),
    getSavedViews: (moduleId: string) => SearchRegistry.getSavedViews(moduleId),
    saveView: (moduleId: string, view: SavedViewDefinition) => SearchRegistry.saveView(moduleId, view),
    getHistory: (moduleId?: string) => SearchRegistry.getHistory(moduleId),
    subscribe: (listener: () => void) => SearchRegistry.subscribe(listener)
  };

  /* ── Business Domains Facade (SPK.domains — Wave 1 Architecture) ── */
  public domains = {
    pos: posDomainService,
    sales: salesDomainService,
    inventory: inventoryDomainService
  };

  /* ── Universal Context Intelligence Framework Facade (SPK.ucif / UCIF v1.0) ── */
  public ucif = {
    /** Full pipeline: resolve field → resolve entity → open inspector */
    inspect: (variant?: InspectorVariant) => UCIFKernel.inspect(variant),
    /** Preview variant — hover (minimal card) */
    preview: (el?: HTMLElement) => UCIFKernel.preview(el),
    /** Phase 1: active element → FieldContext */
    resolveField: (el?: HTMLElement) => UCIFKernel.resolveField(el),
    /** Phase 2: FieldContext → EntityContext[] */
    resolveEntity: (fc: FieldContext) => UCIFKernel.resolveEntity(fc),
    /** Register a full InspectorConfig (entity + variant) */
    registerInspector: (config: InspectorConfig) => UCIFKernel.registerInspector(config),
    /** Inject a plugin section into an existing entity inspector */
    registerInspectorSection: (entityType: string, section: InspectorSectionDef) =>
      UCIFKernel.registerInspectorSection(entityType, section),
    /** Register a custom data provider (REST/GraphQL/ERPNext/Tally/Mock) */
    registerDataProvider: (provider: IInspectorDataProvider) =>
      UCIFKernel.registerDataProvider(provider),
    /** Register a Phase 1 context resolver (barcode, OCR, camera, voice…) */
    registerContextResolver: (resolver: IContextResolver) =>
      UCIFKernel.registerContextResolver(resolver),
    /** Register a Phase 2 entity resolver */
    registerEntityResolver: (resolver: IEntityResolver) =>
      UCIFKernel.registerEntityResolver(resolver),
    /** Subscribe to inspector lifecycle events */
    onLifecycle: (event: InspectorLifecycleEvent | "*", handler: LifecycleSubscriber) =>
      UCIFKernel.onLifecycle(event, handler),
    /** Recent inspection history */
    getHistory: () => UCIFKernel.getHistory(),
    /** Pin a context for quick re-access */
    pin: (ctx: ResolvedContext) => UCIFKernel.pin(ctx),
    /** Mark a context as favourite */
    favorite: (ctx: ResolvedContext) => UCIFKernel.favorite(ctx),
    /** Analytics / telemetry service handle */
    getTelemetry: () => UCIFKernel.getTelemetry(),
    /** Refresh API — invalidate cache and trigger re-fetch (UCIF v1.1) */
    refresh: (entityType: string, entityId: string) => UCIFKernel.refresh(entityType, entityId),
    /** Context Graph breadcrumb stack (UCIF v1.1) */
    pushBreadcrumb: (ctx: ResolvedContext) => UCIFKernel.pushBreadcrumb(ctx),
    getBreadcrumbs: () => UCIFKernel.getBreadcrumbs(),
    clearBreadcrumbs: () => UCIFKernel.clearBreadcrumbs(),
    /** Internal — inject React panel opener (called by AdaptiveWorkspaceLayout) */
    _injectPanelOpener: (fn: (ctx: ResolvedContext) => void) =>
      UCIFKernel.injectPanelOpener(fn),
    _injectDisambiguationUI: (fn: (candidates: ResolvedContext[]) => void) =>
      UCIFKernel.injectDisambiguationUI(fn),
    _injectConfirmationUI: (fn: (ctx: ResolvedContext, onConfirm: () => void) => void) =>
      UCIFKernel.injectConfirmationUI(fn),
  };

  /* ── Extension SDK (SPK.sdk) ── */
  public sdk = {
    registerExtension: (manifest: IModuleMetadata, providers: ILookupProvider[] = []): void => {
      this.modules.register(manifest);
      providers.forEach((p) => this.ule.registerProvider(p));
    },
    registerDomain: (domain: DomainDefinition): void => {
      NavigationRegistry.registerDomain(domain);
    },
    registerForm: (form: FormDefinition): void => {
      FormRegistry.registerForm(form);
    },
    registerEntity: (entity: EntityMetadata): void => {
      EntityRegistry.registerEntity(entity);
    }
  };
}

/* Singleton Export */
export const SPK = SMRITIPlatformKernel.getInstance();
