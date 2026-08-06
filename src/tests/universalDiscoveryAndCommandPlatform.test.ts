/**
 * Project      : SMRITI Retail OS
 * Module       : Universal Discovery & Command Platform (UDCP) Test Suite (ADR-UDP-002)
 * Standard     : UFR-001 / SCS-UIX-001 — UDCP Architecture Test Suite
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * Version      : 3.0.0
 */

import { describe, it, expect } from "vitest";
import { UniversalDiscoveryAndCommandPlatform, IDiscoveryProvider } from "../services/UniversalDiscoveryAndCommandPlatform.js";
import { ILookupItem } from "../kernel/SPK.js";

describe("Universal Discovery & Command Platform (UDCP / ADR-UDP-002) Test Suite", () => {
  const udcp = UniversalDiscoveryAndCommandPlatform.getInstance();

  it("1. CONTROL-AWARE CONTEXT RESOLUTION: Prioritizes active focused field control over workspace", () => {
    expect(udcp.resolveDomainFromContext({ targetFieldId: "customer_id", activeWorkspaceId: "items" })).toBe("CUSTOMER");
    expect(udcp.resolveDomainFromContext({ targetFieldId: "vendor_supplier_id", activeWorkspaceId: "sales" })).toBe("SUPPLIER");
    expect(udcp.resolveDomainFromContext({ targetFieldId: "ledger_account_id" })).toBe("ACCOUNT");
    expect(udcp.resolveDomainFromContext({ targetFieldId: "barcode_scan" })).toBe("ITEM");
  });

  it("2. PROVIDER PLUGIN ARCHITECTURE: Allows custom Industry Pack & AI discovery providers", async () => {
    const mockMedicalProvider: IDiscoveryProvider = {
      domain: "ITEM",
      async search(query: string) {
        return [
          { id: "batch-101", code: "MED-101", name: "Paracetamol 500mg Batch 101", type: "ITEM", metadata: { barcode: "890555" } },
        ];
      },
    };

    udcp.registerProvider("ITEM", mockMedicalProvider);
    const results = await udcp.discover("Paracetamol", { activeWorkspaceId: "items" });
    expect(results.length).toBe(1);
    expect(results[0].title).toContain("Paracetamol");
  });

  it("3. DISCOVERY MEMORY & LOCAL USAGE BOOSTING: Boosts score for frequently selected records", () => {
    const rawItems: ILookupItem[] = [
      { id: "item-a", code: "A1", name: "Item Alpha", type: "ITEM", metadata: {} },
      { id: "item-b", code: "B1", name: "Item Beta", type: "ITEM", metadata: {} },
    ];

    // Record 3 selections for item-b
    udcp.recordSelection("item-b");
    udcp.recordSelection("item-b");
    udcp.recordSelection("item-b");

    const ranked = udcp.rankResults(rawItems);
    expect(ranked[0].id).toBe("item-b"); // Boosted by discovery memory store
    expect(ranked[0].frequentlyUsedCount).toBe(3);
  });

  it("4. COMMAND PALETTE INSTANT ACTIONS: Attaches executable command actions to results", () => {
    const rawItems: ILookupItem[] = [
      { id: "nike-01", code: "NK-01", name: "Nike Air Max", type: "ITEM", metadata: {} },
    ];

    const ranked = udcp.rankResults(rawItems, "Nike");
    expect(ranked[0].actions).toBeDefined();
    expect(ranked[0].actions.length).toBeGreaterThanOrEqual(3);
    expect(ranked[0].actions.map((a) => a.id)).toContain("open");
    expect(ranked[0].actions.map((a) => a.id)).toContain("print");
    expect(ranked[0].actions.map((a) => a.id)).toContain("stock");
  });
});
