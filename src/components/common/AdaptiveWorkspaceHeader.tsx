/**
 * Project      : SMRITI Retail OS
 * Organization : SmritiSys
 * Module       : SAP Fiori Enterprise Slim Header (WNG-002 Compliant)
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * Version      : 5.1.0 (SEEF Phase 8 — Token Upgrade)
 */

import React from "react";
import { Search, Bell, Sparkles, User, HelpCircle, Shield, Sun, Moon, Palette } from "lucide-react";
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

  const handleThemeChange = (newTheme: SEEFTheme) => {
    updateSEEF({ theme: newTheme });
  };

  return (
    <header className="h-12 bg-[#354a5e] border-b border-white/10 px-4 flex items-center justify-between text-xs select-none z-30 shadow-md">
      {/* 1. SMRITI Brand & Waffle Matrix App Launcher */}
      <div className="flex items-center gap-3">
        <div className="grid grid-cols-3 gap-[3px] w-4 h-4 opacity-90 cursor-pointer hover:opacity-100 transition-opacity" title="SMRITI Launchpad Matrix">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="w-[4px] h-[4px] rounded-[1px] bg-white" />
          ))}
        </div>
        <span className="seds-text-title text-white flex items-center gap-2">
          SMRITI <span className="text-[#6fa8dc] font-mono text-xs">Retail OS</span>
        </span>
        <span className="px-2 py-0.5 rounded bg-white/12 text-white border border-white/10 seds-text-overline hidden sm:inline-block">
          v5.3 Enterprise
        </span>
      </div>

      {/* 2. Center Global Search Input Trigger (Ctrl+K) */}
      <div className="flex-1 max-w-md mx-4">
        <button
          onClick={onOpenGlobalSearch}
          className="w-full flex items-center justify-between bg-[#243343] border border-white/15 hover:border-white/30 rounded-xl px-3 py-1.5 text-blue-200/60 hover:text-white transition-all seds-text-small"
        >
          <div className="flex items-center gap-2">
            <Search size={14} className="text-blue-200/60" />
            <span className="seds-text-small">Search applications, SKU, customers...</span>
          </div>
          <kbd className="px-1.5 py-0.2 seds-text-overline rounded bg-white/10 border border-white/15 text-blue-200/80">
            Ctrl+K
          </kbd>
        </button>
      </div>

      {/* 3. Right Enterprise Actions & User Profile */}
      <div className="flex items-center gap-2">
        {/* SAP Fiori Interactive Theme Switcher */}
        <div className="flex items-center gap-1 bg-white/10 border border-white/15 rounded-lg p-1">
          <Palette size={14} className="text-[#6fa8dc] ml-1 shrink-0" />
          <select
            value={activeTheme}
            onChange={(e) => handleThemeChange(e.target.value as SEEFTheme)}
            className="bg-transparent text-white seds-text-caption font-semibold focus:outline-none cursor-pointer pr-1"
            title="Switch SAP Fiori Theme"
          >
            <option value="dark" className="bg-[#1c222b] text-white">🌙 Quartz Dark</option>
            <option value="enterprise" className="bg-white text-[#1d2d3e]">☀️ Horizon Light (Fiori)</option>
            <option value="corporate" className="bg-[#0f1d2a] text-white">🏢 Corporate Navy</option>
          </select>
        </div>

        {/* Help Portal */}
        <button
          onClick={onOpenHelp}
          className="p-1.5 rounded-lg text-blue-200/80 hover:text-white hover:bg-white/10 transition-colors"
          title="SMRITI Documentation & Help"
        >
          <HelpCircle size={16} />
        </button>

        {/* Notifications Trigger */}
        <button
          onClick={onOpenNotifications}
          className="p-1.5 rounded-lg text-blue-200/80 hover:text-white hover:bg-white/10 transition-colors relative"
          title="Notifications"
        >
          <Bell size={16} />
          <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-rose-400" />
        </button>

        {/* User Profile Pill */}
        <div className="flex items-center gap-2 pl-2 border-l border-white/15">
          <div className="w-7 h-7 rounded-full bg-[#1a73e8] border border-white/20 text-white flex items-center justify-center font-bold text-xs shadow-sm">
            {currentUser?.name ? currentUser.name.charAt(0).toUpperCase() : "U"}
          </div>
          <div className="hidden md:flex flex-col text-left">
            <span className="font-bold text-white text-xs leading-tight">
              {currentUser?.name || "Cashier"}
            </span>
            <span className="text-[10px] text-[#6fa8dc] font-mono leading-tight">
              {currentUser?.role || "Staff"}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
};
