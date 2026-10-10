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
 * * Websites: aitdl.com | erpnbook.com | smritibooks.com
 *
 * * Version    : 6.17.0
 * * Created    : 2026-09-14
 * * Modified   : 2026-09-14
 * * Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
 * * License    : Proprietary Commercial Software
 *
 * SMRITI F2 Advanced Item Search & Invoicing Browser
 * Enterprise Retail Specification:
 *   - Universal multi-attribute catalog exploration
 *   - Availability gating & balance inventory criteria
 *   - Fast single-key cashier selection contract
 *
 * KEY CAPABILITIES:
 *   1. General Selection: Stock No, Description, Product/Category, Brand, Style, Shade/Color, Size.
 *   2. Quantity & Balance Criteria: Comparison operators (">", "=", "<") defaulting to "Qty > 0" (In-Stock Only).
 *   3. Advanced Selection Drawer (Alt+A): Department, Price Range (MRP Min/Max), Season, Fabric/Fibre.
 *   4. Image Cross-Verification (Alt+I): Visual validation with zoom viewer for luxury & garment retail.
 *   5. Memory Persistence: localStorage filter preservation & Ctrl+Insert previous search recall.
 *   6. Single-key Selection: Enter commits item and passes structured record to billing terminal.
 */

import React, { useState, useMemo, useEffect, useRef, useCallback } from "react";
import {
  Search,
  Filter,
  CheckCircle2,
  X,
  Package,
  Layers,
  Tag,
  Palette,
  Maximize2,
  Minimize2,
  RotateCcw,
  Save,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  Image as ImageIcon,
  AlertCircle,
  Eye,
  Check
} from "lucide-react";
import { Product } from "../../types.ts";
import { apiFetchV1 } from "../../lib/apiFetch.ts";

export type QuantityCondition = "Greater Than" | "Is" | "Less Than";

export interface SmritiF2SelectedItem {
  stockNo: string;
  barcode: string;
  name: string;
  rate: number;
  mrp: number;
  brand?: string;
  category?: string;
  styleCode?: string;
  color?: string;
  size?: string;
  stock?: number;
  gstRate?: number;
  image?: string;
  rawRecord?: any;
}

export interface SmritiF2AdvancedItemSearchProps {
  isOpen: boolean;
  products?: Product[];
  initialSearchQuery?: string;
  onSelectProduct: (item: SmritiF2SelectedItem) => void;
  onClose: () => void;
  storeId?: string;
}

interface FilterCriteriaState {
  stockNo: string;
  description: string;
  category: string;
  brand: string;
  styleCode: string;
  color: string;
  size: string;
  qtyCondition: QuantityCondition;
  qtyValue: number;
  inStockOnly: boolean;
  // Advanced Selection (Alt+A)
  department: string;
  minMrp: string;
  maxMrp: string;
  season: string;
  fabric: string;
}

const DEFAULT_FILTER_STATE: FilterCriteriaState = {
  stockNo: "",
  description: "",
  category: "",
  brand: "",
  styleCode: "",
  color: "",
  size: "",
  qtyCondition: "Greater Than",
  qtyValue: 0,
  inStockOnly: true,
  department: "",
  minMrp: "",
  maxMrp: "",
  season: "",
  fabric: "",
};

const STORAGE_KEY_PRESETS = "smriti_f2_filter_presets";
const STORAGE_KEY_LAST_QUERY = "smriti_f2_last_query";

