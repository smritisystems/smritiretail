/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.120.0
 * Created      : 2026-08-28
 * Modified     : 2026-08-28
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import React, { useState, useMemo } from "react";
import SalesReturnEngine, {
  SalesReturnOrder, ReturnOrderStatus, ReturnOrderType, RestockDecision,
} from "../../utils/salesReturnEngine";

interface SalesReturnModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNotification?: (title: string, msg: string, type: "success" | "error" | "info") => void;
}

const STATUS_STYLE: Record<ReturnOrderStatus, string> = {
  DRAFT:      "text-slate-300 bg-slate-700/20 border-slate-600/30",
  APPROVED:   "text-emerald-300 bg-emerald-500/15 border-emerald-500/25",
  REFUNDED:   "text-teal-300 bg-teal-500/15 border-teal-500/25",
  EXCHANGED:  "text-sky-300 bg-sky-500/15 border-sky-500/25",
  REJECTED:   "text-rose-300 bg-rose-500/15 border-rose-500/25",
};

const RESTOCK_STYLE: Record<RestockDecision, string> = {
  RESALEABLE: "text-emerald-400",
  DAMAGED:    "text-amber-400",
  DISPOSE:    "text-rose-400",
};

const fmt = (n: number) => `₹${n.toLocaleString("en-IN")}`;

function buildSampleOrders(): SalesReturnOrder[] {
  const r1 = SalesReturnEngine.createReturn({
    originalSaleRef: "SALE-INV-20260828-0001", branchCode: "BR-MUM-01",
    createdBy: "CASHIER-001", customerId: "CUST-001", refundMethod: "ORIGINAL_METHOD",
    lines: [
      { sku: "TEE-WHT-L",  productName: "White Tee L",    returnQty: 2, unitPrice: 499,  reason: "SIZE_ISSUE",  restockDecision: "RESALEABLE" },
      { sku: "JNS-BLU-32", productName: "Blue Jeans 32",  returnQty: 1, unitPrice: 1299, reason: "DEFECTIVE",   restockDecision: "DAMAGED" },
    ],
  });

  const e1 = SalesReturnEngine.createExchange({
    originalSaleRef: "SALE-INV-20260828-0002", branchCode: "BR-MUM-01",
    createdBy: "FLOOR-MGR-001",
    returnLines:  [{ sku: "SHIRT-M", productName: "Shirt M", returnQty: 1, unitPrice: 1000, reason: "SIZE_ISSUE", restockDecision: "RESALEABLE" }],
    exchangeLines:[{ sku: "JACKET-L", productName: "Jacket L", exchangeQty: 1, unitPrice: 1500 }],
  });

  return [r1, e1];
}

