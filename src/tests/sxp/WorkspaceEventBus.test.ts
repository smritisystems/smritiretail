/**
 * Unit Tests — WorkspaceEventBus
 * Framework : Vitest
 */
import { describe, it, expect, beforeEach } from "vitest";
import { WorkspaceEventBus } from "../../layout_engine/WorkspaceEventBus";

describe("WorkspaceEventBus", () => {
  beforeEach(() => {
    WorkspaceEventBus.clearAll();
  });

  it("publishes an event and delivers it to a subscriber", () => {
    let received: unknown = null;
    WorkspaceEventBus.subscribe("FilterChanged", (e) => { received = e; });

    const evt = WorkspaceEventBus.publish("FilterChanged", { field: "category", value: "Footwear" });

    expect(received).not.toBeNull();
    expect(evt.eventType).toBe("FilterChanged");
    expect((evt.payload as { field: string }).field).toBe("category");
  });

  it("does not deliver to unsubscribed handlers", () => {
    let called = false;
    const unsub = WorkspaceEventBus.subscribe("ThemeChanged", () => { called = true; });
    unsub();

    WorkspaceEventBus.publish("ThemeChanged", { theme: "dark" });
    expect(called).toBe(false);
  });

  it("delivers to multiple subscribers on the same event type", () => {
    const log: string[] = [];
    WorkspaceEventBus.subscribe("ModeChanged", () => log.push("A"));
    WorkspaceEventBus.subscribe("ModeChanged", () => log.push("B"));

    WorkspaceEventBus.publish("ModeChanged", { from: "SIMPLE", to: "HYBRID" });
    expect(log).toEqual(["A", "B"]);
  });

  it("sets sourceWorkspaceId when provided", () => {
    let src = "";
    WorkspaceEventBus.subscribe("ActionExecuted", (e) => { src = e.sourceWorkspaceId; });

    WorkspaceEventBus.publish("ActionExecuted", {}, "inventory.dashboard");
    expect(src).toBe("inventory.dashboard");
  });

  it("defaults sourceWorkspaceId to 'platform'", () => {
    let src = "";
    WorkspaceEventBus.subscribe("ActionExecuted", (e) => { src = e.sourceWorkspaceId; });

    WorkspaceEventBus.publish("ActionExecuted", {});
    expect(src).toBe("platform");
  });

  it("returns a frozen event object", () => {
    const evt = WorkspaceEventBus.publish("HealthReport", { ok: true });
    expect(Object.isFrozen(evt)).toBe(true);
  });

  it("clearAll removes all listeners", () => {
    let called = false;
    WorkspaceEventBus.subscribe("SyncCompleted", () => { called = true; });
    WorkspaceEventBus.clearAll();

    WorkspaceEventBus.publish("SyncCompleted", {});
    expect(called).toBe(false);
  });
});
