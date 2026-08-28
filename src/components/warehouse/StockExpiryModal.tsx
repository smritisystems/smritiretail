/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.117.0
 * Created      : 2026-08-28
 * Modified     : 2026-08-28
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import React, { useState, useMemo } from "react";
import StockExpiryEngine, { StockBatch, BatchStatus } from "../../../utils/stockExpiryEngine";

interface StockExpiryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNotification?: (title: string, msg: string, type: "success" | "error" | "info") => void;
}

const STATUS_STYLE: Record<BatchStatus, string> = {
  AVAILABLE:   "text-emerald-300 bg-emerald-500/15 border-emerald-500/25",
  RESERVED:    "text-sky-300 bg-sky-500/15 border-sky-500/25",
  QUARANTINED: "text-amber-300 bg-amber-500/15 border-amber-500/25",
  EXPIRED:     "text-rose-400 bg-rose-500/15 border-rose-500/25",
  DEPLETED:    "text-slate-400 bg-slate-700/15 border-slate-600/25",
  RECALLED:    "text-red-400 bg-red-500/15 border-red-500/25",
};

const EXPIRY_BADGE = (days: number) =>
  days < 0   ? "text-rose-400"
  : days <= 7  ? "text-rose-300"
  : days <= 30 ? "text-amber-300"
  : "text-emerald-400";

function buildSampleBatches(): StockBatch[] {
  const now = new Date("2026-09-01");
  const make = (no: string, sku: string, name: string, exp: string, qty: number) =>
    StockExpiryEngine.registerBatch({ batchNo: no, sku, productName: name, branchCode: "BR-MUM-01", mfgDate: "2026-01-01", expiryDate: exp, receivedQty: qty, unitCost: 12 });

  const b1 = make("BT-2026-001", "MED-PARA-500", "Paracetamol 500mg",   "2026-09-10", 100);
  const b2 = make("BT-2026-002", "MED-PARA-500", "Paracetamol 500mg",   "2026-12-31",  80);
  const b3 = make("BT-2026-003", "MED-AMOX-250", "Amoxicillin 250mg",   "2026-09-20",  60);
  const b4 = make("BT-2026-004", "MED-AMOX-250", "Amoxicillin 250mg",   "2027-06-01",  50);
  const b5e = StockExpiryEngine.expireIfDue(
    make("BT-2026-OLD", "MED-PARA-500", "Paracetamol 500mg", "2026-08-01", 20),
    now
  );
  const b3q = StockExpiryEngine.quarantineBatch(b3, "Label defect", 20, "QC-001");
  return [b1, b2, b3q, b4, b5e];
}

