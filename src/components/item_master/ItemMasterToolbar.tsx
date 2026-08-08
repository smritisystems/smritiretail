/**
 * Project      : SMRITI Retail OS
 * Module       : Item Master Studio Toolbar (SLGP-001 v3.0 — Simplified)
 * Standard     : WNG-003, WNG-004 — 5 Primary Modes + Overflow
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * Version      : 7.0.0
 * Change       : Collapsed 19 scroll-tabs → 5 primary + overflow dropdown.
 *                Removed studioLayers constant (was duplicated in sidebar, unused in JSX).
 *                F2 shortcut label added to Filter toggle button.
 */

import React, { useState, useRef, useEffect } from "react";
import {
  Package,
  FileSpreadsheet,
  FolderKanban,
  UploadCloud,
  BarChart3,
  Plus,
  RefreshCw,
  Printer,
  Search,
  Filter,
  Sparkles,
  ShoppingCart,
  Warehouse,
  BadgeDollarSign,
  TrendingUp,
  Boxes,
  ScanLine,
  FileText,
  MoreHorizontal,
  SlidersHorizontal,
  ChevronDown,
} from "lucide-react";

export type ItemMasterViewMode =
  | "overview"
  | "explorer"
  | "create"
  | "excel-grid"
  | "item-studio"
  | "variants"
  | "pricing"
  | "inventory"
  | "purchase"
  | "sales"
  | "barcode"
  | "images"
  | "documents"
  | "workflow"
  | "ai"
  | "reports"
  | "audit"
  | "settings"
  | "attributes"
  | "templates"
  | "bulk"
  | "analytics"
  | "registry";

interface ItemMasterToolbarProps {
  activeMode: ItemMasterViewMode;
  onModeChange: (mode: ItemMasterViewMode) => void;
  searchTerm: string;
  onSearchChange: (term: string) => void;
  productCount: number;
  onNewProduct: () => void;
  onRefresh: () => void;
  onOpenBarcodeHub: () => void;
  onOpenPrintStudioDemo?: () => void;
  isReadOnly?: boolean;
  onToggleFilterDrawer?: () => void;
  isFilterDrawerOpen?: boolean;
  hasActiveFilter?: boolean;
  activeFilterLabel?: string;
}

/** 5 primary workspace modes — always visible in the mode switcher bar. */
const PRIMARY_VIEWS: { id: ItemMasterViewMode; label: string; icon: React.ElementType }[] = [
  { id: "explorer",    label: "List",        icon: Package       },
  { id: "excel-grid",  label: "Spreadsheet", icon: FileSpreadsheet },
  { id: "item-studio", label: "Product",     icon: FileText      },
  { id: "variants",    label: "Variants",    icon: FolderKanban  },
  { id: "bulk",        label: "Import",      icon: UploadCloud   },
];

/** Secondary modes — accessible via the overflow (⋯ More) dropdown. */
const OVERFLOW_VIEWS: { id: ItemMasterViewMode; label: string; icon: React.ElementType }[] = [
  { id: "pricing",    label: "Pricing",     icon: BadgeDollarSign },
  { id: "inventory",  label: "Inventory",   icon: Boxes           },
  { id: "purchase",   label: "Purchase",    icon: ShoppingCart    },
  { id: "sales",      label: "Sales",       icon: TrendingUp      },
  { id: "barcode",    label: "Barcode",     icon: ScanLine        },
  { id: "ai",         label: "AI Skills",   icon: Sparkles        },
  { id: "reports",    label: "Reports",     icon: BarChart3       },
  { id: "audit",      label: "Audit",       icon: FileText        },
  { id: "attributes", label: "Attributes",  icon: SlidersHorizontal },
  { id: "settings",   label: "Settings",    icon: Warehouse       },
];

