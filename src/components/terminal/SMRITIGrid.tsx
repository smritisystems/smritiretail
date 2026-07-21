/**
 * Project      : SMRITI Retail OS
 * Organization : AITDL NETWORKS
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

import React from "react";
import { Product } from "../../types";

export interface SMRITIGridColumn<T> {
  key: string;
  header: string;
  width?: string;
  render?: (row: T, index: number) => React.ReactNode;
}

interface SMRITIGridProps {
  cart: { product: Product; quantity: number; salespersonId?: string }[];
  onUpdateQuantity: (productId: string, quantity: number) => void;
  onRemoveItem: (productId: string) => void;
  onUpdateSalesperson?: (productId: string, salespersonId: string) => void;
  salespersons?: { id: string; name: string; code: string }[];
  salespersonMode?: "single" | "line";
  fitToWidth?: boolean;
}

export const SMRITIGrid: React.FC<SMRITIGridProps> = ({
  cart,
  onUpdateQuantity,
  onRemoveItem,
  onUpdateSalesperson,
  salespersons = [],
  salespersonMode = "single",
  fitToWidth = true
}) => {
  if (cart.length === 0) {
    return (
      <div className="w-full h-full min-h-[350px] bg-[#0f172a] border border-slate-700/60 rounded-xl flex flex-col items-center justify-center p-8 text-center select-none font-sans">
        <div className="w-14 h-14 rounded-full bg-slate-800/80 border border-slate-700 flex items-center justify-center text-slate-400 mb-3">
          <span className="material-symbols-outlined text-3xl">qr_code_scanner</span>
        </div>
        <h4 className="text-sm font-bold text-slate-200 uppercase tracking-wide font-display">
          Terminal Item Grid Ready
        </h4>
        <p className="text-xs text-slate-400 max-w-sm mt-1 font-mono">
          Scan item barcode or use the search bar above to begin adding products to this active billing transaction.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full h-full bg-[#0f172a] border border-slate-700/60 rounded-xl overflow-hidden flex flex-col font-sans select-none">
      <div className="overflow-x-auto flex-1 w-full custom-scrollbar">
        <table className={`w-full text-left text-xs text-slate-200 ${fitToWidth ? "table-fixed" : ""}`}>
          <thead className="bg-[#1e293b] text-[10px] uppercase font-bold font-display tracking-wider text-slate-400 border-b border-slate-700 sticky top-0 z-10">
            <tr>
              <th className="py-3 px-4 w-12 text-center">#</th>
              <th className="py-3 px-4">Item Code & Description</th>
              <th className="py-3 px-4 text-right w-28">Price (₹)</th>
              <th className="py-3 px-4 text-center w-36">Qty</th>
              {salespersonMode === "line" && (
                <th className="py-3 px-4 text-center w-40">Salesperson</th>
              )}
              <th className="py-3 px-4 text-right w-32">Total (₹)</th>
              <th className="py-3 px-4 text-center w-14">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800 font-mono">
            {cart.map((item, index) => {
              const price = Number(item.product?.price ?? 0);
              const lineTotal = price * (item.quantity || 0);
              const productId = item.product?.id || `item-${index}`;
              return (
                <tr key={productId} className="hover:bg-slate-800/50 transition-colors group">
                  <td className="py-3 px-4 text-center text-slate-500 font-semibold">{index + 1}</td>
                  <td className="py-3 px-4 truncate max-w-0">
                    <div className="font-semibold text-white text-xs truncate">{item.product?.name || "Unknown SKU"}</div>
                    <div className="text-[10px] text-slate-400 flex items-center space-x-2 truncate">
                      <span>Code: {item.product?.code || "N/A"}</span>
                      <span>•</span>
                      <span>BC: {item.product?.barcode || "N/A"}</span>
                      {item.product?.gstPercentage && (
                        <>
                          <span>•</span>
                          <span className="text-blue-400">GST {item.product.gstPercentage}%</span>
                        </>
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-right font-bold text-slate-200">
                    ₹{price.toFixed(2)}
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center justify-center space-x-1 bg-slate-800 rounded border border-slate-700 p-0.5 max-w-[120px] mx-auto">
                      <button
                        onClick={() => onUpdateQuantity(productId, (item.quantity || 1) - 1)}
                        className="w-6 h-6 rounded bg-slate-700 hover:bg-slate-600 text-slate-200 flex items-center justify-center font-bold text-xs"
                      >
                        -
                      </button>
                      <input
                        type="number"
                        value={item.quantity || 0}
                        onChange={(e) => onUpdateQuantity(productId, parseInt(e.target.value) || 0)}
                        className="w-10 text-center bg-transparent text-xs font-bold text-white focus:outline-none"
                      />
                      <button
                        onClick={() => onUpdateQuantity(productId, (item.quantity || 0) + 1)}
                        className="w-6 h-6 rounded bg-slate-700 hover:bg-slate-600 text-slate-200 flex items-center justify-center font-bold text-xs"
                      >
                        +
                      </button>
                    </div>
                  </td>

                  {salespersonMode === "line" && (
                    <td className="py-3 px-4 text-center">
                      <select
                        value={item.salespersonId || ""}
                        onChange={(e) => onUpdateSalesperson && onUpdateSalesperson(productId, e.target.value)}
                        className="bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded px-2 py-1 focus:outline-none w-full max-w-[140px]"
                      >
                        {salespersons.map(s => (
                          <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
                        ))}
                      </select>
                    </td>
                  )}

                  <td className="py-3 px-4 text-right font-bold text-emerald-400">
                    ₹{lineTotal.toFixed(2)}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <button
                      onClick={() => onRemoveItem(productId)}
                      className="text-slate-500 hover:text-rose-400 p-1 rounded transition-colors"
                      title="Remove Item"
                    >
                      <span className="material-symbols-outlined text-sm">delete</span>
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
