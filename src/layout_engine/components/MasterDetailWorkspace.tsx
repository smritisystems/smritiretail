/**
 * Project      : SMRITI Retail OS
 * Module       : Pattern C — Master–Detail Split-Pane Workspace (SLGP-001 v2.0)
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * Version      : 5.4.0
 */

import React from "react";

interface MasterDetailWorkspaceProps {
  toolbar?: React.ReactNode;
  masterPanel: React.ReactNode;
  detailPanel: React.ReactNode;
  statusBar?: React.ReactNode;
  masterWidthPx?: number;
}

export const MasterDetailWorkspace: React.FC<MasterDetailWorkspaceProps> = ({
  toolbar,
  masterPanel,
  detailPanel,
  statusBar,
  masterWidthPx = 360
}) => {
  return (
    <div className="w-full h-full flex flex-col overflow-hidden bg-theme-base select-none">
      {/* 1. Fixed Top Operational Toolbar */}
      {toolbar && (
        <div className="shrink-0 border-b border-theme-divider bg-theme-surface-1 px-4 py-2 flex items-center justify-between shadow-xs">
          {toolbar}
        </div>
      )}

      {/* 2. Split-Pane Body (Independent Vertical Scrolling for Left & Right Panels) */}
      <div className="flex-1 min-h-0 flex overflow-hidden">
        {/* Left Panel: Master List / Grid */}
        <div
          style={{ width: `${masterWidthPx}px` }}
          className="shrink-0 border-r border-theme-divider bg-theme-surface-1 flex flex-col overflow-hidden"
        >
          <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2">
            {masterPanel}
          </div>
        </div>

        {/* Right Panel: Detail Form / Inspector */}
        <div className="flex-1 min-h-0 bg-theme-base flex flex-col overflow-hidden">
          <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-6">
            {detailPanel}
          </div>
        </div>
      </div>

      {/* 3. Optional Bottom Status Bar */}
      {statusBar && (
        <div className="shrink-0 border-t border-theme-divider bg-theme-surface-1 px-4 py-1.5 text-xs text-theme-muted font-mono flex items-center justify-between">
          {statusBar}
        </div>
      )}
    </div>
  );
};
