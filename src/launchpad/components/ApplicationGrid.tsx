/**
 * Project      : SMRITI Retail OS
 * Module       : Zone E â€” Application Grid Component (WNG-002 & Rule AI-001 Compliant)
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Copyright    : Â© SMRITIBooks.com. All Rights Reserved.
 * Version      : 5.4.0
 */

import React, { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import {
  ShoppingCart,
  Receipt,
  RotateCcw,
  Briefcase,
  Package,
  Users,
  Printer,
  FileText,
  DollarSign,
  TrendingUp,
  ShieldCheck,
  Bot,
  Brain,
  Settings,
  Grid,
  ChevronRight,
  Sparkles
} from "lucide-react";
import { ModuleRegistry } from "../registry/ModuleRegistry.ts";
import { CapabilityRegistry } from "../registry/CapabilityRegistry.ts";
import { LaunchpadTileManifest } from "../types/launchpadTypes.ts";

interface ApplicationGridProps {
  currentUser?: { role: string; name: string } | null;
  userPermissions?: string[];
  onSelectTab: (tabId: string) => void;
  searchQuery?: string;
}

const ICON_MAP: Record<string, React.ElementType> = {
  ShoppingCart,
  Receipt,
  RotateCcw,
  Briefcase,
  Package,
  Users,
  Printer,
  FileText,
  DollarSign,
  TrendingUp,
  ShieldCheck,
  Bot,
  Brain,
  Settings
};

export const ApplicationGrid: React.FC<ApplicationGridProps> = ({
  currentUser,
  userPermissions,
  onSelectTab,
  searchQuery
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const isAiEnabled = CapabilityRegistry.isEnabled("ai_advisory");

  const allManifests = ModuleRegistry.getAll();

  // WNG-002 & Rule AI-001 RBAC Filtering (Max 12 tiles cap, zero disabled tiles)
  const authorizedTiles = useMemo(() => {
    const isAdmin =
      currentUser?.role?.toLowerCase().includes("admin") ||
      currentUser?.role?.toLowerCase().includes("manager");

    const filtered = allManifests.filter((tile) => {
      // Rule AI-001: Filter out AI features if AI advisory is disabled
      if (tile.isAiFeature && !isAiEnabled) return false;

      if (isAdmin) return true;
      if (!userPermissions || userPermissions.length === 0) return true;
      return userPermissions.includes(tile.permissionScope);
    });

    return filtered.slice(0, 12);
  }, [currentUser, userPermissions, allManifests, isAiEnabled]);

  // Search & Category Filtering
  const displayedTiles = useMemo(() => {
    return authorizedTiles.filter((tile) => {
      const matchesSearch =
        !searchQuery ||
        tile.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tile.subtitle.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesCategory =
        selectedCategory === "ALL" || tile.category === selectedCategory;

      return matchesSearch && matchesCategory;
    });
  }, [authorizedTiles, searchQuery, selectedCategory]);

  const categories = ["ALL", "Operations", "Masters", "Analytics", "Administration"];

  const groupedTiles = useMemo(() => {
    const groups: Record<string, LaunchpadTileManifest[]> = {};
    displayedTiles.forEach((tile) => {
      if (!groups[tile.category]) {
        groups[tile.category] = [];
      }
      groups[tile.category].push(tile);
    });
    return groups;
  }, [displayedTiles]);

  return (
    <div className="space-y-4">
      {/* Category Pills Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-theme-surface-1 border border-theme-divider p-2 rounded-lg shadow-xs">
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-none">
          <span className="text-xs font-mono text-theme-muted px-2 flex items-center gap-1.5">
            <Grid className="w-3.5 h-3.5 text-[var(--c-seef-accent)]" /> Domains:
          </span>
          <div className="flex items-center gap-1 bg-theme-surface-2 p-1 rounded-md border border-theme-divider">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1 rounded text-xs font-bold transition-all cursor-pointer ${
                  selectedCategory === cat
                    ? "bg-[var(--c-seef-accent)] text-white shadow-xs"
                    : "text-theme-muted hover:bg-theme-surface-hover hover:text-theme-heading"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        <div className="text-[11px] font-mono text-theme-muted px-2 hidden sm:block">
          Governance WNG-002 Certified (Max 12 Active Apps)
        </div>
      </div>

      {/* Tiles Grid */}
      {displayedTiles.length === 0 ? (
        <div className="bg-theme-surface-1 border border-theme-divider rounded-lg p-12 text-center shadow-xs">
          <p className="text-theme-muted text-xs font-mono">
            No authorized applications found matching "{searchQuery}".
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.keys(groupedTiles).map((catName) => (
            <div key={catName} className="space-y-3">
              <div className="flex items-center justify-between border-b border-theme-divider pb-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-theme-muted flex items-center gap-2">
                  <span className="w-1.5 h-3.5 bg-[var(--c-seef-accent)] rounded-xs" />
                  {catName === "Operations" && "Operations & POS Transactions"}
                  {catName === "Masters" && "Master Data & Registry Hub"}
                  {catName === "Analytics" && "Analytics, Ledger & Reports"}
                  {catName === "Administration" && "Administration & System RBAC"}
                  {!["Operations", "Masters", "Analytics", "Administration"].includes(catName) && catName}
                </h3>
                <span className="text-[11px] font-mono text-theme-muted">
                  {groupedTiles[catName].length} {groupedTiles[catName].length === 1 ? "App" : "Apps"}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {groupedTiles[catName].map((tile, idx) => {
                  const Icon = ICON_MAP[tile.iconName] || Package;
                  return (
                    <motion.div
                      key={tile.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.15, delay: idx * 0.02 }}
                      onClick={() => onSelectTab(tile.targetTab)}
                      className="group relative cursor-pointer bg-theme-surface-1 hover:bg-theme-surface-2 border border-theme-divider hover:border-[var(--c-seef-accent)] rounded-lg p-4 transition-all duration-200 shadow-xs hover:shadow-md flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-start justify-between mb-3">
                          <div className="w-9 h-9 rounded-md bg-theme-surface-2 border border-theme-divider flex items-center justify-center text-[var(--c-seef-accent)] group-hover:scale-105 transition-transform duration-200">
                            <Icon className="w-5 h-5" />
                          </div>
                          {tile.badge && (
                            <span className="px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase rounded bg-[var(--c-seef-accent)]/10 text-[var(--c-seef-accent)] border border-[var(--c-seef-accent)]/30">
                              {tile.badge}
                            </span>
                          )}
                        </div>

                        <div>
                          <h4 className="text-sm font-bold text-theme-heading group-hover:text-[var(--c-seef-accent)] transition-colors flex items-center justify-between">
                            {tile.title}
                            <ChevronRight className="w-4 h-4 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all text-[var(--c-seef-accent)]" />
                          </h4>
                          <p className="text-xs text-theme-muted mt-1 line-clamp-2 leading-relaxed">
                            {tile.subtitle}
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 pt-2.5 border-t border-theme-divider flex items-center justify-between text-[10px] text-theme-muted font-mono">
                        <span className="font-semibold uppercase">{tile.category}</span>
                        <span>{tile.permissionScope}</span>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
