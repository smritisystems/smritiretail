/**
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Organization : AITDL NETWORKS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.34.0
 * Created      : 2026-09-20
 * Modified     : 2026-09-20
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 * Capability    : @SmritiCapability("PURCHASE", "GRN_CSV_IMPORT")
 * Target UI    : SMRITI GRN Studio — Intelligent Vendor Packing List & ASN CSV Inward Engine
 */

import React, { useState, useRef, useCallback } from "react";
import {
  Upload,
  X,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Download,
  AlertCircle,
  TrendingUp,
  Layers,
  ArrowRight,
  Sparkles,
} from "lucide-react";

export interface ParsedGrnCsvRow {
  row_index: number;
  barcode: string;
  sku: string;
  name: string;
  size: string;
  color: string;
  quantity_received: number;
  quantity_damaged: number;
  invoice_rate: number;
  cost_price?: number;
  mrp: number;
  gst_rate: number;
  status: "VALID" | "WARNING" | "UNRECOGNIZED";
  message?: string;
  po_matched?: boolean;
  rate_variance?: number; // invoice_rate - po_rate
}

interface GrnCsvImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (rows: ParsedGrnCsvRow[], mode: "merge" | "append" | "replace") => void;
  existingPoLines?: Array<{
    code: string;
    product_id: string;
    name: string;
    size?: string;
    color?: string;
    cost_price: number;
    quantity_ordered: number;
    mrp?: number;
    gst_rate?: number;
  }>;
}

const SAMPLE_CSV_TEMPLATE = `Barcode,SKU,Product Name,Size,Color,Received Qty,Damaged Qty,Invoice Rate,MRP,GST %
8901234567890,SH-001,Runner Pro (Men's Running Shoes),8,Black,200,0,1450.00,2499.00,18
8901234567891,SH-002,City Walk (Men's Casual Shoes),9,Brown,298,2,1300.00,2499.00,18
8901234567892,SH-003,Trail Blazer (Outdoor Shoes),8,Olive,250,0,1650.00,2499.00,18
8901234567893,SH-004,Kids Sport (Kids Shoes),4,Navy,482,8,850.00,1599.00,18
`;