export const SalesReturnModal: React.FC<SalesReturnModalProps> = ({ isOpen, onClose, onNotification }) => {
  const [orders, setOrders]     = useState<SalesReturnOrder[]>(buildSampleOrders);
  const [selectedId, setSelectedId] = useState(orders[0]?.returnId ?? "");
  const [activeTab, setActiveTab]   = useState<"LINES" | "EXCHANGE" | "AUDIT">("LINES");

  const selected = orders.find((o) => o.returnId === selectedId);
  const summary  = useMemo(() => SalesReturnEngine.returnSummary(orders), [orders]);

  if (!isOpen) return null;

  const updateOrder = (updated: SalesReturnOrder) =>
    setOrders((prev) => prev.map((o) => o.returnId === updated.returnId ? updated : o));

  const handleApprove = () => {
    if (!selected) return;
    try {
      updateOrder(SalesReturnEngine.approve(selected, "FLOOR-MGR"));
      onNotification?.("Approved", `${selected.returnNo} — ${selected.refundMethod}`, "success");
    } catch (e: any) { onNotification?.("Error", e.message, "error"); }
  };

  const handleReject = () => {
    if (!selected) return;
    try {
      updateOrder(SalesReturnEngine.reject(selected, "FLOOR-MGR", "Not eligible for return"));
      onNotification?.("Rejected", selected.returnNo, "error");
    } catch (e: any) { onNotification?.("Error", e.message, "error"); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fadeIn">
      <div className="flex flex-col w-full max-w-5xl max-h-[92vh] bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-2xl">?ï¸</div>
            <div>
              <h2 className="text-base font-bold text-slate-100">Sales Return & Exchange Engine</h2>
              <p className="text-xs text-slate-400">Return Orders · Exchange · Restock · Refund Routing</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {(["LINES", "EXCHANGE", "AUDIT"] as const).map((tab) => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${activeTab === tab ? "bg-orange-500/20 text-orange-300 border border-orange-500/30" : "text-slate-400 hover:text-slate-200"}`}>
                {tab === "EXCHANGE" ? "Exchange Lines" : tab === "AUDIT" ? "Audit" : "Return Lines"}
              </button>
            ))}
            <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 ml-2">
              <span className="material-symbols-outlined text-lg">close</span>
            </button>
          </div>
        </div>

        {/* Summary strip */}
        <div className="flex items-center gap-5 px-6 py-2.5 border-b border-slate-800 bg-slate-950/40 text-xs overflow-x-auto">
          {[
            { label: "Returns",    value: summary.totalReturnOrders,   style: "text-orange-400" },
            { label: "Exchanges",  value: summary.totalExchangeOrders, style: "text-sky-400" },
            { label: "Refunded",   value: fmt(summary.totalRefundedAmt), style: "text-emerald-400 font-black" },
            { label: "Resaleable", value: `${summary.totalResaleableQty} units`, style: "text-emerald-400" },
            { label: "Damaged",    value: `${summary.totalDamagedQty} units`,    style: "text-amber-400" },
            { label: "Dispose",    value: `${summary.totalDisposeQty} units`,    style: "text-rose-400" },
          ].map((m) => (
            <div key={m.label} className="flex items-center gap-1.5 flex-shrink-0">
              <span className="text-slate-600">{m.label}:</span>
              <span className={`font-mono font-bold ${m.style}`}>{m.value}</span>
            </div>
          ))}
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Order sidebar */}
          <div className="w-52 border-r border-slate-800 overflow-y-auto bg-slate-950/30 p-3 space-y-2">
            {orders.map((o) => (
              <button key={o.returnId} onClick={() => { setSelectedId(o.returnId); setActiveTab("LINES"); }}
                className={`w-full text-left p-3 rounded-xl border transition-all ${selectedId === o.returnId ? "bg-orange-950/20 border-orange-500/40" : "border-transparent hover:bg-slate-800/60"}`}>
                <p className="text-[10px] font-mono font-bold text-slate-200 truncate">{o.returnNo}</p>
                <p className="text-[10px] text-slate-500 mt-0.5">{o.originalSaleRef}</p>
                <div className="flex gap-1 mt-1.5 flex-wrap">
                  <span className={`text-[8px] font-bold px-1 py-0.5 rounded-full border ${STATUS_STYLE[o.status]}`}>{o.status}</span>
                  <span className={`text-[8px] font-bold px-1 py-0.5 rounded-full border ${o.orderType === "EXCHANGE" ? "text-sky-300 bg-sky-500/10 border-sky-500/20" : "text-orange-300 bg-orange-500/10 border-orange-500/20"}`}>{o.orderType}</span>
                </div>
                <p className="text-xs font-black font-mono text-orange-400 mt-1">{fmt(o.totalReturnAmt)}</p>
              </button>
            ))}
          </div>

          {selected && (
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {/* Header */}
              <div className="flex items-start justify-between flex-wrap gap-3">
                <div>
                  <p className="text-lg font-bold font-mono text-slate-100">{selected.returnNo}</p>
                  <p className="text-xs text-slate-400">Ref: {selected.originalSaleRef}{selected.customerId ? ` · ${selected.customerId}` : ""}</p>
                  <p className="text-[10px] text-slate-500">Method: {selected.refundMethod}</p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-xs font-bold px-2 py-1 rounded-full border ${STATUS_STYLE[selected.status]}`}>{selected.status}</span>
                  {selected.status === "DRAFT" && <>
                    <button onClick={handleApprove} className="px-3 py-1.5 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-600 rounded-xl">Approve</button>
                    <button onClick={handleReject}  className="px-3 py-1.5 text-xs font-bold text-rose-300 border border-rose-500/30 hover:bg-rose-950/30 rounded-xl">Reject</button>
                  </>}
                </div>
              </div>

              {/* KPI strip */}
              <div className="grid grid-cols-4 gap-3">
                {[
                  { label: "Return Total",   value: fmt(selected.totalReturnAmt),   color: "text-orange-400 font-black" },
                  { label: "Exchange Total", value: fmt(selected.totalExchangeAmt), color: "text-sky-400" },
                  { label: "Price Diff",     value: fmt(Math.abs(selected.priceDifference)), color: selected.priceDifference >= 0 ? "text-amber-400" : "text-emerald-400" },
                  { label: "Refund Amt",     value: fmt(selected.refundAmt),        color: "text-teal-400 font-black" },
                ].map((m) => (
                  <div key={m.label} className="bg-slate-800/30 border border-slate-700/60 rounded-xl p-3 text-center">
                    <div className={`font-bold font-mono ${m.color}`}>{m.value}</div>
                    <div className="text-[10px] text-slate-500 uppercase tracking-wide mt-0.5">{m.label}</div>
                  </div>
                ))}
              </div>

              {activeTab === "LINES" && (
                <div className="bg-slate-950/40 border border-slate-800 rounded-xl overflow-hidden text-xs">
                  <table className="w-full text-left border-collapse">
                    <thead><tr className="text-slate-500 uppercase text-[10px] border-b border-slate-800 bg-slate-950/60">
                      <th className="py-2 px-3">Product</th><th className="py-2 px-3">Reason</th>
                      <th className="py-2 px-3 text-right">Qty</th><th className="py-2 px-3 text-right">Unit</th>
                      <th className="py-2 px-3 text-right">Total</th><th className="py-2 px-3">Restock</th>
                    </tr></thead>
                    <tbody className="divide-y divide-slate-800/40 font-mono">
                      {selected.returnLines.map((l) => (
                        <tr key={l.lineId}>
                          <td className="py-2 px-3 font-sans"><p className="text-xs text-slate-200">{l.productName}</p><p className="text-[10px] text-slate-500">{l.sku}</p></td>
                          <td className="py-2 px-3 font-sans text-[10px] text-slate-400">{l.reason.replace(/_/g, " ")}</td>
                          <td className="py-2 px-3 text-right text-slate-400">{l.returnQty}</td>
                          <td className="py-2 px-3 text-right text-slate-400">{fmt(l.unitPrice)}</td>
                          <td className="py-2 px-3 text-right font-bold text-orange-400">{fmt(l.totalReturnAmt)}</td>
                          <td className="py-2 px-3 font-sans"><span className={`text-[9px] font-bold ${RESTOCK_STYLE[l.restockDecision]}`}>{l.restockDecision}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {activeTab === "EXCHANGE" && selected.exchangeLines.length > 0 && (
                <div className="bg-slate-950/40 border border-slate-800 rounded-xl overflow-hidden text-xs">
                  <table className="w-full text-left border-collapse">
                    <thead><tr className="text-slate-500 uppercase text-[10px] border-b border-slate-800 bg-slate-950/60">
                      <th className="py-2 px-3">New Product</th>
                      <th className="py-2 px-3 text-right">Qty</th><th className="py-2 px-3 text-right">Unit</th><th className="py-2 px-3 text-right">Total</th>
                    </tr></thead>
                    <tbody className="divide-y divide-slate-800/40 font-mono">
                      {selected.exchangeLines.map((l) => (
                        <tr key={l.lineId}>
                          <td className="py-2 px-3 font-sans"><p className="text-xs text-slate-200">{l.productName}</p><p className="text-[10px] text-slate-500">{l.sku}</p></td>
                          <td className="py-2 px-3 text-right text-slate-400">{l.exchangeQty}</td>
                          <td className="py-2 px-3 text-right text-slate-400">{fmt(l.unitPrice)}</td>
                          <td className="py-2 px-3 text-right font-bold text-sky-400">{fmt(l.totalExchangeAmt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className={`flex justify-between px-4 py-3 text-xs border-t border-slate-800 ${selected.priceDifference >= 0 ? "bg-amber-950/10" : "bg-emerald-950/10"}`}>
                    <span className="text-slate-400">Price Difference</span>
                    <span className={`font-bold font-mono ${selected.priceDifference >= 0 ? "text-amber-400" : "text-emerald-400"}`}>
                      {selected.priceDifference >= 0 ? `Customer pays +${fmt(selected.priceDifference)}` : `Refund ${fmt(Math.abs(selected.priceDifference))}`}
                    </span>
                  </div>
                </div>
              )}
              {activeTab === "EXCHANGE" && selected.exchangeLines.length === 0 && (
                <p className="text-slate-500 text-sm text-center py-8">No exchange lines — this is a pure return order.</p>
              )}

              {activeTab === "AUDIT" && (
                <div className="space-y-1.5">
                  {[...selected.auditTrail].reverse().map((e) => (
                    <div key={e.auditId} className="flex items-center gap-3 px-3 py-2 bg-slate-800/30 border border-slate-800/50 rounded-lg text-xs">
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border flex-shrink-0 ${
                        e.action === "APPROVED" || e.action.includes("REFUND") || e.action.includes("EXCHANGE") ? "text-emerald-300 bg-emerald-500/10 border-emerald-500/20"
                        : e.action === "REJECTED" ? "text-rose-300 bg-rose-500/10 border-rose-500/20"
                        : "text-slate-400 bg-slate-700/10 border-slate-600/20"
                      }`}>{e.action.replace(/_/g, " ")}</span>
                      <span className="text-slate-400 flex-1 truncate">{e.note}</span>
                      <span className="text-[10px] text-slate-600 flex-shrink-0">{e.performedBy}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end px-6 py-3 border-t border-slate-800 bg-slate-950/80">
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors">Close</button>
        </div>
      </div>
    </div>
  );
};

export default SalesReturnModal;

