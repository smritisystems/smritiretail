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

interface AdaptiveWorkspaceHeaderProps {
  currentUser?: {
    name: string;
    role: string;
  } | null;
  onOpenGlobalSearch?: () => void;
  onOpenNotifications?: () => void;
  onOpenHelp?: () => void;
}

export const AdaptiveWorkspaceHeader: React.FC<AdaptiveWorkspaceHeaderProps> = ({
  currentUser,
  onOpenGlobalSearch,
  onOpenNotifications,
  onOpenHelp,
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
        background: "var(--c-seef-brand)",
        borderColor: isLight ? "rgba(0,0,0,0.10)" : "rgba(255,255,255,0.10)",
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
          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold tracking-wider uppercase bg-white/10 border border-white/15 text-indigo-300">
            Enterprise OS
          </span>
        </div>
      </div>

      {/* Zone B: Universal Command Search (Ctrl+K) */}
      <div className="flex-1 max-w-lg mx-6">
        <button
          type="button"
          onClick={onOpenGlobalSearch}
          className="w-full flex items-center justify-between rounded-xl px-3.5 py-1.5 transition-all seds-text-small cursor-pointer shadow-xs"
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
          <kbd className="px-2 py-0.5 text-[10px] font-mono font-bold rounded bg-theme-surface-1 border border-theme-divider text-theme-muted shrink-0">
            Ctrl+K
          </kbd>
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

          {/* User Settings & Theme Dropdown Menu */}
          {showUserMenu && (
            <div className="absolute right-0 mt-2 w-56 rounded-xl border border-theme-divider bg-theme-surface-1 shadow-2xl p-2 z-50 text-xs space-y-1 font-sans">
              <div className="px-3 py-2 border-b border-theme-divider">
                <div className="font-bold text-theme-heading">{currentUser?.name || "Super Admin"}</div>
                <div className="text-[10px] text-theme-muted font-mono">{currentUser?.role || "SYSADMIN"}</div>
              </div>

              <div className="px-3 pt-2 text-[10px] font-mono uppercase text-theme-muted font-bold">Theme Settings</div>
              <div className="space-y-0.5">
                {[
                  { id: "enterprise", label: "Horizon Light (Fiori)" },
                  { id: "dark", label: "Quartz Dark" },
                  { id: "corporate", label: "Corporate Navy" },
                  { id: "high-contrast", label: "High Contrast" },
                ].map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      handleThemeChange(t.id as SEEFTheme);
                      setShowUserMenu(false);
                    }}
                    className={`w-full px-3 py-1.5 rounded-lg text-left flex items-center justify-between text-xs transition-colors ${
                      activeTheme === t.id ? "bg-theme-surface-2 font-bold text-emerald-400" : "text-theme-body hover:bg-theme-surface-2/60"
                    }`}
                  >
                    <span>{t.label}</span>
                    {activeTheme === t.id && <Check size={14} className="text-emerald-400" />}
                  </button>
                ))}
              </div>

              <div className="border-t border-theme-divider pt-1">
                <button
                  type="button"
                  onClick={() => setShowUserMenu(false)}
                  className="w-full px-3 py-1.5 rounded-lg text-left text-rose-400 hover:bg-rose-500/10 transition-colors flex items-center gap-2 font-bold"
                >
                  <LogOut size={14} /> Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
