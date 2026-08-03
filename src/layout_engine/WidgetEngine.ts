/**
 * Project      : SMRITI Retail OS
 * Module       : SXP v1.0 — Widget Engine
 * Standard     : SXP Constitution v1.0 / UDR-002 / SWEF v1.0
 * Author       : Jawahar Ramkripal Mallah
 * Version      : 1.0.0
 * Created      : 2026-08-03
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 *
 * DashboardRegistry = the metadata store.
 * WidgetEngine      = lifecycle management layer over DashboardRegistry.
 *
 * Widget Marketplace principle:
 *   Future modules add WidgetType entries to DashboardRegistry.
 *   WidgetEngine renders all registered types without modification.
 */

import { DashboardRegistry, DashboardWidget, WidgetGroup } from "../kernel/upr/dashboard/DashboardRegistry.js";
import { adaptiveWorkspaceStore, WorkspaceMode } from "./adaptive_workspace_store.js";
import { WorkspaceEventBus } from "./WorkspaceEventBus.js";
import { WorkspaceHealthMonitor } from "./WorkspaceHealthMonitor.js";

// ── Widget Lifecycle Contract ─────────────────────────────────────────────────

export interface WidgetContract {
  id: string;
  /** Async refresh — pull latest data and re-render */
  refresh(): Promise<void>;
  /** Called when the widget container is resized */
  resize(cols: number, rows: number): void;
  /** SPK.security permission IDs this widget requires */
  permissions(): string[];
  /** Modes in which this widget is visible */
  adaptiveMode(): WorkspaceMode[];
  /** Called on WorkspaceEventBus events this widget is interested in */
  onEvent?(event: { eventType: string; payload: unknown }): void;
  /** Must be called on component unmount — cleans up subscriptions and timers */
  destroy(): void;
}

// ── Engine ────────────────────────────────────────────────────────────────────

class WidgetEngineService {
  private readonly liveWidgets: Map<string, WidgetContract> = new Map();

  /** Register a live widget instance (called by widget component on mount) */
  public mount(widget: WidgetContract): void {
    this.liveWidgets.set(widget.id, widget);

    const startTime = Date.now();

    widget.refresh().then(() => {
      const loadMs = Date.now() - startTime;
      WorkspaceHealthMonitor.recordWidgetLoad(widget.id, loadMs);
      WorkspaceEventBus.publish("WidgetLoaded", { widgetId: widget.id, loadMs }, widget.id);
    }).catch((err) => {
      console.error(`[WidgetEngine] Widget '${widget.id}' failed to load:`, err);
    });
  }

  /** Called on widget unmount */
  public unmount(widgetId: string): void {
    const widget = this.liveWidgets.get(widgetId);
    if (widget) {
      widget.destroy();
      this.liveWidgets.delete(widgetId);
    }
  }

  /** Refresh a specific widget by ID */
  public async refresh(widgetId: string): Promise<void> {
    const widget = this.liveWidgets.get(widgetId);
    if (widget) {
      await widget.refresh();
      WorkspaceEventBus.publish("WidgetRefreshed", { widgetId }, widgetId);
    }
  }

  /** Refresh all mounted widgets */
  public async refreshAll(): Promise<void> {
    await Promise.all(
      Array.from(this.liveWidgets.values()).map((w) => w.refresh())
    );
  }

  /**
   * Get widgets for a dashboard, filtered by current adaptive mode.
   * Used by InventoryDashboardWorkspace and other studio dashboards.
   */
  public getVisibleWidgets(dashboardId: string, mode?: WorkspaceMode): DashboardWidget[] {
    const dashboard = DashboardRegistry.getDashboard(dashboardId);
    if (!dashboard) return [];

    const effectiveMode = mode ?? adaptiveWorkspaceStore.getMode();

    return dashboard.widgets.filter((widget) => {
      if (!widget.adaptiveVisibility) return true; // undefined = visible in all modes
      return widget.adaptiveVisibility.includes(effectiveMode);
    });
  }

  /**
   * Get widgets for a dashboard grouped by widgetGroup.
   * Returns a Map<WidgetGroup, DashboardWidget[]>.
   */
  public getWidgetsByGroup(
    dashboardId: string,
    mode?: WorkspaceMode
  ): Map<WidgetGroup | "ungrouped", DashboardWidget[]> {
    const widgets = this.getVisibleWidgets(dashboardId, mode);
    const groups = new Map<WidgetGroup | "ungrouped", DashboardWidget[]>();

    widgets.forEach((widget) => {
      const key = widget.widgetGroup ?? "ungrouped";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(widget);
    });

    return groups;
  }
}

export const WidgetEngine = new WidgetEngineService();
