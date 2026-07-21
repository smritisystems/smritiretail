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

import React, { useState, useEffect } from "react";
import {
  Sliders,
  Search,
  Layout,
  Cpu,
  Sun,
  Moon,
  Info,
  CheckCircle,
  Settings,
  HelpCircle,
  Monitor,
  ShieldCheck,
  HelpCircle as HelpIcon,
  ArrowLeftRight,
  Bell,
} from "lucide-react";
import { useLayoutEngine, DockPosition } from "./layout_store.js";
import { DockManager } from "./dock_manager.js";
import { useTheme } from "../contexts/ThemeContext.tsx";
import { useNotifications } from "../notifications/notification_store.tsx";
import { NotificationCenter } from "../notifications/NotificationCenter.tsx";
import { useWorkspace } from "../contexts/WorkspaceContext.tsx";

interface LayoutManagerProps {
  activeTab: string;
  onTabSelect: (id: string) => void;
  children: React.ReactNode;
  currentUser?: { role: string; name: string } | null;
  onLogout?: () => void;
}

export const LayoutManager: React.FC<LayoutManagerProps> = ({
  activeTab,
  onTabSelect,
  children,
  currentUser,
  onLogout,
}) => {
  const { preferences, setLayout, toggleSidebar, toggleNavbar, toggleSidebarVisibility, toggleBottombar } = useLayoutEngine();
  const { theme, toggleTheme } = useTheme();
  const { focusMode, toggleFocusMode } = useWorkspace();
  const [searchTerm, setSearchTerm] = useState("");
  const [systemClock, setSystemClock] = useState(new Date());
  const [showLayoutConfig, setShowLayoutConfig] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  
  const { unreadCount } = useNotifications();

  // Sync Clock
  useEffect(() => {
    const interval = setInterval(() => setSystemClock(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const handlePositionChange = (pos: DockPosition) => {
    setLayout(pos);
    setShowLayoutConfig(false);
  };

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-theme-base text-theme-primary font-sans antialiased select-none relative">
      {/* Top Floating Unhide Navbar Trigger (When Navbar is hidden) */}
      {!focusMode && preferences.hideNavbar && (
        <button
          onClick={toggleNavbar}
          className="fixed top-2 left-1/2 -translate-x-1/2 z-40 px-3 py-1 bg-theme-surface-2/90 hover:bg-indigo-600 text-xs font-semibold text-white rounded-b-lg shadow-lg border border-t-0 border-theme-divider flex items-center space-x-1.5 transition-all opacity-70 hover:opacity-100 cursor-pointer"
          title="Unhide Application Navbar (Alt+Shift+N)"
        >
          <span className="material-symbols-outlined text-sm">visibility</span>
          <span>Show Navbar</span>
        </button>
      )}

      {/* 1. FIXED APPLICATION HEADER (Satisfies Application Header requirement) */}
      {!focusMode && !preferences.hideNavbar && (
        <header className="bg-theme-surface-1 border-b border-theme-divider px-6 h-[72px] flex-shrink-0 flex items-center justify-between z-30 shadow-md">
          {/* Brand Logo & Info */}
          <div className="flex items-center space-x-3.5">
            <div className="w-10 h-10 rounded-xl bg-[#2563EB] flex items-center justify-center font-bold text-lg font-display text-theme-body border border-theme-divider shadow-lg animate-pulse">
              S
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="font-display font-bold text-base tracking-wide text-theme-body">
                  SMRITI Retail OS
                </h1>
                <span className="text-[9px] bg-theme-surface-3 text-theme-muted border border-theme-divider rounded px-1.5 py-0.2 font-mono font-bold">
                  LANE 01
                </span>
                <span className="text-[9px] bg-indigo-950 text-indigo-400 border border-indigo-900 rounded px-1.5 py-0.2 font-mono font-bold">
                  SRLE v1.0
                </span>
              </div>
              <p className="text-[10px] text-theme-muted">
                Enterprise Experience & Operational Intelligence Desk
              </p>
            </div>
          </div>

          {/* Global Control Center & Settings */}
          <div className="flex items-center space-x-6 relative">
            
            {/* Notifications */}
            <div className="relative">
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="w-8 h-8 rounded-full bg-theme-surface-3 hover:bg-theme-surface-hover border border-theme-divider flex items-center justify-center text-theme-muted hover:text-theme-primary transition-colors relative"
                title="Notifications"
              >
                <Bell size={16} />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-rose-500 border border-theme-surface-1 rounded-full animate-pulse"></span>
                )}
              </button>
              <NotificationCenter 
                isOpen={showNotifications} 
                onClose={() => setShowNotifications(false)} 
                onNavigate={onTabSelect}
              />
            </div>

            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="w-8 h-8 rounded-full bg-theme-surface-3 hover:bg-theme-surface-hover border border-theme-divider flex items-center justify-center text-theme-muted hover:text-theme-primary transition-colors"
              title={`Switch to ${theme === "dark" ? "Light" : "Dark"} Mode`}
            >
              {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
            </button>

            {/* Layout Quick Configuration Toggler */}
            <div className="relative">
              <button
                onClick={() => setShowLayoutConfig(!showLayoutConfig)}
                className="px-3 py-1.5 rounded-lg bg-theme-surface-3 hover:bg-theme-surface-hover border border-theme-divider text-xs font-bold font-display text-blue-400 flex items-center space-x-2 cursor-pointer transition-colors"
              >
                <Layout size={13} />
                <span>Dock Position ({preferences.position})</span>
              </button>

              {showLayoutConfig && (
                <>
                  <div
                    className="fixed inset-0 z-30"
                    onClick={() => setShowLayoutConfig(false)}
                  />
                  <div className="absolute right-0 mt-2 w-64 rounded-xl bg-theme-surface-2 border border-theme-divider shadow-2xl p-4 space-y-3 z-40 animate-in fade-in slide-in-from-top-2 duration-150 text-left">
                    <span className="text-[10px] font-mono text-theme-muted font-bold uppercase tracking-wider block">
                      Dock Layout Options
                    </span>
                    <div className="grid grid-cols-2 gap-2">
                      {(["left", "right", "top", "bottom"] as DockPosition[]).map(
                        (pos) => (
                          <button
                            key={`dropdown-pos-${pos}`}
                            onClick={() => handlePositionChange(pos)}
                            className={`py-2 text-[10px] font-mono font-bold uppercase rounded-lg border transition-colors ${
                              preferences.position === pos
                                ? "bg-blue-600 border-blue-500 text-white"
                                : "bg-theme-surface-1 border-theme-divider text-theme-muted hover:text-white"
                            }`}
                          >
                            {pos} Dock
                          </button>
                        ),
                      )}
                    </div>
                    <div className="h-px bg-[#2a3a5c]/50 my-1" />
                    <span className="text-[10px] font-mono text-theme-muted font-bold uppercase tracking-wider block">
                      Hideable Bars & Panels
                    </span>
                    <div className="space-y-1">
                      <button
                        onClick={() => {
                          toggleNavbar();
                          setShowLayoutConfig(false);
                        }}
                        className="w-full text-left py-1.5 px-2 rounded hover:bg-theme-surface-3 text-xs font-medium text-theme-muted hover:text-theme-body flex items-center justify-between cursor-pointer"
                      >
                        <div className="flex items-center space-x-2">
                          <span className="material-symbols-outlined text-sm">web_asset</span>
                          <span>Navbar</span>
                        </div>
                        <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${preferences.hideNavbar ? "bg-rose-500/20 text-rose-300" : "bg-emerald-500/20 text-emerald-300"}`}>
                          {preferences.hideNavbar ? "Hidden" : "Visible"}
                        </span>
                      </button>
                      <button
                        onClick={() => {
                          toggleSidebarVisibility();
                          setShowLayoutConfig(false);
                        }}
                        className="w-full text-left py-1.5 px-2 rounded hover:bg-theme-surface-3 text-xs font-medium text-theme-muted hover:text-theme-body flex items-center justify-between cursor-pointer"
                      >
                        <div className="flex items-center space-x-2">
                          <span className="material-symbols-outlined text-sm">dock_to_right</span>
                          <span>Sidebar</span>
                        </div>
                        <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${preferences.hideSidebar ? "bg-rose-500/20 text-rose-300" : "bg-emerald-500/20 text-emerald-300"}`}>
                          {preferences.hideSidebar ? "Hidden" : "Visible"}
                        </span>
                      </button>
                      <button
                        onClick={() => {
                          toggleBottombar();
                          setShowLayoutConfig(false);
                        }}
                        className="w-full text-left py-1.5 px-2 rounded hover:bg-theme-surface-3 text-xs font-medium text-theme-muted hover:text-theme-body flex items-center justify-between cursor-pointer"
                      >
                        <div className="flex items-center space-x-2">
                          <span className="material-symbols-outlined text-sm">view_stream</span>
                          <span>Bottombar (Taskbar)</span>
                        </div>
                        <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${preferences.hideBottombar ? "bg-rose-500/20 text-rose-300" : "bg-emerald-500/20 text-emerald-300"}`}>
                          {preferences.hideBottombar ? "Hidden" : "Visible"}
                        </span>
                      </button>
                    </div>
                    <div className="h-px bg-[#2a3a5c]/50 my-1" />
                    <button
                      onClick={() => {
                        toggleSidebar();
                        setShowLayoutConfig(false);
                      }}
                      className="w-full text-left py-1 text-xs font-medium text-theme-muted hover:text-theme-body flex items-center space-x-1.5 cursor-pointer"
                    >
                      <ArrowLeftRight size={12} />
                      <span>Expand/Collapse Sidebar</span>
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* User Session Identity & Sign Out */}
            {currentUser && (
              <div className="flex items-center space-x-3 border-l border-theme-divider pl-4">
                <div 
                  onClick={() => onTabSelect("user-profile")}
                  className="text-right hidden sm:block cursor-pointer hover:opacity-80 transition-opacity"
                  title="View My Profile Dashboard"
                >
                  <span className="text-[9px] text-theme-muted block font-mono uppercase tracking-wider font-bold">
                    {currentUser.role}
                  </span>
                  <span className="text-xs text-theme-body font-bold">
                    {currentUser.name}
                  </span>
                </div>
                <button
                  onClick={onLogout}
                  className="w-8 h-8 rounded-full bg-theme-surface-3 hover:bg-rose-950/40 border border-theme-divider flex items-center justify-center text-theme-muted hover:text-rose-400 hover:border-rose-500/30 transition-all cursor-pointer"
                  title="Logout Session"
                >
                  <span className="material-symbols-outlined text-[16px] block">logout</span>
                </button>
              </div>
            )}

            {/* System Clock */}
            <div className="text-right hidden md:block border-l border-theme-divider pl-4">
              <span className="text-[9px] text-theme-muted block font-mono">
                SYSTEM SYNCHRONIZED
              </span>
              <span className="font-mono text-xs text-theme-body font-medium">
                {systemClock.toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}{" "}
                • {systemClock.toLocaleTimeString()}
              </span>
            </div>
          </div>
        </header>
      )}

      {/* 2. DOCK MANAGER & VIEWPORT SHELL (Only the workspace inside the DockManager scrolls) */}
      <DockManager
        activeTab={activeTab}
        onTabSelect={onTabSelect}
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
      >
        {children}
      </DockManager>

      {/* Floating Exit Focus Mode Button */}
      {focusMode && (
        <button
          onClick={toggleFocusMode}
          className="fixed bottom-6 right-6 z-50 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-full shadow-lg flex items-center space-x-2 border border-blue-400 transition-all scale-95 hover:scale-100 cursor-pointer text-xs"
        >
          <span className="material-symbols-outlined text-sm">visibility_off</span>
          <span>Exit Focus Mode</span>
        </button>
      )}
    </div>
  );
};
