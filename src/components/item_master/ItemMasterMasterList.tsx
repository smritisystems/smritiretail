/**
 * Project      : SMRITI Retail OS
 * Module       : Product Master List Panel (Pattern C Left Master Panel)
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * Version      : 5.4.0
 */

import React from "react";
import { Package, Tag, DollarSign, AlertCircle, CheckCircle2, ChevronRight } from "lucide-react";
import { Product } from "../../types.js";

interface ItemMasterMasterListProps {
  products: Product[];
  selectedProductId: string | null;
  onSelectProduct: (product: Product) => void;
  categories: string[];
  selectedCategory: string;
  onCategoryChange: (cat: string) => void;
}

export const ItemMasterMasterList: React.FC<ItemMasterMasterListProps> = ({
  products,
  selectedProductId,
  onSelectProduct,
  categories,
  selectedCategory,
  onCategoryChange
}) => {
  return (
    <div className="w-full h-full flex flex-col space-y-3 select-none">
      {/* Category Filter Pills */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-none border-b border-theme-divider">
        <button
          onClick={() => onCategoryChange("ALL")}
          className={`px-2.5 py-1 text-[11px] font-bold rounded-md whitespace-nowrap cursor-pointer ${
            selectedCategory === "ALL"
              ? "bg-[#0a6ed1] text-white"
              : "bg-theme-surface-2 text-theme-muted hover:text-theme-heading"
          }`}
        >
          All Categories ({products.length})
        </button>
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => onCategoryChange(cat)}
            className={`px-2.5 py-1 text-[11px] font-bold rounded-md whitespace-nowrap cursor-pointer ${
              selectedCategory === cat
                ? "bg-[#0a6ed1] text-white"
                : "bg-theme-surface-2 text-theme-muted hover:text-theme-heading"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Product List Cards */}
      <div className="space-y-2">
        {products.length === 0 ? (
          <div className="p-8 text-center text-theme-muted text-xs font-mono border border-dashed border-theme-divider rounded-lg">
            No SKUs found matching filters.
          </div>
        ) : (
          products.map((p) => {
            const isSelected = selectedProductId === p.id;
            const stockQty = p.stock_qty ?? p.qty ?? 0;
            const isLowStock = stockQty < (p.min_stock_level || 5);

            return (
              <div
                key={p.id}
                onClick={() => onSelectProduct(p)}
                className={`p-3 rounded-lg border text-left cursor-pointer transition-all ${
                  isSelected
                    ? "bg-theme-surface-2 border-[#0a6ed1] shadow-xs"
                    : "bg-theme-surface-1 border-theme-divider hover:border-theme-muted hover:bg-theme-surface-hover"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded bg-theme-surface-2 border border-theme-divider text-[#0a6ed1]">
                      <Package className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-theme-heading line-clamp-1">{p.name}</h4>
                      <p className="text-[10px] font-mono text-theme-muted">{p.sku || p.barcode || "NO-SKU"}</p>
                    </div>
                  </div>
                  <ChevronRight className={`w-4 h-4 transition-transform ${isSelected ? "text-[#0a6ed1] translate-x-0.5" : "text-theme-muted"}`} />
                </div>

                {/* Footer Metrics Row */}
                <div className="mt-2.5 pt-2 border-t border-theme-divider/50 flex items-center justify-between text-[11px] font-mono">
                  <span className="text-emerald-500 font-bold">
                    ₹{(p.mrp || p.price || 0).toLocaleString("en-IN")}
                  </span>

                  <span className={`px-1.5 py-0.5 rounded text-[10px] flex items-center gap-1 ${
                    isLowStock
                      ? "bg-rose-500/10 text-rose-500 border border-rose-500/20"
                      : "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                  }`}>
                    {isLowStock ? <AlertCircle className="w-3 h-3" /> : <CheckCircle2 className="w-3 h-3" />}
                    <span>{stockQty} {p.uom || "Pcs"}</span>
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
