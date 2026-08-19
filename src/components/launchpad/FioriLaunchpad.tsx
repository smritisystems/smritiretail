/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.16.0
 * Created      : 2026-08-16
 * Modified     : 2026-08-19
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 */

import React, { useMemo } from "react";
import { ExternalLink } from "lucide-react";
import { useWorkspace } from "../../contexts/WorkspaceContext.tsx";

export interface FioriLaunchpadProps {
  currentUser?: { role: string; name: string } | null;
  onSelectModule: (moduleId: string) => void;
}

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

export const FioriLaunchpad: React.FC<FioriLaunchpadProps> = ({ currentUser, onSelectModule }) => {
  const { popOutExternalWindow } = useWorkspace();
  
  const userRole = (currentUser?.role || "SYSADMIN").toUpperCase().trim();
  const isSysAdmin = userRole === "SYSADMIN" || userRole === "SYSTEM ADMIN" || userRole === "ADMIN";
  const isManager = userRole === "MANAGER" || userRole === "STORE MANAGER" || isSysAdmin;

  // Filter tiles based on current user role
  const visibleTiles = useMemo(() => {
    return LAUNCHPAD_CATALOG.filter((tile) => {
      if (!tile.roles || isSysAdmin) return true;
      return tile.roles.some((r) => r.toUpperCase() === userRole || (r === "MANAGER" && isManager));
    });
  }, [userRole, isSysAdmin, isManager]);

  const quickActions = useMemo(() => {
    return visibleTiles.filter((t) => t.isQuickAction);
  }, [visibleTiles]);

  const groups = useMemo(() => {
    return Array.from(new Set(visibleTiles.map((t) => t.group)));
  }, [visibleTiles]);

  return (
    <div className="flex-1 bg-theme-surface-1 overflow-y-auto p-4 md:p-6 space-y-6 select-none custom-scrollbar">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-indigo-800 text-white p-6 rounded-2xl shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 border border-indigo-500/20">
        <div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight font-display">
            SMRITI Retail OS Launchpad
          </h1>
          <p className="text-xs md:text-sm text-indigo-100 mt-1 max-w-xl">
            Unified operational launcher and workspace director for enterprise retail workflows.
          </p>
        </div>

        {/* System Summary Badge Box */}
        <div className="flex items-center gap-3 bg-white/10 p-3 rounded-xl backdrop-blur-xs border border-white/20 self-start md:self-auto font-mono">
          <div className="text-center px-3 border-r border-white/20">
            <div className="text-indigo-200 uppercase font-semibold text-[10px]">Workspaces</div>
            <div className="text-base font-bold text-white">{visibleTiles.length}</div>
          </div>
          <div className="text-center px-3 border-r border-white/20">
            <div className="text-indigo-200 uppercase font-semibold text-[10px]">Role</div>
            <div className="text-base font-bold text-emerald-300 font-sans">{currentUser?.role || "Admin"}</div>
          </div>
          <div className="text-center px-3">
            <div className="text-indigo-200 uppercase font-semibold text-[10px]">Architecture</div>
            <div className="text-base font-bold text-white">FastAPI + PG</div>
          </div>
        </div>
      </div>

      {/* Mobile / Touch Terminal Quick Action Primary Row */}
      {quickActions.length > 0 && (
        <div className="bg-theme-surface-2 border border-theme-divider rounded-2xl p-4 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold font-mono uppercase tracking-wider text-theme-primary">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Primary Quick Actions (Mobile / Touch Bar)</span>
            </div>
            <span className="text-[10px] text-theme-muted font-mono">1-Tap Rapid Switch</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
            {quickActions.map((qa) => (
              <button
                key={`qa-${qa.id}`}
                type="button"
                onClick={() => onSelectModule(qa.id)}
                className="p-3.5 bg-theme-surface-1 hover:bg-blue-600 hover:text-white border border-theme-divider hover:border-blue-500 rounded-xl flex flex-col items-center justify-center text-center gap-2 transition-all group cursor-pointer shadow-xs"
              >
                <div className="w-9 h-9 rounded-lg bg-blue-500/10 group-hover:bg-white/20 text-blue-400 group-hover:text-white flex items-center justify-center transition-colors">
                  <span className="material-symbols-outlined text-[20px]">{qa.icon}</span>
                </div>
                <span className="text-xs font-bold font-display line-clamp-1 group-hover:text-white text-theme-primary">{qa.title}</span>
                <span className="text-[10px] text-theme-muted group-hover:text-blue-100 font-mono">{qa.tag || "Quick"}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Grouped Tiles */}
      {groups.map((groupName) => {
        const tiles = visibleTiles.filter((t) => t.group === groupName);

        return (
          <section key={groupName} className="space-y-3">
            <div className="flex items-center justify-between border-b border-theme-divider pb-2">
              <h2 className="text-xs font-bold text-theme-primary uppercase tracking-wider flex items-center gap-2 font-mono">
                <span className="w-2 h-2 rounded-full bg-blue-500" />
                <span>{groupName}</span>
              </h2>
              <span className="text-[11px] text-theme-muted font-mono">{tiles.length} Workspaces</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
              {tiles.map((tile) => (
                <button
                  key={tile.id}
                  type="button"
                  onClick={() => onSelectModule(tile.id)}
                  className="group bg-theme-surface-2 hover:bg-theme-surface-hover border border-theme-divider hover:border-blue-500 rounded-xl p-4 text-left transition-all duration-200 hover:shadow-md flex flex-col justify-between cursor-pointer relative overflow-hidden"
                >
                  {/* Subtle Top Accent */}
                  <div className="absolute top-0 left-0 right-0 h-0.5 bg-blue-500 opacity-0 group-hover:opacity-100 transition-opacity" />

                  <div>
                    {/* Icon & Tag Header */}
                    <div className="flex items-start justify-between gap-2 mb-2.5">
                      <div className="w-9 h-9 rounded-lg bg-blue-500/10 group-hover:bg-blue-600 text-blue-400 group-hover:text-white flex items-center justify-center transition-colors shadow-xs shrink-0 border border-blue-500/20">
                        <span className="material-symbols-outlined text-[20px]">{tile.icon}</span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <span
                          role="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            popOutExternalWindow(tile.id, tile.title, tile.icon);
                          }}
                          title={`Pop out ${tile.title} into external window`}
                          className="p-1 rounded-md text-theme-muted hover:text-blue-400 hover:bg-blue-500/10 transition-colors cursor-pointer"
                        >
                          <ExternalLink size={12} />
                        </span>

                        {tile.tag && (
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full font-mono border ${
                              tile.badgeType === "success"
                                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                                : tile.badgeType === "warning"
                                ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                                : "bg-blue-500/10 text-blue-400 border-blue-500/20"
                            }`}
                          >
                            {tile.tag}
                          </span>
                        )}
                      </div>
                    </div>

                    <h3 className="font-bold text-sm text-theme-primary group-hover:text-blue-400 transition-colors mt-1 font-display">
                      {tile.title}
                    </h3>
                    <p className="text-xs text-theme-muted mt-1 leading-snug line-clamp-2">
                      {tile.subtitle}
                    </p>
                  </div>

                  {/* Tile Footer Link Indicator */}
                  <div className="mt-3.5 pt-2 border-t border-theme-divider flex items-center justify-between text-[11px] text-blue-400 font-semibold group-hover:translate-x-0.5 transition-transform font-mono">
                    <span>Open Workspace</span>
                    <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                  </div>
                </button>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
};
