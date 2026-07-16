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
 * * Websites: aitdl.com | erpnbook.com | smritibooks.com
 *
 * * Version    : 2.1.1
 * * Created    : 2026-07-10
 * * Modified   : 2026-07-11
 * * Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
 * * License    : Proprietary Commercial Software
 */

import React, { useState, useEffect, useRef } from "react";
import { 
  X, 
  Minus, 
  Square, 
  Copy, 
  ExternalLink, 
  ZoomIn, 
  ZoomOut, 
  Maximize2, 
  LayoutGrid, 
  Columns,
  FolderSync,
  Layers,
  ChevronDown,
  ArrowRightLeft
} from "lucide-react";
import { useWorkspace, FloatingWindow } from "../contexts/WorkspaceContext.tsx";

interface FloatingWindowHostProps {
  renderTab: (tabId: string) => React.ReactNode;
}

export const FloatingWindowHost: React.FC<FloatingWindowHostProps> = ({ renderTab }) => {
  const {
    floatingWindows,
    activeWindowId,
    dragSnapPreview,
    closeWindow,
    minimizeWindow,
    maximizeWindow,
    restoreWindow,
    updateWindowPosition,
    updateWindowSize,
    updateWindowGeometry,
    setActiveWindowId,
    setDragSnapPreview,
    snapWindow,
    tabTogether,
    moveTabToNewWindow,
    selectWindowTab,
    closeWindowTab,
    focusMode,
  } = useWorkspace();

  const [activeDragWindow, setActiveDragWindow] = useState<string | null>(null);
  const [showMergeMenu, setShowMergeMenu] = useState<string | null>(null);

  // Drag snapping preview coordinate state
  const mainHeaderHeight = focusMode ? 0 : 72;
  const snapPreviewStyles = {
    none: "hidden",
    left: `absolute left-0 w-1/2 bg-blue-500/10 border-r-2 border-dashed border-blue-500 z-50 transition-all duration-150`,
    right: `absolute right-0 w-1/2 bg-blue-500/10 border-l-2 border-dashed border-blue-500 z-50 transition-all duration-150`,
    top: `absolute top-[${mainHeaderHeight}px] w-full bg-blue-500/10 border-b-2 border-dashed border-blue-500 z-50 transition-all duration-150`,
    bottom: `absolute bottom-0 w-full h-1/2 bg-blue-500/10 border-t-2 border-dashed border-blue-500 z-50 transition-all duration-150`,
    full: `absolute inset-0 bg-blue-500/15 border-2 border-dashed border-blue-500 z-50 transition-all duration-150`,
  };

  // Drag Handler
  const startDrag = (e: React.MouseEvent, win: FloatingWindow) => {
    if (win.isMaximized || win.dockStatus !== "none") return;
    
    e.preventDefault();
    setActiveWindowId(win.id);
    setActiveDragWindow(win.id);

    const startX = e.clientX - win.x;
    const startY = e.clientY - win.y;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      let nextX = moveEvent.clientX - startX;
      let nextY = moveEvent.clientY - startY;

      // Restrict coordinate limits
      nextX = Math.max(-100, Math.min(window.innerWidth - 100, nextX));
      nextY = Math.max(mainHeaderHeight, Math.min(window.innerHeight - 50, nextY));

      // Snapping detection
      let preview: "none" | "left" | "right" | "top" | "bottom" | "full" = "none";
      if (moveEvent.clientX < 40) {
        preview = "left";
      } else if (moveEvent.clientX > window.innerWidth - 40) {
        preview = "right";
      } else if (moveEvent.clientY < mainHeaderHeight + 40) {
        preview = "top";
      } else if (moveEvent.clientY > window.innerHeight - 40) {
        preview = "bottom";
      }

      setDragSnapPreview(preview);
      updateWindowPosition(win.id, nextX, nextY);
    };

    const handleMouseUp = (upEvent: MouseEvent) => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      
      setActiveDragWindow(null);

      // Lock current preview snap
      let finalSnap: "none" | "left" | "right" | "top" | "bottom" | "full" = "none";
      if (upEvent.clientX < 40) finalSnap = "left";
      else if (upEvent.clientX > window.innerWidth - 40) finalSnap = "right";
      else if (upEvent.clientY < mainHeaderHeight + 40) finalSnap = "top";
      else if (upEvent.clientY > window.innerHeight - 40) finalSnap = "bottom";

      if (finalSnap !== "none") {
        snapWindow(win.id, finalSnap);
      }
      setDragSnapPreview("none");
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  // Resize Handler
  const startResize = (e: React.MouseEvent, win: FloatingWindow, direction: string) => {
    e.preventDefault();
    e.stopPropagation();
    setActiveWindowId(win.id);

    const startWidth = win.width;
    const startHeight = win.height;
    const startX = win.x;
    const startY = win.y;
    const mouseStartX = e.clientX;
    const mouseStartY = e.clientY;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - mouseStartX;
      const deltaY = moveEvent.clientY - mouseStartY;

      let newWidth = startWidth;
      let newHeight = startHeight;
      let newX = startX;
      let newY = startY;

      const minWidth = 450;
      const minHeight = 300;

      // Handle horizontal resize
      if (direction.includes("e") || direction === "r" || direction === "rb") {
        newWidth = Math.max(minWidth, startWidth + deltaX);
      } else if (direction.includes("w")) {
        const computedWidth = startWidth - deltaX;
        if (computedWidth >= minWidth) {
          newWidth = computedWidth;
          newX = startX + deltaX;
        } else {
          newWidth = minWidth;
          newX = startX + (startWidth - minWidth);
        }
      }

      // Handle vertical resize
      if (direction.includes("s") || direction === "b" || direction === "rb") {
        newHeight = Math.max(minHeight, startHeight + deltaY);
      } else if (direction.includes("n")) {
        const computedHeight = startHeight - deltaY;
        if (computedHeight >= minHeight) {
          newHeight = computedHeight;
          newY = startY + deltaY;
        } else {
          newHeight = minHeight;
          newY = startY + (startHeight - minHeight);
        }
      }

      updateWindowGeometry(win.id, newX, newY, newWidth, newHeight);
    };

    const handleMouseUp = () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      window.dispatchEvent(new Event("resize"));
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  // Keyboard Shortcut Handler for Active Windows (Alt+W/Ctrl+Shift+W to close, Ctrl+M to maximize)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!activeWindowId) return;

      // Ctrl + M (Toggle Maximize/Restore)
      if (e.ctrlKey && e.key.toLowerCase() === "m") {
        e.preventDefault();
        const activeWin = floatingWindows.find(w => w.id === activeWindowId);
        if (activeWin) {
          if (activeWin.isMaximized) {
            restoreWindow(activeWin.id);
          } else {
            maximizeWindow(activeWin.id);
          }
        }
      }

      // Alt + W or Ctrl + Shift + W (Close Focused Floating Window)
      // Note: We use Alt+W and Ctrl+Shift+W to prevent closing the browser tab (Ctrl+W)
      if ((e.altKey && e.key.toLowerCase() === "w") || (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "w")) {
        e.preventDefault();
        closeWindow(activeWindowId);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [activeWindowId, floatingWindows, maximizeWindow, restoreWindow, closeWindow]);

  // Only render non-minimized windows
  const activeWindows = floatingWindows.filter((w) => !w.isMinimized);

  if (activeWindows.length === 0) return null;

  return (
    <div className="absolute inset-0 pointer-events-none z-40 select-none overflow-hidden">
      {/* Snap Preview Overlay */}
      {dragSnapPreview !== "none" && (
        <div 
          className={snapPreviewStyles[dragSnapPreview]}
          style={{
            top: dragSnapPreview === "top" || dragSnapPreview === "full" || dragSnapPreview === "left" || dragSnapPreview === "right" 
              ? `${mainHeaderHeight}px` 
              : undefined,
            height: dragSnapPreview === "top" 
              ? `${(window.innerHeight - mainHeaderHeight) / 2}px` 
              : dragSnapPreview === "full" || dragSnapPreview === "left" || dragSnapPreview === "right"
                ? `${window.innerHeight - mainHeaderHeight}px`
                : undefined
          }}
        >
          <div className="w-full h-full flex items-center justify-center animate-pulse">
            <span className="text-xs font-mono font-bold text-blue-400 uppercase tracking-widest bg-blue-950/80 border border-blue-500/35 px-4 py-2 rounded-lg">
              Release to Snap {dragSnapPreview}
            </span>
          </div>
        </div>
      )}

      {/* Floating Windows Map */}
      {activeWindows.map((win) => {
        const isActive = activeWindowId === win.id;
        const currentTab = win.tabs[win.activeTabIndex] || win.tabs[0];
        
        return (
          <div
            key={win.id}
            onClick={() => setActiveWindowId(win.id)}
            style={{
              position: "absolute",
              left: `${win.x}px`,
              top: `${win.y}px`,
              width: `${win.width}px`,
              height: `${win.height}px`,
              zIndex: win.zIndex,
            }}
            className={`pointer-events-auto flex flex-col rounded-xl overflow-hidden shadow-2xl border transition-all duration-100 ease-out bg-theme-surface-1 select-text ${
              isActive 
                ? "border-blue-500 ring-1 ring-blue-500/20 shadow-blue-950/30" 
                : "border-theme-divider hover:border-theme-muted"
            }`}
          >
            {/* Header / Tab Strip (Drag Handle) */}
            <div 
              onMouseDown={(e) => startDrag(e, win)}
              onDoubleClick={() => win.isMaximized ? restoreWindow(win.id) : maximizeWindow(win.id)}
              className={`flex-shrink-0 h-11 flex items-center justify-between border-b border-theme-divider px-3 cursor-move select-none ${
                isActive ? "bg-theme-surface-2" : "bg-theme-surface-1"
              }`}
            >
              {/* Tabs Section */}
              <div className="flex items-center space-x-1.5 overflow-x-auto smriti-hide-scrollbar max-w-[70%]">
                {win.tabs.map((tab, idx) => {
                  const isTabActive = win.activeTabIndex === idx;
                  return (
                    <div
                      key={`${win.id}_tab_${idx}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        selectWindowTab(win.id, idx);
                      }}
                      className={`flex items-center space-x-1.5 px-3 py-1 rounded-lg text-xs font-medium cursor-pointer transition-colors border ${
                        isTabActive
                          ? "bg-theme-surface-3 text-theme-body border-blue-500/30"
                          : "text-theme-muted hover:text-theme-primary hover:bg-theme-surface-hover border-transparent"
                      }`}
                    >
                      <span className="material-symbols-outlined text-[14px] text-blue-500">
                        {tab.icon}
                      </span>
                      <span className="truncate max-w-[80px] font-display">
                        {tab.title}
                      </span>
                      
                      {/* Pop tab to new window */}
                      {win.tabs.length > 1 && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            moveTabToNewWindow(win.id, idx);
                          }}
                          className="p-0.5 rounded text-theme-muted hover:text-theme-body hover:bg-theme-surface-2 ml-1"
                          title="Pop to New Window"
                        >
                          <ExternalLink size={10} />
                        </button>
                      )}

                      {/* Close Tab */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          closeWindowTab(win.id, idx);
                        }}
                        className="p-0.5 rounded text-theme-muted hover:text-rose-400 hover:bg-rose-500/10 ml-1"
                      >
                        <X size={10} />
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Action Buttons & Helpers */}
              <div className="flex items-center space-x-1">
                {/* Tab With other windows dropdown */}
                {floatingWindows.length > 1 && (
                  <div className="relative">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowMergeMenu(showMergeMenu === win.id ? null : win.id);
                      }}
                      className="p-1 rounded text-theme-muted hover:text-theme-body hover:bg-theme-surface-hover flex items-center space-x-0.5"
                      title="Group/Tab with..."
                    >
                      <Layers size={12} />
                      <ChevronDown size={10} />
                    </button>
                    {showMergeMenu === win.id && (
                      <>
                        <div className="fixed inset-0 z-30" onClick={() => setShowMergeMenu(null)} />
                        <div className="absolute right-0 mt-1 w-48 rounded-lg bg-theme-surface-3 border border-theme-divider shadow-xl py-1 z-40 text-xs">
                          <div className="px-2.5 py-1 text-[9px] font-mono text-theme-muted uppercase tracking-wider font-bold">
                            Group Workspace
                          </div>
                          {floatingWindows
                            .filter((w) => w.id !== win.id)
                            .map((other) => (
                              <button
                                key={`merge_to_${other.id}`}
                                onClick={() => {
                                  tabTogether(win.id, other.id);
                                  setShowMergeMenu(null);
                                }}
                                className="w-full text-left px-3 py-1.5 hover:bg-theme-surface-hover text-theme-body flex items-center space-x-1.5"
                              >
                                <ArrowRightLeft size={11} className="text-blue-500" />
                                <span className="truncate">Tab with win {other.tabs[0]?.title}</span>
                              </button>
                            ))}
                        </div>
                      </>
                    )}
                  </div>
                )}

                <div className="w-px h-3 bg-theme-divider mx-1"></div>

                {/* Minimize window */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    minimizeWindow(win.id);
                  }}
                  className="p-1 rounded text-theme-muted hover:text-theme-body hover:bg-theme-surface-hover"
                  title="Minimize"
                >
                  <Minus size={12} />
                </button>

                {/* Maximize / Restore window */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    win.isMaximized ? restoreWindow(win.id) : maximizeWindow(win.id);
                  }}
                  className="p-1 rounded text-theme-muted hover:text-theme-body hover:bg-theme-surface-hover"
                  title={win.isMaximized ? "Restore Down" : "Maximize"}
                >
                  <Square size={10} />
                </button>

                {/* Close Window */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    closeWindow(win.id);
                  }}
                  className="p-1 rounded text-theme-muted hover:text-rose-400 hover:bg-rose-500/10"
                  title="Close"
                >
                  <X size={12} />
                </button>
              </div>
            </div>

            {/* Window Content Container (Zoomable Frame) */}
            <div className="flex-1 overflow-hidden relative bg-theme-base select-text">
              <div 
                style={{
                  transform: `scale(${win.zoomLevel})`,
                  transformOrigin: "top left",
                  width: `${100 / win.zoomLevel}%`,
                  height: `${100 / win.zoomLevel}%`,
                }}
                className="overflow-auto h-full p-4"
              >
                {renderTab(currentTab.tabId)}
              </div>
            </div>

            {/* Resize Handles (Only if not maximized) */}
            {!win.isMaximized && win.dockStatus === "none" && (
              <>
                {/* Top Edge */}
                <div
                  onMouseDown={(e) => startResize(e, win, "n")}
                  className="group absolute top-0 left-4 right-4 h-2 cursor-n-resize z-20 flex items-start justify-center"
                >
                  <div className="w-12 h-[3px] bg-theme-divider/70 group-hover:bg-blue-500/95 rounded-full transition-all duration-150 mt-0.5" />
                </div>
                {/* Bottom Edge */}
                <div
                  onMouseDown={(e) => startResize(e, win, "s")}
                  className="group absolute bottom-0 left-4 right-4 h-2 cursor-s-resize z-20 flex items-end justify-center"
                >
                  <div className="w-12 h-[3px] bg-theme-divider/70 group-hover:bg-blue-500/95 rounded-full transition-all duration-150 mb-0.5" />
                </div>
                {/* Right Edge */}
                <div
                  onMouseDown={(e) => startResize(e, win, "e")}
                  className="group absolute top-4 bottom-4 right-0 w-2 cursor-e-resize z-20 flex items-center justify-end"
                >
                  <div className="w-[3px] h-12 bg-theme-divider/70 group-hover:bg-blue-500/95 rounded-full transition-all duration-150 mr-0.5" />
                </div>
                {/* Left Edge */}
                <div
                  onMouseDown={(e) => startResize(e, win, "w")}
                  className="group absolute top-4 bottom-4 left-0 w-2 cursor-w-resize z-20 flex items-center justify-start"
                >
                  <div className="w-[3px] h-12 bg-theme-divider/70 group-hover:bg-blue-500/95 rounded-full transition-all duration-150 ml-0.5" />
                </div>
                {/* Top-Left Corner */}
                <div
                  onMouseDown={(e) => startResize(e, win, "nw")}
                  className="group absolute top-0 left-0 w-4 h-4 cursor-nw-resize z-30 flex items-start justify-start p-1"
                  title="Resize"
                >
                  <div className="w-2.5 h-2.5 border-t-2 border-l-2 border-theme-divider/70 group-hover:border-blue-500 transition-all duration-150 rounded-tl" />
                </div>
                {/* Top-Right Corner */}
                <div
                  onMouseDown={(e) => startResize(e, win, "ne")}
                  className="group absolute top-0 right-0 w-4 h-4 cursor-ne-resize z-30 flex items-start justify-end p-1"
                  title="Resize"
                >
                  <div className="w-2.5 h-2.5 border-t-2 border-r-2 border-theme-divider/70 group-hover:border-blue-500 transition-all duration-150 rounded-tr" />
                </div>
                {/* Bottom-Left Corner */}
                <div
                  onMouseDown={(e) => startResize(e, win, "sw")}
                  className="group absolute bottom-0 left-0 w-4 h-4 cursor-sw-resize z-30 flex items-end justify-start p-1"
                  title="Resize"
                >
                  <div className="w-2.5 h-2.5 border-b-2 border-l-2 border-theme-divider/70 group-hover:border-blue-500 transition-all duration-150 rounded-bl" />
                </div>
                {/* Bottom-Right Corner */}
                <div
                  onMouseDown={(e) => startResize(e, win, "se")}
                  className="group absolute bottom-0 right-0 w-4 h-4 cursor-se-resize z-30 flex items-end justify-end p-1"
                  title="Resize"
                >
                  <div className="w-2.5 h-2.5 border-b-2 border-r-2 border-theme-divider/70 group-hover:border-blue-500 transition-all duration-150 rounded-br flex items-end justify-end relative">
                    <span className="absolute bottom-[2px] right-[2px] w-1 h-1 bg-theme-divider/70 group-hover:bg-blue-500 transition-all duration-150 rounded-full" />
                  </div>
                </div>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
};
