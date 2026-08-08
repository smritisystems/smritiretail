/**
 * Project      : SMRITI Retail OS
 * Module       : SMRITI Enterprise Developer Platform SDK (ExperiencePluginSDK v2.0.0 LTS)
 * Standard     : SWEF P-012 / SXP Certification Gate SXP-CS-012
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Version      : 2.0.0-LTS (Frozen Public Contracts)
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 *
 * 5 LOGICAL SDK DOMAINS:
 * 1. UX SDK          (Theme, Component, Workspace, Navigation)
 * 2. Business SDK    (Form, Lookup, Validation, Workflow)
 * 3. Platform SDK    (Search, Timeline, DrillDown, AI)
 * 4. Integration SDK (Hardware, Barcode, Print, Report, Integration, Notification)
 * 5. Extension SDK   (Industry Pack, Mobile)
 */

import { WorkspaceRegistry } from "../layout_engine/WorkspaceRegistry.js";
import { WorkspaceActionRegistry } from "../layout_engine/WorkspaceActionRegistry.js";

// ── Platform Context (Read-only at plugin init) ───────────────────────────────

export interface PluginPlatformContext {
  readonly tenantId: string;
  readonly userId: string;
  readonly edition: string; // 'community' | 'standard' | 'enterprise'
  readonly locale: string;
}

// ── Individual SDK Interfaces (20 Capabilities) ───────────────────────────────

export interface ThemeSDK {
  getTokens(): Record<string, string>;
  setThemeMode(mode: "dark" | "light" | "auto"): void;
}

export interface ComponentSDK {
  registerComponent(name: string, component: any): void;
}

export interface WorkspaceSDK {
  registerWorkspace(metadata: any): void;
}

export interface NavigationSDK {
  registerDomain(domain: { id: string; name: string; icon: string }): void;
  registerModule(domainId: string, module: { id: string; label: string; icon: string; component: string }): void;
}

export interface FormSDK {
  registerForm(entityType: string, formDef: any): void;
}

export interface LookupSDK {
  registerLookupProvider(entityType: string, providerFn: (q: string) => Promise<any[]>): void;
}

export interface ValidationSDK {
  registerValidationRule(ruleId: string, validatorFn: (val: any) => boolean): void;
}

export interface WorkflowSDK {
  registerWorkflow(entityType: string, stateMachine: any): void;
}

export interface ReportSDK {
  registerReport(reportId: string, reportDef: any): void;
}

export interface PrintSDK {
  registerTemplate(templateId: string, templateSchema: any): void;
}

export interface BarcodeSDK {
  registerBarcodeParser(symbology: string, parserFn: (raw: string) => any): void;
}

export interface NotificationSDK {
  emitToast(message: string, type: "info" | "success" | "warning" | "error"): void;
}

export interface DrillDownSDK {
  // ── FROZEN (existing Level-1 contracts) ─────────────────────────────────────
  register360Inspector(entityType: string, componentName: string): void;
  registerLineageAdapter(entityType: string, adapterFn: (id: string) => any): void;

  // ── UCIF v1.0 ContextSDK expansion ──────────────────────────────────────────
  // (These extend the SDK without renaming it — AFR-001 compliance)

  /** Register a full InspectorConfig (entity + variant + capabilities) */
  registerInspector(config: import('../kernel/upr/context/InspectorSchema.js').InspectorConfig): void;
  /** Inject an additional section into an existing entity inspector (VS Code pattern) */
  registerInspectorSection(entityType: string, section: import('../kernel/upr/context/InspectorSchema.js').InspectorSectionDef): void;
  /** Register a custom data provider (REST / GraphQL / ERPNext / Tally / Mock) */
  registerDataProvider(provider: import('../kernel/upr/context/InspectorSchema.js').IInspectorDataProvider): void;
  /** Register a Phase 1 context resolver (barcode, OCR, camera, voice…) */
  registerContextResolver(resolver: import('../kernel/upr/context/InspectorSchema.js').IContextResolver): void;
  /** Register a Phase 2 entity resolver */
  registerEntityResolver(resolver: import('../kernel/upr/context/InspectorSchema.js').IEntityResolver): void;

  /** Trigger a full inspection pipeline for the current cursor context */
  inspect(entityType: string, entityId: string, variant?: string): void;
  /** Resolve the field the cursor is currently on (async — Phase 1) */
  resolve(activeElement?: HTMLElement): Promise<import('../kernel/upr/context/InspectorSchema.js').ResolvedContext | null>;
  /** Open the inspector panel for a pre-resolved context */
  openInspector(context: import('../kernel/upr/context/InspectorSchema.js').ResolvedContext): void;
  /** Close the currently open inspector panel */
  closeInspector(): void;

  /** Subscribe to inspector lifecycle events */
  onLifecycle(
    event: import('../kernel/upr/context/InspectorSchema.js').InspectorLifecycleEvent | '*',
    handler: import('../kernel/upr/context/InspectorSchema.js').LifecycleSubscriber
  ): () => void;

