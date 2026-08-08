/**
 * Project      : SMRITI Retail OS
 * Architecture : ADR-AUTH-001 — Domain Authentication Service
 * Feature      : src/features/auth/services/AuthService.ts
 */

import { authStore } from "../store/authStore";
import { User, AuthProgressStep } from "../types/auth.types";
import { authEvents } from "../events/authEvents";
import { SessionService } from "./SessionService";

export const INITIAL_PROGRESS_STEPS: AuthProgressStep[] = [
  { id: "step-1", label: "Connecting...", status: "pending" },
  { id: "step-2", label: "Authenticating Credentials...", status: "pending" },
  { id: "step-3", label: "Loading User Profile...", status: "pending" },
  { id: "step-4", label: "Loading Workspace Permissions...", status: "pending" },
  { id: "step-5", label: "Preparing Dashboard & Shell...", status: "pending" },
  { id: "step-6", label: "Workspace Ready", status: "pending" },
];

export class AuthService {
  public static async executeProgressiveLogin(
    username: string,
    pass: string,
    onSuccess: (user: User) => void
  ): Promise<boolean> {
    authStore.setErrorMessage(null);
    authStore.setAuthState("Authenticating");

    let steps = INITIAL_PROGRESS_STEPS.map((s) => ({ ...s }));
    authStore.setProgressSteps(steps);

    const updateStep = (index: number, status: "active" | "completed" | "error", labelOverride?: string) => {
      steps = steps.map((s, i) => {
        if (i === index) {
          return { ...s, status, label: labelOverride || s.label };
        }
        return s;
      });
      authStore.setProgressSteps([...steps]);
    };

    try {
      // Step 1: Connecting
      updateStep(0, "active");
      await new Promise((r) => setTimeout(r, 200));
      updateStep(0, "completed", "✓ Connected");

      // Step 2: Authenticating
      updateStep(1, "active");
      await new Promise((r) => setTimeout(r, 250));

      if (!username.trim() || !pass.trim()) {
        updateStep(1, "error", "Invalid Credentials");
        authStore.setErrorMessage("Please enter both username and password.");
        authStore.setAuthState("Unauthenticated");
        authEvents.publish("UserLoginFailed", undefined, undefined, { reason: "empty_fields" });
        return false;
      }

      updateStep(1, "completed", "✓ Authenticated");

      // Step 3: Loading Profile
      authStore.setAuthState("LoadingProfile");
      updateStep(2, "active");
      await new Promise((r) => setTimeout(r, 200));

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

      const authenticatedUser: User = {
        id: `usr_${username}`,
        username,
        name,
        role,
        companyId: authStore.getState().selectedOrganization?.id || "nalanda-main",
        lastLoginAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };

      updateStep(2, "completed", "✓ Profile Loaded");

      // Step 4: Loading Permissions
      updateStep(3, "active");
      await new Promise((r) => setTimeout(r, 180));
      updateStep(3, "completed", "✓ Permissions Loaded");

      // Step 5: Preparing Workspace
      authStore.setAuthState("LoadingWorkspace");
      updateStep(4, "active");
      await new Promise((r) => setTimeout(r, 180));
      updateStep(4, "completed", "✓ Shell Ready");

      // Step 6: Ready
      updateStep(5, "completed", "✓ Complete");
      await new Promise((r) => setTimeout(r, 150));

      // Set tokens and user state
      SessionService.initSession("demo_access_token_jwt", "demo_refresh_token_jwt");
      authStore.setCurrentUser(authenticatedUser);
      authStore.setAuthState("Authenticated");

      authEvents.publish("UserLoggedIn", authenticatedUser.id, authenticatedUser.companyId);
      onSuccess(authenticatedUser);
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Authentication failed. Please try again.";
      authStore.setErrorMessage(msg);
      authStore.setAuthState("Unauthenticated");
      authEvents.publish("UserLoginFailed", undefined, undefined, { error: msg });
      return false;
    }
  }
}
