/**
 * Project      : SMRITI Retail OS
 * Architecture : ADR-AUTH-001 — Centralized Session Service (Server-Bound Verification)
 * Feature      : src/features/auth/services/SessionService.ts
 */

import { authStore } from "../store/authStore";
import { authEvents } from "../events/authEvents";
import { apiFetchV1 } from "../../../lib/apiFetch";

export class SessionService {
  private static idleTimer: NodeJS.Timeout | null = null;
  private static IDLE_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes default

  public static initSession(token: string, refreshToken?: string): void {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem("smriti_session_token", token);
      localStorage.setItem("smriti_jwt_token", token);
      if (refreshToken) {
        localStorage.setItem("smriti_refresh_token", refreshToken);
      }
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

  /**
   * Re-authenticates and resumes an expired session via authoritative server-side password verification.
   * Fail-Closed Security: Returns success=false on any error/401/429/malformed payload without altering state.
   */
  public static async resumeSession(password: string): Promise<{ success: boolean; message?: string }> {
    if (!password || !password.trim()) {
      return { success: false, message: "Incorrect password or PIN." };
    }

    try {
      const storedRefreshToken = typeof localStorage !== 'undefined' ? (localStorage.getItem("smriti_refresh_token") || undefined) : undefined;
      const response = await apiFetchV1<{ access_token?: string; refresh_token?: string; token_type?: string }>(
        "auth/session/resume",
        {
          method: "POST",
          body: JSON.stringify({ password, refresh_token: storedRefreshToken }),
        }
      );

      // Validate payload schema
      if (!response || typeof response !== "object" || !response.access_token || !response.token_type) {
        console.error("[SessionService] Malformed resume session response from server.");
        return { success: false, message: "Server authentication error. Please try again." };
      }

      // Re-initialize session with rotated tokens
      this.initSession(response.access_token, response.refresh_token);
      authStore.setAuthState("Authenticated");
      authStore.setSessionExpiredModalOpen(false);
      authEvents.publish("SessionResumed", authStore.getState().currentUser?.id);
      return { success: true };
    } catch (err: any) {
      console.error("[SessionService] Resume session failed:", err);
      const errMsg = err?.message || String(err) || "Incorrect password or PIN.";
      return { success: false, message: errMsg };
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
      localStorage.removeItem("smriti_jwt_token");
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
