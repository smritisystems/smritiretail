/**
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Organization : AITDL NETWORKS
 *
 * Founders
 *
 * * Pushpa Devi Jawahar Mallah
 *   * Founder & Chairperson
 *   * Phone: +91 9324117007
 *   * Email: founder@aitdl.com
 *
 * * Jawahar Ramkripal Mallah
 *   * Founder, Chief Executive Officer (CEO) & Chief Software Architect
 *   * Email: founder@aitdl.com
 *
 * * Websites: smritisys.com | aitdl.com | erpnbook.com | smritibooks.com
 *
 * * Version    : 2.1.2
 * * Created    : 2026-07-10
 * * Modified   : 2026-07-11
 * * Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
 * * License    : Proprietary Commercial Software
 */

import React from "react";
import { 
  ZoomIn, 
  ZoomOut, 
  RotateCcw, 
  ExternalLink, 
  Maximize2, 
  Minimize2, 
  Tv, 
  LayoutGrid, 
  Columns,
  Eye,
  EyeOff,
  Keyboard,
  Printer
} from "lucide-react";
import { useWorkspace } from "../contexts/WorkspaceContext.tsx";
import { useLayoutEngine } from "../layout_engine/layout_store.tsx";
import { useShortcuts } from "../contexts/ShortcutContext.tsx";
import { AdaptiveWorkspaceHeader } from "./common/AdaptiveWorkspaceHeader.tsx";

interface WorkspaceToolbarProps {
  currentTabId: string;
  isFloating?: boolean;
  windowId?: string;
}

