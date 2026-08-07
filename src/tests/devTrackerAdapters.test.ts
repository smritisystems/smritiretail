/**
 * Project      : SMRITI Retail OS
 * Module       : Scanner Development Standard (SDS v2.3 / PBC-001)
 * Description  : Unit tests for Navigation, Route, and Permission Adapters
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 */

import { describe, expect, it } from "vitest";
import { AdapterRegistry } from "../modules/dev_tracker/scanner/adapters/AdapterRegistry.ts";
import { NavigationAdapter } from "../modules/dev_tracker/scanner/adapters/NavigationAdapter.ts";
import { RouteAdapter } from "../modules/dev_tracker/scanner/adapters/RouteAdapter.ts";
import { PermissionAdapter } from "../modules/dev_tracker/scanner/adapters/PermissionAdapter.ts";
import { EvidenceGraphContainer } from "../modules/dev_tracker/scanner/adapters/EvidenceGraph.ts";

describe("DevTracker Scanner Adapters (PBC-001 Navigation & Security)", () => {
  it("should register NavigationAdapter, RouteAdapter, and PermissionAdapter in AdapterRegistry", () => {
    const registry = new AdapterRegistry();
    const adapters = registry.getAdapters();

    const adapterIds = adapters.map((a) => a.id);
    expect(adapterIds).toContain("navigation-adapter");
    expect(adapterIds).toContain("route-adapter");
    expect(adapterIds).toContain("permission-adapter");
  });

  it("NavigationAdapter should extract navigation evidence from source content", () => {
    const adapter = new NavigationAdapter();
    expect(adapter.canHandle("src/kernel/upr/navigation/NavigationRegistry.ts")).toBe(true);

    const sampleContent = `
      export const NAV_IDS = {
        ITEM_MASTER: "NAV_ITEM_MASTER",
        SALES_INVOICE: "NAV_SALES_INVOICE"
      };
      NavigationRegistry.registerDomain({ id: "sales" });
    `;

    const items = adapter.extract("src/kernel/upr/navigation/NavigationRegistry.ts", sampleContent);
    expect(items.length).toBeGreaterThan(0);
    expect(items.some((i) => i.symbol.includes("NAV_ITEM_MASTER"))).toBe(true);
  });

  it("RouteAdapter should extract route and targetTab mappings", () => {
    const adapter = new RouteAdapter();
    expect(adapter.canHandle("src/workspaces/PlatformControlCenterWorkspace.tsx")).toBe(true);

    const sampleContent = `
      const module = { route: "/sales/invoice", targetTab: "sales-tab" };
    `;

    const items = adapter.extract("src/workspaces/PlatformControlCenterWorkspace.tsx", sampleContent);
    expect(items.length).toBeGreaterThan(0);
    expect(items.some((i) => i.symbol.includes("/sales/invoice"))).toBe(true);
  });

  it("PermissionAdapter should extract security permissions", () => {
    const adapter = new PermissionAdapter();
    expect(adapter.canHandle("src/kernel/upr/security/PermissionRegistry.ts")).toBe(true);

    const sampleContent = `
      const m = { permission: "sales.create" };
    `;

    const items = adapter.extract("src/kernel/upr/security/PermissionRegistry.ts", sampleContent);
    expect(items.length).toBeGreaterThan(0);
    expect(items.some((i) => i.symbol.includes("sales.create"))).toBe(true);
  });

  it("AdapterRegistry should execute all registered adapters against file map", () => {
    const registry = new AdapterRegistry();
    const evidenceGraph = new EvidenceGraphContainer();

    const fileMap = new Map<string, string>([
      ["src/kernel/upr/navigation/NavigationRegistry.ts", `const NAV_IDS = { POS: "NAV_POS" };`],
      ["src/workspaces/SalesWorkspace.tsx", `const r = { route: "/sales/pos", targetTab: "pos" };`],
      ["src/kernel/upr/security/PermissionRegistry.ts", `const p = { permission: "pos.access" };`]
    ]);

    registry.executeAll(fileMap, evidenceGraph);
    const health = registry.getHealth();
    expect(health.length).toBeGreaterThanOrEqual(7);

    const navHealth = health.find((h) => h.adapterId === "navigation-adapter");
    expect(navHealth?.evidenceExtracted).toBeGreaterThan(0);
  });
});
