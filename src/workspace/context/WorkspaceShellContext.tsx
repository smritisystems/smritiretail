/**
 * Project      : SMRITI Retail OS
 * Module       : SMRITI Workspace Shell React Context (ADR-UX-003 Compliant)
 * Standard     : ADR-UX-003 — SMRITI Workspace Shell Architecture
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 */

import React, { createContext, useContext, useState, useEffect } from "react";
import { WorkspaceShellState, OverlayType } from "../types/workspace.types";
import { workspaceShellController } from "../controllers/WorkspaceShellController";
import { SEEFTheme } from "../../layout_engine/SEEFTypes";

interface WorkspaceShellContextValue {
  shellState: WorkspaceShellState;
  setActiveDomain: (domain: string) => void;
  setActiveTab: (tabId: string) => void;
  toggleSidebar: (open?: boolean) => void;
  toggleRailMode: (rail?: boolean) => void;
  openOverlay: (overlay: OverlayType) => void;
  closeOverlay: () => void;
  setTheme: (theme: SEEFTheme) => void;
}

const WorkspaceShellContext = createContext<WorkspaceShellContextValue | null>(null);

export const WorkspaceShellProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [shellState, setShellState] = useState<WorkspaceShellState>(workspaceShellController.getState());

  useEffect(() => {
    return workspaceShellController.subscribe((newState) => {
      setShellState(newState);
    });
  }, []);

  const value: WorkspaceShellContextValue = {
    shellState,
    setActiveDomain: (domain) => workspaceShellController.setActiveDomain(domain),
    setActiveTab: (tabId) => workspaceShellController.setActiveTab(tabId),
    toggleSidebar: (open) => workspaceShellController.toggleSidebar(open),
    toggleRailMode: (rail) => workspaceShellController.toggleRailMode(rail),
    openOverlay: (overlay) => workspaceShellController.setOverlay(overlay),
    closeOverlay: () => workspaceShellController.setOverlay("none"),
    setTheme: (theme) => workspaceShellController.setTheme(theme),
  };

  return <WorkspaceShellContext.Provider value={value}>{children}</WorkspaceShellContext.Provider>;
};

export const useWorkspaceShell = (): WorkspaceShellContextValue => {
  const ctx = useContext(WorkspaceShellContext);
  if (!ctx) {
    throw new Error("useWorkspaceShell must be used within a WorkspaceShellProvider");
  }
  return ctx;
};
