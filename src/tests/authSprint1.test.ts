/** @vitest-environment jsdom */

/**
 * Project      : SMRITI Retail OS
 * Module       : Sprint 1 Authentication & Session Unit Test Suite
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 */

import { describe, expect, it, beforeEach, vi } from "vitest";
import { MockAuthProvider } from "../features/auth/providers/MockAuthProvider.ts";
import { ApiAuthProvider } from "../features/auth/providers/ApiAuthProvider.ts";
import { authStore } from "../features/auth/store/authStore.ts";
import { SessionService } from "../features/auth/services/SessionService.ts";
import { apiFetchV1 } from "../lib/apiFetch";

vi.mock("../lib/apiFetch", () => ({
  apiFetchV1: vi.fn(),
  apiFetch: vi.fn(),
}));

describe("Sprint 1: Authentication & Session Management", () => {
  let mockProvider: MockAuthProvider;
  let apiProvider: ApiAuthProvider;

  beforeEach(() => {
    mockProvider = new MockAuthProvider();
    apiProvider = new ApiAuthProvider();
    authStore.setErrorMessage(null);
    authStore.setAuthState("Unauthenticated");
    authStore.setCurrentUser(null);
    localStorage.clear();
  });

  it("should successfully authenticate valid credentials (super / Shpr0128vdq!@)", async () => {
    const result = await mockProvider.authenticate({ username: "super", password: "Shpr0128vdq!@" });
    expect(result.success).toBe(true);
    expect(result.user).toBeDefined();
    expect(result.user?.role).toBe("SYSADMIN");
  });

  it("should reject invalid password with explicit error message", async () => {
    const result = await mockProvider.authenticate({ username: "super", password: "WrongPassword123!" });
    expect(result.success).toBe(false);
    expect(result.user).toBeUndefined();
    expect(result.errorMessage).toBe("Invalid username or password.");
  });

  it("should reject empty username or password", async () => {
    const result = await mockProvider.authenticate({ username: "", password: "" });
    expect(result.success).toBe(false);
    expect(result.errorMessage).toBe("Username is required.");
  });

  it("should fall back to the local demo credentials when the API returns an authentication error", async () => {
    vi.mocked(apiFetchV1).mockResolvedValueOnce({ detail: "Invalid username or password." } as never);

    const result = await apiProvider.authenticate({ username: "super", password: "Shpr0128vdq!@" });

    expect(result.success).toBe(true);
    expect(result.user?.role).toBe("SYSADMIN");
  });

  it("should initialize session token and handle logout in SessionService", async () => {
    SessionService.initSession("token_12345", "refresh_67890");
    expect(localStorage.getItem("smriti_session_token")).toBe("token_12345");
    expect(localStorage.getItem("smriti_refresh_token")).toBe("refresh_67890");

    await SessionService.executeLogout();
    expect(localStorage.getItem("smriti_session_token")).toBeNull();
    expect(authStore.getState().authState).toBe("LoggedOut");
  });

  it("should register CREATE_SALES_INVOICE command handler in SPK.commands during bootstrapDI", async () => {
    const { bootstrapDI } = await import("../bootstrap/di.ts");
    const { SPK } = await import("../kernel/SPK.ts");
    const { CreateSalesInvoiceCommand } = await import("../kernel/commands/CreateSalesInvoiceCommand.ts");

    bootstrapDI();
    const result = await SPK.commands.execute(
      new CreateSalesInvoiceCommand({
        invoiceNumber: "INV-TEST-001",
        customerName: "Walk-in Customer",
        lines: [{
          id: "p1",
          itemId: "p1",
          itemCode: "P1",
          itemName: "Test Item",
          hsnCode: "9999",
          qty: 1,
          uom: "NOS",
          rate: 100,
          discountPct: 0,
          discountAmount: 0,
          taxableValue: 100,
          gstRate: 0,
          cgstAmount: 0,
          sgstAmount: 0,
          igstAmount: 0,
          totalTaxAmount: 0,
          lineTotal: 100
        }],
        netPayable: 100,
        paymentMode: "Cash",
      })
    );

    expect(result).toBeDefined();
  });
});
