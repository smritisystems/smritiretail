/**
 * Project      : SMRITI Retail OS
 * Module       : SXP v1.0 — Workspace Health Monitor
 * Standard     : SXP Constitution v1.0 — SXP-CS-010 (Performance Budget)
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Version      : 1.0.0
 * Created      : 2026-08-03
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 *
 * Visibility: ADVANCED mode only (adaptiveWorkspaceStore.canRender('diagnostics'))
 * Reports are published to WorkspaceEventBus every 30s.
 *
 * PERFORMANCE BUDGET (SWEF v1.0 — FROZEN):
 *   Workspace load:      < 500ms
 *   Widget render:       < 250ms
 *   Search results:      < 150ms
 *   Navigation:          < 100ms
 *   Action feedback:     <  50ms  (optimistic UI)
 */

import { WorkspaceEventBus } from "./WorkspaceEventBus.js";
import { adaptiveWorkspaceStore } from "./adaptive_workspace_store.js";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface WorkspaceHealthReport {
  workspaceId: string;
  capturedAt: string;
  renderTimeMs: number;
  widgetLoadTimesMs: Record<string, number>;
  apiLatencyMs: number;
  memoryUsageMb: number;
  /** Widgets exceeding 250ms budget */
  slowWidgets: string[];
  /** Navigation transitions exceeding 100ms */
  slowNavigations: number;
}

// ── Budget Constants ──────────────────────────────────────────────────────────

export const SXP_PERFORMANCE_BUDGET = Object.freeze({
  WORKSPACE_LOAD_MS: 500,
  WIDGET_RENDER_MS: 250,
  SEARCH_MS: 150,
  NAVIGATION_MS: 100,
  ACTION_FEEDBACK_MS: 50,
});

// ── Monitor ───────────────────────────────────────────────────────────────────

class WorkspaceHealthMonitorService {
  private reports: Map<string, WorkspaceHealthReport> = new Map();
  private widgetTimings: Map<string, number> = new Map();
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private currentWorkspaceId: string = "unknown";

  /** Start periodic reporting (every 30s) */
  public start(): void {
    if (this.intervalId) return;
    this.intervalId = setInterval(() => this.report(), 30_000);
  }

  /** Stop periodic reporting */
  public stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  public setActiveWorkspace(workspaceId: string): void {
    this.currentWorkspaceId = workspaceId;
    this.widgetTimings.clear();
  }

  /** Called by WidgetEngine when a widget finishes loading */
  public recordWidgetLoad(widgetId: string, durationMs: number): void {
    this.widgetTimings.set(widgetId, durationMs);
  }

  /** Capture and publish a health report (only published in ADVANCED mode) */
  public report(): void {
    if (!adaptiveWorkspaceStore.canRender("diagnostics")) return;

    const widgetLoadTimesMs: Record<string, number> = {};
    const slowWidgets: string[] = [];

    this.widgetTimings.forEach((ms, id) => {
      widgetLoadTimesMs[id] = ms;
      if (ms > SXP_PERFORMANCE_BUDGET.WIDGET_RENDER_MS) slowWidgets.push(id);
    });

    const memoryUsageMb =
      typeof performance !== "undefined" && (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory
        ? Math.round(
            (performance as unknown as { memory: { usedJSHeapSize: number } }).memory.usedJSHeapSize / 1_048_576
          )
        : 0;

    const healthReport: WorkspaceHealthReport = {
      workspaceId: this.currentWorkspaceId,
      capturedAt: new Date().toISOString(),
      renderTimeMs: 0, // set by WorkspaceShell via recordWorkspaceLoad()
      widgetLoadTimesMs,
      apiLatencyMs: 0, // future: wired from API fetch interceptor
      memoryUsageMb,
      slowWidgets,
      slowNavigations: 0,
    };

    this.reports.set(this.currentWorkspaceId, healthReport);
    WorkspaceEventBus.publish("HealthReport", healthReport, this.currentWorkspaceId);
  }

  public recordWorkspaceLoad(workspaceId: string, durationMs: number): void {
    const existing = this.reports.get(workspaceId);
    if (existing) {
      this.reports.set(workspaceId, { ...existing, renderTimeMs: durationMs });
    }
  }

  public getReport(workspaceId: string): WorkspaceHealthReport | undefined {
    return this.reports.get(workspaceId);
  }

  public getAllReports(): WorkspaceHealthReport[] {
    return Array.from(this.reports.values());
  }
}

export const WorkspaceHealthMonitor = new WorkspaceHealthMonitorService();
