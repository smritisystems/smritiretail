/**
 * Project      : SMRITI Retail OS
 * Module       : Product Master Operational Action Bar (SLGP-001 v2.0)
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Copyright    : Â© SMRITIBooks.com. All Rights Reserved.
 * Version      : 5.4.0
 */

import React from "react";
import {
  Package,
  FileSpreadsheet,
  Layers,
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
  ClipboardList,
  Boxes,
  ScanLine,
  FileText,
  Compass,
  PanelRightOpen,
  TerminalSquare,
  Workflow,
  SlidersHorizontal
} from "lucide-react";

export type ItemMasterViewMode = "overview" | "explorer" | "create" | "excel-grid" | "item-studio" | "variants" | "pricing" | "inventory" | "purchase" | "sales" | "barcode" | "images" | "documents" | "workflow" | "ai" | "reports" | "audit" | "settings" | "attributes" | "templates" | "bulk" | "analytics" | "registry";

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

export const ItemMasterToolbar: React.FC<ItemMasterToolbarProps> = ({
  activeMode,
  onModeChange,
  searchTerm,
  onSearchChange,
  productCount,
  onNewProduct,
  onRefresh,
  onOpenBarcodeHub,
  onOpenPrintStudioDemo,
  isReadOnly = false,
  onToggleFilterDrawer,
  isFilterDrawerOpen = false,
  hasActiveFilter = false,
  activeFilterLabel
}) => {
  const views: { id: ItemMasterViewMode; label: string; icon: React.ElementType }[] = [
    { id: "overview", label: "Overview", icon: Package },
    { id: "explorer", label: "Explorer", icon: Search },
    { id: "create", label: "Create", icon: Plus },
    { id: "excel-grid", label: "Spreadsheet", icon: FileSpreadsheet },
    { id: "item-studio", label: "Item Studio", icon: FileText },
    { id: "variants", label: "Variants", icon: FolderKanban },
    { id: "pricing", label: "Pricing", icon: BadgeDollarSign },
    { id: "inventory", label: "Inventory", icon: Boxes },
    { id: "purchase", label: "Purchase", icon: ShoppingCart },
    { id: "sales", label: "Sales", icon: TrendingUp },
    { id: "barcode", label: "Barcode", icon: ScanLine },
    { id: "images", label: "Images", icon: Package },
    { id: "documents", label: "Documents", icon: ClipboardList },
    { id: "workflow", label: "Workflow", icon: Layers },
    { id: "ai", label: "AI", icon: Sparkles },
    { id: "reports", label: "Reports", icon: BarChart3 },
    { id: "audit", label: "Audit", icon: FileText },
    { id: "settings", label: "Settings", icon: Warehouse },
    { id: "bulk", label: "Bulk Ops", icon: UploadCloud }
  ];

  const studioLayers = [
    {
      key: "explorer",
      label: "Explorer",
      icon: Compass,
      description: "Search, filters, saved views",
      modes: ["explorer", "overview", "create"],
    },
    {
      key: "workspace",
      label: "Workspace",
      icon: SlidersHorizontal,
      description: "Spreadsheet, variants, gallery",
      modes: ["excel-grid", "item-studio", "variants", "analytics", "templates"],
    },
    {
      key: "context",
      label: "Context",
      icon: PanelRightOpen,
      description: "Selected item, lifecycle, AI",
      modes: ["pricing", "inventory", "purchase", "sales", "ai", "reports", "audit", "settings"],
    },
    {
      key: "actions",
      label: "Actions",
      icon: Workflow,
      description: "Create, approve, duplicate, bulk",
      modes: ["create", "bulk", "barcode", "workflow"],
    },
    {
      key: "console",
      label: "Console",
      icon: TerminalSquare,
      description: "Validation, jobs, notifications",
      modes: ["reports", "audit", "settings"],
    },
  ];

  return (
    <div className="w-full flex flex-col gap-3 select-none">
      <div className="flex flex-col gap-2 rounded-xl border border-theme-divider bg-theme-surface-2 p-2">
        <div className="flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[0.24em] text-theme-muted">
          <Compass className="w-3.5 h-3.5" />
          <span>Studio Layers</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {studioLayers.map((layer) => {
            const Icon = layer.icon;
            const isActive = layer.modes.includes(activeMode);
            return (
              <button
                key={layer.key}
                onClick={() => onModeChange(layer.modes[0] as ItemMasterViewMode)}
                className={`rounded-lg border px-2.5 py-1.5 text-left transition-all ${
                  isActive
                    ? "border-[var(--c-seef-accent)] bg-[var(--c-seef-accent)]/10 text-[var(--c-seef-accent)]"
                    : "border-theme-divider bg-theme-surface-1 text-theme-heading hover:bg-theme-surface-hover"
                }`}
              >
                <div className="flex items-center gap-1.5 text-[11px] font-bold">
                  <Icon className="w-3.5 h-3.5" />
                  <span>{layer.label}</span>
                </div>
                <div className="mt-1 text-[10px] text-theme-muted">{layer.description}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 1. View Mode Switcher Strip */}
      <div className="flex items-center gap-1 overflow-x-auto scrollbar-none">
        {views.map((v) => {
          const Icon = v.icon;
          const isActive = activeMode === v.id;
          return (
            <button
              key={v.id}
              onClick={() => onModeChange(v.id)}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg border flex items-center gap-2 transition-all cursor-pointer ${
                isActive
                  ? "bg-[var(--c-seef-accent)] text-white border-[var(--c-seef-accent)] shadow-xs"
                  : "bg-theme-surface-2 text-theme-muted border-theme-divider hover:text-theme-heading hover:bg-theme-surface-hover"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{v.label}</span>
            </button>
          );
        })}
      </div>

      {/* 2. Quick Search & Operational Action Buttons */}
      <div className="flex items-center gap-2">
        {/* Slide-out Filter Drawer Toggle Button */}
        {onToggleFilterDrawer && (
          <button
            onClick={onToggleFilterDrawer}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg border flex items-center gap-1.5 transition-all cursor-pointer ${
              hasActiveFilter
                ? "bg-amber-500/10 text-amber-400 border-amber-500/40 shadow-xs"
                : isFilterDrawerOpen
                ? "bg-[var(--c-seef-accent)]/10 text-[var(--c-seef-accent)] border-[var(--c-seef-accent)]/40"
                : "bg-theme-surface-2 text-theme-muted border-theme-divider hover:text-theme-heading hover:bg-theme-surface-hover"
            }`}
            title="Toggle Filter Drawer"
          >
            <Filter className="w-3.5 h-3.5 text-[var(--c-seef-accent)]" />
            <span>Filters</span>
            {hasActiveFilter && (
              <span className="px-1.5 py-0.2 rounded-full bg-amber-500 text-black text-[10px] font-extrabold">
                {activeFilterLabel || "1"}
              </span>
            )}
          </button>
        )}

        {/* Quick Search */}
        <div className="relative w-48 md:w-64">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-theme-muted" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search SKU, Name, Barcode..."
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-theme-surface-2 border border-theme-divider rounded-lg text-theme-heading placeholder:text-theme-muted focus:outline-none focus:border-[var(--c-seef-accent)]"
          />
        </div>

        {/* Total SKU Badge */}
        <div className="px-2.5 py-1 text-xs rounded-lg bg-theme-surface-2 border border-theme-divider font-mono text-theme-muted hidden lg:block">
          SKUs: <strong className="text-theme-heading">{productCount}</strong>
        </div>

        {/* Barcode Print Studio Button */}
        <button
          onClick={onOpenBarcodeHub}
          className="px-3 py-1.5 text-xs font-bold rounded-lg bg-theme-surface-2 border border-theme-divider text-theme-heading hover:bg-theme-surface-hover flex items-center gap-1.5 transition-colors cursor-pointer"
          title="Print Barcode Labels"
        >
          <Printer className="w-3.5 h-3.5 text-[var(--c-seef-accent)]" />
          <span className="hidden sm:inline">Labels</span>
        </button>

        {/* Demo Print Studio Button */}
        {onOpenPrintStudioDemo && (
          <button
            onClick={onOpenPrintStudioDemo}
            className="px-3 py-1.5 text-xs font-bold rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 hover:bg-emerald-500/20 flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Open Barcode Demo Studio"
          >
            <Printer className="w-3.5 h-3.5 text-emerald-600" />
            <span className="hidden sm:inline">Demo</span>
          </button>
        )}

        {/* Refresh Button */}
        <button
          onClick={onRefresh}
          className="p-1.5 rounded-lg bg-theme-surface-2 border border-theme-divider text-theme-muted hover:text-theme-heading hover:bg-theme-surface-hover transition-colors cursor-pointer"
          title="Refresh Products"
        >
          <RefreshCw className="w-4 h-4" />
        </button>

        {/* Add Product Button */}
        {!isReadOnly && (
          <button
            onClick={onNewProduct}
            className="px-3.5 py-1.5 text-xs font-bold rounded-lg bg-[var(--c-seef-accent)] text-white hover:bg-[var(--c-seef-accent)]/90 flex items-center gap-1.5 shadow-xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>New SKU</span>
          </button>
        )}
      </div>
    </div>
  );
};
