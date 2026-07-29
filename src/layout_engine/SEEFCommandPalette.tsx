/**
 * Project      : SMRITI Retail OS
 * Organization : SmritiSys
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 1.0.0  (SEEF Phase 4)
 * Created      : 2026-07-26
 * Modified     : 2026-07-27
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * SEEF Command Palette — Global Keyboard-First Launcher
 *
 * Activated by: Ctrl+K (Windows) / ⌘K (Mac) from any screen.
 * Keyboard-first: entire interaction via keyboard, no mouse required.
 * Searches across: all registered workspaces, recently used, favorites,
 * SEEF quick-actions (theme switch, density toggle).
 *
 * AOP-001: No AI features in v1. Navigation + actions only.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  Search, Clock, Star, ArrowRight, Command, Hash,
  Palette, Sun, Moon, LayoutGrid, Zap
} from "lucide-react";
import { useSEEF } from "./SEEFContext.tsx";
import { useLayoutEngine } from "./layout_store.tsx";

// ── Types ─────────────────────────────────────────────────────────────────────

interface PaletteItem {
  id: string;
  label: string;
  category: "workspace" | "recent" | "favorite" | "action" | "seef";
  icon?: React.ReactNode;
  iconText?: string;           // material symbol name
  keywords?: string[];
  onSelect: () => void;
}

// ── Fuzzy match ───────────────────────────────────────────────────────────────

function fuzzyMatch(query: string, text: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  if (t.includes(q)) return true;
  // Character-by-character fuzzy
  let qi = 0;
  for (let i = 0; i < t.length && qi < q.length; i++) {
    if (t[i] === q[qi]) qi++;
  }
  return qi === q.length;
}

// ── Component ──────────────────────────────────────────────────────────────────

export interface SEEFCommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (workspaceId: string) => void;
}

export const SEEFCommandPalette: React.FC<SEEFCommandPaletteProps> = ({
  isOpen,
  onClose,
  onNavigate,
}) => {
  const { config, updateSEEF } = useSEEF();
  const { registeredWorkspaces, recentlyUsed, preferences, toggleFavorite } = useLayoutEngine();

  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // ── Build palette items ───────────────────────────────────────────────────
  const allItems = useMemo<PaletteItem[]>(() => {
    const items: PaletteItem[] = [];

    // Recently used (shown at top when query is empty)
    recentlyUsed.slice(0, 5).forEach((id) => {
      const ws = registeredWorkspaces.find((w) => w.id === id);
      if (ws) {
        items.push({
          id: `recent-${ws.id}`,
          label: ws.label,
          category: "recent",
          iconText: ws.icon,
          keywords: [ws.label, ws.category],
          onSelect: () => { onNavigate(ws.id); onClose(); },
        });
      }
    });

    // Favorites
    preferences.favorites.forEach((id) => {
      if (recentlyUsed.slice(0, 5).includes(id)) return; // already in recent
      const ws = registeredWorkspaces.find((w) => w.id === id);
      if (ws) {
        items.push({
          id: `fav-${ws.id}`,
          label: ws.label,
          category: "favorite",
          iconText: ws.icon,
          keywords: [ws.label, ws.category],
          onSelect: () => { onNavigate(ws.id); onClose(); },
        });
      }
    });

    // All workspaces
    registeredWorkspaces.forEach((ws) => {
      const alreadyListed = items.find((i) => i.label === ws.label);
      if (!alreadyListed) {
        items.push({
          id: `ws-${ws.id}`,
          label: ws.label,
          category: "workspace",
          iconText: ws.icon,
          keywords: [ws.label, ws.category, ws.id],
          onSelect: () => { onNavigate(ws.id); onClose(); },
        });
      }
    });

    // SEEF Quick Actions
    items.push(
      {
        id: "seef-theme-dark",
        label: "Switch to Dark Theme",
        category: "seef",
        icon: <Moon size={14} />,
        keywords: ["theme", "dark", "seef", "appearance"],
        onSelect: () => { updateSEEF({ theme: "dark" }); onClose(); },
      },
      {
        id: "seef-theme-light",
        label: "Switch to Light Theme",
        category: "seef",
        icon: <Sun size={14} />,
        keywords: ["theme", "light", "seef", "appearance"],
        onSelect: () => { updateSEEF({ theme: "light" }); onClose(); },
      },
      {
        id: "seef-theme-enterprise",
        label: "Switch to Enterprise Theme",
        category: "seef",
        icon: <Palette size={14} />,
        keywords: ["theme", "enterprise", "seef", "fiori"],
        onSelect: () => { updateSEEF({ theme: "enterprise" }); onClose(); },
      },
      {
        id: "seef-density-compact",
        label: "Density: Compact",
        category: "seef",
        icon: <LayoutGrid size={14} />,
        keywords: ["density", "compact", "seef"],
        onSelect: () => { updateSEEF({ density: "compact" }); onClose(); },
      },
      {
        id: "seef-density-comfortable",
        label: "Density: Comfortable",
        category: "seef",
        icon: <LayoutGrid size={14} />,
        keywords: ["density", "comfortable", "default", "seef"],
        onSelect: () => { updateSEEF({ density: "comfortable" }); onClose(); },
      },
      {
        id: "seef-density-spacious",
        label: "Density: Spacious",
        category: "seef",
        icon: <LayoutGrid size={14} />,
        keywords: ["density", "spacious", "seef"],
        onSelect: () => { updateSEEF({ density: "spacious" }); onClose(); },
      },
      {
        id: "seef-animation-toggle",
        label: config.animationPolicy === "none" ? "Enable Animations" : "Disable Animations",
        category: "seef",
        icon: <Zap size={14} />,
        keywords: ["animation", "motion", "seef", "accessibility"],
        onSelect: () => {
          updateSEEF({ animationPolicy: config.animationPolicy === "none" ? "full" : "none" });
          onClose();
        },
      }
    );

    return items;
  }, [registeredWorkspaces, recentlyUsed, preferences.favorites, config, updateSEEF, onNavigate, onClose]);

  // ── Filtered results ──────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    if (!query) return allItems.slice(0, 12);
    return allItems
      .filter((item) =>
        fuzzyMatch(query, item.label) ||
        (item.keywords ?? []).some((kw) => fuzzyMatch(query, kw))
      )
      .slice(0, 12);
  }, [allItems, query]);

  // Reset selection when results change
  useEffect(() => setSelectedIndex(0), [filtered.length, query]);

  // Focus input on open & bind global Escape key listener
  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setSelectedIndex(0);
      requestAnimationFrame(() => inputRef.current?.focus());

      const handleGlobalKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          e.preventDefault();
          onClose();
        }
      };
      window.addEventListener("keydown", handleGlobalKeyDown);
      return () => window.removeEventListener("keydown", handleGlobalKeyDown);
    }
  }, [isOpen, onClose]);

  // ── Keyboard navigation ───────────────────────────────────────────────────
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1));
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex((i) => Math.max(i - 1, 0));
          break;
        case "Enter":
          e.preventDefault();
          filtered[selectedIndex]?.onSelect();
          break;
        case "Escape":
          e.preventDefault();
          onClose();
          break;
      }
    },
    [filtered, selectedIndex, onClose]
  );

  if (!isOpen) return null;

  const categoryLabel: Record<PaletteItem["category"], string> = {
    recent: "Recently Used",
    favorite: "Favorites",
    workspace: "All Modules",
    action: "Actions",
    seef: "Experience Settings",
  };

  const categoryIcon: Record<PaletteItem["category"], React.ReactNode> = {
    recent:    <Clock size={11} />,
    favorite:  <Star size={11} />,
    workspace: <Hash size={11} />,
    action:    <ArrowRight size={11} />,
    seef:      <Palette size={11} />,
  };

  // Group items by category
  const grouped = filtered.reduce<Record<string, PaletteItem[]>>((acc, item) => {
    const key = item.category;
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});
  const categoryOrder: PaletteItem["category"][] = ["recent", "favorite", "workspace", "action", "seef"];
  let flatIndex = 0;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "var(--c-seef-overlay)",
          backdropFilter: "blur(4px)",
          zIndex: 20000,
        }}
      />

      {/* Palette container */}
      <div
        style={{
          position: "fixed",
          top: "12vh",
          left: "50%",
          transform: "translateX(-50%)",
          width: "min(580px, 92vw)",
          background: "var(--c-theme-surface-1)",
          border: "1px solid var(--c-theme-divider)",
          borderRadius: "var(--seef-radius-active-xl)",
          boxShadow: "var(--seef-elevation-5)",
          zIndex: 20001,
          overflow: "hidden",
          fontFamily: "var(--font-sans)",
        }}
        onKeyDown={handleKeyDown}
      >
        {/* Search input */}
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
          padding: "12px 16px",
          borderBottom: "1px solid var(--c-theme-divider)",
        }}>
          <Search size={16} style={{ color: "var(--c-theme-muted)", flexShrink: 0 }} />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search modules, actions, settings…"
            style={{
              flex: 1,
              border: "none",
              background: "none",
              outline: "none",
              fontSize: "var(--seef-font-size-md)",
              color: "var(--c-theme-body)",
              fontFamily: "var(--font-sans)",
            }}
          />
          <kbd style={{
            display: "flex",
            alignItems: "center",
            gap: "2px",
            padding: "2px 6px",
            borderRadius: "4px",
            background: "var(--c-theme-surface-hover)",
            border: "1px solid var(--c-theme-divider)",
            fontSize: "10px",
            color: "var(--c-theme-muted)",
            flexShrink: 0,
          }}>
            Esc
          </kbd>
        </div>

        {/* Results */}
        <div style={{ maxHeight: "420px", overflowY: "auto" }}>
          {filtered.length === 0 ? (
            <div style={{
              padding: "32px 16px",
              textAlign: "center",
              color: "var(--c-theme-muted)",
              fontSize: "var(--seef-font-size-sm)",
            }}>
              No results for &ldquo;{query}&rdquo;
            </div>
          ) : (
            categoryOrder.map((cat) => {
              const items = grouped[cat];
              if (!items?.length) return null;
              return (
                <div key={cat}>
                  {/* Category header */}
                  <div style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "5px",
                    padding: "6px 16px 2px",
                    fontSize: "10px",
                    fontWeight: 600,
                    color: "var(--c-theme-muted)",
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                  }}>
                    {categoryIcon[cat]}
                    {categoryLabel[cat]}
                  </div>
                  {/* Items */}
                  {items.map((item) => {
                    const localIndex = flatIndex;
                    flatIndex++;
                    const isSelected = localIndex === selectedIndex;
                    return (
                      <button
                        key={item.id}
                        onClick={item.onSelect}
                        style={{
                          width: "100%",
                          display: "flex",
                          alignItems: "center",
                          gap: "10px",
                          padding: "8px 16px",
                          background: isSelected ? "var(--c-theme-surface-hover)" : "none",
                          border: "none",
                          cursor: "pointer",
                          color: isSelected ? "var(--c-theme-body)" : "var(--c-theme-primary)",
                          fontSize: "var(--seef-font-size-sm)",
                          textAlign: "left",
                          transition: "background var(--seef-motion-fast) var(--seef-ease-standard)",
                        }}
                        onMouseEnter={() => setSelectedIndex(localIndex)}
                      >
                        <span style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          width: 24,
                          height: 24,
                          borderRadius: "var(--seef-radius-active-sm)",
                          background: isSelected ? "var(--c-seef-accent)" : "var(--c-theme-surface-2)",
                          color: isSelected ? "#fff" : "var(--c-theme-muted)",
                          flexShrink: 0,
                          fontSize: "16px",
                        }}>
                          {item.icon ? item.icon : (
                            <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>
                              {item.iconText ?? "apps"}
                            </span>
                          )}
                        </span>
                        <span style={{ flex: 1 }}>{item.label}</span>
                        {isSelected && (
                          <kbd style={{
                            padding: "1px 5px",
                            borderRadius: "3px",
                            background: "var(--c-theme-surface-2)",
                            border: "1px solid var(--c-theme-divider)",
                            fontSize: "10px",
                            color: "var(--c-theme-muted)",
                          }}>
                            ↵
                          </kbd>
                        )}
                      </button>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>

        {/* Footer hint */}
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "6px 16px",
          borderTop: "1px solid var(--c-theme-divider)",
          background: "var(--c-theme-surface-2)",
          fontSize: "10px",
          color: "var(--c-theme-muted)",
        }}>
          <div style={{ display: "flex", gap: "12px" }}>
            <span><kbd style={kbdStyle}>↑↓</kbd> Navigate</span>
            <span><kbd style={kbdStyle}>↵</kbd> Open</span>
            <span><kbd style={kbdStyle}>Esc</kbd> Close</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <Command size={10} /> SEEF v1.0
          </div>
        </div>
      </div>
    </>
  );
};

const kbdStyle: React.CSSProperties = {
  padding: "1px 4px",
  borderRadius: "3px",
  background: "var(--c-theme-surface-1)",
  border: "1px solid var(--c-theme-divider)",
  fontFamily: "var(--font-mono)",
  fontSize: "9px",
};

// ── Global keyboard shortcut registration hook ────────────────────────────────

/**
 * Hook to register Ctrl+K / ⌘K global shortcut.
 * Usage: useSEEFCommandPaletteShortcut(setOpen)
 */
export function useSEEFCommandPaletteShortcut(
  setOpen: (open: boolean) => void
): void {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [setOpen]);
}
