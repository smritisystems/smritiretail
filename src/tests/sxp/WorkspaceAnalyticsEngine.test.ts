/**
 * Unit Tests — WorkspaceAnalyticsEngine
 * Framework : Vitest
 *
 * Key constraints:
 *  - Engine uses localStorage internally; must be stubbed before import
 *  - Engine subscribes to EventBus in constructor; NEVER call
 *    WorkspaceEventBus.clearAll() — that drops the subscriptions
 *  - ReadonlyArray<T> is compile-time only; runtime array has .push
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

// ── Stub localStorage BEFORE importing the engine ─────────────────────────────
const store: Record<string, string> = {};
vi.stubGlobal("localStorage", {
  getItem: (k: string) => store[k] ?? null,
  setItem: (k: string, v: string) => { store[k] = v; },
  removeItem: (k: string) => { delete store[k]; },
  clear: () => { Object.keys(store).forEach((k) => delete store[k]); },
});

import { WorkspaceAnalyticsEngine } from "../../layout_engine/WorkspaceAnalyticsEngine";
import { WorkspaceEventBus } from "../../layout_engine/WorkspaceEventBus";

beforeEach(() => {
  // Only clear analytics data — never clearAll() the bus (drops engine subscriptions)
  WorkspaceAnalyticsEngine.clearAll();
});

describe("WorkspaceAnalyticsEngine", () => {
  // ── track() ────────────────────────────────────────────────────────────────
  it("track() records an event and getAll() returns it", () => {
    WorkspaceAnalyticsEngine.track("action_executed", "pos.billing", { actionId: "pos.checkout" });
    const all = WorkspaceAnalyticsEngine.getAll();
    expect(all.length).toBeGreaterThanOrEqual(1);
    expect(all.some((e) => e.type === "action_executed")).toBe(true);
  });

  it("track() stores workspaceId correctly", () => {
    WorkspaceAnalyticsEngine.track("workspace_activated", "inventory.dashboard");
    const all = WorkspaceAnalyticsEngine.getAll();
    expect(all.some((e) => e.workspaceId === "inventory.dashboard")).toBe(true);
  });

  it("track() stores metadata correctly", () => {
    WorkspaceAnalyticsEngine.track("mode_switched", undefined, { from: "SIMPLE", to: "HYBRID" });
    const events = WorkspaceAnalyticsEngine.getByType("mode_switched");
    expect(events.length).toBeGreaterThanOrEqual(1);
    expect(events[events.length - 1].metadata.from).toBe("SIMPLE");
    expect(events[events.length - 1].metadata.to).toBe("HYBRID");
  });

  // ── getByType() ────────────────────────────────────────────────────────────
  it("getByType() returns only events of the requested type", () => {
    WorkspaceAnalyticsEngine.track("workspace_activated", "inventory.dashboard");
    WorkspaceAnalyticsEngine.track("action_executed", "pos.billing", { actionId: "pos.new_bill" });
    const activated = WorkspaceAnalyticsEngine.getByType("workspace_activated");
    expect(activated.every((e) => e.type === "workspace_activated")).toBe(true);
  });

  it("getByType() returns empty array when no matching events", () => {
    const results = WorkspaceAnalyticsEngine.getByType("mode_switched");
    expect(results).toHaveLength(0);
  });

  // ── getTopActions() ────────────────────────────────────────────────────────
  it("getTopActions() returns sorted action counts descending", () => {
    WorkspaceAnalyticsEngine.track("action_executed", "pos.billing", { actionId: "pos.checkout" });
    WorkspaceAnalyticsEngine.track("action_executed", "pos.billing", { actionId: "pos.checkout" });
    WorkspaceAnalyticsEngine.track("action_executed", "pos.billing", { actionId: "pos.new_bill" });
    const top = WorkspaceAnalyticsEngine.getTopActions(5);
    expect(top.length).toBe(2);
    expect(top[0].actionId).toBe("pos.checkout");
    expect(top[0].count).toBe(2);
    expect(top[1].count).toBe(1);
  });

  it("getTopActions(n) respects the n limit", () => {
    WorkspaceAnalyticsEngine.track("action_executed", "pos.billing", { actionId: "pos.checkout" });
    WorkspaceAnalyticsEngine.track("action_executed", "pos.billing", { actionId: "pos.new_bill" });
    WorkspaceAnalyticsEngine.track("action_executed", "pos.billing", { actionId: "pos.return" });
    const top = WorkspaceAnalyticsEngine.getTopActions(2);
    expect(top.length).toBeLessThanOrEqual(2);
  });

  it("getTopActions() returns empty array when no actions recorded", () => {
    expect(WorkspaceAnalyticsEngine.getTopActions(5)).toEqual([]);
  });

  // ── getAverageSessionDuration() ────────────────────────────────────────────
  it("getAverageSessionDuration() returns 0 for unknown workspace", () => {
    expect(WorkspaceAnalyticsEngine.getAverageSessionDuration("unknown.workspace")).toBe(0);
  });

  it("getAverageSessionDuration() returns 0 when no durationMs metadata", () => {
    WorkspaceAnalyticsEngine.track("workspace_activated", "sales.orders");
    expect(WorkspaceAnalyticsEngine.getAverageSessionDuration("sales.orders")).toBe(0);
  });

  it("getAverageSessionDuration() averages durationMs values", () => {
    WorkspaceAnalyticsEngine.track("workspace_activated", "sales.orders", { durationMs: 1000 });
    WorkspaceAnalyticsEngine.track("workspace_activated", "sales.orders", { durationMs: 3000 });
    expect(WorkspaceAnalyticsEngine.getAverageSessionDuration("sales.orders")).toBe(2000);
  });

  // ── clearAll() ─────────────────────────────────────────────────────────────
  it("clearAll() empties the event log", () => {
    WorkspaceAnalyticsEngine.track("action_executed", "inventory.operations", { actionId: "inventory.receive" });
    WorkspaceAnalyticsEngine.clearAll();
    expect(WorkspaceAnalyticsEngine.getAll().length).toBe(0);
  });

  // ── EventBus passive recording ──────────────────────────────────────────────
  it("records workspace_activated when WorkspaceOpened event fires", () => {
    WorkspaceEventBus.publish("WorkspaceOpened", { workspaceId: "sales.orders", mode: "HYBRID" });
    const events = WorkspaceAnalyticsEngine.getByType("workspace_activated");
    expect(events.length).toBeGreaterThanOrEqual(1);
    expect(events.some((e) => e.workspaceId === "sales.orders")).toBe(true);
  });

  it("records action_executed when ActionExecuted event fires", () => {
    WorkspaceEventBus.publish("ActionExecuted", { actionId: "pos.checkout", workspaceId: "pos.billing" });
    const events = WorkspaceAnalyticsEngine.getByType("action_executed");
    expect(events.length).toBeGreaterThanOrEqual(1);
  });

  it("records mode_switched metadata when ModeChanged event fires", () => {
    WorkspaceEventBus.publish("ModeChanged", { from: "SIMPLE", to: "ADVANCED" });
    const switched = WorkspaceAnalyticsEngine.getByType("mode_switched");
    expect(switched.length).toBeGreaterThanOrEqual(1);
    expect(switched[switched.length - 1].metadata.to).toBe("ADVANCED");
  });
});
