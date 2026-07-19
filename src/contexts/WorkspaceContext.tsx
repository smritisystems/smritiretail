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
 * * Version    : 2.1.1
 * * Created    : 2026-07-10
 * * Modified   : 2026-07-11
 * * Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
 * * License    : Proprietary Commercial Software
 */

import React, { createContext, useContext, useState, useEffect } from "react";

export interface WindowTab {
  tabId: string;
  title: string;
  icon: string;
}

export interface FloatingWindow {
  id: string;
  tabs: WindowTab[];
  activeTabIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
  isMinimized: boolean;
  isMaximized: boolean;
  zoomLevel: number;
  dockStatus: "none" | "left" | "right" | "top" | "bottom" | "full";
  zIndex: number;
  restoreState?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

interface WorkspaceContextType {
  focusMode: boolean;
  globalZoom: number;
  floatingWindows: FloatingWindow[];
  activeWindowId: string | null;
  dragSnapPreview: "none" | "left" | "right" | "top" | "bottom" | "full";
  
  toggleFocusMode: () => void;
  setFocusMode: (mode: boolean) => void;
  adjustGlobalZoom: (delta: number) => void;
  resetGlobalZoom: () => void;
  
  popOutTab: (tabId: string, title: string, icon: string) => void;
  closeWindow: (id: string) => void;
  minimizeWindow: (id: string) => void;
  maximizeWindow: (id: string) => void;
  restoreWindow: (id: string) => void;
  updateWindowPosition: (id: string, x: number, y: number) => void;
  updateWindowSize: (id: string, width: number, height: number) => void;
  updateWindowGeometry: (id: string, x: number, y: number, width: number, height: number) => void;
  updateWindowZoom: (id: string, delta: number) => void;
  resetWindowZoom: (id: string) => void;
  setActiveWindowId: (id: string | null) => void;
  setDragSnapPreview: (preview: "none" | "left" | "right" | "top" | "bottom" | "full") => void;
  snapWindow: (id: string, position: "none" | "left" | "right" | "top" | "bottom" | "full") => void;
  
  // Docking & Multi-Window Layout arrangements
  tileWorkspaces: () => void;
  arrangeSideBySide: () => void;
  tabTogether: (sourceWindowId: string, targetWindowId: string) => void;
  moveTabToNewWindow: (windowId: string, tabIndex: number) => void;
  selectWindowTab: (windowId: string, tabIndex: number) => void;
  closeWindowTab: (windowId: string, tabIndex: number) => void;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

export const WorkspaceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Restore State from LocalStorage
  const [focusMode, setFocusModeState] = useState<boolean>(() => {
    const saved = localStorage.getItem("smriti_workspace_focus_mode");
    return saved === "true";
  });

  const [globalZoom, setGlobalZoom] = useState<number>(() => {
    const saved = localStorage.getItem("smriti_workspace_global_zoom");
    return saved ? parseFloat(saved) : 1.0;
  });

  const [floatingWindows, setFloatingWindows] = useState<FloatingWindow[]>(() => {
    const saved = localStorage.getItem("smriti_workspace_floating_windows");
    return saved ? JSON.parse(saved) : [];
  });

  const [activeWindowId, setActiveWindowId] = useState<string | null>(null);
  const [dragSnapPreview, setDragSnapPreview] = useState<"none" | "left" | "right" | "top" | "bottom" | "full">("none");

  // Save changes to LocalStorage
  useEffect(() => {
    localStorage.setItem("smriti_workspace_focus_mode", String(focusMode));
  }, [focusMode]);

  useEffect(() => {
    localStorage.setItem("smriti_workspace_global_zoom", String(globalZoom));
  }, [globalZoom]);

  useEffect(() => {
    localStorage.setItem("smriti_workspace_floating_windows", JSON.stringify(floatingWindows));
  }, [floatingWindows]);

  const toggleFocusMode = () => {
    setFocusModeState((prev) => !prev);
  };

  const setFocusMode = (mode: boolean) => {
    setFocusModeState(mode);
  };

  const adjustGlobalZoom = (delta: number) => {
    setGlobalZoom((prev) => Math.max(0.5, Math.min(2.0, Number((prev + delta).toFixed(2)))));
  };

  const resetGlobalZoom = () => {
    setGlobalZoom(1.0);
  };

