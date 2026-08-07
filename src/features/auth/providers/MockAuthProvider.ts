/**
 * Project      : SMRITI Retail OS
 * Architecture : ADR-AUTH-001 — Mock Auth Provider
 * Feature      : src/features/auth/providers/MockAuthProvider.ts
 */

import { IAuthProvider, AuthenticationResult } from "../interfaces/IAuthProvider";
import { User } from "../types/auth.types";

export class MockAuthProvider implements IAuthProvider {
  public providerId = "mock-jwt-provider";
  public providerName = "SMRITI Enterprise Internal Auth";

  public async authenticate(credentials: { username: string; password?: string }): Promise<AuthenticationResult> {
    const { username } = credentials;

    if (!username || !username.trim()) {
      return { success: false, errorMessage: "Username is required." };
    }

    const cleanUsername = username.trim().toLowerCase();

    let role = "SYSADMIN";
    let name = username.charAt(0).toUpperCase() + username.slice(1);

    if (cleanUsername === "super" || cleanUsername === "admin") {
      role = "SYSADMIN";
      name = cleanUsername === "super" ? "Super Admin" : "System Administrator";
    } else if (cleanUsername === "manager") {
      role = "MANAGER";
      name = "Store Manager";
    } else if (cleanUsername === "cashier") {
      role = "CASHIER";
      name = "POS Cashier";
    }

    const user: User = {
      id: `usr_${cleanUsername}`,
      username: cleanUsername,
      name,
      role,
      lastLoginAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    return {
      success: true,
      user,
      token: `smriti_jwt_${Date.now()}`,
      refreshToken: `smriti_rf_${Date.now()}`,
    };
  }

  public async revokeSession(): Promise<boolean> {
    return true;
  }

  public async refreshToken(refreshToken: string): Promise<AuthenticationResult> {
    return {
      success: true,
      token: `smriti_jwt_refreshed_${Date.now()}`,
      refreshToken,
    };
  }
}
