/**
 * Project      : SMRITI Retail OS
 * Module       : SMRITI UX Framework SDK (ExperiencePluginSDK v2.0 — SWEF P-012)
 * Standard     : SXP Constitution v1.0 — Certification Gate SXP-CS-012
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Version      : 2.0.0
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 *
 * GOVERNANCE (SWEF P-012):
 *   All platform extensions MUST implement ExperiencePlugin.
 *   No modifications to core SXP engines are permitted.
 *   Plugins register capabilities via the public SDK surfaces.
 */

import { WorkspaceRegistry, WorkspaceMetadata } from "../layout_engine/WorkspaceRegistry.js";
import { WorkspaceActionRegistry, WorkspaceActionDef } from "../layout_engine/WorkspaceActionRegistry.js";
import { SPK } from "../kernel/SPK.js";

// ── Platform Context (read-only at plugin init) ───────────────────────────────

export interface PluginPlatformContext {
  readonly tenantId: string;
  readonly userId: string;
  readonly edition: string; // 'community' | 'standard' | 'enterprise'
  readonly locale: string;
}

// ── Framework SDK Interfaces ──────────────────────────────────────────────────

export interface SEDSThemeSDK {
  getTokens(): Record<string, string>;
  setThemeMode(mode: "dark" | "light" | "auto"): void;
}

export interface NavigationSDK {
  registerDomain(domain: { id: string; name: string; icon: string }): void;
  registerModule(domainId: string, module: { id: string; label: string; icon: string; component: string }): void;
}

export interface FormSDK {
  registerForm(entityType: string, formDef: any): void;
  registerValidationRule(ruleId: string, validatorFn: (val: any) => boolean): void;
}

export interface DrillDownSDK {
  register360Inspector(entityType: string, componentName: string): void;
  registerLineageAdapter(entityType: string, adapterFn: (id: string) => any): void;
}

export interface PrintSDK {
  registerTemplate(templateId: string, templateSchema: any): void;
}

export interface AiSkillSDK {
  registerAdvisorySkill(skillId: string, skillFn: (ctx: any) => any): void;
}

// ── Plugin Registration Targets ────────────────────────────────────────────────

export interface PluginRegistrationTargets {
  workspaceRegistry: typeof WorkspaceRegistry;
  actionRegistry: typeof WorkspaceActionRegistry;
  navigation: NavigationSDK;
  forms: FormSDK;
  drillDown: DrillDownSDK;
  printing: PrintSDK;
  ai: AiSkillSDK;
}

// ── Plugin Descriptor ─────────────────────────────────────────────────────────

export interface ExperiencePlugin {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly description?: string;

  /**
   * Register workspaces this plugin adds to the platform.
   * Called once during plugin initialization.
   */
  registerWorkspaces?(registry: typeof WorkspaceRegistry): void;

  /**
   * Register actions this plugin contributes.
   * Called once during plugin initialization.
   */
  registerActions?(registry: typeof WorkspaceActionRegistry): void;

  /**
   * Register domain navigation modules, forms, print templates, and 360° inspectors.
   */
  registerExtensions?(targets: PluginRegistrationTargets): void;

  /**
   * Called after all plugins have registered their components.
   */
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
