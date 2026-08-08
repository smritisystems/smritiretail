/**
 * Project      : SMRITI Retail OS
 * Module       : Zone C â€” Favorites Bar Component
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Copyright    : Â© SMRITIBooks.com. All Rights Reserved.
 * Version      : 5.4.0
 */

import React from "react";
import { Star, ChevronRight } from "lucide-react";
import { ModuleRegistry } from "../registry/ModuleRegistry.ts";

interface FavoritesBarProps {
  favorites?: string[];
  onSelectTab: (tabId: string) => void;
}

export const FavoritesBar: React.FC<FavoritesBarProps> = ({
  favorites = ["pos", "sales", "item-master"],
  onSelectTab
}) => {
  const allModules = ModuleRegistry.getAll();
  const pinnedTiles = allModules.filter((m) => favorites.includes(m.targetTab));

  if (pinnedTiles.length === 0) return null;

  return (
    <div className="bg-theme-surface-1 border border-theme-divider p-3 rounded-lg shadow-xs flex items-center gap-3 overflow-x-auto scrollbar-none">
      <span className="text-xs font-bold text-theme-muted uppercase tracking-wider flex items-center gap-1.5 shrink-0 font-mono">
        <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" /> Favorites:
      </span>
      <div className="flex items-center gap-2 overflow-x-auto">
        {pinnedTiles.map((tile) => (
          <button
            key={tile.id}
            onClick={() => onSelectTab(tile.targetTab)}
            className="px-3 py-1.5 rounded-md bg-theme-surface-2 hover:bg-theme-surface-hover border border-theme-divider hover:border-[var(--c-seef-accent)] text-xs font-semibold text-theme-heading flex items-center gap-1.5 transition-all shrink-0 cursor-pointer shadow-xs"
          >
            <span>{tile.title}</span>
            <ChevronRight className="w-3.5 h-3.5 text-theme-muted" />
          </button>
        ))}
      </div>
    </div>
  );
};
