/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.105.0
 * Created      : 2026-08-28
 * Modified     : 2026-08-28
 * Copyright    : Â© SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import React, { useState, useMemo } from "react";
import IPOEngine, {
  InterStorePO, IPOStatus, IPOLine,
} from "../../utils/ipoEngine";

interface IPOStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNotification?: (title: string, msg: string, type: "success" | "error" | "info") => void;
}

const STATUS_STYLE: Record<IPOStatus, string> = {
  DRAFT:        "text-slate-400 bg-slate-700/30 border-slate-600/30",
  SUBMITTED:    "text-blue-300 bg-blue-500/20 border-blue-500/30",
  APPROVED:     "text-sky-300 bg-sky-500/20 border-sky-500/30",
  PICKING:      "text-violet-300 bg-violet-500/20 border-violet-500/30",
  DISPATCHED:   "text-indigo-300 bg-indigo-500/20 border-indigo-500/30",
  AUTO_GRN:     "text-teal-300 bg-teal-500/20 border-teal-500/30",
  CLOSED:       "text-emerald-300 bg-emerald-500/20 border-emerald-500/30",
  DISPUTED:     "text-rose-300 bg-rose-500/20 border-rose-500/30",
  CANCELLED:    "text-slate-500 bg-slate-800/30 border-slate-700/30",
};

const BRANCHES = ["BR-MUM-01", "BR-DEL-01", "BR-BLR-01", "BR-HYD-01"];

function buildSampleIPOs(): InterStorePO[] {
  // IPO 1: Dispatched, waiting for GRN
  let ipo1 = IPOEngine.createIPO({
    requestingBranch: "BR-DEL-01", fulfillingBranch: "BR-MUM-01",
    requestedBy: "MGR-DEL-01",
    lines: [
      { sku: "FAB-COTTON-WHT", productName: "Cotton White 1m",    requestedQty: 100, unitCost: 120 },
      { sku: "FAB-DENIM-BLU",  productName: "Denim Blue 1m",      requestedQty: 50,  unitCost: 250 },
      { sku: "ACC-BELT-BRN",   productName: "Leather Belt Brown",  requestedQty: 30,  unitCost: 350 },
    ],
  });
  ipo1 = IPOEngine.submit(ipo1, "MGR-DEL-01");
  ipo1 = IPOEngine.approve(ipo1, "WH-MGR-MUM", [
    { lineId: "IPOL-1", approvedQty: 100 },
    { lineId: "IPOL-2", approvedQty: 50  },
    { lineId: "IPOL-3", approvedQty: 30  },
  ]);
  ipo1 = IPOEngine.startPicking(ipo1, "PICKER-01");
  ipo1 = IPOEngine.dispatch(ipo1, "DELHIVERY-8812", [
    { lineId: "IPOL-1", pickedQty: 100 },
    { lineId: "IPOL-2", pickedQty: 40  },
    { lineId: "IPOL-3", pickedQty: 30  },
  ], "PICKER-01");

  // IPO 2: Draft â€” just created
  const ipo2 = IPOEngine.createIPO({
    requestingBranch: "BR-BLR-01", fulfillingBranch: "BR-MUM-01",
    requestedBy: "MGR-BLR-01",
    lines: [
      { sku: "FAB-SILK-RED", productName: "Silk Red 1m",   requestedQty: 20, unitCost: 600 },
      { sku: "ACC-SCARF-BLU", productName: "Blue Scarf",   requestedQty: 40, unitCost: 180 },
    ],
  });

  // IPO 3: Closed with clean GRN
  let ipo3 = IPOEngine.createIPO({
    requestingBranch: "BR-HYD-01", fulfillingBranch: "BR-DEL-01",
    requestedBy: "MGR-HYD-01",
    lines: [{ sku: "FAB-LINEN-WHT", productName: "Linen White 1m", requestedQty: 60, unitCost: 200 }],
  });
  ipo3 = IPOEngine.submit(ipo3, "MGR-HYD-01");
  ipo3 = IPOEngine.approve(ipo3, "WH-MGR-DEL", [{ lineId: "IPOL-1", approvedQty: 60 }]);
  ipo3 = IPOEngine.startPicking(ipo3, "PICKER-DEL");
  ipo3 = IPOEngine.dispatch(ipo3, "BLUEDART-5511", [{ lineId: "IPOL-1", pickedQty: 60 }], "PICKER-DEL");
  ipo3 = IPOEngine.generateAutoGRN(ipo3, [{ lineId: "IPOL-1", receivedQty: 60 }], "RECV-HYD");
  ipo3 = IPOEngine.close(ipo3, "MGR-HYD-01");

  return [ipo1, ipo2, ipo3];
}

