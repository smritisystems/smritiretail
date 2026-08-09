/**
 * Project      : SMRITI Retail OS
 * Architecture : ADR-AUTH-001 â€” Centralized State Machine Store
 * Feature      : src/features/auth/store/authStore.ts
 */

import { useState, useEffect } from "react";
import { AuthState, User, OrganizationContext, AuthProgressStep } from "../types/auth.types";
import { authEvents } from "../events/authEvents";

interface AuthStoreState {
  authState: AuthState;
  currentUser: User | null;
  selectedOrganization: OrganizationContext | null;
  progressSteps: AuthProgressStep[];
  errorMessage: string | null;
  isLogoutModalOpen: boolean;
  isSessionExpiredModalOpen: boolean;
}

// Initial seeded sample organizations
export const DEFAULT_ORGANIZATIONS: OrganizationContext[] = [];

let globalState: AuthStoreState = {
  authState: "Unauthenticated",
  currentUser: null,
  selectedOrganization: null,
  progressSteps: [],
  errorMessage: null,
  isLogoutModalOpen: false,
  isSessionExpiredModalOpen: false,
};

const listeners = new Set<() => void>();

const notifyListeners = () => {
  listeners.forEach((fn) => fn());
};

export const authStore = {
  getState: () => globalState,

  setState: (partial: Partial<AuthStoreState>) => {
    globalState = { ...globalState, ...partial };
    notifyListeners();
  },

  setAuthState: (newState: AuthState) => {
    globalState = { ...globalState, authState: newState };
    notifyListeners();
  },

  setCurrentUser: (user: User | null) => {
    globalState = { ...globalState, currentUser: user };
    if (typeof localStorage !== 'undefined') {
      if (user) {
        localStorage.setItem("smriti_user_name", user.name);
        localStorage.setItem("smriti_user_role", user.role);
      } else {
        localStorage.removeItem("smriti_user_name");
        localStorage.removeItem("smriti_user_role");
      }
    }
    notifyListeners();
  },

  setSelectedOrganization: (org: OrganizationContext) => {
    globalState = { ...globalState, selectedOrganization: org };
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem("smriti_selected_org", JSON.stringify(org));
    }
    authEvents.publish("OrganizationChanged", globalState.currentUser?.id, org.id);
    notifyListeners();
  },

  setProgressSteps: (steps: AuthProgressStep[]) => {
    globalState = { ...globalState, progressSteps: steps };
    notifyListeners();
  },

  setErrorMessage: (msg: string | null) => {
    globalState = { ...globalState, errorMessage: msg };
    notifyListeners();
  },

  setLogoutModalOpen: (isOpen: boolean) => {
    globalState = { ...globalState, isLogoutModalOpen: isOpen };
    notifyListeners();
  },

  setSessionExpiredModalOpen: (isOpen: boolean) => {
    globalState = { ...globalState, isSessionExpiredModalOpen: isOpen };
    notifyListeners();
  },
};

export function useAuthStore() {
  const [state, setState] = useState<AuthStoreState>(authStore.getState());

  useEffect(() => {
    const handler = () => setState(authStore.getState());
    listeners.add(handler);
    return () => {
      listeners.delete(handler);
    };
  }, []);

  return state;
}

