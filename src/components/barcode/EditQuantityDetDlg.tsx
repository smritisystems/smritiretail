/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.2.0
 * Created      : 2026-08-21
 * Modified     : 2026-08-21
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import React, { useState, useMemo } from "react";
import { X, Edit3, Search, Check, Trash2, Layers, Sparkles } from "lucide-react";
import { LabelPrintRow } from "./types.ts";

interface EditQuantityDetailsModalProps {
  isOpen: boolean;
  rows: LabelPrintRow[];
  batchId?: string;
  onClose: () => void;
  onSave: (updatedRows: LabelPrintRow[]) => void;
}

export const EditQuantityDetailsModal: React.FC<EditQuantityDetailsModalProps> = ({
  isOpen,
  rows: initialRows,
  batchId = "BATCH-9942-A",
  onClose,
  onSave
}) => {
  const [localRows, setLocalRows] = useState<LabelPrintRow[]>(() => [...initialRows]);
  const [searchQuery, setSearchQuery] = useState<string>("");

  if (!isOpen) return null;

  const filteredRows = useMemo(() => {
    if (!searchQuery.trim()) return localRows;
    const q = searchQuery.toLowerCase();
    return localRows.filter(r =>
      r.stockNo.toLowerCase().includes(q) ||
      r.product.toLowerCase().includes(q) ||
      r.brand.toLowerCase().includes(q) ||
      r.style.toLowerCase().includes(q) ||
      r.colour.toLowerCase().includes(q) ||
      r.size.toLowerCase().includes(q)
    );
  }, [localRows, searchQuery]);

  const totalLabels = useMemo(() => {
    return localRows.reduce((sum, r) => sum + (r.labelCount || 0), 0);
  }, [localRows]);

  const handleUpdateQty = (id: string, count: number) => {
    const validCount = isNaN(count) ? 0 : Math.max(0, count);
    setLocalRows(prev => prev.map(r => (r.id === id ? { ...r, labelCount: validCount } : r)));
  };

  const handleSetAll = (val: number) => {
    setLocalRows(prev => prev.map(r => ({ ...r, labelCount: Math.max(0, val) })));
  };

  const handleSetAllToStock = () => {
    setLocalRows(prev => prev.map(r => ({ ...r, labelCount: Math.max(0, r.currentStock) })));
  };

  const handleClearAll = () => {
    setLocalRows(prev => prev.map(r => ({ ...r, labelCount: 0 })));
  };

  const handleSaveAndClose = () => {
    onSave(localRows);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 select-none animate-in fade-in duration-150">
      {/* Modal Card */}
      <div className="bg-[#fbf8fb] text-[#1b1b1e] rounded-lg border border-[#c5c6ce] w-full max-w-4xl shadow-2xl flex flex-col max-h-[88vh] overflow-hidden">
        
        {/* Modal Header */}
        <div className="px-6 py-3.5 border-b border-[#c5c6ce] flex justify-between items-center bg-[#efedf0]">
          <div className="flex items-center gap-2">
            <Edit3 size={18} className="text-[#041632]" />
            <div>
              <h2 className="font-semibold text-sm text-[#041632]">Edit Quantity Details</h2>
              <p className="text-[11px] text-[#44474d]">Adjust required label quantities for the current batch prior to printing.</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded bg-[#eae7ea] text-[#1b1b1e] font-mono text-[11px] font-bold border border-[#c5c6ce]">
              Batch: #{batchId}
            </span>
            <button
              type="button"
              onClick={onClose}
              className="text-[#44474d] hover:text-[#ba1a1a] p-1 rounded transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Toolbar with Quick Fill actions */}
        <div className="px-6 py-2 bg-white border-b border-[#c5c6ce] flex flex-wrap justify-between items-center gap-2 shrink-0 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-[#44474d] text-[11px]">Quick Fill:</span>
            <button
              type="button"
              onClick={() => handleSetAll(1)}
              className="px-2 py-0.5 bg-[#efedf0] hover:bg-[#eae7ea] border border-[#c5c6ce] rounded text-[11px] font-semibold text-[#041632]"
            >
              All = 1
            </button>
            <button
              type="button"
              onClick={handleSetAllToStock}
              className="px-2 py-0.5 bg-[#efedf0] hover:bg-[#eae7ea] border border-[#c5c6ce] rounded text-[11px] font-semibold text-[#041632]"
            >
              All = Stock
            </button>
            <button
              type="button"
              onClick={handleClearAll}
              className="px-2 py-0.5 bg-[#ffdad6] hover:bg-[#ffb4ab] border border-[#ffb4ab] rounded text-[11px] font-semibold text-[#93000a]"
            >
              Reset 0
            </button>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search size={13} className="absolute left-2 top-1/2 -translate-y-1/2 text-[#75777e]" />
              <input
                type="text"
                placeholder="Filter items..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-6 pr-2 py-1 text-xs border border-[#c5c6ce] rounded bg-[#fbf8fb] focus:bg-white outline-none focus:border-[#3e5f90] w-48 h-6"
              />
            </div>
            <span className="font-mono text-xs font-bold text-[#041632] bg-[#d7e2ff] px-2 py-0.5 rounded border border-[#8393b5]">
              Total Labels: {totalLabels}
            </span>
          </div>
        </div>

        {/* Modal Body (Data Grid) */}
        <div className="flex-1 overflow-y-auto p-4 bg-white">
          <div className="border border-[#c5c6ce] rounded overflow-hidden">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-[#efedf0] sticky top-0 z-10 border-b border-[#c5c6ce] text-[11px] font-bold text-[#041632]">
                <tr>
                  <th className="p-2 border-r border-[#c5c6ce] w-12 text-center text-[#44474d]">#</th>
                  <th className="p-2 border-r border-[#c5c6ce]">Stock Number</th>
                  <th className="p-2 border-r border-[#c5c6ce]">Product</th>
                  <th className="p-2 border-r border-[#c5c6ce]">Brand</th>
                  <th className="p-2 border-r border-[#c5c6ce]">Style</th>
                  <th className="p-2 border-r border-[#c5c6ce]">Shade</th>
                  <th className="p-2 border-r border-[#c5c6ce] w-16">Size</th>
                  <th className="p-2 border-r border-[#c5c6ce] w-20 text-right">Stock</th>
                  <th className="p-2 font-bold text-[#041632] bg-[#eae7ea] w-24 text-right"># Lbls</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#c5c6ce]/50 text-[#1b1b1e]">
                {filteredRows.map((row, idx) => (
                  <tr
                    key={row.id}
                    className={`hover:bg-[#f5f3f6] transition-colors ${
                      idx % 2 === 1 ? "bg-[#fbf8fb]" : "bg-white"
                    }`}
                  >
                    <td className="p-2 border-r border-[#c5c6ce] text-center text-[#44474d] font-mono text-[11px]">
                      {idx + 1}
                    </td>
                    <td className="p-2 border-r border-[#c5c6ce] font-mono font-bold text-[#041632]">
                      {row.stockNo}
                    </td>
                    <td className="p-2 border-r border-[#c5c6ce]">{row.product}</td>
                    <td className="p-2 border-r border-[#c5c6ce]">{row.brand}</td>
                    <td className="p-2 border-r border-[#c5c6ce]">{row.style}</td>
                    <td className="p-2 border-r border-[#c5c6ce]">{row.colour}</td>
                    <td className="p-2 border-r border-[#c5c6ce] font-mono">{row.size}</td>
                    <td className="p-2 border-r border-[#c5c6ce] text-right font-mono text-[#44474d]">
                      {row.currentStock}
                    </td>
                    <td className="p-1 bg-[#eae7ea]/40">
                      <input
                        type="number"
                        min="0"
                        value={row.labelCount}
                        onChange={e => handleUpdateQty(row.id, parseInt(e.target.value) || 0)}
                        className="w-full px-2 py-1 border border-[#75777e] rounded focus:outline-none focus:border-[#3e5f90] focus:ring-1 focus:ring-[#3e5f90] font-mono font-bold text-xs text-right bg-white text-[#041632]"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-[#c5c6ce] bg-[#efedf0] rounded-b-lg flex justify-between items-center">
          <div className="text-xs text-[#44474d]">
            <span>Showing <strong>{filteredRows.length}</strong> items • <strong>{totalLabels}</strong> total labels to print</span>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleClearAll}
              className="px-4 py-1.5 border border-[#75777e] rounded text-[#041632] text-xs font-semibold hover:bg-[#eae7ea] transition-colors"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={handleSaveAndClose}
              className="px-6 py-1.5 bg-[#041632] text-white rounded text-xs font-bold hover:bg-[#1b2b48] transition-colors shadow-sm flex items-center gap-1"
            >
              <Check size={14} />
              OK
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
