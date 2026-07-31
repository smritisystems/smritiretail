/**
 * Project      : SMRITI Application Platform (SMAP) v1.0
 * Component    : SMRITI Platform Kernel (SPK) Master Singleton
 * Standard     : SMAP Constitution v1.0 (FROZEN) — Level 1 Core Execution Kernel
 * Author       : Jawahar Ramkripal Mallah
 * License      : Proprietary Commercial Software
 */

import { WindowManager } from "../sdk/WindowManager.js";
import { NavigationRegistry, DomainDefinition } from "./upr/navigation/NavigationRegistry.js";
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

export interface ILookupItem {
  id: string;
  code: string;
  name: string;
  badge?: string;
  type: string;
  metadata: Record<string, any>;
}

export interface ILookupProvider {
  domain: string;
  search(query: string): Promise<ILookupItem[]>;
  getById(id: string): Promise<ILookupItem | null>;
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
    console.log("[SPK Kernel v1.0] Starting SMRITI Platform Kernel (SPK)...");
    this.isStarted = true;
    console.log("[SPK Kernel v1.0] Ready & Running under SMAP Constitution v1.0.");
  }

  public shutdown(): void {
    this.servicesRegistry.clear();
    this.modulesRegistry.clear();
    this.commandHandlers.clear();
    this.eventSubscribers.clear();
    this.lookupProviders.clear();
    this.isStarted = false;
    console.log("[SPK Kernel v1.0] Kernel session cleanly shut down.");
  }

  /* ── Service Registry (SPK.services) ── */
  public services = {
    register: <T>(serviceId: string, instance: T): void => {
      this.servicesRegistry.set(serviceId.toUpperCase(), instance);
      console.log(`[SPK Service Registry] Service registered: ${serviceId.toUpperCase()}`);
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
      console.log(`[SPK Module Registry] Module registered: ${manifest.name} (v${manifest.version})`);
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
      console.log(`[SPK CommandBus] Executing command: ${command.type}`);
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
    emit: (eventType: string, entityId: string, payload: any): void => {
      const event: IDomainEvent = {
        eventType,
        entityId,
        payload,
        timestamp: new Date().toISOString()
      };
      console.log(`[SPK EventBus] Emitting event: ${eventType} (${entityId})`);

      const subscribers = this.eventSubscribers.get(eventType);
      if (subscribers) {
        subscribers.forEach((cb) => {
          try { cb(event); } catch (e) { console.error(`[SPK Event Error] ${e}`); }
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

  /* ── Universal Lookup Engine (SPK.ule) ── */
  public ule = {
    registerProvider: (provider: ILookupProvider): void => {
      this.lookupProviders.set(provider.domain.toUpperCase(), provider);
      console.log(`[SPK ULE] Lookup Provider registered for domain: ${provider.domain.toUpperCase()}`);
    },
    getProvider: (domain: string): ILookupProvider | undefined => {
      return this.lookupProviders.get(domain.toUpperCase());
    },
    search: async (domain: string, query: string): Promise<ILookupItem[]> => {
      const provider = this.lookupProviders.get(domain.toUpperCase());
      if (!provider) return [];
      return await provider.search(query);
    }
  };

  /* ── Universal Navigation Registry Facade (SPK.navigation) ── */
  public navigation = {
    getDomains: () => NavigationRegistry.getDomains(),
    getDomain: (id: string) => NavigationRegistry.getDomain(id),
    getModuleIdsForDomain: (domainId: string) => NavigationRegistry.getModuleIdsForDomain(domainId),
    getSidebar: (activeDomainId: string) => NavigationRegistry.getSidebar(activeDomainId),
    registerDomain: (domain: DomainDefinition) => NavigationRegistry.registerDomain(domain),
    subscribe: (listener: () => void) => NavigationRegistry.subscribe(listener)
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
