/**
 * Project      : SMRITI Retail OS
 * Architecture : ADR-AUTH-001 — Real API Auth Provider
 * Feature      : src/features/auth/providers/ApiAuthProvider.ts
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
      // 1. Try backend server login endpoint (/api/auth/login)
      const data = await apiFetch("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({
          username: username.trim(),
          password: password.trim()
        })
      });

      if (!data || !data.success || !data.user) {
        return {
          success: false,
          errorMessage: data?.error || "Invalid username or password."
        };
      }

      const user: User = {
        id: data.user.userId || data.user.id || `usr_${data.user.username}`,
        username: data.user.username,
        name: data.user.fullName || data.user.name || data.user.username,
        role: data.user.role || "SYSADMIN",
        lastLoginAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };

      return {
        success: true,
        user,
        token: data.token || `smriti_jwt_${Date.now()}`,
        refreshToken: `smriti_rf_${Date.now()}`,
      };
    } catch (err: any) {
      const errorMsg = err?.message || "Invalid username or password.";
      return {
        success: false,
        errorMessage: errorMsg
      };
    }
  }

  public async revokeSession(token: string): Promise<boolean> {
    try {
      await apiFetch("/api/auth/logout", { method: "POST" });
      return true;
    } catch {
      return false;
    }
  }

  public async refreshToken(refreshToken: string): Promise<AuthenticationResult> {
    return {
      success: false,
      errorMessage: "Session expired. Please sign in again."
    };
  }
}
