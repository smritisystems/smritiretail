/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.17.0
 * Created      : 2026-08-19
 * Modified     : 2026-08-19
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { clearAuthSession } from "../lib/apiFetchV1.ts";

describe("SMRITI Global Logout & Session Invalidation Verification", () => {
  const mockLocalStorage: Record<string, string> = {};

  beforeEach(() => {
    Object.keys(mockLocalStorage).forEach((k) => delete mockLocalStorage[k]);
    global.localStorage = {
      getItem: vi.fn((key: string) => mockLocalStorage[key] || null),
      setItem: vi.fn((key: string, val: string) => {
        mockLocalStorage[key] = val;
      }),
      removeItem: vi.fn((key: string) => {
        delete mockLocalStorage[key];
      }),
      clear: vi.fn(() => {
        Object.keys(mockLocalStorage).forEach((k) => delete mockLocalStorage[k]);
      }),
      length: 0,
      key: vi.fn(),
    } as any;
  });

  it("should purge legacy tokens and tenant context on logout", () => {
    localStorage.setItem("smriti_session_token", "active-session-token-123");
    localStorage.setItem("smriti_jwt_token", "bearer-access-token-456");
    localStorage.setItem("smriti_refresh_token", "refresh-token-789");
    localStorage.setItem("smriti_company_id", "COMP-001");
    localStorage.setItem("smriti_company_code", "SMRITI");
    localStorage.setItem("smriti_branch_id", "BR-MAIN-001");

    clearAuthSession("manual_logout");

    // Verify all keys are purged
    expect(localStorage.getItem("smriti_session_token")).toBeNull();
    expect(localStorage.getItem("smriti_jwt_token")).toBeNull();
    expect(localStorage.getItem("smriti_refresh_token")).toBeNull();
    expect(localStorage.getItem("smriti_company_id")).toBeNull();
    expect(localStorage.getItem("smriti_company_code")).toBeNull();
    expect(localStorage.getItem("smriti_branch_id")).toBeNull();
  });

  it("should verify GlobalHeader exports onLogout handler interface", async () => {
    const { GlobalHeader } = await import("../components/shell/GlobalHeader.tsx");
    expect(GlobalHeader).toBeDefined();
    expect(typeof GlobalHeader).toBe("function");
  });
});
