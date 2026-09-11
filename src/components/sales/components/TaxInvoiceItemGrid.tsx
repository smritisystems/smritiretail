/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 4.12.0
 * Created      : 2026-08-24
 * Modified     : 2026-09-07
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import React, { useState, useRef, useEffect } from "react";
import {
  Trash2,
  Search,
  Plus,
  Layers,
  Truck,
  FileText,
  PlusCircle,
  Barcode,
  ExternalLink
} from "lucide-react";
import { TaxInvoiceItemRow } from "../types.ts";

export interface TaxInvoiceItemGridProps {
  items: TaxInvoiceItemRow[];
  onUpdateItem: (index: number, updates: Partial<TaxInvoiceItemRow>) => void;
  onDeleteItem: (index: number) => void;
  onAddItem: (item: Omit<TaxInvoiceItemRow, "sNo" | "id">) => void;
  onOpenSkuSearch?: () => void;
  onLookupProduct?: (term: string) => Promise<any | null>;
  onScanError?: (barcode: string) => void;
  staffList?: { id: string; name: string }[];
  activeAuxTab?: string;
  onSelectAuxTab?: (tab: "items" | "transporter" | "remarks" | "addons") => void;
  isInterstate?: boolean;
  placeOfSupplyCode?: string | null;
}

export const TaxInvoiceItemGrid: React.FC<TaxInvoiceItemGridProps> = ({
  items,
  onUpdateItem,
  onDeleteItem,
  onAddItem,
  onOpenSkuSearch,
  onLookupProduct,
  onScanError,
  staffList = [
    { id: "EMP001", name: "EMP001 - Jawahar Mallah" },
    { id: "EMP002", name: "EMP002 - John Doe" },
    { id: "EMP003", name: "EMP003 - Jane Smith" },
  ],
  activeAuxTab = "items",
  onSelectAuxTab,
  isInterstate = true,
  placeOfSupplyCode,
}) => {
  // Rapid scan dock state
  const [scanBarcode, setScanBarcode] = useState("");

  // Fast inline entry row state
  const [stockNo, setStockNo] = useState("");
  const [description, setDescription] = useState("");
  const [rate, setRate] = useState<number | "">("");
  const [qty, setQty] = useState<number | "">(1);
  const [discPercent, setDiscPercent] = useState<number | "">("");
  const [discAmt, setDiscAmt] = useState<number | "">("");
  const [salesStaff, setSalesStaff] = useState("");
  const [hsnCode, setHsnCode] = useState("");
  const [gstRate, setGstRate] = useState<number>(18);
  const [mrp, setMrp] = useState<number>(0);

  // Active focus item for live preview strip
  const [focusItem, setFocusItem] = useState<{
    stockNo: string;
    description: string;
    variant: string;
    rate: number;
    mrp: number;
    discPercent: number;
    discAmt: number;
    gstRate: number;
    taxVal: number;
    lineTotal: number;
    qty: number;
  }>({
    stockNo: "SKU-8849201",
    description: "Raymond Wool Formal Blend 1.2m",
    variant: "Charcoal (04)",
    rate: 1450,
    mrp: 1699,
    discPercent: 0,
    discAmt: 0,
    gstRate: 18,
    taxVal: 261,
    lineTotal: 1711,
    qty: 1,
  });

  const stockInputRef = useRef<HTMLInputElement>(null);
  const scanInputRef = useRef<HTMLInputElement>(null);

  // Calculated values for entry row
  const numRate = typeof rate === "number" ? rate : 0;
  const numQty = typeof qty === "number" ? qty : 1;
  const numValue = numRate * numQty;
  const numDiscPercent = typeof discPercent === "number" ? discPercent : 0;
  const numDiscAmt = typeof discAmt === "number" ? discAmt : (numValue * numDiscPercent) / 100;
  const taxableValue = Math.max(0, numValue - numDiscAmt);
  const calculatedTax = (taxableValue * (gstRate || 18)) / 100;
  const numTotal = taxableValue + calculatedTax;

  // Update focus item preview whenever entry inputs change
  useEffect(() => {
    if (stockNo.trim() || description.trim()) {
      setFocusItem({
        stockNo: stockNo.trim() || "NEW-SKU",
        description: description.trim() || "Item",
        variant: "Standard",
        rate: numRate,
        mrp: mrp > numRate ? mrp : Math.round(numRate * 1.15),
        discPercent: numDiscPercent,
        discAmt: numDiscAmt,
        gstRate: gstRate || 18,
        taxVal: calculatedTax,
        lineTotal: numTotal,
        qty: numQty,
      });
    }
  }, [stockNo, description, numRate, numQty, numDiscPercent, numDiscAmt, gstRate, numTotal, calculatedTax, mrp]);

  // Product Lookup handler
  const handleStockNoBlur = async () => {
    if (!stockNo.trim()) return;
    if (onLookupProduct) {
      const prod = await onLookupProduct(stockNo.trim());
      if (prod) {
        setDescription(prod.name || prod.title || "Selected Item");
        const pRate = Number(prod.price || prod.selling_price || prod.mrp || 0);
        setRate(pRate);
        setMrp(Number(prod.mrp || pRate));
        setHsnCode(prod.hsn_code || "64041990");
        setGstRate(Number(prod.gst_percentage || 18));
      }
    }
  };

  // Commit Entry Row to Line Items
  const handleCommitRow = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!stockNo.trim() && !description.trim()) return;

    onAddItem({
      stockNo: stockNo.trim() || `SKU-${Date.now().toString().slice(-4)}`,
      itemDescription: description.trim() || "Retail Item",
      rate: numRate,
      qty: numQty,
      value: numValue,
      discCode: "None",
      discQty: 0,
      discPercent: numDiscPercent,
      discAmt: numDiscAmt,
      total: numTotal,
      salesStaff: salesStaff || staffList[0]?.name || "EMP001 - Jawahar Mallah",
      hsnCode: hsnCode || "64041990",
      gstRate: gstRate || 18,
    });

    // Reset entry bar and focus back
    setStockNo("");
    setDescription("");
    setRate("");
    setQty(1);
    setDiscPercent("");
    setDiscAmt("");
    setHsnCode("");
    setMrp(0);
    stockInputRef.current?.focus();
  };

  // Rapid Scan Dock Submission with Duplicate Auto-Increment & Error Handling
  const handleScanSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const barcode = scanBarcode.trim();
    if (!barcode) return;

    if (onLookupProduct) {
      const prod = await onLookupProduct(barcode);
      if (prod) {
        const itemSku = prod.code || prod.sku || barcode;
        const pRate = Number(prod.price || prod.selling_price || prod.mrp || 0);
        const pGst = Number(prod.gst_percentage || 18);

        const availableStock = prod.stock !== undefined
          ? Number(prod.stock)
          : (prod.stock_quantity !== undefined ? Number(prod.stock_quantity) : undefined);

        // Check for duplicate barcode in existing items (Auto-Increment with Stock Protection)
        const existingIndex = items.findIndex(
          (it) => (it.barcode && it.barcode === barcode) || it.stockNo === itemSku
        );

        if (existingIndex !== -1) {
          const existing = items[existingIndex];
          const effStock = existing.stockQty ?? availableStock;
          const newQty = (Number(existing.qty) || 0) + 1;

          if (effStock !== undefined && effStock > 0 && newQty > effStock) {
            onScanError?.(`Stock limit reached for ${existing.itemDescription} (${itemSku}): Available stock is ${effStock}. Cannot increment beyond stock.`);
            setScanBarcode("");
            return;
          }

          const newValue = newQty * (Number(existing.rate) || 0);
          const newDiscAmt = (newValue * (Number(existing.discPercent) || 0)) / 100;
          const newTaxable = Math.max(0, newValue - newDiscAmt);
          const newTax = (newTaxable * (Number(existing.gstRate) || 18)) / 100;

          onUpdateItem(existingIndex, {
            qty: newQty,
            value: newValue,
            discAmt: newDiscAmt,
            total: newTaxable + newTax,
            stockQty: effStock,
          });
          setScanBarcode("");
          return;
        }

        if (availableStock !== undefined && availableStock <= 0) {
          onScanError?.(`Item ${prod.name || itemSku} is currently out of stock (0 available).`);
          setScanBarcode("");
          return;
        }

        const pTaxable = pRate * 1;
        const pTax = (pTaxable * pGst) / 100;

        onAddItem({
          stockNo: itemSku,
          barcode: prod.barcode || barcode,
          itemDescription: prod.name || prod.title || "Scanned Item",
          rate: pRate,
          qty: 1,
          value: pRate,
          discCode: "None",
          discQty: 0,
          discPercent: 0,
          discAmt: 0,
          total: pRate + pTax,
          salesStaff: staffList[0]?.name || "EMP001 - Jawahar Mallah",
          hsnCode: prod.hsn_code || "64041990",
          gstRate: pGst,
          stockQty: availableStock,
        });

        setScanBarcode("");
        return;
      }
    }

    // Do not create a synthetic line when the tenant catalog cannot resolve the scan.
    onScanError?.(barcode);
    setScanBarcode("");
  };

  // Ensure at least 5 rows for industrial visualization
  const minGuideRows = Math.max(0, 5 - items.length);

  return (
    <main className="flex-1 flex flex-col bg-white overflow-hidden" data-purpose="item-billing-grid-container">
      {/* ─── Top Auxiliary Section: Scan Dock & Active Item Preview Strip ─────────── */}
      <div className="border-b border-slate-200 bg-slate-50 flex flex-col flex-none select-none shadow-2xs">
        {/* Row 1: Rapid Barcode Scanner Dock & Live Scanned Item Insights */}
        <div className="px-3 py-2 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 overflow-x-auto">
          {/* Rapid Barcode / SKU Scan Input Dock */}
          <form onSubmit={handleScanSubmit} className="flex items-center space-x-2 flex-none">
            <div className="flex items-center space-x-1.5 bg-blue-50/80 border border-blue-200 text-blue-800 px-2 py-1 rounded text-xs font-semibold">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-600"></span>
              </span>
              <span className="text-[11px] uppercase tracking-wider font-mono font-bold">Scan Dock</span>
            </div>

            <div className="relative flex items-center min-w-[280px] sm:min-w-[320px]">
              <div className="absolute left-2.5 text-blue-600 flex items-center pointer-events-none">
                <Barcode className="w-4 h-4 animate-pulse" />
              </div>
              <input
                ref={scanInputRef}
                type="text"
                value={scanBarcode}
                onChange={(e) => setScanBarcode(e.target.value)}
                className="h-8 w-full pl-9 pr-14 text-xs font-mono font-semibold text-slate-800 placeholder:text-slate-400 bg-slate-50 focus:bg-white border border-blue-300 focus:border-blue-600 rounded shadow-2xs focus:outline-none"
                placeholder="[F11 / Scan Barcode or SKU...]"
              />
              <span className="absolute right-1.5 text-[10px] font-mono font-bold text-slate-500 bg-slate-200 px-1.5 py-0.5 rounded border border-slate-300">
                AUTO
              </span>
            </div>

            <button
              type="submit"
              className="h-8 px-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded flex items-center space-x-1 shadow-xs transition active:scale-95 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Quick Add</span>
            </button>
          </form>

          {/* Vertical Divider */}
          <div className="hidden lg:block h-7 w-px bg-slate-200 flex-none"></div>

          {/* Active Item Rapid Preview Strip */}
          <div className="hidden md:flex items-center space-x-4 text-xs flex-1 min-w-[500px] justify-between">
            {/* Item Identity */}
            <div className="min-w-[160px] truncate">
              <div className="flex items-center space-x-1.5">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wide">Current Focus</span>
                <span className="px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-mono font-semibold">
                  IN STOCK
                </span>
              </div>
              <div className="font-bold text-slate-800 text-xs truncate mt-0.5">{focusItem.description}</div>
              <div className="text-[10px] font-mono text-slate-500 space-x-2">
                <span>SKU: <strong className="text-blue-700">{focusItem.stockNo}</strong></span>
                <span>•</span>
                <span>Col: {focusItem.variant}</span>
              </div>
            </div>

            {/* Metric: MRP & Rate */}
            <div className="border-l border-slate-200 pl-3 leading-tight">
              <span className="text-[10px] text-slate-400 uppercase font-semibold block">Rate / MRP</span>
              <div className="flex items-baseline space-x-1 font-mono mt-0.5">
                <span className="font-bold text-slate-800 text-xs">₹{focusItem.rate.toFixed(2)}</span>
                {focusItem.mrp > focusItem.rate && (
                  <span className="text-[10px] text-slate-400 line-through">₹{focusItem.mrp.toFixed(0)}</span>
                )}
              </div>
              <span className="text-[10px] text-emerald-600 font-semibold">
                {focusItem.mrp > focusItem.rate
                  ? `${Math.round(((focusItem.mrp - focusItem.rate) / focusItem.mrp) * 100)}% off MRP`
                  : "Standard Rate"}
              </span>
            </div>

            {/* Metric: Discount Breakdown */}
            <div className="border-l border-slate-200 pl-3 leading-tight">
              <div className="flex items-center justify-between space-x-2">
                <span className="text-[10px] text-slate-400 uppercase font-semibold">Disc (F6)</span>
                <button
                  type="button"
                  onClick={() => stockInputRef.current?.focus()}
                  className="text-[9px] font-mono text-blue-600 hover:underline cursor-pointer"
                >
                  Override
                </button>
              </div>
              <div className="font-mono font-bold text-slate-800 text-xs mt-0.5">
                {focusItem.discPercent.toFixed(2)}%{" "}
                <span className="text-slate-400 text-[11px] font-normal">(₹{focusItem.discAmt.toFixed(2)})</span>
              </div>
              <span className="text-[10px] text-slate-500">Scheme: None</span>
            </div>

            {/* Metric: Tax Matrix */}
            <div className="border-l border-slate-200 pl-3 leading-tight">
              <span className="text-[10px] text-slate-400 uppercase font-semibold block">Tax Regime</span>
              <div className="font-mono font-bold text-slate-800 text-xs mt-0.5">GST {focusItem.gstRate}%</div>
              <span className="text-[10px] font-mono text-slate-500">Tax Val: ₹{focusItem.taxVal.toFixed(2)}</span>
            </div>

            {/* Metric: Net Line Total */}
            <div className="border-l border-slate-200 pl-3 bg-blue-50/50 pr-2 py-1 rounded leading-tight text-right">
              <span className="text-[10px] text-blue-700 uppercase font-bold tracking-wider block">Line Amount</span>
              <div className="font-mono font-extrabold text-blue-950 text-sm mt-0.5">₹{focusItem.lineTotal.toFixed(2)}</div>
              <span className="text-[10px] text-slate-500 font-mono">Qty: {focusItem.qty}</span>
            </div>
          </div>
        </div>

        {/* Row 2: Multi-Tab Support Bar & Metadata Indicator */}
        <div className="px-4 py-1.5 flex items-center justify-between text-xs text-slate-600 bg-slate-50">
          <div className="flex items-center space-x-4">
            <button
              type="button"
              onClick={() => onSelectAuxTab?.("items")}
              className={`flex items-center space-x-1.5 pb-0.5 transition cursor-pointer ${
                activeAuxTab === "items"
                  ? "font-bold text-blue-700 border-b-2 border-blue-600"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Layers className="w-3.5 h-3.5 text-blue-600" />
              <span>Line Items</span>
              <span className="ml-1 px-1.5 py-0.2 rounded-full bg-blue-100 text-blue-800 text-[10px] font-mono font-bold">
                {items.length}
              </span>
            </button>
            <button
              type="button"
              onClick={() => onSelectAuxTab?.("transporter")}
              className={`flex items-center space-x-1 pb-0.5 transition cursor-pointer ${
                activeAuxTab === "transporter"
                  ? "font-bold text-blue-700 border-b-2 border-blue-600"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Truck className="w-3.5 h-3.5 text-slate-400" />
              <span>Transporter Details</span>
            </button>
            <button
              type="button"
              onClick={() => onSelectAuxTab?.("remarks")}
              className={`flex items-center space-x-1 pb-0.5 transition cursor-pointer ${
                activeAuxTab === "remarks"
                  ? "font-bold text-blue-700 border-b-2 border-blue-600"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <FileText className="w-3.5 h-3.5 text-slate-400" />
              <span>Document Remarks</span>
            </button>
            <button
              type="button"
              onClick={() => onSelectAuxTab?.("addons")}
              className={`flex items-center space-x-1 pb-0.5 transition cursor-pointer ${
                activeAuxTab === "addons"
                  ? "font-bold text-blue-700 border-b-2 border-blue-600"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <PlusCircle className="w-3.5 h-3.5 text-slate-400" />
              <span>Add-ons &amp; Charges</span>
            </button>
          </div>
          <div className="hidden sm:flex items-center space-x-2 text-[11px] text-slate-500 font-mono">
            <span className="font-medium text-slate-700">Cur: INR (₹)</span>
            <span>•</span>
            <span
              title={`Statutory Tax Treatment: ${isInterstate ? 'Inter-State IGST (Place of supply: ' + (placeOfSupplyCode || 'Out of state') + ')' : 'Intra-State CGST+SGST (Local State)'}`}
              className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${
                isInterstate
                  ? "bg-blue-50 text-blue-800 border-blue-200"
                  : "bg-emerald-50 text-emerald-800 border-emerald-200"
              }`}
            >
              Tax Regime: {items.length > 0 ? `GST ${items[0].gstRate}%` : "GST 18%"} {isInterstate ? "Inter-State IGST" : "Intra-State CGST+SGST"}
            </span>
          </div>
        </div>
      </div>

      {/* ─── Spreadsheet Data Grid ────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse text-left text-xs" id="billingItemsTable">
          <thead className="bg-slate-50 text-slate-700 font-semibold sticky top-0 z-20 border-b border-slate-300 select-none">
            <tr className="divide-x divide-slate-200">
              <th className="py-2.5 px-3 w-12 text-center">S.No</th>
              <th className="py-2.5 px-3 min-w-[180px]">Stock No / SKU</th>
              <th className="py-2.5 px-3 min-w-[240px]">Item Description</th>
              <th className="py-2.5 px-3 w-28 text-right">Rate (₹)</th>
              <th className="py-2.5 px-3 w-20 text-center">Qty</th>
              <th className="py-2.5 px-3 w-28 text-right">Value (₹)</th>
              <th className="py-2.5 px-3 w-20 text-right">Disc %</th>
              <th className="py-2.5 px-3 w-24 text-right">Disc Amt (₹)</th>
              <th className="py-2.5 px-3 w-24 text-right">Tax (₹)</th>
              <th className="py-2.5 px-3 w-28 text-right">Total (₹)</th>
              <th className="py-2.5 px-3 min-w-[140px]">Sales Staff</th>
              <th className="py-2.5 px-2 w-12 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 font-sans">
            {/* ── PRIMARY ACTIVE ENTRY ROW (Stitch Row 1) ── */}
            <tr className="bg-white hover:bg-slate-50/70 transition-colors divide-x divide-slate-200">
              <td className="py-2 px-3 text-center font-mono font-medium text-slate-500">
                {items.length + 1}
              </td>
              {/* Scan / Enter SKU input cell */}
              <td className="py-1 px-2">
                <div className="relative flex items-center">
                  <button
                    type="button"
                    onClick={onOpenSkuSearch}
                    className="absolute left-2 text-slate-400 hover:text-blue-600 cursor-pointer"
                    title="Product Catalog SKU Search (F11)"
                  >
                    <Search className="w-3.5 h-3.5" />
                  </button>
                  <input
                    ref={stockInputRef}
                    id="dist-entry-stockno"
                    data-f2-entity="variant"
                    type="text"
                    value={stockNo}
                    onChange={(e) => setStockNo(e.target.value)}
                    onBlur={handleStockNoBlur}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleCommitRow();
                      }
                    }}
                    placeholder="Scan / SKU (F11)"
                    className="h-8 w-full pl-8 pr-2 text-xs font-mono placeholder:text-slate-400 focus:bg-white bg-slate-50 border border-slate-300 focus:border-blue-600 rounded px-2 focus:outline-none"
                  />
                </div>
              </td>
              {/* Item Description input */}
              <td className="py-1 px-2">
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleCommitRow();
                    }
                  }}
                  placeholder="Enter item description"
                  className="h-8 w-full text-xs placeholder:text-slate-400 bg-white border border-slate-300 focus:border-blue-600 rounded px-2 focus:outline-none"
                />
              </td>
              {/* Rate */}
              <td className="py-1 px-2">
                <input
                  type="number"
                  value={rate}
                  onChange={(e) => setRate(e.target.value === "" ? "" : Number(e.target.value))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleCommitRow();
                    }
                  }}
                  className="h-8 w-full text-right font-mono text-xs bg-white border border-slate-300 focus:border-blue-600 rounded px-2 focus:outline-none"
                  placeholder="0.00"
                />
              </td>
              {/* Quantity */}
              <td className="py-1 px-2">
                <input
                  type="number"
                  min="1"
                  value={qty}
                  onChange={(e) => setQty(e.target.value === "" ? "" : Number(e.target.value))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleCommitRow();
                    }
                  }}
                  className="h-8 w-full text-center font-mono text-xs font-bold text-slate-800 bg-white border border-slate-300 focus:border-blue-600 rounded px-2 focus:outline-none"
                />
              </td>
              {/* Value (calculated) */}
              <td className="py-2 px-3 text-right font-mono text-slate-500">
                {numValue.toFixed(2)}
              </td>
              {/* Discount % */}
              <td className="py-1 px-2">
                <input
                  type="number"
                  value={discPercent}
                  onChange={(e) => setDiscPercent(e.target.value === "" ? "" : Number(e.target.value))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleCommitRow();
                    }
                  }}
                  className="h-8 w-full text-right font-mono text-xs bg-white border border-slate-300 focus:border-blue-600 rounded px-2 focus:outline-none"
                  placeholder="0.00"
                />
              </td>
              {/* Discount Amt */}
              <td className="py-2 px-3 text-right font-mono text-slate-500">
                {numDiscAmt.toFixed(2)}
              </td>
              {/* Tax */}
              <td className="py-2 px-3 text-right font-mono text-slate-500">
                {calculatedTax.toFixed(2)}
              </td>
              {/* Total */}
              <td className="py-2 px-3 text-right font-mono text-slate-500 font-bold">
                {numTotal.toFixed(2)}
              </td>
              {/* Sales Staff dropdown */}
              <td className="py-1 px-2">
                <select
                  value={salesStaff}
                  onChange={(e) => setSalesStaff(e.target.value)}
                  className="h-8 w-full text-xs bg-white text-slate-700 border border-slate-300 focus:border-blue-600 rounded px-1.5 focus:outline-none cursor-pointer"
                >
                  {staffList.map((s) => (
                    <option key={s.id} value={s.name}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </td>
              {/* Add Row CTA Action */}
              <td className="py-1 px-2 text-center">
                <button
                  type="button"
                  onClick={handleCommitRow}
                  className="w-7 h-7 mx-auto bg-slate-100 hover:bg-blue-600 hover:text-white rounded border border-slate-300 flex items-center justify-center text-slate-600 transition cursor-pointer"
                  title="Add Line Item (Enter)"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </td>
            </tr>

            {/* ── COMMITTED ITEM ROWS ── */}
            {items.map((item, idx) => {
              const itemValue = (Number(item.rate) || 0) * (Number(item.qty) || 0);
              const itemDiscAmt = Number(item.discAmt) || ((itemValue * (Number(item.discPercent) || 0)) / 100);
              const taxable = Math.max(0, itemValue - itemDiscAmt);
              const itemTax = (taxable * (Number(item.gstRate) || 18)) / 100;
              const itemTotal = taxable + itemTax;

              return (
                <tr
                  key={item.id || idx}
                  className="bg-white hover:bg-slate-50 transition-colors divide-x divide-slate-200 group"
                >
                  <td className="py-2 px-3 text-center font-mono font-medium text-slate-600 bg-slate-50/50">
                    {idx + 1}
                  </td>
                  <td className="py-2 px-3 font-mono font-bold text-blue-700">
                    {item.stockNo}
                  </td>
                  <td className="py-2 px-3 font-medium text-slate-800">
                    {item.itemDescription}
                  </td>
                  <td className="py-1 px-2 text-right font-mono">
                    <input
                      type="number"
                      value={item.rate}
                      onChange={(e) => onUpdateItem(idx, { rate: Number(e.target.value) || 0 })}
                      className="h-7 w-24 text-right font-mono text-xs border border-transparent hover:border-slate-300 focus:border-blue-600 rounded px-1"
                    />
                  </td>
                  <td className="py-1 px-2 text-center font-mono">
                    <input
                      type="number"
                      min="1"
                      value={item.qty}
                      onChange={(e) => onUpdateItem(idx, { qty: Number(e.target.value) || 1 })}
                      className="h-7 w-16 text-center font-mono font-bold text-xs border border-transparent hover:border-slate-300 focus:border-blue-600 rounded px-1"
                    />
                  </td>
                  <td className="py-2 px-3 text-right font-mono text-slate-700">
                    {itemValue.toFixed(2)}
                  </td>
                  <td className="py-2 px-3 text-right font-mono text-slate-700">
                    {(Number(item.discPercent) || 0).toFixed(2)}
                  </td>
                  <td className="py-2 px-3 text-right font-mono text-slate-700">
                    {itemDiscAmt.toFixed(2)}
                  </td>
                  <td className="py-2 px-3 text-right font-mono text-slate-700">
                    {itemTax.toFixed(2)}
                  </td>
                  <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">
                    {itemTotal.toFixed(2)}
                  </td>
                  <td className="py-2 px-3 text-slate-700 truncate max-w-[140px]">
                    {item.salesStaff}
                  </td>
                  <td className="py-1 px-2 text-center">
                    <button
                      type="button"
                      onClick={() => onDeleteItem(idx)}
                      className="p-1 text-slate-400 hover:text-rose-600 rounded transition cursor-pointer"
                      title="Remove Row"
                    >
                      <Trash2 className="w-3.5 h-3.5 mx-auto" />
                    </button>
                  </td>
                </tr>
              );
            })}

            {/* ── EMPTY GUIDE ROWS (Dense Spreadsheet Visual) ── */}
            {Array.from({ length: minGuideRows }).map((_, guideIdx) => (
              <tr
                key={`guide-${guideIdx}`}
                className="bg-white hover:bg-slate-50/50 transition-colors divide-x divide-slate-200 h-9"
              >
                <td className="py-2 px-3 text-center font-mono font-medium text-slate-400">
                  {items.length + 2 + guideIdx}
                </td>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
};
