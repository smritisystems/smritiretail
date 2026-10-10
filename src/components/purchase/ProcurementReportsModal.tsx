/**
 * Project      : SMRITI Retail OS
 * Module       : Procurement Reports & Audit Studio Modal
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.53.0
 * Created      : 2026-10-02
 * Modified     : 2026-10-02
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 * Capability   : @SmritiCapability("PROCUREMENT", "REPORTS_STUDIO")
 */

import React, { useState, useEffect, useCallback } from "react";
import { apiFetchV1 } from "../../lib/apiFetchV1";
import {
  X,
  RefreshCw,
  Search,
  Truck,
  Building2,
  FileSpreadsheet,
  AlertCircle,
  ExternalLink,
  Receipt,
  Download,
} from "lucide-react";

export interface ProcurementReportsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateTab?: (tab: string) => void;
  onReceivePO?: (po: any) => void;
}

interface PendingDeliveryOrder {
  order_id: string;
  order_no: string;
  supplier_id: string;
  supplier_name: string;
  status: string;
  created_at?: string;
}

interface SupplierOutstandingRow {
  supplier_id: string;
  supplier_name: string;
  supplier_code?: string;
  order_count: number;
  total_outstanding: number;
  open_statuses: string[];
}

interface PurchaseSummaryRow {
  supplier_id: string;
  supplier_name: string;
  supplier_code: string;
  po_count: number;
  grn_count: number;
  ordered_amount: number;
  received_amount: number;
}

