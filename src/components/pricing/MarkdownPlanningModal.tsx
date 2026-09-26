/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.106.0
 * Created      : 2026-08-28
 * Modified     : 2026-08-28
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import React, { useState, useMemo } from "react";
import MarkdownEngine, {
  MarkdownPlan, MarkdownStatus, SellThroughReport,
} from "../../utils/markdownEngine";

interface MarkdownPlanningModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNotification?: (title: string, msg: string, type: "success" | "error" | "info") => void;
}

const STATUS_STYLE: Record<MarkdownStatus, string> = {
  DRAFT:     "text-slate-400 bg-slate-700/30 border-slate-600/30",
  ACTIVE:    "text-emerald-300 bg-emerald-500/20 border-emerald-500/30",
  PAUSED:    "text-amber-300 bg-amber-500/20 border-amber-500/30",
  COMPLETED: "text-teal-300 bg-teal-500/20 border-teal-500/30",
  CANCELLED: "text-slate-500 bg-slate-800/30 border-slate-700/30",
};

function buildSamplePlans(): MarkdownPlan[] {
  let p1 = MarkdownEngine.createPlan({
    planName: "End-of-Season Clearance Aug-Sep 2026",
    branchCode: "BR-MUM-01", season: "CLEARANCE-AUG2026",
    targetSellThroughPct: 80, deadline: "2026-09-30",
    skus: [
      { sku: "FAB-COTTON-WHT", productName: "Cotton White 1m", basePrice: 120, openingStock: 200 },
      { sku: "FAB-DENIM-BLU",  productName: "Denim Blue 1m",   basePrice: 250, openingStock: 100 },
      { sku: "ACC-BELT-BRN",   productName: "Leather Belt Brown", basePrice: 350, openingStock: 60 },
    ],
    steps: [
      { activateOn: "2026-08-15", discountPct: 10 },
      { activateOn: "2026-09-01", discountPct: 20 },
      { activateOn: "2026-09-15", discountPct: 35 },
    ],
    trigger: "SCHEDULED",
  });
  p1 = MarkdownEngine.activate(p1, "MGR-01");
  p1 = MarkdownEngine.applyStep(p1, 1);
  p1 = MarkdownEngine.recordSellThrough(p1, [
    { sku: "FAB-COTTON-WHT", unitsSold: 80,  currentStock: 120 },
    { sku: "FAB-DENIM-BLU",  unitsSold: 30,  currentStock: 70  },
    { sku: "ACC-BELT-BRN",   unitsSold: 18,  currentStock: 42  },
  ]);
  p1 = { ...p1, createdAt: "2026-08-01T00:00:00.000Z" };
  p1 = MarkdownEngine.checkAutoTrigger(p1, new Date("2026-09-10T00:00:00.000Z"));

  let p2 = MarkdownEngine.createPlan({
    planName: "Monsoon Season Overstocks",
    branchCode: "BR-DEL-01", season: "MONSOON2026",
    targetSellThroughPct: 70, deadline: "2026-10-15",
    skus: [
      { sku: "FAB-LINEN-WHT",  productName: "Linen White 1m",  basePrice: 180, openingStock: 150 },
      { sku: "FAB-COTTON-BLK", productName: "Cotton Black 1m", basePrice: 110, openingStock: 200 },
    ],
    steps: [
      { activateOn: "2026-09-01", discountPct: 15 },
      { activateOn: "2026-10-01", discountPct: 30 },
    ],
    trigger: "AUTO_THRESHOLD",
  });
  p2 = MarkdownEngine.activate(p2, "MGR-DEL");
  p2 = MarkdownEngine.recordSellThrough(p2, [
    { sku: "FAB-LINEN-WHT",  unitsSold: 90, currentStock: 60 },
    { sku: "FAB-COTTON-BLK", unitsSold: 100, currentStock: 100 },
  ]);

  return [p1, p2];
}

