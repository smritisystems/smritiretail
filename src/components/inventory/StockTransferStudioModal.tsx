/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.97.0
 * Created      : 2026-08-28
 * Modified     : 2026-08-28
 * Copyright    : Â© SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import React, { useState, useMemo } from "react";
import StockTransferEngine, {
  StockTransferOrder,
  TransferStatus,
} from "../../utils/stockTransferEngine";

interface StockTransferStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNotification?: (title: string, msg: string, type: "success" | "error" | "info") => void;
}

const STATUS_STYLE: Record<TransferStatus, string> = {
  DRAFT:               "text-slate-400 bg-slate-700/30 border-slate-600/30",
  SUBMITTED:           "text-blue-300 bg-blue-500/20 border-blue-500/30",
  APPROVED:            "text-emerald-300 bg-emerald-500/20 border-emerald-500/30",
  STOCK_RESERVED:      "text-teal-300 bg-teal-500/20 border-teal-500/30",
  DISPATCHED:          "text-amber-300 bg-amber-500/20 border-amber-500/30",
  IN_TRANSIT:          "text-orange-300 bg-orange-500/20 border-orange-500/30",
  PARTIALLY_RECEIVED:  "text-violet-300 bg-violet-500/20 border-violet-500/30",
  RECEIVED:            "text-green-300 bg-green-600/20 border-green-500/30",
  REJECTED:            "text-rose-300 bg-rose-500/20 border-rose-500/30",
  CANCELLED:           "text-slate-500 bg-slate-800/40 border-slate-700/40",
};

const NEXT_ACTIONS: Partial<Record<TransferStatus, { label: string; color: string }>> = {
  SUBMITTED:  { label: "Approve",  color: "bg-emerald-600 hover:bg-emerald-500" },
  APPROVED:   { label: "Dispatch", color: "bg-amber-600 hover:bg-amber-500" },
  DISPATCHED: { label: "Receive",  color: "bg-green-600 hover:bg-green-500" },
};

function makeSampleOrders(): StockTransferOrder[] {
  // Order 1: In progress â€” submitted
  const o1 = StockTransferEngine.createRequisition({
    transferType: "INTER_BRANCH", fromBranch: "BR-MUM-01", toBranch: "BR-DEL-01",
    lines: [
      { sku: "APP-POLO-NAVY-M", productName: "Polo Shirt Navy M", requestedQty: 50, unitCost: 600 },
      { sku: "DNM-SLIM-BLK-32", productName: "Slim Denim Black 32", requestedQty: 30, unitCost: 950 },
    ],
    requestedBy: "STORE-MGR-DEL",
  });

  // Order 2: Approved + dispatched
  let o2 = StockTransferEngine.createRequisition({
    transferType: "WAREHOUSE_TO_BRANCH", fromBranch: "WH-CENTRAL", toBranch: "BR-MUM-02",
    lines: [
      { sku: "FTW-SNEAKER-WHT-8", productName: "Sneakers White 8", requestedQty: 20, unitCost: 1400 },
      { sku: "FRM-SHIRT-BLU-M", productName: "Formal Shirt Blue M", requestedQty: 40, unitCost: 750 },
    ],
    requestedBy: "STORE-MGR-MUM2",
  });
  o2 = StockTransferEngine.approve(o2, [], "WH-MANAGER");
  o2 = StockTransferEngine.dispatch(o2, {
    logisticsRef: "BLUEDART-99881",
    dispatchedBy: "WH-OPR-01",
    expectedArrival: "2026-08-30",
    dispatchedLines: [{ lineId: "LINE-1", dispatchedQty: 20 }, { lineId: "LINE-2", dispatchedQty: 40 }],
  });

  // Order 3: Partially received
  let o3 = StockTransferEngine.createRequisition({
    transferType: "INTER_BRANCH", fromBranch: "BR-BLR-01", toBranch: "BR-CHN-01",
    lines: [{ sku: "ACC-BELT-BRN-34", productName: "Leather Belt Brown 34", requestedQty: 60, unitCost: 450 }],
    requestedBy: "STORE-MGR-CHN",
  });
  o3 = StockTransferEngine.approve(o3, [{ lineId: "LINE-1", approvedQty: 60 }], "MGR-BLR");
  o3 = StockTransferEngine.dispatch(o3, {
    logisticsRef: "DELHIVERY-5521", dispatchedBy: "OPR-BLR", expectedArrival: "2026-08-29",
    dispatchedLines: [{ lineId: "LINE-1", dispatchedQty: 60 }],
  });
  o3 = StockTransferEngine.receive(o3, {
    receivedBy: "STORE-OPR-CHN", receivingNotes: "5 units damaged in transit",
    receivedLines: [{ lineId: "LINE-1", receivedQty: 55 }],
  });

  return [o1, o2, o3];
}

