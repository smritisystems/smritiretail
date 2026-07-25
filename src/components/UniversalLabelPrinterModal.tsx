/**
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Organization : AITDL NETWORKS
 *
 * Founders
 *
 * * Pushpa Devi Jawahar Mallah
 *   * Founder & Chairperson
 *   * Phone: +91 9324117007
 *   * Email: founder@aitdl.com
 *
 * * Jawahar Ramkripal Mallah
 *   * Founder, Chief Executive Officer (CEO) & Chief Software Architect
 *   * Email: founder@aitdl.com
 *
 * * Websites: smritisys.com | aitdl.com | erpnbook.com | smritibooks.com
 *
 * * Version    : 3.33.0 (Universal SMRITI Label Printing Engine Modal)
 * * Created    : 2026-07-25
 * * Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
 * * License    : Proprietary Commercial Software
 */

import React, { useState, useMemo } from "react";
import { 
  Printer, X, Filter, Sparkles, FileCode, CheckCircle2, 
  Layers, Search, SlidersHorizontal, Tag, Eye
} from "lucide-react";
import { 
  UniversalLabelItem, QuantitySource, LabelTemplate, PrinterProfile, 
  DEFAULT_LABEL_TEMPLATES, DEFAULT_PRINTER_PROFILES, 
  extractLabelTokens, renderPRNScript, computeLabelCopies 
} from "../services/universalLabelPrinterService.ts";
import { BarcodeLabel } from "../print_engine/templates/BarcodeLabel.tsx";

export interface UniversalLabelPrinterModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: UniversalLabelItem[];
  moduleSource?: string; // e.g. "Item Master", "Purchase", "GRN", "POS", "Stock Transfer", "Barcode Master"
  onNotification?: (title: string, message: string, type: "success" | "error") => void;
}

