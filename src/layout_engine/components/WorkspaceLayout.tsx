/**
 * Project      : SMRITI Retail OS
 * Module       : Unified Workspace Layout Component (SLGP-001 v2.0 Standard)
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * Version      : 5.4.0
 */

import React from "react";
import { MasterDetailWorkspace } from "./MasterDetailWorkspace.tsx";

export type WorkspaceLayoutMode = "scroll" | "studio" | "master-detail";

interface WorkspaceLayoutProps {
  mode: WorkspaceLayoutMode;
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
  toolbar,
  statusBar,
  children,
  masterPanel,
  detailPanel,
  masterWidthPx = 360,
  className = ""
}) => {
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
      <div className={`w-full h-full flex flex-col overflow-hidden bg-theme-base ${className}`}>
        {toolbar && (
          <div className="shrink-0 border-b border-theme-divider bg-theme-surface-1 px-4 py-2 flex items-center justify-between shadow-xs">
            {toolbar}
          </div>
        )}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 md:p-6">
          {children}
        </div>
        {statusBar && (
          <div className="shrink-0 border-t border-theme-divider bg-theme-surface-1 px-4 py-2 flex items-center justify-between font-mono text-xs text-theme-muted">
            {statusBar}
          </div>
        )}
      </div>
    );
  }

  // Mode 3: Continuous Document Scroll Page (Pattern A - Default)
  return (
    <div className={`w-full h-full overflow-y-auto bg-theme-base ${className}`}>
      {toolbar && (
        <div className="sticky top-0 z-10 border-b border-theme-divider bg-theme-surface-1/95 backdrop-blur-xs px-6 py-3 shadow-xs">
          {toolbar}
        </div>
      )}
      <div className="max-w-7xl mx-auto p-6 space-y-6 pb-12">
        {children}
      </div>
      {statusBar && (
        <div className="border-t border-theme-divider bg-theme-surface-1 p-4 font-mono text-xs text-theme-muted">
          {statusBar}
        </div>
      )}
    </div>
  );
};
