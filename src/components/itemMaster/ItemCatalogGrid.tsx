/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.69.0
 * Created      : 2026-08-21
 * Modified     : 2026-10-04
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import React, { useState, useMemo, useEffect, useCallback } from "react";
import {
  Search,
  Plus,
  SlidersHorizontal,
  MoreVertical,
  FileSpreadsheet,
  RefreshCw,
  Upload,
  Package,
  Copy,
  Check,
  Printer,
  Download,
  X,
  Eye,
  Calendar,
  Sparkles,
  History,
  ChevronDown,
  RotateCcw,
  Tag,
  Clock,
} from "lucide-react";
import { Product } from "../../types.ts";
import { AddProductDrawer } from "./AddProductDrawer.tsx";
import { VariantEditModal } from "./modals/VariantEditModal.tsx";
import { BatchBarcodePrintModal } from "./modals/BatchBarcodePrintModal.tsx";
import { ImportBatchManager, ImportBatchRecord } from "../../services/importBatchManager.ts";

// ── Types ─────────────────────────────────────────────────────────────────────

export type QuickFilterType = "ALL" | "FOOTWEAR" | "JUST_IMPORTED" | "NO_BARCODE" | "NO_PRICE" | "INACTIVE";
export type DateFilterType = "ALL" | "TODAY" | "YESTERDAY" | "LAST_7_DAYS" | "LAST_30_DAYS" | "THIS_MONTH" | "CUSTOM";

interface SmritiItemCatalogGridProps {
  products: Product[];
  onRefreshProducts?: () => Promise<void>;
  onNotification?: (title: string, message: string, type?: "success" | "error" | "info" | "warning") => void;
  onNavigateToPaste?: () => void;
  currentUser?: { role: string; name: string } | null;
  productCategory?: string; // e.g. "Footwear"
  onAddNew?: () => void;
  mode?: "SIMPLE" | "HYBRID" | "ADVANCED";
  onSelectMode?: (mode: "SIMPLE" | "HYBRID" | "ADVANCED") => void;
  activeImportBatch?: ImportBatchRecord | null;
  initialQuickFilter?: QuickFilterType;
}

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

// ── Helpers ───────────────────────────────────────────────────────────────────

function getAttr(p: Product, key: string): string {
  return String((p.attributes as any)?.[key] ?? (p as any)[key] ?? "");
}

function formatINR(val: number | undefined | null): string {
  if (val === null || val === undefined || isNaN(Number(val))) return "—";
  return Number(val).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDateTime(val?: string | Date): string {
  if (!val) return "—";
  try {
    const d = new Date(val);
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    });
  } catch {
    return "—";
  }
}

function matchBatchFilter(p: Product, batch: ImportBatchRecord | null): boolean {
  if (!batch) return true;
  const itemCodes = new Set((batch.itemCodes || []).map(c => c.toLowerCase()));
  const barcodes = new Set((batch.barcodes || []).map(b => b.toLowerCase()));

  if (p.code && itemCodes.has(p.code.toLowerCase())) return true;
  if (p.sku && itemCodes.has(p.sku.toLowerCase())) return true;
  if (p.barcode && barcodes.has(p.barcode.toLowerCase())) return true;
  if (Array.isArray(p.secondaryBarcodes) && p.secondaryBarcodes.some(b => barcodes.has(b.toLowerCase()))) return true;

  // Proximity fallback (if batch created recently)
  if (batch.timestamp && (p.createdAt || p.created_at)) {
    const bt = new Date(batch.timestamp).getTime();
    const it = new Date(p.createdAt || p.created_at || "").getTime();
    if (!isNaN(bt) && !isNaN(it) && Math.abs(bt - it) <= 15 * 60 * 1000) {
      return true;
    }
  }

  return false;
}

const renderMutedDash = () => (
  <span className="text-slate-300 dark:text-slate-600 font-mono text-[11px] select-none">—</span>
);

const FilterChip: React.FC<{ label: string; onClear: () => void }> = ({ label, onClear }) => (
  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 animate-in fade-in duration-100">
    <span>{label}</span>
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onClear(); }}
      className="w-3.5 h-3.5 rounded-full hover:bg-blue-200 dark:hover:bg-blue-800 flex items-center justify-center text-blue-600 dark:text-blue-300 transition cursor-pointer"
      title="Remove filter"
    >
      <X size={10} />
    </button>
  </span>
);

// ── Component ─────────────────────────────────────────────────────────────────

