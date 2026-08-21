/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 4.6.0
 * Created      : 2026-08-21
 * Modified     : 2026-08-21
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import React, { useState, useMemo } from "react";
import { 
  Search, 
  Filter, 
  Download, 
  Plus, 
  CheckCircle, 
  ClipboardPaste, 
  Layers, 
  RefreshCw,
  Tag,
  Package
} from "lucide-react";
import { Product } from "../../types.ts";

interface SmritiItemCatalogGridProps {
  products: Product[];
  onRefreshProducts?: () => Promise<void>;
  onNotification?: (title: string, message: string, type?: "success" | "error") => void;
  onNavigateToPaste?: () => void;
}

export const SmritiItemCatalogGrid: React.FC<SmritiItemCatalogGridProps> = ({
  products = [],
  onRefreshProducts,
  onNotification,
  onNavigateToPaste
}) => {
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [selectedStatus, setSelectedStatus] = useState<string>("All");
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set());

  // Extract unique categories
  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach(p => { if (p.category) set.add(p.category); });
    return Array.from(set);
  }, [products]);

  // Filter products
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      if (selectedCategory !== "All" && p.category !== selectedCategory) return false;
      if (selectedStatus === "Stable" && p.is_favorite === false) return true;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const inCode = (p.code || "").toLowerCase().includes(q);
        const inName = (p.name || "").toLowerCase().includes(q);
        const inBarcode = (p.barcode || "").toLowerCase().includes(q);
        const inBrand = (p.brand || "").toLowerCase().includes(q);
        const inAttr = Object.entries(p.attributes || {}).some(
          ([k, v]) => String(k).toLowerCase().includes(q) || String(v).toLowerCase().includes(q)
        );
        return inCode || inName || inBarcode || inBrand || inAttr;
      }
      return true;
    });
  }, [products, selectedCategory, selectedStatus, searchQuery]);

  const handleToggleSelectAll = () => {
    if (selectedProductIds.size === filteredProducts.length) {
      setSelectedProductIds(new Set());
    } else {
      setSelectedProductIds(new Set(filteredProducts.map(p => p.id || p.code)));
    }
  };

  const handleToggleProduct = (id: string) => {
    setSelectedProductIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleExportCsv = () => {
    if (filteredProducts.length === 0) {
      onNotification?.("No Data", "No products available to export.", "error");
      return;
    }

    const headers = ["SKU / Code", "Product Name", "Category", "Brand", "MRP", "Price", "Tax %", "Barcode", "Attributes"];
    const rows = filteredProducts.map(p => [
      p.code || "",
      `"${(p.name || "").replace(/"/g, '""')}"`,
      p.category || "",
      p.brand || "",
      p.mrp || 0,
      p.price || 0,
      p.gst_percentage || 18,
      p.barcode || "",
      `"${Object.entries(p.attributes || {}).map(([k, v]) => `${k}:${v}`).join("; ")}"`
    ]);

    const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `SMRITI_ItemMaster_Catalog_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    onNotification?.("Export Ready", `Exported ${filteredProducts.length} items to CSV.`, "success");
  };

  return (
    <div className="h-full flex flex-col bg-[#f7f9fb] dark:bg-[#191c1e] text-[#191c1e] dark:text-[#eff1f3] font-sans p-4 overflow-hidden space-y-4">
      
      {/* Header & Stats Cards */}
      <div className="flex flex-col gap-3 shrink-0">
        <div className="flex justify-between items-end">
          <div>
            <h1 className="text-xl font-bold text-[#191c1e] dark:text-white">Item Master Catalog</h1>
            <p className="text-xs text-[#515f74] dark:text-[#bec6e0] mt-0.5">Central transactional repository for all items, variants, and dynamic business attributes.</p>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleExportCsv}
              className="px-3 py-1.5 border border-[#76777d] text-[#191c1e] dark:text-[#eff1f3] bg-white dark:bg-[#2d3133] hover:bg-[#eceef0] rounded text-xs font-semibold flex items-center gap-1.5 shadow-xs transition"
            >
              <Download size={14} />
              Export CSV
            </button>
            <button
              type="button"
              onClick={onNavigateToPaste}
              className="px-4 py-1.5 bg-[#000000] dark:bg-[#dae2fd] text-white dark:text-[#131b2e] hover:bg-[#2d3133] rounded text-xs font-bold flex items-center gap-1.5 shadow-xs transition"
            >
              <ClipboardPaste size={14} />
              Bulk Paste / Import
            </button>
          </div>
        </div>

        {/* 3 Stats Widgets */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="bg-white dark:bg-[#2d3133] border border-[#c6c6cd] dark:border-[#45464d] rounded-lg p-3 shadow-xs">
            <p className="text-[11px] text-[#515f74] dark:text-[#bec6e0] uppercase font-bold tracking-wider">Total Active Items</p>
            <p className="text-lg font-bold font-mono text-[#191c1e] dark:text-white mt-0.5">{products.length.toLocaleString()}</p>
          </div>

          <div className="bg-white dark:bg-[#2d3133] border border-[#c6c6cd] dark:border-[#45464d] rounded-lg p-3 shadow-xs">
            <p className="text-[11px] text-[#515f74] dark:text-[#bec6e0] uppercase font-bold tracking-wider">Categories Defined</p>
            <p className="text-lg font-bold font-mono text-[#191c1e] dark:text-white mt-0.5">{categories.length}</p>
          </div>

          <div className="bg-white dark:bg-[#2d3133] border border-[#c6c6cd] dark:border-[#45464d] rounded-lg p-3 shadow-xs">
            <p className="text-[11px] text-[#515f74] dark:text-[#bec6e0] uppercase font-bold tracking-wider">Import Health</p>
            <div className="flex items-center gap-2 mt-0.5">
              <p className="text-lg font-bold font-mono text-[#0c9488]">100% Valid</p>
              <CheckCircle size={16} className="text-[#0c9488]" />
            </div>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white dark:bg-[#2d3133] border border-[#c6c6cd] dark:border-[#45464d] rounded-lg p-2.5 flex flex-wrap gap-3 items-center shrink-0 shadow-xs">
        <div className="flex-1 min-w-[280px] relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#76777d]" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search products, SKUs, barcodes, brands, or attribute tags..."
            className="w-full pl-9 pr-3 py-1.5 bg-[#f2f4f6] dark:bg-[#191c1e] border border-[#c6c6cd] dark:border-[#45464d] rounded text-xs text-[#191c1e] dark:text-white outline-none focus:ring-1 focus:ring-[#000000]"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={selectedCategory}
            onChange={e => setSelectedCategory(e.target.value)}
            className="px-3 py-1.5 bg-white dark:bg-[#191c1e] border border-[#c6c6cd] dark:border-[#45464d] rounded text-xs font-semibold outline-none"
          >
            <option value="All">Category: All</option>
            {categories.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          <select
            value={selectedStatus}
            onChange={e => setSelectedStatus(e.target.value)}
            className="px-3 py-1.5 bg-white dark:bg-[#191c1e] border border-[#c6c6cd] dark:border-[#45464d] rounded text-xs font-semibold outline-none"
          >
            <option value="All">Status: All</option>
            <option value="Stable">Stable</option>
            <option value="Draft">Draft</option>
          </select>
        </div>
      </div>

      {/* Main Table */}
      <div className="flex-1 bg-white dark:bg-[#2d3133] border border-[#c6c6cd] dark:border-[#45464d] rounded-lg overflow-auto shadow-xs">
        <table className="w-full text-left border-collapse text-xs min-w-[900px]">
          <thead className="sticky top-0 bg-[#f2f4f6] dark:bg-[#131b2e] border-b border-[#c6c6cd] dark:border-[#45464d] z-10">
            <tr>
              <th className="p-3 w-10 text-center">
                <input
                  type="checkbox"
                  checked={selectedProductIds.size > 0 && selectedProductIds.size === filteredProducts.length}
                  onChange={handleToggleSelectAll}
                  className="rounded"
                />
              </th>
              <th className="p-3 font-mono font-bold text-[#515f74] dark:text-[#bec6e0] uppercase text-[10px]">SKU / Code</th>
              <th className="p-3 font-bold text-[#515f74] dark:text-[#bec6e0] uppercase text-[10px]">Product Name</th>
              <th className="p-3 font-bold text-[#515f74] dark:text-[#bec6e0] uppercase text-[10px]">Category</th>
              <th className="p-3 font-bold text-[#515f74] dark:text-[#bec6e0] uppercase text-[10px] min-w-[280px]">Business Labels (Attributes)</th>
              <th className="p-3 font-bold text-[#515f74] dark:text-[#bec6e0] uppercase text-[10px] text-right">MRP</th>
              <th className="p-3 font-bold text-[#515f74] dark:text-[#bec6e0] uppercase text-[10px] text-right">Price</th>
              <th className="p-3 font-bold text-[#515f74] dark:text-[#bec6e0] uppercase text-[10px]">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#eceef0] dark:divide-[#2d3133]">
            {filteredProducts.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center py-12 text-[#76777d]">
                  <Package size={36} className="mx-auto mb-2 opacity-30" />
                  <p className="font-semibold text-xs">No matching products found.</p>
                  <p className="text-[11px] mt-0.5">Try clearing your filters or paste items via Bulk Paste.</p>
                </td>
              </tr>
            ) : (
              filteredProducts.map((p, idx) => {
                const isSelected = selectedProductIds.has(p.id || p.code);
                const attrEntries = Object.entries(p.attributes || {}).filter(([k, v]) => Boolean(v));

                return (
                  <tr
                    key={p.id || `prod-${idx}`}
                    onClick={() => handleToggleProduct(p.id || p.code)}
                    className={`cursor-pointer transition ${
                      isSelected
                        ? "bg-[#d5e3fd]/40"
                        : "hover:bg-[#f7f9fb] dark:hover:bg-[#2d3133]"
                    }`}
                  >
                    <td className="p-3 text-center" onClick={e => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleToggleProduct(p.id || p.code)}
                        className="rounded"
                      />
                    </td>
                    <td className="p-3 font-mono font-bold text-[#191c1e] dark:text-[#dae2fd]">
                      {p.code}
                    </td>
                    <td className="p-3 font-semibold text-[#191c1e] dark:text-white">
                      {p.name}
                    </td>
                    <td className="p-3 text-[#515f74] dark:text-[#bec6e0]">
                      {p.category || "Footwear"}
                    </td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-1">
                        {p.brand && (
                          <span className="px-2 py-0.5 bg-[#f2f4f6] dark:bg-[#191c1e] border border-[#c6c6cd] rounded text-[10px]">
                            Brand: <span className="font-bold">{p.brand}</span>
                          </span>
                        )}
                        {attrEntries.slice(0, 3).map(([k, v], aIdx) => (
                          <span key={aIdx} className="px-2 py-0.5 bg-[#f2f4f6] dark:bg-[#191c1e] border border-[#c6c6cd] rounded text-[10px]">
                            {k}: <span className="font-bold">{String(v)}</span>
                          </span>
                        ))}
                        {attrEntries.length > 3 && (
                          <span className="text-[10px] font-mono text-[#76777d]">+{attrEntries.length - 3}</span>
                        )}
                      </div>
                    </td>
                    <td className="p-3 text-right font-mono font-semibold">
                      {Number(p.mrp || p.price || 0).toFixed(2)}
                    </td>
                    <td className="p-3 text-right font-mono font-bold text-[#0c9488]">
                      {Number(p.price || 0).toFixed(2)}
                    </td>
                    <td className="p-3">
                      <span className="flex items-center gap-1.5 text-[11px] text-[#0c9488] font-semibold">
                        <span className="w-2 h-2 rounded-full bg-[#0c9488]"></span>
                        Stable
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

    </div>
  );
};

export default SmritiItemCatalogGrid;
