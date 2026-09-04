/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.115.0
 * Created      : 2026-08-28
 * Modified     : 2026-08-28
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import React, { useState } from "react";
import PRTVEngine, { PRTVOrder, PRTVStatus, ReturnReason } from "../../utils/prtvEngine";

interface PRTVModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNotification?: (title: string, msg: string, type: "success" | "error" | "info") => void;
}

const STATUS_STYLE: Record<PRTVStatus, string> = {
  DRAFT:        "text-slate-300 bg-slate-700/15 border-slate-600/25",
  APPROVED:     "text-sky-300 bg-sky-500/15 border-sky-500/25",
  DISPATCHED:   "text-amber-300 bg-amber-500/15 border-amber-500/25",
  ACKNOWLEDGED: "text-teal-300 bg-teal-500/15 border-teal-500/25",
  SETTLED:      "text-emerald-300 bg-emerald-500/15 border-emerald-500/25",
  REJECTED:     "text-rose-300 bg-rose-500/15 border-rose-500/25",
};

const REASON_LABELS: Record<ReturnReason, string> = {
  DEFECTIVE:         "Defective",
  EXCESS_STOCK:      "Excess Stock",
  QUALITY_REJECTION: "Quality Rejection",
  WRONG_ITEM:        "Wrong Item",
  EXPIRED:           "Expired",
  OTHER:             "Other",
};

const fmt = (n: number) => `₹${n.toLocaleString("en-IN")}`;

function buildSampleOrders(): PRTVOrder[] {
  const o1 = PRTVEngine.createReturn({
    vendorId: "VNDR-001", vendorName: "Textile Exports Ltd",
    branchCode: "BR-MUM-01", createdBy: "MGR-001", poRef: "PO-2026-0081",
    lines: [
      { sku: "FAB-DENIM-BLU", productName: "Denim Blue 1m", returnQty: 10, unitCost: 180, taxPct: 5, reason: "DEFECTIVE" },
      { sku: "FAB-LINEN-WHT", productName: "Linen White 1m", returnQty: 5, unitCost: 200, taxPct: 12, reason: "QUALITY_REJECTION" },
    ],
  });
  const o1a = PRTVEngine.approve(o1, "PURCHASE-MGR-001");
  const o1d = PRTVEngine.markDispatched(o1a, "BlueDart", "BD-9812345678", "DISPATCH-001");

  const o2 = PRTVEngine.createReturn({
    vendorId: "VNDR-002", vendorName: "Craft Weaves Pvt Ltd",
    branchCode: "BR-MUM-01", createdBy: "MGR-002",
    lines: [{ sku: "ACC-BELT-BRN", productName: "Leather Belt", returnQty: 3, unitCost: 300, taxPct: 18, reason: "EXCESS_STOCK" }],
  });

  return [o1d, o2];
}

