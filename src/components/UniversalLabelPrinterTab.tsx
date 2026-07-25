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
 * * Version    : 3.33.0 (Universal SMRITI Label Printing Engine Dedicated Workspace Page)
 * * Created    : 2026-07-25
 * * Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
 * * License    : Proprietary Commercial Software
 */

import React, { useState, useMemo } from "react";
import { 
  Printer, Plus, Trash2, Search, Filter, Sparkles, FileCode, CheckCircle2, 
  Layers, SlidersHorizontal, Tag, Eye, RefreshCw, Copy, Check, ChevronLeft, 
  ChevronRight, Download, Package, DollarSign, Settings, Hash, Cpu, ArrowUpRight
} from "lucide-react";
import { 
  UniversalLabelItem, QuantitySource, LabelTemplate, PrinterProfile, 
  DEFAULT_LABEL_TEMPLATES, DEFAULT_PRINTER_PROFILES, 
  extractLabelTokens, renderPRNScript, computeLabelCopies 
} from "../services/universalLabelPrinterService.ts";
import { Product } from "../types.ts";

export interface UniversalLabelPrinterTabProps {
  products?: Product[];
  onRefreshProducts?: () => Promise<void>;
  onNotification?: (title: string, message: string, type: "success" | "error") => void;
  currentUser?: any;
}

