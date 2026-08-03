/**
 * Project      : SMRITI Retail OS
 * Module       : Zone A â€” Shell Header Component
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Copyright    : Â© SMRITIBooks.com. All Rights Reserved.
 * Version      : 5.4.0
 */

import React, { useState, useEffect } from "react";
import { Sparkles, Search, Bell, Clock, User, ShieldCheck, Wifi } from "lucide-react";

interface HeaderProps {
  currentUser?: { role: string; name: string; companyId?: string; branchId?: string } | null;
  onOpenSearch: () => void;
  onOpenNotifications: () => void;
  onSelectTab: (tabId: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentUser,
  onOpenSearch,
  onOpenNotifications,
  onSelectTab
}) => {
  const [timeStr, setTimeStr] = useState<string>("");

  useEffect(() => {
    const updateTime = () => {
      setTimeStr(
        new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="bg-theme-surface-1 border border-theme-divider rounded-lg p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
      {/* Brand & User Greeting */}
      <div className="space-y-1">
        <div className="flex items-center gap-2 mb-1">
          <span className="px-2.5 py-0.5 text-[11px] font-mono rounded bg-theme-surface-2 text-theme-body border border-theme-divider flex items-center gap-1.5 shadow-xs">
            <Sparkles className="w-3.5 h-3.5 text-[var(--c-seef-accent)]" /> SLP-001 Desktop v5.4
          </span>
          <span className="text-xs font-mono text-theme-muted flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 text-theme-muted" /> {timeStr} IST
          </span>
          <span className="text-xs font-mono text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
            <Wifi className="w-3 h-3" /> Online
          </span>
        </div>
        <h1 className="text-xl font-bold tracking-tight text-theme-heading">
          Welcome back, {currentUser?.name || "Cashier"}
        </h1>
        <p className="text-xs text-theme-muted flex flex-wrap items-center gap-2 font-mono">
          <span>Role: <strong className="text-theme-heading font-medium">{currentUser?.role || "Staff"}</strong></span>
          <span>â€¢</span>
          <span>Company: <strong className="text-theme-heading font-medium">{currentUser?.companyId || "SMRITI Enterprise HQ"}</strong></span>
          <span>â€¢</span>
          <span>Branch: <strong className="text-theme-heading font-medium">{currentUser?.branchId || "Main Store"}</strong></span>
        </p>
      </div>

      {/* Universal Search & Quick Tools */}
      <div className="flex items-center gap-3">
        <div
          onClick={onOpenSearch}
          className="w-full md:w-64 bg-theme-surface-2 border border-theme-divider hover:border-[var(--c-seef-accent)] rounded-lg px-3 py-2 text-xs text-theme-muted flex items-center justify-between cursor-pointer transition-all shadow-xs"
        >
          <span className="flex items-center gap-2">
            <Search className="w-3.5 h-3.5 text-[var(--c-seef-accent)]" />
            Search (Ctrl+K)...
          </span>
          <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-theme-surface-1 border border-theme-divider rounded text-theme-muted">
            Ctrl+K
          </kbd>
        </div>

        <button
          onClick={onOpenNotifications}
          className="p-2 rounded-lg bg-theme-surface-2 hover:bg-theme-surface-hover border border-theme-divider text-theme-heading relative transition-all"
          title="Notifications"
        >
          <Bell className="w-4 h-4" />
          <span className="w-2 h-2 rounded-full bg-[var(--c-seef-accent)] absolute top-1.5 right-1.5 animate-pulse" />
        </button>

        <button
          onClick={() => onSelectTab("user-profile")}
          className="p-2 rounded-lg bg-theme-surface-2 hover:bg-theme-surface-hover border border-theme-divider text-theme-heading transition-all"
          title="User Profile"
        >
          <User className="w-4 h-4 text-[var(--c-seef-accent)]" />
        </button>
      </div>
    </div>
  );
};
