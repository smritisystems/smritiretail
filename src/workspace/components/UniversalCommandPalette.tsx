/**
 * Project      : SMRITI Retail OS
 * Module       : SMRITI Universal Command Palette (Ctrl+K) (ADR-UX-003 Compliant)
 * Standard     : ADR-UX-003 — SMRITI Workspace Shell Architecture
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 */

import React, { useState, useEffect } from "react";
import { Search, X, Command, ArrowRight, Zap } from "lucide-react";
import { workspaceShellController } from "../controllers/WorkspaceShellController";
import { CommandPaletteProviderItem } from "../types/workspace.types";

interface UniversalCommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

export const UniversalCommandPalette: React.FC<UniversalCommandPaletteProps> = ({ isOpen, onClose }) => {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    setQuery("");
    setSelectedIndex(0);
  }, [isOpen]);

  if (!isOpen) return null;

  const items = workspaceShellController.getCommandItems();
  const filtered = items.filter((item) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return (
      item.title.toLowerCase().includes(q) ||
      item.category.toLowerCase().includes(q) ||
      (item.subtitle && item.subtitle.toLowerCase().includes(q)) ||
      (item.keywords && item.keywords.some((k) => k.toLowerCase().includes(q)))
    );
  });

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      onClose();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, filtered.length));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filtered.length) % Math.max(1, filtered.length));
    } else if (e.key === "Enter" && filtered[selectedIndex]) {
      e.preventDefault();
      filtered[selectedIndex].action();
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-start justify-center pt-20 px-4 animate-in fade-in duration-200">
      <div
        className="w-full max-w-2xl bg-theme-surface-1 border border-theme-divider rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh] text-theme-body font-sans"
        onKeyDown={handleKeyDown}
      >
        {/* Command Search Input Bar */}
        <div className="flex items-center px-4 py-3.5 border-b border-theme-divider gap-3 bg-theme-surface-2/40">
          <Search size={18} className="text-theme-muted shrink-0" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder="Type a command, module name, or route (e.g. Sales, POS, Items)..."
            className="flex-1 bg-transparent text-sm text-theme-heading placeholder:text-theme-muted outline-none border-none"
          />
          <kbd className="px-2 py-0.5 text-[10px] font-mono font-bold rounded bg-theme-surface-2 border border-theme-divider text-theme-muted shrink-0">
            ESC to cancel
          </kbd>
          <button onClick={onClose} className="p-1 rounded-lg text-theme-muted hover:text-theme-body cursor-pointer">
            <X size={16} />
          </button>
        </div>

        {/* Command Items List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1 smriti-hide-scrollbar">
          {filtered.length === 0 ? (
            <div className="py-12 text-center text-xs text-theme-muted">
              No matching commands or actions found for &quot;{query}&quot;
            </div>
          ) : (
            filtered.map((item, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <div
                  key={item.id}
                  onClick={() => {
                    item.action();
                    onClose();
                  }}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl cursor-pointer transition-all text-xs ${
                    isSelected
                      ? "bg-theme-surface-2 text-theme-heading border border-[var(--c-seef-accent)]/40 shadow-xs"
                      : "text-theme-muted hover:text-theme-body hover:bg-theme-surface-2/50 border border-transparent"
                  }`}
                >
                  <div className="flex items-center gap-3 overflow-hidden">
                    <div className="p-2 rounded-lg bg-white/5 border border-white/10 text-theme-heading shrink-0">
                      <Zap size={14} className="text-[var(--c-seef-accent)]" />
                    </div>
                    <div className="overflow-hidden">
                      <div className="font-semibold text-theme-heading truncate">{item.title}</div>
                      {item.subtitle && <div className="text-[11px] text-theme-muted truncate">{item.subtitle}</div>}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-white/10 border border-white/10 text-theme-muted">
                      {item.category}
                    </span>
                    <ArrowRight size={14} className={`transition-transform ${isSelected ? "translate-x-1 text-theme-heading" : "opacity-0"}`} />
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer Guidance */}
        <div className="px-4 py-2 border-t border-theme-divider bg-theme-surface-2/20 flex items-center justify-between text-[11px] text-theme-muted">
          <div className="flex items-center gap-3">
            <span>
              <kbd className="px-1.5 py-0.5 rounded bg-theme-surface-2 border border-theme-divider">↑</kbd>{" "}
              <kbd className="px-1.5 py-0.5 rounded bg-theme-surface-2 border border-theme-divider">↓</kbd> Navigate
            </span>
            <span>
              <kbd className="px-1.5 py-0.5 rounded bg-theme-surface-2 border border-theme-divider">↵</kbd> Execute
            </span>
          </div>
          <div className="font-mono text-[10px]">SMRITI SWS v1.0 Command Engine</div>
        </div>
      </div>
    </div>
  );
};
