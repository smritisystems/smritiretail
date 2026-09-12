/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.118.0
 * Created      : 2026-08-28
 * Modified     : 2026-08-28
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import React, { useState, useMemo } from "react";
import InterBranchTransferEngine, {
  StockTransferOrder, TransferStatus,
} from "../../utils/interBranchTransferEngine";

interface InterBranchTransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNotification?: (title: string, msg: string, type: "success" | "error" | "info") => void;
}

const STATUS_STYLE: Record<TransferStatus, string> = {
  DRAFT:       "text-slate-300 bg-slate-700/15 border-slate-600/25",
  APPROVED:    "text-sky-300 bg-sky-500/15 border-sky-500/25",
  IN_TRANSIT:  "text-amber-300 bg-amber-500/15 border-amber-500/25",
  RECEIVED:    "text-teal-300 bg-teal-500/15 border-teal-500/25",
  COMPLETED:   "text-emerald-300 bg-emerald-500/15 border-emerald-500/25",
  CANCELLED:   "text-rose-300 bg-rose-500/15 border-rose-500/25",
};

function buildSampleOrders(): StockTransferOrder[] {
  const BASE = [
    { sku: "FAB-DENIM-BLU", productName: "Denim Blue 1m",   requestedQty: 50, unitCost: 180 },
    { sku: "FAB-LINEN-WHT", productName: "Linen White 1m",  requestedQty: 30, unitCost: 200 },
  ];
  let o1 = InterBranchTransferEngine.createTransfer({ fromBranch: "BR-MUM-01", toBranch: "BR-PUN-01", createdBy: "MGR-001", lines: BASE });
  o1 = InterBranchTransferEngine.approve(o1, "PURCHASE-MGR");
  o1 = InterBranchTransferEngine.dispatch(o1, "DISPATCH-001", { [o1.lines[0].lineId]: 50, [o1.lines[1].lineId]: 28 });

  let o2 = InterBranchTransferEngine.createTransfer({ fromBranch: "BR-MUM-01", toBranch: "BR-DEL-01", createdBy: "MGR-002",
    lines: [{ sku: "ACC-BELT-BRN", productName: "Leather Belt", requestedQty: 20, unitCost: 300 }] });

  return [o1, o2];
}

