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
 * Classification: Isolated Draggable Product List Modal (Phase 5)
 */

import React, { useState, useEffect, useRef } from "react";
import {
  Package,
  Search,
  Plus,
  Minus,
  Square,
  X,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  ExternalLink,
} from "lucide-react";
import { useBillingCatalog, BillingProduct } from "./useBillingCatalog";
import { broadcastBillingDock, getBillingDockChannel } from "./billingDockProtocol";

interface ProductListModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectItem: (item: BillingProduct) => void;
  isStandaloneWindow?: boolean;
}

export const ProductListModal: React.FC<ProductListModalProps> = ({
  isOpen,
  onClose,
  onSelectItem,
  isStandaloneWindow = false,
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
    categories,
    brands,
    products,
    totalCount,
    loading,
  } = useBillingCatalog({ pageSize: 20 });

  const [selectedCode, setSelectedCode] = useState<string | null>(null);

  // Dragging state for in-canvas presentation
  const [pos, setPos] = useState({ x: 500, y: 190 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const channelRef = useRef<BroadcastChannel | null>(null);

  // Initialize BroadcastChannel listener if in standalone mode or window
  useEffect(() => {
    channelRef.current = getBillingDockChannel();
    return () => {
      channelRef.current?.close();
    };
  }, []);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (isStandaloneWindow) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - pos.x, y: e.clientY - pos.y });
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      setPos({
        x: Math.max(20, Math.min(window.innerWidth - 650, e.clientX - dragStart.x)),
        y: Math.max(20, Math.min(window.innerHeight - 500, e.clientY - dragStart.y)),
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    }
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, dragStart]);

  const handleSelect = (p: BillingProduct) => {
    // 1. In-canvas callback
    onSelectItem(p);

    // 2. BroadcastChannel dispatch for cross-window / isolated dock parity
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
  };

  const handleOpenExternalWindow = () => {
    try {
      const popout = window.open(
        `${window.location.origin}/?tab=credit-billing&popout=product-list`,
        "smriti_product_list_dock",
        "width=800,height=700,menubar=no,toolbar=no,location=no,status=no"
      );
      if (popout) {
        onClose();
      }
    } catch (err) {
      console.warn("Could not open external product list window:", err);
    }
  };

  if (!isOpen && !isStandaloneWindow) return null;

  return (
    <div
      style={
        isStandaloneWindow
          ? { width: "100%", height: "100%" }
          : { left: `${pos.x}px`, top: `${pos.y}px` }
      }
      className={`${
        isStandaloneWindow
          ? "w-full h-full bg-white dark:bg-[#1e232a]"
          : "fixed z-50 w-[640px] bg-white dark:bg-[#1e232a] rounded-xl shadow-2xl border border-[#cbd5e1] dark:border-[#334155] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150"
      }`}
    >
      {/* ── Title Bar (Window Drag Handle) ── */}
      <div
        onMouseDown={handleMouseDown}
        className="px-3 py-2 bg-[#f8fafc] dark:bg-[#0f172a] border-b border-[#e2e8f0] dark:border-[#334155] flex items-center justify-between cursor-move select-none"
      >
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded bg-[#00288e] text-white flex items-center justify-center">
            <Package size={12} />
          </div>
          <span className="font-bold text-xs text-slate-800 dark:text-slate-100 tracking-tight">
            Product List
          </span>
          <span className="text-[10px] text-slate-500 font-mono">
            ({totalCount} items)
          </span>
        </div>

        <div className="flex items-center gap-1.5 text-slate-500">
          {!isStandaloneWindow && (
            <button
              type="button"
              onClick={handleOpenExternalWindow}
              title="Pop out into isolated browser window"
              className="p-1 hover:bg-[#e2e8f0] dark:hover:bg-[#334155] rounded text-slate-600 dark:text-slate-300"
            >
              <ExternalLink size={12} />
            </button>
          )}
          <button
            type="button"
            className="p-1 hover:bg-[#e2e8f0] dark:hover:bg-[#334155] rounded"
          >
            <Minus size={12} />
          </button>
          <button
            type="button"
            className="p-1 hover:bg-[#e2e8f0] dark:hover:bg-[#334155] rounded"
          >
            <Square size={11} />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="p-1 hover:bg-[#ef4444] hover:text-white rounded transition"
          >
            <X size={12} />
          </button>
        </div>
      </div>

      {/* ── Search & Filter Controls ── */}
      <div className="p-3 bg-white dark:bg-[#1e232a] border-b border-[#e2e8f0] dark:border-[#334155] space-y-2">
        <div className="flex items-center gap-2">
          <div className="flex-1 relative">
            <Search
              size={14}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search Product, Barcode, Code (F2)..."
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-[#f8fafc] dark:bg-[#0f172a] border border-[#cbd5e1] dark:border-[#475569] rounded-lg outline-none focus:border-[#00288e] transition"
            />
          </div>
          <button
            type="button"
            onClick={() => {}}
            className="flex items-center gap-1 px-3 py-1.5 bg-[#00288e] hover:bg-[#1e40af] text-white rounded-lg text-xs font-bold transition shadow-xs shrink-0"
          >
            <Plus size={12} />
            <span>New</span>
          </button>
        </div>

        {/* Facet Dropdowns */}
        <div className="flex items-center gap-2 text-xs">
          <div className="relative flex-1">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full py-1 px-2 pr-6 bg-[#f8fafc] dark:bg-[#0f172a] border border-[#cbd5e1] dark:border-[#475569] rounded-md text-[11px] font-medium outline-none appearance-none"
            >
              <option value="All Categories">All Categories</option>
              {categories.map((c) => (
                <option key={c.name} value={c.name}>
                  {c.name} ({c.count})
                </option>
              ))}
            </select>
            <ChevronDown
              size={12}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
            />
          </div>

          <div className="relative flex-1">
            <select
              value={brandFilter}
              onChange={(e) => setBrandFilter(e.target.value)}
              className="w-full py-1 px-2 pr-6 bg-[#f8fafc] dark:bg-[#0f172a] border border-[#cbd5e1] dark:border-[#475569] rounded-md text-[11px] font-medium outline-none appearance-none"
            >
              <option value="ALL">All Brands</option>
              {brands.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
            <ChevronDown
              size={12}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
            />
          </div>

          <div className="relative flex-1">
            <select
              value={stockAvailability}
              onChange={(e) => setStockAvailability(e.target.value)}
              className="w-full py-1 px-2 pr-6 bg-[#f8fafc] dark:bg-[#0f172a] border border-[#cbd5e1] dark:border-[#475569] rounded-md text-[11px] font-medium outline-none appearance-none"
            >
              <option value="ALL">All Status</option>
              <option value="IN_STOCK">In Stock</option>
              <option value="LOW_STOCK">Low Stock</option>
              <option value="OUT_OF_STOCK">Out of Stock</option>
            </select>
            <ChevronDown
              size={12}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
            />
          </div>
        </div>
      </div>

      {/* ── Table Grid ── */}
      <div className="flex-1 overflow-auto max-h-[360px] bg-white dark:bg-[#1e232a]">
        {loading ? (
          <div className="p-8 text-center text-xs text-slate-400 font-mono animate-pulse">
            Loading products...
          </div>
        ) : (
          <table className="w-full text-left text-xs border-collapse">
            <thead className="sticky top-0 bg-[#f8fafc] dark:bg-[#0f172a] border-b border-[#e2e8f0] dark:border-[#334155] text-slate-500 font-bold select-none">
              <tr>
                <th className="px-3 py-2 w-28">Code</th>
                <th className="px-3 py-2">Description</th>
                <th className="px-3 py-2 text-right w-20">MRP</th>
                <th className="px-3 py-2 text-right w-20">Stock</th>
                <th className="px-3 py-2 text-center w-14">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {products.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-xs text-slate-400 font-mono">
                    No products matched filter criteria.
                  </td>
                </tr>
              ) : (
                products.map((p) => {
                  const isSel = selectedCode === p.code;
                  return (
                    <tr
                      key={p.id || p.code}
                      onClick={() => setSelectedCode(p.code)}
                      onDoubleClick={() => handleSelect(p)}
                      className={`cursor-pointer transition ${
                        isSel
                          ? "bg-[#dde1ff] dark:bg-[#1e40af]/30 font-medium text-[#00288e] dark:text-[#a8b8ff]"
                          : "hover:bg-[#f8fafc] dark:hover:bg-[#28303d] text-slate-700 dark:text-slate-200"
                      }`}
                    >
                      <td className="px-3 py-1.5 font-mono text-[11px] font-semibold">
                        {p.code}
                      </td>
                      <td className="px-3 py-1.5 truncate max-w-[220px]" title={p.name}>
                        {p.name}
                      </td>
                      <td className="px-3 py-1.5 text-right font-mono text-[11px]">
                        ₹{(p.mrp || p.price || 0).toFixed(2)}
                      </td>
                      <td className="px-3 py-1.5 text-right font-mono text-[11px]">
                        <span
                          className={`px-1.5 py-0.5 rounded font-semibold ${
                            (p.stock || 0) > 10
                              ? "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300"
                              : (p.stock || 0) > 0
                              ? "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                              : "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"
                          }`}
                        >
                          {p.stock ?? 0}
                        </span>
                      </td>
                      <td className="px-3 py-1.5 text-center">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelect(p);
                          }}
                          className="px-2 py-0.5 rounded bg-[#00288e] hover:bg-[#1e40af] text-white text-[10px] font-bold shadow-2xs"
                        >
                          Add
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Footer / Pagination ── */}
      <div className="px-3 py-2 bg-[#f8fafc] dark:bg-[#0f172a] border-t border-[#e2e8f0] dark:border-[#334155] flex items-center justify-between text-xs text-slate-500 select-none">
        <div>
          Showing 1 - {Math.min(products.length, 20)} of {totalCount}
        </div>

        <div className="flex items-center gap-1 font-mono text-[11px]">
          <button
            type="button"
            className="p-1 rounded hover:bg-[#e2e8f0] dark:hover:bg-[#334155] disabled:opacity-40"
            disabled
          >
            <ChevronLeft size={13} />
          </button>
          <span className="px-2 py-0.5 bg-[#00288e] text-white rounded font-bold">1</span>
          <button type="button" className="px-2 py-0.5 hover:bg-[#e2e8f0] dark:hover:bg-[#334155] rounded">
            2
          </button>
          <button type="button" className="px-2 py-0.5 hover:bg-[#e2e8f0] dark:hover:bg-[#334155] rounded">
            3
          </button>
          <button
            type="button"
            className="p-1 rounded hover:bg-[#e2e8f0] dark:hover:bg-[#334155]"
          >
            <ChevronRight size={13} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProductListModal;
