/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.100.0
 * Created      : 2026-08-28
 * Modified     : 2026-08-28
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import React, { useState, useMemo } from "react";
import WavePickingOptimiser, {
  PickWave, Picker, Zone, PickTaskStatus,
} from "../../utils/wavePickingOptimiser";

interface WavePickingStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNotification?: (title: string, msg: string, type: "success" | "error" | "info") => void;
}

const STATUS_STYLE: Record<PickTaskStatus, string> = {
  PENDING: "text-blue-300 bg-blue-500/20 border-blue-500/30",
  PICKED:  "text-emerald-300 bg-emerald-500/20 border-emerald-500/30",
  SHORTED: "text-amber-300 bg-amber-500/20 border-amber-500/30",
  SKIPPED: "text-slate-400 bg-slate-700/30 border-slate-600/30",
};
const ZONE_COLORS: Record<Zone, string> = {
  A: "text-sky-300 bg-sky-500/20 border-sky-500/30",
  B: "text-violet-300 bg-violet-500/20 border-violet-500/30",
  C: "text-emerald-300 bg-emerald-500/20 border-emerald-500/30",
  D: "text-orange-300 bg-orange-500/20 border-orange-500/30",
  E: "text-rose-300 bg-rose-500/20 border-rose-500/30",
  F: "text-teal-300 bg-teal-500/20 border-teal-500/30",
};

const PICKERS: Picker[] = [
  { pickerId: "PKR-01", name: "Suresh Kumar",   currentZone: "A", isAvailable: true },
  { pickerId: "PKR-02", name: "Meena Pillai",   currentZone: "B", isAvailable: true },
  { pickerId: "PKR-03", name: "Ravi Shankar",   currentZone: "A", isAvailable: true },
  { pickerId: "PKR-04", name: "Anita Deshmukh", currentZone: "C", isAvailable: true },
];

const ORDER_LINES = [
  { orderId: "ORD-0841", lineNo: 1, sku: "APP-POLO-NAVY-M",  productName: "Polo Shirt Navy M",    requestedQty: 12, location: { zone: "A" as Zone, aisle: 1, bay: 3, level: 2 } },
  { orderId: "ORD-0841", lineNo: 2, sku: "APP-POLO-WHT-L",   productName: "Polo Shirt White L",   requestedQty: 8,  location: { zone: "A" as Zone, aisle: 1, bay: 7, level: 1 } },
  { orderId: "ORD-0841", lineNo: 3, sku: "APP-POLO-BLK-M",   productName: "Polo Shirt Black M",   requestedQty: 6,  location: { zone: "A" as Zone, aisle: 2, bay: 2, level: 3 } },
  { orderId: "ORD-0842", lineNo: 1, sku: "DNM-SLIM-BLU-32",  productName: "Slim Denim Blue 32",   requestedQty: 10, location: { zone: "B" as Zone, aisle: 3, bay: 1, level: 2 } },
  { orderId: "ORD-0842", lineNo: 2, sku: "DNM-SLIM-BLK-34",  productName: "Slim Denim Black 34",  requestedQty: 7,  location: { zone: "B" as Zone, aisle: 3, bay: 5, level: 1 } },
  { orderId: "ORD-0843", lineNo: 1, sku: "FTW-SNEAKER-WHT-9",productName: "Sneakers White 9",     requestedQty: 4,  location: { zone: "C" as Zone, aisle: 2, bay: 3, level: 1 } },
  { orderId: "ORD-0843", lineNo: 2, sku: "FTW-LOAFER-BRN-8", productName: "Loafers Brown 8",      requestedQty: 3,  location: { zone: "C" as Zone, aisle: 2, bay: 6, level: 2 } },
];

