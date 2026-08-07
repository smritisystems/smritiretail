/**
 * Project      : SMRITI Retail OS
 * Architecture : ADR-AUTH-001 — UI Lock Service
 * Feature      : src/features/auth/services/LockService.ts
 */

import { authStore } from "../store/authStore";
import { authEvents } from "../events/authEvents";

export class LockService {
  public static lockWorkspace(): void {
    const state = authStore.getState();
    if (state.authState === "Authenticated") {
      authStore.setAuthState("Locked");
      authEvents.publish("WorkspaceLocked", state.currentUser?.id);
    }
  }

  public static unlockWorkspace(enteredPassword?: string): boolean {
    const state = authStore.getState();
    if (state.authState !== "Locked") return true;

    // PIN / Password verification logic
    if (enteredPassword !== undefined && enteredPassword.trim() === "") {
      return false;
    }

    authStore.setAuthState("Authenticated");
    authEvents.publish("WorkspaceUnlocked", state.currentUser?.id);
    return true;
  }
}
