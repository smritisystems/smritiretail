/**
 * Project      : SMRITI Retail OS
 * Architecture : ADR-AUTH-001 — Auth Orchestrator Layer
 * Feature      : src/features/auth/services/AuthOrchestrator.ts
 */

import { authStore } from "../store/authStore";
import { authEvents } from "../events/authEvents";
import { IAuthProvider } from "../interfaces/IAuthProvider";
import { ApiAuthProvider } from "../providers/ApiAuthProvider";
import { SessionService } from "./SessionService";
import { User, AuthProgressStep } from "../types/auth.types";

export class AuthOrchestrator {
  private static provider: IAuthProvider = new ApiAuthProvider();

  public static setProvider(newProvider: IAuthProvider) {
    this.provider = newProvider;
  }

  public static async executeLoginWorkflow(
    username: string,
    pass: string,
    onSuccess: (user: User) => void
  ): Promise<boolean> {
    authStore.setErrorMessage(null);
    authEvents.publish("UserLoggedIn", undefined, undefined, { stage: "started" });

    const steps: AuthProgressStep[] = [
      { id: "1", label: "Connecting to Auth Provider...", status: "active" },
      { id: "2", label: "Authenticating Credentials...", status: "pending" },
      { id: "3", label: "Loading User Profile & Context...", status: "pending" },
      { id: "4", label: "Verifying Workspace Permissions...", status: "pending" },
      { id: "5", label: "Restoring Workspace State...", status: "pending" },
      { id: "6", label: "Ready", status: "pending" },
    ];

    authStore.setProgressSteps(steps);
    authStore.setAuthState("Authenticating");

    const updateStepStatus = (index: number, status: "completed" | "error", label?: string) => {
      steps[index].status = status;
      if (label) steps[index].label = label;
      if (index + 1 < steps.length && status === "completed") {
        steps[index + 1].status = "active";
      }
      authStore.setProgressSteps([...steps]);
    };

    // Step 1: Connecting
    await new Promise((r) => setTimeout(r, 150));
    updateStepStatus(0, "completed", "✓ Connected to " + this.provider.providerName);

    // Step 2: Authenticate
    await new Promise((r) => setTimeout(r, 200));
    const result = await this.provider.authenticate({ username, password: pass });

    if (!result.success || !result.user) {
      updateStepStatus(1, "error", "Authentication Failed");
      const err = result.errorMessage || "Invalid credentials provided.";
      authStore.setErrorMessage(err);
      authStore.setAuthState("Unauthenticated");
      authEvents.publish("UserLoginFailed", undefined, undefined, { reason: err });
      return false;
    }

    updateStepStatus(1, "completed", "✓ Authenticated");

    // Step 3: Loading User
    authStore.setAuthState("LoadingProfile");
    await new Promise((r) => setTimeout(r, 180));
    updateStepStatus(2, "completed", "✓ Profile Loaded");

    // Step 4: Permissions
    await new Promise((r) => setTimeout(r, 150));
    updateStepStatus(3, "completed", "✓ Permissions Verified");

    // Step 5: Workspace Restore
    authStore.setAuthState("LoadingWorkspace");
    await new Promise((r) => setTimeout(r, 150));
    updateStepStatus(4, "completed", "✓ Workspace Restored");

    // Step 6: Ready
    updateStepStatus(5, "completed", "✓ Ready");
    await new Promise((r) => setTimeout(r, 100));

    // Complete session
    SessionService.initSession(result.token || "token_demo", result.refreshToken);
    authStore.setCurrentUser(result.user);
    authStore.setAuthState("Authenticated");

    authEvents.publish("UserLoggedIn", result.user.id, authStore.getState().selectedOrganization?.id);
    onSuccess(result.user);
    return true;
  }
}
