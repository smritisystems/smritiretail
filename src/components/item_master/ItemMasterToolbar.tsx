/**
 * Project      : SMRITI Retail OS
 * Module       : Product Master Operational Action Bar (SLGP-001 v2.0)
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
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
  Filter
} from "lucide-react";

export type ItemMasterViewMode = "registry" | "excel-grid" | "attributes" | "templates" | "bulk" | "analytics";

interface ItemMasterToolbarProps {
  activeMode: ItemMasterViewMode;
  onModeChange: (mode: ItemMasterViewMode) => void;
  searchTerm: string;
  onSearchChange: (term: string) => void;
  productCount: number;
  onNewProduct: () => void;
  onRefresh: () => void;
  onOpenBarcodeHub: () => void;
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
  isReadOnly = false,
  onToggleFilterDrawer,
  isFilterDrawerOpen = false,
  hasActiveFilter = false,
  activeFilterLabel
}) => {
  const views: { id: ItemMasterViewMode; label: string; icon: React.ElementType }[] = [
    { id: "registry", label: "Master Registry", icon: Package },
    { id: "excel-grid", label: "Spreadsheet Studio", icon: FileSpreadsheet },
    { id: "attributes", label: "Dynamic Attributes", icon: Layers },
    { id: "templates", label: "Variant Templates", icon: FolderKanban },
    { id: "bulk", label: "Bulk Import", icon: UploadCloud },
    { id: "analytics", label: "SKU Analytics", icon: BarChart3 }
  ];

  return (
    <div className="w-full flex flex-col md:flex-row md:items-center justify-between gap-3 select-none">
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
                  ? "bg-[#0a6ed1] text-white border-[#0a6ed1] shadow-xs"
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
                ? "bg-[#0a6ed1]/10 text-[#0a6ed1] border-[#0a6ed1]/40"
                : "bg-theme-surface-2 text-theme-muted border-theme-divider hover:text-theme-heading hover:bg-theme-surface-hover"
            }`}
            title="Toggle Filter Drawer"
          >
            <Filter className="w-3.5 h-3.5 text-[#0a6ed1]" />
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
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-theme-surface-2 border border-theme-divider rounded-lg text-theme-heading placeholder:text-theme-muted focus:outline-none focus:border-[#0a6ed1]"
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
          <Printer className="w-3.5 h-3.5 text-[#0a6ed1]" />
          <span className="hidden sm:inline">Labels</span>
        </button>

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
            className="px-3.5 py-1.5 text-xs font-bold rounded-lg bg-[#0a6ed1] text-white hover:bg-[#085caf] flex items-center gap-1.5 shadow-xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>New SKU</span>
          </button>
        )}
      </div>
    </div>
  );
};
