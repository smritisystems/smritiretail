/**
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Organization : AITDL NETWORKS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.32.0
 * Created      : 2026-07-10
 * Modified     : 2026-08-21
 * Copyright    : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 */

/**
 * GlobalSearch — Context-Aware Search Modal (Ctrl+K)
 * =====================================================
 * Refactored to use:
 *   - FieldContextRegistry  : centralised column/fetcher config per entity type
 *   - GlobalSearchService   : debounced, cached search with AbortController
 *   - FlexibleContextGrid   : single reusable grid replacing duplicated table markup
 *
 * The active field context (from ActiveFieldContext) automatically pre-selects
 * the correct entity tab and pre-populates the search query.
 *
 * Keyboard:
 *   Ctrl+K  — open
 *   ESC     — close
 *   ↑ / ↓  — navigate rows
 *   Enter   — select row
 */

import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useDrillDown } from "./drilldown_store.tsx";
import { useActiveField } from "../../context/ActiveFieldContext.tsx";
import { SmritiScrollArea } from "../SmritiScrollArea.tsx";
import {
  EntityContextType,
  getContextDescriptor,
  getEntityTabs,
} from "../../services/globalContext/fieldContext.ts";
import {
  useGlobalSearch,
  SearchResult,
} from "../../services/globalContext/GlobalSearchService.ts";
import { FlexContextGrid, FlexibleGridFooter } from "../common/FlexContextGrid.tsx";

// Re-export prewarm from the registry so callers don't need an extra import
function prewarm(t: EntityContextType) {
  const descriptor = getContextDescriptor(t);
  descriptor.fetcher("").catch(() => {});
}

// ─────────────────────────────────────────────────────────────────────────────
// Inner search panel (separate component to isolate hook calls per context)
// ─────────────────────────────────────────────────────────────────────────────

interface SearchPanelProps {
  contextType: EntityContextType;
  query: string;
  selectedIndex: number;
  onSelectIndex: (i: number) => void;
  onSelectRow: (row: any) => void;
}

