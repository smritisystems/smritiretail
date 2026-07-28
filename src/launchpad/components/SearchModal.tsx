/**
 * Project      : SMRITI Retail OS
 * Module       : Universal Search Modal (Ctrl+K)
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * Version      : 5.4.0
 */

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, X, ChevronRight, Package, Receipt, Users, Building, FileText, Settings } from "lucide-react";
import { SearchProviderRegistry } from "../registry/SearchProviderRegistry.ts";
import { SearchResultItem } from "../types/launchpadTypes.ts";

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTab: (tabId: string) => void;
}

const ICON_MAP: Record<string, React.ElementType> = {
  Package,
  Receipt,
  Users,
  Building,
  FileText,
  Settings
};

export const SearchModal: React.FC<SearchModalProps> = ({
  isOpen,
  onClose,
  onSelectTab
}) => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (isOpen) onClose();
        else {
          setQuery("");
          setResults([]);
        }
      }
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    setSearching(true);
    const timeout = setTimeout(() => {
      SearchProviderRegistry.searchAll(query)
        .then(setResults)
        .finally(() => setSearching(false));
    }, 150);
    return () => clearTimeout(timeout);
  }, [query]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-start justify-center pt-20 p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: -10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: -10 }}
          className="w-full max-w-2xl bg-theme-surface-1 border border-theme-divider rounded-xl shadow-2xl overflow-hidden"
        >
          {/* Search Input Bar */}
          <div className="p-4 border-b border-theme-divider flex items-center gap-3">
            <Search className="w-5 h-5 text-[#0a6ed1]" />
            <input
              type="text"
              autoFocus
              placeholder="Search across SKUs, invoices, customers, suppliers, screens... (ESC to close)"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full bg-transparent text-sm text-theme-heading placeholder-theme-muted focus:outline-none"
            />
            <button
              onClick={onClose}
              className="p-1 rounded text-theme-muted hover:text-theme-heading"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Results Area */}
          <div className="max-h-96 overflow-y-auto p-4 space-y-2">
            {searching ? (
              <div className="p-8 text-center text-xs text-theme-muted font-mono">Searching providers...</div>
            ) : results.length === 0 ? (
              <div className="p-8 text-center text-xs text-theme-muted font-mono">
                {query.trim() ? `No items found matching "${query}".` : "Type a SKU, invoice number, or customer name..."}
              </div>
            ) : (
              results.map((res) => {
                const IconComp = ICON_MAP[res.iconName || "Package"] || Package;
                return (
                  <div
                    key={res.id}
                    onClick={() => {
                      onSelectTab(res.targetTab);
                      onClose();
                    }}
                    className="p-3 rounded-lg bg-theme-surface-2 hover:bg-theme-surface-hover border border-theme-divider hover:border-[#0a6ed1] flex items-center justify-between cursor-pointer transition-all shadow-xs group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded bg-theme-surface-1 border border-theme-divider text-[#0a6ed1]">
                        <IconComp className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-theme-heading group-hover:text-[#0a6ed1] transition-colors">
                          {res.title}
                        </h4>
                        <p className="text-[11px] text-theme-muted">{res.subtitle}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono uppercase bg-theme-surface-1 px-2 py-0.5 rounded text-theme-muted border border-theme-divider">
                        {res.category}
                      </span>
                      <ChevronRight className="w-4 h-4 text-theme-muted group-hover:text-[#0a6ed1] group-hover:translate-x-1 transition-all" />
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="p-3 border-t border-theme-divider bg-theme-surface-2 flex items-center justify-between text-[11px] font-mono text-theme-muted">
            <span>Use ↑ ↓ keys to navigate, ENTER to select</span>
            <span>ESC to dismiss</span>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