  /** Recent inspection history */
  getHistory(): import('../kernel/upr/context/InspectorSchema.js').ResolvedContext[];
  /** Pin an inspection context for quick re-access */
  pin(context: import('../kernel/upr/context/InspectorSchema.js').ResolvedContext): void;
  /** Mark an inspection context as favourite */
  favorite(context: import('../kernel/upr/context/InspectorSchema.js').ResolvedContext): void;
}

export interface TimelineSDK {
  registerTimelineAdapter(entityType: string, adapterFn: (id: string) => any[]): void;
}

export interface SearchSDK {
  registerSearchIndex(entityType: string, indexerFn: (q: string) => any[]): void;
}

export interface AiSkillSDK {
  registerAdvisorySkill(skillId: string, skillFn: (ctx: any) => any): void;
}

export interface IntegrationSDK {
  registerCommunicatorAdapter(targetSystem: string, adapterFn: (payload: any) => Promise<any>): void;
}

export interface HardwareSDK {
  registerThermalPrinterDriver(driverId: string, driverFn: (bytes: Uint8Array) => Promise<boolean>): void;
}

export interface MobileSDK {
  registerTouchGesture(gestureId: string, handlerFn: (evt: any) => void): void;
}

export interface IndustryPackSDK {
  registerVerticalPack(packId: string, packDescriptor: { name: string; domainModules: any[] }): void;
}

// ── 5 Logical SDK Domains (v2.0.0 LTS Architecture) ───────────────────────────

export interface SMRITIUXDomainSDK {
  theme: ThemeSDK;
  component: ComponentSDK;
  workspace: WorkspaceSDK;
  navigation: NavigationSDK;
}

export interface SMRITIBusinessDomainSDK {
  form: FormSDK;
  lookup: LookupSDK;
  validation: ValidationSDK;
  workflow: WorkflowSDK;
}

export interface SMRITIPlatformDomainSDK {
  search: SearchSDK;
  timeline: TimelineSDK;
  drillDown: DrillDownSDK;
  ai: AiSkillSDK;
}

export interface SMRITIIntegrationDomainSDK {
  hardware: HardwareSDK;
  barcode: BarcodeSDK;
  print: PrintSDK;
  report: ReportSDK;
  communicator: IntegrationSDK;
  notification: NotificationSDK;
}

export interface SMRITIExtensionDomainSDK {
  industryPack: IndustryPackSDK;
  mobile: MobileSDK;
}

// ── Consolidated Plugin Registration Targets (v2.0.0 LTS) ─────────────────────

export interface PluginRegistrationTargets extends SMRITIUXDomainSDK, SMRITIBusinessDomainSDK, SMRITIPlatformDomainSDK, SMRITIIntegrationDomainSDK, SMRITIExtensionDomainSDK {
  uxDomain: SMRITIUXDomainSDK;
  businessDomain: SMRITIBusinessDomainSDK;
  platformDomain: SMRITIPlatformDomainSDK;
  integrationDomain: SMRITIIntegrationDomainSDK;
  extensionDomain: SMRITIExtensionDomainSDK;
  workspaceRegistry: typeof WorkspaceRegistry;
  actionRegistry: typeof WorkspaceActionRegistry;
}

// ── Plugin Descriptor ─────────────────────────────────────────────────────────

export interface ExperiencePlugin {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly description?: string;

  registerWorkspaces?(registry: typeof WorkspaceRegistry): void;
  registerActions?(registry: typeof WorkspaceActionRegistry): void;
  registerExtensions?(targets: PluginRegistrationTargets): void;
  onPlatformReady?(context: PluginPlatformContext): void;
}

// ── Plugin Host Manager ───────────────────────────────────────────────────────

export class ExperiencePluginHost {
  private static instance: ExperiencePluginHost;
  private registeredPlugins: Map<string, ExperiencePlugin> = new Map();

  private constructor() {}

  public static getInstance(): ExperiencePluginHost {
    if (!ExperiencePluginHost.instance) {
      ExperiencePluginHost.instance = new ExperiencePluginHost();
    }
    return ExperiencePluginHost.instance;
  }

  public registerPlugin(plugin: ExperiencePlugin): void {
    if (this.registeredPlugins.has(plugin.id)) {
      console.warn(`[ExperiencePluginHost] Plugin ${plugin.id} already registered.`);
      return;
    }

    this.registeredPlugins.set(plugin.id, plugin);

    if (plugin.registerWorkspaces) {
      plugin.registerWorkspaces(WorkspaceRegistry);
    }
    if (plugin.registerActions) {
      plugin.registerActions(WorkspaceActionRegistry);
    }

    console.info(`[ExperiencePluginHost] Successfully registered plugin: ${plugin.name} (v${plugin.version})`);
  }

  public getPlugins(): ExperiencePlugin[] {
    return Array.from(this.registeredPlugins.values());
  }
}
