/**
 * Unit Tests — GlobalSearchEngine
 * Framework : Vitest
 */
import { describe, it, expect, beforeEach } from "vitest";
import { GlobalSearchEngine } from "../../layout_engine/GlobalSearchEngine";
import { WorkspaceRegistry } from "../../layout_engine/WorkspaceRegistry";
import { WorkspaceActionRegistry } from "../../layout_engine/WorkspaceActionRegistry";

beforeEach(() => {
  // Seed a deterministic workspace
  WorkspaceRegistry.register({
    id: "test.gse_workspace",
    title: "GSE Test Workspace",
    icon: "🔍",
    domainId: "test",
    adaptiveModes: ["SIMPLE", "HYBRID", "ADVANCED"],
    defaultLayout: "scroll",
    zone: "operator",
    mobileEnabled: false,
    actions: [],
    widgets: [],
  });

  // Seed a deterministic action
  WorkspaceActionRegistry.register({
    id: "test.gse_action",
    label: "GSE Test Action",
    icon: "⚡",
    adaptiveVisibility: ["SIMPLE", "HYBRID", "ADVANCED"],
    canExecute: () => true,
    async execute() { return { success: true }; },
  });
});

describe("GlobalSearchEngine", () => {
  it("returns workspace results matching query", async () => {
    const results = await GlobalSearchEngine.search("GSE Test Workspace");
    // Engine prefixes workspace ids with "ws:"
    const ws = results.find((r) => r.id === "ws:test.gse_workspace");
    expect(ws).toBeDefined();
    expect(ws?.type).toBe("workspace");
    expect(ws?.title).toContain("GSE Test Workspace");
  });

  it("returns action results matching query", async () => {
    const results = await GlobalSearchEngine.search("GSE Test Action");
    // Engine prefixes action ids with "action:"
    const action = results.find((r) => r.id === "action:test.gse_action");
    expect(action).toBeDefined();
    expect(action?.type).toBe("action");
  });

  it("returns empty array for blank query", async () => {
    const results = await GlobalSearchEngine.search("   ");
    expect(results).toEqual([]);
  });

  it("search is case-insensitive", async () => {
    const results = await GlobalSearchEngine.search("gse test workspace");
    const ws = results.find((r) => r.id === "ws:test.gse_workspace");
    expect(ws).toBeDefined();
  });

  it("getSources() includes built-in workspaces and actions sources", () => {
    const sources = GlobalSearchEngine.getSources();
    expect(sources).toContain("workspaces");
    expect(sources).toContain("actions");
  });

  it("registerSource() adds a pluggable provider", async () => {
    let providerCalled = false;
    GlobalSearchEngine.registerSource({
      id: "test_custom_source",
      label: "Test Custom",
      async search(query) {
        providerCalled = true;
        return [{
          id: "custom-1",
          type: "custom" as const,
          title: `Custom: ${query}`,
          icon: "🧩",
          onSelect: () => {},
        }];
      },
    });

    const results = await GlobalSearchEngine.search("anything");
    expect(providerCalled).toBe(true);
    expect(results.find((r) => r.id === "custom-1")).toBeDefined();

    GlobalSearchEngine.unregisterSource("test_custom_source");
  });

  it("unregisterSource() removes the source", async () => {
    let called = false;
    GlobalSearchEngine.registerSource({
      id: "temp_source",
      label: "Temp",
      async search() {
        called = true;
        return [];
      },
    });
    GlobalSearchEngine.unregisterSource("temp_source");

    await GlobalSearchEngine.search("test");
    expect(called).toBe(false);
  });

  it("results are sorted: actions before workspaces", async () => {
    const results = await GlobalSearchEngine.search("GSE Test");
    const actionIdx = results.findIndex((r) => r.type === "action");
    const wsIdx = results.findIndex((r) => r.type === "workspace");
    if (actionIdx !== -1 && wsIdx !== -1) {
      expect(actionIdx).toBeLessThan(wsIdx);
    }
  });
});
