/**
 * Project      : SMRITI Retail OS
 * Module       : Product Master List Panel (Pattern C Left Master Panel with Multi-Select Checkboxes)
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Copyright    : Â© SMRITIBooks.com. All Rights Reserved.
 * Version      : 5.6.0
 */

import React from "react";
import { Package, Tag, DollarSign, AlertCircle, CheckCircle2, ChevronRight, Grid } from "lucide-react";
import { Product } from "../../types.js";

interface ItemMasterMasterListProps {
  products: Product[];
  selectedProductId: string | null;
  onSelectProduct: (product: Product) => void;
  checkedProductIds: string[];
  onToggleCheckProduct: (productId: string, e: React.MouseEvent) => void;
  onToggleSelectAll: () => void;
}

export const ItemMasterMasterList: React.FC<ItemMasterMasterListProps> = ({
  products,
  selectedProductId,
  onSelectProduct,
  checkedProductIds,
  onToggleCheckProduct,
  onToggleSelectAll
}) => {
  const isAllChecked = products.length > 0 && checkedProductIds.length === products.length;

  return (
    <div className="w-full h-full flex flex-col space-y-3 select-none">
      {/* Selection Control Bar */}
      <div className="p-2 bg-theme-surface-2/60 border border-theme-divider rounded-lg flex items-center justify-between text-xs font-mono">
        <label className="flex items-center gap-2 cursor-pointer font-bold text-theme-heading">
          <input
            type="checkbox"
            checked={isAllChecked}
            onChange={onToggleSelectAll}
            className="rounded text-[var(--c-seef-accent)]"
          />
          <span>Select All ({checkedProductIds.length}/{products.length})</span>
        </label>
        <span className="text-[10px] text-theme-muted">
          {products.length} SKUs Listed
        </span>
      </div>

      {/* Product List Cards */}
      <div className="space-y-2 flex-1 overflow-y-auto pr-1 scrollbar-thin">
        {products.length === 0 ? (
          <div className="p-8 text-center text-theme-muted text-xs font-mono border border-dashed border-theme-divider rounded-lg">
            No SKUs found matching filters.
          </div>
        ) : (
          products.map((p) => {
            const isSelected = selectedProductId === p.id;
            const isChecked = checkedProductIds.includes(p.id);
            const stockQty = p.stock_qty ?? p.qty ?? 0;
            const isLowStock = stockQty < (p.min_stock_level || 5);

            return (
              <div
                key={p.id}
                onClick={() => onSelectProduct(p)}
                className={`p-3 rounded-lg border text-left cursor-pointer transition-all ${
                  isSelected
                    ? "bg-theme-surface-2 border-[var(--c-seef-accent)] shadow-xs"
                    : isChecked
                    ? "bg-[var(--c-seef-accent)]/10 border-[var(--c-seef-accent)]/40"
                    : "bg-theme-surface-1 border-theme-divider hover:border-theme-muted hover:bg-theme-surface-hover"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    {/* Multi-Select Checkbox */}
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onClick={(e) => onToggleCheckProduct(p.id, e)}
                      onChange={() => {}}
                      className="rounded text-[var(--c-seef-accent)] cursor-pointer"
                    />

                    <div className="p-1.5 rounded bg-theme-surface-2 border border-theme-divider text-[var(--c-seef-accent)]">
                      <Package className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-theme-heading line-clamp-1">{p.name}</h4>
                      <p className="text-[10px] font-mono text-theme-muted flex items-center gap-2">
                        <span>{p.sku || p.barcode || "NO-SKU"}</span>
                        <span className="text-[9px] px-1 rounded bg-theme-surface-2 text-theme-muted border border-theme-divider">
                          4 Variants
                        </span>
                      </p>
                    </div>
                  </div>
                  <ChevronRight className={`w-4 h-4 transition-transform ${isSelected ? "text-[var(--c-seef-accent)] translate-x-0.5" : "text-theme-muted"}`} />
                </div>

                {/* Footer Metrics Row */}
                <div className="mt-2.5 pt-2 border-t border-theme-divider/50 flex items-center justify-between text-[11px] font-mono">
                  <span className="text-emerald-500 font-bold">
                    â‚¹{(p.mrp || p.price || 0).toLocaleString("en-IN")}
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