export const StockExpiryModal: React.FC<StockExpiryModalProps> = ({ isOpen, onClose, onNotification }) => {
  const asOf = useMemo(() => new Date("2026-09-01"), []);
  const [batches, setBatches] = useState<StockBatch[]>(buildSampleBatches);
  const [selectedId, setSelectedId] = useState(batches[0]?.batchId ?? "");
  const [activeTab, setActiveTab] = useState<"BATCHES" | "NEAR_EXPIRY" | "REPORT">("BATCHES");

  const selected  = batches.find((b) => b.batchId === selectedId);
  const nearExpiry = useMemo(() => StockExpiryEngine.nearExpiryBatches(batches, 30, asOf), [batches]);
  const report    = useMemo(() => StockExpiryEngine.batchReport(batches, asOf), [batches]);

  if (!isOpen) return null;

  const daysTo = (exp: string) => Math.floor((new Date(exp).getTime() - asOf.getTime()) / 86400000);

  const handleQuarantine = () => {
    if (!selected || selected.availableQty < 1) return;
    try {
      const updated = StockExpiryEngine.quarantineBatch(selected, "Manual QC hold", selected.availableQty, "QC-001");
      setBatches((prev) => prev.map((b) => b.batchId === updated.batchId ? updated : b));
      onNotification?.("Quarantined", `${updated.batchNo} — ${updated.quarantinedQty} units held`, "info");
    } catch (e: any) { onNotification?.("Error", e.message, "error"); }
  };

  const handleRelease = () => {
    if (!selected || selected.quarantinedQty < 1) return;
    try {
      const updated = StockExpiryEngine.releaseFromQuarantine(selected, selected.quarantinedQty, "QC-001");
      setBatches((prev) => prev.map((b) => b.batchId === updated.batchId ? updated : b));
      onNotification?.("Released", `${updated.batchNo} — ${updated.availableQty} units released`, "success");
    } catch (e: any) { onNotification?.("Error", e.message, "error"); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fadeIn">
      <div className="flex flex-col w-full max-w-5xl max-h-[92vh] bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-2xl">🧪</div>
            <div>
              <h2 className="text-base font-bold text-slate-100">Stock Expiry & Batch Tracking Engine</h2>
              <p className="text-xs text-slate-400">FEFO Allocation · Near-Expiry Alerts · Quarantine · Batch Report</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {(["BATCHES", "NEAR_EXPIRY", "REPORT"] as const).map((tab) => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${activeTab === tab ? "bg-teal-500/20 text-teal-300 border border-teal-500/30" : "text-slate-400 hover:text-slate-200"}`}>
                {tab === "NEAR_EXPIRY" ? `Near Expiry (${nearExpiry.length})` : tab === "REPORT" ? "SKU Report" : "Batches"}
              </button>
            ))}
            <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 ml-2">
              <span className="material-symbols-outlined text-lg">close</span>
            </button>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Batch sidebar */}
          <div className="w-56 border-r border-slate-800 overflow-y-auto bg-slate-950/30 p-3 space-y-2">
            {batches.map((b) => (
              <button key={b.batchId} onClick={() => { setSelectedId(b.batchId); setActiveTab("BATCHES"); }}
                className={`w-full text-left p-3 rounded-xl border transition-all ${selectedId === b.batchId ? "bg-teal-950/20 border-teal-500/40" : "border-transparent hover:bg-slate-800/60"}`}>
                <p className="text-[10px] font-mono font-bold text-slate-200">{b.batchNo}</p>
                <p className="text-[10px] text-slate-500 truncate">{b.productName}</p>
                <p className="text-xs font-bold text-teal-400 mt-0.5">{b.availableQty} avail</p>
                <div className="flex gap-1 mt-1.5 flex-wrap">
                  <span className={`text-[8px] font-bold px-1 py-0.5 rounded-full border ${STATUS_STYLE[b.status]}`}>{b.status}</span>
                  <span className={`text-[8px] font-bold ${EXPIRY_BADGE(daysTo(b.expiryDate))}`}>{daysTo(b.expiryDate)}d</span>
                </div>
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            {activeTab === "BATCHES" && selected && (
              <>
                <div className="flex items-start justify-between flex-wrap gap-3">
                  <div>
                    <p className="text-lg font-bold font-mono text-slate-100">{selected.batchNo}</p>
                    <p className="text-xs text-slate-400">{selected.productName} · {selected.sku} · {selected.branchCode}</p>
                    {selected.lotNo && <p className="text-[10px] text-slate-500">Lot: {selected.lotNo}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-bold px-2 py-1 rounded-full border ${STATUS_STYLE[selected.status]}`}>{selected.status}</span>
                    {selected.status === "AVAILABLE" && <button onClick={handleQuarantine} className="px-3 py-1.5 text-xs font-bold text-amber-300 border border-amber-500/30 hover:bg-amber-950/30 rounded-xl">Quarantine All</button>}
                    {selected.status === "QUARANTINED" && <button onClick={handleRelease} className="px-3 py-1.5 text-xs font-bold text-emerald-300 border border-emerald-500/30 hover:bg-emerald-950/30 rounded-xl">Release</button>}
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-3">
                  {[
                    { label: "Received",     value: selected.receivedQty,    color: "text-slate-400" },
                    { label: "Available",    value: selected.availableQty,   color: "text-teal-400 font-black" },
                    { label: "Quarantined",  value: selected.quarantinedQty, color: "text-amber-400" },
                    { label: "Days to Exp.", value: `${daysTo(selected.expiryDate)}d`, color: EXPIRY_BADGE(daysTo(selected.expiryDate)) },
                  ].map((m) => (
                    <div key={m.label} className="bg-slate-800/30 border border-slate-700/60 rounded-xl p-3 text-center">
                      <div className={`font-bold font-mono ${m.color}`}>{m.value}</div>
                      <div className="text-[10px] text-slate-500 uppercase tracking-wide mt-0.5">{m.label}</div>
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  {[
                    { label: "MFG Date",    value: selected.mfgDate },
                    { label: "Expiry Date", value: selected.expiryDate },
                    { label: "Unit Cost",   value: `₹${selected.unitCost}` },
                    { label: "Supplier",    value: selected.supplierId ?? "—" },
                  ].map((m) => (
                    <div key={m.label} className="flex items-center justify-between px-3 py-2 bg-slate-800/30 border border-slate-700/60 rounded-lg">
                      <span className="text-slate-500">{m.label}</span>
                      <span className="font-mono text-slate-300">{m.value}</span>
                    </div>
                  ))}
                </div>
                {selected.quarantineReason && (
                  <div className="p-3 bg-amber-950/20 border border-amber-500/20 rounded-lg text-xs text-amber-400">
                    ⚠ Quarantine Reason: {selected.quarantineReason}
                  </div>
                )}
              </>
            )}

            {activeTab === "NEAR_EXPIRY" && (
              <div className="space-y-3">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Batches Expiring Within 30 Days</p>
                {nearExpiry.length === 0 && <p className="text-slate-500 text-sm text-center py-8">No batches near expiry.</p>}
                {nearExpiry.map((b) => (
                  <div key={b.batchId} className={`flex items-center justify-between px-4 py-3 rounded-xl border ${b.daysToExpiry <= 7 ? "bg-rose-950/20 border-rose-500/30" : "bg-amber-950/10 border-amber-500/20"}`}>
                    <div>
                      <p className="text-xs font-mono font-bold text-slate-200">{b.batchNo}</p>
                      <p className="text-[10px] text-slate-400">{b.productName} · {b.sku}</p>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-black font-mono ${EXPIRY_BADGE(b.daysToExpiry)}`}>{b.daysToExpiry}d left</p>
                      <p className="text-[10px] text-slate-500">{b.availableQty} units · Exp: {b.expiryDate.slice(0, 10)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeTab === "REPORT" && (
              <div className="space-y-4">
                {report.map((r) => (
                  <div key={r.sku} className="bg-slate-800/20 border border-slate-700/60 rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-bold text-slate-200">{r.productName}</p>
                        <p className="text-[10px] font-mono text-slate-500">{r.sku}</p>
                      </div>
                      <p className="text-[10px] text-slate-500">{r.totalBatches} batch(es)</p>
                    </div>
                    <div className="grid grid-cols-4 gap-2 text-center text-xs">
                      {[
                        { label: "Available",    value: r.totalAvailable,    color: "text-teal-400" },
                        { label: "Near Exp 30d", value: r.nearExpiry30d,     color: "text-amber-400" },
                        { label: "Quarantined",  value: r.totalQuarantined,  color: "text-amber-300" },
                        { label: "Expired",      value: r.totalExpired,      color: "text-rose-400" },
                      ].map((m) => (
                        <div key={m.label} className="bg-slate-900/40 rounded-lg py-2">
                          <div className={`font-bold font-mono ${m.color}`}>{m.value}</div>
                          <div className="text-[9px] text-slate-600 uppercase">{m.label}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end px-6 py-3 border-t border-slate-800 bg-slate-950/80">
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors">Close</button>
        </div>
      </div>
    </div>
  );
};

export default StockExpiryModal;
