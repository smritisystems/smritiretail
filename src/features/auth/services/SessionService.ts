/**
 * Project      : SMRITI Retail OS
 * Architecture : ADR-AUTH-001 — Centralized Session Service
 * Feature      : src/features/auth/services/SessionService.ts
 */

import { authStore } from "../store/authStore";
import { authEvents } from "../events/authEvents";

export class SessionService {
  private static idleTimer: NodeJS.Timeout | null = null;
  private static IDLE_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes default

  public static initSession(token: string, refreshToken?: string): void {
    localStorage.setItem("smriti_session_token", token);
    if (refreshToken) {
      localStorage.setItem("smriti_refresh_token", refreshToken);
    }
    this.resetIdleTimer();
  }

  public static resetIdleTimer(): void {
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.idleTimer = setTimeout(() => {
      this.handleIdleTimeout();
    }, this.IDLE_TIMEOUT_MS);
  }

  private static handleIdleTimeout(): void {
    const currentState = authStore.getState().authState;
    if (currentState === "Authenticated") {
      authStore.setAuthState("SessionExpired");
      authStore.setSessionExpiredModalOpen(true);
      authEvents.publish("SessionExpired", authStore.getState().currentUser?.id);
    }
  }

  public static async executeLogout(options?: { revokeAllDevices?: boolean; clearOfflineCache?: boolean }): Promise<void> {
    authStore.setAuthState("LoggingOut");
    const user = authStore.getState().currentUser;

    if (options?.clearOfflineCache) {
      try {
        localStorage.clear();
        sessionStorage.clear();
      } catch (e) {
        console.error("[SessionService] Clear storage error:", e);
      }
    } else {
      localStorage.removeItem("smriti_session_token");
      localStorage.removeItem("smriti_refresh_token");
      localStorage.removeItem("smriti_user_name");
      localStorage.removeItem("smriti_user_role");
    }

    if (this.idleTimer) clearTimeout(this.idleTimer);

    authStore.setCurrentUser(null);
    authStore.setAuthState("LoggedOut");
    authEvents.publish("UserLoggedOut", user?.id, undefined, options);
  }
}
