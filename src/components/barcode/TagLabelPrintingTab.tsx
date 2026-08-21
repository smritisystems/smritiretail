/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.31.0
 * Created      : 2026-08-21
 * Modified     : 2026-08-21
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import React, { useState, useEffect, useMemo, useRef } from "react";
import { Product } from "../../types.ts";
import { apiFetchV1 } from "../../lib/apiFetch.ts";
import {
  LabelPrintRow,
  LabelPrintSettings,
  SelectionCriteriaRange,
  PortType,
  LabelSourceOption,
  LabelQuantityMode
} from "./types.ts";

interface TagLabelPrintingTabProps {
  products?: Product[];
  currentUser?: { role: string; name: string } | null;
  onNotification?: (title: string, message: string, type: "success" | "error") => void;
  onClose?: () => void;
}

export const TagLabelPrintingTab: React.FC<TagLabelPrintingTabProps> = ({
  products: initialProducts = [],
  currentUser,
  onNotification,
  onClose
}) => {
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [gridRows, setGridRows] = useState<LabelPrintRow[]>([]);
  const [selectedRowIndex, setSelectedRowIndex] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 12;

  // Settings
  const [settings, setSettings] = useState<LabelPrintSettings>({
    scriptFileName: "\\\\Tallydt276\\d\\Shoper9\\Barcode\\BarcodeScript_Acme.t",
    labelsPerRow: 1,
    outputToPort: true,
    outputToFile: true,
    portSetting: "USB",
    sourceOption: "Manual Selection",
    piPdtFileName: "",
    quantityMode: "Specified Quantity"
  });

  // Selection Criteria Ranges
  const [criteria, setCriteria] = useState<SelectionCriteriaRange>({
    stockNoFrom: "",
    stockNoTo: "",
    brandFrom: "",
    brandTo: "",
    productFrom: "",
    productTo: "",
    colourFrom: "",
    colourTo: "",
    styleFrom: "",
    styleTo: "",
    sizeFrom: "",
    sizeTo: ""
  });

  // Modal / Preview state
  const [showPrintDialog, setShowPrintDialog] = useState(false);
  const [pdtImporting, setPdtImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch products from backend if empty
  useEffect(() => {
    if (products.length === 0) {
      loadProducts();
    } else {
      populateGrid(products);
    }
  }, [initialProducts]);

  const loadProducts = async () => {
    try {
      const res = await apiFetchV1("/products");
      const list = Array.isArray(res) ? res : res?.items || [];
      if (list.length > 0) {
        setProducts(list);
        populateGrid(list);
      }
    } catch {
      // Fallback to sample data
      const sampleList: Product[] = [
        { id: "1", code: "000001", name: "Trousers", category: "Apparel", brand: "Abiba Halo", color: "Blue", styleCode: "BPTY", size: "32", mrp: 1299, price: 999, stock: 12, barcode: "890100000001" },
        { id: "2", code: "000002", name: "Trousers", category: "Apparel", brand: "Abiba Halo", color: "Blue", styleCode: "BPTY", size: "34", mrp: 1299, price: 999, stock: 15, barcode: "890100000002" },
        { id: "3", code: "000003", name: "Trousers", category: "Apparel", brand: "Abiba Halo", color: "Blue", styleCode: "BPTY", size: "36", mrp: 1299, price: 999, stock: 8, barcode: "890100000003" },
        { id: "4", code: "000004", name: "Knit Shirts", category: "Apparel", brand: "Lance Perry", color: "Blue", styleCode: "LPB9E", size: "L", mrp: 899, price: 699, stock: 24, barcode: "890100000004" },
        { id: "5", code: "000005", name: "Knit Shirts", category: "Apparel", brand: "Lance Perry", color: "Blue", styleCode: "LPB9E", size: "M", mrp: 899, price: 699, stock: 18, barcode: "890100000005" },
        { id: "6", code: "000006", name: "Knit Shirts", category: "Apparel", brand: "Lance Perry", color: "Blue", styleCode: "LPB9E", size: "S", mrp: 899, price: 699, stock: 6, barcode: "890100000006" }
      ];
      setProducts(sampleList);
      populateGrid(sampleList);
    }
  };

  const populateGrid = (itemsList: Product[]) => {
    const rows: LabelPrintRow[] = itemsList.map((p, idx) => ({
      id: p.id || `row-${idx}`,
      sNo: idx + 1,
      stockNo: p.code || String(idx + 1).padStart(6, "0"),
      barcode: p.barcode || p.code || "",
      brand: p.brand || "SMRITI",
      product: p.name || p.category || "Item",
      colour: p.color || "-",
      style: p.styleCode || "-",
      size: p.size || "-",
      mrp: p.mrp || p.price || 0,
      sellingPrice: p.price || 0,
      currentStock: p.stock ?? 0,
      labelCount: 0,
      originalProduct: p
    }));
    setGridRows(rows);
  };

  // Distinct options for dropdowns
  const uniqueBrands = useMemo(() => Array.from(new Set(products.map(p => p.brand).filter(Boolean))), [products]);
  const uniqueProducts = useMemo(() => Array.from(new Set(products.map(p => p.name || p.category).filter(Boolean))), [products]);
  const uniqueColours = useMemo(() => Array.from(new Set(products.map(p => p.color).filter(Boolean))), [products]);
  const uniqueStyles = useMemo(() => Array.from(new Set(products.map(p => p.styleCode).filter(Boolean))), [products]);
  const uniqueSizes = useMemo(() => Array.from(new Set(products.map(p => p.size).filter(Boolean))), [products]);

  // Filtered rows based on Selection Criteria ranges
  const filteredRows = useMemo(() => {
    return gridRows.filter(row => {
      if (criteria.stockNoFrom && row.stockNo < criteria.stockNoFrom) return false;
      if (criteria.stockNoTo && row.stockNo > criteria.stockNoTo) return false;
      if (criteria.brandFrom && row.brand < criteria.brandFrom) return false;
      if (criteria.brandTo && row.brand > criteria.brandTo) return false;
      if (criteria.productFrom && row.product < criteria.productFrom) return false;
      if (criteria.productTo && row.product > criteria.productTo) return false;
      if (criteria.colourFrom && row.colour < criteria.colourFrom) return false;
      if (criteria.colourTo && row.colour > criteria.colourTo) return false;
      if (criteria.styleFrom && row.style < criteria.styleFrom) return false;
      if (criteria.styleTo && row.style > criteria.styleTo) return false;
      if (criteria.sizeFrom && row.size < criteria.sizeFrom) return false;
      if (criteria.sizeTo && row.size > criteria.sizeTo) return false;
      return true;
    });
  }, [gridRows, criteria]);

  // Synchronize Present Stock mode
  useEffect(() => {
    if (settings.quantityMode === "Present Stock") {
      setGridRows(prev => prev.map(r => ({ ...r, labelCount: Math.max(0, r.currentStock) })));
    }
  }, [settings.quantityMode]);

  // Computed summary totals
  const totalRecords = filteredRows.length;
  const currentStockSum = useMemo(() => filteredRows.reduce((sum, r) => sum + r.currentStock, 0), [filteredRows]);
  const labelsToPrintSum = useMemo(() => filteredRows.reduce((sum, r) => sum + r.labelCount, 0), [filteredRows]);

  // Pagination
  const totalPages = Math.ceil(filteredRows.length / pageSize) || 1;
  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, currentPage]);

  const handleUpdateLabelCount = (rowId: string, count: number) => {
    const val = isNaN(count) ? 0 : Math.max(0, count);
    setGridRows(prev => prev.map(r => (r.id === rowId ? { ...r, labelCount: val } : r)));
  };

  const handleClear = () => {
    setGridRows(prev => prev.map(r => ({ ...r, labelCount: 0 })));
    if (onNotification) onNotification("Cleared", "All label quantities reset to 0.", "success");
  };

  const handlePrintAll = () => {
    const rowsToPrint = filteredRows.filter(r => r.labelCount > 0);
    if (rowsToPrint.length === 0) {
      alert("No labels have quantity greater than 0 to print.");
      return;
    }
    setShowPrintDialog(true);
  };

  // Keyboard shortcut listener (F2, F3)
  useEffect(() => {
    const handleKeys = (e: KeyboardEvent) => {
      if (e.key === "F2") {
        e.preventDefault();
        // Focus first visible quantity input
        const firstInput = document.querySelector<HTMLInputElement>(".label-qty-input");
        firstInput?.focus();
      } else if (e.key === "F3") {
        e.preventDefault();
        if (onClose) onClose();
      }
    };
    window.addEventListener("keydown", handleKeys);
    return () => window.removeEventListener("keydown", handleKeys);
  }, [onClose]);

  return (
    <div className="bg-[#faf9ff] text-[#1a1b20] font-sans h-full flex flex-col antialiased select-none overflow-hidden">
      {/* Main Workspace Frame */}
      <main className="flex-1 flex flex-col p-3 bg-[#faf9ff] overflow-y-auto">
        {/* Window Title Bar */}
        <div className="bg-[#e8e7ed] px-3 py-1.5 border border-[#c4c6d4] rounded-t flex justify-between items-center shrink-0 mb-2">
          <div className="flex items-center gap-1.5 text-[#00296d] font-bold text-xs">
            <span className="material-symbols-outlined text-[16px]">print</span>
            <span>Tag Printing</span>
            <span className="text-[10px] bg-[#dae2ff] text-[#00296d] px-1.5 py-0.2 rounded font-mono ml-2">
              SMRITI 9 Professional
            </span>
          </div>
          <div className="flex gap-1">
            <button
              type="button"
              className="w-5 h-5 border border-[#c4c6d4] bg-[#eeedf3] hover:bg-white flex items-center justify-center rounded-xs transition-colors"
            >
              <span className="material-symbols-outlined text-[13px]">minimize</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-5 h-5 border border-[#c4c6d4] bg-[#ffdad6] text-[#93000a] hover:bg-[#ba1a1a] hover:text-white flex items-center justify-center rounded-xs transition-colors"
            >
              <span className="material-symbols-outlined text-[13px]">close</span>
            </button>
          </div>
        </div>

        {/* Application Workspace */}
        <div className="flex-1 border border-[#c4c6d4] rounded-b bg-white flex flex-col p-3 shadow-sm overflow-hidden">
          {/* Header Area: Script & Settings */}
          <div className="flex flex-wrap items-center gap-4 mb-2 pb-2 border-b border-[#c4c6d4] shrink-0 text-xs">
            <div className="flex-1 flex items-center gap-2 min-w-[300px]">
              <label className="font-semibold text-[#434652] whitespace-nowrap">Script File Name</label>
              <div className="flex-1 flex">
                <input
                  type="text"
                  value={settings.scriptFileName}
                  onChange={(e) => setSettings({ ...settings, scriptFileName: e.target.value })}
                  className="w-full border border-[#737685] rounded-l px-2 py-0.5 text-xs font-mono bg-white outline-none focus:ring-1 focus:ring-[#00296d] h-6"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="bg-[#eeedf3] border-y border-r border-[#737685] text-[#1a1b20] px-2.5 h-6 rounded-r hover:bg-[#e8e7ed] text-xs font-bold"
                >
                  ...
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".t,.prn,.zpl,.tspl,.txt"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setSettings({ ...settings, scriptFileName: file.name });
                    }
                  }}
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <label className="font-semibold text-[#434652] whitespace-nowrap">No. of Labels Per Row</label>
              <input
                type="number"
                min="1"
                max="8"
                value={settings.labelsPerRow}
                onChange={(e) => setSettings({ ...settings, labelsPerRow: parseInt(e.target.value) || 1 })}
                className="w-16 text-center border border-[#737685] rounded px-2 py-0.5 text-xs font-bold font-mono h-6 outline-none focus:ring-1 focus:ring-[#00296d]"
              />
            </div>
          </div>

          {/* Main Grid Layout: Left Sidebar + Right Data Area */}
          <div className="flex flex-1 gap-3 overflow-hidden">
            {/* Left Sidebar (Options & Settings) */}
            <div className="w-64 flex flex-col gap-2 overflow-y-auto pr-1 shrink-0 text-xs">
              {/* Output To */}
              <fieldset className="border border-[#c4c6d4] rounded p-2 bg-[#faf9ff]">
                <legend className="text-[10px] font-bold text-[#434652] uppercase px-1 tracking-wider">Output To</legend>
                <div className="flex items-center gap-4 py-0.5">
                  <label className="flex items-center gap-1 font-medium cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.outputToPort}
                      onChange={(e) => setSettings({ ...settings, outputToPort: e.target.checked })}
                      className="rounded border-[#737685] text-[#00296d] focus:ring-0 w-3.5 h-3.5"
                    />
                    Port
                  </label>
                  <label className="flex items-center gap-1 font-medium cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.outputToFile}
                      onChange={(e) => setSettings({ ...settings, outputToFile: e.target.checked })}
                      className="rounded border-[#737685] text-[#00296d] focus:ring-0 w-3.5 h-3.5"
                    />
                    File
                  </label>
                  <button
                    type="button"
                    className="ml-auto bg-[#eeedf3] border border-[#c4c6d4] hover:bg-white text-[10px] px-1.5 py-0.5 rounded font-bold"
                  >
                    ...
                  </button>
                </div>
              </fieldset>

              {/* Port Settings */}
              <fieldset className="border border-[#c4c6d4] rounded p-2 bg-[#faf9ff]">
                <legend className="text-[10px] font-bold text-[#434652] uppercase px-1 tracking-wider">Port Settings</legend>
                <div className="grid grid-cols-2 gap-1 py-0.5">
                  {(["COM 1", "USB", "Network TCP/IP"] as PortType[]).map((port) => (
                    <label key={port} className="flex items-center gap-1 font-medium cursor-pointer">
                      <input
                        type="radio"
                        name="portSetting"
                        value={port}
                        checked={settings.portSetting === port}
                        onChange={() => setSettings({ ...settings, portSetting: port })}
                        className="text-[#00296d] focus:ring-0 w-3.5 h-3.5"
                      />
                      {port}
                    </label>
                  ))}
                </div>
              </fieldset>

              {/* Source Option */}
              <fieldset className="border border-[#c4c6d4] rounded p-2 bg-[#faf9ff]">
                <legend className="text-[10px] font-bold text-[#434652] uppercase px-1 tracking-wider">Option</legend>
                <div className="flex flex-col gap-1 py-0.5">
                  {(
                    [
                      "Manual Selection",
                      "Against Purchase (PT File)",
                      "Against Transactions",
                      "Against Purchase Order",
                      "Against Masters",
                      "Against Direct Scan",
                      "Against PDT File"
                    ] as LabelSourceOption[]
                  ).map((opt) => (
                    <label key={opt} className="flex items-center gap-1 font-medium cursor-pointer">
                      <input
                        type="radio"
                        name="sourceOption"
                        value={opt}
                        checked={settings.sourceOption === opt}
                        onChange={() => setSettings({ ...settings, sourceOption: opt })}
                        className="text-[#00296d] focus:ring-0 w-3.5 h-3.5"
                      />
                      {opt}
                    </label>
                  ))}
                </div>
              </fieldset>

              {/* PI / PDT File Name */}
              <fieldset className="border border-[#c4c6d4] rounded p-2 bg-[#faf9ff]">
                <legend className="text-[10px] font-bold text-[#434652] uppercase px-1 tracking-wider">PI / PDT File Name</legend>
                <div className="flex py-0.5">
                  <input
                    type="text"
                    disabled={settings.sourceOption !== "Against PDT File" && settings.sourceOption !== "Against Purchase (PT File)"}
                    value={settings.piPdtFileName}
                    onChange={(e) => setSettings({ ...settings, piPdtFileName: e.target.value })}
                    placeholder="e.g. C:\PDT\Scans.pdt"
                    className="w-full border border-[#737685] rounded-l px-2 text-xs font-mono bg-white outline-none focus:ring-1 focus:ring-[#00296d] h-6 disabled:bg-[#eeedf3]"
                  />
                  <button
                    type="button"
                    disabled={settings.sourceOption !== "Against PDT File" && settings.sourceOption !== "Against Purchase (PT File)"}
                    className="bg-[#eeedf3] border-y border-r border-[#737685] text-[#1a1b20] px-2 h-6 rounded-r hover:bg-[#e8e7ed] text-xs font-bold disabled:opacity-50"
                  >
                    ...
                  </button>
                </div>
              </fieldset>

              {/* Labels to Print (Mode & Counters) */}
              <fieldset className="border border-[#c4c6d4] rounded p-2 bg-[#faf9ff]">
                <legend className="text-[10px] font-bold text-[#434652] uppercase px-1 tracking-wider">Labels to Print</legend>
                <div className="flex flex-col gap-1 py-0.5 mb-2">
                  {(["Specified Quantity", "Present Stock"] as LabelQuantityMode[]).map((mode) => (
                    <label key={mode} className="flex items-center gap-1 font-medium cursor-pointer">
                      <input
                        type="radio"
                        name="quantityMode"
                        value={mode}
                        checked={settings.quantityMode === mode}
                        onChange={() => setSettings({ ...settings, quantityMode: mode })}
                        className="text-[#00296d] focus:ring-0 w-3.5 h-3.5"
                      />
                      {mode}
                    </label>
                  ))}
                </div>

                <div className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-1.5 items-center font-medium">
                  <label className="text-[#434652]">Total Records:</label>
                  <input
                    type="text"
                    readOnly
                    value={totalRecords}
                    className="w-full h-6 text-right bg-[#eeedf3] border border-[#c4c6d4] rounded px-2 font-mono font-bold"
                  />

                  <label className="text-[#434652]">Current Stock:</label>
                  <input
                    type="text"
                    readOnly
                    value={currentStockSum}
                    className="w-full h-6 text-right bg-[#eeedf3] border border-[#c4c6d4] rounded px-2 font-mono font-bold"
                  />

                  <label className="text-[#434652]">Labels to Print:</label>
                  <input
                    type="text"
                    readOnly
                    value={labelsToPrintSum}
                    className="w-full h-6 text-right bg-[#e9edff] text-[#00296d] border border-[#00296d] rounded px-2 font-mono font-bold text-sm"
                  />
                </div>
              </fieldset>
            </div>

            {/* Right Main Area (Filters & Quantity Grid) */}
            <div className="flex-1 flex flex-col gap-2 overflow-hidden">
              {/* Selection Criteria Range Filters */}
              <fieldset className="border border-[#c4c6d4] rounded p-2 bg-[#faf9ff] shrink-0 text-xs">
                <legend className="text-[10px] font-bold text-[#434652] uppercase px-1 tracking-wider">Selection Criteria</legend>
                <div className="grid grid-cols-[80px_1fr_1fr] gap-x-3 gap-y-1 py-0.5 items-center">
                  <div></div>
                  <div className="font-bold text-[#434652] text-center border-b border-[#c4c6d4] pb-0.5">From</div>
                  <div className="font-bold text-[#434652] text-center border-b border-[#c4c6d4] pb-0.5">To</div>

                  {/* Stock No */}
                  <label className="font-semibold text-[#434652]">Stock No.</label>
                  <input
                    type="text"
                    value={criteria.stockNoFrom}
                    onChange={(e) => setCriteria({ ...criteria, stockNoFrom: e.target.value })}
                    placeholder="From SKU..."
                    className="h-6 border border-[#737685] rounded px-2 font-mono"
                  />
                  <input
                    type="text"
                    value={criteria.stockNoTo}
                    onChange={(e) => setCriteria({ ...criteria, stockNoTo: e.target.value })}
                    placeholder="To SKU..."
                    className="h-6 border border-[#737685] rounded px-2 font-mono"
                  />

                  {/* Brand */}
                  <label className="font-semibold text-[#434652]">Brand</label>
                  <select
                    value={criteria.brandFrom}
                    onChange={(e) => setCriteria({ ...criteria, brandFrom: e.target.value })}
                    className="h-6 border border-[#737685] rounded px-1 bg-white"
                  >
                    <option value="">(All)</option>
                    {uniqueBrands.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                  <select
                    value={criteria.brandTo}
                    onChange={(e) => setCriteria({ ...criteria, brandTo: e.target.value })}
                    className="h-6 border border-[#737685] rounded px-1 bg-white"
                  >
                    <option value="">(All)</option>
                    {uniqueBrands.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>

                  {/* Product */}
                  <label className="font-semibold text-[#434652]">Product</label>
                  <select
                    value={criteria.productFrom}
                    onChange={(e) => setCriteria({ ...criteria, productFrom: e.target.value })}
                    className="h-6 border border-[#737685] rounded px-1 bg-white"
                  >
                    <option value="">(All)</option>
                    {uniqueProducts.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                  <select
                    value={criteria.productTo}
                    onChange={(e) => setCriteria({ ...criteria, productTo: e.target.value })}
                    className="h-6 border border-[#737685] rounded px-1 bg-white"
                  >
                    <option value="">(All)</option>
                    {uniqueProducts.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>

                  {/* Colour */}
                  <label className="font-semibold text-[#434652]">Colour</label>
                  <select
                    value={criteria.colourFrom}
                    onChange={(e) => setCriteria({ ...criteria, colourFrom: e.target.value })}
                    className="h-6 border border-[#737685] rounded px-1 bg-white"
                  >
                    <option value="">(All)</option>
                    {uniqueColours.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <select
                    value={criteria.colourTo}
                    onChange={(e) => setCriteria({ ...criteria, colourTo: e.target.value })}
                    className="h-6 border border-[#737685] rounded px-1 bg-white"
                  >
                    <option value="">(All)</option>
                    {uniqueColours.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>

                  {/* Style */}
                  <label className="font-semibold text-[#434652]">Style</label>
                  <select
                    value={criteria.styleFrom}
                    onChange={(e) => setCriteria({ ...criteria, styleFrom: e.target.value })}
                    className="h-6 border border-[#737685] rounded px-1 bg-white"
                  >
                    <option value="">(All)</option>
                    {uniqueStyles.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <select
                    value={criteria.styleTo}
                    onChange={(e) => setCriteria({ ...criteria, styleTo: e.target.value })}
                    className="h-6 border border-[#737685] rounded px-1 bg-white"
                  >
                    <option value="">(All)</option>
                    {uniqueStyles.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>

                  {/* Size */}
                  <label className="font-semibold text-[#434652]">Size</label>
                  <select
                    value={criteria.sizeFrom}
                    onChange={(e) => setCriteria({ ...criteria, sizeFrom: e.target.value })}
                    className="h-6 border border-[#737685] rounded px-1 bg-white"
                  >
                    <option value="">(All)</option>
                    {uniqueSizes.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <select
                    value={criteria.sizeTo}
                    onChange={(e) => setCriteria({ ...criteria, sizeTo: e.target.value })}
                    className="h-6 border border-[#737685] rounded px-1 bg-white"
                  >
                    <option value="">(All)</option>
                    {uniqueSizes.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </fieldset>

              {/* Tactical Quantity Grid */}
              <fieldset className="flex-1 flex flex-col overflow-hidden border border-[#c4c6d4] rounded p-2 bg-white mb-0">
                <legend className="text-[10px] font-bold text-[#434652] uppercase px-1 tracking-wider">Edit Quantity Details</legend>
                <div className="flex-1 border border-[#c4c6d4] bg-white overflow-auto custom-scrollbar">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead className="bg-[#eeedf3] sticky top-0 z-10 shadow-xs text-[10px] font-bold uppercase text-[#434652]">
                      <tr>
                        <th className="border-b border-r border-[#c4c6d4] p-1 w-8 text-center bg-[#e8e7ed]">#</th>
                        <th className="border-b border-r border-[#c4c6d4] p-1 px-2">Stock Number</th>
                        <th className="border-b border-r border-[#c4c6d4] p-1 px-2">Brand</th>
                        <th className="border-b border-r border-[#c4c6d4] p-1 px-2">Product</th>
                        <th className="border-b border-r border-[#c4c6d4] p-1 px-2">Colour</th>
                        <th className="border-b border-r border-[#c4c6d4] p-1 px-2">Style</th>
                        <th className="border-b border-r border-[#c4c6d4] p-1 px-2">Size</th>
                        <th className="border-b border-[#c4c6d4] p-1 px-2 w-20 text-right"># Lbls</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#c4c6d4]/40 font-medium">
                      {paginatedRows.map((row, idx) => {
                        const isSelected = idx === selectedRowIndex;
                        return (
                          <tr
                            key={row.id}
                            onClick={() => setSelectedRowIndex(idx)}
                            className={`hover:bg-[#f4f3f9] transition-colors ${
                              isSelected ? "bg-[#cdddff]/40" : ""
                            }`}
                          >
                            <td className="border-r border-[#c4c6d4] p-1 text-center bg-[#f4f3f9] text-[#434652] font-mono">
                              {(currentPage - 1) * pageSize + idx + 1}
                            </td>
                            <td className="border-r border-[#c4c6d4] p-1 px-2 font-mono font-bold">{row.stockNo}</td>
                            <td className="border-r border-[#c4c6d4] p-1 px-2">{row.brand}</td>
                            <td className="border-r border-[#c4c6d4] p-1 px-2">{row.product}</td>
                            <td className="border-r border-[#c4c6d4] p-1 px-2">{row.colour}</td>
                            <td className="border-r border-[#c4c6d4] p-1 px-2">{row.style}</td>
                            <td className="border-r border-[#c4c6d4] p-1 px-2">{row.size}</td>
                            <td className="p-0.5 px-1 text-right">
                              <input
                                type="number"
                                min="0"
                                value={row.labelCount}
                                onChange={(e) => handleUpdateLabelCount(row.id, parseInt(e.target.value) || 0)}
                                className="label-qty-input w-full text-right h-5 border border-[#737685] rounded px-1 text-xs font-mono font-bold text-[#00296d] focus:border-[#00296d] focus:ring-1 focus:ring-[#00296d] bg-white shadow-inner"
                              />
                            </td>
                          </tr>
                        );
                      })}

                      {/* Empty padding rows to preserve software layout */}
                      {Array.from({ length: Math.max(0, pageSize - paginatedRows.length) }).map((_, i) => (
                        <tr key={"empty-" + i} className="border-b border-[#c4c6d4]/30 h-6 bg-white">
                          <td className="border-r border-[#c4c6d4]/30 p-1 text-center text-[#c4c6d4] font-mono">
                            {paginatedRows.length + i + 1}
                          </td>
                          <td className="border-r border-[#c4c6d4]/30"></td>
                          <td className="border-r border-[#c4c6d4]/30"></td>
                          <td className="border-r border-[#c4c6d4]/30"></td>
                          <td className="border-r border-[#c4c6d4]/30"></td>
                          <td className="border-r border-[#c4c6d4]/30"></td>
                          <td className="border-r border-[#c4c6d4]/30"></td>
                          <td></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </fieldset>
            </div>
          </div>

          {/* Bottom Action Bar */}
          <div className="mt-2 pt-2 border-t border-[#c4c6d4] flex items-center justify-between shrink-0 text-xs">
            <div className="flex gap-1">
              <button
                type="button"
                onClick={handlePrintAll}
                className="bg-[#eeedf3] hover:bg-[#e8e7ed] border border-[#c4c6d4] text-[#1a1b20] font-bold px-4 py-1 rounded transition-colors w-20"
              >
                OK
              </button>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage(1)}
                className="bg-[#eeedf3] hover:bg-white border border-[#c4c6d4] p-1 rounded disabled:opacity-40"
              >
                <span className="material-symbols-outlined text-[16px]">first_page</span>
              </button>
              <button
                type="button"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                className="bg-[#eeedf3] hover:bg-white border border-[#c4c6d4] p-1 rounded disabled:opacity-40"
              >
                <span className="material-symbols-outlined text-[16px]">chevron_left</span>
              </button>
              <span className="px-2 font-mono font-bold text-[11px]">
                {currentPage} / {totalPages}
              </span>
              <button
                type="button"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                className="bg-[#eeedf3] hover:bg-white border border-[#c4c6d4] p-1 rounded disabled:opacity-40"
              >
                <span className="material-symbols-outlined text-[16px]">chevron_right</span>
              </button>
              <button
                type="button"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage(totalPages)}
                className="bg-[#eeedf3] hover:bg-white border border-[#c4c6d4] p-1 rounded disabled:opacity-40"
              >
                <span className="material-symbols-outlined text-[16px]">last_page</span>
              </button>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={handlePrintAll}
                className="bg-[#00296d] hover:bg-[#0052cc] text-white font-bold px-4 py-1 rounded transition-colors flex items-center gap-1 shadow-sm"
              >
                <span className="material-symbols-outlined text-[15px]">print</span>
                Print ({labelsToPrintSum})
              </button>
              <button
                type="button"
                onClick={handlePrintAll}
                className="bg-[#eeedf3] hover:bg-[#e8e7ed] border border-[#c4c6d4] font-bold px-3 py-1 rounded transition-colors"
              >
                Print All
              </button>
              <button
                type="button"
                onClick={handleClear}
                className="bg-[#eeedf3] hover:bg-[#e8e7ed] border border-[#c4c6d4] font-bold px-3 py-1 rounded transition-colors"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={onClose}
                className="bg-[#ffdad6] text-[#93000a] border border-[#ffdad6] hover:bg-[#ba1a1a] hover:text-white font-bold px-3 py-1 rounded transition-colors"
              >
                Exit
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Footer Hotkeys Bar */}
      <footer className="bg-[#f4f3f9] border-t border-[#c4c6d4] flex justify-between items-center px-4 py-1 w-full shrink-0 text-xs">
        <div className="flex gap-4 font-mono text-[#434652]">
          <span className="cursor-pointer hover:text-[#00296d]">
            <strong className="text-[#00296d]">F2</strong> Edit Quantity Details
          </span>
          <span className="cursor-pointer hover:text-[#00296d]">
            <strong className="text-[#00296d]">F3</strong> Close Grid Window
          </span>
        </div>
        <div className="flex items-center gap-6 font-mono text-[#434652] text-[11px]">
          <span>{filteredRows.length > 0 ? `${(currentPage - 1) * pageSize + 1} - ${Math.min(filteredRows.length, currentPage * pageSize)} Of ${filteredRows.length}` : "0 Records"}</span>
          <span>{new Date().toLocaleDateString("en-GB")}</span>
        </div>
      </footer>

      {/* Print Preview & Thermal Dispatch Modal */}
      {showPrintDialog && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="bg-[#faf9ff] text-[#1a1b20] w-full max-w-2xl rounded-lg shadow-2xl border border-[#c4c6d4] flex flex-col overflow-hidden">
            <div className="bg-[#00296d] text-white px-4 py-2.5 flex justify-between items-center">
              <span className="font-bold text-sm">Thermal Label Print Dispatch</span>
              <button onClick={() => setShowPrintDialog(false)} className="text-white hover:opacity-80">
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <div className="p-4 flex flex-col gap-3 text-xs">
              <div className="bg-[#eeedf3] p-3 rounded border border-[#c4c6d4] flex justify-between items-center">
                <div>
                  <span className="font-bold text-[#00296d] block">Job Destination: {settings.portSetting}</span>
                  <span className="text-[11px] text-[#434652]">Script: {settings.scriptFileName}</span>
                </div>
                <span className="bg-[#00296d] text-white px-2.5 py-1 rounded font-bold font-mono text-sm">
                  {labelsToPrintSum} Labels
                </span>
              </div>

              <div className="max-h-56 overflow-y-auto border border-[#c4c6d4] rounded bg-white p-2 flex flex-col gap-1.5 custom-scrollbar">
                <span className="font-bold text-[#434652] text-[11px]">Labels in Queue:</span>
                {filteredRows.filter(r => r.labelCount > 0).map((r) => (
                  <div key={r.id} className="flex justify-between items-center border-b border-[#eeedf3] py-1">
                    <span className="font-mono font-bold">{r.stockNo} - {r.product} ({r.colour} / {r.size})</span>
                    <span className="font-mono bg-[#dae2ff] text-[#00296d] px-2 py-0.5 rounded font-bold">
                      {r.labelCount} pcs
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-[#e8e7ed] p-3 flex justify-end gap-2 border-t border-[#c4c6d4]">
              <button
                type="button"
                onClick={() => setShowPrintDialog(false)}
                className="bg-white border border-[#c4c6d4] px-4 py-1.5 rounded font-bold text-[#434652]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  window.print();
                  setShowPrintDialog(false);
                  if (onNotification) onNotification("Print Dispatched", `Sent ${labelsToPrintSum} labels to ${settings.portSetting}.`, "success");
                }}
                className="bg-[#00296d] hover:bg-[#0052cc] text-white px-6 py-1.5 rounded font-bold flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-[16px]">print</span>
                Dispatch to Printer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
