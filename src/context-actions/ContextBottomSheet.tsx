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
 * * Websites: smritisys.com | aitdl.com | erpnbook.com | smritibooks.com
 *
 * * Version    : 2.1.1
 * * Created    : 2026-07-10
 * * Modified   : 2026-07-11
 * * Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
 * * License    : Proprietary Commercial Software
 */

import React, { useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useACAS } from "./ContextProvider.tsx";
import { Star, Pin, Search, Sparkles, Check, X, ShieldAlert, Zap } from "lucide-react";

interface ContextBottomSheetProps {
  onClose: () => void;
}

export const ContextBottomSheet: React.FC<ContextBottomSheetProps> = ({ onClose }) => {
  const { state, actions, setSearchQuery, toggleFavorite, togglePin, executeAction } = useACAS();
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  if (!state.isOpen || !state.context) return null;

  // Group actions by category
  const filteredActions = actions.filter(action =>
    action.label.toLowerCase().includes(state.searchQuery.toLowerCase()) ||
    (action.description && action.description.toLowerCase().includes(state.searchQuery.toLowerCase())) ||
    (action.category && action.category.toLowerCase().includes(state.searchQuery.toLowerCase()))
  );

  // Divide into groups: AI Promoted, Favorites/Pinned, Other categories
  const aiRecommended = filteredActions.filter(a => a.isAiRecommended);
  const regularActions = filteredActions.filter(a => !a.isAiRecommended);

  // Keyboard navigation on bottom sheets is supported by focus states
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm">
      {/* Click outside backdrop to dismiss */}
      <div className="absolute inset-0" onClick={onClose} />

      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 25, stiffness: 220 }}
        drag="y"
        dragConstraints={{ top: 0 }}
        dragElastic={0.2}
        onDragEnd={(e, info) => {
          if (info.velocity.y > 150 || info.offset.y > 150) {
            onClose();
          }
        }}
        className="relative w-full max-w-md bg-theme-surface-1 border-t border-theme-divider rounded-t-3xl shadow-2xl overflow-hidden focus:outline-none"
        style={{ touchAction: "none" }}
        role="dialog"
        aria-modal="true"
        aria-label="Adaptive Context Actions"
      >
        {/* Swipe drag handlebar handle */}
        <div className="flex justify-center py-3">
          <div className="w-12 h-1.5 rounded-full bg-theme-muted cursor-grab active:cursor-grabbing" />
        </div>

        {/* Header containing title and metadata */}
        <div className="px-5 pb-3 border-b border-theme-divider flex justify-between items-center">
          <div>
            <h2 className="text-base font-semibold text-theme-primary flex items-center gap-1.5">
              <span>{state.context.type.toUpperCase()} Operations</span>
              <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 bg-theme-surface-2 rounded text-theme-muted">
                {state.context.module}
              </span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Role: {state.context.role || "Operator"} | Selected Count: {state.context.count || 1}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full bg-theme-surface-2 hover:bg-theme-surface-3 text-theme-muted hover:text-theme-primary transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Action search bar */}
        <div className="p-4 border-b border-theme-divider/60">
          <div className="relative">
            <Search className="absolute left-3 top-3 text-slate-400" size={16} />
            <input
              ref={searchRef}
              type="text"
              placeholder="Search responsive context actions..."
              value={state.searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-theme-surface-2 border border-theme-divider rounded-xl pl-9 pr-4 py-2.5 text-sm text-theme-primary focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-theme-muted"
            />
          </div>
        </div>

        {/* Scrollable action container */}
        <div className="max-h-[50vh] overflow-y-auto px-4 pb-8 space-y-4 pt-2">
          {/* AI Recommended Section */}
          {aiRecommended.length > 0 && (
            <div>
              <div className="text-[11px] font-semibold text-amber-500 uppercase tracking-wider mb-2 flex items-center gap-1 pl-1">
                <Sparkles size={12} className="animate-pulse text-amber-500" />
                <span>AI Recommended Actions</span>
              </div>
              <div className="space-y-1.5">
                {aiRecommended.map(action => (
                  <button
                    key={action.id}
                    onClick={() => executeAction(action)}
                    className="w-full flex items-center justify-between p-3.5 bg-amber-500/10 hover:bg-amber-500/20 active:bg-amber-500/30 border border-amber-500/20 rounded-xl transition text-left focus:outline-none focus:ring-2 focus:ring-amber-500 group"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xl text-amber-600 material-symbols-outlined">
                        {action.icon}
                      </span>
                      <div>
                        <div className="text-sm font-medium text-amber-800 flex items-center gap-1.5">
                          {action.label}
                          <Zap size={10} className="fill-amber-500 text-amber-500" />
                        </div>
                        {action.description && (
                          <div className="text-[11px] text-amber-700/70 mt-0.5 leading-relaxed">
                            {action.description}
                          </div>
                        )}
                      </div>
                    </div>
                    <ChevronRightIcon />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Regular Actions Section */}
          {regularActions.length > 0 && (
            <div>
              <div className="text-[11px] font-semibold text-theme-muted uppercase tracking-wider mb-2 pl-1">
                Standard Operations
              </div>
              <div className="space-y-1.5">
                {regularActions.map(action => {
                  const isFav = action.isFavorite;
                  const isPin = action.isPinned;

                  return (
                    <div
                      key={action.id}
                      className="w-full flex items-center justify-between bg-theme-surface-2 hover:bg-theme-surface-3 rounded-xl transition overflow-hidden border border-theme-divider"
                    >
                      <button
                        onClick={() => executeAction(action)}
                        className="flex-1 flex items-center gap-3 p-3.5 text-left focus:outline-none"
                      >
                        <span className="text-xl text-theme-muted material-symbols-outlined">
                          {action.icon}
                        </span>
                        <div>
                          <div className="text-sm font-medium text-theme-primary">
                            {action.label}
                          </div>
                          {action.description && (
                            <div className="text-[11px] text-theme-muted mt-0.5 leading-relaxed">
                              {action.description}
                            </div>
                          )}
                        </div>
                      </button>

                      {/* Side buttons for pin / fav */}
                      <div className="flex items-center gap-1 pr-3 border-l border-theme-divider pl-2">
                        <button
                          onClick={() => toggleFavorite(action.id)}
                          className={`p-2 rounded-lg transition ${
                            isFav ? "text-yellow-500" : "text-theme-muted hover:text-theme-primary"
                          }`}
                          title="Favorite"
                        >
                          <Star size={14} className={isFav ? "fill-yellow-500" : ""} />
                        </button>
                        <button
                          onClick={() => togglePin(action.id)}
                          className={`p-2 rounded-lg transition ${
                            isPin ? "text-blue-500" : "text-theme-muted hover:text-theme-primary"
                          }`}
                          title="Pin Action"
                        >
                          <Pin size={14} className={isPin ? "fill-blue-500" : ""} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Empty state */}
          {filteredActions.length === 0 && (
            <div className="py-8 text-center text-slate-400 text-sm flex flex-col items-center justify-center gap-2">
              <ShieldAlert size={28} className="text-theme-muted" />
              <span>No applicable context actions found.</span>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};

const ChevronRightIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 20 20"
    fill="currentColor"
    className="w-5 h-5 text-theme-muted group-hover:translate-x-1 transition-transform"
  >
    <path
      fillRule="evenodd"
      d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
      clipRule="evenodd"
    />
  </svg>
);
