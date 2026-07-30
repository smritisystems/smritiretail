/**
 * Project      : SMRITI Retail OS v6.5 — Platform Architecture Constitution
 * Module       : SUNEFNavigationBar Component (SUNE In-App Control Bar)
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Copyright    : © SMRITIBooks.com and AITDL.com. All Rights Reserved.
 * Version      : 3.3.0
 */

import React, { useState, useEffect } from "react";
import { ArrowLeft, ArrowRight, RotateCw, Home, ChevronRight, History } from "lucide-react";
import { SUNEFKernel, NavigationHistory } from "./SUNEFKernel.ts";

export const SUNEFNavigationBar: React.FC = () => {
  const [canGoBack, setCanGoBack] = useState<boolean>(false);
  const [canGoForward, setCanGoForward] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [breadcrumb, setBreadcrumb] = useState<string[]>(["Home", "Dashboard"]);
  const [showHistoryDropdown, setShowHistoryDropdown] = useState<boolean>(false);
  const [historyStackData, setHistoryStackData] = useState<{ items: NavigationHistory[]; currentIndex: number }>({
    items: [],
    currentIndex: -1
  });

  const syncState = () => {
    setCanGoBack(SUNEFKernel.canGoBack());
    setCanGoForward(SUNEFKernel.canGoForward());
    setBreadcrumb(SUNEFKernel.getCurrentBreadcrumb());
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

  const handleForward = async () => {
    await SUNEFKernel.goForward();
    syncState();
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await SUNEFKernel.smartRefresh();
    setTimeout(() => setIsRefreshing(false), 600);
  };

  const handleHome = async () => {
    await SUNEFKernel.goHome();
    syncState();
  };

  const handleJump = async (idx: number) => {
    await SUNEFKernel.jumpToHistory(idx);
    setShowHistoryDropdown(false);
    syncState();
  };

  return (
    <div className="flex items-center gap-2">
      {/* 1. In-App Control Bar */}
      <div className="flex items-center gap-1 bg-white/10 border border-white/15 rounded-lg p-0.5 relative">
        {/* ◀ Back */}
        <button
          onClick={handleBack}
          disabled={!canGoBack}
          className={`p-1.5 rounded transition-all flex items-center justify-center ${
            canGoBack
              ? "text-white hover:bg-white/15 cursor-pointer"
              : "text-white/30 cursor-not-allowed opacity-40"
          }`}
          title="Back (Alt + ←)"
        >
          <ArrowLeft size={13} />
        </button>

        {/* ▶ Forward */}
        <button
          onClick={handleForward}
          disabled={!canGoForward}
          className={`p-1.5 rounded transition-all flex items-center justify-center ${
            canGoForward
              ? "text-white hover:bg-white/15 cursor-pointer"
              : "text-white/30 cursor-not-allowed opacity-40"
          }`}
          title="Forward (Alt + →)"
        >
          <ArrowRight size={13} />
        </button>

        {/* ⟳ Smart Refresh */}
        <button
          onClick={handleRefresh}
          className="p-1.5 rounded text-white hover:bg-white/15 transition-all cursor-pointer flex items-center justify-center"
          title="Smart Refresh — Preserve Drafts (Ctrl + R)"
        >
          <RotateCw size={13} className={isRefreshing ? "animate-spin text-blue-300" : ""} />
        </button>

        {/* 🏠 Home */}
        <button
          onClick={handleHome}
          className="p-1.5 rounded text-white hover:bg-white/15 transition-all cursor-pointer flex items-center justify-center"
          title="Home Dashboard (Ctrl + H)"
        >
          <Home size={13} />
        </button>

        {/* History Dropdown Trigger */}
        <button
          onClick={() => setShowHistoryDropdown(!showHistoryDropdown)}
          className="p-1.5 rounded text-blue-200 hover:text-white hover:bg-white/15 transition-all cursor-pointer flex items-center justify-center border-l border-white/15 ml-0.5 pl-1.5"
          title="Workspace Navigation History (NHE)"
        >
          <History size={13} />
        </button>

        {/* Interactive History Dropdown Menu */}
        {showHistoryDropdown && (
          <div className="absolute top-9 left-0 w-64 bg-[#1e293b] border border-slate-700 rounded-xl shadow-2xl z-50 p-2 text-xs font-sans text-slate-200">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 py-1 border-b border-slate-700 flex justify-between">
              <span>Navigation History (NHE)</span>
              <span>{historyStackData.items.length} Workspaces</span>
            </div>
            <div className="max-h-60 overflow-y-auto space-y-0.5 mt-1">
              {historyStackData.items.map((item, idx) => (
                <button
                  key={item.id}
                  onClick={() => handleJump(idx)}
                  className={`w-full text-left px-2 py-1.5 rounded transition-colors flex items-center justify-between cursor-pointer ${
                    idx === historyStackData.currentIndex
                      ? "bg-blue-600/30 text-blue-300 font-bold border border-blue-500/40"
                      : "hover:bg-slate-800 text-slate-300"
                  }`}
                >
                  <span className="truncate">{item.title}</span>
                  <span className="text-[9px] font-mono text-slate-400 capitalize">{item.module}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 2. SUNE Dynamic Breadcrumb Trail */}
      <div className="hidden lg:flex items-center gap-1.5 text-xs text-blue-200/80 font-mono bg-white/5 border border-white/10 px-2.5 py-1 rounded-lg">
        {breadcrumb.map((crumb, i) => (
          <React.Fragment key={crumb + i}>
            {i > 0 && <ChevronRight size={11} className="text-white/40" />}
            <span className={i === breadcrumb.length - 1 ? "text-white font-bold" : "hover:text-white cursor-pointer"}>
              {crumb}
            </span>
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};
