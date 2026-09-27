/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.16.0
 * Created      : 2026-09-27
 * Modified     : 2026-09-27
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Embedded/Docked Product List with Category Sidebar (Phase 5)
 */

import React, { useState, useEffect } from "react";
import {
  Package,
  ExternalLink,
  X,
  ChevronDown,
  ChevronUp,
  Search,
  Barcode,
  Folder,
  ArrowUpDown,
  Check,
} from "lucide-react";
import { useBillingCatalog, BillingProduct } from "./useBillingCatalog";
import { broadcastBillingDock } from "./billingDockProtocol";

interface DockedProductListProps {
  onClose: () => void;
  onPopOut?: () => void;
  onAddProducts: (products: BillingProduct[]) => void;
  onSelectProductForDetails?: (product: BillingProduct | null) => void;
}

export const DockedProductList: React.FC<DockedProductListProps> = ({
  onClose,
  onPopOut,
  onAddProducts,
  onSelectProductForDetails,
}) => {
  const {
    searchQuery,
    setSearchQuery,
    selectedCategory,
    setSelectedCategory,
    brandFilter,
    setBrandFilter,
    stockAvailability,
    setStockAvailability,
    minPrice,
    setMinPrice,
    maxPrice,
    setMaxPrice,
    showOnlyActive,
    setShowOnlyActive,
    categories,
    brands,
    products,
    totalCount,
    loading,
    refresh: fetchProducts,
  } = useBillingCatalog({ pageSize: 50 });

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const toggleSelectAll = () => {
    if (selectedIds.size === products.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(products.map((p) => p.id)));
    }
  };

  const toggleSelectRow = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleRowClick = (product: BillingProduct) => {
    onSelectProductForDetails?.(product);
  };

  const handleAddSelected = () => {
    const toAdd = products.filter((p) => selectedIds.has(p.id));
    if (toAdd.length > 0) {
      onAddProducts(toAdd);
      toAdd.forEach((p) => {
        broadcastBillingDock({
          type: "ADD_TO_CART",
          product: {
            id: p.id,
            code: p.code,
            name: p.name,
            price: p.price,
            mrp: p.mrp,
            gst_rate: p.gst_rate,
            hsn_code: p.hsn_code,
            unit: p.unit,
            stock: p.stock,
            category: p.category,
            brand: p.brand,
          },
          quantity: 1,
        });
      });
      setSelectedIds(new Set());
    }
  };

  // Thumbnail SVG icon rendering
  const renderProductThumbnail = (category: string, code: string) => {
    const isFootwear = category.toLowerCase().includes("footwear") || code.startsWith("SHOE");
    const isCare = category.toLowerCase().includes("care") || code.startsWith("ACC");
    const isBag = category.toLowerCase().includes("bag") || code.startsWith("BAG");

    if (isFootwear) {
      return (
        <div className="w-9 h-7 rounded bg-slate-100 flex items-center justify-center text-slate-700 shadow-2xs">
          <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current text-slate-800">
            <path d="M2.5 13.5C2.5 13.5 4 10 7.5 10C9 10 10.5 11 11.5 12L15 11C16 10.5 17.5 10 19.5 10.5C21.5 11 22 13 22 14.5C22 16.5 20.5 18 18.5 18H5C3.5 18 2.5 16.5 2.5 13.5Z" />
          </svg>
        </div>
      );
    }
    if (isCare) {
      return (
        <div className="w-9 h-7 rounded bg-amber-50 flex items-center justify-center text-amber-700 shadow-2xs">
          <Package size={16} />
        </div>
      );
    }
    if (isBag) {
      return (
        <div className="w-9 h-7 rounded bg-blue-50 flex items-center justify-center text-blue-700 shadow-2xs">
          <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current text-blue-800">
            <path d="M6 8V6C6 4.34 7.34 3 9 3H15C16.66 3 18 4.34 18 6V8H20C21.1 8 22 8.9 22 10V20C22 21.1 21.1 22 20 22H4C2.9 22 2 21.1 2 20V10C2 8.9 2.9 8 4 8H6ZM8 6V8H16V6C16 5.45 15.55 5 15 5H9C8.45 5 8 5.45 8 6Z" />
          </svg>
        </div>
      );
    }
    return (
      <div className="w-9 h-7 rounded bg-slate-100 flex items-center justify-center text-slate-500 shadow-2xs">
        <Package size={15} />
      </div>
    );
  };

  return (
    <div className="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden flex flex-col font-sans mb-3 select-none">
      {/* ── Top Header ── */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <Package size={16} className="text-blue-600" />
          <h2 className="font-bold text-xs text-slate-800 tracking-tight">Product List</h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onPopOut}
            className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium text-slate-600 hover:text-blue-600 bg-white border border-slate-200 rounded hover:bg-slate-50 transition"
          >
            <ExternalLink size={12} />
            <span>Open in New Window</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Product List"
            className="p-1 text-slate-400 hover:text-slate-700 rounded hover:bg-slate-200/50"
          >
            <X size={15} />
          </button>
        </div>
      </div>

      {/* ── Body: Categories Sidebar + Main Grid ── */}
      <div className="flex flex-1 min-h-[360px] overflow-hidden">
        {/* Left Category Sidebar */}
        <div className="w-52 border-r border-slate-200 bg-slate-50/60 p-2.5 flex flex-col gap-1 overflow-y-auto">
          <div className="flex items-center justify-between px-2 py-1 text-xs font-semibold text-slate-600">
            <span>Category</span>
            <ChevronDown size={13} className="text-slate-400" />
          </div>

          <div className="flex flex-col gap-0.5 mt-1">
            {categories.map((c) => {
              const isActive = selectedCategory === c.name;
              return (
                <button
                  key={c.name}
                  type="button"
                  onClick={() => setSelectedCategory(c.name)}
                  className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition ${
                    isActive
                      ? "bg-blue-600 text-white font-medium shadow-xs"
                      : "text-slate-700 hover:bg-slate-200/70"
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <Folder size={13} className={isActive ? "text-white" : "text-slate-400"} />
                    <span className="truncate">{c.name}</span>
                  </div>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                      isActive ? "bg-blue-700/60 text-white" : "text-slate-500"
                    }`}
                  >
                    ({c.count})
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Search, Filters & Products Table */}
        <div className="flex-1 flex flex-col overflow-hidden bg-white">
          {/* Advanced Search Header */}
          <div className="p-3 border-b border-slate-100 flex flex-col gap-2.5">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
              <ChevronDown size={13} />
              <span>Advanced Search</span>
            </div>

            {/* Search Input Bar */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by Code, Name, Barcode, Brand, SKU ..."
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:border-blue-500 focus:bg-white text-slate-800"
                />
              </div>
              <button
                type="button"
                aria-label="Search items"
                onClick={fetchProducts}
                className="p-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition shadow-2xs"
              >
                <Search size={14} />
              </button>
              <button
                type="button"
                aria-label="Barcode scanner"
                className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-200 rounded-md transition"
              >
                <Barcode size={14} />
              </button>
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  setBrandFilter("ALL");
                  setStockAvailability("ALL");
                  setMinPrice("");
                  setMaxPrice("");
                }}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-200 text-xs font-medium rounded-md transition"
              >
                Clear
              </button>
            </div>

            {/* Filter Controls Row */}
            <div className="grid grid-cols-5 gap-2 items-center text-xs">
              <div>
                <label className="block text-[10px] text-slate-500 mb-0.5">Category</label>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  aria-label="Filter by Category"
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded px-2 py-1 text-slate-700 focus:outline-none focus:border-blue-500"
                >
                  <option value="All Categories">All</option>
                  {categories.map((c) => (
                    <option key={c.name} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] text-slate-500 mb-0.5">Brand</label>
                <select
                  value={brandFilter}
                  onChange={(e) => setBrandFilter(e.target.value)}
                  aria-label="Filter by Brand"
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded px-2 py-1 text-slate-700 focus:outline-none focus:border-blue-500"
                >
                  <option value="ALL">All</option>
                  {brands.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] text-slate-500 mb-0.5">Stock Availability</label>
                <select
                  value={stockAvailability}
                  onChange={(e) => setStockAvailability(e.target.value)}
                  aria-label="Filter by Stock Availability"
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded px-2 py-1 text-slate-700 focus:outline-none focus:border-blue-500"
                >
                  <option value="ALL">All</option>
                  <option value="IN_STOCK">In Stock</option>
                  <option value="LOW_STOCK">Low Stock</option>
                  <option value="OUT_OF_STOCK">Out of Stock</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] text-slate-500 mb-0.5">Price Range</label>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    value={minPrice}
                    onChange={(e) => setMinPrice(e.target.value)}
                    placeholder="Min"
                    className="w-1/2 text-xs bg-slate-50 border border-slate-200 rounded px-1.5 py-1 text-slate-700 focus:outline-none"
                  />
                  <span className="text-slate-400">-</span>
                  <input
                    type="number"
                    value={maxPrice}
                    onChange={(e) => setMaxPrice(e.target.value)}
                    placeholder="Max"
                    className="w-1/2 text-xs bg-slate-50 border border-slate-200 rounded px-1.5 py-1 text-slate-700 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowOnlyActive(!showOnlyActive)}
                  className={`w-9 h-5 rounded-full p-0.5 transition-colors ${
                    showOnlyActive ? "bg-blue-600" : "bg-slate-300"
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full bg-white transition-transform ${
                      showOnlyActive ? "translate-x-4" : "translate-x-0"
                    }`}
                  />
                </button>
                <span className="text-[11px] text-slate-600 font-medium whitespace-nowrap">
                  Show Only Active Items
                </span>
              </div>
            </div>
          </div>

          {/* Products Table */}
          <div className="flex-1 overflow-y-auto max-h-[300px]">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-medium text-[11px] sticky top-0 z-10">
                  <th className="py-2 px-3 w-8">
                    <input
                      type="checkbox"
                      checked={products.length > 0 && selectedIds.size === products.length}
                      onChange={toggleSelectAll}
                      aria-label="Select all products"
                      className="rounded border-slate-300 text-blue-600 focus:ring-0 cursor-pointer"
                    />
                  </th>
                  <th className="py-2 px-3 w-12">Image</th>
                  <th className="py-2 px-3">
                    <div className="flex items-center gap-1 cursor-pointer hover:text-slate-800">
                      <span>Code</span>
                      <ArrowUpDown size={11} />
                    </div>
                  </th>
                  <th className="py-2 px-3">Product Name</th>
                  <th className="py-2 px-3">Category</th>
                  <th className="py-2 px-3">Brand</th>
                  <th className="py-2 px-3 text-right">
                    <div className="flex items-center justify-end gap-1 cursor-pointer hover:text-slate-800">
                      <span>MRP (₹)</span>
                      <ArrowUpDown size={11} />
                    </div>
                  </th>
                  <th className="py-2 px-3 text-right">
                    <div className="flex items-center justify-end gap-1 cursor-pointer hover:text-slate-800">
                      <span>Stock</span>
                      <ArrowUpDown size={11} />
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {products.map((p) => {
                  const isChecked = selectedIds.has(p.id);
                  const isLow = p.stock > 0 && p.stock <= 5;
                  const isOut = p.stock <= 0;

                  return (
                    <tr
                      key={p.id}
                      onClick={() => handleRowClick(p)}
                      onDoubleClick={() => onAddProducts([p])}
                      className={`hover:bg-slate-50/80 cursor-pointer transition-colors ${
                        isChecked ? "bg-blue-50/50" : ""
                      }`}
                    >
                      <td className="py-2 px-3" onClick={(e) => toggleSelectRow(p.id, e)}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}}
                          aria-label={`Select product ${p.name}`}
                          className="rounded border-slate-300 text-blue-600 focus:ring-0 cursor-pointer"
                        />
                      </td>
                      <td className="py-1 px-3">{renderProductThumbnail(p.category, p.code)}</td>
                      <td className="py-2 px-3 font-mono text-[11px] text-blue-600 font-medium hover:underline">
                        {p.code}
                      </td>
                      <td className="py-2 px-3 text-slate-800 font-medium">{p.name}</td>
                      <td className="py-2 px-3 text-slate-600">{p.category}</td>
                      <td className="py-2 px-3 text-slate-600">{p.brand || "—"}</td>
                      <td className="py-2 px-3 text-right font-mono text-[11px] text-slate-800">
                        {Number(p.mrp).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-2 px-3 text-right">
                        <span
                          className={`font-semibold font-mono text-[11px] ${
                            isOut
                              ? "text-red-500"
                              : isLow
                              ? "text-red-600"
                              : p.stock <= 20
                              ? "text-amber-600"
                              : "text-emerald-600"
                          }`}
                        >
                          {p.stock} {p.unit || "Pair"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Footer Controls */}
          <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 border-t border-slate-200 text-xs">
            <span className="text-[11px] text-slate-500">
              Showing 1 - {products.length} of {totalCount} items
            </span>

            {/* Pagination numbers */}
            <div className="flex items-center gap-1 text-[11px]">
              <button type="button" className="px-2 py-0.5 bg-blue-600 text-white rounded font-medium shadow-2xs">
                1
              </button>
              <button type="button" className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded">
                2
              </button>
              <button type="button" className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded">
                3
              </button>
              <button type="button" className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded">
                4
              </button>
              <button type="button" className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded">
                5
              </button>
              <span className="px-1 text-slate-400">...</span>
              <button type="button" className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded">
                41
              </button>
              <button type="button" aria-label="Next page" className="p-0.5 text-slate-500 hover:text-slate-800">
                &gt;
              </button>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              <select aria-label="Items per page" className="text-[11px] bg-white border border-slate-200 rounded px-2 py-1 text-slate-700">
                <option>50 / page</option>
                <option>100 / page</option>
              </select>
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-md text-xs font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={selectedIds.size === 0}
                onClick={handleAddSelected}
                className="px-3 py-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-md text-xs font-semibold shadow-xs transition"
              >
                Add Selected ({selectedIds.size})
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
