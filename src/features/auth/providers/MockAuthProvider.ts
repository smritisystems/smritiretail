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
    const { username, password } = credentials;

    if (!username.trim() || !password?.trim()) {
      return { success: false, errorMessage: "Username and password are required." };
    }

    let role = "SYSADMIN";
    let name = username.charAt(0).toUpperCase() + username.slice(1);

    if (username === "super") {
      role = "SYSADMIN";
      name = "Super Admin";
    } else if (username === "manager") {
      role = "MANAGER";
      name = "Store Manager";
    } else if (username === "cashier") {
      role = "CASHIER";
      name = "POS Cashier";
    }

    const user: User = {
      id: `usr_${username}`,
      username,
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
