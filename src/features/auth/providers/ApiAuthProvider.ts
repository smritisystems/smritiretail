/**
 * Project      : SMRITI Retail OS
 * Architecture : ADR-AUTH-001 — Real API Auth Provider
 * Feature      : src/features/auth/providers/ApiAuthProvider.ts
 * Modified     : 2026-08-09 — Removed silent mock fallback (Phase 3 Auth Hardening)
 */

import { IAuthProvider, AuthenticationResult } from "../interfaces/IAuthProvider";
import { User } from "../types/auth.types";
import { apiFetch, apiFetchV1 } from "../../../lib/apiFetch";

export class ApiAuthProvider implements IAuthProvider {
  public providerId = "api-auth-provider";
  public providerName = "SMRITI Backend API Auth";

  public async authenticate(credentials: { username: string; password?: string }): Promise<AuthenticationResult> {
    const { username, password } = credentials;

    if (!username || !username.trim()) {
      return { success: false, errorMessage: "Username is required." };
    }

    if (!password || !password.trim()) {
      return { success: false, errorMessage: "Password is required." };
    }

    try {
      // POST /api/v1/auth/login — real backend authentication
      const data = await apiFetchV1<{
        success?: boolean;
        token?: string;
        access_token?: string;
        refreshToken?: string;
        refresh_token?: string;
        user?: {
          id?: string;
          username: string;
          name?: string;
          role: string;
        };
        error?: string;
        detail?: string;
      }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({
          username: username.trim(),
          password: password.trim()
        })
      });

      const rawToken = data?.token || (data as any)?.access_token;
      const rawRefreshToken = data?.refreshToken || (data as any)?.refresh_token;

      if (data && (data.user || rawToken)) {
        const user: User = {
          id: data.user?.id || `usr_${username.trim()}`,
          username: data.user?.username || username.trim(),
          name: data.user?.name || username.trim(),
          role: data.user?.role || "SYSADMIN",
          lastLoginAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        };

        return {
          success: true,
          user,
          token: rawToken,
          refreshToken: rawRefreshToken,
        };
      }

      // Backend returned an explicit error — surface it directly.
      // RULE (Phase 3): A real backend failure MUST remain a failure.
      // NEVER convert REAL BACKEND FAILURE → MOCK LOGIN.
      if (data && (data.error || data.detail)) {
        return {
          success: false,
          errorMessage: data.detail || data.error || "Invalid username or password. Please check your credentials."
        };
      }

      return {
        success: false,
        errorMessage: "Authentication service returned an unexpected response. Please try again."
      };
    } catch (err: any) {
      // Network error or backend unreachable — surface real failure.
      const isNetworkError = !err?.message || err?.message?.includes("fetch") ||
        err?.message?.includes("network") || err?.message?.includes("Failed to fetch");
      if (isNetworkError) {
        return {
          success: false,
          errorMessage: "Cannot reach the SMRITI backend server. Ensure the backend API is running and accessible."
        };
      }
      return {
        success: false,
        errorMessage: err?.message || "Authentication failed. Please try again."
      };
    }
  }

  public async revokeSession(_token: string): Promise<boolean> {
    try {
      await apiFetch("/api/auth/logout", { method: "POST" });
      return true;
    } catch {
      return false;
    }
  }

  public async refreshToken(_refreshToken: string): Promise<AuthenticationResult> {
    return {
      success: false,
      errorMessage: "Session expired. Please sign in again."
    };
  }
}
