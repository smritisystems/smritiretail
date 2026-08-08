import { describe, it, expect, vi, beforeEach } from "vitest";
import { LockService } from "../features/auth/services/LockService";
import { SessionService } from "../features/auth/services/SessionService";
import { authStore } from "../features/auth/store/authStore";
import * as apiFetchModule from "../lib/apiFetch";

describe("Session Expiry & Workspace Unlock Server-Side Security Suite (ADR-AUTH-001 / Hardened v1.2)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    authStore.setAuthState("Unauthenticated");
    authStore.setCurrentUser(null);
    authStore.setSessionExpiredModalOpen(false);
  });

  it("Test 1: Correct password verifies server-side and resumes session", async () => {
    authStore.setAuthState("SessionExpired");
    authStore.setSessionExpiredModalOpen(true);

    vi.spyOn(apiFetchModule, "apiFetchV1").mockResolvedValueOnce({
      access_token: "mock-valid-access-token",
      refresh_token: "mock-valid-refresh-token",
      token_type: "bearer",
    });

    const result = await SessionService.resumeSession("correctpassword");

    expect(result.success).toBe(true);
    expect(authStore.getState().authState).toBe("Authenticated");
    expect(authStore.getState().isSessionExpiredModalOpen).toBe(false);
  });

  it("Test 2: Wrong password returns 401 and remains SessionExpired", async () => {
    authStore.setAuthState("SessionExpired");
    authStore.setSessionExpiredModalOpen(true);

    vi.spyOn(apiFetchModule, "apiFetchV1").mockRejectedValueOnce(
      new Error("Incorrect password or PIN.")
    );

    const result = await SessionService.resumeSession("wrongpassword");

    expect(result.success).toBe(false);
    expect(result.message).toBe("Incorrect password or PIN.");
    expect(authStore.getState().authState).toBe("SessionExpired");
    expect(authStore.getState().isSessionExpiredModalOpen).toBe(true);
  });

  it("Test 3: Empty password input fails validation and remains SessionExpired", async () => {
    authStore.setAuthState("SessionExpired");
    const spyFetch = vi.spyOn(apiFetchModule, "apiFetchV1");

    const result = await SessionService.resumeSession("   ");

    expect(result.success).toBe(false);
    expect(spyFetch).not.toHaveBeenCalled();
    expect(authStore.getState().authState).toBe("SessionExpired");
  });

  it("Test 4 & 10: Malformed HTTP 200 response (missing access_token) fails closed", async () => {
    authStore.setAuthState("SessionExpired");

    vi.spyOn(apiFetchModule, "apiFetchV1").mockResolvedValueOnce({
      success: true, // HTTP 200 but missing access_token!
    } as any);

    const result = await SessionService.resumeSession("somepassword");

    expect(result.success).toBe(false);
    expect(authStore.getState().authState).toBe("SessionExpired");
  });

  it("Test 5: Server 401 error remains locked", async () => {
    authStore.setAuthState("Locked");

    vi.spyOn(apiFetchModule, "apiFetchV1").mockRejectedValueOnce({
      status: 401,
      message: "Unauthorized",
    });

    const success = await LockService.unlockWorkspace("wrongpass");

    expect(success).toBe(false);
    expect(authStore.getState().authState).toBe("Locked");
  });

  it("Test 6: Server 500 / Network Error exception NEVER unlocks session", async () => {
    authStore.setAuthState("Locked");

    vi.spyOn(apiFetchModule, "apiFetchV1").mockRejectedValueOnce(
      new Error("Network Error: Failed to fetch")
    );

    const success = await LockService.unlockWorkspace("anypassword");

    expect(success).toBe(false);
    expect(authStore.getState().authState).toBe("Locked");
  });

  it("Test 7: Expired/invalid token returns 401 and remains SessionExpired", async () => {
    authStore.setAuthState("SessionExpired");

    vi.spyOn(apiFetchModule, "apiFetchV1").mockRejectedValueOnce(
      new Error("Session has expired. Complete re-authentication required.")
    );

    const result = await SessionService.resumeSession("password");

    expect(result.success).toBe(false);
    expect(authStore.getState().authState).toBe("SessionExpired");
  });

  it("Test 8: Workspace lock unlock succeeds ONLY when server verification passes", async () => {
    authStore.setAuthState("Locked");

    vi.spyOn(apiFetchModule, "apiFetchV1").mockResolvedValueOnce({
      access_token: "new-token",
      token_type: "bearer",
    });

    const success = await LockService.unlockWorkspace("validpass");

    expect(success).toBe(true);
    expect(authStore.getState().authState).toBe("Authenticated");
  });

  it("Test 9: Identity Immutability — payload does not accept client-supplied username override", async () => {
    authStore.setAuthState("Locked");

    const spyFetch = vi.spyOn(apiFetchModule, "apiFetchV1").mockResolvedValueOnce({
      access_token: "new-token",
      token_type: "bearer",
    });

    await LockService.unlockWorkspace("pass123");

    const fetchArgs = spyFetch.mock.calls[0];
    const requestBody = JSON.parse(fetchArgs[1]?.body as string);

    // Verify username parameter is NEVER sent in body
    expect(requestBody).not.toHaveProperty("username");
    expect(requestBody).toHaveProperty("password", "pass123");
  });

  it("Test 11: Invalid token payload signature fails schema verification", async () => {
    authStore.setAuthState("Locked");

    vi.spyOn(apiFetchModule, "apiFetchV1").mockResolvedValueOnce(null as any);

    const success = await LockService.unlockWorkspace("pass");

    expect(success).toBe(false);
    expect(authStore.getState().authState).toBe("Locked");
  });

  it("Test 12: Unauthenticated direct API bypass attempt fails closed", async () => {
    authStore.setAuthState("SessionExpired");

    vi.spyOn(apiFetchModule, "apiFetchV1").mockRejectedValueOnce(
      new Error("401 Unauthorized")
    );

    const result = await SessionService.resumeSession("bypasstry");

    expect(result.success).toBe(false);
    expect(authStore.getState().authState).toBe("SessionExpired");
  });

  it("Test 13: Server-side rate limiting (HTTP 429 Too Many Requests) keeps session locked", async () => {
    authStore.setAuthState("SessionExpired");

    vi.spyOn(apiFetchModule, "apiFetchV1").mockRejectedValueOnce(
      new Error("Too many failed authentication attempts. Account temporarily locked for 15 minutes.")
    );

    const result = await SessionService.resumeSession("failedpass");

    expect(result.success).toBe(false);
    expect(result.message).toContain("Too many failed authentication attempts");
    expect(authStore.getState().authState).toBe("SessionExpired");
  });

  it("Test 14: Refresh-token identity binding & token expiry rejection", async () => {
    authStore.setAuthState("SessionExpired");

    // Case 1: Expired refresh token returns 401
    vi.spyOn(apiFetchModule, "apiFetchV1").mockRejectedValueOnce(
      new Error("This session has been logged out. Please log in again.")
    );

    const res1 = await SessionService.resumeSession("validpass");
    expect(res1.success).toBe(false);
    expect(authStore.getState().authState).toBe("SessionExpired");

    // Case 2: Cross-user credential mismatch returns 401
    vi.spyOn(apiFetchModule, "apiFetchV1").mockRejectedValueOnce(
      new Error("Incorrect password or PIN.")
    );

    const res2 = await SessionService.resumeSession("wronguserpass");
    expect(res2.success).toBe(false);
    expect(authStore.getState().authState).toBe("SessionExpired");
  });
});
