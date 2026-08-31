/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.2.0
 * Created      : 2026-08-16
 * Modified     : 2026-08-21
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import React, { useMemo, useState, useEffect } from "react";
import { ExternalLink, Search, X, Sparkles, Layers, ShieldCheck, Database, Store } from "lucide-react";
import { useWorkspace } from "../../contexts/WorkspaceContext.tsx";
import type { TileData } from "./launchpadCatalog.ts";
import {
  LAUNCHPAD_CATALOG,
  getVisibleLaunchpadTiles,
  getQuickActionTiles,
} from "./launchpadCatalog.ts";

export type { TileData };
export {
  LAUNCHPAD_CATALOG,
  getVisibleLaunchpadTiles,
  getQuickActionTiles,
};

export interface FioriLaunchpadProps {
  currentUser?: { role: string; name: string } | null;
  onSelectModule: (moduleId: string) => void;
}

export const FioriLaunchpad: React.FC<FioriLaunchpadProps> = ({ currentUser, onSelectModule }) => {
  const { popOutExternalWindow } = useWorkspace();
  const [searchTerm, setSearchTerm] = useState<string>("");

  // Filter tiles strictly using the canonical helper (deny-by-default)
  const visibleTiles = useMemo(() => {
    return getVisibleLaunchpadTiles(currentUser?.role);
  }, [currentUser?.role]);

  // Quick Action Tiles
  const quickActions = useMemo(() => {
    return visibleTiles.filter((t) => t.isQuickAction);
  }, [visibleTiles]);

  // Search filtered tiles
  const filteredTiles = useMemo(() => {
    if (!searchTerm.trim()) return visibleTiles;
    const query = searchTerm.toLowerCase().trim();
    return visibleTiles.filter(
      (t) =>
        t.title.toLowerCase().includes(query) ||
        t.subtitle.toLowerCase().includes(query) ||
        t.group.toLowerCase().includes(query) ||
        (t.tag && t.tag.toLowerCase().includes(query))
    );
  }, [visibleTiles, searchTerm]);

  // Group names from filtered tiles
  const groups = useMemo(() => {
    return Array.from(new Set(filteredTiles.map((t) => t.group)));
  }, [filteredTiles]);

  // Hotkey support for Quick Actions (F1, F3, F4, F5, F6)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input
      if (["INPUT", "TEXTAREA", "SELECT"].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }
      const matched = quickActions.find((qa) => qa.shortcut === e.key);
      if (matched) {
        e.preventDefault();
        onSelectModule(matched.id);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [quickActions, onSelectModule]);

  // Group color accents
  const getGroupAccent = (groupName: string) => {
    switch (groupName) {
      case "Retail Operations":
        return {
          border: "border-l-emerald-500",
          dot: "bg-emerald-500",
          badge: "bg-emerald-50 text-emerald-700 border-emerald-200",
          hoverBorder: "hover:border-emerald-400",
          iconBg: "bg-emerald-500/10 text-emerald-600",
          arrow: "text-emerald-600",
        };
      case "Master Data & Stock":
        return {
          border: "border-l-indigo-500",
          dot: "bg-indigo-500",
          badge: "bg-indigo-50 text-indigo-700 border-indigo-200",
          hoverBorder: "hover:border-indigo-400",
          iconBg: "bg-indigo-500/10 text-indigo-600",
          arrow: "text-indigo-600",
        };
      case "Finance & Compliance":
        return {
          border: "border-l-amber-500",
          dot: "bg-amber-500",
          badge: "bg-amber-50 text-amber-700 border-amber-200",
          hoverBorder: "hover:border-amber-400",
          iconBg: "bg-amber-500/10 text-amber-600",
          arrow: "text-amber-600",
        };
      case "Administration & Control":
        return {
          border: "border-l-purple-500",
          dot: "bg-purple-500",
          badge: "bg-purple-50 text-purple-700 border-purple-200",
          hoverBorder: "hover:border-purple-400",
          iconBg: "bg-purple-500/10 text-purple-600",
          arrow: "text-purple-600",
        };
      case "Analytics & Reporting":
        return {
          border: "border-l-blue-500",
          dot: "bg-blue-500",
          badge: "bg-blue-50 text-blue-700 border-blue-200",
          hoverBorder: "hover:border-blue-400",
          iconBg: "bg-blue-500/10 text-blue-600",
          arrow: "text-blue-600",
        };
      default:
        return {
          border: "border-l-slate-500",
          dot: "bg-slate-500",
          badge: "bg-slate-50 text-slate-700 border-slate-200",
          hoverBorder: "hover:border-slate-400",
          iconBg: "bg-slate-500/10 text-slate-600",
          arrow: "text-slate-600",
        };
    }
  };

  // Quick Action card specific colors
  const getQuickActionStyle = (qa: TileData) => {
    switch (qa.id) {
      case "pos":
        return {
          bg: "hover:bg-gradient-to-br hover:from-emerald-600 hover:to-emerald-700 hover:text-white",
          iconBg: "bg-emerald-100 text-emerald-700 group-hover:bg-white/20 group-hover:text-white",
          badge: "bg-emerald-100 text-emerald-800 border-emerald-300",
          hotkey: "bg-emerald-500 text-white",
        };
      case "create-tax-invoice":
        return {
          bg: "hover:bg-gradient-to-br hover:from-indigo-600 hover:to-indigo-700 hover:text-white",
          iconBg: "bg-indigo-100 text-indigo-700 group-hover:bg-white/20 group-hover:text-white",
          badge: "bg-indigo-100 text-indigo-800 border-indigo-300",
          hotkey: "bg-indigo-500 text-white",
        };
      case "item-master":
        return {
          bg: "hover:bg-gradient-to-br hover:from-purple-600 hover:to-purple-700 hover:text-white",
          iconBg: "bg-purple-100 text-purple-700 group-hover:bg-white/20 group-hover:text-white",
          badge: "bg-purple-100 text-purple-800 border-purple-300",
          hotkey: "bg-purple-500 text-white",
        };
      case "barcode":
        return {
          bg: "hover:bg-gradient-to-br hover:from-amber-600 hover:to-amber-700 hover:text-white",
          iconBg: "bg-amber-100 text-amber-800 group-hover:bg-white/20 group-hover:text-white",
          badge: "bg-amber-100 text-amber-800 border-amber-300",
          hotkey: "bg-amber-500 text-white",
        };
      case "stock-ledger":
        return {
          bg: "hover:bg-gradient-to-br hover:from-blue-600 hover:to-blue-700 hover:text-white",
          iconBg: "bg-blue-100 text-blue-700 group-hover:bg-white/20 group-hover:text-white",
          badge: "bg-blue-100 text-blue-800 border-blue-300",
          hotkey: "bg-blue-500 text-white",
        };
      default:
        return {
          bg: "hover:bg-gradient-to-br hover:from-blue-600 hover:to-blue-700 hover:text-white",
          iconBg: "bg-blue-100 text-blue-700 group-hover:bg-white/20 group-hover:text-white",
          badge: "bg-blue-100 text-blue-800 border-blue-300",
          hotkey: "bg-blue-500 text-white",
        };
    }
  };

  return (
    <div className="flex-1 bg-[#f5f6f8] overflow-y-auto p-4 md:p-6 space-y-6 select-none custom-scrollbar font-sans antialiased text-[#1e293b]">
      
      {/* 1. Hero Operational Banner */}
      <div className="relative overflow-hidden bg-gradient-to-r from-[#041632] via-[#0b254a] to-[#1b3a6b] text-white p-6 md:p-7 rounded-2xl shadow-md border border-[#3e5f90]/30 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
        
        {/* Subtle mesh background glow */}
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-64 h-64 rounded-full bg-blue-500/10 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-8 w-48 h-48 rounded-full bg-indigo-500/10 blur-2xl pointer-events-none" />

        <div className="relative z-10 space-y-1.5 max-w-xl">
          <div className="flex items-center gap-2">
            <span className="bg-blue-500/20 text-blue-300 border border-blue-400/30 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1">
              <Sparkles size={11} className="text-blue-300" />
              SMRITI Retail OS v6.2
            </span>
            <span className="text-[11px] text-blue-200/80 font-mono">
              Industrial Terminal
            </span>
          </div>

          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight font-display text-white">
            Retail Operations Launchpad
          </h1>
          <p className="text-xs md:text-sm text-blue-100/90 leading-relaxed">
            Unified operational workspace director for high-speed POS billing, barcode printing, and inventory control.
          </p>

          {/* Quick Real-Time Filter Search Box */}
          <div className="pt-2">
            <div className="relative max-w-md">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-300/70" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search workspaces (e.g. POS, Barcode, GST, Ledger, Purchase)..."
                className="w-full bg-white/10 hover:bg-white/15 focus:bg-white/20 border border-white/20 focus:border-blue-400 rounded-xl pl-9 pr-8 py-2 text-xs text-white placeholder-blue-200/60 outline-none transition font-medium backdrop-blur-xs shadow-inner"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-blue-200 hover:text-white p-0.5 rounded"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Live Operational Status Panel */}
        <div className="relative z-10 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-2 gap-2.5 bg-black/25 p-3.5 rounded-xl border border-white/10 font-mono backdrop-blur-md shrink-0">
          
          <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
              <Store size={16} />
            </div>
            <div>
              <div className="text-blue-200/70 text-[9px] uppercase font-bold tracking-wider">Store Status</div>
              <div className="text-xs font-bold text-emerald-300 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Main Store
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/5">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0">
              <ShieldCheck size={16} />
            </div>
            <div>
              <div className="text-blue-200/70 text-[9px] uppercase font-bold tracking-wider">Role Access</div>
              <div className="text-xs font-bold text-white font-sans">{currentUser?.role || "SYSADMIN"}</div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/5">
            <div className="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">
              <Database size={16} />
            </div>
            <div>
              <div className="text-blue-200/70 text-[9px] uppercase font-bold tracking-wider">Backend</div>
              <div className="text-xs font-bold text-white">FastAPI + PG</div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/5">
            <div className="w-8 h-8 rounded-lg bg-purple-500/20 text-purple-400 flex items-center justify-center shrink-0">
              <Layers size={16} />
            </div>
            <div>
              <div className="text-blue-200/70 text-[9px] uppercase font-bold tracking-wider">Workspaces</div>
              <div className="text-xs font-bold text-white font-mono">{filteredTiles.length} / {visibleTiles.length}</div>
            </div>
          </div>

        </div>

      </div>

      {/* 2. Primary Quick Actions Row (Mobile / Touch Bar with Hotkey Badges) */}
      {!searchTerm && quickActions.length > 0 && (
        <div className="bg-white border border-[#e2e8f0] rounded-2xl p-4 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold font-mono uppercase tracking-wider text-[#041632]">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>Primary Quick Actions (1-Tap &amp; Keyboard Shortcuts)</span>
            </div>
            <span className="text-[10px] text-[#64748b] font-mono">Instant F-Key Routing</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
            {quickActions.map((qa) => {
              const style = getQuickActionStyle(qa);
              return (
                <button
                  key={`qa-${qa.id}`}
                  type="button"
                  onClick={() => onSelectModule(qa.id)}
                  className={`relative p-3.5 bg-[#f8fafc] ${style.bg} border border-[#e2e8f0] rounded-xl flex flex-col items-center justify-center text-center gap-2 transition-all duration-200 group cursor-pointer shadow-xs hover:-translate-y-1 hover:shadow-md`}
                >
                  {/* Hotkey Tag Badge */}
                  {qa.shortcut && (
                    <span className="absolute top-2 right-2 font-mono text-[9px] font-extrabold px-1.5 py-0.5 rounded shadow-2xs border border-black/10 bg-white/90 text-[#041632] group-hover:bg-white/20 group-hover:text-white group-hover:border-white/30 transition-colors">
                      {qa.shortcut}
                    </span>
                  )}

                  <div className={`w-11 h-11 rounded-xl ${style.iconBg} flex items-center justify-center transition-all duration-200 shadow-xs group-hover:scale-105`}>
                    <span className="material-symbols-outlined text-[24px]">{qa.icon}</span>
                  </div>

                  <span className="text-xs font-bold font-display line-clamp-1 text-[#041632] group-hover:text-white transition-colors">
                    {qa.title}
                  </span>

                  <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${style.badge} group-hover:bg-white/20 group-hover:text-white group-hover:border-white/30 transition-colors`}>
                    {qa.tag || "Quick"}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 3. Grouped Workspace Cards */}
      {groups.length === 0 ? (
        <div className="bg-white border border-[#e2e8f0] rounded-2xl p-12 text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 mx-auto flex items-center justify-center">
            <Search size={24} />
          </div>
          <h3 className="font-bold text-sm text-[#041632]">No workspaces match "{searchTerm}"</h3>
          <p className="text-xs text-[#64748b]">Try searching for different keywords like POS, Barcode, Ledger, or Tax.</p>
          <button
            type="button"
            onClick={() => setSearchTerm("")}
            className="px-4 py-1.5 bg-[#041632] text-white rounded-lg text-xs font-bold hover:bg-[#1b2b48] transition"
          >
            Clear Search Filter
          </button>
        </div>
      ) : (
        groups.map((groupName) => {
          const tiles = filteredTiles.filter((t) => t.group === groupName);
          const accent = getGroupAccent(groupName);

          return (
            <section key={groupName} className="space-y-3">
              {/* Category Section Header */}
              <div className="flex items-center justify-between border-b border-[#e2e8f0] pb-2">
                <h2 className="text-xs font-extrabold text-[#041632] uppercase tracking-wider flex items-center gap-2 font-mono">
                  <span className={`w-2.5 h-2.5 rounded-full ${accent.dot}`} />
                  <span>{groupName}</span>
                </h2>
                <span className="text-[11px] text-[#64748b] font-mono bg-white border border-[#e2e8f0] px-2 py-0.5 rounded-full font-semibold shadow-2xs">
                  {tiles.length} {tiles.length === 1 ? "Workspace" : "Workspaces"}
                </span>
              </div>

              {/* Grid of Elevated Workspace Tiles */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
                {tiles.map((tile) => (
                  <button
                    key={tile.id}
                    type="button"
                    onClick={() => onSelectModule(tile.id)}
                    className={`group bg-white hover:bg-[#f8fafc] border border-[#e2e8f0] ${accent.border} ${accent.hoverBorder} rounded-xl p-4 text-left transition-all duration-200 hover:shadow-md hover:-translate-y-1 flex flex-col justify-between cursor-pointer relative overflow-hidden`}
                  >
                    <div>
                      {/* Top Row: Icon, Tag Badge & Pop-out */}
                      <div className="flex items-start justify-between gap-2 mb-2.5">
                        <div className={`w-10 h-10 rounded-xl ${accent.iconBg} group-hover:scale-105 flex items-center justify-center transition-all duration-200 shadow-2xs shrink-0 border border-black/5`}>
                          <span className="material-symbols-outlined text-[22px]">{tile.icon}</span>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <span
                            role="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              popOutExternalWindow(tile.id, tile.title, tile.icon);
                            }}
                            title={`Pop out ${tile.title} into external window`}
                            className="p-1 rounded-md text-[#94a3b8] hover:text-[#041632] hover:bg-slate-100 transition-colors cursor-pointer"
                          >
                            <ExternalLink size={13} />
                          </span>

                          {tile.tag && (
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full font-mono border ${accent.badge}`}>
                              {tile.tag}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Title & Description */}
                      <h3 className="font-bold text-sm text-[#041632] group-hover:text-[#3e5f90] transition-colors mt-1 font-display">
                        {tile.title}
                      </h3>
                      <p className="text-xs text-[#64748b] mt-1 leading-snug line-clamp-2">
                        {tile.subtitle}
                      </p>
                    </div>

                    {/* Card Footer Action Indicator */}
                    <div className={`mt-3.5 pt-2 border-t border-[#f1f5f9] flex items-center justify-between text-[11px] ${accent.arrow} font-semibold font-mono`}>
                      <span>Open Workspace</span>
                      <span className="material-symbols-outlined text-[15px] group-hover:translate-x-1 transition-transform">
                        arrow_forward
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </section>
          );
        })
      )}

    </div>
  );
};

export default FioriLaunchpad;
