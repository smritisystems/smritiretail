/**
 * Project      : SMRITI Retail OS
 * Architecture : ADR-AUTH-001 — Infrastructure-Neutral Auth Provider Interface
 * Feature      : src/features/auth/interfaces/IAuthProvider.ts
 */

import { User } from "../types/auth.types";

export interface AuthenticationResult {
  success: boolean;
  user?: User;
  token?: string;
  refreshToken?: string;
  errorMessage?: string;
}

export interface IAuthProvider {
  providerId: string;
  providerName: string;
  authenticate(credentials: { username: string; password?: string; token?: string }): Promise<AuthenticationResult>;
  revokeSession(token: string): Promise<boolean>;
  refreshToken(refreshToken: string): Promise<AuthenticationResult>;
}
