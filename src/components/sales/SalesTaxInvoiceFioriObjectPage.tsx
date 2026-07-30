/**
 * Project      : SMRITI Business OS
 * Component    : SalesTaxInvoiceFioriObjectPage (Clean User Wireframe Layout)
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * License      : Proprietary Commercial Software
 * Classification: SMRITI Design System (Clean Invoice Layout Standard)
 */

import React, { useState } from "react";
import {
  X,
  Search,
  Plus,
  Trash2,
  Printer,
  FileText,
  Share2,
  Save,
  PauseCircle,
  CreditCard,
  CheckCircle2,
  ChevronDown,
  Paperclip,
  Truck,
  FileEdit,
  ExternalLink
} from "lucide-react";
import { Customer, Product } from "../../types";
import { WindowManager } from "../../sdk/WindowManager.ts";

export interface SalesTaxInvoiceFioriObjectPageProps {
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
  selectedProduct,
  setSelectedProduct,
  manualQty,
  setManualQty,
  manualTax,
  setManualTax,
  handleAddManualItem,
  invoiceItems,
  setInvoiceItems,
  invoiceTotals,
  handleCreateInvoiceSubmit,
  onCancel,
}) => {
  const [showMoreFields, setShowMoreFields] = useState(false);
  const [bottomTab, setBottomTab] = useState<"notes" | "delivery" | "attachments">("notes");
  const [invoiceNotes, setInvoiceNotes] = useState("");
  const [transporterName, setTransporterName] = useState("");
  const [discountPercent, setDiscountPercent] = useState(0);
  const [roundOff, setRoundOff] = useState(0);

  const totalDiscountAmount = (invoiceTotals.taxable * discountPercent) / 100;
  const netTaxable = invoiceTotals.taxable - totalDiscountAmount;
  const totalGst = invoiceTotals.cgst + invoiceTotals.sgst + invoiceTotals.igst;
  const computedGrandTotal = netTaxable + totalGst + roundOff;

  return (
    <div className="w-full bg-[#0E131F] border border-[#1E293B] rounded-2xl overflow-hidden shadow-2xl font-sans text-slate-200 flex flex-col max-h-[92vh]">
      
      {/* ─── 1. TOP TITLE HEADER BAR ─── */}
      <div className="bg-[#161E2E] px-6 py-3 border-b border-[#1E293B] flex items-center justify-between shrink-0">
        <div className="flex items-center space-x-3">
          <button
            type="button"
            onClick={onCancel}
            className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition cursor-pointer"
          >
            <X size={18} />
          </button>
          <h2 className="text-lg font-bold font-display text-white tracking-wide">Sales Invoice</h2>
          <span
            className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider ${
              invoiceStatus === "Draft"
                ? "bg-blue-950/80 text-blue-400 border border-blue-500/40"
                : invoiceStatus === "Submitted"
                ? "bg-amber-950/80 text-amber-400 border border-amber-500/40"
                : "bg-emerald-950/80 text-emerald-400 border border-emerald-500/40"
            }`}
          >
            {invoiceStatus}
          </span>
        </div>

        <div className="flex items-center space-x-3 font-mono">
          <span className="px-3 py-1 bg-indigo-950/60 text-indigo-300 border border-indigo-500/40 rounded-lg text-xs font-bold">
            INV-000145
          </span>
          <button
            type="button"
            onClick={() => {
              WindowManager.openTransaction({
                transactionType: "SalesInvoice",
                mode: "standalone",
                action: "create",
              });
            }}
            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs transition flex items-center space-x-1 cursor-pointer"
            title="Open in Popout Window"
          >
            <ExternalLink size={13} />
            <span>Popout</span>
          </button>
        </div>
      </div>

      {/* ─── 2. TOP FORM CONTROLS ROW ─── */}
      <div className="bg-[#121824] px-6 py-3 border-b border-[#1E293B] space-y-3 shrink-0 text-xs">
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 items-end">
          <div>
            <label className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block mb-1">Customer</label>
            <select
              value={invoiceCustomerId}
              onChange={(e) => setInvoiceCustomerId(e.target.value)}
              className="w-full bg-[#1E293B] border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500 font-medium"
            >
              <option value="">-- Select Customer --</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.mobile})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block mb-1">Date</label>
            <input
              type="date"
              defaultValue={new Date().toISOString().split("T")[0]}
              className="w-full bg-[#1E293B] border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none font-mono"
            />
          </div>

          <div>
            <label className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block mb-1">Branch</label>
            <select className="w-full bg-[#1E293B] border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none">
              <option>Main Head Office</option>
              <option>Suburban Retail Branch</option>
            </select>
          </div>

          <div>
            <label className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block mb-1">Warehouse</label>
            <select className="w-full bg-[#1E293B] border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none">
              <option>WH-01 Main Store</option>
              <option>WH-02 Dispatch Hub</option>
            </select>
          </div>

          <div>
            <label className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block mb-1">Salesperson</label>
            <select className="w-full bg-[#1E293B] border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none">
              <option>Jawahar Mallah</option>
              <option>Rajesh Kumar</option>
            </select>
          </div>

          <div>
            <label className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block mb-1">Payment</label>
            <select className="w-full bg-[#1E293B] border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none">
              <option>Net 30 Credit</option>
              <option>UPI / QR Code</option>
              <option>Card Swiper</option>
              <option>Cash Drawer</option>
            </select>
          </div>

          <div>
            <button
              type="button"
              onClick={() => setShowMoreFields(!showMoreFields)}
              className="w-full py-1.5 bg-[#1E293B] hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold flex items-center justify-center space-x-1 transition cursor-pointer border border-slate-700"
            >
              <span>More</span>
              <ChevronDown size={14} className={`transform transition-transform ${showMoreFields ? "rotate-180" : ""}`} />
            </button>
          </div>
        </div>

        {/* Collapsible Additional Controls */}
        {showMoreFields && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-[#1E293B] animate-in fade-in duration-150">
            <div>
              <label className="text-[10px] font-mono text-slate-400 block mb-1">eWay Bill Number</label>
              <input
                type="text"
                value={invoiceEWayBill}
                onChange={(e) => setInvoiceEWayBill(e.target.value)}
                placeholder="e.g. 123456789012"
                className="w-full bg-[#1E293B] border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono"
              />
            </div>
            <div>
              <label className="text-[10px] font-mono text-slate-400 block mb-1">Transporter Name</label>
              <input
                type="text"
                value={transporterName}
                onChange={(e) => setTransporterName(e.target.value)}
                placeholder="e.g. VRL Express"
                className="w-full bg-[#1E293B] border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
              />
            </div>
            <div className="flex items-center pt-4">
              <input
                type="checkbox"
                id="interstateCheck"
                checked={invoiceIsInterstate}
                onChange={(e) => setInvoiceIsInterstate(e.target.checked)}
                className="rounded bg-[#1E293B] border-slate-700 text-indigo-500 mr-2 h-4 w-4 accent-indigo-500 cursor-pointer"
              />
              <label htmlFor="interstateCheck" className="text-xs text-slate-300 font-semibold cursor-pointer">
                Interstate Supply (IGST)
              </label>
            </div>
          </div>
        )}
      </div>

      {/* ─── 3. ITEM SEARCH / BARCODE SCANNER ROW ─── */}
      <div className="bg-[#161E2E] px-6 py-3 border-b border-[#1E293B] flex items-center space-x-3 shrink-0">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search Item / Scan Barcode (e.g. SKU-101, Cotton Shirt)..."
            className="w-full bg-[#0E131F] border border-[#1E293B] rounded-xl pl-9 pr-4 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono placeholder:text-slate-500"
          />
        </div>

        {/* Quick Item Picker Select */}
        <select
          value={selectedProduct}
          onChange={(e) => setSelectedProduct(e.target.value)}
          className="bg-[#1E293B] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none font-medium max-w-[280px]"
        >
          <option value="">-- Quick Pick Product --</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} - ₹{p.price} [{p.barcode}]
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={handleAddManualItem}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 transition cursor-pointer shadow-md"
        >
          <Plus size={15} />
          <span>Add</span>
        </button>
      </div>

      {/* ─── 4. ITEMS TABLE ─── */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        <div className="bg-[#121824] border border-[#1E293B] rounded-xl overflow-hidden shadow-md">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-[#161E2E] text-slate-400 uppercase font-mono text-[10px] tracking-wider border-b border-[#1E293B]">
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">Batch</th>
                <th className="px-4 py-3 text-right">Qty</th>
                <th className="px-4 py-3 text-right">Rate (₹)</th>
                <th className="px-4 py-3 text-right">Disc %</th>
                <th className="px-4 py-3 text-right">GST %</th>
                <th className="px-4 py-3 text-right">Amount (₹)</th>
                <th className="px-4 py-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1E293B]">
              {invoiceItems.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-slate-500 text-xs italic">
                    No items added to invoice. Scan barcode or use search bar above to add items.
                  </td>
                </tr>
              ) : (
                invoiceItems.map((item, idx) => {
                  const taxPct = item.taxRate || 18;
                  const rate = item.price || 0;
                  const qty = item.qty || 1;
                  const disc = item.discountPct || 0;
                  const gross = rate * qty;
                  const discAmt = (gross * disc) / 100;
                  const taxable = gross - discAmt;
                  const taxAmt = (taxable * taxPct) / 100;
                  const amount = taxable + taxAmt;

                  return (
                    <tr key={idx} className="hover:bg-[#161E2E] transition-colors text-slate-200">
                      <td className="px-4 py-3 font-mono font-bold text-indigo-400">{item.code || `SKU-${idx + 101}`}</td>
                      <td className="px-4 py-3 font-semibold text-white">{item.name || item.title || "Item Description"}</td>
                      <td className="px-4 py-3 font-mono text-slate-400">{item.batch || "BATCH-2026A"}</td>
                      <td className="px-4 py-3 font-mono text-right font-bold text-indigo-300">{qty}</td>
                      <td className="px-4 py-3 font-mono text-right">₹{rate.toLocaleString("en-IN")}</td>
                      <td className="px-4 py-3 font-mono text-right text-amber-400">{disc}%</td>
                      <td className="px-4 py-3 font-mono text-right text-emerald-400">{taxPct}%</td>
                      <td className="px-4 py-3 font-mono text-right font-bold text-white">
                        ₹{Math.round(amount).toLocaleString("en-IN")}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          type="button"
                          onClick={() => setInvoiceItems(invoiceItems.filter((_, i) => i !== idx))}
                          className="p-1 text-rose-400 hover:bg-rose-950/40 rounded transition cursor-pointer"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* ─── 5. SPLIT BOTTOM SECTION (2 COLUMNS) ─── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* LEFT COLUMN: NOTES / DELIVERY / ATTACHMENTS */}
          <div className="bg-[#121824] border border-[#1E293B] rounded-xl p-4 space-y-4">
            <div className="flex border-b border-[#1E293B] space-x-2 text-xs font-bold">
              <button
                type="button"
                onClick={() => setBottomTab("notes")}
                className={`px-3 py-2 border-b-2 transition cursor-pointer flex items-center space-x-1.5 ${
                  bottomTab === "notes" ? "border-indigo-500 text-indigo-400" : "border-transparent text-slate-400 hover:text-slate-200"
                }`}
              >
                <FileEdit size={14} />
                <span>Notes</span>
              </button>
              <button
                type="button"
                onClick={() => setBottomTab("delivery")}
                className={`px-3 py-2 border-b-2 transition cursor-pointer flex items-center space-x-1.5 ${
                  bottomTab === "delivery" ? "border-indigo-500 text-indigo-400" : "border-transparent text-slate-400 hover:text-slate-200"
                }`}
              >
                <Truck size={14} />
                <span>Delivery</span>
              </button>
              <button
                type="button"
                onClick={() => setBottomTab("attachments")}
                className={`px-3 py-2 border-b-2 transition cursor-pointer flex items-center space-x-1.5 ${
                  bottomTab === "attachments" ? "border-indigo-500 text-indigo-400" : "border-transparent text-slate-400 hover:text-slate-200"
                }`}
              >
                <Paperclip size={14} />
                <span>Attachments</span>
              </button>
            </div>

            {bottomTab === "notes" && (
              <div className="space-y-3 text-xs">
                <textarea
                  rows={3}
                  value={invoiceNotes}
                  onChange={(e) => setInvoiceNotes(e.target.value)}
                  placeholder="Add customer notes, payment terms, or special instructions..."
                  className="w-full bg-[#0E131F] border border-[#1E293B] rounded-xl p-3 text-xs text-white focus:outline-none"
                />
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Terms: Payment due within 30 days. Statutory GST output tax applied per Government of India rules.
                </p>
              </div>
            )}

            {bottomTab === "delivery" && (
              <div className="space-y-3 text-xs">
                <div>
                  <label className="text-[10px] font-mono text-slate-400 block mb-1">Shipping Address</label>
                  <input
                    type="text"
                    placeholder="Enter destination shipping address..."
                    className="w-full bg-[#0E131F] border border-[#1E293B] rounded-xl p-2.5 text-xs text-white"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-mono text-slate-400 block mb-1">eWay Bill</label>
                    <input
                      type="text"
                      value={invoiceEWayBill}
                      onChange={(e) => setInvoiceEWayBill(e.target.value)}
                      placeholder="12-digit number"
                      className="w-full bg-[#0E131F] border border-[#1E293B] rounded-xl p-2 text-xs text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-mono text-slate-400 block mb-1">Transporter</label>
                    <input
                      type="text"
                      value={transporterName}
                      onChange={(e) => setTransporterName(e.target.value)}
                      placeholder="Carrier name"
                      className="w-full bg-[#0E131F] border border-[#1E293B] rounded-xl p-2 text-xs text-white"
                    />
                  </div>
                </div>
              </div>
            )}

            {bottomTab === "attachments" && (
              <div className="space-y-3 text-xs">
                <div className="border-2 border-dashed border-[#1E293B] rounded-xl p-6 text-center text-slate-500 hover:border-slate-600 transition cursor-pointer">
                  <Paperclip size={20} className="mx-auto mb-2 text-slate-400" />
                  <span>Click to attach Purchase Order (PO), LR receipt, or documents</span>
                </div>
              </div>
            )}
          </div>

          {/* RIGHT COLUMN: INVOICE SUMMARY */}
          <div className="bg-[#121824] border border-[#1E293B] rounded-xl p-4 space-y-3 text-xs">
            <h4 className="font-bold text-xs text-indigo-400 font-mono uppercase tracking-wider border-b border-[#1E293B] pb-2">
              Invoice Summary
            </h4>

            <div className="space-y-2.5">
              <div className="flex justify-between text-slate-300">
                <span>Subtotal:</span>
                <span className="font-mono font-semibold text-white">₹{invoiceTotals.taxable.toLocaleString("en-IN")}</span>
              </div>

              <div className="flex justify-between items-center text-slate-300">
                <span>Discount (%):</span>
                <div className="flex items-center space-x-2">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={discountPercent}
                    onChange={(e) => setDiscountPercent(Math.max(0, parseFloat(e.target.value) || 0))}
                    className="w-16 bg-[#0E131F] border border-[#1E293B] rounded px-2 py-0.5 text-right font-mono text-xs text-amber-400"
                  />
                  <span className="font-mono font-semibold text-amber-400">₹{totalDiscountAmount.toFixed(2)}</span>
                </div>
              </div>

              <div className="flex justify-between text-slate-300">
                <span>GST Tax (CGST+SGST/IGST):</span>
                <span className="font-mono text-emerald-400">₹{totalGst.toLocaleString("en-IN")}</span>
              </div>

              <div className="flex justify-between items-center text-slate-300">
                <span>Round Off:</span>
                <input
                  type="number"
                  step="0.01"
                  value={roundOff}
                  onChange={(e) => setRoundOff(parseFloat(e.target.value) || 0)}
                  className="w-20 bg-[#0E131F] border border-[#1E293B] rounded px-2 py-0.5 text-right font-mono text-xs text-white"
                />
              </div>

              <div className="pt-3 border-t border-[#1E293B] flex justify-between items-center text-sm font-bold">
                <span className="text-white">Grand Total:</span>
                <span className="font-mono text-xl text-emerald-400">₹{Math.round(computedGrandTotal).toLocaleString("en-IN")}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ─── 6. BOTTOM ACTION COMMAND TOOLBAR ─── */}
      <div className="bg-[#161E2E] px-6 py-3 border-t border-[#1E293B] flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={() => setInvoiceStatus("Draft")}
            className="px-3.5 py-1.5 bg-[#1E293B] hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg transition cursor-pointer flex items-center space-x-1.5"
          >
            <Save size={14} />
            <span>Save</span>
          </button>
          <button
            type="button"
            className="px-3.5 py-1.5 bg-amber-950/40 hover:bg-amber-900/60 border border-amber-500/40 text-amber-300 text-xs font-semibold rounded-lg transition cursor-pointer flex items-center space-x-1.5"
          >
            <PauseCircle size={14} />
            <span>Hold</span>
          </button>
          <button
            type="button"
            className="px-3.5 py-1.5 bg-[#1E293B] hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg transition cursor-pointer flex items-center space-x-1.5"
          >
            <Printer size={14} />
            <span>Print</span>
          </button>
          <button
            type="button"
            className="px-3.5 py-1.5 bg-[#1E293B] hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg transition cursor-pointer flex items-center space-x-1.5"
          >
            <FileText size={14} />
            <span>PDF</span>
          </button>
          <button
            type="button"
            className="px-3.5 py-1.5 bg-[#1E293B] hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg transition cursor-pointer flex items-center space-x-1.5"
          >
            <Share2 size={14} />
            <span>WhatsApp</span>
          </button>
        </div>

        <div className="flex items-center space-x-2">
          <button
            type="button"
            className="px-4 py-1.5 bg-indigo-950/60 border border-indigo-500/40 hover:bg-indigo-900/80 text-indigo-300 text-xs font-bold rounded-lg transition cursor-pointer flex items-center space-x-1.5"
          >
            <CreditCard size={14} />
            <span>Payment</span>
          </button>
          <button
            type="button"
            onClick={(e) => {
              setInvoiceStatus("Approved");
              handleCreateInvoiceSubmit(e as any);
            }}
            className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg shadow-lg transition flex items-center space-x-1.5 cursor-pointer"
          >
            <CheckCircle2 size={15} />
            <span>Submit</span>
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-1.5 bg-[#1E293B] hover:bg-slate-700 text-slate-400 hover:text-white text-xs font-semibold rounded-lg transition cursor-pointer"
          >
            More ▼
          </button>
        </div>
      </div>
    </div>
  );
};