export const ProcurementReportsModal: React.FC<ProcurementReportsModalProps> = ({
  isOpen,
  onClose,
  onNavigateTab,
  onReceivePO,
}) => {
  const [activeTab, setActiveTab] = useState<"pending" | "outstanding" | "summary">("pending");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Data states
  const [pendingOrders, setPendingOrders] = useState<PendingDeliveryOrder[]>([]);
  const [outstandingSuppliers, setOutstandingSuppliers] = useState<SupplierOutstandingRow[]>([]);
  const [summaryRows, setSummaryRows] = useState<PurchaseSummaryRow[]>([]);

  const fetchReports = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (activeTab === "pending") {
        const res = await apiFetchV1("/purchase/reports/pending-delivery");
        setPendingOrders(Array.isArray(res) ? res : []);
      } else if (activeTab === "outstanding") {
        const res = await apiFetchV1("/purchase/reports/outstanding");
        setOutstandingSuppliers(Array.isArray(res) ? res : []);
      } else if (activeTab === "summary") {
        const res = await apiFetchV1("/reports/purchase-summary");
        setSummaryRows(Array.isArray(res) ? res : []);
      }
    } catch (err: any) {
      setError(err?.message || "Failed to load procurement reports.");
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    if (isOpen) {
      fetchReports();
    }
  }, [isOpen, fetchReports]);

  if (!isOpen) return null;

  const fmtCurrency = (n: number) =>
    "₹" + Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const fmtDate = (d?: string) => {
    if (!d) return "—";
    try {
      return new Date(d).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    } catch {
      return d;
    }
  };

  const handleReceivePO = (orderId: string) => {
    try {
      if (onReceivePO) {
        onReceivePO(orderId);
        onClose();
        return;
      }
      sessionStorage.setItem("smriti_grn_selected_po", orderId);
      window.dispatchEvent(
        new CustomEvent("smriti_navigate_module", {
          detail: { moduleId: "grn-studio" },
        })
      );
      onClose();
    } catch {
      onNavigateTab?.("grn-studio");
      onClose();
    }
  };

  const handleOpenVendor = () => {
    try {
      window.dispatchEvent(
        new CustomEvent("smriti_navigate_module", {
          detail: { moduleId: "vendor-360" },
        })
      );
      onClose();
    } catch {
      onNavigateTab?.("vendor-360");
      onClose();
    }
  };

  // Filtered rows
  const filteredPending = pendingOrders.filter(
    (o) =>
      o.order_no.toLowerCase().includes(search.toLowerCase()) ||
      o.supplier_name.toLowerCase().includes(search.toLowerCase())
  );

  const filteredOutstanding = outstandingSuppliers.filter(
    (s) =>
      s.supplier_name.toLowerCase().includes(search.toLowerCase()) ||
      (s.supplier_code && s.supplier_code.toLowerCase().includes(search.toLowerCase()))
  );

  const filteredSummary = summaryRows.filter(
    (r) =>
      r.supplier_name.toLowerCase().includes(search.toLowerCase()) ||
      r.supplier_code.toLowerCase().includes(search.toLowerCase())
  );

  const totalOutstandingAmount = outstandingSuppliers.reduce((acc, s) => acc + (s.total_outstanding || 0), 0);
  const totalReceivedValue = summaryRows.reduce((acc, r) => acc + (r.received_amount || 0), 0);
  const totalOrderedValue = summaryRows.reduce((acc, r) => acc + (r.ordered_amount || 0), 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-5xl h-[88vh] bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-white">
        {/* Header */}
        <div className="px-5 py-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
              <FileSpreadsheet size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-wide">
                  Procurement Reports &amp; Audit Studio
                </h2>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-indigo-950 border border-indigo-700/60 text-indigo-300">
                  SSOT v6.53.0
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Authoritative pipeline audit: Pending Inwards, Supplier Liabilities &amp; Purchase Summary
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* KPI Strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 px-5 py-3 bg-slate-950/60 border-b border-slate-800 shrink-0">
          <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-700/50">
            <div className="text-[10px] font-semibold uppercase text-slate-400">Pending Delivery POs</div>
            <div className="text-lg font-extrabold text-amber-400 mt-0.5">{pendingOrders.length}</div>
            <div className="text-[10px] text-slate-400 mt-0.5">Awaiting GRN receipt</div>
          </div>
          <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-700/50">
            <div className="text-[10px] font-semibold uppercase text-slate-400">Suppliers with Liability</div>
            <div className="text-lg font-extrabold text-indigo-400 mt-0.5">{outstandingSuppliers.length}</div>
            <div className="text-[10px] text-slate-400 mt-0.5">Active commercial balances</div>
          </div>
          <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-700/50">
            <div className="text-[10px] font-semibold uppercase text-slate-400">Total Outstanding (2010 AP)</div>
            <div className="text-lg font-extrabold text-rose-400 font-mono mt-0.5">
              {fmtCurrency(totalOutstandingAmount)}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">Accounts payable exposure</div>
          </div>
          <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-700/50">
            <div className="text-[10px] font-semibold uppercase text-slate-400">Received Inward Value</div>
            <div className="text-lg font-extrabold text-emerald-400 font-mono mt-0.5">
              {fmtCurrency(totalReceivedValue || totalOrderedValue)}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">Verified GRN assets</div>
          </div>
        </div>

        {/* Tabs & Search Toolbar */}
        <div className="px-5 py-2.5 bg-slate-900 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800">
            <button
              type="button"
              onClick={() => setActiveTab("pending")}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeTab === "pending"
                  ? "bg-amber-600/30 text-amber-300 border border-amber-500/40"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Truck size={14} />
              <span>Pending Delivery ({pendingOrders.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("outstanding")}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeTab === "outstanding"
                  ? "bg-indigo-600/30 text-indigo-300 border border-indigo-500/40"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Building2 size={14} />
              <span>Supplier Outstanding ({outstandingSuppliers.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("summary")}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeTab === "summary"
                  ? "bg-emerald-600/30 text-emerald-300 border border-emerald-500/40"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Receipt size={14} />
              <span>Purchase Summary Register</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" size={13} />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search report rows..."
                className="bg-slate-950 border border-slate-700/80 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 w-48 md:w-60"
              />
            </div>
            <button
              type="button"
              onClick={fetchReports}
              className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
              title="Refresh Report"
            >
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            </button>
          </div>
        </div>

        {/* Report Content Body */}
        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4">
          {error && (
            <div className="p-3 mb-3 rounded-xl bg-rose-950/40 border border-rose-800 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle size={15} />
              <span>{error}</span>
            </div>
          )}

          {loading ? (
            <div className="flex flex-col items-center justify-center h-56 gap-3 text-slate-400">
              <RefreshCw size={24} className="animate-spin text-indigo-400" />
              <p className="text-xs">Querying authoritative procurement ledger...</p>
            </div>
          ) : (
            <>
              {/* Tab 1: Pending Delivery POs */}
              {activeTab === "pending" && (
                <div className="space-y-2">
                  {filteredPending.length === 0 ? (
                    <div className="text-center py-16 text-slate-500 text-xs">
                      No pending delivery purchase orders found. All confirmed orders have been inwarded.
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-xl border border-slate-800">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-slate-950 text-slate-400 font-semibold border-b border-slate-800">
                          <tr>
                            <th className="py-2.5 px-3">PO Number</th>
                            <th className="py-2.5 px-3">Supplier Name</th>
                            <th className="py-2.5 px-3">Order Date</th>
                            <th className="py-2.5 px-3">Status</th>
                            <th className="py-2.5 px-3 text-right">Inward Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60 font-mono">
                          {filteredPending.map((po) => (
                            <tr key={po.order_id} className="hover:bg-slate-800/30 transition">
                              <td className="py-2.5 px-3 font-bold text-indigo-400">{po.order_no}</td>
                              <td className="py-2.5 px-3 font-sans text-slate-200">{po.supplier_name}</td>
                              <td className="py-2.5 px-3 text-slate-400">{fmtDate(po.created_at)}</td>
                              <td className="py-2.5 px-3 font-sans">
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-950 text-amber-300 border border-amber-700/50">
                                  {po.status}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-right font-sans">
                                <button
                                  type="button"
                                  onClick={() => handleReceivePO(po.order_id)}
                                  className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-bold shadow-xs transition"
                                >
                                  <Truck size={12} />
                                  <span>Receive in GRN</span>
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* Tab 2: Supplier Outstanding */}
              {activeTab === "outstanding" && (
                <div className="space-y-2">
                  {filteredOutstanding.length === 0 ? (
                    <div className="text-center py-16 text-slate-500 text-xs">
                      No supplier outstanding records found.
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-xl border border-slate-800">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-slate-950 text-slate-400 font-semibold border-b border-slate-800">
                          <tr>
                            <th className="py-2.5 px-3">Supplier</th>
                            <th className="py-2.5 px-3 text-center">Open PO Count</th>
                            <th className="py-2.5 px-3">Statuses</th>
                            <th className="py-2.5 px-3 text-right">Outstanding (2010 AP)</th>
                            <th className="py-2.5 px-3 text-right">Vendor 360</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60 font-mono">
                          {filteredOutstanding.map((sup) => (
                            <tr key={sup.supplier_id} className="hover:bg-slate-800/30 transition">
                              <td className="py-2.5 px-3 font-sans text-slate-200 font-semibold">
                                {sup.supplier_name}
                                {sup.supplier_code && (
                                  <span className="text-[10px] text-slate-500 font-mono ml-1.5">
                                    [{sup.supplier_code}]
                                  </span>
                                )}
                              </td>
                              <td className="py-2.5 px-3 text-center text-slate-300">{sup.order_count}</td>
                              <td className="py-2.5 px-3 font-sans">
                                <div className="flex gap-1">
                                  {sup.open_statuses.map((st) => (
                                    <span
                                      key={st}
                                      className="px-1.5 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300 border border-slate-700"
                                    >
                                      {st}
                                    </span>
                                  ))}
                                </div>
                              </td>
                              <td className="py-2.5 px-3 text-right font-bold text-rose-400">
                                {fmtCurrency(sup.total_outstanding)}
                              </td>
                              <td className="py-2.5 px-3 text-right font-sans">
                                <button
                                  type="button"
                                  onClick={handleOpenVendor}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] transition"
                                >
                                  <ExternalLink size={11} />
                                  <span>View Ledger</span>
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* Tab 3: Purchase Summary Register */}
              {activeTab === "summary" && (
                <div className="space-y-2">
                  {filteredSummary.length === 0 ? (
                    <div className="text-center py-16 text-slate-500 text-xs">
                      No purchase register summary data available for current period.
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-xl border border-slate-800">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-slate-950 text-slate-400 font-semibold border-b border-slate-800">
                          <tr>
                            <th className="py-2.5 px-3">Supplier</th>
                            <th className="py-2.5 px-3 text-center">PO Count</th>
                            <th className="py-2.5 px-3 text-center">GRN Count</th>
                            <th className="py-2.5 px-3 text-right">Ordered Value</th>
                            <th className="py-2.5 px-3 text-right">Received Inward Value</th>
                            <th className="py-2.5 px-3 text-right">Variance</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60 font-mono">
                          {filteredSummary.map((r) => {
                            const variance = r.ordered_amount - r.received_amount;
                            return (
                              <tr key={r.supplier_id} className="hover:bg-slate-800/30 transition">
                                <td className="py-2.5 px-3 font-sans text-slate-200 font-semibold">
                                  {r.supplier_name}
                                  <span className="text-[10px] text-slate-500 font-mono ml-1.5">
                                    [{r.supplier_code}]
                                  </span>
                                </td>
                                <td className="py-2.5 px-3 text-center text-slate-300">{r.po_count}</td>
                                <td className="py-2.5 px-3 text-center text-indigo-400 font-bold">{r.grn_count}</td>
                                <td className="py-2.5 px-3 text-right text-slate-300">
                                  {fmtCurrency(r.ordered_amount)}
                                </td>
                                <td className="py-2.5 px-3 text-right font-bold text-emerald-400">
                                  {fmtCurrency(r.received_amount)}
                                </td>
                                <td
                                  className={`py-2.5 px-3 text-right ${
                                    Math.abs(variance) < 0.01 ? "text-slate-500" : "text-amber-400"
                                  }`}
                                >
                                  {fmtCurrency(variance)}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400 shrink-0">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>FastAPI Unified Accounting Ledger Authority Synchronized</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
