/**
 * Project      : SMRITI Application Platform (SMAP) v1.0
 * Component    : SMRITI Platform Kernel (SPK) Master Singleton
 * Standard     : SMAP Constitution v1.0 (FROZEN) — Level 1 Core Execution Kernel
 * Author       : Jawahar Ramkripal Mallah
 * License      : Proprietary Commercial Software
 */

import { WindowManager } from "../sdk/WindowManager.js";

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

  /* ── Extension SDK (SPK.sdk) ── */
  public sdk = {
    registerExtension: (manifest: IModuleMetadata, providers: ILookupProvider[] = []): void => {
      this.modules.register(manifest);
      providers.forEach((p) => this.ule.registerProvider(p));
    }
  };
}

/* Singleton Export */
export const SPK = SMRITIPlatformKernel.getInstance();
