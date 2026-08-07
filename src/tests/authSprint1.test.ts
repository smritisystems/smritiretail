/** @vitest-environment jsdom */

/**
 * Project      : SMRITI Retail OS
 * Module       : Sprint 1 Authentication & Session Unit Test Suite
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 */

import { describe, expect, it, beforeEach } from "vitest";
import { MockAuthProvider } from "../features/auth/providers/MockAuthProvider.ts";
import { ApiAuthProvider } from "../features/auth/providers/ApiAuthProvider.ts";
import { authStore } from "../features/auth/store/authStore.ts";
import { SessionService } from "../features/auth/services/SessionService.ts";

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

  it("should initialize session token and handle logout in SessionService", async () => {
    SessionService.initSession("token_12345", "refresh_67890");
    expect(localStorage.getItem("smriti_session_token")).toBe("token_12345");
    expect(localStorage.getItem("smriti_refresh_token")).toBe("refresh_67890");

    await SessionService.executeLogout();
    expect(localStorage.getItem("smriti_session_token")).toBeNull();
    expect(authStore.getState().authState).toBe("LoggedOut");
  });
});
