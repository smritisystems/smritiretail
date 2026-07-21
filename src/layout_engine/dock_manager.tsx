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

import React, { useRef, useState, useEffect } from "react";
import { useLayoutEngine } from "./layout_store.js";
import { useResponsiveLayout } from "./responsive_manager.js";
import { NavigationRenderer } from "./navigation_renderer.js";
import { SmritiScrollArea } from "../components/SmritiScrollArea.tsx";
import { useWorkspace } from "../contexts/WorkspaceContext.tsx";
import { WorkspaceToolbar } from "../components/WorkspaceToolbar.tsx";

interface DockManagerProps {
  activeTab: string;
  onTabSelect: (id: string) => void;
  children: React.ReactNode;
  searchTerm: string;
  onSearchChange: (val: string) => void;
}

export const DockManager: React.FC<DockManagerProps> = ({
  activeTab,
  onTabSelect,
  children,
  searchTerm,
  onSearchChange
}) => {
  const { preferences, setSidebarWidth, toggleSidebarVisibility } = useLayoutEngine();
  const { effectivePosition } = useResponsiveLayout(preferences.position);
  const { focusMode } = useWorkspace();
  
  const containerRef = useRef<HTMLDivElement>(null);
  const [isResizing, setIsResizing] = useState(false);
  const [localWidth, setLocalWidth] = useState(preferences.sidebarWidth);

  // Synchronize local state with store preferences
  useEffect(() => {
    setLocalWidth(preferences.sidebarWidth);
  }, [preferences.sidebarWidth]);

  // Drag-to-resize handlers
  const startResize = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  };

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      
      let newWidth = preferences.sidebarWidth;
      if (effectivePosition === "left") {
        newWidth = e.clientX - rect.left;
      } else if (effectivePosition === "right") {
        newWidth = rect.right - e.clientX;
      }

      // Constrain sidebar width between 180px and 480px
      const clamped = Math.max(180, Math.min(480, newWidth));
      setLocalWidth(clamped);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      setSidebarWidth(localWidth);
      // Dispatch resize event to force canvas / chart components redraw
      window.dispatchEvent(new Event("resize"));
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizing, effectivePosition, localWidth, preferences.sidebarWidth, setSidebarWidth]);

  // Determine current width styled
  const isCollapsed = preferences.collapsed || preferences.iconOnly;
  const currentWidth = isCollapsed ? 72 : localWidth;

  const showNavigation = !focusMode && !preferences.hideSidebar;

  // Floating trigger button when sidebar is hidden
  const renderSidebarUnhideTrigger = () => {
    if (focusMode || !preferences.hideSidebar) return null;
    const isHorizontal = effectivePosition === "top" || effectivePosition === "bottom";
    const posClass =
      effectivePosition === "right"
        ? "right-2 top-1/2 -translate-y-1/2"
        : effectivePosition === "top"
        ? "top-2 left-1/2 -translate-x-1/2"
        : effectivePosition === "bottom"
        ? "bottom-2 left-1/2 -translate-x-1/2"
        : "left-2 top-1/2 -translate-y-1/2";

    return (
      <button
        onClick={toggleSidebarVisibility}
        className={`fixed z-30 px-2.5 py-1 bg-theme-surface-2/90 hover:bg-indigo-600 text-xs font-semibold text-white rounded-lg shadow-xl border border-theme-divider flex items-center space-x-1.5 transition-all opacity-70 hover:opacity-100 cursor-pointer ${posClass}`}
        title="Unhide Sidebar Navigation (Alt+Shift+S)"
      >
        <span className="material-symbols-outlined text-sm">dock_to_right</span>
        <span>Show Sidebar</span>
      </button>
    );
  };

  // Render Left Dock Layout
  const renderLeftDockLayout = () => {
    return (
      <div ref={containerRef} className="flex-1 flex overflow-hidden relative">
        {renderSidebarUnhideTrigger()}
        {/* Navigation Panel */}
        {showNavigation && (
          <div 
            style={{ width: `${currentWidth}px` }} 
            className="h-full flex-shrink-0 transition-all duration-200 ease-in-out select-none relative z-10 animate-fade-in"
          >
            <NavigationRenderer 
              activeTab={activeTab} 
              onTabSelect={onTabSelect} 
              searchTerm={searchTerm}
              onSearchChange={onSearchChange}
            />
            
            {/* Resize handle (only if not collapsed) */}
            {!isCollapsed && (
              <div 
                onMouseDown={startResize}
                className="absolute top-0 right-0 w-1.5 h-full cursor-col-resize hover:bg-blue-600/50 hover:w-2 active:bg-blue-500 transition-colors z-20"
              />
            )}
          </div>
        )}

        {/* Workspace content */}
        <SmritiScrollArea className="flex-1 bg-theme-base select-text h-full relative flex flex-col" fadeColorClass="from-[#1A2B5C]">
          <WorkspaceToolbar currentTabId={activeTab} />
          <div className="p-6 flex-1">
            {children}
          </div>
        </SmritiScrollArea>
      </div>
    );
  };

  // Render Right Dock Layout
  const renderRightDockLayout = () => {
    return (
      <div ref={containerRef} className="flex-1 flex overflow-hidden relative">
        {renderSidebarUnhideTrigger()}
        {/* Workspace content (first) */}
        <SmritiScrollArea className="flex-1 bg-theme-base select-text h-full relative flex flex-col" fadeColorClass="from-[#1A2B5C]">
          <WorkspaceToolbar currentTabId={activeTab} />
          <div className="p-6 flex-1">
            {children}
          </div>
        </SmritiScrollArea>

        {/* Navigation Panel (second) */}
        {showNavigation && (
          <div 
            style={{ width: `${currentWidth}px` }} 
            className="h-full flex-shrink-0 transition-all duration-200 ease-in-out select-none relative z-10 animate-fade-in"
          >
            {/* Resize handle (only if not collapsed) */}
            {!isCollapsed && (
              <div 
                onMouseDown={startResize}
                className="absolute top-0 left-0 w-1.5 h-full cursor-col-resize hover:bg-blue-600/50 hover:w-2 active:bg-blue-500 transition-colors z-20"
              />
            )}

            <NavigationRenderer 
              activeTab={activeTab} 
              onTabSelect={onTabSelect} 
              searchTerm={searchTerm}
              onSearchChange={onSearchChange}
            />
          </div>
        )}
      </div>
    );
  };

  // Render Top Dock Layout
  const renderTopDockLayout = () => {
    return (
      <div className="flex-1 flex flex-col overflow-hidden relative">
        {renderSidebarUnhideTrigger()}
        {/* Navigation Panel */}
        {showNavigation && (
          <NavigationRenderer 
            activeTab={activeTab} 
            onTabSelect={onTabSelect} 
            searchTerm={searchTerm}
            onSearchChange={onSearchChange}
          />
        )}
        
        {/* Workspace Content */}
        <SmritiScrollArea className="flex-1 bg-theme-base select-text h-full relative flex flex-col" fadeColorClass="from-[#1A2B5C]">
          <WorkspaceToolbar currentTabId={activeTab} />
          <div className="p-6 flex-1">
            {children}
          </div>
        </SmritiScrollArea>
      </div>
    );
  };

  // Render Bottom Dock Layout
  const renderBottomDockLayout = () => {
    return (
      <div className="flex-1 flex flex-col overflow-hidden relative">
        {renderSidebarUnhideTrigger()}
        {/* Workspace Content */}
        <SmritiScrollArea className="flex-1 bg-theme-base select-text h-full relative flex flex-col" fadeColorClass="from-[#1A2B5C]">
          <WorkspaceToolbar currentTabId={activeTab} />
          <div className="p-6 flex-1">
            {children}
          </div>
        </SmritiScrollArea>

        {/* Navigation Panel */}
        {showNavigation && (
          <NavigationRenderer 
            activeTab={activeTab} 
            onTabSelect={onTabSelect} 
            searchTerm={searchTerm}
            onSearchChange={onSearchChange}
          />
        )}
      </div>
    );
  };

  // Return specific position renderers
  switch (effectivePosition) {
    case "right":
      return renderRightDockLayout();
    case "top":
      return renderTopDockLayout();
    case "bottom":
      return renderBottomDockLayout();
    default:
      return renderLeftDockLayout();
  }
};