export const MarkdownPlanningModal: React.FC<MarkdownPlanningModalProps> = ({ isOpen, onClose, onNotification }) => {
  const [plans, setPlans]       = useState<MarkdownPlan[]>(buildSamplePlans);
  const [selectedId, setSelectedId] = useState(plans[0]?.planId ?? "");
  const [activeTab, setActiveTab]   = useState<"DETAIL" | "REPORT">("DETAIL");

  const selected = plans.find((p) => p.planId === selectedId);
  const update   = (p: MarkdownPlan) => setPlans((prev) => prev.map((x) => x.planId === p.planId ? p : x));

  const report: SellThroughReport | null = useMemo(() =>
    selected ? MarkdownEngine.generateReport(selected, new Date()) : null,
  [selected]);

  if (!isOpen) return null;

  const applyStep = (stepNo: number) => {
    if (!selected) return;
    const u = MarkdownEngine.applyStep(selected, stepNo);
    update(u);
    onNotification?.("Step Applied", `Step ${stepNo} (${u.steps.find((s) => s.stepNo === stepNo)?.discountPct}% off) activated`, "success");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fadeIn">
      <div className="flex flex-col w-full max-w-5xl max-h-[92vh] bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-400">
              <span className="material-symbols-outlined text-2xl">trending_down</span>
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100">Markdown & Clearance Planning Engine</h2>
              <p className="text-xs text-slate-400">SKU-Level Markdown Steps · Sell-Through Tracking · Auto-Trigger Recommendations</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {(["DETAIL", "REPORT"] as const).map((tab) => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${activeTab === tab ? "bg-orange-500/20 text-orange-300 border border-orange-500/30" : "text-slate-400 hover:text-slate-200"}`}>
                {tab === "REPORT" ? "Sell-Through Report" : "Plan Detail"}
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
                className={`w-full text-left p-3 rounded-xl border transition-all ${selectedId === p.planId ? "bg-orange-950/20 border-orange-500/40" : "border-transparent hover:bg-slate-800/60"}`}>
                <p className="text-xs font-medium text-slate-200 leading-tight">{p.planName}</p>
                <p className="text-[10px] text-slate-500 mt-0.5">{p.branchCode}</p>
                <div className="flex items-center justify-between mt-1.5">
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${STATUS_STYLE[p.status]}`}>{p.status}</span>
                  <span className="text-[10px] font-mono text-slate-400">{p.currentAvgSellThrough}%</span>
                </div>
                {p.autoTriggerFired && <p className="text-[9px] text-orange-400 mt-1">? Auto-trigger fired</p>}
              </button>
            ))}
          </div>

          {selected && (
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {activeTab === "DETAIL" && (
                <>
                  <div className="flex items-start justify-between flex-wrap gap-3">
                    <div>
                      <p className="text-base font-bold text-slate-100">{selected.planName}</p>
                      <p className="text-xs text-slate-400">{selected.branchCode} · {selected.season} · Target: {selected.targetSellThroughPct}% by {selected.deadline}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs font-bold px-3 py-1.5 rounded-full border ${STATUS_STYLE[selected.status]}`}>{selected.status}</span>
                      {selected.autoTriggerFired && selected.nextRecommendedStep && (
                        <button onClick={() => applyStep(selected.nextRecommendedStep!)}
                          className="px-3 py-1.5 rounded-xl text-xs font-bold text-white bg-orange-600 hover:bg-orange-500 transition-all flex items-center gap-1">
                          ? Apply Step {selected.nextRecommendedStep}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Sell-through gauge */}
                  <div className="bg-slate-800/30 border border-slate-700/60 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-slate-400">Sell-Through Progress</span>
                      <span className="text-sm font-black font-mono text-orange-400">{selected.currentAvgSellThrough}% / {selected.targetSellThroughPct}%</span>
                    </div>
                    <div className="h-3 bg-slate-800 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all"
                        style={{ width: `${Math.min(100, (selected.currentAvgSellThrough / selected.targetSellThroughPct) * 100)}%`,
                          background: selected.currentAvgSellThrough >= selected.targetSellThroughPct ? "#10b981" : "#f97316" }} />
                    </div>
                    <div className="flex justify-between text-[10px] text-slate-600 mt-1">
                      <span>0%</span>
                      <span className="text-slate-500">Gap: {selected.sellThroughGap}%</span>
                      <span>{selected.targetSellThroughPct}%</span>
                    </div>
                  </div>

                  {/* Markdown steps */}
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Markdown Steps</p>
                    <div className="grid grid-cols-3 gap-3">
                      {selected.steps.map((s) => (
                        <div key={s.stepNo} onClick={() => applyStep(s.stepNo)}
                          className={`cursor-pointer rounded-xl border p-3 text-center transition-all hover:border-orange-500/40 ${s.isActive ? "bg-orange-950/20 border-orange-500/40" : "bg-slate-800/30 border-slate-700/50"}`}>
                          <div className="text-lg font-black text-orange-400">{s.discountPct}% OFF</div>
                          <div className="text-[10px] text-slate-500 mt-0.5">Step {s.stepNo} — {s.activateOn}</div>
                          {s.isActive && <div className="text-[9px] text-emerald-400 font-bold mt-1">? ACTIVE</div>}
                          {s.activatedAt && <div className="text-[9px] text-slate-600 mt-0.5">{new Date(s.activatedAt).toLocaleDateString("en-IN")}</div>}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* SKU table */}
                  <div className="bg-slate-950/40 border border-slate-800 rounded-xl overflow-hidden text-xs">
                    <div className="px-4 py-2 border-b border-slate-800 bg-slate-950/60">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">SKU Performance</p>
                    </div>
                    <table className="w-full text-left border-collapse">
                      <thead><tr className="text-slate-500 uppercase text-[10px] border-b border-slate-800">
                        <th className="py-2 px-3">Product</th>
                        <th className="py-2 px-3 text-right">Opening</th>
                        <th className="py-2 px-3 text-right">Sold</th>
                        <th className="py-2 px-3 text-right">ST%</th>
                        <th className="py-2 px-3 text-right">Effective Price</th>
                        <th className="py-2 px-3 text-right">Step</th>
                      </tr></thead>
                      <tbody className="divide-y divide-slate-800/40">
                        {selected.skuLines.map((l) => (
                          <tr key={l.sku}>
                            <td className="py-2 px-3"><p className="text-slate-200">{l.productName}</p><p className="text-[10px] text-slate-500">{l.sku}</p></td>
                            <td className="py-2 px-3 text-right font-mono text-slate-400">{l.openingStock}</td>
                            <td className="py-2 px-3 text-right font-mono text-slate-300">{l.unitsSold}</td>
                            <td className="py-2 px-3 text-right font-mono">
                              <span className={l.sellThroughPct >= selected.targetSellThroughPct ? "text-emerald-400" : l.sellThroughPct >= 50 ? "text-amber-400" : "text-rose-400"}>
                                {l.sellThroughPct}%
                              </span>
                            </td>
                            <td className="py-2 px-3 text-right font-mono">
                              <span className="text-orange-400">₹{l.currentEffectivePrice}</span>
                              <span className="text-slate-600 ml-1 text-[10px]">(was ₹{l.basePrice})</span>
                            </td>
                            <td className="py-2 px-3 text-right font-mono text-slate-400">{l.currentMarkdownStep > 0 ? `Step ${l.currentMarkdownStep}` : "Base"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}

              {activeTab === "REPORT" && report && (
                <div className="space-y-5">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { label: "Days Elapsed",    value: `${report.daysElapsed}/${report.daysTotal}`, color: "text-slate-300" },
                      { label: "Time Elapsed",    value: `${report.timeElapsedPct}%`,   color: "text-slate-300" },
                      { label: "Current ST%",     value: `${report.currentAvgSellThrough}%`, color: report.onTrack ? "text-emerald-400" : "text-rose-400" },
                      { label: "Pace Status",     value: report.onTrack ? "On Track" : "Behind", color: report.onTrack ? "text-emerald-400" : "text-rose-400" },
                    ].map((m) => (
                      <div key={m.label} className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-4 text-center">
                        <div className={`text-xl font-black font-mono ${m.color}`}>{m.value}</div>
                        <div className="text-[10px] text-slate-500 uppercase tracking-wide mt-0.5">{m.label}</div>
                      </div>
                    ))}
                  </div>

                  {report.recommendation && (
                    <div className="bg-orange-950/20 border border-orange-500/30 rounded-xl p-4">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-orange-400 mb-1">? Auto-Trigger Recommendation</p>
                      <p className="text-xs text-slate-200">{report.recommendation}</p>
                    </div>
                  )}

                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">SKU Sell-Through Breakdown</p>
                    <div className="space-y-2">
                      {report.skuLines.map((l) => (
                        <div key={l.sku} className="bg-slate-800/30 border border-slate-700/60 rounded-xl p-3">
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-xs text-slate-300">{l.productName}</span>
                            <div className="flex items-center gap-3">
                              <span className="text-[10px] font-mono text-orange-400">₹{l.currentEffectivePrice}</span>
                              <span className={`text-sm font-black font-mono ${l.sellThroughPct >= selected.targetSellThroughPct ? "text-emerald-400" : l.sellThroughPct >= 50 ? "text-amber-400" : "text-rose-400"}`}>{l.sellThroughPct}%</span>
                            </div>
                          </div>
                          <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                            <div className="h-full rounded-full transition-all" style={{ width: `${l.sellThroughPct}%`, background: l.sellThroughPct >= selected.targetSellThroughPct ? "#10b981" : l.sellThroughPct >= 50 ? "#f59e0b" : "#f97316" }} />
                          </div>
                        </div>
                      ))}
                    </div>
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

export default MarkdownPlanningModal;

