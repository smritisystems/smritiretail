/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.99.12
 * Created      : 2026-08-16
 * Modified     : 2026-10-22
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Fiori Launchpad Interactive Workspace Hub
 */

import React, { useMemo, useState, useEffect } from "react";
import { ExternalLink, Search, X, Clock, Star } from "lucide-react";
import { useWorkspace } from "../../contexts/WorkspaceContext.tsx";
import { useLayoutEngine } from "../../layout_engine/layout_store.tsx";
import { apiFetchV1 } from "../../lib/apiFetchV1.ts";
import type { TileData } from "./launchpadCatalog.ts";
import {
  LAUNCHPAD_CATALOG,
  getVisibleLaunchpadTiles,
  getQuickActionTiles,
  synthesizeLaunchpadCatalogWithRemoteMenus,
} from "./launchpadCatalog.ts";

export type { TileData };
export {
  LAUNCHPAD_CATALOG,
  getVisibleLaunchpadTiles,
  getQuickActionTiles,
  synthesizeLaunchpadCatalogWithRemoteMenus,
};

const matchesShortcut = (event: KeyboardEvent, shortcut: string) => {
  const parts = shortcut.split("+").map(part => part.trim().toLowerCase());
  const key = parts[parts.length - 1];
  return event.key.toLowerCase() === key
    && event.altKey === parts.includes("alt")
    && event.ctrlKey === (parts.includes("ctrl") || parts.includes("control"))
    && event.shiftKey === parts.includes("shift")
    && event.metaKey === (parts.includes("meta") || parts.includes("cmd"));
};

export interface FioriLaunchpadProps {
  currentUser?: { role: string; name: string } | null;
  onSelectModule: (moduleId: string) => void;
  uxMode?: "regular" | "classic";
}

const getTileTitle = (tile: TileData) => tile.plainTitle || tile.title;
const getTileSubtitle = (tile: TileData) => tile.plainSubtitle || tile.subtitle;
const normalizeWorkspaceId = (id: string) => id === "pos" ? "billing-workspace" : id;

