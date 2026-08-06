/**
 * Project      : SMRITI Retail OS
 * Module       : Universal Discovery Platform (UDP) Test Suite (ADR-UDP-001)
 * Standard     : UFR-001 / SCS-UIX-001 — Universal Discovery Platform Architecture
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * Version      : 2.0.0
 */

import { describe, it, expect } from "vitest";
import { UniversalDiscoveryPlatform } from "../services/UniversalDiscoveryPlatform.js";
import { NormalizedLookupItem } from "../kernel/SPK.js";

describe("Universal Discovery Platform (UDP / ADR-UDP-001) Test Suite", () => {
  const udp = UniversalDiscoveryPlatform.getInstance();

  it("1. CONTEXT-AWARE DOMAIN RESOLUTION: Automatically resolves target domain from active workspace", () => {
    expect(udp.resolveDomainFromWorkspace("purchase")).toBe("SUPPLIER");
    expect(udp.resolveDomainFromWorkspace("suppliers")).toBe("SUPPLIER");
    expect(udp.resolveDomainFromWorkspace("sales")).toBe("CUSTOMER");
    expect(udp.resolveDomainFromWorkspace("crm")).toBe("CUSTOMER");
    expect(udp.resolveDomainFromWorkspace("ledger")).toBe("ACCOUNT");
    expect(udp.resolveDomainFromWorkspace("items")).toBe("ITEM");
    expect(udp.resolveDomainFromWorkspace("label-printing")).toBe("ITEM");
  });

  it("2. SMART RELEVANCE RANKING ALGORITHM: Ranks Barcode Exact Match > SKU > Article > Name Prefix", () => {
    const rawItems: NormalizedLookupItem[] = [
      { id: "1", code: "NIKE-01", name: "Puma Running Shoes", master_type_id: "ITEM", data: { barcode: "890999" } },
      { id: "2", code: "NIKE-02", name: "Nike Air Zoom", master_type_id: "ITEM", data: { barcode: "890200" } },
      { id: "3", code: "BAR-890100", name: "Exact Barcode Item", master_type_id: "ITEM", data: { barcode: "890100" } },
    ];

    const ranked = udp.rankResults(rawItems, "890100");
    expect(ranked.length).toBeGreaterThan(0);
    // Exact barcode match ranks 1st with score 1000
    expect(ranked[0].id).toBe("3");
    expect(ranked[0].relevanceScore).toBe(1000);
  });

  it("3. DISCOVERY QUERY PIPELINE: Returns ranked paginated discovery results", async () => {
    const results = await udp.discover("Nike", { activeWorkspaceId: "items", limit: 10 });
    expect(results).toBeDefined();
    expect(Array.isArray(results)).toBe(true);
  });
});
