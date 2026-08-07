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

    if (!username || !username.trim()) {
      return { success: false, errorMessage: "Username is required." };
    }

    if (!password || !password.trim()) {
      return { success: false, errorMessage: "Password is required." };
    }

    const cleanUsername = username.trim().toLowerCase();
    const cleanPassword = password.trim();

    const MOCK_ACCOUNTS: Record<string, { pass: string; role: string; name: string }> = {
      super: { pass: "Shpr0128vdq!@", role: "SYSADMIN", name: "Super Admin" },
      admin: { pass: "admin123", role: "SYSADMIN", name: "System Administrator" },
      manager: { pass: "Password@123", role: "MANAGER", name: "Store Manager" },
      cashier: { pass: "Cashier@1234", role: "CASHIER", name: "POS Cashier" },
    };

    const matchedAccount = MOCK_ACCOUNTS[cleanUsername];

    if (!matchedAccount || matchedAccount.pass !== cleanPassword) {
      return { success: false, errorMessage: "Invalid username or password." };
    }

    const user: User = {
      id: `usr_${cleanUsername}`,
      username: cleanUsername,
      name: matchedAccount.name,
      role: matchedAccount.role,
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