export const InterBranchTransferModal: React.FC<InterBranchTransferModalProps> = ({ isOpen, onClose, onNotification }) => {
  const [orders, setOrders]     = useState<StockTransferOrder[]>(buildSampleOrders);
  const [selectedId, setSelectedId] = useState(orders[0]?.transferId ?? "");
  const [activeTab, setActiveTab]   = useState<"LINES" | "AUDIT">("LINES");

  const selected = orders.find((o) => o.transferId === selectedId);
  const summary  = useMemo(() => InterBranchTransferEngine.transferSummary(orders), [orders]);

  if (!isOpen) return null;

  const update = (updated: StockTransferOrder) =>
    setOrders((prev) => prev.map((o) => o.transferId === updated.transferId ? updated : o));

  const handleApprove = () => {
    if (!selected) return;
    try { update(InterBranchTransferEngine.approve(selected, "PURCHASE-MGR")); onNotification?.("Approved", selected.transferNo, "success"); }
    catch (e: any) { onNotification?.("Error", e.message, "error"); }
  };

  const handleDispatch = () => {
    if (!selected) return;
    try {
      const lineQtys = Object.fromEntries(selected.lines.map((l) => [l.lineId, l.requestedQty]));
      update(InterBranchTransferEngine.dispatch(selected, "DISPATCH-001", lineQtys));
      onNotification?.("Dispatched", `${selected.transferNo} — IN_TRANSIT`, "info");
    } catch (e: any) { onNotification?.("Error", e.message, "error"); }
  };

  const handleReceive = () => {
    if (!selected) return;
    try {
      const lineQtys = Object.fromEntries(selected.lines.map((l) => [l.lineId, l.dispatchedQty]));
      update(InterBranchTransferEngine.receive(selected, "RECV-001", lineQtys));
      onNotification?.("Received", `${selected.transferNo} — checking variance`, "success");
    } catch (e: any) { onNotification?.("Error", e.message, "error"); }
  };

  const handleComplete = () => {
    if (!selected) return;
    try { update(InterBranchTransferEngine.complete(selected, "MGR-001")); onNotification?.("Completed", selected.transferNo, "success"); }
    catch (e: any) { onNotification?.("Error", e.message, "error"); }
  };

  const handleCancel = () => {
    if (!selected) return;
    try { update(InterBranchTransferEngine.cancel(selected, "MGR-001", "Demand cancelled")); onNotification?.("Cancelled", selected.transferNo, "error"); }
    catch (e: any) { onNotification?.("Error", e.message, "error"); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fadeIn">
      <div className="flex flex-col w-full max-w-5xl max-h-[92vh] bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
              <span className="material-symbols-outlined text-2xl">swap_horiz</span>
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100">Inter-Branch Stock Transfer Engine</h2>
              <p className="text-xs text-slate-400">Transfer Orders · Dispatch · Receipt · Variance Detection</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {(["LINES", "AUDIT"] as const).map((tab) => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${activeTab === tab ? "bg-sky-500/20 text-sky-300 border border-sky-500/30" : "text-slate-400 hover:text-slate-200"}`}>
                {tab === "AUDIT" ? "Audit Trail" : "Transfer Lines"}
              </button>
            ))}
            <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 ml-2 transition-colors">
              <span className="material-symbols-outlined text-lg">close</span>
            </button>
          </div>
        </div>

        {/* Queue summary strip */}
        <div className="flex items-center gap-5 px-6 py-2.5 border-b border-slate-800 bg-slate-950/40 text-xs overflow-x-auto">
          {[
            { label: "In Transit",    value: summary.totalInTransit,  style: "text-amber-400 font-black" },
            { label: "Completed",     value: summary.totalCompleted,  style: "text-emerald-400" },
            { label: "With Variance", value: summary.withVariance,    style: summary.withVariance > 0 ? "text-rose-400" : "text-slate-400" },
          ].map((m) => (
            <div key={m.label} className="flex items-center gap-1.5 flex-shrink-0">
              <span className="text-slate-600">{m.label}:</span>
              <span className={`font-mono font-bold ${m.style.split(" ")[0]}`}>{m.value}</span>
            </div>
          ))}
          {Object.entries(summary.byStatus).map(([status, count]) => (
            <div key={status} className="flex items-center gap-1.5 flex-shrink-0">
              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${STATUS_STYLE[status as TransferStatus]}`}>{status}</span>
              <span className="font-mono text-slate-400">{typeof count === "number" ? count : Number(count ?? 0)}</span>
            </div>
          ))}
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Order sidebar */}
          <div className="w-56 border-r border-slate-800 overflow-y-auto bg-slate-950/30 p-3 space-y-2">
            {orders.map((o) => (
              <button key={o.transferId} onClick={() => { setSelectedId(o.transferId); setActiveTab("LINES"); }}
                className={`w-full text-left p-3 rounded-xl border transition-all ${selectedId === o.transferId ? "bg-sky-950/20 border-sky-500/40" : "border-transparent hover:bg-slate-800/60"}`}>
                <p className="text-[10px] font-mono font-bold text-slate-200 truncate">{o.transferNo}</p>
                <p className="text-[10px] text-slate-500 mt-0.5">{o.fromBranch} → {o.toBranch}</p>
                <p className="text-xs font-bold text-sky-400 mt-0.5">{o.totalRequestedQty} units</p>
                <div className="flex gap-1 mt-1.5 flex-wrap">
                  <span className={`text-[8px] font-bold px-1 py-0.5 rounded-full border ${STATUS_STYLE[o.status]}`}>{o.status}</span>
                  {o.hasVariance && <span className="text-[8px] font-bold text-rose-400">? VAR</span>}
                </div>
              </button>
            ))}
          </div>

          {selected && (
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {/* Header row */}
              <div className="flex items-start justify-between flex-wrap gap-3">
                <div>
                  <p className="text-lg font-bold font-mono text-slate-100">{selected.transferNo}</p>
                  <p className="text-xs text-slate-400">{selected.fromBranch} → {selected.toBranch} · {selected.createdBy}</p>
                  {selected.dispatchedAt && <p className="text-[10px] text-slate-500">Dispatched: {new Date(selected.dispatchedAt).toLocaleString("en-IN")}</p>}
                  {selected.receivedAt   && <p className="text-[10px] text-slate-500">Received:   {new Date(selected.receivedAt).toLocaleString("en-IN")}</p>}
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-xs font-bold px-2 py-1 rounded-full border ${STATUS_STYLE[selected.status]}`}>{selected.status}</span>
                  {selected.status === "DRAFT"       && <button onClick={handleApprove}  className="px-3 py-1.5 text-xs font-bold text-white bg-sky-700 hover:bg-sky-600 rounded-xl">Approve</button>}
                  {selected.status === "APPROVED"    && <button onClick={handleDispatch} className="px-3 py-1.5 text-xs font-bold text-white bg-amber-700 hover:bg-amber-600 rounded-xl">Dispatch</button>}
                  {selected.status === "IN_TRANSIT"  && <button onClick={handleReceive}  className="px-3 py-1.5 text-xs font-bold text-white bg-teal-700 hover:bg-teal-600 rounded-xl">Mark Received</button>}
                  {selected.status === "RECEIVED"    && <button onClick={handleComplete} className="px-3 py-1.5 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-600 rounded-xl">Complete</button>}
                  {["DRAFT","APPROVED"].includes(selected.status) && <button onClick={handleCancel} className="px-3 py-1.5 text-xs font-bold text-rose-300 border border-rose-500/30 hover:bg-rose-950/30 rounded-xl">Cancel</button>}
                </div>
              </div>

              {/* Totals strip */}
              <div className="grid grid-cols-4 gap-3">
                {[
                  { label: "Requested",  value: selected.totalRequestedQty,  color: "text-slate-400" },
                  { label: "Dispatched", value: selected.totalDispatchedQty, color: "text-amber-400" },
                  { label: "Received",   value: selected.totalReceivedQty,   color: "text-teal-400" },
                  { label: "Variance",   value: selected.totalVarianceQty,   color: selected.hasVariance ? "text-rose-400 font-black" : "text-emerald-400" },
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
                      <th className="py-2 px-3">Product</th>
                      <th className="py-2 px-3 text-right">Requested</th>
                      <th className="py-2 px-3 text-right">Dispatched</th>
                      <th className="py-2 px-3 text-right">Received</th>
                      <th className="py-2 px-3 text-right">Variance</th>
                    </tr></thead>
                    <tbody className="divide-y divide-slate-800/40 font-mono">
                      {selected.lines.map((l) => (
                        <tr key={l.lineId} className={l.variance > 0 ? "bg-rose-950/10" : ""}>
                          <td className="py-2 px-3 font-sans"><p className="text-xs text-slate-200">{l.productName}</p><p className="text-[10px] text-slate-500">{l.sku}{l.batchRef ? ` · ${l.batchRef}` : ""}</p></td>
                          <td className="py-2 px-3 text-right text-slate-400">{l.requestedQty}</td>
                          <td className="py-2 px-3 text-right text-amber-400">{l.dispatchedQty}</td>
                          <td className="py-2 px-3 text-right text-teal-400">{l.receivedQty}</td>
                          <td className={`py-2 px-3 text-right font-bold ${l.variance > 0 ? "text-rose-400" : "text-emerald-400"}`}>{l.variance > 0 ? `-${l.variance}` : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {activeTab === "AUDIT" && (
                <div className="space-y-1.5">
                  {[...selected.auditTrail].reverse().map((e) => (
                    <div key={e.auditId} className="flex items-center gap-3 px-3 py-2 bg-slate-800/30 border border-slate-800/50 rounded-lg text-xs">
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border flex-shrink-0 ${
                        e.action === "COMPLETED"  ? "text-emerald-300 bg-emerald-500/10 border-emerald-500/20"
                        : e.action === "RECEIVED"   ? "text-teal-300 bg-teal-500/10 border-teal-500/20"
                        : e.action === "DISPATCHED" ? "text-amber-300 bg-amber-500/10 border-amber-500/20"
                        : e.action === "CANCELLED"  ? "text-rose-300 bg-rose-500/10 border-rose-500/20"
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

export default InterBranchTransferModal;

