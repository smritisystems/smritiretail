/**
 * Project      : SMRITI Retail OS v6.5 — Platform Architecture Constitution
 * Module       : SUNEFNavigationBar Component (SUNE In-App Control Bar)
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Copyright    : © SMRITIBooks.com and AITDL.com. All Rights Reserved.
 * Version      : 3.3.0
 */

import React, { useState, useEffect } from "react";
import { ArrowLeft, RotateCw, History } from "lucide-react";
import { SUNEFKernel, NavigationHistory } from "./SUNEFKernel.ts";

export const SUNEFNavigationBar: React.FC = () => {
  const [canGoBack, setCanGoBack] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [showHistoryDropdown, setShowHistoryDropdown] = useState<boolean>(false);
  const [historyStackData, setHistoryStackData] = useState<{ items: NavigationHistory[]; currentIndex: number }>({
    items: [],
    currentIndex: -1
  });

  const syncState = () => {
    setCanGoBack(SUNEFKernel.canGoBack());
    setHistoryStackData(SUNEFKernel.getHistoryStack());
  };

  useEffect(() => {
    syncState();

    const handleEntityOpened = () => syncState();
    window.addEventListener("sunef_entity_opened", handleEntityOpened);
    return () => {
      window.removeEventListener("sunef_entity_opened", handleEntityOpened);
    };
  }, []);

  const handleBack = async () => {
    await SUNEFKernel.goBack();
    syncState();
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await SUNEFKernel.smartRefresh();
    setTimeout(() => setIsRefreshing(false), 600);
  };

  const handleJump = async (idx: number) => {
    await SUNEFKernel.jumpToHistory(idx);
    setShowHistoryDropdown(false);
    syncState();
  };

  if (!canGoBack && historyStackData.items.length <= 1) {
    return null;
  }

  return (
    <div className="flex items-center gap-1.5 ml-2 border-l border-white/15 pl-3">
      {/* ◀ Back */}
      <button
        type="button"
        onClick={handleBack}
        disabled={!canGoBack}
        className={`px-2 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
          canGoBack
            ? "bg-white/10 hover:bg-white/20 text-white cursor-pointer"
            : "opacity-40 cursor-not-allowed text-white/50"
        }`}
        title="Back (Alt + ←)"
      >
        <ArrowLeft size={13} />
        <span className="hidden lg:inline text-[11px]">Back</span>
      </button>

      {/* ⟳ Smart Refresh */}
      <button
        type="button"
        onClick={handleRefresh}
        className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-all cursor-pointer"
        title="Smart Refresh — Preserve Drafts (Ctrl + R)"
      >
        <RotateCw size={13} className={isRefreshing ? "animate-spin text-blue-300" : ""} />
      </button>

      {/* History Dropdown Trigger */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setShowHistoryDropdown(!showHistoryDropdown)}
          className="px-2 py-1 rounded-lg text-xs text-white/80 hover:text-white hover:bg-white/10 transition-all cursor-pointer flex items-center gap-1"
          title="Recent Workspaces History"
        >
          <History size={13} />
          <span className="hidden lg:inline text-[11px]">Recent</span>
        </button>

        {showHistoryDropdown && (
          <div className="absolute top-8 left-0 w-64 bg-theme-surface-1 border border-theme-divider rounded-xl shadow-2xl z-50 p-2 text-xs font-sans">
            <div className="text-[10px] font-bold text-theme-muted uppercase tracking-wider px-2 py-1 border-b border-theme-divider flex justify-between">
              <span>Recent Workspaces</span>
              <span>{historyStackData.items.length} Visited</span>
            </div>
            <div className="max-h-60 overflow-y-auto space-y-0.5 mt-1 font-mono text-xs">
              {historyStackData.items.map((item, idx) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleJump(idx)}
                  className={`w-full text-left px-2.5 py-1.5 rounded-lg transition-colors flex items-center justify-between cursor-pointer ${
                    idx === historyStackData.currentIndex
                      ? "bg-emerald-500/10 text-emerald-400 font-bold border border-emerald-500/30"
                      : "text-theme-body hover:bg-theme-surface-2"
                  }`}
                >
                  <span className="truncate">{item.title}</span>
                  {idx === historyStackData.currentIndex && <span className="text-[10px]">Active</span>}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
