/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.16.0
 * Created      : 2026-08-19
 * Modified     : 2026-08-19
 * Copyright    : Â© SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 */

import React, { useState, useMemo, useEffect } from "react";
import { 
  FileText, Save, CheckCircle2, Printer, Plus, Trash2, 
  Calendar, Building2, User, RefreshCw, Calculator, 
  Tag, AlertCircle, ArrowLeft, Layers, ExternalLink
} from "lucide-react";
import { DocumentStudioConfig, DocumentLineItem, DocumentHeaderState, DocumentTotals } from "./types.ts";
import { BottomScanBar } from "./BottomScanBar.tsx";
import { apiFetchV1 } from "../../../lib/apiFetchV1.ts";
import { formatCurrency } from "../../../utils/formatters.ts";
import { useWorkspace } from "../../../contexts/WorkspaceContext.tsx";

export interface DocumentStudioScreenProps {
  config: DocumentStudioConfig;
  initialLines?: DocumentLineItem[];
  initialHeader?: Partial<DocumentHeaderState>;
  onSaveDocument?: (header: DocumentHeaderState, lines: DocumentLineItem[], totals: DocumentTotals, isDraft: boolean) => Promise<void>;
  onPrintDocument?: (header: DocumentHeaderState, lines: DocumentLineItem[], totals: DocumentTotals) => void;
  onNotification?: (title: string, msg: string, type: "success" | "error") => void;
}

