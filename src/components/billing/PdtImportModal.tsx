/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.7.0
 * Created      : 2026-08-21
 * Modified     : 2026-08-22
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 * Source Module: Stitch Distributor PDT Import Dialog
 */

import React, { useState, useRef } from "react";
import { Product } from "../../types.ts";
import { PdtImportRow, PdtFieldTemplate } from "./types.ts";
import { Upload, X, FileText, CheckCircle, Database } from "lucide-react";
import { barcodeTransactionStore } from "../barcode/barcodeTransactionS.ts";

interface PdtImportModalProps {
  isOpen: boolean;
  products: Product[];
  onImportItems: (items: { product: Product; qty: number; rate?: number }[]) => void;
  onClose: () => void;
}

export const PdtImportModal: React.FC<PdtImportModalProps> = ({
  isOpen,
  products,
  onImportItems,
  onClose
}) => {
  const [importMode, setImportMode] = useState<"file" | "transaction">("file");
  const [fieldTemplate, setFieldTemplate] = useState<PdtFieldTemplate>("Stock Number + Qty + Rate");
  const [filePath, setFilePath] = useState<string>("");
  const [rawText, setRawText] = useState<string>("");
  const [parsedRows, setParsedRows] = useState<PdtImportRow[]>([]);
  
  // Transaction Mode states
  const [transactionType, setTransactionType] = useState<string>("Purchase Order");
  const [billPrefix, setBillPrefix] = useState<string>("PO");
  const [billNo, setBillNo] = useState<string>("1001");

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleParseText = (text: string, template: PdtFieldTemplate) => {
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const rows: PdtImportRow[] = [];

    lines.forEach(line => {
      const parts = line.split(/[,;\t|]+/).map(p => p.trim()).filter(Boolean);
      if (parts.length === 0) return;

      const codeOrBarcode = parts[0];
      let qty = 1;
      let rate: number | undefined = undefined;

      if (template === "Stock Number") {
        qty = 1;
      } else if (template === "Stock Number + Qty") {
        if (parts[1]) qty = parseFloat(parts[1]) || 1;
      } else if (template === "Stock Number + Qty + Rate") {
        if (parts[1]) qty = parseFloat(parts[1]) || 1;
        if (parts[2]) rate = parseFloat(parts[2]) || undefined;
      } else if (template === "Stock Number + Rate + Qty") {
        if (parts[1]) rate = parseFloat(parts[1]) || undefined;
        if (parts[2]) qty = parseFloat(parts[2]) || 1;
      }

      const matched = products.find(
        p => p.barcode === codeOrBarcode || p.code === codeOrBarcode || p.id === codeOrBarcode
      );

      rows.push({
        barcode: codeOrBarcode,
        qty: qty > 0 ? qty : 1,
        rate: rate ?? (matched ? Number((matched as any).sellingPrice ?? matched.price ?? matched.mrp ?? 0) : undefined),
        stockNo: matched?.code || codeOrBarcode,
        description: matched?.name || "Unmatched Product"
      });
    });

    setParsedRows(rows);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFilePath(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        setRawText(content);
        handleParseText(content, fieldTemplate);
      }
    };
    reader.readAsText(file);
  };

  const handleFetchTransaction = () => {
    // Query items from transaction store
    let matchedItems: PdtImportRow[] = [];
    if (transactionType === "Purchase Order") {
      const poItems = barcodeTransactionStore.getPurchaseOrders(billPrefix, billNo, billNo);
      matchedItems = poItems.map(p => ({
        barcode: p.barcode || p.stockNo,
        qty: p.labelCount || 1,
        rate: p.sellingPrice || p.mrp,
        stockNo: p.stockNo,
        description: p.product
      }));
    } else {
      const txns = barcodeTransactionStore.getTransactions("Purchase Inward (GRN)", billPrefix, billNo, billNo);
      matchedItems = txns.map(p => ({
        barcode: p.barcode || p.stockNo,
        qty: p.labelCount || 1,
        rate: p.sellingPrice || p.mrp,
        stockNo: p.stockNo,
        description: p.product
      }));
    }

    if (matchedItems.length === 0 && products.length > 0) {
      // Demo fallback if no specific transaction is found
      matchedItems = products.slice(0, 3).map(p => ({
        barcode: p.barcode || p.code,
        qty: 5,
        rate: Number((p as any).sellingPrice || p.price || p.mrp || 100),
        stockNo: p.code,
        description: p.name
      }));
    }

    setParsedRows(matchedItems);
  };

  const handleClear = () => {
    setFilePath("");
    setRawText("");
    setParsedRows([]);
    setBillPrefix("");
    setBillNo("");
  };

  const handleCommit = () => {
    const itemsToImport: { product: Product; qty: number; rate?: number }[] = [];

    parsedRows.forEach(row => {
      const matched = products.find(
        p => p.barcode === row.barcode || p.code === row.barcode || p.id === row.barcode || p.code === row.stockNo
      );
      if (matched) {
        itemsToImport.push({
          product: matched,
          qty: row.qty,
          rate: row.rate ?? Number((matched as any).sellingPrice || matched.price || matched.mrp || 0)
        });
      } else {
        // Create synthetic product for unregistered stock number
        const syntheticProduct: Product = {
          id: "PDT-" + row.barcode,
          code: row.stockNo || row.barcode,
          name: row.description || row.barcode,
          barcode: row.barcode,
          mrp: row.rate || 0,
          price: row.rate || 0,
          stock: 999,
          category: "General",
          attributes: { uom: "PCS" }
        };
        itemsToImport.push({
          product: syntheticProduct,
          qty: row.qty,
          rate: row.rate
        });
      }
    });

    if (itemsToImport.length > 0) {
      onImportItems(itemsToImport);
      onClose();
    } else {
      alert("No valid items to import. Please select a file or transaction.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in select-none">
      <div className="bg-surface rounded-lg shadow-2xl w-full max-w-lg border border-outline-variant overflow-hidden flex flex-col">
        
        {/* Modal Header */}
        <div className="bg-surface-container-lowest px-6 py-4 border-b border-outline-variant flex justify-between items-center shrink-0">
          <div className="flex items-center gap-2">
            <Upload size={20} className="text-primary" />
            <h2 className="font-headline-md text-base text-on-surface font-semibold m-0">PDT Import</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-on-surface-variant hover:text-error transition-colors rounded p-1 hover:bg-error-container"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 flex flex-col gap-stack-gap bg-surface">
          
          {/* Tab/Radio Selection */}
          <div className="flex gap-6 mb-2">
            <label className="flex items-center gap-2 cursor-pointer font-title-sm text-xs font-semibold text-on-surface">
              <input
                type="radio"
                name="importMode"
                value="file"
                checked={importMode === "file"}
                onChange={() => setImportMode("file")}
                className="text-primary focus:ring-primary h-4 w-4"
              />
              <span>Import from File</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer font-title-sm text-xs font-semibold text-on-surface">
              <input
                type="radio"
                name="importMode"
                value="transaction"
                checked={importMode === "transaction"}
                onChange={() => setImportMode("transaction")}
                className="text-primary focus:ring-primary h-4 w-4"
              />
              <span>Import from Transaction</span>
            </label>
          </div>

          <div className="h-px bg-outline-variant w-full my-1"></div>

          {/* Mode 1: Import from File */}
          {importMode === "file" && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <label className="font-label-caps text-[11px] text-on-surface-variant uppercase tracking-wider font-bold">
                  Field Template
                </label>
                <select
                  value={fieldTemplate}
                  onChange={e => {
                    const t = e.target.value as PdtFieldTemplate;
                    setFieldTemplate(t);
                    if (rawText) handleParseText(rawText, t);
                  }}
                  className="w-full bg-surface-container-lowest border border-outline-variant rounded px-3 py-2 text-on-surface font-body-md text-xs focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                >
                  <option value="Stock Number">Stock Number</option>
                  <option value="Stock Number + Qty + Rate">Stock Number + Qty + Rate</option>
                  <option value="Stock Number + Rate + Qty">Stock Number + Rate + Qty</option>
                  <option value="Stock Number + Qty">Stock Number + Qty</option>
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="font-label-caps text-[11px] text-on-surface-variant uppercase tracking-wider font-bold">
                  File Path
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={filePath}
                    readOnly
                    placeholder="Select .txt, .csv, or .pdt file"
                    className="flex-1 bg-surface-container-lowest border border-outline-variant rounded px-3 py-2 text-on-surface font-code-md text-xs focus:border-primary outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="bg-surface-container-high border border-outline-variant text-on-surface font-title-sm text-xs font-semibold px-4 py-2 rounded hover:bg-surface-variant transition-colors whitespace-nowrap"
                  >
                    Browse
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".txt,.csv,.pdt,.dat"
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Mode 2: Import from Transaction */}
          {importMode === "transaction" && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <label className="font-label-caps text-[11px] text-on-surface-variant uppercase tracking-wider font-bold">
                  Transaction Type
                </label>
                <select
                  value={transactionType}
                  onChange={e => setTransactionType(e.target.value)}
                  className="w-full bg-surface-container-lowest border border-outline-variant rounded px-3 py-2 text-on-surface font-body-md text-xs focus:border-primary outline-none"
                >
                  <option value="Purchase Order">Purchase Order</option>
                  <option value="Transfer Issue">Transfer Issue</option>
                  <option value="Sales Order">Sales Order</option>
                </select>
              </div>

              <div className="flex gap-3">
                <div className="flex flex-col gap-1 flex-1">
                  <label className="font-label-caps text-[11px] text-on-surface-variant uppercase tracking-wider font-bold">
                    Bill Prefix
                  </label>
                  <input
                    type="text"
                    value={billPrefix}
                    onChange={e => setBillPrefix(e.target.value)}
                    placeholder="e.g. PO"
                    className="bg-surface-container-lowest border border-outline-variant rounded px-3 py-2 text-on-surface font-code-md text-xs focus:border-primary outline-none font-bold"
                  />
                </div>

                <div className="flex flex-col gap-1 flex-[2]">
                  <label className="font-label-caps text-[11px] text-on-surface-variant uppercase tracking-wider font-bold">
                    Bill No
                  </label>
                  <input
                    type="text"
                    value={billNo}
                    onChange={e => setBillNo(e.target.value)}
                    placeholder="e.g. 1001"
                    className="bg-surface-container-lowest border border-outline-variant rounded px-3 py-2 text-on-surface font-code-md text-xs focus:border-primary outline-none font-bold"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={handleFetchTransaction}
                className="bg-surface-container-high hover:bg-surface-variant text-primary border border-outline-variant py-2 rounded text-xs font-bold transition flex items-center justify-center gap-1.5"
              >
                <Database size={14} />
                <span>Fetch Transaction Items</span>
              </button>
            </div>
          )}

          {/* Parsed Preview Count */}
          {parsedRows.length > 0 && (
            <div className="bg-surface-container-low border border-outline-variant rounded p-2.5 flex items-center justify-between">
              <span className="font-body-sm text-xs font-medium text-on-surface">
                Ready to import: <strong>{parsedRows.length}</strong> items
              </span>
              <span className="font-code-md text-xs font-bold text-secondary">
                Total Qty: {parsedRows.reduce((s, r) => s + r.qty, 0)}
              </span>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="bg-surface-container-low px-6 py-3.5 border-t border-outline-variant flex justify-end gap-3 shrink-0">
          <button
            type="button"
            onClick={handleClear}
            className="px-5 py-2 rounded border border-outline text-primary font-title-sm text-xs font-semibold hover:bg-surface-container-highest transition-colors"
          >
            Clear
          </button>
          <button
            type="button"
            onClick={handleCommit}
            disabled={parsedRows.length === 0}
            className="px-6 py-2 rounded bg-primary text-on-primary font-title-sm text-xs font-bold hover:bg-primary-container disabled:opacity-40 transition-colors shadow-xs"
          >
            Ok
          </button>
        </div>

      </div>
    </div>
  );
};

export default PdtImportModal;
