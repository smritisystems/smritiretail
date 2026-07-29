/**
 * Project      : SMRITI Business OS
 * Component    : SEDSHeader (SMRITI Shell Bar Equivalent)
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * License      : Proprietary Commercial Software
 * Classification: SEDS Enterprise Core Component
 */

import React from "react";
import { Search, Bell, Sun, Moon, Sparkles, Command } from "lucide-react";
import { SEDSAvatar } from "./SEDSAvatar";

export interface SEDSHeaderProps {
  appName?: string;
  version?: string;
  userName?: string;
  userRole?: string;
  userEmail?: string;
  unreadNotificationsCount?: number;
  onSearchClick?: () => void;
  onNotificationsClick?: () => void;
  onThemeToggle?: () => void;
  isDarkMode?: boolean;
}

export const SEDSHeader: React.FC<SEDSHeaderProps> = ({
  appName = "SMRITI Business OS",
  version = "v3.16 Fiori SEDS",
  userName = "System Admin",
  userRole = "SYSADMIN",
  unreadNotificationsCount = 0,
  onSearchClick,
  onNotificationsClick,
  onThemeToggle,
  isDarkMode = true,
}) => {
  return (
    <header className="w-full bg-[#11141c] border-b border-theme-divider/80 px-4 md:px-6 py-2.5 flex items-center justify-between gap-4 font-sans select-none z-30">
      {/* Brand Identity & Version */}
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center font-bold text-white shadow-lg text-sm tracking-tighter">
          S
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-display font-bold text-sm text-theme-body tracking-tight">{appName}</span>
            <span className="px-2 py-0.5 rounded-full bg-blue-950/60 border border-blue-500/30 text-[10px] font-mono text-blue-400 font-bold">
              {version}
            </span>
          </div>
        </div>
      </div>

      {/* Global Command Palette / Search Trigger */}
      <button
        onClick={onSearchClick}
        className="hidden md:flex items-center gap-3 px-4 py-1.5 bg-theme-surface-2/80 border border-theme-divider/80 rounded-xl text-xs text-theme-muted hover:text-theme-body hover:border-theme-muted transition w-72 lg:w-96 justify-between"
      >
        <div className="flex items-center gap-2">
          <Search size={14} className="text-theme-muted" />
          <span>Search applications, SKU, customers...</span>
        </div>
        <div className="flex items-center gap-1 font-mono text-[10px] bg-theme-surface-3 px-1.5 py-0.5 rounded border border-theme-divider">
          <Command size={10} />
          <span>K</span>
        </div>
      </button>

      {/* Right Shell Bar Actions */}
      <div className="flex items-center gap-3">
        {onNotificationsClick && (
          <button
            onClick={onNotificationsClick}
            className="relative p-2 rounded-xl bg-theme-surface-2 border border-theme-divider text-theme-muted hover:text-theme-body transition"
            title="Notifications"
          >
            <Bell size={16} />
            {unreadNotificationsCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-blue-500 text-white text-[9px] font-bold flex items-center justify-center animate-pulse">
                {unreadNotificationsCount}
              </span>
            )}
          </button>
        )}

        {onThemeToggle && (
          <button
            onClick={onThemeToggle}
            className="p-2 rounded-xl bg-theme-surface-2 border border-theme-divider text-theme-muted hover:text-theme-body transition"
            title="Toggle Theme"
          >
            {isDarkMode ? <Sun size={16} /> : <Moon size={16} />}
          </button>
        )}

        {/* User Profile Avatar */}
        <div className="flex items-center gap-2 pl-2 border-l border-theme-divider">
          <SEDSAvatar name={userName} role={userRole} size="sm" />
          <div className="hidden lg:flex flex-col text-left">
            <span className="text-xs font-bold text-theme-body leading-none">{userName}</span>
            <span className="text-[10px] font-mono text-theme-muted uppercase tracking-wider mt-0.5">{userRole}</span>
          </div>
        </div>
      </div>
    </header>
  );
};
