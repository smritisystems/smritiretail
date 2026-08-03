/**
 * Project      : SMRITI Retail OS v5.0
 * Module       : Item Master Floating Batch Action Toolbar
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Copyright    : Â© SMRITIBooks.com and AITDL.com. All Rights Reserved.
 * Version      : 5.6.0
 */

import React from "react";
import { Download, Printer, Tag, CheckSquare, X, Power, FileSpreadsheet } from "lucide-react";
import { Product } from "../../types.js";

interface ItemMasterBatchBarProps {
  selectedProducts: Product[];
  onClearSelection: () => void;
  onExportExcel: () => void;
  onExportCsv: () => void;
  onPrintLabels: () => void;
  onBulkStatusToggle: () => void;
}

export const ItemMasterBatchBar: React.FC<ItemMasterBatchBarProps> = ({
  selectedProducts,
  onClearSelection,
  onExportExcel,
  onExportCsv,
  onPrintLabels,
  onBulkStatusToggle
}) => {
  if (selectedProducts.length === 0) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-theme-surface-2 text-white backdrop-blur-md px-4 py-2.5 rounded-2xl shadow-2xl border border-theme-divider flex items-center gap-4 text-xs font-mono select-none animate-in fade-in slide-in-from-bottom-4 duration-200">
      {/* Selected Counter */}
      <div className="flex items-center gap-2 pr-3 border-r border-theme-divider font-bold">
        <CheckSquare className="w-4 h-4 text-[var(--c-seef-accent)]" />
        <span>{selectedProducts.length} SKU{selectedProducts.length > 1 ? "s" : ""} Selected</span>
      </div>

      {/* Batch Action Buttons */}
      <div className="flex items-center gap-2">
        <button
          onClick={onExportExcel}
          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 font-bold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer text-white shadow-xs"
        >
          <FileSpreadsheet className="w-3.5 h-3.5" /> Export Excel
        </button>

        <button
          onClick={onExportCsv}
          className="px-3 py-1.5 bg-theme-surface-2 hover:bg-theme-surface-hover text-theme-heading font-bold rounded-lg border border-theme-divider transition-colors flex items-center gap-1.5 cursor-pointer"
        >
          <Download className="w-3.5 h-3.5" /> CSV
        </button>

        <button
          onClick={onPrintLabels}
          className="px-3 py-1.5 bg-[var(--c-seef-accent)] hover:bg-[var(--c-seef-accent)]/90 font-bold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer text-white shadow-xs"
        >
          <Printer className="w-3.5 h-3.5" /> Print Barcode Labels ({selectedProducts.length})
        </button>

        <button
          onClick={onBulkStatusToggle}
          className="px-3 py-1.5 bg-theme-surface-2 hover:bg-theme-surface-hover text-theme-heading font-bold rounded-lg border border-theme-divider transition-colors flex items-center gap-1.5 cursor-pointer"
        >
          <Power className="w-3.5 h-3.5 text-amber-400" /> Toggle Status
        </button>
      </div>

      {/* Close Selection */}
      <button
        onClick={onClearSelection}
        className="p-1 hover:bg-theme-surface-hover text-theme-muted hover:text-white rounded-md transition-colors cursor-pointer ml-1"
        title="Clear Selection"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};
