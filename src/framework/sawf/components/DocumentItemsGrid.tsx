/**
 * SMRITI Adaptive Workspace Framework (SAWF v1.1)
 * Spreadsheet-like Keyboard Item Entry Grid
 */

import React, { useState } from "react";
import { Plus, Trash2, Barcode, Copy, Clipboard, Search } from "lucide-react";
import { Product } from "../../../types.ts";
import { ProductImage } from "../../../components/common/ProductImage.tsx";

export interface ItemGridRow {
  productId: string;
  code: string;
  name: string;
  description?: string;
  quantity: number;
  price: number;
  discountPercent?: number;
  gstRate: number;
  totalAmount: number;
  color?: string;
  size?: string;
}

interface DocumentItemsGridProps {
  items: ItemGridRow[];
  onChangeItems: (items: ItemGridRow[]) => void;
  products: Product[];
  onScanBarcode?: () => void;
}

export const DocumentItemsGrid: React.FC<DocumentItemsGridProps> = ({
  items,
  onChangeItems,
  products,
  onScanBarcode,
}) => {
  const [selectedProduct, setSelectedProduct] = useState<string>("");
  const [copiedRow, setCopiedRow] = useState<ItemGridRow | null>(null);

  const handleAddItem = (productId?: string) => {
    const prod = products.find((p) => p.id === (productId || selectedProduct));
    if (!prod) return;

    const rate = prod.mrp || prod.price || 100;
    const gst = prod.tax_rate || prod.gstPercentage || prod.gst_rate || 18;
    const qty = 1;
    const total = qty * rate * (1 + gst / 100);

    const newRow: ItemGridRow = {
      productId: prod.id,
      code: prod.code,
      name: prod.name,
      description: prod.category || "",
      quantity: qty,
      price: rate,
      discountPercent: 0,
      gstRate: gst,
      totalAmount: total,
    };

    onChangeItems([...items, newRow]);
    setSelectedProduct("");
  };

  const handleRemoveRow = (index: number) => {
    const updated = items.filter((_, idx) => idx !== index);
    onChangeItems(updated);
  };

  const handleCopyRow = (row: ItemGridRow) => {
    setCopiedRow({ ...row });
  };

  const handlePasteRow = () => {
    if (copiedRow) {
      onChangeItems([...items, { ...copiedRow }]);
    }
  };

  const handleUpdateField = (index: number, field: keyof ItemGridRow, value: any) => {
    const updated = [...items];
    const row = { ...updated[index], [field]: value };

    const qty = Math.max(1, row.quantity || 1);
    const price = Math.max(0, row.price || 0);
    const disc = Math.min(100, Math.max(0, row.discountPercent || 0));
    const gst = row.gstRate || 18;

    const discountedPrice = price * (1 - disc / 100);
    row.totalAmount = qty * discountedPrice * (1 + gst / 100);

    updated[index] = row;
    onChangeItems(updated);
  };

  return (
    <div className="bg-[#161E2E] border border-[#1E293B] rounded-2xl overflow-hidden shadow-xl space-y-4">
      {/* Grid Control Toolbar */}
      <div className="p-4 bg-[#121824] border-b border-[#1E293B] flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center space-x-3 flex-1 max-w-md">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-2.5 text-slate-500" />
            <select
              value={selectedProduct}
              onChange={(e) => {
                const val = e.target.value;
                setSelectedProduct(val);
                if (val) handleAddItem(val);
              }}
              className="w-full pl-9 pr-3 py-1.5 bg-[#1E293B] border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-indigo-500 font-medium"
            >
              <option value="">-- Add Product to Item Grid --</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.code}) - ₹{p.mrp}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center space-x-2 text-xs">
          {onScanBarcode && (
            <button
              type="button"
              onClick={onScanBarcode}
              className="px-3 py-1.5 bg-indigo-950/80 hover:bg-indigo-900 border border-indigo-700/60 text-indigo-300 font-bold rounded-lg flex items-center space-x-1.5 transition cursor-pointer"
            >
              <Barcode size={14} />
              <span>Scan Barcode (F6)</span>
            </button>
          )}

          {copiedRow && (
            <button
              type="button"
              onClick={handlePasteRow}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-bold rounded-lg flex items-center space-x-1.5 transition cursor-pointer"
            >
              <Clipboard size={14} />
              <span>Paste Line</span>
            </button>
          )}
        </div>
      </div>

      {/* Spreadsheet Items Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-[#121824] text-slate-400 font-mono text-[10px] uppercase tracking-wider border-b border-[#1E293B]">
              <th className="px-4 py-3">#</th>
              <th className="px-4 py-3">Barcode / Code</th>
              <th className="px-4 py-3">Item Description</th>
              <th className="px-4 py-3 text-right">Qty</th>
              <th className="px-4 py-3 text-right">Rate (₹)</th>
              <th className="px-4 py-3 text-right">Disc %</th>
              <th className="px-4 py-3 text-right">GST %</th>
              <th className="px-4 py-3 text-right font-bold text-emerald-400">Line Amount</th>
              <th className="px-4 py-3 text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={9} className="p-8 text-center text-slate-500 text-xs">
                  No line items in document grid. Select a product above or press <span className="font-mono text-indigo-400">Ctrl+N</span> to add items.
                </td>
              </tr>
            ) : (
              items.map((row, index) => {
                const prod = products.find((p) => p.id === row.productId || p.code === row.code);
                return (
                  <tr
                    key={index}
                    className="border-b border-[#1E293B]/60 hover:bg-[#1E293B]/40 transition text-slate-200"
                  >
                    <td className="px-4 py-2 font-mono text-slate-500 text-[11px]">{index + 1}</td>
                    <td className="px-4 py-2 font-mono text-slate-400 font-semibold">{row.code}</td>
                    <td className="px-4 py-2">
                      <div className="flex items-center space-x-3">
                        {prod?.primaryImageUrl && (
                          <ProductImage src={prod.primaryImageUrl} alt={row.name} size="small" />
                        )}
                        <div>
                          <div className="font-bold text-white">{row.name}</div>
                          {row.description && <div className="text-[10px] text-slate-400">{row.description}</div>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-2 text-right">
                      <input
                        type="number"
                        min="1"
                        value={row.quantity}
                        onChange={(e) => handleUpdateField(index, "quantity", parseInt(e.target.value) || 1)}
                        className="w-16 text-center bg-[#1E293B] border border-slate-700 rounded py-1 text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
                      />
                    </td>
                    <td className="px-4 py-2 text-right">
                      <input
                        type="number"
                        min="0"
                        value={row.price}
                        onChange={(e) => handleUpdateField(index, "price", parseFloat(e.target.value) || 0)}
                        className="w-20 text-right bg-[#1E293B] border border-slate-700 rounded py-1 px-2 text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
                      />
                    </td>
                    <td className="px-4 py-2 text-right font-mono">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={row.discountPercent || 0}
                        onChange={(e) => handleUpdateField(index, "discountPercent", parseFloat(e.target.value) || 0)}
                        className="w-16 text-right bg-[#1E293B] border border-slate-700 rounded py-1 px-2 text-xs text-amber-400 font-mono focus:outline-none focus:border-indigo-500"
                      />
                    </td>
                    <td className="px-4 py-2 text-right font-mono text-amber-400">{row.gstRate}%</td>
                    <td className="px-4 py-2 text-right font-mono font-bold text-emerald-400">
                      ₹{Math.round(row.totalAmount).toLocaleString("en-IN")}
                    </td>
                    <td className="px-4 py-2 text-center">
                      <div className="flex items-center justify-center space-x-1">
                        <button
                          type="button"
                          onClick={() => handleCopyRow(row)}
                          className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition"
                          title="Copy Line"
                        >
                          <Copy size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveRow(index)}
                          className="p-1 rounded text-rose-400 hover:bg-rose-950/60 transition"
                          title="Delete Row"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
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
