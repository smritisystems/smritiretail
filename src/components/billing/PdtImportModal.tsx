/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.30.0
 * Created      : 2026-08-21
 * Modified     : 2026-08-21
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import React, { useState, useRef } from "react";
import { Product } from "../../types.ts";
import { PdtImportRow } from "./types.ts";

interface PdtImportModalProps {
  isOpen: boolean;
  products: Product[];
  onImportItems: (items: { product: Product; qty: number }[]) => void;
  onClose: () => void;
}

export const PdtImportModal: React.FC<PdtImportModalProps> = ({
  isOpen,
  products,
  onImportItems,
  onClose
}) => {
  const [rawText, setRawText] = useState("");
  const [parsedRows, setParsedRows] = useState<PdtImportRow[]>([]);
  const [hasParsed, setHasParsed] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleParse = (text: string) => {
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const rows: PdtImportRow[] = [];

    lines.forEach(line => {
      // Split by comma, tab, space, or semicolon
      const parts = line.split(/[,;\t\s]+/).filter(Boolean);
      if (parts.length > 0) {
        const barcode = parts[0];
        let qty = 1;
        if (parts.length > 1) {
          const parsedQty = parseFloat(parts[1]);
          if (!isNaN(parsedQty) && parsedQty > 0) {
            qty = parsedQty;
          }
        }
        
        const matchedProduct = products.find(
          p => p.barcode === barcode || p.code === barcode
        );

        rows.push({
          barcode,
          qty,
          stockNo: matchedProduct?.code,
          description: matchedProduct?.name
        });
      }
    });

    setParsedRows(rows);
    setHasParsed(true);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        setRawText(content);
        handleParse(content);
      }
    };
    reader.readAsText(file);
  };

  const handleCommit = () => {
    const itemsToImport: { product: Product; qty: number }[] = [];

    parsedRows.forEach(row => {
      const matched = products.find(
        p => p.barcode === row.barcode || p.code === row.barcode
      );
      if (matched) {
        itemsToImport.push({ product: matched, qty: row.qty });
      }
    });

    if (itemsToImport.length > 0) {
      onImportItems(itemsToImport);
      onClose();
    }
  };

  const matchedCount = parsedRows.filter(r => r.stockNo).length;
  const unmatchedCount = parsedRows.length - matchedCount;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 font-sans animate-in fade-in duration-150">
      <div className="bg-[#faf9ff] text-[#1a1b20] w-full max-w-3xl rounded-lg shadow-2xl border border-[#c4c6d4] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-[#00296d] text-white px-4 py-2.5 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[20px]">cloud_upload</span>
            <span className="font-bold text-sm tracking-wide">Import PDT / Batch Barcode File</span>
          </div>
          <button 
            type="button"
            onClick={onClose}
            className="p-1 hover:bg-white/20 rounded transition-colors text-white"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <p className="text-xs text-[#434652]">
              Upload a PDT collector file (<span className="font-mono font-bold">.txt, .csv, .pdt</span>) or paste barcode batch list:
            </p>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="bg-[#e9edff] text-[#00296d] border border-[#00296d] px-3 py-1 rounded text-xs font-bold uppercase hover:bg-[#cdddff] flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-[16px]">file_open</span>
              Browse File
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,.csv,.pdt,.tsv"
              onChange={handleFileUpload}
              className="hidden"
            />
          </div>

          {/* Paste Area */}
          <textarea
            value={rawText}
            onChange={(e) => {
              setRawText(e.target.value);
              handleParse(e.target.value);
            }}
            placeholder={`Format: Barcode, Quantity (one per line)\nExample:\n8901234567890, 2\n8909876543210, 1\nSKU-OXF-001, 5`}
            rows={5}
            className="w-full p-2.5 bg-white border border-[#737685] rounded text-xs font-mono focus:ring-2 focus:ring-[#00296d] outline-none shadow-inner"
          />

          {/* Preview / Validation Table */}
          {hasParsed && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-[#434652]">Parsed Rows ({parsedRows.length})</span>
                <div className="flex gap-2">
                  <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-bold text-[11px]">
                    ✓ {matchedCount} Matched
                  </span>
                  {unmatchedCount > 0 && (
                    <span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded font-bold text-[11px]">
                      ⚠ {unmatchedCount} Unmatched
                    </span>
                  )}
                </div>
              </div>

              <div className="max-h-48 overflow-y-auto border border-[#c4c6d4] rounded bg-white custom-scrollbar">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="sticky top-0 bg-[#e8e7ed] border-b border-[#c4c6d4] text-[10px] font-bold text-[#434652] uppercase">
                    <tr>
                      <th className="p-1.5 border-r border-[#c4c6d4]">Barcode / SKU</th>
                      <th className="p-1.5 border-r border-[#c4c6d4] text-center w-16">Qty</th>
                      <th className="p-1.5 border-r border-[#c4c6d4]">Item Description</th>
                      <th className="p-1.5 text-center w-20">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#e2e2e8]">
                    {parsedRows.map((r, i) => (
                      <tr key={i} className={r.stockNo ? "bg-white" : "bg-red-50"}>
                        <td className="p-1.5 font-mono font-semibold border-r border-[#c4c6d4]/60">{r.barcode}</td>
                        <td className="p-1.5 font-mono text-center font-bold border-r border-[#c4c6d4]/60">{r.qty}</td>
                        <td className="p-1.5 border-r border-[#c4c6d4]/60 truncate max-w-xs font-medium">
                          {r.description || <span className="text-red-500 italic">Not found in catalog</span>}
                        </td>
                        <td className="p-1.5 text-center">
                          {r.stockNo ? (
                            <span className="text-emerald-700 font-bold text-[11px]">Ready</span>
                          ) : (
                            <span className="text-red-600 font-bold text-[11px]">Unknown</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-[#e8e7ed] border-t border-[#c4c6d4] px-4 py-2.5 flex justify-end items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="bg-[#faf9ff] hover:bg-[#e8e7ed] text-[#434652] text-xs font-bold uppercase px-4 py-1.5 rounded border border-[#c4c6d4] transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={matchedCount === 0}
            onClick={handleCommit}
            className="bg-[#00296d] hover:bg-[#003d9b] disabled:opacity-40 text-white text-xs font-bold uppercase px-6 py-1.5 rounded transition-colors flex items-center gap-1 shadow-sm"
          >
            <span className="material-symbols-outlined text-[16px]">add_shopping_cart</span>
            Import {matchedCount} Items to Bill
          </button>
        </div>
      </div>
    </div>
  );
};
