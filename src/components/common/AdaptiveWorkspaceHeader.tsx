/**
 * Project      : SMRITI Retail OS
 * Organization : SmritiSys
 * Module       : SMRITI Fiori OS Shell Header (WNG-002 / SCS-SHL-001 Compliant)
 * Standard     : SCS-SHL-001 — SMRITI Shell Constitution v1.0
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * Version      : 7.0.0 (Operating System Shell Architecture)
 */

import React, { useState } from "react";
import { Search, Bell, HelpCircle, Bot, LogOut, Check, Sparkles, RefreshCw } from "lucide-react";
import { useSEEF } from "../../layout_engine/SEEFContext.tsx";
import { SEEFTheme } from "../../layout_engine/SEEFTypes.ts";
import { UserProfileMenu } from "../../features/auth/components/UserProfileMenu";

interface AdaptiveWorkspaceHeaderProps {
  currentUser?: {
    name: string;
    role: string;
  } | null;
  onOpenGlobalSearch?: () => void;
  onOpenNotifications?: () => void;
  onOpenHelp?: () => void;
  onLogout?: () => void;
}

export const AdaptiveWorkspaceHeader: React.FC<AdaptiveWorkspaceHeaderProps> = ({
  currentUser,
  onOpenGlobalSearch,
  onOpenNotifications,
  onOpenHelp,
  onLogout,
}) => {
  const { config, updateSEEF } = useSEEF();
  const activeTheme = config.theme;
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showAiCopilot, setShowAiCopilot] = useState(false);

  const handleThemeChange = (newTheme: SEEFTheme) => {
    updateSEEF({ theme: newTheme });
  };

  const isLight = activeTheme === "enterprise" || activeTheme === "light" || activeTheme === "minimal";

  return (
    <header
      className="h-13 border-b px-5 flex items-center justify-between text-xs select-none z-30 shadow-xs transition-colors duration-300 relative"
      style={{
        background: "var(--c-theme-surface-1)",
        borderColor: "var(--c-theme-divider)",
        color: "var(--c-theme-body)",
      }}
    >
      {/* Zone A: Logo & OS Identity */}
      <div className="flex items-center gap-3">
        <div
          className="grid grid-cols-3 gap-[3px] w-4 h-4 opacity-80 hover:opacity-100 transition-opacity cursor-pointer"
          title="Launchpad Matrix"
        >
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="w-[4px] h-[4px] rounded-[1px]" style={{ background: "var(--c-theme-body)" }} />
          ))}
        </div>

        <div className="flex items-center gap-2">
          <span className="font-display font-extrabold text-sm tracking-wide text-theme-heading">SMRITI</span>
          <span className="hidden sm:inline-block px-2 py-0.5 rounded text-[10px] font-mono font-bold tracking-wider uppercase bg-white/10 border border-white/15 text-indigo-300">
            Enterprise OS
          </span>
        </div>
      </div>

      {/* Zone B: Universal Command Search (Ctrl+K) */}
      <div className="flex-1 max-w-lg mx-2 sm:mx-6 flex justify-center sm:justify-start">
        {/* Desktop Full Search Bar */}
        <button
          type="button"
          onClick={onOpenGlobalSearch}
          className="hidden sm:flex w-full items-center justify-between rounded-xl px-3.5 py-1.5 transition-all seds-text-small cursor-pointer shadow-xs"
          style={{
            background: "var(--c-theme-surface-2)",
            border: `1px solid ${isLight ? "rgba(0,0,0,0.12)" : "rgba(255,255,255,0.15)"}`,
            color: "var(--c-theme-muted)",
          }}
        >
          <div className="flex items-center gap-2 overflow-hidden">
            <Search size={14} className="shrink-0 text-theme-muted" />
            <span className="truncate text-xs text-theme-muted font-sans">Search products, customers, invoices...</span>
          </div>
        </button>

        {/* Mobile Compact Search Icon Button */}
        <button
          type="button"
          onClick={onOpenGlobalSearch}
          className="sm:hidden p-2 rounded-lg text-theme-muted hover:text-theme-body hover:bg-white/10 transition-colors cursor-pointer"
          title="Universal Search"
          aria-label="Universal Search"
        >
          <Search size={16} />
        </button>
      </div>

      {/* Zone E: Status Controls (Notifications, Sync & User Profile) */}
      <div className="flex items-center gap-2.5">
        {/* Sync Status Badge */}
        <div className="hidden lg:flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-mono text-[10px] font-bold">
          <RefreshCw size={11} className="animate-spin" />
          <span>Live</span>
        </div>

        {/* Help Center */}
        <button
          type="button"
          onClick={onOpenHelp}
          className="p-2 rounded-lg hover:bg-white/10 text-theme-muted hover:text-theme-body transition-colors cursor-pointer"
          title="Documentation & Help"
        >
          <HelpCircle size={16} />
        </button>

        {/* Notifications */}
        <button
          type="button"
          onClick={onOpenNotifications}
          className="p-2 rounded-lg hover:bg-white/10 text-theme-muted hover:text-theme-body transition-colors relative cursor-pointer"
          title="Notifications"
        >
          <Bell size={16} />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
        </button>

        {/* User Profile Pill & Dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-2.5 pl-2 hover:opacity-90 transition-opacity cursor-pointer"
          >
            <div className="w-8 h-8 rounded-full border text-white flex items-center justify-center font-bold text-xs shadow-xs bg-indigo-600 border-indigo-400">
              {currentUser?.name ? currentUser.name.charAt(0).toUpperCase() : "S"}
            </div>
            <div className="hidden md:flex flex-col text-left">
              <span className="font-bold text-xs leading-tight text-theme-heading">{currentUser?.name || "Super Admin"}</span>
              <span className="text-[10px] font-mono leading-tight text-indigo-400 font-semibold">{currentUser?.role || "SYSADMIN"}</span>
            </div>
          </button>

          {/* User Profile Menu Component */}
          <UserProfileMenu
            isOpen={showUserMenu}
            onClose={() => setShowUserMenu(false)}
            onOpenLogoutModal={() => {
              setShowUserMenu(false);
              onLogout?.();
            }}
          />
        </div>
      </div>
    </header>
  );
};
