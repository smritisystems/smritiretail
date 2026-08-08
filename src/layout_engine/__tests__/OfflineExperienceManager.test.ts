/**
 * Unit Tests — OfflineExperienceManager
 * Framework : Vitest
 *
 * NOTE: localStorage is mocked via vitest's jsdom environment.
 * WorkspaceEventBus is not mocked — real bus used (cleared between tests).
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

// Provide minimal localStorage before importing the manager
const store: Record<string, string> = {};
vi.stubGlobal("localStorage", {
  getItem: (k: string) => store[k] ?? null,
  setItem: (k: string, v: string) => { store[k] = v; },
  removeItem: (k: string) => { delete store[k]; },
  clear: () => { Object.keys(store).forEach((k) => delete store[k]); },
});

// Stub window.addEventListener (navigator.onLine checks)
vi.stubGlobal("window", { addEventListener: vi.fn() });

import { OfflineExperienceManager } from "../../layout_engine/OfflineExperienceManager";
import { WorkspaceEventBus } from "../../layout_engine/WorkspaceEventBus";

describe("OfflineExperienceManager", () => {
  beforeEach(() => {
    localStorage.clear();
    WorkspaceEventBus.clearAll();
  });

  it("enqueues an operation and returns it", () => {
    const op = OfflineExperienceManager.enqueue("sale", "pos.billing", { total: 500 });
    expect(op.id).toMatch(/^oem-/);
    expect(op.type).toBe("sale");
    expect(op.status).toBe("pending");
    expect(op.retryCount).toBe(0);
  });

  it("getPendingCount reflects queued items", () => {
    OfflineExperienceManager.enqueue("sale", "pos.billing", {});
    OfflineExperienceManager.enqueue("stock_receipt", "inventory.operations", {});
    expect(OfflineExperienceManager.getPendingCount()).toBe(2);
  });

  it("getQueue returns all enqueued operations", () => {
    OfflineExperienceManager.enqueue("payment", "pos.billing", {});
    const q = OfflineExperienceManager.getQueue();
    expect(q.length).toBeGreaterThanOrEqual(1);
    expect(q[q.length - 1].type).toBe("payment");
  });

  it("clearSynced removes only synced operations", () => {
    // Enqueue two operations and manually mark one as synced
    OfflineExperienceManager.enqueue("sale", "pos.billing", {});
    const key = "sxp_offline_queue_v1";
    const raw = JSON.parse(localStorage.getItem(key)!);
    raw[raw.length - 1].status = "synced";
    localStorage.setItem(key, JSON.stringify(raw));

    OfflineExperienceManager.enqueue("sale", "pos.billing", {});
    OfflineExperienceManager.clearSynced();

    const remaining = OfflineExperienceManager.getQueue();
    expect(remaining.every((op) => op.status !== "synced")).toBe(true);
  });

  it("syncAll calls the registered handler and marks op as synced", async () => {
    const handler = vi.fn().mockResolvedValue({ success: true });
    OfflineExperienceManager.registerHandler("stock_adjustment", handler);

    // Force online
    (OfflineExperienceManager as unknown as { isOnline: boolean }).isOnline = true;

    OfflineExperienceManager.enqueue("stock_adjustment", "inventory.operations", { qty: 5 });
    await OfflineExperienceManager.syncAll();

    expect(handler).toHaveBeenCalledOnce();
    const q = OfflineExperienceManager.getQueue();
    const op = q.find((o) => o.type === "stock_adjustment");
    expect(op?.status).toBe("synced");
  });

  it("syncAll marks op as failed when handler returns success:false", async () => {
    const handler = vi.fn().mockResolvedValue({ success: false, error: "Server error" });
    OfflineExperienceManager.registerHandler("stock_transfer", handler);

    (OfflineExperienceManager as unknown as { isOnline: boolean }).isOnline = true;

    OfflineExperienceManager.enqueue("stock_transfer", "inventory.operations", {});
    await OfflineExperienceManager.syncAll();

    const q = OfflineExperienceManager.getQueue();
    const op = q.find((o) => o.type === "stock_transfer");
    expect(op?.status).toBe("failed");
    expect(op?.failureReason).toBe("Server error");
  });

  it("publishes SyncCompleted event on enqueue", () => {
    let fired = false;
    WorkspaceEventBus.subscribe("SyncCompleted", () => { fired = true; });

    OfflineExperienceManager.enqueue("sale", "pos.billing", {});
    expect(fired).toBe(true);
  });
});
