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
import { motion, AnimatePresence } from "motion/react";
import { 
  X, ChevronUp, ChevronDown, Monitor, Search, Sparkles, FolderSync, 
  Trash2, Layers, Plus, Settings, Pin, ExternalLink, Minimize2, 
  Maximize2, Play, Grid, ShieldAlert, Cpu, HardDrive, CheckCircle2,
  ChevronLeft, ChevronRight, Eye, EyeOff
} from "lucide-react";
import { useWorkspace, FloatingWindow } from "../contexts/WorkspaceContext.tsx";
import { useLayoutEngine } from "../layout_engine/layout_store.tsx";
import { SmritiScrollArea } from "./SmritiScrollArea.tsx";

interface PinnedWorkspace {
  tabId: string;
  title: string;
  icon: string;
}

export const WorkspaceTaskbar: React.FC = () => {
  const {
    floatingWindows,
    activeWindowId,
    closeWindow,
    minimizeWindow,
    maximizeWindow,
    restoreWindow,
    setActiveWindowId,
    popOutTab,
    selectWindowTab,
    focusMode,
    toggleFocusMode
  } = useWorkspace();

  const { registeredWorkspaces, addToRecentlyUsed } = useLayoutEngine();

  // Taskbar general preferences
  const [autoHide, setAutoHide] = useState<boolean>(() => {
    return localStorage.getItem("smriti_taskbar_autohide") === "true";
  });
  const [isHovered, setIsHovered] = useState(false);
  const [taskbarOrder, setTaskbarOrder] = useState<string[]>(() => {
    const saved = localStorage.getItem("smriti_taskbar_order");
    return saved ? JSON.parse(saved) : [];
  });
  
  const [pinnedWorkspaces, setPinnedWorkspaces] = useState<PinnedWorkspace[]>(() => {
    const saved = localStorage.getItem("smriti_taskbar_pinned");
    return saved ? JSON.parse(saved) : [
      { tabId: "pos", title: "Billing Desk", icon: "point_of_sale" },
      { tabId: "dashboard", title: "Executive Hub", icon: "dashboard" },
      { tabId: "sales", title: "Sales Studio", icon: "receipt_long" }
    ];
  });

  // UI state
  const [contextMenuWinId, setContextMenuWinId] = useState<string | null>(null);
  const [contextMenuPos, setContextMenuPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isNewWorkspaceMenuOpen, setIsNewWorkspaceMenuOpen] = useState(false);
  const [isWorkspaceManagerOpen, setIsWorkspaceManagerOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [windowSearchQuery, setWindowSearchQuery] = useState("");

  const taskbarRef = useRef<HTMLDivElement>(null);
  const itemsContainerRef = useRef<HTMLDivElement>(null);

  // Sync order when floating windows change
  useEffect(() => {
    const activeIds = floatingWindows.map(w => w.id);
    const updatedOrder = taskbarOrder.filter(id => activeIds.includes(id));
    
    // Add new windows to end of order
    activeIds.forEach(id => {
      if (!updatedOrder.includes(id)) {
        updatedOrder.push(id);
      }
    });

    if (JSON.stringify(updatedOrder) !== JSON.stringify(taskbarOrder)) {
      setTaskbarOrder(updatedOrder);
      localStorage.setItem("smriti_taskbar_order", JSON.stringify(updatedOrder));
    }
  }, [floatingWindows]);

  // Persist pinned
  useEffect(() => {
    localStorage.setItem("smriti_taskbar_pinned", JSON.stringify(pinnedWorkspaces));
  }, [pinnedWorkspaces]);

  // Persist autoHide
  useEffect(() => {
    localStorage.setItem("smriti_taskbar_autohide", String(autoHide));
  }, [autoHide]);

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (contextMenuWinId) {
        setContextMenuWinId(null);
      }
      if (isNewWorkspaceMenuOpen && !(e.target as HTMLElement).closest(".new-workspace-btn")) {
        setIsNewWorkspaceMenuOpen(false);
      }
    };
    window.addEventListener("click", handleClickOutside);
    return () => window.removeEventListener("click", handleClickOutside);
  }, [contextMenuWinId, isNewWorkspaceMenuOpen]);

  // Handle right click on workspace item
  const handleRightClick = (e: React.MouseEvent, windowId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenuWinId(windowId);
    // Position menu above the cursor/taskbar
    const rect = taskbarRef.current?.getBoundingClientRect();
    const taskbarTop = rect ? rect.top : window.innerHeight - 50;
    setContextMenuPos({
      x: Math.min(e.clientX, window.innerWidth - 200),
      y: taskbarTop - 340 // estimated height of context menu
    });
  };

  const handleLeftClickItem = (win: FloatingWindow) => {
    const isActive = activeWindowId === win.id;
    if (isActive) {
      if (win.isMinimized) {
        restoreWindow(win.id);
      } else {
        minimizeWindow(win.id);
      }
    } else {
      if (win.isMinimized) {
        restoreWindow(win.id);
      } else {
        setActiveWindowId(win.id);
      }
    }
  };

  // Pinned workspace helpers
  const togglePin = (tabId: string, title: string, icon: string) => {
    const isPinned = pinnedWorkspaces.some(pw => pw.tabId === tabId);
    if (isPinned) {
      setPinnedWorkspaces(pinnedWorkspaces.filter(pw => pw.tabId !== tabId));
    } else {
      setPinnedWorkspaces([...pinnedWorkspaces, { tabId, title, icon }]);
    }
  };

  const launchPinned = (pw: PinnedWorkspace) => {
    popOutTab(pw.tabId, pw.title, pw.icon);
  };

  // Reordering helpers
  const moveItem = (index: number, direction: "left" | "right") => {
    const newOrder = [...taskbarOrder];
    const targetIdx = direction === "left" ? index - 1 : index + 1;
    if (targetIdx >= 0 && targetIdx < newOrder.length) {
      const temp = newOrder[index];
      newOrder[index] = newOrder[targetIdx];
      newOrder[targetIdx] = temp;
      setTaskbarOrder(newOrder);
      localStorage.setItem("smriti_taskbar_order", JSON.stringify(newOrder));
    }
  };

  // Window actions
  const handleDuplicateWorkspace = (win: FloatingWindow) => {
    if (win.tabs.length > 0) {
      const activeTab = win.tabs[win.activeTabIndex];
      popOutTab(activeTab.tabId, `${activeTab.title} (Copy)`, activeTab.icon);
    }
  };

  const handleCloseOthers = (winId: string) => {
    floatingWindows.forEach(w => {
      if (w.id !== winId) {
        closeWindow(w.id);
      }
    });
  };

  const handleCloseAll = () => {
    floatingWindows.forEach(w => closeWindow(w.id));
  };

  const handleMinimizeAll = () => {
    floatingWindows.forEach(w => minimizeWindow(w.id));
  };

  const handleRestoreAll = () => {
    floatingWindows.forEach(w => restoreWindow(w.id));
  };

  // Scroll taskbar items
  const scrollItems = (direction: "left" | "right") => {
    if (itemsContainerRef.current) {
      const scrollAmount = direction === "left" ? -200 : 200;
      itemsContainerRef.current.scrollBy({ left: scrollAmount, behavior: "smooth" });
    }
  };

  // Search filtered workspaces
  const filteredModules = registeredWorkspaces.filter(w => 
    w.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
    w.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <>
      {/* Taskbar Frame */}
      <div
        ref={taskbarRef}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={`fixed bottom-0 left-0 right-0 z-[9990] transition-all duration-300 font-sans border-t border-theme-divider/70 bg-theme-surface-1 shadow-[0_-4px_24px_rgba(0,0,0,0.7)] ${
          autoHide && !isHovered && floatingWindows.length > 0 && !isWorkspaceManagerOpen && !contextMenuWinId
            ? "translate-y-[calc(100%-4px)] h-12 opacity-40 hover:opacity-100 hover:translate-y-0"
            : "translate-y-0 h-13"
        }`}
      >
        <div className="w-full h-full flex items-center justify-between px-3 md:px-4 gap-3 relative select-none">
          
          {/* Quick Launcher & Controls Section */}
          <div className="flex items-center space-x-1.5 shrink-0">
            {/* New Workspace Popout Dropdown */}
            <div className="relative new-workspace-btn">
              <button
                onClick={() => setIsNewWorkspaceMenuOpen(!isNewWorkspaceMenuOpen)}
                className={`flex items-center space-x-1.5 h-9 px-3 rounded-lg text-xs font-bold transition-all shadow-md ${
                  isNewWorkspaceMenuOpen 
                    ? "bg-indigo-600 text-white" 
                    : "bg-theme-surface-2 text-theme-body hover:bg-theme-surface-3 border border-theme-divider/80"
                }`}
                title="Launch New Floating Workspace Tab"
              >
                <Plus size={14} className="text-indigo-400 shrink-0" />
                <span className="hidden sm:inline">New Workspace</span>
              </button>

              <AnimatePresence>
                {isNewWorkspaceMenuOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute bottom-11 left-0 w-72 max-h-96 bg-theme-surface-1 border border-theme-divider shadow-2xl rounded-xl overflow-hidden flex flex-col z-[9995]"
                  >
                    <div className="p-3 border-b border-theme-divider bg-theme-surface-2 flex items-center space-x-2">
                      <Search size={14} className="text-theme-muted" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search system modules..."
                        className="w-full bg-transparent text-xs text-theme-body placeholder-theme-muted focus:outline-none"
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                    <SmritiScrollArea className="flex-1 max-h-64 p-2">
                      {filteredModules.map((mod) => (
                        <button
                          key={`launcher-${mod.id}`}
                          onClick={() => {
                            popOutTab(mod.id, mod.label, mod.icon);
                            setIsNewWorkspaceMenuOpen(false);
                            addToRecentlyUsed(mod.id);
                          }}
                          className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-theme-surface-2 transition-all text-left text-xs font-medium"
                        >
                          <div className="flex items-center space-x-2.5 min-w-0">
                            <span className="material-symbols-outlined text-[16px] text-indigo-400 shrink-0">
                              {mod.icon}
                            </span>
                            <div className="truncate">
                              <p className="text-white text-xs font-bold">{mod.label}</p>
                              <p className="text-[10px] text-theme-muted">{mod.category}</p>
                            </div>
                          </div>
                          <span className="text-[9px] uppercase font-bold text-indigo-400 px-1 bg-indigo-500/10 rounded">
                            Pop
                          </span>
                        </button>
                      ))}
                      {filteredModules.length === 0 && (
                        <p className="text-[11px] text-theme-muted text-center py-4">No matching modules</p>
                      )}
                    </SmritiScrollArea>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Workspace Bento Manager Trigger */}
            <button
              onClick={() => setIsWorkspaceManagerOpen(true)}
              className="flex items-center justify-center w-9 h-9 bg-theme-surface-2 hover:bg-theme-surface-3 border border-theme-divider/80 text-theme-body rounded-lg transition-all shadow-md"
              title="Overview & Manage Open Workspaces"
            >
              <Grid size={15} className="text-indigo-400" />
            </button>

            {/* Show Desktop (Minimize All) */}
            <button
              onClick={handleMinimizeAll}
              className="flex items-center justify-center w-9 h-9 bg-theme-surface-2 hover:bg-theme-surface-3 border border-theme-divider/80 text-theme-muted hover:text-white rounded-lg transition-all"
              title="Minimize All (Show Desktop)"
            >
              <Monitor size={15} />
            </button>

            {/* Quick layout controls dividers */}
            <div className="w-px h-5 bg-theme-divider mx-1 self-center" />

            {/* Pinned Quick Launch Bar (Desktop/Tablet) */}
            <div className="hidden md:flex items-center space-x-1">
              {pinnedWorkspaces.map(pw => {
                const isOpen = floatingWindows.some(w => w.tabs.some(t => t.tabId === pw.tabId));
                return (
                  <button
                    key={`pin-launch-${pw.tabId}`}
                    onClick={() => launchPinned(pw)}
                    className={`flex items-center space-x-1.5 h-9 px-2.5 rounded-lg text-xs font-semibold transition-all ${
                      isOpen 
                        ? "bg-indigo-500/10 border border-indigo-500/30 text-indigo-300" 
                        : "bg-transparent text-theme-muted hover:text-theme-body hover:bg-theme-surface-2"
                    }`}
                    title={`Open Pinned ${pw.title}`}
                  >
                    <span className="material-symbols-outlined text-[15px] shrink-0">
                      {pw.icon}
                    </span>
                    <span className="max-w-[70px] truncate">{pw.title}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Scrolling Active Workspaces List Container */}
          <div className="flex-1 flex items-center min-w-0 px-2 relative">
            <button
              onClick={() => scrollItems("left")}
              className="absolute left-0 z-10 p-1 rounded bg-theme-surface-2/80 hover:bg-theme-surface-3 text-theme-muted hover:text-white shrink-0 border border-theme-divider shadow-md"
            >
              <ChevronLeft size={13} />
            </button>

            {/* Horizontal scroll box */}
            <div
              ref={itemsContainerRef}
              className="w-full flex items-center space-x-2 overflow-x-auto smriti-hide-scrollbar px-7 py-1"
            >
              <AnimatePresence initial={false}>
                {taskbarOrder.map((id, index) => {
                  const win = floatingWindows.find(w => w.id === id);
                  if (!win || win.tabs.length === 0) return null;
                  
                  const activeTab = win.tabs[win.activeTabIndex];
                  const isActive = activeWindowId === win.id;
                  const isMinimized = win.isMinimized;

                  return (
                    <motion.div
                      key={win.id}
                      initial={{ opacity: 0, scale: 0.8, x: 20 }}
                      animate={{ opacity: 1, scale: 1, x: 0 }}
                      exit={{ opacity: 0, scale: 0.8, x: -20 }}
                      transition={{ type: "spring", stiffness: 350, damping: 25 }}
                      onContextMenu={(e) => handleRightClick(e, win.id)}
                      onClick={() => handleLeftClickItem(win)}
                      className={`flex items-center space-x-2 h-9 px-3 rounded-lg text-xs font-bold cursor-pointer transition-all border shrink-0 select-none relative group ${
                        isActive
                          ? "bg-theme-surface-2 text-white border-indigo-500 shadow-lg ring-1 ring-indigo-500/20"
                          : isMinimized
                          ? "bg-theme-surface-1 border-theme-divider/40 text-theme-muted opacity-50 hover:opacity-80"
                          : "bg-theme-surface-2/60 hover:bg-theme-surface-2 border-theme-divider text-theme-body"
                      }`}
                    >
                      {/* Active status underline dot indicator */}
                      <span className={`absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full transition-all ${
                        isActive ? "bg-indigo-400" : isMinimized ? "bg-theme-muted/50" : "bg-indigo-500/40"
                      }`} />

                      <span className="material-symbols-outlined text-[15px] text-indigo-400 shrink-0">
                        {activeTab.icon}
                      </span>
                      <span className="max-w-[100px] md:max-w-[140px] truncate pr-1">
                        {activeTab.title}
                      </span>

                      {/* Mock unsaved changes indicator (e.g. amber status) */}
                      {win.width > 700 && (
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0 shadow shadow-amber-500/20 animate-pulse" title="Unsaved changes in workspace" />
                      )}

                      {/* Hover actions */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          closeWindow(win.id);
                        }}
                        className="p-0.5 rounded hover:bg-rose-500/10 text-theme-muted hover:text-rose-400 transition-colors opacity-0 group-hover:opacity-100 shrink-0"
                        title="Close Workspace"
                      >
                        <X size={11} />
                      </button>
                    </motion.div>
                  );
                })}
              </AnimatePresence>

              {floatingWindows.length === 0 && (
                <div className="text-[10px] text-theme-muted font-mono italic mx-auto text-center py-1 opacity-70">
                  No active workspaces. Launch modules as floating windows using "New Workspace" or Workspace Toolbar pop-out.
                </div>
              )}
            </div>

            <button
              onClick={() => scrollItems("right")}
              className="absolute right-0 z-10 p-1 rounded bg-theme-surface-2/80 hover:bg-theme-surface-3 text-theme-muted hover:text-white shrink-0 border border-theme-divider shadow-md"
            >
              <ChevronRight size={13} />
            </button>
          </div>

          {/* Quick System Status & Preferences (Right Side) */}
          <div className="flex items-center space-x-2 shrink-0">
            {/* AutoHide toggle indicator */}
            <button
              onClick={() => setAutoHide(!autoHide)}
              className={`p-1.5 rounded-lg border text-xs transition-all ${
                autoHide 
                  ? "bg-indigo-500/10 border-indigo-500/30 text-indigo-400" 
                  : "bg-transparent border-transparent text-theme-muted hover:text-theme-body"
              }`}
              title={autoHide ? "Disable Auto-Hide Taskbar" : "Enable Auto-Hide Taskbar"}
            >
              {autoHide ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>

            {/* Performance Indicators (CPU/Memory Simulation for power-users) */}
            <div className="hidden lg:flex items-center space-x-2.5 px-2.5 py-1.5 rounded-lg bg-theme-surface-2/50 border border-theme-divider/40 text-[10px] text-theme-muted font-mono">
              <div className="flex items-center space-x-1">
                <Cpu size={10} className="text-emerald-400 shrink-0" />
                <span>3.4%</span>
              </div>
              <div className="flex items-center space-x-1">
                <HardDrive size={10} className="text-emerald-400 shrink-0" />
                <span>42MB</span>
              </div>
            </div>

            {/* Reset All layout buttons */}
            <button
              onClick={handleRestoreAll}
              className="p-1.5 rounded-lg bg-theme-surface-2 hover:bg-theme-surface-3 border border-theme-divider/80 text-theme-muted hover:text-white text-xs font-semibold transition-all"
              title="Restore All Windows"
            >
              Restore All
            </button>
          </div>
        </div>

        {/* Right Click context menu portal helper */}
        <AnimatePresence>
          {contextMenuWinId && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              style={{
                position: "fixed",
                left: `${contextMenuPos.x}px`,
                top: `${contextMenuPos.y}px`
              }}
              className="w-52 bg-theme-surface-1 border border-theme-divider shadow-2xl rounded-xl overflow-hidden p-1.5 flex flex-col z-[9999]"
              onClick={(e) => e.stopPropagation()}
            >
              {(() => {
                const targetWin = floatingWindows.find(w => w.id === contextMenuWinId);
                if (!targetWin) return null;
                const activeTab = targetWin.tabs[targetWin.activeTabIndex];
                const isPinned = pinnedWorkspaces.some(pw => pw.tabId === activeTab.tabId);

                return (
                  <>
                    {/* Header info */}
                    <div className="px-2.5 py-2 border-b border-theme-divider/50 bg-theme-surface-2/40 flex items-center space-x-2">
                      <span className="material-symbols-outlined text-[14px] text-indigo-400 shrink-0">
                        {activeTab.icon}
                      </span>
                      <p className="text-[11px] font-bold text-white truncate">{activeTab.title}</p>
                    </div>

                    {/* Window Control operations */}
                    <button
                      onClick={() => {
                        restoreWindow(contextMenuWinId);
                        setContextMenuWinId(null);
                      }}
                      className="w-full flex items-center space-x-2 px-2.5 py-1.5 rounded-lg text-left text-xs text-theme-body hover:bg-theme-surface-2 transition-all font-medium mt-1"
                    >
                      <Play size={12} className="text-indigo-400 shrink-0" />
                      <span>Bring to Front</span>
                    </button>

                    <button
                      onClick={() => {
                        minimizeWindow(contextMenuWinId);
                        setContextMenuWinId(null);
                      }}
                      className="w-full flex items-center space-x-2 px-2.5 py-1.5 rounded-lg text-left text-xs text-theme-body hover:bg-theme-surface-2 transition-all font-medium"
                    >
                      <Minimize2 size={12} className="text-indigo-400 shrink-0" />
                      <span>Minimize</span>
                    </button>

                    <button
                      onClick={() => {
                        maximizeWindow(contextMenuWinId);
                        setContextMenuWinId(null);
                      }}
                      className="w-full flex items-center space-x-2 px-2.5 py-1.5 rounded-lg text-left text-xs text-theme-body hover:bg-theme-surface-2 transition-all font-medium"
                    >
                      <Maximize2 size={12} className="text-indigo-400 shrink-0" />
                      <span>Maximize</span>
                    </button>

                    <div className="h-px bg-theme-divider my-1.5" />

                    {/* Pinned actions */}
                    <button
                      onClick={() => {
                        togglePin(activeTab.tabId, activeTab.title, activeTab.icon);
                        setContextMenuWinId(null);
                      }}
                      className={`w-full flex items-center space-x-2 px-2.5 py-1.5 rounded-lg text-left text-xs font-medium transition-all ${
                        isPinned ? "text-indigo-400 hover:bg-indigo-950/20" : "text-theme-body hover:bg-theme-surface-2"
                      }`}
                    >
                      <Pin size={12} className="shrink-0" />
                      <span>{isPinned ? "Unpin Workspace" : "Pin to Taskbar"}</span>
                    </button>

                    <button
                      onClick={() => {
                        handleDuplicateWorkspace(targetWin);
                        setContextMenuWinId(null);
                      }}
                      className="w-full flex items-center space-x-2 px-2.5 py-1.5 rounded-lg text-left text-xs text-theme-body hover:bg-theme-surface-2 transition-all font-medium"
                    >
                      <Layers size={12} className="text-indigo-400 shrink-0" />
                      <span>Duplicate Workspace</span>
                    </button>

                    <div className="h-px bg-theme-divider my-1.5" />

                    {/* Item list navigation order controls */}
                    <div className="flex items-center justify-between px-2.5 py-1 text-[10px] text-theme-muted font-mono font-bold">
                      <span>Order:</span>
                      <div className="flex items-center space-x-1">
                        <button
                          onClick={() => {
                            const index = taskbarOrder.indexOf(contextMenuWinId);
                            moveItem(index, "left");
                          }}
                          className="p-1 hover:bg-theme-surface-2 rounded text-white"
                          title="Move Item Left"
                        >
                          <ChevronLeft size={11} />
                        </button>
                        <button
                          onClick={() => {
                            const index = taskbarOrder.indexOf(contextMenuWinId);
                            moveItem(index, "right");
                          }}
                          className="p-1 hover:bg-theme-surface-2 rounded text-white"
                          title="Move Item Right"
                        >
                          <ChevronRight size={11} />
                        </button>
                      </div>
                    </div>

                    <div className="h-px bg-theme-divider my-1.5" />

                    {/* Danger Closing rules */}
                    <button
                      onClick={() => {
                        closeWindow(contextMenuWinId);
                        setContextMenuWinId(null);
                      }}
                      className="w-full flex items-center space-x-2 px-2.5 py-1.5 rounded-lg text-left text-xs text-rose-400 hover:bg-rose-500/10 transition-all font-medium"
                    >
                      <X size={12} className="shrink-0" />
                      <span>Close Workspace</span>
                    </button>

                    <button
                      onClick={() => {
                        handleCloseOthers(contextMenuWinId);
                        setContextMenuWinId(null);
                      }}
                      className="w-full flex items-center space-x-2 px-2.5 py-1.5 rounded-lg text-left text-xs text-rose-400 hover:bg-rose-500/10 transition-all font-medium"
                    >
                      <Minimize2 size={12} className="shrink-0" />
                      <span>Close Others</span>
                    </button>

                    <button
                      onClick={() => {
                        handleCloseAll();
                        setContextMenuWinId(null);
                      }}
                      className="w-full flex items-center space-x-2 px-2.5 py-1.5 rounded-lg text-left text-xs text-rose-400 hover:bg-rose-500/10 transition-all font-medium"
                    >
                      <Trash2 size={12} className="shrink-0" />
                      <span>Close All</span>
                    </button>
                  </>
                );
              })()}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Fullscreen Bento Grid Workspace Manager Overlay */}
      <AnimatePresence>
        {isWorkspaceManagerOpen && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-6 bg-black/90 backdrop-blur-md select-none font-sans">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-6xl bg-theme-surface-1 border border-theme-divider shadow-2xl rounded-2xl overflow-hidden flex flex-col max-h-[88vh]"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-theme-divider/70 bg-theme-surface-2">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-xl">
                    <Grid size={20} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white tracking-wide">
                      Workspace Hub & Manager
                    </h3>
                    <p className="text-[10px] text-theme-muted font-mono mt-0.5">
                      Visual grid overview of currently open multitasking sessions
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsWorkspaceManagerOpen(false)}
                  className="p-1.5 rounded-lg hover:bg-theme-surface-3 text-theme-muted hover:text-white transition-all"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Toolbar */}
              <div className="px-6 py-3.5 bg-theme-surface-2/40 border-b border-theme-divider/40 flex flex-wrap gap-4 items-center justify-between">
                <div className="relative w-72">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-theme-muted" />
                  <input
                    type="text"
                    value={windowSearchQuery}
                    onChange={(e) => setWindowSearchQuery(e.target.value)}
                    placeholder="Search active windows..."
                    className="w-full bg-theme-surface-3 border border-theme-divider rounded-lg pl-9 pr-3 py-1.5 text-xs text-theme-body placeholder-theme-muted focus:outline-none focus:border-indigo-500 font-medium"
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={handleRestoreAll}
                    className="px-3 py-1.5 bg-theme-surface-3 hover:bg-theme-surface-hover border border-theme-divider/80 rounded-lg text-xs font-semibold text-theme-body hover:text-white transition-colors"
                  >
                    Restore All
                  </button>
                  <button
                    onClick={handleMinimizeAll}
                    className="px-3 py-1.5 bg-theme-surface-3 hover:bg-theme-surface-hover border border-theme-divider/80 rounded-lg text-xs font-semibold text-theme-body hover:text-white transition-colors"
                  >
                    Minimize All
                  </button>
                  <button
                    onClick={handleCloseAll}
                    className="px-3 py-1.5 bg-rose-950/40 border border-rose-500/30 text-rose-400 hover:bg-rose-500 hover:text-white rounded-lg text-xs font-semibold transition-colors"
                  >
                    Close All Windows
                  </button>
                </div>
              </div>

              {/* Window Bento List */}
              <SmritiScrollArea className="flex-1 p-6">
                {floatingWindows.filter(w => 
                  w.tabs.some(t => t.title.toLowerCase().includes(windowSearchQuery.toLowerCase()))
                ).length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-center text-theme-muted">
                    <Grid size={48} className="mb-4 opacity-30" />
                    <p className="text-sm font-medium">No open workspaces found.</p>
                    <p className="text-xs mt-1 opacity-70">Launch a workspace from the new workspace menu to get started.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {floatingWindows.filter(w => 
                      w.tabs.some(t => t.title.toLowerCase().includes(windowSearchQuery.toLowerCase()))
                    ).map((win) => {
                      const activeTab = win.tabs[win.activeTabIndex];
                      const isActive = activeWindowId === win.id;

                      return (
                        <div
                          key={`bento-${win.id}`}
                          onClick={() => {
                            restoreWindow(win.id);
                            setIsWorkspaceManagerOpen(false);
                          }}
                          className={`p-4 rounded-xl border cursor-pointer transition-all flex flex-col justify-between min-h-36 ${
                            isActive
                              ? "bg-indigo-950/20 border-indigo-500/80 shadow-lg shadow-indigo-950/25 ring-1 ring-indigo-500/30"
                              : win.isMinimized
                              ? "bg-theme-surface-2/40 border-theme-divider/40 opacity-70 hover:opacity-100"
                              : "bg-theme-surface-2 border-theme-divider/70 hover:border-theme-divider"
                          }`}
                        >
                          {/* Bento header */}
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center space-x-2.5 min-w-0">
                              <span className="material-symbols-outlined text-lg text-indigo-400 shrink-0">
                                {activeTab.icon}
                              </span>
                              <div className="truncate">
                                <h4 className="text-xs font-bold text-white tracking-wide">{activeTab.title}</h4>
                                <p className="text-[10px] text-theme-muted mt-0.5">
                                  {win.tabs.length} open {win.tabs.length === 1 ? "tab" : "tabs"}
                                </p>
                              </div>
                            </div>

                            {/* Close window */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                closeWindow(win.id);
                              }}
                              className="p-1 rounded hover:bg-rose-500/10 text-theme-muted hover:text-rose-400 transition-colors"
                            >
                              <X size={13} />
                            </button>
                          </div>

                          {/* Quick details */}
                          <div className="my-3 text-[11px] text-theme-muted font-mono space-y-1">
                            <p>Resolution: {win.width}px × {win.height}px</p>
                            <p>Dock Status: <span className="uppercase text-indigo-400 font-bold">{win.dockStatus}</span></p>
                            <p>Zoom Level: {Math.round(win.zoomLevel * 100)}%</p>
                          </div>

                          {/* Action footer */}
                          <div className="flex items-center justify-between border-t border-theme-divider/40 pt-2.5 mt-2.5">
                            <span className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded ${
                              isActive ? "bg-indigo-500/20 text-indigo-300" : "bg-theme-surface-3 text-theme-muted"
                            }`}>
                              {isActive ? "Active Focused" : win.isMinimized ? "Minimized" : "Background"}
                            </span>

                            <div className="flex items-center space-x-1.5" onClick={e => e.stopPropagation()}>
                              <button
                                onClick={() => {
                                  if (win.isMinimized) {
                                    restoreWindow(win.id);
                                  } else {
                                    minimizeWindow(win.id);
                                  }
                                }}
                                className="p-1.5 rounded bg-theme-surface-3 hover:bg-theme-surface-hover text-theme-muted hover:text-white"
                                title="Toggle Minimize"
                              >
                                <Minimize2 size={11} />
                              </button>
                              <button
                                onClick={() => {
                                  if (win.isMaximized) {
                                    restoreWindow(win.id);
                                  } else {
                                    maximizeWindow(win.id);
                                  }
                                }}
                                className="p-1.5 rounded bg-theme-surface-3 hover:bg-theme-surface-hover text-theme-muted hover:text-white"
                                title="Toggle Maximize"
                              >
                                <Maximize2 size={11} />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </SmritiScrollArea>

              {/* Bento Footer */}
              <div className="px-6 py-4 border-t border-theme-divider/70 bg-theme-surface-2/40 flex items-center justify-between text-xs text-theme-muted">
                <span>Multi-session multitasking environment</span>
                <span className="font-mono text-[10px]">Total open windows: {floatingWindows.length}</span>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};
