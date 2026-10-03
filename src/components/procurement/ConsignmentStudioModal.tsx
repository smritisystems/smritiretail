/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.109.0
 * Created      : 2026-08-28
 * Modified     : 2026-08-28
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import React, { useState, useMemo } from "react";
import ConsignmentEngine, {
  ConsignmentPlan, AgingBand, DEFAULT_AGING_CONFIG,
} from "../../utils/consignmentEngine";

interface ConsignmentStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNotification?: (title: string, msg: string, type: "success" | "error" | "info") => void;
}

const BAND_STYLE: Record<AgingBand, string> = {
  FRESH:    "text-emerald-300 bg-emerald-500/15 border-emerald-500/25",
  NORMAL:   "text-sky-300 bg-sky-500/15 border-sky-500/25",
  AGEING:   "text-amber-300 bg-amber-500/15 border-amber-500/25",
  CRITICAL: "text-rose-300 bg-rose-500/15 border-rose-500/25",
};

const fmt = (n: number) => `₹${n.toLocaleString("en-IN")}`;

function buildSamplePlans(): ConsignmentPlan[] {
  let p1 = ConsignmentEngine.createPlan({
    vendorId: "VNDR-001", vendorName: "Textile Exports Ltd",
    branchCode: "BR-MUM-01", termDays: 60, startDate: "2026-07-01",
    lines: [
      { sku: "FAB-SILK-RED",    productName: "Silk Red 1m",     vendorCost: 600, receivedQty: 50 },
      { sku: "FAB-COTTON-WHT",  productName: "Cotton White 1m", vendorCost: 120, receivedQty: 100 },
      { sku: "ACC-SCARF-BLUE",  productName: "Blue Scarf",      vendorCost: 180, receivedQty: 40 },
    ],
  });
  p1 = ConsignmentEngine.recordSales(p1, [
    { sku: "FAB-SILK-RED",   qty: 28, performedBy: "POS-01" },
    { sku: "FAB-COTTON-WHT", qty: 55, performedBy: "POS-01" },
  ], new Date("2026-07-20T00:00:00.000Z"));

  const p2 = ConsignmentEngine.createPlan({
    vendorId: "VNDR-002", vendorName: "Craft Weaves Pvt Ltd",
    branchCode: "BR-DEL-01", termDays: 45, startDate: "2026-08-01",
    lines: [
      { sku: "FAB-LINEN-WHT",  productName: "Linen White 1m", vendorCost: 180, receivedQty: 80 },
      { sku: "FAB-DENIM-BLU",  productName: "Denim Blue 1m",  vendorCost: 250, receivedQty: 60 },
    ],
  });

  return [p1, p2];
}

