/**
 * Project      : SMRITI Business OS
 * Component    : UniversalLabelPrintingStudio (Rule SLP-001)
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * License      : Proprietary Commercial Software
 * Classification: SMRITI Platform Studio (SAP Fiori Object Page Pattern)
 */

import React, { useState, useMemo } from "react";
import { 
  Printer, Search, Download, Copy, Check, Filter, Layers, Grid, 
  RefreshCw, Barcode, History, FileCode, Settings, ExternalLink, 
  Play, Plus, Trash2, Sliders, CheckCircle2, AlertCircle, Clock, ChevronRight, X
} from "lucide-react";
import { Product } from "../../types.js";
import { DEFAULT_PRN_TEMPLATES, PRNTemplate, PRNVariableEngine } from "../../services/label_print/PRNVariableEngine.ts";
import { PrintProviderRegistry, PrintProviderType } from "../../services/label_print/PrintProviderFramework.ts";
import { PrintHistoryService, PrintHistoryEntry } from "../../services/label_print/PrintHistoryService.ts";
import { WindowManager } from "../../sdk/WindowManager.ts";

export interface UniversalLabelPrintingStudioProps {
  products: Product[];
  onNotification?: (title: string, message: string, type?: "success" | "error") => void;
}

export const UniversalLabelPrintingStudio: React.FC<UniversalLabelPrintingStudioProps> = ({
  products,
  onNotification,
}) => {
  // State variables
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [selectedBrand, setSelectedBrand] = useState<string>("ALL");
  const [mrpMin, setMrpMin] = useState<string>("");
  const [mrpMax, setMrpMax] = useState<string>("");

  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set());
  const [itemCopies, setItemCopies] = useState<Record<string, number>>({});
  const [copiesMode, setCopiesMode] = useState<"fixed" | "stock">("fixed");
  const [fixedCopies, setFixedCopies] = useState<number>(1);

  // Apparel/Footwear Size Allocation Pivot Matrix State
  const [pivotArticle, setPivotArticle] = useState<string>("");
  const [pivotColor, setPivotColor] = useState<string>("");
  const [pivotQuantities, setPivotQuantities] = useState<Record<string, number>>({});

  // Printer & Template configuration
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("tspl-standard-50x25");
  const [providerType, setProviderType] = useState<PrintProviderType>("prn");
  const [activeTab, setActiveTab] = useState<"items" | "pivot" | "preview" | "script" | "history" | "templates">("items");
  const [copied, setCopied] = useState<boolean>(false);
  const [printHistory, setPrintHistory] = useState<PrintHistoryEntry[]>(() => PrintHistoryService.getHistory());

  // Filter products by Universal Lookup
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchSearch =
        !searchTerm ||
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.code && p.code.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (p.barcode && p.barcode.toLowerCase().includes(searchTerm.toLowerCase())) ||
        ((p as any).articleNo && (p as any).articleNo.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (p.brand && p.brand.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchCat = selectedCategory === "ALL" || p.category === selectedCategory;
      const matchBrand = selectedBrand === "ALL" || p.brand === selectedBrand;

      const price = p.mrp || p.price || 0;
      const matchMin = !mrpMin || price >= parseFloat(mrpMin);
      const matchMax = !mrpMax || price <= parseFloat(mrpMax);

      return matchSearch && matchCat && matchBrand && matchMin && matchMax;
    });
  }, [products, searchTerm, selectedCategory, selectedBrand, mrpMin, mrpMax]);

  // Selected Items List
  const selectedItemsList = useMemo(() => {
    if (selectedProductIds.size === 0) return filteredProducts.slice(0, 15);
    return products.filter((p) => selectedProductIds.has(p.id));
  }, [products, filteredProducts, selectedProductIds]);

  // Total Labels Count
  const totalLabelsCount = useMemo(() => {
    return selectedItemsList.reduce((acc, p) => {
      const customQty = itemCopies[p.id];
      if (customQty !== undefined) return acc + customQty;
      return acc + (copiesMode === "stock" ? Math.max(1, p.stock || 1) : fixedCopies);
    }, 0);
  }, [selectedItemsList, itemCopies, copiesMode, fixedCopies]);

  // Selected Template Object
  const activeTemplate = useMemo(() => {
    return DEFAULT_PRN_TEMPLATES.find((t) => t.id === selectedTemplateId) || DEFAULT_PRN_TEMPLATES[0];
  }, [selectedTemplateId]);

  // Generated Raw PRN Script
  const compiledPRNScript = useMemo(() => {
    return selectedItemsList
      .map((product) => {
        const copies = itemCopies[product.id] !== undefined 
          ? itemCopies[product.id] 
          : copiesMode === "stock" ? Math.max(1, product.stock || 1) : fixedCopies;
        return PRNVariableEngine.renderTemplate(activeTemplate, product, copies);
      })
      .join("\n\n");
  }, [selectedItemsList, itemCopies, copiesMode, fixedCopies, activeTemplate]);

  // Unique Base Articles for Pivot Matrix
  const baseArticles = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      if ((p as any).articleNo) set.add((p as any).articleNo);
      else if (p.code) set.add(p.code);
    });
    return Array.from(set);
  }, [products]);

  // Available colors for selected base article
  const availableColors = useMemo(() => {
    if (!pivotArticle) return [];
    const set = new Set<string>();
    products
      .filter((p) => (p as any).articleNo === pivotArticle || p.code === pivotArticle)
      .forEach((p) => {
        if (p.color) set.add(p.color);
      });
    return Array.from(set);
  }, [products, pivotArticle]);

  // Variant size allocation list for selected article & color
  const matrixVariants = useMemo(() => {
    if (!pivotArticle || !pivotColor) return [];
    return products.filter(
      (p) => ((p as any).articleNo === pivotArticle || p.code === pivotArticle) && p.color === pivotColor
    );
  }, [products, pivotArticle, pivotColor]);

  // Handlers
  const handleToggleSelectAll = () => {
    if (selectedProductIds.size === filteredProducts.length) {
      setSelectedProductIds(new Set());
    } else {
      setSelectedProductIds(new Set(filteredProducts.map((p) => p.id)));
    }
  };

  const handleToggleSelectItem = (id: string) => {
    const next = new Set(selectedProductIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedProductIds(next);
  };

  const handleAddMatrixItemsToSelection = () => {
    const nextSelected = new Set(selectedProductIds);
    const nextCopies = { ...itemCopies };

    matrixVariants.forEach((v) => {
      const qty = pivotQuantities[v.id] || 0;
      if (qty > 0) {
        nextSelected.add(v.id);
        nextCopies[v.id] = qty;
      }
    });

    setSelectedProductIds(nextSelected);
    setItemCopies(nextCopies);
    if (onNotification) {
      onNotification("Matrix Selection Added", `Added size variants to label print selection.`, "success");
    }
    setActiveTab("items");
  };

  const handleExecutePrintJob = async () => {
    const provider = PrintProviderRegistry.getProvider(providerType);
    const result = await provider.sendJob({
      jobId: `JOB-${Date.now().toString().slice(-6)}`,
      printerName: provider.name,
      templateName: activeTemplate.name,
      script: compiledPRNScript,
      totalLabels: totalLabelsCount,
      items: selectedItemsList.map((p) => ({
        name: p.name,
        copies: itemCopies[p.id] || (copiesMode === "stock" ? Math.max(1, p.stock || 1) : fixedCopies),
      })),
    });

    // Record Audit & History
    const entry = PrintHistoryService.addEntry({
      user: "super",
      printer: provider.name,
      provider: provider.name,
      template: activeTemplate.name,
      sourceDoc: selectedProductIds.size > 0 ? "Universal Selection" : "Filtered Master",
      itemsCount: selectedItemsList.length,
      totalLabels: totalLabelsCount,
      status: result.success ? "Completed" : "Failed",
      errorMessage: result.error,
    });

    setPrintHistory(PrintHistoryService.getHistory());

    if (result.success && onNotification) {
      onNotification("Print Job Executed", `Job ${entry.jobId} sent via ${provider.name} (${totalLabelsCount} labels).`, "success");
    } else if (!result.success && onNotification) {
      onNotification("Print Error", result.error || "Failed to execute print job.", "error");
    }
  };

  const handleCopyScript = () => {
    navigator.clipboard.writeText(compiledPRNScript);
    setCopied(true);
    if (onNotification) onNotification("PRN Script Copied", "Raw PRN script copied to clipboard.", "success");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="w-full bg-[#0B0F17] border border-theme-divider rounded-2xl overflow-hidden shadow-2xl animate-in fade-in duration-200 text-theme-body font-sans flex flex-col max-h-[92vh]">
      {/* 1. SAP Fiori Sticky Object Header */}
      <div className="bg-[#121824] border-b border-theme-divider px-6 py-4 space-y-3 shrink-0">
        {/* Breadcrumb Trail */}
        <div className="flex items-center gap-2 text-[11px] text-theme-muted font-mono">
          <span>Platform Services</span>
          <ChevronRight size={12} />
          <span>Label Printing</span>
          <ChevronRight size={12} />
          <span className="text-indigo-400 font-bold">Universal Label Printing Studio (SLPS v4.0)</span>
        </div>

        {/* Header Title & Actions */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-950/80 border border-indigo-500/40 rounded-xl text-indigo-400 shadow-md">
              <Printer size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold font-display text-theme-heading">SMRITI Universal Label Printing Studio</h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-950/80 text-emerald-400 border border-emerald-500/30">
                  SLP-001 Active
                </span>
              </div>
              <p className="text-xs text-theme-muted mt-0.5">
                Single Label Printing Application • Multi-Provider Framework (ZPL/TSPL) • Size Matrix Pivot
              </p>
            </div>
          </div>

          {/* Header KPI Micro-Cards & Standalone Popout */}
          <div className="flex items-center gap-3">
            <div className="bg-theme-surface-2 px-3 py-1.5 rounded-xl border border-theme-divider text-right">
              <span className="text-[10px] text-theme-muted uppercase font-mono block">Items Selected</span>
              <span className="text-xs font-bold font-mono text-theme-heading">{selectedItemsList.length} Articles</span>
            </div>
            <div className="bg-indigo-950/40 px-4 py-1.5 rounded-xl border border-indigo-500/40 text-right">
              <span className="text-[10px] text-indigo-300 uppercase font-mono block">Total Labels</span>
              <span className="text-sm font-bold font-mono text-indigo-300">{totalLabelsCount} Labels</span>
            </div>

            {/* STWS-001 Standalone Popout Action */}
            <button
              type="button"
              onClick={() => {
                WindowManager.openTransaction({
                  transactionType: "SalesInvoice",
                  mode: "standalone",
                  subView: "label-print",
                });
              }}
              className="px-3 py-2 bg-indigo-600/30 hover:bg-indigo-600/50 border border-indigo-500/50 text-indigo-300 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-md"
              title="Open in Dedicated Standalone Window (STWS-001 Standard)"
            >
              <ExternalLink size={14} />
              <span>Popout Window</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Scrollable Object Page Body */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Universal Lookup & Range Filter Bar */}
        <div className="p-4 rounded-2xl bg-theme-surface-1 border border-theme-divider space-y-3">
          <div className="flex items-center justify-between border-b border-theme-divider pb-2">
            <span className="text-xs font-bold text-theme-heading flex items-center gap-1.5">
              <Search size={14} className="text-indigo-400" />
              <span>Universal Lookup & Cross-Entity Search (SLP-006)</span>
            </span>
            <span className="text-[10px] font-mono text-theme-muted">{filteredProducts.length} Results Found</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 text-xs">
            <div className="sm:col-span-4">
              <label className="text-[10px] font-mono text-theme-muted block mb-1">SEARCH ITEM / BARCODE / ARTICLE / BRAND / GRN</label>
              <div className="relative">
                <Search size={14} className="absolute left-3 top-2.5 text-theme-muted" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="e.g. Nike Air, 8901234567, ART-2026..."
                  className="w-full bg-theme-surface-2 border border-theme-divider rounded-xl pl-9 pr-3 py-2 text-xs text-theme-body focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div className="sm:col-span-2">
              <label className="text-[10px] font-mono text-theme-muted block mb-1">CATEGORY</label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full bg-theme-surface-2 border border-theme-divider rounded-xl px-3 py-2 text-xs text-theme-body"
              >
                <option value="ALL">All Categories</option>
                {Array.from(new Set(products.map((p) => p.category).filter(Boolean))).map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="text-[10px] font-mono text-theme-muted block mb-1">BRAND</label>
              <select
                value={selectedBrand}
                onChange={(e) => setSelectedBrand(e.target.value)}
                className="w-full bg-theme-surface-2 border border-theme-divider rounded-xl px-3 py-2 text-xs text-theme-body"
              >
                <option value="ALL">All Brands</option>
                {Array.from(new Set(products.map((p) => p.brand).filter(Boolean))).map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="text-[10px] font-mono text-theme-muted block mb-1">MIN MRP (₹)</label>
              <input
                type="number"
                value={mrpMin}
                onChange={(e) => setMrpMin(e.target.value)}
                placeholder="0"
                className="w-full bg-theme-surface-2 border border-theme-divider rounded-xl px-3 py-2 text-xs text-theme-body font-mono"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="text-[10px] font-mono text-theme-muted block mb-1">MAX MRP (₹)</label>
              <input
                type="number"
                value={mrpMax}
                onChange={(e) => setMrpMax(e.target.value)}
                placeholder="99999"
                className="w-full bg-theme-surface-2 border border-theme-divider rounded-xl px-3 py-2 text-xs text-theme-body font-mono"
              />
            </div>
          </div>
        </div>

        {/* 3. SAP Fiori Studio Tabs Suite */}
        <div className="space-y-4">
          <div className="flex border-b border-theme-divider bg-theme-surface-1 px-4 rounded-t-2xl">
            {[
              { id: "items", label: "Master Items Grid", icon: Layers, badge: selectedItemsList.length },
              { id: "pivot", label: "Apparel/Size Pivot Matrix", icon: Grid },
              { id: "preview", label: "Label Canvas Preview", icon: Barcode },
              { id: "script", label: "Raw PRN Code Engine", icon: FileCode },
              { id: "history", label: "Print History & Audit", icon: History, badge: printHistory.length },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`px-5 py-3 text-xs font-bold font-display flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
                    isActive
                      ? "border-indigo-500 text-indigo-400 bg-indigo-950/20"
                      : "border-transparent text-theme-muted hover:text-theme-heading hover:bg-theme-surface-hover"
                  }`}
                >
                  <Icon size={15} />
                  <span>{tab.label}</span>
                  {tab.badge !== undefined && (
                    <span className="px-1.5 py-0.2 rounded-full bg-theme-surface-2 border border-theme-divider font-mono text-[10px]">
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* TAB 1: MASTER ITEMS GRID */}
          {activeTab === "items" && (
            <div className="bg-theme-surface-1 border border-theme-divider rounded-2xl overflow-hidden space-y-3 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-theme-divider pb-3">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleToggleSelectAll}
                    className="px-3 py-1.5 bg-theme-surface-2 border border-theme-divider rounded-xl text-xs font-semibold hover:bg-theme-surface-hover cursor-pointer"
                  >
                    {selectedProductIds.size === filteredProducts.length ? "Deselect All" : "Select All Filtered"}
                  </button>
                  <span className="text-xs text-theme-muted">
                    {selectedProductIds.size} of {filteredProducts.length} items checked
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-xs text-theme-muted">Copies Mode:</span>
                  <button
                    type="button"
                    onClick={() => setCopiesMode("fixed")}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold border transition ${
                      copiesMode === "fixed" ? "bg-indigo-600 border-indigo-500 text-white" : "bg-theme-surface-2 border-theme-divider text-theme-muted"
                    }`}
                  >
                    Fixed ({fixedCopies})
                  </button>
                  <button
                    type="button"
                    onClick={() => setCopiesMode("stock")}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold border transition ${
                      copiesMode === "stock" ? "bg-indigo-600 border-indigo-500 text-white" : "bg-theme-surface-2 border-theme-divider text-theme-muted"
                    }`}
                  >
                    One Per Stock
                  </button>
                </div>
              </div>

              {/* Data Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-theme-surface-2 text-theme-muted uppercase font-mono text-[9px] border-b border-theme-divider">
                      <th className="px-4 py-3 text-center">Select</th>
                      <th className="px-4 py-3">Item / Article Name</th>
                      <th className="px-4 py-3">SKU Code</th>
                      <th className="px-4 py-3">Barcode</th>
                      <th className="px-4 py-3">Color / Size</th>
                      <th className="px-4 py-3 text-right">MRP (₹)</th>
                      <th className="px-4 py-3 text-right">Price (₹)</th>
                      <th className="px-4 py-3 text-right">Stock</th>
                      <th className="px-4 py-3 text-right">Print Copies</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-theme-divider/60">
                    {filteredProducts.map((p) => {
                      const isChecked = selectedProductIds.has(p.id);
                      const currentCopies = itemCopies[p.id] !== undefined
                        ? itemCopies[p.id]
                        : copiesMode === "stock" ? Math.max(1, p.stock || 1) : fixedCopies;

                      return (
                        <tr key={p.id} className={`hover:bg-theme-surface-hover transition-colors ${isChecked ? "bg-indigo-950/20" : ""}`}>
                          <td className="px-4 py-3 text-center">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => handleToggleSelectItem(p.id)}
                              className="rounded border-theme-divider bg-theme-surface-2 accent-indigo-500 h-4 w-4"
                            />
                          </td>
                          <td className="px-4 py-3 font-semibold text-theme-heading">{p.name}</td>
                          <td className="px-4 py-3 font-mono text-theme-muted">{p.code || "N/A"}</td>
                          <td className="px-4 py-3 font-mono text-indigo-400 font-bold">{p.barcode || p.code || "123456789"}</td>
                          <td className="px-4 py-3 font-mono text-theme-muted">{p.color || "N/A"} / {p.size || "OS"}</td>
                          <td className="px-4 py-3 font-mono text-right text-theme-muted">₹{(p.mrp || p.price || 0).toLocaleString("en-IN")}</td>
                          <td className="px-4 py-3 font-mono text-right font-bold text-emerald-400">₹{(p.price || 0).toLocaleString("en-IN")}</td>
                          <td className="px-4 py-3 font-mono text-right text-theme-muted">{p.stock || 0}</td>
                          <td className="px-4 py-3 text-right">
                            <input
                              type="number"
                              min="1"
                              value={currentCopies}
                              onChange={(e) => {
                                const val = Math.max(1, parseInt(e.target.value) || 1);
                                setItemCopies({ ...itemCopies, [p.id]: val });
                              }}
                              className="w-16 text-center bg-theme-surface-2 border border-theme-divider rounded-lg py-1 text-xs text-theme-body font-mono"
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 2: APPAREL / SIZE PIVOT MATRIX */}
          {activeTab === "pivot" && (
            <div className="p-5 rounded-2xl bg-theme-surface-1 border border-theme-divider space-y-4">
              <h3 className="font-bold text-sm text-theme-heading flex items-center gap-2">
                <Grid size={16} className="text-indigo-400" />
                <span>Footwear & Apparel Variant Size Allocator Grid (Pivot Mode)</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-mono text-theme-muted block mb-1">SELECT BASE ARTICLE</label>
                  <select
                    value={pivotArticle}
                    onChange={(e) => {
                      setPivotArticle(e.target.value);
                      setPivotColor("");
                      setPivotQuantities({});
                    }}
                    className="w-full bg-theme-surface-2 border border-theme-divider rounded-xl px-3 py-2 text-xs text-theme-body"
                  >
                    <option value="">-- Choose Base Article --</option>
                    {baseArticles.map((art) => (
                      <option key={art} value={art}>{art}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-mono text-theme-muted block mb-1">SELECT COLOR</label>
                  <select
                    value={pivotColor}
                    onChange={(e) => {
                      setPivotColor(e.target.value);
                      setPivotQuantities({});
                    }}
                    disabled={!pivotArticle}
                    className="w-full bg-theme-surface-2 border border-theme-divider rounded-xl px-3 py-2 text-xs text-theme-body disabled:opacity-50"
                  >
                    <option value="">-- Choose Color --</option>
                    {availableColors.map((col) => (
                      <option key={col} value={col}>{col}</option>
                    ))}
                  </select>
                </div>
              </div>

              {pivotArticle && pivotColor && (
                <div className="space-y-4 pt-2 border-t border-theme-divider/50">
                  <div className="bg-theme-surface-2 p-4 rounded-xl border border-theme-divider">
                    <h4 className="text-[10px] font-mono text-indigo-400 uppercase tracking-wider mb-3">SIZE ALLOCATION COPIES MATRIX</h4>
                    <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-3">
                      {matrixVariants.map((v) => (
                        <div key={v.id} className="bg-theme-surface-1 p-3 rounded-xl border border-theme-divider flex flex-col items-center">
                          <span className="text-[10px] font-mono text-theme-muted">Size {v.size || "OS"}</span>
                          <span className="text-xs font-bold text-theme-heading mt-0.5">₹{v.price}</span>
                          <span className="text-[9px] text-emerald-400 mt-0.5">Stock: {v.stock}</span>
                          <input
                            type="number"
                            min="0"
                            value={pivotQuantities[v.id] || ""}
                            placeholder="0"
                            onChange={(e) => {
                              const val = Math.max(0, parseInt(e.target.value) || 0);
                              setPivotQuantities({ ...pivotQuantities, [v.id]: val });
                            }}
                            className="w-full text-center bg-theme-surface-2 border border-theme-divider rounded-lg mt-2 py-1 text-xs text-theme-body font-mono"
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={handleAddMatrixItemsToSelection}
                      className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition shadow-md cursor-pointer"
                    >
                      Add Matrix Quantities to Print Job
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: VISUAL LABEL PREVIEW */}
          {activeTab === "preview" && (
            <div className="p-6 rounded-2xl bg-theme-surface-1 border border-theme-divider space-y-4">
              <h3 className="font-bold text-sm text-theme-heading">Label Visual Canvas Preview (50x25mm)</h3>
              <div className="flex justify-center p-8 bg-[#05080E] rounded-xl border border-theme-divider">
                <div className="w-[320px] h-[160px] bg-white text-black p-4 rounded shadow-2xl font-sans flex flex-col justify-between border-2 border-dashed border-gray-400">
                  <div className="flex justify-between items-start">
                    <span className="font-bold text-xs leading-tight">
                      {selectedItemsList[0]?.name || "Sample Article"}
                    </span>
                    <span className="font-mono text-[10px] bg-black text-white px-1.5 py-0.5 rounded">
                      ₹{selectedItemsList[0]?.price || 999}
                    </span>
                  </div>
                  <div className="text-[10px] text-gray-700 font-mono">
                    SKU: {selectedItemsList[0]?.code || "SMR-1001"} | MRP: ₹{selectedItemsList[0]?.mrp || 1299}
                  </div>
                  <div className="my-1 flex flex-col items-center">
                    <div className="w-full h-8 bg-black flex items-center justify-between px-2 text-white font-mono text-[8px]">
                      ||| | |||| | ||| |||| | ||| |||| | |||
                    </div>
                    <span className="font-mono text-[10px] tracking-widest mt-0.5">
                      {selectedItemsList[0]?.barcode || "890123456789"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: RAW PRN SCRIPT ENGINE */}
          {activeTab === "script" && (
            <div className="p-5 rounded-2xl bg-theme-surface-1 border border-theme-divider space-y-3 font-mono text-xs">
              <div className="flex items-center justify-between">
                <span className="text-theme-heading font-bold">Compiled Printer Command Script ({activeTemplate.language})</span>
                <button
                  type="button"
                  onClick={handleCopyScript}
                  className="px-3 py-1 bg-theme-surface-2 border border-theme-divider hover:bg-theme-surface-hover text-theme-body rounded-lg transition flex items-center gap-1.5"
                >
                  {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                  <span>{copied ? "Copied!" : "Copy Script"}</span>
                </button>
              </div>
              <textarea
                readOnly
                value={compiledPRNScript}
                rows={12}
                className="w-full bg-[#05080E] text-emerald-400 p-4 rounded-xl font-mono text-xs border border-theme-divider outline-none"
              />
            </div>
          )}

          {/* TAB 5: PRINT HISTORY */}
          {activeTab === "history" && (
            <div className="p-5 rounded-2xl bg-theme-surface-1 border border-theme-divider space-y-3">
              <h3 className="font-bold text-sm text-theme-heading">Print History & Job Audit Log (SLP-002)</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-theme-surface-2 text-theme-muted uppercase font-mono text-[9px] border-b border-theme-divider">
                      <th className="px-4 py-3">Job ID</th>
                      <th className="px-4 py-3">Timestamp</th>
                      <th className="px-4 py-3">Operator</th>
                      <th className="px-4 py-3">Printer / Provider</th>
                      <th className="px-4 py-3">Template</th>
                      <th className="px-4 py-3 text-right">Labels</th>
                      <th className="px-4 py-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-theme-divider/60">
                    {printHistory.map((job) => (
                      <tr key={job.jobId} className="hover:bg-theme-surface-hover transition-colors">
                        <td className="px-4 py-3 font-mono font-bold text-indigo-400">{job.jobId}</td>
                        <td className="px-4 py-3 font-mono text-theme-muted">{new Date(job.timestamp).toLocaleString()}</td>
                        <td className="px-4 py-3 text-theme-heading font-semibold">{job.user}</td>
                        <td className="px-4 py-3 font-mono text-theme-muted">{job.printer}</td>
                        <td className="px-4 py-3 text-theme-body">{job.template}</td>
                        <td className="px-4 py-3 font-mono text-right font-bold text-emerald-400">{job.totalLabels}</td>
                        <td className="px-4 py-3 text-center">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase ${
                              job.status === "Completed"
                                ? "bg-emerald-950/80 text-emerald-400 border border-emerald-500/30"
                                : "bg-rose-950/80 text-rose-400 border border-rose-500/30"
                            }`}
                          >
                            {job.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 4. SAP Fiori Sticky Footer Toolbar */}
      <div className="bg-[#121824] border-t border-theme-divider px-6 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4 text-xs">
          <div>
            <span className="text-theme-muted">Template: </span>
            <select
              value={selectedTemplateId}
              onChange={(e) => setSelectedTemplateId(e.target.value)}
              className="bg-theme-surface-2 border border-theme-divider rounded-lg px-2.5 py-1 text-xs text-theme-body"
            >
              {DEFAULT_PRN_TEMPLATES.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>

          <div>
            <span className="text-theme-muted">Print Provider: </span>
            <select
              value={providerType}
              onChange={(e) => setProviderType(e.target.value as PrintProviderType)}
              className="bg-theme-surface-2 border border-theme-divider rounded-lg px-2.5 py-1 text-xs text-theme-body font-mono"
            >
              <option value="prn">PRN File Download</option>
              <option value="browser">Browser Native Print</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleExecutePrintJob}
            className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl shadow-lg transition flex items-center gap-2 cursor-pointer"
          >
            <Printer size={15} />
            <span>Execute Print Job ({totalLabelsCount} Labels)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