export const PRTVModal: React.FC<PRTVModalProps> = ({ isOpen, onClose, onNotification }) => {
  const [orders, setOrders] = useState<PRTVOrder[]>(buildSampleOrders);
  const [selectedId, setSelectedId] = useState(orders[0]?.prtvId ?? "");
  const [activeTab, setActiveTab] = useState<"LINES" | "DEBIT_NOTE" | "AUDIT">("LINES");

  const selected = orders.find((o) => o.prtvId === selectedId);

  if (!isOpen) return null;

  const update = (updated: PRTVOrder) => {
    setOrders((prev) => prev.map((o) => o.prtvId === updated.prtvId ? updated : o));
  };

  const handleApprove = () => {
    if (!selected) return;
    try { update(PRTVEngine.approve(selected, "PURCHASE-MGR-001")); onNotification?.("Approved", `${selected.prtvNo} — Debit Note generated`, "success"); }
    catch (e: any) { onNotification?.("Error", e.message, "error"); }
  };

  const handleAcknowledge = () => {
    if (!selected) return;
    try { update(PRTVEngine.acknowledge(selected, "VENDOR-PORTAL")); onNotification?.("Acknowledged", `${selected.prtvNo} — Vendor confirmed receipt`, "success"); }
    catch (e: any) { onNotification?.("Error", e.message, "error"); }
  };

  const handleSettle = () => {
    if (!selected) return;
    try {
      update(PRTVEngine.settle(selected, "ACCOUNTS-001", `PAYABLE-${Date.now()}`, selected.netReturnAmt));
      onNotification?.("Settled", `${selected.prtvNo} — ${fmt(selected.netReturnAmt)} settled`, "success");
    } catch (e: any) { onNotification?.("Error", e.message, "error"); }
  };

  const handleReject = () => {
    if (!selected) return;
    try { update(PRTVEngine.reject(selected, "MGR-001", "Vendor dispute — quality contested")); onNotification?.("Rejected", selected.prtvNo, "error"); }
    catch (e: any) { onNotification?.("Error", e.message, "error"); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fadeIn">
      <div className="flex flex-col w-full max-w-5xl max-h-[92vh] bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-400">
              <span className="material-symbols-outlined text-2xl">assignment_return</span>
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100">Purchase Return to Vendor (PRTV) Engine</h2>
              <p className="text-xs text-slate-400">Vendor Return Order · Debit Note · Dispatch · Settlement</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {(["LINES", "DEBIT_NOTE", "AUDIT"] as const).map((tab) => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${activeTab === tab ? "bg-orange-500/20 text-orange-300 border border-orange-500/30" : "text-slate-400 hover:text-slate-200"}`}>
                {tab === "DEBIT_NOTE" ? "Debit Note" : tab === "AUDIT" ? "Audit" : "Lines"}
              </button>
            ))}
            <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 ml-2 transition-colors">
              <span className="material-symbols-outlined text-lg">close</span>
            </button>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Order sidebar */}
          <div className="w-56 border-r border-slate-800 overflow-y-auto bg-slate-950/30 p-3 space-y-2">
            {orders.map((o) => (
              <button key={o.prtvId} onClick={() => { setSelectedId(o.prtvId); setActiveTab("LINES"); }}
                className={`w-full text-left p-3 rounded-xl border transition-all ${selectedId === o.prtvId ? "bg-orange-950/20 border-orange-500/40" : "border-transparent hover:bg-slate-800/60"}`}>
                <p className="text-[10px] font-mono font-bold text-slate-200">{o.prtvNo}</p>
                <p className="text-[10px] text-slate-500 mt-0.5 truncate">{o.vendorName}</p>
                <p className="text-xs font-black font-mono text-orange-400 mt-0.5">{fmt(o.netReturnAmt)}</p>
                <span className={`text-[8px] font-bold px-1 py-0.5 rounded-full border mt-1.5 inline-block ${STATUS_STYLE[o.status]}`}>{o.status}</span>
              </button>
            ))}
          </div>

          {selected && (
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              <div className="flex items-start justify-between flex-wrap gap-3">
                <div>
                  <p className="text-lg font-bold font-mono text-slate-100">{selected.prtvNo}</p>
                  <p className="text-xs text-slate-400">{selected.vendorName} · {selected.branchCode}{selected.poRef ? ` · PO: ${selected.poRef}` : ""}</p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-xs font-bold px-2 py-1 rounded-full border ${STATUS_STYLE[selected.status]}`}>{selected.status}</span>
                  {selected.status === "DRAFT"        && <button onClick={handleApprove}     className="px-3 py-1.5 text-xs font-bold text-white bg-sky-700 hover:bg-sky-600 rounded-xl">Approve</button>}
                  {selected.status === "DISPATCHED"   && <button onClick={handleAcknowledge} className="px-3 py-1.5 text-xs font-bold text-white bg-teal-700 hover:bg-teal-600 rounded-xl">Mark Acknowledged</button>}
                  {selected.status === "ACKNOWLEDGED" && <button onClick={handleSettle}      className="px-3 py-1.5 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-600 rounded-xl">Settle</button>}
                  {["DRAFT", "APPROVED"].includes(selected.status) && <button onClick={handleReject} className="px-3 py-1.5 text-xs font-bold text-rose-300 border border-rose-500/30 hover:bg-rose-950/30 rounded-xl">Reject</button>}
                </div>
              </div>

              {/* Totals */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "Sub Total",  value: fmt(selected.subTotal),     color: "text-slate-400" },
                  { label: "Total Tax",  value: fmt(selected.totalTax),     color: "text-amber-400" },
                  { label: "Net Return", value: fmt(selected.netReturnAmt), color: "text-orange-400 text-lg font-black" },
                ].map((m) => (
                  <div key={m.label} className="bg-slate-800/30 border border-slate-700/60 rounded-xl p-4 text-center">
                    <div className={`font-bold font-mono ${m.color}`}>{m.value}</div>
                    <div className="text-[10px] text-slate-500 uppercase tracking-wide mt-0.5">{m.label}</div>
                  </div>
                ))}
              </div>

              {activeTab === "LINES" && (
                <div className="bg-slate-950/40 border border-slate-800 rounded-xl overflow-hidden text-xs">
                  <table className="w-full text-left border-collapse">
                    <thead><tr className="text-slate-500 uppercase text-[10px] border-b border-slate-800 bg-slate-950/60">
                      <th className="py-2 px-3">Product</th>
                      <th className="py-2 px-3 text-right">Qty</th>
                      <th className="py-2 px-3 text-right">Unit Cost</th>
                      <th className="py-2 px-3 text-right">Tax</th>
                      <th className="py-2 px-3 text-right">Net Return</th>
                      <th className="py-2 px-3">Reason</th>
                    </tr></thead>
                    <tbody className="divide-y divide-slate-800/40 font-mono">
                      {selected.lines.map((l) => (
                        <tr key={l.lineId}>
                          <td className="py-2 px-3 font-sans"><p className="text-xs text-slate-200">{l.productName}</p><p className="text-[10px] text-slate-500">{l.sku}</p></td>
                          <td className="py-2 px-3 text-right text-slate-300">{l.returnQty}</td>
                          <td className="py-2 px-3 text-right text-slate-400">{fmt(l.unitCost)}</td>
                          <td className="py-2 px-3 text-right text-amber-400">{fmt(l.taxAmt)} ({l.taxPct}%)</td>
                          <td className="py-2 px-3 text-right text-orange-400 font-bold">{fmt(l.netReturnAmt)}</td>
                          <td className="py-2 px-3 font-sans text-[10px] text-slate-400">{REASON_LABELS[l.reason]}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {activeTab === "DEBIT_NOTE" && (
                selected.debitNote ? (
                  <div className="bg-slate-800/20 border border-sky-500/20 rounded-xl p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-bold text-slate-200">Debit Note — {selected.debitNote.debitNoteNo}</p>
                      <p className="text-[10px] text-slate-500">{new Date(selected.debitNote.generatedAt).toLocaleDateString("en-IN")}</p>
                    </div>
                    {[
                      { label: "Vendor",      value: selected.debitNote.vendorName },
                      { label: "Sub Total",   value: fmt(selected.debitNote.subTotal) },
                      { label: "Total Tax",   value: fmt(selected.debitNote.totalTax) },
                      { label: "Net Debit",   value: fmt(selected.debitNote.netDebitAmt) },
                    ].map((m) => (
                      <div key={m.label} className="flex items-center justify-between border-b border-slate-700/40 pb-2 text-xs">
                        <span className="text-slate-500">{m.label}</span>
                        <span className="font-mono text-slate-200">{m.value}</span>
                      </div>
                    ))}
                    {selected.dispatch && (
                      <div className="mt-2 text-xs text-slate-400">
                        <span className="text-slate-500">Courier: </span>{selected.dispatch.courier}
                        <span className="mx-2 text-slate-600">·</span>
                        <span className="text-slate-500">Tracking: </span>{selected.dispatch.trackingNo}
                      </div>
                    )}
                    {selected.settlement && (
                      <div className="p-3 bg-emerald-950/20 border border-emerald-500/20 rounded-lg text-xs mt-2">
                        <p className="text-emerald-400 font-bold">Settled — {fmt(selected.settlement.settledAmt)} against {selected.settlement.payableRef}</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-slate-500 text-sm text-center py-8">Debit note generated on approval.</p>
                )
              )}

              {activeTab === "AUDIT" && (
                <div className="space-y-1.5">
                  {[...selected.auditTrail].reverse().map((e) => (
                    <div key={e.auditId} className="flex items-center gap-3 px-3 py-2 bg-slate-800/30 border border-slate-800/50 rounded-lg text-xs">
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border flex-shrink-0 ${
                        e.action === "APPROVED"   ? "text-sky-300 bg-sky-500/10 border-sky-500/20"
                        : e.action === "SETTLED"    ? "text-emerald-300 bg-emerald-500/10 border-emerald-500/20"
                        : e.action === "REJECTED"   ? "text-rose-300 bg-rose-500/10 border-rose-500/20"
                        : "text-slate-400 bg-slate-700/10 border-slate-600/20"
                      }`}>{e.action.replace(/_/g, " ")}</span>
                      <span className="text-slate-400 flex-1 truncate">{e.note}</span>
                      <span className="text-[10px] text-slate-600 flex-shrink-0">{e.performedBy}</span>
                      <span className="text-[10px] text-slate-600 flex-shrink-0">{new Date(e.timestamp).toLocaleTimeString("en-IN")}</span>
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

export default PRTVModal;

