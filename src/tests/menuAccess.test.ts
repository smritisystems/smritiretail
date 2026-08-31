/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.16.0
 * Created      : 2026-08-22
 * Modified     : 2026-08-22
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 * Source Module: Security Management & Menu Access Control Unit Tests
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  initialSecurityUsers,
  initialSecurityGroups,
  initialSecurityNodes,
  getCanonicalMenuTree,
  getPasswordSecurityConfig,
  savePasswordSecurityConfig,
  getHousekeepingSecurityConfig,
  saveHousekeepingSecurityConfig,
  getPermissionsForSubject,
  savePermissionsForSubject,
} from "../services/securityStore";

const mockStorage: Record<string, string> = {};
const mockLocalStorage = {
  getItem: vi.fn((key: string) => mockStorage[key] || null),
  setItem: vi.fn((key: string, val: string) => {
    mockStorage[key] = String(val);
  }),
  removeItem: vi.fn((key: string) => {
    delete mockStorage[key];
  }),
  clear: vi.fn(() => {
    Object.keys(mockStorage).forEach((k) => delete mockStorage[k]);
  }),
};

Object.defineProperty(globalThis, "localStorage", {
  value: mockLocalStorage,
  writable: true,
});

describe("SMRITI — Security Management & Menu Access Control Tests", () => {
  beforeEach(() => {
    mockLocalStorage.clear();
    vi.clearAllMocks();
  });

  // TEST 1: Identity & Subject Directory
  it("TEST 1: should load canonical security users, groups, and nodes", () => {
    expect(initialSecurityUsers.length).toBeGreaterThanOrEqual(3);
    const ram = initialSecurityUsers.find((u) => u.id === "002");
    expect(ram).toBeDefined();
    expect(ram?.name).toBe("Ram");

    const countersGroup = initialSecurityGroups.find((g) => g.id === "002");
    expect(countersGroup).toBeDefined();
    expect(countersGroup?.name).toBe("Counters");

    const posNode = initialSecurityNodes.find((n) => n.id === "NODE-POS-01");
    expect(posNode).toBeDefined();
  });

  // TEST 2: Canonical Menu Tree Structure
  it("TEST 2: should build canonical menu tree with standard ERP root modules", () => {
    const tree = getCanonicalMenuTree();
    const rootIds = tree.map((m) => m.menuId);

    expect(rootIds).toContain("sales");
    expect(rootIds).toContain("cash");
    expect(rootIds).toContain("stock");
    expect(rootIds).toContain("reports");
    expect(rootIds).toContain("housekeeping");
    expect(rootIds).toContain("catalogue");
    expect(rootIds).toContain("setup");
    expect(rootIds).toContain("help");
  });

  // TEST 3: Granular Operations Matrix on Sub-menus
  it("TEST 3: should define granular operations for billing and goods inwards", () => {
    const tree = getCanonicalMenuTree();
    
    // Check Billing operations
    const sales = tree.find((m) => m.menuId === "sales");
    const billing = sales?.children?.find((c) => c.menuId === "sales_billing");
    expect(billing).toBeDefined();
    expect(billing?.supportedOperations).toEqual(
      expect.arrayContaining(["NEW", "VOID", "RETURN", "VOID RETURN"])
    );
    expect(billing?.allowedOperations?.NEW).toBe(true);

    // Check Goods Inwards operations
    const stock = tree.find((m) => m.menuId === "stock");
    const goodsInwards = stock?.children?.find((c) => c.menuId === "stock_goods_inwards");
    expect(goodsInwards).toBeDefined();
    expect(goodsInwards?.supportedOperations).toEqual(
      expect.arrayContaining(["ADD", "EDIT", "DELETE", "VIEW"])
    );
  });

  // TEST 4: Permission Persistence per User/Group/Node
  it("TEST 4: should save and retrieve customized menu permissions for User 002", () => {
    const initialTree = getCanonicalMenuTree();
    
    // Modify billing VOID operation for User 002
    const modifiedTree = initialTree.map((m) => {
      if (m.menuId === "sales") {
        return {
          ...m,
          children: m.children?.map((c) => {
            if (c.menuId === "sales_billing") {
              return {
                ...c,
                allowedOperations: { ...c.allowedOperations, VOID: true },
              };
            }
            return c;
          }),
        };
      }
      return m;
    });

    savePermissionsForSubject("User", "002", modifiedTree);
    const retrieved = getPermissionsForSubject("User", "002");

    const retrievedSales = retrieved.find((m) => m.menuId === "sales");
    const retrievedBilling = retrievedSales?.children?.find(
      (c) => c.menuId === "sales_billing"
    );
    expect(retrievedBilling?.allowedOperations?.VOID).toBe(true);
  });

  // TEST 5: Password Security Configuration
  it("TEST 5: should maintain and update password security policy defaults", () => {
    const config = getPasswordSecurityConfig();
    expect(config.maxPasswordLength).toBe(50);
    expect(config.minPasswordLength).toBe(6);
    expect(config.minUppercase).toBe(1);
    expect(config.minLowercase).toBe(1);
    expect(config.minNumeric).toBe(2);

    savePasswordSecurityConfig({
      ...config,
      minPasswordLength: 8,
      maxInvalidAttempts: 3,
    });

    const updated = getPasswordSecurityConfig();
    expect(updated.minPasswordLength).toBe(8);
    expect(updated.maxInvalidAttempts).toBe(3);
  });

  // TEST 6: Housekeeping Security Configuration
  it("TEST 6: should maintain housekeeping policies and company-wise menu activation", () => {
    const config = getHousekeepingSecurityConfig();
    expect(config.countryCode).toBe("+91");
    expect(config.activateCompanyWiseRestrictions).toBe(true);
    expect(config.remindPatchUpdationDays).toBe(7);

    saveHousekeepingSecurityConfig({
      ...config,
      remindPatchUpdationDays: 14,
      daysToRetainActivityLog: 90,
    });

    const updated = getHousekeepingSecurityConfig();
    expect(updated.remindPatchUpdationDays).toBe(14);
    expect(updated.daysToRetainActivityLog).toBe(90);
  });
});
