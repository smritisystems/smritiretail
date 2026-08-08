/**
 * Project      : SMRITI Retail OS
 * Architecture : ADR-AUTH-001 — UI Lock Service (Server-Bound Verification)
 * Feature      : src/features/auth/services/LockService.ts
 */

import { authStore } from "../store/authStore";
import { authEvents } from "../events/authEvents";
import { apiFetchV1 } from "../../../lib/apiFetch";
import { SessionService } from "./SessionService";

export class LockService {
  public static lockWorkspace(): void {
    const state = authStore.getState();
    if (state.authState === "Authenticated") {
      authStore.setAuthState("Locked");
      authEvents.publish("WorkspaceLocked", state.currentUser?.id);
    }
  }

  /**
   * Asynchronously verifies password against server auth boundary before unlocking workspace.
   * Fail-Closed Security: Returns false and maintains Locked state on any non-200, exception, or malformed payload.
   */
  public static async unlockWorkspace(enteredPassword?: string): Promise<boolean> {
    const state = authStore.getState();
    if (state.authState !== "Locked") return true;

    if (!enteredPassword || !enteredPassword.trim()) {
      return false;
    }

    try {
      const response = await apiFetchV1<{ access_token?: string; refresh_token?: string; token_type?: string }>(
        "auth/session/resume",
        {
          method: "POST",
          body: JSON.stringify({ password: enteredPassword }),
        }
      );

      // Payload Schema & Credential Validation
      if (!response || typeof response !== "object" || !response.access_token || !response.token_type) {
        console.error("[LockService] Malformed authentication response from server.");
        return false;
      }

      // Explicit Server Verification Success: Initialize session with rotated tokens and transition state
      SessionService.initSession(response.access_token, response.refresh_token);
      authStore.setAuthState("Authenticated");
      authEvents.publish("WorkspaceUnlocked", state.currentUser?.id);
      return true;
    } catch (err) {
      console.error("[LockService] Unlock verification failed:", err);
      // FAIL-CLOSED SECURITY: Never unlock workspace on error/exception/fallback
      return false;
    }
  }
}
