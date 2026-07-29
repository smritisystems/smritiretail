/**
 * Project      : SMRITI Retail OS v5.0
 * Module       : Item Master Contextual Sidebar (SAP Fiori Accordion Tree Pattern)
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Copyright    : © SMRITIBooks.com and AITDL.com. All Rights Reserved.
 * Version      : 5.6.0
 */

import React, { useState } from "react";
import {
  Package,
  Layers,
  Tag,
  Building2,
  Warehouse,
  Star,
  Clock,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Filter,
  Check
} from "lucide-react";
import { Product } from "../../types.js";

export interface ContextFilterState {
  type: "ALL" | "LOW_STOCK" | "FAVORITES" | "RECENT" | "CATEGORY" | "BRAND" | "DEPARTMENT" | "SUPPLIER" | "WAREHOUSE";
  value: string;
}

interface ItemMasterContextSidebarProps {
  products: Product[];
  activeFilter: ContextFilterState;
  onFilterChange: (filter: ContextFilterState) => void;
  categories: string[];
  brands: string[];
  departments?: string[];
  suppliers?: string[];
  warehouses?: string[];
  lowStockCount: number;
}

export const ItemMasterContextSidebar: React.FC<ItemMasterContextSidebarProps> = ({
  products,
  activeFilter,
  onFilterChange,
  categories,
  brands,
  departments = ["Apparel & Fashion", "Footwear", "Electronics", "General Retail"],
  suppliers = ["V-001 (Smriti Mills)", "V-002 (Royal Crafts)", "V-003 (Apex Logistics)"],
  warehouses = ["Main Store (BR-01)", "Central Warehouse (WH-01)", "Bin Area A1"],
  lowStockCount
}) => {
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    quick: true,
    categories: true,
    brands: false,
    departments: false,
    suppliers: false,
    warehouses: false
  });

  const toggleSection = (section: string) => {
    setOpenSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const isSelected = (type: ContextFilterState["type"], value: string) =>
    activeFilter.type === type && activeFilter.value === value;

  return (
    <aside className="w-64 h-full bg-theme-surface-1 border-r border-theme-divider flex flex-col select-none text-xs">
      {/* Header */}
      <div className="p-3 border-b border-theme-divider flex items-center justify-between bg-theme-surface-2/50">
        <span className="font-bold text-theme-heading flex items-center gap-1.5 uppercase tracking-wider text-[11px]">
          <Filter className="w-3.5 h-3.5 text-[#0a6ed1]" /> Master Registry Tree
        </span>
        <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-theme-surface-2 text-theme-muted">
          {products.length} SKUs
        </span>
      </div>

      {/* Accordion Tree Scroll Container */}
      <div className="flex-1 overflow-y-auto p-2 space-y-3 scrollbar-thin">
        {/* Quick Views */}
        <div>
          <button
            onClick={() => toggleSection("quick")}
            className="w-full flex items-center justify-between p-1.5 font-bold text-theme-muted hover:text-theme-heading transition-colors"
          >
            <span className="text-[11px] uppercase tracking-wider">Quick Views</span>
            {openSections.quick ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </button>

          {openSections.quick && (
            <div className="mt-1 space-y-0.5 pl-1">
              <button
                onClick={() => onFilterChange({ type: "ALL", value: "ALL" })}
                className={`w-full flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors ${
                  isSelected("ALL", "ALL")
                    ? "bg-[#0a6ed1] text-white font-bold"
                    : "text-theme-heading hover:bg-theme-surface-2"
                }`}
              >
                <span className="flex items-center gap-2">
                  <Package className="w-4 h-4" /> All Products
                </span>
                <span className="font-mono text-[11px] opacity-80">{products.length}</span>
              </button>

              <button
                onClick={() => onFilterChange({ type: "LOW_STOCK", value: "LOW_STOCK" })}
                className={`w-full flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors ${
                  isSelected("LOW_STOCK", "LOW_STOCK")
                    ? "bg-rose-600 text-white font-bold"
                    : "text-theme-heading hover:bg-theme-surface-2"
                }`}
              >
                <span className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-500" /> Low Stock Alerts
                </span>
                <span className="font-mono text-[11px] px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-500 font-bold">
                  {lowStockCount}
                </span>
              </button>

              <button
                onClick={() => onFilterChange({ type: "FAVORITES", value: "FAVORITES" })}
                className={`w-full flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors ${
                  isSelected("FAVORITES", "FAVORITES")
                    ? "bg-[#0a6ed1] text-white font-bold"
                    : "text-theme-heading hover:bg-theme-surface-2"
                }`}
              >
                <span className="flex items-center gap-2">
                  <Star className="w-4 h-4 text-amber-400 fill-amber-400" /> Starred Favorites
                </span>
              </button>

              <button
                onClick={() => onFilterChange({ type: "RECENT", value: "RECENT" })}
                className={`w-full flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors ${
                  isSelected("RECENT", "RECENT")
                    ? "bg-[#0a6ed1] text-white font-bold"
                    : "text-theme-heading hover:bg-theme-surface-2"
                }`}
              >
                <span className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-sky-400" /> Recently Viewed
                </span>
              </button>
            </div>
          )}
        </div>

        {/* Categories */}
        <div>
          <button
            onClick={() => toggleSection("categories")}
            className="w-full flex items-center justify-between p-1.5 font-bold text-theme-muted hover:text-theme-heading transition-colors"
          >
            <span className="text-[11px] uppercase tracking-wider">Categories</span>
            {openSections.categories ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </button>

          {openSections.categories && (
            <div className="mt-1 space-y-0.5 pl-1">
              {categories.map((cat) => {
                const count = products.filter((p) => p.category === cat).length;
                return (
                  <button
                    key={cat}
                    onClick={() => onFilterChange({ type: "CATEGORY", value: cat })}
                    className={`w-full flex items-center justify-between p-1.5 rounded-md cursor-pointer transition-colors text-left ${
                      isSelected("CATEGORY", cat)
                        ? "bg-[#0a6ed1] text-white font-bold"
                        : "text-theme-heading hover:bg-theme-surface-2"
                    }`}
                  >
                    <span className="flex items-center gap-2 truncate">
                      <Layers className="w-3.5 h-3.5 text-[#0a6ed1]" /> {cat}
                    </span>
                    <span className="font-mono text-[10px] opacity-75">{count}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Brands */}
        <div>
          <button
            onClick={() => toggleSection("brands")}
            className="w-full flex items-center justify-between p-1.5 font-bold text-theme-muted hover:text-theme-heading transition-colors"
          >
            <span className="text-[11px] uppercase tracking-wider">Brands</span>
            {openSections.brands ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </button>

          {openSections.brands && (
            <div className="mt-1 space-y-0.5 pl-1">
              {brands.map((b) => (
                <button
                  key={b}
                  onClick={() => onFilterChange({ type: "BRAND", value: b })}
                  className={`w-full flex items-center justify-between p-1.5 rounded-md cursor-pointer transition-colors text-left ${
                    isSelected("BRAND", b)
                      ? "bg-[#0a6ed1] text-white font-bold"
                      : "text-theme-heading hover:bg-theme-surface-2"
                  }`}
                >
                  <span className="flex items-center gap-2 truncate">
                    <Tag className="w-3.5 h-3.5 text-emerald-500" /> {b}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Departments */}
        <div>
          <button
            onClick={() => toggleSection("departments")}
            className="w-full flex items-center justify-between p-1.5 font-bold text-theme-muted hover:text-theme-heading transition-colors"
          >
            <span className="text-[11px] uppercase tracking-wider">Departments</span>
            {openSections.departments ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </button>

          {openSections.departments && (
            <div className="mt-1 space-y-0.5 pl-1">
              {departments.map((d) => (
                <button
                  key={d}
                  onClick={() => onFilterChange({ type: "DEPARTMENT", value: d })}
                  className={`w-full flex items-center justify-between p-1.5 rounded-md cursor-pointer transition-colors text-left ${
                    isSelected("DEPARTMENT", d)
                      ? "bg-[#0a6ed1] text-white font-bold"
                      : "text-theme-heading hover:bg-theme-surface-2"
                  }`}
                >
                  <span className="flex items-center gap-2 truncate">
                    <Building2 className="w-3.5 h-3.5 text-indigo-400" /> {d}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Warehouses */}
        <div>
          <button
            onClick={() => toggleSection("warehouses")}
            className="w-full flex items-center justify-between p-1.5 font-bold text-theme-muted hover:text-theme-heading transition-colors"
          >
            <span className="text-[11px] uppercase tracking-wider">Warehouses & Bins</span>
            {openSections.warehouses ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </button>

          {openSections.warehouses && (
            <div className="mt-1 space-y-0.5 pl-1">
              {warehouses.map((w) => (
                <button
                  key={w}
                  onClick={() => onFilterChange({ type: "WAREHOUSE", value: w })}
                  className={`w-full flex items-center justify-between p-1.5 rounded-md cursor-pointer transition-colors text-left ${
                    isSelected("WAREHOUSE", w)
                      ? "bg-[#0a6ed1] text-white font-bold"
                      : "text-theme-heading hover:bg-theme-surface-2"
                  }`}
                >
                  <span className="flex items-center gap-2 truncate">
                    <Warehouse className="w-3.5 h-3.5 text-amber-500" /> {w}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </aside>
  );
};
