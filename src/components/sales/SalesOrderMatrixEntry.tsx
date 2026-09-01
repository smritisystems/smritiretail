/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.30.0
 * Created      : 2026-08-27
 * Modified     : 2026-08-27
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import React, { useState, useMemo } from "react";
import { Grid, Plus, Trash2, CheckCircle2, Calculator, Layers, Sparkles } from "lucide-react";
import { formatCurrency, formatQuantity } from "../../utils/formatters";

export interface MatrixSizeRow {
  id: string;
  styleName: string;
  color: string;
  hsnCode: string;
  unitPrice: number;
  mrp: number;
  gstRate: number;
  sizes: Record<string, number>; // e.g. { "6": 12, "7": 24, "8": 24, "9": 24, "10": 12 }
}

interface SalesOrderMatrixEntryProps {
  onAddItems: (items: any[]) => void;
  availableStyles?: Array<{ name: string; hsn: string; price: number; mrp: number }>;
}

const DEFAULT_SIZES = ["5", "6", "7", "8", "9", "10", "11", "12"];

export const SalesOrderMatrixEntry: React.FC<SalesOrderMatrixEntryProps> = ({
  onAddItems,
  availableStyles = [
    { name: "CH-24-G BLACK", hsn: "64041990", price: 294.00, mrp: 699.00 },
    { name: "CH-24-G NAVY", hsn: "64041990", price: 294.00, mrp: 699.00 },
    { name: "CH-24-G TAN", hsn: "64041990", price: 294.00, mrp: 699.00 },
    { name: "SD-101 GREY", hsn: "64041990", price: 349.00, mrp: 799.00 },
    { name: "FL-502 BROWN", hsn: "64041990", price: 225.00, mrp: 499.00 },
  ]
}) => {
  const [rows, setRows] = useState<MatrixSizeRow[]>([
    {
      id: "row-1",
      styleName: "CH-24-G BLACK",
      color: "BLACK",
      hsnCode: "64041990",
      unitPrice: 294.00,
      mrp: 699.00,
      gstRate: 5.0,
      sizes: { "6": 24, "7": 36, "8": 48, "9": 36, "10": 24 },
    }
  ]);

  const handleSizeChange = (rowId: string, size: string, qtyStr: string) => {
    const qty = parseInt(qtyStr, 10) || 0;
    setRows(prev => prev.map(r => {
      if (r.id !== rowId) return r;
      return {
        ...r,
        sizes: {
          ...r.sizes,
          [size]: Math.max(0, qty)
        }
      };
    }));
  };

  const handleAddRow = () => {
    const newId = `row-${Date.now()}`;
    const defaultSt = availableStyles[0] || { name: "NEW-STYLE", hsn: "64041990", price: 294, mrp: 699 };
    setRows(prev => [
      ...prev,
      {
        id: newId,
        styleName: defaultSt.name,
        color: "BLACK",
        hsnCode: defaultSt.hsn,
        unitPrice: defaultSt.price,
        mrp: defaultSt.mrp,
        gstRate: 5.0,
        sizes: { "6": 0, "7": 0, "8": 0, "9": 0, "10": 0 },
      }
    ]);
  };

  const handleRemoveRow = (rowId: string) => {
    setRows(prev => prev.filter(r => r.id !== rowId));
  };

  const matrixTotals = useMemo(() => {
    let totalPairs = 0;
    let totalTaxable = 0;
    let totalTax = 0;
    let grandTotal = 0;

    rows.forEach(r => {
      const rowPairs = Object.values(r.sizes).reduce((a, b) => a + (b || 0), 0);
      const taxable = rowPairs * r.unitPrice;
      const tax = taxable * (r.gstRate / 100);
      totalPairs += rowPairs;
      totalTaxable += taxable;
      totalTax += tax;
      grandTotal += (taxable + tax);
    });

    return { totalPairs, totalTaxable, totalTax, grandTotal };
  }, [rows]);

  const handleCommitToOrder = () => {
    const itemsToAdd: any[] = [];
    rows.forEach(r => {
      Object.entries(r.sizes).forEach(([sz, q]) => {
        if (q > 0) {
          const taxable = q * r.unitPrice;
          const tax = taxable * (r.gstRate / 100);
          itemsToAdd.push({
            item_code: `${r.styleName}-SZ${sz}`.replace(/\s+/g, "_"),
            item_description: `${r.styleName} (Size ${sz})`,
            hsn_code: r.hsnCode,
            quantity: q,
            unit_price: r.unitPrice,
            mrp: r.mrp,
            discount_pct: 0,
            taxable_value: taxable,
            gst_rate: r.gstRate,
            total_tax: tax,
            total_amount: taxable + tax,
            size: sz,
            color: r.color,
          });
        }
      });
    });

    if (itemsToAdd.length === 0) {
      alert("Please enter at least 1 pair quantity in the size matrix.");
      return;
    }

    onAddItems(itemsToAdd);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-xl text-white">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-indigo-600/20 text-indigo-400 rounded-lg border border-indigo-500/30">
            <Grid className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-slate-100 flex items-center gap-2">
              Fast Size Matrix Entry Grid
              <span className="text-[10px] font-mono bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 px-2 py-0.5 rounded-full">
                Footwear Wholesale SLA
              </span>
            </h3>
            <p className="text-xs text-slate-400">Rapid batch entry across standard shoe size runs (5 through 12)</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleAddRow}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700 rounded-lg transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Style Row
          </button>
        </div>
      </div>

      {/* Grid Table */}
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse min-w-[760px]">
          <thead>
            <tr className="border-b border-slate-800 text-[11px] font-bold text-slate-400 uppercase tracking-wider bg-slate-950/60">
              <th className="p-2 w-44">Article / Style</th>
              <th className="p-2 w-20 text-right">Rate (₹)</th>
              {DEFAULT_SIZES.map(sz => (
                <th key={sz} className="p-2 text-center w-12 text-indigo-300 font-mono">
                  Sz {sz}
                </th>
              ))}
              <th className="p-2 text-right w-16 text-emerald-400 font-bold">Total Prs</th>
              <th className="p-2 text-right w-24 text-slate-200 font-bold">Line Val (₹)</th>
              <th className="p-2 text-center w-10"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {rows.map((r, rIdx) => {
              const rowPairs = Object.values(r.sizes).reduce((a, b) => a + (b || 0), 0);
              const rowVal = rowPairs * r.unitPrice * (1 + r.gstRate / 100);

              return (
                <tr key={r.id} className="hover:bg-slate-800/30 transition-colors">
                  {/* Style input / selector */}
                  <td className="p-2">
                    <input
                      type="text"
                      value={r.styleName}
                      data-field-key="product_name"
                      onChange={(e) => {
                        const val = e.target.value;
                        setRows(prev => prev.map(item => item.id === r.id ? { ...item, styleName: val } : item));
                      }}
                      className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs font-semibold text-white focus:outline-none focus:border-indigo-500"
                      placeholder="e.g. CH-24-G BLACK"
                    />
                  </td>

                  {/* Unit Rate */}
                  <td className="p-2">
                    <input
                      type="number"
                      value={r.unitPrice}
                      data-field-key="selling_price"
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        setRows(prev => prev.map(item => item.id === r.id ? { ...item, unitPrice: val } : item));
                      }}
                      className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs font-mono text-right text-slate-200 focus:outline-none focus:border-indigo-500"
                    />
                  </td>

                  {/* Size Input Cells */}
                  {DEFAULT_SIZES.map(sz => (
                    <td key={sz} className="p-1 text-center">
                      <input
                        type="number"
                        min="0"
                        value={r.sizes[sz] || ""}
                        data-field-key="quantity"
                        onChange={(e) => handleSizeChange(r.id, sz, e.target.value)}
                        placeholder="0"
                        className="w-11 text-center bg-slate-950 border border-slate-700/80 rounded py-1 font-mono text-xs font-bold text-indigo-200 focus:outline-none focus:border-indigo-400 focus:bg-indigo-950/40"
                      />
                    </td>
                  ))}

                  {/* Row Total Pairs */}
                  <td className="p-2 text-right font-mono font-bold text-emerald-400 text-xs">
                    {formatQuantity(rowPairs)}
                  </td>

                  {/* Row Total Value */}
                  <td className="p-2 text-right font-mono font-bold text-slate-100 text-xs">
                    {formatCurrency(rowVal)}
                  </td>

                  {/* Delete Row */}
                  <td className="p-2 text-center">
                    {rows.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveRow(r.id)}
                        className="text-slate-500 hover:text-rose-400 transition-colors p-1"
                        title="Remove row"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Summary Footer & Commit Action */}
      <div className="mt-4 pt-3 border-t border-slate-800 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4 text-xs">
          <div className="bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800">
            <span className="text-slate-400">Total Pairs: </span>
            <span className="font-mono font-bold text-emerald-400 text-sm ml-1">
              {formatQuantity(matrixTotals.totalPairs)}
            </span>
          </div>

          <div className="bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800">
            <span className="text-slate-400">Taxable Value: </span>
            <span className="font-mono font-semibold text-slate-200 ml-1">
              {formatCurrency(matrixTotals.totalTaxable)}
            </span>
          </div>

          <div className="bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800">
            <span className="text-slate-400">GST (5%): </span>
            <span className="font-mono font-semibold text-slate-200 ml-1">
              {formatCurrency(matrixTotals.totalTax)}
            </span>
          </div>

          <div className="bg-indigo-950/50 border border-indigo-500/30 px-3 py-1.5 rounded-lg">
            <span className="text-indigo-300 font-medium">Order Total: </span>
            <span className="font-mono font-black text-indigo-100 text-sm ml-1">
              {formatCurrency(matrixTotals.grandTotal)}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={handleCommitToOrder}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-lg shadow-lg shadow-indigo-600/30 transition-all cursor-pointer"
        >
          <Sparkles className="w-4 h-4" />
          Add Matrix Items to Sales Order
        </button>
      </div>
    </div>
  );
};
