/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.27.3
 * Created      : 2026-09-16
 * Modified     : 2026-09-16
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getAuthenticatedDocumentUrl,
  syncAuthCookies,
  clearAuthSession,
} from "../lib/apiFetchV1.ts";

describe("Authenticated Document URL & Cookie Protection Suite (SMRITI-AUTH-001 Guard)", () => {
  const mockStorage: Record<string, string> = {};
  let mockCookies = "";

  beforeEach(() => {
    Object.keys(mockStorage).forEach((k) => delete mockStorage[k]);
    mockCookies = "";

    (global as any).localStorage = {
      getItem: vi.fn((key: string) => mockStorage[key] || null),
      setItem: vi.fn((key: string, val: string) => {
        mockStorage[key] = val;
      }),
      removeItem: vi.fn((key: string) => {
        delete mockStorage[key];
      }),
      clear: vi.fn(() => {
        Object.keys(mockStorage).forEach((k) => delete mockStorage[k]);
      }),
      length: 0,
      key: vi.fn(),
    };

    (global as any).window = {
      location: {
        origin: "http://localhost:3000",
        hostname: "localhost",
      },
      dispatchEvent: vi.fn(),
    };

    (global as any).document = {
      get cookie() {
        return mockCookies;
      },
      set cookie(val: string) {
        if (val.includes("expires=Thu, 01 Jan 1970")) {
          const key = val.split("=")[0];
          mockCookies = mockCookies
            .split("; ")
            .filter((c) => !c.startsWith(`${key}=`))
            .join("; ");
        } else {
          mockCookies += (mockCookies ? "; " : "") + val.split(";")[0];
        }
      },
    };
  });

  it("keeps document endpoints free from embedded token and tenant query params", () => {
    mockStorage["smriti_jwt_token"] = "test-jwt-token-xyz";
    mockStorage["smriti_company_code"] = "COMP-001";
    mockStorage["smriti_branch_id"] = "BR-MAIN-001";

    const urlStr = getAuthenticatedDocumentUrl("/api/v1/sales/invoices/inv-001/print");
    const parsed = new URL(urlStr);

    expect(parsed.searchParams.get("token")).toBeNull();
    expect(parsed.searchParams.get("company_code")).toBeNull();
    expect(parsed.searchParams.get("branch_id")).toBeNull();
    expect(parsed.pathname).toBe("/api/v1/sales/invoices/inv-001/print");
  });

  it("handles paths without /api/v1 prefix gracefully without URL token leakage", () => {
    mockStorage["smriti_jwt_token"] = "test-token-456";

    const urlStr = getAuthenticatedDocumentUrl("/sales/invoices/inv-002/preview");
    const parsed = new URL(urlStr);

    expect(parsed.pathname).toBe("/api/v1/sales/invoices/inv-002/preview");
    expect(parsed.searchParams.get("token")).toBeNull();
  });

  it("syncs access_token and smriti_jwt_token into document.cookie", () => {
    syncAuthCookies("jwt-cookie-token-789");

    expect(document.cookie).toContain("access_token=jwt-cookie-token-789");
    expect(document.cookie).toContain("smriti_jwt_token=jwt-cookie-token-789");
  });

  it("clears cookies and localStorage on clearAuthSession", () => {
    mockStorage["smriti_jwt_token"] = "valid-token";
    syncAuthCookies("valid-token");

    clearAuthSession("logout_test");

    expect(mockStorage["smriti_jwt_token"]).toBeUndefined();
    expect(document.cookie).not.toContain("access_token=valid-token");
  });
});
