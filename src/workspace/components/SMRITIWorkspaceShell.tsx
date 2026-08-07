/**
 * Project      : SMRITI Retail OS
 * Module       : Root SMRITI Workspace Shell (SWS) Runtime Container
 * Standard     : ADR-UX-001 | ADR-UX-002 | ADR-UX-003 (FROZEN v1.0)
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 */

import React, { useEffect } from "react";
import { WorkspaceShellProvider, useWorkspaceShell } from "../context/WorkspaceShellContext";
import { OverlayManager } from "./OverlayManager";
import { AdaptiveWorkspaceHeader } from "../../components/common/AdaptiveWorkspaceHeader";
import { WorkspaceTaskbar } from "../../components/WorkspaceTaskbar";

interface SMRITIWorkspaceShellProps {
  children: React.ReactNode;
  currentUser?: { name: string; role: string } | null;
  onLogout?: () => void;
}

const WorkspaceShellInner: React.FC<SMRITIWorkspaceShellProps> = ({ children, currentUser, onLogout }) => {
  const { openOverlay } = useWorkspaceShell();

  // Keyboard shortcut listener for Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        openOverlay("command-palette");
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [openOverlay]);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-theme-base text-theme-body font-sans select-none">
      {/* 1. Adaptive Header */}
      <AdaptiveWorkspaceHeader
        currentUser={currentUser || undefined}
        onOpenGlobalSearch={() => openOverlay("command-palette")}
        onOpenNotifications={() => openOverlay("notification-center")}
        onLogout={onLogout}
      />

      {/* 2. Workspace Content Region */}
      <div className="flex-1 flex overflow-hidden relative">
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
          {children}
        </main>
      </div>

      {/* 3. Operational Dock & Bottom Taskbar */}
      <WorkspaceTaskbar />

      {/* 4. Central Overlay Host */}
      <OverlayManager />
    </div>
  );
};

export const SMRITIWorkspaceShell: React.FC<SMRITIWorkspaceShellProps> = (props) => {
  return (
    <WorkspaceShellProvider>
      <WorkspaceShellInner {...props} />
    </WorkspaceShellProvider>
  );
};
