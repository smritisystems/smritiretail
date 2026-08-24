/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.0.0
 * Created      : 2026-08-21
 * Modified     : 2026-08-21
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import React, { useState } from "react";
import { ProPosCartItem } from "./types.ts";
import { X, UploadCloud, FileText, CheckCircle, AlertCircle, RefreshCw } from "lucide-react";

interface SmritiProPosPdtImportModalProps {
  onImportItems: (items: Partial<ProPosCartItem>[]) => void;
  onClose: () => void;
}

export type PdtFieldTemplate = 
  | "STOCK_ONLY" 
  | "STOCK_QTY_RATE" 
  | "STOCK_RATE_QTY" 
  | "STOCK_QTY";

export type TransactionImportType = 
  | "Sales" 
  | "Sales Return" 
  | "Void Sales" 
  | "Sales Order" 
  | "Sales Advice Slip" 
  | "Service Order";

export const SmritiProPosPdtImportModal: React.FC<SmritiProPosPdtImportModalProps> = ({
  onImportItems,
  onClose
}) => {
  const [importMode, setImportMode] = useState<"FILE" | "TRANSACTION">("FILE");
  
  // File Import State
  const [fieldTemplate, setFieldTemplate] = useState<PdtFieldTemplate>("STOCK_QTY_RATE");
  const [delimiter, setDelimiter] = useState<string>("~");
  const [filePath, setFilePath] = useState<string>("");
  const [fileContentText, setFileContentText] = useState<string>("");

  // Transaction Import State
  const [transType, setTransType] = useState<TransactionImportType>("Sales Order");
  const [billPrefix, setBillPrefix] = useState<string>("SO");
  const [billNo, setBillNo] = useState<string>("");

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFilePath(file.name);

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setFileContentText(text || "");
    };
    reader.readAsText(file);
  };

  const handleProcessImport = () => {
    if (importMode === "FILE") {
      if (!fileContentText.trim()) return;

      const lines = fileContentText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
      const parsedItems: Partial<ProPosCartItem>[] = [];

      for (const line of lines) {
        const parts = line.split(delimiter).map(p => p.trim());
        if (parts.length === 0 || !parts[0]) continue;

        let stockNo = parts[0];
        let qty = 1.0;
        let rate = 999.0;

        if (fieldTemplate === "STOCK_QTY_RATE") {
          qty = parseFloat(parts[1]) || 1.0;
          rate = parseFloat(parts[2]) || 999.0;
        } else if (fieldTemplate === "STOCK_RATE_QTY") {
          rate = parseFloat(parts[1]) || 999.0;
          qty = parseFloat(parts[2]) || 1.0;
        } else if (fieldTemplate === "STOCK_QTY") {
          qty = parseFloat(parts[1]) || 1.0;
        }

        parsedItems.push({
          sku: stockNo,
          barcode: stockNo,
          name: `Imported Item ${stockNo}`,
          qty,
          unitPrice: rate,
          mrp: rate,
          discountPct: 10.0,
          discountAmt: (rate * 10) / 100,
          taxPct: 5.0,
          taxAmt: ((rate - (rate * 10) / 100) * 5) / 100,
          lineTotal: (rate - (rate * 10) / 100) * qty,
          salesStaff: "SM1"
        });
      }

      if (parsedItems.length > 0) {
        onImportItems(parsedItems);
        onClose();
      }
    } else {
      // Transaction import mock
      if (!billNo.trim()) return;

      onImportItems([
        {
          sku: "8887462974641",
          barcode: "8887462974641",
          name: `regular straight Med Beige (${transType} #${billPrefix}-${billNo})`,
          qty: 2.0,
          unitPrice: 999.0,
          mrp: 999.0,
          discountPct: 10.0,
          discountAmt: 99.9,
          taxPct: 5.0,
          taxAmt: 42.81,
          lineTotal: 1798.2,
          salesStaff: "SM1"
        }
      ]);
      onClose();
    }
  };

  const handleClear = () => {
    setFilePath("");
    setFileContentText("");
    setBillNo("");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="bg-white dark:bg-[#191c1e] text-[#191c1e] dark:text-[#eff1f3] w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col border border-[#c4c5d5] dark:border-[#444653]">
        
        {/* Header */}
        <div className="px-6 py-3.5 border-b border-[#c4c5d5] dark:border-[#444653] bg-[#f8f9fa] dark:bg-[#131b2e] flex justify-between items-center shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-[#00288e] text-white rounded-lg">
              <UploadCloud size={18} />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#191c1d] dark:text-white">PDT Import — Item Details Loading</h3>
              <p className="text-xs text-[#565e74] dark:text-[#bec6e0]">Import items from Portable Data Terminal (PDT) file or saved transaction.</p>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose}
            className="text-[#565e74] hover:bg-[#f3f4f5] p-1.5 rounded-lg transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Mode Switcher */}
        <div className="px-6 pt-4 pb-2 border-b border-[#eceef0] dark:border-[#2d3133] flex items-center gap-4 bg-[#f8f9fa] dark:bg-[#131b2e]">
          <span className="text-xs font-bold uppercase tracking-wider text-[#565e74] dark:text-[#bec6e0]">Import from:</span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setImportMode("FILE")}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition ${
                importMode === "FILE"
                  ? "bg-[#00288e] text-white shadow-xs"
                  : "bg-white dark:bg-[#2d3133] border border-[#c4c5d5] dark:border-[#444653] text-[#565e74]"
              }`}
            >
              File (PDT Data)
            </button>
            <button
              type="button"
              onClick={() => setImportMode("TRANSACTION")}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition ${
                importMode === "TRANSACTION"
                  ? "bg-[#00288e] text-white shadow-xs"
                  : "bg-white dark:bg-[#2d3133] border border-[#c4c5d5] dark:border-[#444653] text-[#565e74]"
              }`}
            >
              Transaction (SO / Advice Slip)
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 flex flex-col gap-4">
          
          {importMode === "FILE" ? (
            <div className="space-y-4">
              
              {/* Field Template Selection */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-[#565e74] dark:text-[#bec6e0] mb-1">
                    Field Template
                  </label>
                  <select
                    value={fieldTemplate}
                    onChange={e => setFieldTemplate(e.target.value as any)}
                    className="w-full px-3 py-2 border border-[#c4c5d5] dark:border-[#444653] rounded-xl bg-[#f8f9fa] dark:bg-[#131b2e] text-xs font-semibold outline-none focus:border-[#00288e]"
                  >
                    <option value="STOCK_QTY_RATE">Stock Number + Qty + Rate</option>
                    <option value="STOCK_RATE_QTY">Stock Number + Rate + Qty</option>
                    <option value="STOCK_QTY">Stock Number + Qty</option>
                    <option value="STOCK_ONLY">Stock Number</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-[#565e74] dark:text-[#bec6e0] mb-1">
                    Delimiter Character
                  </label>
                  <select
                    value={delimiter}
                    onChange={e => setDelimiter(e.target.value)}
                    className="w-full px-3 py-2 border border-[#c4c5d5] dark:border-[#444653] rounded-xl bg-[#f8f9fa] dark:bg-[#131b2e] text-xs font-mono font-bold outline-none focus:border-[#00288e]"
                  >
                    <option value="~">Tilde (~)</option>
                    <option value=",">Comma (,)</option>
                    <option value="|">Pipe (|)</option>
                    <option value="	">Tab (\t)</option>
                  </select>
                </div>
              </div>

              {/* Path & File Upload */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-[#565e74] dark:text-[#bec6e0] mb-1">
                  PDT File Path / Upload
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    readOnly
                    value={filePath || "Select file from disk..."}
                    className="flex-1 px-3 py-2 border border-[#c4c5d5] dark:border-[#444653] rounded-xl bg-[#f8f9fa] dark:bg-[#131b2e] text-xs font-mono outline-none"
                  />
                  <label className="px-4 py-2 bg-[#00288e] text-white text-xs font-bold rounded-xl hover:bg-[#1e40af] transition cursor-pointer flex items-center gap-1.5 shadow-xs">
                    <FileText size={14} />
                    Browse...
                    <input
                      type="file"
                      accept=".txt,.csv,.pdt,.dat"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              {/* File Preview */}
              {fileContentText && (
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-[#565e74] dark:text-[#bec6e0] mb-1">
                    Raw File Preview
                  </label>
                  <textarea
                    rows={4}
                    value={fileContentText}
                    onChange={e => setFileContentText(e.target.value)}
                    className="w-full p-2.5 border border-[#c4c5d5] dark:border-[#444653] rounded-xl bg-white dark:bg-[#131b2e] text-xs font-mono outline-none"
                  />
                </div>
              )}

            </div>
          ) : (
            <div className="space-y-4">
              
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-1">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-[#565e74] dark:text-[#bec6e0] mb-1">
                    Transaction Type
                  </label>
                  <select
                    value={transType}
                    onChange={e => {
                      const t = e.target.value as TransactionImportType;
                      setTransType(t);
                      if (t === "Sales Order") setBillPrefix("SO");
                      else if (t === "Sales Advice Slip") setBillPrefix("SA");
                      else if (t === "Service Order") setBillPrefix("SVO");
                      else if (t === "Sales Return") setBillPrefix("SR");
                      else setBillPrefix("INV");
                    }}
                    className="w-full px-3 py-2 border border-[#c4c5d5] dark:border-[#444653] rounded-xl bg-[#f8f9fa] dark:bg-[#131b2e] text-xs font-semibold outline-none focus:border-[#00288e]"
                  >
                    <option value="Sales Order">Sales Order</option>
                    <option value="Sales Advice Slip">Sales Advice Slip</option>
                    <option value="Service Order">Service Order</option>
                    <option value="Sales">Sales Bill</option>
                    <option value="Sales Return">Sales Return</option>
                    <option value="Void Sales">Void Sales</option>
                  </select>
                </div>

                <div className="col-span-1">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-[#565e74] dark:text-[#bec6e0] mb-1">
                    Bill Prefix
                  </label>
                  <input
                    type="text"
                    value={billPrefix}
                    onChange={e => setBillPrefix(e.target.value)}
                    className="w-full px-3 py-2 border border-[#c4c5d5] dark:border-[#444653] rounded-xl bg-[#f8f9fa] dark:bg-[#131b2e] text-xs font-mono font-bold text-center outline-none focus:border-[#00288e]"
                  />
                </div>

                <div className="col-span-1">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-[#565e74] dark:text-[#bec6e0] mb-1">
                    Bill Doc Number
                  </label>
                  <input
                    type="text"
                    value={billNo}
                    onChange={e => setBillNo(e.target.value)}
                    placeholder="e.g. 1001"
                    className="w-full px-3 py-2 border border-[#c4c5d5] dark:border-[#444653] rounded-xl bg-white dark:bg-[#131b2e] text-xs font-mono font-bold outline-none focus:border-[#00288e]"
                  />
                </div>
              </div>

            </div>
          )}

        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#c4c5d5] dark:border-[#444653] bg-[#f8f9fa] dark:bg-[#131b2e] flex justify-between items-center">
          <button
            type="button"
            onClick={handleClear}
            className="px-4 py-2 border border-[#c4c5d5] dark:border-[#444653] bg-white dark:bg-[#2d3133] rounded-xl text-xs font-bold hover:bg-[#eceef0] transition"
          >
            Clear Entries
          </button>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-[#565e74] hover:bg-[#eceef0] rounded-xl transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleProcessImport}
              className="px-6 py-2 bg-[#00288e] hover:bg-[#1e40af] text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
            >
              <CheckCircle size={15} />
              <span>Ok (Load Items)</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default SmritiProPosPdtImportModal;