  const getNextZIndex = () => {
    if (floatingWindows.length === 0) return 100;
    const maxZ = Math.max(...floatingWindows.map((w) => w.zIndex));
    return maxZ + 1;
  };

  const popOutTab = (tabId: string, title: string, icon: string) => {
    // If the tab is already opened in a floating window, focus it
    const existing = floatingWindows.find((w) => w.tabs.some((t) => t.tabId === tabId));
    if (existing) {
      const tabIdx = existing.tabs.findIndex((t) => t.tabId === tabId);
      selectWindowTab(existing.id, tabIdx);
      setActiveWindowId(existing.id);
      return;
    }

    const id = `win_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const nextZ = getNextZIndex();
    
    // Default initial coordinates for pop-out
    const offset = (floatingWindows.length * 30) % 150;
    const initialWidth = Math.min(800, window.innerWidth - 100);
    const initialHeight = Math.min(600, window.innerHeight - 150);
    
    const newWindow: FloatingWindow = {
      id,
      tabs: [{ tabId, title, icon }],
      activeTabIndex: 0,
      x: 100 + offset,
      y: 120 + offset,
      width: initialWidth,
      height: initialHeight,
      isMinimized: false,
      isMaximized: false,
      zoomLevel: 1.0,
      dockStatus: "none",
      zIndex: nextZ,
    };

    setFloatingWindows((prev) => [...prev, newWindow]);
    setActiveWindowId(id);
  };

  const closeWindow = (id: string) => {
    setFloatingWindows((prev) => prev.filter((w) => w.id !== id));
    if (activeWindowId === id) {
      setActiveWindowId(null);
    }
  };

  const minimizeWindow = (id: string) => {
    setFloatingWindows((prev) =>
      prev.map((w) => (w.id === id ? { ...w, isMinimized: true } : w))
    );
  };

  const maximizeWindow = (id: string) => {
    setFloatingWindows((prev) =>
      prev.map((w) => {
        if (w.id === id) {
          return {
            ...w,
            isMaximized: true,
            isMinimized: false,
            dockStatus: "full",
            restoreState: { x: w.x, y: w.y, width: w.width, height: w.height },
          };
        }
        return w;
      })
    );
    setActiveWindowId(id);
  };

  const restoreWindow = (id: string) => {
    setFloatingWindows((prev) =>
      prev.map((w) => {
        if (w.id === id) {
          const restored = w.restoreState || { x: 100, y: 120, width: 700, height: 500 };
          return {
            ...w,
            isMaximized: false,
            isMinimized: false,
            dockStatus: "none",
            ...restored,
          };
        }
        return w;
      })
    );
    setActiveWindowId(id);
  };

  const updateWindowPosition = (id: string, x: number, y: number) => {
    setFloatingWindows((prev) =>
      prev.map((w) => (w.id === id ? { ...w, x, y, dockStatus: "none" } : w))
    );
  };

  const updateWindowSize = (id: string, width: number, height: number) => {
    setFloatingWindows((prev) =>
      prev.map((w) => (w.id === id ? { ...w, width, height, dockStatus: "none" } : w))
    );
  };

  const updateWindowGeometry = (id: string, x: number, y: number, width: number, height: number) => {
    setFloatingWindows((prev) =>
      prev.map((w) => (w.id === id ? { ...w, x, y, width, height, dockStatus: "none" } : w))
    );
  };

  const updateWindowZoom = (id: string, delta: number) => {
    setFloatingWindows((prev) =>
      prev.map((w) =>
        w.id === id
          ? { ...w, zoomLevel: Math.max(0.5, Math.min(2.0, Number((w.zoomLevel + delta).toFixed(2)))) }
          : w
      )
    );
  };

  const resetWindowZoom = (id: string) => {
    setFloatingWindows((prev) =>
      prev.map((w) => (w.id === id ? { ...w, zoomLevel: 1.0 } : w))
    );
  };

  const snapWindow = (id: string, position: "none" | "left" | "right" | "top" | "bottom" | "full") => {
    setFloatingWindows((prev) =>
      prev.map((w) => {
        if (w.id === id) {
          const mainHeaderHeight = focusMode ? 0 : 72;
          const availableWidth = window.innerWidth;
          const availableHeight = window.innerHeight - mainHeaderHeight;

          let targetX = w.x;
          let targetY = w.y;
          let targetWidth = w.width;
          let targetHeight = w.height;

          const backupState = w.dockStatus === "none" 
            ? { x: w.x, y: w.y, width: w.width, height: w.height }
            : w.restoreState || { x: w.x, y: w.y, width: w.width, height: w.height };

          if (position === "left") {
            targetX = 0;
            targetY = mainHeaderHeight;
            targetWidth = availableWidth / 2;
            targetHeight = availableHeight;
          } else if (position === "right") {
            targetX = availableWidth / 2;
            targetY = mainHeaderHeight;
            targetWidth = availableWidth / 2;
            targetHeight = availableHeight;
          } else if (position === "top") {
            targetX = 0;
            targetY = mainHeaderHeight;
            targetWidth = availableWidth;
            targetHeight = availableHeight / 2;
          } else if (position === "bottom") {
            targetX = 0;
            targetY = mainHeaderHeight + availableHeight / 2;
            targetWidth = availableWidth;
            targetHeight = availableHeight / 2;
          } else if (position === "full") {
            targetX = 0;
            targetY = mainHeaderHeight;
            targetWidth = availableWidth;
            targetHeight = availableHeight;
          } else {
            // Restore original floating state
            const orig = w.restoreState || { x: 100, y: 120, width: 700, height: 500 };
            return {
              ...w,
              dockStatus: "none",
              isMaximized: false,
              ...orig,
            };
          }

          return {
            ...w,
            dockStatus: position,
            isMaximized: position === "full",
            x: targetX,
            y: targetY,
            width: targetWidth,
            height: targetHeight,
            restoreState: backupState,
          };
        }
        return w;
      })
    );
  };

  const tileWorkspaces = () => {
    if (floatingWindows.length === 0) return;
    const count = floatingWindows.length;
    const mainHeaderHeight = focusMode ? 0 : 72;
    const totalW = window.innerWidth;
    const totalH = window.innerHeight - mainHeaderHeight;

    const cols = Math.ceil(Math.sqrt(count));
    const rows = Math.ceil(count / cols);

    const wWidth = totalW / cols;
    const wHeight = totalH / rows;

    setFloatingWindows((prev) =>
      prev.map((win, idx) => {
        const col = idx % cols;
        const row = Math.floor(idx / cols);
        return {
          ...win,
          x: col * wWidth,
          y: mainHeaderHeight + row * wHeight,
          width: wWidth - 2,
          height: wHeight - 2,
          isMinimized: false,
          isMaximized: false,
          dockStatus: "none",
        };
      })
    );
  };

  const arrangeSideBySide = () => {
    if (floatingWindows.length === 0) return;
    const count = floatingWindows.length;
    const mainHeaderHeight = focusMode ? 0 : 72;
    const totalW = window.innerWidth;
    const totalH = window.innerHeight - mainHeaderHeight;

    const wWidth = totalW / count;

    setFloatingWindows((prev) =>
      prev.map((win, idx) => ({
        ...win,
        x: idx * wWidth,
        y: mainHeaderHeight,
        width: wWidth - 2,
        height: totalH,
        isMinimized: false,
        isMaximized: false,
        dockStatus: "none",
      }))
    );
  };

  const tabTogether = (sourceWindowId: string, targetWindowId: string) => {
    if (sourceWindowId === targetWindowId) return;
    
    setFloatingWindows((prev) => {
      const source = prev.find((w) => w.id === sourceWindowId);
      const target = prev.find((w) => w.id === targetWindowId);
      if (!source || !target) return prev;

      // Move source tabs into target
      const updatedTarget = {
        ...target,
        tabs: [...target.tabs, ...source.tabs],
        activeTabIndex: target.tabs.length, // switch to first imported tab
      };

      return prev
        .filter((w) => w.id !== sourceWindowId)
        .map((w) => (w.id === targetWindowId ? updatedTarget : w));
    });

    setActiveWindowId(targetWindowId);
  };

  const moveTabToNewWindow = (windowId: string, tabIndex: number) => {
    setFloatingWindows((prev) => {
      const win = prev.find((w) => w.id === windowId);
      if (!win || win.tabs.length <= 1) return prev;

      const tabToMove = win.tabs[tabIndex];
      const remainingTabs = win.tabs.filter((_, idx) => idx !== tabIndex);
      
      const updatedSourceWindow = {
        ...win,
        tabs: remainingTabs,
        activeTabIndex: Math.min(win.activeTabIndex, remainingTabs.length - 1),
      };

      const id = `win_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      const nextZ = getNextZIndex();
      
      const newWindow: FloatingWindow = {
        id,
        tabs: [tabToMove],
        activeTabIndex: 0,
        x: win.x + 40,
        y: win.y + 40,
        width: win.width,
        height: win.height,
        isMinimized: false,
        isMaximized: false,
        zoomLevel: win.zoomLevel,
        dockStatus: "none",
        zIndex: nextZ,
      };

      return [...prev.map((w) => (w.id === windowId ? updatedSourceWindow : w)), newWindow];
    });
  };

  const selectWindowTab = (windowId: string, tabIndex: number) => {
    setFloatingWindows((prev) =>
      prev.map((w) => (w.id === windowId ? { ...w, activeTabIndex: tabIndex, isMinimized: false } : w))
    );
    setActiveWindowId(windowId);
  };

  const closeWindowTab = (windowId: string, tabIndex: number) => {
    setFloatingWindows((prev) => {
      const win = prev.find((w) => w.id === windowId);
      if (!win) return prev;

      if (win.tabs.length <= 1) {
        return prev.filter((w) => w.id !== windowId);
      }

      const remainingTabs = win.tabs.filter((_, idx) => idx !== tabIndex);
      return prev.map((w) => {
        if (w.id === windowId) {
          return {
            ...w,
            tabs: remainingTabs,
            activeTabIndex: Math.min(w.activeTabIndex, remainingTabs.length - 1),
          };
        }
        return w;
      });
    });
  };

  // Keyboard Shortcuts Handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // F11: Toggle Focus Mode (Prevent browser default if appropriate)
      if (e.key === "F11") {
        e.preventDefault();
        toggleFocusMode();
      }
      
      // Ctrl + Shift + P: Pop-out active workspace
      if (e.ctrlKey && e.shiftKey && e.key.toUpperCase() === "P") {
        e.preventDefault();
        // Dispatch custom event to get current tab details and trigger pop-out
        const event = new CustomEvent("smriti_popout_current_tab");
        window.dispatchEvent(event);
      }

      // Zoom keys: Ctrl + Plus (represented by '=' or '+'), Ctrl + Minus, Ctrl + '0'
      if (e.ctrlKey) {
        if (e.key === "=" || e.key === "+") {
          e.preventDefault();
          adjustGlobalZoom(0.1);
        } else if (e.key === "-") {
          e.preventDefault();
          adjustGlobalZoom(-0.1);
        } else if (e.key === "0") {
          e.preventDefault();
          resetGlobalZoom();
        }
      }

      // Escape: exit full screen/maximize
      if (e.key === "Escape") {
        // Find if any window is maximized/docked full and restore it
        setFloatingWindows((prev) => {
          if (prev.some((w) => w.isMaximized || w.dockStatus === "full")) {
            return prev.map((w) => 
              w.isMaximized || w.dockStatus === "full"
                ? { ...w, isMaximized: false, dockStatus: "none", ...(w.restoreState || { x: 100, y: 120, width: 700, height: 500 }) }
                : w
            );
          }
          return prev;
        });
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [focusMode]);

  return (
    <WorkspaceContext.Provider
      value={{
        focusMode,
        globalZoom,
        floatingWindows,
        activeWindowId,
        dragSnapPreview,
        toggleFocusMode,
        setFocusMode,
        adjustGlobalZoom,
        resetGlobalZoom,
        popOutTab,
        closeWindow,
        minimizeWindow,
        maximizeWindow,
        restoreWindow,
        updateWindowPosition,
        updateWindowSize,
        updateWindowGeometry,
        updateWindowZoom,
        resetWindowZoom,
        setActiveWindowId,
        setDragSnapPreview,
        snapWindow,
        tileWorkspaces,
        arrangeSideBySide,
        tabTogether,
        moveTabToNewWindow,
        selectWindowTab,
        closeWindowTab,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
};

export const useWorkspace = () => {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error("useWorkspace must be used within a WorkspaceProvider");
  }
  return context;
};
