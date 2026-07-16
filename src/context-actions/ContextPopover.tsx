/**
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Organization : AITDL NETWORKS
 *
 * Founders
 *
 * * Pushpa Devi Jawahar Mallah
 *   * Founder & Chairperson
 *   * Phone: +91 9324117007
 *   * Email: founder@aitdl.com
 *
 * * Jawahar Ramkripal Mallah
 *   * Founder, Chief Executive Officer (CEO) & Chief Software Architect
 *   * Email: founder@aitdl.com
 *
 * * Websites: aitdl.com | erpnbook.com | smritibooks.com
 *
 * * Version    : 2.1.1
 * * Created    : 2026-07-10
 * * Modified   : 2026-07-11
 * * Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
 * * License    : Proprietary Commercial Software
 */

import React, { useRef, useState, useEffect } from "react";
import { motion } from "motion/react";
import { useACAS } from "./ContextProvider.tsx";
import { Star, Pin, Search, Sparkles, SlidersHorizontal, Keyboard } from "lucide-react";

interface ContextPopoverProps {
  onClose: () => void;
}

export const ContextPopover: React.FC<ContextPopoverProps> = ({ onClose }) => {
  const { state, actions, setSearchQuery, toggleFavorite, togglePin, setDensity, executeAction } = useACAS();
  const popoverRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  // Filter actions based on search
  const filteredActions = actions.filter(action =>
    action.label.toLowerCase().includes(state.searchQuery.toLowerCase()) ||
    (action.description && action.description.toLowerCase().includes(state.searchQuery.toLowerCase())) ||
    (action.category && action.category.toLowerCase().includes(state.searchQuery.toLowerCase()))
  );

  // Reset active keyboard focus index on query change
  useEffect(() => {
    setActiveIndex(0);
  }, [state.searchQuery]);

  // Autofocus the search input on opening
  useEffect(() => {
    if (searchRef.current) {
      searchRef.current.focus();
    }
  }, []);

  // Keyboard navigation handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex(prev => (filteredActions.length > 0 ? (prev + 1) % filteredActions.length : 0));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex(prev => (filteredActions.length > 0 ? (prev - 1 + filteredActions.length) % filteredActions.length : 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (filteredActions[activeIndex]) {
          executeAction(filteredActions[activeIndex]);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [filteredActions, activeIndex, onClose, executeAction]);

  // Handle clicking outside of context menu popover
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    window.addEventListener("mousedown", handleClickOutside);
    return () => window.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  if (!state.isOpen || !state.context) return null;

  const isComfortable = state.density === "comfortable";

  return (
    <div className="fixed inset-0 z-50 pointer-events-none">
      <motion.div
        ref={popoverRef}
        initial={{ opacity: 0, scale: 0.95, y: -5 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: -5 }}
        transition={{ duration: 0.08 }}
        style={{
          top: state.position.y,
          left: state.position.x,
        }}
        className="absolute pointer-events-auto w-[290px] bg-theme-surface-1 border border-theme-divider rounded-xl shadow-2xl overflow-hidden focus:outline-none flex flex-col"
        role="menu"
        aria-label="Adaptive Context Action Menu"
      >
        {/* Context Information & Quick Header */}
        <div className="px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900/60 border-b border-theme-divider flex items-center justify-between">
          <div className="overflow-hidden">
            <div className="text-[11px] font-semibold text-slate-800 dark:text-slate-200 uppercase tracking-wider truncate">
              {state.context.type} Operations
            </div>
            <div className="text-[9px] text-slate-400 font-mono flex items-center gap-1 mt-0.5">
              <span>{state.context.module}</span>
              <span>•</span>
              <span>{state.context.role || "Operator"}</span>
            </div>
          </div>
          {/* Density Toggle Button */}
          <button
            onClick={() => setDensity(isComfortable ? "compact" : "comfortable")}
            className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 transition"
            title="Toggle compact/comfortable density"
          >
            <SlidersHorizontal size={12} />
          </button>
        </div>

        {/* Dynamic Interactive Search */}
        <div className="p-2 border-b border-theme-divider/60">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 text-slate-400" size={13} />
            <input
              ref={searchRef}
              type="text"
              placeholder="Search actions..."
              value={state.searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-200/50 dark:border-slate-700/80 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder-slate-400"
            />
          </div>
        </div>

        {/* Menu Items Container */}
        <div className="max-h-[300px] overflow-y-auto py-1 scrollbar-thin">
          {filteredActions.length > 0 ? (
            filteredActions.map((action, idx) => {
              const isSelected = idx === activeIndex;
              const isFav = action.isFavorite;
              const isPin = action.isPinned;
              const isRecommended = action.isAiRecommended;

              return (
                <div
                  key={action.id}
                  className={`group relative flex items-center justify-between px-3 transition-colors ${
                    isComfortable ? "py-2" : "py-1.5"
                  } ${
                    isSelected
                      ? "bg-blue-500 text-white"
                      : isRecommended
                      ? "bg-amber-500/5 hover:bg-amber-500/10"
                      : "hover:bg-slate-100 dark:hover:bg-slate-800/60"
                  }`}
                  role="menuitem"
                  aria-disabled={typeof action.disabled === "function" ? action.disabled(state.context!) : !!action.disabled}
                >
                  <button
                    onClick={() => executeAction(action)}
                    className="flex-1 flex items-center gap-2.5 text-left focus:outline-none overflow-hidden"
                  >
                    <span
                      className={`text-[18px] material-symbols-outlined flex-shrink-0 ${
                        isSelected
                          ? "text-white"
                          : isRecommended
                          ? "text-amber-500 animate-pulse"
                          : "text-slate-400 dark:text-slate-500 group-hover:text-slate-600"
                      }`}
                    >
                      {action.icon}
                    </span>
                    <div className="overflow-hidden flex flex-col justify-center">
                      <div className="flex items-center gap-1">
                        <span
                          className={`text-xs font-medium truncate ${
                            isSelected
                              ? "text-white"
                              : isRecommended
                              ? "text-amber-800 dark:text-amber-300"
                              : "text-slate-700 dark:text-slate-200"
                          }`}
                        >
                          {action.label}
                        </span>
                        {isRecommended && (
                          <Sparkles size={8} className="text-amber-500 fill-amber-500 animate-pulse" />
                        )}
                      </div>
                      {isComfortable && action.description && (
                        <span
                          className={`text-[9px] truncate ${
                            isSelected ? "text-blue-100" : "text-slate-400 dark:text-slate-500"
                          }`}
                        >
                          {action.description}
                        </span>
                      )}
                    </div>
                  </button>

                  {/* Hotkeys / Actions Actions */}
                  <div className="flex items-center gap-1 ml-2 flex-shrink-0">
                    {/* Render shortcut indicator */}
                    {action.shortcut && !isSelected && (
                      <span className="text-[9px] font-mono border border-slate-200 dark:border-slate-800 rounded px-1 py-0.5 bg-slate-50 dark:bg-slate-900/80 text-slate-400">
                        {action.shortcut}
                      </span>
                    )}

                    {/* Quick Add Pin/Fav hover triggers */}
                    <div
                      className={`flex items-center gap-0.5 transition-opacity duration-150 ${
                        isFav || isPin ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                      }`}
                    >
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          toggleFavorite(action.id);
                        }}
                        className={`p-1 rounded hover:bg-slate-200/50 dark:hover:bg-slate-700/50 transition ${
                          isFav
                            ? "text-yellow-500"
                            : isSelected
                            ? "text-blue-200 hover:text-white"
                            : "text-slate-300 dark:text-slate-600 hover:text-slate-500"
                        }`}
                        title="Add to Favorites"
                      >
                        <Star size={11} className={isFav ? "fill-yellow-500" : ""} />
                      </button>
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          togglePin(action.id);
                        }}
                        className={`p-1 rounded hover:bg-slate-200/50 dark:hover:bg-slate-700/50 transition ${
                          isPin
                            ? "text-blue-400"
                            : isSelected
                            ? "text-blue-200 hover:text-white"
                            : "text-slate-300 dark:text-slate-600 hover:text-slate-500"
                        }`}
                        title="Pin this operation"
                      >
                        <Pin size={11} className={isPin ? "fill-blue-400" : ""} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="px-4 py-6 text-center text-slate-400 text-xs flex flex-col items-center gap-1">
              <Keyboard size={16} className="text-slate-300 dark:text-slate-700" />
              <span>No applicable actions matching query.</span>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};