export const FioriLaunchpad: React.FC<FioriLaunchpadProps> = ({ currentUser, onSelectModule }) => {
  const { popOutExternalWindow } = useWorkspace();
  const { preferences, recentlyUsed, toggleFavorite } = useLayoutEngine();
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [showAllQuickActions, setShowAllQuickActions] = useState(false);
  const [showAllPersonalWorkspaces, setShowAllPersonalWorkspaces] = useState(false);
  const [remoteMenus, setRemoteMenus] = useState<any[] | null>(null);

  // Asynchronously query PostgreSQL control plane (/api/v1/menus/resolved)
  useEffect(() => {
    let isMounted = true;
    async function loadControlPlaneMenus() {
      try {
        const res = await apiFetchV1<any[]>("/menus/resolved");
        if (!isMounted) return;
        const data = Array.isArray(res) ? res : (res as any)?.data || (res as any)?.items || [];
        if (Array.isArray(data) && data.length > 0) {
          setRemoteMenus(data);
        }
      } catch {
        // Resilient offline fallback: retain static LAUNCHPAD_CATALOG without disruption
      }
    }
    loadControlPlaneMenus();
    return () => {
      isMounted = false;
    };
  }, []);

  // Synthesize catalog from database menus or fallback to static catalog
  const activeCatalog = useMemo(() => {
    if (!remoteMenus || remoteMenus.length === 0) {
      return LAUNCHPAD_CATALOG;
    }
    return synthesizeLaunchpadCatalogWithRemoteMenus(remoteMenus, LAUNCHPAD_CATALOG);
  }, [remoteMenus]);

  // Filter tiles strictly using the canonical helper (deny-by-default)
  const visibleTiles = useMemo(() => {
    return getVisibleLaunchpadTiles(currentUser?.role, activeCatalog);
  }, [currentUser?.role, activeCatalog]);

  // Quick Action Tiles
  const quickActions = useMemo(() => {
    return visibleTiles.filter((t) => t.isQuickAction);
  }, [visibleTiles]);

  const favoriteTiles = visibleTiles.filter((tile) =>
    preferences.favorites.some((id) => normalizeWorkspaceId(id) === tile.id),
  );
  const favoriteIds = new Set(favoriteTiles.map((tile) => tile.id));
  const recentTiles = recentlyUsed.reduce<TileData[]>((matches, id) => {
    const tileId = normalizeWorkspaceId(id);
    if (tileId === "dashboard" || tileId === "launchpad" || favoriteIds.has(tileId)) return matches;
    const tile = visibleTiles.find((candidate) => candidate.id === tileId);
    if (tile && !matches.some((match) => match.id === tile.id)) matches.push(tile);
    return matches;
  }, []);
  const personalWorkspaces = [
    ...favoriteTiles.map((tile) => ({ tile, kind: "Pinned" as const })),
    ...recentTiles.map((tile) => ({ tile, kind: "Recently opened" as const })),
  ];
  const visiblePersonalWorkspaces = showAllPersonalWorkspaces
    ? personalWorkspaces
    : personalWorkspaces.slice(0, 5);
  const visibleQuickActions = showAllQuickActions ? quickActions : quickActions.slice(0, 5);

  const isTileFavorite = (tile: TileData) =>
    preferences.favorites.some((id) => normalizeWorkspaceId(id) === tile.id);
  const toggleTileFavorite = (tile: TileData) => {
    const legacyFavorite = tile.id === "billing-workspace" && preferences.favorites.includes("pos");
    toggleFavorite(legacyFavorite ? "pos" : tile.id);
  };

  // Search filtered tiles
  const filteredTiles = useMemo(() => {
    if (!searchTerm.trim()) return visibleTiles;
    const query = searchTerm.toLowerCase().trim();
    return visibleTiles.filter(
      (t) =>
        [t.title, t.subtitle, t.plainTitle, t.plainSubtitle, ...(t.searchTerms || [])]
          .some((value) => value?.toLowerCase().includes(query)) ||
        t.group.toLowerCase().includes(query) ||
        (t.tag && t.tag.toLowerCase().includes(query))
    );
  }, [visibleTiles, searchTerm]);

  // Group names from filtered tiles
  const groups = useMemo(() => {
    return Array.from(new Set(filteredTiles.map((t) => t.group)));
  }, [filteredTiles]);

  // Hotkey support for configured Quick Actions
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target instanceof HTMLElement ? e.target : null;
      if (
        e.defaultPrevented
        || target?.isContentEditable
        || target?.closest("input, textarea, select, [contenteditable='true']")
      ) {
        return;
      }

      const matchedActions = quickActions.filter(qa => qa.shortcut && matchesShortcut(e, qa.shortcut));
      if (matchedActions.length === 1) {
        e.preventDefault();
        onSelectModule(matchedActions[0].id);
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
    <div className="flex-1 bg-[#f5f6f8] dark:bg-slate-950 overflow-y-auto p-4 md:p-6 space-y-6 select-none custom-scrollbar font-sans antialiased text-[#1e293b] dark:text-slate-100">
      
      {/* 1. Hero Operational Banner */}
      <div className="relative overflow-hidden bg-gradient-to-r from-[#041632] via-[#0b254a] to-[#1b3a6b] text-white p-6 md:p-7 rounded-2xl shadow-md border border-[#3e5f90]/30 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
        
        {/* Subtle mesh background glow */}
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-64 h-64 rounded-full bg-blue-500/10 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-8 w-48 h-48 rounded-full bg-indigo-500/10 blur-2xl pointer-events-none" />

        <div className="relative z-10 space-y-1.5 max-w-xl">
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight font-display text-white">
            What would you like to do?
          </h1>
          <p className="text-sm md:text-base text-blue-100/90 leading-relaxed">
            Search by task or workspace, or choose one of your pinned and recently opened workspaces below.
          </p>

          <div className="pt-2">
            <div className="relative max-w-md">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-300/70" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                aria-label="Search workspaces by task or name"
                placeholder="Try “sell”, “receive stock”, “barcode” or a workspace name"
                className="w-full min-h-11 bg-white/10 hover:bg-white/15 focus:bg-white/20 border border-white/20 focus:border-blue-400 rounded-xl pl-9 pr-12 py-2 text-sm text-white placeholder-blue-200/80 outline-none transition font-medium backdrop-blur-xs shadow-inner"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm("")}
                  aria-label="Clear workspace search"
                  className="absolute right-1 top-1/2 -translate-y-1/2 min-h-9 min-w-9 flex items-center justify-center text-blue-200 hover:text-white rounded"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="relative z-10 rounded-xl border border-white/15 bg-black/20 px-5 py-4 text-left shrink-0">
          <div className="text-sm text-blue-100">Available to you</div>
          <div className="mt-1 text-2xl font-bold">{visibleTiles.length} workspaces</div>
          <div className="mt-1 text-xs text-blue-100/80">Filtered by your account access</div>
        </div>

      </div>

      {!searchTerm && personalWorkspaces.length > 0 && (
        <section className="bg-white dark:bg-slate-900 border border-[#e2e8f0] dark:border-slate-800 rounded-2xl p-4 shadow-xs space-y-3" aria-labelledby="launchpad-personal-heading">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 id="launchpad-personal-heading" className="text-lg font-bold text-[#041632] dark:text-white">
                Your workspaces
              </h2>
              <p className="text-sm text-[#64748b] dark:text-slate-400">
                Pinned workspaces and the ones you opened recently.
              </p>
            </div>
            {personalWorkspaces.length > 5 && (
              <button
                type="button"
                onClick={() => setShowAllPersonalWorkspaces((showAll) => !showAll)}
                aria-expanded={showAllPersonalWorkspaces}
                className="min-h-10 rounded-lg px-3 text-sm font-semibold text-blue-700 hover:bg-blue-50 dark:text-blue-300 dark:hover:bg-slate-800"
              >
                {showAllPersonalWorkspaces ? "Show fewer" : `Show all ${personalWorkspaces.length}`}
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {visiblePersonalWorkspaces.map(({ tile, kind }) => {
              const isFavorite = isTileFavorite(tile);
              return (
                <article key={`${kind}-${tile.id}`} className="rounded-xl border border-[#e2e8f0] dark:border-slate-700 bg-[#f8fafc] dark:bg-slate-800 p-3.5 flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-semibold ${kind === "Pinned" ? "bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-200" : "bg-blue-50 text-blue-800 dark:bg-blue-950 dark:text-blue-200"}`}>
                      {kind === "Pinned" ? <Star size={13} aria-hidden="true" /> : <Clock size={13} aria-hidden="true" />}
                      {kind}
                    </span>
                    <button
                      type="button"
                      onClick={() => toggleTileFavorite(tile)}
                      aria-label={`${isFavorite ? "Remove" : "Pin"} ${getTileTitle(tile)} ${isFavorite ? "from" : "to"} your workspaces`}
                      aria-pressed={isFavorite}
                      title={isFavorite ? "Remove from pinned workspaces" : "Pin workspace"}
                      className="min-h-10 min-w-10 inline-flex items-center justify-center rounded-lg text-amber-700 hover:bg-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 dark:text-amber-300 dark:hover:bg-slate-700"
                    >
                      <Star size={18} fill={isFavorite ? "currentColor" : "none"} aria-hidden="true" />
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => onSelectModule(tile.id)}
                    className="min-h-16 w-full text-left rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                  >
                    <span className="block font-bold text-base text-[#041632] dark:text-white">{getTileTitle(tile)}</span>
                    <span className="mt-1 block text-sm leading-snug text-[#64748b] dark:text-slate-300">{getTileSubtitle(tile)}</span>
                  </button>
                </article>
              );
            })}
          </div>
        </section>
      )}

      {/* Quick actions remain available by click and keyboard; expand to see the full shortcut set. */}
      {!searchTerm && quickActions.length > 0 && (
        <section className="bg-white dark:bg-slate-900 border border-[#e2e8f0] dark:border-slate-800 rounded-2xl p-4 shadow-xs space-y-3" aria-labelledby="launchpad-quick-actions-heading">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 id="launchpad-quick-actions-heading" className="text-base font-bold text-[#041632] dark:text-white">
                Common tasks
              </h2>
              <p className="text-sm text-[#64748b] dark:text-slate-400">Quick actions with optional keyboard shortcuts.</p>
            </div>
            {quickActions.length > 5 && (
              <button
                type="button"
                onClick={() => setShowAllQuickActions((showAll) => !showAll)}
                aria-expanded={showAllQuickActions}
                aria-controls="launchpad-quick-actions"
                className="min-h-10 rounded-lg px-3 text-sm font-semibold text-blue-700 hover:bg-blue-50 dark:text-blue-300 dark:hover:bg-slate-800"
              >
                {showAllQuickActions ? "Show fewer" : `Show all ${quickActions.length} quick actions`}
              </button>
            )}
          </div>

          <div id="launchpad-quick-actions" className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
            {visibleQuickActions.map((qa) => {
              const style = getQuickActionStyle(qa);
              return (
                <button
                  key={`qa-${qa.id}`}
                  type="button"
                  onClick={() => onSelectModule(qa.id)}
                  aria-label={`Open ${getTileTitle(qa)}${qa.shortcut ? `, shortcut ${qa.shortcut}` : ""}`}
                  className={`relative min-h-28 p-3.5 bg-[#f8fafc] dark:bg-slate-800/80 ${style.bg} border border-[#e2e8f0] dark:border-slate-700/80 rounded-xl flex flex-col items-center justify-center text-center gap-2 transition-all duration-200 group cursor-pointer shadow-xs hover:-translate-y-1 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600`}
                >
                  {/* Hotkey Tag Badge */}
                  {qa.shortcut && (
                    <span className="absolute top-2 right-2 font-mono text-xs font-extrabold px-1.5 py-0.5 rounded shadow-2xs border border-black/10 bg-white/90 dark:bg-slate-900/90 text-[#041632] dark:text-white group-hover:bg-white/20 group-hover:text-white group-hover:border-white/30 transition-colors">
                      {qa.shortcut}
                    </span>
                  )}

                  <div className={`w-11 h-11 rounded-xl ${style.iconBg} flex items-center justify-center transition-all duration-200 shadow-xs group-hover:scale-105`}>
                    <span className="material-symbols-outlined text-[24px]">{qa.icon}</span>
                  </div>

                  <span className="text-sm font-bold font-display line-clamp-2 text-[#041632] dark:text-slate-100 group-hover:text-white transition-colors">
                    {getTileTitle(qa)}
                  </span>

                  <span className={`text-xs font-mono px-2 py-0.5 rounded-full border ${style.badge} group-hover:bg-white/20 group-hover:text-white group-hover:border-white/30 transition-colors`}>
                    {qa.tag || "Quick"}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* 3. Grouped Workspace Cards */}
      {groups.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-[#e2e8f0] dark:border-slate-800 rounded-2xl p-12 text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 mx-auto flex items-center justify-center">
            <Search size={24} />
          </div>
          <h3 className="font-bold text-base text-[#041632] dark:text-white">No workspaces match "{searchTerm}"</h3>
          <p className="text-sm text-[#64748b] dark:text-slate-400">Try a task or workspace name, such as “sell”, “receive stock”, or “barcode”.</p>
          <button
            type="button"
            onClick={() => setSearchTerm("")}
            className="min-h-11 px-4 py-2 bg-[#041632] dark:bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-[#1b2b48] dark:hover:bg-blue-700 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
          >
            Clear search
          </button>
        </div>
      ) : (
        groups.map((groupName) => {
          const tiles = filteredTiles.filter((t) => t.group === groupName);
          const accent = getGroupAccent(groupName);

          return (
            <section key={groupName} className="space-y-3">
              {/* Category Section Header */}
              <div className="flex items-center justify-between border-b border-[#e2e8f0] dark:border-slate-800 pb-2">
                <h2 className="text-base font-bold text-[#041632] dark:text-white flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${accent.dot}`} />
                  <span>{groupName}</span>
                </h2>
                <span className="text-sm text-[#64748b] dark:text-slate-400 bg-white dark:bg-slate-900 border border-[#e2e8f0] dark:border-slate-800 px-2 py-0.5 rounded-full font-semibold shadow-2xs">
                  {tiles.length} {tiles.length === 1 ? "Workspace" : "Workspaces"}
                </span>
              </div>

              {/* Grid of Elevated Workspace Tiles */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
                {tiles.map((tile) => {
                  const isFavorite = isTileFavorite(tile);
                  return (
                    <article
                      key={tile.id}
                      className={`group bg-white dark:bg-slate-900 hover:bg-[#f8fafc] dark:hover:bg-slate-800 border border-[#e2e8f0] dark:border-slate-800 ${accent.border} ${accent.hoverBorder} rounded-xl p-4 transition-all duration-200 hover:shadow-md hover:-translate-y-1 flex flex-col gap-3 relative overflow-hidden`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className={`w-10 h-10 rounded-xl ${accent.iconBg} group-hover:scale-105 flex items-center justify-center transition-all duration-200 shadow-2xs shrink-0 border border-black/5`}>
                          <span className="material-symbols-outlined text-[22px]" aria-hidden="true">{tile.icon}</span>
                        </div>

                        <div className="flex items-center gap-1">
                          {tile.tag && (
                            <span className={`text-xs font-semibold px-2 py-1 rounded-full border ${accent.badge}`}>
                              {tile.tag}
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => toggleTileFavorite(tile)}
                            aria-label={`${isFavorite ? "Remove" : "Pin"} ${getTileTitle(tile)} ${isFavorite ? "from" : "to"} your workspaces`}
                            aria-pressed={isFavorite}
                            title={isFavorite ? "Remove from pinned workspaces" : "Pin workspace"}
                            className="min-h-10 min-w-10 inline-flex items-center justify-center rounded-lg text-amber-700 hover:bg-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 dark:text-amber-300 dark:hover:bg-slate-700"
                          >
                            <Star size={18} fill={isFavorite ? "currentColor" : "none"} aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            onClick={() => popOutExternalWindow(tile.id, tile.title, tile.icon)}
                            aria-label={`Open ${getTileTitle(tile)} in a separate window`}
                            title={`Open ${tile.title} in a separate window`}
                            className="min-h-10 min-w-10 inline-flex items-center justify-center rounded-lg text-[#64748b] hover:text-[#041632] dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                          >
                            <ExternalLink size={16} aria-hidden="true" />
                          </button>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => onSelectModule(tile.id)}
                        className="w-full flex-1 text-left rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                      >
                        <span className="block font-bold text-base text-[#041632] dark:text-white group-hover:text-[#3e5f90] dark:group-hover:text-indigo-400 transition-colors font-display">
                          {getTileTitle(tile)}
                        </span>
                        <span className="block text-sm text-[#64748b] dark:text-slate-300 mt-1 leading-snug line-clamp-3">
                          {getTileSubtitle(tile)}
                        </span>
                        <span className={`mt-3.5 pt-2 border-t border-[#f1f5f9] dark:border-slate-800/80 flex items-center justify-between text-sm ${accent.arrow} font-semibold`}>
                          <span>Open workspace</span>
                          <span className="material-symbols-outlined text-[17px] group-hover:translate-x-1 transition-transform" aria-hidden="true">
                            arrow_forward
                          </span>
                        </span>
                      </button>
                    </article>
                  );
                })}
              </div>
            </section>
          );
        })
      )}

    </div>
  );
};

export default FioriLaunchpad;
