/**
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Organization : AITDL NETWORKS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.70.0
 * Created      : 2026-10-08
 * Modified     : 2026-10-08
 * Copyright    : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: SMRITI Core System Lookups & Master Directory Standard
 */

import React, { useState, useMemo } from "react";
import {
  Sparkles,
  X,
  Search,
  Check,
  CheckCircle2,
  AlertCircle,
  Plus,
  Layers,
  ArrowRight,
  Database,
  Filter
} from "lucide-react";
import {
  StandardLookupPreset,
  getLookupRecommendations,
  getMissingRecommendations,
} from "./lookupStandardPresets.ts";

export interface LookupRecommendModalProps {
  isOpen: boolean;
  onClose: () => void;
  typeCode: string;
  typeLabel?: string;
  existingItems: Array<{ code?: string; name?: string; [key: string]: any }>;
  onCommit: (selectedPresets: StandardLookupPreset[]) => Promise<void>;
}

export const LookupRecommendModal: React.FC<LookupRecommendModalProps> = ({
  isOpen,
  onClose,
  typeCode,
  typeLabel,
  existingItems = [],
  onCommit,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCodes, setSelectedCodes] = useState<Set<string>>(new Set());
  const [isCommitting, setIsCommitting] = useState(false);
  const [filterMode, setFilterMode] = useState<"ALL" | "MISSING_ONLY" | "ALREADY_REGISTERED">("MISSING_ONLY");

  const allPresets = useMemo(() => getLookupRecommendations(typeCode), [typeCode]);

  const existingCodeSet = useMemo(() => {
    return new Set(
      existingItems
        .map((item) => String(item.code || "").trim().toUpperCase())
        .filter(Boolean)
    );
  }, [existingItems]);

  const existingNameSet = useMemo(() => {
    return new Set(
      existingItems
        .map((item) => String(item.name || "").trim().toUpperCase())
        .filter(Boolean)
    );
  }, [existingItems]);

  const missingPresets = useMemo(() => {
    return allPresets.filter(
      (p) => !existingCodeSet.has(p.code.toUpperCase()) && !existingNameSet.has(p.name.toUpperCase())
    );
  }, [allPresets, existingCodeSet, existingNameSet]);

  // Initial auto-selection of all missing presets upon opening
  React.useEffect(() => {
    if (isOpen) {
      const initialMissing = new Set(missingPresets.map((p) => p.code));
      setSelectedCodes(initialMissing);
      setSearchQuery("");
      setFilterMode("MISSING_ONLY");
    }
  }, [isOpen, missingPresets]);

  const filteredPresets = useMemo(() => {
    return allPresets.filter((preset) => {
      const isRegistered =
        existingCodeSet.has(preset.code.toUpperCase()) ||
        existingNameSet.has(preset.name.toUpperCase());

      if (filterMode === "MISSING_ONLY" && isRegistered) return false;
      if (filterMode === "ALREADY_REGISTERED" && !isRegistered) return false;

      if (!searchQuery.trim()) return true;
      const query = searchQuery.toLowerCase().trim();
      return (
        preset.code.toLowerCase().includes(query) ||
        preset.name.toLowerCase().includes(query) ||
        (preset.description && preset.description.toLowerCase().includes(query))
      );
    });
  }, [allPresets, existingCodeSet, existingNameSet, filterMode, searchQuery]);

  if (!isOpen) return null;

  const toggleSelect = (code: string) => {
    setSelectedCodes((prev) => {
      const next = new Set(prev);
      if (next.has(code)) {
        next.delete(code);
      } else {
        next.add(code);
      }
      return next;
    });
  };

  const selectAllMissing = () => {
    const next = new Set<string>();
    missingPresets.forEach((p) => next.add(p.code));
    setSelectedCodes(next);
  };

  const clearSelection = () => {
    setSelectedCodes(new Set());
  };

  const handleApply = async () => {
    const selectedList = allPresets.filter((p) => selectedCodes.has(p.code));
    if (selectedList.length === 0) return;

    setIsCommitting(true);
    try {
      await onCommit(selectedList);
      onClose();
    } finally {
      setIsCommitting(false);
    }
  };

  const displayTitle = typeLabel || typeCode.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-theme-surface border border-theme-divider rounded-2xl shadow-2xl flex flex-col overflow-hidden text-theme-primary">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-theme-divider bg-theme-surface-2/60">
          <div className="flex items-center space-x-3.5">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-amber-500/20 to-indigo-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
              <Sparkles size={22} className="animate-pulse" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-base font-bold text-theme-primary tracking-tight">
                  Recommended Standard Master Values
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  {displayTitle}
                </span>
              </div>
              <p className="text-xs text-theme-muted mt-0.5">
                Pre-configured retail and ERP reference standards. Select industry values to instantly register them into System Lookups.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-theme-muted hover:text-theme-primary hover:bg-theme-surface-hover border border-transparent hover:border-theme-divider transition-all cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Stats and Filter Bar */}
        <div className="p-4 border-b border-theme-divider bg-theme-surface/40 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center space-x-2">
            <div className="relative min-w-[240px]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-theme-muted" />
              <input
                type="text"
                placeholder="Search standard presets..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-theme-surface-2 border border-theme-divider rounded-xl text-theme-primary placeholder-theme-muted focus:outline-none focus:border-blue-500 transition-all font-mono"
              />
            </div>

            <div className="flex items-center bg-theme-surface-2 p-0.5 rounded-xl border border-theme-divider text-[11px] font-medium">
              <button
                type="button"
                onClick={() => setFilterMode("MISSING_ONLY")}
                className={`px-2.5 py-1 rounded-lg transition-all ${
                  filterMode === "MISSING_ONLY"
                    ? "bg-blue-600 text-white font-bold shadow-sm"
                    : "text-theme-muted hover:text-theme-primary"
                }`}
              >
                Missing ({missingPresets.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterMode("ALL")}
                className={`px-2.5 py-1 rounded-lg transition-all ${
                  filterMode === "ALL"
                    ? "bg-blue-600 text-white font-bold shadow-sm"
                    : "text-theme-muted hover:text-theme-primary"
                }`}
              >
                All Available ({allPresets.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterMode("ALREADY_REGISTERED")}
                className={`px-2.5 py-1 rounded-lg transition-all ${
                  filterMode === "ALREADY_REGISTERED"
                    ? "bg-blue-600 text-white font-bold shadow-sm"
                    : "text-theme-muted hover:text-theme-primary"
                }`}
              >
                Already Live ({allPresets.length - missingPresets.length})
              </button>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={selectAllMissing}
              disabled={missingPresets.length === 0}
              className="px-2.5 py-1.5 rounded-xl bg-theme-surface-2 hover:bg-theme-surface-hover text-theme-primary border border-theme-divider text-[11px] font-bold font-mono transition-all cursor-pointer disabled:opacity-40"
            >
              Select All Missing
            </button>
            <button
              type="button"
              onClick={clearSelection}
              disabled={selectedCodes.size === 0}
              className="px-2.5 py-1.5 rounded-xl bg-theme-surface-2 hover:bg-theme-surface-hover text-theme-muted hover:text-theme-primary border border-theme-divider text-[11px] font-mono transition-all cursor-pointer disabled:opacity-40"
            >
              Clear
            </button>
          </div>
        </div>

        {/* Presets List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {filteredPresets.length === 0 ? (
            <div className="py-16 text-center text-theme-muted">
              <Database size={36} className="mx-auto mb-3 opacity-30 text-blue-400" />
              <p className="text-sm font-bold text-theme-primary">No preset recommendations matching criteria</p>
              <p className="text-xs text-theme-muted mt-1">
                {allPresets.length === 0
                  ? `No standard presets are registered for '${typeCode}'. You can use 'Import & Paste' to bulk ingest custom CSV or Excel tables.`
                  : "Try clearing your search query or switching filter mode."}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {filteredPresets.map((preset) => {
                const isRegistered =
                  existingCodeSet.has(preset.code.toUpperCase()) ||
                  existingNameSet.has(preset.name.toUpperCase());
                const isSelected = selectedCodes.has(preset.code);

                return (
                  <div
                    key={preset.code}
                    onClick={() => {
                      if (!isRegistered) toggleSelect(preset.code);
                    }}
                    className={`p-3.5 rounded-xl border transition-all text-left flex items-start space-x-3 select-none ${
                      isRegistered
                        ? "bg-theme-surface-2/30 border-theme-divider/50 opacity-60 cursor-not-allowed"
                        : isSelected
                        ? "bg-blue-500/10 border-blue-500/40 shadow-sm cursor-pointer hover:border-blue-500/60"
                        : "bg-theme-surface-2/70 border-theme-divider hover:border-theme-divider/80 hover:bg-theme-surface-2 cursor-pointer"
                    }`}
                  >
                    <div className="pt-0.5 shrink-0">
                      <div
                        className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${
                          isRegistered
                            ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-400"
                            : isSelected
                            ? "bg-blue-600 border-blue-600 text-white"
                            : "border-theme-divider bg-theme-surface"
                        }`}
                      >
                        {isRegistered ? (
                          <Check size={11} strokeWidth={3} />
                        ) : isSelected ? (
                          <Check size={11} strokeWidth={3} />
                        ) : null}
                      </div>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-xs text-theme-primary truncate">
                          {preset.name}
                        </span>
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-theme-surface border border-theme-divider text-theme-muted shrink-0">
                          {preset.code}
                        </span>
                      </div>

                      {preset.description && (
                        <p className="text-[11px] text-theme-muted mt-1 leading-relaxed line-clamp-2">
                          {preset.description}
                        </p>
                      )}

                      {preset.values && preset.values.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {preset.values.slice(0, 6).map((val) => (
                            <span
                              key={val}
                              className="px-1.5 py-0.2 rounded text-[9px] font-mono bg-blue-500/10 text-blue-400 border border-blue-500/20"
                            >
                              {val}
                            </span>
                          ))}
                          {preset.values.length > 6 && (
                            <span className="text-[9px] font-mono text-theme-muted self-center">
                              +{preset.values.length - 6} more
                            </span>
                          )}
                        </div>
                      )}

                      <div className="mt-2 flex items-center justify-between text-[10px]">
                        {isRegistered ? (
                          <span className="inline-flex items-center space-x-1 text-emerald-400 font-bold font-mono">
                            <CheckCircle2 size={11} />
                            <span>Already in System</span>
                          </span>
                        ) : isSelected ? (
                          <span className="text-blue-400 font-bold font-mono">
                            Ready to Ingest
                          </span>
                        ) : (
                          <span className="text-theme-muted font-mono">
                            Click to select
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-theme-divider bg-theme-surface-2/60 flex items-center justify-between">
          <div className="text-xs text-theme-muted">
            <span className="font-bold text-theme-primary font-mono">{selectedCodes.size}</span> item(s) selected for ingestion
          </div>

          <div className="flex items-center space-x-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isCommitting}
              className="px-4 py-2 rounded-xl bg-theme-surface-2 hover:bg-theme-surface-hover text-theme-primary border border-theme-divider text-xs font-bold transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleApply}
              disabled={selectedCodes.size === 0 || isCommitting}
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-blue-500/20 flex items-center space-x-2 transition-all cursor-pointer disabled:opacity-40"
            >
              {isCommitting ? (
                <span>Ingesting Presets...</span>
              ) : (
                <>
                  <Sparkles size={14} />
                  <span>Apply & Ingest ({selectedCodes.size})</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
