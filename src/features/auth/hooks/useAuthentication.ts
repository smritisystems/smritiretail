/**
 * Project      : SMRITI Retail OS
 * Architecture : ADR-AUTH-001 — Authentication Hook
 * Feature      : src/features/auth/hooks/useAuthentication.ts
 */

import { useAuthStore } from "../store/authStore";
import { AuthService } from "../services/AuthService";
import { User } from "../types/auth.types";

export function useAuthentication() {
  const { authState, currentUser, selectedOrganization, progressSteps, errorMessage } = useAuthStore();

  const login = async (username: string, pass: string, onSuccess: (u: User) => void) => {
    return AuthService.executeProgressiveLogin(username, pass, onSuccess);
  };

  return {
    authState,
    currentUser,
    selectedOrganization,
    progressSteps,
    errorMessage,
    login,
  };
}
