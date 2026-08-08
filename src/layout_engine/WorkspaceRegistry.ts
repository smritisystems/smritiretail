/**
 * Project      : SMRITI Retail OS
 * Module       : SXP v1.0 — Workspace Registry (WSR)
 * Standard     : SXP Constitution v1.0 / WNG-005 (Declarative Navigation)
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Version      : 1.0.0
 * Created      : 2026-08-03
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 *
 * GOVERNANCE: Workspace definitions MUST be declared here and in co-located
 * *.manifest.ts files. Hardcoded workspace routes in UI components are prohibited.
 */

import { WorkspaceMode, FeatureKey } from "./adaptive_workspace_store.js";
import { IndustryPackType } from "./saef_experience_store.js";

export type WorkspaceLayoutMode = "scroll" | "studio" | "master-detail";

/**
 * SWEF Experience Zones — all studios must declare one.
 * WorkspaceShell applies the zone's layout automatically.
 */
export type ExperienceZone =
  | "dashboard"    // Widget grid, timeline strip, KPI cards
  | "operator"     // Action launcher grid, filter bar, list report
  | "document"     // Object Page header + section body
  | "executive"    // Wide charts, KPI tiles, drill-down table
  | "scanner"      // Full-screen scan input, 3-interaction flow
  | "approval";    // Split list + detail, action tray

export interface WorkspaceActionDef {
  id: string;
  label: string;
  icon: string;
  shortcut?: string;
  permissionId?: string;
  /** Modes in which this action is visible */
  adaptiveVisibility: WorkspaceMode[];
  featureKey?: FeatureKey;
}

export interface WorkspaceLifecycle {
  /** Called once on mount: load preferences, register widgets */
  initialize?(): Promise<void>;
  /** Called when workspace gains focus: resume subscriptions */
  activate?(): void;
  /** Called when workspace loses focus: pause non-critical subs */
  deactivate?(): void;
  /** Called on unmount: cleanup listeners, flush analytics */
  destroy?(): void;
}

export interface WorkspaceMetadata {
  /** Unique workspace ID, e.g. 'inventory.dashboard' */
  id: string;
  /** Display title */
  title: string;
  /** Lucide icon name */
  icon: string;
  /** Parent domain ID from NavigationRegistry */
  domainId: string;
  /** Which adaptive modes activate this workspace */
  adaptiveModes: WorkspaceMode[];
  /** Restrict to specific industry packs (undefined = all packs) */
  industryPacks?: IndustryPackType[];
  /** Default layout mode for WorkspaceLayout */
  defaultLayout: WorkspaceLayoutMode;
  /** SWEF Experience Zone — drives WorkspaceShell layout variant */
  zone: ExperienceZone;
  /** Whether a mobile-optimised layout exists for this workspace */
  mobileEnabled: boolean;
  /** SPK.security permission gate (undefined = public) */
  permissionId?: string;
  /** Action IDs resolved via WorkspaceActionRegistry */
  actions: string[];
  /** Widget IDs resolved via WidgetEngine / DashboardRegistry */
  widgets: string[];
  /** Lifecycle hooks implemented in the studio's manifest */
  lifecycle?: WorkspaceLifecycle;
}

/** Manifest co-located with studio components — declares full studio contract */
export interface WorkspaceManifest extends WorkspaceMetadata {
  /** Path to the timeline adapter module (for WorkspaceTimeline) */
  timelineAdapterId?: string;
  /** POS-style shortcuts: { 'F5': 'receive_stock' } */
  shortcuts?: Record<string, string>;
  /** Scanner-first or standard mobile layout */
  mobileLayout?: "scan_first" | "standard";
  /** Override per-feature visibility threshold for this studio */
  adaptiveOverrides?: Partial<Record<FeatureKey, WorkspaceMode>>;
}

class WorkspaceRegistryService {
  private readonly workspaces: Map<string, Readonly<WorkspaceMetadata>> = new Map();
  private readonly listeners: Set<() => void> = new Set();

  /** Register a workspace. Typically called from a studio's *.manifest.ts on module load. */
  public register(workspace: WorkspaceMetadata): void {
    const payload = Object.freeze({ ...workspace, id: workspace.id.toLowerCase() });
    this.workspaces.set(payload.id, payload);
    this.emit();
  }

  public get(id: string): Readonly<WorkspaceMetadata> | undefined {
    if (!id) return undefined;
    return this.workspaces.get(id.toLowerCase());
  }

  public getAll(): ReadonlyArray<Readonly<WorkspaceMetadata>> {
    return Array.from(this.workspaces.values());
  }

  public getByDomain(domainId: string): ReadonlyArray<Readonly<WorkspaceMetadata>> {
    return this.getAll().filter((w) => w.domainId === domainId.toLowerCase());
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(): void {
    this.listeners.forEach((fn) => fn());
  }
}

export const WorkspaceRegistry = new WorkspaceRegistryService();