const SearchPanel: React.FC<SearchPanelProps> = ({
  contextType,
  query,
  selectedIndex,
  onSelectIndex,
  onSelectRow,
}) => {
  const descriptor = getContextDescriptor(contextType);
  const { results, isLoading } = useGlobalSearch(contextType, query);

  return (
    <FlexContextGrid
      columns={descriptor.columns}
      results={results}
      isLoading={isLoading}
      selectedIndex={selectedIndex}
      onSelectIndex={onSelectIndex}
      onSelectRow={onSelectRow}
      handleKeys={false} /* parent modal handles key events */
      emptyMessage={
        query.trim()
          ? `No ${descriptor.label} records match "${query}". Try different keywords.`
          : `Type to search ${descriptor.label}.`
      }
    />
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Main GlobalSearch Component
// ─────────────────────────────────────────────────────────────────────────────

export const GlobalSearch: React.FC = () => {
  const { searchOpen, setSearchOpen, openPanel, pushContext } = useDrillDown();
  const {
    category: activeCategory,
    fieldLabel,
    fieldValue,
    insertValueIntoActiveField,
  } = useActiveField();

  const [query, setQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<EntityContextType>("general");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const allTabs = getEntityTabs();

  // Sync category & query with active field context on open
  useEffect(() => {
    if (searchOpen) {
      const cat = activeCategory as EntityContextType;
      setSelectedCategory(cat !== "general" ? cat : "product");
      if (fieldValue && fieldValue.length >= 1) {
        setQuery(fieldValue);
      } else {
        setQuery("");
      }
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 80);

      // Pre-warm the active context for instant results
      prewarm(cat !== "general" ? cat : "product");
    }
  }, [searchOpen, activeCategory, fieldValue]);

  // Reset selection when query or category changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query, selectedCategory]);

  // Global keyboard shortcut (Ctrl+K to open)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const token = typeof window !== "undefined" ? (localStorage.getItem("smriti_jwt_token") || localStorage.getItem("smriti_session_token")) : null;
      if (!token) return;

      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen(!searchOpen);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [searchOpen, setSearchOpen]);

  // ESC to close
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSearchOpen(false);
    };
    if (searchOpen) window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [searchOpen, setSearchOpen]);

  const descriptor = getContextDescriptor(selectedCategory);

  // Build results for current selection (used by footer + key handler)
  // The actual data display is done by SearchPanel which calls useGlobalSearch
  // We need a local copy for footer count and keyboard confirm — so we track it
  const [currentResults, setCurrentResults] = useState<SearchResult[]>([]);
  const [currentLoading, setCurrentLoading] = useState(false);

  // Row selection handlers
  const handleSelectRow = useCallback(
    (row: any) => {
      if (selectedCategory === "menu" || row?._entityType === "Menu") {
        window.dispatchEvent(new CustomEvent("smriti_navigate_module", {
          detail: { moduleId: row.id, title: row.title },
        }));
        setSearchOpen(false);
        return;
      }
      // 1. Always inject the appropriate value into the active input field
      const insertKey = descriptor.insertValueKeys.find((k) => row[k]) ?? "name";
      const valueToInsert = row[insertKey] || row.name || row.code || row.id || "";
      insertValueIntoActiveField(valueToInsert);

      // 2. For products and customers, also push a drill-down context panel
      if (selectedCategory === "product" || selectedCategory === "customer") {
        const context = {
          entityType: selectedCategory === "product" ? ("item" as const) : ("customer" as const),
          entityId: row.id,
          title: row.name || row.invoice_number || row.code || String(row.id),
          metadata: row,
        };
        openPanel(context);
        pushContext(context);
      }

      setSearchOpen(false);
    },
    [descriptor, selectedCategory, insertValueIntoActiveField, openPanel, pushContext, setSearchOpen]
  );

  const handleConfirm = useCallback(() => {
    if (currentResults[selectedIndex]) {
      handleSelectRow(currentResults[selectedIndex].data);
    }
  }, [currentResults, selectedIndex, handleSelectRow]);

  // Keyboard navigation within modal
  const handleModalKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, currentResults.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      handleConfirm();
    }
  };

  const token = typeof window !== "undefined" ? (localStorage.getItem("smriti_jwt_token") || localStorage.getItem("smriti_session_token")) : null;
  if (!searchOpen || !token) return null;

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-[100] flex items-start justify-center pt-[5vh] px-4"
        onKeyDown={handleModalKeyDown}
      >
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.65 }}
          exit={{ opacity: 0 }}
          onClick={() => setSearchOpen(false)}
          className="fixed inset-0 bg-black/70 backdrop-blur-sm"
        />

        {/* Modal Shell */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: -20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: -20 }}
          className="relative w-full max-w-5xl bg-white border border-[#c5c5d4] shadow-2xl rounded-2xl overflow-hidden font-sans flex flex-col"
          style={{ maxHeight: "88vh" }}
        >
          {/* ── Header ──────────────────────────────────────────────────────── */}
          <div className="bg-[#00296d] text-white px-5 py-3.5 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2.5">
              <span className="material-symbols-outlined text-[22px] text-indigo-200">
                {descriptor.icon}
              </span>
              <div>
                <h2 className="text-sm font-bold tracking-wide flex items-center gap-2">
                  SMRITI Context Search
                  <span className="text-[10px] font-mono bg-white/15 text-indigo-100 px-2 py-0.5 rounded-full border border-white/20">
                    Cursor: {fieldLabel}
                  </span>
                </h2>
                <p className="text-[11px] text-indigo-200 mt-0.5">{descriptor.description}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono bg-white/10 text-indigo-100 px-2 py-1 rounded border border-white/20">
                ESC to close
              </span>
            </div>
          </div>

          {/* ── Search Input ─────────────────────────────────────────────────── */}
          <div className="flex items-center px-5 py-3 border-b border-[#e1e2ec] bg-[#f8f9ff] shrink-0 gap-3">
            <span className="material-symbols-outlined text-[#565975] text-[22px]">search</span>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={descriptor.searchPlaceholder}
              className="flex-1 bg-transparent border-none text-[#0b1c30] text-sm font-medium focus:outline-none placeholder:text-[#8d90a5]"
            />
            {query && (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setSelectedIndex(0);
                }}
                className="p-1 text-[#565975] hover:text-[#0b1c30] rounded-full"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            )}
          </div>

          {/* ── Context / Entity Tabs ────────────────────────────────────────── */}
          <div className="flex items-center gap-1.5 px-4 py-2 bg-[#f0f2fa] border-b border-[#e1e2ec] overflow-x-auto shrink-0 select-none">
            {/* "All" tab */}
            <button
              type="button"
              onClick={() => setSelectedCategory("general")}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all shrink-0 ${
                selectedCategory === "general"
                  ? "bg-[#00296d] text-white shadow-sm"
                  : "bg-white text-[#44475b] hover:bg-indigo-50 border border-[#c5c5d4]/60"
              }`}
            >
              <span className="material-symbols-outlined text-[15px]">hub</span>
              All
            </button>

            {/* Entity-specific tabs */}
            {allTabs.map((tab) => {
              const isSelected = selectedCategory === tab.entityType;
              const isCursorActive = activeCategory === tab.entityType;
              return (
                <button
                  key={tab.entityType}
                  type="button"
                  onClick={() => {
                    setSelectedCategory(tab.entityType);
                    prewarm(tab.entityType);
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all shrink-0 ${
                    isSelected
                      ? "bg-[#00296d] text-white shadow-sm"
                      : "bg-white text-[#44475b] hover:bg-indigo-50 border border-[#c5c5d4]/60"
                  }`}
                >
                  <span className="material-symbols-outlined text-[15px]">{tab.icon}</span>
                  <span>{tab.label}</span>
                  {isCursorActive && (
                    <span
                      className={`w-2 h-2 rounded-full animate-pulse ${
                        isSelected ? "bg-emerald-400" : "bg-[#00296d]"
                      }`}
                    />
                  )}
                </button>
              );
            })}
          </div>

          {/* ── Results Grid ─────────────────────────────────────────────────── */}
          <div className="flex-1 overflow-hidden flex flex-col">
            <SearchPanelConnected
              contextType={selectedCategory}
              query={query}
              selectedIndex={selectedIndex}
              onSelectIndex={setSelectedIndex}
              onSelectRow={handleSelectRow}
              onResultsChange={(r, loading) => {
                setCurrentResults(r);
                setCurrentLoading(loading);
              }}
            />
          </div>

          {/* ── Footer ───────────────────────────────────────────────────────── */}
          <FlexibleGridFooter
            totalResults={currentResults.length}
            isLoading={currentLoading}
            selectedIndex={selectedIndex}
            onConfirm={handleConfirm}
            onCancel={() => setSearchOpen(false)}
            confirmLabel={
              selectedCategory === "customer"
                ? "Select Customer"
                : selectedCategory === "product"
                ? "Add to Bill"
                : "Select"
            }
          />
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Bridge component — wraps SearchPanel + exposes results to parent via callback
// ─────────────────────────────────────────────────────────────────────────────

interface SearchPanelConnectedProps extends SearchPanelProps {
  onResultsChange: (results: SearchResult[], isLoading: boolean) => void;
}

const SearchPanelConnected: React.FC<SearchPanelConnectedProps> = ({
  contextType,
  query,
  selectedIndex,
  onSelectIndex,
  onSelectRow,
  onResultsChange,
}) => {
  const descriptor = getContextDescriptor(contextType);
  const { results, isLoading } = useGlobalSearch(contextType, query);

  // Propagate results to parent for footer count & keyboard Enter handling
  useEffect(() => {
    onResultsChange(results, isLoading);
  }, [results, isLoading]);

  return (
    <FlexContextGrid
      columns={descriptor.columns}
      results={results}
      isLoading={isLoading}
      selectedIndex={selectedIndex}
      onSelectIndex={onSelectIndex}
      onSelectRow={onSelectRow}
      handleKeys={false}
      emptyMessage={
        query.trim()
          ? `No ${descriptor.label} records match "${query}". Try different keywords.`
          : `Type to search ${descriptor.label}.`
      }
    />
  );
};
