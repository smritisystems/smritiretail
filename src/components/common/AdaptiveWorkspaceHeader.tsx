/**
 * Project      : SMRITI Retail OS
 * Module       : SAP Fiori Enterprise Slim Header (WNG-002 Compliant)
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * Version      : 5.1.0 (SEEF Phase 8 — Token Upgrade)
 */

import React from "react";
import { Search, Bell, Sparkles, User, HelpCircle, Shield } from "lucide-react";
import { useSEEF } from "../../layout_engine/SEEFContext.tsx";

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
  const { theme, toggleTheme } = useSEEF();

  return (
    <header className="h-12 bg-theme-surface-1 border-b border-theme-divider px-4 flex items-center justify-between text-xs select-none z-30 shadow-sm">
      {/* 1. SMRITI Brand & Version Badge */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse" />
          <span className="font-bold text-sm text-theme-heading font-display tracking-tight">
            SMRITI <span className="text-cyan-400 font-mono text-xs">Retail OS</span>
          </span>
        </div>
        <span className="px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-mono text-[10px] font-semibold hidden sm:inline-block">
          v5.1 Fiori
        </span>
      </div>

      {/* 2. Center Global Search Input Trigger (Ctrl+K) */}
      <div className="flex-1 max-w-md mx-4">
        <button
          onClick={onOpenGlobalSearch}
          className="w-full flex items-center justify-between bg-theme-surface-2 border border-theme-divider hover:border-cyan-500/50 rounded-xl px-3 py-1.5 text-theme-muted hover:text-theme-body transition-all text-xs"
        >
          <div className="flex items-center gap-2">
            <Search size={14} className="text-theme-muted" />
            <span>Search applications, SKU, customers...</span>
          </div>
          <kbd className="px-1.5 py-0.2 text-[9px] font-mono rounded bg-theme-surface-3 border border-theme-divider text-theme-muted">
            Ctrl+K
          </kbd>
        </button>
      </div>

      {/* 3. Right Enterprise Actions & User Profile */}
      <div className="flex items-center gap-2">
        {/* Help Portal */}
        <button
          onClick={onOpenHelp}
          className="p-1.5 rounded-lg text-theme-muted hover:text-theme-heading hover:bg-theme-surface-2 transition-colors"
          title="SMRITI Documentation & Help"
        >
          <HelpCircle size={16} />
        </button>

        {/* Notifications Trigger */}
        <button
          onClick={onOpenNotifications}
          className="p-1.5 rounded-lg text-theme-muted hover:text-theme-heading hover:bg-theme-surface-2 transition-colors relative"
          title="Notifications"
        >
          <Bell size={16} />
          <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-rose-500" />
        </button>

        {/* User Profile Pill */}
        <div className="flex items-center gap-2 pl-2 border-l border-theme-divider">
          <div className="w-7 h-7 rounded-full bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 flex items-center justify-center font-bold text-xs">
            {currentUser?.name ? currentUser.name.charAt(0).toUpperCase() : "U"}
          </div>
          <div className="hidden md:flex flex-col text-left">
            <span className="font-bold text-theme-heading text-xs leading-tight">
              {currentUser?.name || "Cashier"}
            </span>
            <span className="text-[10px] text-theme-muted font-mono leading-tight">
              {currentUser?.role || "Staff"}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
};
