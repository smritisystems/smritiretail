/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.99.14
 * Created      : 2026-10-09
 * Modified     : 2026-10-29 (v6.99.14 — Unified body portal & #root suppression print standard)
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, Printer, Download, Copy, Check, Tag, Eye, FileCode } from "lucide-react";
import { Product } from "../../../types.ts";
import { compilePrnBatch, BUILTIN_PRN_TEMPLATES, generatePrnDownloadFilename } from "../../barcode/prnInterpolation.ts";

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
  const [printLayout, setPrintLayout] = useState<"tattly-prn" | "thermal" | "sheet">("tattly-prn");
  const [copiesPerItem, setCopiesPerItem] = useState(1);

  if (!isOpen) return null;

  const validProducts = products.filter(p => p.barcode && p.barcode.trim() !== "");

  const handleDownloadPRN = () => {
    const template = BUILTIN_PRN_TEMPLATES["Tattly Threads Footwear — 100x50.7mm"];
    const prnItems = validProducts.map(p => ({
      stockNo: p.code,
      barcode: p.barcode,
      product: p.name,
      brand: p.brand || "TATTLY THREADS",
      style: p.styleCode || p.style_code || p.style || p.article || p.article_no || p.code || "CH-30-K",
      colour: p.color || "BLACK",
      size: p.size || "37",
      mrp: Number(p.mrp ?? p.price ?? 0),
      sellingPrice: Number(p.price ?? p.mrp ?? 0),
      labelCount: copiesPerItem,
      vendorCode: p.vendor_code || (p.brand ? p.brand.replace(/\s+Threads/i, "").toUpperCase() : "TATTLY"),
    }));
    const prnContent = compilePrnBatch(template, prnItems);
    const filename = generatePrnDownloadFilename(prnItems, "prn", {
      prefix: "SMRITI",
      fallbackStyle: "CH-30-K",
      fallbackVendor: "TATTLY",
    });
    const blob = new Blob([prnContent], { type: "text/plain;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    onNotification?.("PRN Exported", `Downloaded PRN script "${filename}" for ${validProducts.length * copiesPerItem} label(s).`, "success");
  };

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

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "F9" || ((e.ctrlKey || e.metaKey) && (e.key === "p" || e.key === "P"))) {
        e.preventDefault();
        window.print();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const handleBrowserPrint = () => {
    window.print();
  };

  const pageSizeCss = printLayout === "thermal" ? "50mm 25mm" : printLayout === "tattly-prn" ? "100mm 50.7mm" : "A4 portrait";

  const modalContent = (
    <div
      className="barcode-batch-modal-root fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150 print:static print:inset-auto print:h-auto print:w-full print:p-0 print:m-0 print:bg-white print:overflow-visible print:block"
      role="dialog"
      aria-modal="true"
      aria-label="Batch Barcode Print Modal"
    >
      <style>{`
        @media print {
          @page {
            size: ${pageSizeCss};
            margin: 0;
          }
          #root {
            display: none !important;
          }
          html, body {
            height: auto !important;
            min-height: 0 !important;
            overflow: visible !important;
            overflow-x: visible !important;
            overflow-y: visible !important;
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
          }
          .barcode-batch-modal-root {
            position: static !important;
            display: block !important;
            width: 100% !important;
            height: auto !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: visible !important;
            background: white !important;
          }
          .barcode-batch-toolbar,
          .no-print {
            display: none !important;
          }
          .barcode-batch-sheet-wrapper {
            display: block !important;
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            box-shadow: none !important;
            border: none !important;
            overflow: visible !important;
            background: white !important;
          }
          .barcode-batch-grid {
            display: grid !important;
            box-shadow: none !important;
            border: none !important;
            margin: 0 !important;
            padding: 0 !important;
            visibility: visible !important;
            background: white !important;
          }
        }
      `}</style>
      <div className="barcode-batch-sheet-wrapper bg-white dark:bg-[#1e222b] rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-3xl flex flex-col max-h-[90vh] overflow-hidden print:max-h-none print:shadow-none print:border-none print:w-full print:m-0 print:p-0 print:block">
        {/* Header */}
        <div className="barcode-batch-toolbar px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0 bg-slate-50/50 dark:bg-slate-900/50 print:hidden">
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
        <div className="barcode-batch-toolbar px-6 py-3 bg-slate-100/60 dark:bg-[#171a21] border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs print:hidden">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-600 dark:text-slate-300">Format:</span>
              <div className="inline-flex rounded-lg border border-slate-300 dark:border-slate-700 p-0.5 bg-white dark:bg-slate-800">
                <button
                  type="button"
                  onClick={() => setPrintLayout("tattly-prn")}
                  className={`px-2.5 py-1 rounded-md font-semibold transition ${
                    printLayout === "tattly-prn"
                      ? "bg-blue-600 text-white shadow-xs"
                      : "text-slate-600 dark:text-slate-300 hover:text-slate-900"
                  }`}
                  title="Tattly Threads Footwear 100x50.7mm 3-Stub Master PRN Layout"
                >
                  Tattly Threads (100×50.7mm PRN)
                </button>
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
                data-field-key="copies_per_item"
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
              onClick={handleDownloadPRN}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 font-semibold text-blue-700 dark:text-blue-200 transition"
              title="Download compiled .PRN thermal script for Tattly Threads 100x50.7mm"
            >
              <FileCode size={14} />
              <span>Download .PRN</span>
            </button>
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
        <div className="barcode-batch-canvas-wrapper flex-1 min-h-0 overflow-auto p-6 print:p-0 print:overflow-visible print:block">
          {validProducts.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              <Tag size={36} className="mx-auto mb-2 opacity-30" />
              <p className="font-semibold text-sm">No barcodes available in this batch</p>
            </div>
          ) : (
            <div className="barcode-batch-grid grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 print:grid">
              {validProducts.map((p, idx) => (
                <div
                  key={p.id || `bc-${idx}`}
                  className="p-3 rounded-xl border border-slate-200 dark:border-slate-700/80 bg-slate-50/50 dark:bg-slate-800/40 flex flex-col justify-between relative hover:border-blue-300 dark:hover:border-blue-600 transition"
                >
                  <div>
                    {printLayout === "tattly-prn" && (
                      <div className="mb-1.5 flex items-center justify-between text-[9px] font-mono font-bold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-1.5 py-0.5 rounded border border-amber-200 dark:border-amber-800/50">
                        <span>Tattly Threads 3-Stub (100×50.7mm)</span>
                        <span>Dual Tear-Off</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 truncate max-w-[120px]">
                        {p.brand || "TATTLY THREADS"}
                      </span>
                      <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold">
                        {p.size ? `Size: ${p.size}` : "Size: 37"} {p.color ? `• ${p.color}` : "• BLACK"}
                      </span>
                    </div>
                    <div className="text-xs font-semibold text-slate-900 dark:text-white truncate mb-1" title={p.name}>
                      {p.name}
                    </div>
                    <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 truncate">
                      Art: {p.styleCode || p.code || "CH-30-K"}
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
        <div className="barcode-batch-toolbar px-6 py-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0 bg-slate-50 dark:bg-slate-900/50 print:hidden">
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
              onClick={handleDownloadPRN}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 text-blue-700 dark:text-blue-200 text-xs font-bold transition cursor-pointer"
            >
              <FileCode size={15} />
              <span>Download .PRN File</span>
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

  if (typeof document === "undefined" || !document?.body || typeof (document.body as any).appendChild !== "function") {
    return modalContent;
  }

  return createPortal(modalContent, document.body);
};
