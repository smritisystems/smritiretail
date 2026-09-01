/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 4.10.0
 * Created      : 2026-08-24
 * Modified     : 2026-08-24
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import React from "react";
import { Trash2 } from "lucide-react";
import { TaxInvoiceItemRow } from "../types.ts";

export interface TaxInvoiceItemGridProps {
  items: TaxInvoiceItemRow[];
  onUpdateItem: (index: number, updates: Partial<TaxInvoiceItemRow>) => void;
  onDeleteItem: (index: number) => void;
  staffList?: { id: string; name: string }[];
}

export const TaxInvoiceItemGrid: React.FC<TaxInvoiceItemGridProps> = ({
  items,
  onUpdateItem,
  onDeleteItem,
  staffList = [
    { id: "EMP001", name: "EMP001 - Jawahar Mallah" },
    { id: "EMP002", name: "EMP002 - John Doe" },
    { id: "EMP003", name: "EMP003 - Jane Smith" },
  ],
}) => {
  // Always render at least 5 rows for industrial visualization
  const minRows = Math.max(5, items.length);

  return (
    <div className="flex-1 overflow-auto">
      <table className="w-full text-left whitespace-nowrap">
        <thead className="sticky top-0 bg-surface-container-high border-b border-outline-variant z-10">
          <tr className="font-label-caps text-label-caps text-on-surface-variant">
            <th className="px-3 py-2 w-10 text-center border-r border-outline-variant">S.No</th>
            <th className="px-3 py-2 w-[100px] border-r border-outline-variant">Stock No</th>
            <th className="px-3 py-2 border-r border-outline-variant">Item Description</th>
            <th className="px-3 py-2 w-[80px] text-right border-r border-outline-variant">Rate</th>
            <th className="px-3 py-2 w-[80px] text-right border-r border-outline-variant">Qty</th>
            <th className="px-3 py-2 w-[100px] text-right border-r border-outline-variant">Value</th>
            <th className="px-3 py-2 w-[80px] border-r border-outline-variant">Disc Code</th>
            <th className="px-3 py-2 w-[80px] text-right border-r border-outline-variant">Disc Qty</th>
            <th className="px-3 py-2 w-[80px] text-right border-r border-outline-variant">Disc %</th>
            <th className="px-3 py-2 w-[100px] text-right border-r border-outline-variant">Disc Amt</th>
            <th className="px-3 py-2 w-[120px] text-right border-r border-outline-variant">Total</th>
            <th className="px-3 py-2 w-[120px]">Sales Staff</th>
          </tr>
        </thead>
        <tbody className="font-code-md text-code-md">
          {Array.from({ length: minRows }).map((_, idx) => {
            const item = items[idx];

            if (!item) {
              return (
                <tr
                  key={`empty-${idx}`}
                  className="border-b border-outline-variant hover:bg-surface-container-low transition-colors"
                >
                  <td className="px-3 py-2 text-center border-r border-outline-variant bg-surface-container-low">
                    {idx + 1}
                  </td>
                  <td className="px-3 py-2 border-r border-outline-variant"></td>
                  <td className="px-3 py-2 border-r border-outline-variant"></td>
                  <td className="px-3 py-2 text-right border-r border-outline-variant"></td>
                  <td className="px-3 py-2 text-right border-r border-outline-variant"></td>
                  <td className="px-3 py-2 text-right border-r border-outline-variant"></td>
                  <td className="px-3 py-2 border-r border-outline-variant"></td>
                  <td className="px-3 py-2 text-right border-r border-outline-variant"></td>
                  <td className="px-3 py-2 text-right border-r border-outline-variant"></td>
                  <td className="px-3 py-2 text-right border-r border-outline-variant"></td>
                  <td className="px-3 py-2 text-right border-r border-outline-variant"></td>
                  <td className="px-3 py-2"></td>
                </tr>
              );
            }

            return (
              <tr
                key={item.id || idx}
                className="border-b border-outline-variant hover:bg-surface-container-low transition-colors group"
              >
                {/* S.No */}
                <td className="px-3 py-2 text-center border-r border-outline-variant bg-surface-container-low font-bold">
                  {idx + 1}
                </td>

                {/* Stock No */}
                <td className="px-3 py-2 border-r border-outline-variant font-semibold">
                  {item.stockNo}
                </td>

                {/* Item Description */}
                <td className="px-3 py-2 border-r border-outline-variant font-sans text-xs">
                  {item.itemDescription}
                </td>

                {/* Rate */}
                <td className="px-3 py-2 text-right border-r border-outline-variant">
                  <input
                    type="number"
                    value={item.rate}
                    data-field-key="selling_price"
                    onChange={(e) => {
                      const newRate = parseFloat(e.target.value) || 0;
                      const newValue = newRate * item.qty;
                      const newTotal = Math.max(0, newValue - item.discAmt);
                      onUpdateItem(idx, { rate: newRate, value: newValue, total: newTotal });
                    }}
                    className="w-full text-right bg-transparent focus:bg-surface-container-lowest focus:outline-none rounded px-1"
                  />
                </td>

                {/* Qty */}
                <td className="px-3 py-2 text-right border-r border-outline-variant">
                  <input
                    type="number"
                    value={item.qty}
                    data-field-key="quantity"
                    onChange={(e) => {
                      const newQty = parseFloat(e.target.value) || 0;
                      const newValue = item.rate * newQty;
                      const newDiscAmt = item.discPercent ? (newValue * item.discPercent) / 100 : item.discAmt;
                      const newTotal = Math.max(0, newValue - newDiscAmt);
                      onUpdateItem(idx, { qty: newQty, value: newValue, discAmt: newDiscAmt, total: newTotal });
                    }}
                    className="w-full text-right bg-transparent focus:bg-surface-container-lowest focus:outline-none rounded px-1 font-bold"
                  />
                </td>

                {/* Value */}
                <td className="px-3 py-2 text-right border-r border-outline-variant font-semibold">
                  {item.value.toFixed(2)}
                </td>

                {/* Disc Code */}
                <td className="px-3 py-2 border-r border-outline-variant">
                  {item.discCode || "-"}
                </td>

                {/* Disc Qty */}
                <td className="px-3 py-2 text-right border-r border-outline-variant">
                  {item.discQty || 0}
                </td>

                {/* Disc % */}
                <td className="px-3 py-2 text-right border-r border-outline-variant">
                  {item.discPercent || 0}%
                </td>

                {/* Disc Amt */}
                <td className="px-3 py-2 text-right border-r border-outline-variant text-amber-600">
                  {item.discAmt ? item.discAmt.toFixed(2) : "0.00"}
                </td>

                {/* Total */}
                <td className="px-3 py-2 text-right border-r border-outline-variant font-bold text-emerald-700">
                  {item.total.toFixed(2)}
                </td>

                {/* Sales Staff & Delete */}
                <td className="px-3 py-2 flex items-center justify-between">
                  <span className="truncate text-xs font-sans">{item.salesStaff || "Staff..."}</span>
                  <button
                    type="button"
                    onClick={() => onDeleteItem(idx)}
                    className="opacity-0 group-hover:opacity-100 p-1 text-rose-500 hover:bg-rose-100 rounded transition-opacity cursor-pointer ml-2"
                    title="Delete row"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
