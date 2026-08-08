/**
 * Project      : SMRITI Retail OS
 * Module       : SMRITI Central Overlay Manager (ADR-UX-003 Compliant)
 * Standard     : ADR-UX-003 — SMRITI Workspace Shell Architecture
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 */

import React from "react";
import { useWorkspaceShell } from "../context/WorkspaceShellContext";
import { UniversalCommandPalette } from "./UniversalCommandPalette";
import { NotificationCenter } from "./NotificationCenter";
import { LockScreen, LogoutDialog, SessionExpiredDialog } from "../../features/auth";

export const OverlayManager: React.FC = () => {
  const { shellState, closeOverlay } = useWorkspaceShell();
  const { activeOverlay } = shellState;

  return (
    <>
      <UniversalCommandPalette
        isOpen={activeOverlay === "command-palette"}
        onClose={closeOverlay}
      />
      <NotificationCenter
        isOpen={activeOverlay === "notification-center"}
        onClose={closeOverlay}
      />
      {activeOverlay === "lock-screen" && <LockScreen />}
      {activeOverlay === "logout-dialog" && <LogoutDialog />}
      {activeOverlay === "session-expired" && <SessionExpiredDialog />}
    </>
  );
};