export const ItemCatalogGrid: React.FC<SmritiItemCatalogGridProps> = ({
  products = [],
  onRefreshProducts,
  onNotification,
  onNavigateToPaste,
  currentUser,
  productCategory = "Footwear",
  onAddNew,
  mode = "HYBRID",
  onSelectMode,
  activeImportBatch,
  initialQuickFilter,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [quickFilter, setQuickFilter] = useState<QuickFilterType>(() => {
    if (initialQuickFilter) return initialQuickFilter;
    if (activeImportBatch) return "JUST_IMPORTED";
    return "ALL";
  });
  const [dateFilter, setDateFilter] = useState<DateFilterType>("ALL");
  const [dateFilterField, setDateFilterField] = useState<"created" | "modified">("created");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(() => activeImportBatch?.batchId || null);
  const [isBatchHistoryOpen, setIsBatchHistoryOpen] = useState(false);

  const [filterCategory, setFilterCategory] = useState("All");
  const [filterBrand, setFilterBrand] = useState("All");
  const [filterGender, setFilterGender] = useState("All");
  const [filterProductType, setFilterProductType] = useState("All");
  const [filterStatus, setFilterStatus] = useState("All");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedVariantForEdit, setSelectedVariantForEdit] = useState<Product | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const [showMoreFilters, setShowMoreFilters] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<{ url: string; name: string } | null>(null);

  // Barcode Label Print Queue Modal
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [printModalProducts, setPrintModalProducts] = useState<Product[]>([]);
  const [printModalTitle, setPrintModalTitle] = useState("Batch Barcodes");

  // React to new active import batch coming from parent
  useEffect(() => {
    if (activeImportBatch) {
      setSelectedBatchId(activeImportBatch.batchId);
      setQuickFilter("JUST_IMPORTED");
    }
  }, [activeImportBatch]);

  // Reset page when filters change
  useEffect(() => { 
    setPageIndex(0); 
  }, [searchQuery, quickFilter, dateFilter, customStartDate, customEndDate, selectedBatchId, filterCategory, filterBrand, filterGender, filterProductType, filterStatus]);

  // Recent import batches from storage
  const recentBatches = useMemo(() => ImportBatchManager.getRecentBatches(), [activeImportBatch, isBatchHistoryOpen]);
  const currentBatch = useMemo(() => {
    if (selectedBatchId) return ImportBatchManager.getBatchById(selectedBatchId);
    return activeImportBatch || ImportBatchManager.getLatestBatch();
  }, [selectedBatchId, activeImportBatch]);

  // Quick preset counts
  const footwearCount = useMemo(() => products.filter(p => (p.category || "").toLowerCase() === "footwear").length, [products]);
  const missingBarcodeCount = useMemo(() => products.filter(p => !p.barcode || p.barcode.trim() === "").length, [products]);
  const noPriceCount = useMemo(() => products.filter(p => p.mrp == null && p.price == null).length, [products]);
  const inactiveCount = useMemo(() => products.filter(p => p.isActive === false || (p as any).is_active === false).length, [products]);
  const justImportedCount = useMemo(() => {
    if (!currentBatch) return 0;
    return products.filter(p => matchBatchFilter(p, currentBatch)).length;
  }, [products, currentBatch]);

  // Unique filter values
  const categories = useMemo(() => [...new Set(products.map(p => p.category).filter(Boolean))], [products]);
  const brands = useMemo(() => [...new Set(products.map(p => p.brand).filter(Boolean))], [products]);
  const genders = useMemo(() => [...new Set(products.map(p => getAttr(p, "gender")).filter(Boolean))], [products]);
  const productTypes = useMemo(() => [...new Set(products.map(p => getAttr(p, "product_type")).filter(Boolean))], [products]);

  // Active filters check
  const hasActiveFilters = useMemo(() => {
    return (
      quickFilter !== "ALL" ||
      dateFilter !== "ALL" ||
      filterCategory !== "All" ||
      filterBrand !== "All" ||
      filterGender !== "All" ||
      filterProductType !== "All" ||
      filterStatus !== "All" ||
      searchQuery.trim() !== "" ||
      selectedBatchId !== null
    );
  }, [quickFilter, dateFilter, filterCategory, filterBrand, filterGender, filterProductType, filterStatus, searchQuery, selectedBatchId]);

  const handleClearAllFilters = () => {
    setQuickFilter("ALL");
    setDateFilter("ALL");
    setCustomStartDate("");
    setCustomEndDate("");
    setSelectedBatchId(null);
    setFilterCategory("All");
    setFilterBrand("All");
    setFilterGender("All");
    setFilterProductType("All");
    setFilterStatus("All");
    setSearchQuery("");
  };

  // Filtered products
  const filtered = useMemo(() => {
    return products.filter(p => {
      // 1. Quick presets
      if (quickFilter === "FOOTWEAR" && (p.category || "").toLowerCase() !== "footwear") return false;
      if (quickFilter === "NO_BARCODE" && p.barcode && p.barcode.trim() !== "") return false;
      if (quickFilter === "NO_PRICE" && (p.mrp != null || p.price != null)) return false;
      if (quickFilter === "INACTIVE" && (p.isActive !== false && (p as any).is_active !== false)) return false;

      // 1b. Just Imported Batch filter
      if (quickFilter === "JUST_IMPORTED" || selectedBatchId) {
        const batchToMatch = selectedBatchId ? ImportBatchManager.getBatchById(selectedBatchId) : currentBatch;
        if (batchToMatch && !matchBatchFilter(p, batchToMatch)) {
          return false;
        }
      }

      // 2. Date Filtering
      if (dateFilter !== "ALL") {
        const dateStr = dateFilterField === "modified"
          ? (p.modifiedAt || p.modified_at || p.updatedAt || p.updated_at || p.createdAt || p.created_at)
          : (p.createdAt || p.created_at);

        if (!dateStr) return false;
        const itemDate = new Date(dateStr);
        if (isNaN(itemDate.getTime())) return false;

        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const itemDayStart = new Date(itemDate.getFullYear(), itemDate.getMonth(), itemDate.getDate());

        if (dateFilter === "TODAY") {
          if (itemDayStart.getTime() !== todayStart.getTime()) return false;
        } else if (dateFilter === "YESTERDAY") {
          const yesterdayStart = new Date(todayStart);
          yesterdayStart.setDate(yesterdayStart.getDate() - 1);
          if (itemDayStart.getTime() !== yesterdayStart.getTime()) return false;
        } else if (dateFilter === "LAST_7_DAYS") {
          const sevenDaysAgo = new Date(todayStart);
          sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
          if (itemDayStart.getTime() < sevenDaysAgo.getTime() || itemDayStart.getTime() > todayStart.getTime()) return false;
        } else if (dateFilter === "LAST_30_DAYS") {
          const thirtyDaysAgo = new Date(todayStart);
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);
          if (itemDayStart.getTime() < thirtyDaysAgo.getTime() || itemDayStart.getTime() > todayStart.getTime()) return false;
        } else if (dateFilter === "THIS_MONTH") {
          if (itemDate.getFullYear() !== now.getFullYear() || itemDate.getMonth() !== now.getMonth()) return false;
        } else if (dateFilter === "CUSTOM") {
          if (customStartDate) {
            const start = new Date(customStartDate);
            start.setHours(0, 0, 0, 0);
            if (itemDate < start) return false;
          }
          if (customEndDate) {
            const end = new Date(customEndDate);
            end.setHours(23, 59, 59, 999);
            if (itemDate > end) return false;
          }
        }
      }

      // 3. Structured dropdown filters
      if (filterCategory !== "All" && p.category !== filterCategory) return false;
      if (filterBrand !== "All" && p.brand !== filterBrand) return false;
      if (filterGender !== "All" && getAttr(p, "gender") !== filterGender) return false;
      if (filterProductType !== "All" && getAttr(p, "product_type") !== filterProductType) return false;
      if (filterStatus !== "All") {
        const active = p.isActive !== false && (p as any).is_active !== false;
        if (filterStatus === "Active" && !active) return false;
        if (filterStatus === "Inactive" && active) return false;
      }

      // 4. Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          (p.code || "").toLowerCase().includes(q) ||
          (p.name || "").toLowerCase().includes(q) ||
          (p.barcode || "").toLowerCase().includes(q) ||
          (p.brand || "").toLowerCase().includes(q) ||
          Object.values(p.attributes || {}).some(v => String(v).toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [products, quickFilter, selectedBatchId, currentBatch, dateFilter, dateFilterField, customStartDate, customEndDate, filterCategory, filterBrand, filterGender, filterProductType, filterStatus, searchQuery]);

  // Pagination
  const totalPages = Math.ceil(filtered.length / pageSize) || 1;
  const paginated = filtered.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize);

  const allSelected = paginated.length > 0 && paginated.every(p => selectedIds.has(p.id || p.code));

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(prev => { 
        const next = new Set(prev); 
        paginated.forEach(p => next.delete(p.id || p.code)); 
        return next; 
      });
    } else {
      setSelectedIds(prev => { 
        const next = new Set(prev); 
        paginated.forEach(p => next.add(p.id || p.code)); 
        return next; 
      });
    }
  };

  const toggleRow = (id: string) => {
    setSelectedIds(prev => { 
      const next = new Set(prev); 
      next.has(id) ? next.delete(id) : next.add(id); 
      return next; 
    });
  };

  const copyToClipboard = (text: string, label: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!text || text === "—") return;
    navigator.clipboard.writeText(text);
    setCopiedCode(text);
    setTimeout(() => setCopiedCode(null), 1500);
    onNotification?.("Copied", `${label} "${text}" copied to clipboard.`, "info");
  };

  const handleExport = () => {
    if (filtered.length === 0) { 
      onNotification?.("No Data", "No products to export.", "error"); 
      return; 
    }
    const headers = ["SKU", "Barcode", "Name", "Brand", "Category", "Gender", "Product Type", "Article", "Color", "Size", "HSN", "Retail Price", "Dealer Price", "Cost Price", "GST%", "Status"];
    const rows = filtered.map(p => [
      p.code, p.barcode || "", `"${p.name}"`, p.brand || "", p.category || "",
      getAttr(p, "gender"), getAttr(p, "product_type"), getAttr(p, "article"),
      p.color || getAttr(p, "color"), p.size || getAttr(p, "size"),
      (p as any).hsn_code || p.hsnCode || "",
      p.mrp || p.price || "", p.buyingPrice || "", p.costPrice || "",
      (p as any).gst_percentage ?? p.gstPercentage ?? "",
      p.isActive !== false ? "Active" : "Inactive"
    ]);
    const csv = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `SMRITI_Products_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    onNotification?.("Export Ready", `${filtered.length} products exported.`, "success");
  };

  const handleBulkExportSelected = () => {
    const selectedProds = products.filter(p => selectedIds.has(p.id || p.code));
    if (selectedProds.length === 0) return;
    const headers = ["SKU", "Barcode", "Name", "Brand", "Category", "Gender", "Product Type", "Article", "Color", "Size", "HSN", "Retail Price", "Dealer Price", "Cost Price", "GST%", "Status"];
    const rows = selectedProds.map(p => [
      p.code, p.barcode || "", `"${p.name}"`, p.brand || "", p.category || "",
      getAttr(p, "gender"), getAttr(p, "product_type"), getAttr(p, "article"),
      p.color || getAttr(p, "color"), p.size || getAttr(p, "size"),
      (p as any).hsn_code || p.hsnCode || "",
      p.mrp || p.price || "", p.buyingPrice || "", p.costPrice || "",
      (p as any).gst_percentage ?? p.gstPercentage ?? "",
      p.isActive !== false ? "Active" : "Inactive"
    ]);
    const csv = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `SMRITI_Selected_${selectedProds.length}_Products_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    onNotification?.("Export Ready", `${selectedProds.length} selected products exported.`, "success");
  };

  const handleBulkPrintBarcodes = () => {
    const selectedProds = products.filter(p => selectedIds.has(p.id || p.code));
    if (selectedProds.length === 0) return;
    setPrintModalProducts(selectedProds);
    setPrintModalTitle(`Selected ${selectedProds.length} Products`);
    setIsPrintModalOpen(true);
  };

  const handleRefresh = async () => {
    if (!onRefreshProducts) return;
    setIsRefreshing(true);
    try { await onRefreshProducts(); } finally { setIsRefreshing(false); }
  };

  return (
    <div className="h-full flex flex-col bg-[#f7f9fb] dark:bg-[#191c1e] font-sans overflow-hidden relative">

      {/* ── Top Header ──────────────────────────────────────────────────── */}
      <div className="shrink-0 px-5 pt-4 pb-2.5">
        <div className="flex items-center justify-between gap-4">
          {/* Title Area */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-[#eff6ff] dark:bg-[#1d3054] flex items-center justify-center shrink-0 shadow-xs">
              <span className="text-xl">👟</span>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold text-[#0f172a] dark:text-white truncate">
                  {productCategory} Products
                </h1>
                
                {/* Mode Segmented Pill */}
                {onSelectMode && (
                  <div className="inline-flex items-center bg-[#f1f3ff] dark:bg-[#1e293b] p-0.5 rounded-lg border border-[#cbd5e1] dark:border-[#334155] text-[11px] ml-1">
                    {(["SIMPLE", "HYBRID", "ADVANCED"] as const).map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => onSelectMode(m)}
                        className={`px-2 py-0.5 rounded-md font-bold transition cursor-pointer ${
                          mode === m
                            ? "bg-blue-600 text-white shadow-xs"
                            : "text-[#64748b] dark:text-[#94a3b8] hover:text-[#0f172a] dark:hover:text-white"
                        }`}
                        title={`Switch grid to ${m.toLowerCase()} view`}
                      >
                        {m.charAt(0) + m.slice(1).toLowerCase()}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <p className="text-xs text-[#64748b] dark:text-[#94a3b8] truncate">
                {mode === "SIMPLE" 
                  ? "Fast floor & billing lookup view (SKU, Barcode, Size, MRP)."
                  : mode === "HYBRID"
                  ? "Merchandiser view: style specs, commercial pricing, and category filters."
                  : "Full accounting & audit view: cost margins, HSN tax lines, and inventory parameters."}
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 shrink-0 relative">
            <button
              type="button"
              onClick={onAddNew || (() => setIsDrawerOpen(true))}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#2563eb] text-white text-xs font-bold hover:bg-[#1d4ed8] transition shadow-xs cursor-pointer"
            >
              <Plus size={14} />
              <span>Add Article</span>
            </button>
            <button
              type="button"
              onClick={onNavigateToPaste}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#16a34a] text-[#16a34a] dark:text-[#4ade80] bg-white dark:bg-[#2d3133] hover:bg-[#f0fdf4] dark:hover:bg-[#1a2e1a] text-xs font-bold transition cursor-pointer"
            >
              <FileSpreadsheet size={14} />
              <span>Excel Import</span>
            </button>
            <button
              type="button"
              onClick={handleExport}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#cbd5e1] dark:border-[#434654] text-[#374151] dark:text-[#e2e8f0] bg-white dark:bg-[#2d3133] hover:bg-[#f1f5f9] dark:hover:bg-[#1c1f26] text-xs font-semibold transition cursor-pointer"
            >
              <Upload size={14} />
              <span>Export</span>
            </button>
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsMoreMenuOpen(!isMoreMenuOpen)}
                className="w-8 h-8 flex items-center justify-center rounded-lg border border-[#cbd5e1] dark:border-[#434654] bg-white dark:bg-[#2d3133] hover:bg-[#f1f5f9] dark:hover:bg-[#1c1f26] transition text-[#64748b] cursor-pointer"
                title="More Options"
              >
                <MoreVertical size={15} />
              </button>

              {/* Overflow Menu */}
              {isMoreMenuOpen && (
                <div
                  className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-[#1e293b] border border-[#e2e8f0] dark:border-[#334155] rounded-xl shadow-xl py-1.5 z-30 text-xs font-medium"
                  onClick={() => setIsMoreMenuOpen(false)}
                >
                  <button
                    type="button"
                    onClick={handleRefresh}
                    className="w-full text-left px-3.5 py-2 hover:bg-[#f1f5f9] dark:hover:bg-[#334155] flex items-center gap-2 text-[#0f172a] dark:text-white"
                  >
                    <RefreshCw size={13} />
                    <span>Refresh Articles</span>
                  </button>
                  <button
                    type="button"
                    onClick={onNavigateToPaste}
                    className="sm:hidden w-full text-left px-3.5 py-2 hover:bg-[#f1f5f9] dark:hover:bg-[#334155] flex items-center gap-2 text-[#16a34a]"
                  >
                    <FileSpreadsheet size={13} />
                    <span>Copy From Excel</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleExport}
                    className="sm:hidden w-full text-left px-3.5 py-2 hover:bg-[#f1f5f9] dark:hover:bg-[#334155] flex items-center gap-2 text-[#0f172a] dark:text-white"
                  >
                    <Upload size={13} />
                    <span>Export CSV</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Quick Smart Filter Pills ──────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-1.5 px-5 pb-2">
        <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mr-1">Quick:</span>
        {[
          { id: "ALL", label: `All`, count: products.length },
          ...(currentBatch ? [{ id: "JUST_IMPORTED", label: `✨ Just Imported`, count: justImportedCount, alert: false, isSpecial: true }] : []),
          { id: "FOOTWEAR", label: `👟 Footwear`, count: footwearCount },
          { id: "NO_BARCODE", label: `⚠️ Missing Barcode`, count: missingBarcodeCount, alert: missingBarcodeCount > 0 },
          { id: "NO_PRICE", label: `🏷️ Unset Price`, count: noPriceCount, alert: noPriceCount > 0 },
          { id: "INACTIVE", label: `🔴 Inactive`, count: inactiveCount },
        ].map((pill) => (
          <button
            key={pill.id}
            type="button"
            onClick={() => setQuickFilter(pill.id as any)}
            className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold transition flex items-center gap-1.5 cursor-pointer ${
              quickFilter === pill.id
                ? pill.id === "JUST_IMPORTED"
                  ? "bg-indigo-600 text-white shadow-xs font-bold"
                  : "bg-blue-600 text-white shadow-xs"
                : (pill as any).isSpecial
                ? "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100"
                : pill.alert
                ? "bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 hover:bg-amber-100"
                : "bg-white dark:bg-[#2d3133] text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50"
            }`}
          >
            <span>{pill.label}</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
              quickFilter === pill.id ? "bg-white/20 text-white" : "bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300"
            }`}>
              {pill.count}
            </span>
          </button>
        ))}
      </div>

      {/* ── Just Imported Isolation Banner ─────────────────────────────────── */}
      {quickFilter === "JUST_IMPORTED" && currentBatch && (
        <div className="mx-5 mb-2.5 px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/40 dark:to-indigo-950/40 border border-blue-200 dark:border-blue-800 flex flex-wrap items-center justify-between gap-3 text-xs animate-in fade-in duration-150 shadow-xs">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold shrink-0 shadow-xs">
              <Sparkles size={16} />
            </div>
            <div>
              <div className="font-bold text-blue-950 dark:text-blue-100 flex items-center gap-2">
                <span>Active Import Batch: {currentBatch.summary}</span>
                <span className="px-2 py-0.2 rounded-full bg-blue-600 text-white font-mono text-[10px]">
                  {filtered.length} Items
                </span>
              </div>
              <div className="text-[11px] text-blue-700 dark:text-blue-300">
                Imported at {formatDateTime(currentBatch.timestamp)} • Filter is isolating only items from this session.
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setPrintModalProducts(filtered);
                setPrintModalTitle(currentBatch.summary);
                setIsPrintModalOpen(true);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold transition shadow-xs cursor-pointer"
            >
              <Printer size={13} />
              <span>Print Barcode Labels</span>
            </button>
            <button
              type="button"
              onClick={handleExport}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-blue-200 dark:border-blue-700 hover:bg-blue-50 dark:hover:bg-slate-700 text-blue-800 dark:text-blue-200 font-semibold transition cursor-pointer"
            >
              <Download size={13} />
              <span>Export Batch CSV</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setQuickFilter("ALL");
                setSelectedBatchId(null);
              }}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition cursor-pointer"
              title="Clear batch filter and show all products"
            >
              <X size={13} />
              <span>Show All</span>
            </button>
          </div>
        </div>
      )}

      {/* ── Active Filter Chips Summary Bar ───────────────────────────────── */}
      {hasActiveFilters && (
        <div className="flex flex-wrap items-center gap-1.5 px-5 pb-2">
          <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mr-1">Active:</span>
          {quickFilter !== "ALL" && (
            <FilterChip
              label={`Preset: ${quickFilter === "JUST_IMPORTED" ? "Just Imported" : quickFilter.replace("_", " ")}`}
              onClear={() => { setQuickFilter("ALL"); setSelectedBatchId(null); }}
            />
          )}
          {dateFilter !== "ALL" && (
            <FilterChip
              label={`Date: ${dateFilter.replace(/_/g, " ")}${dateFilter === "CUSTOM" && (customStartDate || customEndDate) ? ` (${customStartDate || "Start"} to ${customEndDate || "End"})` : ""}`}
              onClear={() => { setDateFilter("ALL"); setCustomStartDate(""); setCustomEndDate(""); }}
            />
          )}
          {filterCategory !== "All" && (
            <FilterChip label={`Category: ${filterCategory}`} onClear={() => setFilterCategory("All")} />
          )}
          {filterBrand !== "All" && (
            <FilterChip label={`Brand: ${filterBrand}`} onClear={() => setFilterBrand("All")} />
          )}
          {filterGender !== "All" && (
            <FilterChip label={`Gender: ${filterGender}`} onClear={() => setFilterGender("All")} />
          )}
          {filterProductType !== "All" && (
            <FilterChip label={`Type: ${filterProductType}`} onClear={() => setFilterProductType("All")} />
          )}
          {filterStatus !== "All" && (
            <FilterChip label={`Status: ${filterStatus}`} onClear={() => setFilterStatus("All")} />
          )}
          {searchQuery.trim() && (
            <FilterChip label={`Search: "${searchQuery}"`} onClear={() => setSearchQuery("")} />
          )}
          <button
            type="button"
            onClick={handleClearAllFilters}
            className="text-[11px] font-semibold text-rose-600 dark:text-rose-400 hover:underline px-2 py-0.5 ml-1 flex items-center gap-1 cursor-pointer"
          >
            <RotateCcw size={11} />
            <span>Clear All</span>
          </button>
        </div>
      )}

      {/* ── Search & Filter Bar ─────────────────────────────────────────── */}
      <div className="shrink-0 px-5 pb-2.5">
        <div className="flex flex-wrap gap-2 items-center">
          {/* Search */}
          <div className="relative flex-1 min-w-[220px]">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94a3b8]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search SKU, name, brand, article, model, size, color, HSN..."
              className="w-full pl-8 pr-3 py-1.5 bg-white dark:bg-[#2d3133] border border-[#e2e8f0] dark:border-[#45464d] rounded-lg text-xs text-[#0f172a] dark:text-[#e2e8f0] outline-none focus:ring-2 focus:ring-[#2563eb]/30 focus:border-[#2563eb] transition placeholder:text-[#94a3b8]"
            />
          </div>

          {/* Primary Filters: Category, Brand */}
          <FilterSelect label="Category" value={filterCategory} onChange={setFilterCategory} options={["All", ...categories as string[]]} />
          <FilterSelect label="Brand" value={filterBrand} onChange={setFilterBrand} options={["All", ...brands as string[]]} />

          {/* Date Range Selector */}
          <div className="relative">
            <div className="flex items-center gap-1.5 bg-white dark:bg-[#2d3133] border border-[#e2e8f0] dark:border-[#45464d] rounded-lg px-2.5 py-1.5 text-xs text-[#0f172a] dark:text-[#e2e8f0]">
              <Calendar size={13} className="text-[#94a3b8]" />
              <span className="text-[10px] text-slate-400 uppercase font-bold">Date:</span>
              <select
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value as any)}
                className="bg-transparent outline-none font-semibold text-xs cursor-pointer text-slate-700 dark:text-slate-200"
              >
                <option value="ALL">All Time</option>
                <option value="TODAY">Today</option>
                <option value="YESTERDAY">Yesterday</option>
                <option value="LAST_7_DAYS">Last 7 Days</option>
                <option value="LAST_30_DAYS">Last 30 Days</option>
                <option value="THIS_MONTH">This Month</option>
                <option value="CUSTOM">Custom Range...</option>
              </select>
            </div>
          </div>

          {/* Custom Date Pickers (visible if CUSTOM selected) */}
          {dateFilter === "CUSTOM" && (
            <div className="flex items-center gap-1.5 bg-white dark:bg-[#2d3133] border border-blue-400 dark:border-blue-600 rounded-lg px-2 py-1 text-xs">
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="bg-transparent outline-none text-xs font-mono text-slate-700 dark:text-slate-200"
                placeholder="Start Date"
              />
              <span className="text-slate-400 text-xs">to</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="bg-transparent outline-none text-xs font-mono text-slate-700 dark:text-slate-200"
                placeholder="End Date"
              />
            </div>
          )}

          {/* Import Batches History Dropdown */}
          {recentBatches.length > 0 && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsBatchHistoryOpen(!isBatchHistoryOpen)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition cursor-pointer ${
                  selectedBatchId || quickFilter === "JUST_IMPORTED"
                    ? "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700"
                    : "border-[#e2e8f0] dark:border-[#45464d] bg-white dark:bg-[#2d3133] text-[#374151] dark:text-[#e2e8f0] hover:bg-[#f1f5f9]"
                }`}
                title="Filter Catalog by recent import batch sessions"
              >
                <History size={13} />
                <span>Import Batches ({recentBatches.length})</span>
                <ChevronDown size={12} />
              </button>

              {isBatchHistoryOpen && (
                <div className="absolute right-0 mt-1 w-72 bg-white dark:bg-[#1e222b] rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 py-1.5 z-30 animate-in fade-in duration-100">
                  <div className="px-3 py-1.5 border-b border-slate-100 dark:border-slate-700/60 flex items-center justify-between text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    <span>Recent Import Sessions</span>
                    <button
                      type="button"
                      onClick={() => {
                        ImportBatchManager.clearAllBatches();
                        setSelectedBatchId(null);
                        setQuickFilter("ALL");
                        setIsBatchHistoryOpen(false);
                      }}
                      className="text-[10px] text-rose-500 hover:underline normal-case font-normal cursor-pointer"
                    >
                      Clear History
                    </button>
                  </div>
                  <div className="max-h-60 overflow-auto divide-y divide-slate-100 dark:divide-slate-800">
                    {recentBatches.map((b) => (
                      <button
                        key={b.batchId}
                        type="button"
                        onClick={() => {
                          setSelectedBatchId(b.batchId);
                          setQuickFilter("JUST_IMPORTED");
                          setIsBatchHistoryOpen(false);
                        }}
                        className={`w-full text-left px-3.5 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 flex flex-col gap-0.5 transition ${
                          selectedBatchId === b.batchId ? "bg-blue-50/70 dark:bg-blue-900/20" : ""
                        }`}
                      >
                        <div className="flex items-center justify-between text-xs font-semibold text-slate-900 dark:text-white">
                          <span className="truncate max-w-[170px]">{b.summary}</span>
                          <span className="px-1.5 py-0.2 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-mono text-[10px]">
                            {b.savedCount} items
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          {formatDateTime(b.timestamp)}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Secondary Filters (Responsive / Toggleable) */}
          <div className={`${showMoreFilters ? "flex" : "hidden md:flex"} flex-wrap gap-2 items-center`}>
            <FilterSelect label="Gender" value={filterGender} onChange={setFilterGender} options={["All", ...genders]} />
            <FilterSelect label="Product Type" value={filterProductType} onChange={setFilterProductType} options={["All", ...productTypes]} />
            <FilterSelect label="Status" value={filterStatus} onChange={setFilterStatus} options={["All", "Active", "Inactive"]} />
          </div>

          {/* More Filters Toggle */}
          <button
            type="button"
            onClick={() => setShowMoreFilters(!showMoreFilters)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition cursor-pointer ${
              showMoreFilters
                ? "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700"
                : "border-[#e2e8f0] dark:border-[#45464d] bg-white dark:bg-[#2d3133] text-[#374151] dark:text-[#e2e8f0] hover:bg-[#f1f5f9]"
            }`}
          >
            <SlidersHorizontal size={13} />
            <span>More Filters</span>
          </button>
          <button 
            type="button" 
            onClick={handleRefresh} 
            className={`w-7 h-7 flex items-center justify-center rounded-lg border border-[#e2e8f0] dark:border-[#45464d] bg-white dark:bg-[#2d3133] hover:bg-[#f1f5f9] dark:hover:bg-[#1c1f26] transition text-[#64748b] cursor-pointer ${isRefreshing ? "animate-spin" : ""}`}
            title="Refresh Catalog Data"
          >
            <RefreshCw size={13} />
          </button>
        </div>
      </div>

      {/* ── Table ───────────────────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 px-5 pb-0 overflow-hidden flex flex-col">
        <div className="flex-1 overflow-auto bg-white dark:bg-[#2d3133] border border-[#e2e8f0] dark:border-[#45464d] rounded-xl shadow-xs">
          <table className={`w-full text-left border-collapse ${mode === "SIMPLE" ? "min-w-full lg:min-w-[900px]" : mode === "HYBRID" ? "min-w-[1220px]" : "min-w-[1450px]"}`}>
            <thead className="sticky top-0 z-10 bg-[#f8fafc] dark:bg-[#131b2e] border-b border-[#e2e8f0] dark:border-[#45464d]">
              <tr>
                <Th className="w-10 text-center">
                  <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} className="rounded accent-[#2563eb]" />
                </Th>
                <Th className="w-12 text-center">Image</Th>
                <Th>SKU / Item Code</Th>
                <Th>Barcode</Th>
                <Th>{mode === "SIMPLE" ? "Product & Article" : "Product Name"}</Th>
                
                {mode !== "SIMPLE" && (
                  <>
                    <Th>Brand</Th>
                    <Th>Category</Th>
                    <Th>Gender</Th>
                    <Th>Product Type</Th>
                    <Th>Article / Design</Th>
                  </>
                )}

                <Th className="text-center">{mode === "SIMPLE" ? "Size / Color" : "Size (UK/EU)"}</Th>
                {mode !== "SIMPLE" && <Th>Color / Shade</Th>}

                {/* Retail Price (MRP) Promoted to Primary Fold */}
                <Th className="text-right bg-blue-50/60 dark:bg-blue-950/20 text-blue-900 dark:text-blue-300">Retail Price (₹)</Th>
                
                {mode !== "SIMPLE" && (
                  <>
                    <Th className="text-right">Dealer Price (₹)</Th>
                    <Th className="text-center">GST (%)</Th>
                  </>
                )}

                {mode === "ADVANCED" && (
                  <>
                    <Th className="text-right">Cost Price (₹)</Th>
                    <Th className="text-right">Last Purchase Price (₹)</Th>
                    <Th>HSN Code</Th>
                  </>
                )}

                <Th className="text-center whitespace-nowrap">Date Added</Th>
                <Th className="text-center">Status</Th>
                <Th className="text-center w-14">Actions</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f1f5f9] dark:divide-[#2d3133]">
              {paginated.length === 0 ? (
                <tr>
                  <td colSpan={22} className="text-center py-16 text-[#94a3b8]">
                    <Package size={40} className="mx-auto mb-3 opacity-20" />
                    <p className="text-sm font-semibold">No products found</p>
                    <p className="text-xs mt-1">Try adjusting your filters or add a new product.</p>
                  </td>
                </tr>
              ) : (
                paginated.map((p, idx) => {
                  const isSelected = selectedIds.has(p.id || p.code);
                  const gender = getAttr(p, "gender");
                  const productType = getAttr(p, "product_type");
                  const article = getAttr(p, "article") || (p as any).style_code || p.styleCode || "";
                  const color = p.color || getAttr(p, "color") || getAttr(p, "shade") || "";
                  const size = p.size || getAttr(p, "size") || "";
                  const hsnCode = (p as any).hsn_code || p.hsnCode || "";
                  const retailPrice = p.mrp || p.price;
                  const dealerPrice = p.buyingPrice;
                  const costPrice = p.costPrice;
                  const lastPurchasePrice = getAttr(p, "last_purchase_price");
                  const gstPct = p.gstPercentage;
                  const isActive = p.isActive !== false;

                  return (
                    <tr
                      key={p.id || `prod-${idx}`}
                      className={`text-xs transition-colors ${isSelected ? "bg-[#eff6ff] dark:bg-[#1d3054]/30" : "hover:bg-[#f8fafc] dark:hover:bg-[#1c1f26]"}`}
                    >
                      {/* Checkbox */}
                      <Td className="text-center" onClick={(e) => e.stopPropagation()}>
                        <input type="checkbox" checked={isSelected} onChange={() => toggleRow(p.id || p.code)} className="rounded accent-[#2563eb]" />
                      </Td>

                      {/* Image Thumbnail with Hover Zoom */}
                      <Td className="text-center">
                        <div 
                          className="w-8 h-8 mx-auto rounded-lg bg-[#f1f5f9] dark:bg-[#2d3133] border border-[#e2e8f0] dark:border-[#45464d] flex items-center justify-center overflow-hidden cursor-pointer relative group"
                          onMouseEnter={() => p.primaryImageUrl && setPreviewImage({ url: p.primaryImageUrl, name: p.name })}
                          onMouseLeave={() => setPreviewImage(null)}
                        >
                          {p.primaryImageUrl ? (
                            <img src={p.primaryImageUrl} alt={p.name} className="w-full h-full object-cover" />
                          ) : (
                            <Package size={14} className="text-[#94a3b8]" />
                          )}
                        </div>
                      </Td>

                      {/* SKU / Code with 1-Click Copy */}
                      <Td>
                        <div className="group/copy flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => { setSelectedVariantForEdit(p); setIsEditModalOpen(true); }}
                            className="font-mono font-bold text-[#2563eb] dark:text-[#93c5fd] text-[11px] hover:underline cursor-pointer truncate max-w-[150px]"
                            title="Click to edit item"
                          >
                            {p.code}
                          </button>
                          <button
                            type="button"
                            onClick={(e) => copyToClipboard(p.code, "SKU", e)}
                            className="opacity-0 group-hover/copy:opacity-100 transition p-0.5 hover:bg-blue-100 dark:hover:bg-blue-900/40 rounded text-slate-400 hover:text-blue-600"
                            title="Copy SKU to clipboard"
                          >
                            {copiedCode === p.code ? <Check size={11} className="text-green-600" /> : <Copy size={11} />}
                          </button>
                        </div>
                      </Td>

                      {/* Barcode with 1-Click Copy */}
                      <Td>
                        <div className="group/copy flex items-center gap-1.5">
                          <span className="font-mono text-[11px] text-[#64748b] tracking-wider">
                            {p.barcode || renderMutedDash()}
                          </span>
                          {p.barcode && (
                            <button
                              type="button"
                              onClick={(e) => copyToClipboard(p.barcode, "Barcode", e)}
                              className="opacity-0 group-hover/copy:opacity-100 transition p-0.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-slate-400 hover:text-blue-600"
                              title="Copy Barcode to clipboard"
                            >
                              {copiedCode === p.barcode ? <Check size={11} className="text-green-600" /> : <Copy size={11} />}
                            </button>
                          )}
                        </div>
                      </Td>

                      {/* Product Name (& Article in Simple Mode) */}
                      <Td>
                        <div className="max-w-[220px]">
                          <span className="font-semibold text-[#0f172a] dark:text-white truncate block">{p.name}</span>
                          {mode === "SIMPLE" && article && (
                            <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 block">
                              Art: {article}
                            </span>
                          )}
                        </div>
                      </Td>

                      {/* Hybrid / Advanced Attribute Columns */}
                      {mode !== "SIMPLE" && (
                        <>
                          <Td>{p.brand || renderMutedDash()}</Td>
                          <Td>{p.category || renderMutedDash()}</Td>
                          <Td>{gender || renderMutedDash()}</Td>
                          <Td>{productType || renderMutedDash()}</Td>
                          <Td><span className="font-mono font-semibold">{article || renderMutedDash()}</span></Td>
                        </>
                      )}

                      {/* Size & Color */}
                      {mode === "SIMPLE" ? (
                        <Td className="text-center">
                          <div className="inline-flex flex-col items-center">
                            <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                              {size || renderMutedDash()}
                            </span>
                            {color && (
                              <span className="text-[10px] text-slate-500 dark:text-slate-400 max-w-[80px] truncate">
                                {color}
                              </span>
                            )}
                          </div>
                        </Td>
                      ) : (
                        <>
                          <Td className="text-center"><span className="font-mono font-bold">{size || renderMutedDash()}</span></Td>
                          <Td>{color || renderMutedDash()}</Td>
                        </>
                      )}

                      {/* Retail Price (MRP) Promoted to Primary Fold */}
                      <Td className="text-right font-mono font-bold text-[#0f172a] dark:text-[#e2e8f0] bg-blue-50/30 dark:bg-blue-950/10">
                        {formatINR(retailPrice)}
                      </Td>

                      {/* Dealer Price & GST (Hybrid & Advanced) */}
                      {mode !== "SIMPLE" && (
                        <>
                          <Td className="text-right font-mono text-[#64748b]">{formatINR(dealerPrice)}</Td>
                          <Td className="text-center">{gstPct != null ? `${gstPct}%` : renderMutedDash()}</Td>
                        </>
                      )}

                      {/* Cost Price, Last Purchase Price, HSN (Advanced Only) */}
                      {mode === "ADVANCED" && (
                        <>
                          <Td className="text-right font-mono text-[#64748b]">{formatINR(costPrice)}</Td>
                          <Td className="text-right font-mono text-[#64748b]">{lastPurchasePrice ? formatINR(parseFloat(lastPurchasePrice)) : renderMutedDash()}</Td>
                          <Td><span className="font-mono text-[#64748b]">{hsnCode || renderMutedDash()}</span></Td>
                        </>
                      )}

                      {/* Date Added */}
                      <Td className="text-center font-mono text-[11px] text-slate-500 dark:text-slate-400 whitespace-nowrap">
                        {formatDateTime(p.createdAt || p.created_at)}
                      </Td>

                      {/* Status */}
                      <Td className="text-center">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                          isActive
                            ? "bg-[#dcfce7] text-[#15803d] dark:bg-[#14532d]/40 dark:text-[#4ade80]"
                            : "bg-[#fef2f2] text-[#dc2626] dark:bg-[#450a0a]/40 dark:text-[#f87171]"
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${isActive ? "bg-[#16a34a]" : "bg-[#dc2626]"}`} />
                          {isActive ? "Active" : "Inactive"}
                        </span>
                      </Td>

                      {/* Actions */}
                      <Td className="text-center">
                        <button
                          type="button"
                          onClick={() => { setSelectedVariantForEdit(p); setIsEditModalOpen(true); }}
                          className="w-6 h-6 flex items-center justify-center rounded hover:bg-[#f1f5f9] dark:hover:bg-[#2d3133] transition text-[#64748b] mx-auto cursor-pointer"
                          title="Edit Variant (Commercial & Barcodes)"
                        >
                          <MoreVertical size={14} />
                        </button>
                      </Td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* ── Contextual Floating Bulk Action Bar ────────────────────────── */}
        {selectedIds.size > 0 && (
          <div className="absolute bottom-14 left-1/2 -translate-x-1/2 z-30 bg-[#0f172a] text-white px-4 py-2 rounded-xl shadow-2xl border border-slate-700 flex items-center gap-3 animate-in fade-in slide-in-from-bottom-2 duration-150">
            <div className="flex items-center gap-2 pr-3 border-r border-slate-700">
              <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[11px] font-bold flex items-center justify-center">
                {selectedIds.size}
              </span>
              <span className="text-xs font-semibold">selected</span>
            </div>
            <button
              type="button"
              onClick={handleBulkPrintBarcodes}
              className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-semibold flex items-center gap-1.5 transition text-white shadow-xs cursor-pointer"
            >
              <Printer size={13} />
              <span>Print Barcodes</span>
            </button>
            <button
              type="button"
              onClick={handleBulkExportSelected}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium flex items-center gap-1.5 transition text-slate-200 cursor-pointer"
            >
              <Download size={13} />
              <span>Export Selected</span>
            </button>
            <button
              type="button"
              onClick={() => setSelectedIds(new Set())}
              className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition ml-1 cursor-pointer"
              title="Clear selection"
            >
              <X size={15} />
            </button>
          </div>
        )}

        {/* ── Image Hover Lightbox Popup ─────────────────────────────────── */}
        {previewImage && (
          <div className="fixed bottom-16 left-20 z-40 p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl pointer-events-none">
            <img src={previewImage.url} alt={previewImage.name} className="w-44 h-44 object-cover rounded-lg" />
            <p className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 mt-1 max-w-[176px] truncate text-center">
              {previewImage.name}
            </p>
          </div>
        )}

        {/* ── Pagination Bar ────────────────────────────────────────────── */}
        <div className="shrink-0 py-2.5 flex items-center justify-between text-xs text-[#64748b] dark:text-[#94a3b8]">
          <span>
            Showing {filtered.length === 0 ? 0 : pageIndex * pageSize + 1} to{" "}
            {Math.min((pageIndex + 1) * pageSize, filtered.length)} of {filtered.length} products
          </span>
          <div className="flex items-center gap-2">
            {/* Page size */}
            <select
              value={pageSize}
              onChange={(e) => { setPageSize(Number(e.target.value)); setPageIndex(0); }}
              className="px-2 py-1 rounded border border-[#e2e8f0] dark:border-[#45464d] bg-white dark:bg-[#2d3133] text-xs outline-none"
            >
              {PAGE_SIZE_OPTIONS.map(s => <option key={s} value={s}>{s} / page</option>)}
            </select>

            {/* Page buttons */}
            <div className="flex items-center gap-1">
              <PageBtn onClick={() => setPageIndex(0)} disabled={pageIndex === 0} label="«" />
              <PageBtn onClick={() => setPageIndex(i => Math.max(0, i - 1))} disabled={pageIndex === 0} label="‹" />
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let page = i;
                if (totalPages > 5 && pageIndex > 2) {
                  page = Math.min(totalPages - 5 + i, pageIndex - 2 + i);
                }
                return (
                  <button
                    key={page}
                    type="button"
                    onClick={() => setPageIndex(page)}
                    className={`w-7 h-7 rounded flex items-center justify-center text-[11px] font-semibold transition ${
                      pageIndex === page
                        ? "bg-[#2563eb] text-white"
                        : "bg-white dark:bg-[#2d3133] border border-[#e2e8f0] dark:border-[#45464d] text-[#374151] dark:text-[#e2e8f0] hover:bg-[#f1f5f9]"
                    }`}
                  >
                    {page + 1}
                  </button>
                );
              })}
              {totalPages > 5 && <span className="px-1">...</span>}
              {totalPages > 5 && (
                <button
                  type="button"
                  onClick={() => setPageIndex(totalPages - 1)}
                  className={`w-7 h-7 rounded flex items-center justify-center text-[11px] font-semibold transition ${
                    pageIndex === totalPages - 1
                      ? "bg-[#2563eb] text-white"
                      : "bg-white dark:bg-[#2d3133] border border-[#e2e8f0] dark:border-[#45464d] text-[#374151] dark:text-[#e2e8f0] hover:bg-[#f1f5f9]"
                  }`}
                >
                  {totalPages}
                </button>
              )}
              <PageBtn onClick={() => setPageIndex(i => Math.min(totalPages - 1, i + 1))} disabled={pageIndex >= totalPages - 1} label="›" />
              <PageBtn onClick={() => setPageIndex(totalPages - 1)} disabled={pageIndex >= totalPages - 1} label="»" />
            </div>
          </div>
        </div>
      </div>

      {/* ── Add Product Drawer ───────────────────────────────────────────── */}
      <AddProductDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        onSaved={() => { void onRefreshProducts?.(); }}
        onNotification={onNotification}
        productType={productCategory}
        mode={mode}
      />

      {/* ── Variant Detail / Edit Modal (Panel 6) ────────────────────────── */}
      <VariantEditModal
        isOpen={isEditModalOpen}
        onClose={() => { setIsEditModalOpen(false); setSelectedVariantForEdit(null); }}
        product={selectedVariantForEdit}
        onUpdated={() => { void onRefreshProducts?.(); }}
        onNotification={onNotification}
      />

      {/* ── Batch Barcode Label Print Modal ───────────────────────────────── */}
      <BatchBarcodePrintModal
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        products={printModalProducts}
        batchTitle={printModalTitle}
        onNotification={onNotification}
      />
    </div>
  );
};

// ── Sub-Components ─────────────────────────────────────────────────────────────

const Th: React.FC<{ children?: React.ReactNode; className?: string }> = ({ children, className = "" }) => (
  <th className={`px-3 py-2 text-[10px] font-bold text-[#64748b] dark:text-[#94a3b8] uppercase tracking-wider whitespace-nowrap ${className}`}>
    {children}
  </th>
);

const Td: React.FC<{ children?: React.ReactNode; className?: string; onClick?: (e: React.MouseEvent) => void }> = ({ children, className = "", onClick }) => (
  <td className={`px-3 py-2 text-xs text-[#374151] dark:text-[#cbd5e1] whitespace-nowrap ${className}`} onClick={onClick}>
    {children}
  </td>
);

const FilterSelect: React.FC<{
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
}> = ({ label, value, onChange, options }) => (
  <div className="relative">
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="appearance-none pl-3 pr-7 py-1.5 rounded-lg border border-[#e2e8f0] dark:border-[#45464d] bg-white dark:bg-[#2d3133] text-xs font-semibold text-[#374151] dark:text-[#e2e8f0] outline-none focus:ring-2 focus:ring-[#2563eb]/30 focus:border-[#2563eb] transition cursor-pointer"
    >
      {options.map((opt) => (
        <option key={opt} value={opt}>
          {opt === "All" ? `${label}: All` : opt}
        </option>
      ))}
    </select>
    <span className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-[#94a3b8]">▾</span>
  </div>
);

const PageBtn: React.FC<{ onClick: () => void; disabled: boolean; label: string }> = ({ onClick, disabled, label }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className="w-7 h-7 rounded flex items-center justify-center text-[11px] font-bold bg-white dark:bg-[#2d3133] border border-[#e2e8f0] dark:border-[#45464d] text-[#374151] dark:text-[#e2e8f0] hover:bg-[#f1f5f9] disabled:opacity-30 disabled:cursor-not-allowed transition"
  >
    {label}
  </button>
);

export default ItemCatalogGrid;