export const DocumentStudioScreen: React.FC<DocumentStudioScreenProps> = ({
  config,
  initialLines = [],
  initialHeader = {},
  onSaveDocument,
  onPrintDocument,
  onNotification,
}) => {
  const { popOutExternalWindow } = useWorkspace();
  const [header, setHeader] = useState<DocumentHeaderState>({
    docType: config.documentType,
    docNumber: `DOC-${Date.now().toString(36).toUpperCase()}`,
    docDate: new Date().toISOString().split("T")[0],
    dueDate: new Date(Date.now() + 15 * 86400000).toISOString().split("T")[0],
    partyName: "",
    partyGstin: "",
    partyMobile: "",
    partyAddress: "",
    warehouseName: config.defaultWarehouse || "Main Central Warehouse",
    remarks: "",
    ...initialHeader,
  });

  const [lines, setLines] = useState<DocumentLineItem[]>(initialLines);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Compute real-time totals
  const totals: DocumentTotals = useMemo(() => {
    let itemCount = lines.length;
    let totalQuantity = 0;
    let subTotal = 0;
    let totalDiscount = 0;
    let taxableAmount = 0;
    let totalTax = 0;

    lines.forEach((line) => {
      const lineQty = Number(line.quantity) || 0;
      const lineRate = Number(line.price) || 0;
      const discPercent = Number(line.discountPercent) || 0;
      const gstRate = Number(line.gstRate) || 0;

      const rawAmount = lineQty * lineRate;
      const discAmount = (rawAmount * discPercent) / 100;
      const taxable = rawAmount - discAmount;
      const tax = (taxable * gstRate) / 100;

      totalQuantity += lineQty;
      subTotal += rawAmount;
      totalDiscount += discAmount;
      taxableAmount += taxable;
      totalTax += tax;
    });

    const unroundedGrand = taxableAmount + totalTax;
    const roundedGrand = Math.round(unroundedGrand);
    const roundOff = Number((roundedGrand - unroundedGrand).toFixed(2));

    return {
      itemCount,
      totalQuantity,
      subTotal: Number(subTotal.toFixed(2)),
      totalDiscount: Number(totalDiscount.toFixed(2)),
      taxableAmount: Number(taxableAmount.toFixed(2)),
      cgstAmount: Number((totalTax / 2).toFixed(2)),
      sgstAmount: Number((totalTax / 2).toFixed(2)),
      igstAmount: 0,
      totalTax: Number(totalTax.toFixed(2)),
      roundOff,
      grandTotal: roundedGrand,
    };
  }, [lines]);

  // Handle Barcode Scan / Lookup
  const handleScanProduct = async (query: string, qty: number = 1): Promise<boolean> => {
    try {
      // 1. Check if product exists in backend catalog via search endpoint or products query
      const encodedQuery = encodeURIComponent(query.trim());
      const searchRes = await apiFetchV1(`/inventory/search?q=${encodedQuery}&limit=5`).catch(() => []);
      const searchList = searchRes?.items || (Array.isArray(searchRes) ? searchRes : []);
      const matched = searchList.length > 0 ? searchList[0] : null;

      if (!matched) {
        // Fallback: search products endpoint directly
        const fallbackRes = await apiFetchV1(`/products/?q=${encodedQuery}&page_size=5`).catch(() => null);
        const list = fallbackRes?.items || (Array.isArray(fallbackRes) ? fallbackRes : []);
        if (!list || list.length === 0) return false;
        return addOrMergeProductLine(list[0], qty);
      }

      return addOrMergeProductLine(matched, qty);
    } catch (err) {
      console.error("Barcode scan lookup failed:", err);
      return false;
    }
  };

  const addOrMergeProductLine = (prod: any, qty: number): boolean => {
    const existingIndex = lines.findIndex(
      (l) => l.productId === prod.id || (l.barcode && l.barcode === prod.barcode) || l.code === prod.code
    );

    if (existingIndex >= 0) {
      // Merge quantity into existing line
      setLines((prev) =>
        prev.map((line, idx) => {
          if (idx !== existingIndex) return line;
          const updatedQty = line.quantity + qty;
          const lineTotal = calculateLineTotal(updatedQty, line.price, line.discountPercent || 0, line.gstRate || 0);
          return {
            ...line,
            quantity: updatedQty,
            lineTotal,
          };
        })
      );
    } else {
      // Add new document line
      const unitPrice = parseFloat(prod.price || prod.cost_price || 0);
      const gstRate = parseFloat(prod.gst_percentage || 18);
      const lineTotal = calculateLineTotal(qty, unitPrice, 0, gstRate);

      const newLine: DocumentLineItem = {
        id: `line-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`,
        productId: prod.id,
        code: prod.code || "SKU-AUTO",
        name: prod.name || "Product Item",
        barcode: prod.barcode || "",
        hsnCode: prod.hsn_code || "0902",
        quantity: qty,
        unit: prod.unit || "PCS",
        price: unitPrice,
        mrp: prod.mrp ? parseFloat(prod.mrp) : unitPrice,
        discountPercent: 0,
        discountAmount: 0,
        gstRate,
        taxAmount: (unitPrice * qty * gstRate) / 100,
        lineTotal,
      };

      setLines((prev) => [...prev, newLine]);
    }
    return true;
  };

  const calculateLineTotal = (qty: number, price: number, discPercent: number, gstRate: number): number => {
    const taxable = qty * price * (1 - discPercent / 100);
    const tax = taxable * (gstRate / 100);
    return Number((taxable + tax).toFixed(2));
  };

  const updateLineField = (index: number, field: keyof DocumentLineItem, value: any) => {
    setLines((prev) =>
      prev.map((line, idx) => {
        if (idx !== index) return line;
        const updated = { ...line, [field]: value };
        const qty = Number(updated.quantity) || 0;
        const price = Number(updated.price) || 0;
        const discPercent = Number(updated.discountPercent) || 0;
        const gstRate = Number(updated.gstRate) || 0;
        updated.lineTotal = calculateLineTotal(qty, price, discPercent, gstRate);
        return updated;
      })
    );
  };

  const removeLine = (index: number) => {
    setLines((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleSave = async (isDraft: boolean) => {
    if (lines.length === 0) {
      if (onNotification) onNotification("Validation Error", "Document must contain at least one line item.", "error");
      return;
    }

    setIsSubmitting(true);
    try {
      if (onSaveDocument) {
        await onSaveDocument(header, lines, totals, isDraft);
      } else {
        // Default API submission
        const payload = {
          header,
          lines,
          totals,
          isDraft,
        };
        await apiFetchV1(config.apiEndpoint, {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }
      if (onNotification) {
        onNotification(
          isDraft ? "Draft Saved" : "Document Created",
          `${config.title} (${header.docNumber}) successfully recorded.`,
          "success"
        );
      }
    } catch (err: any) {
      if (onNotification) onNotification("Save Failed", err.message || "Could not save document", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex-1 bg-theme-surface-1 overflow-y-auto p-4 md:p-6 space-y-5 custom-scrollbar">
      {/* Header Banner */}
      <div className="bg-theme-surface-2 border border-theme-divider rounded-2xl p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-blue-400 font-bold uppercase tracking-wider">
            <Layers size={14} />
            <span>Document Studio â€¢ {config.documentType}</span>
          </div>
          <h1 className="text-xl md:text-2xl font-bold text-theme-primary font-display mt-1">{config.title}</h1>
          <p className="text-xs text-theme-muted mt-0.5">{config.subtitle}</p>
        </div>

        {/* Header Action Buttons */}
        <div className="flex items-center gap-2 self-start md:self-auto font-mono">
          <button
            type="button"
            onClick={() => handleSave(true)}
            disabled={isSubmitting || lines.length === 0}
            className="px-3.5 py-2 bg-theme-surface-3 hover:bg-theme-surface-hover border border-theme-divider text-theme-primary rounded-xl text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
          >
            <Save size={14} />
            <span>{config.draftActionLabel || "Save Draft"}</span>
          </button>

          {onPrintDocument && (
            <button
              type="button"
              onClick={() => onPrintDocument(header, lines, totals)}
              disabled={lines.length === 0}
              className="px-3.5 py-2 bg-theme-surface-3 hover:bg-theme-surface-hover border border-theme-divider text-theme-primary rounded-xl text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
            >
              <Printer size={14} />
              <span>Print</span>
            </button>
          )}

          {/* Popout External Window Button */}
          <button
            type="button"
            onClick={() => popOutExternalWindow(config.documentType.toLowerCase().replace(/\s+/g, "-"), config.title)}
            title="Pop Out into Standalone Window"
            className="p-2 bg-theme-surface-3 hover:bg-theme-surface-hover border border-theme-divider text-theme-muted hover:text-theme-primary rounded-xl transition-colors cursor-pointer"
          >
            <ExternalLink size={14} />
          </button>

          <button
            type="button"
            onClick={() => handleSave(false)}
            disabled={isSubmitting || lines.length === 0}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer disabled:opacity-50"
          >
            <CheckCircle2 size={14} />
            <span>{config.primaryActionLabel || "Post Document"}</span>
          </button>
        </div>
      </div>

      {/* Header Fields Section */}
      <div className="bg-theme-surface-2 border border-theme-divider rounded-xl p-4 shadow-xs">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3.5">
          <div>
            <label className="block text-[11px] font-mono text-theme-muted uppercase mb-1">Doc Number</label>
            <input
              type="text"
              value={header.docNumber}
              onChange={(e) => setHeader((p) => ({ ...p, docNumber: e.target.value }))}
              className="w-full bg-theme-surface-1 border border-theme-divider rounded-lg px-3 py-1.5 text-xs text-theme-primary font-mono focus:border-blue-500 focus:outline-hidden"
            />
          </div>

          <div>
            <label className="block text-[11px] font-mono text-theme-muted uppercase mb-1">Document Date</label>
            <input
              type="date"
              value={header.docDate}
              onChange={(e) => setHeader((p) => ({ ...p, docDate: e.target.value }))}
              className="w-full bg-theme-surface-1 border border-theme-divider rounded-lg px-3 py-1.5 text-xs text-theme-primary font-mono focus:border-blue-500 focus:outline-hidden"
            />
          </div>

          <div>
            <label className="block text-[11px] font-mono text-theme-muted uppercase mb-1">
              {config.partyType} Name
            </label>
            <input
              type="text"
              placeholder={`Enter ${config.partyType.toLowerCase()} name...`}
              value={header.partyName}
              onChange={(e) => setHeader((p) => ({ ...p, partyName: e.target.value }))}
              className="w-full bg-theme-surface-1 border border-theme-divider rounded-lg px-3 py-1.5 text-xs text-theme-primary focus:border-blue-500 focus:outline-hidden"
            />
          </div>

          <div>
            <label className="block text-[11px] font-mono text-theme-muted uppercase mb-1">
              {config.partyType} GSTIN
            </label>
            <input
              type="text"
              placeholder="e.g. 27AAAAA0000A1Z5"
              value={header.partyGstin}
              onChange={(e) => setHeader((p) => ({ ...p, partyGstin: e.target.value.toUpperCase() }))}
              className="w-full bg-theme-surface-1 border border-theme-divider rounded-lg px-3 py-1.5 text-xs text-theme-primary font-mono uppercase focus:border-blue-500 focus:outline-hidden"
            />
          </div>
        </div>
      </div>

      {/* Line Items Table */}
      <div className="bg-theme-surface-2 border border-theme-divider rounded-xl overflow-hidden shadow-xs">
        <div className="p-3.5 border-b border-theme-divider flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText size={16} className="text-blue-400" />
            <h2 className="text-xs font-bold text-theme-primary uppercase font-mono tracking-wider">
              Document Line Items ({lines.length})
            </h2>
          </div>

          <button
            type="button"
            onClick={() =>
              setLines((prev) => [
                ...prev,
                {
                  id: `line-${Date.now().toString(36)}`,
                  code: "CUSTOM-ITEM",
                  name: "New Line Item",
                  quantity: 1,
                  price: 0,
                  gstRate: 18,
                  lineTotal: 0,
                },
              ])
            }
            className="text-xs text-blue-400 hover:text-blue-300 font-mono flex items-center gap-1 cursor-pointer"
          >
            <Plus size={14} />
            <span>Add Blank Row</span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-theme-surface-3/50 text-theme-muted font-mono border-b border-theme-divider">
              <tr>
                <th className="px-3 py-2.5 w-10 text-center">#</th>
                <th className="px-3 py-2.5 min-w-[200px]">Item Description</th>
                <th className="px-3 py-2.5 w-24">HSN</th>
                <th className="px-3 py-2.5 w-20 text-right">Qty</th>
                <th className="px-3 py-2.5 w-28 text-right">Rate</th>
                <th className="px-3 py-2.5 w-20 text-right">Disc %</th>
                <th className="px-3 py-2.5 w-20 text-right">GST %</th>
                <th className="px-3 py-2.5 w-32 text-right">Amount</th>
                <th className="px-3 py-2.5 w-12 text-center"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-theme-divider font-mono">
              {lines.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-theme-muted font-mono text-xs">
                    No items in document. Use the quick barcode scan bar below to add line items.
                  </td>
                </tr>
              ) : (
                lines.map((line, idx) => (
                  <tr key={line.id} className="hover:bg-theme-surface-hover/50">
                    <td className="px-3 py-2 text-center text-theme-muted">{idx + 1}</td>
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        value={line.name}
                        onChange={(e) => updateLineField(idx, "name", e.target.value)}
                        className="w-full bg-transparent border-none text-theme-primary font-sans text-xs focus:ring-0 p-0"
                      />
                      <div className="text-[10px] text-theme-muted font-mono">{line.code}</div>
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        value={line.hsnCode || ""}
                        onChange={(e) => updateLineField(idx, "hsnCode", e.target.value)}
                        className="w-full bg-theme-surface-1 border border-theme-divider rounded px-1.5 py-1 text-[11px] text-theme-primary"
                      />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <input
                        type="number"
                        min={1}
                        value={line.quantity}
                        onChange={(e) => updateLineField(idx, "quantity", Math.max(1, parseFloat(e.target.value) || 1))}
                        className="w-16 bg-theme-surface-1 border border-theme-divider rounded px-1.5 py-1 text-right text-xs text-theme-primary"
                      />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={line.price}
                        onChange={(e) => updateLineField(idx, "price", Math.max(0, parseFloat(e.target.value) || 0))}
                        className="w-24 bg-theme-surface-1 border border-theme-divider rounded px-1.5 py-1 text-right text-xs text-theme-primary"
                      />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={line.discountPercent || 0}
                        onChange={(e) => updateLineField(idx, "discountPercent", parseFloat(e.target.value) || 0)}
                        className="w-14 bg-theme-surface-1 border border-theme-divider rounded px-1.5 py-1 text-right text-xs text-theme-primary"
                      />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <select
                        value={line.gstRate || 18}
                        onChange={(e) => updateLineField(idx, "gstRate", parseFloat(e.target.value) || 0)}
                        className="bg-theme-surface-1 border border-theme-divider rounded px-1 py-1 text-xs text-theme-primary"
                      >
                        <option value={0}>0%</option>
                        <option value={5}>5%</option>
                        <option value={12}>12%</option>
                        <option value={18}>18%</option>
                        <option value={28}>28%</option>
                      </select>
                    </td>
                    <td className="px-3 py-2 text-right font-bold text-theme-primary">
                      {formatCurrency(line.lineTotal)}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <button
                        type="button"
                        onClick={() => removeLine(idx)}
                        className="text-theme-muted hover:text-red-400 p-1 rounded transition-colors cursor-pointer"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bottom Barcode Quick Scan Bar */}
      <BottomScanBar onScanProduct={handleScanProduct} />

      {/* Summary Totals Card */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Remarks / Notes */}
        <div className="bg-theme-surface-2 border border-theme-divider rounded-xl p-4 space-y-2">
          <label className="block text-[11px] font-mono text-theme-muted uppercase">Terms & Document Notes</label>
          <textarea
            rows={3}
            placeholder="Enter payment conditions, warranty remarks, or dispatch notes..."
            value={header.remarks}
            onChange={(e) => setHeader((p) => ({ ...p, remarks: e.target.value }))}
            className="w-full bg-theme-surface-1 border border-theme-divider rounded-lg p-2.5 text-xs text-theme-primary focus:border-blue-500 focus:outline-hidden resize-none"
          />
        </div>

        {/* Totals Breakdown */}
        <div className="bg-theme-surface-2 border border-theme-divider rounded-xl p-4 space-y-2 font-mono text-xs">
          <div className="flex justify-between text-theme-muted">
            <span>Subtotal ({totals.itemCount} items, {totals.totalQuantity} units):</span>
            <span>{formatCurrency(totals.subTotal)}</span>
          </div>

          {totals.totalDiscount > 0 && (
            <div className="flex justify-between text-emerald-400">
              <span>Total Line Discount:</span>
              <span>- {formatCurrency(totals.totalDiscount)}</span>
            </div>
          )}

          <div className="flex justify-between text-theme-muted">
            <span>Taxable Amount:</span>
            <span>{formatCurrency(totals.taxableAmount)}</span>
          </div>

          <div className="flex justify-between text-theme-muted border-t border-theme-divider/50 pt-1">
            <span>CGST:</span>
            <span>{formatCurrency(totals.cgstAmount)}</span>
          </div>

          <div className="flex justify-between text-theme-muted">
            <span>SGST:</span>
            <span>{formatCurrency(totals.sgstAmount)}</span>
          </div>

          {totals.roundOff !== 0 && (
            <div className="flex justify-between text-theme-muted">
              <span>Round Off:</span>
              <span>{formatCurrency(totals.roundOff)}</span>
            </div>
          )}

          <div className="flex justify-between text-sm font-bold text-theme-primary border-t border-theme-divider pt-2 font-display">
            <span>Grand Total:</span>
            <span className="text-blue-400 font-mono text-base">{formatCurrency(totals.grandTotal)}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

