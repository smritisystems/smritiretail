/**
 * Project      : SMRITI Retail OS
 * Architecture : ADR-AUTH-001 — Session Hook
 * Feature      : src/features/auth/hooks/useSession.ts
 */

import { useAuthStore, authStore } from "../store/authStore";
import { SessionService } from "../services/SessionService";

export function useSession() {
  const { authState, currentUser, isLogoutModalOpen, isSessionExpiredModalOpen } = useAuthStore();

  const openLogoutModal = () => authStore.setLogoutModalOpen(true);
  const closeLogoutModal = () => authStore.setLogoutModalOpen(false);

  const logout = async (options?: { revokeAllDevices?: boolean; clearOfflineCache?: boolean }) => {
    await SessionService.executeLogout(options);
    closeLogoutModal();
  };

  return {
    authState,
    currentUser,
    isLogoutModalOpen,
    isSessionExpiredModalOpen,
    openLogoutModal,
    closeLogoutModal,
    logout,
  };
}
