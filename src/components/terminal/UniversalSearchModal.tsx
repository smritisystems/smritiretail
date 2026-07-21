/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Email        : support@smritibooks.com
 * Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 5.0.0
 * Created      : 2026-07-20
 * Modified     : 2026-07-20
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import React, { useState, useEffect, useRef } from "react";
import { Product } from "../../types";

interface UniversalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  onSelectProduct?: (product: Product) => void;
}

export const UniversalSearchModal: React.FC<UniversalSearchModalProps> = ({
  isOpen,
  onClose,
  products,
  onSelectProduct
}) => {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery("");
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (isOpen) onClose();
        else setQuery("");
      }
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const filtered = products.filter(p => {
    const q = query.toLowerCase();
    return (
      !q ||
      p.name.toLowerCase().includes(q) ||
      p.code.toLowerCase().includes(q) ||
      p.barcode.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q)
    );
  }).slice(0, 8);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 bg-slate-950/80 backdrop-blur-sm p-4 font-sans">
      <div className="w-full max-w-2xl bg-[#1e293b] border border-slate-700 rounded-xl shadow-2xl overflow-hidden flex flex-col">
        {/* Search Header Input */}
        <div className="p-4 border-b border-slate-700 flex items-center space-x-3 bg-[#0f172a]">
          <span className="material-symbols-outlined text-blue-400 text-xl">search</span>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Universal Search: Item Name, SKU Code, Barcode, Serial, Category... (Press ESC to exit)"
            className="flex-1 bg-transparent text-white text-sm focus:outline-none font-mono placeholder:text-slate-500"
          />
          <kbd className="bg-slate-800 px-2 py-0.5 rounded text-[10px] text-slate-400 border border-slate-700 font-mono">ESC</kbd>
        </div>

        {/* Results List */}
        <div className="max-h-96 overflow-y-auto p-2">
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400 font-mono">
              No matching items or records found for "{query}".
            </div>
          ) : (
            filtered.map((item) => (
              <div
                key={item.id}
                onClick={() => {
                  if (onSelectProduct) onSelectProduct(item);
                  onClose();
                }}
                className="p-3 hover:bg-slate-800 rounded-lg cursor-pointer flex items-center justify-between transition-colors border border-transparent hover:border-slate-700"
              >
                <div className="flex items-center space-x-3">
                  <span className="material-symbols-outlined text-slate-400 text-lg">inventory_2</span>
                  <div>
                    <h4 className="text-xs font-semibold text-white">{item.name}</h4>
                    <p className="text-[10px] text-slate-400 font-mono">
                      Code: {item.code} | Barcode: {item.barcode} | Cat: {item.category}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-xs font-bold text-emerald-400 font-mono">₹{item.price}</span>
                  <p className="text-[10px] text-slate-400 font-mono">{item.stock} in stock</p>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Search Footer */}
        <div className="p-2.5 bg-[#0f172a] border-t border-slate-700 text-[10px] font-mono text-slate-400 flex items-center justify-between">
          <span>Search scope: Products, Barcodes, Categories</span>
          <span>SMRITI Universal Search Engine</span>
        </div>
      </div>
    </div>
  );
};