export const IPOStudioModal: React.FC<IPOStudioModalProps> = ({ isOpen, onClose, onNotification }) => {
  const [orders, setOrders]   = useState<InterStorePO[]>(buildSampleIPOs);
  const [selectedId, setSelectedId] = useState(orders[0]?.ipoId ?? "");
  const [activeTab, setActiveTab]   = useState<"DETAIL" | "GRN">("DETAIL");

  const selected = orders.find((o) => o.ipoId === selectedId);
  const update   = (o: InterStorePO) => setOrders((prev) => prev.map((x) => x.ipoId === o.ipoId ? x : x).map((x) => x.ipoId === o.ipoId ? o : x));

  if (!isOpen) return null;

  const handleAction = (action: string) => {
    if (!selected) return;
    let o = selected;
    if (action === "submit")   o = IPOEngine.submit(o, "STORE-MGR");
    if (action === "approve")  o = IPOEngine.approve(o, "WH-MGR", o.lines.map((l) => ({ lineId: l.lineId, approvedQty: l.requestedQty })));
    if (action === "pick")     o = IPOEngine.startPicking(o, "PICKER");
    if (action === "dispatch") o = IPOEngine.dispatch(o, `LOG-${Date.now().toString().slice(-4)}`, o.lines.map((l) => ({ lineId: l.lineId, pickedQty: l.approvedQty })), "PICKER");
    if (action === "grn")      { o = IPOEngine.generateAutoGRN(o, o.lines.map((l) => ({ lineId: l.lineId, receivedQty: l.dispatchedQty })), "RECV"); setActiveTab("GRN"); }
    if (action === "close")    o = IPOEngine.close(o, "STORE-MGR");
    update(o);
    onNotification?.("IPO Updated", `${o.ipoNo} â†’ ${o.status}`, "success");
  };

  const NEXT_ACTION: Partial<Record<IPOStatus, { label: string; action: string; color: string }>> = {
    DRAFT:        { label: "Submit IPO",         action: "submit",   color: "bg-blue-600 hover:bg-blue-500" },
    SUBMITTED:    { label: "Approve",            action: "approve",  color: "bg-sky-600 hover:bg-sky-500" },
    APPROVED:     { label: "Start Picking",      action: "pick",     color: "bg-violet-600 hover:bg-violet-500" },
    PICKING:      { label: "Mark Dispatched",    action: "dispatch", color: "bg-indigo-600 hover:bg-indigo-500" },
    DISPATCHED:   { label: "Generate Auto-GRN",  action: "grn",      color: "bg-teal-600 hover:bg-teal-500" },
    AUTO_GRN:     { label: "Close IPO",          action: "close",    color: "bg-emerald-600 hover:bg-emerald-500" },
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fadeIn">
      <div className="flex flex-col w-full max-w-5xl max-h-[92vh] bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <span className="material-symbols-outlined text-2xl">swap_horiz</span>
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100">Inter-Store Purchase Order (IPO) Studio</h2>
              <p className="text-xs text-slate-400">Branch-to-Branch Requisition Â· Approval Â· Picking Â· Dispatch Â· Auto-GRN</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {(["DETAIL", "GRN"] as const).map((tab) => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${activeTab === tab ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30" : "text-slate-400 hover:text-slate-200"}`}>
                {tab === "GRN" ? "Auto-GRN" : "IPO Detail"}
              </button>
            ))}
            <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors ml-2">
              <span className="material-symbols-outlined text-lg">close</span>
            </button>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* IPO sidebar */}
          <div className="w-60 border-r border-slate-800 overflow-y-auto bg-slate-950/30 p-3 space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 px-2 pb-1">Purchase Orders ({orders.length})</p>
            {orders.map((o) => (
              <button key={o.ipoId} onClick={() => { setSelectedId(o.ipoId); setActiveTab("DETAIL"); }}
                className={`w-full text-left p-3 rounded-xl border transition-all ${selectedId === o.ipoId ? "bg-indigo-950/20 border-indigo-500/40" : "border-transparent hover:bg-slate-800/60"}`}>
                <div className="text-xs font-mono font-bold text-slate-200">{o.ipoNo}</div>
                <div className="text-[10px] text-slate-500 mt-0.5">{o.requestingBranch} â† {o.fulfillingBranch}</div>
                <div className="flex items-center justify-between mt-1.5">
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${STATUS_STYLE[o.status]}`}>{o.status.replace(/_/g, " ")}</span>
                  {o.totalValue > 0 && <span className="text-[10px] font-mono text-slate-400">â‚¹{o.totalValue.toLocaleString("en-IN")}</span>}
                </div>
              </button>
            ))}
          </div>

          {selected && (
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {activeTab === "DETAIL" && (
                <>
                  {/* Header */}
                  <div className="flex items-start justify-between flex-wrap gap-3">
                    <div>
                      <p className="text-lg font-bold font-mono text-slate-100">{selected.ipoNo}</p>
                      <p className="text-xs text-slate-400">{selected.requestingBranch} â† {selected.fulfillingBranch}</p>
                      <p className="text-[10px] text-slate-500 mt-0.5">Requested by: {selected.requestedBy}</p>
                      {selected.approvedBy && <p className="text-[10px] text-emerald-400">Approved by: {selected.approvedBy}</p>}
                      {selected.dispatchRef && <p className="text-[10px] text-sky-400">Dispatch ref: {selected.dispatchRef}</p>}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs font-bold px-3 py-1.5 rounded-full border ${STATUS_STYLE[selected.status]}`}>{selected.status.replace(/_/g, " ")}</span>
                      {NEXT_ACTION[selected.status] && (
                        <button onClick={() => handleAction(NEXT_ACTION[selected.status]!.action)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold text-white transition-all ${NEXT_ACTION[selected.status]!.color}`}>
                          {NEXT_ACTION[selected.status]!.label}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* KPIs */}
                  <div className="grid grid-cols-4 gap-3">
                    {[
                      { label: "Requested Qty",  value: selected.totalRequestedQty,  color: "text-slate-300" },
                      { label: "Dispatched Qty", value: selected.totalDispatchedQty, color: "text-indigo-400" },
                      { label: "Fulfillment %",  value: `${selected.fulfillmentRate}%`, color: selected.fulfillmentRate >= 90 ? "text-emerald-400" : "text-amber-400" },
                      { label: "Total Value",    value: `â‚¹${selected.totalValue.toLocaleString("en-IN")}`, color: "text-violet-400" },
                    ].map((m) => (
                      <div key={m.label} className="bg-slate-800/30 border border-slate-700/60 rounded-xl p-3 text-center">
                        <div className={`text-base font-black font-mono ${m.color}`}>{m.value}</div>
                        <div className="text-[10px] text-slate-500 mt-0.5">{m.label}</div>
                      </div>
                    ))}
                  </div>

                  {/* Lines table */}
                  <div className="bg-slate-950/40 border border-slate-800 rounded-xl overflow-hidden text-xs">
                    <div className="px-4 py-2 border-b border-slate-800 bg-slate-950/60">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Order Lines ({selected.lines.length})</p>
                    </div>
                    <table className="w-full text-left border-collapse">
                      <thead><tr className="text-slate-500 uppercase text-[10px] border-b border-slate-800">
                        <th className="py-2 px-3">Product</th>
                        <th className="py-2 px-3 text-right">Req</th>
                        <th className="py-2 px-3 text-right">Approved</th>
                        <th className="py-2 px-3 text-right">Dispatched</th>
                        <th className="py-2 px-3 text-right">Value</th>
                        <th className="py-2 px-3 text-center">Status</th>
                      </tr></thead>
                      <tbody className="divide-y divide-slate-800/40 font-mono">
                        {selected.lines.map((l) => (
                          <tr key={l.lineId}>
                            <td className="py-2 px-3 font-sans"><p className="text-xs text-slate-200">{l.productName}</p><p className="text-[10px] text-slate-500">{l.sku}</p></td>
                            <td className="py-2 px-3 text-right text-slate-400">{l.requestedQty}</td>
                            <td className="py-2 px-3 text-right text-sky-400">{l.approvedQty || "â€”"}</td>
                            <td className="py-2 px-3 text-right text-indigo-400">{l.dispatchedQty || "â€”"}</td>
                            <td className="py-2 px-3 text-right text-slate-200">â‚¹{l.lineValue.toLocaleString("en-IN") || "â€”"}</td>
                            <td className="py-2 px-3 text-center">
                              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${
                                l.lineStatus === "FULFILLED" ? "text-emerald-300 bg-emerald-500/10 border-emerald-500/20" :
                                l.lineStatus === "PARTIAL"   ? "text-amber-300 bg-amber-500/10 border-amber-500/20" :
                                l.lineStatus === "PICKING"   ? "text-violet-300 bg-violet-500/10 border-violet-500/20" :
                                "text-slate-400 bg-slate-700/20 border-slate-600/20"
                              }`}>{l.lineStatus}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Audit trail */}
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Audit Trail</p>
                    <div className="space-y-2">
                      {[...selected.auditTrail].reverse().map((e) => (
                        <div key={e.auditId} className="flex items-start gap-3 px-3 py-2.5 bg-slate-800/30 border border-slate-800/60 rounded-xl text-xs">
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border mt-0.5 flex-shrink-0 ${STATUS_STYLE[e.toStatus]}`}>{e.toStatus.replace(/_/g, " ")}</span>
                          <div>
                            <p className="text-[10px] text-slate-500 font-mono">{e.performedBy} Â· {new Date(e.timestamp).toLocaleString("en-IN")}</p>
                            {e.note && <p className="text-slate-400 mt-0.5">{e.note}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {activeTab === "GRN" && (
                selected.autoGRN ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between flex-wrap gap-3">
                      <div>
                        <p className="text-lg font-bold font-mono text-slate-100">{selected.autoGRN.grnNo}</p>
                        <p className="text-xs text-slate-400">Receiving: {selected.autoGRN.receivingBranch} Â· Generated: {new Date(selected.autoGRN.generatedAt).toLocaleString("en-IN")}</p>
                      </div>
                      <span className={`text-sm font-black px-3 py-1.5 rounded-full border ${selected.autoGRN.hasVariance ? "text-rose-300 bg-rose-500/20 border-rose-500/30" : "text-emerald-300 bg-emerald-500/20 border-emerald-500/30"}`}>
                        {selected.autoGRN.hasVariance ? "âš  Variance Detected" : "âœ“ Fully Received"}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { label: "Total Dispatched", value: selected.autoGRN.totalDispatched, color: "text-indigo-400" },
                        { label: "Total Received",   value: selected.autoGRN.totalReceived,   color: selected.autoGRN.hasVariance ? "text-amber-400" : "text-emerald-400" },
                      ].map((m) => (
                        <div key={m.label} className="bg-slate-800/30 border border-slate-700/60 rounded-xl p-4 text-center">
                          <div className={`text-xl font-black font-mono ${m.color}`}>{m.value}</div>
                          <div className="text-[10px] text-slate-500 uppercase tracking-wide mt-0.5">{m.label}</div>
                        </div>
                      ))}
                    </div>
                    <div className="bg-slate-950/40 border border-slate-800 rounded-xl overflow-hidden text-xs">
                      <table className="w-full text-left border-collapse">
                        <thead><tr className="text-slate-500 uppercase text-[10px] border-b border-slate-800 bg-slate-950/60">
                          <th className="py-2 px-3">Product</th>
                          <th className="py-2 px-3 text-right">Dispatched</th>
                          <th className="py-2 px-3 text-right">Received</th>
                          <th className="py-2 px-3 text-right">Short</th>
                          <th className="py-2 px-3 text-center">Variance</th>
                        </tr></thead>
                        <tbody className="divide-y divide-slate-800/40 font-mono">
                          {selected.autoGRN.lines.map((l) => (
                            <tr key={l.lineId}>
                              <td className="py-2 px-3 font-sans text-slate-300 text-xs">{l.productName}<div className="text-[10px] text-slate-500">{l.sku}</div></td>
                              <td className="py-2 px-3 text-right text-indigo-400">{l.dispatchedQty}</td>
                              <td className="py-2 px-3 text-right text-emerald-400">{l.receivedQty}</td>
                              <td className="py-2 px-3 text-right text-rose-400">{l.shortQty > 0 ? l.shortQty : "â€”"}</td>
                              <td className="py-2 px-3 text-center">{l.hasVariance ? <span className="text-rose-400">âš </span> : <span className="text-emerald-400">âœ“</span>}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-40 text-slate-500 text-sm">
                    No GRN generated yet. Dispatch the IPO and confirm receipt to generate Auto-GRN.
                  </div>
                )
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

export default IPOStudioModal;

