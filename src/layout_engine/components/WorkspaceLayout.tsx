/**
 * Project      : SMRITI Retail OS
 * Module       : Unified Enterprise Workspace Layout Component (SLGP-001 v3.0 Standard)
 * Description  : Enterprise-grade layout engine supporting fluid full-width layouts, density modes
 *                (comfortable, compact, dense), sticky toolbars, and master-detail split views.
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * Version      : 5.5.0
 */

import React from "react";
import { MasterDetailWorkspace } from "./MasterDetailWorkspace.tsx";

export type WorkspaceLayoutMode = "scroll" | "studio" | "master-detail";
export type WorkspaceDensity = "comfortable" | "compact" | "dense";
export type WorkspaceWidth = "fluid" | "contained";

interface WorkspaceLayoutProps {
  mode: WorkspaceLayoutMode;
  density?: WorkspaceDensity;
  width?: WorkspaceWidth;
  toolbar?: React.ReactNode;
  statusBar?: React.ReactNode;
  children?: React.ReactNode;
  // For master-detail mode
  masterPanel?: React.ReactNode;
  detailPanel?: React.ReactNode;
  masterWidthPx?: number;
  className?: string;
}

export const WorkspaceLayout: React.FC<WorkspaceLayoutProps> = ({
  mode,
  density = "compact",
  width = "fluid",
  toolbar,
  statusBar,
  children,
  masterPanel,
  detailPanel,
  masterWidthPx = 360,
  className = ""
}) => {
  // Density Spacing Utilities
  const spacingClass =
    density === "dense"
      ? "p-2 md:p-3 space-y-2.5 pb-6"
      : density === "compact"
      ? "p-3 md:p-4 space-y-3 pb-8"
      : "p-4 md:p-6 space-y-4 pb-12";

  const widthContainerClass =
    width === "contained"
      ? "max-w-7xl mx-auto"
      : "w-full";

  // Mode 1: Master-Detail Split Pane (Pattern C)
  if (mode === "master-detail" && masterPanel && detailPanel) {
    return (
      <MasterDetailWorkspace
        toolbar={toolbar}
        masterPanel={masterPanel}
        detailPanel={detailPanel}
        statusBar={statusBar}
        masterWidthPx={masterWidthPx}
      />
    );
  }

  // Mode 2: Viewport-Constrained Studio (Pattern B)
  if (mode === "studio") {
    return (
      <div className={`w-full h-full min-w-0 flex flex-col overflow-hidden bg-theme-base ${className}`}>
        {toolbar && (
          <div className="shrink-0 border-b border-theme-divider bg-theme-surface-1 px-4 py-1.5 flex items-center justify-between shadow-xs">
            {toolbar}
          </div>
        )}
        <div className={`flex-1 min-h-0 min-w-0 overflow-y-auto overflow-x-hidden smriti-custom-scroll srux-responsive-scroll ${widthContainerClass} ${spacingClass}`}>
          {children}
        </div>
        {statusBar && (
          <div className="shrink-0 border-t border-theme-divider bg-theme-surface-1 px-4 py-1.5 flex items-center justify-between font-mono text-xs text-theme-muted">
            {statusBar}
          </div>
        )}
      </div>
    );
  }

  // Mode 3: Continuous Document Scroll Page (Pattern A - Default)
  return (
    <div className={`w-full h-full min-w-0 overflow-y-auto overflow-x-hidden smriti-custom-scroll srux-responsive-scroll bg-theme-base ${className}`}>
      {toolbar && (
        <div className="sticky top-0 z-10 border-b border-theme-divider bg-theme-surface-1/95 backdrop-blur-xs px-4 py-2 shadow-xs">
          {toolbar}
        </div>
      )}
      <div className={`${widthContainerClass} ${spacingClass}`}>
        {children}
      </div>
      {statusBar && (
        <div className="border-t border-theme-divider bg-theme-surface-1 p-3 font-mono text-xs text-theme-muted">
          {statusBar}
        </div>
      )}
    </div>
  );
};
