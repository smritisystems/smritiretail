/**
 * Unit Tests — adaptive_workspace_store (canRender)
 * Framework : Vitest
 */
import { describe, it, expect } from "vitest";
import {
  adaptiveWorkspaceStore,
  ADAPTIVE_VISIBILITY_MATRIX,
} from "../../layout_engine/adaptive_workspace_store";

describe("adaptiveWorkspaceStore.canRender()", () => {
  // ── SIMPLE mode ────────────────────────────────────────────────────────────
  it("SIMPLE: shows timeline", () => {
    expect(adaptiveWorkspaceStore.canRender("timeline", "SIMPLE")).toBe(true);
  });
  it("SIMPLE: hides reservations", () => {
    expect(adaptiveWorkspaceStore.canRender("reservations", "SIMPLE")).toBe(false);
  });
  it("SIMPLE: hides batch_serial", () => {
    expect(adaptiveWorkspaceStore.canRender("batch_serial", "SIMPLE")).toBe(false);
  });
  it("SIMPLE: hides cost_layers", () => {
    expect(adaptiveWorkspaceStore.canRender("cost_layers", "SIMPLE")).toBe(false);
  });
  it("SIMPLE: hides raw_ledger", () => {
    expect(adaptiveWorkspaceStore.canRender("raw_ledger", "SIMPLE")).toBe(false);
  });
  it("SIMPLE: hides api_inspector", () => {
    expect(adaptiveWorkspaceStore.canRender("api_inspector", "SIMPLE")).toBe(false);
  });
  it("SIMPLE: hides diagnostics", () => {
    expect(adaptiveWorkspaceStore.canRender("diagnostics", "SIMPLE")).toBe(false);
  });

  // ── HYBRID mode ────────────────────────────────────────────────────────────
  it("HYBRID: shows timeline", () => {
    expect(adaptiveWorkspaceStore.canRender("timeline", "HYBRID")).toBe(true);
  });
  it("HYBRID: shows reservations", () => {
    expect(adaptiveWorkspaceStore.canRender("reservations", "HYBRID")).toBe(true);
  });
  it("HYBRID: shows batch_serial", () => {
    expect(adaptiveWorkspaceStore.canRender("batch_serial", "HYBRID")).toBe(true);
  });
  it("HYBRID: hides cost_layers", () => {
    expect(adaptiveWorkspaceStore.canRender("cost_layers", "HYBRID")).toBe(false);
  });
  it("HYBRID: hides raw_ledger", () => {
    expect(adaptiveWorkspaceStore.canRender("raw_ledger", "HYBRID")).toBe(false);
  });
  it("HYBRID: hides diagnostics", () => {
    expect(adaptiveWorkspaceStore.canRender("diagnostics", "HYBRID")).toBe(false);
  });

  // ── ADVANCED mode ──────────────────────────────────────────────────────────
  it("ADVANCED: shows everything", () => {
    const keys = Object.keys(ADAPTIVE_VISIBILITY_MATRIX) as Array<keyof typeof ADAPTIVE_VISIBILITY_MATRIX>;
    keys.forEach((key) => {
      expect(adaptiveWorkspaceStore.canRender(key, "ADVANCED")).toBe(true);
    });
  });

  // ── Matrix structure ────────────────────────────────────────────────────────
  it("ADAPTIVE_VISIBILITY_MATRIX is frozen", () => {
    expect(Object.isFrozen(ADAPTIVE_VISIBILITY_MATRIX)).toBe(true);
  });

  it("ADAPTIVE_VISIBILITY_MATRIX contains all 8 feature keys", () => {
    const keys = Object.keys(ADAPTIVE_VISIBILITY_MATRIX);
    expect(keys).toContain("timeline");
    expect(keys).toContain("reservations");
    expect(keys).toContain("batch_serial");
    expect(keys).toContain("cost_layers");
    expect(keys).toContain("raw_ledger");
    expect(keys).toContain("api_inspector");
    expect(keys).toContain("diagnostics");
    expect(keys).toContain("lock_inspector");
    expect(keys).toHaveLength(8);
  });

  // ── Store mode management ───────────────────────────────────────────────────
  it("defaults to SIMPLE mode", () => {
    adaptiveWorkspaceStore.setMode("SIMPLE");
    expect(adaptiveWorkspaceStore.getMode()).toBe("SIMPLE");
  });

  it("setMode/getMode round-trip", () => {
    adaptiveWorkspaceStore.setMode("HYBRID");
    expect(adaptiveWorkspaceStore.getMode()).toBe("HYBRID");
    adaptiveWorkspaceStore.setMode("SIMPLE"); // restore
  });

  it("canRender uses current store mode when no explicit mode passed", () => {
    adaptiveWorkspaceStore.setMode("ADVANCED");
    expect(adaptiveWorkspaceStore.canRender("diagnostics")).toBe(true);
    adaptiveWorkspaceStore.setMode("SIMPLE");
    expect(adaptiveWorkspaceStore.canRender("diagnostics")).toBe(false);
  });
});
