/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.32.0
 * Created      : 2026-08-21
 * Modified     : 2026-08-21
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import React, { useState, useMemo, useEffect, useRef } from "react";
import { Product } from "../../types.ts";

interface PurchaseProductBrowseModalProps {
  products: Product[];
  isOpen: boolean;
  onClose: () => void;
  onSelectProduct: (product: Product) => void;
}

export const PurchaseProductBrowseModal: React.FC<PurchaseProductBrowseModalProps> = ({
  products,
  isOpen,
  onClose,
  onSelectProduct
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
      setSelectedIndex(0);
    }
  }, [isOpen]);

  const filteredProducts = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return products.slice(0, 100);
    return products
      .filter((p) =>
        (p.name && p.name.toLowerCase().includes(q)) ||
        (p.code && p.code.toLowerCase().includes(q)) ||
        (p.barcode && p.barcode.toLowerCase().includes(q)) ||
        (p.brand && p.brand.toLowerCase().includes(q)) ||
        (p.styleCode && p.styleCode.toLowerCase().includes(q)) ||
        (p.color && p.color.toLowerCase().includes(q))
      )
      .slice(0, 100);
  }, [products, searchQuery]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < filteredProducts.length - 1 ? prev + 1 : prev));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : 0));
    } else if (e.key === "Enter" && filteredProducts[selectedIndex]) {
      e.preventDefault();
      onSelectProduct(filteredProducts[selectedIndex]);
      onClose();
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150"
      onKeyDown={handleKeyDown}
    >
      <div className="bg-[#faf9ff] text-[#1a1b20] w-full max-w-4xl rounded-lg shadow-2xl border border-[#c4c6d4] flex flex-col max-h-[85vh] overflow-hidden">
        {/* Header */}
        <div className="bg-[#00296d] text-white px-4 py-2.5 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px]">inventory_2</span>
            <span className="font-bold text-sm">Browse Stock Items (F2)</span>
            <span className="text-[10px] bg-[#dae2ff] text-[#00296d] px-2 py-0.5 rounded font-mono font-bold">
              {filteredProducts.length} Items Found
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-white hover:opacity-80 p-1"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        {/* Search Bar */}
        <div className="p-3 bg-[#e8e7ed] border-b border-[#c4c6d4] flex items-center gap-2 shrink-0">
          <span className="material-symbols-outlined text-[#737685] text-[18px]">search</span>
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder="Search by Stock No, Article, Brand, Product, Style, Color..."
            className="w-full bg-white border border-[#737685] rounded px-3 py-1 text-xs font-medium outline-none focus:ring-1 focus:ring-[#00296d] h-8"
          />
        </div>

        {/* Catalog Table */}
        <div className="flex-1 overflow-auto bg-white custom-scrollbar">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-[#eeedf3] sticky top-0 z-10 text-[10px] font-bold uppercase text-[#434652] shadow-xs">
              <tr>
                <th className="p-1.5 px-2 border-b border-r border-[#c4c6d4] w-10 text-center">#</th>
                <th className="p-1.5 px-2 border-b border-r border-[#c4c6d4] min-w-[90px]">Stock / Code</th>
                <th className="p-1.5 px-2 border-b border-r border-[#c4c6d4] min-w-[140px]">Product Name</th>
                <th className="p-1.5 px-2 border-b border-r border-[#c4c6d4] min-w-[100px]">Brand</th>
                <th className="p-1.5 px-2 border-b border-r border-[#c4c6d4] min-w-[80px]">Style</th>
                <th className="p-1.5 px-2 border-b border-r border-[#c4c6d4] min-w-[80px]">Color/Shade</th>
                <th className="p-1.5 px-2 border-b border-r border-[#c4c6d4] min-w-[60px]">Size</th>
                <th className="p-1.5 px-2 border-b border-r border-[#c4c6d4] min-w-[80px] text-right">Cost/Rate</th>
                <th className="p-1.5 px-2 border-b border-[#c4c6d4] min-w-[70px] text-right">Stock</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#c4c6d4]/40 font-medium">
              {filteredProducts.map((p, idx) => {
                const isSelected = idx === selectedIndex;
                return (
                  <tr
                    key={p.id || idx}
                    onClick={() => {
                      setSelectedIndex(idx);
                      onSelectProduct(p);
                      onClose();
                    }}
                    className={`hover:bg-[#f4f3f9] cursor-pointer transition-colors ${
                      isSelected ? "bg-[#cdddff] font-bold text-[#00296d]" : ""
                    }`}
                  >
                    <td className="p-1 px-2 border-r border-[#c4c6d4] text-center font-mono text-[#737685]">
                      {idx + 1}
                    </td>
                    <td className="p-1 px-2 border-r border-[#c4c6d4] font-mono font-bold">
                      {p.code || p.barcode}
                    </td>
                    <td className="p-1 px-2 border-r border-[#c4c6d4]">{p.name}</td>
                    <td className="p-1 px-2 border-r border-[#c4c6d4]">{p.brand || "-"}</td>
                    <td className="p-1 px-2 border-r border-[#c4c6d4]">{p.styleCode || "-"}</td>
                    <td className="p-1 px-2 border-r border-[#c4c6d4]">{p.color || "-"}</td>
                    <td className="p-1 px-2 border-r border-[#c4c6d4] font-mono">{p.size || "-"}</td>
                    <td className="p-1 px-2 border-r border-[#c4c6d4] text-right font-mono">
                      ₹{(p.costPrice || p.price * 0.7 || p.price || 0).toFixed(2)}
                    </td>
                    <td className="p-1 px-2 text-right font-mono font-bold">
                      {p.stock ?? 0}
                    </td>
                  </tr>
                );
              })}
              {filteredProducts.length === 0 && (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-[#737685] font-medium">
                    No products matched your search. Try another query or press Esc to close.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Footer controls */}
        <div className="bg-[#f4f3f9] px-4 py-2 border-t border-[#c4c6d4] flex justify-between items-center shrink-0 text-xs">
          <div className="flex gap-4 text-[#434652] font-mono">
            <span><strong>↑ / ↓</strong> Navigate</span>
            <span><strong>Enter</strong> Select Product</span>
            <span><strong>Esc</strong> Close</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="bg-white border border-[#c4c6d4] px-4 py-1 rounded font-bold hover:bg-[#eeedf3]"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