export const WorkspaceToolbar: React.FC<WorkspaceToolbarProps> = ({
  currentTabId,
  isFloating = false,
  windowId,
}) => {
  const { 
    focusMode, 
    globalZoom, 
    floatingWindows,
    toggleFocusMode, 
    adjustGlobalZoom, 
    resetGlobalZoom, 
    popOutTab,
    closeWindow,
    updateWindowZoom,
    resetWindowZoom,
    tileWorkspaces,
    arrangeSideBySide,
    snapWindow
  } = useWorkspace();

  const { registeredWorkspaces } = useLayoutEngine();
  const { setPaletteOpen } = useShortcuts();
  
  // Find current tab details
  const tabConfig = registeredWorkspaces.find((w) => w.id === currentTabId);
  const title = tabConfig ? tabConfig.label : "Workspace Document";
  const icon = tabConfig ? tabConfig.icon : "description";

  const zoomValue = isFloating && windowId
    ? floatingWindows.find((w) => w.id === windowId)?.zoomLevel || 1.0
    : globalZoom;

  const handleZoomIn = () => {
    if (isFloating && windowId) {
      updateWindowZoom(windowId, 0.1);
    } else {
      adjustGlobalZoom(0.1);
    }
  };

  const handleZoomOut = () => {
    if (isFloating && windowId) {
      updateWindowZoom(windowId, -0.1);
    } else {
      adjustGlobalZoom(-0.1);
    }
  };

  const handleResetZoom = () => {
    if (isFloating && windowId) {
      resetWindowZoom(windowId);
    } else {
      resetGlobalZoom();
    }
  };

  const handlePopOut = () => {
    popOutTab(currentTabId, title, icon);
  };

  const handleFullScreenToggle = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => {
        console.warn(`Error enabling fullscreen: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  };

  return (
    <div className={`flex items-center justify-between border-b border-theme-divider px-4 py-2.5 ${
      isFloating ? "bg-theme-surface-3" : "bg-theme-surface-1"
    } select-none`}>
      {/* Title & Status */}
      <div className="flex items-center space-x-2.5">
        <span className="material-symbols-outlined text-blue-500 text-lg">
          {icon}
        </span>
        <h2 className="text-xs font-display font-semibold text-theme-body tracking-wide">
          {title}
        </h2>
        
        {/* Adaptive Workspace Mode Switcher (Simple / Hybrid / Advanced) */}
        {!isFloating && (
          <div className="ml-3">
            <AdaptiveWorkspaceHeader />
          </div>
        )}
      </div>

      {/* Control Actions Panel */}
      <div className="flex items-center space-x-1.5">
        {/* Workspace Layout Arrangement (Only show in main area if floating windows exist) */}
        {!isFloating && floatingWindows.length > 0 && (
          <div className="flex items-center space-x-1 pr-3 mr-3 border-r border-theme-divider">
            <button
              onClick={tileWorkspaces}
              className="p-1.5 rounded-lg text-theme-muted hover:text-theme-body hover:bg-theme-surface-hover transition-all cursor-pointer"
              title="Tile Floating Workspaces"
            >
              <LayoutGrid size={14} />
            </button>
            <button
              onClick={arrangeSideBySide}
              className="p-1.5 rounded-lg text-theme-muted hover:text-theme-body hover:bg-theme-surface-hover transition-all cursor-pointer"
              title="Arrange Side-by-Side"
            >
              <Columns size={14} />
            </button>
          </div>
        )}

        {/* Zoom Level Indicator */}
        <div className="text-[10px] font-mono text-theme-muted bg-theme-surface-2 px-2 py-1 rounded border border-theme-divider mr-1.5">
          Zoom: <strong className="text-theme-body">{(zoomValue * 100).toFixed(0)}%</strong>
        </div>

        {/* Zoom Actions */}
        <button
          onClick={handleZoomOut}
          disabled={zoomValue <= 0.5}
          className="p-1.5 rounded-lg text-theme-muted hover:text-theme-body hover:bg-theme-surface-hover transition-all cursor-pointer disabled:opacity-40"
          title="Zoom Out"
        >
          <ZoomOut size={14} />
        </button>
        <button
          onClick={handleZoomIn}
          disabled={zoomValue >= 2.0}
          className="p-1.5 rounded-lg text-theme-muted hover:text-theme-body hover:bg-theme-surface-hover transition-all cursor-pointer disabled:opacity-40"
          title="Zoom In"
        >
          <ZoomIn size={14} />
        </button>
        <button
          onClick={handleResetZoom}
          className="p-1.5 rounded-lg text-theme-muted hover:text-theme-body hover:bg-theme-surface-hover transition-all cursor-pointer"
          title="Reset Zoom (100%)"
        >
          <RotateCcw size={14} />
        </button>

        <div className="w-px h-4 bg-theme-divider mx-1.5"></div>

        {/* Focus Mode & Screen Actions (Only for main workspace) */}
        {!isFloating && (
          <>
            <button
              onClick={toggleFocusMode}
              className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                focusMode 
                  ? "bg-blue-600/10 text-blue-400 border border-blue-500/20" 
                  : "text-theme-muted hover:text-theme-body hover:bg-theme-surface-hover"
              }`}
              title={focusMode ? "Exit Focus Mode" : "Focus Mode (F11)"}
            >
              {focusMode ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>

            <button
              onClick={handlePopOut}
              className="p-1.5 rounded-lg text-theme-muted hover:text-theme-body hover:bg-theme-surface-hover transition-all cursor-pointer"
              title="Pop-out Page to Floating Workspace (Ctrl+Shift+P)"
            >
              <ExternalLink size={14} />
            </button>

            <button
              onClick={() => window.dispatchEvent(new CustomEvent("smriti_open_print_preview"))}
              className="p-1.5 rounded-lg text-theme-muted hover:text-theme-body hover:bg-theme-surface-hover transition-all cursor-pointer"
              title="Print & Document Preview Engine (Ctrl + P / Alt + P)"
            >
              <Printer size={14} />
            </button>
          </>
        )}

        {/* Full Screen Toggle */}
        <button
          onClick={handleFullScreenToggle}
          className="p-1.5 rounded-lg text-theme-muted hover:text-theme-body hover:bg-theme-surface-hover transition-all cursor-pointer"
          title="Toggle Native Full Screen"
        >
          <Maximize2 size={14} />
        </button>

        {/* Central Keyboard Shortcuts / Command Palette Trigger */}
        <button
          onClick={() => setPaletteOpen(true)}
          className="p-1.5 rounded-lg text-theme-muted hover:text-theme-body hover:bg-theme-surface-hover transition-all cursor-pointer"
          title="SMRITI Keyboard Shortcuts & Command Palette (Alt + Space)"
        >
          <Keyboard size={14} />
        </button>

        {isFloating && windowId && (
          <>
            <div className="w-px h-4 bg-theme-divider mx-1.5"></div>
            <button
              onClick={() => closeWindow(windowId)}
              className="p-1.5 rounded-lg hover:bg-rose-500/10 text-theme-muted hover:text-rose-400 transition-all cursor-pointer"
              title="Close Workspace Window"
            >
              <Minimize2 size={14} />
            </button>
          </>
        )}
      </div>
    </div>
  );
};
