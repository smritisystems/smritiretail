/**
 * Project      : SMRITI Business OS
 * Component    : SalesTaxInvoiceFioriObjectPage (SAP Fiori Object Page Refactoring)
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * License      : Proprietary Commercial Software
 * Classification: SMRITI Design System (SAP Fiori Object Page Pattern)
 */

import React, { useState } from "react";
import { 
  X, 
  Save, 
  CheckCircle2, 
  AlertTriangle, 
  FileText, 
  User, 
  Building2, 
  Calendar, 
  CreditCard, 
  Truck, 
  Layers, 
  Grid, 
  Plus, 
  Trash2, 
  Printer, 
  Share2, 
  ShieldCheck, 
  Clock, 
  Info,
  Check,
  ChevronRight,
  FileSpreadsheet,
  ExternalLink
} from "lucide-react";
import { Customer, Product } from "../../types";

export interface SalesTaxInvoiceFioriObjectPageProps {
  // Existing Business Logic & State Props
  customers: Customer[];
  products: Product[];
  invoiceCustomerId: string;
  setInvoiceCustomerId: (id: string) => void;
  invoiceIsInterstate: boolean;
  setInvoiceIsInterstate: (val: boolean) => void;
  invoiceEWayBill: string;
  setInvoiceEWayBill: (val: string) => void;
  invoiceStatus: "Draft" | "Submitted" | "Approved" | "Cancelled";
  setInvoiceStatus: (status: any) => void;
  entryMode: "manual" | "matrix";
  setEntryMode: (mode: "manual" | "matrix") => void;
  selectedProduct: string;
  setSelectedProduct: (id: string) => void;
  manualQty: number;
  setManualQty: (qty: number) => void;
  manualTax: number;
  setManualTax: (tax: number) => void;
  handleAddManualItem: () => void;
  selectedBaseArticle: string;
  setSelectedBaseArticle: (art: string) => void;
  baseArticles: string[];
  selectedBaseColor: string;
  setSelectedBaseColor: (col: string) => void;
  availableColors: string[];
  matrixVariants: Product[];
  matrixQuantities: Record<string, number>;
  setMatrixQuantities: (q: Record<string, number>) => void;
  handleAddMatrixItems: () => void;
  invoiceItems: any[];
  setInvoiceItems: (items: any[]) => void;
  invoiceTotals: {
    taxable: number;
    cgst: number;
    sgst: number;
    igst: number;
    grandTotal: number;
  };
  handleCreateInvoiceSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
}

