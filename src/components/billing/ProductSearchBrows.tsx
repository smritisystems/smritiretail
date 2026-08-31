/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.30.0
 * Created      : 2026-08-21
 * Modified     : 2026-08-21
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import React, { useState, useMemo, useEffect, useRef } from "react";
import { Product } from "../../types.ts";

interface ProductSearchBrowserModalProps {
  isOpen: boolean;
  products: Product[];
  initialQuery?: string;
  onSelectProduct: (product: Product) => void;
  onClose: () => void;
}

export const ProductSearchBrowserModal: React.FC<ProductSearchBrowserModalProps> = ({
  isOpen,
  products,
  initialQuery = "",
  onSelectProduct,
  onClose
}) => {
  const [query, setQuery] = useState(initialQuery);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 12;
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery(initialQuery);
      setSelectedIndex(0);
      setCurrentPage(1);
      setTimeout(() => inputRef.current?.focus(), 80);
    }
  }, [isOpen, initialQuery]);

  const filteredProducts = useMemo(() => {
    if (!query.trim()) return products;
    const q = query.toLowerCase().trim();
    return products.filter(p =>
      p.name?.toLowerCase().includes(q) ||
      p.code?.toLowerCase().includes(q) ||
      p.barcode?.toLowerCase().includes(q) ||
      p.brand?.toLowerCase().includes(q) ||
      p.category?.toLowerCase().includes(q) ||
      p.color?.toLowerCase().includes(q) ||
      p.size?.toLowerCase().includes(q) ||
      p.styleCode?.toLowerCase().includes(q)
    );
  }, [products, query]);

  const totalPages = Math.ceil(filteredProducts.length / pageSize) || 1;
  const paginatedProducts = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredProducts.slice(start, start + pageSize);
  }, [filteredProducts, currentPage]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      onClose();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex(prev => (prev + 1) % paginatedProducts.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex(prev => (prev - 1 + paginatedProducts.length) % paginatedProducts.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (paginatedProducts[selectedIndex]) {
        onSelectProduct(paginatedProducts[selectedIndex]);
        onClose();
      }
    } else if (e.key === "PageDown") {
      e.preventDefault();
      setCurrentPage(p => Math.min(totalPages, p + 1));
      setSelectedIndex(0);
    } else if (e.key === "PageUp") {
      e.preventDefault();
      setCurrentPage(p => Math.max(1, p - 1));
      setSelectedIndex(0);
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 font-sans animate-in fade-in duration-150"
      onKeyDown={handleKeyDown}
    >
      <div className="bg-[#faf9ff] text-[#1a1b20] w-full max-w-5xl h-[85vh] max-h-[720px] rounded-lg shadow-2xl border border-[#c4c6d4] flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="bg-[#00296d] text-white px-4 py-2.5 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[20px]">search</span>
            <span className="font-bold text-sm tracking-wide">Product Search & Catalog Browser</span>
            <span className="text-xs bg-[#0052cc] text-[#dae2ff] px-2 py-0.5 rounded font-mono font-semibold ml-2">
              {filteredProducts.length} Found
            </span>
          </div>
          <button 
            type="button"
            onClick={onClose}
            className="p-1 hover:bg-white/20 rounded transition-colors text-white"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        {/* Search & Filter Bar */}
        <div className="p-3 bg-[#e9edff] border-b border-[#c4c6d4] flex items-center gap-3 shrink-0">
          <div className="relative flex-1">
            <span className="material-symbols-outlined absolute left-2.5 top-2 text-[#737685] text-[18px]">search</span>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={e => {
                setQuery(e.target.value);
                setCurrentPage(1);
                setSelectedIndex(0);
              }}
              placeholder="Search by Barcode, Stock No, Product Name, Brand, Color, Size..."
              className="w-full pl-9 pr-4 py-1.5 bg-white border border-[#737685] rounded text-xs focus:ring-2 focus:ring-[#00296d] focus:border-[#00296d] outline-none shadow-inner"
            />
          </div>
          <span className="text-[11px] text-[#434652] font-semibold hidden md:inline">
            Use <kbd className="bg-white px-1.5 py-0.5 rounded border border-[#c4c6d4] font-mono text-[10px]">↑</kbd> <kbd className="bg-white px-1.5 py-0.5 rounded border border-[#c4c6d4] font-mono text-[10px]">↓</kbd> to navigate, <kbd className="bg-white px-1.5 py-0.5 rounded border border-[#c4c6d4] font-mono text-[10px]">Enter</kbd> to select
          </span>
        </div>

        {/* Product Table Browser */}
        <div className="flex-1 overflow-auto bg-white custom-scrollbar">
          <table className="w-full text-left border-collapse whitespace-nowrap text-xs">
            <thead className="sticky top-0 z-10 bg-[#e8e7ed] border-b border-[#c4c6d4] text-[11px] font-bold text-[#434652] uppercase tracking-wider">
              <tr>
                <th className="w-10 px-2 py-2 text-center border-r border-[#c4c6d4]">#</th>
                <th className="w-28 px-3 py-2 border-r border-[#c4c6d4]">Stock No</th>
                <th className="w-36 px-3 py-2 border-r border-[#c4c6d4]">Barcode</th>
                <th className="px-3 py-2 border-r border-[#c4c6d4]">Product Name</th>
                <th className="w-24 px-3 py-2 border-r border-[#c4c6d4]">Brand</th>
                <th className="w-20 px-3 py-2 border-r border-[#c4c6d4]">Shade</th>
                <th className="w-16 px-3 py-2 border-r border-[#c4c6d4]">Size</th>
                <th className="w-24 px-3 py-2 text-right border-r border-[#c4c6d4]">MRP</th>
                <th className="w-24 px-3 py-2 text-right border-r border-[#c4c6d4]">Selling Price</th>
                <th className="w-16 px-3 py-2 text-center">Stock</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e2e2e8] font-medium text-[#1a1b20]">
              {paginatedProducts.length === 0 ? (
                <tr>
                  <td colSpan={10} className="p-8 text-center text-[#737685] bg-[#faf9ff]">
                    <span className="material-symbols-outlined text-3xl mb-1 text-[#737685]/60">inventory_2</span>
                    <p className="font-semibold text-xs">No products found matching "{query}"</p>
                  </td>
                </tr>
              ) : (
                paginatedProducts.map((p, idx) => {
                  const isSelected = idx === selectedIndex;
                  return (
                    <tr
                      key={p.id || p.code}
                      onClick={() => {
                        onSelectProduct(p);
                        onClose();
                      }}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      className={`cursor-pointer transition-colors ${
                        isSelected 
                          ? "bg-[#cdddff] text-[#00296d] font-semibold border-l-4 border-l-[#00296d]" 
                          : "hover:bg-[#f4f3f9]"
                      }`}
                    >
                      <td className="px-2 py-2 text-center text-[10px] text-[#737685] font-mono border-r border-[#c4c6d4]/60">
                        {(currentPage - 1) * pageSize + idx + 1}
                      </td>
                      <td className="px-3 py-2 font-mono font-bold border-r border-[#c4c6d4]/60">{p.code}</td>
                      <td className="px-3 py-2 font-mono text-[11px] border-r border-[#c4c6d4]/60">{p.barcode}</td>
                      <td className="px-3 py-2 font-bold truncate max-w-xs border-r border-[#c4c6d4]/60">{p.name}</td>
                      <td className="px-3 py-2 border-r border-[#c4c6d4]/60">{p.brand || "-"}</td>
                      <td className="px-3 py-2 border-r border-[#c4c6d4]/60">{p.color || "-"}</td>
                      <td className="px-3 py-2 border-r border-[#c4c6d4]/60">{p.size || "-"}</td>
                      <td className="px-3 py-2 text-right font-mono font-bold border-r border-[#c4c6d4]/60">
                        ₹{(p.mrp || p.price || 0).toFixed(2)}
                      </td>
                      <td className="px-3 py-2 text-right font-mono font-bold text-emerald-700 border-r border-[#c4c6d4]/60">
                        ₹{(p.price || 0).toFixed(2)}
                      </td>
                      <td className="px-3 py-2 text-center font-mono font-bold text-slate-700">
                        {p.stock ?? 0}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Modal Footer & Pagination */}
        <div className="bg-[#e8e7ed] border-t border-[#c4c6d4] px-4 py-2.5 flex justify-between items-center shrink-0 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-[#434652] font-semibold">
              Showing {Math.min(filteredProducts.length, (currentPage - 1) * pageSize + 1)} - {Math.min(filteredProducts.length, currentPage * pageSize)} of {filteredProducts.length} items
            </span>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={currentPage <= 1}
                onClick={() => {
                  setCurrentPage(p => Math.max(1, p - 1));
                  setSelectedIndex(0);
                }}
                className="p-1 rounded hover:bg-white disabled:opacity-40 transition-colors border border-[#c4c6d4] bg-[#faf9ff]"
              >
                <span className="material-symbols-outlined text-[16px]">chevron_left</span>
              </button>
              <span className="px-2 font-mono font-bold text-[11px]">
                {currentPage} / {totalPages}
              </span>
              <button
                type="button"
                disabled={currentPage >= totalPages}
                onClick={() => {
                  setCurrentPage(p => Math.min(totalPages, p + 1));
                  setSelectedIndex(0);
                }}
                className="p-1 rounded hover:bg-white disabled:opacity-40 transition-colors border border-[#c4c6d4] bg-[#faf9ff]"
              >
                <span className="material-symbols-outlined text-[16px]">chevron_right</span>
              </button>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  if (paginatedProducts[selectedIndex]) {
                    onSelectProduct(paginatedProducts[selectedIndex]);
                    onClose();
                  }
                }}
                disabled={!paginatedProducts[selectedIndex]}
                className="bg-[#00296d] hover:bg-[#003d9b] disabled:opacity-40 text-white text-xs font-bold uppercase px-5 py-1.5 rounded transition-colors flex items-center gap-1 shadow-sm"
              >
                <span className="material-symbols-outlined text-[15px]">check</span>
                Select Item
              </button>
              <button
                type="button"
                onClick={onClose}
                className="bg-[#faf9ff] hover:bg-[#e8e7ed] text-[#434652] text-xs font-bold uppercase px-4 py-1.5 rounded border border-[#c4c6d4] transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
