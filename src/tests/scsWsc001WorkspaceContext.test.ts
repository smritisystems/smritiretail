/**
 * Project      : SMRITI Retail OS
 * Test Suite   : SCS-WSC-001 Workspace Context & Resolver Tests
 * Standard     : SCS-WSC-001 — Workspace Context & Resolver
 * Author       : Jawahar Ramkripal Mallah & Antigravity AI
 * Version      : 1.0.0
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 *
 * Covers:
 *   WSC-001  Immutable SPK.platform.current() and SPK.business.current()
 *   WSC-002  CapabilityRegistry platform capability assertions (batch, expiry, rfid, thermal)
 *   WSC-003  FeatureFlagRegistry company-scoped enablement
 *   WSC-004  PolicyRegistry operational business rules (negativeStockPolicy, maxDiscountPercent)
 *   WSC-005  SWC.switchWorkspaceContext updates context, feature flags, policies, and emits Workspace.Changed.v1 event
 */

import { describe, it, expect, vi } from "vitest";
import { SWC } from "../kernel/SWC.js";
import { SPK } from "../kernel/SPK.js";
import { CapabilityRegistry } from "../kernel/registries/CapabilityRegistry.js";
import { FeatureFlagRegistry } from "../kernel/registries/FeatureFlagRegistry.js";
import { PolicyRegistry } from "../kernel/registries/PolicyRegistry.js";

describe("SCS-WSC-001 Workspace Context & Resolver Tests (WSC-001 to WSC-005)", () => {
  it("WSC-001: SPK.platform.current() and SPK.business.current() return immutable readonly context objects", () => {
    const platform = SWC.platform.current();
    const business = SWC.business.current();

    expect(platform.userId).toBeDefined();
    expect(business.companyId).toBeDefined();

    // Verify immutability (frozen objects)
    expect(Object.isFrozen(platform)).toBe(true);
    expect(Object.isFrozen(business)).toBe(true);
  });

  it("WSC-002: CapabilityRegistry accurately asserts platform-wide technical capabilities", () => {
    expect(CapabilityRegistry.has("batch")).toBe(true);
    expect(CapabilityRegistry.has("expiry")).toBe(true);
    expect(CapabilityRegistry.has("barcode")).toBe(true);
    expect(CapabilityRegistry.has("thermal")).toBe(true);
    expect(CapabilityRegistry.has("unknown_capability")).toBe(false);

    const invCapabilities = CapabilityRegistry.getByCategory("Inventory");
    expect(invCapabilities.length).toBeGreaterThanOrEqual(4);
  });

  it("WSC-003: FeatureFlagRegistry evaluates company-scoped enablement scoped to platform capabilities", () => {
    FeatureFlagRegistry.setFlag("rfid", false);
    expect(FeatureFlagRegistry.isEnabled("rfid")).toBe(false);

    FeatureFlagRegistry.setFlag("batch", true);
    expect(FeatureFlagRegistry.isEnabled("batch")).toBe(true);
  });

  it("WSC-004: PolicyRegistry provides default operational policies and supports runtime updates", () => {
    expect(PolicyRegistry.get("negativeStockPolicy")).toBe("block");
    expect(PolicyRegistry.get("maxDiscountPercent")).toBe(20);

    PolicyRegistry.setPolicies({ maxDiscountPercent: 15, negativeStockPolicy: "warn" });

    expect(PolicyRegistry.get("maxDiscountPercent")).toBe(15);
    expect(PolicyRegistry.get("negativeStockPolicy")).toBe("warn");

    PolicyRegistry.resetToDefaults();
  });

  it("WSC-005: SWC.switchWorkspaceContext updates business context, feature flags, policies, and emits Workspace.Changed.v1 event", () => {
    const eventHandler = vi.fn();
    const unsub = SPK.events.on("Workspace.Changed.v1", eventHandler);

    SWC.switchWorkspaceContext({
      workspace: {
        tenantId: "tent-footwear",
        companyId: "comp-footwear-01",
        branchId: "br-andheri",
        warehouseId: "wh-andheri-main",
        financialYearId: "cfy-2026-2027",
        currency: "INR",
        timezone: "Asia/Kolkata",
        language: "en-IN",
      },
      permissions: ["sales.create", "inventory.transfer"],
      features: { rfid: true, batch: true },
      policies: { negativeStockPolicy: "allow", maxDiscountPercent: 25 },
      industryPack: { id: "footwear", name: "Footwear & Fashion Retail" },
      branding: { companyName: "SMRITI Footwear Pvt Ltd" },
    });

    const activeBiz = SWC.business.current();
    expect(activeBiz.companyId).toBe("comp-footwear-01");
    expect(activeBiz.branchId).toBe("br-andheri");
    expect(activeBiz.tenantId).toBe("tent-footwear");

    expect(PolicyRegistry.get("negativeStockPolicy")).toBe("allow");
    expect(PolicyRegistry.get("maxDiscountPercent")).toBe(25);

    expect(eventHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "Workspace.Changed.v1",
        entityId: "comp-footwear-01",
      })
    );

    unsub?.();
  });
});
