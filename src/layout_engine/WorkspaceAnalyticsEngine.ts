/**
 * Project      : SMRITI Retail OS
 * Module       : SXP v1.0 — Workspace Analytics Engine (WAE)
 * Standard     : SXP Constitution v1.0 / AOP-001 (AI Optionality)
 * Author       : Jawahar Ramkripal Mallah
 * Version      : 1.0.0
 * Created      : 2026-08-03
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 *
 * Captures anonymous usage metrics locally via WorkspaceEventBus.
 * No network calls — all data stays in localStorage.
 * AOP-001: Analytics are purely advisory. No automatic action or AI trigger.
 *
 * Metrics captured:
 *   - Action executions (actionId, workspaceId, mode, timestamp)
 *   - Workspace activations (workspaceId, domainId, timestamp)
 *   - Search queries (length only — never content, per privacy contract)
 *   - Mode switches (from, to, timestamp)
 *   - Session duration (per workspace)
 */

import { WorkspaceEventBus } from "./WorkspaceEventBus.js";

// ── Types ─────────────────────────────────────────────────────────────────────

export type AnalyticsEventType =
  | "action_executed"
  | "workspace_activated"
  | "search_performed"
  | "mode_switched"
  | "widget_rendered"
  | "error_boundary_triggered";

export interface AnalyticsEvent {
  id: string;
  type: AnalyticsEventType;
  workspaceId?: string;
  /** Never contains user content — only structural metadata */
  metadata: Record<string, string | number | boolean>;
  timestamp: string;
}

// ── Storage ───────────────────────────────────────────────────────────────────

const STORAGE_KEY = "sxp_analytics_v1";
const MAX_STORED_EVENTS = 500; // rolling window

// ── Engine ────────────────────────────────────────────────────────────────────

class WorkspaceAnalyticsEngineService {
  private sessionStartTimes: Map<string, number> = new Map();

  constructor() {
    this.subscribeToEventBus();
  }

  // ── EventBus subscription (passive — no manual track() calls needed in studios) ──

  private subscribeToEventBus(): void {
    // Capture workspace activations
    WorkspaceEventBus.subscribe("WorkspaceOpened", (event) => {
      const p = event.payload as { workspaceId?: string; domainId?: string };
      if (p.workspaceId) {
        this.sessionStartTimes.set(p.workspaceId, Date.now());
        this.record("workspace_activated", p.workspaceId, {
          domainId: p.domainId ?? "unknown",
        });
      }
    });

    // Capture action executions
    WorkspaceEventBus.subscribe("ActionExecuted", (event) => {
      const p = event.payload as { actionId?: string; workspaceId?: string; mode?: string; durationMs?: number };
      this.record("action_executed", p.workspaceId, {
        actionId: p.actionId ?? "unknown",
        mode: p.mode ?? "SIMPLE",
        durationMs: p.durationMs ?? 0,
      });
    });

    // Capture mode switches
    WorkspaceEventBus.subscribe("ModeChanged", (event) => {
      const p = event.payload as { from?: string; to?: string };
      this.record("mode_switched", undefined, {
        from: p.from ?? "SIMPLE",
        to: p.to ?? "HYBRID",
      });
    });
  }

  // ── Recording ─────────────────────────────────────────────────────────────

  /**
   * Record an analytics event locally.
   * Called internally by EventBus subscriptions.
   * Studios MUST NOT call this directly — use WorkspaceEventBus.publish() instead.
   */
  private record(
    type: AnalyticsEventType,
    workspaceId: string | undefined,
    metadata: Record<string, string | number | boolean>
  ): void {
    const event: AnalyticsEvent = {
      id: `wae-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type,
      workspaceId,
      metadata,
      timestamp: new Date().toISOString(),
    };

    const events = this.readEvents();
    events.push(event);

    // Rolling window — drop oldest when over limit
    if (events.length > MAX_STORED_EVENTS) {
      events.splice(0, events.length - MAX_STORED_EVENTS);
    }

    this.writeEvents(events);
  }

  /**
   * Manual track — for events not captured via EventBus.
   * For example: search performed (query length only, never content).
   */
  public track(
    type: AnalyticsEventType,
    workspaceId?: string,
    metadata: Record<string, string | number | boolean> = {}
  ): void {
    this.record(type, workspaceId, metadata);
  }

  // ── Storage ───────────────────────────────────────────────────────────────

  private readEvents(): AnalyticsEvent[] {
    if (typeof localStorage === "undefined") return [];
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]") as AnalyticsEvent[];
    } catch {
      return [];
    }
  }

  private writeEvents(events: AnalyticsEvent[]): void {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
  }

  // ── Queries ───────────────────────────────────────────────────────────────

  public getAll(): ReadonlyArray<AnalyticsEvent> {
    return this.readEvents();
  }

  public getByType(type: AnalyticsEventType): ReadonlyArray<AnalyticsEvent> {
    return this.readEvents().filter((e) => e.type === type);
  }

  /**
   * Top N most-used action IDs across all workspaces.
   * Used by CommandPalette to surface frequently used actions at top.
   */
  public getTopActions(n = 5): Array<{ actionId: string; count: number }> {
    const counts: Record<string, number> = {};
    this.getByType("action_executed").forEach((e) => {
      const id = String(e.metadata["actionId"] ?? "unknown");
      counts[id] = (counts[id] ?? 0) + 1;
    });
    return Object.entries(counts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, n)
      .map(([actionId, count]) => ({ actionId, count }));
  }

  /**
   * Average session duration per workspace (ms).
   * Populated when WorkspaceDeactivated event is fired.
   */
  public getAverageSessionDuration(workspaceId: string): number {
    const events = this.getByType("workspace_activated").filter(
      (e) => e.workspaceId === workspaceId && e.metadata["durationMs"]
    );
    if (!events.length) return 0;
    const total = events.reduce((sum, e) => sum + Number(e.metadata["durationMs"] ?? 0), 0);
    return Math.round(total / events.length);
  }

  /** Clear all analytics data (privacy / user request) */
  public clearAll(): void {
    if (typeof localStorage !== "undefined") {
      localStorage.removeItem(STORAGE_KEY);
    }
  }
}

export const WorkspaceAnalyticsEngine = new WorkspaceAnalyticsEngineService();
