/**
 * Project      : SMRITI Application Platform (SMAP) v1.0
 * Module       : Universal Configuration Registry (UCR Phase 3 Core) Unit Tests
 * Standard     : SMAP Constitution v1.0 — Rule SAP-018 & UCR Standard v1.0 Compliance
 * Author       : Jawahar Ramkripal Mallah
 * License      : Proprietary Commercial Software
 */

import { describe, expect, it } from "vitest";
import { SPK } from "../kernel/SPK.js";
import { createPlatformContext } from "../kernel/context/PlatformContext.js";

describe("Universal Configuration Registry (UCR Phase 3 Core)", () => {
  it("should create immutable PlatformContext with defaults and overrides", () => {
    const ctx = createPlatformContext({ storeId: "store-99" });
    expect(ctx.tenantId).toBe("smriti-default");
    expect(ctx.storeId).toBe("store-99");
    expect(ctx.currency).toBe("INR");
    expect(Object.isFrozen(ctx)).toBe(true);
  });

  it("should return branding metadata and support branding updates", () => {
    const branding = SPK.configuration.branding.getBranding();
    expect(branding.appTitle).toBe("SMRITI Retail OS");

    SPK.configuration.branding.updateBranding({ appTitle: "SMRITI Enterprise OS" });
    const updated = SPK.configuration.branding.getBranding();
    expect(updated.appTitle).toBe("SMRITI Enterprise OS");
  });

  it("should format currency according to regional configuration", () => {
    const regional = SPK.configuration.regional.getConfig();
    expect(regional.defaultCurrency).toBe("INR");

    const formatted = SPK.configuration.regional.formatCurrency(1250.50);
    expect(formatted).toContain("1,250.50");
  });

  it("should store and retrieve user and tenant preferences", () => {
    const autoPrint = SPK.configuration.preferences.getPreference<boolean>("pos.autoPrintReceipt");
    expect(autoPrint).toBe(true);

    SPK.configuration.preferences.setPreference("user.sidebarCollapsed", true, "user");
    const collapsed = SPK.configuration.preferences.getPreference<boolean>("user.sidebarCollapsed");
    expect(collapsed).toBe(true);
  });

  it("should return environment configuration", () => {
    const env = SPK.configuration.environment.getConfig();
    expect(env.environmentName).toBe("production");
    expect(env.isOfflineCapable).toBe(true);
  });
});