export const UniversalLabelPrinterModal: React.FC<UniversalLabelPrinterModalProps> = ({
  isOpen,
  onClose,
  items,
  moduleSource = "Item Master",
  onNotification
}) => {
  if (!isOpen) return null;

  // Selection & Filter State
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set(items.map(i => i.id)));
  const [selectionMode, setSelectionMode] = useState<"selected_only" | "all_filtered" | "range_boundary" | "search_results">("selected_only");
  
  // Search & Attribute Filter Drawer
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [brandFilter, setBrandFilter] = useState("");
  const [vendorFilter, setVendorFilter] = useState("");
  const [warehouseFilter, setWarehouseFilter] = useState("");
  const [stockStatusFilter, setStockStatusFilter] = useState("");
  const [showFilterDrawer, setShowFilterDrawer] = useState(false);

  // Range boundary filter (e.g. SKU A to SKU B)
  const [rangeFromSku, setRangeFromSku] = useState("");
  const [rangeToSku, setRangeToSku] = useState("");

  // Quantity Source Engine
  const [quantitySource, setQuantitySource] = useState<QuantitySource>("fixed");
  const [fixedCopies, setFixedCopies] = useState<number>(1);
  const [customQuantities, setCustomQuantities] = useState<Record<string, number>>({});

  // PRN Template & Hardware Printer Settings
  const [templates] = useState<LabelTemplate[]>(DEFAULT_LABEL_TEMPLATES);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(DEFAULT_LABEL_TEMPLATES[0].id);
  const [printers] = useState<PrinterProfile[]>(DEFAULT_PRINTER_PROFILES);
  const [selectedPrinterId, setSelectedPrinterId] = useState<string>(DEFAULT_PRINTER_PROFILES[0].id);
  const [customPrnScript, setCustomPrnScript] = useState<string>("");
  const [isEditingPrnScript, setIsEditingPrnScript] = useState<boolean>(false);
  const [showPrnCodeInspector, setShowPrnCodeInspector] = useState<boolean>(false);

  // Unique attribute filter options extracted from items
  const categories = useMemo(() => Array.from(new Set(items.map(i => i.category).filter(Boolean))), [items]);
  const brands = useMemo(() => Array.from(new Set(items.map(i => i.brand).filter(Boolean))), [items]);
  const vendors = useMemo(() => Array.from(new Set(items.map(i => i.vendor).filter(Boolean))), [items]);
  const warehouses = useMemo(() => Array.from(new Set(items.map(i => i.warehouse).filter(Boolean))), [items]);

  // Active Template definition
  const activeTemplate = useMemo(() => {
    return templates.find(t => t.id === selectedTemplateId) || templates[0];
  }, [templates, selectedTemplateId]);

  // Active Printer profile
  const activePrinter = useMemo(() => {
    return printers.find(p => p.id === selectedPrinterId) || printers[0];
  }, [printers, selectedPrinterId]);

  // Filter items based on multi-attribute criteria
  const filteredItems = useMemo(() => {
    return items.filter(item => {
      // 1. Search Query Filter
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const matches = 
          item.name.toLowerCase().includes(query) ||
          item.barcode.toLowerCase().includes(query) ||
          item.sku.toLowerCase().includes(query) ||
          (item.item_code && item.item_code.toLowerCase().includes(query)) ||
          (item.batch_no && item.batch_no.toLowerCase().includes(query));
        if (!matches) return false;
      }

      // 2. Attribute Filters
      if (categoryFilter && item.category !== categoryFilter) return false;
      if (brandFilter && item.brand !== brandFilter) return false;
      if (vendorFilter && item.vendor !== vendorFilter) return false;
      if (warehouseFilter && item.warehouse !== warehouseFilter) return false;

      // 3. Stock Status Filter
      if (stockStatusFilter) {
        const qty = item.stock_qty || 0;
        if (stockStatusFilter === "in_stock" && qty <= 0) return false;
        if (stockStatusFilter === "low_stock" && (qty <= 0 || qty >= 10)) return false;
        if (stockStatusFilter === "out_of_stock" && qty > 0) return false;
      }

      // 4. Range Boundary Filter
      if (rangeFromSku.trim() || rangeToSku.trim()) {
        const skuUpper = item.sku.toUpperCase();
        if (rangeFromSku.trim() && skuUpper < rangeFromSku.trim().toUpperCase()) return false;
        if (rangeToSku.trim() && skuUpper > rangeToSku.trim().toUpperCase()) return false;
      }

      return true;
    });
  }, [items, searchTerm, categoryFilter, brandFilter, vendorFilter, warehouseFilter, stockStatusFilter, rangeFromSku, rangeToSku]);

  // Target records to print based on selection mode
  const targetItemsToPrint = useMemo(() => {
    if (selectionMode === "selected_only") {
      return filteredItems.filter(i => selectedIds.has(i.id));
    }
    return filteredItems; // all_filtered, range_boundary, search_results
  }, [filteredItems, selectedIds, selectionMode]);

  // Total label copies computation across target items
  const totalLabelsToPrint = useMemo(() => {
    return targetItemsToPrint.reduce((sum, item) => {
      const customQty = customQuantities[item.id];
      const copies = customQty !== undefined ? customQty : computeLabelCopies(item, quantitySource, fixedCopies);
      return sum + copies;
    }, 0);
  }, [targetItemsToPrint, quantitySource, fixedCopies, customQuantities]);

  // Toggle selection for all filtered items
  const handleToggleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(filteredItems.map(i => i.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  // Dispatch Universal Batch Print Job
  const handleDispatchPrint = () => {
    if (targetItemsToPrint.length === 0) {
      if (onNotification) onNotification("Selection Empty", "No items selected to print.", "error");
      return;
    }

    const scriptToUse = isEditingPrnScript && customPrnScript.trim() ? customPrnScript : activeTemplate.prnScript;

    // Render ZPL payload for target items
    const zplPayload = targetItemsToPrint.map(item => {
      const customQty = customQuantities[item.id];
      const copies = customQty !== undefined ? customQty : computeLabelCopies(item, quantitySource, fixedCopies);
      return renderPRNScript(scriptToUse, item, copies);
    }).join("\n");

    const batchJob = {
      id: `UNIVERSAL-JOB-${Date.now()}`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      source: `Universal Label Engine (${moduleSource})`,
      template: activeTemplate.name,
      totalLabels: totalLabelsToPrint,
      itemsCount: targetItemsToPrint.length,
      status: "Completed",
      protocol: activePrinter.protocol,
      items: targetItemsToPrint.map(item => ({
        sku: item.sku,
        barcode: item.barcode,
        copies: customQuantities[item.id] !== undefined ? customQuantities[item.id] : computeLabelCopies(item, quantitySource, fixedCopies)
      })),
      zplPayload
    };

    // Save job to LocalStorage Reprint Queue
    const existing = localStorage.getItem("smriti_barcode_reprint_queue");
    const queueList = existing ? JSON.parse(existing) : [];
    localStorage.setItem("smriti_barcode_reprint_queue", JSON.stringify([batchJob, ...queueList.slice(0, 19)]));

    if (onNotification) {
      onNotification(
        "Batch Print Dispatched", 
        `Sent ${totalLabelsToPrint} labels across ${targetItemsToPrint.length} records to ${activePrinter.name} (${activePrinter.protocol}).`, 
        "success"
      );
    }
    onClose();
  };

  // First sample item for live visual preview
  const samplePreviewItem = targetItemsToPrint[0] || items[0] || {
    id: "sample-1",
    item_code: "BBM-0001",
    barcode: "8901234560015",
    sku: "BBM-0001-6-BLK",
    name: "Mens Casual Footwear (Black / 6)",
    price: 899,
    mrp: 1199,
    category: "Footwear",
    brand: "SMRITI"
  };

  const samplePreviewTokens = extractLabelTokens(samplePreviewItem, 1);
  const samplePrnRender = renderPRNScript(
    isEditingPrnScript && customPrnScript.trim() ? customPrnScript : activeTemplate.prnScript, 
    samplePreviewItem, 
    1
  );

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150 font-mono text-xs">
      <div className="bg-[#12151e] border border-indigo-500/40 w-full max-w-5xl rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
        
        {/* Header Bar */}
        <div className="px-6 py-4 bg-[#191d2b] border-b border-indigo-500/20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
              <Printer size={20} />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span>SMRITI Universal Label Printing Engine</span>
                <span className="px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-[10px]">
                  {moduleSource}
                </span>
              </h3>
              <p className="text-[11px] text-slate-400">Print barcodes & PRN tags directly across all modules without opening individual transactions.</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition">
            <X size={18} />
          </button>
        </div>

        {/* Workspace Grid Layout */}
        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Left 2 Columns: Selection Controls & 9-Column Item Table */}
          <div className="lg:col-span-2 space-y-4">
            
            {/* Top Toolbar Controls */}
            <div className="bg-[#191d2b] p-4 rounded-2xl border border-slate-800 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                
                {/* Search Input */}
                <div className="relative flex-1 min-w-[200px]">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    placeholder="Search SKU, Barcode, Item Name, Batch..."
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white outline-none focus:border-indigo-500"
                  />
                </div>

                {/* Selection Mode Selector */}
                <select
                  value={selectionMode}
                  onChange={e => setSelectionMode(e.target.value as any)}
                  className="bg-slate-900 border border-slate-700 text-white text-xs rounded-xl px-3 py-1.5 outline-none focus:border-indigo-500 font-bold"
                >
                  <option value="selected_only">Print Selected Records ({targetItemsToPrint.length})</option>
                  <option value="all_filtered">Print All Filtered Records ({filteredItems.length})</option>
                  <option value="range_boundary">Print Range Boundary</option>
                  <option value="search_results">Print Search Results</option>
                </select>

                {/* Filter Drawer Toggle */}
                <button
                  onClick={() => setShowFilterDrawer(!showFilterDrawer)}
                  className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition ${
                    showFilterDrawer ? "bg-indigo-600 border-indigo-400 text-white" : "bg-slate-900 border-slate-700 text-slate-300 hover:text-white"
                  }`}
                >
                  <SlidersHorizontal size={14} /> Filter Attributes
                </button>
              </div>

              {/* Collapsible Multi-Attribute Filter Drawer */}
              {showFilterDrawer && (
                <div className="pt-3 border-t border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-3 text-[11px] animate-in fade-in duration-150">
                  <div>
                    <label className="text-slate-400 block mb-1">Category</label>
                    <select
                      value={categoryFilter}
                      onChange={e => setCategoryFilter(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg px-2 py-1 outline-none"
                    >
                      <option value="">All Categories</option>
                      {categories.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1">Brand</label>
                    <select
                      value={brandFilter}
                      onChange={e => setBrandFilter(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg px-2 py-1 outline-none"
                    >
                      <option value="">All Brands</option>
                      {brands.map(b => <option key={b} value={b}>{b}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1">Warehouse</label>
                    <select
                      value={warehouseFilter}
                      onChange={e => setWarehouseFilter(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg px-2 py-1 outline-none"
                    >
                      <option value="">All Warehouses</option>
                      {warehouses.map(w => <option key={w} value={w}>{w}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1">Stock Status</label>
                    <select
                      value={stockStatusFilter}
                      onChange={e => setStockStatusFilter(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg px-2 py-1 outline-none"
                    >
                      <option value="">All Stock Levels</option>
                      <option value="in_stock">In Stock (&gt; 0)</option>
                      <option value="low_stock">Low Stock (1-9)</option>
                      <option value="out_of_stock">Out of Stock (0)</option>
                    </select>
                  </div>
                </div>
              )}

              {/* Range Boundary Controls */}
              {selectionMode === "range_boundary" && (
                <div className="pt-3 border-t border-slate-800 flex items-center gap-3">
                  <span className="text-indigo-400 font-bold text-xs">SKU Range Boundary:</span>
                  <input
                    type="text"
                    value={rangeFromSku}
                    onChange={e => setRangeFromSku(e.target.value)}
                    placeholder="From SKU (e.g. BBM-0001)"
                    className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1 text-xs text-white outline-none"
                  />
                  <span className="text-slate-500">to</span>
                  <input
                    type="text"
                    value={rangeToSku}
                    onChange={e => setRangeToSku(e.target.value)}
                    placeholder="To SKU (e.g. BBM-0020)"
                    className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1 text-xs text-white outline-none"
                  />
                </div>
              )}
            </div>

            {/* 9-Column Item Selection Table */}
            <div className="bg-[#191d2b] border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
              <div className="px-4 py-2.5 bg-slate-900 border-b border-slate-800 flex items-center justify-between text-xs">
                <span className="font-bold text-white">Records ({targetItemsToPrint.length} Items Selected)</span>
                <span className="text-emerald-400 font-bold">Total Label Output: {totalLabelsToPrint} Copies</span>
              </div>

              <div className="max-h-80 overflow-y-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="bg-slate-950 text-[10px] uppercase text-slate-400 font-bold sticky top-0 border-b border-slate-800">
                    <tr>
                      <th className="px-3 py-2 text-center">
                        <input
                          type="checkbox"
                          checked={selectedIds.size === filteredItems.length && filteredItems.length > 0}
                          onChange={e => handleToggleSelectAll(e.target.checked)}
                          className="rounded bg-slate-900 border-slate-700"
                        />
                      </th>
                      <th className="px-3 py-2">SKU Code</th>
                      <th className="px-3 py-2">Barcode</th>
                      <th className="px-3 py-2">Item Description</th>
                      <th className="px-3 py-2 text-right">Rates (Sell/MRP)</th>
                      <th className="px-3 py-2 text-right">Stock</th>
                      <th className="px-3 py-2 text-right w-20">Copies</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {filteredItems.map(item => {
                      const isChecked = selectedIds.has(item.id);
                      const copies = customQuantities[item.id] !== undefined ? customQuantities[item.id] : computeLabelCopies(item, quantitySource, fixedCopies);

                      return (
                        <tr key={item.id} className={`hover:bg-slate-800/40 ${isChecked ? "bg-indigo-950/20" : "opacity-50"}`}>
                          <td className="px-3 py-2 text-center">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={e => {
                                const next = new Set(selectedIds);
                                if (e.target.checked) next.add(item.id);
                                else next.delete(item.id);
                                setSelectedIds(next);
                              }}
                              className="rounded bg-slate-900 border-slate-700"
                            />
                          </td>
                          <td className="px-3 py-2 font-bold text-amber-300">{item.sku}</td>
                          <td className="px-3 py-2 font-bold text-indigo-300">{item.barcode}</td>
                          <td className="px-3 py-2 text-white truncate max-w-xs">{item.name}</td>
                          <td className="px-3 py-2 text-right">
                            <strong className="text-emerald-400">₹{item.price || 0}</strong> / <span className="text-slate-400">₹{item.mrp || item.price || 0}</span>
                          </td>
                          <td className="px-3 py-2 text-right text-slate-300">{item.stock_qty || 0}</td>
                          <td className="px-3 py-2 text-right">
                            <input
                              type="number"
                              min="1"
                              value={copies}
                              onChange={e => setCustomQuantities({ ...customQuantities, [item.id]: parseInt(e.target.value) || 1 })}
                              className="w-16 text-right bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white font-bold outline-none focus:border-indigo-500"
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Right Column: Template Selector, Quantity Rules & Hardware Engine */}
          <div className="space-y-4">
            
            {/* Template & PRN Selector */}
            <div className="bg-[#191d2b] p-4 rounded-2xl border border-slate-800 space-y-3">
              <span className="text-[10px] text-indigo-400 uppercase font-bold block">1. Label Template & PRN Script</span>
              <select
                value={selectedTemplateId}
                onChange={e => setSelectedTemplateId(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs font-mono outline-none focus:border-indigo-500"
              >
                {templates.map(t => (
                  <option key={t.id} value={t.id}>{t.name} ({t.dimensions})</option>
                ))}
              </select>

              <div className="flex items-center justify-between text-[11px] pt-1">
                <button 
                  onClick={() => setShowPrnCodeInspector(!showPrnCodeInspector)} 
                  className="text-indigo-400 hover:underline font-bold flex items-center gap-1"
                >
                  <FileCode size={13} /> {showPrnCodeInspector ? "Hide ZPL PRN Script" : "View ZPL PRN Script"}
                </button>
              </div>

              {showPrnCodeInspector && (
                <div className="space-y-2 pt-2 animate-in fade-in duration-150">
                  <textarea
                    value={isEditingPrnScript ? customPrnScript : activeTemplate.prnScript}
                    onChange={e => {
                      setIsEditingPrnScript(true);
                      setCustomPrnScript(e.target.value);
                    }}
                    rows={6}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-[10px] font-mono text-emerald-400 outline-none"
                  />
                  {isEditingPrnScript && (
                    <button onClick={() => setIsEditingPrnScript(false)} className="text-[10px] text-slate-400 hover:underline">Reset to Default Script</button>
                  )}
                </div>
              )}
            </div>

            {/* Quantity Source Engine */}
            <div className="bg-[#191d2b] p-4 rounded-2xl border border-slate-800 space-y-3">
              <span className="text-[10px] text-indigo-400 uppercase font-bold block">2. Label Quantity Source</span>
              
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <button
                  onClick={() => setQuantitySource("fixed")}
                  className={`p-2 rounded-xl border text-left font-bold transition ${quantitySource === "fixed" ? "bg-indigo-600 border-indigo-400 text-white" : "bg-slate-900 border-slate-800 text-slate-400"}`}
                >
                  Fixed Copies
                </button>
                <button
                  onClick={() => setQuantitySource("stock")}
                  className={`p-2 rounded-xl border text-left font-bold transition ${quantitySource === "stock" ? "bg-indigo-600 border-indigo-400 text-white" : "bg-slate-900 border-slate-800 text-slate-400"}`}
                >
                  Stock On-Hand
                </button>
                <button
                  onClick={() => setQuantitySource("received")}
                  className={`p-2 rounded-xl border text-left font-bold transition ${quantitySource === "received" ? "bg-indigo-600 border-indigo-400 text-white" : "bg-slate-900 border-slate-800 text-slate-400"}`}
                >
                  Received (GRN/PO)
                </button>
                <button
                  onClick={() => setQuantitySource("sold")}
                  className={`p-2 rounded-xl border text-left font-bold transition ${quantitySource === "sold" ? "bg-indigo-600 border-indigo-400 text-white" : "bg-slate-900 border-slate-800 text-slate-400"}`}
                >
                  Sold (POS Sales)
                </button>
              </div>

              {quantitySource === "fixed" && (
                <div className="flex items-center gap-2 pt-1">
                  <span className="text-slate-400 text-[11px]">Copies per Item:</span>
                  <input
                    type="number"
                    min="1"
                    value={fixedCopies}
                    onChange={e => setFixedCopies(parseInt(e.target.value) || 1)}
                    className="w-20 bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-white font-bold outline-none text-right"
                  />
                </div>
              )}
            </div>

            {/* Hardware Printer Selection */}
            <div className="bg-[#191d2b] p-4 rounded-2xl border border-slate-800 space-y-3">
              <span className="text-[10px] text-indigo-400 uppercase font-bold block">3. Target Hardware Printer</span>
              <select
                value={selectedPrinterId}
                onChange={e => setSelectedPrinterId(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs font-mono outline-none focus:border-indigo-500"
              >
                {printers.map(p => (
                  <option key={p.id} value={p.id}>{p.name} ({p.address})</option>
                ))}
              </select>
            </div>

            {/* Live Visual Label Preview Box */}
            <div className="bg-[#191d2b] p-4 rounded-2xl border border-slate-800 space-y-2">
              <span className="text-[10px] text-slate-400 uppercase font-bold block flex items-center justify-between">
                <span>Live Sample Tag Preview</span>
                <Eye size={12} className="text-indigo-400" />
              </span>
              
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex items-center justify-center min-h-[140px]">
                <div className="max-w-[55mm]">
                  <BarcodeLabel data={{ items: [{ name: samplePreviewItem.name, rate: samplePreviewItem.price || 0, barcode: samplePreviewItem.barcode }] }} />
                </div>
              </div>
            </div>

          </div>

        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-[#191d2b] border-t border-indigo-500/20 flex items-center justify-between">
          <div className="text-xs text-slate-400">
            Dispatches PRN payload to <strong className="text-indigo-300">{activePrinter.name}</strong>
          </div>

          <div className="flex items-center gap-3">
            <button onClick={onClose} className="px-4 py-2 bg-slate-800 text-slate-300 text-xs rounded-xl hover:bg-slate-700 transition">
              Cancel
            </button>
            <button
              onClick={handleDispatchPrint}
              disabled={targetItemsToPrint.length === 0}
              className="px-6 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-xs rounded-xl shadow-lg flex items-center gap-2 transition"
            >
              <Printer size={16} /> Dispatch Print ({totalLabelsToPrint} Labels)
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
