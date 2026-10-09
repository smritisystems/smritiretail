/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.70.50
 * Created      : 2026-10-09
 * Modified     : 2026-10-09 (v6.70.50 — Batch barcode label preview and thermal/sheet print modal)
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import React, { useState } from "react";
import { X, Printer, Download, Copy, Check, Tag, Eye } from "lucide-react";
import { Product } from "../../../types.ts";

interface BatchBarcodePrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  batchTitle?: string;
  onNotification?: (title: string, message: string, type?: "success" | "error" | "info" | "warning") => void;
}

export const BatchBarcodePrintModal: React.FC<BatchBarcodePrintModalProps> = ({
  isOpen,
  onClose,
  products = [],
  batchTitle = "Imported Batch",
  onNotification,
}) => {
  const [copied, setCopied] = useState(false);
  const [printLayout, setPrintLayout] = useState<"thermal" | "sheet">("thermal");
  const [copiesPerItem, setCopiesPerItem] = useState(1);

  if (!isOpen) return null;

  const validProducts = products.filter(p => p.barcode && p.barcode.trim() !== "");

  const handleCopyAllBarcodes = () => {
    const list = validProducts.map(p => p.barcode).join("\n");
    navigator.clipboard.writeText(list).then(() => {
      setCopied(true);
      onNotification?.("Copied", `Copied ${validProducts.length} barcodes to clipboard.`, "success");
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleExportBarcodeCSV = () => {
    const headers = ["SKU", "Barcode", "Product Name", "Brand", "Color", "Size", "MRP", "Selling Price"];
    const rows = validProducts.map(p => [
      `"${p.code || ""}"`,
      `"${p.barcode || ""}"`,
      `"${(p.name || "").replace(/"/g, '""')}"`,
      `"${(p.brand || "").replace(/"/g, '""')}"`,
      `"${p.color || ""}"`,
      `"${p.size || ""}"`,
      p.mrp ?? p.price ?? 0,
      p.price ?? 0,
    ]);

    const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `SMRITI_Barcodes_${batchTitle.replace(/\s+/g, "_")}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    onNotification?.("Exported", `Downloaded CSV for ${validProducts.length} barcodes.`, "success");
  };

  const handleBrowserPrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-white dark:bg-[#1e222b] rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-3xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Tag size={20} />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                Barcode Label Queue
                <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-mono font-semibold border border-blue-200 dark:border-blue-800">
                  {validProducts.length} Items Ready
                </span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Source: {batchTitle}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Toolbar Controls */}
        <div className="px-6 py-3 bg-slate-100/60 dark:bg-[#171a21] border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-600 dark:text-slate-300">Format:</span>
              <div className="inline-flex rounded-lg border border-slate-300 dark:border-slate-700 p-0.5 bg-white dark:bg-slate-800">
                <button
                  type="button"
                  onClick={() => setPrintLayout("thermal")}
                  className={`px-2.5 py-1 rounded-md font-semibold transition ${
                    printLayout === "thermal"
                      ? "bg-blue-600 text-white shadow-xs"
                      : "text-slate-600 dark:text-slate-300 hover:text-slate-900"
                  }`}
                >
                  Thermal (50x25mm)
                </button>
                <button
                  type="button"
                  onClick={() => setPrintLayout("sheet")}
                  className={`px-2.5 py-1 rounded-md font-semibold transition ${
                    printLayout === "sheet"
                      ? "bg-blue-600 text-white shadow-xs"
                      : "text-slate-600 dark:text-slate-300 hover:text-slate-900"
                  }`}
                >
                  A4 Sheet (24-up)
                </button>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-slate-600 dark:text-slate-300">Copies:</span>
              <input
                type="number"
                min={1}
                max={50}
                value={copiesPerItem}
                onChange={(e) => setCopiesPerItem(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-14 px-2 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-center font-mono"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyAllBarcodes}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 font-semibold text-slate-700 dark:text-slate-200 transition"
            >
              {copied ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}
              <span>{copied ? "Copied!" : "Copy Barcodes"}</span>
            </button>
            <button
              type="button"
              onClick={handleExportBarcodeCSV}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 font-semibold text-slate-700 dark:text-slate-200 transition"
            >
              <Download size={14} />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {/* Item Preview List */}
        <div className="flex-1 min-h-0 overflow-auto p-6">
          {validProducts.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              <Tag size={36} className="mx-auto mb-2 opacity-30" />
              <p className="font-semibold text-sm">No barcodes available in this batch</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {validProducts.map((p, idx) => (
                <div
                  key={p.id || `bc-${idx}`}
                  className="p-3 rounded-xl border border-slate-200 dark:border-slate-700/80 bg-slate-50/50 dark:bg-slate-800/40 flex flex-col justify-between relative hover:border-blue-300 dark:hover:border-blue-600 transition"
                >
                  <div>
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 truncate max-w-[120px]">
                        {p.brand || "SMRITI"}
                      </span>
                      <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                        {p.size ? `Size: ${p.size}` : ""} {p.color ? `• ${p.color}` : ""}
                      </span>
                    </div>
                    <div className="text-xs font-semibold text-slate-900 dark:text-white truncate mb-1" title={p.name}>
                      {p.name}
                    </div>
                    <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 truncate">
                      SKU: {p.code}
                    </div>
                  </div>

                  <div className="mt-3 pt-2 border-t border-slate-200 dark:border-slate-700/60 flex items-center justify-between">
                    <div>
                      <div className="text-[10px] text-slate-400 font-mono tracking-wider font-bold">
                        {p.barcode}
                      </div>
                      <div className="text-[9px] text-slate-400">
                        Type: {p.barcode.length === 13 ? "EAN-13" : "Code-128"}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-bold text-slate-900 dark:text-white font-mono">
                        ₹{Number(p.mrp ?? p.price ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </div>
                      <div className="text-[9px] text-slate-400 uppercase">MRP Incl. Tax</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0 bg-slate-50 dark:bg-slate-900/50">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            Total Labels to Print: <strong className="text-slate-800 dark:text-slate-200">{validProducts.length * copiesPerItem}</strong>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              Close
            </button>
            <button
              type="button"
              onClick={handleBrowserPrint}
              className="flex items-center gap-2 px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-500/20 transition cursor-pointer"
            >
              <Printer size={15} />
              <span>Print {validProducts.length * copiesPerItem} Labels</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