export const SalesTaxInvoiceFioriObjectPage: React.FC<SalesTaxInvoiceFioriObjectPageProps> = ({
  customers,
  products,
  invoiceCustomerId,
  setInvoiceCustomerId,
  invoiceIsInterstate,
  setInvoiceIsInterstate,
  invoiceEWayBill,
  setInvoiceEWayBill,
  invoiceStatus,
  setInvoiceStatus,
  entryMode,
  setEntryMode,
  selectedProduct,
  setSelectedProduct,
  manualQty,
  setManualQty,
  manualTax,
  setManualTax,
  handleAddManualItem,
  selectedBaseArticle,
  setSelectedBaseArticle,
  baseArticles,
  selectedBaseColor,
  setSelectedBaseColor,
  availableColors,
  matrixVariants,
  matrixQuantities,
  setMatrixQuantities,
  handleAddMatrixItems,
  invoiceItems,
  setInvoiceItems,
  invoiceTotals,
  handleCreateInvoiceSubmit,
  onCancel,
}) => {
  const [activeTab, setActiveTab] = useState<"items" | "tax" | "customer" | "audit">("items");

  const selectedCustomer = customers.find((c) => c.id === invoiceCustomerId);
  const totalItemsQty = invoiceItems.reduce((acc, curr) => acc + (curr.qty || 1), 0);

  // Helper for Number in Words conversion
  const numberToWords = (num: number): string => {
    if (num <= 0) return "Zero Rupees Only";
    return `Rupees ${Math.floor(num).toLocaleString("en-IN")} Only`;
  };

  return (
    <div className="w-full bg-[#0B0F17] border border-indigo-500/30 rounded-2xl overflow-hidden shadow-2xl animate-in fade-in duration-200 text-theme-body font-sans flex flex-col max-h-[90vh]">
      {/* 1. SAP Fiori Sticky Object Header */}
      <div className="bg-[#121824] border-b border-theme-divider px-6 py-4 space-y-3 shrink-0">
        {/* Breadcrumb Trail */}
        <div className="flex items-center gap-2 text-[11px] text-theme-muted font-mono">
          <span>Sales</span>
          <ChevronRight size={12} />
          <span>Sales Invoices Registry</span>
          <ChevronRight size={12} />
          <span className="text-indigo-400 font-bold">New Sales Tax Invoice</span>
        </div>

        {/* Header Title & Status Badge */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-950/80 border border-blue-500/40 rounded-xl text-blue-400 shadow-md">
              <FileText size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold font-display text-theme-heading">Sales Tax Invoice</h2>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider ${
                    invoiceStatus === "Draft"
                      ? "bg-blue-950/60 text-blue-400 border border-blue-500/30"
                      : invoiceStatus === "Submitted"
                      ? "bg-amber-950/60 text-amber-400 border border-amber-500/30"
                      : "bg-emerald-950/60 text-emerald-400 border border-emerald-500/30"
                  }`}
                >
                  {invoiceStatus}
                </span>
              </div>
              <p className="text-xs text-theme-muted mt-0.5">
                Commercial Tax Invoice • Dual-Entry Engine (Manual Scan + Apparel Size Matrix)
              </p>
            </div>
          </div>

          {/* Header KPI Micro Cards */}
          <div className="flex items-center gap-3">
            <div className="bg-theme-surface-2 px-3 py-1.5 rounded-xl border border-theme-divider text-right">
              <span className="text-[10px] text-theme-muted uppercase font-mono block">Subtotal</span>
              <span className="text-xs font-bold font-mono text-theme-heading">₹{invoiceTotals.taxable.toLocaleString("en-IN")}</span>
            </div>
            <div className="bg-theme-surface-2 px-3 py-1.5 rounded-xl border border-theme-divider text-right">
              <span className="text-[10px] text-theme-muted uppercase font-mono block">GST Tax</span>
              <span className="text-xs font-bold font-mono text-emerald-400">
                ₹{(invoiceTotals.cgst + invoiceTotals.sgst + invoiceTotals.igst).toLocaleString("en-IN")}
              </span>
            </div>
            <div className="bg-indigo-950/40 px-4 py-1.5 rounded-xl border border-indigo-500/40 text-right">
              <span className="text-[10px] text-indigo-300 uppercase font-mono block">Grand Total</span>
              <span className="text-sm font-bold font-mono text-indigo-300">₹{invoiceTotals.grandTotal.toLocaleString("en-IN")}</span>
            </div>

            {/* Dedicated Standalone Popout Window Action */}
            <button
              type="button"
              onClick={() => {
                const popoutUrl = `${window.location.origin}${window.location.pathname}?popout=true&tab=sales&subView=invoices&action=create`;
                window.open(popoutUrl, "SalesTaxInvoicePopoutWindow", "width=1440,height=900,menubar=no,toolbar=no,location=no,status=no,resizable=yes");
              }}
              className="px-3 py-2 bg-indigo-600/30 hover:bg-indigo-600/50 border border-indigo-500/50 text-indigo-300 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-md"
              title="Open Sales Tax Invoice in dedicated Popout window without sidebar or menubar"
            >
              <ExternalLink size={14} />
              <span>Popout Window</span>
            </button>
          </div>
        </div>
      </div>

      {/* Scrollable Object Page Body */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* 2. Top 3 Cards Section: Customer Info, Invoice Info, KPI Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card 1: Customer Information */}
          <div className="p-4 rounded-2xl bg-theme-surface-1 border border-theme-divider space-y-3">
            <div className="flex items-center justify-between border-b border-theme-divider pb-2">
              <span className="text-xs font-bold text-theme-heading flex items-center gap-1.5">
                <User size={14} className="text-blue-400" />
                <span>Customer Information</span>
              </span>
              <span className="text-[10px] font-mono text-indigo-400">Section 1</span>
            </div>

            <div className="space-y-2.5 text-xs">
              <div>
                <label className="text-[10px] font-mono uppercase tracking-wider text-theme-muted block mb-1">
                  Select Customer *
                </label>
                <select
                  value={invoiceCustomerId}
                  onChange={(e) => setInvoiceCustomerId(e.target.value)}
                  className="w-full bg-theme-surface-2 border border-theme-divider rounded-xl px-3 py-2 text-xs text-theme-body focus:outline-none focus:border-blue-500"
                >
                  <option value="">-- Choose Customer Entity --</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.mobile}) - Outstanding: ₹{c.outstanding}
                    </option>
                  ))}
                </select>
              </div>

              {selectedCustomer && (
                <div className="bg-theme-surface-2 p-3 rounded-xl border border-theme-divider/60 space-y-1.5 text-[11px]">
                  <div className="flex justify-between">
                    <span className="text-theme-muted">GSTIN:</span>
                    <span className="font-mono font-bold text-theme-heading">{(selectedCustomer as any).gstin || "27AAACG1234F1Z0"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-theme-muted">State Code:</span>
                    <span className="font-mono text-theme-heading">27 (Maharashtra)</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-theme-muted">Credit Balance:</span>
                    <span className="font-mono text-emerald-400">₹{selectedCustomer.outstanding || 0}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Card 2: Invoice Header Information */}
          <div className="p-4 rounded-2xl bg-theme-surface-1 border border-theme-divider space-y-3">
            <div className="flex items-center justify-between border-b border-theme-divider pb-2">
              <span className="text-xs font-bold text-theme-heading flex items-center gap-1.5">
                <Calendar size={14} className="text-blue-400" />
                <span>Invoice Information</span>
              </span>
              <span className="text-[10px] font-mono text-indigo-400">Section 2</span>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-mono uppercase tracking-wider text-theme-muted block mb-1">Invoice Date</label>
                  <input
                    type="date"
                    defaultValue={new Date().toISOString().split("T")[0]}
                    className="w-full bg-theme-surface-2 border border-theme-divider rounded-xl px-2.5 py-1.5 text-xs text-theme-body outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-mono uppercase tracking-wider text-theme-muted block mb-1">Due Date</label>
                  <input
                    type="date"
                    defaultValue={new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0]}
                    className="w-full bg-theme-surface-2 border border-theme-divider rounded-xl px-2.5 py-1.5 text-xs text-theme-body outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-mono uppercase tracking-wider text-theme-muted block mb-1">eWay Bill Number</label>
                <input
                  type="text"
                  value={invoiceEWayBill}
                  onChange={(e) => setInvoiceEWayBill(e.target.value)}
                  placeholder="e.g. 123456789012"
                  className="w-full bg-theme-surface-2 border border-theme-divider rounded-xl px-3 py-1.5 text-xs text-theme-body focus:outline-none focus:border-blue-500 font-mono"
                />
              </div>

              <div className="flex items-center pt-1">
                <input
                  type="checkbox"
                  checked={invoiceIsInterstate}
                  onChange={(e) => setInvoiceIsInterstate(e.target.checked)}
                  className="rounded border-theme-divider bg-theme-surface-2 accent-indigo-500 mr-2 h-4 w-4"
                />
                <span className="text-xs font-semibold text-theme-heading">Interstate Supply (IGST Applicable)</span>
              </div>
            </div>
          </div>

          {/* Card 3: KPI Summary Card */}
          <div className="p-4 rounded-2xl bg-theme-surface-1 border border-theme-divider space-y-3">
            <div className="flex items-center justify-between border-b border-theme-divider pb-2">
              <span className="text-xs font-bold text-theme-heading flex items-center gap-1.5">
                <CreditCard size={14} className="text-blue-400" />
                <span>Financial KPI Summary</span>
              </span>
              <span className="text-[10px] font-mono text-indigo-400">Section 3</span>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-theme-divider/40">
                <span className="text-theme-muted">Before Tax:</span>
                <span className="font-mono font-bold text-theme-heading">₹{invoiceTotals.taxable.toLocaleString("en-IN")}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-theme-divider/40">
                <span className="text-theme-muted">Total Quantity:</span>
                <span className="font-mono font-bold text-indigo-400">{totalItemsQty} Pcs</span>
              </div>
              <div className="flex justify-between py-1 border-b border-theme-divider/40">
                <span className="text-theme-muted">GST Tax Amount:</span>
                <span className="font-mono font-bold text-emerald-400">
                  ₹{(invoiceTotals.cgst + invoiceTotals.sgst + invoiceTotals.igst).toLocaleString("en-IN")}
                </span>
              </div>
              <div className="pt-2">
                <span className="text-[10px] font-mono uppercase tracking-wider text-theme-muted block">Amount in Words</span>
                <span className="text-xs font-semibold text-indigo-300 italic">{numberToWords(invoiceTotals.grandTotal)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* 3. SAP Fiori Object Page Tabs Suite */}
        <div className="space-y-4">
          <div className="flex border-b border-theme-divider bg-theme-surface-1 px-4 rounded-t-2xl">
            {[
              { id: "items", label: "Invoice Items & Entry Grid", icon: Layers, badge: invoiceItems.length },
              { id: "tax", label: "Tax Breakdown", icon: FileSpreadsheet },
              { id: "customer", label: "Customer & Credit Details", icon: User },
              { id: "audit", label: "Workflow & Audit Logs", icon: Clock },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`px-5 py-3 text-xs font-bold font-display flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
                    isActive
                      ? "border-blue-500 text-blue-400 bg-blue-950/20"
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

          {/* TAB 1: ITEMS ENTRY */}
          {activeTab === "items" && (
            <div className="space-y-4">
              {/* Dual Entry Mode Selector */}
              <div className="bg-theme-surface-1 p-4 rounded-2xl border border-theme-divider space-y-4">
                <div className="flex items-center justify-between border-b border-theme-divider pb-3">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setEntryMode("manual")}
                      className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition cursor-pointer ${
                        entryMode === "manual" ? "bg-indigo-600 text-white shadow-md" : "bg-theme-surface-2 text-theme-muted hover:text-theme-body"
                      }`}
                    >
                      <Layers size={14} />
                      <span>Manual Scan / Resolve</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setEntryMode("matrix")}
                      className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition cursor-pointer ${
                        entryMode === "matrix" ? "bg-indigo-600 text-white shadow-md" : "bg-theme-surface-2 text-theme-muted hover:text-theme-body"
                      }`}
                    >
                      <Grid size={14} />
                      <span>Matrix Grid Entry (SMRITI Footwear/Apparel)</span>
                    </button>
                  </div>
                </div>

                {/* Manual Entry Sub-Panel */}
                {entryMode === "manual" && (
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 bg-theme-surface-2 p-4 rounded-xl border border-theme-divider/50">
                    <div className="sm:col-span-6">
                      <label className="text-[10px] font-mono text-theme-muted block mb-1">SELECT VARIANT *</label>
                      <select
                        value={selectedProduct}
                        onChange={(e) => setSelectedProduct(e.target.value)}
                        className="w-full bg-theme-surface-1 border border-theme-divider rounded-xl px-3 py-2 text-xs text-theme-body focus:outline-none focus:border-blue-500"
                      >
                        <option value="">-- Choose Article Variant --</option>
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} ({p.color || "N/A"} - Size {p.size || "N/A"}) - ₹{p.price} [SMR-Barcode: {p.barcode}]
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="sm:col-span-2">
                      <label className="text-[10px] font-mono text-theme-muted block mb-1">QTY</label>
                      <input
                        type="number"
                        min="1"
                        value={manualQty}
                        onChange={(e) => setManualQty(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-full bg-theme-surface-1 border border-theme-divider rounded-xl px-3 py-2 text-xs text-theme-body focus:outline-none focus:border-blue-500 font-mono"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="text-[10px] font-mono text-theme-muted block mb-1">GST TAX %</label>
                      <select
                        value={manualTax}
                        onChange={(e) => setManualTax(parseInt(e.target.value) || 18)}
                        className="w-full bg-theme-surface-1 border border-theme-divider rounded-xl px-2 py-2 text-xs text-theme-body focus:outline-none focus:border-blue-500"
                      >
                        <option value="5">5% GST</option>
                        <option value="12">12% GST</option>
                        <option value="18">18% GST</option>
                        <option value="28">28% GST</option>
                      </select>
                    </div>

                    <div className="sm:col-span-2 flex items-end">
                      <button
                        type="button"
                        onClick={handleAddManualItem}
                        className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-md cursor-pointer"
                      >
                        <Plus size={14} />
                        <span>Add Line</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Matrix Entry Sub-Panel */}
                {entryMode === "matrix" && (
                  <div className="bg-theme-surface-2 p-4 rounded-xl border border-theme-divider/50 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] font-mono text-theme-muted block mb-1">SELECT BASE ARTICLE</label>
                        <select
                          value={selectedBaseArticle}
                          onChange={(e) => {
                            setSelectedBaseArticle(e.target.value);
                            setSelectedBaseColor("");
                            setMatrixQuantities({});
                          }}
                          className="w-full bg-theme-surface-1 border border-theme-divider rounded-xl px-3 py-2 text-xs text-theme-body"
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
                          value={selectedBaseColor}
                          onChange={(e) => {
                            setSelectedBaseColor(e.target.value);
                            setMatrixQuantities({});
                          }}
                          disabled={!selectedBaseArticle}
                          className="w-full bg-theme-surface-1 border border-theme-divider rounded-xl px-3 py-2 text-xs text-theme-body disabled:opacity-50"
                        >
                          <option value="">-- Choose Color --</option>
                          {availableColors.map((col) => (
                            <option key={col} value={col}>{col}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {selectedBaseArticle && selectedBaseColor && (
                      <div className="space-y-3 pt-2 border-t border-theme-divider/50">
                        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-3">
                          {matrixVariants.map((variant) => (
                            <div key={variant.id} className="bg-theme-surface-1 p-2.5 rounded-xl border border-theme-divider flex flex-col items-center">
                              <span className="text-[10px] font-mono text-theme-muted">Size {variant.size || "OS"}</span>
                              <span className="text-xs font-semibold text-theme-body mt-0.5">₹{variant.price}</span>
                              <input
                                type="number"
                                min="0"
                                value={matrixQuantities[variant.id] || ""}
                                placeholder="0"
                                onChange={(e) => {
                                  const val = Math.max(0, parseInt(e.target.value) || 0);
                                  setMatrixQuantities({ ...matrixQuantities, [variant.id]: val });
                                }}
                                className="w-full text-center bg-theme-surface-2 border border-theme-divider rounded-lg mt-2 py-1 text-xs text-theme-body font-mono"
                              />
                            </div>
                          ))}
                        </div>

                        <div className="flex justify-end">
                          <button
                            type="button"
                            onClick={handleAddMatrixItems}
                            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition"
                          >
                            Add Matrix Items to Draft
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Fiori Enterprise Data Grid */}
              <div className="bg-theme-surface-1 border border-theme-divider rounded-2xl overflow-hidden space-y-2">
                <div className="px-4 py-3 bg-theme-surface-2 border-b border-theme-divider flex items-center justify-between">
                  <h4 className="text-xs font-bold text-theme-heading flex items-center gap-2">
                    <span>Invoice Items List</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-theme-surface-3 text-indigo-400">
                      {invoiceItems.length} Lines
                    </span>
                  </h4>
                </div>

                {invoiceItems.length === 0 ? (
                  <div className="p-12 text-center text-theme-muted text-xs">
                    No items added yet. Use manual or matrix entry above to add lines to the invoice.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-theme-surface-2 text-theme-muted uppercase font-mono text-[9px] border-b border-theme-divider">
                          <th className="px-4 py-3">#</th>
                          <th className="px-4 py-3">Article / Variant</th>
                          <th className="px-4 py-3">HSN Code</th>
                          <th className="px-4 py-3 text-right">Qty</th>
                          <th className="px-4 py-3 text-right">Unit Price (₹)</th>
                          <th className="px-4 py-3 text-right">GST %</th>
                          <th className="px-4 py-3 text-right">Tax Amount (₹)</th>
                          <th className="px-4 py-3 text-right">Line Total (₹)</th>
                          <th className="px-4 py-3 text-center">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-theme-divider/60">
                        {invoiceItems.map((item, idx) => {
                          const taxPct = item.taxRate || 18;
                          const lineTaxable = (item.price || 0) * (item.qty || 1);
                          const lineTax = lineTaxable * (taxPct / 100);
                          const lineTotal = lineTaxable + lineTax;
                          return (
                            <tr key={idx} className="hover:bg-theme-surface-hover transition-colors">
                              <td className="px-4 py-3 font-mono text-theme-muted">{idx + 1}</td>
                              <td className="px-4 py-3 font-semibold text-theme-heading">
                                {item.name || item.title || "Standard Item"}
                              </td>
                              <td className="px-4 py-3 font-mono text-theme-muted">{item.hsn || "620520"}</td>
                              <td className="px-4 py-3 font-mono text-right font-bold text-indigo-400">{item.qty || 1}</td>
                              <td className="px-4 py-3 font-mono text-right">₹{(item.price || 0).toLocaleString("en-IN")}</td>
                              <td className="px-4 py-3 font-mono text-right text-emerald-400">{taxPct}%</td>
                              <td className="px-4 py-3 font-mono text-right text-emerald-400">₹{lineTax.toLocaleString("en-IN")}</td>
                              <td className="px-4 py-3 font-mono text-right font-bold text-theme-heading">
                                ₹{lineTotal.toLocaleString("en-IN")}
                              </td>
                              <td className="px-4 py-3 text-center">
                                <button
                                  type="button"
                                  onClick={() => setInvoiceItems(invoiceItems.filter((_, i) => i !== idx))}
                                  className="p-1.5 text-rose-400 hover:bg-rose-950/40 rounded-lg transition"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: TAX BREAKDOWN */}
          {activeTab === "tax" && (
            <div className="p-5 rounded-2xl bg-theme-surface-1 border border-theme-divider space-y-4">
              <h3 className="font-bold text-sm text-theme-heading">Statutory GST Tax Summary Breakdown</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl bg-theme-surface-2 border border-theme-divider">
                  <span className="text-xs text-theme-muted block">CGST Output Tax (9%)</span>
                  <span className="text-xl font-bold font-mono text-emerald-400 mt-1 block">
                    ₹{invoiceTotals.cgst.toLocaleString("en-IN")}
                  </span>
                </div>
                <div className="p-4 rounded-xl bg-theme-surface-2 border border-theme-divider">
                  <span className="text-xs text-theme-muted block">SGST Output Tax (9%)</span>
                  <span className="text-xl font-bold font-mono text-emerald-400 mt-1 block">
                    ₹{invoiceTotals.sgst.toLocaleString("en-IN")}
                  </span>
                </div>
                <div className="p-4 rounded-xl bg-theme-surface-2 border border-theme-divider">
                  <span className="text-xs text-theme-muted block">IGST Output Tax (18%)</span>
                  <span className="text-xl font-bold font-mono text-indigo-400 mt-1 block">
                    ₹{invoiceTotals.igst.toLocaleString("en-IN")}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: CUSTOMER DETAILS */}
          {activeTab === "customer" && (
            <div className="p-5 rounded-2xl bg-theme-surface-1 border border-theme-divider space-y-3">
              <h3 className="font-bold text-sm text-theme-heading">Customer Account & Credit Parameters</h3>
              {selectedCustomer ? (
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="text-theme-muted">Name:</span> <span className="font-bold text-theme-heading">{selectedCustomer.name}</span>
                  </div>
                  <div>
                    <span className="text-theme-muted">Mobile:</span> <span className="font-mono text-theme-heading">{selectedCustomer.mobile}</span>
                  </div>
                  <div>
                    <span className="text-theme-muted">Outstanding:</span> <span className="font-mono font-bold text-emerald-400">₹{selectedCustomer.outstanding}</span>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-theme-muted">Select a customer above to view details.</p>
              )}
            </div>
          )}

          {/* TAB 4: AUDIT */}
          {activeTab === "audit" && (
            <div className="p-5 rounded-2xl bg-theme-surface-1 border border-theme-divider space-y-3 text-xs">
              <h3 className="font-bold text-sm text-theme-heading">Workflow Audit Log</h3>
              <div className="space-y-2 font-mono">
                <div className="p-2 rounded bg-theme-surface-2 text-theme-muted">[2026-07-30 12:00] Draft created by System Admin</div>
                <div className="p-2 rounded bg-theme-surface-2 text-theme-muted">[2026-07-30 12:01] Statutory GST Pre-Flight Validation Passed</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 4. SAP Fiori Sticky Footer Toolbar */}
      <div className="bg-[#121824] border-t border-theme-divider px-6 py-3 flex items-center justify-between shrink-0">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 bg-theme-surface-2 border border-theme-divider hover:bg-theme-surface-hover text-theme-body text-xs font-semibold rounded-xl transition cursor-pointer"
        >
          Cancel
        </button>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setInvoiceStatus("Draft")}
            className="px-4 py-2 bg-theme-surface-2 border border-theme-divider hover:border-indigo-500/40 text-theme-body text-xs font-semibold rounded-xl transition cursor-pointer"
          >
            Save Draft
          </button>

          <button
            type="button"
            onClick={(e) => {
              setInvoiceStatus("Approved");
              handleCreateInvoiceSubmit(e as any);
            }}
            className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl shadow-md transition flex items-center gap-2 cursor-pointer"
          >
            <Check size={15} />
            <span>Post & Save Tax Invoice</span>
          </button>
        </div>
      </div>
    </div>
  );
};