export const StockTransferStudioModal: React.FC<StockTransferStudioModalProps> = ({ isOpen, onClose, onNotification }) => {
  const [orders, setOrders] = useState<StockTransferOrder[]>(makeSampleOrders);
  const [selectedId, setSelectedId] = useState<string>(orders[0]?.transferId ?? "");
  const [activeTab, setActiveTab] = useState<"ORDERS" | "METRICS">("ORDERS");

  const selected = orders.find((o) => o.transferId === selectedId);
  const metrics = useMemo(() => StockTransferEngine.computeMetrics(orders), [orders]);

  if (!isOpen) return null;

  const handleApprove = (order: StockTransferOrder) => {
    const approved = StockTransferEngine.approve(order, [], "MGR-CONSOLE");
    setOrders((prev) => prev.map((o) => o.transferId === order.transferId ? approved : o));
    onNotification?.("Approved", `${order.transferId} approved.`, "success");
  };

  const handleDispatch = (order: StockTransferOrder) => {
    const dispatched = StockTransferEngine.dispatch(order, {
      logisticsRef: `AUTO-${Date.now().toString().slice(-6)}`,
      dispatchedBy: "WH-CONSOLE",
      expectedArrival: new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10),
      dispatchedLines: order.lines.map((l) => ({ lineId: l.lineId, dispatchedQty: l.approvedQty ?? l.requestedQty })),
    });
    setOrders((prev) => prev.map((o) => o.transferId === order.transferId ? dispatched : o));
    onNotification?.("Dispatched", `${order.transferId} dispatched.`, "success");
  };

  const handleReceive = (order: StockTransferOrder) => {
    const received = StockTransferEngine.receive(order, {
      receivedBy: "STORE-CONSOLE",
      receivedLines: order.lines.map((l) => ({ lineId: l.lineId, receivedQty: l.dispatchedQty ?? l.approvedQty ?? l.requestedQty })),
    });
    setOrders((prev) => prev.map((o) => o.transferId === order.transferId ? received : o));
    onNotification?.("Received", `${order.transferId} received.`, "success");
  };

  const handleAction = (order: StockTransferOrder) => {
    if (order.status === "SUBMITTED") handleApprove(order);
    else if (order.status === "APPROVED") handleDispatch(order);
    else if (order.status === "DISPATCHED") handleReceive(order);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fadeIn">
      <div className="flex flex-col w-full max-w-5xl max-h-[92vh] bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
              <span className="material-symbols-outlined text-2xl">swap_horiz</span>
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100">Multi-Branch Stock Transfer & Inter-Branch Requisition</h2>
              <p className="text-xs text-slate-400">Requisition Â· Approval Â· Dispatch Â· In-Transit Â· Receiving Confirmation</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {(["ORDERS", "METRICS"] as const).map((tab) => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${activeTab === tab ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30" : "text-slate-400 hover:text-slate-200"}`}>
                {tab}
              </button>
            ))}
            <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors ml-2">
              <span className="material-symbols-outlined text-lg">close</span>
            </button>
          </div>
        </div>

        {activeTab === "ORDERS" ? (
          <div className="flex flex-1 overflow-hidden">
            {/* Order list */}
            <div className="w-64 border-r border-slate-800 overflow-y-auto bg-slate-950/30 p-3 space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 px-2 pb-1">Transfer Orders ({orders.length})</p>
              {orders.map((o) => (
                <button key={o.transferId} onClick={() => setSelectedId(o.transferId)}
                  className={`w-full text-left p-3 rounded-xl border transition-all ${selectedId === o.transferId ? "bg-cyan-950/20 border-cyan-500/40" : "border-transparent hover:bg-slate-800/60"}`}>
                  <div className="text-xs font-bold text-slate-200 font-mono truncate">{o.transferId}</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">{o.fromBranch} â†’ {o.toBranch}</div>
                  <div className="flex items-center justify-between mt-1.5">
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${STATUS_STYLE[o.status]}`}>{o.status}</span>
                    <span className="text-[10px] font-mono text-slate-400">â‚¹{o.totalTransferValue.toLocaleString("en-IN")}</span>
                  </div>
                </button>
              ))}
            </div>

            {/* Order detail */}
            {selected && (
              <div className="flex-1 overflow-y-auto p-5 space-y-5">
                {/* Header */}
                <div className="flex items-start justify-between flex-wrap gap-3">
                  <div>
                    <p className="text-lg font-bold text-slate-100 font-mono">{selected.transferId}</p>
                    <p className="text-xs text-slate-400">{selected.transferType.replace(/_/g, " ")} Â· {selected.fromBranch} â†’ {selected.toBranch}</p>
                    {selected.logisticsRef && <p className="text-xs text-cyan-400 font-mono mt-0.5">ðŸ“¦ {selected.logisticsRef}{selected.expectedArrival && ` Â· ETA: ${selected.expectedArrival}`}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-bold px-3 py-1.5 rounded-full border ${STATUS_STYLE[selected.status]}`}>{selected.status}</span>
                    {NEXT_ACTIONS[selected.status] && (
                      <button onClick={() => handleAction(selected)}
                        className={`px-4 py-2 rounded-xl text-xs font-bold text-white transition-all shadow-lg ${NEXT_ACTIONS[selected.status]!.color}`}>
                        {NEXT_ACTIONS[selected.status]!.label}
                      </button>
                    )}
                  </div>
                </div>

                {/* Line items */}
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Transfer Lines</p>
                  <div className="bg-slate-950/40 border border-slate-800 rounded-xl overflow-hidden text-xs">
                    <table className="w-full text-left border-collapse">
                      <thead><tr className="text-slate-500 uppercase text-[10px] border-b border-slate-800 bg-slate-950/60">
                        <th className="py-2 px-3">Product</th><th className="py-2 px-3 text-right">Requested</th><th className="py-2 px-3 text-right">Approved</th><th className="py-2 px-3 text-right">Dispatched</th><th className="py-2 px-3 text-right">Received</th><th className="py-2 px-3 text-right">Short</th><th className="py-2 px-3 text-right">Value</th>
                      </tr></thead>
                      <tbody className="divide-y divide-slate-800/60 font-mono">
                        {selected.lines.map((line) => (
                          <tr key={line.lineId}>
                            <td className="py-2 px-3"><div className="text-slate-200 font-sans font-medium">{line.productName}</div><div className="text-[10px] text-slate-500">{line.sku}</div></td>
                            <td className="py-2 px-3 text-right text-slate-400">{line.requestedQty}</td>
                            <td className="py-2 px-3 text-right text-emerald-400">{line.approvedQty ?? "â€”"}</td>
                            <td className="py-2 px-3 text-right text-amber-400">{line.dispatchedQty ?? "â€”"}</td>
                            <td className="py-2 px-3 text-right text-teal-400">{line.receivedQty ?? "â€”"}</td>
                            <td className="py-2 px-3 text-right">{line.shortQty !== undefined ? <span className={line.shortQty > 0 ? "text-rose-400 font-bold" : "text-slate-500"}>{line.shortQty}</span> : "â€”"}</td>
                            <td className="py-2 px-3 text-right font-bold text-slate-100">â‚¹{(line.transferValue ?? 0).toLocaleString("en-IN")}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div className="border-t border-slate-800 px-3 py-2 flex justify-end">
                      <span className="text-sm font-black text-slate-100 font-mono">â‚¹{selected.totalTransferValue.toLocaleString("en-IN")}</span>
                    </div>
                  </div>
                </div>

                {/* Audit trail */}
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Audit Trail</p>
                  <div className="space-y-2">
                    {[...selected.auditTrail].reverse().map((e) => (
                      <div key={e.auditId} className="flex items-start gap-3 p-3 bg-slate-800/30 border border-slate-800/60 rounded-xl text-xs">
                        <div className="w-1.5 h-1.5 rounded-full bg-slate-500 mt-1.5 flex-shrink-0" />
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${STATUS_STYLE[e.toStatus]}`}>{e.toStatus}</span>
                            <span className="text-slate-500 text-[10px] ml-auto font-mono">{new Date(e.timestamp).toLocaleTimeString("en-IN")}</span>
                          </div>
                          {e.note && <p className="text-slate-400 mt-1">{e.note} <span className="text-slate-600">â€” {e.performedBy}</span></p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: "Total Transfers", value: metrics.totalTransfers, color: "text-slate-300" },
                { label: "In Transit", value: metrics.inTransit, color: "text-amber-400" },
                { label: "Pending Approval", value: metrics.pendingApproval, color: "text-blue-400" },
                { label: "Received", value: metrics.received, color: "text-emerald-400" },
              ].map((m) => (
                <div key={m.label} className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-4 text-center">
                  <div className={`text-2xl font-black font-mono ${m.color}`}>{m.value}</div>
                  <div className="text-[10px] text-slate-500 uppercase tracking-wide mt-0.5">{m.label}</div>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Value In Transit", value: `â‚¹${metrics.totalValueInTransit.toLocaleString("en-IN")}`, color: "text-amber-400" },
                { label: "Avg Transit Days", value: `${metrics.avgTransitDays}d`, color: "text-slate-300" },
                { label: "Short Receipt Rate", value: `${metrics.shortReceiptRate}%`, color: metrics.shortReceiptRate > 0 ? "text-rose-400" : "text-emerald-400" },
              ].map((m) => (
                <div key={m.label} className="bg-slate-800/30 border border-slate-700/60 rounded-xl p-5 text-center">
                  <div className={`text-xl font-black font-mono ${m.color}`}>{m.value}</div>
                  <div className="text-[10px] text-slate-500 uppercase tracking-wide mt-0.5">{m.label}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center justify-end px-6 py-3 border-t border-slate-800 bg-slate-950/80">
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors">Close</button>
        </div>
      </div>
    </div>
  );
};

export default StockTransferStudioModal;