export const ItemMasterToolbar: React.FC<ItemMasterToolbarProps> = ({
  activeMode,
  onModeChange,
  searchTerm,
  onSearchChange,
  productCount,
  onNewProduct,
  onRefresh,
  onOpenBarcodeHub,
  isReadOnly = false,
  onToggleFilterDrawer,
  isFilterDrawerOpen = false,
  hasActiveFilter = false,
  activeFilterLabel,
}) => {
  const [isOverflowOpen, setIsOverflowOpen] = useState(false);
  const overflowRef = useRef<HTMLDivElement>(null);

  /** Close overflow when clicking outside */
  useEffect(() => {
    if (!isOverflowOpen) return;
    const handler = (e: MouseEvent) => {
      if (overflowRef.current && !overflowRef.current.contains(e.target as Node)) {
        setIsOverflowOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isOverflowOpen]);

  const isOverflowActive = OVERFLOW_VIEWS.some((v) => v.id === activeMode);

  return (
    <div className="w-full flex items-center gap-2 flex-wrap select-none">

      {/* ── 5 Primary Mode Tabs ── */}
      <div className="flex items-center gap-1">
        {PRIMARY_VIEWS.map((v) => {
          const Icon = v.icon;
          const isActive = activeMode === v.id;
          return (
            <button
              key={v.id}
              id={`im-mode-${v.id}`}
              onClick={() => onModeChange(v.id)}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg border flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                isActive
                  ? "bg-[var(--c-seef-accent)] text-white border-[var(--c-seef-accent)] shadow-xs"
                  : "bg-theme-surface-2 text-theme-muted border-theme-divider hover:text-theme-heading hover:bg-theme-surface-hover"
              }`}
            >
              <Icon className="w-3.5 h-3.5 flex-shrink-0" />
              <span>{v.label}</span>
            </button>
          );
        })}

        {/* ── Overflow Dropdown ── */}
        <div className="relative" ref={overflowRef}>
          <button
            id="im-mode-overflow"
            onClick={() => setIsOverflowOpen((p) => !p)}
            className={`px-2.5 py-1.5 text-xs font-bold rounded-lg border flex items-center gap-1 transition-all cursor-pointer ${
              isOverflowActive || isOverflowOpen
                ? "bg-[var(--c-seef-accent)]/10 text-[var(--c-seef-accent)] border-[var(--c-seef-accent)]/40"
                : "bg-theme-surface-2 text-theme-muted border-theme-divider hover:text-theme-heading hover:bg-theme-surface-hover"
            }`}
            title="More workspace modes"
            aria-label="More workspace modes"
          >
            <MoreHorizontal className="w-3.5 h-3.5" />
            <span className="hidden sm:inline text-xs">More</span>
            <ChevronDown
              className={`w-3 h-3 transition-transform duration-150 ${isOverflowOpen ? "rotate-180" : ""}`}
            />
          </button>

          {isOverflowOpen && (
            <div className="absolute left-0 top-full mt-1 z-30 min-w-[172px] bg-theme-surface-1 border border-theme-divider rounded-xl shadow-2xl py-1 text-xs">
              {OVERFLOW_VIEWS.map((v) => {
                const Icon = v.icon;
                const isActive = activeMode === v.id;
                return (
                  <button
                    key={v.id}
                    id={`im-mode-overflow-${v.id}`}
                    onClick={() => {
                      onModeChange(v.id);
                      setIsOverflowOpen(false);
                    }}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 font-bold text-left transition-colors cursor-pointer ${
                      isActive
                        ? "bg-[var(--c-seef-accent)]/10 text-[var(--c-seef-accent)]"
                        : "text-theme-heading hover:bg-theme-surface-hover"
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>{v.label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Visual Divider ── */}
      <div className="w-px h-5 bg-theme-divider hidden sm:block flex-shrink-0" />

      {/* ── Filter Toggle (F2) ── */}
      {onToggleFilterDrawer && (
        <button
          id="im-filter-toggle"
          onClick={onToggleFilterDrawer}
          className={`px-3 py-1.5 text-xs font-bold rounded-lg border flex items-center gap-1.5 transition-all cursor-pointer ${
            hasActiveFilter
              ? "bg-amber-500/10 text-amber-400 border-amber-500/40 shadow-xs"
              : isFilterDrawerOpen
              ? "bg-[var(--c-seef-accent)]/10 text-[var(--c-seef-accent)] border-[var(--c-seef-accent)]/40"
              : "bg-theme-surface-2 text-theme-muted border-theme-divider hover:text-theme-heading hover:bg-theme-surface-hover"
          }`}
          title="Toggle Filter Drawer (F2)"
          aria-label="Toggle Filter Drawer (F2)"
        >
          <Filter className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Filter</span>
          {hasActiveFilter && (
            <span className="px-1.5 rounded-full bg-amber-500 text-black text-[10px] font-extrabold leading-5">
              {activeFilterLabel || "1"}
            </span>
          )}
          <span className="text-[10px] font-mono text-theme-muted hidden lg:inline opacity-60">F2</span>
        </button>
      )}

      {/* ── Quick Search ── */}
      <div className="relative flex-1 min-w-[160px] max-w-xs">
        <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-theme-muted pointer-events-none" />
        <input
          id="im-search"
          type="text"
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search SKU, Name, Barcode…"
          className="w-full pl-8 pr-3 py-1.5 text-xs bg-theme-surface-2 border border-theme-divider rounded-lg text-theme-heading placeholder:text-theme-muted focus:outline-none focus:border-[var(--c-seef-accent)] transition-colors"
        />
      </div>

      {/* ── SKU Count ── */}
      <div className="px-2.5 py-1 text-xs rounded-lg bg-theme-surface-2 border border-theme-divider font-mono text-theme-muted hidden lg:block flex-shrink-0">
        <strong className="text-theme-heading">{productCount}</strong> SKUs
      </div>

      {/* ── Print Labels (F4) ── */}
      <button
        id="im-print-labels"
        onClick={onOpenBarcodeHub}
        className="px-3 py-1.5 text-xs font-bold rounded-lg bg-theme-surface-2 border border-theme-divider text-theme-heading hover:bg-theme-surface-hover flex items-center gap-1.5 transition-colors cursor-pointer flex-shrink-0"
        title="Print Barcode Labels (F4)"
        aria-label="Print Barcode Labels (F4)"
      >
        <Printer className="w-3.5 h-3.5 text-[var(--c-seef-accent)]" />
        <span className="hidden sm:inline">Labels</span>
        <span className="text-[10px] font-mono text-theme-muted hidden lg:inline opacity-60">F4</span>
      </button>

      {/* ── Refresh ── */}
      <button
        id="im-refresh"
        onClick={onRefresh}
        className="p-1.5 rounded-lg bg-theme-surface-2 border border-theme-divider text-theme-muted hover:text-theme-heading hover:bg-theme-surface-hover transition-colors cursor-pointer flex-shrink-0"
        title="Refresh Products"
        aria-label="Refresh Products"
      >
        <RefreshCw className="w-4 h-4" />
      </button>

      {/* ── New SKU (primary CTA) ── */}
      {!isReadOnly && (
        <button
          id="im-new-sku"
          onClick={onNewProduct}
          className="px-3.5 py-1.5 text-xs font-bold rounded-lg bg-[var(--c-seef-accent)] text-white hover:bg-[var(--c-seef-accent)]/90 flex items-center gap-1.5 shadow-xs cursor-pointer flex-shrink-0 ml-auto"
        >
          <Plus className="w-4 h-4" />
          <span>New SKU</span>
        </button>
      )}
    </div>
  );
};