export const SmritiF2AdvancedItemSearch: React.FC<SmritiF2AdvancedItemSearchProps> = ({
  isOpen,
  products = [],
  initialSearchQuery = "",
  onSelectProduct,
  onClose,
  storeId
}) => {
  // Load initial filter state from memory if available
  const [filters, setFilters] = useState<FilterCriteriaState>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_PRESETS);
      if (saved) return { ...DEFAULT_FILTER_STATE, ...JSON.parse(saved) };
    } catch { /* ignore fallback */ }
    return DEFAULT_FILTER_STATE;
  });

  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);
  const [showImageViewer, setShowImageViewer] = useState<boolean>(false);
  const [selectedRowIndex, setSelectedRowIndex] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [liveApiProducts, setLiveApiProducts] = useState<any[]>([]);
  const [isLoadingApi, setIsLoadingApi] = useState<boolean>(false);
  const [zoomLevel, setZoomLevel] = useState<number>(1);

  const pageSize = 12;
  const primaryInputRef = useRef<HTMLInputElement>(null);
  const prevQueryRef = useRef<FilterCriteriaState | null>(null);

  // Sync initial query when opened
  useEffect(() => {
    if (isOpen) {
      if (initialSearchQuery.trim()) {
        setFilters(prev => ({
          ...prev,
          description: initialSearchQuery.trim()
        }));
      }
      setSelectedRowIndex(0);
      setCurrentPage(1);
      setTimeout(() => primaryInputRef.current?.focus(), 80);
      fetchLiveVariants();
    }
  }, [isOpen, initialSearchQuery]);

  // Fetch live variants with warehouse inventory levels from FastAPI backend
  const fetchLiveVariants = useCallback(async () => {
    setIsLoadingApi(true);
    try {
      const resp = await apiFetchV1("/variants?limit=300");
      if (resp && Array.isArray(resp.items)) {
        setLiveApiProducts(resp.items);
      } else if (Array.isArray(resp)) {
        setLiveApiProducts(resp);
      }
    } catch (e) {
      console.warn("[SmritiF2ItemSearch] Live variants fetch failed, using local product catalog:", e);
    } finally {
      setIsLoadingApi(false);
    }
  }, []);

  // Merge live API variants with passed products catalog
  const mergedCatalog = useMemo(() => {
    const list: any[] = [];
    const seen = new Set<string>();

    // 1. Prioritize live API variants
    for (const v of liveApiProducts) {
      const key = (v.sku || v.barcode || v.code || v.id || "").toLowerCase();
      if (key && !seen.has(key)) {
        seen.add(key);
        list.push({
          id: v.id,
          code: v.sku || v.code || "",
          barcode: v.barcode || v.default_barcode || v.sku || "",
          name: v.name || v.description || "",
          category: v.category || "",
          brand: v.brand || "",
          styleCode: v.style_code || v.article_code || "",
          color: v.color || v.shade || "",
          size: v.size || "",
          sellingPrice: Number(v.selling_price || v.price || v.mrp || 0),
          mrp: Number(v.mrp || v.selling_price || 0),
          stock: Number(v.stock_quantity ?? v.available_qty ?? v.stock ?? 10),
          department: v.department || "",
          season: v.season || "",
          fabric: v.fabric || "",
          image: v.image_url || v.image || "",
          raw: v
        });
      }
    }

    // 2. Blend with passed products
    for (const p of products) {
      const key = (p.code || p.barcode || p.id || "").toLowerCase();
      if (key && !seen.has(key)) {
        seen.add(key);
        list.push({
          id: p.id,
          code: p.code || "",
          barcode: p.barcode || p.code || "",
          name: p.name || "",
          category: p.category || "",
          brand: p.brand || "",
          styleCode: (p as any).styleCode || (p as any).style || "",
          color: p.color || "",
          size: p.size || "",
          sellingPrice: Number(p.price || (p as any).sellingPrice || p.mrp || 0),
          mrp: Number(p.mrp || p.price || 0),
          stock: Number((p as any).stock ?? 10),
          department: (p as any).department || "",
          season: (p as any).season || "",
          fabric: (p as any).fabric || "",
          image: (p as any).image || "",
          raw: p
        });
      }
    }

    return list;
  }, [liveApiProducts, products]);

  // Multi-dimensional filtering
  const filteredItems = useMemo(() => {
    return mergedCatalog.filter(item => {
      // General Selection Filters
      if (filters.stockNo.trim() && !item.code.toLowerCase().includes(filters.stockNo.toLowerCase().trim())) {
        return false;
      }
      if (filters.description.trim() && !item.name.toLowerCase().includes(filters.description.toLowerCase().trim())) {
        return false;
      }
      if (filters.category.trim() && !item.category.toLowerCase().includes(filters.category.toLowerCase().trim())) {
        return false;
      }
      if (filters.brand.trim() && !item.brand.toLowerCase().includes(filters.brand.toLowerCase().trim())) {
        return false;
      }
      if (filters.styleCode.trim() && !item.styleCode.toLowerCase().includes(filters.styleCode.toLowerCase().trim())) {
        return false;
      }
      if (filters.color.trim() && !item.color.toLowerCase().includes(filters.color.toLowerCase().trim())) {
        return false;
      }
      if (filters.size.trim() && !item.size.toLowerCase().includes(filters.size.toLowerCase().trim())) {
        return false;
      }

      // Quantity / Balance stock evaluation
      const balanceQty = Number(item.stock || 0);
      if (filters.inStockOnly && balanceQty <= 0) {
        return false;
      }

      if (filters.qtyCondition === "Greater Than" && !(balanceQty > filters.qtyValue)) {
        return false;
      }
      if (filters.qtyCondition === "Is" && !(balanceQty === filters.qtyValue)) {
        return false;
      }
      if (filters.qtyCondition === "Less Than" && !(balanceQty < filters.qtyValue)) {
        return false;
      }

      // Advanced Selection Filters (Alt+A)
      if (filters.department.trim() && !item.department.toLowerCase().includes(filters.department.toLowerCase().trim())) {
        return false;
      }
      if (filters.season.trim() && !item.season.toLowerCase().includes(filters.season.toLowerCase().trim())) {
        return false;
      }
      if (filters.fabric.trim() && !item.fabric.toLowerCase().includes(filters.fabric.toLowerCase().trim())) {
        return false;
      }
      if (filters.minMrp && item.mrp < Number(filters.minMrp)) {
        return false;
      }
      if (filters.maxMrp && item.mrp > Number(filters.maxMrp)) {
        return false;
      }

      return true;
    });
  }, [mergedCatalog, filters]);

  const totalPages = Math.ceil(filteredItems.length / pageSize) || 1;
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredItems.slice(start, start + pageSize);
  }, [filteredItems, currentPage]);

  const selectedItem = paginatedItems[selectedRowIndex] || paginatedItems[0] || null;

  // Handle Commit Selection into Billing Terminal
  const handleCommitSelection = useCallback(() => {
    if (!selectedItem) return;
    const returnPayload: SmritiF2SelectedItem = {
      stockNo: selectedItem.code,
      barcode: selectedItem.barcode,
      name: selectedItem.name,
      rate: selectedItem.sellingPrice,
      mrp: selectedItem.mrp,
      brand: selectedItem.brand,
      category: selectedItem.category,
      styleCode: selectedItem.styleCode,
      color: selectedItem.color,
      size: selectedItem.size,
      stock: selectedItem.stock,
      image: selectedItem.image,
      rawRecord: selectedItem.raw
    };

    // Save query to last query cache
    try {
      localStorage.setItem(STORAGE_KEY_LAST_QUERY, JSON.stringify(filters));
    } catch { /* ignore */ }

    onSelectProduct(returnPayload);
    onClose();
  }, [selectedItem, filters, onSelectProduct, onClose]);

  // Save Settings Presets
  const handleSaveSettings = () => {
    try {
      localStorage.setItem(STORAGE_KEY_PRESETS, JSON.stringify(filters));
      alert("Filter settings saved as default preset for SMRITI F2 Item Search.");
    } catch (e) {
      console.error(e);
    }
  };

  // Clear Filter Criteria
  const handleClearFilters = () => {
    prevQueryRef.current = { ...filters };
    setFilters({
      ...DEFAULT_FILTER_STATE,
      inStockOnly: false,
    });
    setSelectedRowIndex(0);
    setCurrentPage(1);
    primaryInputRef.current?.focus();
  };

  // Recall Previous Search Criteria (Ctrl+Insert)
  const handleRecallPreviousSearch = () => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_LAST_QUERY);
      if (saved) {
        setFilters(JSON.parse(saved));
        setSelectedRowIndex(0);
        setCurrentPage(1);
      } else if (prevQueryRef.current) {
        setFilters(prevQueryRef.current);
      }
    } catch { /* ignore */ }
  };

  // Cycle Quantity Condition (Alt+R / F3)
  const handleCycleQtyCondition = () => {
    const conditions: QuantityCondition[] = ["Greater Than", "Is", "Less Than"];
    const idx = conditions.indexOf(filters.qtyCondition);
    const nextCond = conditions[(idx + 1) % conditions.length];
    setFilters(prev => ({ ...prev, qtyCondition: nextCond }));
  };

  // Comprehensive Keyboard Navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (paginatedItems.length > 0) {
        setSelectedRowIndex(prev => (prev + 1) % paginatedItems.length);
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (paginatedItems.length > 0) {
        setSelectedRowIndex(prev => (prev - 1 + paginatedItems.length) % paginatedItems.length);
      }
    } else if (e.key === "Enter") {
      e.preventDefault();
      handleCommitSelection();
    } else if (e.key === "PageDown") {
      e.preventDefault();
      setCurrentPage(p => Math.min(totalPages, p + 1));
      setSelectedRowIndex(0);
    } else if (e.key === "PageUp") {
      e.preventDefault();
      setCurrentPage(p => Math.max(1, p - 1));
      setSelectedRowIndex(0);
    } else if (e.altKey && (e.key === "a" || e.key === "A")) {
      e.preventDefault();
      setShowAdvanced(prev => !prev);
    } else if (e.altKey && (e.key === "q" || e.key === "Q")) {
      e.preventDefault();
      setFilters(prev => ({ ...prev, inStockOnly: !prev.inStockOnly }));
    } else if (e.altKey && (e.key === "i" || e.key === "I")) {
      e.preventDefault();
      setShowImageViewer(prev => !prev);
    } else if (e.altKey && (e.key === "r" || e.key === "R") || e.key === "F3") {
      e.preventDefault();
      handleCycleQtyCondition();
    } else if (e.ctrlKey && e.key === "Insert") {
      e.preventDefault();
      handleRecallPreviousSearch();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="SMRITI F2 Advanced Item Search"
      className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-900/70 backdrop-blur-xs p-3 font-sans select-none animate-fadeIn"
      onKeyDown={handleKeyDown}
      tabIndex={-1}
    >
      <div className="bg-[#fcfcff] dark:bg-[#191c24] text-[#1a1c22] dark:text-[#e2e2ec] w-full max-w-6xl h-[92vh] max-h-[820px] rounded-xl shadow-2xl border border-[#c4c6d4] dark:border-[#444654] flex flex-col overflow-hidden">
        
        {/* ── 1. HEADER (SMRITI Sapphire Standard) ────────────────────────── */}
        <header className="bg-[#00246b] dark:bg-[#00174a] text-white px-4 py-2.5 flex items-center justify-between shrink-0 shadow-md">
          <div className="flex items-center gap-3">
            <div className="p-1.5 bg-[#0040b0] rounded-md shadow-xs flex items-center justify-center">
              <Package size={17} className="text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold tracking-wide flex items-center gap-1.5">
                  <span>SMRITI F2 Advanced Item Search</span>
                  <span className="text-[11px] bg-[#0050dc] px-2 py-0.5 rounded font-mono font-semibold">
                    Retail OS
                  </span>
                </h2>
                <span className="text-xs text-blue-200">|</span>
                <span className="text-xs text-blue-100 font-mono">
                  {filteredItems.length} SKUs Identified
                </span>
              </div>
              <p className="text-[11px] text-blue-200 leading-tight">
                Multi-attribute catalog browse & store inventory availability inspection
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Quick Actions */}
            <button
              type="button"
              onClick={() => setFilters(prev => ({ ...prev, inStockOnly: !prev.inStockOnly }))}
              title="Toggle In-Stock Only (Alt+Q)"
              className={`px-2.5 py-1 text-xs rounded font-medium flex items-center gap-1.5 transition-colors ${
                filters.inStockOnly
                  ? "bg-emerald-600 text-white font-bold shadow-xs"
                  : "bg-blue-900/60 text-blue-200 hover:bg-blue-800"
              }`}
            >
              <CheckCircle2 size={13} />
              <span>In-Stock Only (Alt+Q)</span>
            </button>

            <button
              type="button"
              onClick={() => setShowAdvanced(prev => !prev)}
              title="Toggle Advanced Selection (Alt+A)"
              className={`px-2.5 py-1 text-xs rounded font-medium flex items-center gap-1.5 transition-colors ${
                showAdvanced
                  ? "bg-[#0050dc] text-white font-bold"
                  : "bg-blue-900/60 text-blue-200 hover:bg-blue-800"
              }`}
            >
              <SlidersHorizontal size={13} />
              <span>Advanced (Alt+A)</span>
              {showAdvanced ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            </button>

            <button
              type="button"
              onClick={() => setShowImageViewer(prev => !prev)}
              title="Toggle High-Value Image Preview (Alt+I)"
              className={`px-2.5 py-1 text-xs rounded font-medium flex items-center gap-1.5 transition-colors ${
                showImageViewer
                  ? "bg-[#0050dc] text-white font-bold"
                  : "bg-blue-900/60 text-blue-200 hover:bg-blue-800"
              }`}
            >
              <ImageIcon size={13} />
              <span>Image (Alt+I)</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1 hover:bg-white/20 rounded transition-colors text-white ml-2"
              title="Close (Esc)"
            >
              <X size={18} />
            </button>
          </div>
        </header>

        {/* ── 2. GENERAL SELECTION PANEL ────────────────────────────────────── */}
        <section className="bg-[#edeae1] dark:bg-[#1d202a] border-b border-[#c4c6d4] dark:border-[#444654] p-2.5 shrink-0 text-xs">
          <div className="grid grid-cols-1 md:grid-cols-7 gap-2 items-center">
            
            {/* Stock No */}
            <div>
              <label className="block text-[10px] font-bold text-slate-700 dark:text-slate-300 uppercase mb-0.5">
                Stock No
              </label>
              <input
                ref={primaryInputRef}
                type="text"
                value={filters.stockNo}
                onChange={e => setFilters({ ...filters, stockNo: e.target.value })}
                placeholder="Stock Number..."
                className="w-full h-7 px-2 bg-white dark:bg-[#131b2e] border border-slate-300 dark:border-slate-600 rounded text-xs font-mono font-bold outline-none focus:border-[#00246b] focus:ring-1 focus:ring-[#00246b]"
              />
            </div>

            {/* Item Desc */}
            <div className="col-span-1 md:col-span-2">
              <label className="block text-[10px] font-bold text-slate-700 dark:text-slate-300 uppercase mb-0.5">
                Item Description
              </label>
              <input
                type="text"
                value={filters.description}
                onChange={e => setFilters({ ...filters, description: e.target.value })}
                placeholder="Description or keywords..."
                className="w-full h-7 px-2 bg-white dark:bg-[#131b2e] border border-slate-300 dark:border-slate-600 rounded text-xs outline-none focus:border-[#00246b] focus:ring-1 focus:ring-[#00246b]"
              />
            </div>

            {/* Product (Category) */}
            <div>
              <label className="block text-[10px] font-bold text-slate-700 dark:text-slate-300 uppercase mb-0.5">
                Product / Category
              </label>
              <input
                type="text"
                value={filters.category}
                onChange={e => setFilters({ ...filters, category: e.target.value })}
                placeholder="e.g. Shirts, Denim..."
                className="w-full h-7 px-2 bg-white dark:bg-[#131b2e] border border-slate-300 dark:border-slate-600 rounded text-xs outline-none focus:border-[#00246b] focus:ring-1 focus:ring-[#00246b]"
              />
            </div>

            {/* Brand */}
            <div>
              <label className="block text-[10px] font-bold text-slate-700 dark:text-slate-300 uppercase mb-0.5">
                Brand
              </label>
              <input
                type="text"
                value={filters.brand}
                onChange={e => setFilters({ ...filters, brand: e.target.value })}
                placeholder="Brand name..."
                className="w-full h-7 px-2 bg-white dark:bg-[#131b2e] border border-slate-300 dark:border-slate-600 rounded text-xs outline-none focus:border-[#00246b] focus:ring-1 focus:ring-[#00246b]"
              />
            </div>

            {/* Style (Subclass 1) */}
            <div>
              <label className="block text-[10px] font-bold text-slate-700 dark:text-slate-300 uppercase mb-0.5">
                Style
              </label>
              <input
                type="text"
                value={filters.styleCode}
                onChange={e => setFilters({ ...filters, styleCode: e.target.value })}
                placeholder="Style Code..."
                className="w-full h-7 px-2 bg-white dark:bg-[#131b2e] border border-slate-300 dark:border-slate-600 rounded text-xs font-mono outline-none focus:border-[#00246b] focus:ring-1 focus:ring-[#00246b]"
              />
            </div>

            {/* Shade & Size Group */}
            <div className="flex gap-1">
              <div className="w-1/2">
                <label className="block text-[10px] font-bold text-slate-700 dark:text-slate-300 uppercase mb-0.5">
                  Shade
                </label>
                <input
                  type="text"
                  value={filters.color}
                  onChange={e => setFilters({ ...filters, color: e.target.value })}
                  placeholder="Color..."
                  className="w-full h-7 px-1.5 bg-white dark:bg-[#131b2e] border border-slate-300 dark:border-slate-600 rounded text-xs outline-none focus:border-[#00246b]"
                />
              </div>
              <div className="w-1/2">
                <label className="block text-[10px] font-bold text-slate-700 dark:text-slate-300 uppercase mb-0.5">
                  Size
                </label>
                <input
                  type="text"
                  value={filters.size}
                  onChange={e => setFilters({ ...filters, size: e.target.value })}
                  placeholder="Size..."
                  className="w-full h-7 px-1.5 bg-white dark:bg-[#131b2e] border border-slate-300 dark:border-slate-600 rounded text-xs outline-none focus:border-[#00246b]"
                />
              </div>
            </div>

          </div>

          {/* Sub-row: Quantity Condition & Memory buttons */}
          <div className="flex flex-wrap items-center justify-between gap-2 mt-2 pt-2 border-t border-slate-300 dark:border-slate-700/60">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400">
                Quantity Criteria (Alt+R):
              </span>
              <button
                type="button"
                onClick={handleCycleQtyCondition}
                className="px-2 py-0.5 bg-white dark:bg-[#131b2e] border border-slate-300 dark:border-slate-600 rounded text-xs font-semibold hover:border-[#00246b] flex items-center gap-1"
                title="Click or Alt+R to cycle: Greater Than -> Is -> Less Than"
              >
                <span>{filters.qtyCondition}</span>
                <span className="text-[10px] text-blue-600 dark:text-blue-400">⇄</span>
              </button>
              <input
                type="number"
                value={filters.qtyValue}
                onChange={e => setFilters({ ...filters, qtyValue: Number(e.target.value) })}
                className="w-14 h-6 px-1.5 bg-white dark:bg-[#131b2e] border border-slate-300 dark:border-slate-600 rounded text-xs font-mono text-center outline-none focus:border-[#00246b]"
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleRecallPreviousSearch}
                className="px-2 py-1 text-[11px] font-medium bg-white dark:bg-[#131b2e] border border-slate-300 dark:border-slate-600 rounded hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-1"
                title="Recall previous search conditions (Ctrl+Insert)"
              >
                <RotateCcw size={12} />
                <span>Recall (Ctrl+Insert)</span>
              </button>

              <button
                type="button"
                onClick={handleSaveSettings}
                className="px-2 py-1 text-[11px] font-medium bg-white dark:bg-[#131b2e] border border-slate-300 dark:border-slate-600 rounded hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-1"
                title="Save current filters as default setting"
              >
                <Save size={12} />
                <span>Save Setting</span>
              </button>

              <button
                type="button"
                onClick={handleClearFilters}
                className="px-2 py-1 text-[11px] font-medium text-red-600 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded hover:bg-red-100"
              >
                Clear
              </button>
            </div>
          </div>
        </section>

        {/* ── 3. ADVANCED SELECTION DRAWER (Alt+A) ──────────────────────────── */}
        {showAdvanced && (
          <section className="bg-[#f0f4ff] dark:bg-[#141d33] border-b border-[#c4c6d4] dark:border-[#444654] p-2.5 shrink-0 text-xs animate-fadeIn">
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-bold text-[11px] text-blue-900 dark:text-blue-300 flex items-center gap-1">
                <SlidersHorizontal size={13} />
                <span>Advanced Selection Criteria</span>
              </span>
              <span className="text-[10px] text-slate-500">
                Alt+A to collapse
              </span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              <div>
                <label className="block text-[10px] font-medium text-slate-600 dark:text-slate-400">
                  Department
                </label>
                <input
                  type="text"
                  value={filters.department}
                  onChange={e => setFilters({ ...filters, department: e.target.value })}
                  placeholder="e.g. Menswear, Kids..."
                  className="w-full h-6 px-1.5 bg-white dark:bg-[#131b2e] border border-slate-300 dark:border-slate-600 rounded text-xs"
                />
              </div>
              <div>
                <label className="block text-[10px] font-medium text-slate-600 dark:text-slate-400">
                  Min MRP (₹)
                </label>
                <input
                  type="number"
                  value={filters.minMrp}
                  onChange={e => setFilters({ ...filters, minMrp: e.target.value })}
                  placeholder="Min..."
                  className="w-full h-6 px-1.5 bg-white dark:bg-[#131b2e] border border-slate-300 dark:border-slate-600 rounded text-xs"
                />
              </div>
              <div>
                <label className="block text-[10px] font-medium text-slate-600 dark:text-slate-400">
                  Max MRP (₹)
                </label>
                <input
                  type="number"
                  value={filters.maxMrp}
                  onChange={e => setFilters({ ...filters, maxMrp: e.target.value })}
                  placeholder="Max..."
                  className="w-full h-6 px-1.5 bg-white dark:bg-[#131b2e] border border-slate-300 dark:border-slate-600 rounded text-xs"
                />
              </div>
              <div>
                <label className="block text-[10px] font-medium text-slate-600 dark:text-slate-400">
                  Season
                </label>
                <input
                  type="text"
                  value={filters.season}
                  onChange={e => setFilters({ ...filters, season: e.target.value })}
                  placeholder="e.g. AW26, SS26..."
                  className="w-full h-6 px-1.5 bg-white dark:bg-[#131b2e] border border-slate-300 dark:border-slate-600 rounded text-xs"
                />
              </div>
              <div>
                <label className="block text-[10px] font-medium text-slate-600 dark:text-slate-400">
                  Fabric / Fibre
                </label>
                <input
                  type="text"
                  value={filters.fabric}
                  onChange={e => setFilters({ ...filters, fabric: e.target.value })}
                  placeholder="Cotton, Linen..."
                  className="w-full h-6 px-1.5 bg-white dark:bg-[#131b2e] border border-slate-300 dark:border-slate-600 rounded text-xs"
                />
              </div>
            </div>
          </section>
        )}

        {/* ── 4. RESULTS TABLE & IMAGE PREVIEW SPLIT ────────────────────────── */}
        <div className="flex-1 flex overflow-hidden">
          
          {/* Table Container */}
          <div className="flex-1 flex flex-col overflow-hidden bg-white dark:bg-[#14161f]">
            <div className="flex-1 overflow-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead className="sticky top-0 bg-[#e4e7f3] dark:bg-[#202434] text-slate-800 dark:text-slate-200 border-b border-[#c4c6d4] dark:border-[#444654] font-bold text-[11px] select-none z-10">
                  <tr>
                    <th className="p-2 w-10 text-center">#</th>
                    <th className="p-2 w-32 font-mono">Stock No</th>
                    <th className="p-2 w-32 font-mono">Barcode</th>
                    <th className="p-2">Item Description</th>
                    <th className="p-2 w-24">Brand</th>
                    <th className="p-2 w-24">Style</th>
                    <th className="p-2 w-16 text-center">Size</th>
                    <th className="p-2 w-20 text-center">Color</th>
                    <th className="p-2 w-20 text-right">MRP (₹)</th>
                    <th className="p-2 w-20 text-right">Rate (₹)</th>
                    <th className="p-2 w-20 text-right">Avail Qty</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 font-mono">
                  {paginatedItems.map((item, idx) => {
                    const isSelected = idx === selectedRowIndex;
                    const isAvailable = item.stock > 0;
                    return (
                      <tr
                        key={`${item.code}-${item.barcode}-${idx}`}
                        onClick={() => setSelectedRowIndex(idx)}
                        onDoubleClick={handleCommitSelection}
                        className={`cursor-pointer transition-colors ${
                          isSelected
                            ? "bg-[#00246b] text-white dark:bg-[#1a3880]"
                            : idx % 2 === 0
                            ? "bg-white dark:bg-[#14161f] hover:bg-slate-50 dark:hover:bg-slate-800/50"
                            : "bg-[#f9fafc] dark:bg-[#171923] hover:bg-slate-50 dark:hover:bg-slate-800/50"
                        }`}
                      >
                        <td className="p-2 text-center text-[11px] opacity-70">
                          {(currentPage - 1) * pageSize + idx + 1}
                        </td>
                        <td className="p-2 font-bold truncate">{item.code}</td>
                        <td className="p-2 text-slate-500 dark:text-slate-400 font-mono text-[11px] truncate">
                          {isSelected ? (
                            <span className="text-white">{item.barcode}</span>
                          ) : (
                            item.barcode
                          )}
                        </td>
                        <td className="p-2 font-sans font-medium truncate max-w-xs" title={item.name}>
                          {item.name}
                        </td>
                        <td className="p-2 font-sans truncate">{item.brand || "—"}</td>
                        <td className="p-2 truncate">{item.styleCode || "—"}</td>
                        <td className="p-2 text-center font-bold">{item.size || "—"}</td>
                        <td className="p-2 text-center font-sans">{item.color || "—"}</td>
                        <td className="p-2 text-right">
                          ₹{item.mrp.toFixed(2)}
                        </td>
                        <td className="p-2 text-right font-bold text-emerald-600 dark:text-emerald-400">
                          {isSelected ? (
                            <span className="text-white">₹{item.sellingPrice.toFixed(2)}</span>
                          ) : (
                            `₹${item.sellingPrice.toFixed(2)}`
                          )}
                        </td>
                        <td className="p-2 text-right">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              isSelected
                                ? "bg-white/20 text-white"
                                : isAvailable
                                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                                : "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                            }`}
                          >
                            {item.stock}
                          </span>
                        </td>
                      </tr>
                    );
                  })}

                  {paginatedItems.length === 0 && (
                    <tr>
                      <td colSpan={11} className="p-10 text-center text-slate-400">
                        <Package size={28} className="mx-auto mb-2 opacity-40" />
                        <p className="font-sans font-semibold">No items match the provided search criteria.</p>
                        <p className="text-[11px] font-sans mt-1">Press Clear or uncheck 'In-Stock Only' to expand search.</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Table Bottom Navigation Bar */}
            <div className="px-4 py-2 bg-[#edeae1] dark:bg-[#1d202a] border-t border-[#c4c6d4] dark:border-[#444654] flex items-center justify-between text-xs shrink-0 select-none">
              <div className="flex items-center gap-2">
                <span className="text-slate-600 dark:text-slate-400">
                  Page {currentPage} of {totalPages}
                </span>
                <span className="text-slate-400">|</span>
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  Showing {paginatedItems.length} of {filteredItems.length} records
                </span>
                {isLoadingApi && (
                  <span className="text-[11px] text-blue-600 dark:text-blue-400 animate-pulse ml-2">
                    Syncing live inventory...
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={currentPage <= 1}
                  onClick={() => { setCurrentPage(p => Math.max(1, p - 1)); setSelectedRowIndex(0); }}
                  className="px-2 py-1 bg-white dark:bg-[#131b2e] border border-slate-300 dark:border-slate-600 rounded disabled:opacity-40 hover:bg-slate-50"
                >
                  Previous (PgUp)
                </button>
                <button
                  type="button"
                  disabled={currentPage >= totalPages}
                  onClick={() => { setCurrentPage(p => Math.min(totalPages, p + 1)); setSelectedRowIndex(0); }}
                  className="px-2 py-1 bg-white dark:bg-[#131b2e] border border-slate-300 dark:border-slate-600 rounded disabled:opacity-40 hover:bg-slate-50"
                >
                  Next (PgDn)
                </button>
              </div>
            </div>
          </div>

          {/* ── 5. HIGH-VALUE IMAGE VIEWER (Alt+I) ──────────────────────────── */}
          {showImageViewer && (
            <aside className="w-64 bg-[#f8fafc] dark:bg-[#11131a] border-l border-[#c4c6d4] dark:border-[#444654] p-3 flex flex-col shrink-0">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
                <span className="font-bold text-xs flex items-center gap-1 text-slate-700 dark:text-slate-300">
                  <Eye size={13} />
                  <span>Image Preview</span>
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setZoomLevel(z => Math.min(2, z + 0.25))}
                    className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded text-slate-600"
                    title="Zoom In"
                  >
                    <Maximize2 size={12} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setZoomLevel(z => Math.max(0.75, z - 0.25))}
                    className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded text-slate-600"
                    title="Zoom Out"
                  >
                    <Minimize2 size={12} />
                  </button>
                </div>
              </div>

              <div className="flex-1 flex items-center justify-center overflow-hidden my-2 bg-white dark:bg-[#1e2029] rounded border border-slate-200 dark:border-slate-800 relative">
                {selectedItem?.image ? (
                  <img
                    src={selectedItem.image}
                    alt={selectedItem.name}
                    style={{ transform: `scale(${zoomLevel})` }}
                    className="max-h-56 object-contain transition-transform duration-150"
                  />
                ) : (
                  <div className="text-center text-slate-400 p-4">
                    <ImageIcon size={32} className="mx-auto mb-1 opacity-40" />
                    <p className="text-[11px]">No image attached to item master</p>
                  </div>
                )}
              </div>

              {selectedItem && (
                <div className="text-xs bg-white dark:bg-[#1a1c24] p-2 rounded border border-slate-200 dark:border-slate-800 text-[11px] space-y-1">
                  <p className="font-bold text-slate-900 dark:text-slate-100 truncate">{selectedItem.name}</p>
                  <p className="text-slate-500 font-mono">SKU: {selectedItem.code}</p>
                  <p className="text-slate-500">Rate: <span className="font-bold text-emerald-600">₹{selectedItem.sellingPrice.toFixed(2)}</span></p>
                  <p className="text-slate-500">Available: <span className="font-bold">{selectedItem.stock} units</span></p>
                </div>
              )}
            </aside>
          )}

        </div>

        {/* ── 6. BOTTOM FOOTER & KEYBOARD LEGEND ───────────────────────────── */}
        <footer className="bg-[#e4e7f3] dark:bg-[#161822] px-4 py-2 border-t border-[#c4c6d4] dark:border-[#444654] flex items-center justify-between shrink-0 text-xs select-none">
          <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-600 dark:text-slate-400 font-mono">
            <span><kbd className="px-1.5 py-0.5 bg-white dark:bg-slate-800 border rounded shadow-xs font-bold text-slate-800 dark:text-slate-200">Enter</kbd> Select & Insert</span>
            <span><kbd className="px-1.5 py-0.5 bg-white dark:bg-slate-800 border rounded shadow-xs font-bold text-slate-800 dark:text-slate-200">↑/↓</kbd> Row</span>
            <span><kbd className="px-1.5 py-0.5 bg-white dark:bg-slate-800 border rounded shadow-xs font-bold text-slate-800 dark:text-slate-200">Alt+Q</kbd> In-Stock</span>
            <span><kbd className="px-1.5 py-0.5 bg-white dark:bg-slate-800 border rounded shadow-xs font-bold text-slate-800 dark:text-slate-200">Alt+A</kbd> Advanced</span>
            <span><kbd className="px-1.5 py-0.5 bg-white dark:bg-slate-800 border rounded shadow-xs font-bold text-slate-800 dark:text-slate-200">Alt+R/F3</kbd> Criteria</span>
            <span><kbd className="px-1.5 py-0.5 bg-white dark:bg-slate-800 border rounded shadow-xs font-bold text-slate-800 dark:text-slate-200">Esc</kbd> Close</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium rounded hover:bg-slate-300 transition-colors"
            >
              Cancel (Esc)
            </button>
            <button
              type="button"
              disabled={!selectedItem}
              onClick={handleCommitSelection}
              className="px-4 py-1 bg-[#00246b] hover:bg-[#00174a] text-white font-bold rounded shadow-sm disabled:opacity-50 flex items-center gap-1.5 transition-colors"
            >
              <Check size={14} />
              <span>Select & Drop to Invoice (Enter)</span>
            </button>
          </div>
        </footer>

      </div>
    </div>
  );
};
