/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 5.0.0
 * Created      : 2026-08-21
 * Modified     : 2026-09-28
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import React, { useState, useMemo, useEffect } from "react";
import {
  Search,
  Plus,
  SlidersHorizontal,
  Columns3,
  MoreVertical,
  FileSpreadsheet,
  RefreshCw,
  Upload,
  Package,
} from "lucide-react";
import { Product } from "../../types.ts";
import { AddProductDrawer } from "./AddProductDrawer.tsx";

// ── Types ─────────────────────────────────────────────────────────────────────

interface SmritiItemCatalogGridProps {
  products: Product[];
  onRefreshProducts?: () => Promise<void>;
  onNotification?: (title: string, message: string, type?: "success" | "error") => void;
  onNavigateToPaste?: () => void;
  currentUser?: { role: string; name: string } | null;
  productCategory?: string; // e.g. "Footwear"
  onAddNew?: () => void;
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

// ── Component ─────────────────────────────────────────────────────────────────

export const ItemCatalogGrid: React.FC<SmritiItemCatalogGridProps> = ({
  products = [],
  onRefreshProducts,
  onNotification,
  onNavigateToPaste,
  currentUser,
  productCategory = "Footwear",
  onAddNew,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
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

  // Reset page when filters change
  useEffect(() => { setPageIndex(0); }, [searchQuery, filterCategory, filterBrand, filterGender, filterProductType, filterStatus]);

  // Unique filter values
  const categories = useMemo(() => [...new Set(products.map(p => p.category).filter(Boolean))], [products]);
  const brands = useMemo(() => [...new Set(products.map(p => p.brand).filter(Boolean))], [products]);
  const genders = useMemo(() => [...new Set(products.map(p => getAttr(p, "gender")).filter(Boolean))], [products]);
  const productTypes = useMemo(() => [...new Set(products.map(p => getAttr(p, "product_type")).filter(Boolean))], [products]);

  // Filtered products
  const filtered = useMemo(() => {
    return products.filter(p => {
      if (filterCategory !== "All" && p.category !== filterCategory) return false;
      if (filterBrand !== "All" && p.brand !== filterBrand) return false;
      if (filterGender !== "All" && getAttr(p, "gender") !== filterGender) return false;
      if (filterProductType !== "All" && getAttr(p, "product_type") !== filterProductType) return false;
      if (filterStatus !== "All") {
        const active = (p as any).is_active !== false;
        if (filterStatus === "Active" && !active) return false;
        if (filterStatus === "Inactive" && active) return false;
      }
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
  }, [products, filterCategory, filterBrand, filterGender, filterProductType, filterStatus, searchQuery]);

  // Pagination
  const totalPages = Math.ceil(filtered.length / pageSize);
  const paginated = filtered.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize);

  const allSelected = paginated.length > 0 && paginated.every(p => selectedIds.has(p.id || p.code));

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(prev => { const next = new Set(prev); paginated.forEach(p => next.delete(p.id || p.code)); return next; });
    } else {
      setSelectedIds(prev => { const next = new Set(prev); paginated.forEach(p => next.add(p.id || p.code)); return next; });
    }
  };

  const toggleRow = (id: string) => {
    setSelectedIds(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  };

  const handleExport = () => {
    if (filtered.length === 0) { onNotification?.("No Data", "No products to export.", "error"); return; }
    const headers = ["SKU", "Barcode", "Name", "Brand", "Category", "Gender", "Product Type", "Article", "Color", "Size", "HSN", "Retail Price", "Dealer Price", "Cost Price", "GST%", "Status"];
    const rows = filtered.map(p => [
      p.code, p.barcode, `"${p.name}"`, p.brand, p.category,
      getAttr(p, "gender"), getAttr(p, "product_type"), getAttr(p, "article"),
      p.color || getAttr(p, "color"), p.size || getAttr(p, "size"),
      (p as any).hsn_code || p.hsnCode,
      p.mrp, (p as any).buying_price, (p as any).cost_price,
      (p as any).gst_percentage ?? p.gstPercentage,
      (p as any).is_active !== false ? "Active" : "Inactive"
    ]);
    const csv = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `SMRITI_Products_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    onNotification?.("Export Ready", `${filtered.length} products exported.`, "success");
  };

  const handleRefresh = async () => {
    if (!onRefreshProducts) return;
    setIsRefreshing(true);
    try { await onRefreshProducts(); } finally { setIsRefreshing(false); }
  };

  return (
    <div className="h-full flex flex-col bg-[#f7f9fb] dark:bg-[#191c1e] font-sans overflow-hidden">

      {/* ── Top Header ──────────────────────────────────────────────────── */}
      <div className="shrink-0 px-5 pt-5 pb-3">
        <div className="flex items-start justify-between gap-4">
          {/* Title Area */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-[#eff6ff] dark:bg-[#1d3054] flex items-center justify-center shrink-0">
              <span className="text-2xl">👟</span>
            </div>
            <div className="min-w-0">
              <h1 className="text-lg font-bold text-[#0f172a] dark:text-white truncate">
                {productCategory} Products
              </h1>
              <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mt-0.5 truncate">
                Manage your {productCategory.toLowerCase()} article / design master, pricing, tax and inventory information.
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onAddNew || (() => setIsDrawerOpen(true))}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#2563eb] text-white text-xs font-bold hover:bg-[#1d4ed8] transition shadow-sm"
            >
              <Plus size={14} />
              Add Article / Design
            </button>
            <button
              type="button"
              onClick={onNavigateToPaste}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg border-2 border-[#16a34a] text-[#16a34a] dark:text-[#4ade80] bg-white dark:bg-[#2d3133] hover:bg-[#f0fdf4] dark:hover:bg-[#1a2e1a] text-xs font-bold transition"
            >
              <FileSpreadsheet size={14} />
              Copy From Excel
            </button>
            <button
              type="button"
              onClick={handleExport}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-[#cbd5e1] dark:border-[#2d3133] text-[#374151] dark:text-[#e2e8f0] bg-white dark:bg-[#2d3133] hover:bg-[#f1f5f9] dark:hover:bg-[#1c1f26] text-xs font-semibold transition"
            >
              <Upload size={14} />
              Export
            </button>
            <button
              type="button"
              className="w-8 h-8 flex items-center justify-center rounded-lg border border-[#cbd5e1] dark:border-[#2d3133] bg-white dark:bg-[#2d3133] hover:bg-[#f1f5f9] dark:hover:bg-[#1c1f26] transition text-[#64748b]"
            >
              <MoreVertical size={15} />
            </button>
          </div>
        </div>
      </div>

      {/* ── Filter Bar ──────────────────────────────────────────────────── */}
      <div className="shrink-0 px-5 pb-3">
        <div className="flex flex-wrap gap-2 items-center">
          {/* Search */}
          <div className="relative flex-1 min-w-[260px]">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94a3b8]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by SKU, product name, brand, article, design, model, size, color, HSN..."
              className="w-full pl-8 pr-3 py-2 bg-white dark:bg-[#2d3133] border border-[#e2e8f0] dark:border-[#45464d] rounded-lg text-xs text-[#0f172a] dark:text-[#e2e8f0] outline-none focus:ring-2 focus:ring-[#2563eb]/30 focus:border-[#2563eb] transition placeholder:text-[#94a3b8]"
            />
          </div>

          {/* Category */}
          <FilterSelect label="Category" value={filterCategory} onChange={setFilterCategory} options={["All", ...categories as string[]]} />
          {/* Brand */}
          <FilterSelect label="Brand" value={filterBrand} onChange={setFilterBrand} options={["All", ...brands as string[]]} />
          {/* Gender */}
          <FilterSelect label="Gender" value={filterGender} onChange={setFilterGender} options={["All", ...genders]} />
          {/* Product Type */}
          <FilterSelect label="Product Type" value={filterProductType} onChange={setFilterProductType} options={["All", ...productTypes]} />
          {/* Status */}
          <FilterSelect label="Status" value={filterStatus} onChange={setFilterStatus} options={["All", "Active", "Inactive"]} />

          {/* More Filters & Columns */}
          <button type="button" className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[#e2e8f0] dark:border-[#45464d] bg-white dark:bg-[#2d3133] text-xs font-semibold text-[#374151] dark:text-[#e2e8f0] hover:bg-[#f1f5f9] dark:hover:bg-[#1c1f26] transition">
            <SlidersHorizontal size={13} />
            More Filters
          </button>
          <button type="button" className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[#e2e8f0] dark:border-[#45464d] bg-white dark:bg-[#2d3133] text-xs font-semibold text-[#374151] dark:text-[#e2e8f0] hover:bg-[#f1f5f9] dark:hover:bg-[#1c1f26] transition">
            <Columns3 size={13} />
            Columns
          </button>
          <button type="button" onClick={handleRefresh} className={`w-8 h-8 flex items-center justify-center rounded-lg border border-[#e2e8f0] dark:border-[#45464d] bg-white dark:bg-[#2d3133] hover:bg-[#f1f5f9] dark:hover:bg-[#1c1f26] transition text-[#64748b] ${isRefreshing ? "animate-spin" : ""}`}>
            <RefreshCw size={13} />
          </button>
        </div>
      </div>

      {/* ── Table ───────────────────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 px-5 pb-0 overflow-hidden flex flex-col">
        <div className="flex-1 overflow-auto bg-white dark:bg-[#2d3133] border border-[#e2e8f0] dark:border-[#45464d] rounded-xl shadow-sm">
          <table className="w-full text-left border-collapse min-w-[1400px]">
            <thead className="sticky top-0 z-10 bg-[#f8fafc] dark:bg-[#131b2e] border-b border-[#e2e8f0] dark:border-[#45464d]">
              <tr>
                <Th className="w-10 text-center">
                  <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} className="rounded accent-[#2563eb]" />
                </Th>
                <Th>Image</Th>
                <Th>SKU / Item Code</Th>
                <Th>Barcode</Th>
                <Th>Product Name</Th>
                <Th>Brand</Th>
                <Th>Category</Th>
                <Th>Gender</Th>
                <Th>Product Type</Th>
                <Th>Article / Design / Style / Model</Th>
                <Th>Color / Shade</Th>
                <Th className="text-center">Size (UK/EU/US/CM)</Th>
                <Th>HSN Code</Th>
                <Th className="text-right">Retail Price (₹)</Th>
                <Th className="text-right">Dealer Price (₹)</Th>
                <Th className="text-right">Cost Price (₹)</Th>
                <Th className="text-right">Last Purchase Price (₹)</Th>
                <Th className="text-center">GST (%)</Th>
                <Th>Status</Th>
                <Th className="text-center">Actions</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f1f5f9] dark:divide-[#2d3133]">
              {paginated.length === 0 ? (
                <tr>
                  <td colSpan={20} className="text-center py-16 text-[#94a3b8]">
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
                  const dealerPrice = p.buyingPrice;                          // Issue 4 fix: typed
                  const costPrice = p.costPrice;
                  const lastPurchasePrice = getAttr(p, "last_purchase_price");
                  const gstPct = p.gstPercentage;
                  const isActive = p.isActive !== false;                      // Issue 4 fix: typed

                  return (
                    <tr
                      key={p.id || `prod-${idx}`}
                      className={`text-xs transition-colors ${isSelected ? "bg-[#eff6ff] dark:bg-[#1d3054]/30" : "hover:bg-[#f8fafc] dark:hover:bg-[#1c1f26]"}`}
                    >
                      <Td className="text-center" onClick={(e) => e.stopPropagation()}>
                        <input type="checkbox" checked={isSelected} onChange={() => toggleRow(p.id || p.code)} className="rounded accent-[#2563eb]" />
                      </Td>
                      {/* Image */}
                      <Td>
                        <div className="w-9 h-9 rounded-lg bg-[#f1f5f9] dark:bg-[#2d3133] border border-[#e2e8f0] dark:border-[#45464d] flex items-center justify-center overflow-hidden">
                          {p.primaryImageUrl ? (
                            <img src={p.primaryImageUrl} alt={p.name} className="w-full h-full object-cover" />
                          ) : (
                            <Package size={14} className="text-[#94a3b8]" />
                          )}
                        </div>
                      </Td>
                      <Td><span className="font-mono font-bold text-[#2563eb] dark:text-[#93c5fd] text-[11px]">{p.code}</span></Td>
                      <Td><span className="font-mono text-[11px] text-[#64748b]">{p.barcode || "—"}</span></Td>
                      <Td><span className="font-semibold text-[#0f172a] dark:text-white">{p.name}</span></Td>
                      <Td>{p.brand || "—"}</Td>
                      <Td>{p.category || "—"}</Td>
                      <Td>{gender || "—"}</Td>
                      <Td>{productType || "—"}</Td>
                      <Td><span className="font-mono font-semibold">{article || "—"}</span></Td>
                      <Td>{color || "—"}</Td>
                      <Td className="text-center"><span className="font-mono font-bold">{size || "—"}</span></Td>
                      <Td><span className="font-mono text-[#64748b]">{hsnCode || "—"}</span></Td>
                      <Td className="text-right font-mono font-semibold text-[#0f172a] dark:text-[#e2e8f0]">{formatINR(retailPrice)}</Td>
                      <Td className="text-right font-mono text-[#64748b]">{formatINR(dealerPrice)}</Td>
                      <Td className="text-right font-mono text-[#64748b]">{formatINR(costPrice)}</Td>
                      <Td className="text-right font-mono text-[#64748b]">{lastPurchasePrice ? formatINR(parseFloat(lastPurchasePrice)) : "—"}</Td>
                      <Td className="text-center">{gstPct != null ? `${gstPct}%` : "—"}</Td>
                      <Td>
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                          isActive
                            ? "bg-[#dcfce7] text-[#15803d] dark:bg-[#14532d]/40 dark:text-[#4ade80]"
                            : "bg-[#fef2f2] text-[#dc2626] dark:bg-[#450a0a]/40 dark:text-[#f87171]"
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${isActive ? "bg-[#16a34a]" : "bg-[#dc2626]"}`} />
                          {isActive ? "Active" : "Inactive"}
                        </span>
                      </Td>
                      <Td className="text-center">
                        <button type="button" className="w-6 h-6 flex items-center justify-center rounded hover:bg-[#f1f5f9] dark:hover:bg-[#2d3133] transition text-[#64748b] mx-auto">
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

        {/* ── Pagination Bar ────────────────────────────────────────────── */}
        <div className="shrink-0 py-3 flex items-center justify-between text-xs text-[#64748b] dark:text-[#94a3b8]">
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
                if (totalPages > 5) {
                  const mid = Math.min(Math.max(pageIndex, 2), totalPages - 3);
                  page = mid - 2 + i;
                }
                return (
                  <button
                    key={page}
                    type="button"
                    onClick={() => setPageIndex(page)}
                    className={`w-7 h-7 rounded flex items-center justify-center text-[11px] font-semibold transition ${
                      page === pageIndex
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
        onSaved={() => { onRefreshProducts?.(); }}
        onNotification={onNotification}
        productType={productCategory}
      />
    </div>
  );
};

// ── Sub-Components ─────────────────────────────────────────────────────────────

const Th: React.FC<{ children?: React.ReactNode; className?: string }> = ({ children, className = "" }) => (
  <th className={`px-3 py-2.5 text-[10px] font-bold text-[#64748b] dark:text-[#94a3b8] uppercase tracking-wider whitespace-nowrap ${className}`}>
    {children}
  </th>
);

const Td: React.FC<{ children?: React.ReactNode; className?: string; onClick?: (e: React.MouseEvent) => void }> = ({ children, className = "", onClick }) => (
  <td className={`px-3 py-2.5 text-xs text-[#374151] dark:text-[#cbd5e1] whitespace-nowrap ${className}`} onClick={onClick}>
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
      className="appearance-none pl-3 pr-7 py-2 rounded-lg border border-[#e2e8f0] dark:border-[#45464d] bg-white dark:bg-[#2d3133] text-xs font-semibold text-[#374151] dark:text-[#e2e8f0] outline-none focus:ring-2 focus:ring-[#2563eb]/30 focus:border-[#2563eb] transition cursor-pointer"
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

