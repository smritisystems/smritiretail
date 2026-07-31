/**
 * Project      : SMRITI Application Platform (SMAP) v1.0
 * Module       : Universal Security Registry (USR Phase 2 Core) Unit Tests
 * Standard     : SMAP Constitution v1.0 — Rule SAP-018 & USR Standard v1.0 Compliance
 * Author       : Jawahar Ramkripal Mallah
 * License      : Proprietary Commercial Software
 */

import { describe, expect, it, beforeEach } from "vitest";
import { SPK } from "../kernel/SPK.js";
import { PermissionRegistry, type PermissionDefinition } from "../kernel/upr/security/PermissionRegistry.js";
import { RoleRegistry, type RoleDefinition } from "../kernel/upr/security/RoleRegistry.js";

describe("Universal Security Registry (USR Phase 2 Core)", () => {
  beforeEach(() => {
    PermissionRegistry.clear();
    RoleRegistry.clear();
  });

  it("should seed default permissions and filter by domain", () => {
    const permissions = SPK.security.permissions.getPermissions();
    expect(permissions.length).toBeGreaterThanOrEqual(8);

    const salesPerms = SPK.security.permissions.getPermissionsByDomain("sales");
    expect(salesPerms.map((p) => p.id)).toContain("sales.pos.billing");
  });

  it("should seed default roles and evaluate permission hierarchy inheritance", () => {
    const sysAdminHasBilling = SPK.security.roles.hasPermission("sysadmin", "sales.pos.billing");
    expect(sysAdminHasBilling).toBe(true);

    const cashierHasBilling = SPK.security.roles.hasPermission("cashier", "sales.pos.billing");
    expect(cashierHasBilling).toBe(true);

    const cashierHasDiscount = SPK.security.roles.hasPermission("cashier", "sales.pos.discount");
    expect(cashierHasDiscount).toBe(false);

    // Inheritance check: inventory_clerk inherits from cashier
    const clerkHasBilling = SPK.security.roles.hasPermission("inventory_clerk", "sales.pos.billing");
    expect(clerkHasBilling).toBe(true);
  });

  it("should return license metadata and evaluate feature flags", () => {
    const license = SPK.security.licenses.getLicense();
    expect(license.edition).toBe("enterprise");
    expect(license.isActive).toBe(true);

    const isPosEnabled = SPK.security.licenses.isFeatureEnabled("pos");
    expect(isPosEnabled).toBe(true);
  });

  it("should support dynamic registration of plugin permissions and roles", () => {
    const customPerm: PermissionDefinition = {
      id: "jewellery.rate.update",
      name: "Update Gold Rate",
      scope: "action",
      domainId: "jewellery",
      action: "update"
    };

    SPK.security.permissions.registerPermission(customPerm);

    const registeredPerm = SPK.security.permissions.getPermission("jewellery.rate.update");
    expect(registeredPerm).toBeDefined();

    const customRole: RoleDefinition = {
      id: "goldsmith",
      name: "Gold Rate Manager",
      permissionIds: ["jewellery.rate.update"]
    };

    SPK.security.roles.registerRole(customRole);

    const goldsmithHasRate = SPK.security.roles.hasPermission("goldsmith", "jewellery.rate.update");
    expect(goldsmithHasRate).toBe(true);
  });
});