export const UniversalLabelPrinterTab: React.FC<UniversalLabelPrinterTabProps> = ({
  products = [],
  onRefreshProducts,
  onNotification,
  currentUser
}) => {
  // Convert standard products into UniversalLabelItems
  const initialItems: UniversalLabelItem[] = useMemo(() => {
    if (products.length > 0) {
      return products.map(p => ({
        id: p.id,
        item_code: p.code || p.sku || "ITEM-001",
        barcode: p.barcode || "8901234560000",
        sku: p.sku || p.code || "SKU-001",
        name: p.name,
        category: p.category || "General",
        brand: p.brand || "SMRITI",
        price: p.price,
        cost_price: p.costPrice || (p as any).cost_price || 0,
        mrp: p.mrp || p.price,
        stock_qty: p.stock ?? (p as any).stock_qty ?? 10,
        received_qty: p.stock ?? (p as any).stock_qty ?? 10,
        sold_qty: 0,
        style_code: p.code || p.sku,
        label_copies: 1
      }));
    }
    // Demo fallback list if no products passed
    return [
      { id: "lbl-1", item_code: "DRS-BLU-M", barcode: "8901234560012", sku: "DRS-BLU-M", name: "Floral Summer Denim Dress (Blue, M)", category: "Apparel", brand: "SMRITI LUXE", price: 1499, mrp: 2999, stock_qty: 15, received_qty: 20, sold_qty: 5, style_code: "DRS-BLU", label_copies: 2 },
      { id: "lbl-2", item_code: "SH-LEATH-42", barcode: "8901234560029", sku: "SH-LEATH-42", name: "Executive Oxford Leather Shoes (Size 42)", category: "Footwear", brand: "AITDL CRAFT", price: 3499, mrp: 5999, stock_qty: 8, received_qty: 10, sold_qty: 2, style_code: "SH-LEATH", label_copies: 1 },
      { id: "lbl-3", item_code: "JW-RNG-GLD", barcode: "8901234560036", sku: "JW-RNG-GLD", name: "22K Gold Filigree Ring (4.2g)", category: "Jewelry", brand: "ROYAL SMRITI", price: 28500, mrp: 31000, stock_qty: 3, received_qty: 3, sold_qty: 0, style_code: "JW-RNG", label_copies: 1 },
      { id: "lbl-4", item_code: "ELE-PODS-PRO", barcode: "8901234560043", sku: "ELE-PODS-PRO", name: "Pro Wireless ANC Earbuds (Black)", category: "Electronics", brand: "AITDL TECH", price: 2499, mrp: 4999, stock_qty: 45, received_qty: 50, sold_qty: 5, style_code: "ELE-PODS", label_copies: 3 },
    ];
  }, [products]);

  // Master State
  const [itemList, setItemList] = useState<UniversalLabelItem[]>(initialItems);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set(initialItems.map(i => i.id)));
  const [quantitySource, setQuantitySource] = useState<QuantitySource>("custom");
  const [fixedCopiesValue, setFixedCopiesValue] = useState<number>(1);
  
  // Active Filter & Search State
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [selectedBrand, setSelectedBrand] = useState("ALL");
  
  // Printer Engine & Layout Configuration
  const [activeTemplate, setActiveTemplate] = useState<LabelTemplate>(DEFAULT_LABEL_TEMPLATES[0]);
  const [activePrinter, setActivePrinter] = useState<PrinterProfile>(DEFAULT_PRINTER_PROFILES[0]);
  const [barcodeType, setBarcodeType] = useState<"code128" | "ean13" | "qrcode">("code128");
  
  // Toggle Options
  const [showMrp, setShowMrp] = useState(true);
  const [showPrice, setShowPrice] = useState(true);
  const [showBrand, setShowBrand] = useState(true);
  const [showCategory, setShowCategory] = useState(true);
  const [showBatchInfo, setShowBatchInfo] = useState(false);
  
  // Preview Pagination
  const [previewIndex, setPreviewIndex] = useState(0);
  const [copiedPrn, setCopiedPrn] = useState(false);
  
  // Add Custom Item Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [newItem, setNewItem] = useState({
    item_code: "",
    name: "",
    barcode: "",
    sku: "",
    price: "",
    mrp: "",
    category: "General",
    brand: "SMRITI",
    label_copies: 1
  });

  // Extract Categories & Brands
  const categories = useMemo(() => {
    const set = new Set<string>();
    itemList.forEach(i => { if (i.category) set.add(i.category); });
    return ["ALL", ...Array.from(set)];
  }, [itemList]);

  const brands = useMemo(() => {
    const set = new Set<string>();
    itemList.forEach(i => { if (i.brand) set.add(i.brand); });
    return ["ALL", ...Array.from(set)];
  }, [itemList]);

  // Filtered List
  const filteredItems = useMemo(() => {
    return itemList.filter(item => {
      const matchSearch = 
        !searchTerm ||
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.item_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.barcode.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.sku && item.sku.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchCat = selectedCategory === "ALL" || item.category === selectedCategory;
      const matchBrand = selectedBrand === "ALL" || item.brand === selectedBrand;
      return matchSearch && matchCat && matchBrand;
    });
  }, [itemList, searchTerm, selectedCategory, selectedBrand]);

  // Selected Batch Items
  const selectedItems = useMemo(() => {
    return itemList.filter(item => selectedIds.has(item.id));
  }, [itemList, selectedIds]);

  // Total Copies Calculation
  const totalCopiesCalculated = useMemo(() => {
    return selectedItems.reduce((acc, item) => {
      return acc + computeLabelCopies(item, quantitySource, fixedCopiesValue);
    }, 0);
  }, [selectedItems, quantitySource, fixedCopiesValue]);

  // Active Preview Item
  const activePreviewItem = useMemo(() => {
    if (selectedItems.length === 0) return null;
    const idx = Math.min(previewIndex, selectedItems.length - 1);
    return selectedItems[idx] || selectedItems[0];
  }, [selectedItems, previewIndex]);

  // Active Rendered PRN Script
  const activePRNScript = useMemo(() => {
    if (!activePreviewItem) return "";
    const qty = computeLabelCopies(activePreviewItem, quantitySource, fixedCopiesValue);
    return renderPRNScript(activeTemplate.prnScript, activePreviewItem, qty);
  }, [activePreviewItem, activeTemplate, quantitySource, fixedCopiesValue]);

  // Selection Handlers
  const toggleSelectAll = () => {
    if (selectedIds.size === filteredItems.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredItems.map(i => i.id)));
    }
  };

  const toggleSelectItem = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const updateItemCopies = (id: string, delta: number) => {
    setItemList(prev => prev.map(item => {
      if (item.id === id) {
        const cur = item.label_copies || 1;
        return { ...item, label_copies: Math.max(1, cur + delta) };
      }
      return item;
    }));
  };

  const handleAddCustomItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItem.name.trim()) return;
    const item: UniversalLabelItem = {
      id: `custom-${Date.now()}`,
      item_code: newItem.item_code.trim() || `ITEM-${Math.floor(1000 + Math.random() * 9000)}`,
      name: newItem.name.trim(),
      barcode: newItem.barcode.trim() || `890${Math.floor(100000000 + Math.random() * 900000000)}`,
      sku: newItem.sku.trim() || newItem.item_code.trim() || `SKU-${Math.floor(100 + Math.random() * 900)}`,
      price: parseFloat(newItem.price) || 999,
      mrp: parseFloat(newItem.mrp) || 1999,
      category: newItem.category || "General",
      brand: newItem.brand || "SMRITI",
      stock_qty: 10,
      received_qty: 10,
      sold_qty: 0,
      label_copies: Number(newItem.label_copies) || 1
    };
    setItemList(prev => [item, ...prev]);
    setSelectedIds(prev => new Set(prev).add(item.id));
    setShowAddModal(false);
    setNewItem({ item_code: "", name: "", barcode: "", sku: "", price: "", mrp: "", category: "General", brand: "SMRITI", label_copies: 1 });
    if (onNotification) onNotification("Item Added", `Added '${item.name}' to label printing queue`, "success");
  };

  const handleCopyPRN = () => {
    navigator.clipboard.writeText(activePRNScript);
    setCopiedPrn(true);
    setTimeout(() => setCopiedPrn(false), 2000);
    if (onNotification) onNotification("PRN Script Copied", "Raw thermal printer command script copied to clipboard", "success");
  };

  const handleExecutePrint = () => {
    if (selectedItems.length === 0) {
      if (onNotification) onNotification("No Items Selected", "Please select at least 1 item to generate label print batch", "error");
      return;
    }
    
    // In browser environment, trigger window.print() with printable dynamic container
    window.print();
    if (onNotification) onNotification("Print Job Sent", `Dispatched ${totalCopiesCalculated} label tags across ${selectedItems.length} items to ${activePrinter.name}`, "success");
  };

  return (
    <div className="min-h-screen bg-[#0d0f17] text-slate-100 p-4 md:p-6 font-sans">
      {/* ── Header Toolbar Banner ────────────────────────────────────────────────── */}
      <div className="bg-[#141724] border border-amber-500/30 rounded-2xl p-5 mb-6 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-amber-500/10 to-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="p-2.5 bg-gradient-to-br from-amber-500 to-indigo-600 rounded-xl shadow-lg text-white">
                <Printer size={24} />
              </div>
              <div>
                <h1 className="text-xl font-black tracking-tight text-white flex items-center gap-2 font-display">
                  SMRITI Universal Label Printing Engine
                  <span className="text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full border border-amber-500/40">
                    v3.33.0 ENTERPRISE
                  </span>
                </h1>
                <p className="text-xs text-slate-400 font-mono">
                  Thermal Barcode, QR Code & Sticker Sheet High-DPI Direct Batch Operations Engine
                </p>
              </div>
            </div>
          </div>

          {/* Quick Metrics & Actions */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="bg-[#0b0d14] px-3.5 py-2 rounded-xl border border-slate-800 text-right">
              <span className="text-[9px] font-mono uppercase text-slate-500 block">Queue Selection</span>
              <span className="text-sm font-mono font-bold text-amber-400">{selectedItems.length} / {itemList.length} Items</span>
            </div>

            <div className="bg-[#0b0d14] px-3.5 py-2 rounded-xl border border-slate-800 text-right">
              <span className="text-[9px] font-mono uppercase text-slate-500 block">Total Printed Copies</span>
              <span className="text-sm font-mono font-bold text-indigo-400">{totalCopiesCalculated} Tags</span>
            </div>

            <button 
              onClick={() => setShowAddModal(true)}
              className="px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono font-semibold rounded-xl border border-slate-700/60 transition-all flex items-center gap-2"
            >
              <Plus size={15} />
              <span>Add Custom Item</span>
            </button>

            <button 
              onClick={handleExecutePrint}
              className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-indigo-600 hover:from-amber-400 hover:to-indigo-500 text-white text-xs font-bold font-mono rounded-xl shadow-lg hover:shadow-amber-500/20 transition-all flex items-center gap-2"
            >
              <Printer size={16} />
              <span>Execute Print Batch</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── Main Operations Grid ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* ── Left Column: Data Grid & Queue (Col Span 7) ──────────────────────── */}
        <div className="lg:col-span-7 space-y-4">
          
          {/* Controls & Filter Bar */}
          <div className="bg-[#141724] border border-slate-800 rounded-2xl p-4 space-y-3 shadow-xl">
            <div className="flex flex-col sm:flex-row items-center gap-3">
              {/* Search */}
              <div className="relative flex-1 w-full">
                <Search size={15} className="absolute left-3 top-2.5 text-slate-500" />
                <input 
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search Item Code, Barcode, SKU, Name..."
                  className="w-full bg-[#0b0d14] border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-amber-500/50 font-mono"
                />
              </div>

              {/* Category Filter */}
              <select 
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full sm:w-36 bg-[#0b0d14] border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-300 font-mono focus:outline-none focus:border-amber-500/50"
              >
                {categories.map(cat => (
                  <option key={cat} value={cat}>Cat: {cat}</option>
                ))}
              </select>

              {/* Brand Filter */}
              <select 
                value={selectedBrand}
                onChange={(e) => setSelectedBrand(e.target.value)}
                className="w-full sm:w-36 bg-[#0b0d14] border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-300 font-mono focus:outline-none focus:border-amber-500/50"
              >
                {brands.map(b => (
                  <option key={b} value={b}>Brand: {b}</option>
                ))}
              </select>
            </div>

            {/* Quantity Strategy Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800/60">
              <div className="flex items-center gap-2">
                <SlidersHorizontal size={14} className="text-amber-400" />
                <span className="text-[11px] font-mono text-slate-400 font-semibold">Qty Calculation Strategy:</span>
                <select 
                  value={quantitySource}
                  onChange={(e) => setQuantitySource(e.target.value as QuantitySource)}
                  className="bg-[#0b0d14] border border-amber-500/30 rounded-lg px-2.5 py-1 text-xs text-amber-300 font-mono font-bold focus:outline-none"
                >
                  <option value="custom">Manual Custom Copies</option>
                  <option value="fixed">Fixed 1 Tag per Item</option>
                  <option value="stock">Current Stock Qty</option>
                  <option value="received">Received Batch Qty</option>
                  <option value="sold">Sold Sales Qty</option>
                </select>
              </div>

              {/* Selection Actions */}
              <div className="flex items-center gap-2">
                <button 
                  onClick={toggleSelectAll}
                  className="text-[10px] font-mono text-indigo-400 hover:text-indigo-300 bg-indigo-950/40 px-2.5 py-1 rounded-lg border border-indigo-800/40 transition-colors"
                >
                  {selectedIds.size === filteredItems.length ? "Deselect All" : "Select All"} ({filteredItems.length})
                </button>
              </div>
            </div>
          </div>

          {/* Items Batch Table */}
          <div className="bg-[#141724] border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="max-h-[560px] overflow-y-auto">
              <table className="w-full text-left text-xs font-mono border-collapse">
                <thead className="sticky top-0 z-10 bg-[#0b0d14] border-b border-slate-800 text-slate-400 text-[10px] uppercase tracking-wider">
                  <tr>
                    <th className="p-3 w-10 text-center">
                      <input 
                        type="checkbox" 
                        checked={selectedIds.size > 0 && selectedIds.size === filteredItems.length}
                        onChange={toggleSelectAll}
                        className="rounded border-slate-700 accent-amber-500"
                      />
                    </th>
                    <th className="p-3">Product Details</th>
                    <th className="p-3">Identifiers</th>
                    <th className="p-3 text-right">Price / MRP</th>
                    <th className="p-3 text-center">Calculated Copies</th>
                    <th className="p-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300">
                  {filteredItems.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-slate-500 font-mono">
                        No items found matching active search filter.
                      </td>
                    </tr>
                  ) : (
                    filteredItems.map(item => {
                      const isSelected = selectedIds.has(item.id);
                      const copies = computeLabelCopies(item, quantitySource, fixedCopiesValue);
                      return (
                        <tr 
                          key={item.id}
                          className={`transition-colors ${isSelected ? "bg-amber-950/20 hover:bg-amber-900/30" : "hover:bg-slate-800/40"}`}
                        >
                          <td className="p-3 text-center">
                            <input 
                              type="checkbox" 
                              checked={isSelected}
                              onChange={() => toggleSelectItem(item.id)}
                              className="rounded border-slate-700 accent-amber-500"
                            />
                          </td>
                          <td className="p-3">
                            <div className="font-bold text-white max-w-xs truncate">{item.name}</div>
                            <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-400">
                              <span className="bg-slate-800 px-1.5 py-0.2 rounded text-slate-300">{item.category}</span>
                              <span className="bg-indigo-950 text-indigo-300 px-1.5 py-0.2 rounded border border-indigo-800/30">{item.brand}</span>
                            </div>
                          </td>
                          <td className="p-3 font-mono text-[11px]">
                            <div className="text-amber-400 font-semibold">{item.item_code}</div>
                            <div className="text-slate-500 text-[10px]">{item.barcode}</div>
                          </td>
                          <td className="p-3 text-right font-mono">
                            <div className="font-bold text-emerald-400">₹{item.price?.toLocaleString()}</div>
                            {item.mrp && <div className="text-[10px] text-slate-500 line-through">₹{item.mrp?.toLocaleString()}</div>}
                          </td>
                          <td className="p-3 text-center">
                            {quantitySource === "custom" ? (
                              <div className="inline-flex items-center border border-slate-700 bg-[#0b0d14] rounded-lg">
                                <button 
                                  onClick={() => updateItemCopies(item.id, -1)}
                                  className="px-2 py-0.5 text-slate-400 hover:text-white"
                                >-</button>
                                <span className="px-2 py-0.5 font-bold text-amber-400 text-xs">{item.label_copies || 1}</span>
                                <button 
                                  onClick={() => updateItemCopies(item.id, 1)}
                                  className="px-2 py-0.5 text-slate-400 hover:text-white"
                                >+</button>
                              </div>
                            ) : (
                              <span className="px-2.5 py-1 bg-amber-950/60 border border-amber-500/40 text-amber-300 font-bold rounded-lg text-xs">
                                {copies} Copies
                              </span>
                            )}
                          </td>
                          <td className="p-3 text-center">
                            <button 
                              onClick={() => {
                                const idx = selectedItems.findIndex(i => i.id === item.id);
                                if (idx >= 0) setPreviewIndex(idx);
                              }}
                              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg"
                              title="Preview Tag"
                            >
                              <Eye size={14} />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* ── Right Column: Engine Config & Live Preview (Col Span 5) ───────────── */}
        <div className="lg:col-span-5 space-y-4">
          
          {/* Printer & Layout Config Card */}
          <div className="bg-[#141724] border border-slate-800 rounded-2xl p-5 space-y-4 shadow-xl">
            <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
              <Settings size={18} className="text-amber-400" />
              <h3 className="text-sm font-bold font-display text-white">Hardware & Template Profile</h3>
            </div>

            {/* Template Dropdown */}
            <div>
              <label className="text-[10px] font-mono text-slate-400 uppercase block mb-1">Label Layout Template</label>
              <select 
                value={activeTemplate.id}
                onChange={(e) => {
                  const found = DEFAULT_LABEL_TEMPLATES.find(t => t.id === e.target.value);
                  if (found) setActiveTemplate(found);
                }}
                className="w-full bg-[#0b0d14] border border-slate-800 rounded-xl px-3 py-2 text-xs text-amber-300 font-mono font-bold focus:outline-none focus:border-amber-500/50"
              >
                {DEFAULT_LABEL_TEMPLATES.map(tpl => (
                  <option key={tpl.id} value={tpl.id}>{tpl.name} ({tpl.dimensions})</option>
                ))}
              </select>
            </div>

            {/* Printer Profile */}
            <div>
              <label className="text-[10px] font-mono text-slate-400 uppercase block mb-1">Target Printer Hardware Profile</label>
              <select 
                value={activePrinter.id}
                onChange={(e) => {
                  const found = DEFAULT_PRINTER_PROFILES.find(p => p.id === e.target.value);
                  if (found) setActivePrinter(found);
                }}
                className="w-full bg-[#0b0d14] border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 font-mono focus:outline-none focus:border-amber-500/50"
              >
                {DEFAULT_PRINTER_PROFILES.map(prn => (
                  <option key={prn.id} value={prn.id}>{prn.name} ({prn.protocol})</option>
                ))}
              </select>
            </div>

            {/* Display Field Toggles */}
            <div>
              <label className="text-[10px] font-mono text-slate-400 uppercase block mb-2">Display Tokens on Tag</label>
              <div className="grid grid-cols-2 gap-2 text-xs font-mono text-slate-300">
                <label className="flex items-center gap-2 bg-[#0b0d14] px-2.5 py-1.5 rounded-lg border border-slate-800 cursor-pointer">
                  <input type="checkbox" checked={showPrice} onChange={(e) => setShowPrice(e.target.checked)} className="accent-amber-500" />
                  <span>Selling Price</span>
                </label>
                <label className="flex items-center gap-2 bg-[#0b0d14] px-2.5 py-1.5 rounded-lg border border-slate-800 cursor-pointer">
                  <input type="checkbox" checked={showMrp} onChange={(e) => setShowMrp(e.target.checked)} className="accent-amber-500" />
                  <span>M.R.P. Tag</span>
                </label>
                <label className="flex items-center gap-2 bg-[#0b0d14] px-2.5 py-1.5 rounded-lg border border-slate-800 cursor-pointer">
                  <input type="checkbox" checked={showBrand} onChange={(e) => setShowBrand(e.target.checked)} className="accent-amber-500" />
                  <span>Brand Name</span>
                </label>
                <label className="flex items-center gap-2 bg-[#0b0d14] px-2.5 py-1.5 rounded-lg border border-slate-800 cursor-pointer">
                  <input type="checkbox" checked={showCategory} onChange={(e) => setShowCategory(e.target.checked)} className="accent-amber-500" />
                  <span>Category Tag</span>
                </label>
              </div>
            </div>
          </div>

          {/* Interactive Live 2D Label Preview Card */}
          <div className="bg-[#141724] border border-amber-500/30 rounded-2xl p-5 space-y-4 shadow-2xl relative overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Eye size={18} className="text-amber-400" />
                <h3 className="text-sm font-bold font-display text-white">Live 2D Barcode Tag Preview</h3>
              </div>

              {selectedItems.length > 0 && (
                <div className="flex items-center gap-1.5 text-xs font-mono">
                  <button 
                    onClick={() => setPreviewIndex(prev => Math.max(0, prev - 1))}
                    disabled={previewIndex === 0}
                    className="p-1 text-slate-400 hover:text-white disabled:opacity-30"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <span className="text-amber-300 font-bold">{previewIndex + 1} / {selectedItems.length}</span>
                  <button 
                    onClick={() => setPreviewIndex(prev => Math.min(selectedItems.length - 1, prev + 1))}
                    disabled={previewIndex >= selectedItems.length - 1}
                    className="p-1 text-slate-400 hover:text-white disabled:opacity-30"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              )}
            </div>

            {/* Live Tag Render Container */}
            <div className="bg-[#08090e] p-6 rounded-xl border border-slate-800 flex items-center justify-center min-h-[220px]">
              {activePreviewItem ? (
                <div className="bg-white text-black p-3 rounded shadow-2xl w-[220px] box-border space-y-1 font-sans text-center border-2 border-slate-950">
                  <div className="flex justify-between items-center text-[9px] font-bold border-b border-slate-200 pb-1">
                    <span className="uppercase text-slate-700">{showBrand ? (activePreviewItem.brand || "SMRITI") : "SMRITI"}</span>
                    {showPrice && <span className="text-black font-extrabold">₹{activePreviewItem.price?.toLocaleString()}</span>}
                  </div>
                  
                  <div className="text-[10px] font-bold text-slate-900 leading-tight py-0.5 truncate">
                    {activePreviewItem.name}
                  </div>

                  {/* Barcode Lines Graphic */}
                  <div className="py-1">
                    <div className="h-9 bg-slate-950 w-full rounded-sm flex items-center justify-center p-1">
                      <div className="w-full h-full bg-repeating-linear-stripes" style={{
                        backgroundImage: "linear-gradient(90deg, #fff 0px, #fff 2px, #000 2px, #000 5px, #fff 5px, #fff 7px, #000 7px, #000 11px)"
                      }} />
                    </div>
                    <div className="text-[9px] font-mono font-bold tracking-widest text-slate-900 mt-0.5">
                      {activePreviewItem.barcode}
                    </div>
                  </div>

                  <div className="flex justify-between items-center text-[8px] text-slate-600 border-t border-slate-200 pt-1 font-mono">
                    <span>CODE: {activePreviewItem.item_code}</span>
                    {showMrp && activePreviewItem.mrp && <span>MRP: ₹{activePreviewItem.mrp}</span>}
                  </div>
                </div>
              ) : (
                <div className="text-center text-slate-500 font-mono text-xs">
                  No items selected in print queue.
                </div>
              )}
            </div>

            {/* RAW PRN Script Collapsible / Export Box */}
            <div className="bg-[#0b0d14] rounded-xl p-3 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono uppercase text-slate-400 font-semibold flex items-center gap-1.5">
                  <FileCode size={13} className="text-amber-400" />
                  RAW Hardware PRN / ZPL Output Script
                </span>
                <button 
                  onClick={handleCopyPRN}
                  className="text-[10px] font-mono text-amber-400 hover:text-amber-300 flex items-center gap-1 bg-amber-950/40 px-2 py-0.5 rounded border border-amber-800/40"
                >
                  {copiedPrn ? <Check size={12} /> : <Copy size={12} />}
                  <span>{copiedPrn ? "Copied" : "Copy PRN"}</span>
                </button>
              </div>

              <pre className="text-[10px] font-mono text-amber-300/90 bg-[#06070a] p-2.5 rounded-lg border border-slate-800 overflow-x-auto max-h-32">
                {activePRNScript || "; Select an item to preview PRN"}
              </pre>
            </div>
          </div>

        </div>

      </div>

      {/* ── Add Custom Item Modal ──────────────────────────────────────────────── */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#141724] border border-amber-500/30 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl font-mono text-xs">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white font-display flex items-center gap-2">
                <Plus size={16} className="text-amber-400" />
                Add Custom Label Batch Entry
              </h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleAddCustomItem} className="space-y-3">
              <div>
                <label className="text-slate-400 block mb-1 text-[10px]">Product Name *</label>
                <input 
                  type="text"
                  required
                  value={newItem.name}
                  onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                  placeholder="e.g. Silk Printed Dupatta"
                  className="w-full bg-[#0b0d14] border border-slate-800 rounded-xl px-3 py-1.5 text-slate-200 focus:outline-none focus:border-amber-500/50"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1 text-[10px]">Item Code</label>
                  <input 
                    type="text"
                    value={newItem.item_code}
                    onChange={(e) => setNewItem({ ...newItem, item_code: e.target.value })}
                    placeholder="e.g. DUP-001"
                    className="w-full bg-[#0b0d14] border border-slate-800 rounded-xl px-3 py-1.5 text-slate-200 focus:outline-none focus:border-amber-500/50"
                  />
                </div>

                <div>
                  <label className="text-slate-400 block mb-1 text-[10px]">Barcode Number</label>
                  <input 
                    type="text"
                    value={newItem.barcode}
                    onChange={(e) => setNewItem({ ...newItem, barcode: e.target.value })}
                    placeholder="8901234567890"
                    className="w-full bg-[#0b0d14] border border-slate-800 rounded-xl px-3 py-1.5 text-slate-200 focus:outline-none focus:border-amber-500/50"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1 text-[10px]">Selling Price (₹)</label>
                  <input 
                    type="number"
                    value={newItem.price}
                    onChange={(e) => setNewItem({ ...newItem, price: e.target.value })}
                    placeholder="999"
                    className="w-full bg-[#0b0d14] border border-slate-800 rounded-xl px-3 py-1.5 text-slate-200 focus:outline-none focus:border-amber-500/50"
                  />
                </div>

                <div>
                  <label className="text-slate-400 block mb-1 text-[10px]">MRP (₹)</label>
                  <input 
                    type="number"
                    value={newItem.mrp}
                    onChange={(e) => setNewItem({ ...newItem, mrp: e.target.value })}
                    placeholder="1999"
                    className="w-full bg-[#0b0d14] border border-slate-800 rounded-xl px-3 py-1.5 text-slate-200 focus:outline-none focus:border-amber-500/50"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1 text-[10px]">Category</label>
                  <input 
                    type="text"
                    value={newItem.category}
                    onChange={(e) => setNewItem({ ...newItem, category: e.target.value })}
                    className="w-full bg-[#0b0d14] border border-slate-800 rounded-xl px-3 py-1.5 text-slate-200 focus:outline-none focus:border-amber-500/50"
                  />
                </div>

                <div>
                  <label className="text-slate-400 block mb-1 text-[10px]">Initial Copies</label>
                  <input 
                    type="number"
                    min="1"
                    value={newItem.label_copies}
                    onChange={(e) => setNewItem({ ...newItem, label_copies: Number(e.target.value) })}
                    className="w-full bg-[#0b0d14] border border-slate-800 rounded-xl px-3 py-1.5 text-slate-200 focus:outline-none focus:border-amber-500/50"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button 
                  type="button" 
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="px-5 py-2 bg-gradient-to-r from-amber-500 to-indigo-600 hover:from-amber-400 hover:to-indigo-500 text-white font-bold rounded-xl text-xs shadow-lg"
                >
                  Add to Batch Queue
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default UniversalLabelPrinterTab;
