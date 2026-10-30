/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.91.0
 * Created      : 2026-10-17
 * Modified     : 2026-10-17
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Bulk Barcode & CSV Import Modal Component
 */

import React, { useState, useMemo } from "react";
import { Product } from "../../../types.ts";
import { ProPosCartItem } from "../propos/types.ts";
import {
  FileSpreadsheet,
  Upload,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  X,
  FileText,
  Table,
  Plus,
  RefreshCw,
  Edit2,
  Trash2,
  ArrowRight,
  Info,
} from "lucide-react";

export type BulkAddMode = "PASTE_BARCODES" | "PASTE_BARCODE_QTY" | "IMPORT_CSV";

export interface BulkPreviewRow {
  rowNumber: number;
  barcode: string;
  qty: number;
  productName?: string;
  style?: string;
  color?: string;
  size?: string;
  unitPrice?: number;
  taxPct?: number;
  hsnCode?: string;
  matchedProduct?: Product | any;
  status: "VALID" | "WARNING" | "ERROR";
  errorMessage?: string;
}

export interface BulkAddItemsModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  onCommitItems: (itemsToAdd: { product: any; qty: number }[]) => void;
  salesperson?: string;
}

export const BulkAddItemsModal: React.FC<BulkAddItemsModalProps> = ({
  isOpen,
  onClose,
  products = [],
  onCommitItems,
  salesperson = "Amit Patil",
}) => {
  const [activeTab, setActiveTab] = useState<BulkAddMode>("PASTE_BARCODES");
  const [pasteContent, setPasteContent] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [previewRows, setPreviewRows] = useState<BulkPreviewRow[]>([]);
  const [editingRowIndex, setEditingRowIndex] = useState<number | null>(null);
  const [editBarcode, setEditBarcode] = useState<string>("");
  const [editQty, setEditQty] = useState<number>(1);

  if (!isOpen) return null;

  // ── Product Catalog Resolution Helper ────────────────────────────────────
  const resolveProduct = (identifier: string, styleHint?: string, colorHint?: string, sizeHint?: string) => {
    const cleanId = identifier.trim().toUpperCase();
    if (!cleanId) return null;

    // 1. Direct match by Barcode or SKU
    const directMatch = products.find(
      (p) =>
        (p.barcode && p.barcode.trim().toUpperCase() === cleanId) ||
        (p.sku && p.sku.trim().toUpperCase() === cleanId) ||
        (p.code && p.code.trim().toUpperCase() === cleanId) ||
        (p.id && p.id.trim().toUpperCase() === cleanId)
    );
    if (directMatch) return directMatch;

    // 2. Structured Footwear / Apparel Match (Article + Color + Size)
    if (styleHint && sizeHint) {
      const artClean = styleHint.trim().toUpperCase();
      const szClean = sizeHint.trim().toUpperCase();
      const colClean = colorHint ? colorHint.trim().toUpperCase() : "";

      const structMatch = products.find((p) => {
        const pStyle = (p.brand || (p as any).style || "").toUpperCase();
        const pSize = (p.size || "").toUpperCase();
        const pColor = ((p as any).color || "").toUpperCase();
        const matchesStyle = pStyle.includes(artClean) || (p.code || "").toUpperCase().includes(artClean);
        const matchesSize = pSize === szClean;
        const matchesColor = !colClean || pColor.includes(colClean);
        return matchesStyle && matchesSize && matchesColor;
      });
      if (structMatch) return structMatch;
    }

    return null;
  };

  // ── Parse & Validate Input Content ────────────────────────────────────────
  const handleParseAndValidate = () => {
    setIsProcessing(true);
    const lines = pasteContent
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    const rows: BulkPreviewRow[] = [];
    const seenBarcodes = new Map<string, number>();

    lines.forEach((line, index) => {
      const rowNum = index + 1;
      let barcode = "";
      let qty = 1;
      let styleHint: string | undefined;
      let colorHint: string | undefined;
      let sizeHint: string | undefined;

      if (activeTab === "PASTE_BARCODES") {
        // Mode 1: One barcode per line
        barcode = line.trim();
        qty = 1;
      } else if (activeTab === "PASTE_BARCODE_QTY") {
        // Mode 2: Barcode + Qty (Tab or Comma separated) or Footwear 4-column paste
        const delimiter = line.includes("\t") ? "\t" : ",";
        const parts = line.split(delimiter).map((p) => p.trim());

        if (parts.length >= 4) {
          // Footwear structured paste: Article, Color, Size, Qty
          styleHint = parts[0];
          colorHint = parts[1];
          sizeHint = parts[2];
          barcode = `${parts[0]}-${parts[1]}-${parts[2]}`;
          const parsedQty = Number(parts[3]);
          qty = !isNaN(parsedQty) && parsedQty > 0 ? parsedQty : 1;
        } else if (parts.length >= 2) {
          // Standard Barcode + Qty
          barcode = parts[0];
          const parsedQty = Number(parts[1]);
          qty = !isNaN(parsedQty) ? parsedQty : 1;
        } else {
          barcode = parts[0];
          qty = 1;
        }
      } else if (activeTab === "IMPORT_CSV") {
        // Mode 3: CSV line (handles headers skip if index === 0 and header detected)
        const delimiter = line.includes("\t") ? "\t" : ",";
        const parts = line.split(delimiter).map((p) => p.trim());
        if (index === 0 && (parts[0].toLowerCase().includes("barcode") || parts[0].toLowerCase().includes("code"))) {
          return; // Skip header row
        }
        barcode = parts[0];
        const parsedQty = parts.length > 1 ? Number(parts[1]) : 1;
        qty = !isNaN(parsedQty) ? parsedQty : 1;
      }

      // Check duplicate within batch
      const cleanBc = barcode.trim().toUpperCase();
      const existingCount = seenBarcodes.get(cleanBc) || 0;
      seenBarcodes.set(cleanBc, existingCount + 1);

      // Validation Checks
      let status: "VALID" | "WARNING" | "ERROR" = "VALID";
      let errorMsg: string | undefined;

      if (!barcode || cleanBc === "") {
        status = "ERROR";
        errorMsg = `Row ${rowNum}: Product barcode or code is missing.`;
      } else if (qty <= 0) {
        status = "ERROR";
        errorMsg = `Row ${rowNum}: Quantity must be greater than 0 (got ${qty}).`;
      } else if (qty > 99999) {
        status = "ERROR";
        errorMsg = `Row ${rowNum}: Quantity ${qty} exceeds maximum allowable units (99,999).`;
      } else {
        const matched = resolveProduct(barcode, styleHint, colorHint, sizeHint);
        if (!matched) {
          status = "ERROR";
          errorMsg = `Row ${rowNum}: Barcode '${barcode}' was not found in Product List.`;
        } else {
          if (existingCount > 0) {
            status = "WARNING";
            errorMsg = `Row ${rowNum}: Duplicate barcode in batch (appears ${existingCount + 1} times). Quantities will be aggregated.`;
          }
          rows.push({
            rowNumber: rowNum,
            barcode: matched.barcode || barcode,
            qty,
            productName: matched.name || "Product",
            style: matched.brand || (matched as any).style || "-",
            color: (matched as any).color || "-",
            size: (matched as any).size || "-",
            unitPrice: Number(matched.price || matched.mrp || 750),
            taxPct: Number(matched.gstPercentage ?? (matched as any).gst_rate ?? 5),
            hsnCode: matched.hsnCode || (matched as any).hsn_code || (matched as any).hsn || "6403",
            matchedProduct: matched,
            status,
            errorMessage: errorMsg,
          });
          return;
        }
      }

      rows.push({
        rowNumber: rowNum,
        barcode,
        qty,
        status,
        errorMessage: errorMsg,
      });
    });

    setPreviewRows(rows);
    setIsProcessing(false);
  };

  // ── File Upload Handler for CSV ──────────────────────────────────────────
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) {
        setPasteContent(text);
      }
    };
    reader.readAsText(file);
  };

  // ── Save Inline Edit ─────────────────────────────────────────────────────
  const handleSaveRowEdit = (index: number) => {
    setPreviewRows((prev) => {
      const updated = [...prev];
      const target = updated[index];
      const matched = resolveProduct(editBarcode);

      let status: "VALID" | "WARNING" | "ERROR" = "VALID";
      let errorMsg: string | undefined;

      if (!matched) {
        status = "ERROR";
        errorMsg = `Row ${target.rowNumber}: Barcode '${editBarcode}' was not found in Product List.`;
      } else if (editQty <= 0) {
        status = "ERROR";
        errorMsg = `Row ${target.rowNumber}: Quantity must be greater than 0.`;
      }

      updated[index] = {
        ...target,
        barcode: editBarcode,
        qty: editQty,
        productName: matched?.name || target.productName,
        style: matched?.brand || (matched as any)?.style || target.style,
        color: (matched as any)?.color || target.color,
        size: (matched as any)?.size || target.size,
        unitPrice: matched ? Number(matched.price || matched.mrp || 750) : target.unitPrice,
        taxPct: matched ? Number(matched.gstPercentage ?? (matched as any).gst_rate ?? 5) : target.taxPct,
        matchedProduct: matched || target.matchedProduct,
        status,
        errorMessage: errorMsg,
      };
      return updated;
    });
    setEditingRowIndex(null);
  };

  // ── Delete Row from Preview ──────────────────────────────────────────────
  const handleDeleteRow = (index: number) => {
    setPreviewRows((prev) => prev.filter((_, idx) => idx !== index));
  };

  // ── Commit Valid Rows to Cart ────────────────────────────────────────────
  const validRows = previewRows.filter((r) => r.status === "VALID" || r.status === "WARNING");
  const errorRows = previewRows.filter((r) => r.status === "ERROR");

  const handleCommitToCart = () => {
    if (validRows.length === 0) return;
    setIsProcessing(true);

    const itemsToAdd = validRows.map((r) => ({
      product: r.matchedProduct,
      qty: r.qty,
    }));

    onCommitItems(itemsToAdd);
    setIsProcessing(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="bg-white dark:bg-[#191c1e] text-[#191c1e] dark:text-[#eff1f3] rounded-2xl shadow-2xl border border-[#c4c5d5] dark:border-[#444653] max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#c4c5d5] dark:border-[#444653] bg-[#f8fafc] dark:bg-[#131b2e]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-[#00288e]/10 dark:bg-[#a8b8ff]/20 text-[#00288e] dark:text-[#a8b8ff] rounded-xl">
              <FileSpreadsheet size={18} />
            </div>
            <div>
              <h2 className="font-bold text-base tracking-tight">Bulk Add Items to Cart</h2>
              <p className="text-xs text-[#565e74] dark:text-[#bec6e0]">
                Paste barcodes, copy tabular quantities from Excel, or import CSV files.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 transition text-slate-500 hover:text-slate-900 dark:hover:text-white"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="flex items-center gap-2 px-6 pt-3 pb-2 border-b border-[#c4c5d5] dark:border-[#444653] bg-slate-50 dark:bg-[#171f30]">
          <button
            type="button"
            onClick={() => { setActiveTab("PASTE_BARCODES"); setPreviewRows([]); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
              activeTab === "PASTE_BARCODES"
                ? "bg-[#00288e] text-white shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800"
            }`}
          >
            <FileText size={14} />
            <span>1. Paste Barcodes</span>
          </button>

          <button
            type="button"
            onClick={() => { setActiveTab("PASTE_BARCODE_QTY"); setPreviewRows([]); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
              activeTab === "PASTE_BARCODE_QTY"
                ? "bg-[#00288e] text-white shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800"
            }`}
          >
            <Table size={14} />
            <span>2. Paste Barcode + Qty (Excel)</span>
          </button>

          <button
            type="button"
            onClick={() => { setActiveTab("IMPORT_CSV"); setPreviewRows([]); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
              activeTab === "IMPORT_CSV"
                ? "bg-[#00288e] text-white shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800"
            }`}
          >
            <Upload size={14} />
            <span>3. Import CSV File</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {previewRows.length === 0 ? (
            <div>
              {/* Instructions Banner */}
              <div className="mb-3 p-3 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 rounded-xl text-xs text-blue-800 dark:text-blue-300 flex items-start gap-2">
                <Info size={16} className="shrink-0 mt-0.5 text-blue-600 dark:text-blue-400" />
                <div>
                  {activeTab === "PASTE_BARCODES" && (
                    <span>Enter or paste one barcode per line. Each recognized barcode will be added with Quantity = 1.</span>
                  )}
                  {activeTab === "PASTE_BARCODE_QTY" && (
                    <span>
                      Copy and paste directly from Microsoft Excel or Google Sheets. Supports Tab-separated columns (<code>Barcode [TAB] Qty</code>) or Footwear format (<code>Article [TAB] Color [TAB] Size [TAB] Qty</code>).
                    </span>
                  )}
                  {activeTab === "IMPORT_CSV" && (
                    <span>Select or drag-and-drop a .csv file containing columns: <code>barcode, quantity</code>.</span>
                  )}
                </div>
              </div>

              {/* Textarea or File Input */}
              {activeTab === "IMPORT_CSV" && (
                <div className="mb-3">
                  <label className="block text-xs font-semibold mb-1.5 text-slate-700 dark:text-slate-300">
                    Upload .CSV File
                  </label>
                  <input
                    type="file"
                    accept=".csv,.txt"
                    onChange={handleFileUpload}
                    className="block w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-[#00288e] file:text-white hover:file:bg-[#001f70] cursor-pointer"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold mb-1 text-slate-700 dark:text-slate-300">
                  {activeTab === "IMPORT_CSV" ? "CSV Content Preview / Raw Input" : "Paste Data Below"}
                </label>
                <textarea
                  rows={8}
                  value={pasteContent}
                  onChange={(e) => setPasteContent(e.target.value)}
                  placeholder={
                    activeTab === "PASTE_BARCODES"
                      ? "8901234567890\n8901234567891\n8901234567893"
                      : activeTab === "PASTE_BARCODE_QTY"
                      ? "8901234567890\t2\n8901234567891\t5\nSND-18\tBEIGE\t36\t3"
                      : "barcode,quantity\n8901234567890,2\n8901234567891,1"
                  }
                  className="w-full p-3 font-mono text-xs border border-slate-300 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-[#131b2e] focus:ring-2 focus:ring-[#00288e] outline-none"
                />
              </div>

              <div className="flex justify-end mt-4">
                <button
                  type="button"
                  id="bulk-add-parse-btn"
                  onClick={handleParseAndValidate}
                  disabled={!pasteContent.trim() || isProcessing}
                  className="px-5 py-2.5 rounded-xl bg-[#00288e] hover:bg-[#001f70] text-white text-xs font-bold transition flex items-center gap-2 disabled:opacity-50 cursor-pointer"
                >
                  {isProcessing ? <RefreshCw size={14} className="animate-spin" /> : <ArrowRight size={14} />}
                  <span>Parse &amp; Validate Preview</span>
                </button>
              </div>
            </div>
          ) : (
            <div>
              {/* Validation Stats Summary Badges */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-semibold text-slate-500">
                    Total Rows: <strong className="text-slate-900 dark:text-white">{previewRows.length}</strong>
                  </span>
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-400 border border-green-300 dark:border-green-800">
                    <CheckCircle2 size={12} />
                    <span>{validRows.length} Valid</span>
                  </span>
                  {errorRows.length > 0 && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-400 border border-red-300 dark:border-red-800">
                      <XCircle size={12} />
                      <span>{errorRows.length} Failed</span>
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setPreviewRows([])}
                  className="text-xs text-blue-600 dark:text-blue-400 font-bold hover:underline flex items-center gap-1"
                >
                  <RefreshCw size={12} />
                  <span>Re-enter / Clear</span>
                </button>
              </div>

              {/* Preview Grid */}
              <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl mt-3 max-h-72">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-100 dark:bg-[#131b2e] text-slate-600 dark:text-slate-300 font-bold sticky top-0 border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="py-2 px-3 w-12 text-center">Row</th>
                      <th className="py-2 px-3">Status</th>
                      <th className="py-2 px-3">Barcode / Code</th>
                      <th className="py-2 px-3">Product Name</th>
                      <th className="py-2 px-3 text-center">Style</th>
                      <th className="py-2 px-3 text-center">Color</th>
                      <th className="py-2 px-3 text-center">Size</th>
                      <th className="py-2 px-3 text-center w-20">Qty</th>
                      <th className="py-2 px-3 text-right">Unit Rate</th>
                      <th className="py-2 px-3">Validation Message</th>
                      <th className="py-2 px-3 text-center w-16">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {previewRows.map((row, idx) => {
                      const isEditing = editingRowIndex === idx;
                      return (
                        <tr
                          key={idx}
                          className={`hover:bg-slate-50 dark:hover:bg-slate-800/40 transition ${
                            row.status === "ERROR"
                              ? "bg-red-50/50 dark:bg-red-950/20"
                              : row.status === "WARNING"
                              ? "bg-amber-50/40 dark:bg-amber-950/20"
                              : ""
                          }`}
                        >
                          <td className="py-2 px-3 text-center font-mono text-[11px] text-slate-500">
                            {row.rowNumber}
                          </td>
                          <td className="py-2 px-3">
                            {row.status === "VALID" ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-green-600 dark:text-green-400">
                                <CheckCircle2 size={12} />
                                Valid
                              </span>
                            ) : row.status === "WARNING" ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-600 dark:text-amber-400">
                                <AlertTriangle size={12} />
                                Warning
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-red-600 dark:text-red-400">
                                <XCircle size={12} />
                                Error
                              </span>
                            )}
                          </td>

                          {/* Barcode */}
                          <td className="py-2 px-3 font-mono font-bold">
                            {isEditing ? (
                              <input
                                type="text"
                                data-field-key="barcode"
                                value={editBarcode}
                                onChange={(e) => setEditBarcode(e.target.value)}
                                className="px-2 py-0.5 border border-blue-400 rounded text-xs font-mono w-28 bg-white dark:bg-slate-900"
                              />
                            ) : (
                              <span>{row.barcode}</span>
                            )}
                          </td>

                          {/* Product Name */}
                          <td className="py-2 px-3 font-medium text-slate-800 dark:text-slate-200 max-w-xs truncate">
                            {row.productName || "-"}
                          </td>

                          {/* Style */}
                          <td className="py-2 px-3 text-center text-slate-600 dark:text-slate-400">
                            {row.style || "-"}
                          </td>

                          {/* Color */}
                          <td className="py-2 px-3 text-center text-slate-600 dark:text-slate-400">
                            {row.color || "-"}
                          </td>

                          {/* Size */}
                          <td className="py-2 px-3 text-center font-bold text-slate-700 dark:text-slate-300">
                            {row.size || "-"}
                          </td>

                          {/* Qty */}
                          <td className="py-2 px-3 text-center font-bold">
                            {isEditing ? (
                              <input
                                type="number"
                                data-field-key="qty"
                                min={1}
                                max={99999}
                                value={editQty}
                                onChange={(e) => setEditQty(Number(e.target.value))}
                                className="px-2 py-0.5 border border-blue-400 rounded text-xs font-bold text-center w-16 bg-white dark:bg-slate-900"
                              />
                            ) : (
                              <span>{row.qty}</span>
                            )}
                          </td>

                          {/* Unit Rate */}
                          <td className="py-2 px-3 text-right font-mono">
                            {row.unitPrice !== undefined ? `₹${row.unitPrice.toFixed(2)}` : "-"}
                          </td>

                          {/* Validation Message */}
                          <td className="py-2 px-3 text-[11px]">
                            {row.errorMessage ? (
                              <span className={row.status === "ERROR" ? "text-red-600 dark:text-red-400" : "text-amber-600 dark:text-amber-400"}>
                                {row.errorMessage}
                              </span>
                            ) : (
                              <span className="text-slate-400">OK</span>
                            )}
                          </td>

                          {/* Actions */}
                          <td className="py-2 px-3 text-center">
                            {isEditing ? (
                              <button
                                type="button"
                                onClick={() => handleSaveRowEdit(idx)}
                                className="p-1 text-green-600 hover:bg-green-100 rounded transition"
                                title="Save Row Edit"
                              >
                                <CheckCircle2 size={14} />
                              </button>
                            ) : (
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingRowIndex(idx);
                                    setEditBarcode(row.barcode);
                                    setEditQty(row.qty);
                                  }}
                                  className="p-1 text-slate-500 hover:text-blue-600 transition"
                                  title="Edit Row"
                                >
                                  <Edit2 size={13} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteRow(idx)}
                                  className="p-1 text-slate-500 hover:text-red-600 transition"
                                  title="Remove Row"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Error Warning if any error rows exist */}
              {errorRows.length > 0 && (
                <div className="mt-3 p-2.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-800 rounded-xl text-xs text-amber-800 dark:text-amber-300 flex items-center justify-between">
                  <span>
                    <strong>Notice:</strong> {errorRows.length} rows have errors and will be omitted. Only the {validRows.length} valid rows will be committed.
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3.5 border-t border-[#c4c5d5] dark:border-[#444653] bg-slate-50 dark:bg-[#131b2e]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 transition"
          >
            Cancel
          </button>

          {previewRows.length > 0 && (
            <button
              type="button"
              id="bulk-add-commit-btn"
              onClick={handleCommitToCart}
              disabled={validRows.length === 0 || isProcessing}
              className="px-5 py-2.5 rounded-xl bg-[#16a34a] hover:bg-[#15803d] text-white text-xs font-bold transition flex items-center gap-2 shadow-xs disabled:opacity-50 cursor-pointer"
            >
              <Plus size={15} />
              <span>Add {validRows.length} Valid Items to Cart</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
