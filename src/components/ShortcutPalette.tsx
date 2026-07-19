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

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Keyboard, Search, X, Edit2, Check, RotateCcw, Shield, User, Play, 
  AlertTriangle, Save, HelpCircle, ArrowRight, CornerDownLeft
} from "lucide-react";
import { useShortcuts, KeyboardShortcut, ShortcutKeyConfig } from "../contexts/ShortcutContext.tsx";
import { SmritiScrollArea } from "./SmritiScrollArea.tsx";

const AVAILABLE_ROLES = [
  "Admin",
  "Shop Owner",
  "Cashier",
  "Warehouse Staff",
  "Purchase Executive",
  "Sales Executive",
  "Store Manager",
  "Branch Manager",
  "Distributor",
  "Franchise Owner",
  "Accountant (Operational)"
];

export const ShortcutPalette: React.FC = () => {
  const {
    shortcuts,
    activeRole,
    isAdmin,
    paletteOpen,
    setPaletteOpen,
    setActiveRole,
    setIsAdmin,
    updateShortcut,
    resetToDefaults,
    resetToOrgDefaults,
    saveAsOrgDefaults,
    orgDefaultsExist
  } = useShortcuts();

  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<"All" | "Global" | "Navigation" | "Quick Access" | "Floating Window">("All");
  const [selectedRoleFilter, setSelectedRoleFilter] = useState<string>("All");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [recordingKey, setRecordingKey] = useState<ShortcutKeyConfig | null>(null);
  const [conflictMsg, setConflictMsg] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Close when Esc is pressed
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (editingId) {
          cancelEdit();
        } else {
          setPaletteOpen(false);
        }
      }
    };
    if (paletteOpen) {
      window.addEventListener("keydown", handleEsc);
      setTimeout(() => searchInputRef.current?.focus(), 150);
    }
    return () => window.removeEventListener("keydown", handleEsc);
  }, [paletteOpen, editingId]);

  // Record Key Handler
  useEffect(() => {
    if (!editingId) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const key = e.key;
      // Filter out raw modifier-only presses
      if (["control", "alt", "shift", "meta"].includes(key.toLowerCase())) {
        return;
      }

      // Safe check to avoid using browser-reserved keys
      const reservedKeys = ["f5", "f11", "escape", "enter", "tab", "backspace"];
      if (reservedKeys.includes(key.toLowerCase())) {
        return;
      }

      const isCtrl = e.ctrlKey || e.metaKey;
      const isAlt = e.altKey;
      const isShift = e.shiftKey;

      // Ensure at least one modifier is pressed for global keys, except for special functional characters
      if (!isCtrl && !isAlt && !isShift && key !== "Escape" && key !== "Enter") {
        setConflictMsg("Please use at least one modifier key (Alt, Ctrl, or Shift) to prevent native text-input conflicts.");
        return;
      }

      // Check browser defaults warning
      if (isCtrl && ["k", "l", "t", "n", "w", "r", "p", "f", "h", "j", "d", "s", "o"].includes(key.toLowerCase())) {
        setConflictMsg(`Ctrl + ${key.toUpperCase()} is reserved by the browser. Please use an Alt-based shortcut!`);
        return;
      }

      const newConfig: ShortcutKeyConfig = {
        key: key === " " ? "Space" : key,
        ctrl: isCtrl,
        alt: isAlt,
        shift: isShift,
        meta: false
      };

      setRecordingKey(newConfig);

      // Perform a preliminary conflict check
      const matched = shortcuts.find(
        (s) =>
          s.id !== editingId &&
          s.currentKey.key.toLowerCase() === newConfig.key.toLowerCase() &&
          s.currentKey.ctrl === newConfig.ctrl &&
          s.currentKey.alt === newConfig.alt &&
          s.currentKey.shift === newConfig.shift
      );

      if (matched) {
        setConflictMsg(`Conflicts with "${matched.name}"`);
      } else {
        setConflictMsg(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [editingId, shortcuts]);

  const startEdit = (shortcut: KeyboardShortcut) => {
    setEditingId(shortcut.id);
    setRecordingKey(shortcut.currentKey);
    setConflictMsg(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setRecordingKey(null);
    setConflictMsg(null);
  };

  const saveEdit = () => {
    if (!editingId || !recordingKey) return;

    const res = updateShortcut(editingId, recordingKey);
    if (!res.success) {
      setConflictMsg(`Cannot save: Conflicts with "${res.conflictWith}"`);
      return;
    }

    setEditingId(null);
    setRecordingKey(null);
    setConflictMsg(null);
  };

  const getReadableKey = (config: ShortcutKeyConfig) => {
    const parts: string[] = [];
    if (config.ctrl) parts.push("Ctrl");
    if (config.alt) parts.push("Alt");
    if (config.shift) parts.push("Shift");
    parts.push(config.key === " " ? "Space" : config.key.toUpperCase());
    return parts.join(" + ");
  };

  // Filter shortcuts
  const filteredShortcuts = shortcuts.filter((s) => {
    const matchesSearch =
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.category.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesCategory = activeCategory === "All" || s.category === activeCategory;
    
    const matchesRole =
      selectedRoleFilter === "All" || s.roles.includes(selectedRoleFilter);

    return matchesSearch && matchesCategory && matchesRole;
  });

  return (
    <AnimatePresence>
      {paletteOpen && (
        <div className="fixed inset-0 z-[9999] flex items-start justify-center pt-[8vh] p-4 font-sans">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.6 }}
            exit={{ opacity: 0 }}
            onClick={() => setPaletteOpen(false)}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm"
          />

          {/* Dialog Body */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            transition={{ type: "spring", duration: 0.3 }}
            ref={containerRef}
            className="relative w-full max-w-4xl bg-theme-surface-1 border border-theme-divider shadow-2xl rounded-2xl overflow-hidden flex flex-col max-h-[84vh]"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-theme-divider/60 bg-theme-surface-2">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-xl">
                  <Keyboard size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white tracking-wide flex items-center">
                    SMRITI Command & Shortcuts Manager
                  </h3>
                  <p className="text-[10px] text-theme-muted font-mono mt-0.5">
                    Conflict-Free Hotkeys & Organization Command Palette
                  </p>
                </div>
              </div>
              <button
                onClick={() => setPaletteOpen(false)}
                className="p-1.5 rounded-lg hover:bg-theme-surface-3 text-theme-muted hover:text-white transition-all"
              >
                <X size={18} />
              </button>
            </div>

            {/* Quick Filters Panel */}
            <div className="px-6 py-3 bg-theme-surface-2/60 border-b border-theme-divider/40 flex flex-wrap gap-4 items-center justify-between text-xs">
              {/* Persona / Role Selector */}
              <div className="flex items-center space-x-2">
                <User size={13} className="text-theme-muted" />
                <span className="text-theme-muted font-semibold">Active Persona:</span>
                <select
                  value={activeRole}
                  onChange={(e) => setActiveRole(e.target.value)}
                  className="bg-theme-surface-3 border border-theme-divider rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500 font-medium cursor-pointer"
                >
                  {AVAILABLE_ROLES.map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </select>
              </div>

              {/* Admin Mode Controls */}
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => setIsAdmin(!isAdmin)}
                  className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all ${
                    isAdmin
                      ? "bg-indigo-600/20 border-indigo-500/40 text-indigo-400"
                      : "bg-theme-surface-3 border-theme-divider text-theme-muted hover:text-white"
                  }`}
                >
                  <Shield size={13} />
                  <span>{isAdmin ? "Admin Actions Enabled" : "Enable Admin Mode"}</span>
                </button>

                {isAdmin && (
                  <button
                    onClick={saveAsOrgDefaults}
                    className="flex items-center space-x-1.5 bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-lg text-xs font-semibold shadow-md transition-colors"
                    title="Propagate currently configured keys to entire enterprise as defaults"
                  >
                    <Save size={13} />
                    <span>Save as Org Default</span>
                  </button>
                )}
              </div>
            </div>

            {/* Main Action Bar */}
            <div className="px-6 py-4 flex flex-col md:flex-row gap-4 items-center bg-theme-surface-1 border-b border-theme-divider/40">
              {/* Search */}
              <div className="relative flex-1 w-full">
                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-theme-muted" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search shortcuts, categories, actions..."
                  className="w-full bg-theme-surface-2 border border-theme-divider rounded-xl pl-10 pr-4 py-2.5 text-xs text-theme-body placeholder-theme-muted focus:outline-none focus:border-indigo-500/80 transition-all font-medium"
                />
              </div>

              {/* Shortcut Role Filter */}
              <div className="flex items-center space-x-2 text-xs shrink-0">
                <span className="text-theme-muted">Role Filter:</span>
                <select
                  value={selectedRoleFilter}
                  onChange={(e) => setSelectedRoleFilter(e.target.value)}
                  className="bg-theme-surface-2 border border-theme-divider rounded-lg px-2.5 py-1.5 text-xs text-theme-body focus:outline-none"
                >
                  <option value="All">All Roles</option>
                  {AVAILABLE_ROLES.map((role) => (
                    <option key={`filter-${role}`} value={role}>
                      {role}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Categories tab-list */}
            <div className="px-6 py-2 bg-theme-surface-1 border-b border-theme-divider/20 flex gap-1.5 overflow-x-auto">
              {(["All", "Global", "Navigation", "Quick Access", "Floating Window"] as const).map((cat) => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold tracking-wide uppercase transition-all ${
                    activeCategory === cat
                      ? "bg-indigo-600 text-white font-bold"
                      : "text-theme-muted hover:text-white hover:bg-theme-surface-2"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* List Body */}
            <SmritiScrollArea className="flex-1 p-6">
              {filteredShortcuts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center text-theme-muted">
                  <Keyboard size={48} className="mb-4 opacity-30" />
                  <p className="text-sm font-medium">No commands or shortcuts found matching your filters.</p>
                  <p className="text-xs mt-1 opacity-70">Try broadening your search query or switching the category.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3">
                  {filteredShortcuts.map((shortcut) => {
                    const isEditing = editingId === shortcut.id;
                    const hasAccess = shortcut.roles.includes(activeRole);

                    return (
                      <div
                        key={shortcut.id}
                        className={`p-4 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 ${
                          isEditing
                            ? "bg-indigo-950/20 border-indigo-500/60 shadow-lg shadow-indigo-950/15"
                            : !hasAccess
                            ? "bg-theme-surface-2/40 border-theme-divider/45 opacity-60"
                            : "bg-theme-surface-2/65 hover:bg-theme-surface-2 border-theme-divider/50 hover:border-theme-divider"
                        }`}
                      >
                        {/* Information column */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2">
                            <span className="text-xs font-bold text-white tracking-wide">
                              {shortcut.name}
                            </span>
                            <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-theme-surface-3 text-theme-muted font-mono">
                              {shortcut.category}
                            </span>
                            {!hasAccess && (
                              <span className="text-[8px] font-bold uppercase px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20">
                                RESTRICTED
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-theme-muted mt-1 leading-relaxed">
                            {shortcut.description}
                          </p>
                          <div className="flex flex-wrap gap-1 mt-2.5">
                            {shortcut.roles.map((r) => (
                              <span
                                key={r}
                                className={`text-[8.5px] px-1.5 py-0.5 rounded font-medium ${
                                  r === activeRole
                                    ? "bg-indigo-500/15 text-indigo-300 font-bold border border-indigo-500/25"
                                    : "bg-theme-surface-3 text-theme-muted"
                                }`}
                              >
                                {r}
                              </span>
                            ))}
                          </div>
                        </div>

                        {/* Interactive Key config column */}
                        <div className="flex items-center gap-3 self-end sm:self-center shrink-0">
                          {isEditing ? (
                            <div className="flex flex-col items-end gap-1.5">
                              {/* Recording mode box */}
                              <div className="bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 px-3 py-2 rounded-lg font-bold text-xs flex items-center space-x-2 animate-pulse font-mono">
                                <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-ping" />
                                <span>{recordingKey ? getReadableKey(recordingKey) : "Press Any Key Combo..."}</span>
                              </div>

                              {/* Alert details */}
                              {conflictMsg && (
                                <div className="text-[10px] text-amber-400 font-bold flex items-center space-x-1 max-w-[240px] text-right">
                                  <AlertTriangle size={11} className="shrink-0" />
                                  <span className="truncate">{conflictMsg}</span>
                                </div>
                              )}

                              {/* Action btns */}
                              <div className="flex items-center space-x-1.5 mt-1">
                                <button
                                  onClick={saveEdit}
                                  className="bg-indigo-600 hover:bg-indigo-500 text-white p-1.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-1"
                                  title="Apply New Shortcut"
                                >
                                  <Check size={13} />
                                  <span className="text-[10px] px-1">Apply</span>
                                </button>
                                <button
                                  onClick={cancelEdit}
                                  className="bg-theme-surface-3 hover:bg-theme-surface-hover border border-theme-divider text-theme-muted hover:text-white p-1.5 rounded-lg text-xs transition-all flex items-center space-x-1"
                                >
                                  <X size={13} />
                                  <span className="text-[10px] px-1">Cancel</span>
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              {/* Standard key view */}
                              <kbd className="px-3 py-1.5 rounded-lg bg-theme-surface-3 border border-theme-divider/70 text-theme-primary font-mono text-xs font-bold shadow-sm tracking-wider">
                                {getReadableKey(shortcut.currentKey)}
                              </kbd>

                              {/* Trigger Directly Button */}
                              {hasAccess && (
                                <button
                                  onClick={() => {
                                    setPaletteOpen(false);
                                    // Let matching listener handle action trigger asynchronously
                                    const customEvent = new KeyboardEvent("keydown", {
                                      key: shortcut.currentKey.key === "Space" ? " " : shortcut.currentKey.key,
                                      ctrlKey: shortcut.currentKey.ctrl,
                                      altKey: shortcut.currentKey.alt,
                                      shiftKey: shortcut.currentKey.shift,
                                      metaKey: shortcut.currentKey.meta,
                                      bubbles: true
                                    });
                                    window.dispatchEvent(customEvent);
                                  }}
                                  className="p-2 rounded-lg bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-400 hover:text-emerald-300 transition-colors border border-emerald-500/20"
                                  title="Run Command"
                                >
                                  <Play size={13} />
                                </button>
                              )}

                              {/* Customize Button */}
                              <button
                                onClick={() => startEdit(shortcut)}
                                className="p-2 rounded-lg bg-theme-surface-3 hover:bg-theme-surface-hover text-theme-muted hover:text-white transition-all border border-theme-divider/60 hover:border-theme-divider"
                                title="Edit Hotkey"
                              >
                                <Edit2 size={13} />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </SmritiScrollArea>

            {/* Footer Operations */}
            <div className="px-6 py-4 border-t border-theme-divider/60 bg-theme-surface-2/40 flex flex-col sm:flex-row gap-4 items-center justify-between text-xs text-theme-muted">
              {/* Resetters */}
              <div className="flex items-center gap-2.5">
                <button
                  onClick={resetToDefaults}
                  className="flex items-center space-x-1 hover:text-white transition-colors"
                  title="Restore factory default hotkey layout"
                >
                  <RotateCcw size={12} />
                  <span>Reset to Factory Defaults</span>
                </button>

                {orgDefaultsExist && (
                  <button
                    onClick={resetToOrgDefaults}
                    className="flex items-center space-x-1 text-indigo-400 hover:text-indigo-300 transition-colors"
                    title="Load organization default configurations"
                  >
                    <RotateCcw size={12} />
                    <span>Reset to Org Defaults</span>
                  </button>
                )}
              </div>

              {/* Help tip */}
              <div className="flex items-center space-x-1 font-mono text-[10px]">
                <span>Esc to Close</span>
                <span>•</span>
                <HelpCircle size={11} />
                <span>Search hotkeys then hit Enter/Play to run</span>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