export const ConsignmentStudioModal: React.FC<ConsignmentStudioModalProps> = ({ isOpen, onClose, onNotification }) => {
  const [plans, setPlans]       = useState<ConsignmentPlan[]>(buildSamplePlans);
  const [selectedId, setSelectedId] = useState(plans[0]?.planId ?? "");
  const [activeTab, setActiveTab]   = useState<"DETAIL" | "AGING" | "MOVEMENTS">("DETAIL");

  const NOW   = useMemo(() => new Date(), []);
  const selected = plans.find((p) => p.planId === selectedId);
  const update   = (p: ConsignmentPlan) => setPlans((prev) => prev.map((x) => x.planId === p.planId ? p : x));

  const aging        = useMemo(() => selected ? ConsignmentEngine.getAgingReport(selected, NOW) : [], [selected, NOW]);
  const returnSched  = useMemo(() => selected ? ConsignmentEngine.getReturnSchedule(selected, NOW) : [], [selected, NOW]);

  if (!isOpen) return null;

  const handleSettle = () => {
    if (!selected) return;
    const settled = ConsignmentEngine.settle(selected, "VNDR-MGR", NOW);
    update(settled);
    onNotification?.("Settlement Created", `${selected.planNo} settled — billed ${fmt(settled.settlement!.totalBilledAmt)}`, "success");
  };

  const totalExposedValue = aging.reduce((s, i) => s + i.exposedValue, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fadeIn">
      <div className="flex flex-col w-full max-w-5xl max-h-[92vh] bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400">
              <span className="material-symbols-outlined text-2xl">inventory_2</span>
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100">Consignment Stock Engine</h2>
              <p className="text-xs text-slate-400">Vendor-Owned Stock · Sale-or-Return · Aging Bands · Return Schedule</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {(["DETAIL", "AGING", "MOVEMENTS"] as const).map((tab) => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${activeTab === tab ? "bg-teal-500/20 text-teal-300 border border-teal-500/30" : "text-slate-400 hover:text-slate-200"}`}>
                {tab === "MOVEMENTS" ? "Movement Ledger" : tab === "AGING" ? "Aging Report" : "Plan Detail"}
              </button>
            ))}
            <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors ml-2">
              <span className="material-symbols-outlined text-lg">close</span>
            </button>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Plan list */}
          <div className="w-56 border-r border-slate-800 overflow-y-auto bg-slate-950/30 p-3 space-y-2">
            {plans.map((p) => (
              <button key={p.planId} onClick={() => { setSelectedId(p.planId); setActiveTab("DETAIL"); }}
                className={`w-full text-left p-3 rounded-xl border transition-all ${selectedId === p.planId ? "bg-teal-950/20 border-teal-500/40" : "border-transparent hover:bg-slate-800/60"}`}>
                <p className="text-[10px] font-mono font-bold text-slate-200">{p.planNo}</p>
                <p className="text-xs text-slate-400 mt-0.5">{p.vendorName}</p>
                <p className="text-[10px] text-slate-500">{p.branchCode}</p>
                <div className="flex items-center justify-between mt-1.5">
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${p.status === "ACTIVE" ? "text-emerald-300 bg-emerald-500/15 border-emerald-500/25" : "text-teal-300 bg-teal-500/15 border-teal-500/25"}`}>{p.status}</span>
                  <span className="text-[10px] font-mono text-slate-400">{p.daysElapsed}d / {p.termDays}d</span>
                </div>
              </button>
            ))}
          </div>

          {selected && (
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {activeTab === "DETAIL" && (
                <>
                  <div className="flex items-start justify-between flex-wrap gap-3">
                    <div>
                      <p className="text-lg font-bold font-mono text-slate-100">{selected.planNo}</p>
                      <p className="text-xs text-slate-400">{selected.vendorName} · {selected.branchCode}</p>
                      <p className="text-[10px] text-slate-500">{selected.startDate} → {selected.endDate} ({selected.termDays} days)</p>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs font-bold px-3 py-1.5 rounded-full border ${selected.status === "ACTIVE" ? "text-emerald-300 bg-emerald-500/15 border-emerald-500/25" : "text-teal-300 bg-teal-500/15 border-teal-500/25"}`}>{selected.status}</span>
                      {selected.status === "ACTIVE" && (
                        <button onClick={handleSettle}
                          className="px-3 py-1.5 rounded-xl text-xs font-bold text-white bg-teal-600 hover:bg-teal-500 transition-all">
                          Settle Now
                        </button>
                      )}
                    </div>
                  </div>

                  {/* KPIs */}
                  <div className="grid grid-cols-4 gap-3">
                    {[
                      { label: "Total Received",    value: selected.totalReceived,                      color: "text-slate-300" },
                      { label: "Total Sold",         value: selected.totalSold,                          color: "text-teal-400" },
                      { label: "Billed Amount",      value: fmt(selected.totalBilledAmt),                color: "text-emerald-400" },
                      { label: "Days Remaining",     value: `${selected.daysRemaining}d`,                color: selected.daysRemaining <= 7 ? "text-rose-400" : "text-sky-400" },
                    ].map((m) => (
                      <div key={m.label} className="bg-slate-800/30 border border-slate-700/60 rounded-xl p-3 text-center">
                        <div className={`text-base font-black font-mono ${m.color}`}>{m.value}</div>
                        <div className="text-[10px] text-slate-500 uppercase tracking-wide mt-0.5">{m.label}</div>
                      </div>
                    ))}
                  </div>

                  {/* Lines table */}
                  <div className="bg-slate-950/40 border border-slate-800 rounded-xl overflow-hidden text-xs">
                    <div className="px-4 py-2 border-b border-slate-800 bg-slate-950/60">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Consignment Lines</p>
                    </div>
                    <table className="w-full text-left border-collapse">
                      <thead><tr className="text-slate-500 uppercase text-[10px] border-b border-slate-800">
                        <th className="py-2 px-3">Product</th>
                        <th className="py-2 px-3 text-right">Received</th>
                        <th className="py-2 px-3 text-right">Sold</th>
                        <th className="py-2 px-3 text-right">On Hand</th>
                        <th className="py-2 px-3 text-right">Billed</th>
                      </tr></thead>
                      <tbody className="divide-y divide-slate-800/40 font-mono">
                        {selected.lines.map((l) => (
                          <tr key={l.lineId}>
                            <td className="py-2 px-3 font-sans"><p className="text-xs text-slate-200">{l.productName}</p><p className="text-[10px] text-slate-500">{l.sku} · {fmt(l.vendorCost)}/unit</p></td>
                            <td className="py-2 px-3 text-right text-slate-400">{l.receivedQty}</td>
                            <td className="py-2 px-3 text-right text-teal-400">{l.soldQty}</td>
                            <td className="py-2 px-3 text-right text-slate-300">{l.onHandQty}</td>
                            <td className="py-2 px-3 text-right text-emerald-400">{fmt(l.billedAmt)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {selected.settlement && (
                    <div className="bg-teal-950/20 border border-teal-500/30 rounded-xl p-4">
                      <p className="text-xs font-bold text-teal-300 mb-2">Settlement — {new Date(selected.settlement.settledAt).toLocaleString("en-IN")}</p>
                      <div className="grid grid-cols-3 gap-3 text-xs text-center">
                        {[
                          { label: "Billed",   value: fmt(selected.settlement.totalBilledAmt), color: "text-emerald-400" },
                          { label: "For Return", value: String(selected.settlement.totalReturnQty), color: "text-amber-400" },
                          { label: "Sold",      value: String(selected.settlement.totalSold), color: "text-teal-400" },
                        ].map((m) => (
                          <div key={m.label} className="bg-slate-900/40 rounded-lg p-3">
                            <div className={`font-black font-mono ${m.color}`}>{m.value}</div>
                            <div className="text-[10px] text-slate-500 mt-0.5">{m.label}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}

              {activeTab === "AGING" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <p className="text-sm font-bold text-slate-200">Aging Report — {NOW.toLocaleDateString("en-IN")}</p>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-slate-500">Exposed Value:</span>
                      <span className="text-sm font-black font-mono text-orange-400">{fmt(totalExposedValue)}</span>
                    </div>
                  </div>
                  {returnSched.length > 0 && (
                    <div className="bg-rose-950/20 border border-rose-500/30 rounded-xl p-3">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-rose-400 mb-1">? Return Due ({returnSched.length} lines)</p>
                      <p className="text-xs text-slate-300">{returnSched.map((i) => `${i.productName} (${i.onHandQty} units)`).join(" · ")}</p>
                    </div>
                  )}
                  <div className="space-y-2">
                    {aging.length === 0 ? (
                      <p className="text-slate-500 text-sm text-center py-8">No on-hand stock to report.</p>
                    ) : aging.map((item) => (
                      <div key={item.sku} className="bg-slate-800/30 border border-slate-700/60 rounded-xl p-4 flex items-center justify-between flex-wrap gap-3">
                        <div>
                          <p className="text-xs font-medium text-slate-200">{item.productName}</p>
                          <p className="text-[10px] text-slate-500">{item.sku} · Received: {item.receivedDate}</p>
                        </div>
                        <div className="flex items-center gap-4 flex-wrap">
                          <div className="text-center"><div className="text-sm font-black font-mono text-slate-300">{item.daysOnFloor}d</div><div className="text-[9px] text-slate-500">On Floor</div></div>
                          <div className="text-center"><div className="text-sm font-black font-mono text-slate-300">{item.onHandQty}</div><div className="text-[9px] text-slate-500">On Hand</div></div>
                          <div className="text-center"><div className="text-sm font-black font-mono text-orange-400">{fmt(item.exposedValue)}</div><div className="text-[9px] text-slate-500">Exposed</div></div>
                          <span className={`text-[10px] font-bold px-2 py-1 rounded-full border ${BAND_STYLE[item.agingBand]}`}>{item.agingBand}</span>
                          {item.returnDue && <span className="text-[9px] font-bold text-rose-400 bg-rose-500/10 border border-rose-500/20 px-1.5 py-0.5 rounded-full">RETURN DUE</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === "MOVEMENTS" && (
                <div className="space-y-2">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Movement Ledger ({selected.movements.length} entries)</p>
                  <div className="bg-slate-950/40 border border-slate-800 rounded-xl overflow-hidden text-xs">
                    <table className="w-full text-left border-collapse">
                      <thead><tr className="text-slate-500 uppercase text-[10px] border-b border-slate-800 bg-slate-950/60">
                        <th className="py-2 px-3">Type</th>
                        <th className="py-2 px-3">SKU</th>
                        <th className="py-2 px-3 text-right">Qty</th>
                        <th className="py-2 px-3 text-right">Amount</th>
                        <th className="py-2 px-3">By</th>
                        <th className="py-2 px-3">When</th>
                      </tr></thead>
                      <tbody className="divide-y divide-slate-800/40 font-mono">
                        {[...selected.movements].reverse().map((m) => (
                          <tr key={m.movementId}>
                            <td className="py-2 px-3">
                              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${
                                m.type === "SOLD"     ? "text-teal-300 bg-teal-500/10 border-teal-500/20"
                                : m.type === "RECEIVED" ? "text-sky-300 bg-sky-500/10 border-sky-500/20"
                                : m.type === "RETURNED" ? "text-amber-300 bg-amber-500/10 border-amber-500/20"
                                : "text-slate-400 bg-slate-700/10 border-slate-600/20"
                              }`}>{m.type}</span>
                            </td>
                            <td className="py-2 px-3 text-slate-400 text-[10px]">{m.sku}</td>
                            <td className="py-2 px-3 text-right text-slate-300">{m.qty}</td>
                            <td className="py-2 px-3 text-right text-emerald-400">{fmt(m.totalAmt)}</td>
                            <td className="py-2 px-3 text-[10px] text-slate-500">{m.performedBy}</td>
                            <td className="py-2 px-3 text-[10px] text-slate-500">{new Date(m.timestamp).toLocaleDateString("en-IN")}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
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

export default ConsignmentStudioModal;

