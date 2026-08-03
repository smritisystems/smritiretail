/**
 * Project      : SMRITI Retail OS
 * Module       : SXP v1.0 — Experience Plugin SDK (SWEF P-012)
 * Standard     : SXP Constitution v1.0 — Certification Gate SXP-CS-012
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Version      : 1.0.0
 * Created      : 2026-08-03
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 *
 * GOVERNANCE (SWEF P-012):
 *   All platform extensions MUST implement ExperiencePlugin.
 *   No modifications to core SXP engines are permitted.
 *   Plugins register capabilities via the provided registry instances.
 *
 * EXAMPLE PLUGINS (register without touching core):
 *   SmritiAIPlugin        — AI reorder advisory, demand forecast widgets
 *   MarketplacePlugin     — Shopify/Amazon sync widgets + timeline adapter
 *   ManufacturingPlugin   — BOM, production order workspaces
 *   RestaurantPlugin      — KOT, table management, modifier workspaces
 */

import { WorkspaceRegistry, WorkspaceMetadata } from "../layout_engine/WorkspaceRegistry.js";
import { WorkspaceActionRegistry, WorkspaceActionDef } from "../layout_engine/WorkspaceActionRegistry.js";

// ── Platform Context (read-only at plugin init) ───────────────────────────────

export interface PluginPlatformContext {
  readonly tenantId: string;
  readonly userId: string;
  readonly edition: string; // 'community' | 'standard' | 'enterprise'
  readonly locale: string;
}

// ── Plugin Registration Targets ────────────────────────────────────────────────

export interface PluginRegistrationTargets {
  workspaceRegistry: typeof WorkspaceRegistry;
  actionRegistry: typeof WorkspaceActionRegistry;
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
   * Register additional widget type IDs (declared in DashboardRegistry
   * separately by the plugin's module).
   */
  registerWidgetTypes?(): string[];

  /**
   * Register timeline adapter IDs this plugin provides.
   * WorkspaceTimeline resolves adapters by ID at render time.
   */
  registerTimelineAdapters?(): string[];

  /**
   * Register search source IDs (resolved by GlobalSearchEngine).
   */
  registerSearchSources?(): string[];

  /**
   * Lifecycle: called once with an immutable platform context.
   * Plugins must complete initialization here (load data, set up subscriptions).
   */
  initialize(context: PluginPlatformContext): Promise<void>;

  /**
   * Lifecycle: called on platform teardown or plugin deregistration.
   * Must remove all event subscriptions and timers.
   */
  destroy(): void;
}

// ── Plugin Registry ───────────────────────────────────────────────────────────

class ExperiencePluginRegistryService {
  private readonly plugins: Map<string, ExperiencePlugin> = new Map();

  /**
   * Load and initialize a plugin.
   * Calls all registerXxx hooks then initialize().
   */
  public async load(
    plugin: ExperiencePlugin,
    context: PluginPlatformContext
  ): Promise<void> {
    if (this.plugins.has(plugin.id)) {
      console.warn(`[ExperiencePluginSDK] Plugin '${plugin.id}' is already loaded.`);
      return;
    }

    // Call registration hooks
    plugin.registerWorkspaces?.(WorkspaceRegistry);
    plugin.registerActions?.(WorkspaceActionRegistry);

    // Initialize with immutable context
    await plugin.initialize(Object.freeze({ ...context }));

    this.plugins.set(plugin.id, plugin);
    console.info(`[ExperiencePluginSDK] Loaded plugin: ${plugin.name} v${plugin.version}`);
  }

  /** Unload a plugin and call its destroy() lifecycle method */
  public unload(pluginId: string): void {
    const plugin = this.plugins.get(pluginId);
    if (plugin) {
      plugin.destroy();
      this.plugins.delete(pluginId);
    }
  }

  public get(pluginId: string): ExperiencePlugin | undefined {
    return this.plugins.get(pluginId);
  }

  public getAll(): ExperiencePlugin[] {
    return Array.from(this.plugins.values());
  }

  /** Check if a plugin is currently active */
  public isLoaded(pluginId: string): boolean {
    return this.plugins.has(pluginId);
  }
}

export const ExperiencePluginRegistry = new ExperiencePluginRegistryService();

// ── Convenience type exports ──────────────────────────────────────────────────
// Plugin authors import from this module only — not from internal SXP modules.

export type { WorkspaceMetadata, WorkspaceActionDef };
