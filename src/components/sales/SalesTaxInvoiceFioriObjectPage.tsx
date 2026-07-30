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
import { WindowManager } from "../../sdk/WindowManager.ts";

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
    <div className="w-full bg-[#0B0F17] border border-indigo-500/30 rounded-2xl overflow-hidden shadow-2xl animate-in fade-in duration-200 text-theme-body font-sans flex flex-col max-h-[92vh]">
      {/* 1. Sticky Object Header & Command Bar */}
      <div className="bg-[#121824] border-b border-theme-divider px-6 py-3.5 space-y-2 shrink-0">
        {/* Top Header Row: Title, Status Badge, Document ID, Hotkeys */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="p-1.5 rounded-lg bg-theme-surface-2 hover:bg-theme-surface-hover text-theme-muted hover:text-theme-body transition cursor-pointer"
              title="Return to Sales Invoices Registry"
            >
              <X size={16} />
            </button>
            <div className="p-2 bg-blue-950/80 border border-blue-500/40 rounded-xl text-blue-400 shadow-md">
              <FileText size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold font-display text-theme-heading">Sales Tax Invoice Workspace</h2>
                <span className="px-2 py-0.5 rounded-md bg-indigo-950/60 text-indigo-300 border border-indigo-500/30 font-mono text-[10px] font-bold">
                  INV-000124
                </span>
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
              <p className="text-[11px] text-theme-muted mt-0.5">
                Keyboard-Optimized High-Speed Billing Desk • SAP Fiori & Dynamics 365 Architecture
              </p>
            </div>
          </div>

          {/* Quick Keyboard Hotkeys Legend Bar */}
          <div className="hidden lg:flex items-center gap-2 text-[10px] font-mono text-theme-muted bg-theme-surface-2 px-3 py-1.5 rounded-xl border border-theme-divider">
            <span className="px-1.5 py-0.5 bg-theme-surface-3 rounded border border-theme-divider text-indigo-400 font-bold">F2</span> Customer
            <span className="text-theme-divider">|</span>
            <span className="px-1.5 py-0.5 bg-theme-surface-3 rounded border border-theme-divider text-indigo-400 font-bold">F3</span> Item Search
            <span className="text-theme-divider">|</span>
            <span className="px-1.5 py-0.5 bg-theme-surface-3 rounded border border-theme-divider text-indigo-400 font-bold">F4</span> Payment
            <span className="text-theme-divider">|</span>
            <span className="px-1.5 py-0.5 bg-theme-surface-3 rounded border border-theme-divider text-indigo-400 font-bold">F9</span> Print
            <span className="text-theme-divider">|</span>
            <span className="px-1.5 py-0.5 bg-theme-surface-3 rounded border border-theme-divider text-indigo-400 font-bold">Ctrl+S</span> Save
          </div>

          {/* Standalone Window Button */}
          <button
            type="button"
            onClick={() => {
              WindowManager.openTransaction({
                transactionType: "SalesInvoice",
                mode: "standalone",
                action: "create",
              });
            }}
            className="px-3 py-1.5 bg-indigo-600/30 hover:bg-indigo-600/50 border border-indigo-500/50 text-indigo-300 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-md"
          >
            <ExternalLink size={13} />
            <span>Open Popout Window</span>
          </button>
        </div>

        {/* 2. Top Header Form Bar (Dense Enterprise Data Entry Row) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5 pt-2 border-t border-theme-divider/40 text-xs">
          <div>
            <label className="text-[9px] font-mono uppercase tracking-wider text-theme-muted block mb-1">Customer (F2)</label>
            <select
              value={invoiceCustomerId}
              onChange={(e) => setInvoiceCustomerId(e.target.value)}
              className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg px-2 py-1.5 text-xs text-theme-body focus:outline-none focus:border-blue-500 font-medium"
            >
              <option value="">-- Choose Customer --</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.mobile})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[9px] font-mono uppercase tracking-wider text-theme-muted block mb-1">Invoice Date</label>
            <input
              type="date"
              defaultValue={new Date().toISOString().split("T")[0]}
              className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg px-2 py-1 text-xs text-theme-body focus:outline-none font-mono"
            />
          </div>

          <div>
            <label className="text-[9px] font-mono uppercase tracking-wider text-theme-muted block mb-1">Warehouse</label>
            <select className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg px-2 py-1.5 text-xs text-theme-body focus:outline-none">
              <option>WH-01 Main Distribution</option>
              <option>WH-02 Retail Counter Desk</option>
            </select>
          </div>

          <div>
            <label className="text-[9px] font-mono uppercase tracking-wider text-theme-muted block mb-1">Sales Representative</label>
            <select className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg px-2 py-1.5 text-xs text-theme-body focus:outline-none">
              <option>Jawahar Mallah (SYSADMIN)</option>
              <option>Rajesh Kumar (Sales Exec)</option>
            </select>
          </div>

          <div>
            <label className="text-[9px] font-mono uppercase tracking-wider text-theme-muted block mb-1">Payment Mode (F4)</label>
            <select className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg px-2 py-1.5 text-xs text-theme-body focus:outline-none">
              <option>Net 30 Credit</option>
              <option>UPI / QR Pay</option>
              <option>POS Card Swiper</option>
              <option>Cash Drawer</option>
            </select>
          </div>

          <div>
            <label className="text-[9px] font-mono uppercase tracking-wider text-theme-muted block mb-1">Price List</label>
            <select className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg px-2 py-1.5 text-xs text-theme-body focus:outline-none">
              <option>Standard Retail MRP</option>
              <option>Distributor Wholesale</option>
              <option>VIP Member Special</option>
            </select>
          </div>

          <div>
            <label className="text-[9px] font-mono uppercase tracking-wider text-theme-muted block mb-1">Currency</label>
            <select className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg px-2 py-1.5 text-xs text-theme-body focus:outline-none font-mono">
              <option>INR (₹)</option>
              <option>USD ($)</option>
              <option>EUR (€)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Scrollable Workspace Body */}
      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {/* 3. Fast Item Search & Barcode Scan Input Bar */}
        <div className="bg-theme-surface-1 p-3 rounded-xl border border-theme-divider flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <input
              type="text"
              placeholder="Search product by name, SKU code, or scan barcode... (Ctrl+K / F3)"
              className="w-full bg-theme-surface-2 border border-theme-divider rounded-xl pl-9 pr-4 py-2 text-xs text-theme-body focus:outline-none focus:border-indigo-500 font-mono"
            />
            <Info size={14} className="absolute left-3 top-2.5 text-theme-muted" />
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setEntryMode("manual")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                entryMode === "manual" ? "bg-indigo-600 text-white" : "bg-theme-surface-2 text-theme-muted"
              }`}
            >
              Manual / Barcode
            </button>
            <button
              type="button"
              onClick={() => setEntryMode("matrix")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                entryMode === "matrix" ? "bg-indigo-600 text-white" : "bg-theme-surface-2 text-theme-muted"
              }`}
            >
              Matrix Entry Grid
            </button>
          </div>
        </div>

        {/* 4. Manual Entry Panel / Matrix Panel */}
        {entryMode === "manual" ? (
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 bg-theme-surface-1 p-3.5 rounded-xl border border-theme-divider/70">
            <div className="sm:col-span-6">
              <label className="text-[10px] font-mono text-theme-muted block mb-1">PRODUCT VARIANT *</label>
              <select
                value={selectedProduct}
                onChange={(e) => setSelectedProduct(e.target.value)}
                className="w-full bg-theme-surface-2 border border-theme-divider rounded-xl px-3 py-2 text-xs text-theme-body focus:outline-none focus:border-blue-500 font-medium"
              >
                <option value="">-- Choose Article Variant --</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.color || "N/A"} - Size {p.size || "N/A"}) - ₹{p.price} [Barcode: {p.barcode}]
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
                className="w-full bg-theme-surface-2 border border-theme-divider rounded-xl px-3 py-2 text-xs text-theme-body focus:outline-none focus:border-blue-500 font-mono"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="text-[10px] font-mono text-theme-muted block mb-1">GST TAX %</label>
              <select
                value={manualTax}
                onChange={(e) => setManualTax(parseInt(e.target.value) || 18)}
                className="w-full bg-theme-surface-2 border border-theme-divider rounded-xl px-2 py-2 text-xs text-theme-body focus:outline-none focus:border-blue-500 font-mono"
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
                className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-md"
              >
                <Plus size={15} />
                <span>Add Item Line</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-theme-surface-1 p-4 rounded-xl border border-theme-divider space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-mono text-theme-muted block mb-1">BASE ARTICLE MODEL *</label>
                <select
                  value={selectedBaseArticle}
                  onChange={(e) => {
                    setSelectedBaseArticle(e.target.value);
                    setSelectedBaseColor("");
                    setMatrixQuantities({});
                  }}
                  className="w-full bg-theme-surface-2 border border-theme-divider rounded-xl px-3 py-2 text-xs text-theme-body focus:outline-none"
                >
                  <option value="">-- Choose Base Article --</option>
                  {baseArticles.map((art) => (
                    <option key={art} value={art}>{art}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-mono text-theme-muted block mb-1">COLOR VARIANT *</label>
                <select
                  value={selectedBaseColor}
                  onChange={(e) => {
                    setSelectedBaseColor(e.target.value);
                    setMatrixQuantities({});
                  }}
                  disabled={!selectedBaseArticle}
                  className="w-full bg-theme-surface-2 border border-theme-divider rounded-xl px-3 py-2 text-xs text-theme-body focus:outline-none disabled:opacity-50"
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
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                  {matrixVariants.map((variant) => (
                    <div key={variant.id} className="bg-theme-surface-2 p-2.5 rounded-xl border border-theme-divider flex flex-col items-center">
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
                        className="w-full text-center bg-theme-surface-1 border border-theme-divider rounded-lg mt-2 py-1 text-xs text-theme-body font-mono"
                      />
                    </div>
                  ))}
                </div>

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleAddMatrixItems}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition cursor-pointer"
                  >
                    Add Matrix Items to Invoice
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 5. Dynamic Item Entry Table */}
        <div className="bg-theme-surface-1 border border-theme-divider rounded-xl overflow-hidden shadow-md">
          <div className="px-4 py-2.5 bg-theme-surface-2 border-b border-theme-divider flex items-center justify-between">
            <h4 className="text-xs font-bold text-theme-heading flex items-center gap-2">
              <span>Invoice Item Lines</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-theme-surface-3 text-indigo-400">
                {invoiceItems.length} Lines
              </span>
            </h4>
          </div>

          {invoiceItems.length === 0 ? (
            <div className="p-10 text-center text-theme-muted text-xs">
              No items added yet. Use manual barcode scan or matrix grid entry above to build invoice lines.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-theme-surface-2 text-theme-muted uppercase font-mono text-[9px] tracking-wider border-b border-theme-divider">
                    <th className="px-3 py-2.5">Code</th>
                    <th className="px-3 py-2.5">Product Description</th>
                    <th className="px-3 py-2.5">Batch</th>
                    <th className="px-3 py-2.5 text-right">Qty</th>
                    <th className="px-3 py-2.5 text-center">UOM</th>
                    <th className="px-3 py-2.5 text-right">Rate (₹)</th>
                    <th className="px-3 py-2.5 text-right">Disc %</th>
                    <th className="px-3 py-2.5 text-right">GST %</th>
                    <th className="px-3 py-2.5 text-right">Amount (₹)</th>
                    <th className="px-3 py-2.5 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-theme-divider/60">
                  {invoiceItems.map((item, idx) => {
                    const taxPct = item.taxRate || 18;
                    const lineRate = item.price || 0;
                    const lineQty = item.qty || 1;
                    const discPct = item.discountPct || 0;
                    const grossAmount = lineRate * lineQty;
                    const discAmount = (grossAmount * discPct) / 100;
                    const taxable = grossAmount - discAmount;
                    const taxAmount = (taxable * taxPct) / 100;
                    const lineTotal = taxable + taxAmount;

                    return (
                      <tr key={idx} className="hover:bg-theme-surface-hover transition-colors">
                        <td className="px-3 py-2.5 font-mono text-indigo-400 font-bold">{item.code || `SKU-${idx + 101}`}</td>
                        <td className="px-3 py-2.5 font-semibold text-theme-heading">
                          {item.name || item.title || "Standard Article"}
                        </td>
                        <td className="px-3 py-2.5 font-mono text-theme-muted">{item.batch || "BATCH-2026A"}</td>
                        <td className="px-3 py-2.5 font-mono text-right font-bold text-indigo-300">{lineQty}</td>
                        <td className="px-3 py-2.5 text-center font-mono text-theme-muted">{item.uom || "PCS"}</td>
                        <td className="px-3 py-2.5 font-mono text-right">₹{lineRate.toLocaleString("en-IN")}</td>
                        <td className="px-3 py-2.5 font-mono text-right text-amber-400">{discPct}%</td>
                        <td className="px-3 py-2.5 font-mono text-right text-emerald-400">{taxPct}%</td>
                        <td className="px-3 py-2.5 font-mono text-right font-bold text-theme-heading">
                          ₹{Math.round(lineTotal).toLocaleString("en-IN")}
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <button
                            type="button"
                            onClick={() => setInvoiceItems(invoiceItems.filter((_, i) => i !== idx))}
                            className="p-1 text-rose-400 hover:bg-rose-950/40 rounded transition"
                          >
                            <Trash2 size={13} />
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

        {/* 6. Split Bottom Panel */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Left Sub-Panel */}
          <div className="lg:col-span-2 bg-theme-surface-1 border border-theme-divider rounded-xl p-4 space-y-4">
            <div className="flex border-b border-theme-divider gap-2 text-xs font-bold">
              <button
                type="button"
                onClick={() => setActiveTab("items")}
                className={`px-3 py-2 border-b-2 transition cursor-pointer ${
                  activeTab === "items" ? "border-blue-500 text-blue-400" : "border-transparent text-theme-muted"
                }`}
              >
                Notes & Terms
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("tax")}
                className={`px-3 py-2 border-b-2 transition cursor-pointer ${
                  activeTab === "tax" ? "border-blue-500 text-blue-400" : "border-transparent text-theme-muted"
                }`}
              >
                Statutory GST
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("customer")}
                className={`px-3 py-2 border-b-2 transition cursor-pointer ${
                  activeTab === "customer" ? "border-blue-500 text-blue-400" : "border-transparent text-theme-muted"
                }`}
              >
                Delivery & Transport
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("audit")}
                className={`px-3 py-2 border-b-2 transition cursor-pointer ${
                  activeTab === "audit" ? "border-blue-500 text-blue-400" : "border-transparent text-theme-muted"
                }`}
              >
                Workflow Audit
              </button>
            </div>

            {activeTab === "items" && (
              <div className="space-y-3 text-xs">
                <div>
                  <label className="text-[10px] font-mono uppercase text-theme-muted block mb-1">Invoice Notes / Remarks</label>
                  <textarea
                    rows={2}
                    placeholder="Enter customer special instructions, delivery terms, or PO references..."
                    className="w-full bg-theme-surface-2 border border-theme-divider rounded-xl p-2 text-xs text-theme-body focus:outline-none"
                  />
                </div>
                <div className="text-[11px] text-theme-muted leading-relaxed">
                  GST Statutory Declaration: Goods once sold will not be accepted back without original tax invoice. All disputes subject to local jurisdiction.
                </div>
              </div>
            )}

            {activeTab === "tax" && (
              <div className="grid grid-cols-3 gap-3 text-xs font-mono">
                <div className="p-3 bg-theme-surface-2 rounded-xl border border-theme-divider">
                  <span className="text-[10px] text-theme-muted block">CGST Output (9%)</span>
                  <span className="text-sm font-bold text-emerald-400 mt-0.5 block">₹{invoiceTotals.cgst.toLocaleString("en-IN")}</span>
                </div>
                <div className="p-3 bg-theme-surface-2 rounded-xl border border-theme-divider">
                  <span className="text-[10px] text-theme-muted block">SGST Output (9%)</span>
                  <span className="text-sm font-bold text-emerald-400 mt-0.5 block">₹{invoiceTotals.sgst.toLocaleString("en-IN")}</span>
                </div>
                <div className="p-3 bg-theme-surface-2 rounded-xl border border-theme-divider">
                  <span className="text-[10px] text-theme-muted block">IGST Output (18%)</span>
                  <span className="text-sm font-bold text-indigo-400 mt-0.5 block">₹{invoiceTotals.igst.toLocaleString("en-IN")}</span>
                </div>
              </div>
            )}

            {activeTab === "customer" && (
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="text-[10px] font-mono text-theme-muted block mb-1">e-Way Bill No.</label>
                  <input
                    type="text"
                    value={invoiceEWayBill}
                    onChange={(e) => setInvoiceEWayBill(e.target.value)}
                    placeholder="Enter 12-digit eWay Bill No."
                    className="w-full bg-theme-surface-2 border border-theme-divider rounded-xl px-3 py-1.5 font-mono text-xs text-theme-body"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-mono text-theme-muted block mb-1">Transporter Name</label>
                  <input
                    type="text"
                    placeholder="e.g. VRL Logistics / BlueDart"
                    className="w-full bg-theme-surface-2 border border-theme-divider rounded-xl px-3 py-1.5 text-xs text-theme-body"
                  />
                </div>
              </div>
            )}

            {activeTab === "audit" && (
              <div className="space-y-1.5 font-mono text-[11px] text-theme-muted">
                <div className="p-2 rounded bg-theme-surface-2">[2026-07-30 12:00] Draft created by System Admin</div>
                <div className="p-2 rounded bg-theme-surface-2">[2026-07-30 12:01] Pre-Flight GST Engine Validation Passed</div>
              </div>
            )}
          </div>

          {/* Right Summary Stack */}
          <div className="bg-theme-surface-1 border border-indigo-500/30 rounded-xl p-4 space-y-2.5 text-xs">
            <h4 className="font-bold text-xs text-indigo-300 font-mono uppercase tracking-wider border-b border-theme-divider pb-2">
              Financial Summary Breakdown
            </h4>

            <div className="space-y-2">
              <div className="flex justify-between text-theme-muted">
                <span>Subtotal (Taxable):</span>
                <span className="font-mono font-semibold text-theme-body">₹{invoiceTotals.taxable.toLocaleString("en-IN")}</span>
              </div>
              <div className="flex justify-between text-theme-muted">
                <span>Total Discount:</span>
                <span className="font-mono font-semibold text-amber-400">₹0.00</span>
              </div>
              <div className="flex justify-between text-theme-muted">
                <span>CGST (Output):</span>
                <span className="font-mono text-emerald-400">₹{invoiceTotals.cgst.toLocaleString("en-IN")}</span>
              </div>
              <div className="flex justify-between text-theme-muted">
                <span>SGST (Output):</span>
                <span className="font-mono text-emerald-400">₹{invoiceTotals.sgst.toLocaleString("en-IN")}</span>
              </div>
              <div className="flex justify-between text-theme-muted">
                <span>IGST (Output):</span>
                <span className="font-mono text-indigo-400">₹{invoiceTotals.igst.toLocaleString("en-IN")}</span>
              </div>
              <div className="flex justify-between text-theme-muted">
                <span>Round Off Adjustment:</span>
                <span className="font-mono text-theme-body">₹0.00</span>
              </div>

              <div className="pt-2 border-t border-theme-divider flex justify-between items-center text-sm font-bold">
                <span className="text-indigo-300">GRAND TOTAL:</span>
                <span className="font-mono text-lg text-emerald-400">₹{invoiceTotals.grandTotal.toLocaleString("en-IN")}</span>
              </div>

              <div className="pt-1 text-[10px] font-mono text-theme-muted italic text-right">
                {numberToWords(invoiceTotals.grandTotal)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 7. Bottom Floating Command Action Bar */}
      <div className="bg-[#121824] border-t border-theme-divider px-6 py-3 flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-3.5 py-1.5 bg-theme-surface-2 border border-theme-divider hover:bg-theme-surface-hover text-theme-body text-xs font-semibold rounded-xl transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => setInvoiceStatus("Draft")}
            className="px-3.5 py-1.5 bg-theme-surface-2 border border-theme-divider hover:border-indigo-500/40 text-theme-body text-xs font-semibold rounded-xl transition cursor-pointer flex items-center gap-1.5"
          >
            <Save size={14} />
            <span>Save Draft [Ctrl+S]</span>
          </button>
          <button
            type="button"
            className="px-3.5 py-1.5 bg-amber-950/40 border border-amber-500/40 hover:bg-amber-950/70 text-amber-300 text-xs font-semibold rounded-xl transition cursor-pointer"
          >
            Hold [F6]
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            className="px-3 py-1.5 bg-theme-surface-2 border border-theme-divider text-theme-body text-xs font-semibold rounded-xl hover:bg-theme-surface-hover transition flex items-center gap-1.5 cursor-pointer"
          >
            <Printer size={14} />
            <span>Print [F9]</span>
          </button>
          <button
            type="button"
            className="px-3 py-1.5 bg-theme-surface-2 border border-theme-divider text-theme-body text-xs font-semibold rounded-xl hover:bg-theme-surface-hover transition flex items-center gap-1.5 cursor-pointer"
          >
            <FileText size={14} />
            <span>PDF</span>
          </button>
          <button
            type="button"
            className="px-3 py-1.5 bg-theme-surface-2 border border-theme-divider text-theme-body text-xs font-semibold rounded-xl hover:bg-theme-surface-hover transition flex items-center gap-1.5 cursor-pointer"
          >
            <Share2 size={14} />
            <span>WhatsApp</span>
          </button>
          <button
            type="button"
            onClick={(e) => {
              setInvoiceStatus("Approved");
              handleCreateInvoiceSubmit(e as any);
            }}
            className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-lg transition flex items-center gap-2 cursor-pointer"
          >
            <CheckCircle2 size={15} />
            <span>Submit & Commit Invoice [Enter]</span>
          </button>
        </div>
      </div>
    </div>
  );
};
