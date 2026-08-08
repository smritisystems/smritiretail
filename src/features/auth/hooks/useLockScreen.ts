/**
 * Project      : SMRITI Retail OS
 * Architecture : ADR-AUTH-001 — Lock Screen Hook
 * Feature      : src/features/auth/hooks/useLockScreen.ts
 */

import { useAuthStore } from "../store/authStore";
import { LockService } from "../services/LockService";

export function useLockScreen() {
  const { authState, currentUser } = useAuthStore();

  const isLocked = authState === "Locked";

  const lock = () => LockService.lockWorkspace();
  const unlock = (pass?: string) => LockService.unlockWorkspace(pass);

  return {
    isLocked,
    currentUser,
    lock,
    unlock,
  };
}