export const GrnCsvImportModal: React.FC<GrnCsvImportModalProps> = ({
  isOpen,
  onClose,
  onImport,
  existingPoLines = [],
}) => {
  const [dragActive, setDragActive] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedGrnCsvRow[]>([]);
  const [rawText, setRawText] = useState("");
  const [importMode, setImportMode] = useState<"merge" | "append" | "replace">(
    existingPoLines.length > 0 ? "merge" : "append"
  );
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Normalize and parse CSV or PDT string
  const parseInwardCsv = useCallback(
    (text: string): ParsedGrnCsvRow[] => {
      const clean = text.replace(/^\uFEFF/, "").trim(); // strip UTF-8 BOM
      if (!clean) return [];

      const lines = clean
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter((l) => l.length > 0 && !l.startsWith("#"));

      if (lines.length === 0) return [];

      // Check if PDT tilde/pipe delimited (e.g. barcode~qty~rate or barcode|qty|rate)
      const isPdt = lines[0].includes("~") || (!lines[0].includes(",") && lines[0].includes("|"));
      const delimiter = isPdt ? (lines[0].includes("~") ? "~" : "|") : ",";

      // Split into cells handling RFC 4180 quotes if CSV
      const parseLine = (lineStr: string): string[] => {
        if (delimiter !== ",") {
          return lineStr.split(delimiter).map((c) => c.trim());
        }
        const cells: string[] = [];
        let cur = "";
        let inQuotes = false;
        for (let i = 0; i < lineStr.length; i++) {
          const char = lineStr[i];
          if (char === '"') {
            if (inQuotes && lineStr[i + 1] === '"') {
              cur += '"';
              i++;
            } else {
              inQuotes = !inQuotes;
            }
          } else if (char === "," && !inQuotes) {
            cells.push(cur.trim());
            cur = "";
          } else {
            cur += char;
          }
        }
        cells.push(cur.trim());
        return cells;
      };

      let headers: string[] = [];
      let dataLines = lines;

      // Check if first line contains textual column headers
      const firstLineCells = parseLine(lines[0]);
      const hasHeader = firstLineCells.some((c) =>
        /^(barcode|sku|code|item|product|qty|quantity|rate|price|mrp|cost|name|description)/i.test(c)
      );

      if (hasHeader) {
        headers = firstLineCells.map((h) => h.toLowerCase().replace(/[^a-z0-9]/g, ""));
        dataLines = lines.slice(1);
      } else {
        // Positional defaults: [barcode, sku, name, qty, rate, mrp, gst]
        headers = ["barcode", "sku", "name", "qty", "rate", "mrp", "gst"];
      }

      // Column index lookups
      const findColIdx = (patterns: string[]): number => {
        return headers.findIndex((h) => patterns.some((p) => h.includes(p)));
      };

      const idxBarcode = findColIdx(["barcode", "ean", "upc"]);
      const idxSku = findColIdx(["sku", "code", "itemcode", "prodcode", "article", "style"]);
      const idxName = findColIdx(["name", "product", "desc", "item", "title"]);
      const idxSize = findColIdx(["size", "dim"]);
      const idxColor = findColIdx(["color", "colour", "shade"]);
      const idxQty = findColIdx(["qty", "quantity", "received", "inward", "units", "shipped"]);
      const idxDamage = findColIdx(["damage", "damaged", "shortage", "reject"]);
      const idxRate = findColIdx(["rate", "invoice", "price", "cost", "buying", "unitprice"]);
      const idxMrp = findColIdx(["mrp", "retail"]);
      const idxGst = findColIdx(["gst", "tax"]);

      const results: ParsedGrnCsvRow[] = [];

      dataLines.forEach((lineStr, lineIdx) => {
        const cells = parseLine(lineStr);
        if (cells.length === 0 || cells.every((c) => !c)) return;

        const barcode = idxBarcode >= 0 ? cells[idxBarcode] || "" : "";
        let sku = idxSku >= 0 ? cells[idxSku] || "" : "";
        let name = idxName >= 0 ? cells[idxName] || "" : "";
        const size = idxSize >= 0 ? cells[idxSize] || "M" : "M";
        const color = idxColor >= 0 ? cells[idxColor] || "Standard" : "Standard";

        const qtyReceived = Math.max(0, Number(idxQty >= 0 ? cells[idxQty] : 1) || 0);
        const qtyDamaged = Math.max(0, Number(idxDamage >= 0 ? cells[idxDamage] : 0) || 0);
        const invRate = Number(idxRate >= 0 ? cells[idxRate] : 0) || 0;
        const mrp = Number(idxMrp >= 0 ? cells[idxMrp] : 0) || (invRate > 0 ? invRate * 1.5 : 0);
        const gstRate = Number(idxGst >= 0 ? cells[idxGst] : 18) || 18;

        // Auto fallback if sku empty
        if (!sku && barcode) {
          sku = barcode;
        }
        if (!sku && !barcode) {
          sku = `ITEM-${lineIdx + 1}`;
        }
        if (!name) {
          name = `Material SKU ${sku}`;
        }

        // Match against existing PO lines if loaded
        let poMatched = false;
        let poContractCost = invRate;
        let rateVariance = 0;

        if (existingPoLines && existingPoLines.length > 0) {
          const match = existingPoLines.find(
            (p) =>
              p.code.toLowerCase() === sku.toLowerCase() ||
              (barcode && p.code.toLowerCase() === barcode.toLowerCase()) ||
              p.name.toLowerCase() === name.toLowerCase()
          );
          if (match) {
            poMatched = true;
            poContractCost = match.cost_price;
            rateVariance = Number((invRate - poContractCost).toFixed(2));
          }
        }

        let status: "VALID" | "WARNING" | "UNRECOGNIZED" = "VALID";
        let message: string | undefined = undefined;

        if (qtyReceived <= 0) {
          status = "WARNING";
          message = "Zero received quantity specified.";
        } else if (rateVariance > 0) {
          status = "WARNING";
          message = `Billed rate ₹${invRate} exceeds PO rate ₹${poContractCost} (+₹${rateVariance} PPV).`;
        } else if (!poMatched && existingPoLines.length > 0) {
          status = "UNRECOGNIZED";
          message = "SKU not found in active Purchase Order contract.";
        }

        results.push({
          row_index: lineIdx + 1,
          barcode,
          sku,
          name,
          size,
          color,
          quantity_received: qtyReceived,
          quantity_damaged: qtyDamaged,
          invoice_rate: invRate || poContractCost,
          cost_price: poContractCost,
          mrp,
          gst_rate: gstRate,
          status,
          message,
          po_matched: poMatched,
          rate_variance: rateVariance,
        });
      });

      return results;
    },
    [existingPoLines]
  );

  const handleFile = (file: File) => {
    setErrorMsg(null);
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = (e.target?.result as string) || "";
      setRawText(text);
      try {
        const rows = parseInwardCsv(text);
        if (rows.length === 0) {
          setErrorMsg("No readable items found in file. Ensure file contains data rows.");
        }
        setParsedRows(rows);
      } catch (err: any) {
        setErrorMsg(err.message || "Failed to parse CSV file.");
      }
    };
    reader.onerror = () => setErrorMsg("Could not read file from disk.");
    reader.readAsText(file, "UTF-8");
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true);
    else if (e.type === "dragleave") setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleDownloadTemplate = () => {
    const blob = new Blob([SAMPLE_CSV_TEMPLATE], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "grn_inward_template.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Metrics
  const totalItemsCount = parsedRows.length;
  const validItemsCount = parsedRows.filter((r) => r.status === "VALID").length;
  const warningCount = parsedRows.filter((r) => r.status === "WARNING").length;
  const unrecognizedCount = parsedRows.filter((r) => r.status === "UNRECOGNIZED").length;
  const totalReceivedQty = parsedRows.reduce((sum, r) => sum + r.quantity_received, 0);
  const totalInwardValue = parsedRows.reduce(
    (sum, r) => sum + r.quantity_received * r.invoice_rate,
    0
  );

  const handleConfirmImport = () => {
    if (parsedRows.length === 0) return;
    onImport(parsedRows, importMode);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-indigo-600 text-white shadow-xs">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-slate-900 dark:text-white tracking-tight">
                Import Inward Packing List / Vendor CSV
              </h3>
              <p className="text-xs text-slate-500">
                Bulk ingest supplier dispatch invoices, ASN challans, or PDT terminal scans
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDownloadTemplate}
              className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-750 text-xs font-semibold text-slate-700 dark:text-slate-300 transition flex items-center gap-1.5"
              title="Download standard CSV template"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download Template</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Dropzone Area */}
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition flex flex-col items-center justify-center gap-2 ${
              dragActive
                ? "border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/30"
                : fileName
                ? "border-emerald-400 bg-emerald-50/20 dark:bg-emerald-950/10"
                : "border-slate-300 dark:border-slate-700 hover:border-indigo-400 dark:hover:border-indigo-500 bg-slate-50/50 dark:bg-slate-850/50"
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.tsv,.txt"
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  handleFile(e.target.files[0]);
                }
              }}
            />

            <div className="p-3 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400">
              <FileText className="w-6 h-6" />
            </div>

            <div>
              <span className="font-bold text-xs text-slate-800 dark:text-slate-200">
                {fileName ? fileName : "Click to select or drag & drop Inward CSV / PDT file"}
              </span>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Supports standard comma/tab delimited CSVs and tilde-delimited PDT formats (`barcode~qty~rate`)
              </p>
            </div>
          </div>

          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {parsedRows.length > 0 && (
            <>
              {/* Summary Metric Strip */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                  <span className="font-mono font-extrabold text-sm text-slate-900 dark:text-white block">
                    {totalItemsCount}
                  </span>
                  <span className="text-[11px] text-slate-500">Total Rows</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                  <span className="font-mono font-extrabold text-sm text-indigo-600 dark:text-indigo-400 block">
                    {totalReceivedQty.toLocaleString()}
                  </span>
                  <span className="text-[11px] text-slate-500">Inward Units</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                  <span className="font-mono font-extrabold text-sm text-emerald-600 dark:text-emerald-400 block">
                    ₹{totalInwardValue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </span>
                  <span className="text-[11px] text-slate-500">Gross Invoice Value</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                  <span className="font-mono font-extrabold text-sm text-amber-600 dark:text-amber-400 block">
                    {warningCount + unrecognizedCount}
                  </span>
                  <span className="text-[11px] text-slate-500">Variances / Alerts</span>
                </div>
              </div>

              {/* Import Mode Radio Selectors */}
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
                <div className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-indigo-600" />
                  <span>Target Inward Strategy:</span>
                </div>
                <div className="flex flex-wrap items-center gap-4 text-xs">
                  {existingPoLines.length > 0 && (
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="importMode"
                        value="merge"
                        checked={importMode === "merge"}
                        onChange={() => setImportMode("merge")}
                        className="text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="font-medium text-slate-700 dark:text-slate-300">
                        Reconcile Active PO Lines
                      </span>
                    </label>
                  )}
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="importMode"
                      value="append"
                      checked={importMode === "append"}
                      onChange={() => setImportMode("append")}
                      className="text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="font-medium text-slate-700 dark:text-slate-300">
                      Append to Workspace
                    </span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="importMode"
                      value="replace"
                      checked={importMode === "replace"}
                      onChange={() => setImportMode("replace")}
                      className="text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="font-medium text-slate-700 dark:text-slate-300">
                      Replace All Items
                    </span>
                  </label>
                </div>
              </div>

              {/* Parsed Items Table */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs">
                <div className="overflow-x-auto max-h-64">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-semibold sticky top-0 z-10 border-b border-slate-200 dark:border-slate-700">
                      <tr>
                        <th className="py-2.5 px-3">#</th>
                        <th className="py-2.5 px-3">SKU / Barcode</th>
                        <th className="py-2.5 px-3">Product Name</th>
                        <th className="py-2.5 px-2">Size/Col</th>
                        <th className="py-2.5 px-3 text-right">Recv Qty</th>
                        <th className="py-2.5 px-3 text-right">Invoice Rate</th>
                        <th className="py-2.5 px-3 text-right">MRP</th>
                        <th className="py-2.5 px-3 text-center">Status / Variance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {parsedRows.map((row, idx) => (
                        <tr
                          key={idx}
                          className={`hover:bg-slate-50 dark:hover:bg-slate-850/50 transition ${
                            row.status === "WARNING"
                              ? "bg-amber-50/20 dark:bg-amber-950/10"
                              : row.status === "UNRECOGNIZED"
                              ? "bg-slate-100/50 dark:bg-slate-800/40"
                              : ""
                          }`}
                        >
                          <td className="py-2 px-3 font-mono text-slate-400">{row.row_index}</td>
                          <td className="py-2 px-3">
                            <div className="font-mono font-bold text-slate-800 dark:text-slate-200">
                              {row.sku}
                            </div>
                            {row.barcode && (
                              <div className="text-[10px] font-mono text-slate-400">{row.barcode}</div>
                            )}
                          </td>
                          <td className="py-2 px-3 text-slate-800 dark:text-slate-200 font-medium">
                            {row.name}
                          </td>
                          <td className="py-2 px-2 text-slate-500 font-mono text-[11px]">
                            {row.size}/{row.color}
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-indigo-600 dark:text-indigo-400">
                            {row.quantity_received}
                            {row.quantity_damaged > 0 && (
                              <span className="text-rose-500 text-[10px] ml-1">
                                (-{row.quantity_damaged})
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-semibold text-slate-800 dark:text-slate-200">
                            ₹{row.invoice_rate.toFixed(2)}
                          </td>
                          <td className="py-2 px-3 text-right font-mono text-slate-500">
                            ₹{row.mrp.toFixed(2)}
                          </td>
                          <td className="py-2 px-3 text-center">
                            {row.rate_variance && row.rate_variance > 0 ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-300">
                                +₹{row.rate_variance} PPV
                              </span>
                            ) : row.po_matched ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300">
                                PO Matched
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                                Direct Inward
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 flex items-center justify-between">
          <div className="text-xs text-slate-500">
            {parsedRows.length > 0 && (
              <span>
                Ready to import <strong>{totalItemsCount}</strong> items (
                <strong>{totalReceivedQty}</strong> units).
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmImport}
              disabled={parsedRows.length === 0}
              className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs shadow-md transition flex items-center gap-1.5"
            >
              <span>Confirm &amp; Load Inward</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