export const WavePickingStudioModal: React.FC<WavePickingStudioModalProps> = ({ isOpen, onClose, onNotification }) => {
  const [wave, setWave] = useState<PickWave | null>(null);
  const [activeTab, setActiveTab] = useState<"TASKS" | "PICKERS" | "METRICS">("TASKS");
  const [filterZone, setFilterZone] = useState<Zone | "ALL">("ALL");
  const [filterPicker, setFilterPicker] = useState<string>("ALL");

  const metrics = useMemo(() => wave ? WavePickingOptimiser.computeMetrics(wave) : null, [wave]);

  if (!isOpen) return null;

  const handleCreateWave = () => {
    const w = WavePickingOptimiser.createWave({ branchCode: "BR-MUM-01", orderLines: ORDER_LINES, pickers: PICKERS });
    setWave(WavePickingOptimiser.assignTasks(w));
    onNotification?.("Wave Created", `${w.totalTasks} tasks assigned to ${PICKERS.length} pickers.`, "success");
  };

  const handlePick = (taskId: string, full: boolean) => {
    if (!wave) return;
    const task = wave.tasks.find((t) => t.taskId === taskId)!;
    const qty = full ? task.requestedQty : Math.floor(task.requestedQty * 0.6);
    setWave(WavePickingOptimiser.recordPick(wave, taskId, qty));
  };

  const displayTasks = wave?.tasks.filter((t) => {
    if (filterZone !== "ALL" && t.location.zone !== filterZone) return false;
    if (filterPicker !== "ALL" && t.pickerId !== filterPicker) return false;
    return true;
  }).sort((a, b) => a.sortKey - b.sortKey) ?? [];

  const zones: Zone[] = ["A", "B", "C", "D", "E", "F"];
  const progressPct = wave ? Math.round(((wave.completedTasks + wave.shortedTasks) / wave.totalTasks) * 100) : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fadeIn">
      <div className="flex flex-col w-full max-w-5xl max-h-[92vh] bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-400">
              <span className="material-symbols-outlined text-2xl">forklift</span>
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100">Warehouse Wave Picking Optimiser</h2>
              <p className="text-xs text-slate-400">Batch Wave · Zone Routing · Serpentine Path · Picker Assignment · Short Detection</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {(["TASKS", "PICKERS", "METRICS"] as const).map((tab) => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${activeTab === tab ? "bg-orange-500/20 text-orange-300 border border-orange-500/30" : "text-slate-400 hover:text-slate-200"}`}>
                {tab}
              </button>
            ))}
            {!wave ? (
              <button onClick={handleCreateWave} className="px-4 py-1.5 rounded-xl text-xs font-bold text-white bg-orange-600 hover:bg-orange-500 transition-all shadow-lg shadow-orange-500/20 ml-2">
                ðŸŒŠ Create Wave
              </button>
            ) : (
              <span className={`text-xs font-bold px-3 py-1.5 rounded-full border ml-2 ${wave.status === "COMPLETED" ? "text-emerald-300 bg-emerald-500/20 border-emerald-500/30" : "text-orange-300 bg-orange-500/20 border-orange-500/30"}`}>
                {wave.status}
              </span>
            )}
            <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors ml-1">
              <span className="material-symbols-outlined text-lg">close</span>
            </button>
          </div>
        </div>

        {/* Progress bar */}
        {wave && (
          <div className="px-6 py-2 border-b border-slate-800 bg-slate-950/30">
            <div className="flex items-center justify-between text-[10px] text-slate-500 mb-1">
              <span>Wave Progress — {wave.waveId}</span>
              <span>{wave.completedTasks + wave.shortedTasks}/{wave.totalTasks} tasks ({progressPct}%)</span>
            </div>
            <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full bg-orange-500 rounded-full transition-all duration-500" style={{ width: `${progressPct}%` }} />
            </div>
          </div>
        )}

        {!wave ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-400 mx-auto">
                <span className="material-symbols-outlined text-4xl">inventory</span>
              </div>
              <p className="text-slate-400 text-sm">No active wave. Click <strong className="text-orange-400">Create Wave</strong> to begin.</p>
              <p className="text-slate-600 text-xs">{ORDER_LINES.length} order lines · {PICKERS.length} pickers available</p>
            </div>
          </div>
        ) : activeTab === "TASKS" ? (
          <div className="flex flex-1 overflow-hidden">
            {/* Filters */}
            <div className="w-48 border-r border-slate-800 bg-slate-950/30 p-3 space-y-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">Zone</p>
                <div className="space-y-1">
                  <button onClick={() => setFilterZone("ALL")} className={`w-full text-left text-xs px-2 py-1.5 rounded-lg transition-all ${filterZone === "ALL" ? "bg-orange-500/20 text-orange-300 font-bold" : "text-slate-400 hover:bg-slate-800/60"}`}>All Zones</button>
                  {zones.filter((z) => wave.tasks.some((t) => t.location.zone === z)).map((z) => (
                    <button key={z} onClick={() => setFilterZone(z)} className={`w-full text-left text-xs px-2 py-1.5 rounded-lg flex items-center gap-2 transition-all ${filterZone === z ? "bg-orange-500/20 text-orange-300 font-bold" : "text-slate-400 hover:bg-slate-800/60"}`}>
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${ZONE_COLORS[z]}`}>Zone {z}</span>
                      <span className="text-slate-500">({wave.tasks.filter((t) => t.location.zone === z).length})</span>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">Picker</p>
                <div className="space-y-1">
                  <button onClick={() => setFilterPicker("ALL")} className={`w-full text-left text-xs px-2 py-1.5 rounded-lg transition-all ${filterPicker === "ALL" ? "bg-orange-500/20 text-orange-300 font-bold" : "text-slate-400 hover:bg-slate-800/60"}`}>All Pickers</button>
                  {PICKERS.map((p) => (
                    <button key={p.pickerId} onClick={() => setFilterPicker(p.pickerId)} className={`w-full text-left text-xs px-2 py-1.5 rounded-lg transition-all ${filterPicker === p.pickerId ? "bg-orange-500/20 text-orange-300 font-bold" : "text-slate-400 hover:bg-slate-800/60"}`}>
                      {p.name.split(" ")[0]}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Task list */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {displayTasks.map((task) => {
                const picker = PICKERS.find((p) => p.pickerId === task.pickerId);
                return (
                  <div key={task.taskId} className={`flex items-center justify-between p-3 rounded-xl border transition-all ${task.status === "PENDING" ? "bg-slate-800/30 border-slate-700/50" : "bg-slate-900/40 border-slate-800/40"}`}>
                    <div className="flex items-center gap-3 min-w-0">
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border flex-shrink-0 ${ZONE_COLORS[task.location.zone]}`}>
                        {task.location.zone}{task.location.aisle}-{task.location.bay}-L{task.location.level}
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-slate-200 truncate">{task.productName}</p>
                        <p className="text-[10px] text-slate-500">{task.orderId} · {picker?.name.split(" ")[0] ?? "Unassigned"}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                      <span className="text-xs font-mono text-slate-400">{task.pickedQty ?? 0}/{task.requestedQty}</span>
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${STATUS_STYLE[task.status]}`}>{task.status}</span>
                      {task.status === "PENDING" && (
                        <div className="flex gap-1">
                          <button onClick={() => handlePick(task.taskId, true)} className="px-2 py-1 text-[10px] font-bold rounded-lg bg-emerald-600/20 text-emerald-400 border border-emerald-600/30 hover:bg-emerald-600/30">Full</button>
                          <button onClick={() => handlePick(task.taskId, false)} className="px-2 py-1 text-[10px] font-bold rounded-lg bg-amber-600/20 text-amber-400 border border-amber-600/30 hover:bg-amber-600/30">Short</button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : activeTab === "PICKERS" ? (
          <div className="flex-1 overflow-y-auto p-5">
            <div className="grid grid-cols-2 gap-4">
              {PICKERS.map((p) => {
                const tasks = wave.tasks.filter((t) => t.pickerId === p.pickerId);
                const picked = tasks.filter((t) => t.status === "PICKED").length;
                const pending = tasks.filter((t) => t.status === "PENDING").length;
                const pct = tasks.length > 0 ? Math.round((picked / tasks.length) * 100) : 0;
                return (
                  <div key={p.pickerId} className="bg-slate-800/30 border border-slate-700/60 rounded-2xl p-5">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="text-sm font-bold text-slate-100">{p.name}</p>
                        <p className="text-[10px] text-slate-400">{p.pickerId} · Zone {p.currentZone}</p>
                      </div>
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${ZONE_COLORS[p.currentZone!]}`}>Zone {p.currentZone}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center mb-3">
                      {[{ l: "Assigned", v: tasks.length, c: "text-slate-300" }, { l: "Picked", v: picked, c: "text-emerald-400" }, { l: "Pending", v: pending, c: "text-blue-400" }].map((m) => (
                        <div key={m.l} className="bg-slate-900/60 rounded-xl p-2 border border-slate-800/40">
                          <div className={`text-lg font-black font-mono ${m.c}`}>{m.v}</div>
                          <div className="text-[9px] text-slate-500 mt-0.5">{m.l}</div>
                        </div>
                      ))}
                    </div>
                    <div>
                      <div className="flex justify-between text-[10px] text-slate-500 mb-1"><span>Progress</span><span>{pct}%</span></div>
                      <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                        <div className="h-full bg-orange-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : metrics ? (
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: "Total Tasks",     value: metrics.totalTasks, color: "text-slate-300" },
                { label: "Completion Rate", value: `${metrics.completionRate}%`, color: "text-emerald-400" },
                { label: "Short Rate",      value: `${metrics.shortRate}%`, color: metrics.shortRate > 0 ? "text-amber-400" : "text-slate-500" },
                { label: "Units Picked",    value: `${metrics.totalUnitsPicked}/${metrics.totalUnitsRequested}`, color: "text-sky-400" },
              ].map((m) => (
                <div key={m.label} className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-4 text-center">
                  <div className={`text-xl font-black font-mono ${m.color}`}>{m.value}</div>
                  <div className="text-[10px] text-slate-500 uppercase tracking-wide mt-0.5">{m.label}</div>
                </div>
              ))}
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Picker Utilisation</p>
              {Object.entries(metrics.pickerUtilisation).map(([pid, count]) => {
                const picker = PICKERS.find((p) => p.pickerId === pid);
                const pct = metrics.totalTasks > 0 ? Math.round((count / metrics.totalTasks) * 100) : 0;
                return (
                  <div key={pid} className="flex items-center gap-3 mb-2">
                    <span className="text-xs text-slate-300 w-28">{picker?.name.split(" ")[0] ?? pid}</span>
                    <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
                      <div className="h-full bg-orange-500 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-xs font-mono text-slate-400 w-12 text-right">{count} tasks</span>
                  </div>
                );
              })}
              <p className="text-[10px] text-slate-500 mt-2">Avg tasks/picker: {metrics.avgTasksPerPicker}</p>
            </div>
          </div>
        ) : null}

        <div className="flex items-center justify-end px-6 py-3 border-t border-slate-800 bg-slate-950/80">
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors">Close</button>
        </div>
      </div>
    </div>
  );
};

export default WavePickingStudioModal;

