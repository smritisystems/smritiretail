/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.18.0
 * Created      : 2026-09-11
 * Modified     : 2026-09-11
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 * Source Module: Invoicing & Commercial Transaction Browser (Read-Only Terminal Integration)
 */

import React, { useState, useEffect, useMemo } from "react";
import { 
  X, 
  Search, 
  FileText, 
  Printer, 
  Eye, 
  RefreshCw, 
  Clock, 
  ShoppingBag, 
  RotateCcw, 
  AlertTriangle, 
  PauseCircle,
  Filter,
  Download,
  Building2,
  Calendar,
  CheckCircle2
} from "lucide-react";
import { apiFetchV1 } from "../../lib/apiFetchV1.ts";
import { withCapability } from "../../types/architecture.ts";

export type InvoicingBrowserTab = 
  | "INVOICES" 
  | "ORDERS" 
  | "RETURNS" 
  | "CANCELLED" 
  | "SUSPENDED";

export interface InvoicingTransactionBrowserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectDocument: (docType: InvoicingBrowserTab, doc: any) => void;
  onPrintPdf?: (docId: string) => void;
  onNotification?: (title: string, msg: string, type: "success" | "error" | "info" | "warning") => void;
}

const InvoicingTransactionBrowserModalBase: React.FC<InvoicingTransactionBrowserModalProps> = ({
  isOpen,
  onClose,
  onSelectDocument,
  onPrintPdf,
  onNotification
}) => {
  const [activeTab, setActiveTab] = useState<InvoicingBrowserTab>("INVOICES");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Loaded Data Pools
  const [invoices, setInvoices] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [returns, setReturns] = useState<any[]>([]);
  const [suspended, setSuspended] = useState<any[]>([]);

  // Fetch Live Data
  const fetchData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      if (activeTab === "INVOICES" || activeTab === "CANCELLED") {
        const res = await apiFetchV1<any>("/sales/invoices?page_size=100");
        const list = Array.isArray(res) ? res : (res?.items || res?.data || []);
        setInvoices(list);
      } else if (activeTab === "ORDERS") {
        const [ordersRes, posRes] = await Promise.allSettled([
          apiFetchV1<any[]>("/sales/orders"),
          apiFetchV1<any[]>("/sales/customer-pos?status=ALL")
        ]);
        const orderList = ordersRes.status === "fulfilled" && Array.isArray(ordersRes.value) ? ordersRes.value : [];
        const poList = posRes.status === "fulfilled" && Array.isArray(posRes.value) ? posRes.value : [];
        setOrders([...orderList, ...poList]);
      } else if (activeTab === "RETURNS") {
        const res = await apiFetchV1<any>("/sales/returns");
        const list = Array.isArray(res) ? res : (res?.items || []);
        setReturns(list);
      } else if (activeTab === "SUSPENDED") {
        const res = await apiFetchV1<any>("/sales/invoices/suspended");
        const list = Array.isArray(res) ? res : (res?.items || []);
        setSuspended(list);
      }
    } catch (err: any) {
      console.error("[InvoicingBrowser] Failed to fetch documents:", err);
      setError(err?.message || "Failed to load transactions.");
      onNotification?.("Error", "Unable to load transactions from backend.", "error");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      void fetchData();
    }
  }, [isOpen, activeTab]);

  // Filtered rows
  const filteredRows = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    if (activeTab === "INVOICES") {
      const activeInvoices = invoices.filter(inv => String(inv.status || "").toUpperCase() !== "CANCELLED");
      if (!term) return activeInvoices;
      return activeInvoices.filter(inv => 
        String(inv.invoice_no || "").toLowerCase().includes(term) ||
        String(inv.customer_name || "").toLowerCase().includes(term) ||
        String(inv.delivery_store_code || "").toLowerCase().includes(term) ||
        String(inv.date || "").toLowerCase().includes(term)
      );
    }

    if (activeTab === "CANCELLED") {
      const cancelled = invoices.filter(inv => String(inv.status || "").toUpperCase() === "CANCELLED");
      if (!term) return cancelled;
      return cancelled.filter(inv => 
        String(inv.invoice_no || "").toLowerCase().includes(term) ||
        String(inv.customer_name || "").toLowerCase().includes(term) ||
        String(inv.date || "").toLowerCase().includes(term)
      );
    }

    if (activeTab === "ORDERS") {
      if (!term) return orders;
      return orders.filter(o => 
        String(o.order_no || o.po_number || "").toLowerCase().includes(term) ||
        String(o.customer_name || "").toLowerCase().includes(term) ||
        String(o.site_code || "").toLowerCase().includes(term) ||
        String(o.date || "").toLowerCase().includes(term)
      );
    }

    if (activeTab === "RETURNS") {
      if (!term) return returns;
      return returns.filter(r => 
        String(r.return_no || r.credit_note_number || "").toLowerCase().includes(term) ||
        String(r.customer_name || "").toLowerCase().includes(term) ||
        String(r.date || "").toLowerCase().includes(term)
      );
    }

    if (activeTab === "SUSPENDED") {
      if (!term) return suspended;
      return suspended.filter(s => 
        String(s.invoice_no || "").toLowerCase().includes(term) ||
        String(s.customer_name || "").toLowerCase().includes(term) ||
        String(s.date || "").toLowerCase().includes(term)
      );
    }

    return [];
  }, [activeTab, searchTerm, invoices, orders, returns, suspended]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-surface dark:bg-[#191c1e] text-on-surface dark:text-[#eff1f3] rounded-2xl shadow-2xl w-full max-w-5xl border border-outline-variant dark:border-[#444653] overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Modal Header */}
        <div className="bg-surface-container-lowest dark:bg-[#131b2e] px-6 py-4 border-b border-outline-variant dark:border-[#444653] flex justify-between items-center shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 text-primary rounded-xl">
              <FileText size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-on-surface dark:text-white">
                  Invoicing & Commercial Transactions
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20 uppercase tracking-wider">
                  Read-Only Audit Mode
                </span>
              </div>
              <p className="text-xs text-on-surface-variant dark:text-[#bec6e0]">
                Search, inspect, and load finalized tax invoices, PO allocations, and returns into the billing workspace.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={fetchData}
              disabled={isLoading}
              className="p-2 hover:bg-surface-container-high rounded-lg text-on-surface-variant transition disabled:opacity-50"
              title="Refresh Transactions"
            >
              <RefreshCw size={16} className={isLoading ? "animate-spin" : ""} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 hover:bg-surface-container-high rounded-lg text-on-surface-variant transition"
              title="Close [Esc]"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Tab Navigation Strip */}
        <div className="bg-surface-container-low dark:bg-[#15191c] px-6 pt-3 border-b border-outline-variant dark:border-[#33383f] flex items-center gap-2 shrink-0 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab("INVOICES")}
            className={`px-4 py-2.5 rounded-t-xl text-xs font-bold transition flex items-center gap-2 border-b-2 ${
              activeTab === "INVOICES"
                ? "border-primary text-primary bg-surface dark:bg-[#191c1e]"
                : "border-transparent text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high/50"
            }`}
          >
            <FileText size={14} />
            <span>Tax Invoices</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-primary/10 text-primary">
              {invoices.filter(i => String(i.status || "").toUpperCase() !== "CANCELLED").length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("ORDERS")}
            className={`px-4 py-2.5 rounded-t-xl text-xs font-bold transition flex items-center gap-2 border-b-2 ${
              activeTab === "ORDERS"
                ? "border-primary text-primary bg-surface dark:bg-[#191c1e]"
                : "border-transparent text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high/50"
            }`}
          >
            <ShoppingBag size={14} />
            <span>Customer POs & Orders</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-primary/10 text-primary">
              {orders.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("RETURNS")}
            className={`px-4 py-2.5 rounded-t-xl text-xs font-bold transition flex items-center gap-2 border-b-2 ${
              activeTab === "RETURNS"
                ? "border-primary text-primary bg-surface dark:bg-[#191c1e]"
                : "border-transparent text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high/50"
            }`}
          >
            <RotateCcw size={14} />
            <span>Returns & Credit Notes</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-primary/10 text-primary">
              {returns.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("CANCELLED")}
            className={`px-4 py-2.5 rounded-t-xl text-xs font-bold transition flex items-center gap-2 border-b-2 ${
              activeTab === "CANCELLED"
                ? "border-primary text-primary bg-surface dark:bg-[#191c1e]"
                : "border-transparent text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high/50"
            }`}
          >
            <AlertTriangle size={14} className="text-error" />
            <span>Cancelled Invoices</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-error/10 text-error">
              {invoices.filter(i => String(i.status || "").toUpperCase() === "CANCELLED").length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("SUSPENDED")}
            className={`px-4 py-2.5 rounded-t-xl text-xs font-bold transition flex items-center gap-2 border-b-2 ${
              activeTab === "SUSPENDED"
                ? "border-primary text-primary bg-surface dark:bg-[#191c1e]"
                : "border-transparent text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high/50"
            }`}
          >
            <PauseCircle size={14} />
            <span>Held Bills</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-500/10 text-amber-700">
              {suspended.length}
            </span>
          </button>
        </div>

        {/* Toolbar & Search */}
        <div className="px-6 py-3 bg-surface-container-lowest dark:bg-[#191c1e] border-b border-outline-variant dark:border-[#33383f] flex items-center justify-between gap-4 shrink-0">
          <div className="relative flex-1 max-w-md">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by Document No, Customer, Store Code, or Date..."
              className="w-full pl-9 pr-4 py-2 bg-surface-container-low dark:bg-[#25292e] border border-outline-variant dark:border-[#444653] rounded-xl text-xs focus:ring-2 focus:ring-primary focus:border-transparent outline-hidden font-sans"
              autoFocus
            />
          </div>
          <div className="text-xs text-on-surface-variant font-medium">
            Showing <strong className="text-on-surface font-mono">{filteredRows.length}</strong> transactions
          </div>
        </div>

        {/* Data Grid Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {isLoading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-3 text-on-surface-variant">
              <RefreshCw size={24} className="animate-spin text-primary" />
              <span className="text-xs font-semibold">Loading commercial transactions from database...</span>
            </div>
          ) : error ? (
            <div className="p-4 bg-error/10 text-error border border-error/20 rounded-xl text-xs text-center">
              {error}
            </div>
          ) : filteredRows.length === 0 ? (
            <div className="py-16 text-center text-xs text-on-surface-variant space-y-2">
              <FileText size={32} className="mx-auto opacity-30" />
              <p className="font-semibold">No transactions found matching criteria.</p>
              <p className="text-[11px]">Try adjusting your search query or switch tabs.</p>
            </div>
          ) : (
            <div className="border border-outline-variant dark:border-[#33383f] rounded-xl overflow-hidden shadow-xs">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-surface-container-high dark:bg-[#25292e] text-on-surface-variant font-bold border-b border-outline-variant dark:border-[#33383f]">
                  <tr>
                    <th className="py-2.5 px-3">Doc Number</th>
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Customer / Party</th>
                    {activeTab === "INVOICES" && <th className="py-2.5 px-3">Store / POS</th>}
                    {activeTab === "ORDERS" && <th className="py-2.5 px-3">Quantities (Tot/Bld/Pnd)</th>}
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3 text-right">Grand Total</th>
                    <th className="py-2.5 px-3 text-center">Audit Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/60 dark:divide-[#33383f]">
                  {filteredRows.map((row, idx) => {
                    const docId = row.id;
                    const docNo = row.invoice_no || row.order_no || row.return_no || row.po_number || `DOC-${idx + 1}`;
                    const docDate = row.date || row.billDate || row.created_at?.split("T")[0] || "—";
                    const custName = row.customer_name || row.customer?.name || "Counter Walk-in";
                    const status = String(row.status || "Completed");
                    const grandTotal = Number(row.grand_total || row.netAmount || row.total_amount || 0);

                    return (
                      <tr 
                        key={docId || idx}
                        className="hover:bg-surface-container-low/70 dark:hover:bg-[#25292e]/60 transition-colors"
                      >
                        <td className="py-2.5 px-3 font-mono font-bold text-primary">
                          {docNo}
                        </td>
                        <td className="py-2.5 px-3 text-on-surface-variant whitespace-nowrap font-mono text-[11px]">
                          {docDate}
                        </td>
                        <td className="py-2.5 px-3 font-medium text-on-surface max-w-[200px] truncate" title={custName}>
                          {custName}
                        </td>

                        {activeTab === "INVOICES" && (
                          <td className="py-2.5 px-3 font-mono text-on-surface-variant text-[11px]">
                            {row.delivery_store_code ? (
                              <span className="px-1.5 py-0.5 bg-secondary-container/30 text-secondary rounded">
                                {row.delivery_store_code}
                              </span>
                            ) : (
                              row.pos_state || "27-MH"
                            )}
                          </td>
                        )}

                        {activeTab === "ORDERS" && (
                          <td className="py-2.5 px-3 font-mono text-[11px]">
                            <span className="text-on-surface font-bold">{Number(row.total_qty || 0).toFixed(0)}</span>
                            <span className="text-on-surface-variant"> / </span>
                            <span className="text-emerald-600 font-bold">{Number(row.billed_qty || 0).toFixed(0)}</span>
                            <span className="text-on-surface-variant"> / </span>
                            <span className="text-amber-600 font-bold">{Number(row.pending_qty || 0).toFixed(0)}</span>
                          </td>
                        )}

                        <td className="py-2.5 px-3">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            status.toUpperCase() === "CANCELLED"
                              ? "bg-error/10 text-error"
                              : status.toUpperCase() === "SUBMITTED" || status.toUpperCase() === "COMPLETED"
                              ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                              : "bg-primary/10 text-primary"
                          }`}>
                            {status}
                          </span>
                        </td>

                        <td className="py-2.5 px-3 text-right font-mono font-bold text-on-surface">
                          ₹{grandTotal.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>

                        <td className="py-2.5 px-3">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                onSelectDocument(activeTab, row);
                                onClose();
                              }}
                              className="px-2 py-1 bg-primary/10 hover:bg-primary text-primary hover:text-on-primary rounded text-[11px] font-bold transition flex items-center gap-1"
                              title="Load document into Billing Terminal in Read-Only Mode"
                            >
                              <Eye size={12} />
                              <span>Inspect</span>
                            </button>

                            {onPrintPdf && (
                              <button
                                type="button"
                                onClick={() => onPrintPdf(docId)}
                                className="p-1 hover:bg-surface-container-high rounded text-on-surface-variant transition"
                                title="Print / Download PDF"
                              >
                                <Printer size={14} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="bg-surface-container-lowest dark:bg-[#131b2e] px-6 py-3 border-t border-outline-variant dark:border-[#444653] flex justify-between items-center shrink-0 text-xs">
          <div className="flex items-center gap-2 text-on-surface-variant">
            <CheckCircle2 size={14} className="text-emerald-600" />
            <span>Selecting any transaction loads a synchronized, immutable snapshot into the Billing Terminal.</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-surface-container border border-outline-variant hover:bg-surface-container-high rounded-xl text-xs font-semibold text-primary transition"
          >
            Close [Esc]
          </button>
        </div>

      </div>
    </div>
  );
};

export const InvoicingTransactionBrowserModal = withCapability(InvoicingTransactionBrowserModalBase, {
  entity: "sales_invoice",
  capability: "sales_invoice.transaction_browser",
  role: "SPECIALIZED_UI",
  canonicalOwner: "BillingTerm.tsx",
  decisionId: "ADR-INV-01",
});

export default InvoicingTransactionBrowserModal;
