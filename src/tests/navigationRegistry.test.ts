/**
 * Project      : SMRITI Application Platform (SMAP) v1.0
 * Module       : Universal Platform Registry (UPR) — NavigationRegistry Unit Tests
 * Standard     : SMAP Constitution v1.0 — Rule SAP-018 & WNG-005 Compliance Test
 * Author       : Jawahar Ramkripal Mallah
 * License      : Proprietary Commercial Software
 */

import { describe, expect, it, beforeEach } from "vitest";
import { NavigationRegistry, type DomainDefinition } from "../kernel/upr/navigation/NavigationRegistry.js";

describe("NavigationRegistry (UPR Metadata Service)", () => {
  beforeEach(() => {
    NavigationRegistry.clear();
  });

  it("should seed default enterprise domains (sales, inventory, purchase, accounting, crm, reports)", () => {
    const domains = NavigationRegistry.getDomains();
    expect(domains.length).toBeGreaterThanOrEqual(7);
    const domainIds = domains.map((d) => d.id);
    expect(domainIds).toContain("all");
    expect(domainIds).toContain("sales");
    expect(domainIds).toContain("inventory");
    expect(domainIds).toContain("purchase");
    expect(domainIds).toContain("accounting");
    expect(domainIds).toContain("crm");
    expect(domainIds).toContain("reports");
  });

  it("should return correct module workspace IDs for active domain", () => {
    const salesModules = NavigationRegistry.getModuleIdsForDomain("sales");
    expect(salesModules.some((m) => m.toLowerCase().includes("billing") || m.toLowerCase().includes("pos"))).toBe(true);

    const inventoryModules = NavigationRegistry.getModuleIdsForDomain("inventory");
    expect(inventoryModules.some((m) => m.toLowerCase().includes("item"))).toBe(true);
  });

  it("should allow dynamic registration of plugin domains (e.g. Jewellery, Restaurant, Medical)", () => {
    const jewelleryDomain: DomainDefinition = {
      id: "jewellery",
      label: "Jewellery Industry Pack",
      icon: "diamond",
      emoji: "💎",
      order: 10,
      moduleIds: ["jewellery-master", "metal-rates", "making-charges"]
    };

    NavigationRegistry.registerDomain(jewelleryDomain);

    const dom = NavigationRegistry.getDomain("jewellery");
    expect(dom).toBeDefined();
    expect(dom?.label).toBe("Jewellery Industry Pack");

    const sidebar = NavigationRegistry.getSidebar("jewellery");
    expect(sidebar.moduleIds).toEqual(["jewellery-master", "metal-rates", "making-charges"]);
  });

  it("should notify subscribers when domain metadata is updated", () => {
    let updates = 0;
    const unsubscribe = NavigationRegistry.subscribe(() => {
      updates += 1;
    });

    NavigationRegistry.registerDomain({
      id: "restaurant",
      label: "Restaurant Domain",
      icon: "restaurant",
      emoji: "🍽️",
      order: 12,
      moduleIds: ["table-billing", "kitchen-display"]
    });

    expect(updates).toBe(1);
    unsubscribe();
  });

  it("should compute platform integrity scorecard and navigation health report", () => {
    const audit = NavigationRegistry.auditPlatformIntegrity();
    expect(audit).toBeDefined();
    expect(audit.overallScore).toBeGreaterThan(0);
    expect(audit.status).toBeDefined();
    expect(audit.categories.length).toBeGreaterThan(0);

    const health = NavigationRegistry.health();
    expect(health).toBeDefined();
    expect(health.status).toBeDefined();
    expect(health.totalModules).toBeGreaterThan(0);
  });
});
