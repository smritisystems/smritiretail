/**
 * Project      : SMRITI Retail OS
 * Architecture : ADR-AUTH-001 — Authentication Experience Architecture
 * Feature      : src/features/auth/types/auth.types.ts
 * Author       : Jawahar Ramkripal Mallah
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 */

export type AuthState =
  | "Unauthenticated"
  | "Authenticating"
  | "LoadingProfile"
  | "LoadingWorkspace"
  | "Authenticated"
  | "Locked"
  | "SessionExpired"
  | "LoggingOut"
  | "LoggedOut";

export interface User {
  id?: string;
  name: string;
  username: string;
  email?: string;
  role: string;
  avatarUrl?: string;
  passwordResetRequired?: boolean;
  companyId?: string;
  branchId?: string;
  lastLoginAt?: string;
}

export interface OrganizationContext {
  id: string;
  name: string;
  code: string;
  tenantLogo?: string;
  branchName?: string;
  isFavorite?: boolean;
  lastLoginTimestamp?: string;
}

export interface SessionToken {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
}

export interface AuthProgressStep {
  id: string;
  label: string;
  status: "pending" | "active" | "completed" | "error";
  error?: string;
}

export interface DeviceFingerprint {
  deviceId: string;
  deviceName: string;
  browser: string;
  os: string;
  isTrusted: boolean;
}

export type AuthEventType =
  | "UserLoggedIn"
  | "UserLoginFailed"
  | "WorkspaceLocked"
  | "WorkspaceUnlocked"
  | "SessionExpired"
  | "UserLoggedOut"
  | "OrganizationChanged"
  | "WorkspaceChanged";

export interface AuthEventPayload {
  eventType: AuthEventType;
  timestamp: string;
  userId?: string;
  organizationId?: string;
  details?: Record<string, unknown>;
}
