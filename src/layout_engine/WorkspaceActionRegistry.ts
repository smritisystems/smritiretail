/**
 * Project      : SMRITI Retail OS
 * Module       : SXP v1.0 — Unified Action Framework (WorkspaceActionRegistry)
 * Standard     : SXP Constitution v1.0 / SWEF v1.0 — Certification Gate SXP-CS-004
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Version      : 1.0.0
 * Created      : 2026-08-03
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 *
 * GOVERNANCE:
 *   Every studio action MUST be registered here.
 *   Direct callback props in action bars are PROHIBITED.
 *   Enables: permissions, undo, analytics, AI automation, audit logging
 *   from a single registered source.
 */

import { WorkspaceMode, FeatureKey, adaptiveWorkspaceStore } from "./adaptive_workspace_store.js";
import { WorkspaceEventBus } from "./WorkspaceEventBus.js";

// ── Interfaces ────────────────────────────────────────────────────────────────

export interface ActionResult {
  success: boolean;
  message?: string;
  data?: unknown;
}

/** Minimal context available at action execution time */
export interface ActionExecutionContext {
  tenantId: string;
  userId: string;
  workspaceId: string;
  mode: WorkspaceMode;
  /** Optional — wizard-driven actions use this to pass collected state to execute() */
  payload?: unknown;
}

/**
 * WorkspaceActionDef — the contract every studio action must implement.
 *
 * Register via: WorkspaceActionRegistry.register(action)
 * Execute via:  WorkspaceActionRegistry.execute(actionId, context)
 */
export interface WorkspaceActionDef {
  /** Unique action ID, e.g. 'receive_stock', 'transfer_stock' */
  id: string;
  /** Display label — must NOT contain ERP terminology in SIMPLE mode */
  label: string;
  /** Lucide icon name */
  icon: string;
  /** Keyboard shortcut (e.g. 'F5', 'Ctrl+R') */
  shortcut?: string;
  /** SPK.security permission gate — undefined = always allowed */
  permissionId?: string;
  /** Modes in which this action is visible (drives UniversalActionBar filtering) */
  adaptiveVisibility: WorkspaceMode[];
  /** Optional: also gate by AdaptiveVisibilityRegistry feature key */
  featureKey?: FeatureKey;

  /** Returns true if the action can currently be executed */
  canExecute(ctx: ActionExecutionContext): boolean;

  /** Main execution handler — must publish ActionExecuted to WorkspaceEventBus */
  execute(ctx: ActionExecutionContext): Promise<ActionResult>;

  /** Optional undo handler (shown as "Undo" toast after success) */
  undo?(ctx: ActionExecutionContext): Promise<void>;

  /** Optional analytics callback — feeds WorkspaceAnalyticsEngine */
  analytics?(result: ActionResult, ctx: ActionExecutionContext): void;
}

// ── Registry ──────────────────────────────────────────────────────────────────

class WorkspaceActionRegistryService {
  private readonly actions: Map<string, Readonly<WorkspaceActionDef>> = new Map();

  /** Register an action. Called from studio *.manifest.ts on module load. */
  public register(action: WorkspaceActionDef): void {
    this.actions.set(action.id.toLowerCase(), Object.freeze({ ...action }));
  }

  public get(id: string): Readonly<WorkspaceActionDef> | undefined {
    return this.actions.get(id.toLowerCase());
  }

  public getAll(): ReadonlyArray<Readonly<WorkspaceActionDef>> {
    return Array.from(this.actions.values());
  }

  /**
   * Returns actions visible in the given mode, optionally filtered by IDs.
   * Used by WorkspaceShell SmartActionBar to build the action bar.
   */
  public getVisible(
    mode: WorkspaceMode,
    actionIds?: string[]
  ): ReadonlyArray<Readonly<WorkspaceActionDef>> {
    const all = actionIds
      ? actionIds.map((id) => this.get(id)).filter(Boolean) as WorkspaceActionDef[]
      : this.getAll() as WorkspaceActionDef[];

    return all.filter((action) => {
      if (!action.adaptiveVisibility.includes(mode)) return false;
      if (action.featureKey && !adaptiveWorkspaceStore.canRender(action.featureKey, mode)) {
        return false;
      }
      return true;
    });
  }

  /**
   * Execute a registered action.
   * Publishes ActionExecuted to WorkspaceEventBus on completion.
   */
  public async execute(
    actionId: string,
    ctx: ActionExecutionContext
  ): Promise<ActionResult> {
    const action = this.get(actionId);
    if (!action) {
      return { success: false, message: `Action '${actionId}' not registered.` };
    }
    if (!action.canExecute(ctx)) {
      return { success: false, message: `Action '${actionId}' cannot execute in current state.` };
    }

    try {
      const result = await action.execute(ctx);

      WorkspaceEventBus.publish(
        "ActionExecuted",
        { actionId, result, workspaceId: ctx.workspaceId },
        ctx.workspaceId
      );

      if (result.success && action.analytics) {
        action.analytics(result, ctx);
      }

      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, message };
    }
  }

  /** Clear all registrations — for testing only */
  public clearAll(): void {
    this.actions.clear();
  }

  /** Unregister a single action by id */
  public unregister(id: string): void {
    this.actions.delete(id.toLowerCase());
  }
}

export const WorkspaceActionRegistry = new WorkspaceActionRegistryService();
