/**
 * Project      : SMRITI Retail OS
 * Module       : SXP v1.0 — Workspace Personalization Engine (WPE)
 * Standard     : SXP Constitution v1.0 / UCR-003 / SWEF P-010
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Version      : 1.0.0
 * Created      : 2026-08-03
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 *
 * GOVERNANCE (P-010): All personalization state MUST be managed through WPE
 * via SPK.configuration.preferences. No studio may persist preferences directly.
 *
 * DESIGN: Extends layout_store.tsx (lastWorkspace, favorites, recentlyUsed).
 * WPE adds dashboard layout, pinned actions, filter memory, and density.
 */

import { WorkspaceEventBus } from "./WorkspaceEventBus.js";

// ── Types ─────────────────────────────────────────────────────────────────────

export type WorkspaceDensity = "comfortable" | "compact" | "dense";

export interface WidgetLayoutConfig {
  widgetId: string;
  colSpan: number;
  rowSpan: number;
  order: number;
}

export interface FilterState {
  [key: string]: string | string[] | boolean | number | undefined;
}

interface PersonalizationState {
  dashboardLayouts: Record<string, WidgetLayoutConfig[]>;
  pinnedActions: string[];
  rememberedFilters: Record<string, FilterState>;
  density: WorkspaceDensity;
  lastWorkspace: string;
  recentOperations: string[];
}

// ── Engine ────────────────────────────────────────────────────────────────────

const WPE_STORAGE_KEY = "smriti_sxp_personalization";

class WorkspacePersonalizationEngineService {
  private state: PersonalizationState;

  constructor() {
    this.state = this.load();
  }

  private load(): PersonalizationState {
    const defaults: PersonalizationState = {
      dashboardLayouts: {},
      pinnedActions: [],
      rememberedFilters: {},
      density: "comfortable",
      lastWorkspace: "launchpad",
      recentOperations: [],
    };
    if (typeof window === "undefined") return defaults;
    try {
      const saved = localStorage.getItem(WPE_STORAGE_KEY);
      return saved ? { ...defaults, ...JSON.parse(saved) } : defaults;
    } catch {
      return defaults;
    }
  }

  private save(): void {
    if (typeof window !== "undefined") {
      localStorage.setItem(WPE_STORAGE_KEY, JSON.stringify(this.state));
    }
  }

  // ── Dashboard Layouts ──────────────────────────────────────────────────────

  public getDashboardLayout(workspaceId: string): WidgetLayoutConfig[] {
    return this.state.dashboardLayouts[workspaceId] ?? [];
  }

  public saveDashboardLayout(workspaceId: string, layout: WidgetLayoutConfig[]): void {
    this.state.dashboardLayouts[workspaceId] = layout;
    this.save();
  }

  public clearDashboardLayout(workspaceId: string): void {
    delete this.state.dashboardLayouts[workspaceId];
    this.save();
  }

  // ── Pinned Actions ─────────────────────────────────────────────────────────

  public pinAction(actionId: string): void {
    if (!this.state.pinnedActions.includes(actionId)) {
      this.state.pinnedActions = [...this.state.pinnedActions, actionId];
      this.save();
    }
  }

  public unpinAction(actionId: string): void {
    this.state.pinnedActions = this.state.pinnedActions.filter((id) => id !== actionId);
    this.save();
  }

  public getPinnedActions(): string[] {
    return [...this.state.pinnedActions];
  }

  // ── Filter Memory ──────────────────────────────────────────────────────────

  public rememberFilter(workspaceId: string, filter: FilterState): void {
    this.state.rememberedFilters[workspaceId] = filter;
    this.save();
    WorkspaceEventBus.publish("FilterChanged", { workspaceId, filter }, workspaceId);
  }

  public getRememberedFilter(workspaceId: string): FilterState | undefined {
    return this.state.rememberedFilters[workspaceId];
  }

  // ── Density ───────────────────────────────────────────────────────────────

  public getDensity(): WorkspaceDensity {
    return this.state.density;
  }

  public setDensity(density: WorkspaceDensity): void {
    this.state.density = density;
    this.save();
  }

  // ── Last Workspace ─────────────────────────────────────────────────────────

  public getLastWorkspace(): string {
    return this.state.lastWorkspace;
  }

  public setLastWorkspace(workspaceId: string): void {
    this.state.lastWorkspace = workspaceId;
    this.save();
  }

  // ── Recent Operations ──────────────────────────────────────────────────────

  public recordOperation(operationId: string): void {
    this.state.recentOperations = [
      operationId,
      ...this.state.recentOperations.filter((id) => id !== operationId),
    ].slice(0, 20);
    this.save();
  }

  public getRecentOperations(n: number = 10): string[] {
    return this.state.recentOperations.slice(0, n);
  }
}

export const WorkspacePersonalizationEngine = new WorkspacePersonalizationEngineService();
