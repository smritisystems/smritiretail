/**
 * Project      : SMRITI Retail OS v5.0
 * Module       : Item Master Variant Inventory Breakdown Table
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Copyright    : © SMRITIBooks.com and AITDL.com. All Rights Reserved.
 * Version      : 5.6.0
 */

import React, { useState } from "react";
import { Grid, Barcode, Printer, CheckCircle2, AlertCircle, RefreshCw } from "lucide-react";
import { Product } from "../../types.js";

interface VariantItem {
  id: string;
  color: string;
  size: string;
  sku: string;
  barcode: string;
  stock_qty: number;
  mrp: number;
  cost_price: number;
  is_active: boolean;
}

interface ItemMasterVariantTableProps {
  product: Product;
  onOpenBarcodeDialog: (variant?: VariantItem) => void;
  isReadOnly?: boolean;
}

export const ItemMasterVariantTable: React.FC<ItemMasterVariantTableProps> = ({
  product,
  onOpenBarcodeDialog,
  isReadOnly = false
}) => {
  // Generate concrete variant objects from product metadata/variant matrix
  const colors = ["Black", "Navy Blue", "Maroon", "Gold"];
  const sizes = ["S", "M", "L", "XL", "XXL"];

  const baseSku = product.sku || product.code || "SKU-100";
  const baseBarcode = product.barcode || "8901000000000";

  const [variants, setVariants] = useState<VariantItem[]>([
    {
      id: "v-1",
      color: "Black",
      size: "M",
      sku: `${baseSku}-BLK-M`,
      barcode: `${baseBarcode.slice(0, 11)}01`,
      stock_qty: 15,
      mrp: product.mrp || product.price || 1000,
      cost_price: product.purchase_price || 600,
      is_active: true
    },
    {
      id: "v-2",
      color: "Black",
      size: "L",
      sku: `${baseSku}-BLK-L`,
      barcode: `${baseBarcode.slice(0, 11)}02`,
      stock_qty: 8,
      mrp: product.mrp || product.price || 1000,
      cost_price: product.purchase_price || 600,
      is_active: true
    },
    {
      id: "v-3",
      color: "Navy Blue",
      size: "L",
      sku: `${baseSku}-NVY-L`,
      barcode: `${baseBarcode.slice(0, 11)}03`,
      stock_qty: 2,
      mrp: product.mrp || product.price || 1000,
      cost_price: product.purchase_price || 600,
      is_active: true
    },
    {
      id: "v-4",
      color: "Maroon",
      size: "XL",
      sku: `${baseSku}-MRN-XL`,
      barcode: `${baseBarcode.slice(0, 11)}04`,
      stock_qty: 0,
      mrp: product.mrp || product.price || 1050,
      cost_price: product.purchase_price || 620,
      is_active: false
    }
  ]);

  const handleStockChange = (id: string, newQty: number) => {
    if (isReadOnly) return;
    setVariants((prev) =>
      prev.map((v) => (v.id === id ? { ...v, stock_qty: Math.max(0, newQty) } : v))
    );
  };

  const handleToggleStatus = (id: string) => {
    if (isReadOnly) return;
    setVariants((prev) =>
      prev.map((v) => (v.id === id ? { ...v, is_active: !v.is_active } : v))
    );
  };

  const totalVariantStock = variants.reduce((acc, v) => acc + v.stock_qty, 0);

  return (
    <div className="space-y-4 select-none">
      {/* Header Metric Banner */}
      <div className="p-3 bg-theme-surface-2/60 border border-theme-divider rounded-xl flex items-center justify-between text-xs">
        <div className="flex items-center gap-2 font-bold text-theme-heading">
          <Grid className="w-4 h-4 text-[#0a6ed1]" />
          <span>Color × Size Variant Inventory Matrix</span>
          <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-[#0a6ed1]/10 text-[#0a6ed1] border border-[#0a6ed1]/20">
            {variants.length} Active Variants
          </span>
        </div>
        <div className="font-mono text-theme-muted">
          Total Variant Stock: <strong className="text-emerald-500 font-bold">{totalVariantStock} Pcs</strong>
        </div>
      </div>

      {/* Variant Table */}
      <div className="border border-theme-divider rounded-xl overflow-hidden bg-theme-surface-1">
        <table className="w-full text-left text-xs">
          <thead className="bg-theme-surface-2 text-theme-muted font-bold uppercase tracking-wider text-[10px] border-b border-theme-divider">
            <tr>
              <th className="p-3">Color × Size</th>
              <th className="p-3">Variant SKU</th>
              <th className="p-3">Barcode</th>
              <th className="p-3">On-Hand Stock</th>
              <th className="p-3">MRP (₹)</th>
              <th className="p-3">Cost Price (₹)</th>
              <th className="p-3">Status</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-theme-divider font-mono text-[11px]">
            {variants.map((v) => {
              const isLow = v.stock_qty <= 3;
              return (
                <tr key={v.id} className="hover:bg-theme-surface-hover transition-colors">
                  <td className="p-3 font-sans font-bold text-theme-heading flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full border border-theme-divider" style={{ backgroundColor: v.color.toLowerCase() }} />
                    {v.color} / {v.size}
                  </td>
                  <td className="p-3 text-theme-heading">{v.sku}</td>
                  <td className="p-3 text-theme-muted flex items-center gap-1">
                    <Barcode className="w-3.5 h-3.5 text-theme-muted" /> {v.barcode}
                  </td>
                  <td className="p-3">
                    <input
                      type="number"
                      value={v.stock_qty}
                      onChange={(e) => handleStockChange(v.id, parseInt(e.target.value) || 0)}
                      disabled={isReadOnly}
                      className={`w-16 p-1 text-center font-bold border rounded-md ${
                        isLow
                          ? "bg-rose-500/10 text-rose-500 border-rose-500/30"
                          : "bg-theme-surface-2 text-theme-heading border-theme-divider"
                      }`}
                    />
                  </td>
                  <td className="p-3 text-emerald-500 font-bold">₹{v.mrp.toFixed(2)}</td>
                  <td className="p-3 text-theme-muted">₹{v.cost_price.toFixed(2)}</td>
                  <td className="p-3">
                    <button
                      onClick={() => handleToggleStatus(v.id)}
                      disabled={isReadOnly}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer transition-colors ${
                        v.is_active
                          ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                          : "bg-rose-500/10 text-rose-500 border border-rose-500/20"
                      }`}
                    >
                      {v.is_active ? "Active" : "Disabled"}
                    </button>
                  </td>
                  <td className="p-3 text-right">
                    <button
                      onClick={() => onOpenBarcodeDialog(v)}
                      className="px-2.5 py-1 text-[10px] font-bold bg-theme-surface-2 text-[#0a6ed1] border border-[#0a6ed1]/30 rounded-md hover:bg-[#0a6ed1] hover:text-white transition-colors cursor-pointer inline-flex items-center gap-1"
                    >
                      <Printer className="w-3 h-3" /> Print Label
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
