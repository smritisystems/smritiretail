/**
 * Project      : SMRITI Retail OS
 * Module       : UDCP — Universal Command Palette Presentation UI (Ctrl+K)
 * Standard     : UDCP-001 through UDCP-007 (FROZEN)
 * Author       : Jawahar Ramkripal Mallah
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Version      : 1.0.0
 *
 * UDCP-001: Component is presentation-only. It consumes SPK.udcp for all search & execution.
 * UDCP-004: F2 key on any highlighted entity result triggers SPK.ucif.inspect().
 *
 * Keyboard shortcuts inside palette:
 *   Ctrl+K / Cmd+K  → Open / Close palette
 *   ↑ / ↓           → Navigate search results
 *   Enter           → Execute selected result (SPK.udcp.executeResult)
 *   F2              → Inspect selected result via UCIF (SPK.ucif.inspect)
 *   Esc             → Close palette
 */

import React, { useState, useEffect, useRef, useCallback } from "react";
import type { DiscoveryResult, DiscoveryResultType } from "../../kernel/upr/discovery/UDCPSchema.js";
import { SPK } from "../../kernel/SPK.js";
import { useDrillDown } from "../drilldown/drilldown_store.js";

const CATEGORY_TABS: Array<{ id: string; label: string; icon: string }> = [
  { id: "all", label: "All", icon: "sparkles" },
  { id: "navigation", label: "Workspaces", icon: "compass" },
  { id: "entity", label: "Records", icon: "database" },
  { id: "action", label: "Actions", icon: "zap" },
  { id: "report", label: "Reports", icon: "bar-chart" },
  { id: "ai", label: "Intelligence", icon: "auto_awesome" },
];

export const UniversalCommandPalette: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const [results, setResults] = useState<DiscoveryResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { openPanel } = useDrillDown();

  // Listen for Ctrl+K global keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Execute search through SPK.udcp
  const performSearch = useCallback(async (q: string) => {
    setLoading(true);
    try {
      const res = await SPK.udcp.search(q);
      setResults(res);
      setSelectedIndex(0);
    } catch (err) {
      console.error("[UDCP Palette] Search error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      performSearch(query);
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery("");
      setResults([]);
    }
  }, [isOpen, performSearch]);

  const handleQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    performSearch(val);
  };

  const filteredResults = results.filter((r) => {
    if (activeCategory === "all") return true;
    return r.type === activeCategory;
  });

  const handleSelectResult = (result: DiscoveryResult) => {
    SPK.udcp.executeResult(result);
    setIsOpen(false);
  };

  const handleInspectResult = (result: DiscoveryResult) => {
    if (result.entityType && result.entityId) {
      openPanel({
        entityType: result.entityType,
        entityId: result.entityId,
        title: result.title,
        metadata: { variant: "compact" },
      });
      SPK.udcp.inspectResult(result);
      setIsOpen(false);
    }
  };

  // Keyboard navigation within the command palette
  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, filteredResults.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === "Enter" && filteredResults[selectedIndex]) {
      e.preventDefault();
      handleSelectResult(filteredResults[selectedIndex]);
    } else if (e.key === "F2" && filteredResults[selectedIndex]) {
      e.preventDefault();
      handleInspectResult(filteredResults[selectedIndex]);
    } else if (e.key === "Escape") {
      setIsOpen(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={(e) => e.target === e.currentTarget && setIsOpen(false)}
    >
      <div className="w-full max-w-2xl bg-theme-surface-1 border border-theme-divider rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[75vh]">
        {/* Search Input Bar */}
        <div className="flex items-center px-4 py-3 border-b border-theme-divider bg-theme-surface-2 gap-3">
          <span className="material-symbols-outlined text-theme-muted text-xl">search</span>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={handleQueryChange}
            onKeyDown={handleInputKeyDown}
            placeholder="Type a command, search entity, or ask AI... (Ctrl+K)"
            className="flex-1 bg-transparent text-theme-text text-sm font-medium focus:outline-none placeholder:text-theme-muted/60"
          />
          {loading && (
            <span className="material-symbols-outlined text-theme-accent text-lg animate-spin">sync</span>
          )}
          <span className="text-xs px-2 py-1 bg-theme-surface-1 border border-theme-divider rounded text-theme-muted">
            Esc to close
          </span>
        </div>

        {/* Category Tabs */}
        <div className="flex items-center px-4 py-1.5 border-b border-theme-divider/60 bg-theme-surface-1 gap-1 overflow-x-auto">
          {CATEGORY_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveCategory(tab.id)}
              className={`
                px-2.5 py-1 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap
                ${activeCategory === tab.id
                  ? "bg-theme-accent/15 text-theme-accent font-semibold"
                  : "text-theme-muted hover:text-theme-text hover:bg-theme-surface-2"
                }
              `}
            >
              <span className="material-symbols-outlined text-sm">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Results List */}
        <div className="flex-1 overflow-y-auto py-2">
          {filteredResults.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-theme-muted gap-2">
              <span className="material-symbols-outlined text-3xl">search_off</span>
              <p className="text-sm">No results found for "{query}"</p>
              <p className="text-xs text-theme-muted/60">Try searching for a customer name, item SKU, invoice #, or command</p>
            </div>
          ) : (
            filteredResults.map((result, idx) => (
              <div
                key={result.id}
                onClick={() => handleSelectResult(result)}
                onMouseEnter={() => setSelectedIndex(idx)}
                className={`
                  flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors
                  ${idx === selectedIndex
                    ? "bg-theme-accent/10 border-l-2 border-theme-accent"
                    : "border-l-2 border-transparent hover:bg-theme-surface-2/60"
                  }
                `}
              >
                {/* Result Icon */}
                <span className="w-8 h-8 rounded-lg bg-theme-surface-2 border border-theme-divider flex items-center justify-center text-sm flex-shrink-0">
                  {result.icon ?? "🔹"}
                </span>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-theme-text truncate">{result.title}</p>
                    {result.badge && (
                      <span className="px-1.5 py-0.5 text-[10px] bg-theme-accent/10 text-theme-accent rounded uppercase flex-shrink-0">
                        {result.badge}
                      </span>
                    )}
                  </div>
                  {result.subtitle && (
                    <p className="text-xs text-theme-muted truncate mt-0.5">{result.subtitle}</p>
                  )}
                </div>

                {/* Score / Quick Action Hints */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  {result.entityType && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleInspectResult(result);
                      }}
                      className="px-2 py-0.5 text-[11px] bg-theme-surface-2 border border-theme-divider text-theme-muted hover:text-theme-text rounded flex items-center gap-1 transition-colors"
                      title="Inspect context via UCIF (F2)"
                    >
                      <span className="font-semibold text-theme-accent">F2</span> Inspect
                    </button>
                  )}
                  <span className="text-xs text-theme-muted/50 font-mono">
                    {result.score}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer Navigation Bar */}
        <div className="px-4 py-2 border-t border-theme-divider bg-theme-surface-2 flex items-center justify-between text-xs text-theme-muted">
          <div className="flex gap-4">
            <span><kbd className="px-1 bg-theme-surface-1 border border-theme-divider rounded text-[10px]">↑↓</kbd> Navigate</span>
            <span><kbd className="px-1 bg-theme-surface-1 border border-theme-divider rounded text-[10px]">Enter</kbd> Execute</span>
            <span><kbd className="px-1 bg-theme-surface-1 border border-theme-divider rounded text-[10px]">F2</kbd> UCIF 360° Inspect</span>
          </div>
          <span>SMRITI UDCP v1.0</span>
        </div>
      </div>
    </div>
  );
};
