/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.10.0
 * Created      : 2026-08-22
 * Modified     : 2026-08-22
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 * Source Module: Universal Item Auto-Search & Multi-Attribute Inspection Dropdown
 */

import React, { useEffect, useRef } from "react";
import { AutoPopulateProductResult } from "../../services/autoPopulateService.ts";
import { 
  Barcode, 
  Package, 
  Tag, 
  Layers, 
  Percent, 
  Boxes, 
  DollarSign, 
  ShieldCheck, 
  FileText, 
  Scale, 
  Palette, 
  Maximize2 
} from "lucide-react";

interface SmritiItemTypeaheadDropdownProps {
  isOpen: boolean;
  items: AutoPopulateProductResult[];
  selectedIndex: number;
  onSelect: (item: AutoPopulateProductResult) => void;
  onClose: () => void;
  isLoading?: boolean;
  searchFieldType?: "stockNo" | "barcode";
}

export const SmritiItemTypeaheadDropdown: React.FC<SmritiItemTypeaheadDropdownProps> = ({
  isOpen,
  items,
  selectedIndex,
  onSelect,
  onClose,
  isLoading = false,
  searchFieldType = "stockNo"
}) => {
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, onClose]);

  // Scroll active item into view
  useEffect(() => {
    if (isOpen && dropdownRef.current) {
      const activeEl = dropdownRef.current.querySelector(`[data-item-index="${selectedIndex}"]`);
      if (activeEl) {
        activeEl.scrollIntoView({ block: "nearest", behavior: "smooth" });
      }
    }
  }, [selectedIndex, isOpen]);

  if (!isOpen) return null;

  return (
    <div
      ref={dropdownRef}
      className="absolute left-0 top-full mt-1.5 w-[680px] max-w-[90vw] max-h-96 overflow-y-auto bg-white dark:bg-[#131b2e] border-2 border-[#00288e] dark:border-[#3b82f6] rounded-xl shadow-2xl z-50 divide-y divide-gray-100 dark:divide-gray-800 font-sans"
    >
      {/* Header Inspector Ribbon */}
      <div className="px-3 py-1.5 bg-[#f0f4ff] dark:bg-[#1e293b] border-b border-[#dde1ff] dark:border-gray-700 flex justify-between items-center text-[11px] text-[#00288e] dark:text-[#a8b8ff] font-bold">
        <span className="flex items-center gap-1.5">
          <Barcode size={13} />
          <span>Live Item Search ({searchFieldType === "barcode" ? "Barcode Field" : "Stock No / SKU Field"})</span>
        </span>
        <span className="text-[10px] opacity-75 font-mono">
          {items.length} Matches Found • [↑↓ Navigate] • [Enter Select]
        </span>
      </div>

      {isLoading ? (
        <div className="px-4 py-6 text-xs text-gray-500 dark:text-gray-400 flex items-center justify-center gap-2.5">
          <div className="w-4 h-4 border-2 border-[#00288e] border-t-transparent rounded-full animate-spin" />
          <span className="font-semibold">Searching catalog by Barcode, Stock No, Code, and SKU...</span>
        </div>
      ) : items.length === 0 ? (
        <div className="px-4 py-6 text-xs text-gray-500 dark:text-gray-400 text-center font-medium">
          No matching items found for query
        </div>
      ) : (
        items.map((item, idx) => {
          const isSelected = idx === selectedIndex;
          return (
            <div
              key={item.id || item.barcode || idx}
              data-item-index={idx}
              onMouseDown={(e) => {
                e.preventDefault();
                onSelect(item);
              }}
              className={`p-3 cursor-pointer transition flex flex-col gap-2 ${
                isSelected
                  ? "bg-[#edf2ff] dark:bg-[#1e3a8a]/40 border-l-4 border-[#00288e] dark:border-[#60a5fa]"
                  : "hover:bg-gray-50 dark:hover:bg-gray-800/60"
              }`}
            >
              {/* Row 1: Key Identifiers (Barcode, Stock No, Code, SKU, Item Name) */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  {item.primaryImageUrl ? (
                    <img 
                      src={item.primaryImageUrl} 
                      alt={item.name} 
                      className="w-10 h-10 object-cover rounded-lg border border-gray-300 dark:border-gray-700 shrink-0" 
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center shrink-0 text-gray-600 dark:text-gray-300">
                      <Package size={18} />
                    </div>
                  )}

                  <div className="min-w-0">
                    <div className="font-bold text-xs text-gray-900 dark:text-white truncate flex items-center gap-2">
                      <span>{item.name}</span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/60 text-[#00288e] dark:text-[#93c5fd] font-bold">
                        Stock No: {item.stockNo || item.code}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-[11px] text-gray-600 dark:text-gray-400 font-mono mt-0.5">
                      <span className="flex items-center gap-1">
                        <Barcode size={12} className="text-gray-500" />
                        <strong>Barcode:</strong> {item.barcode}
                      </span>
                      <span>•</span>
                      <span><strong>SKU:</strong> {item.sku}</span>
                      <span>•</span>
                      <span><strong>Code:</strong> {item.code}</span>
                    </div>
                  </div>
                </div>

                {/* Right: Key Price & MRP */}
                <div className="text-right shrink-0">
                  <div className="text-sm font-bold text-[#00288e] dark:text-[#93c5fd]">
                    ₹{item.sellingPrice.toFixed(2)}
                  </div>
                  <div className="text-[10px] text-gray-500 font-mono line-through">
                    MRP: ₹{item.mrp.toFixed(2)}
                  </div>
                </div>
              </div>

              {/* Row 2: Initial 5–7 Important Related Details */}
              <div className="grid grid-cols-6 gap-1.5 bg-gray-50 dark:bg-[#191c28] p-1.5 rounded-lg border border-gray-200 dark:border-gray-800 text-[10px] font-mono">
                <div className="flex flex-col">
                  <span className="text-gray-500 text-[9px] uppercase font-sans">Stock</span>
                  <span className={`font-bold ${item.stockQty > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600"}`}>
                    {item.stockQty} {item.uom}
                  </span>
                </div>

                <div className="flex flex-col">
                  <span className="text-gray-500 text-[9px] uppercase font-sans">Rate</span>
                  <span className="font-bold text-gray-800 dark:text-gray-200">₹{item.sellingPrice.toFixed(2)}</span>
                </div>

                <div className="flex flex-col">
                  <span className="text-gray-500 text-[9px] uppercase font-sans">MRP</span>
                  <span className="font-bold text-gray-800 dark:text-gray-200">₹{item.mrp.toFixed(2)}</span>
                </div>

                <div className="flex flex-col">
                  <span className="text-gray-500 text-[9px] uppercase font-sans">Cost</span>
                  <span className="font-bold text-gray-700 dark:text-gray-300">₹{item.costPrice.toFixed(2)}</span>
                </div>

                <div className="flex flex-col">
                  <span className="text-gray-500 text-[9px] uppercase font-sans">Size</span>
                  <span className="font-bold text-gray-800 dark:text-gray-200 truncate">{item.size || "Std"}</span>
                </div>

                <div className="flex flex-col">
                  <span className="text-gray-500 text-[9px] uppercase font-sans">Color / GST</span>
                  <span className="font-bold text-indigo-600 dark:text-indigo-400 truncate">
                    {item.color || "Std"} ({item.gstPercentage}%)
                  </span>
                </div>
              </div>

              {/* Row 3: Additional 5–7 Relevant Item Details */}
              <div className="flex flex-wrap items-center gap-2 text-[10px] text-gray-600 dark:text-gray-400 pt-0.5">
                <span className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded font-semibold">
                  Brand: {item.brand || "SMRITI"}
                </span>
                <span className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded font-semibold">
                  Category: {item.category}
                </span>
                <span className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded font-mono font-semibold">
                  HSN: {item.hsnCode}
                </span>
                <span className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded font-semibold">
                  Mode: {item.pricingMode || "Fixed"}
                </span>
                <span className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded font-semibold">
                  Tracking: {item.trackingMode || "Standard"}
                </span>
                {item.weightGrams ? (
                  <span className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded font-mono">
                    Weight: {item.weightGrams}g
                  </span>
                ) : null}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
};
