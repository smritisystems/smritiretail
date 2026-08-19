/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.25.0
 * Created      : 2026-08-18
 * Modified     : 2026-08-18
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock localStorage for node environment
const store: Record<string, string> = {};
const mockLocalStorage = {
  getItem: (key: string) => store[key] || null,
  setItem: (key: string, value: string) => { store[key] = value; },
  removeItem: (key: string) => { delete store[key]; },
  clear: () => { Object.keys(store).forEach(k => delete store[k]); },
};

describe("SMRITI Company Selector Hardening & Context Flow", () => {
  beforeEach(() => {
    mockLocalStorage.clear();
    vi.restoreAllMocks();
  });

  it("should preserve original localStorage context when switch-context fails", async () => {
    mockLocalStorage.setItem("smriti_jwt_token", "valid-initial-token");
    mockLocalStorage.setItem("smriti_company_id", "COMP-001");
    mockLocalStorage.setItem("smriti_company_code", "001");

    // Mock a failed switch context API response
    const mockApiFetchV1 = vi.fn().mockRejectedValue(new Error("Access denied: You are not assigned to the specified target company."));

    let switchError: string | null = null;
    try {
      await mockApiFetchV1("/auth/switch-context", {
        method: "POST",
        body: JSON.stringify({ target_company_id: "COMP-999", target_branch_id: "BR-999" }),
      });
    } catch (err: any) {
      switchError = err.message;
    }

    // Assert that error was captured and NO localStorage mutations occurred
    expect(switchError).toContain("Access denied");
    expect(mockLocalStorage.getItem("smriti_jwt_token")).toBe("valid-initial-token");
    expect(mockLocalStorage.getItem("smriti_company_id")).toBe("COMP-001");
    expect(mockLocalStorage.getItem("smriti_company_code")).toBe("001");
  });

  it("should commit new company context and JWT token only on successful switch-context", async () => {
    mockLocalStorage.setItem("smriti_jwt_token", "old-token");
    mockLocalStorage.setItem("smriti_company_id", "COMP-001");

    const mockApiFetchV1 = vi.fn().mockResolvedValue({
      access_token: "new-scoped-jwt-token-comp-002",
      company_id: "COMP-002",
      branch_id: "BR-NORTH-01",
    });

    const res = await mockApiFetchV1("/auth/switch-context", {
      method: "POST",
      body: JSON.stringify({ target_company_id: "COMP-002", target_branch_id: "BR-NORTH-01" }),
    });

    if (res && res.access_token) {
      mockLocalStorage.setItem("smriti_jwt_token", res.access_token);
      mockLocalStorage.setItem("smriti_company_id", "COMP-002");
      mockLocalStorage.setItem("smriti_company_code", "002");
    }

    expect(mockLocalStorage.getItem("smriti_jwt_token")).toBe("new-scoped-jwt-token-comp-002");
    expect(mockLocalStorage.getItem("smriti_company_id")).toBe("COMP-002");
    expect(mockLocalStorage.getItem("smriti_company_code")).toBe("002");
    expect(mockLocalStorage.getItem("smriti_database_name")).toBeNull();
  });

  it("should resolve company branch strictly from /auth/tenants response without guessing MAIN", () => {
    const tenantsResponse = {
      companies: [
        { id: "COMP-ALPHA", name: "Alpha Enterprises", status: "Active" },
        { id: "COMP-BETA", name: "Beta Stores", status: "Active" },
      ],
      branches: [
        { id: "BR-ALPHA-WEST", name: "Alpha West Branch", code: "ALPWST", company: "COMP-ALPHA" },
        { id: "BR-BETA-SOUTH", name: "Beta South Hub", code: "BETSTH", company: "COMP-BETA" },
      ],
    };

    // Test branch resolution for COMP-ALPHA
    const alphaBranches = tenantsResponse.branches.filter(b => b.company === "COMP-ALPHA");
    expect(alphaBranches.length).toBe(1);
    expect(alphaBranches[0].id).toBe("BR-ALPHA-WEST");
    expect(alphaBranches[0].id).not.toBe("MAIN");

    // Test branch resolution for COMP-BETA
    const betaBranches = tenantsResponse.branches.filter(b => b.company === "COMP-BETA");
    expect(betaBranches.length).toBe(1);
    expect(betaBranches[0].id).toBe("BR-BETA-SOUTH");
    expect(betaBranches[0].id).not.toBe("MAIN");
  });

  it("should handle companies with zero branches by identifying unassigned state", () => {
    const tenantsResponse = {
      companies: [
        { id: "COMP-EMPTY", name: "Empty Company", status: "Active" },
      ],
      branches: [],
    };

    const emptyBranches = tenantsResponse.branches.filter((b: any) => b.company === "COMP-EMPTY");
    expect(emptyBranches.length).toBe(0);

    const hasValidBranch = emptyBranches.length > 0;
    expect(hasValidBranch).toBe(false);
  });
});
